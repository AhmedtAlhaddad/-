import {
  unstable_cache,
} from "next/cache";

import {
  getBrands as fetchBrands,
  getCategories as fetchCategories,
  getProductBySlug as fetchProductBySlug,
  getProducts as fetchProducts,
} from "@/lib/supabase/catalog";

import {
  PUBLIC_CATALOG_CACHE_TAG,
  PUBLIC_CATALOG_REVALIDATE_SECONDS,
} from "@/lib/supabase/catalog-cache-key";

const cachedProducts =
  unstable_cache(
    async () =>
      fetchProducts(),
    [
      "public-catalog-products-v1",
    ],
    {
      revalidate:
        PUBLIC_CATALOG_REVALIDATE_SECONDS,

      tags: [
        PUBLIC_CATALOG_CACHE_TAG,
      ],
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
      "public-catalog-categories-v1",
    ],
    {
      revalidate:
        PUBLIC_CATALOG_REVALIDATE_SECONDS,

      tags: [
        PUBLIC_CATALOG_CACHE_TAG,
      ],
    },
  );

export async function getProducts() {
  return cachedProducts();
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