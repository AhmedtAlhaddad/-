import {
  revalidatePath,
  revalidateTag,
} from "next/cache";

import {
  PUBLIC_CATALOG_CACHE_TAG,
} from "@/lib/supabase/catalog-cache-key";

export function revalidatePublicCatalog(
  productSlug?: string,
) {
  revalidateTag(
    PUBLIC_CATALOG_CACHE_TAG,
    "max",
  );

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/search");

  if (productSlug) {
    revalidatePath(
      `/products/${productSlug}`,
    );

    return;
  }

  revalidatePath(
    "/products/[slug]",
    "page",
  );
}