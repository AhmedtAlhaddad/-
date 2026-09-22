import {
  unstable_cache,
} from "next/cache";

import {
  getBrands as fetchBrands,
  getCatalogPage as fetchCatalogPage,
  getCategories as fetchCategories,
  getFeaturedProducts as fetchFeaturedProducts,
  getHomepageCategories as fetchHomepageCategories,
  getNavigationCategories as fetchNavigationCategories,
  getProductBySlug as fetchProductBySlug,
  searchProducts as fetchSearchProducts,
} from "@/lib/supabase/catalog";

import type {
  CatalogSort,
  ProductScope,
} from "@/lib/catalog-query";

import {
  PUBLIC_CATALOG_CACHE_TAG,
  PUBLIC_CATALOG_REVALIDATE_SECONDS,
} from "@/lib/supabase/catalog-cache-key";
import { fetchPopularSearchTerms } from "@/lib/supabase/search-analytics";

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
      "public-catalog-featured-products-v3",
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
    brandSlugs: string[],
    trainingGoals: string[],
    available: boolean,
    sort: CatalogSort,
    productScope: ProductScope | null,
    page: number,
    pageSize: number,
  ) =>
    fetchCatalogPage({
      categorySlugs,
      brandSlugs,
      trainingGoals,
      available,
      sort,
      productScope,
      page,
      pageSize,
    }),
  ["public-catalog-list-v5"],
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
      "public-catalog-product-by-slug-v2",
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
      "public-catalog-brands-v2",
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
      "public-catalog-categories-v4",
    ],
    {
      revalidate:
        PUBLIC_CATALOG_REVALIDATE_SECONDS,

      tags: [
        PUBLIC_CATALOG_CACHE_TAG,
      ],
    },
  );

const cachedHomepageCategories =
  unstable_cache(
    async () => fetchHomepageCategories(),
    ["public-catalog-homepage-categories-v1"],
    {
      revalidate:
        PUBLIC_CATALOG_REVALIDATE_SECONDS,
      tags: [PUBLIC_CATALOG_CACHE_TAG],
    },
  );

const cachedNavigationCategories = unstable_cache(
  async () => fetchNavigationCategories(),
  ["public-catalog-navigation-categories-v1"],
  {
    revalidate: PUBLIC_CATALOG_REVALIDATE_SECONDS,
    tags: [PUBLIC_CATALOG_CACHE_TAG],
  },
);

const cachedPopularSearchTerms = unstable_cache(
  async (limit: number) => fetchPopularSearchTerms(limit),
  ["public-popular-search-terms-v1"],
  { revalidate: PUBLIC_CATALOG_REVALIDATE_SECONDS },
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
  brandSlugs: string[],
  trainingGoals: string[],
  available: boolean,
  sort: CatalogSort,
  productScope: ProductScope | null,
  page: number,
  pageSize: number,
) {
  return cachedCatalogPage(
    categorySlugs,
    brandSlugs,
    trainingGoals,
    available,
    sort,
    productScope,
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

export async function getHomepageCategories() {
  return cachedHomepageCategories();
}

export async function getNavigationCategories() {
  return cachedNavigationCategories();
}

export async function getPopularSearchTerms(limit = 8) {
  return cachedPopularSearchTerms(limit);
}
