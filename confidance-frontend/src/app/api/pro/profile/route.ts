import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase env vars for pro profile");
}

const supabase = createClient(
  supabaseUrl || "",
  supabaseServiceKey || "" // SERVER ONLY
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pro_profiles")
    .select(
      "company_legal_name,country_code,company_registration_number,registered_address,business_email,main_business_wallet,business_activity,website_url,company_size"
    )
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "SUPABASE_PROFILE_FETCH_FAILED" },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile: data || null });
}
