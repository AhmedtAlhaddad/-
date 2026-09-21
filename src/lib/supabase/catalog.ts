import { supabase } from "@/lib/supabase/client";

import type { Brand } from "@/types/brand";
import type {
  CatalogCategory,
  HomepageCategory,
} from "@/types/category";
import type {
  CatalogProduct,
  Product,
  ProductCategory,
  ProductVariant,
  SearchProduct,
} from "@/types/product";

import type {
  CatalogSort,
} from "@/lib/catalog-query";

const PRODUCT_IMAGES_BUCKET = "product-images";

type BrandRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
};

type CategoryRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
};

type CatalogBrandRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  logo_path: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

type CatalogCategoryRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  active: boolean;
  sort_order: number;
};

type CategoryProductRow = {
  category_id: string;
  images: Array<{
    id: string;
    storage_path: string | null;
    external_url: string | null;
    sort_order: number;
    is_primary: boolean;
    created_at: string;
  }>;
};

type VariantRow = {
  id: string;
  sku: string;
  flavor_ar: string | null;
  flavor_en: string | null;
  weight_value: number | null;
  weight_unit: string | null;
  size_label_ar: string | null;
  size_label_en: string | null;
  servings: number | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  active: boolean;
  sort_order: number;
};

type ImageRow = {
  id: string;
  variant_id: string | null;
  storage_path: string | null;
  external_url: string | null;
  alt_text_ar: string | null;
  alt_text_en: string | null;
  sort_order: number;
  is_primary: boolean;
};

type SupabaseProductRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  short_description_ar: string | null;
  full_description_ar: string | null;
  nutrition_facts: string | null;
  usage_instructions: string | null;
  product_type: string | null;
  training_goal: string | null;
  highlights: unknown;
  badge_label_ar: string | null;
  featured: boolean;
  status: string;

  brand: BrandRow | null;
  category: CategoryRow | null;

  variants: VariantRow[];
  images: ImageRow[];
};

type CatalogProductRow = {
  id: string;
  slug: string;
  name_ar: string;
  product_type: string | null;
  training_goal: string | null;
  badge_label_ar: string | null;
  featured: boolean;
  brand: BrandRow | null;
  category: CategoryRow | null;
  variants: VariantRow[];
  images: ImageRow[];
};

type StorefrontProductRow = {
  id: string;
  slug: string;
  name_ar: string;
  brand_name_ar: string;
  category_slug: string;
  product_type: string | null;
  training_goal: string | null;
  badge_label_ar: string | null;
  featured: boolean;
  variant_id: string;
  variant_flavor_ar: string | null;
  variant_weight_value: number | string | null;
  variant_weight_unit: string | null;
  variant_size_label_ar: string | null;
  variant_servings: number | null;
  variant_price: number | string;
  variant_compare_at_price: number | string | null;
  variant_stock_quantity: number;
  in_stock: boolean;
  image_storage_path: string | null;
  image_external_url: string | null;
  total_count: number | string;
};

export type CatalogPage = {
  products: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type SearchPage = {
  products: SearchProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CatalogPageQuery = {
  categorySlugs: string[];
  trainingGoals: string[];
  available: boolean;
  sort: CatalogSort;
  productScope: "supplements" | "accessories" | null;
  page: number;
  pageSize: number;
};

const productSelect = `
  id,
  slug,
  name_ar,
  name_en,
  short_description_ar,
  full_description_ar,
  nutrition_facts,
  usage_instructions,
  product_type,
  training_goal,
  highlights,
  badge_label_ar,
  featured,
  status,

  brand:brands (
    id,
    slug,
    name_ar,
    name_en
  ),

  category:categories (
    id,
    slug,
    name_ar,
    name_en
  ),

  variants:product_variants (
    id,
    flavor_ar,
    weight_value,
    weight_unit,
    size_label_ar,
    servings,
    price,
    compare_at_price,
    stock_quantity,
    active,
    sort_order
  ),

  images:product_images (
    id,
    variant_id,
    storage_path,
    external_url,
    sort_order,
    is_primary
  )
`;

const catalogCardSelect = `
  id,
  slug,
  name_ar,
  product_type,
  training_goal,
  badge_label_ar,
  featured,

  brand:brands!inner (
    id,
    slug,
    name_ar,
    name_en
  ),

  category:categories!inner (
    id,
    slug,
    name_ar,
    name_en
  ),

  variants:product_variants (
    id,
    sku,
    flavor_ar,
    flavor_en,
    weight_value,
    weight_unit,
    size_label_ar,
    size_label_en,
    servings,
    price,
    compare_at_price,
    stock_quantity,
    active,
    sort_order
  ),

  images:product_images (
    id,
    variant_id,
    storage_path,
    external_url,
    alt_text_ar,
    alt_text_en,
    sort_order,
    is_primary
  )
`;

function mapCategory(
  category:
    | CategoryRow
    | null,
): ProductCategory {
  return (
    category?.name_ar.trim() ||
    category?.name_en?.trim() ||
    category?.slug ||
    ""
  );
}

function mapProductType(
  type: string | null,
): string {
  switch (type) {
    case "whey-protein":
      return "واي بروتين";

    case "creatine":
      return "كرياتين";

    case "pre-workout":
      return "Pre-Workout";

    case "bcaa":
      return "BCAA";

    case "fitness-accessory":
      return "إكسسوار رياضي";

    default:
      return type ?? "مكمل غذائي";
  }
}

function getStorageUrl(
  path: string | null,
): string | null {
  if (!path) {
    return null;
  }

  if (
    path.startsWith("https://") ||
    path.startsWith("http://") ||
    path.startsWith("/")
  ) {
    return path;
  }

  const { data } = supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

function getBrandLogoUrl(
  path: string | null,
): string | null {
  if (!path) {
    return null;
  }

  if (path.startsWith("/")) {
    return path;
  }

  if (
    path.startsWith("https://") ||
    path.startsWith("http://")
  ) {
    return path.includes(
      ".supabase.co/storage/v1/object/public/product-images/",
    )
      ? path
      : null;
  }

  return getStorageUrl(path);
}

function getImageUrl(
  image: {
    storage_path: string | null;
    external_url: string | null;
  },
): string | null {
  if (image.external_url) {
    return image.external_url;
  }

  return getStorageUrl(
    image.storage_path,
  );
}

function formatWeight(
  variant: VariantRow,
): string {
  if (variant.size_label_ar) {
    return variant.size_label_ar;
  }

  if (
    variant.weight_value === null ||
    !variant.weight_unit
  ) {
    return "";
  }

  const unitLabels: Record<
    string,
    string
  > = {
    g: "جم",
    kg: "كجم",
    ml: "مل",
    l: "لتر",
    capsule: "كبسولة",
    tablet: "قرص",
    piece: "قطعة",
  };

  const unit =
    unitLabels[
      variant.weight_unit
    ] ?? variant.weight_unit;

  return `${Number(
    variant.weight_value,
  )} ${unit}`;
}

function uniqueImages(
  images: string[],
): string[] {
  return [...new Set(images)];
}

function mapProduct(
  row: SupabaseProductRow,
): Product {
  const sortedImages = [
    ...(row.images ?? []),
  ].sort(
    (a, b) =>
      a.sort_order -
      b.sort_order,
  );

  const globalImageRows =
    sortedImages
      .filter(
        (image) =>
          image.variant_id ===
          null,
      )
      .sort((a, b) => {
        if (
          a.is_primary !==
          b.is_primary
        ) {
          return a.is_primary
            ? -1
            : 1;
        }

        return (
          a.sort_order -
          b.sort_order
        );
      });

  const globalImages =
    globalImageRows
      .map(getImageUrl)
      .filter(
        (
          url,
        ): url is string =>
          Boolean(url),
      );

  const allImageUrls =
    sortedImages
      .map(getImageUrl)
      .filter(
        (
          url,
        ): url is string =>
          Boolean(url),
      );

  const productImages =
    globalImages.length > 0
      ? uniqueImages(
          globalImages,
        )
      : uniqueImages(
          allImageUrls,
        );

  const variants: ProductVariant[] =
    [...(row.variants ?? [])]
      .filter(
        (variant) =>
          variant.active,
      )
      .sort(
        (a, b) =>
          a.sort_order -
          b.sort_order,
      )
      .map((variant) => {
        const specificImages =
          sortedImages
            .filter(
              (image) =>
                image.variant_id ===
                variant.id,
            )
            .map(getImageUrl)
            .filter(
              (
                url,
              ): url is string =>
                Boolean(url),
            );

        return {
          id:
            variant.id,

          flavor:
            variant.flavor_ar ??
            variant.size_label_ar ??
            "الخيار الافتراضي",

          weight:
            formatWeight(
              variant,
            ),

          servings:
            variant.servings ??
            0,

          price:
            Number(
              variant.price,
            ),

          compareAtPrice:
            variant.compare_at_price !==
            null
              ? Number(
                  variant.compare_at_price,
                )
              : undefined,

          stock:
            variant.stock_quantity,

          images:
            specificImages.length > 0
              ? uniqueImages(
                  specificImages,
                )
              : productImages,
        };
      });

  const highlights =
    Array.isArray(
      row.highlights,
    )
      ? row.highlights.filter(
          (
            item,
          ): item is string =>
            typeof item ===
            "string",
        )
      : [];

  return {
    id:
      row.id,

    slug:
      row.slug,

    brand:
      row.brand?.name_ar ??
      "",

    name:
      row.name_ar,

    shortName:
      row.name_ar,

    description:
      row.short_description_ar ??
      row.full_description_ar ??
      "",

    nutritionFacts:
      row.nutrition_facts,

    usageInstructions:
      row.usage_instructions,

    category:
      mapCategory(
        row.category,
      ),

    images:
      productImages,

    badge:
      row.badge_label_ar ??
      undefined,

    inStock:
      variants.some(
        (variant) =>
          variant.stock > 0,
      ),

    type:
      mapProductType(
        row.product_type,
      ),

    storefrontScope:
      row.product_type === "fitness-accessory"
        ? "accessories"
        : "supplements",

    features:
      highlights,

    variants,
  };
}

function compactCatalogProduct(
  product: Product,
): CatalogProduct {
  const firstVariant = product.variants[0];

  return {
    id: product.id,
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    shortName: product.shortName,
    category: product.category,
    images: product.images.slice(0, 1),
    badge: product.badge,
    inStock: product.inStock,
    type: product.type,
    storefrontScope: product.storefrontScope,
    variants: firstVariant
      ? [
          {
            ...firstVariant,
            images: [],
          },
        ]
      : [],
  };
}

function mapCatalogProduct(
  row: CatalogProductRow,
): CatalogProduct {
  const product = mapProduct({
    ...row,
    short_description_ar: null,
    full_description_ar: null,
    highlights: [],
    status: "active",
    nutrition_facts: null,
    usage_instructions: null,
  } as SupabaseProductRow);

  return compactCatalogProduct(product);
}

function mapStorefrontProduct(
  row: StorefrontProductRow,
): CatalogProduct {
  const variant = {
    id: row.variant_id,
    sku: "",
    flavor_ar: row.variant_flavor_ar,
    flavor_en: null,
    weight_value:
      row.variant_weight_value === null
        ? null
        : Number(row.variant_weight_value),
    weight_unit: row.variant_weight_unit,
    size_label_ar: row.variant_size_label_ar,
    size_label_en: null,
    servings: row.variant_servings,
    price: Number(row.variant_price),
    compare_at_price:
      row.variant_compare_at_price === null
        ? null
        : Number(row.variant_compare_at_price),
    stock_quantity: row.variant_stock_quantity,
    active: true,
    sort_order: 0,
  } satisfies VariantRow;

  const image = getImageUrl({
    storage_path: row.image_storage_path,
    external_url: row.image_external_url,
  });

  return {
    id: row.id,
    slug: row.slug,
    brand: row.brand_name_ar,
    name: row.name_ar,
    shortName: row.name_ar,
    category: row.category_slug,
    images: image ? [image] : [],
    badge: row.badge_label_ar ?? undefined,
    inStock: row.in_stock,
    type: mapProductType(row.product_type),
    storefrontScope:
      row.product_type === "fitness-accessory"
        ? "accessories"
        : "supplements",
    variants: [
      {
        id: variant.id,
        flavor:
          variant.flavor_ar ??
          variant.size_label_ar ??
          "الخيار الافتراضي",
        weight: formatWeight(variant),
        servings: variant.servings ?? 0,
        price: Number(variant.price),
        compareAtPrice:
          variant.compare_at_price === null
            ? undefined
            : Number(variant.compare_at_price),
        stock: variant.stock_quantity,
        images: [],
      },
    ],
  };
}

async function runStorefrontQuery({
  categorySlugs,
  trainingGoals,
  available,
  sort,
  productScope,
  search,
  page,
  pageSize,
}: CatalogPageQuery & { search?: string }) {
  const functionName = productScope
    ? "list_storefront_products_by_scope"
    : "list_storefront_products";
  const parameters = {
    p_category_slugs:
      categorySlugs.length > 0
        ? categorySlugs
        : null,
    p_training_goals:
      trainingGoals.length > 0
        ? trainingGoals
        : null,
    p_available: available,
    p_sort: sort,
    p_search: search || null,
    p_offset: (page - 1) * pageSize,
    p_limit: pageSize,
    ...(productScope
      ? { p_product_scope: productScope }
      : {}),
  };
  const { data, error } = await supabase.rpc(
    functionName,
    parameters,
  );

  if (error) {
    console.error(
      "Failed to fetch storefront catalog:",
      error,
    );

    throw error;
  }

  return (data ?? []) as StorefrontProductRow[];
}

async function getStorefrontPage(
  query: CatalogPageQuery & { search?: string },
) {
  let page = query.page;
  let rows = await runStorefrontQuery(query);

  if (rows.length === 0 && page > 1) {
    page = 1;
    rows = await runStorefrontQuery({
      ...query,
      page,
    });
  }

  const total = Number(rows[0]?.total_count ?? 0);

  return {
    rows,
    total,
    page,
    pageSize: query.pageSize,
    totalPages:
      total > 0 ? Math.ceil(total / query.pageSize) : 0,
  };
}

export async function getProductBySlug(
  slug: string,
): Promise<Product | null> {
  const { data, error } =
    await supabase
      .from("products")
      .select(productSelect)
      .eq(
        "slug",
        slug,
      )
      .eq(
        "status",
        "active",
      )
      .maybeSingle();

  if (error) {
    console.error(
      "Failed to fetch product:",
      error,
    );

    throw error;
  }

  if (!data) {
    return null;
  }

  return mapProduct(
    data as unknown as SupabaseProductRow,
  );
}

export async function getCatalogPage(
  query: CatalogPageQuery,
): Promise<CatalogPage> {
  const result = await getStorefrontPage(query);

  return {
    products: result.rows.map(mapStorefrontProduct),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };
}

export async function searchProducts(
  search: string,
  page: number,
  pageSize: number,
): Promise<SearchPage> {
  const result = await getStorefrontPage({
    categorySlugs: [],
    trainingGoals: [],
    available: false,
    sort: "featured",
    productScope: null,
    search,
    page,
    pageSize,
  });

  return {
    products: result.rows.map((row) => {
      const product = mapStorefrontProduct(row);

      return {
        id: product.id,
        slug: product.slug,
        brand: product.brand,
        name: product.name,
        shortName: product.shortName,
        image: product.images[0],
        price: product.variants[0].price,
      };
    }),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };
}

export async function getFeaturedProducts(
  limit = 4,
  excludeProductSlug?: string,
): Promise<CatalogProduct[]> {
  const { data: rankedData, error: rankedError } =
    await supabase.rpc(
      "list_storefront_featured_products",
      {
        p_limit: limit,
        p_exclude_slug:
          excludeProductSlug ?? null,
      },
    );

  if (!rankedError) {
    return (
      (rankedData ?? []) as StorefrontProductRow[]
    )
      .map(mapStorefrontProduct)
      .filter(
        (product) => product.variants.length > 0,
      );
  }

  if (
    rankedError.code !== "PGRST202" &&
    rankedError.code !== "42883"
  ) {
    console.error(
      "Failed to fetch ranked storefront products:",
      rankedError,
    );

    throw rankedError;
  }

  let query = supabase
    .from("products")
    .select(catalogCardSelect)
    .eq("status", "active")
    .order("created_at", {
      ascending: false,
    })
    .limit(Math.max(limit * 10, 40));

  if (excludeProductSlug) {
    query = query.neq("slug", excludeProductSlug);
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "Failed to fetch featured products:",
      error,
    );

    throw error;
  }

  return (data ?? [])
    .map((row) =>
      mapCatalogProduct(
        row as unknown as CatalogProductRow,
      ),
    )
    .filter((product) => product.variants.length > 0)
    .sort(
      (left, right) =>
        right.variants.reduce(
          (total, variant) => total + variant.stock,
          0,
        ) -
        left.variants.reduce(
          (total, variant) => total + variant.stock,
          0,
        ),
    )
    .slice(0, limit);
}

export async function getBrands(): Promise<
  Brand[]
> {
  const { data, error } =
    await supabase
      .from("brands")
      .select(`
        id,
        slug,
        name_ar,
        name_en,
        logo_path,
        active,
        sort_order,
        created_at
      `)
      .eq(
        "active",
        true,
      )
      .order(
        "sort_order",
        {
          ascending: true,
        },
      )
      .order(
        "name_ar",
        {
          ascending: true,
        },
      );

  if (error) {
    console.error(
      "Failed to fetch brands:",
      error,
    );

    throw error;
  }

  return (data ?? []).map(
    (row) => {
      const brand =
        row as CatalogBrandRow;

      return {
        id:
          brand.id,

        name:
          brand.name_ar.trim() ||
          brand.name_en?.trim() ||
          brand.slug,

        logo:
          getBrandLogoUrl(
            brand.logo_path,
          ) ?? undefined,
      };
    },
  );
}

async function getActiveCategoryRows() {
  const { data, error } =
    await supabase
      .from("categories")
      .select(`
        id,
        slug,
        name_ar,
        name_en,
        description_ar,
        active,
        sort_order
      `)
      .eq(
        "active",
        true,
      )
      .order(
        "sort_order",
        {
          ascending: true,
        },
      )
      .order(
        "slug",
        {
          ascending: true,
        },
      );

  if (error) {
    console.error(
      "Failed to fetch categories:",
      error,
    );

    throw error;
  }

  return (data ?? []) as CatalogCategoryRow[];
}

function mapCatalogCategory(
  category: CatalogCategoryRow,
): CatalogCategory {
  return {
    slug: category.slug,
    name:
      category.name_ar.trim() ||
      category.name_en?.trim() ||
      category.slug,
    description:
      category.description_ar ??
      "تصفح منتجات هذه الفئة",
    href: `/shop?category=${encodeURIComponent(
      category.slug,
    )}`,
  };
}

export async function getCategories(): Promise<
  CatalogCategory[]
> {
  const categoryRows = await getActiveCategoryRows();

  return categoryRows.map(mapCatalogCategory);
}

export async function getHomepageCategories(): Promise<
  HomepageCategory[]
> {
  const categoryRows = await getActiveCategoryRows();
  const categoryIds = categoryRows.map(
    (category) => category.id,
  );
  let productRows: CategoryProductRow[] = [];

  if (categoryIds.length > 0) {
    const {
      data: imageData,
      error: imageError,
    } = await supabase
      .from("products")
      .select(`
        category_id,
        images:product_images (
          id,
          storage_path,
          external_url,
          sort_order,
          is_primary,
          created_at
        )
      `)
      .eq("status", "active")
      .in("category_id", categoryIds)
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: true,
      });

    if (imageError) {
      console.error(
        "Failed to fetch category product images:",
        imageError,
      );

      throw imageError;
    }

    productRows = (imageData ??
      []) as unknown as CategoryProductRow[];
  }

  const imagesByCategory = new Map<
    string,
    string[]
  >();

  productRows.forEach((product) => {
    const urls = [...(product.images ?? [])]
      .sort((left, right) => {
        if (
          left.is_primary !== right.is_primary
        ) {
          return left.is_primary ? -1 : 1;
        }

        const sortOrder =
          left.sort_order - right.sort_order;

        if (sortOrder !== 0) {
          return sortOrder;
        }

        return (
          left.created_at.localeCompare(
            right.created_at,
          ) || left.id.localeCompare(right.id)
        );
      })
      .map(getImageUrl)
      .filter(
        (url): url is string => Boolean(url),
      );
    let existing =
      imagesByCategory.get(product.category_id) ??
      [];

    for (const image of urls) {
      if (
        existing.includes(image) ||
        existing.length >= 8
      ) {
        continue;
      }

      existing = [...existing, image];
    }

    imagesByCategory.set(
      product.category_id,
      existing,
    );
  });

  return categoryRows.map((category) => ({
    ...mapCatalogCategory(category),
    images: imagesByCategory.get(category.id) ?? [],
  }));
}
