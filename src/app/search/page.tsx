import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SearchPage } from "@/components/search/search-page";

import {
  getBrands,
  getCategories,
  searchProducts,
} from "@/lib/supabase/catalog-cache";

import {
  SEARCH_PAGE_SIZE,
  buildSearchHref,
  normalizePage,
  normalizeSearchQuery,
} from "@/lib/catalog-query";

export const metadata: Metadata = {
  title: "البحث",

  robots: {
    index: false,
    follow: true,
  },
};

export const revalidate =
  300;

type Props = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);
  const page = normalizePage(params.page);

  const [results, categories, brands] = query
    ? await Promise.all([
        searchProducts(query, page, SEARCH_PAGE_SIZE),
        getCategories(),
        getBrands(),
      ])
    : [
        {
          products: [],
          total: 0,
          page: 1,
          pageSize: SEARCH_PAGE_SIZE,
          totalPages: 0,
        },
        [],
        [],
      ];

  if (query && results.page !== page) {
    redirect(buildSearchHref(query, results.page));
  }

  const normalized = query.toLocaleLowerCase("ar");
  const categoryMatches = categories.filter((category) =>
    `${category.name} ${category.description}`
      .toLocaleLowerCase("ar")
      .includes(normalized),
  );
  const brandMatches = brands.filter((brand) =>
    brand.name.toLocaleLowerCase("ar").includes(normalized),
  );

  return (
    <SearchPage
      query={query}
      products={results.products}
      total={results.total}
      page={results.page}
      totalPages={results.totalPages}
      categoryMatches={categoryMatches}
      brandMatches={brandMatches}
    />
  );
}
