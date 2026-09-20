"use client";

import {
  type FormEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import detailStyles from "./admin-commissions.module.css";
import styles from "./admin-taxonomy.module.css";

export type CommissionStatus =
  | "pending"
  | "approved"
  | "paid"
  | "void";

export type CommissionItem = {
  id: string;
  order_id: string;
  athlete_id: string;
  discount_code_id: string | null;
  code_snapshot: string;
  scope_snapshot: "global" | "category" | "product";
  base_subtotal: number;
  commission_percent: number;
  commission_amount: number;
  status: CommissionStatus;
  approved_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderContext = {
  id: string;
  order_number: number | string;
  status: string;
  customer_full_name: string;
  total: number | string;
  delivered_at: string | null;
  created_at: string;
};

export type AthleteContext = {
  id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
};

export type PayoutRecord = {
  id: string;
  athlete_id: string;
  currency: string;
  total_amount: number;
  payment_reference: string | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
};

export type PayoutItem = {
  payout_id: string;
  commission_id: string;
  amount: number;
  created_at: string;
};

type Filter = "all" | CommissionStatus;

const statusLabels: Record<CommissionStatus, string> = {
  pending: "قيد الانتظار",
  approved: "معتمدة للدفع",
  paid: "مدفوعة",
  void: "ملغاة",
};

const orderStatusLabels: Record<string, string> = {
  pending: "طلب قيد الانتظار",
  confirmed: "طلب مؤكد",
  preparing: "قيد التجهيز",
  delivered: "تم التسليم",
  cancelled: "طلب ملغى",
};

const scopeLabels = {
  global: "المتجر بالكامل",
  category: "نطاق تصنيف",
  product: "نطاق منتج",
};

function formatMoney(value: number, currency = "LYD") {
  return new Intl.NumberFormat("ar-LY", {
    style: "currency",
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-LY", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(status: CommissionStatus) {
  if (status === "approved") {
    return detailStyles.statusApproved;
  }

  if (status === "paid") {
    return detailStyles.statusPaid;
  }

  if (status === "void") {
    return detailStyles.statusVoid;
  }

  return detailStyles.statusPending;
}

function PayoutForm({
  athlete,
  commissions,
  orderMap,
}: {
  athlete: AthleteContext;
  commissions: CommissionItem[];
  orderMap: Map<string, OrderContext>;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const selectedTotal = commissions.reduce(
    (total, commission) =>
      selectedIds.has(commission.id)
        ? total + commission.commission_amount
        : total,
    0,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    if (selectedIds.size === 0) {
      setIsError(true);
      setMessage("اختر عمولة واحدة على الأقل لتسجيل الدفعة.");
      return;
    }

    const confirmed = window.confirm(
      `هل تم تحويل ${formatMoney(selectedTotal)} فعليًا إلى ${athlete.display_name}؟ سيُسجل السداد ولا يمكن التراجع عنه من لوحة الإدارة.`,
    );

    if (!confirmed) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);

    try {
      const response = await fetch("/api/admin/commissions/payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          athlete_id: athlete.id,
          commission_ids: Array.from(selectedIds),
          payment_reference: String(
            data.get("payment_reference") ?? "",
          ),
          notes: String(data.get("notes") ?? ""),
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        payout_id?: string;
        error?: string;
      };

      if (!response.ok || result.success !== true) {
        throw new Error(result.error || "تعذر تسجيل دفعة العمولات.");
      }

      setSelectedIds(new Set());
      form.reset();
      setMessage("تم تسجيل الدفعة وتحديث العمولات إلى مدفوعة.");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر تسجيل دفعة العمولات.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={detailStyles.payoutForm} onSubmit={submit}>
      <p className={detailStyles.notice}>
        هذه العملية تسجل دفعة منفذة فعليًا؛ لا تنفذ تحويلًا مصرفيًا.
        المبالغ التاريخية تبقى كما هي بعد تحويل الحالة إلى مدفوعة.
      </p>

      <div className={detailStyles.selectionTools}>
        <span>
          اختر العمولات المعتمدة التابعة للطلبات المسلّمة فقط.
        </span>
        <button
          type="button"
          className={detailStyles.linkButton}
          onClick={() =>
            setSelectedIds(
              selectedIds.size === commissions.length
                ? new Set()
                : new Set(commissions.map((item) => item.id)),
            )
          }
        >
          {selectedIds.size === commissions.length
            ? "إلغاء تحديد الكل"
            : "تحديد الكل"}
        </button>
      </div>

      <div className={detailStyles.commissionChoices}>
        {commissions.map((commission) => {
          const order = orderMap.get(commission.order_id);

          return (
            <label
              key={commission.id}
              className={detailStyles.commissionChoice}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(commission.id)}
                onChange={(event) => {
                  const next = new Set(selectedIds);

                  if (event.target.checked) {
                    next.add(commission.id);
                  } else {
                    next.delete(commission.id);
                  }

                  setSelectedIds(next);
                }}
              />
              <span className={detailStyles.choiceText}>
                <strong>طلب #{String(order?.order_number ?? "—")}</strong>
                <span>
                  {commission.code_snapshot} · {formatDate(commission.created_at)}
                </span>
              </span>
              <strong className={detailStyles.choiceAmount}>
                {formatMoney(commission.commission_amount)}
              </strong>
            </label>
          );
        })}
      </div>

      <div className={detailStyles.payoutFields}>
        <label>
          <span>مرجع الدفع</span>
          <input
            type="text"
            name="payment_reference"
            dir="ltr"
            maxLength={300}
            placeholder="رقم التحويل أو المرجع"
          />
        </label>
        <label>
          <span>ملاحظات الدفعة</span>
          <textarea
            name="notes"
            maxLength={2000}
            placeholder="ملاحظات اختيارية..."
          />
        </label>
      </div>

      <div className={detailStyles.payoutFooter}>
        <div>
          <span>{selectedIds.size} عمولة محددة</span>
          <strong>{formatMoney(selectedTotal)}</strong>
        </div>
        <button
          type="submit"
          className={detailStyles.payoutButton}
          disabled={saving || selectedIds.size === 0}
        >
          {saving ? "جارٍ تسجيل الدفعة..." : "تسجيل الدفعة"}
        </button>
      </div>

      {message && (
        <p className={isError ? detailStyles.error : detailStyles.success}>
          {message}
        </p>
      )}
    </form>
  );
}

export function CommissionsManager({
  items,
  orders,
  athletes,
  payouts,
  payoutItems,
}: {
  items: CommissionItem[];
  orders: OrderContext[];
  athletes: AthleteContext[];
  payouts: PayoutRecord[];
  payoutItems: PayoutItem[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const orderMap = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const athleteMap = useMemo(
    () => new Map(athletes.map((athlete) => [athlete.id, athlete])),
    [athletes],
  );
  const commissionMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );

  const payableItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === "approved" &&
          orderMap.get(item.order_id)?.status === "delivered",
      ),
    [items, orderMap],
  );

  const payableByAthlete = useMemo(() => {
    const groups = new Map<string, CommissionItem[]>();

    for (const item of payableItems) {
      const group = groups.get(item.athlete_id) ?? [];
      group.push(item);
      groups.set(item.athlete_id, group);
    }

    return Array.from(groups.entries());
  }, [payableItems]);

  const historicalTotal = items.reduce(
    (total, item) => total + item.commission_amount,
    0,
  );
  const pendingTotal = items
    .filter((item) => item.status === "pending")
    .reduce((total, item) => total + item.commission_amount, 0);
  const payableTotal = payableItems.reduce(
    (total, item) => total + item.commission_amount,
    0,
  );
  const paidTotal = items
    .filter((item) => item.status === "paid")
    .reduce((total, item) => total + item.commission_amount, 0);

  const visibleItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();

    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const order = orderMap.get(item.order_id);
      const athlete = athleteMap.get(item.athlete_id);

      return [
        item.code_snapshot,
        athlete?.display_name ?? "",
        String(order?.order_number ?? ""),
        order?.customer_full_name ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [athleteMap, filter, items, orderMap, search]);

  const payoutItemsByPayout = useMemo(() => {
    const map = new Map<string, PayoutItem[]>();

    for (const item of payoutItems) {
      const group = map.get(item.payout_id) ?? [];
      group.push(item);
      map.set(item.payout_id, group);
    }

    return map;
  }, [payoutItems]);

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>COMMISSIONS</span>
          <h1>إدارة العمولات</h1>
          <p>
            متابعة العمولات التاريخية ودورة اعتمادها وتسجيل دفعات
            الرياضيين عبر وظائف قاعدة البيانات الموثوقة.
          </p>
        </div>
      </section>

      <section className={styles.stats}>
        <article className={styles.stat}>
          <span>السجل الكامل</span>
          <strong>{items.length}</strong>
          <small>قيمة تاريخية {formatMoney(historicalTotal)}</small>
        </article>
        <article className={styles.stat}>
          <span>قيد الانتظار</span>
          <strong className={detailStyles.statsValue}>
            {formatMoney(pendingTotal)}
          </strong>
          <small>تُعتمد عند تسليم الطلب</small>
        </article>
        <article className={styles.stat}>
          <span>قابلة للدفع</span>
          <strong className={detailStyles.statsValue}>
            {formatMoney(payableTotal)}
          </strong>
          <small>{payableItems.length} عمولة معتمدة</small>
        </article>
        <article className={styles.stat}>
          <span>مدفوعة</span>
          <strong className={detailStyles.statsValue}>
            {formatMoney(paidTotal)}
          </strong>
          <small>{payouts.length} دفعة مسجلة</small>
        </article>
      </section>

      <section className={detailStyles.section}>
        <div className={detailStyles.sectionHeading}>
          <div>
            <strong>العمولات القابلة للدفع</strong>
            <span>
              تظهر هنا فقط العمولات المعتمدة المرتبطة بطلبات مسلّمة،
              مجمعة حسب الرياضي أو المؤثر.
            </span>
          </div>
        </div>

        {payableByAthlete.length === 0 ? (
          <div className={detailStyles.empty}>
            لا توجد عمولات معتمدة قابلة للدفع حاليًا.
          </div>
        ) : (
          <div className={detailStyles.payableGroups}>
            {payableByAthlete.map(([athleteId, commissions]) => {
              const athlete = athleteMap.get(athleteId);

              if (!athlete) {
                return null;
              }

              const total = commissions.reduce(
                (sum, item) => sum + item.commission_amount,
                0,
              );

              return (
                <details
                  key={athleteId}
                  className={detailStyles.payableGroup}
                >
                  <summary className={detailStyles.payableSummary}>
                    <span className={detailStyles.payableIdentity}>
                      <strong>{athlete.display_name}</strong>
                      <span>{commissions.length} عمولة قابلة للدفع</span>
                    </span>
                    <strong className={detailStyles.payableTotal}>
                      {formatMoney(total)}
                    </strong>
                  </summary>
                  <PayoutForm
                    athlete={athlete}
                    commissions={commissions}
                    orderMap={orderMap}
                  />
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.toolbar}>
        <input
          type="search"
          value={search}
          className={styles.searchInput}
          placeholder="ابحث بالكود أو الرياضي أو رقم الطلب أو العميل..."
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className={styles.filters}>
          {(
            ["all", "pending", "approved", "paid", "void"] as const
          ).map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.filter} ${
                filter === value ? styles.filterActive : ""
              }`}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "الكل" : statusLabels[value]}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.list}>
        {visibleItems.length === 0 ? (
          <div className={styles.empty}>
            <span>◈</span>
            <strong>لا توجد نتائج</strong>
            <p>جرّب تغيير البحث أو فلتر الحالة.</p>
          </div>
        ) : (
          visibleItems.map((item) => {
            const order = orderMap.get(item.order_id);
            const athlete = athleteMap.get(item.athlete_id);

            return (
              <details
                key={`${item.id}:${item.updated_at}`}
                className={styles.entityCard}
              >
                <summary className={styles.entitySummary}>
                  <div className={styles.entityIdentity}>
                    <span className={styles.entityIcon}>◈</span>
                    <div>
                      <strong>{athlete?.display_name ?? "رياضي غير متاح"}</strong>
                      <span>
                        طلب #{String(order?.order_number ?? "—")} · {item.code_snapshot}
                      </span>
                    </div>
                  </div>

                  <div className={styles.summaryMeta}>
                    <span className={statusClass(item.status)}>
                      {statusLabels[item.status]}
                    </span>
                    <span className={detailStyles.orderStatus}>
                      {orderStatusLabels[order?.status ?? ""] ?? "حالة طلب غير متاحة"}
                    </span>
                    <span className={`${styles.productCount} ${detailStyles.commissionAmount}`}>
                      {formatMoney(item.commission_amount)}
                    </span>
                  </div>
                </summary>

                <div className={styles.entityBody}>
                  <div className={detailStyles.detailGrid}>
                    <div className={detailStyles.detail}>
                      <span>المجموع المؤهل التاريخي</span>
                      <strong>{formatMoney(item.base_subtotal)}</strong>
                    </div>
                    <div className={detailStyles.detail}>
                      <span>نسبة العمولة التاريخية</span>
                      <strong>{item.commission_percent}%</strong>
                    </div>
                    <div className={detailStyles.detail}>
                      <span>الكود والنطاق</span>
                      <strong>
                        {item.code_snapshot} · {scopeLabels[item.scope_snapshot]}
                      </strong>
                    </div>
                    <div className={detailStyles.detail}>
                      <span>قيمة الطلب الحالية</span>
                      <strong>
                        {order ? formatMoney(Number(order.total)) : "—"}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.entityMeta}>
                    <span>إنشاء: {formatDate(item.created_at)}</span>
                    {item.approved_at && (
                      <span>اعتماد: {formatDate(item.approved_at)}</span>
                    )}
                    {item.paid_at && (
                      <span>دفع: {formatDate(item.paid_at)}</span>
                    )}
                    {item.voided_at && (
                      <span>إلغاء: {formatDate(item.voided_at)}</span>
                    )}
                    {order?.customer_full_name && (
                      <span>العميل: {order.customer_full_name}</span>
                    )}
                  </div>
                </div>
              </details>
            );
          })
        )}
      </section>

      <section className={detailStyles.section}>
        <div className={detailStyles.sectionHeading}>
          <div>
            <strong>سجل الدفعات</strong>
            <span>
              سجل دائم للدفعات وعناصرها؛ لا يمكن تعديله أو حذفه من لوحة الإدارة.
            </span>
          </div>
        </div>

        {payouts.length === 0 ? (
          <div className={detailStyles.empty}>لا توجد دفعات مسجلة بعد.</div>
        ) : (
          <div className={detailStyles.historyList}>
            {payouts.map((payout) => {
              const athlete = athleteMap.get(payout.athlete_id);
              const linkedItems = payoutItemsByPayout.get(payout.id) ?? [];
              const ordersLabel = linkedItems
                .map((payoutItem) => {
                  const commission = commissionMap.get(
                    payoutItem.commission_id,
                  );
                  const order = commission
                    ? orderMap.get(commission.order_id)
                    : null;
                  return order ? `#${String(order.order_number)}` : null;
                })
                .filter((value): value is string => Boolean(value))
                .join("، ");

              return (
                <article key={payout.id} className={detailStyles.payoutCard}>
                  <div className={detailStyles.payoutHeader}>
                    <div>
                      <strong>{athlete?.display_name ?? "رياضي غير متاح"}</strong>
                      <span>
                        {formatDate(payout.paid_at)} · {linkedItems.length} عمولة
                      </span>
                    </div>
                    <strong className={detailStyles.payoutAmount}>
                      {formatMoney(payout.total_amount, payout.currency)}
                    </strong>
                  </div>
                  <div className={detailStyles.payoutMeta}>
                    {payout.payment_reference && (
                      <div>مرجع الدفع: {payout.payment_reference}</div>
                    )}
                    {ordersLabel && <div>الطلبات: {ordersLabel}</div>}
                    {payout.notes && <div>ملاحظات: {payout.notes}</div>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.safetyNotice}>
        <strong>دورة مالية موثوقة</strong>
        <span>
          تسليم الطلب يعتمد العمولة، وإلغاء الطلب يلغيها، وتسجيل الدفعة
          يتم ذريًا عبر create_commission_payout دون تغيير المبلغ التاريخي.
        </span>
      </section>
    </main>
  );
}
