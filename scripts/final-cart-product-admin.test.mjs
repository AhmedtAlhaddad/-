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

test("product removal is previewed but decided again by the trusted database function", () => {
  const action = read("src/components/admin/product-removal-action.tsx");
  const route = read("src/app/api/admin/products/[id]/route.ts");
  const migration = read("supabase/migrations/014_safe_product_removal.sql");

  assert.match(action, /method:\s*"GET"/);
  assert.match(action, /window\.confirm\(message\)/);
  assert.match(action, /method:\s*"DELETE"/);
  assert.match(action, /الطلبات ومبالغ العمولات والمدفوعات والسجلات التاريخية محفوظة/);
  assert.match(route, /"get_admin_product_removal_plan"/);
  assert.match(route, /"remove_admin_product"/);
  assert.match(migration, /select p\.slug[\s\S]*for update;/s);
  assert.match(migration, /from public\.product_variants pv[\s\S]*for update;/s);
  assert.match(migration, /if v_has_order_history[\s\S]*or v_has_inventory_history[\s\S]*or v_has_stored_images then/s);
});

test("retirement disables new sales while hard delete cleans only safe operational rows", () => {
  const migration = read("supabase/migrations/014_safe_product_removal.sql");

  assert.match(migration, /set status = 'archived',[\s\n]*featured = false/);
  assert.match(migration, /update public\.product_variants[\s\S]*set active = false/s);
  assert.match(migration, /delete from public\.discount_code_products/);
  assert.match(migration, /delete from public\.product_training_goals/);
  assert.match(migration, /delete from public\.product_images/);
  assert.match(migration, /delete from public\.product_variants/);
  assert.match(migration, /delete from public\.products/);
  assert.doesNotMatch(migration, /delete from public\.(orders|order_items|commissions|commission_payouts|commission_payout_items|inventory_movements)/);
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
  const migration = read("supabase/migrations/014_safe_product_removal.sql");

  assert.match(migration, /security definer[\s\S]*set search_path = ''/s);
  assert.equal((migration.match(/if not public\.is_admin\(\)/g) ?? []).length, 2);
  assert.match(migration, /revoke all on function public\.remove_admin_product\(uuid\) from public/);
  assert.match(migration, /grant execute on function public\.remove_admin_product\(uuid\) to authenticated/);
  assert.doesNotMatch(migration, /grant execute[\s\S]{0,100}\bto anon\b/);
  assert.doesNotMatch(migration, /service_role/i);
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
