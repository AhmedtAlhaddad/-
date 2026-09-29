import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

import {
  createWhatsAppMetaApiError,
  parseWhatsAppFailure,
  parseWhatsAppSuccessMessageId,
  sanitizeWhatsAppFailure,
} from "../src/lib/whatsapp-failure.ts";
import { isUuid } from "../src/lib/uuid.ts";

const read = (path) => readFileSync(path, "utf8");
const REPORTED_ORDER_UUID = "b34c67d1-57e5-4ae8-a724-e8db8727c788";

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

test("reported Supabase UUID v4 passes canonical retry validation", () => {
  const adminApi = read("src/app/api/admin/orders/whatsapp/route.ts");

  assert.equal(isUuid(REPORTED_ORDER_UUID), true);
  assert.equal(isUuid("2"), false);
  assert.equal(isUuid("b34c67d1-57e5-4ae8-a724-e8db8727c78"), false);
  assert.equal(isUuid("b34c67d1-57e5-4ae8-z724-e8db8727c788"), false);
  assert.match(adminApi, /function errorResponse\(error: string, status = 400/);
  assert.match(
    adminApi,
    /if \(Object\.keys\(requestPayload\)\.length !== 1 \|\| !isUuid\(orderId\)\) \{\s*return errorResponse\("معرّف الطلب غير صالح\."\);/,
  );
  assert.match(adminApi, /const orderId = text\(requestPayload\.orderId\)/);
  assert.doesNotMatch(adminApi, /requestPayload\.order_id/);
  assert.doesNotMatch(
    adminApi,
    /\[89ab\]\[0-9a-f\]\{12\}/,
  );
});

test("Admin retry validates UUIDs and maps missing jobs to not found before delivery", () => {
  const adminApi = read("src/app/api/admin/orders/whatsapp/route.ts");
  const validation = adminApi.indexOf("!isUuid(orderId)");
  const orderLookup = adminApi.indexOf('.from("orders")');
  const missingOrder = adminApi.indexOf("if (!order)");
  const claim = adminApi.indexOf('"claim_admin_whatsapp_notification"');
  const sender = adminApi.indexOf("await sendWhatsAppOrderNotification(payload)");

  assert.ok(validation > -1 && validation < orderLookup);
  assert.ok(orderLookup < missingOrder && missingOrder < claim);
  assert.ok(claim > -1 && claim < sender);
  assert.match(
    adminApi.slice(missingOrder, claim),
    /return errorResponse\("الطلب غير موجود\."\s*,\s*404\)/,
  );
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
  assert.match(manager, /parseWhatsAppFailure\(notification\.last_error\)/);
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

test("safe documented Meta error fields are persisted and displayed", () => {
  const manager = read("src/components/admin/orders-manager.tsx");
  const providerError = createWhatsAppMetaApiError(400, {
    error: {
      code: 132001,
      error_subcode: 2494010,
      type: "OAuthException",
      message: "Template name does not exist in the translation",
      error_data: {
        details: "The template new_store_order is unavailable for ar",
        messaging_product: "whatsapp",
        ignored_raw_field: "raw-response-marker",
      },
      fbtrace_id: "provider-trace-must-not-be-stored",
    },
  });
  const stored = sanitizeWhatsAppFailure(providerError);
  const parsed = parseWhatsAppFailure(stored);

  assert.equal(parsed.kind, "meta");
  assert.deepEqual(parsed.diagnostic, {
    status: 400,
    code: 132001,
    error_subcode: 2494010,
    type: "OAuthException",
    message: "Template name does not exist in the translation",
    details: "The template new_store_order is unavailable for ar",
    messaging_product: "whatsapp",
  });
  assert.ok(stored.length <= 480);
  assert.doesNotMatch(stored, /raw-response-marker|provider-trace/);
  assert.match(manager, /رمز Meta/);
  assert.match(manager, /الرمز الفرعي/);
  assert.match(manager, /failure\.diagnostic\.details/);
  assert.match(manager, /failure\.diagnostic\.messaging_product/);
});

test("Meta diagnostics redact credentials, headers, and customer PII", () => {
  const providerError = createWhatsAppMetaApiError(
    400,
    {
      error: {
        code: 100,
        message:
          "Authorization: Bearer token-super-secret for Ahmad +218912345678",
        error_data: {
          details:
            "access_token=token-super-secret; Ahmad; Tripoli private address",
        },
      },
      request_body: "full-raw-response-must-not-survive",
    },
    ["token-super-secret", "+218912345678", "Ahmad", "Tripoli private address"],
  );
  const stored = sanitizeWhatsAppFailure(providerError);

  assert.doesNotMatch(
    stored,
    /token-super-secret|Authorization|Bearer|218912345678|Ahmad|Tripoli private address|full-raw-response/,
  );
  assert.match(stored, /\[redacted\]/);
});

test("only a valid Meta wamid is accepted as successful delivery", () => {
  const sender = read("src/lib/whatsapp-order-notification.ts");
  const adminApi = read("src/app/api/admin/orders/whatsapp/route.ts");
  const senderCall = adminApi.indexOf("await sendWhatsAppOrderNotification(payload)");
  const completeSuccess = adminApi.indexOf("p_success: true");

  assert.equal(
    parseWhatsAppSuccessMessageId({
      messaging_product: "whatsapp",
      messages: [{ id: "wamid.HBgMTestMessageId" }],
    }),
    "wamid.HBgMTestMessageId",
  );
  assert.equal(parseWhatsAppSuccessMessageId({ messages: [] }), null);
  assert.equal(
    parseWhatsAppSuccessMessageId({ messages: [{ id: "not-a-wamid" }] }),
    null,
  );
  assert.equal(parseWhatsAppSuccessMessageId("raw provider response"), null);
  assert.match(sender, /parseWhatsAppSuccessMessageId\(responseBody\)/);
  assert.match(sender, /if \(!messageId\)[\s\S]*INVALID_SUCCESS_RESPONSE/);
  assert.ok(senderCall > -1 && senderCall < completeSuccess);
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
  assert.match(sender, /requiredConfig\("WHATSAPP_ORDER_TEMPLATE_LANGUAGE"\)/);
  assert.match(sender, /WHATSAPP_API_VERSION/);
  assert.match(sender, /type: "template"/);
  assert.match(
    sender,
    /components: \[\s*\{\s*type: "body",\s*parameters: \[\{ type: "text", text: summary \}\],\s*\},\s*\]/,
  );
  assert.match(sender, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(
    sender,
    /process\.env\.NODE_ENV === "development"[\s\S]*subcode: error_subcode/,
  );
  assert.doesNotMatch(sender, /console\.error\([^\n]*(responseBody|accessToken|summary)/);
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
