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
) {
  const lines = [
    `طلب جديد #${String(order.order_number)}`,
    `التاريخ: ${formatDate(order.created_at)}`,
    "",
    "بيانات العميل",
    `الاسم: ${order.customer_full_name}`,
    `الهاتف: ${order.customer_phone}`,
    `المدينة: ${order.customer_city}`,
    `العنوان: ${order.customer_address}`,
  ];

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
      `الإجمالي: ${formatMoney(item.line_total, order.currency)}`,
      "",
    );
  });

  lines.push(
    "تفاصيل السعر",
    `قبل الخصم: ${formatMoney(order.subtotal, order.currency)}`,
    `الكود: ${order.code_snapshot ?? "لا يوجد"}`,
  );

  if (order.code_snapshot) {
    lines.push(
      `خصم العميل: ${order.customer_discount_percent_snapshot}%`,
      `قيمة الخصم: ${formatMoney(order.discount_amount, order.currency)}`,
    );
  }

  lines.push(
    `الإجمالي النهائي: ${formatMoney(order.total, order.currency)}`,
    `حالة الطلب: ${order.status}`,
  );

  if (order.athlete && order.commission) {
    lines.push(
      "",
      "تفاصيل الرياضي",
      `الرياضي: ${order.athlete.display_name}`,
      `نسبة العمولة: ${order.commission.commission_percent}%`,
      `قيمة العمولة: ${formatMoney(
        order.commission.commission_amount,
        order.currency,
      )}`,
    );
  }

  return lines.join("\n");
}

function requiredConfig(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`WhatsApp configuration is missing: ${name}`);
  }

  return value;
}

export async function sendWhatsAppOrderNotification(
  order: OrderNotificationPayload,
) {
  const accessToken = requiredConfig("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requiredConfig("WHATSAPP_PHONE_NUMBER_ID");
  const adminPhone = requiredConfig("WHATSAPP_ADMIN_PHONE");
  const templateName = requiredConfig("WHATSAPP_ORDER_TEMPLATE_NAME");
  const apiVersion = requiredConfig("WHATSAPP_API_VERSION");
  const languageCode = process.env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE?.trim() || "ar";
  const summary = buildOrderNotificationSummary(order);
  const timeout = AbortSignal.timeout(8_000);

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: adminPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: summary }],
            },
          ],
        },
      }),
      signal: timeout,
    },
  );

  if (!response.ok) {
    throw new Error(`WhatsApp provider returned HTTP ${response.status}.`);
  }
}
