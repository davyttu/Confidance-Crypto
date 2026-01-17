import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  const { data: user } = await supabase
    .from("users")
    .select("pro_status")
    .eq("id", user_id)
    .single();

  const feeBps = user?.pro_status === "verified" ? 40 : 100;

  return NextResponse.json({
    fee_bps: feeBps,
    fee_percent: feeBps / 100
  });
}
