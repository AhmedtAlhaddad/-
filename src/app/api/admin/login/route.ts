import { NextResponse } from "next/server";

import {
  ADMIN_GATE_COOKIE,
  adminGateCookieOptions,
  createAdminGateToken,
  safeAdminReturnTo,
} from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

const GENERIC_LOGIN_ERROR =
  "اسم المستخدم أو كلمة المرور غير صحيحة.";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: GENERIC_LOGIN_ERROR },
      { status: 401 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: GENERIC_LOGIN_ERROR },
      { status: 401 },
    );
  }

  const payload = body as Record<string, unknown>;
  const username = text(payload.username);
  const password = typeof payload.password === "string"
    ? payload.password
    : "";
  const returnTo = safeAdminReturnTo(text(payload.returnTo));
  const configuredUsername = process.env.ADMIN_LOGIN_USERNAME?.trim();
  const configuredEmail = process.env.ADMIN_LOGIN_EMAIL?.trim();

  if (
    !configuredUsername ||
    !configuredEmail ||
    !username ||
    !password ||
    username !== configuredUsername
  ) {
    return NextResponse.json(
      { error: GENERIC_LOGIN_ERROR },
      { status: 401 },
    );
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: configuredEmail,
    password,
  });

  if (signInError) {
    return NextResponse.json(
      { error: GENERIC_LOGIN_ERROR },
      { status: 401 },
    );
  }

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const { data: profile, error: profileError } = userId
    ? await supabase
        .from("profiles")
        .select("role, active")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null, error: null };

  if (
    claimsError ||
    !userId ||
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.active !== true
  ) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: GENERIC_LOGIN_ERROR },
      { status: 401 },
    );
  }

  let gateToken: string;

  try {
    gateToken = createAdminGateToken(userId);
  } catch {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "تعذر تهيئة جلسة الإدارة. حاول لاحقًا." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({
    success: true,
    returnTo,
  });
  response.cookies.set(
    ADMIN_GATE_COOKIE,
    gateToken,
    adminGateCookieOptions(),
  );

  return response;
}
