import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase env vars for pro sync");
}

const supabase = createClient(
  supabaseUrl || "",
  supabaseServiceKey || "" // SERVER ONLY
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

async function setProWalletOnChain(wallet: string, isPro: boolean) {
  if (!PRO_ALLOWLIST_PRIVATE_KEY || !PRO_ALLOWLIST_RPC) {
    console.error("PRO sync missing env", {
      hasPrivateKey: Boolean(PRO_ALLOWLIST_PRIVATE_KEY),
      hasRpc: Boolean(PRO_ALLOWLIST_RPC),
      hasScheduledFactory: Boolean(FACTORY_SCHEDULED_ADDRESS),
      hasRecurringFactory: Boolean(FACTORY_RECURRING_ADDRESS)
    });
    return { ok: false, reason: "MISSING_ENV" };
  }

  if (!FACTORY_SCHEDULED_ADDRESS && !FACTORY_RECURRING_ADDRESS) {
    console.error("PRO sync missing factory addresses");
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
    try {
      const txHash = await walletClient.writeContract({
        address: factory,
        abi: PRO_ALLOWLIST_ABI,
        functionName: "setProWallets",
        args: [[wallet as `0x${string}`], isPro]
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      results.push({ factory, txHash });
    } catch (error) {
      console.error("PRO sync tx error", { factory, error });
      return { ok: false, reason: "TX_ERROR" };
    }
  }

  return { ok: true, results };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, wallet } = body || {};

    if (!user_id || !wallet) {
      return NextResponse.json(
        { error: "MISSING_USER_OR_WALLET" },
        { status: 400 }
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("pro_status")
      .eq("id", user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const isProVerified = user.pro_status === "verified";
    console.log("PRO sync request", {
      user_id,
      wallet,
      isProVerified
    });

    const allowlist = await setProWalletOnChain(wallet, isProVerified);

    return NextResponse.json({
      status: "SYNCED",
      is_pro_verified: isProVerified,
      allowlist
    });
  } catch (error) {
    console.error("PRO sync error:", error);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
