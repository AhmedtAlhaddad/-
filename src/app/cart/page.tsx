import type { Metadata } from "next";
import { CartPage } from "@/components/cart/cart-page";
import { StoreChrome } from "@/components/layout/footer";

export const metadata: Metadata = { title: "سلة التسوق", robots: { index: false, follow: true } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawCode = Array.isArray(query.code) ? query.code[0] : query.code;
  const initialCode = (rawCode ?? "").trim().toUpperCase().slice(0, 32);

  return (
    <StoreChrome>
      <CartPage initialCode={initialCode} />
    </StoreChrome>
  );
}
