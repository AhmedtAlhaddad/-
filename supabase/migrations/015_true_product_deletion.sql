-- Replace migration 014 retirement semantics with a history-preserving
-- catalog deletion workflow. Migration 014 is already applied and remains
-- immutable; this migration supersedes its removal function.

-- Inventory movements are append-only history. Keep the SKU snapshot when a
-- current variant is removed, then detach the now-historical variant FK.
alter table public.inventory_movements
  add column if not exists sku_snapshot text;

-- Migration runners execute this file in one transaction. The one historical
-- backfill below is the only operation that needs to pass through the
-- append-only guard. Re-enable the exact trigger immediately afterward; if
-- anything fails, the migration transaction restores the enabled state.
alter table public.inventory_movements
  disable trigger inventory_movements_immutable;

update public.inventory_movements movement
set sku_snapshot = variant.sku
from public.product_variants variant
where variant.id = movement.variant_id
  and (
    movement.sku_snapshot is null
    or length(btrim(movement.sku_snapshot)) = 0
  );

alter table public.inventory_movements
  enable trigger inventory_movements_immutable;

do $$
begin
  if exists (
    select 1
    from public.inventory_movements
    where sku_snapshot is null
      or length(btrim(sku_snapshot)) = 0
  ) then
    raise exception 'Cannot establish inventory SKU snapshots before product deletion'
      using errcode = '23514';
  end if;
end;
$$;

alter table public.inventory_movements
  alter column sku_snapshot set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_movements'::regclass
      and conname = 'inventory_movements_sku_snapshot_check'
  ) then
    alter table public.inventory_movements
      add constraint inventory_movements_sku_snapshot_check
      check (length(btrim(sku_snapshot)) > 0);
  end if;
end;
$$;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_variant_id_fkey;

alter table public.inventory_movements
  alter column variant_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_movements'::regclass
      and conname = 'inventory_movements_variant_id_fkey'
  ) then
    alter table public.inventory_movements
      add constraint inventory_movements_variant_id_fkey
      foreign key (variant_id)
      references public.product_variants(id)
      on delete set null;
  end if;
end;
$$;

-- Every newly-created movement must snapshot the authoritative current SKU.
-- Historical rows may have a null variant_id only after that variant is deleted.
create or replace function public.snapshot_inventory_movement_sku()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.variant_id is null then
    raise exception 'Inventory movement variant is required' using errcode = '23502';
  end if;

  select variant.sku
    into new.sku_snapshot
  from public.product_variants variant
  where variant.id = new.variant_id;

  if new.sku_snapshot is null or length(btrim(new.sku_snapshot)) = 0 then
    raise exception 'Inventory movement SKU snapshot could not be established'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_movements_snapshot_sku
on public.inventory_movements;

create trigger inventory_movements_snapshot_sku
before insert on public.inventory_movements
for each row execute function public.snapshot_inventory_movement_sku();

revoke all on function public.snapshot_inventory_movement_sku() from public;
revoke all on function public.snapshot_inventory_movement_sku() from anon, authenticated;

-- Foreign-key ON DELETE SET NULL must be able to detach a historical
-- reference. PostgreSQL runs that referential action through a nested
-- trigger invocation; requiring trigger depth > 1 keeps direct client/admin
-- UPDATE statements rejected while allowing only the FK detach to null
-- variant_id. No financial/audit value may change during that detach.
create or replace function public.prevent_inventory_movement_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and pg_trigger_depth() > 1
    and old.variant_id is not null
    and new.variant_id is null
    and new.sku_snapshot is not distinct from old.sku_snapshot
    and new.quantity_change is not distinct from old.quantity_change
    and new.stock_after is not distinct from old.stock_after
    and new.reason is not distinct from old.reason
    and new.order_id is not distinct from old.order_id
    and new.note is not distinct from old.note
    and new.actor_user_id is not distinct from old.actor_user_id
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  raise exception '% is an append-only historical table', tg_table_name
    using errcode = '55000';
end;
$$;

drop trigger if exists inventory_movements_immutable
on public.inventory_movements;

create trigger inventory_movements_immutable
before update or delete on public.inventory_movements
for each row execute function public.prevent_inventory_movement_mutation();

revoke all on function public.prevent_inventory_movement_mutation() from public;
revoke all on function public.prevent_inventory_movement_mutation() from anon, authenticated;

create or replace function public.prevent_order_item_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and (old.product_id is not null or old.variant_id is not null)
    and (new.product_id is null or new.product_id is not distinct from old.product_id)
    and (new.variant_id is null or new.variant_id is not distinct from old.variant_id)
    and new.product_name_snapshot is not distinct from old.product_name_snapshot
    and new.variant_description_snapshot is not distinct from old.variant_description_snapshot
    and new.sku_snapshot is not distinct from old.sku_snapshot
    and new.unit_price is not distinct from old.unit_price
    and new.quantity is not distinct from old.quantity
    and new.line_total is not distinct from old.line_total
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  raise exception '% is an append-only historical table', tg_table_name
    using errcode = '55000';
end;
$$;

drop trigger if exists order_items_immutable
on public.order_items;

create trigger order_items_immutable
before update or delete on public.order_items
for each row execute function public.prevent_order_item_mutation();

revoke all on function public.prevent_order_item_mutation() from public;
revoke all on function public.prevent_order_item_mutation() from anon, authenticated;

-- Migration 014's preview exposed the old retirement decision and is no
-- longer part of the product-management workflow.
drop function if exists public.get_admin_product_removal_plan(uuid);

create or replace function public.remove_admin_product(
  p_product_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_slug text;
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select product.slug
    into v_product_slug
  from public.products product
  where product.id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  -- Serialize against checkout and inventory operations that lock variants.
  perform variant.id
  from public.product_variants variant
  where variant.product_id = p_product_id
  order by variant.id
  for update;

  -- Only current catalog relationships are removed. Foreign keys detach
  -- order_items and inventory_movements; immutable financial/history tables
  -- are never deleted or updated here.
  delete from public.discount_code_products
  where product_id = p_product_id;

  delete from public.product_training_goals
  where product_id = p_product_id;

  delete from public.product_images
  where product_id = p_product_id;

  delete from public.product_variants
  where product_id = p_product_id;

  delete from public.products
  where id = p_product_id;

  return jsonb_build_object(
    'action', 'hard_deleted',
    'product_slug', v_product_slug,
    'history_preserved', true
  );
end;
$$;

revoke all on function public.remove_admin_product(uuid) from public;
grant execute on function public.remove_admin_product(uuid) to authenticated;

comment on function public.remove_admin_product(uuid) is
  'Admin-only transactional catalog deletion. Current catalog rows are removed while order, commission, payout, and inventory history is preserved.';
