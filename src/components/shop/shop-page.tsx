"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ProductGrid } from "@/components/products/product-card";
import { CloseIcon, FilterIcon } from "@/components/ui/icons";
import {
  buildShopHref,
  goalOptions,
  type CatalogSort,
  type ShopQuery,
} from "@/lib/catalog-query";
import type { ShopCategoryOption } from "@/types/category";
import type {
  CatalogProduct,
  TrainingGoal,
} from "@/types/product";

function Filters({
  query,
  categories,
  onCategory,
  onGoal,
  onAvailability,
  onClear,
}: {
  query: ShopQuery;
  categories: ShopCategoryOption[];
  onCategory: (value: string) => void;
  onGoal: (value: TrainingGoal) => void;
  onAvailability: () => void;
  onClear: () => void;
}) {
  return (
    <div className="filters">
      <div className="filter-title">
        <b>تصفية النتائج</b>
        <button onClick={onClear}>مسح الكل</button>
      </div>

      <fieldset>
        <legend>الفئة التجارية</legend>
        {categories.map((item) => (
          <label key={item.slug}>
            <input
              type="checkbox"
              checked={query.categories.includes(item.slug)}
              onChange={() => onCategory(item.slug)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>هدف التدريب</legend>
        {goalOptions.map((item) => (
          <label key={item}>
            <input
              type="checkbox"
              checked={query.goals.includes(item)}
              onChange={() => onGoal(item)}
            />
            <span>{item}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>التوفر</legend>
        <label>
          <input
            type="checkbox"
            checked={query.available}
            onChange={onAvailability}
          />
          <span>متوفر حاليًا</span>
        </label>
      </fieldset>

      <div className="member-card">
        <b>مزايا الأعضاء</b>
        <p>سجّل لتصلك العروض التي يحددها المتجر.</p>
        <button>سجّل الآن</button>
      </div>
    </div>
  );
}

function pageItems(page: number, totalPages: number) {
  return [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((item) => item > 0 && item <= totalPages)
    .sort((a, b) => a - b);
}

function Pagination({
  query,
  totalPages,
}: {
  query: ShopQuery;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = pageItems(query.page, totalPages);

  return (
    <nav className="pagination" aria-label="صفحات المنتجات">
      {pages.map((page, index) => (
        <span key={page}>
          {index > 0 && page - pages[index - 1] > 1 && (
            <i aria-hidden="true">…</i>
          )}
          <Link
            href={buildShopHref({ ...query, page })}
            className={page === query.page ? "active" : ""}
            aria-current={page === query.page ? "page" : undefined}
          >
            {page}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export function ShopPage({
  products,
  total,
  totalPages,
  query,
  categories,
}: {
  products: CatalogProduct[];
  total: number;
  totalPages: number;
  query: ShopQuery;
  categories: ShopCategoryOption[];
}) {
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [isPending, startTransition] = useTransition();
  const heading =
    query.productScope === "accessories"
      ? "إكسسوارات اللياقة"
      : query.productScope === "supplements"
        ? "المكملات الغذائية"
        : "كل المنتجات";
  const description =
    query.productScope === "accessories"
      ? "استكشف إكسسوارات اللياقة المتاحة واختر ما يناسب تدريبك."
      : query.productScope === "supplements"
        ? "استكشف مجموعتنا المختارة من المكملات الغذائية لدعم احتياجاتك الرياضية."
        : "استكشف مجموعتنا المختارة من المكملات الغذائية وإكسسوارات اللياقة.";

  const navigate = (next: ShopQuery) => {
    startTransition(() => {
      router.push(buildShopHref(next));
    });
  };

  const toggleCategory = (value: string) => {
    const categories = query.categories.includes(value)
      ? query.categories.filter((item) => item !== value)
      : [...query.categories, value];
    navigate({ ...query, categories, page: 1 });
  };

  const toggleGoal = (value: TrainingGoal) => {
    const goals = query.goals.includes(value)
      ? query.goals.filter((item) => item !== value)
      : [...query.goals, value];
    navigate({ ...query, goals, page: 1 });
  };

  const clear = () => {
    navigate({
      categories: [],
      goals: [],
      available: false,
      sort: query.sort,
      productScope: query.productScope,
      page: 1,
    });
  };

  const filterProps = {
    query,
    categories,
    onCategory: toggleCategory,
    onGoal: toggleGoal,
    onAvailability: () =>
      navigate({
        ...query,
        available: !query.available,
        page: 1,
      }),
    onClear: clear,
  };

  return (
    <main>
      <section className="collection-hero">
        <div className="container">
          <span>الرئيسية / {heading}</span>
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>
      </section>

      <nav className="collection-categories" aria-label="فئات المنتجات">
        <div className="container">
          <button
            className={query.categories.length === 0 ? "active" : ""}
            onClick={() =>
              navigate({ ...query, categories: [], page: 1 })
            }
          >
            الكل
          </button>
          {categories.map((category) => (
            <button
              className={
                query.categories.includes(category.slug) ? "active" : ""
              }
              key={category.slug}
              onClick={() => toggleCategory(category.slug)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="container shop-toolbar">
        <span>
          متوفر <b>{total}</b> منتجًا
        </span>
        <div>
          <button
            className="filter-trigger"
            onClick={() => setDrawer(true)}
          >
            <FilterIcon />
            تصفية
          </button>
          <label htmlFor="sort">ترتيب حسب</label>
          <select
            id="sort"
            value={query.sort}
            onChange={(event) =>
              navigate({
                ...query,
                sort: event.target.value as CatalogSort,
                page: 1,
              })
            }
          >
            <option value="featured">المنتجات المميزة</option>
            <option value="price-asc">السعر: الأقل أولًا</option>
            <option value="price-desc">السعر: الأعلى أولًا</option>
          </select>
        </div>
      </div>

      <div className="container shop-layout">
        <aside className="filter-sidebar">
          <Filters {...filterProps} />
        </aside>

        <section
          className="shop-products"
          aria-live="polite"
          aria-busy={isPending}
        >
          {products.length > 0 ? (
            <>
              <ProductGrid items={products} />
              <Pagination query={query} totalPages={totalPages} />
            </>
          ) : (
            <div className="empty-state">
              <h2>لا توجد منتجات مطابقة</h2>
              <p>جرّب إزالة بعض عوامل التصفية.</p>
              <button className="button primary" onClick={clear}>
                مسح عوامل التصفية
              </button>
            </div>
          )}
        </section>
      </div>

      {drawer && (
        <div
          className="drawer-layer"
          role="dialog"
          aria-modal="true"
          aria-label="تصفية المنتجات"
        >
          <button
            className="drawer-backdrop"
            onClick={() => setDrawer(false)}
            aria-label="إغلاق"
          />
          <div className="filter-drawer">
            <button
              className="drawer-close"
              onClick={() => setDrawer(false)}
            >
              <CloseIcon />
              إغلاق
            </button>
            <Filters {...filterProps} />
            <button
              className="button primary drawer-apply"
              onClick={() => setDrawer(false)}
            >
              عرض {total} منتجات
            </button>
          </div>
        </div>
      )}

      <section className="collection-copy container">
        <h2>المعايير الحقيقية في عالم المكملات</h2>
        <p>
          نختار منتجات عالم اللياقة بعناية، مع التركيز على جودة المنتجات
          ووضوح معلوماتها ومصدرها.
        </p>
        <div>
          <article>
            <b>جودة مختارة</b>
            <span>مراجعة معلومات المنتجات</span>
          </article>
          <article>
            <b>توصيل سريع</b>
            <span>تغليف آمن للطلبات</span>
          </article>
          <article>
            <b>دعم العملاء</b>
            <span>مساعدة عند الحاجة</span>
          </article>
        </div>
      </section>
    </main>
  );
}
