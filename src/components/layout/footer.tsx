import Link from "next/link";
import type { ReactNode } from "react";
import { AnnouncementBar, Header } from "./header";
import { getNavigationCategories } from "@/lib/supabase/catalog-cache";

export function CommunitySection() {
  return (
    <section className="community-band">
      <div className="container community-inner">
        <h2>اشتري على حسب هدفك وكن من مجتمع عالم اللياقة</h2>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div><Link className="brand footer-brand" href="/"><span>عالم <b>اللياقة</b></span></Link><p>وجهتك للمكملات الرياضية الأصلية والأداء الأفضل.</p></div>
        <div><h3>تواصل معنا</h3><p>طرابلس، حي دمشق بجانب مصحة السندان</p><a href="tel:0911465383" dir="ltr">0911465383</a></div>
        <div className="developer-credit"><h3>تم تطوير الموقع بواسطة :</h3><strong>احمد الحداد</strong><a href="tel:0918063993" dir="ltr">0918063993</a></div>
      </div>
      <div className="container copyright"><span>© 2026 عالم اللياقة. جميع الحقوق محفوظة.</span><span>شروط الاستخدام · سياسة الخصوصية</span></div>
    </footer>
  );
}

export async function StoreChrome({ children, community = false }: { children: ReactNode; community?: boolean }) {
  const categories = await getNavigationCategories();

  return <><AnnouncementBar/><Header categories={categories}/>{children}{community && <CommunitySection/>}<Footer/></>;
}
