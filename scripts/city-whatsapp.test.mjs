import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Libya delivery cities are one curated source and exclude neighbourhood entries", () => {
  const cities = read("src/lib/libya-cities.ts");
  const required = [
    "طرابلس",
    "بنغازي",
    "مصراتة",
    "سرت",
    "سبها",
    "الزاوية",
    "زليتن",
    "الخمس",
    "طبرق",
    "درنة",
    "أجدابيا",
    "البيضاء",
  ];

  for (const city of required) {
    assert.match(cities, new RegExp(city));
  }

  assert.match(cities, /PPLX/);
  assert.doesNotMatch(cities, /حي الأندلس|فشلوم|زاوية الدهماني|سوق الجمعة/);
  assert.match(cities, /findLibyaCity/);
});
test("checkout city uses the searchable local dataset and server validation", () => {
  const checkout = read("src/components/checkout/checkout-page.tsx");
  const route = read("src/app/api/checkout/route.ts");
  const cartPage = read("src/app/cart/page.tsx");

  assert.match(checkout, /LIBYA_CITIES\.map/);
  assert.match(checkout, /list="libya-city-options"/);
  assert.match(checkout, /placeholder="اختر المدينة"/);
  assert.match(checkout, /name="customer_city"[\s\S]*required/);
  assert.match(route, /findLibyaCity/);
  assert.match(route, /اختر مدينة ليبية معتمدة/);
  assert.match(route, /p_customer_city: customerCity/);
  assert.match(cartPage, /searchParams/);
});

test("order outbox is queued transactionally with admin-only retry state", () => {
  const migration = read("supabase/migrations/017_admin_whatsapp_order_outbox.sql");
  const adminApi = read("src/app/api/admin/orders/whatsapp/route.ts");
  const ordersPage = read("src/app/admin/orders/page.tsx");

  assert.match(migration, /create table public\.admin_notification_outbox/);
  assert.match(migration, /unique \(order_id, channel\)/);
  assert.match(migration, /after insert on public\.orders/);
  assert.match(migration, /on conflict \(order_id, channel\) do nothing/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /public\.is_admin\(\)/);
  assert.match(migration, /claim_admin_whatsapp_notification/);
  assert.match(migration, /complete_admin_whatsapp_notification/);
  assert.match(adminApi, /authorizeAdminApi/);
  assert.match(adminApi, /claim_admin_whatsapp_notification/);
  assert.match(adminApi, /complete_admin_whatsapp_notification/);
  assert.match(adminApi, /sendWhatsAppOrderNotification/);
  assert.match(ordersPage, /admin_notification_outbox/);
});

test("WhatsApp sender uses an approved server-side template and authoritative fields", () => {
  const sender = read("src/lib/whatsapp-order-notification.ts");
  const checkout = read("src/app/api/checkout/route.ts");

  for (const field of [
    "customer_full_name",
    "customer_phone",
    "customer_city",
    "customer_address",
    "product_name_snapshot",
    "sku_snapshot",
    "variant_description_snapshot",
    "unit_price",
    "line_total",
    "code_snapshot",
    "customer_discount_percent_snapshot",
    "discount_amount",
    "total",
    "commission_percent",
    "commission_amount",
  ]) {
    assert.match(sender, new RegExp(field));
  }

  assert.match(sender, /WHATSAPP_ACCESS_TOKEN/);
  assert.match(sender, /WHATSAPP_PHONE_NUMBER_ID/);
  assert.match(sender, /WHATSAPP_ADMIN_PHONE/);
  assert.match(sender, /WHATSAPP_ORDER_TEMPLATE_NAME/);
  assert.match(sender, /WHATSAPP_API_VERSION/);
  assert.match(sender, /type: "template"/);
  assert.match(sender, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.doesNotMatch(sender, /NEXT_PUBLIC_|SERVICE_ROLE|service_role/);
  assert.doesNotMatch(checkout, /WHATSAPP_ADMIN_PHONE|WHATSAPP_ACCESS_TOKEN/);
});
