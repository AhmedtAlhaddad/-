create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  sku text not null check (length(btrim(sku)) > 0),
  flavor_ar text,
  flavor_en text,
  weight_value numeric(10,3) check (weight_value is null or weight_value > 0),
  weight_unit text check (weight_unit is null or weight_unit in ('g', 'kg', 'ml', 'l', 'capsule', 'tablet', 'piece')),
  size_label_ar text,
  size_label_en text,
  servings integer check (servings is null or servings > 0),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  price numeric(12,3) not null check (price >= 0),
  compare_at_price numeric(12,3) check (compare_at_price is null or compare_at_price >= price),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, product_id),
  check ((weight_value is null) = (weight_unit is null))
);

create unique index product_variants_sku_ci_uidx on public.product_variants (lower(sku));
create index product_variants_product_id_idx on public.product_variants (product_id, active, sort_order);
create index product_variants_sellable_idx on public.product_variants (active, stock_quantity) where active = true;

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid,
  storage_path text,
  external_url text,
  alt_text_ar text,
  alt_text_en text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_images_variant_product_fk
    foreign key (variant_id, product_id)
    references public.product_variants(id, product_id)
    on delete cascade,
  check (num_nonnulls(storage_path, external_url) = 1),
  check (storage_path is null or length(btrim(storage_path)) > 0),
  check (external_url is null or external_url ~ '^https://')
);

create index product_images_product_order_idx on public.product_images (product_id, sort_order, created_at);
create index product_images_variant_order_idx on public.product_images (variant_id, sort_order, created_at) where variant_id is not null;
create unique index product_images_one_global_primary_uidx
  on public.product_images (product_id) where variant_id is null and is_primary = true;
create unique index product_images_one_variant_primary_uidx
  on public.product_images (variant_id) where variant_id is not null and is_primary = true;

create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();
create trigger product_images_set_updated_at before update on public.product_images
for each row execute function public.set_updated_at();

comment on column public.product_variants.attributes is 'Sparse future dimensions for fitness accessories such as color or material; core flavor/weight/size fields remain queryable columns.';
comment on table public.product_images is 'variant_id NULL means a global product image; a variant image must reference a variant of the same product.';
