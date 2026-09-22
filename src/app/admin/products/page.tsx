import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";

import styles from "@/components/admin/admin-products.module.css";
import { ProductRemovalAction } from "@/components/admin/product-removal-action";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "إدارة المنتجات",

  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

type ProductRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  brand_id: string | null;
  category_id: string | null;
  status: string;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

type VariantRow = {
  product_id: string;
  price: number;
  stock_quantity: number;
  active: boolean;
};

type ImageRow = {
  product_id: string;
  storage_path: string | null;
  external_url: string | null;
  is_primary: boolean;
  sort_order: number;
};

type BrandRow = {
  id: string;
  name_ar: string;
  name_en: string | null;
};

type CategoryRow = {
  id: string;
  name_ar: string;
  name_en: string | null;
};

function formatPrice(
  value: number,
) {
  return new Intl.NumberFormat(
    "ar-LY",
    {
      style: "currency",
      currency: "LYD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    },
  ).format(value);
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "ar-LY",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  ).format(
    new Date(value),
  );
}

function getImageUrl(
  image: ImageRow | undefined,
) {
  if (!image) {
    return null;
  }

  if (image.external_url) {
    return image.external_url;
  }

  if (!image.storage_path) {
    return null;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return null;
  }

  const encodedPath =
    image.storage_path
      .split("/")
      .map((part) =>
        encodeURIComponent(part),
      )
      .join("/");

  return `${supabaseUrl}/storage/v1/object/public/product-images/${encodedPath}`;
}

function statusLabel(
  status: string,
) {
  if (status === "active") {
    return "نشط";
  }

  if (status === "draft") {
    return "مسودة";
  }

  if (status === "archived") {
    return "غير متاح";
  }

  return status;
}

function statusClass(
  status: string,
) {
  if (status === "active") {
    return styles.statusActive;
  }

  if (status === "draft") {
    return styles.statusDraft;
  }

  return styles.statusArchived;
}

export default async function Page({
  searchParams,
}: PageProps) {
  const {
    supabase,
  } =
    await requireAdmin("/admin/products");

  const params =
    await searchParams;

  const search =
    (params.q ?? "").trim();

  const requestedStatus =
    params.status ?? "all";

  const allowedStatuses = [
    "all",
    "active",
    "draft",
  ];

  const status =
    allowedStatuses.includes(
      requestedStatus,
    )
      ? requestedStatus
      : "all";

  let productsQuery =
    supabase
      .from("products")
      .select(
        "id, slug, name_ar, name_en, brand_id, category_id, status, featured, created_at, updated_at",
      )
      .order(
        "updated_at",
        {
          ascending: false,
        },
      )
      .limit(100);

  if (status !== "all") {
    productsQuery =
      productsQuery.eq(
        "status",
        status,
      );
  }

  const [
    productsResult,
    brandsResult,
    categoriesResult,
    totalResult,
    activeResult,
    draftResult,
  ] =
    await Promise.all([
      productsQuery,

      supabase
        .from("brands")
        .select(
          "id, name_ar, name_en",
        )
        .order(
          "sort_order",
          {
            ascending: true,
          },
        ),

      supabase
        .from("categories")
        .select(
          "id, name_ar, name_en",
        )
        .order(
          "sort_order",
          {
            ascending: true,
          },
        ),

      supabase
        .from("products")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        ),

      supabase
        .from("products")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "status",
          "active",
        ),

      supabase
        .from("products")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        )
        .eq(
          "status",
          "draft",
        ),

    ]);

  if (productsResult.error) {
    throw new Error(
      productsResult.error.message,
    );
  }

  const brands =
    (brandsResult.data ??
      []) as BrandRow[];

  const categories =
    (categoriesResult.data ??
      []) as CategoryRow[];

  const brandMap =
    new Map(
      brands.map((brand) => [
        brand.id,
        brand.name_ar ||
          brand.name_en ||
          "—",
      ]),
    );

  const categoryMap =
    new Map(
      categories.map(
        (category) => [
          category.id,
          category.name_ar ||
            category.name_en ||
            "—",
        ],
      ),
    );

  const rawProducts =
    (productsResult.data ??
      []) as ProductRow[];

  const normalizedSearch =
    search.toLocaleLowerCase();

  const products =
    normalizedSearch
      ? rawProducts.filter(
          (product) => {
            const haystack = [
              product.name_ar,
              product.name_en ?? "",
              product.slug,
              product.brand_id
                ? brandMap.get(
                    product.brand_id,
                  ) ?? ""
                : "",
              product.category_id
                ? categoryMap.get(
                    product.category_id,
                  ) ?? ""
                : "",
            ]
              .join(" ")
              .toLocaleLowerCase();

            return haystack.includes(
              normalizedSearch,
            );
          },
        )
      : rawProducts;

  const productIds =
    products.map(
      (product) =>
        product.id,
    );

  let variants: VariantRow[] =
    [];

  let images: ImageRow[] =
    [];

  if (
    productIds.length > 0
  ) {
    const [
      variantsResult,
      imagesResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "product_variants",
          )
          .select(
            "product_id, price, stock_quantity, active",
          )
          .in(
            "product_id",
            productIds,
          )
          .order(
            "sort_order",
            {
              ascending: true,
            },
          ),

        supabase
          .from(
            "product_images",
          )
          .select(
            "product_id, storage_path, external_url, is_primary, sort_order",
          )
          .in(
            "product_id",
            productIds,
          )
          .order(
            "is_primary",
            {
              ascending: false,
            },
          )
          .order(
            "sort_order",
            {
              ascending: true,
            },
          ),
      ]);

    if (
      variantsResult.error
    ) {
      throw new Error(
        variantsResult.error.message,
      );
    }

    if (
      imagesResult.error
    ) {
      throw new Error(
        imagesResult.error.message,
      );
    }

    variants =
      (variantsResult.data ??
        []) as VariantRow[];

    images =
      (imagesResult.data ??
        []) as ImageRow[];
  }

  const variantsByProduct =
    new Map<
      string,
      VariantRow[]
    >();

  for (
    const variant of variants
  ) {
    const current =
      variantsByProduct.get(
        variant.product_id,
      ) ?? [];

    current.push(variant);

    variantsByProduct.set(
      variant.product_id,
      current,
    );
  }

  const imageByProduct =
    new Map<
      string,
      ImageRow
    >();

  for (
    const image of images
  ) {
    if (
      !imageByProduct.has(
        image.product_id,
      )
    ) {
      imageByProduct.set(
        image.product_id,
        image,
      );
    }
  }

  function makeFilterHref(
    nextStatus: string,
  ) {
    const query =
      new URLSearchParams();

    if (search) {
      query.set(
        "q",
        search,
      );
    }

    if (
      nextStatus !==
      "all"
    ) {
      query.set(
        "status",
        nextStatus,
      );
    }

    const value =
      query.toString();

    return value
      ? `/admin/products?${value}`
      : "/admin/products";
  }

  const filters = [
    {
      id: "all",
      label: "الكل",
    },
    {
      id: "active",
      label: "النشطة",
    },
    {
      id: "draft",
      label: "المسودات",
    },
  ];

  return (
    <main
      className={
        styles.page
      }
    >
      <section
        className={
          styles.heading
        }
      >
        <div
          className={
            styles.headingCopy
          }
        >
          <span
            className={
              styles.eyebrow
            }
          >
            CATALOG
          </span>

          <h1>
            إدارة المنتجات
          </h1>

          <p>
            المنتجات والأسعار
            والخيارات والمخزون
            في مكان واحد.
          </p>
        </div>

      </section>

      <section className={styles.createActionsSection}>
        <div className={styles.createActions}>
          <Link href="/admin/products/new?type=supplement" className={styles.addButton}>
            + إضافة مكمل
          </Link>
          <Link href="/admin/products/new?type=apparel" className={styles.addButton}>
            + إضافة ملابس
          </Link>
          <Link href="/admin/products/new?type=accessory" className={styles.addButton}>
            + إضافة إكسسوار
          </Link>
        </div>
      </section>

      <section
        className={
          styles.stats
        }
      >
        <article
          className={
            styles.stat
          }
        >
          <span>
            إجمالي المنتجات
          </span>

          <strong>
            {totalResult.count ??
              0}
          </strong>
        </article>

        <article
          className={
            styles.stat
          }
        >
          <span>
            المنتجات النشطة
          </span>

          <strong>
            {activeResult.count ??
              0}
          </strong>
        </article>

        <article
          className={
            styles.stat
          }
        >
          <span>
            المسودات
          </span>

          <strong>
            {draftResult.count ??
              0}
          </strong>
        </article>

      </section>

      <section
        className={
          styles.toolbar
        }
      >
        <form
          method="get"
          className={
            styles.searchForm
          }
        >
          {status !== "all" && (
            <input
              type="hidden"
              name="status"
              value={status}
            />
          )}

          <input
            className={
              styles.searchInput
            }
            type="search"
            name="q"
            defaultValue={
              search
            }
            placeholder="ابحث باسم المنتج، العلامة، التصنيف أو الرابط المختصر (Slug)..."
          />

          <button
            type="submit"
            className={
              styles.searchButton
            }
          >
            بحث
          </button>
        </form>

        <div
          className={
            styles.filters
          }
        >
          {filters.map(
            (filter) => (
              <Link
                key={
                  filter.id
                }
                href={makeFilterHref(
                  filter.id,
                )}
                className={`${styles.filter} ${
                  status ===
                  filter.id
                    ? styles.filterActive
                    : ""
                }`}
              >
                {
                  filter.label
                }
              </Link>
            ),
          )}
        </div>
      </section>

      <section
        className={
          styles.tableCard
        }
      >
        {products.length ===
        0 ? (
          <div
            className={
              styles.empty
            }
          >
            <span
              className={
                styles.emptyIcon
              }
            >
              ▦
            </span>

            <strong>
              لا توجد منتجات
            </strong>

            <p>
              جرّب تغيير البحث
              أو الفلتر الحالي.
            </p>
          </div>
        ) : (
          <div
            className={
              styles.tableWrap
            }
          >
            <table
              className={
                styles.table
              }
            >
              <thead>
                <tr>
                  <th>
                    المنتج
                  </th>

                  <th>
                    العلامة
                  </th>

                  <th>
                    التصنيف
                  </th>

                  <th>
                    السعر
                  </th>

                  <th>
                    المخزون
                  </th>

                  <th>
                    الخيارات / النسخ
                  </th>

                  <th>
                    الحالة
                  </th>

                  <th>
                    مميز
                  </th>

                  <th>
                    آخر تحديث
                  </th>

                  <th>
                    الإجراء
                  </th>
                </tr>
              </thead>

              <tbody>
                {products.map(
                  (product) => {
                    const productVariants =
                      variantsByProduct.get(
                        product.id,
                      ) ?? [];

                    const activeVariants =
                      productVariants.filter(
                        (variant) =>
                          variant.active,
                      );

                    const totalStock =
                      productVariants.reduce(
                        (
                          total,
                          variant,
                        ) =>
                          total +
                          variant.stock_quantity,
                        0,
                      );

                    const prices =
                      activeVariants
                        .map(
                          (
                            variant,
                          ) =>
                            variant.price,
                        )
                        .filter(
                          (
                            price,
                          ) =>
                            Number.isFinite(
                              price,
                            ),
                        );

                    const minPrice =
                      prices.length >
                      0
                        ? Math.min(
                            ...prices,
                          )
                        : null;

                    const maxPrice =
                      prices.length >
                      0
                        ? Math.max(
                            ...prices,
                          )
                        : null;

                    const imageUrl =
                      getImageUrl(
                        imageByProduct.get(
                          product.id,
                        ),
                      );

                    let stockClass =
                      styles.stockGood;

                    if (
                      totalStock ===
                      0
                    ) {
                      stockClass =
                        styles.stockEmpty;
                    } else if (
                      totalStock <=
                      5
                    ) {
                      stockClass =
                        styles.stockLow;
                    }

                    return (
                      <tr
                        key={
                          product.id
                        }
                      >
                        <td
                          className={
                            styles.productCell
                          }
                        >
                          <div
                            className={
                              styles.productInfo
                            }
                          >
                            {imageUrl ? (
                              <Image
                                src={
                                  imageUrl
                                }
                                alt={
                                  product.name_ar
                                }
                                width={
                                  58
                                }
                                height={
                                  58
                                }
                                className={
                                  styles.thumbnail
                                }
                                sizes="58px"
                              />
                            ) : (
                              <div
                                className={
                                  styles.thumbnailPlaceholder
                                }
                              >
                                ▦
                              </div>
                            )}

                            <div
                              className={
                                styles.productText
                              }
                            >
                              <strong>
                                {
                                  product.name_ar
                                }
                              </strong>

                              <span>
                                {
                                  product.slug
                                }
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {product.brand_id
                            ? brandMap.get(
                                product.brand_id,
                              ) ??
                              "—"
                            : "—"}
                        </td>

                        <td>
                          {product.category_id
                            ? categoryMap.get(
                                product.category_id,
                              ) ??
                              "—"
                            : "—"}
                        </td>

                        <td>
                          {minPrice ===
                          null ? (
                            <span
                              className={
                                styles.muted
                              }
                            >
                              —
                            </span>
                          ) : minPrice ===
                            maxPrice ? (
                            formatPrice(
                              minPrice,
                            )
                          ) : (
                            <>
                              {formatPrice(
                                minPrice,
                              )}
                              {" – "}
                              {formatPrice(
                                maxPrice ??
                                  minPrice,
                              )}
                            </>
                          )}
                        </td>

                        <td>
                          <span
                            className={`${styles.stock} ${stockClass}`}
                          >
                            {
                              totalStock
                            }
                          </span>
                        </td>

                        <td>
                          {
                            productVariants.length
                          }
                          {" / "}
                          {
                            activeVariants.length
                          }{" "}
                          نشط
                        </td>

                        <td>
                          <span
                            className={`${styles.status} ${statusClass(
                              product.status,
                            )}`}
                          >
                            {statusLabel(
                              product.status,
                            )}
                          </span>
                        </td>

                        <td>
                          {product.featured ? (
                            <span
                              className={
                                styles.featured
                              }
                            >
                              نعم
                            </span>
                          ) : (
                            <span
                              className={
                                styles.muted
                              }
                            >
                              لا
                            </span>
                          )}
                        </td>

                        <td>
                          {formatDate(
                            product.updated_at,
                          )}
                        </td>

                        <td>
                          <div
                            className={
                              styles.actions
                            }
                          >
                            {product.status !== "archived" && (
                              <Link
                                href={`/admin/products/${product.id}/edit`}
                                className={
                                  styles.actionLink
                                }
                              >
                                تعديل
                              </Link>
                            )}

                            {product.status ===
                              "active" && (
                              <Link
                                href={`/products/${product.slug}`}
                                className={
                                  styles.actionLink
                                }
                              >
                                عرض
                              </Link>
                            )}

                            <ProductRemovalAction
                              productId={product.id}
                              productName={product.name_ar}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}

        <div
          className={
            styles.footer
          }
        >
          يتم عرض أول 100 منتج
          حسب آخر تحديث. سنضيف
          ترقيم الصفحات قبل
          الإطلاق النهائي.
        </div>
      </section>
    </main>
  );
}


