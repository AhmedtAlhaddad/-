"use client";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import detailStyles from "./admin-discounts.module.css";
import styles from "./admin-taxonomy.module.css";

export type DiscountScope = "global" | "category" | "product";

export type DiscountCodeItem = {
  id: string;
  code: string;
  active: boolean;
  customer_discount_percent: number;
  athlete_id: string | null;
  athlete_commission_percent: number;
  scope_type: DiscountScope;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  redemption_count: number;
  minimum_subtotal: number | null;
  created_at: string;
  updated_at: string;
  category_ids: string[];
  product_ids: string[];
};

export type AthleteOption = {
  id: string;
  display_name: string;
  active: boolean;
};

export type CategoryOption = {
  id: string;
  slug: string;
  name_ar: string;
  active: boolean;
};

export type ProductOption = {
  id: string;
  slug: string;
  name_ar: string;
  status: string;
};

type Filter = "all" | "active" | "inactive";

type EditorProps = {
  item?: DiscountCodeItem | null;
  athletes: AthleteOption[];
  categories: CategoryOption[];
  products: ProductOption[];
  onSaved?: () => void;
};

type Availability = "available" | "inactive" | "scheduled" | "expired" | "exhausted";

const scopeLabels: Record<DiscountScope, string> = {
  global: "المتجر بالكامل",
  category: "تصنيفات محددة",
  product: "منتجات محددة",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-LY", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function datetimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().slice(0, 16);
}

function isoDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw ? new Date(raw).toISOString() : "";
}

function availability(item: DiscountCodeItem): Availability {
  if (!item.active) {
    return "inactive";
  }

  const now = Date.now();

  if (item.starts_at && new Date(item.starts_at).getTime() > now) {
    return "scheduled";
  }

  if (item.ends_at && new Date(item.ends_at).getTime() <= now) {
    return "expired";
  }

  if (
    item.usage_limit !== null &&
    item.redemption_count >= item.usage_limit
  ) {
    return "exhausted";
  }

  return "available";
}

function DiscountEditor({
  item = null,
  athletes,
  categories,
  products,
  onSaved,
}: EditorProps) {
  const router = useRouter();
  const [scope, setScope] = useState<DiscountScope>(
    item?.scope_type ?? "global",
  );
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(
    () =>
      new Set(
        item?.scope_type === "category"
          ? item.category_ids
          : item?.scope_type === "product"
            ? item.product_ids
            : [],
      ),
  );
  const [targetSearch, setTargetSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const editing = Boolean(item);

  const visibleTargets = useMemo(() => {
    const normalized = targetSearch.trim().toLocaleLowerCase();
    const options = scope === "category" ? categories : products;

    if (!normalized) {
      return options;
    }

    return options.filter((option) =>
      `${option.name_ar} ${option.slug}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [categories, products, scope, targetSearch]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    const form = event.currentTarget;
    const data = new FormData(form);
    const targetIds = Array.from(selectedTargetIds);
    const active = data.get("active") === "on";

    if (scope !== "global" && targetIds.length === 0) {
      setIsError(true);
      setMessage("اختر تصنيفًا أو منتجًا واحدًا على الأقل للنطاق المحدد.");
      return;
    }

    if (item?.active && !active) {
      const confirmed = window.confirm(
        "تعطيل الكود يمنع استخدامه في الطلبات الجديدة، مع الحفاظ على الطلبات والعمولات السابقة. هل تريد المتابعة؟",
      );

      if (!confirmed) {
        return;
      }
    }

    const payload: Record<string, unknown> = {
      code: String(data.get("code") ?? ""),
      active,
      customer_discount_percent: Number(
        data.get("customer_discount_percent") ?? 0,
      ),
      athlete_id: String(data.get("athlete_id") ?? ""),
      athlete_commission_percent: Number(
        data.get("athlete_commission_percent") ?? 0,
      ),
      scope_type: scope,
      starts_at: isoDate(data.get("starts_at")),
      ends_at: isoDate(data.get("ends_at")),
      usage_limit: String(data.get("usage_limit") ?? ""),
      minimum_subtotal: String(
        data.get("minimum_subtotal") ?? "",
      ),
      target_ids: scope === "global" ? [] : targetIds,
    };

    if (item) {
      payload.id = item.id;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/discounts", {
        method: editing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        partial?: boolean;
      };

      if (!response.ok || result.success !== true) {
        if (result.partial) {
          router.refresh();
        }

        throw new Error(result.error || "تعذر حفظ كود الخصم.");
      }

      setMessage("تم حفظ كود الخصم بنجاح.");

      if (!editing) {
        form.reset();
        setScope("global");
        setSelectedTargetIds(new Set());
        setTargetSearch("");

        const activeInput = form.elements.namedItem("active");

        if (activeInput instanceof HTMLInputElement) {
          activeInput.checked = true;
        }
      }

      router.refresh();
      onSaved?.();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر حفظ كود الخصم.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.editorForm} onSubmit={submit}>
      <div className={styles.formGrid}>
        <label>
          <span>الكود *</span>
          <input
            type="text"
            name="code"
            required
            dir="ltr"
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
            defaultValue={item?.code ?? ""}
            placeholder="FITNESS20"
            onInput={(event) => {
              event.currentTarget.value =
                event.currentTarget.value.toUpperCase();
            }}
          />
        </label>

        <label>
          <span>الرياضي / المؤثر</span>
          <select
            name="athlete_id"
            className={detailStyles.select}
            defaultValue={item?.athlete_id ?? ""}
          >
            <option value="">بدون رياضي</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.display_name}
                {athlete.active ? "" : " — غير نشط"}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>خصم العميل % *</span>
          <input
            type="number"
            name="customer_discount_percent"
            required
            min="0"
            max="100"
            step="0.01"
            defaultValue={item?.customer_discount_percent ?? 0}
          />
        </label>

        <label>
          <span>عمولة الرياضي / المؤثر % *</span>
          <input
            type="number"
            name="athlete_commission_percent"
            required
            min="0"
            max="100"
            step="0.01"
            defaultValue={item?.athlete_commission_percent ?? 0}
          />
        </label>
      </div>

      <p className={detailStyles.independenceNotice}>
        خصم العميل وعمولة الرياضي قيمتان مستقلتان يدويًا. يمكن أن تكون
        إحداهما صفرًا، ولا تُشتق أي نسبة من الأخرى.
      </p>

      <div className={styles.formGrid}>
        <label>
          <span>يبدأ في</span>
          <input
            type="datetime-local"
            name="starts_at"
            defaultValue={datetimeLocalValue(item?.starts_at ?? null)}
          />
        </label>

        <label>
          <span>ينتهي في</span>
          <input
            type="datetime-local"
            name="ends_at"
            defaultValue={datetimeLocalValue(item?.ends_at ?? null)}
          />
        </label>

        <label>
          <span>حد الاستخدام</span>
          <input
            type="number"
            name="usage_limit"
            min={Math.max(1, item?.redemption_count ?? 1)}
            max="2147483647"
            step="1"
            defaultValue={item?.usage_limit ?? ""}
            placeholder="بدون حد"
          />
        </label>

        <label>
          <span>الحد الأدنى للمجموع (د.ل)</span>
          <input
            type="number"
            name="minimum_subtotal"
            min="0"
            max="999999999.999"
            step="0.001"
            defaultValue={item?.minimum_subtotal ?? ""}
            placeholder="بدون حد أدنى"
          />
        </label>
      </div>

      <section className={detailStyles.section}>
        <div className={detailStyles.sectionHeading}>
          <div>
            <strong>نطاق تطبيق الكود</strong>
            <span>يُحسب الخصم والعمولة على المجموع المؤهل فقط.</span>
          </div>

          <select
            name="scope_type"
            className={detailStyles.select}
            value={scope}
            onChange={(event) => {
              const nextScope = event.target.value as DiscountScope;
              setScope(nextScope);
              setSelectedTargetIds(
                new Set(
                  nextScope === "category"
                    ? item?.category_ids ?? []
                    : nextScope === "product"
                      ? item?.product_ids ?? []
                      : [],
                ),
              );
              setTargetSearch("");
            }}
          >
            <option value="global">المتجر بالكامل</option>
            <option value="category">تصنيفات محددة</option>
            <option value="product">منتجات محددة</option>
          </select>
        </div>

        {scope !== "global" && (
          <>
            <input
              type="search"
              value={targetSearch}
              className={detailStyles.targetSearch}
              placeholder={
                scope === "category"
                  ? "ابحث في التصنيفات..."
                  : "ابحث في المنتجات..."
              }
              onChange={(event) => setTargetSearch(event.target.value)}
            />

            {visibleTargets.length === 0 ? (
              <p className={detailStyles.emptyTargets}>
                لا توجد عناصر مطابقة.
              </p>
            ) : (
              <div className={detailStyles.targets}>
                {visibleTargets.map((target) => {
                  const inactive =
                    "active" in target
                      ? !target.active
                      : target.status !== "active";

                  return (
                    <label key={target.id} className={detailStyles.target}>
                      <input
                        type="checkbox"
                        name="target_ids"
                        value={target.id}
                        checked={selectedTargetIds.has(target.id)}
                        onChange={(event) => {
                          const next = new Set(selectedTargetIds);

                          if (event.target.checked) {
                            next.add(target.id);
                          } else {
                            next.delete(target.id);
                          }

                          setSelectedTargetIds(next);
                        }}
                      />
                      <span className={detailStyles.targetText}>
                        <strong>{target.name_ar}</strong>
                        <span dir="ltr">
                          {target.slug}
                          {inactive ? " — غير نشط" : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      <div className={styles.formFooter}>
        <label className={styles.activeToggle}>
          <input
            type="checkbox"
            name="active"
            defaultChecked={item?.active ?? true}
          />
          <span>نشط ومتاح للطلبات الجديدة</span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className={styles.saveButton}
        >
          {saving
            ? "جارٍ الحفظ..."
            : editing
              ? "حفظ التعديلات"
              : "إضافة الكود"}
        </button>
      </div>

      {item && (
        <p className={styles.linkedNotice}>
          استُخدم هذا الكود {item.redemption_count} مرة. لا يمكن خفض حد
          الاستخدام عن هذا العدد، ولا يوجد حذف مباشر حفاظًا على السجل.
        </p>
      )}

      {message && (
        <p
          className={
            isError ? styles.errorMessage : styles.successMessage
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}

export function DiscountCodesManager({
  items,
  athletes,
  categories,
  products,
}: {
  items: DiscountCodeItem[];
  athletes: AthleteOption[];
  categories: CategoryOption[];
  products: ProductOption[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const athleteNames = useMemo(
    () => new Map(athletes.map((item) => [item.id, item.display_name])),
    [athletes],
  );
  const categoryNames = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name_ar])),
    [categories],
  );
  const productNames = useMemo(
    () => new Map(products.map((item) => [item.id, item.name_ar])),
    [products],
  );

  const activeCount = items.filter((item) => item.active).length;
  const athleteCount = items.filter((item) => item.athlete_id).length;
  const scopedCount = items.filter(
    (item) => item.scope_type !== "global",
  ).length;

  const visibleItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();

    return items.filter((item) => {
      if (filter === "active" && !item.active) {
        return false;
      }

      if (filter === "inactive" && item.active) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return `${item.code} ${
        item.athlete_id ? athleteNames.get(item.athlete_id) ?? "" : ""
      }`
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [athleteNames, filter, items, search]);

  function targetNames(item: DiscountCodeItem) {
    if (item.scope_type === "global") {
      return "كل المنتجات المؤهلة في المتجر";
    }

    const ids =
      item.scope_type === "category"
        ? item.category_ids
        : item.product_ids;
    const names = ids
      .map((id) =>
        item.scope_type === "category"
          ? categoryNames.get(id)
          : productNames.get(id),
      )
      .filter((name): name is string => Boolean(name));

    return names.length > 0 ? names.join("، ") : "لا توجد أهداف مهيأة";
  }

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>DISCOUNT CODES</span>
          <h1>إدارة أكواد الخصم</h1>
          <p>
            إدارة خصم العميل وعمولة الرياضي بشكل مستقل، مع نطاقات
            وفترات صلاحية وحدود استخدام موثوقة من الخادم.
          </p>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setCreateOpen((current) => !current)}
        >
          {createOpen ? "إغلاق النموذج" : "+ إضافة كود"}
        </button>
      </section>

      <section className={styles.stats}>
        <article className={styles.stat}>
          <span>الإجمالي</span>
          <strong>{items.length}</strong>
          <small>كل الأكواد</small>
        </article>
        <article className={styles.stat}>
          <span>المفعلة</span>
          <strong>{activeCount}</strong>
          <small>قبل فحص التاريخ والحد</small>
        </article>
        <article className={styles.stat}>
          <span>مرتبطة برياضي</span>
          <strong>{athleteCount}</strong>
          <small>قد تحمل عمولة مستقلة</small>
        </article>
        <article className={styles.stat}>
          <span>بنطاق مخصص</span>
          <strong>{scopedCount}</strong>
          <small>تصنيف أو منتج</small>
        </article>
      </section>

      {createOpen && (
        <section className={styles.createCard}>
          <div className={styles.cardHeading}>
            <div>
              <strong>إضافة كود جديد</strong>
              <span>اضبط النسب والنطاق يدويًا ثم احفظ.</span>
            </div>
          </div>
          <DiscountEditor
            athletes={athletes}
            categories={categories}
            products={products}
            onSaved={() => setCreateOpen(false)}
          />
        </section>
      )}

      <section className={styles.toolbar}>
        <input
          type="search"
          value={search}
          className={styles.searchInput}
          placeholder="ابحث بالكود أو اسم الرياضي..."
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className={styles.filters}>
          {(["all", "active", "inactive"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.filter} ${
                filter === value ? styles.filterActive : ""
              }`}
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? "الكل"
                : value === "active"
                  ? "المفعلة"
                  : "غير المفعلة"}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.list}>
        {visibleItems.length === 0 ? (
          <div className={styles.empty}>
            <span>%</span>
            <strong>لا توجد نتائج</strong>
            <p>جرّب تغيير البحث أو الفلتر.</p>
          </div>
        ) : (
          visibleItems.map((item) => {
            const state = availability(item);

            return (
              <details
                key={`${item.id}:${item.updated_at}`}
                className={styles.entityCard}
              >
                <summary className={styles.entitySummary}>
                  <div className={styles.entityIdentity}>
                    <span className={styles.entityIcon}>%</span>
                    <div>
                      <strong className={detailStyles.code}>{item.code}</strong>
                      <span>
                        {item.athlete_id
                          ? athleteNames.get(item.athlete_id) ?? "رياضي غير متاح"
                          : "بدون رياضي"}
                      </span>
                    </div>
                  </div>

                  <div className={styles.summaryMeta}>
                    <span
                      className={
                        item.active
                          ? styles.activeBadge
                          : styles.inactiveBadge
                      }
                    >
                      {item.active ? "مفعل" : "غير مفعل"}
                    </span>
                    {state === "scheduled" && (
                      <span className={detailStyles.scheduledBadge}>مجدول</span>
                    )}
                    {state === "expired" && (
                      <span className={detailStyles.expiredBadge}>منتهي</span>
                    )}
                    {state === "exhausted" && (
                      <span className={detailStyles.exhaustedBadge}>مستنفد</span>
                    )}
                    <span className={styles.productCount}>
                      خصم {item.customer_discount_percent}%
                    </span>
                    <span className={styles.orderBadge}>
                      عمولة {item.athlete_commission_percent}%
                    </span>
                  </div>
                </summary>

                <div className={styles.entityBody}>
                  <div className={detailStyles.scopeSummary}>
                    <span className={detailStyles.scopePill}>
                      {scopeLabels[item.scope_type]}
                    </span>
                    <span className={detailStyles.scopePill}>
                      الاستخدام {item.redemption_count}
                      {item.usage_limit === null ? " / ∞" : ` / ${item.usage_limit}`}
                    </span>
                    {item.minimum_subtotal !== null && (
                      <span className={detailStyles.scopePill}>
                        حد أدنى {item.minimum_subtotal.toFixed(3)} د.ل
                      </span>
                    )}
                  </div>

                  <p className={detailStyles.targetNames}>
                    النطاق: {targetNames(item)}
                  </p>

                  <div className={styles.entityMeta}>
                    {item.starts_at && (
                      <span>البداية: {formatDate(item.starts_at)}</span>
                    )}
                    {item.ends_at && (
                      <span>النهاية: {formatDate(item.ends_at)}</span>
                    )}
                    <span>آخر تحديث: {formatDate(item.updated_at)}</span>
                  </div>

                  <DiscountEditor
                    item={item}
                    athletes={athletes}
                    categories={categories}
                    products={products}
                  />
                </div>
              </details>
            );
          })
        )}
      </section>

      <section className={styles.safetyNotice}>
        <strong>حماية السجل المالي</strong>
        <span>
          لا يوجد حذف مباشر للأكواد. الطلبات والعمولات تحتفظ بلقطاتها
          التاريخية، والتغييرات تؤثر فقط في الاستخدامات الجديدة.
        </span>
      </section>
    </main>
  );
}
