import type { Metadata } from "next";

import {
  CommissionsManager,
  type AthleteContext,
  type CommissionItem,
  type OrderContext,
  type PayoutItem,
  type PayoutRecord,
} from "@/components/admin/commissions-manager";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "إدارة العمولات",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

type CommissionRow = Omit<
  CommissionItem,
  "base_subtotal" | "commission_percent" | "commission_amount"
> & {
  base_subtotal: number | string;
  commission_percent: number | string;
  commission_amount: number | string;
};

type PayoutRow = Omit<PayoutRecord, "total_amount"> & {
  total_amount: number | string;
};

type PayoutItemRow = Omit<PayoutItem, "amount"> & {
  amount: number | string;
};

export default async function Page() {
  const { supabase } = await requireAdmin();

  const [
    commissionsResult,
    ordersResult,
    athletesResult,
    payoutsResult,
    payoutItemsResult,
  ] = await Promise.all([
    supabase
      .from("commissions")
      .select(
        "id, order_id, athlete_id, discount_code_id, code_snapshot, scope_snapshot, base_subtotal, commission_percent, commission_amount, status, approved_at, paid_at, voided_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: true }),
    supabase
      .from("orders")
      .select(
        "id, order_number, status, customer_full_name, total, delivered_at, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("athletes")
      .select("id, display_name, phone, email, active")
      .order("display_name", { ascending: true }),
    supabase
      .from("commission_payouts")
      .select(
        "id, athlete_id, currency, total_amount, payment_reference, notes, paid_at, created_at",
      )
      .order("paid_at", { ascending: false })
      .order("id", { ascending: true }),
    supabase
      .from("commission_payout_items")
      .select("payout_id, commission_id, amount, created_at"),
  ]);

  const firstError = [
    commissionsResult.error,
    ordersResult.error,
    athletesResult.error,
    payoutsResult.error,
    payoutItemsResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message);
  }

  const commissions = ((commissionsResult.data ?? []) as CommissionRow[]).map(
    (item) => ({
      ...item,
      base_subtotal: Number(item.base_subtotal),
      commission_percent: Number(item.commission_percent),
      commission_amount: Number(item.commission_amount),
    }),
  );
  const payouts = ((payoutsResult.data ?? []) as PayoutRow[]).map(
    (item) => ({
      ...item,
      total_amount: Number(item.total_amount),
    }),
  );
  const payoutItems = (
    (payoutItemsResult.data ?? []) as PayoutItemRow[]
  ).map((item) => ({
    ...item,
    amount: Number(item.amount),
  }));

  return (
    <CommissionsManager
      items={commissions}
      orders={(ordersResult.data ?? []) as OrderContext[]}
      athletes={(athletesResult.data ?? []) as AthleteContext[]}
      payouts={payouts}
      payoutItems={payoutItems}
    />
  );
}
