create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_full_name text not null check (length(btrim(customer_full_name)) between 2 and 160),
  customer_phone text not null check (length(btrim(customer_phone)) between 6 and 32),
  customer_city text not null check (length(btrim(customer_city)) between 2 and 120),
  customer_address text not null check (length(btrim(customer_address)) between 5 and 500),
  customer_notes text,
  currency text not null default 'LYD' check (currency = 'LYD'),
  subtotal numeric(12,3) not null check (subtotal >= 0),
  discount_amount numeric(12,3) not null default 0 check (discount_amount >= 0),
  total numeric(12,3) not null check (total >= 0),
  discount_code_id uuid references public.discount_codes(id) on delete set null,
  code_snapshot text,
  code_scope_snapshot text check (code_scope_snapshot is null or code_scope_snapshot in ('global', 'category', 'product')),
  code_qualifying_subtotal numeric(12,3) not null default 0 check (code_qualifying_subtotal >= 0),
  customer_discount_percent_snapshot numeric(5,2) not null
    check (customer_discount_percent_snapshot between 0 and 100),
  athlete_id uuid references public.athletes(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled')),
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_amount <= subtotal),
  check (code_qualifying_subtotal <= subtotal),
  check (total = subtotal - discount_amount),
  check (status <> 'delivered' or delivered_at is not null),
  check (status <> 'cancelled' or cancelled_at is not null)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name_snapshot text not null check (length(btrim(product_name_snapshot)) > 0),
  variant_description_snapshot text not null check (length(btrim(variant_description_snapshot)) > 0),
  sku_snapshot text not null check (length(btrim(sku_snapshot)) > 0),
  unit_price numeric(12,3) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,3) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, variant_id),
  check (line_total = unit_price * quantity)
);

alter table public.inventory_movements
  add constraint inventory_movements_order_id_fk
  foreign key (order_id) references public.orders(id) on delete restrict;

create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_phone_created_idx on public.orders (customer_phone, created_at desc);
create index orders_discount_code_idx on public.orders (discount_code_id, created_at desc) where discount_code_id is not null;
create index orders_athlete_idx on public.orders (athlete_id, created_at desc) where athlete_id is not null;
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id) where product_id is not null;
create index order_items_variant_id_idx on public.order_items (variant_id) where variant_id is not null;

create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.protect_order_financials_and_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.subtotal is distinct from old.subtotal
    or new.discount_amount is distinct from old.discount_amount
    or new.total is distinct from old.total
    or new.currency is distinct from old.currency
    or new.discount_code_id is distinct from old.discount_code_id
    or new.code_snapshot is distinct from old.code_snapshot
    or new.code_scope_snapshot is distinct from old.code_scope_snapshot
    or new.code_qualifying_subtotal is distinct from old.code_qualifying_subtotal
    or new.customer_discount_percent_snapshot is distinct from old.customer_discount_percent_snapshot
    or new.athlete_id is distinct from old.athlete_id then
    raise exception 'Historical order financial fields are immutable' using errcode = '55000';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
    or (old.status = 'confirmed' and new.status in ('preparing', 'cancelled'))
    or (old.status = 'preparing' and new.status in ('delivered', 'cancelled'))
  ) then
    raise exception 'Invalid order status transition: % to %', old.status, new.status using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger orders_protect_financials_and_transition
before update on public.orders
for each row execute function public.protect_order_financials_and_transition();

create trigger order_items_immutable
before update or delete on public.order_items
for each row execute function public.prevent_immutable_row_change();

comment on table public.orders is 'Trusted financial header. Amounts are computed by submit_order, never accepted from the browser.';
comment on table public.order_items is 'Immutable commerce snapshots keep orders understandable after catalog names, prices, or relations change.';
comment on column public.orders.order_number is 'Human-facing sequence; the UUID remains the internal stable key.';
