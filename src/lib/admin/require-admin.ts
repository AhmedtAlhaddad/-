import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (
    claimsError ||
    !userId
  ) {
    redirect("/admin/login");
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select(
        "role, active",
      )
      .eq(
        "user_id",
        userId,
      )
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.active !== true
  ) {
    redirect("/admin/login");
  }

  return {
    supabase,
    userId,
    profile,
  };
}
