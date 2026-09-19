import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { CartProvider } from "@/components/cart/cart-provider";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://alamallayaqa.ly"),
  title: { default: "عالم اللياقة | مكملات رياضية أصلية", template: "%s | عالم اللياقة" },
  description: "متجر ليبي متخصص في المكملات الرياضية الأصلية، البروتين، الكرياتين ومنتجات الأداء.",
  openGraph: { title: "عالم اللياقة", description: "ارتقِ بأدائك مع مكملات رياضية أصلية مختارة بعناية.", type: "website", locale: "ar_LY" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ar" dir="rtl" className={cairo.variable}><body><CartProvider>{children}</CartProvider></body></html>;
}
