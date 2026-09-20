"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useState,
  useTransition,
  type FormEvent,
} from "react";

import { ArrowIcon, CloseIcon, SearchIcon } from "@/components/ui/icons";
import { buildSearchHref } from "@/lib/catalog-query";
import { formatPrice } from "@/lib/utils";
import type { Brand } from "@/types/brand";
import type { Category } from "@/types/category";
import type { SearchProduct } from "@/types/product";

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

function pageItems(page: number, totalPages: number) {
  return [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((item) => item > 0 && item <= totalPages)
    .sort((a, b) => a - b);
}

function SearchForm({
  query,
  onSearch,
  onClear,
}: {
  query: string;
  onSearch: (value: string) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(query);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(draft);
  };

  const clear = () => {
    setDraft("");
    onClear();
  };

  return (
    <form onSubmit={submit} role="search">
      <button type="submit" aria-label="تنفيذ البحث">
        <SearchIcon />
      </button>
      <label className="sr-only" htmlFor="main-search">
        ابحث في المتجر
      </label>
      <input
        id="main-search"
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="ابحث عن المكملات، الإكسسوارات، أو العلامات..."
      />
      {draft && (
        <button type="button" onClick={clear} aria-label="مسح البحث">
          مسح
        </button>
      )}
    </form>
  );
}

export function SearchPage({
  query,
  products,
  total,
  page,
  totalPages,
  categoryMatches,
  brandMatches,
}: {
  query: string;
  products: SearchProduct[];
  total: number;
  page: number;
  totalPages: number;
  categoryMatches: Category[];
  brandMatches: Brand[];
}) {
  const router = useRouter();
  const [recent, setRecent] = useState(recentDefault);
  const [isPending, startTransition] = useTransition();

  const navigate = (value: string) => {
    const href = buildSearchHref(value);
    startTransition(() => router.push(href));
  };

  const applySearch = (value: string) => {
    const normalized = value.trim().replace(/\s+/g, " ");

    if (normalized) {
      setRecent((current) =>
        [
          normalized,
          ...current.filter((item) => item !== normalized),
        ].slice(0, 5),
      );
    }

    navigate(normalized);
  };

  const hasResults =
    products.length + categoryMatches.length + brandMatches.length > 0;

  return (
    <main className="search-page">
      <header className="search-header">
        <Link href="/" aria-label="إغلاق البحث">
          <CloseIcon />
        </Link>

        <SearchForm
          key={query}
          query={query}
          onSearch={applySearch}
          onClear={() => navigate("")}
        />

        <Link href="/" className="search-back" aria-label="العودة">
          <ArrowIcon />
        </Link>
      </header>

      <div className="search-body container" aria-busy={isPending}>
        {!query ? (
          <>
            <section className="search-block">
              <div className="search-block-title">
                <h2>عمليات البحث الأخيرة</h2>
                {recent.length > 0 && (
                  <button onClick={() => setRecent([])}>مسح الكل</button>
                )}
              </div>
              {recent.length > 0 ? (
                <div className="search-chips">
                  {recent.map((item) => (
                    <button onClick={() => applySearch(item)} key={item}>
                      ↶ {item}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">لا توجد عمليات بحث حديثة.</p>
              )}
            </section>

            <section className="search-block">
              <h2>الكلمات الأكثر بحثًا</h2>
              <div className="popular-grid">
                {popular.map((item) => (
                  <button onClick={() => applySearch(item)} key={item}>
                    {item}
                    <span>↗</span>
                  </button>
                ))}
              </div>
            </section>

            <Link className="search-promo" href="/shop">
              <Image
                src="/images/search-promo.jpg"
                alt="استكشف منتجات عالم اللياقة"
                fill
                loading="lazy"
                sizes="(max-width: 900px) 100vw, 850px"
              />
              <span className="sr-only">استكشف منتجات عالم اللياقة</span>
            </Link>
          </>
        ) : hasResults ? (
          <section className="live-results">
            <div className="search-block-title">
              <h1>نتائج البحث عن “{query}”</h1>
              <span>{total} منتجات</span>
            </div>

            {products.length > 0 && (
              <div className="result-list">
                {products.map((product) => (
                  <Link
                    href={`/products/${product.slug}`}
                    className="search-result"
                    key={product.id}
                  >
                    <div>
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          loading="lazy"
                          sizes="90px"
                        />
                      ) : (
                        <span className="muted">لا توجد صورة</span>
                      )}
                    </div>
                    <span>
                      <small>{product.brand}</small>
                      <b>{product.shortName}</b>
                      <em>{formatPrice(product.price)}</em>
                    </span>
                    <ArrowIcon />
                  </Link>
                ))}
              </div>
            )}

            {(categoryMatches.length > 0 || brandMatches.length > 0) && (
              <div className="search-taxonomy">
                {categoryMatches.map((item) => (
                  <Link href={item.href} key={`${item.name}-${item.href}`}>
                    فئة: {item.name}
                  </Link>
                ))}
                {brandMatches.map((item) => (
                  <Link href="/shop" key={item.id}>
                    علامة: {item.name}
                  </Link>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <nav className="pagination" aria-label="صفحات نتائج البحث">
                {pageItems(page, totalPages).map((item, index, pages) => (
                  <span key={item}>
                    {index > 0 && item - pages[index - 1] > 1 && (
                      <i aria-hidden="true">…</i>
                    )}
                    <Link
                      href={buildSearchHref(query, item)}
                      className={item === page ? "active" : ""}
                      aria-current={item === page ? "page" : undefined}
                    >
                      {item}
                    </Link>
                  </span>
                ))}
              </nav>
            )}
          </section>
        ) : (
          <section className="empty-state search-empty">
            <SearchIcon />
            <h1>لم نجد ما تبحث عنه</h1>
            <p>تأكد من كتابة الكلمة أو جرّب عبارة أقصر.</p>
            <button className="button primary" onClick={() => navigate("")}>
              العودة للاقتراحات
            </button>
          </section>
        )}
      </div>

      <footer className="search-footer">عالم اللياقة © 2026</footer>
    </main>
  );
}
