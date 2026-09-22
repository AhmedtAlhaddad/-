"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import {
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import styles from "./admin-product-form.module.css";

type Option = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
};

type InitialVariant = {
  id?: string;
  sku: string;
  flavor_ar: string | null;
  flavor_en: string | null;
  weight_value: number | null;
  weight_unit: string | null;
  size_label_ar: string | null;
  size_label_en: string | null;
  servings: number | null;
  attributes: Record<string, unknown>;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  active: boolean;
};

type InitialProduct = {
  name_ar: string;
  name_en: string | null;
  slug: string;
  brand_id: string;
  category_id: string;
  short_description_ar: string;
  full_description_ar: string | null;
  nutrition_facts: string | null;
  usage_instructions: string | null;
  product_type: string;
  training_goals: string[];
  badge_label_ar: string | null;
  highlights: string[];
  status: string;
  featured: boolean;
  variants: InitialVariant[];
};

export type ProductKind = "supplement" | "apparel" | "accessory";

function productKindFromType(productType: string): ProductKind {
  if (productType === "apparel") {
    return "apparel";
  }

  if (productType === "fitness-accessory") {
    return "accessory";
  }

  return "supplement";
}

const TRAINING_GOALS = [
  {
    value: "muscle-building",
    label: "بناء عضلات",
  },
  {
    value: "energy-endurance",
    label: "زيادة الوزن وقدرة التحمل",
  },
  {
    value: "weight-management",
    label: "حرق الدهون وانقاص الوزن",
  },
] as const;

type VariantForm = {
  key: string;
  id?: string;
  sku: string;
  flavor_ar: string;
  flavor_en: string;
  color_ar: string;
  color_en: string;
  weight_value: string;
  weight_unit: string;
  size_label_ar: string;
  size_label_en: string;
  servings: string;
  price: string;
  compare_at_price: string;
  stock_quantity: string;
  active: boolean;
  attributes: Record<string, unknown>;
};

function createBlankVariant(
  key: string,
): VariantForm {
  return {
    key,
    sku: "",
    flavor_ar: "",
    flavor_en: "",
    color_ar: "",
    color_en: "",
    weight_value: "",
    weight_unit: "",
    size_label_ar: "",
    size_label_en: "",
    servings: "",
    price: "",
    compare_at_price: "",
    stock_quantity: "0",
    active: true,
    attributes: {},
  };
}

function initialVariant(
  variant: InitialVariant,
): VariantForm {
  const colorAr =
    typeof variant.attributes.color_ar === "string"
      ? variant.attributes.color_ar
      : "";

  const colorEn =
    typeof variant.attributes.color_en === "string"
      ? variant.attributes.color_en
      : "";

  return {
    key: variant.id ?? `existing-${variant.sku}`,
    id: variant.id,
    sku: variant.sku,
    flavor_ar: variant.flavor_ar ?? "",
    flavor_en: variant.flavor_en ?? "",
    color_ar: colorAr,
    color_en: colorEn,
    weight_value:
      variant.weight_value === null
        ? ""
        : String(variant.weight_value),
    weight_unit: variant.weight_unit ?? "",
    size_label_ar: variant.size_label_ar ?? "",
    size_label_en: variant.size_label_en ?? "",
    servings:
      variant.servings === null
        ? ""
        : String(variant.servings),
    price: String(variant.price),
    compare_at_price:
      variant.compare_at_price === null
        ? ""
        : String(variant.compare_at_price),
    stock_quantity: String(variant.stock_quantity),
    active: variant.active,
    attributes: variant.attributes,
  };
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductForm({
  mode,
  productId,
  initialData,
  createKind = "supplement",
  brands,
  categories,
  children,
}: {
  mode: "create" | "edit";
  productId?: string;
  initialData?: InitialProduct;
  createKind?: ProductKind;
  brands: Option[];
  categories: Option[];
  children?: ReactNode;
}) {
  const router = useRouter();
  const variantCounter = useRef(1000);
  const productKind = initialData
    ? productKindFromType(initialData.product_type)
    : createKind;
  const isSupplement = productKind === "supplement";

  const [slugTouched, setSlugTouched] =
    useState(mode === "edit");

  const [nameAr, setNameAr] =
    useState(initialData?.name_ar ?? "");

  const [nameEn, setNameEn] =
    useState(initialData?.name_en ?? "");

  const [slug, setSlug] =
    useState(initialData?.slug ?? "");

  const [brandId, setBrandId] =
    useState(
      initialData?.brand_id ??
        brands[0]?.id ??
        "",
    );

  const [categoryId, setCategoryId] =
    useState(
      initialData?.category_id ??
        categories[0]?.id ??
        "",
    );

  const [shortDescription, setShortDescription] =
    useState(
      initialData?.short_description_ar ?? "",
    );

  const [fullDescription, setFullDescription] =
    useState(
      initialData?.full_description_ar ?? "",
    );

  const [nutritionFacts, setNutritionFacts] =
    useState(
      initialData?.nutrition_facts ?? "",
    );

  const [usageInstructions, setUsageInstructions] =
    useState(
      initialData?.usage_instructions ?? "",
    );

  const [productType, setProductType] =
    useState(
      initialData?.product_type ??
        (productKind === "apparel"
          ? "apparel"
          : productKind === "accessory"
            ? "fitness-accessory"
            : "supplement"),
    );

  const [trainingGoals, setTrainingGoals] =
    useState(
      initialData?.training_goals ?? [],
    );

  const [badge, setBadge] =
    useState(
      initialData?.badge_label_ar ?? "",
    );

  const [highlights, setHighlights] =
    useState(
      initialData?.highlights.join("\n") ?? "",
    );

  const [status, setStatus] =
    useState(
      initialData?.status ?? "draft",
    );

  const [featured, setFeatured] =
    useState(
      initialData?.featured ?? false,
    );

  const [variants, setVariants] =
    useState<VariantForm[]>(
      initialData?.variants.length
        ? initialData.variants.map(initialVariant)
        : [createBlankVariant("variant-1")],
    );

  const [accessoryUsesSize, setAccessoryUsesSize] = useState(
    productKind === "accessory" &&
      Boolean(
        initialData?.variants.some(
          (variant) => variant.size_label_ar || variant.size_label_en,
        ),
      ),
  );

  const [error, setError] =
    useState<string | null>(null);

  const [submitting, setSubmitting] =
    useState(false);

  function updateVariant(
    key: string,
    field: keyof VariantForm,
    value: string | boolean,
  ) {
    setVariants((current) =>
      current.map((variant) =>
        variant.key === key
          ? {
              ...variant,
              [field]: value,
            }
          : variant,
      ),
    );
  }

  function addVariant() {
    const key =
      `new-${variantCounter.current}`;

    variantCounter.current += 1;

    setVariants((current) => [
      ...current,
      createBlankVariant(key),
    ]);
  }

  function removeNewVariant(
    key: string,
  ) {
    setVariants((current) =>
      current.length <= 1
        ? current
        : current.filter(
            (variant) =>
              variant.key !== key,
          ),
    );
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    try {
      const url =
        mode === "create"
          ? "/api/admin/products"
          : `/api/admin/products/${productId}`;

      const response =
        await fetch(url, {
          method:
            mode === "create"
              ? "POST"
              : "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name_ar: nameAr,
            name_en: nameEn,
            slug,
            brand_id: brandId,
            category_id: categoryId,

            short_description_ar:
              shortDescription,

            full_description_ar:
              fullDescription,

            nutrition_facts:
              isSupplement ? nutritionFacts : "",

            usage_instructions:
              isSupplement ? usageInstructions : "",

            product_type:
              productType,

            training_goals:
              isSupplement ? trainingGoals : [],

            badge_label_ar:
              badge,

            highlights:
              highlights
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),

            status,
            featured,

            variants:
              variants.map(
                (variant) => ({
                  id: variant.id,
                  sku: variant.sku,

                  flavor_ar:
                    variant.flavor_ar,

                  flavor_en:
                    variant.flavor_en,

                  color_ar:
                    variant.color_ar,

                  color_en:
                    variant.color_en,

                  weight_value:
                    variant.weight_value,

                  weight_unit:
                    variant.weight_unit,

                  size_label_ar:
                    productKind === "accessory" && !accessoryUsesSize
                      ? ""
                      : variant.size_label_ar,

                  size_label_en:
                    productKind === "accessory" && !accessoryUsesSize
                      ? ""
                      : variant.size_label_en,

                  servings:
                    variant.servings,

                  price:
                    variant.price,

                  compare_at_price:
                    variant.compare_at_price,

                  stock_quantity:
                    variant.stock_quantity,

                  active:
                    variant.active,

                  attributes:
                    variant.attributes,
                }),
              ),
          }),
        });

      const result =
        await response.json();

      if (!response.ok) {
        setError(
          typeof result.error === "string"
            ? result.error
            : "تعذر حفظ المنتج.",
        );

        return;
      }

      if (
        mode === "create" &&
        result.product?.id
      ) {
        router.push(
          `/admin/products/${result.product.id}/edit`,
        );
      } else {
        router.push(
          "/admin/products",
        );
      }

      router.refresh();
    } catch {
      setError(
        "حدث خطأ أثناء الاتصال بالخادم.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.top}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>
            {mode === "create"
              ? "NEW PRODUCT"
              : "EDIT PRODUCT"}
          </span>

          <h1>
            {mode === "create"
              ? productKind === "supplement"
                ? "إضافة مكمل جديد"
                : productKind === "apparel"
                  ? "إضافة ملابس جديدة"
                  : "إضافة إكسسوار جديد"
              : "تعديل المنتج"}
          </h1>

          <p>
            عدّل بيانات المنتج والأسعار والمخزون والحالة وخيارات المنتج.
          </p>
        </div>

        <Link
          href="/admin/products"
          className={styles.back}
        >
          → الرجوع للمنتجات
        </Link>
      </section>

      <form
        onSubmit={submit}
        className={styles.form}
      >
        <section className={styles.card}>
          <div className={styles.cardTitle}>
            <h2>المعلومات الأساسية</h2>
            <p>
              بيانات المنتج التي تظهر في المتجر.
            </p>
          </div>

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span className={styles.label}>
                اسم المنتج بالعربي *
              </span>

              <input
                className={styles.input}
                value={nameAr}
                onChange={(event) =>
                  setNameAr(event.target.value)
                }
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>
                الاسم بالإنجليزي
              </span>

              <input
                className={styles.input}
                value={nameEn}
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setNameEn(value);

                  if (!slugTouched) {
                    setSlug(
                      slugify(value),
                    );
                  }
                }}
              />
            </label>

            <label
              className={`${styles.field} ${styles.fieldFull}`}
            >
              <span className={styles.label}>
                الرابط المختصر (Slug) *
              </span>

              <input
                className={styles.input}
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);

                  setSlug(
                    slugify(
                      event.target.value,
                    ),
                  );
                }}
                dir="ltr"
                required
              />
            </label>
          </div>

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span className={styles.label}>
                العلامة التجارية *
              </span>

              <select
                className={styles.select}
                value={brandId}
                onChange={(event) =>
                  setBrandId(
                    event.target.value,
                  )
                }
                required
              >
                {brands.map((brand) => (
                  <option
                    key={brand.id}
                    value={brand.id}
                  >
                    {brand.name_ar}
                    {brand.name_en
                      ? ` — ${brand.name_en}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>
                التصنيف *
              </span>

              <select
                className={styles.select}
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(
                    event.target.value,
                  )
                }
                required
              >
                {categories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name_ar}
                      {category.name_en
                        ? ` — ${category.name_en}`
                        : ""}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>
              الوصف المختصر *
            </span>

            <textarea
              className={styles.textarea}
              value={shortDescription}
              onChange={(event) =>
                setShortDescription(
                  event.target.value,
                )
              }
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              الوصف الكامل
            </span>

            <textarea
              className={styles.textarea}
              value={fullDescription}
              onChange={(event) =>
                setFullDescription(
                  event.target.value,
                )
              }
            />
          </label>

          {isSupplement && <div className={styles.grid2}>
            <label className={styles.field}>
              <span className={styles.label}>
                الحقائق الغذائية
              </span>

              <textarea
                className={styles.textarea}
                value={nutritionFacts}
                onChange={(event) =>
                  setNutritionFacts(
                    event.target.value,
                  )
                }
                maxLength={10000}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>
                تعليمات الاستخدام
              </span>

              <textarea
                className={styles.textarea}
                value={usageInstructions}
                onChange={(event) =>
                  setUsageInstructions(
                    event.target.value,
                  )
                }
                maxLength={10000}
              />

              <span className={styles.hint}>
                اكتب تعليمات الملصق فقط، واترك الحقل فارغًا إذا لم تتوفر.
              </span>
            </label>
          </div>}
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>
            <h2>إعدادات المنتج</h2>
            <p>
              النوع والحالة وظهور المنتج في المتجر.
            </p>
          </div>

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span className={styles.label}>
                نوع المنتج *
              </span>

              {isSupplement ? (
                <select
                  className={styles.select}
                  value={productType}
                  onChange={(event) => setProductType(event.target.value)}
                  required
                >
                  <option value="supplement">مكمل غذائي عام</option>
                  <option value="whey-protein">واي بروتين</option>
                  <option value="creatine">كرياتين</option>
                  <option value="pre-workout">ما قبل التمرين</option>
                  <option value="bcaa">أحماض أمينية BCAA</option>
                </select>
              ) : (
                <input
                  className={styles.input}
                  value={productKind === "apparel" ? "ملابس رياضية" : "إكسسوار رياضي"}
                  readOnly
                />
              )}
            </label>

            <label className={styles.field}>
              <span className={styles.label}>
                الحالة
              </span>

              <select
                className={styles.select}
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value,
                  )
                }
              >
                <option value="draft">
                  مسودة
                </option>

                <option value="active">
                  نشط
                </option>

                <option value="archived">
                  مؤرشف
                </option>
              </select>
            </label>
          </div>

          {isSupplement && <fieldset className={styles.goalFieldset}>
            <legend className={styles.label}>
              أهداف التدريب
            </legend>

            <div className={styles.goalOptions}>
              {TRAINING_GOALS.map((goal) => (
                <label
                  key={goal.value}
                  className={styles.goalOption}
                >
                  <input
                    type="checkbox"
                    checked={trainingGoals.includes(
                      goal.value,
                    )}
                    onChange={(event) =>
                      setTrainingGoals((current) =>
                        event.target.checked
                          ? [
                              ...current,
                              goal.value,
                            ]
                          : current.filter(
                              (value) =>
                                value !== goal.value,
                            ),
                      )
                    }
                  />
                  <span>{goal.label}</span>
                </label>
              ))}
            </div>

            <span className={styles.hint}>
              يمكن ربط المنتج بأكثر من هدف، أو تركها كلها غير محددة.
            </span>
          </fieldset>}

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span className={styles.label}>
                شارة المنتج (Badge)
              </span>

              <input
                className={styles.input}
                value={badge}
                onChange={(event) =>
                  setBadge(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={featured}
                onChange={(event) =>
                  setFeatured(
                    event.target.checked,
                  )
                }
              />

              منتج مميز (Featured)
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>
              أبرز المميزات (Highlights)
            </span>

            <textarea
              className={styles.textarea}
              value={highlights}
              onChange={(event) =>
                setHighlights(
                  event.target.value,
                )
              }
            />

            <span className={styles.hint}>
              كل ميزة في سطر منفصل.
            </span>
          </label>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <h2>الخيارات / النسخ (Variants)</h2>

              <p>
                السعر والمخزون ورمز المخزون (SKU) لكل خيار.
                الخيار القديم (Variant) لا نحذفه؛ يمكن
                تعطيله للحفاظ على التاريخ.
              </p>
            </div>

            <button
              type="button"
              className={styles.addVariant}
              onClick={addVariant}
            >
              + إضافة خيار / نسخة
            </button>
          </div>

          {productKind === "accessory" && (
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={accessoryUsesSize}
                onChange={(event) => setAccessoryUsesSize(event.target.checked)}
              />
              هذا الإكسسوار يحتاج إلى مقاس
            </label>
          )}

          {productKind === "apparel" && (
            <span className={styles.hint}>
              أضف خيارًا مستقلًا لكل تركيبة لون ومقاس، مثل: أسود + M، وأسود + L.
            </span>
          )}

          <div className={styles.variants}>
            {variants.map(
              (variant, index) => (
                <article
                  key={variant.key}
                  className={styles.variant}
                >
                  <div
                    className={styles.variantHeader}
                  >
                    <strong>
                      الخيار / النسخة (Variant) {index + 1}
                    </strong>

                    {!variant.id &&
                      variants.length > 1 && (
                        <button
                          type="button"
                          className={
                            styles.removeButton
                          }
                          onClick={() =>
                            removeNewVariant(
                              variant.key,
                            )
                          }
                        >
                          حذف الجديد
                        </button>
                      )}
                  </div>

                  <div className={styles.grid3}>
                    <label className={styles.field}>
                      <span className={styles.label}>
                        رمز المخزون (SKU) *
                      </span>

                      <input
                        className={styles.input}
                        value={variant.sku}
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "sku",
                            event.target.value.toUpperCase(),
                          )
                        }
                        dir="ltr"
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>
                        السعر *
                      </span>

                      <input
                        className={styles.input}
                        type="number"
                        min="0"
                        step="0.001"
                        value={variant.price}
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "price",
                            event.target.value,
                          )
                        }
                        dir="ltr"
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>
                        السعر السابق
                      </span>

                      <input
                        className={styles.input}
                        type="number"
                        min="0"
                        step="0.001"
                        value={
                          variant.compare_at_price
                        }
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "compare_at_price",
                            event.target.value,
                          )
                        }
                        dir="ltr"
                      />
                    </label>
                  </div>

                  <div className={styles.grid3}>
                    {productKind !== "apparel" && <label className={styles.field}>
                      <span className={styles.label}>
                        {productKind === "accessory" ? "الخيار بالعربي" : "النكهة بالعربي"}
                      </span>

                      <input
                        className={styles.input}
                        value={variant.flavor_ar}
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "flavor_ar",
                            event.target.value,
                          )
                        }
                      />
                    </label>}

                    {productKind !== "apparel" && <label className={styles.field}>
                      <span className={styles.label}>
                        {productKind === "accessory" ? "الخيار بالإنجليزية (Option)" : "النكهة بالإنجليزية (Flavor)"}
                      </span>

                      <input
                        className={styles.input}
                        value={variant.flavor_en}
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "flavor_en",
                            event.target.value,
                          )
                        }
                      />
                    </label>}

                    <label className={styles.field}>
                      <span className={styles.label}>
                        المخزون *
                      </span>

                      <input
                        className={styles.input}
                        type="number"
                        min="0"
                        step="1"
                        value={
                          variant.stock_quantity
                        }
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "stock_quantity",
                            event.target.value,
                          )
                        }
                        dir="ltr"
                        required
                      />
                    </label>
                  </div>

                  <div className={styles.grid4}>
                    {isSupplement && <>
                    <label className={styles.field}>
                      <span className={styles.label}>
                        الوزن
                      </span>

                      <input
                        className={styles.input}
                        type="number"
                        min="0"
                        step="0.001"
                        value={variant.weight_value}
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "weight_value",
                            event.target.value,
                          )
                        }
                        dir="ltr"
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>
                        الوحدة
                      </span>

                      <select
                        className={styles.select}
                        value={variant.weight_unit}
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "weight_unit",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">—</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="l">l</option>
                        <option value="capsule">
                          capsule
                        </option>
                        <option value="tablet">
                          tablet
                        </option>
                        <option value="piece">
                          piece
                        </option>
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>
                        عدد الحصص
                      </span>

                      <input
                        className={styles.input}
                        type="number"
                        min="1"
                        step="1"
                        value={variant.servings}
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "servings",
                            event.target.value,
                          )
                        }
                        dir="ltr"
                      />
                    </label>
                    </>}

                    <label
                      className={styles.checkboxRow}
                    >
                      <input
                        type="checkbox"
                        checked={variant.active}
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "active",
                            event.target.checked,
                          )
                        }
                      />

                      الخيار / النسخة نشطة
                    </label>
                  </div>

                  <div className={styles.grid4}>
                    {(productKind !== "accessory" || accessoryUsesSize) && <>
                    <label className={styles.field}>
                      <span className={styles.label}>
                        المقاس بالعربي
                      </span>

                      <input
                        className={styles.input}
                        value={
                          variant.size_label_ar
                        }
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "size_label_ar",
                            event.target.value,
                          )
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>
                        المقاس بالإنجليزية (Size)
                      </span>

                      <input
                        className={styles.input}
                        value={
                          variant.size_label_en
                        }
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "size_label_en",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    </>}

                    <label className={styles.field}>
                      <span className={styles.label}>
                        اللون بالعربي
                      </span>

                      <input
                        className={styles.input}
                        value={variant.color_ar}
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "color_ar",
                            event.target.value,
                          )
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>
                        اللون بالإنجليزية (Color)
                      </span>

                      <input
                        className={styles.input}
                        value={variant.color_en}
                        onChange={(event) =>
                          updateVariant(
                            variant.key,
                            "color_en",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>

        {mode === "create" && (
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <h2>صور المنتج</h2>
              <p>
                بعد حفظ البيانات الأساسية بأمان سيفتح مدير الصور مباشرة لإضافة صور المنتج وربطها بالخيارات عند الحاجة.
              </p>
            </div>
          </section>
        )}

        {children}


        {error && (
          <div
            className={styles.error}
            role="alert"
          >
            {error}
          </div>
        )}

        <div className={styles.actions}>
          <Link
            href="/admin/products"
            className={styles.cancel}
          >
            إلغاء
          </Link>

          <button
            type="submit"
            className={styles.submit}
            disabled={submitting}
          >
            {submitting
              ? "جارٍ الحفظ..."
              : mode === "create"
                ? "حفظ المنتج"
                : "حفظ التعديلات"}
          </button>
        </div>
      </form>
    </main>
  );
}
