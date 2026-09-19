create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) > 0),
  profile_image_path text,
  phone text,
  email text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  active boolean not null default true,
  customer_discount_percent numeric(5,2) not null check (customer_discount_percent between 0 and 100),
  athlete_id uuid references public.athletes(id) on delete restrict,
  athlete_commission_percent numeric(5,2) not null check (athlete_commission_percent between 0 and 100),
  scope_type text not null check (scope_type in ('global', 'category', 'product')),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  minimum_subtotal numeric(12,3) check (minimum_subtotal is null or minimum_subtotal >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (athlete_id is not null or athlete_commission_percent = 0),
  check (customer_discount_percent > 0 or athlete_commission_percent > 0),
  check (usage_limit is null or redemption_count <= usage_limit)
);

create table public.discount_code_categories (
  discount_code_id uuid not null references public.discount_codes(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (discount_code_id, category_id)
);

create table public.discount_code_products (
  discount_code_id uuid not null references public.discount_codes(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (discount_code_id, product_id)
);

create index athletes_active_idx on public.athletes (active, created_at desc);
create index discount_codes_athlete_id_idx on public.discount_codes (athlete_id) where athlete_id is not null;
create index discount_codes_validation_idx on public.discount_codes (code, active, starts_at, ends_at);
create index discount_code_categories_category_idx on public.discount_code_categories (category_id, discount_code_id);
create index discount_code_products_product_idx on public.discount_code_products (product_id, discount_code_id);

create trigger athletes_set_updated_at before update on public.athletes
for each row execute function public.set_updated_at();
create trigger discount_codes_set_updated_at before update on public.discount_codes
for each row execute function public.set_updated_at();

create or replace function public.validate_discount_scope_target()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_scope_type text;
  v_expected_scope text;
begin
  select scope_type into v_scope_type
  from public.discount_codes where id = new.discount_code_id;

  v_expected_scope := case tg_table_name
    when 'discount_code_categories' then 'category'
    when 'discount_code_products' then 'product'
  end;

  if v_scope_type is distinct from v_expected_scope then
    raise exception 'Discount-code target does not match scope_type %', v_scope_type using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger discount_code_category_scope_validate
before insert or update on public.discount_code_categories
for each row execute function public.validate_discount_scope_target();
create trigger discount_code_product_scope_validate
before insert or update on public.discount_code_products
for each row execute function public.validate_discount_scope_target();

create or replace function public.protect_discount_scope_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.scope_type is distinct from old.scope_type and (
    exists (select 1 from public.discount_code_categories where discount_code_id = old.id)
    or exists (select 1 from public.discount_code_products where discount_code_id = old.id)
  ) then
    raise exception 'Remove existing discount-code targets before changing scope_type' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger discount_codes_protect_scope_change
before update of scope_type on public.discount_codes
for each row execute function public.protect_discount_scope_change();

comment on table public.discount_codes is 'Private management table. Admins explicitly set independent customer-discount and athlete-commission percentages and choose global/category/product scope.';
comment on column public.discount_codes.redemption_count is 'Locked and incremented by submit_order to enforce usage_limit safely under concurrency.';
