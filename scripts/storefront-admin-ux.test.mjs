import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("header actions have distinct motion, spacing, sticky behavior, and reduced-motion protection", () => {
  const css = read("src/app/globals.css");

  assert.match(css, /\.announcement\s*\{[^}]*position:\s*static/s);
  assert.match(css, /\.site-header\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/s);
  assert.match(css, /\.header-actions\s*\{[^}]*gap:\s*16px/s);
  assert.match(css, /\.search-link\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(css, /\.cart-link\s*\{[^}]*border-radius:\s*9px/s);
  assert.match(css, /\.search-link:hover[^}]*transform:\s*translateY\(-2px\)/s);
  assert.match(css, /\.cart-link:hover[^}]*transform:\s*translateY\(-2px\)/s);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.search-link:hover[\s\S]*transform:\s*none/);
});

test("shared storefront shell supplies cached dynamic categories to every header", () => {
  const chrome = read("src/components/layout/footer.tsx");
  const cache = read("src/lib/supabase/catalog-cache.ts");
  const storefrontPages = [
    "src/app/page.tsx",
    "src/app/shop/page.tsx",
    "src/app/search/page.tsx",
    "src/app/cart/page.tsx",
    "src/app/checkout/page.tsx",
    "src/app/products/[slug]/page.tsx",
  ];

  assert.match(chrome, /await getNavigationCategories\(\)/);
  assert.match(chrome, /<Header categories=\{categories\}/);
  assert.match(cache, /cachedNavigationCategories[\s\S]*PUBLIC_CATALOG_CACHE_TAG/);
  for (const page of storefrontPages) {
    assert.match(read(page), /StoreChrome/);
  }
});

test("navigation dropdowns are dynamically and correctly scoped", () => {
  const header = read("src/components/layout/header.tsx");
  const catalog = read("src/lib/catalog-query.ts");

  assert.match(header, /categories\s*\.filter\(\(category\) => category\.supplement\)/);
  assert.match(header, /categories\s*\.filter\(\(category\) => category\.accessory\)/);
  assert.match(header, /items:\s*categories\.map/);
  assert.match(header, /items:\s*goalOptions\.map/);
  assert.match(header, /href:\s*"\/shop\?type=supplements"/);
  assert.match(header, /href:\s*"\/shop\?type=accessories"/);
  assert.match(header, /aria-expanded=\{expanded\}/);
  assert.equal((catalog.match(/label:\s*"/g) ?? []).length, 3);
});

test("cart sound follows a valid explicit cart update and is not effect-driven", () => {
  const provider = read("src/components/cart/cart-provider.tsx");
  const sound = read("src/lib/cart-sound.ts");
  const addStart = provider.indexOf("const addItem =");
  const update = provider.indexOf("updateCart", addStart);
  const play = provider.indexOf("playAddToCartSound()", addStart);

  assert.ok(addStart >= 0 && update > addStart && play > update);
  assert.doesNotMatch(provider.slice(addStart, play + 30), /useEffect/);
  assert.match(sound, /new window\.AudioContext\(\)/);
  assert.match(sound, /0\.025/);
  assert.match(sound, /oscillator\.stop\(now \+ 0\.12\)/);
});

test("popular searches are data-backed and analytics storage is aggregate-only", () => {
  const search = read("src/components/search/search-page.tsx");
  const page = read("src/app/search/page.tsx");
  const route = read("src/app/api/search-analytics/route.ts");
  const migration = read("supabase/migrations/013_search_analytics_and_catalog_filters.sql");

  assert.doesNotMatch(search, /const\s+(popular|recentDefault)\s*=/);
  assert.match(search, /popularSearches\.map/);
  assert.match(page, /getPopularSearchTerms\(\)/);
  assert.match(route, /\.rpc\("record_storefront_search"/);
  assert.match(migration, /normalized_term text primary key/);
  assert.match(migration, /search_count bigint not null/);
  assert.match(migration, /storefront_search_terms_popular_idx/);
  assert.doesNotMatch(migration, /\b(user_id|email|ip_address|fingerprint|device_id)\b/i);
  assert.match(migration, /revoke all on table public\.storefront_search_terms from public, anon, authenticated/);
  assert.match(migration, /security definer[\s\S]*set search_path = ''[\s\S]*record_storefront_search/s);
  assert.match(migration, /list_popular_storefront_searches[\s\S]*security invoker/s);
});

test("search promotion uses the exact approved image and canonical supplements link", () => {
  const search = read("src/components/search/search-page.tsx");
  const config = read("next.config.ts");
  const exactImage = "https://cdn.mos.cms.futurecdn.net/crNhvY7v5xtBGShFW8ZXV8-1024-80.jpg.webp";

  assert.ok(search.includes(exactImage));
  assert.match(search, /<Link className="search-promo" href="\/shop\?type=supplements">/);
  assert.match(search, /<strong>تسوق الآن<\/strong>/);
  assert.match(search, /<span>اكتشف المزيد<\/span>/);
  assert.match(config, /hostname:\s*"cdn\.mos\.cms\.futurecdn\.net"/);
});

test("admin dashboard removes staging disclosure and provides the centered storefront action", () => {
  const page = read("src/app/admin/page.tsx");
  const css = read("src/components/admin/admin-dashboard.module.css");

  assert.doesNotMatch(page, /بيئة Staging/);
  assert.match(page, /href="\/"[\s\S]*عرض المتجر/);
  assert.match(css, /\.storeAction\s*\{[^}]*place-items:\s*center/s);
  assert.match(css, /\.storeButton\s*\{[^}]*background:\s*linear-gradient/s);
});

test("products admin exposes the three configured create flows and type-specific fields", () => {
  const page = read("src/app/admin/products/page.tsx");
  const form = read("src/components/admin/product-form.tsx");
  const apiCreate = read("src/app/api/admin/products/route.ts");
  const apiEdit = read("src/app/api/admin/products/[id]/route.ts");

  assert.equal((page.match(/className=\{styles\.addButton\}/g) ?? []).length, 3);
  for (const [kind, label] of [
    ["supplement", "إضافة مكمل"],
    ["apparel", "إضافة ملابس"],
    ["accessory", "إضافة إكسسوار"],
  ]) {
    assert.ok(page.includes(`/admin/products/new?type=${kind}`));
    assert.ok(page.includes(label));
  }
  assert.match(form, /productKindFromType\(initialData\.product_type\)/);
  assert.match(form, /\{isSupplement && <div className=\{styles\.grid2\}>/);
  assert.match(form, /\{isSupplement && <fieldset className=\{styles\.goalFieldset\}>/);
  assert.match(form, /productKind === "accessory" && \(/);
  assert.match(form, /هذا الإكسسوار يحتاج إلى مقاس/);
  assert.match(form, /productKind === "apparel"[\s\S]*تركيبة لون ومقاس/);
  assert.match(read("src/lib/supabase/catalog.ts"), /\[flavor\?\.trim\(\), color, size\?\.trim\(\)\]/);
  assert.match(apiCreate, /productType === "apparel"[\s\S]*attributes\.color_ar/s);
  assert.match(apiEdit, /productType === "apparel"[\s\S]*attributes\.color_ar/s);
});

test("admin product terminology is Arabic-first", () => {
  const form = read("src/components/admin/product-form.tsx");

  for (const label of [
    "الرابط المختصر (Slug)",
    "شارة المنتج (Badge)",
    "أبرز المميزات (Highlights)",
    "رمز المخزون (SKU)",
    "الخيار / النسخة (Variant)",
  ]) {
    assert.ok(form.includes(label));
  }
});

test("brand filtering is active-data-backed and storefront pagination sizes are preserved", () => {
  const catalog = read("src/lib/supabase/catalog.ts");
  const query = read("src/lib/catalog-query.ts");
  const shop = read("src/app/shop/page.tsx");
  const search = read("src/components/search/search-page.tsx");
  const storefrontFiles = [
    read("src/components/home/brand-strip.tsx"),
    shop,
    search,
    read("src/components/shop/shop-page.tsx"),
  ].join("\n");

  assert.match(catalog, /\.from\("brands"\)[\s\S]*\.eq\([\s\n]*"active",[\s\n]*true/s);
  assert.match(catalog, /p_brand_slugs/);
  assert.match(query, /params\.append\("brand", brand\)/);
  assert.match(shop, /areBrandParamsCanonical/);
  assert.doesNotMatch(storefrontFiles, /Optimum Nutrition|Optimum|أوبتيموم/i);
  assert.match(query, /SHOP_PAGE_SIZE = 24/);
  assert.match(query, /SEARCH_PAGE_SIZE = 20/);
});

test("homepage large images use high-quality optimized rendering and footer developer phone is current", () => {
  const home = read("src/components/home/home-sections.tsx");
  const footer = read("src/components/layout/footer.tsx");

  assert.match(home, /src="\/images\/hero-athlete\.jpg"[\s\S]*quality=\{90\}/);
  assert.equal((home.match(/quality=\{90\}/g) ?? []).length, 2);
  assert.match(home, /sizes="100vw"/);
  assert.match(home, /sizes="\(max-width: 700px\) 100vw, 33vw"/);
  assert.match(footer, /tel:0918063993/);
  assert.match(footer, />0918063993</);
  assert.doesNotMatch(footer, /0919063993/);
});
