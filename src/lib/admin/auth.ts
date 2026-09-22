import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const ADMIN_GATE_COOKIE = "alam_admin_gate";
export const ADMIN_GATE_MAX_AGE_SECONDS = 12 * 60 * 60;

type AdminProfile = {
  role: string;
  active: boolean;
};

type AdminAuthorization = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profile: AdminProfile;
};

type FailedAuthorization = {
  kind: "unauthenticated" | "forbidden" | "expired";
};

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET is not configured securely.");
  }

  return secret;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createAdminGateToken(
  userId: string,
  now = Date.now(),
) {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + ADMIN_GATE_MAX_AGE_SECONDS;
  const payload = encode(
    JSON.stringify({
      sub: userId,
      iat: issuedAt,
      exp: expiresAt,
      nonce: randomBytes(16).toString("base64url"),
    }),
  );

  return `${payload}.${signature(payload)}`;
}

export function verifyAdminGateToken(
  token: string | undefined,
  userId: string,
  now = Date.now(),
) {
  if (!token) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [payload, providedSignature] = parts;

  if (!payload || !providedSignature) {
    return false;
  }

  try {
    const expectedSignature = signature(payload);
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");
    const providedBuffer = Buffer.from(providedSignature, "base64url");

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return false;
    }

    const parsed: unknown = JSON.parse(decode(payload));

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return false;
    }

    const gate = parsed as Record<string, unknown>;
    const issuedAt = gate.iat;
    const expiresAt = gate.exp;

    return (
      gate.sub === userId &&
      typeof issuedAt === "number" &&
      Number.isSafeInteger(issuedAt) &&
      typeof expiresAt === "number" &&
      Number.isSafeInteger(expiresAt) &&
      expiresAt - issuedAt === ADMIN_GATE_MAX_AGE_SECONDS &&
      Math.floor(now / 1000) >= issuedAt &&
      Math.floor(now / 1000) < expiresAt
    );
  } catch {
    return false;
  }
}

export function adminGateCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ADMIN_GATE_MAX_AGE_SECONDS,
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export function safeAdminReturnTo(value: string | null | undefined) {
  if (
    !value ||
    !(value === "/admin" || value.startsWith("/admin/")) ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("\r") ||
    value.includes("\n")
  ) {
    return "/admin";
  }

  return value;
}

async function clearAdminGateCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_GATE_COOKIE);
  } catch {
    // Server Components cannot mutate cookies; the redirect/API response
    // path clears the marker where response cookies are available.
  }
}

async function signOutQuietly(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    await supabase.auth.signOut();
  } catch {
    // The signed Admin gate is still cleared even if Supabase is unavailable.
  }
}

async function readAuthorization(): Promise<
  | AdminAuthorization
  | FailedAuthorization
> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    await clearAdminGateCookie();
    return { kind: "unauthenticated" };
  }

  let gateValid = false;

  try {
    const cookieStore = await cookies();
    gateValid = verifyAdminGateToken(
      cookieStore.get(ADMIN_GATE_COOKIE)?.value,
      userId,
    );
  } catch {
    gateValid = false;
  }

  if (!gateValid) {
    await clearAdminGateCookie();
    await signOutQuietly(supabase);
    return { kind: "expired" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.active !== true
  ) {
    await clearAdminGateCookie();
    await signOutQuietly(supabase);
    return { kind: "forbidden" };
  }

  return {
    supabase,
    userId,
    profile,
  };
}

export async function getAdminAuthorization() {
  return readAuthorization();
}

export async function requireAdmin(
  returnTo = "/admin",
) {
  const authorization = await readAuthorization();

  if ("kind" in authorization) {
    const destination = safeAdminReturnTo(returnTo);
    redirect(
      `/admin/login?returnTo=${encodeURIComponent(destination)}`,
    );
  }

  return authorization;
}

export async function authorizeAdminApi() {
  const authorization = await readAuthorization();

  if ("kind" in authorization) {
    const status = authorization.kind === "forbidden" ? 403 : 401;
    const response = NextResponse.json(
      {
        error:
          authorization.kind === "forbidden"
            ? "ليس لديك صلاحية الإدارة."
            : "يجب تسجيل الدخول إلى لوحة الإدارة.",
      },
      { status },
    );
    response.cookies.delete(ADMIN_GATE_COOKIE);
    return {
      supabase: null,
      response,
    } as const;
  }

  return {
    ...authorization,
    response: null,
  } as const;
}

export async function clearAdminSession() {
  const supabase = await createClient();
  await signOutQuietly(supabase);
  const response = NextResponse.json({ success: true });
  response.cookies.set(
    ADMIN_GATE_COOKIE,
    "",
    {
      ...adminGateCookieOptions(),
      maxAge: 0,
      expires: new Date(0),
    },
  );
  return response;
}
