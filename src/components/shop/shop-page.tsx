"use client";

import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { ProductGrid } from "@/components/products/product-card";
import {
  CloseIcon,
  FilterIcon,
} from "@/components/ui/icons";

import type {
  Product,
  ProductCategory,
  TrainingGoal,
} from "@/types/product";

const categoryOptions: ProductCategory[] =
  [
    "بروتين",
    "قبل التمرين",
    "كرياتين",
    "أحماض أمينية",
    "إكسسوارات اللياقة",
  ];

const goalOptions: TrainingGoal[] =
  [
    "بناء العضلات",
    "الطاقة والتحمل",
    "إدارة الوزن",
    "الاستشفاء",
  ];

function Filters({
  categories,
  goals,
  available,
  onCategory,
  onGoal,
  onAvailability,
  onClear,
}: {
  categories: ProductCategory[];
  goals: TrainingGoal[];
  available: boolean;

  onCategory: (
    value: ProductCategory,
  ) => void;

  onGoal: (
    value: TrainingGoal,
  ) => void;

  onAvailability: () => void;
  onClear: () => void;
}) {
  return (
    <div className="filters">
      <div className="filter-title">
        <b>تصفية النتائج</b>

        <button
          onClick={onClear}
        >
          مسح الكل
        </button>
      </div>

      <fieldset>
        <legend>
          الفئة التجارية
        </legend>

        {categoryOptions.map(
          (item) => (
            <label key={item}>
              <input
                type="checkbox"
                checked={categories.includes(
                  item,
                )}
                onChange={() =>
                  onCategory(item)
                }
              />

              <span>{item}</span>
            </label>
          ),
        )}
      </fieldset>

      <fieldset>
        <legend>
          هدف التدريب
        </legend>

        {goalOptions.map(
          (item) => (
            <label key={item}>
              <input
                type="checkbox"
                checked={goals.includes(
                  item,
                )}
                onChange={() =>
                  onGoal(item)
                }
              />

              <span>{item}</span>
            </label>
          ),
        )}
      </fieldset>

      <fieldset>
        <legend>
          التوفر
        </legend>

        <label>
          <input
            type="checkbox"
            checked={available}
            onChange={
              onAvailability
            }
          />

          <span>
            متوفر حاليًا
          </span>
        </label>
      </fieldset>

      <div className="member-card">
        <b>مزايا الأعضاء</b>

        <p>
          سجّل لتصلك العروض
          التي يحددها المتجر.
        </p>

        <button>
          سجّل الآن
        </button>
      </div>
    </div>
  );
}

export function ShopPage({
  products,
  initialCategory,
}: {
  products: Product[];
  initialCategory?: ProductCategory;
}) {
  const [
    categories,
    setCategories,
  ] = useState<
    ProductCategory[]
  >(
    initialCategory
      ? [initialCategory]
      : [],
  );

  const [goals, setGoals] =
    useState<
      TrainingGoal[]
    >([]);

  const [
    available,
    setAvailable,
  ] = useState(false);

  const [sort, setSort] =
    useState("featured");

  const [drawer, setDrawer] =
    useState(false);

  const toggle = <T,>(
    setter: Dispatch<
      SetStateAction<T[]>
    >,
    value: T,
  ) => {
    setter((current) =>
      current.includes(value)
        ? current.filter(
            (item) =>
              item !== value,
          )
        : [...current, value],
    );
  };

  const clear = () => {
    setCategories([]);
    setGoals([]);
    setAvailable(false);
  };

  const filtered =
    useMemo(() => {
      const result =
        products.filter(
          (product) =>
            (!categories.length ||
              categories.includes(
                product.category,
              )) &&
            (!goals.length ||
              goals.includes(
                product.goal,
              )) &&
            (!available ||
              product.inStock),
        );

      return [...result].sort(
        (a, b) => {
          const aPrice =
            a.variants[0]?.price ??
            0;

          const bPrice =
            b.variants[0]?.price ??
            0;

          if (
            sort ===
            "price-asc"
          ) {
            return (
              aPrice -
              bPrice
            );
          }

          if (
            sort ===
            "price-desc"
          ) {
            return (
              bPrice -
              aPrice
            );
          }

          if (
            sort === "rating"
          ) {
            return (
              b.rating -
              a.rating
            );
          }

          return (
            Number(
              Boolean(
                b.badge,
              ),
            ) -
            Number(
              Boolean(
                a.badge,
              ),
            )
          );
        },
      );
    }, [
      products,
      categories,
      goals,
      available,
      sort,
    ]);

  const props = {
    categories,
    goals,
    available,

    onCategory: (
      value: ProductCategory,
    ) =>
      toggle(
        setCategories,
        value,
      ),

    onGoal: (
      value: TrainingGoal,
    ) =>
      toggle(
        setGoals,
        value,
      ),

    onAvailability: () =>
      setAvailable(
        (value) => !value,
      ),

    onClear: clear,
  };

  return (
    <main>
      <section className="collection-hero">
        <div className="container">
          <span>
            الرئيسية /
            المكملات الغذائية
          </span>

          <h1>
            كل المكملات
          </h1>

          <p>
            استكشف مجموعتنا
            المختارة من المكملات
            الغذائية والإكسسوارات
            لدعم احتياجاتك
            الرياضية.
          </p>
        </div>
      </section>

      <nav
        className="collection-categories"
        aria-label="فئات المنتجات"
      >
        <div className="container">
          <button
            className={
              !categories.length
                ? "active"
                : ""
            }
            onClick={() =>
              setCategories([])
            }
          >
            الكل
          </button>

          {categoryOptions.map(
            (category) => (
              <button
                className={
                  categories.includes(
                    category,
                  )
                    ? "active"
                    : ""
                }
                key={category}
                onClick={() =>
                  toggle(
                    setCategories,
                    category,
                  )
                }
              >
                {category}
              </button>
            ),
          )}
        </div>
      </nav>

      <div className="container shop-toolbar">
        <span>
          متوفر{" "}
          <b>
            {filtered.length}
          </b>{" "}
          منتجًا
        </span>

        <div>
          <button
            className="filter-trigger"
            onClick={() =>
              setDrawer(true)
            }
          >
            <FilterIcon />
            تصفية
          </button>

          <label htmlFor="sort">
            ترتيب حسب
          </label>

          <select
            id="sort"
            value={sort}
            onChange={(event) =>
              setSort(
                event.target.value,
              )
            }
          >
            <option value="featured">
              المنتجات المميزة
            </option>

            <option value="rating">
              الأعلى تقييمًا
            </option>

            <option value="price-asc">
              السعر: الأقل أولًا
            </option>

            <option value="price-desc">
              السعر: الأعلى أولًا
            </option>
          </select>
        </div>
      </div>

      <div className="container shop-layout">
        <aside className="filter-sidebar">
          <Filters
            {...props}
          />
        </aside>

        <section
          className="shop-products"
          aria-live="polite"
        >
          {filtered.length ? (
            <ProductGrid
              items={filtered}
            />
          ) : (
            <div className="empty-state">
              <h2>
                لا توجد منتجات
                مطابقة
              </h2>

              <p>
                جرّب إزالة بعض
                عوامل التصفية.
              </p>

              <button
                className="button primary"
                onClick={clear}
              >
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
            onClick={() =>
              setDrawer(false)
            }
            aria-label="إغلاق"
          />

          <div className="filter-drawer">
            <button
              className="drawer-close"
              onClick={() =>
                setDrawer(false)
              }
            >
              <CloseIcon />
              إغلاق
            </button>

            <Filters
              {...props}
            />

            <button
              className="button primary drawer-apply"
              onClick={() =>
                setDrawer(false)
              }
            >
              عرض{" "}
              {filtered.length}{" "}
              منتجات
            </button>
          </div>
        </div>
      )}

      <section className="collection-copy container">
        <h2>
          المعايير الحقيقية في
          عالم المكملات
        </h2>

        <p>
          نختار منتجات عالم
          اللياقة بعناية، مع
          التركيز على جودة
          المنتجات ووضوح
          معلوماتها ومصدرها.
        </p>

        <div>
          <article>
            <b>
              جودة مختارة
            </b>

            <span>
              مراجعة معلومات
              المنتجات
            </span>
          </article>

          <article>
            <b>
              توصيل سريع
            </b>

            <span>
              تغليف آمن للطلبات
            </span>
          </article>

          <article>
            <b>
              دعم العملاء
            </b>

            <span>
              مساعدة عند الحاجة
            </span>
          </article>
        </div>
      </section>
    </main>
  );
}