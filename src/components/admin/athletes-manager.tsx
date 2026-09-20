"use client";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import styles from "./admin-taxonomy.module.css";

export type AthleteItem = {
  id: string;
  display_name: string;
  profile_image_path: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Filter = "all" | "active" | "inactive";

type EditorProps = {
  item?: AthleteItem | null;
  onSaved?: () => void;
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

function AthleteEditor({
  item = null,
  onSaved,
}: EditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const editing = Boolean(item);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    const form = event.currentTarget;
    const data = new FormData(form);
    const active = data.get("active") === "on";

    if (item?.active && !active) {
      const confirmed = window.confirm(
        "تعطيل الرياضي يمنع استخدام أكواده في الطلبات الجديدة، مع الحفاظ على السجل السابق. هل تريد المتابعة؟",
      );

      if (!confirmed) {
        return;
      }
    }

    const payload: Record<string, unknown> = {
      display_name: String(data.get("display_name") ?? ""),
      profile_image_path: String(
        data.get("profile_image_path") ?? "",
      ),
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      notes: String(data.get("notes") ?? ""),
      active,
    };

    if (item) {
      payload.id = item.id;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/athletes", {
        method: editing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || result.success !== true) {
        throw new Error(result.error || "تعذر حفظ بيانات الرياضي.");
      }

      setMessage("تم حفظ بيانات الرياضي بنجاح.");

      if (!editing) {
        form.reset();

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
          : "تعذر حفظ بيانات الرياضي.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.editorForm} onSubmit={submit}>
      <div className={styles.formGrid}>
        <label>
          <span>اسم العرض *</span>
          <input
            type="text"
            name="display_name"
            required
            maxLength={160}
            defaultValue={item?.display_name ?? ""}
            placeholder="مثال: أحمد محمد"
          />
        </label>

        <label>
          <span>رقم الهاتف</span>
          <input
            type="tel"
            name="phone"
            dir="ltr"
            maxLength={64}
            defaultValue={item?.phone ?? ""}
            placeholder="+218..."
          />
        </label>

        <label>
          <span>البريد الإلكتروني</span>
          <input
            type="email"
            name="email"
            dir="ltr"
            maxLength={320}
            defaultValue={item?.email ?? ""}
            placeholder="athlete@example.com"
          />
        </label>

        <label>
          <span>مسار صورة الملف</span>
          <input
            type="text"
            name="profile_image_path"
            dir="ltr"
            maxLength={1000}
            defaultValue={item?.profile_image_path ?? ""}
            placeholder="مسار اختياري"
          />
        </label>
      </div>

      <label className={styles.fullField}>
        <span>ملاحظات</span>
        <textarea
          name="notes"
          maxLength={5000}
          rows={4}
          defaultValue={item?.notes ?? ""}
          placeholder="ملاحظات داخلية اختيارية..."
        />
      </label>

      <div className={styles.formFooter}>
        <label className={styles.activeToggle}>
          <input
            type="checkbox"
            name="active"
            defaultChecked={item?.active ?? true}
          />
          <span>نشط ومتاح</span>
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
              : "إضافة الرياضي"}
        </button>
      </div>

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

export function AthletesManager({
  items,
}: {
  items: AthleteItem[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const activeCount = items.filter((item) => item.active).length;
  const inactiveCount = items.length - activeCount;
  const contactableCount = items.filter(
    (item) => Boolean(item.phone || item.email),
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

      return [
        item.display_name,
        item.phone ?? "",
        item.email ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [filter, items, search]);

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>ATHLETES</span>
          <h1>إدارة الرياضيين</h1>
          <p>
            إضافة الرياضيين وتحديث بيانات التواصل وحالة التفعيل،
            مع الحفاظ على أكواد الخصم والسجلات المرتبطة.
          </p>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setCreateOpen((current) => !current)}
        >
          {createOpen ? "إغلاق النموذج" : "+ إضافة رياضي"}
        </button>
      </section>

      <section className={styles.stats}>
        <article className={styles.stat}>
          <span>الإجمالي</span>
          <strong>{items.length}</strong>
          <small>جميع الرياضيين</small>
        </article>

        <article className={styles.stat}>
          <span>النشطون</span>
          <strong>{activeCount}</strong>
          <small>متاحون للأكواد الجديدة</small>
        </article>

        <article className={styles.stat}>
          <span>غير النشطين</span>
          <strong>{inactiveCount}</strong>
          <small>محفوظون دون تفعيل</small>
        </article>

        <article className={styles.stat}>
          <span>بيانات التواصل</span>
          <strong>{contactableCount}</strong>
          <small>لديهم هاتف أو بريد</small>
        </article>
      </section>

      {createOpen && (
        <section className={styles.createCard}>
          <div className={styles.cardHeading}>
            <div>
              <strong>إضافة رياضي</strong>
              <span>أدخل البيانات ثم احفظ.</span>
            </div>
          </div>

          <AthleteEditor onSaved={() => setCreateOpen(false)} />
        </section>
      )}

      <section className={styles.toolbar}>
        <input
          type="search"
          value={search}
          className={styles.searchInput}
          placeholder="ابحث بالاسم أو الهاتف أو البريد..."
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filter} ${
              filter === "all" ? styles.filterActive : ""
            }`}
            onClick={() => setFilter("all")}
          >
            الكل
          </button>

          <button
            type="button"
            className={`${styles.filter} ${
              filter === "active" ? styles.filterActive : ""
            }`}
            onClick={() => setFilter("active")}
          >
            النشطون
          </button>

          <button
            type="button"
            className={`${styles.filter} ${
              filter === "inactive" ? styles.filterActive : ""
            }`}
            onClick={() => setFilter("inactive")}
          >
            غير النشطين
          </button>
        </div>
      </section>

      <section className={styles.list}>
        {visibleItems.length === 0 ? (
          <div className={styles.empty}>
            <span>◎</span>
            <strong>لا توجد نتائج</strong>
            <p>جرّب تغيير البحث أو الفلتر.</p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <details
              key={`${item.id}:${item.updated_at}`}
              className={styles.entityCard}
            >
              <summary className={styles.entitySummary}>
                <div className={styles.entityIdentity}>
                  <span className={styles.entityIcon}>◎</span>
                  <div>
                    <strong>{item.display_name}</strong>
                    <span dir="ltr">
                      {item.email || item.phone || "لا توجد بيانات تواصل"}
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
                    {item.active ? "نشط" : "غير نشط"}
                  </span>

                  {item.phone && (
                    <span className={styles.productCount}>هاتف</span>
                  )}

                  {item.email && (
                    <span className={styles.orderBadge}>بريد</span>
                  )}
                </div>
              </summary>

              <div className={styles.entityBody}>
                <div className={styles.entityMeta}>
                  <span>آخر تحديث: {formatDate(item.updated_at)}</span>
                  <span>تاريخ الإضافة: {formatDate(item.created_at)}</span>
                </div>

                <AthleteEditor item={item} />
              </div>
            </details>
          ))
        )}
      </section>

      <section className={styles.safetyNotice}>
        <strong>حماية السجل</strong>
        <span>
          لا يوجد حذف مباشر للرياضيين. استخدم التعطيل لمنع الاستخدام
          الجديد مع إبقاء أكواد الخصم والطلبات والعمولات السابقة مترابطة.
        </span>
      </section>
    </main>
  );
}
