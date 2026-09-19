import Link from "next/link";
import type { ReactNode } from "react";
import { AnnouncementBar, Header } from "./header";

export function NewsletterSection() {
  return (
    <section className="newsletter-band">
      <div className="container newsletter-inner">
        <div><span className="eyebrow light">مجتمع عالم اللياقة</span><h2>انضم إلى مجتمع النخبة</h2><p>نصائح تدريب، عروض حصرية، ومنتجات جديدة تصل إلى بريدك.</p></div>
        <form className="newsletter-form"><label className="sr-only" htmlFor="newsletter">بريدك الإلكتروني</label><input id="newsletter" type="email" placeholder="بريدك الإلكتروني"/><button type="submit">اشترك الآن</button></form>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div><Link className="brand footer-brand" href="/"><span className="brand-mark">ع</span><span>عالم <b>اللياقة</b></span></Link><p>وجهتك للمكملات الرياضية الأصلية والأداء الأفضل.</p></div>
        <div><h3>عن المتجر</h3><Link href="/">من نحن</Link><Link href="/shop">تسوق المنتجات</Link><Link href="/">سياسة الخصوصية</Link></div>
        <div><h3>خدمة العملاء</h3><Link href="/cart">تتبع الطلب</Link><Link href="/">الشحن والاسترجاع</Link><Link href="/">الأسئلة الشائعة</Link></div>
        <div><h3>تواصل معنا</h3><p>طرابلس، ليبيا</p><p>support@alamallayaqa.ly</p><div className="socials"><span>in</span><span>f</span><span>x</span></div></div>
      </div>
      <div className="container copyright"><span>© 2026 عالم اللياقة. جميع الحقوق محفوظة.</span><span>شروط الاستخدام · سياسة الخصوصية</span></div>
    </footer>
  );
}

export function StoreChrome({ children, newsletter = false }: { children: ReactNode; newsletter?: boolean }) {
  return <><AnnouncementBar/><Header/>{children}{newsletter && <NewsletterSection/>}<Footer/></>;
}
