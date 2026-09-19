import { NextResponse } from "next/server";

import {
  revalidatePublicCatalog,
} from "@/lib/supabase/revalidate-catalog";

import {
  createClient,
} from "@/lib/supabase/server";

export async function POST() {
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
    return NextResponse.json(
      {
        error:
          "يجب تسجيل الدخول أولًا.",
      },
      {
        status: 401,
      },
    );
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
    profile.role !==
      "admin" ||
    profile.active !== true
  ) {
    return NextResponse.json(
      {
        error:
          "ليس لديك صلاحية الإدارة.",
      },
      {
        status: 403,
      },
    );
  }

  revalidatePublicCatalog();

  return NextResponse.json({
    success: true,
  });
}