import {
  unstable_cache,
} from "next/cache";

import {
  getBrands as fetchBrands,
  getCatalogPage as fetchCatalogPage,
  getCategories as fetchCategories,
  getFeaturedProducts as fetchFeaturedProducts,
  getProductBySlug as fetchProductBySlug,
  searchProducts as fetchSearchProducts,
} from "@/lib/supabase/catalog";

import type {
  CatalogSort,
} from "@/lib/catalog-query";

import {
  PUBLIC_CATALOG_CACHE_TAG,
  PUBLIC_CATALOG_REVALIDATE_SECONDS,
} from "@/lib/supabase/catalog-cache-key";

const cachedFeaturedProducts =
  unstable_cache(
    async (
      limit: number,
      excludeProductSlug?: string,
    ) =>
      fetchFeaturedProducts(
        limit,
        excludeProductSlug,
      ),
    [
      "public-catalog-featured-products-v2",
    ],
    {
      revalidate:
        PUBLIC_CATALOG_REVALIDATE_SECONDS,

      tags: [
        PUBLIC_CATALOG_CACHE_TAG,
      ],
    },
  );

const cachedCatalogPage = unstable_cache(
  async (
    categorySlugs: string[],
    trainingGoals: string[],
    available: boolean,
    sort: CatalogSort,
    page: number,
    pageSize: number,
  ) =>
    fetchCatalogPage({
      categorySlugs,
      trainingGoals,
      available,
      sort,
      page,
      pageSize,
    }),
  ["public-catalog-list-v2"],
  {
    revalidate: PUBLIC_CATALOG_REVALIDATE_SECONDS,
    tags: [PUBLIC_CATALOG_CACHE_TAG],
  },
);

const cachedSearchProducts = unstable_cache(
  async (
    query: string,
    page: number,
    pageSize: number,
  ) => fetchSearchProducts(query, page, pageSize),
  ["public-catalog-search-v2"],
  {
    revalidate: PUBLIC_CATALOG_REVALIDATE_SECONDS,
    tags: [PUBLIC_CATALOG_CACHE_TAG],
  },
);

const cachedProductBySlug =
  unstable_cache(
    async (
      slug: string,
    ) =>
      fetchProductBySlug(
        slug,
      ),
    [
      "public-catalog-product-by-slug-v1",
    ],
    {
      revalidate:
        PUBLIC_CATALOG_REVALIDATE_SECONDS,

      tags: [
        PUBLIC_CATALOG_CACHE_TAG,
      ],
    },
  );

const cachedBrands =
  unstable_cache(
    async () =>
      fetchBrands(),
    [
      "public-catalog-brands-v1",
    ],
    {
      revalidate:
        PUBLIC_CATALOG_REVALIDATE_SECONDS,

      tags: [
        PUBLIC_CATALOG_CACHE_TAG,
      ],
    },
  );

const cachedCategories =
  unstable_cache(
    async () =>
      fetchCategories(),
    [
      "public-catalog-categories-v2",
    ],
    {
      revalidate:
        PUBLIC_CATALOG_REVALIDATE_SECONDS,

      tags: [
        PUBLIC_CATALOG_CACHE_TAG,
      ],
    },
  );

export async function getFeaturedProducts(
  limit = 4,
  excludeProductSlug?: string,
) {
  return cachedFeaturedProducts(
    limit,
    excludeProductSlug,
  );
}

export async function getCatalogPage(
  categorySlugs: string[],
  trainingGoals: string[],
  available: boolean,
  sort: CatalogSort,
  page: number,
  pageSize: number,
) {
  return cachedCatalogPage(
    categorySlugs,
    trainingGoals,
    available,
    sort,
    page,
    pageSize,
  );
}

export async function searchProducts(
  query: string,
  page: number,
  pageSize: number,
) {
  return cachedSearchProducts(query, page, pageSize);
}

export async function getProductBySlug(
  slug: string,
) {
  return cachedProductBySlug(
    slug,
  );
}

export async function getBrands() {
  return cachedBrands();
}

export async function getCategories() {
  return cachedCategories();
}
