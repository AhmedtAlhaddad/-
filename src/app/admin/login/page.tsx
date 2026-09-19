import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLogin } from "@/components/admin/admin-login";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "تسجيل دخول الإدارة",

  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic =
  "force-dynamic";

export default async function Page() {
  const supabase =
    await createClient();

  const {
    data: claimsData,
  } =
    await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (userId) {
    const {
      data: profile,
    } =
      await supabase
        .from("profiles")
        .select("role, active")
        .eq(
          "user_id",
          userId,
        )
        .maybeSingle();

    if (
      profile?.role === "admin" &&
      profile.active === true
    ) {
      redirect("/admin");
    }
  }

  return <AdminLogin />;
}
