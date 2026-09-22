import Image from "next/image";
import Link from "next/link";

import { BrandStrip } from "@/components/home/brand-strip";
import { CategoryCarousel } from "@/components/home/category-carousel";
import { ProductGrid } from "@/components/products/product-card";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  ArrowIcon,
  BoltIcon,
  CheckIcon,
} from "@/components/ui/icons";

import type { Brand } from "@/types/brand";
import type { HomepageCategory } from "@/types/category";
import type { CatalogProduct } from "@/types/product";
import { trainingGoalDetails } from "@/lib/catalog-query";

export function Hero() {
  return (
    <section className="hero">
      <Image
        src="/images/hero-athlete.jpg"
        alt="رياضي يستعد للتمرين"
        fill
        priority
        quality={90}
        sizes="100vw"
        className="hero-image"
      />

      <div className="hero-shade" />

      <div className="container hero-content">
        <span className="hero-tag">
          مكملات أصلية، نتائج حقيقية
        </span>

        <h1>
          ارتقِ بأدائك إلى
          <br />
          <em>
            أقصى عالم اللياقة
          </em>
        </h1>

        <p>
          نقدم لك مجموعة مختارة من
          المكملات الغذائية
          والإكسسوارات الرياضية من
          علامات تجارية موثوقة.
        </p>

        <div className="hero-actions">
          <Link
            className="button primary"
            href="/shop?type=supplements"
          >
            تسوّق الآن
            <ArrowIcon />
          </Link>

          <Link
            className="button ghost"
            href="#training-goals"
          >
            اختر مكملاتك بناء على هدفك
          </Link>
        </div>
      </div>

      <div className="container hero-stats">
        <div>
          <strong>
            علامات مختارة
          </strong>

          <span>
            منتجات من مصادر موثوقة
          </span>
        </div>

        <div>
          <strong>
            توصيل
          </strong>

          <span>
            داخل ليبيا
          </span>
        </div>

        <div>
          <strong>
            جودة
          </strong>

          <span>
            منتجات مختارة بعناية
          </span>
        </div>
      </div>
    </section>
  );
}

export function CategorySection({
  categories,
}: {
  categories: HomepageCategory[];
}) {
  return (
    <section
      id="categories"
      className="section container anchor-section"
    >
      <SectionHeading
        kicker="اختيارات تناسبك"
        title="تصفح حسب الفئة"
        description="تصفح المنتجات حسب الفئة التي تناسب احتياجاتك."
      />

      {categories.length > 0 ? (
        <CategoryCarousel categories={categories} />
      ) : (
        <div className="empty-state">
          <p>لا توجد أصناف متاحة حاليًا.</p>
        </div>
      )}
    </section>
  );
}

const goalImages = [
  "/images/goal-muscle.jpg",
  "/images/goal-energy.jpg",
  "/images/goal-weight.jpg",
];

const goals = trainingGoalDetails.map(
  (goal, index) => ({
    title: goal.label,
    copy: goal.description,
    image: goalImages[index],
    href: `/shop?goal=${encodeURIComponent(goal.label)}`,
  }),
);

export function GoalsSection() {
  return (
    <section
      id="training-goals"
      className="section container anchor-section"
    >
      <SectionHeading
        kicker="تسوق حسب الهدف"
        title="اختر هدفك التدريبي"
        description="تصفح المنتجات حسب الهدف التدريبي الذي يناسب احتياجاتك."
      />

      <div className="goal-grid">
        {goals.map(
          (goal) => (
            <Link
              href={goal.href}
              className="goal-card"
              key={goal.title}
            >
              <Image
                src={goal.image}
                alt={goal.title}
                fill
                quality={90}
                sizes="(max-width: 700px) 100vw, 33vw"
              />

              <div />

              <span>
                <b>
                  {goal.title}
                </b>

                <small>
                  {goal.copy}
                </small>

                <i>
                  اكتشف المجموعة ←
                </i>
              </span>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}

export function TrustStrip() {
  return (
    <section className="trust-strip">
      <div className="container trust-grid">
        <div>
          <CheckIcon />

          <b>
            منتجات مختارة
          </b>

          <span>
            معلومات واضحة ومصدر موثوق
          </span>
        </div>

        <div>
          <BoltIcon />

          <b>
            توصيل سريع
          </b>

          <span>
            خدمة توصيل داخل ليبيا
          </span>
        </div>

        <div>
          <span className="trust-icon">
            ◎
          </span>

          <b>
            أسعار واضحة
          </b>

          <span>
            السعر يظهر قبل إتمام الطلب
          </span>
        </div>

        <div>
          <span className="trust-icon">
            ♕
          </span>

          <b>
            دعم العملاء
          </b>

          <span>
            مساعدة عند الحاجة
          </span>
        </div>
      </div>
    </section>
  );
}

export function HomePage({
  products,
  brands,
  categories,
}: {
  products: CatalogProduct[];
  brands: Brand[];
  categories: HomepageCategory[];
}) {
  const featuredProducts =
    products.slice(0, 4);

  return (
    <main>
      <Hero />

      <BrandStrip
        brands={brands}
      />

      <CategorySection
        categories={
          categories
        }
      />

      <section className="section container best-sellers">
        <SectionHeading
          kicker="مختارات عالم اللياقة"
          title="منتجات مميزة"
          description="اكتشف مجموعة مختارة من المنتجات المتوفرة حاليًا."
          href="/shop"
        />

        {featuredProducts.length >
        0 ? (
          <ProductGrid
            items={
              featuredProducts
            }
          />
        ) : (
          <div className="empty-state">
            <h2>
              لا توجد منتجات
              متاحة حاليًا
            </h2>

            <p>
              ستظهر المنتجات هنا
              بمجرد إضافتها
              وتفعيلها في المتجر.
            </p>
          </div>
        )}
      </section>

      <GoalsSection />

      <TrustStrip />
    </main>
  );
}
