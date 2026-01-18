import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase env vars for pro submit');
}

const supabase = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '' // SERVER ONLY
);

const PRO_ALLOWLIST_PRIVATE_KEY =
  process.env.PRO_ALLOWLIST_PRIVATE_KEY || process.env.PRIVATE_KEY;
const PRO_ALLOWLIST_RPC =
  process.env.PRO_ALLOWLIST_RPC || process.env.BASE_RPC || process.env.RPC_URL;
const FACTORY_SCHEDULED_ADDRESS = process.env.FACTORY_SCHEDULED_ADDRESS;
const FACTORY_RECURRING_ADDRESS = process.env.FACTORY_RECURRING_ADDRESS;

const PRO_ALLOWLIST_ABI = [
  {
    type: "function",
    name: "setProWallets",
    inputs: [
      { name: "wallets", type: "address[]" },
      { name: "isPro", type: "bool" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  }
] as const;

const TIMEOUT_MS = 8000;

async function setProWalletOnChain(wallet: string, isPro: boolean) {
  if (!PRO_ALLOWLIST_PRIVATE_KEY || !PRO_ALLOWLIST_RPC) {
    console.warn("Missing PRO allowlist env vars");
    return { ok: false, reason: "MISSING_ENV" };
  }

  if (!FACTORY_SCHEDULED_ADDRESS && !FACTORY_RECURRING_ADDRESS) {
    console.warn("No factory address configured for PRO allowlist");
    return { ok: false, reason: "MISSING_FACTORY_ADDRESS" };
  }

  const privateKey = PRO_ALLOWLIST_PRIVATE_KEY.startsWith("0x")
    ? PRO_ALLOWLIST_PRIVATE_KEY
    : `0x${PRO_ALLOWLIST_PRIVATE_KEY}`;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const transport = http(PRO_ALLOWLIST_RPC);
  const walletClient = createWalletClient({ account, chain: base, transport });
  const publicClient = createPublicClient({ chain: base, transport });

  const targets = [
    FACTORY_SCHEDULED_ADDRESS,
    FACTORY_RECURRING_ADDRESS
  ].filter(Boolean) as `0x${string}`[];

  const results: Array<{ factory: string; txHash: string }> = [];

  for (const factory of targets) {
    const txHash = await walletClient.writeContract({
      address: factory,
      abi: PRO_ALLOWLIST_ABI,
      functionName: "setProWallets",
      args: [[wallet as `0x${string}`], isPro]
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    results.push({ factory, txHash });
  }

  return { ok: true, results };
}

async function handleProSubmit(req: Request) {
  const body = await req.json();

  const {
    user_id,
    company_legal_name,
    country_code,
    company_registration_number,
    registered_address,
    business_email,
    main_business_wallet,
    business_activity,
    website_url,
    company_size
  } = body;

  const errors: string[] = [];

  /* ---------------------------
     1. HARD CHECKS (bloquants)
  ----------------------------*/
  if (!company_legal_name || company_legal_name.length < 2)
    errors.push("INVALID_COMPANY_NAME");

  if (!country_code)
    errors.push("INVALID_COUNTRY");

  if (!company_registration_number)
    errors.push("INVALID_REGISTRATION_NUMBER");

  if (!registered_address || registered_address.length < 5)
    errors.push("INVALID_ADDRESS");

  if (!business_email || !business_email.includes("@"))
    errors.push("INVALID_EMAIL");

  if (!/^0x[a-fA-F0-9]{40}$/.test(main_business_wallet))
    errors.push("INVALID_WALLET");

  if (!business_activity)
    errors.push("INVALID_ACTIVITY");

  if (!/^https?:\/\//.test(website_url))
    errors.push("INVALID_WEBSITE");

  if (!["SOLO", "2_10", "11_50", "50_PLUS"].includes(company_size))
    errors.push("INVALID_COMPANY_SIZE");

  /* ---------------------------
     2. WALLET UNIQUENESS
  ----------------------------*/
  const { data: walletExists, error: walletCheckError } = await supabase
    .from("pro_profiles")
    .select("id")
    .eq("main_business_wallet", main_business_wallet.toLowerCase())
    .neq("user_id", user_id)
    .maybeSingle();

  if (walletCheckError) {
    console.error("Supabase wallet check error:", walletCheckError);
    return NextResponse.json(
      {
        error: "SUPABASE_WALLET_CHECK_FAILED",
        details: process.env.NODE_ENV !== "production" ? walletCheckError?.message : undefined
      },
      { status: 500 }
    );
  }

  if (walletExists)
    errors.push("WALLET_ALREADY_USED");

  /* ---------------------------
     3. WEBSITE CHECK (léger)
  ----------------------------*/
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2500);

    await fetch(website_url, {
      method: "HEAD",
      signal: controller.signal
    });
  } catch (e) {
    // timeout = OK
    // DNS / invalid URL = KO
    if (!website_url.startsWith("http"))
      errors.push("WEBSITE_UNREACHABLE");
  }

  /* ---------------------------
     4. SI ERREURS → REJECT
  ----------------------------*/
  if (errors.length > 0) {
    const { error: rejectError } = await supabase.from("users").update({
      // Ne pas activer le compte pro si validation KO
      pro_status: "rejected",
      pro_rejected_reason: errors.join(","),
      updated_at: new Date().toISOString()
    }).eq("id", user_id);

    if (rejectError) {
      console.error("Supabase reject update error:", rejectError);
      return NextResponse.json(
        {
          error: "SUPABASE_REJECT_UPDATE_FAILED",
          details: process.env.NODE_ENV !== "production" ? rejectError?.message : undefined
        },
        { status: 500 }
      );
    }

    let allowlistResult: { ok: boolean; reason?: string; results?: Array<{ factory: string; txHash: string }> } | null = null;
    try {
      allowlistResult = await setProWalletOnChain(main_business_wallet, false);
    } catch (allowlistError) {
      console.error("Allowlist on-chain error (revoke):", allowlistError);
      allowlistResult = { ok: false, reason: "ONCHAIN_ERROR" };
    }

    return NextResponse.json(
      { status: "REJECTED", errors, allowlist: allowlistResult },
      { status: 400 }
    );
  }

  /* ---------------------------
     5. SOFT CHECKS (non bloquants)
  ----------------------------*/
  const riskFlags: string[] = [];

  if (/@gmail|@yahoo|@outlook/.test(business_email.toLowerCase())) {
    riskFlags.push("FREE_EMAIL_DOMAIN");
  }

  /* ---------------------------
     6. UPSERT PROFIL PRO
  ----------------------------*/
  const { error: upsertError } = await supabase
    .from("pro_profiles")
    .upsert(
      {
        user_id,
        company_legal_name,
        country_code,
        company_registration_number,
        registered_address,
        business_email: business_email.toLowerCase(),
        main_business_wallet: main_business_wallet.toLowerCase(),
        business_activity,
        website_url,
        company_size,
        risk_flags: riskFlags,
        validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("Supabase upsert error:", upsertError);
    return NextResponse.json(
      {
        error: "SUPABASE_UPSERT_FAILED",
        details: process.env.NODE_ENV !== "production" ? upsertError?.message : undefined
      },
      { status: 500 }
    );
  }

  /* ---------------------------
     7. AUTO-VERIFY
  ----------------------------*/
  const { error: verifyError } = await supabase.from("users").update({
    account_type: "professional",
    pro_status: "verified",
    pro_verified_at: new Date().toISOString(),
    pro_rejected_reason: null,
    updated_at: new Date().toISOString()
  }).eq("id", user_id);

  if (verifyError) {
    console.error("Supabase verify update error:", verifyError);
    return NextResponse.json(
      {
        error: "SUPABASE_VERIFY_UPDATE_FAILED",
        details: process.env.NODE_ENV !== "production" ? verifyError?.message : undefined
      },
      { status: 500 }
    );
  }

  let allowlistResult: { ok: boolean; reason?: string; results?: Array<{ factory: string; txHash: string }> } | null = null;
  try {
    allowlistResult = await setProWalletOnChain(main_business_wallet, true);
  } catch (allowlistError) {
    console.error("Allowlist on-chain error:", allowlistError);
    allowlistResult = { ok: false, reason: "ONCHAIN_ERROR" };
  }

  return NextResponse.json({
    status: "VERIFIED",
    fee_bps: 40,
    risk_flags: riskFlags,
    allowlist: allowlistResult
  });
}

export async function POST(req: Request) {
  const timeoutPromise = new Promise<NextResponse>((_, reject) => {
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS);
  });

  try {
    return await Promise.race([handleProSubmit(req), timeoutPromise]);
  } catch (error) {
    if (error instanceof Error && error.message === "TIMEOUT") {
      return NextResponse.json(
        { error: "TIMEOUT" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
