import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("account_type, pro_status, pro_verified_at")
    .eq("id", user_id)
    .single();

  return NextResponse.json({
    account_type: user.account_type,
    pro_status: user.pro_status,
    is_pro_verified: user.pro_status === "verified"
  });
}
