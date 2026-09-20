import type { Metadata } from "next";

import { CheckoutPage } from "@/components/checkout/checkout-page";
import { StoreChrome } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "تأكيد الطلب",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const rawCode = Array.isArray(query.code) ? query.code[0] : query.code;
  const initialCode = (rawCode ?? "").trim().toUpperCase().slice(0, 32);

  return (
    <StoreChrome>
      <CheckoutPage initialCode={initialCode} />
    </StoreChrome>
  );
}
