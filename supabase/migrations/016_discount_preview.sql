-- Read-only, server-authoritative discount preview for cart and checkout UX.
-- This migration is intentionally not applied here.

create function public.preview_discount(
  p_items jsonb,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_variant record;
  v_code record;
  v_normalized_items jsonb;
  v_normalized_code text;
  v_subtotal numeric(12,3) := 0;
  v_qualifying_subtotal numeric(12,3) := 0;
  v_discount_amount numeric(12,3) := 0;
  v_total numeric(12,3) := 0;
  v_discount_code_id uuid;
  v_discount_percent numeric(5,2) := 0;
  v_code_snapshot text;
  v_code_scope text;
begin
  v_normalized_code := nullif(upper(btrim(p_code)), '');

  if v_normalized_code is null
    or length(coalesce(p_code, '')) > 32
    or v_normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$' then
    raise exception 'Discount code format is invalid' using errcode = '22023';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 100 then
    raise exception 'Order items must be a JSON array with 1 to 100 entries'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    where jsonb_typeof(value) <> 'object'
      or not (value ? 'variant_id')
      or not (value ? 'quantity')
      or (value ->> 'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (value ->> 'quantity') !~ '^[1-9][0-9]{0,3}$'
      or (value ->> 'quantity')::integer > 1000
  ) then
    raise exception 'Each item requires a valid variant_id and quantity from 1 to 1000'
      using errcode = '22023';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'variant_id', requested.variant_id,
      'quantity', requested.quantity
    )
    order by requested.variant_id
  )
    into v_normalized_items
  from (
    select
      (item.value ->> 'variant_id')::uuid as variant_id,
      sum((item.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as item(value)
    group by (item.value ->> 'variant_id')::uuid
  ) requested;

  if exists (
    select 1
    from jsonb_array_elements(v_normalized_items) as item(value)
    where (value ->> 'quantity')::integer > 1000
  ) then
    raise exception 'Aggregated item quantity exceeds the accepted limit'
      using errcode = '22023';
  end if;

  for v_item in
    select
      (item.value ->> 'variant_id')::uuid as variant_id,
      (item.value ->> 'quantity')::integer as quantity
    from jsonb_array_elements(v_normalized_items) as item(value)
    order by (item.value ->> 'variant_id')::uuid
  loop
    select pv.price, pv.stock_quantity
      into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = v_item.variant_id
      and pv.active = true
      and p.status = 'active';

    if not found then
      raise exception 'Variant % is unavailable', v_item.variant_id using errcode = 'P0001';
    end if;

    if v_variant.stock_quantity < v_item.quantity then
      raise exception 'Insufficient stock for variant %', v_item.variant_id using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + (v_variant.price * v_item.quantity);
  end loop;

  select dc.*, a.active as athlete_active
    into v_code
  from public.discount_codes dc
  left join public.athletes a on a.id = dc.athlete_id
  where dc.code = v_normalized_code;

  if not found then
    raise exception 'Discount or athlete code is invalid' using errcode = 'P0001';
  end if;

  if v_code.active = false
    or (v_code.starts_at is not null and now() < v_code.starts_at)
    or (v_code.ends_at is not null and now() >= v_code.ends_at)
    or (v_code.usage_limit is not null and v_code.redemption_count >= v_code.usage_limit)
    or (v_code.athlete_id is not null and v_code.athlete_active is not true) then
    raise exception 'Discount or athlete code is invalid' using errcode = 'P0001';
  end if;

  if v_code.scope_type = 'category' and not exists (
    select 1
    from public.discount_code_categories dcc
    where dcc.discount_code_id = v_code.id
  ) then
    raise exception 'Category-scoped code has no configured categories' using errcode = 'P0001';
  elsif v_code.scope_type = 'product' and not exists (
    select 1
    from public.discount_code_products dcp
    where dcp.discount_code_id = v_code.id
  ) then
    raise exception 'Product-scoped code has no configured products' using errcode = 'P0001';
  end if;

  v_discount_code_id := v_code.id;
  v_discount_percent := v_code.customer_discount_percent;
  v_code_snapshot := v_code.code;
  v_code_scope := v_code.scope_type;

  select coalesce(sum(pv.price * requested.quantity), 0)
    into v_qualifying_subtotal
  from (
    select
      (item.value ->> 'variant_id')::uuid as variant_id,
      (item.value ->> 'quantity')::integer as quantity
    from jsonb_array_elements(v_normalized_items) as item(value)
  ) requested
  join public.product_variants pv on pv.id = requested.variant_id
  join public.products p on p.id = pv.product_id
  where v_code_scope = 'global'
    or (
      v_code_scope = 'category'
      and exists (
        select 1
        from public.discount_code_categories dcc
        where dcc.discount_code_id = v_discount_code_id
          and dcc.category_id = p.category_id
      )
    )
    or (
      v_code_scope = 'product'
      and exists (
        select 1
        from public.discount_code_products dcp
        where dcp.discount_code_id = v_discount_code_id
          and dcp.product_id = p.id
      )
    );

  if v_qualifying_subtotal <= 0 then
    raise exception 'Code does not apply to any order item' using errcode = 'P0001';
  end if;

  if v_code.minimum_subtotal is not null
    and v_qualifying_subtotal < v_code.minimum_subtotal then
    raise exception 'Qualifying subtotal is below the code minimum' using errcode = 'P0001';
  end if;

  v_discount_amount := round(v_qualifying_subtotal * v_discount_percent / 100, 3);
  v_total := v_subtotal - v_discount_amount;

  return jsonb_build_object(
    'code', v_code_snapshot,
    'currency', 'LYD',
    'subtotal_before_discount', v_subtotal,
    'code_qualifying_subtotal', v_qualifying_subtotal,
    'discount_amount', v_discount_amount,
    'subtotal_after_discount', v_total
  );
end;
$$;

revoke all on function public.preview_discount(jsonb, text) from public;
grant execute on function public.preview_discount(jsonb, text) to anon, authenticated;

comment on function public.preview_discount is
  'Read-only checkout preview. Revalidates active code scope and current catalog values; submit_order remains authoritative for final pricing.';
