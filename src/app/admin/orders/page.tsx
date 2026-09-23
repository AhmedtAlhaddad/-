import type { Metadata } from "next";

import {
  OrdersManager,
  type AthleteContext,
  type CommissionContext,
  type NotificationContext,
  type OrderItemSnapshot,
  type OrderRecord,
} from "@/components/admin/orders-manager";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "إدارة الطلبات",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

type OrderRow = Omit<
  OrderRecord,
  | "subtotal"
  | "discount_amount"
  | "total"
  | "code_qualifying_subtotal"
  | "customer_discount_percent_snapshot"
> & {
  subtotal: number | string;
  discount_amount: number | string;
  total: number | string;
  code_qualifying_subtotal: number | string;
  customer_discount_percent_snapshot: number | string;
};

type ItemRow = Omit<OrderItemSnapshot, "unit_price" | "line_total"> & {
  unit_price: number | string;
  line_total: number | string;
};

type CommissionRow = Omit<
  CommissionContext,
  "base_subtotal" | "commission_percent" | "commission_amount"
> & {
  base_subtotal: number | string;
  commission_percent: number | string;
  commission_amount: number | string;
};

type NotificationRow = NotificationContext;

export default async function Page() {
  const { supabase } = await requireAdmin("/admin/orders");

  const [ordersResult, itemsResult, athletesResult, commissionsResult, notificationsResult] =
    await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, customer_full_name, customer_phone, customer_city, customer_address, customer_notes, currency, subtotal, discount_amount, total, discount_code_id, code_snapshot, code_scope_snapshot, code_qualifying_subtotal, customer_discount_percent_snapshot, athlete_id, status, delivered_at, cancelled_at, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: true }),
      supabase
        .from("order_items")
        .select(
          "id, order_id, product_id, variant_id, product_name_snapshot, variant_description_snapshot, sku_snapshot, unit_price, quantity, line_total, created_at",
        )
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("athletes")
        .select("id, display_name, phone, email, active")
        .order("display_name", { ascending: true }),
      supabase
        .from("commissions")
        .select(
          "id, order_id, athlete_id, code_snapshot, base_subtotal, commission_percent, commission_amount, status, approved_at, paid_at, voided_at, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("admin_notification_outbox")
        .select("order_id, status, attempt_count, sent_at")
        .eq("channel", "whatsapp")
        .order("created_at", { ascending: false }),
    ]);

  const notificationTableUnavailable =
    notificationsResult.error?.code === "42P01" ||
    notificationsResult.error?.code === "PGRST205";
  const firstError = [
    ordersResult.error,
    itemsResult.error,
    athletesResult.error,
    commissionsResult.error,
    notificationTableUnavailable ? null : notificationsResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message);
  }

  const orders = ((ordersResult.data ?? []) as OrderRow[]).map((order) => ({
    ...order,
    subtotal: Number(order.subtotal),
    discount_amount: Number(order.discount_amount),
    total: Number(order.total),
    code_qualifying_subtotal: Number(order.code_qualifying_subtotal),
    customer_discount_percent_snapshot: Number(
      order.customer_discount_percent_snapshot,
    ),
  }));
  const items = ((itemsResult.data ?? []) as ItemRow[]).map((item) => ({
    ...item,
    unit_price: Number(item.unit_price),
    line_total: Number(item.line_total),
  }));
  const commissions = (
    (commissionsResult.data ?? []) as CommissionRow[]
  ).map((commission) => ({
    ...commission,
    base_subtotal: Number(commission.base_subtotal),
    commission_percent: Number(commission.commission_percent),
    commission_amount: Number(commission.commission_amount),
  }));

  return (
    <OrdersManager
      orders={orders}
      items={items}
      athletes={(athletesResult.data ?? []) as AthleteContext[]}
      commissions={commissions}
      notifications={
        notificationTableUnavailable
          ? []
          : ((notificationsResult.data ?? []) as NotificationRow[])
      }
    />
  );
}
