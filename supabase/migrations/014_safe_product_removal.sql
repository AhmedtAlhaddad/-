-- Database-authoritative product removal with immutable commerce history protection.
-- This migration is intentionally not applied by this change.

create function public.get_admin_product_removal_plan(
  p_product_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_product_slug text;
  v_has_order_history boolean;
  v_has_inventory_history boolean;
  v_has_stored_images boolean;
  v_action text;
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select p.slug
    into v_product_slug
  from public.products p
  where p.id = p_product_id;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.order_items oi
    where oi.product_id = p_product_id
      or oi.variant_id in (
        select pv.id
        from public.product_variants pv
        where pv.product_id = p_product_id
      )
  ) into v_has_order_history;

  select exists (
    select 1
    from public.inventory_movements movement
    join public.product_variants pv on pv.id = movement.variant_id
    where pv.product_id = p_product_id
  ) into v_has_inventory_history;

  select exists (
    select 1
    from public.product_images image
    where image.product_id = p_product_id
      and image.storage_path is not null
  ) into v_has_stored_images;

  v_action := case
    when v_has_order_history
      or v_has_inventory_history
      or v_has_stored_images
      then 'retire'
    else 'hard_delete'
  end;

  return jsonb_build_object(
    'action', v_action,
    'product_slug', v_product_slug,
    'has_order_history', v_has_order_history,
    'has_inventory_history', v_has_inventory_history,
    'has_stored_images', v_has_stored_images
  );
end;
$$;

revoke all on function public.get_admin_product_removal_plan(uuid) from public;
grant execute on function public.get_admin_product_removal_plan(uuid) to authenticated;

create function public.remove_admin_product(
  p_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_slug text;
  v_has_order_history boolean;
  v_has_inventory_history boolean;
  v_has_stored_images boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select p.slug
    into v_product_slug
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  -- Serialize against checkout and inventory operations that lock variants.
  perform pv.id
  from public.product_variants pv
  where pv.product_id = p_product_id
  order by pv.id
  for update;

  select exists (
    select 1
    from public.order_items oi
    where oi.product_id = p_product_id
      or oi.variant_id in (
        select pv.id
        from public.product_variants pv
        where pv.product_id = p_product_id
      )
  ) into v_has_order_history;

  select exists (
    select 1
    from public.inventory_movements movement
    join public.product_variants pv on pv.id = movement.variant_id
    where pv.product_id = p_product_id
  ) into v_has_inventory_history;

  select exists (
    select 1
    from public.product_images image
    where image.product_id = p_product_id
      and image.storage_path is not null
  ) into v_has_stored_images;

  if v_has_order_history
    or v_has_inventory_history
    or v_has_stored_images then
    update public.products
    set status = 'archived',
        featured = false
    where id = p_product_id;

    update public.product_variants
    set active = false
    where product_id = p_product_id
      and active = true;

    return jsonb_build_object(
      'action', 'retired',
      'product_slug', v_product_slug,
      'history_preserved', true,
      'has_order_history', v_has_order_history,
      'has_inventory_history', v_has_inventory_history,
      'has_stored_images', v_has_stored_images
    );
  end if;

  -- These are current catalog relationships only. Historical order and
  -- commission ledgers are absent by the eligibility checks above.
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

comment on function public.get_admin_product_removal_plan(uuid) is
  'Admin-only preview; final removal eligibility is recomputed transactionally at execution.';
comment on function public.remove_admin_product(uuid) is
  'Admin-only transactional product removal: hard delete only without order, inventory, or stored-media history; otherwise archive and deactivate variants.';
