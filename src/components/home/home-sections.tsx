import Image from "next/image";
import Link from "next/link";

import { ProductGrid } from "@/components/products/product-card";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  ArrowIcon,
  BoltIcon,
  CheckIcon,
} from "@/components/ui/icons";

import type { Brand } from "@/types/brand";
import type { Category } from "@/types/category";
import type { CatalogProduct } from "@/types/product";

export function Hero() {
  return (
    <section className="hero">
      <Image
        src="/images/hero-athlete.jpg"
        alt="رياضي يستعد للتمرين"
        fill
        priority
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
            href="/shop"
          >
            تسوّق الآن
            <ArrowIcon />
          </Link>

          <Link
            className="button ghost"
            href="#goals"
          >
            تعرّف على المجموعة
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

export function BrandStrip({
  brands,
}: {
  brands: Brand[];
}) {
  if (!brands.length) {
    return null;
  }

  return (
    <div className="brand-strip">
      <div className="container">
        {brands.map((brand) => (
          <span key={brand.id}>
            {brand.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CategorySection({
  categories,
}: {
  categories: Category[];
}) {
  if (!categories.length) {
    return null;
  }

  return (
    <section className="section container">
      <SectionHeading
        kicker="اختيارات تناسبك"
        title="تصفح حسب الفئة"
        description="تصفح المنتجات حسب الفئة التي تناسب احتياجاتك."
      />

      <div className="category-grid">
        {categories.map(
          (category) => (
            <Link
              href={category.href}
              className="category-card"
              key={`${category.name}-${category.href}`}
            >
              <Image
                src={category.image}
                alt={category.name}
                fill
                sizes="(max-width: 700px) 50vw, 25vw"
              />

              <div />

              <span>
                <b>
                  {category.name}
                </b>

                <small>
                  {
                    category.description
                  }
                </small>
              </span>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}

const goals = [
  {
    title:
      "بناء العضلات",
    copy:
      "تصفح المنتجات المرتبطة بأهداف القوة والكتلة العضلية",
    image:
      "/images/goal-muscle.jpg",
    href:
      "/shop",
  },
  {
    title:
      "الطاقة والتحمل",
    copy:
      "تصفح الخيارات المرتبطة بالطاقة والأداء الرياضي",
    image:
      "/images/goal-energy.jpg",
    href:
      "/shop",
  },
  {
    title:
      "إدارة الوزن",
    copy:
      "تصفح الخيارات حسب احتياجاتك الغذائية والرياضية",
    image:
      "/images/goal-weight.jpg",
    href:
      "/shop",
  },
];

export function GoalsSection() {
  return (
    <section
      id="goals"
      className="section container"
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
  categories: Category[];
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
