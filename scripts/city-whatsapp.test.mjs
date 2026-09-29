import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeWhatsAppFailure } from "../src/lib/whatsapp-failure.ts";

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

test("Admin retry uses the internal UUID and one explicit camelCase request contract", () => {
  const ordersMigration = read("supabase/migrations/005_orders.sql");
  const outboxMigration = read("supabase/migrations/017_admin_whatsapp_order_outbox.sql");
  const manager = read("src/components/admin/orders-manager.tsx");
  const adminApi = read("src/app/api/admin/orders/whatsapp/route.ts");

  assert.match(ordersMigration, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(ordersMigration, /order_number bigint generated always as identity unique/);
  assert.match(outboxMigration, /order_id uuid not null references public\.orders\(id\)/);
  assert.match(manager, /orderId=\{order\.id\}/);
  assert.match(manager, /body: JSON\.stringify\(\{ orderId \}\)/);
  assert.doesNotMatch(manager, /body: JSON\.stringify\(\{ orderId: order\.order_number \}\)/);
  assert.match(adminApi, /const orderId = text\(requestPayload\.orderId\)/);
  assert.doesNotMatch(adminApi, /\(body as Record<string, unknown>\)\.order_id/);
  assert.match(adminApi, /Object\.keys\(requestPayload\)\.length !== 1/);
});

test("Admin retry validates UUIDs and maps missing jobs to not found before delivery", () => {
  const adminApi = read("src/app/api/admin/orders/whatsapp/route.ts");
  const validation = adminApi.indexOf("!isUuid(orderId)");
  const claim = adminApi.indexOf('"claim_admin_whatsapp_notification"');
  const sender = adminApi.indexOf("await sendWhatsAppOrderNotification(payload)");

  assert.ok(validation > -1 && validation < claim);
  assert.ok(claim > -1 && claim < sender);
  assert.match(adminApi, /claimError\?\.code === "P0002"/);
  assert.match(adminApi, /message\.includes\("not found"\)/);
  assert.match(adminApi, /404/);
  assert.match(adminApi, /\{ p_order_id: orderId \}/);
});

test("Admin retry claims the existing job, never enqueues one, and cannot resend sent jobs", () => {
  const adminApi = read("src/app/api/admin/orders/whatsapp/route.ts");
  const migration = read("supabase/migrations/017_admin_whatsapp_order_outbox.sql");
  const sentGuard = adminApi.indexOf('if (claim.status === "sent")');
  const sender = adminApi.indexOf("await sendWhatsAppOrderNotification(payload)");

  assert.match(adminApi, /authorizeAdminApi\(\)/);
  assert.match(adminApi, /claim_admin_whatsapp_notification/);
  assert.match(adminApi, /complete_admin_whatsapp_notification/);
  assert.doesNotMatch(adminApi, /insert|enqueue_order_whatsapp_notification/);
  assert.match(migration, /unique \(order_id, channel\)/);
  assert.match(migration, /on conflict \(order_id, channel\) do nothing/);
  assert.ok(sentGuard > -1 && sentGuard < sender);
});

test("provider failures are completed as failed and remain retryable", () => {
  const adminApi = read("src/app/api/admin/orders/whatsapp/route.ts");
  const migration = read("supabase/migrations/017_admin_whatsapp_order_outbox.sql");

  assert.match(adminApi, /catch \(error\)[\s\S]*p_success: false/);
  assert.match(adminApi, /p_error: failureReason/);
  assert.match(migration, /set status = 'failed'/);
  assert.match(migration, /if v_job\.status = 'sent'/);
  assert.doesNotMatch(migration, /if v_job\.status = 'failed'[\s\S]*raise exception/);
});

test("Admin sees only allow-listed persisted WhatsApp failure details", () => {
  const ordersPage = read("src/app/admin/orders/page.tsx");
  const manager = read("src/components/admin/orders-manager.tsx");

  assert.match(ordersPage, /sent_at, last_error/);
  assert.match(ordersPage, /sanitizeWhatsAppFailure\(notification\.last_error\)/);
  assert.match(manager, /السبب: \{notification\.last_error\}/);
  assert.equal(
    sanitizeWhatsAppFailure("WhatsApp provider returned HTTP 400."),
    "WhatsApp provider returned HTTP 400.",
  );
  assert.equal(
    sanitizeWhatsAppFailure(new Error("Authorization: Bearer super-secret-token")),
    "WhatsApp provider delivery failed.",
  );
  assert.equal(
    sanitizeWhatsAppFailure('{"error":{"message":"customer +218 secret"}}'),
    "WhatsApp provider delivery failed.",
  );
  assert.doesNotMatch(
    sanitizeWhatsAppFailure("access_token=super-secret-token"),
    /super-secret-token|Authorization|access_token/,
  );
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

test("checkout schedules automatic dispatch only after the trusted order succeeds", () => {
  const checkout = read("src/app/api/checkout/route.ts");
  const dispatcher = read("src/lib/automatic-whatsapp-dispatch.ts");
  const migration = read("supabase/migrations/018_automatic_whatsapp_dispatch.sql");

  assert.match(checkout, /after\(\(\) =>/);
  assert.match(checkout, /dispatchAutomaticWhatsAppOrder\(result\.order_id, idempotencyKey\)/);
  assert.match(checkout, /revalidatePublicCatalog\(\);[\s\S]*after\(/);
  assert.match(dispatcher, /claim_checkout_whatsapp_notification/);
  assert.match(dispatcher, /complete_checkout_whatsapp_notification/);
  assert.match(dispatcher, /sendWhatsAppOrderNotification/);
  assert.match(migration, /checkout_idempotency_key = p_checkout_idempotency_key/);
  assert.match(migration, /admin_notification_outbox/);
  assert.match(migration, /security definer/);
  assert.match(migration, /grant execute .* to anon, authenticated/);
  assert.doesNotMatch(dispatcher, /WHATSAPP_ADMIN_PHONE/);
});

test("WhatsApp dispatch has no customer-facing redirect or client provider call", () => {
  const files = [
    "src/app/api/checkout/route.ts",
    "src/components/checkout/checkout-page.tsx",
    "src/app/checkout/success/page.tsx",
  ];

  for (const file of files) {
    let source = "";
    try {
      source = read(file);
    } catch {
      continue;
    }

    assert.doesNotMatch(source, /wa\.me|api\.whatsapp|graph\.facebook\.com/);
    assert.doesNotMatch(source, /WHATSAPP_ACCESS_TOKEN|WHATSAPP_ADMIN_PHONE/);
  }
});
