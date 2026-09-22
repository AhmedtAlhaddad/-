import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLogin } from "@/components/admin/admin-login";
import {
  getAdminAuthorization,
  safeAdminReturnTo,
} from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "تسجيل دخول الإدارة",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const authorization = await getAdminAuthorization();

  if (!("kind" in authorization)) {
    redirect(safeAdminReturnTo(params.returnTo));
  }

  return (
    <AdminLogin
      returnTo={safeAdminReturnTo(params.returnTo)}
    />
  );
}
