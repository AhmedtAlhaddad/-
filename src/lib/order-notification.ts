export type OrderNotificationItem = {
  product_name_snapshot: string;
  variant_description_snapshot: string;
  sku_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type OrderNotificationPayload = {
  order_number: number | string;
  created_at: string;
  customer_full_name: string;
  customer_phone: string;
  customer_city: string;
  customer_address: string;
  customer_notes: string | null;
  currency: string;
  subtotal: number;
  code_snapshot: string | null;
  customer_discount_percent_snapshot: number;
  discount_amount: number;
  total: number;
  status: string;
  items: OrderNotificationItem[];
  athlete: {
    display_name: string;
  } | null;
  commission: {
    commission_percent: number;
    commission_amount: number;
  } | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("ar-LY", {
    style: "currency",
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-LY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function buildOrderNotificationSummary(
  order: OrderNotificationPayload,
  heading?: string,
) {
  const lines = heading
    ? [heading, `رقم الطلب: #${String(order.order_number)}`]
    : [`طلب جديد #${String(order.order_number)}`];

  lines.push(
    `التاريخ: ${formatDate(order.created_at)}`,
    `حالة الطلب: ${order.status}`,
    "",
    "بيانات العميل",
    `الاسم: ${order.customer_full_name}`,
    `الهاتف: ${order.customer_phone}`,
    `المدينة: ${order.customer_city}`,
    `العنوان: ${order.customer_address}`,
  );

  if (order.customer_notes) {
    lines.push(`الملاحظات: ${order.customer_notes}`);
  }

  lines.push("", "المنتجات");

  order.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.product_name_snapshot}`,
      `التفاصيل: ${item.variant_description_snapshot}`,
      `SKU: ${item.sku_snapshot}`,
      `الكمية: ${item.quantity}`,
      `سعر الوحدة: ${formatMoney(item.unit_price, order.currency)}`,
      `إجمالي العنصر: ${formatMoney(item.line_total, order.currency)}`,
      "",
    );
  });

  lines.push(
    "تفاصيل السعر",
    `قبل الخصم: ${formatMoney(order.subtotal, order.currency)}`,
    `الكود: ${order.code_snapshot ?? "لا يوجد"}`,
  );

  if (
    order.code_snapshot ||
    order.customer_discount_percent_snapshot !== 0 ||
    order.discount_amount !== 0
  ) {
    lines.push(
      `خصم العميل: ${order.customer_discount_percent_snapshot}%`,
      `قيمة الخصم: ${formatMoney(order.discount_amount, order.currency)}`,
    );
  }

  lines.push(`الإجمالي النهائي: ${formatMoney(order.total, order.currency)}`);

  if (order.athlete || order.commission) {
    lines.push("", "تفاصيل الرياضي");

    if (order.athlete) {
      lines.push(`الرياضي: ${order.athlete.display_name}`);
    }

    if (order.commission) {
      lines.push(
        `نسبة العمولة: ${order.commission.commission_percent}%`,
        `قيمة العمولة: ${formatMoney(
          order.commission.commission_amount,
          order.currency,
        )}`,
      );
    }
  }

  return lines.join("\n");
}

function parseItem(value: unknown): OrderNotificationItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const quantity = number(item.quantity);
  const unitPrice = number(item.unit_price);
  const lineTotal = number(item.line_total);
  const productName = text(item.product_name_snapshot);

  if (
    !productName ||
    quantity === null ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    unitPrice === null ||
    lineTotal === null
  ) {
    return null;
  }

  return {
    product_name_snapshot: productName,
    variant_description_snapshot: text(item.variant_description_snapshot),
    sku_snapshot: text(item.sku_snapshot),
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal,
  };
}

export function parseOrderNotificationPayload(
  value: unknown,
): OrderNotificationPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const orderNumber = payload.order_number;
  const createdAt = text(payload.created_at);
  const currency = text(payload.currency);
  const subtotal = number(payload.subtotal);
  const discountPercent = number(payload.customer_discount_percent_snapshot);
  const discountAmount = number(payload.discount_amount);
  const total = number(payload.total);
  const items = Array.isArray(payload.items)
    ? payload.items
        .map(parseItem)
        .filter((item): item is OrderNotificationItem => item !== null)
    : [];

  if (
    (typeof orderNumber !== "string" && typeof orderNumber !== "number") ||
    !createdAt ||
    !currency ||
    !text(payload.customer_full_name) ||
    !text(payload.customer_phone) ||
    !text(payload.customer_city) ||
    !text(payload.customer_address) ||
    subtotal === null ||
    discountPercent === null ||
    discountAmount === null ||
    total === null ||
    !items.length
  ) {
    return null;
  }

  const athleteValue = payload.athlete;
  const athlete =
    athleteValue && typeof athleteValue === "object" && !Array.isArray(athleteValue)
      ? { display_name: text((athleteValue as Record<string, unknown>).display_name) }
      : null;
  const commissionValue = payload.commission;
  const commissionPercent =
    commissionValue &&
    typeof commissionValue === "object" &&
    !Array.isArray(commissionValue)
      ? number((commissionValue as Record<string, unknown>).commission_percent)
      : null;
  const commissionAmount =
    commissionValue &&
    typeof commissionValue === "object" &&
    !Array.isArray(commissionValue)
      ? number((commissionValue as Record<string, unknown>).commission_amount)
      : null;

  return {
    order_number: orderNumber,
    created_at: createdAt,
    customer_full_name: text(payload.customer_full_name),
    customer_phone: text(payload.customer_phone),
    customer_city: text(payload.customer_city),
    customer_address: text(payload.customer_address),
    customer_notes: text(payload.customer_notes) || null,
    currency,
    subtotal,
    code_snapshot: text(payload.code_snapshot) || null,
    customer_discount_percent_snapshot: discountPercent,
    discount_amount: discountAmount,
    total,
    status: text(payload.status) || "pending",
    items,
    athlete: athlete?.display_name ? athlete : null,
    commission:
      commissionPercent !== null && commissionAmount !== null
        ? {
            commission_percent: commissionPercent,
            commission_amount: commissionAmount,
          }
        : null,
  };
}
