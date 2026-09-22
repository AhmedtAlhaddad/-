import { NextResponse } from "next/server";

import { authorizeAdminApi } from "@/lib/admin/auth";
import { revalidatePublicCatalog } from "@/lib/supabase/revalidate-catalog";

export async function POST() {
  const authorization = await authorizeAdminApi();

  if (authorization.response) {
    return authorization.response;
  }

  revalidatePublicCatalog();

  return NextResponse.json({
    success: true,
  });
}
