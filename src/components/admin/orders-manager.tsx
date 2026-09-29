"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { parseTelegramFailure } from "@/lib/telegram-failure";
import { parseWhatsAppFailure } from "@/lib/whatsapp-failure";

import detailStyles from "./admin-orders.module.css";
import styles from "./admin-taxonomy.module.css";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "delivered"
  | "cancelled";

export type OrderRecord = {
  id: string;
  order_number: number | string;
  customer_full_name: string;
  customer_phone: string;
  customer_city: string;
  customer_address: string;
  customer_notes: string | null;
  currency: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  discount_code_id: string | null;
  code_snapshot: string | null;
  code_scope_snapshot: "global" | "category" | "product" | null;
  code_qualifying_subtotal: number;
  customer_discount_percent_snapshot: number;
  athlete_id: string | null;
  status: OrderStatus;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemSnapshot = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name_snapshot: string;
  variant_description_snapshot: string;
  sku_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
};

export type AthleteContext = {
  id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
};

export type CommissionContext = {
  id: string;
  order_id: string;
  athlete_id: string;
  code_snapshot: string;
  base_subtotal: number;
  commission_percent: number;
  commission_amount: number;
  status: "pending" | "approved" | "paid" | "void";
  approved_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_at: string;
};

export type NotificationContext = {
  order_id: string;
  channel: "telegram" | "whatsapp";
  status: "pending" | "sending" | "sent" | "failed";
  attempt_count: number;
  sent_at: string | null;
  last_error: string | null;
};

type Filter = "all" | OrderStatus;

const statusLabels: Record<OrderStatus, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

const commissionLabels = {
  pending: "عمولة قيد الانتظار",
  approved: "عمولة معتمدة",
  paid: "عمولة مدفوعة",
  void: "عمولة ملغاة",
};

const scopeLabels = {
  global: "المتجر بالكامل",
  category: "تصنيف",
  product: "منتج",
};

const lifecycle: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "delivered",
];

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

function statusClass(status: OrderStatus) {
  if (status === "confirmed") {
    return detailStyles.statusConfirmed;
  }

  if (status === "preparing") {
    return detailStyles.statusPreparing;
  }

  if (status === "delivered") {
    return detailStyles.statusDelivered;
  }

  if (status === "cancelled") {
    return detailStyles.statusCancelled;
  }

  return detailStyles.statusPending;
}

function nextStatus(status: OrderStatus): OrderStatus | null {
  if (status === "pending") {
    return "confirmed";
  }

  if (status === "confirmed") {
    return "preparing";
  }

  if (status === "preparing") {
    return "delivered";
  }

  return null;
}

const notificationLabels: Record<NotificationContext["status"], string> = {
  pending: "بانتظار الإرسال",
  sending: "جارٍ الإرسال",
  sent: "تم الإرسال",
  failed: "فشل الإرسال",
};

function NotificationUpdater({
  orderId,
  notification,
}: {
  orderId: string;
  notification: NotificationContext;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const providerName = notification.channel === "telegram" ? "Telegram" : "WhatsApp";
  const failure = notification.last_error
    ? notification.channel === "telegram"
      ? parseTelegramFailure(notification.last_error)
      : parseWhatsAppFailure(notification.last_error)
    : null;
  const canRetry =
    notification.status === "failed" ||
    (notification.channel === "telegram" && notification.status === "pending");

  async function retry() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/orders/${notification.channel}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        },
      );
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || result.success !== true) {
        throw new Error(result.error || `تعذر إرسال إشعار ${providerName}.`);
      }

      setMessage(`تم تحديث حالة إشعار ${providerName}.`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : `تعذر إرسال إشعار ${providerName}.`,
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={detailStyles.statusPanel}>
      <div className={detailStyles.statusCopy}>
        <strong>إشعار {providerName} للإدارة</strong>
        <span>
          الإشعار يعتمد على لقطات الطلب المحفوظة، ولا يؤثر فشل {providerName} على نجاح الطلب.
        </span>
      </div>
      <p className={notification.status === "failed" ? detailStyles.error : detailStyles.terminalNotice}>
        {notificationLabels[notification.status]}
        {notification.attempt_count > 0 && ` · المحاولات: ${notification.attempt_count}`}
      </p>
      {notification.status === "failed" && failure?.kind === "meta" && (
        <dl className={detailStyles.notificationErrorDetails}>
          <div>
            <dt>حالة HTTP</dt>
            <dd>{failure.diagnostic.status}</dd>
          </div>
          {failure.diagnostic.code !== undefined && (
            <div>
              <dt>رمز Meta</dt>
              <dd>{failure.diagnostic.code}</dd>
            </div>
          )}
          {failure.diagnostic.error_subcode !== undefined && (
            <div>
              <dt>الرمز الفرعي</dt>
              <dd>{failure.diagnostic.error_subcode}</dd>
            </div>
          )}
          {failure.diagnostic.type && (
            <div>
              <dt>النوع</dt>
              <dd dir="auto">{failure.diagnostic.type}</dd>
            </div>
          )}
          {failure.diagnostic.message && (
            <div>
              <dt>السبب</dt>
              <dd dir="auto">{failure.diagnostic.message}</dd>
            </div>
          )}
          {failure.diagnostic.details && (
            <div>
              <dt>التفاصيل</dt>
              <dd dir="auto">{failure.diagnostic.details}</dd>
            </div>
          )}
          {failure.diagnostic.messaging_product && (
            <div>
              <dt>المنتج</dt>
              <dd dir="auto">{failure.diagnostic.messaging_product}</dd>
            </div>
          )}
        </dl>
      )}
      {notification.status === "failed" && failure?.kind === "telegram" && (
        <dl className={detailStyles.notificationErrorDetails}>
          <div>
            <dt>حالة HTTP</dt>
            <dd>{failure.diagnostic.status}</dd>
          </div>
          {failure.diagnostic.error_code !== undefined && (
            <div>
              <dt>رمز Telegram</dt>
              <dd>{failure.diagnostic.error_code}</dd>
            </div>
          )}
          {failure.diagnostic.description && (
            <div>
              <dt>السبب</dt>
              <dd dir="auto">{failure.diagnostic.description}</dd>
            </div>
          )}
        </dl>
      )}
      {notification.status === "failed" && failure?.kind === "text" && (
        <p className={detailStyles.error}>السبب: {failure.message}</p>
      )}
      {canRetry && (
        <button
          type="button"
          className={detailStyles.statusButton}
          disabled={saving}
          onClick={retry}
        >
          {saving ? "جارٍ إعادة المحاولة..." : "إعادة إرسال الإشعار"}
        </button>
      )}
      {message && <p className={detailStyles.success}>{message}</p>}
    </section>
  );
}

function StatusUpdater({ order }: { order: OrderRecord }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const next = nextStatus(order.status);
  const canCancel = ["pending", "confirmed", "preparing"].includes(
    order.status,
  );

  async function updateStatus(status: OrderStatus) {
    setMessage("");
    setIsError(false);

    if (status === "cancelled") {
      const confirmed = window.confirm(
        "إلغاء الطلب نهائي لهذه الدورة: ستعيد قاعدة البيانات مخزون العناصر المرتبطة وتلغي العمولة غير المدفوعة. هل تريد المتابعة؟",
      );

      if (!confirmed) {
        return;
      }
    }

    if (status === "delivered") {
      const confirmed = window.confirm(
        "تأكيد التسليم سيعتمد عمولة الرياضي المرتبطة لتصبح قابلة للدفع. هل تم تسليم الطلب فعليًا؟",
      );

      if (!confirmed) {
        return;
      }
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/orders/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: order.id,
          status,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || result.success !== true) {
        throw new Error(result.error || "تعذر تحديث حالة الطلب.");
      }

      setMessage(`تم تحديث حالة الطلب إلى «${statusLabels[status]}».`);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر تحديث حالة الطلب.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={detailStyles.statusPanel}>
      <div className={detailStyles.statusCopy}>
        <strong>تحديث حالة الطلب</strong>
        <span>
          التغييرات تنفذ عبر set_order_status الموثوقة؛ لا يتم تعديل
          المخزون أو العمولات مباشرة من الواجهة.
        </span>
      </div>

      {order.status === "cancelled" ? (
        <p className={detailStyles.terminalNotice}>
          الطلب ملغى. أعادت الوظيفة الموثوقة المخزون وألغت العمولة المؤهلة.
        </p>
      ) : order.status === "delivered" ? (
        <p className={detailStyles.terminalNotice}>
          الطلب مسلّم ونهائي، وأصبحت العمولة المرتبطة معتمدة للدفع.
        </p>
      ) : (
        <div className={detailStyles.statusActions}>
          {next && (
            <button
              type="button"
              className={detailStyles.statusButton}
              disabled={saving}
              onClick={() => updateStatus(next)}
            >
              {saving ? "جارٍ التحديث..." : `نقل إلى: ${statusLabels[next]}`}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              className={detailStyles.cancelButton}
              disabled={saving}
              onClick={() => updateStatus("cancelled")}
            >
              إلغاء الطلب
            </button>
          )}
        </div>
      )}

      {message && (
        <p className={isError ? detailStyles.error : detailStyles.success}>
          {message}
        </p>
      )}
    </section>
  );
}

export function OrdersManager({
  orders,
  items,
  athletes,
  commissions,
  notifications,
}: {
  orders: OrderRecord[];
  items: OrderItemSnapshot[];
  athletes: AthleteContext[];
  commissions: CommissionContext[];
  notifications: NotificationContext[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const itemsByOrder = useMemo(() => {
    const map = new Map<string, OrderItemSnapshot[]>();

    for (const item of items) {
      const group = map.get(item.order_id) ?? [];
      group.push(item);
      map.set(item.order_id, group);
    }

    return map;
  }, [items]);
  const athleteMap = useMemo(
    () => new Map(athletes.map((athlete) => [athlete.id, athlete])),
    [athletes],
  );
  const commissionByOrder = useMemo(
    () => new Map(commissions.map((item) => [item.order_id, item])),
    [commissions],
  );
  const notificationByOrder = useMemo(
    () => {
      const map = new Map<string, NotificationContext[]>();

      for (const notification of notifications) {
        const group = map.get(notification.order_id) ?? [];
        group.push(notification);
        map.set(notification.order_id, group);
      }

      return map;
    },
    [notifications],
  );

  const activeCount = orders.filter((order) =>
    ["pending", "confirmed", "preparing"].includes(order.status),
  ).length;
  const deliveredOrders = orders.filter(
    (order) => order.status === "delivered",
  );
  const deliveredRevenue = deliveredOrders.reduce(
    (total, order) => total + order.total,
    0,
  );
  const cancelledCount = orders.filter(
    (order) => order.status === "cancelled",
  ).length;

  const visibleOrders = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();

    return orders.filter((order) => {
      if (filter !== "all" && order.status !== filter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      const athlete = order.athlete_id
        ? athleteMap.get(order.athlete_id)
        : null;

      return [
        String(order.order_number),
        order.customer_full_name,
        order.customer_phone,
        order.customer_city,
        order.code_snapshot ?? "",
        athlete?.display_name ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [athleteMap, filter, orders, search]);

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>ORDERS</span>
          <h1>إدارة الطلبات</h1>
          <p>
            متابعة الطلبات من الأحدث، مراجعة تفاصيل العميل واللقطات
            المالية، وتحديث الحالة عبر دورة قاعدة البيانات الموثوقة.
          </p>
        </div>
      </section>

      <section className={styles.stats}>
        <article className={styles.stat}>
          <span>إجمالي الطلبات</span>
          <strong>{orders.length}</strong>
          <small>كل السجل التاريخي</small>
        </article>
        <article className={styles.stat}>
          <span>قيد التنفيذ</span>
          <strong>{activeCount}</strong>
          <small>انتظار أو تأكيد أو تجهيز</small>
        </article>
        <article className={styles.stat}>
          <span>إيراد الطلبات المسلّمة</span>
          <strong className={detailStyles.statsValue}>
            {formatMoney(deliveredRevenue)}
          </strong>
          <small>{deliveredOrders.length} طلب مسلّم</small>
        </article>
        <article className={styles.stat}>
          <span>الطلبات الملغاة</span>
          <strong>{cancelledCount}</strong>
          <small>أعيد مخزونها عبر الوظيفة الموثوقة</small>
        </article>
      </section>

      <section className={styles.toolbar}>
        <input
          type="search"
          value={search}
          className={styles.searchInput}
          placeholder="ابحث برقم الطلب أو العميل أو الهاتف أو المدينة أو الكود..."
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className={styles.filters}>
          {(
            [
              "all",
              "pending",
              "confirmed",
              "preparing",
              "delivered",
              "cancelled",
            ] as const
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
        {visibleOrders.length === 0 ? (
          <div className={styles.empty}>
            <span>▤</span>
            <strong>لا توجد نتائج</strong>
            <p>جرّب تغيير البحث أو فلتر الحالة.</p>
          </div>
        ) : (
          visibleOrders.map((order) => {
            const orderItems = itemsByOrder.get(order.id) ?? [];
            const athlete = order.athlete_id
              ? athleteMap.get(order.athlete_id)
              : null;
            const commission = commissionByOrder.get(order.id);

            return (
              <details key={order.id} className={styles.entityCard}>
                <summary className={styles.entitySummary}>
                  <div className={styles.entityIdentity}>
                    <span className={styles.entityIcon}>▤</span>
                    <div>
                      <strong>
                        طلب #{String(order.order_number)} · {order.customer_full_name}
                      </strong>
                      <span>
                        {order.customer_phone} · {order.customer_city} · {formatDate(order.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.summaryMeta}>
                    <span className={statusClass(order.status)}>
                      {statusLabels[order.status]}
                    </span>
                    <span className={detailStyles.contextBadge}>
                      {orderItems.length} عنصر
                    </span>
                    <span className={`${styles.productCount} ${detailStyles.totalBadge}`}>
                      {formatMoney(order.total, order.currency)}
                    </span>
                  </div>
                </summary>

                <div className={styles.entityBody}>
                  <div className={detailStyles.timeline}>
                    {order.status === "cancelled" ? (
                      <span className={`${detailStyles.timelineStep} ${detailStyles.timelineCurrent}`}>
                        ملغى
                      </span>
                    ) : (
                      lifecycle.map((status) => (
                        <span
                          key={status}
                          className={`${detailStyles.timelineStep} ${
                            order.status === status
                              ? detailStyles.timelineCurrent
                              : ""
                          }`}
                        >
                          {statusLabels[status]}
                        </span>
                      ))
                    )}
                  </div>

                  <div className={detailStyles.detailGrid}>
                    <section className={detailStyles.panel}>
                      <strong className={detailStyles.panelTitle}>بيانات العميل</strong>
                      <dl className={detailStyles.dataList}>
                        <div className={detailStyles.dataRow}>
                          <dt>الاسم</dt>
                          <dd>{order.customer_full_name}</dd>
                        </div>
                        <div className={detailStyles.dataRow}>
                          <dt>الهاتف</dt>
                          <dd dir="ltr">{order.customer_phone}</dd>
                        </div>
                        <div className={detailStyles.dataRow}>
                          <dt>المدينة</dt>
                          <dd>{order.customer_city}</dd>
                        </div>
                        <div className={detailStyles.dataRow}>
                          <dt>العنوان</dt>
                          <dd>{order.customer_address}</dd>
                        </div>
                        {order.customer_notes && (
                          <div className={detailStyles.dataRow}>
                            <dt>ملاحظات العميل</dt>
                            <dd>{order.customer_notes}</dd>
                          </div>
                        )}
                      </dl>
                    </section>

                    <section className={detailStyles.panel}>
                      <strong className={detailStyles.panelTitle}>الكود والعمولة</strong>
                      <dl className={detailStyles.dataList}>
                        <div className={detailStyles.dataRow}>
                          <dt>كود الخصم</dt>
                          <dd>{order.code_snapshot ?? "بدون كود"}</dd>
                        </div>
                        {order.code_snapshot && (
                          <>
                            <div className={detailStyles.dataRow}>
                              <dt>النطاق التاريخي</dt>
                              <dd>
                                {order.code_scope_snapshot
                                  ? scopeLabels[order.code_scope_snapshot]
                                  : "—"}
                              </dd>
                            </div>
                            <div className={detailStyles.dataRow}>
                              <dt>المجموع المؤهل</dt>
                              <dd>{formatMoney(order.code_qualifying_subtotal, order.currency)}</dd>
                            </div>
                            <div className={detailStyles.dataRow}>
                              <dt>خصم العميل</dt>
                              <dd>{order.customer_discount_percent_snapshot}%</dd>
                            </div>
                          </>
                        )}
                        <div className={detailStyles.dataRow}>
                          <dt>الرياضي / المؤثر</dt>
                          <dd>{athlete?.display_name ?? "غير مرتبط"}</dd>
                        </div>
                        {commission && (
                          <>
                            <div className={detailStyles.dataRow}>
                              <dt>العمولة التاريخية</dt>
                              <dd>
                                {formatMoney(commission.commission_amount, order.currency)} · {commission.commission_percent}%
                              </dd>
                            </div>
                            <div className={detailStyles.dataRow}>
                              <dt>حالة العمولة</dt>
                              <dd>{commissionLabels[commission.status]}</dd>
                            </div>
                          </>
                        )}
                      </dl>
                    </section>
                  </div>

                  <section className={detailStyles.itemsPanel}>
                    <strong className={detailStyles.panelTitle}>عناصر الطلب التاريخية</strong>
                    <div className={detailStyles.items}>
                      {orderItems.map((item) => (
                        <article key={item.id} className={detailStyles.item}>
                          <div className={detailStyles.itemIdentity}>
                            <strong>{item.product_name_snapshot}</strong>
                            <span>
                              {item.variant_description_snapshot} · رمز المخزون (SKU): {item.sku_snapshot} · سعر الوحدة {formatMoney(item.unit_price, order.currency)}
                            </span>
                          </div>
                          <span className={detailStyles.itemQuantity}>
                            × {item.quantity}
                          </span>
                          <strong className={detailStyles.itemAmount}>
                            {formatMoney(item.line_total, order.currency)}
                          </strong>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className={detailStyles.financials}>
                    <div className={detailStyles.financialRow}>
                      <span>المجموع الفرعي التاريخي</span>
                      <strong>{formatMoney(order.subtotal, order.currency)}</strong>
                    </div>
                    <div className={detailStyles.financialRow}>
                      <span>الخصم التاريخي</span>
                      <strong>- {formatMoney(order.discount_amount, order.currency)}</strong>
                    </div>
                    <div className={`${detailStyles.financialRow} ${detailStyles.financialTotal}`}>
                      <span>الإجمالي</span>
                      <strong>{formatMoney(order.total, order.currency)}</strong>
                    </div>
                  </section>

                  <div className={styles.entityMeta}>
                    <span>إنشاء: {formatDate(order.created_at)}</span>
                    <span>آخر تحديث: {formatDate(order.updated_at)}</span>
                    {order.delivered_at && (
                      <span>تسليم: {formatDate(order.delivered_at)}</span>
                    )}
                    {order.cancelled_at && (
                      <span>إلغاء: {formatDate(order.cancelled_at)}</span>
                    )}
                  </div>

                  <StatusUpdater order={order} />
                  {(notificationByOrder.get(order.id) ?? []).map(
                    (notification) => (
                      <NotificationUpdater
                        key={notification.channel}
                        orderId={order.id}
                        notification={notification}
                      />
                    ),
                  )}
                </div>
              </details>
            );
          })
        )}
      </section>

      <section className={styles.safetyNotice}>
        <strong>سجل تاريخي محمي</strong>
        <span>
          الأسماء والأسعار والكميات والإجماليات معروضة من لقطات الطلب
          الأصلية، ولا تُعاد حسابها من بيانات المنتجات الحالية.
        </span>
      </section>
    </main>
  );
}
