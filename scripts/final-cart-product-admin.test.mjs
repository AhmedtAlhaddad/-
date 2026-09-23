import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("product cards show one-second success feedback only after a successful add", () => {
  const card = read("src/components/products/product-card.tsx");
  const provider = read("src/components/cart/cart-provider.tsx");
  const css = read("src/app/globals.css");

  assert.match(card, /const succeeded = addItem/);
  assert.match(card, /if \(!succeeded\) \{\s*return;/s);
  assert.match(card, /setAdded\(true\)[\s\S]*window\.setTimeout[\s\S]*setAdded\(false\)[\s\S]*1000/s);
  assert.match(card, /if \(feedbackActive\.current\)[\s\S]*feedbackActive\.current = true/s);
  assert.match(card, /added \? "✓" : <PlusIcon/);
  assert.match(card, /added \|\|[\s\S]*!product\.inStock/);
  assert.match(card, /role="status" aria-live="polite"/);
  assert.match(provider, /\) => boolean;/);
  assert.match(provider, /if \(!added\) \{\s*return false;[\s\S]*playAddToCartSound\(\);[\s\S]*return true;/s);
  assert.match(css, /@keyframes product-card-added/);
  assert.match(css, /prefers-reduced-motion[\s\S]*\.product-card-add\.is-added[\s\S]*animation:\s*none/s);
});

test("header cart is a single nowrap row with compact mobile behavior", () => {
  const css = read("src/app/globals.css");
  const header = read("src/components/layout/header.tsx");

  assert.match(css, /\.cart-link\s*\{[^}]*display:\s*inline-flex[^}]*flex-flow:\s*row nowrap[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.cart-link \.desktop-label\s*\{\s*white-space:\s*nowrap/);
  assert.match(css, /\.header-actions\s*\{[^}]*gap:\s*16px/s);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*\.desktop-label\s*\{\s*display:\s*none/s);
  assert.match(header, /<BagIcon \/>[\s\S]*سلة التسوق[\s\S]*<b>\{itemCount\}<\/b>/s);
});

test("discount preview is server-authoritative, stable on focus, and invalidated when inputs change", () => {
  const cart = read("src/components/cart/cart-page.tsx");
  const checkout = read("src/components/checkout/checkout-page.tsx");
  const previewRoute = read("src/app/api/checkout/discount-preview/route.ts");
  const previewMigration = read("supabase/migrations/016_discount_preview.sql");
  const globalCss = read("src/app/globals.css");
  const checkoutCss = read("src/components/checkout/checkout.module.css");

  assert.match(previewRoute, /rpc\("preview_discount"/);
  assert.match(previewMigration, /create function public\.preview_discount/);
  assert.match(previewMigration, /security definer/);
  assert.match(previewMigration, /subtotal_before_discount/);
  assert.match(previewMigration, /discount_amount/);
  assert.match(previewMigration, /subtotal_after_discount/);
  assert.match(previewMigration, /grant execute on function public\.preview_discount\(jsonb, text\) to anon, authenticated/);
  assert.doesNotMatch(previewMigration, /commission_percent|commission_amount|payout/);

  for (const source of [cart, checkout]) {
    assert.match(source, /requestDiscountPreview/);
    assert.match(source, /setPreview\(null\)|setDiscountPreview\(null\)/);
    assert.match(source, /subtotal_before_discount/);
    assert.match(source, /discount_amount/);
    assert.match(source, /subtotal_after_discount/);
    assert.doesNotMatch(source, /commission_percent|commission_amount|payout/);
  }

  assert.match(cart, /previewItems === items/);
  assert.match(checkout, /discountPreviewItems === items/);
  assert.match(cart, /onChange=\{\(event\) => \{[\s\S]*setPreview\(null\)[\s\S]*setMessage\(""\)/s);
  assert.match(checkout, /onChange=\{\(event\) => \{[\s\S]*setDiscountPreview\(null\)[\s\S]*setDiscountMessage\(""\)/s);
  assert.match(checkout, /fetch\("\/api\/checkout"/);
  assert.match(checkout, /name="code"/);

  assert.match(globalCss, /\.discount-input input[\s\S]*border: 1px solid var\(--line\)/s);
  assert.match(globalCss, /\.discount-input input:focus\s*\{[^}]*border-color:/s);
  assert.doesNotMatch(globalCss, /\.discount-input input:focus\s*\{[^}]*border:\s*(?!1px)/s);
  assert.match(globalCss, /\.discount-input input\s*\{[^}]*box-sizing:\s*border-box/s);
  assert.match(globalCss, /\.discount-input input\s*\{[^}]*min-width:\s*0/s);
  assert.match(globalCss, /\.discount-input button\s*\{[^}]*flex:\s*0 0 auto/s);
  assert.match(checkoutCss, /\.discountInput\s*\{[^}]*min-width:\s*0/s);
  assert.match(checkoutCss, /\.discountInput input\s*\{[^}]*box-sizing:\s*border-box[^}]*min-width:\s*0/s);
});

test("the shared form infers internal family and exposes no duplicate type selector", () => {
  const form = read("src/components/admin/product-form.tsx");
  const list = read("src/app/admin/products/page.tsx");
  const createPage = read("src/app/admin/products/new/page.tsx");
  const editApi = read("src/app/api/admin/products/[id]/route.ts");

  assert.doesNotMatch(form, /نوع المنتج|مكمل غذائي عام|واي بروتين|أحماض أمينية BCAA/);
  assert.doesNotMatch(form, /setProductType/);
  assert.match(form, /initialData\?\.product_type \?\?[\s\S]*productKind === "apparel"[\s\S]*"fitness-accessory"[\s\S]*"supplement"/s);
  assert.equal((list.match(/className=\{styles\.addButton\}/g) ?? []).length, 3);
  assert.match(createPage, /requestedType === "apparel" \|\| requestedType === "accessory"/);
  assert.match(editApi, /\.select\("id, product_type"\)/);
  assert.match(editApi, /text\([\s\n]*existingProduct\.product_type/);
});

test("visible categories are dynamic active Supabase categories", () => {
  const createPage = read("src/app/admin/products/new/page.tsx");
  const editPage = read("src/app/admin/products/[id]/edit/page.tsx");
  const form = read("src/components/admin/product-form.tsx");

  for (const page of [createPage, editPage]) {
    assert.match(page, /\.from\("categories"\)[\s\S]*\.select\([\s\S]*"id, slug, name_ar, name_en"[\s\S]*\.eq\("active", true\)/s);
  }
  assert.match(form, /categories\.map/);
  assert.match(form, /value=\{categoryId\}/);
});

test("variant controls and validation are family-specific", () => {
  const form = read("src/components/admin/product-form.tsx");
  const createApi = read("src/app/api/admin/products/route.ts");
  const editApi = read("src/app/api/admin/products/[id]/route.ts");
  const nonSupplementBlock = form.slice(form.indexOf("{!isSupplement && ("));

  assert.match(form, /\{isSupplement && <>[\s\S]*الوزن[\s\S]*عدد الحصص/s);
  assert.match(nonSupplementBlock, /المقاس بالعربي[\s\S]*المقاس بالإنجليزية \(Size\)[\s\S]*اللون بالعربي[\s\S]*اللون بالإنجليزية \(Color\)/s);
  assert.match(nonSupplementBlock, /productKind === "apparel" \|\| accessoryUsesSize/);
  assert.match(form, /productKind !== "apparel"[\s\S]*النكهة بالعربي/s);
  assert.match(form, /productKind === "accessory"[\s\S]*هذا الإكسسوار يحتاج إلى مقاس/s);
  for (const api of [createApi, editApi]) {
    assert.match(api, /productType === "apparel"[\s\S]*size_label_ar[\s\S]*attributes\.color_ar/s);
    assert.doesNotMatch(api, /productType === "supplement"[\s\S]{0,120}size_label/);
  }
});

test("product removal removes only after success and refreshes the current catalog", () => {
  const action = read("src/components/admin/product-removal-action.tsx");
  const page = read("src/app/admin/products/page.tsx");
  const route = read("src/app/api/admin/products/[id]/route.ts");
  const migration = read("supabase/migrations/015_true_product_deletion.sql");

  assert.doesNotMatch(action, /method:\s*"GET"/);
  assert.match(action, /window\.confirm\(message\)/);
  assert.match(action, /method:\s*"DELETE"/);
  assert.match(action, /message = .*productName/);
  assert.match(page, /\.neq\(\s*"status",\s*"archived",?\s*\)/s);
  assert.match(page, /data-product-row-id=\{\s*product\.id\s*\}/s);
  assert.match(action, /document\s*\.querySelector[\s\S]*data-product-row-id/);
  assert.match(action, /\?\.remove\(\)/);
  const removeIndex = action.indexOf("?.remove()");
  const failureIndex = action.indexOf(
    "throw new Error(await responseError(deleteResponse));",
  );
  assert.ok(
    failureIndex < removeIndex && removeIndex < action.indexOf("router.refresh()"),
    "the successful deletion must remove the visible row before refreshing",
  );
  assert.match(route, /"remove_admin_product"/);
  assert.match(migration, /select product\.slug[\s\S]*for update;/s);
  assert.match(migration, /from public\.product_variants variant[\s\S]*for update;/s);
  assert.match(migration, /security invoker/);
});

test("true deletion cleans current catalog rows while preserving every historical ledger", () => {
  const migration = read("supabase/migrations/015_true_product_deletion.sql");

  assert.match(migration, /delete from public\.discount_code_products/);
  assert.match(migration, /delete from public\.product_training_goals/);
  assert.match(migration, /delete from public\.product_images/);
  assert.match(migration, /delete from public\.product_variants/);
  assert.match(migration, /delete from public\.products/);
  assert.doesNotMatch(migration, /delete from public\.(orders|order_items|commissions|commission_payouts|commission_payout_items|inventory_movements)/);
  assert.match(migration, /on delete set null/);
  assert.match(migration, /sku_snapshot/);
  assert.match(migration, /prevent_inventory_movement_mutation/);
  assert.match(migration, /prevent_order_item_mutation/);
});

test("inventory snapshots are backfilled once while append-only protections remain enforced", () => {
  const migration = read("supabase/migrations/015_true_product_deletion.sql");

  assert.match(
    migration,
    /disable trigger inventory_movements_immutable[\s\S]*update public\.inventory_movements[\s\S]*enable trigger inventory_movements_immutable/s,
  );
  assert.match(
    migration,
    /movement\.sku_snapshot is null[\s\S]*length\(btrim\(movement\.sku_snapshot\)\) = 0/s,
  );
  assert.match(migration, /pg_trigger_depth\(\) > 1/);
  assert.match(migration, /before insert on public\.inventory_movements/);
  assert.match(migration, /before update or delete on public\.inventory_movements/);
  assert.match(migration, /raise exception '% is an append-only historical table'/);
  assert.match(migration, /on delete set null/);
  assert.doesNotMatch(migration, /disable trigger all/i);
});

test("existing immutable order, commission, payout, and athlete history remains protected", () => {
  const orders = read("supabase/migrations/005_orders.sql");
  const commissions = read("supabase/migrations/006_commissions.sql");
  const athletesApi = read("src/app/api/admin/athletes/route.ts");

  assert.match(orders, /product_name_snapshot text not null/);
  assert.match(orders, /sku_snapshot text not null/);
  assert.match(orders, /order_items_immutable/);
  assert.match(commissions, /commission_amount numeric\(12,3\) not null/);
  assert.match(commissions, /commissions_protect_history_and_transition/);
  assert.match(commissions, /commission_payouts_immutable/);
  assert.match(commissions, /commission_payout_items_immutable/);
  assert.doesNotMatch(athletesApi, /\.delete\(|export async function DELETE/);
});

test("removal RPCs use admin authorization, restricted grants, and no anonymous mutation", () => {
  const migration = read("supabase/migrations/015_true_product_deletion.sql");

  assert.match(migration, /security invoker[\s\S]*set search_path = ''/s);
  assert.equal((migration.match(/if not public\.is_admin\(\)/g) ?? []).length, 1);
  assert.match(migration, /revoke all on function public\.remove_admin_product\(uuid\) from public/);
  assert.match(migration, /grant execute on function public\.remove_admin_product\(uuid\) to authenticated/);
  assert.doesNotMatch(migration, /grant execute[\s\S]{0,100}\bto anon\b/);
  assert.doesNotMatch(migration, /service_role/i);
});

test("archived product workflow is removed from normal Admin Products UX", () => {
  const page = read("src/app/admin/products/page.tsx");
  const form = read("src/components/admin/product-form.tsx");
  const editPage = read("src/app/admin/products/[id]/edit/page.tsx");

  assert.doesNotMatch(page, /archivedResult/);
  assert.doesNotMatch(page, /id:\s*"archived"/);
  assert.doesNotMatch(form, /option value="archived"/);
  assert.match(page, /product\.status !== "archived"/);
  assert.match(editPage, /productResult\.data\.status === "archived"/);
});

test("admin section rhythm is exactly 24px desktop and 16px mobile without overlap hacks", () => {
  const dashboard = read("src/components/admin/admin-dashboard.module.css");
  const products = read("src/components/admin/admin-products.module.css");

  for (const css of [dashboard, products]) {
    assert.match(css, /--admin-section-gap:\s*24px/);
    assert.match(css, /gap:\s*var\(--admin-section-gap\)/);
    assert.match(css, /@media[\s\S]*--admin-section-gap:\s*16px/s);
    assert.doesNotMatch(css, /margin-(?:top|bottom):\s*-/);
  }
  assert.match(products, /\.createActions\s*\{[^}]*flex-wrap:\s*wrap[^}]*gap:\s*10px 12px/s);
});
