import { supabase } from "@/lib/supabase/client";

import type { Brand } from "@/types/brand";
import type { CatalogCategory } from "@/types/category";
import type {
  CatalogProduct,
  Product,
  ProductCategory,
  ProductVariant,
  SearchProduct,
  TrainingGoal,
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
};

type CatalogCategoryRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  image_path: string | null;
  active: boolean;
  sort_order: number;
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
  slug: string | undefined,
): ProductCategory {
  switch (slug) {
    case "protein":
      return "بروتين";

    case "pre-workout":
      return "قبل التمرين";

    case "creatine":
      return "كرياتين";

    case "amino-acids":
    case "bcaa":
      return "أحماض أمينية";

    case "fitness-accessories":
    case "accessories":
      return "إكسسوارات اللياقة";

    default:
      return "بروتين";
  }
}

function mapTrainingGoal(
  goal: string | null,
): TrainingGoal {
  switch (goal) {
    case "muscle-support":
    case "muscle-building":
      return "بناء العضلات";

    case "energy-endurance":
    case "energy":
      return "الطاقة والتحمل";

    case "weight-management":
      return "إدارة الوزن";

    case "recovery":
      return "الاستشفاء";

    default:
      return "بناء العضلات";
  }
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

function getImageUrl(
  image: ImageRow,
): string | null {
  if (image.external_url) {
    return image.external_url;
  }

  return getStorageUrl(
    image.storage_path,
  );
}

function getCategoryFallbackImage(
  slug: string,
): string {
  switch (slug) {
    case "protein":
      return "/images/cat-protein.jpg";

    case "pre-workout":
      return "/images/cat-preworkout.jpg";

    case "creatine":
      return "/images/product-creatine.jpg";

    case "amino-acids":
    case "bcaa":
      return "/images/product-bcaa.jpg";

    case "fitness-accessories":
    case "accessories":
      return "/images/cat-accessories.jpg";

    default:
      return "/images/cat-protein.jpg";
  }
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

    category:
      mapCategory(
        row.category?.slug,
      ),

    goal:
      mapTrainingGoal(
        row.training_goal,
      ),

    rating:
      0,

    reviewCount:
      0,

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
    rating: 0,
    images: product.images.slice(0, 1),
    badge: product.badge,
    inStock: product.inStock,
    type: product.type,
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
    id: row.id,
    variant_id: null,
    storage_path: row.image_storage_path,
    external_url: row.image_external_url,
    alt_text_ar: null,
    alt_text_en: null,
    sort_order: 0,
    is_primary: true,
  });

  return {
    id: row.id,
    slug: row.slug,
    brand: row.brand_name_ar,
    name: row.name_ar,
    shortName: row.name_ar,
    category: mapCategory(row.category_slug),
    rating: 0,
    images: image ? [image] : [],
    badge: row.badge_label_ar ?? undefined,
    inStock: row.in_stock,
    type: mapProductType(row.product_type),
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
  search,
  page,
  pageSize,
}: CatalogPageQuery & { search?: string }) {
  const { data, error } = await supabase.rpc(
    "list_storefront_products",
    {
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
    },
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
  let query = supabase
    .from("products")
    .select(catalogCardSelect)
    .eq("status", "active")
    .order("featured", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

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
    .filter((product) => product.variants.length > 0);
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
          brand.name_en ??
          brand.name_ar,
      };
    },
  );
}

export async function getCategories(): Promise<
  CatalogCategory[]
> {
  const { data, error } =
    await supabase
      .from("categories")
      .select(`
        id,
        slug,
        name_ar,
        name_en,
        description_ar,
        image_path,
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

  return (data ?? []).map(
    (row) => {
      const category =
        row as CatalogCategoryRow;

      return {
        slug:
          category.slug,

        name:
          category.name_ar.trim() ||
          category.name_en?.trim() ||
          category.slug,

        description:
          category.description_ar ??
          "تصفح منتجات هذه الفئة",

        image:
          getStorageUrl(
            category.image_path,
          ) ??
          getCategoryFallbackImage(
            category.slug,
          ),

        href:
          `/shop?category=${encodeURIComponent(
            category.slug,
          )}`,
      };
    },
  );
}
