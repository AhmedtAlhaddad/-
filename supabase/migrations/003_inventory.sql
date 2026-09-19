create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity_change integer not null check (quantity_change <> 0),
  stock_after integer not null check (stock_after >= 0),
  reason text not null check (reason in ('restock', 'sale', 'manual_adjustment', 'order_cancelled_return', 'correction')),
  order_id uuid,
  note text,
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (reason in ('sale', 'order_cancelled_return') and order_id is not null)
    or reason in ('restock', 'manual_adjustment', 'correction')
  )
);

create index inventory_movements_variant_history_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_order_id_idx on public.inventory_movements (order_id) where order_id is not null;
create index inventory_movements_actor_idx on public.inventory_movements (actor_user_id, created_at desc) where actor_user_id is not null;

create or replace function public.prevent_immutable_row_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception '% is an append-only historical table', tg_table_name using errcode = '55000';
end;
$$;

create trigger inventory_movements_immutable
before update or delete on public.inventory_movements
for each row execute function public.prevent_immutable_row_change();

comment on table public.inventory_movements is 'Append-only audit ledger. product_variants.stock_quantity is the current balance and must change in the same transaction as this ledger.';
