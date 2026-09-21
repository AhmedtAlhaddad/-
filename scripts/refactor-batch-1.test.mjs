import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  migration011,
  migration012,
  checkoutRoute,
  checkoutPage,
  createProductRoute,
  updateProductRoute,
] = await Promise.all([
  readFile("supabase/migrations/011_product_goals_and_content.sql", "utf8"),
  readFile("supabase/migrations/012_commerce_transactions.sql", "utf8"),
  readFile("src/app/api/checkout/route.ts", "utf8"),
  readFile("src/components/checkout/checkout-page.tsx", "utf8"),
  readFile("src/app/api/admin/products/route.ts", "utf8"),
  readFile("src/app/api/admin/products/[id]/route.ts", "utf8"),
]);

test("checkout retries have a database-backed idempotency boundary", () => {
  assert.match(migration012, /unique \(checkout_idempotency_key\)/);
  assert.match(migration012, /pg_advisory_xact_lock\(hashtextextended\(p_idempotency_key::text, 0\)\)/);
  assert.match(migration012, /checkout_request_fingerprint <> v_request_fingerprint/);
  assert.ok(
    migration012.indexOf("where o.checkout_idempotency_key = p_idempotency_key") <
      migration012.indexOf("insert into public.orders"),
    "idempotent replay must be checked before a new order is inserted",
  );
  assert.match(checkoutPage, /idempotencyKey\.current \?\?= crypto\.randomUUID\(\)/);
  assert.match(checkoutRoute, /p_idempotency_key: idempotencyKey/);
});

test("trusted checkout rejects oversized payloads", () => {
  assert.match(migration012, /jsonb_array_length\(p_items\) > 100/);
  assert.match(migration012, /length\(coalesce\(p_customer_full_name, ''\)\) > 160/);
  assert.match(migration012, /length\(coalesce\(p_customer_address, ''\)\) > 500/);
  assert.match(migration012, /length\(p_customer_notes\) > 2000/);
  assert.match(migration012, /Aggregated item quantity exceeds the accepted limit/);
});

test("product routes delegate all related writes to one transactional RPC", () => {
  assert.match(createProductRoute, /\.rpc\(\s*"create_admin_product"/);
  assert.match(updateProductRoute, /\.rpc\(\s*"update_admin_product"/);
  assert.doesNotMatch(createProductRoute, /\.from\("products"\)\s*\.insert/);
  assert.doesNotMatch(updateProductRoute, /\.from\("products"\)\s*\.update/);

  for (const functionName of ["create_admin_product", "update_admin_product"]) {
    const start = migration012.indexOf(`create function public.${functionName}`);
    assert.notEqual(start, -1, `${functionName} must exist`);
    const body = migration012.slice(start, migration012.indexOf("$$;", start));
    assert.match(body, /perform public\.set_product_training_goals/);
    assert.match(body, /perform public\.adjust_inventory/);
    assert.doesNotMatch(body, /exception\s+when/i);
  }
});

test("migration 011 reports unmapped goals before backfill and bounds raw content", () => {
  const preflight = migration011.indexOf("Unmapped legacy products.training_goal values");
  const backfill = migration011.indexOf("insert into public.product_training_goals");

  assert.ok(preflight > -1 && preflight < backfill);
  assert.match(migration011, /length\(nutrition_facts\) <= 10000/);
  assert.match(migration011, /length\(usage_instructions\) <= 10000/);
  assert.doesNotMatch(migration011, /null::text as training_goal/);
});
