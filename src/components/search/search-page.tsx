"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ArrowIcon,
  CloseIcon,
  SearchIcon,
} from "@/components/ui/icons";

import { formatPrice } from "@/lib/utils";

import type { Brand } from "@/types/brand";
import type { Category } from "@/types/category";
import type { Product } from "@/types/product";

const recentDefault = [
  "واي بروتين",
  "كرياتين",
  "إكسسوارات اللياقة",
];

const popular = [
  "مكملات ما قبل التمرين",
  "كرياتين مونوهيدرات",
  "بروتين مصل اللبن",
  "BCAA أحماض أمينية",
  "إكسسوارات اللياقة",
];

export function SearchPage({
  products,
  categories,
  brands,
}: {
  products: Product[];
  categories: Category[];
  brands: Brand[];
}) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] =
    useState(recentDefault);

  const normalized =
    query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!normalized) {
      return [];
    }

    return products.filter(
      (product) => {
        const searchable = [
          product.name,
          product.shortName,
          product.brand,
          product.category,
          product.goal,
          product.type,
          product.description,
          ...product.features,
          ...product.variants.map(
            (variant) =>
              variant.flavor,
          ),
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(
          normalized,
        );
      },
    );
  }, [normalized, products]);

  const categoryMatches =
    useMemo(() => {
      if (!normalized) {
        return [];
      }

      return categories.filter(
        (category) =>
          [
            category.name,
            category.description,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
    }, [
      categories,
      normalized,
    ]);

  const brandMatches =
    useMemo(() => {
      if (!normalized) {
        return [];
      }

      return brands.filter(
        (brand) =>
          brand.name
            .toLowerCase()
            .includes(normalized),
      );
    }, [
      brands,
      normalized,
    ]);

  const hasResults =
    results.length +
      categoryMatches.length +
      brandMatches.length >
    0;

  const applySearch = (
    value: string,
  ) => {
    setQuery(value);

    setRecent((current) => {
      const next = [
        value,
        ...current.filter(
          (item) =>
            item !== value,
        ),
      ];

      return next.slice(0, 5);
    });
  };

  return (
    <main className="search-page">
      <header className="search-header">
        <Link
          href="/"
          aria-label="إغلاق البحث"
        >
          <CloseIcon />
        </Link>

        <div>
          <SearchIcon />

          <label
            className="sr-only"
            htmlFor="main-search"
          >
            ابحث في المتجر
          </label>

          <input
            id="main-search"
            autoFocus
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value,
              )
            }
            placeholder="ابحث عن المكملات، الإكسسوارات، أو العلامات..."
          />

          {query && (
            <button
              onClick={() =>
                setQuery("")
              }
              aria-label="مسح البحث"
            >
              مسح
            </button>
          )}
        </div>

        <Link
          href="/"
          className="search-back"
          aria-label="العودة"
        >
          <ArrowIcon />
        </Link>
      </header>

      <div className="search-body container">
        {!normalized ? (
          <>
            <section className="search-block">
              <div className="search-block-title">
                <h2>
                  عمليات البحث الأخيرة
                </h2>

                {recent.length >
                  0 && (
                  <button
                    onClick={() =>
                      setRecent([])
                    }
                  >
                    مسح الكل
                  </button>
                )}
              </div>

              {recent.length ? (
                <div className="search-chips">
                  {recent.map(
                    (item) => (
                      <button
                        onClick={() =>
                          applySearch(
                            item,
                          )
                        }
                        key={item}
                      >
                        ↶ {item}
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <p className="muted">
                  لا توجد عمليات بحث
                  حديثة.
                </p>
              )}
            </section>

            <section className="search-block">
              <h2>
                الكلمات الأكثر بحثًا
              </h2>

              <div className="popular-grid">
                {popular.map(
                  (item) => (
                    <button
                      onClick={() =>
                        applySearch(
                          item,
                        )
                      }
                      key={item}
                    >
                      {item}

                      <span>
                        ↗
                      </span>
                    </button>
                  ),
                )}
              </div>
            </section>

            <Link
              className="search-promo"
              href="/shop"
            >
              <Image
                src="/images/search-promo.jpg"
                alt="استكشف منتجات عالم اللياقة"
                fill
                loading="lazy"
                sizes="900px"
              />

              <span className="sr-only">
                استكشف منتجات عالم
                اللياقة
              </span>
            </Link>
          </>
        ) : hasResults ? (
          <section className="live-results">
            <div className="search-block-title">
              <h1>
                نتائج البحث عن “
                {query}”
              </h1>

              <span>
                {results.length} منتجات
              </span>
            </div>

            {results.length >
              0 && (
              <div className="result-list">
                {results.map(
                  (product) => {
                    const variant =
                      product
                        .variants[0];

                    const image =
                      product
                        .images[0];

                    return (
                      <Link
                        href={`/products/${product.slug}`}
                        className="search-result"
                        key={
                          product.id
                        }
                      >
                        <div>
                          {image ? (
                            <Image
                              src={
                                image
                              }
                              alt={
                                product.name
                              }
                              fill
                              sizes="90px"
                            />
                          ) : (
                            <span className="muted">
                              لا توجد صورة
                            </span>
                          )}
                        </div>

                        <span>
                          <small>
                            {
                              product.brand
                            }
                          </small>

                          <b>
                            {
                              product.shortName
                            }
                          </b>

                          {variant && (
                            <em>
                              {formatPrice(
                                variant.price,
                              )}
                            </em>
                          )}
                        </span>

                        <ArrowIcon />
                      </Link>
                    );
                  },
                )}
              </div>
            )}

            {(categoryMatches.length >
              0 ||
              brandMatches.length >
                0) && (
              <div className="search-taxonomy">
                {categoryMatches.map(
                  (item) => (
                    <Link
                      href={
                        item.href
                      }
                      key={`${item.name}-${item.href}`}
                    >
                      فئة:{" "}
                      {item.name}
                    </Link>
                  ),
                )}

                {brandMatches.map(
                  (item) => (
                    <Link
                      href="/shop"
                      key={item.id}
                    >
                      علامة:{" "}
                      {item.name}
                    </Link>
                  ),
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="empty-state search-empty">
            <SearchIcon />

            <h1>
              لم نجد ما تبحث عنه
            </h1>

            <p>
              تأكد من كتابة الكلمة أو
              جرّب عبارة أقصر.
            </p>

            <button
              className="button primary"
              onClick={() =>
                setQuery("")
              }
            >
              العودة للاقتراحات
            </button>
          </section>
        )}
      </div>

      <footer className="search-footer">
        عالم اللياقة © 2026
      </footer>
    </main>
  );
}