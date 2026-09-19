-- Phase 2A: local architecture only. Do not apply to a remote project without review.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_ar text not null check (length(btrim(name_ar)) > 0),
  name_en text,
  logo_path text,
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_ar text not null check (length(btrim(name_ar)) > 0),
  name_en text,
  description_ar text,
  image_path text,
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_ar text not null check (length(btrim(name_ar)) > 0),
  name_en text,
  short_description_ar text,
  full_description_ar text,
  brand_id uuid not null references public.brands(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  product_type text,
  training_goal text,
  highlights jsonb not null default '[]'::jsonb check (jsonb_typeof(highlights) = 'array'),
  badge_label_ar text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_brand_id_idx on public.products (brand_id);
create index products_category_id_idx on public.products (category_id);
create index products_storefront_idx on public.products (status, featured, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger brands_set_updated_at before update on public.brands
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

comment on table public.profiles is 'Database-authoritative application roles; admin access never depends on a browser boolean.';
comment on column public.products.slug is 'Stable customer-facing URL identifier. Rename only through an intentional SEO migration.';
comment on column public.products.highlights is 'Ordered JSON string array for concise storefront benefit bullets; not a generic attributes engine.';
