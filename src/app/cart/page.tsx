import type { Metadata } from "next";
import { CartPage } from "@/components/cart/cart-page";
import { StoreChrome } from "@/components/layout/footer";

export const metadata: Metadata = { title: "سلة التسوق", robots: { index: false, follow: true } };
export default function Page() { return <StoreChrome><CartPage/></StoreChrome>; }
