import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  ADMIN_GATE_COOKIE,
  safeAdminReturnTo,
  verifyAdminGateToken,
} from "@/lib/admin/auth";

export async function proxy(
  request: NextRequest,
) {
  let supabaseResponse =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet,
            headers,
          ) {
            cookiesToSet.forEach(
              ({ name, value }) => {
                request.cookies.set(
                  name,
                  value,
                );
              },
            );

            supabaseResponse =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                supabaseResponse.cookies.set(
                  name,
                  value,
                  options,
                );
              },
            );

            Object.entries(
              headers,
            ).forEach(
              ([key, value]) => {
                supabaseResponse.headers.set(
                  key,
                  value,
                );
              },
            );
          },
        },
      },
    );

  const { data: claimsData } = await supabase.auth.getClaims();

  const pathname = request.nextUrl.pathname;
  const isAdminPage =
    pathname === "/admin" ||
    (pathname.startsWith("/admin/") && pathname !== "/admin/login");
  const isAdminLogin = pathname === "/admin/login";

  if (isAdminLogin && request.cookies.has(ADMIN_GATE_COOKIE)) {
    const userId = claimsData?.claims?.sub;
    let gateValid = false;

    try {
      gateValid = verifyAdminGateToken(
        request.cookies.get(ADMIN_GATE_COOKIE)?.value,
        userId ?? "",
      );
    } catch {
      gateValid = false;
    }

    if (!gateValid) {
      supabaseResponse.cookies.delete(ADMIN_GATE_COOKIE);
    }
  }

  if (isAdminPage) {
    const userId = claimsData?.claims?.sub;
    let gateValid = false;

    try {
      gateValid = verifyAdminGateToken(
        request.cookies.get(ADMIN_GATE_COOKIE)?.value,
        userId ?? "",
      );
    } catch {
      gateValid = false;
    }

    if (!userId || !gateValid) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.search = "";
      loginUrl.searchParams.set(
        "returnTo",
        safeAdminReturnTo(pathname + request.nextUrl.search),
      );

      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(ADMIN_GATE_COOKIE);
      return response;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
