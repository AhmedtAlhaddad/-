import type {
  Metadata,
} from "next";

import Link from "next/link";

import {
  InventoryAdjuster,
} from "@/components/admin/inventory-adjuster";

import styles from "@/components/admin/admin-inventory.module.css";

import {
  requireAdmin,
} from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "إدارة المخزون",

  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic =
  "force-dynamic";

const LOW_STOCK_THRESHOLD =
  5;

type PageProps = {
  searchParams: Promise<{
    q?:
      | string
      | string[];

    stock?:
      | string
      | string[];
  }>;
};

type ProductRow = {
  id: string;
  slug: string;
  name_ar: string;
  status: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  flavor_ar:
    | string
    | null;
  weight_value:
    | number
    | null;
  weight_unit:
    | string
    | null;
  size_label_ar:
    | string
    | null;
  servings:
    | number
    | null;
  price: number;
  stock_quantity: number;
  active: boolean;
  sort_order: number;

  product:
    | ProductRow
    | ProductRow[]
    | null;
};

type MovementRow = {
  id: number;
  variant_id: string;
  quantity_change: number;
  stock_after: number;
  reason: string;
  note:
    | string
    | null;
  actor_user_id:
    | string
    | null;
  created_at: string;
};

function firstParam(
  value:
    | string
    | string[]
    | undefined,
) {
  if (
    Array.isArray(value)
  ) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function productOf(
  variant: VariantRow,
) {
  if (
    Array.isArray(
      variant.product,
    )
  ) {
    return (
      variant.product[0] ??
      null
    );
  }

  return variant.product;
}

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

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "ar-LY",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(value),
  );
}

function formatWeight(
  variant: VariantRow,
) {
  if (
    variant.weight_value ===
      null ||
    !variant.weight_unit
  ) {
    return "";
  }

  return `${variant.weight_value} ${variant.weight_unit}`;
}

function variantLabel(
  variant: VariantRow,
) {
  const parts = [
    variant.flavor_ar,
    formatWeight(
      variant,
    ),
    variant.size_label_ar,

    variant.servings
      ? `${variant.servings} حصة`
      : "",
  ].filter(Boolean);

  return (
    parts.join(" / ") ||
    "الخيار الافتراضي"
  );
}

function stockClass(
  stock: number,
) {
  if (stock === 0) {
    return styles.stockEmpty;
  }

  if (
    stock <=
    LOW_STOCK_THRESHOLD
  ) {
    return styles.stockLow;
  }

  return styles.stockGood;
}

function stockLabel(
  stock: number,
) {
  if (stock === 0) {
    return "نفد";
  }

  if (
    stock <=
    LOW_STOCK_THRESHOLD
  ) {
    return "منخفض";
  }

  return "متوفر";
}

function reasonLabel(
  reason: string,
) {
  if (
    reason === "restock"
  ) {
    return "توريد";
  }

  if (
    reason ===
    "manual_adjustment"
  ) {
    return "تعديل يدوي";
  }

  if (
    reason ===
    "correction"
  ) {
    return "تصحيح";
  }

  if (
    reason === "sale"
  ) {
    return "طلب";
  }

  if (
    reason ===
    "order_cancelled_return"
  ) {
    return "إرجاع طلب";
  }

  return reason;
}

export default async function Page({
  searchParams,
}: PageProps) {
  const {
    supabase,
  } =
    await requireAdmin();

  const params =
    await searchParams;

  const search =
    firstParam(
      params.q,
    )
      .trim()
      .slice(0, 100);

  const requestedStock =
    firstParam(
      params.stock,
    );

  const allowedStockFilters =
    new Set([
      "all",
      "good",
      "low",
      "out",
    ]);

  const stockFilter =
    allowedStockFilters.has(
      requestedStock,
    )
      ? requestedStock
      : "all";

  const [
    variantsResult,
    movementsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "product_variants",
        )
        .select(
          "id, product_id, sku, flavor_ar, weight_value, weight_unit, size_label_ar, servings, price, stock_quantity, active, sort_order, product:products!inner(id, slug, name_ar, status)",
        )
        .order(
          "product_id",
          {
            ascending: true,
          },
        )
        .order(
          "sort_order",
          {
            ascending: true,
          },
        )
        .limit(1000),

      supabase
        .from(
          "inventory_movements",
        )
        .select(
          "id, variant_id, quantity_change, stock_after, reason, note, actor_user_id, created_at",
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(12),
    ]);

  if (
    variantsResult.error
  ) {
    throw new Error(
      variantsResult
        .error
        .message,
    );
  }

  if (
    movementsResult.error
  ) {
    throw new Error(
      movementsResult
        .error
        .message,
    );
  }

  const variants =
    (
      variantsResult.data ??
      []
    ) as unknown as
      VariantRow[];

  const movements =
    (
      movementsResult.data ??
      []
    ) as unknown as
      MovementRow[];

  const activeVariants =
    variants.filter(
      (variant) =>
        variant.active,
    );

  const totalUnits =
    activeVariants.reduce(
      (
        total,
        variant,
      ) =>
        total +
        variant.stock_quantity,
      0,
    );

  const lowStockCount =
    activeVariants.filter(
      (variant) =>
        variant.stock_quantity >
          0 &&
        variant.stock_quantity <=
          LOW_STOCK_THRESHOLD,
    ).length;

  const outOfStockCount =
    activeVariants.filter(
      (variant) =>
        variant.stock_quantity ===
        0,
    ).length;

  const normalizedSearch =
    search.toLocaleLowerCase();

  const visibleVariants =
    variants.filter(
      (variant) => {
        const product =
          productOf(
            variant,
          );

        if (
          normalizedSearch
        ) {
          const haystack = [
            product?.name_ar ??
              "",
            product?.slug ??
              "",
            variant.sku,
            variant.flavor_ar ??
              "",
            variant.size_label_ar ??
              "",
            formatWeight(
              variant,
            ),
          ]
            .join(" ")
            .toLocaleLowerCase();

          if (
            !haystack.includes(
              normalizedSearch,
            )
          ) {
            return false;
          }
        }

        if (
          stockFilter ===
          "out"
        ) {
          return (
            variant.active &&
            variant.stock_quantity ===
              0
          );
        }

        if (
          stockFilter ===
          "low"
        ) {
          return (
            variant.active &&
            variant.stock_quantity >
              0 &&
            variant.stock_quantity <=
              LOW_STOCK_THRESHOLD
          );
        }

        if (
          stockFilter ===
          "good"
        ) {
          return (
            variant.active &&
            variant.stock_quantity >
              LOW_STOCK_THRESHOLD
          );
        }

        return true;
      },
    );

  const variantMap =
    new Map(
      variants.map(
        (variant) => [
          variant.id,
          variant,
        ],
      ),
    );

  function makeFilterHref(
    nextStock: string,
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
      nextStock !== "all"
    ) {
      query.set(
        "stock",
        nextStock,
      );
    }

    const value =
      query.toString();

    return value
      ? `/admin/inventory?${value}`
      : "/admin/inventory";
  }

  const filters = [
    {
      id: "all",
      label: "الكل",
    },
    {
      id: "good",
      label: "متوفر",
    },
    {
      id: "low",
      label: `منخفض ≤ ${LOW_STOCK_THRESHOLD}`,
    },
    {
      id: "out",
      label: "نفد",
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
            INVENTORY
          </span>

          <h1>
            إدارة المخزون
          </h1>

          <p>
            متابعة أرصدة الخيارات / النسخ،
            تنبيهات النقص وسجل
            حركات المخزون من مكان واحد.
          </p>
        </div>

        <div
          className={
            styles.headingActions
          }
        >
          <Link
            href="/admin/products"
            className={
              styles.secondaryLink
            }
          >
            إدارة المنتجات
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
            الخيارات / النسخ النشطة
          </span>

          <strong>
            {
              activeVariants.length
            }
          </strong>

          <small>
            خيارات قابلة للبيع
          </small>
        </article>

        <article
          className={
            styles.stat
          }
        >
          <span>
            إجمالي الوحدات
          </span>

          <strong>
            {totalUnits}
          </strong>

          <small>
            المخزون الحالي
          </small>
        </article>

        <article
          className={`${styles.stat} ${
            lowStockCount > 0
              ? styles.statWarning
              : ""
          }`}
        >
          <span>
            مخزون منخفض
          </span>

          <strong>
            {lowStockCount}
          </strong>

          <small>
            من 1 إلى
            {" "}
            {
              LOW_STOCK_THRESHOLD
            }
          </small>
        </article>

        <article
          className={`${styles.stat} ${
            outOfStockCount > 0
              ? styles.statDanger
              : ""
          }`}
        >
          <span>
            نفد المخزون
          </span>

          <strong>
            {
              outOfStockCount
            }
          </strong>

          <small>
            يحتاج متابعة
          </small>
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
          {stockFilter !==
            "all" && (
            <input
              type="hidden"
              name="stock"
              value={
                stockFilter
              }
            />
          )}

          <input
            type="search"
            name="q"
            defaultValue={
              search
            }
            className={
              styles.searchInput
            }
            placeholder="ابحث باسم المنتج، رمز المخزون (SKU)، النكهة، الوزن أو المقاس..."
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
                  stockFilter ===
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

      {(lowStockCount >
        0 ||
        outOfStockCount >
          0) && (
        <section
          className={
            styles.alert
          }
        >
          <div>
            <strong>
              تنبيه المخزون
            </strong>

            <span>
              يوجد
              {" "}
              {
                lowStockCount
              }
              {" "}
              خيار / نسخة (Variant) بمخزون منخفض و
              {" "}
              {
                outOfStockCount
              }
              {" "}
              نفد مخزونها.
            </span>
          </div>

          <Link
            href="/admin/inventory?stock=low"
          >
            عرض المنخفض
          </Link>
        </section>
      )}

      <section
        className={
          styles.tableCard
        }
      >
        <div
          className={
            styles.tableHeader
          }
        >
          <div>
            <strong>
              أرصدة المخزون
            </strong>

            <span>
              {
                visibleVariants.length
              }
              {" "}
              نتيجة
            </span>
          </div>
        </div>

        {visibleVariants.length ===
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
              ◫
            </span>

            <strong>
              لا توجد خيارات / نسخ
              مطابقة
            </strong>

            <p>
              جرّب تغيير البحث
              أو فلتر المخزون.
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
                    الخيار / النسخة (Variant)
                  </th>

                  <th>
                    رمز المخزون (SKU)
                  </th>

                  <th>
                    السعر
                  </th>

                  <th>
                    المخزون
                  </th>

                  <th>
                    الحالة
                  </th>

                  <th>
                    المنتج
                  </th>

                  <th>
                    تعديل سريع
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleVariants.map(
                  (variant) => {
                    const product =
                      productOf(
                        variant,
                      );

                    return (
                      <tr
                        key={
                          variant.id
                        }
                      >
                        <td
                          className={
                            styles.productCell
                          }
                        >
                          {product ? (
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className={
                                styles.productLink
                              }
                            >
                              {
                                product.name_ar
                              }
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          <div
                            className={
                              styles.variantInfo
                            }
                          >
                            <strong>
                              {
                                variantLabel(
                                  variant,
                                )
                              }
                            </strong>

                            <span>
                              {variant.active
                                ? "نشط"
                                : "غير نشط"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <code
                            className={
                              styles.sku
                            }
                          >
                            {
                              variant.sku
                            }
                          </code>
                        </td>

                        <td>
                          {
                            formatPrice(
                              variant.price,
                            )
                          }
                        </td>

                        <td>
                          <strong
                            className={`${styles.stock} ${stockClass(
                              variant.stock_quantity,
                            )}`}
                          >
                            {
                              variant.stock_quantity
                            }
                          </strong>
                        </td>

                        <td>
                          <span
                            className={`${styles.stockBadge} ${stockClass(
                              variant.stock_quantity,
                            )}`}
                          >
                            {
                              stockLabel(
                                variant.stock_quantity,
                              )
                            }
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              styles.productStatus
                            }
                          >
                            {
                              product?.status ??
                              "—"
                            }
                          </span>
                        </td>

                        <td>
                          <InventoryAdjuster
                            variantId={
                              variant.id
                            }
                            currentStock={
                              variant.stock_quantity
                            }
                          />
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
          يتم عرض حتى 1000 خيار / نسخة (Variant)
          في هذه النسخة من لوحة المخزون.
        </div>
      </section>

      <section
        className={
          styles.historySection
        }
      >
        <div
          className={
            styles.sectionTitle
          }
        >
          <div>
            <span
              className={
                styles.eyebrow
              }
            >
              AUDIT LOG
            </span>

            <h2>
              آخر حركات المخزون
            </h2>
          </div>

          <span>
            سجل تاريخي لا يتم
            تعديله أو حذفه
          </span>
        </div>

        <div
          className={
            styles.historyCard
          }
        >
          {movements.length ===
          0 ? (
            <div
              className={
                styles.empty
              }
            >
              <strong>
                لا توجد حركات مخزون
                حتى الآن.
              </strong>
            </div>
          ) : (
            <div
              className={
                styles.tableWrap
              }
            >
              <table
                className={`${styles.table} ${styles.historyTable}`}
              >
                <thead>
                  <tr>
                    <th>
                      المنتج
                    </th>

                    <th>
                      رمز المخزون (SKU)
                    </th>

                    <th>
                      التغيير
                    </th>

                    <th>
                      الرصيد بعد الحركة
                    </th>

                    <th>
                      السبب
                    </th>

                    <th>
                      الملاحظة
                    </th>

                    <th>
                      التاريخ
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map(
                    (movement) => {
                      const variant =
                        variantMap.get(
                          movement.variant_id,
                        );

                      const product =
                        variant
                          ? productOf(
                              variant,
                            )
                          : null;

                      return (
                        <tr
                          key={
                            movement.id
                          }
                        >
                          <td>
                            {
                              product?.name_ar ??
                              "—"
                            }
                          </td>

                          <td>
                            <code
                              className={
                                styles.sku
                              }
                            >
                              {
                                variant?.sku ??
                                movement.variant_id
                              }
                            </code>
                          </td>

                          <td>
                            <strong
                              className={
                                movement.quantity_change >
                                0
                                  ? styles.movementPositive
                                  : styles.movementNegative
                              }
                            >
                              {
                                movement.quantity_change >
                                0
                                  ? `+${movement.quantity_change}`
                                  : movement.quantity_change
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              movement.stock_after
                            }
                          </td>

                          <td>
                            {
                              reasonLabel(
                                movement.reason,
                              )
                            }
                          </td>

                          <td
                            className={
                              styles.note
                            }
                          >
                            {
                              movement.note ??
                              "—"
                            }
                          </td>

                          <td>
                            {
                              formatDateTime(
                                movement.created_at,
                              )
                            }
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
