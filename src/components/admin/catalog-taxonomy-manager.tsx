"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import styles from "./admin-taxonomy.module.css";

export type CatalogTaxonomyItem = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  active: boolean;
  sort_order: number;
  updated_at: string;
  product_count: number;

  logo_path?: string | null;

  description_ar?: string | null;
  image_path?: string | null;
};

type Props = {
  kind:
    | "brands"
    | "categories";

  items:
    CatalogTaxonomyItem[];
};

type Filter =
  | "all"
  | "active"
  | "inactive";

type EditorProps = {
  kind:
    | "brands"
    | "categories";

  item?:
    | CatalogTaxonomyItem
    | null;

  onSaved?: () => void;
};

function formatDate(
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

function TaxonomyEditor({
  kind,
  item = null,
  onSaved,
}: EditorProps) {
  const router =
    useRouter();

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    isError,
    setIsError,
  ] =
    useState(false);

  const editing =
    Boolean(item);

  const entityLabel =
    kind === "brands"
      ? "العلامة التجارية"
      : "التصنيف";

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");
    setIsError(false);

    const form =
      event.currentTarget;

    const data =
      new FormData(form);

    const active =
      data.get("active") ===
      "on";

    if (
      item &&
      item.active &&
      !active &&
      item.product_count > 0
    ) {
      const confirmed =
        window.confirm(
          `هذا ${entityLabel} مرتبط بـ ${item.product_count} منتج. تعطيله قد يخفي المنتجات المرتبطة به من المتجر العام. هل تريد المتابعة؟`,
        );

      if (!confirmed) {
        return;
      }
    }

    const payload: Record<
      string,
      unknown
    > = {
      slug:
        String(
          data.get("slug") ??
            "",
        ),

      name_ar:
        String(
          data.get(
            "name_ar",
          ) ?? "",
        ),

      name_en:
        String(
          data.get(
            "name_en",
          ) ?? "",
        ),

      active,

      sort_order:
        Number(
          data.get(
            "sort_order",
          ) ?? 0,
        ),
    };

    if (editing) {
      payload.id =
        item?.id;
    }

    if (
      kind === "brands"
    ) {
      payload.logo_path =
        String(
          data.get(
            "logo_path",
          ) ?? "",
        );
    } else {
      payload.description_ar =
        String(
          data.get(
            "description_ar",
          ) ?? "",
        );

      payload.image_path =
        String(
          data.get(
            "image_path",
          ) ?? "",
        );
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          `/api/admin/catalog-taxonomy/${kind}`,
          {
            method:
              editing
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload,
              ),
          },
        );

      const result =
        (await response.json()) as {
          success?: boolean;
          error?: string;
          warning?: string | null;
        };

      if (
        !response.ok ||
        result.success !== true
      ) {
        throw new Error(
          result.error ||
            `تعذر حفظ ${entityLabel}.`,
        );
      }

      setIsError(false);

      setMessage(
        result.warning ||
          `تم حفظ ${entityLabel} بنجاح.`,
      );

      if (!editing) {
        form.reset();

        const activeInput =
          form.elements.namedItem(
            "active",
          );

        if (
          activeInput instanceof
          HTMLInputElement
        ) {
          activeInput.checked =
            true;
        }

        const sortOrderInput =
          form.elements.namedItem(
            "sort_order",
          );

        if (
          sortOrderInput instanceof
          HTMLInputElement
        ) {
          sortOrderInput.value =
            "0";
        }
      }

      router.refresh();

      onSaved?.();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : `تعذر حفظ ${entityLabel}.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className={
        styles.editorForm
      }
      onSubmit={submit}
    >
      <div
        className={
          styles.formGrid
        }
      >
        <label>
          <span>
            الاسم بالعربي *
          </span>

          <input
            type="text"
            name="name_ar"
            required
            maxLength={160}
            defaultValue={
              item?.name_ar ??
              ""
            }
            placeholder={
              kind === "brands"
                ? "مثال: اسم العلامة بالعربية"
                : "مثال: بروتين"
            }
          />
        </label>

        <label>
          <span>
            الاسم بالإنجليزي
          </span>

          <input
            type="text"
            name="name_en"
            maxLength={160}
            defaultValue={
              item?.name_en ??
              ""
            }
            placeholder={
              kind === "brands"
                ? "Brand name"
                : "Protein"
            }
          />
        </label>

        <label>
          <span>
            الرابط المختصر (Slug) *
          </span>

          <input
            type="text"
            name="slug"
            required
            dir="ltr"
            maxLength={160}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            defaultValue={
              item?.slug ??
              ""
            }
            placeholder={
              kind === "brands"
                ? "brand-name"
                : "protein"
            }
          />
        </label>

        <label>
          <span>
            ترتيب العرض
          </span>

          <input
            type="number"
            name="sort_order"
            min="0"
            max="1000000"
            step="1"
            defaultValue={
              item?.sort_order ??
              0
            }
          />
        </label>
      </div>

      {kind ===
        "brands" ? (
        <label
          className={
            styles.fullField
          }
        >
          <span>
            Logo Path
          </span>

          <input
            type="text"
            name="logo_path"
            maxLength={1000}
            defaultValue={
              item?.logo_path ??
              ""
            }
            placeholder="مسار شعار اختياري"
          />

          <small>
            نخزن المسار فقط في
            هذه المرحلة. رفع شعارات
            مخصص يمكن إضافته لاحقًا.
          </small>
        </label>
      ) : (
        <>
          <label
            className={
              styles.fullField
            }
          >
            <span>
              وصف التصنيف
            </span>

            <textarea
              name="description_ar"
              maxLength={5000}
              rows={4}
              defaultValue={
                item?.description_ar ??
                ""
              }
              placeholder="وصف عربي اختياري للتصنيف..."
            />
          </label>

          <label
            className={
              styles.fullField
            }
          >
            <span>
              Image Path
            </span>

            <input
              type="text"
              name="image_path"
              maxLength={1000}
              defaultValue={
                item?.image_path ??
                ""
              }
              placeholder="مسار صورة اختياري"
            />

            <small>
              نخزن المسار فقط في
              هذه المرحلة.
            </small>
          </label>
        </>
      )}

      <div
        className={
          styles.formFooter
        }
      >
        <label
          className={
            styles.activeToggle
          }
        >
          <input
            type="checkbox"
            name="active"
            defaultChecked={
              item?.active ??
              true
            }
          />

          <span>
            نشط ومتاح
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className={
            styles.saveButton
          }
        >
          {saving
            ? "جارٍ الحفظ..."
            : editing
              ? "حفظ التعديلات"
              : `إضافة ${entityLabel}`}
        </button>
      </div>

      {editing &&
        item &&
        item.product_count >
          0 && (
          <p
            className={
              styles.linkedNotice
            }
          >
            مرتبط بـ
            {" "}
            {
              item.product_count
            }
            {" "}
            منتج. لا يوجد حذف مباشر
            من هذه الشاشة حفاظًا على
            العلاقات.
          </p>
        )}

      {message && (
        <p
          className={
            isError
              ? styles.errorMessage
              : styles.successMessage
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}

export function CatalogTaxonomyManager({
  kind,
  items,
}: Props) {
  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    filter,
    setFilter,
  ] =
    useState<Filter>(
      "all",
    );

  const [
    createOpen,
    setCreateOpen,
  ] =
    useState(false);

  const entityPlural =
    kind === "brands"
      ? "العلامات التجارية"
      : "التصنيفات";

  const entitySingular =
    kind === "brands"
      ? "علامة تجارية"
      : "تصنيف";

  const activeCount =
    items.filter(
      (item) =>
        item.active,
    ).length;

  const inactiveCount =
    items.length -
    activeCount;

  const linkedCount =
    items.filter(
      (item) =>
        item.product_count >
        0,
    ).length;

  const visibleItems =
    useMemo(() => {
      const normalized =
        search
          .trim()
          .toLocaleLowerCase();

      return items.filter(
        (item) => {
          if (
            filter ===
              "active" &&
            !item.active
          ) {
            return false;
          }

          if (
            filter ===
              "inactive" &&
            item.active
          ) {
            return false;
          }

          if (!normalized) {
            return true;
          }

          const haystack =
            [
              item.name_ar,
              item.name_en ??
                "",
              item.slug,
            ]
              .join(" ")
              .toLocaleLowerCase();

          return haystack.includes(
            normalized,
          );
        },
      );
    }, [
      filter,
      items,
      search,
    ]);

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
            {kind ===
            "brands"
              ? "BRANDS"
              : "CATEGORIES"}
          </span>

          <h1>
            إدارة
            {" "}
            {
              entityPlural
            }
          </h1>

          <p>
            إضافة وتعديل وترتيب
            وتفعيل عناصر الكتالوج
            مع متابعة عدد المنتجات
            المرتبطة.
          </p>
        </div>

        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={() =>
            setCreateOpen(
              (current) =>
                !current,
            )
          }
        >
          {createOpen
            ? "إغلاق النموذج"
            : `+ إضافة ${entitySingular}`}
        </button>
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
            الإجمالي
          </span>

          <strong>
            {items.length}
          </strong>

          <small>
            جميع العناصر
          </small>
        </article>

        <article
          className={
            styles.stat
          }
        >
          <span>
            النشطة
          </span>

          <strong>
            {activeCount}
          </strong>

          <small>
            ظاهرة للمتجر
          </small>
        </article>

        <article
          className={
            styles.stat
          }
        >
          <span>
            غير النشطة
          </span>

          <strong>
            {
              inactiveCount
            }
          </strong>

          <small>
            مخفية عن المتجر
          </small>
        </article>

        <article
          className={
            styles.stat
          }
        >
          <span>
            مرتبطة بمنتجات
          </span>

          <strong>
            {linkedCount}
          </strong>

          <small>
            عناصر مستخدمة
          </small>
        </article>
      </section>

      {createOpen && (
        <section
          className={
            styles.createCard
          }
        >
          <div
            className={
              styles.cardHeading
            }
          >
            <div>
              <strong>
                إضافة
                {" "}
                {
                  entitySingular
                }
              </strong>

              <span>
                أدخل البيانات ثم
                احفظ.
              </span>
            </div>
          </div>

          <TaxonomyEditor
            kind={kind}
            onSaved={() =>
              setCreateOpen(
                false,
              )
            }
          />
        </section>
      )}

      <section
        className={
          styles.toolbar
        }
      >
        <input
          type="search"
          value={search}
          className={
            styles.searchInput
          }
          placeholder={`ابحث في ${entityPlural} بالاسم أو slug...`}
          onChange={(
            event,
          ) =>
            setSearch(
              event
                .target
                .value,
            )
          }
        />

        <div
          className={
            styles.filters
          }
        >
          <button
            type="button"
            className={`${styles.filter} ${
              filter === "all"
                ? styles.filterActive
                : ""
            }`}
            onClick={() =>
              setFilter(
                "all",
              )
            }
          >
            الكل
          </button>

          <button
            type="button"
            className={`${styles.filter} ${
              filter ===
              "active"
                ? styles.filterActive
                : ""
            }`}
            onClick={() =>
              setFilter(
                "active",
              )
            }
          >
            النشطة
          </button>

          <button
            type="button"
            className={`${styles.filter} ${
              filter ===
              "inactive"
                ? styles.filterActive
                : ""
            }`}
            onClick={() =>
              setFilter(
                "inactive",
              )
            }
          >
            غير النشطة
          </button>
        </div>
      </section>

      <section
        className={
          styles.list
        }
      >
        {visibleItems.length ===
        0 ? (
          <div
            className={
              styles.empty
            }
          >
            <span>
              ◇
            </span>

            <strong>
              لا توجد نتائج
            </strong>

            <p>
              جرّب تغيير البحث
              أو الفلتر.
            </p>
          </div>
        ) : (
          visibleItems.map(
            (item) => (
              <details
                key={`${item.id}:${item.updated_at}`}
                className={
                  styles.entityCard
                }
              >
                <summary
                  className={
                    styles.entitySummary
                  }
                >
                  <div
                    className={
                      styles.entityIdentity
                    }
                  >
                    <span
                      className={
                        styles.entityIcon
                      }
                    >
                      {kind ===
                      "brands"
                        ? "B"
                        : "C"}
                    </span>

                    <div>
                      <strong>
                        {
                          item.name_ar
                        }
                      </strong>

                      <span
                        dir="ltr"
                      >
                        {item.slug}
                      </span>
                    </div>
                  </div>

                  <div
                    className={
                      styles.summaryMeta
                    }
                  >
                    <span
                      className={
                        item.active
                          ? styles.activeBadge
                          : styles.inactiveBadge
                      }
                    >
                      {item.active
                        ? "نشط"
                        : "غير نشط"}
                    </span>

                    <span
                      className={
                        styles.productCount
                      }
                    >
                      {
                        item.product_count
                      }
                      {" "}
                      منتج
                    </span>

                    <span
                      className={
                        styles.orderBadge
                      }
                    >
                      ترتيب
                      {" "}
                      {
                        item.sort_order
                      }
                    </span>
                  </div>
                </summary>

                <div
                  className={
                    styles.entityBody
                  }
                >
                  <div
                    className={
                      styles.entityMeta
                    }
                  >
                    <span>
                      آخر تحديث:
                      {" "}
                      {
                        formatDate(
                          item.updated_at,
                        )
                      }
                    </span>

                    {item.name_en && (
                      <span>
                        English:
                        {" "}
                        {
                          item.name_en
                        }
                      </span>
                    )}
                  </div>

                  <TaxonomyEditor
                    kind={kind}
                    item={item}
                  />
                </div>
              </details>
            ),
          )
        )}
      </section>

      <section
        className={
          styles.safetyNotice
        }
      >
        <strong>
          سياسة آمنة
        </strong>

        <span>
          لا يوجد حذف مباشر للعلامات
          أو التصنيفات من لوحة الإدارة.
          استخدم التعطيل للحفاظ على
          العلاقات والسجل، خصوصًا للعناصر
          المرتبطة بمنتجات.
        </span>
      </section>
    </main>
  );
}
