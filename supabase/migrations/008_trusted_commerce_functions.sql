create or replace function public.submit_order(
  p_customer_full_name text,
  p_customer_phone text,
  p_customer_city text,
  p_customer_address text,
  p_items jsonb,
  p_customer_notes text default null,
  p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_variant record;
  v_code record;
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(12,3) := 0;
  v_discount_amount numeric(12,3) := 0;
  v_total numeric(12,3) := 0;
  v_qualifying_subtotal numeric(12,3) := 0;
  v_commission_amount numeric(12,3) := 0;
  v_discount_code_id uuid;
  v_athlete_id uuid;
  v_discount_percent numeric(5,2) := 0;
  v_commission_percent numeric(5,2) := 0;
  v_code_snapshot text;
  v_code_scope text;
  v_stock_after integer;
  v_variant_description text;
begin
  if length(btrim(coalesce(p_customer_full_name, ''))) < 2
    or length(btrim(coalesce(p_customer_phone, ''))) < 6
    or length(btrim(coalesce(p_customer_city, ''))) < 2
    or length(btrim(coalesce(p_customer_address, ''))) < 5 then
    raise exception 'Customer information is incomplete' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items must be a non-empty JSON array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    where jsonb_typeof(value) <> 'object'
      or not (value ? 'variant_id')
      or not (value ? 'quantity')
      or (value ->> 'quantity') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Each item requires variant_id and a positive integer quantity' using errcode = '22023';
  end if;

  -- Aggregation prevents duplicate variant lines from bypassing stock validation.
  -- Sorting makes concurrent row locks deterministic and reduces deadlock risk.
  for v_item in
    select
      (item.value ->> 'variant_id')::uuid as variant_id,
      sum((item.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as item(value)
    group by (item.value ->> 'variant_id')::uuid
    order by (item.value ->> 'variant_id')::uuid
  loop
    if v_item.quantity > 1000 then
      raise exception 'Item quantity exceeds the accepted limit' using errcode = '22023';
    end if;

    select pv.*, p.name_ar as product_name_ar
      into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = v_item.variant_id
      and pv.active = true
      and p.status = 'active'
    for update of pv;

    if not found then
      raise exception 'Variant % is unavailable', v_item.variant_id using errcode = 'P0001';
    end if;
    if v_variant.stock_quantity < v_item.quantity then
      raise exception 'Insufficient stock for variant %', v_item.variant_id using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + (v_variant.price * v_item.quantity);
  end loop;

  if p_code is not null and length(btrim(p_code)) > 0 then
    select dc.*, a.active as athlete_active
      into v_code
    from public.discount_codes dc
    left join public.athletes a on a.id = dc.athlete_id
    where dc.code = upper(btrim(p_code))
    for update of dc;

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
      select 1 from public.discount_code_categories dcc where dcc.discount_code_id = v_code.id
    ) then
      raise exception 'Category-scoped code has no configured categories' using errcode = 'P0001';
    elsif v_code.scope_type = 'product' and not exists (
      select 1 from public.discount_code_products dcp where dcp.discount_code_id = v_code.id
    ) then
      raise exception 'Product-scoped code has no configured products' using errcode = 'P0001';
    end if;

    v_discount_code_id := v_code.id;
    v_athlete_id := v_code.athlete_id;
    v_discount_percent := v_code.customer_discount_percent;
    v_commission_percent := v_code.athlete_commission_percent;
    v_code_snapshot := v_code.code;
    v_code_scope := v_code.scope_type;

    with requested_items as (
      select
        (item.value ->> 'variant_id')::uuid as variant_id,
        sum((item.value ->> 'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) as item(value)
      group by (item.value ->> 'variant_id')::uuid
    )
    select coalesce(sum(pv.price * requested_items.quantity), 0)
      into v_qualifying_subtotal
    from requested_items
    join public.product_variants pv on pv.id = requested_items.variant_id
    join public.products p on p.id = pv.product_id
    where v_code_scope = 'global'
      or (
        v_code_scope = 'category'
        and exists (
          select 1 from public.discount_code_categories dcc
          where dcc.discount_code_id = v_discount_code_id
            and dcc.category_id = p.category_id
        )
      )
      or (
        v_code_scope = 'product'
        and exists (
          select 1 from public.discount_code_products dcp
          where dcp.discount_code_id = v_discount_code_id
            and dcp.product_id = p.id
        )
      );

    if v_qualifying_subtotal <= 0 then
      raise exception 'Code does not apply to any order item' using errcode = 'P0001';
    end if;
    if v_code.minimum_subtotal is not null and v_qualifying_subtotal < v_code.minimum_subtotal then
      raise exception 'Qualifying subtotal is below the code minimum' using errcode = 'P0001';
    end if;

    v_discount_amount := round(v_qualifying_subtotal * v_discount_percent / 100, 3);
  end if;

  v_total := v_subtotal - v_discount_amount;

  insert into public.orders (
    customer_full_name, customer_phone, customer_city, customer_address,
    customer_notes, subtotal, discount_amount, total, discount_code_id,
    code_snapshot, code_scope_snapshot, code_qualifying_subtotal,
    customer_discount_percent_snapshot, athlete_id
  ) values (
    btrim(p_customer_full_name), btrim(p_customer_phone), btrim(p_customer_city),
    btrim(p_customer_address), nullif(btrim(p_customer_notes), ''), v_subtotal,
    v_discount_amount, v_total, v_discount_code_id,
    v_code_snapshot, v_code_scope, v_qualifying_subtotal,
    v_discount_percent, v_athlete_id
  )
  returning id, order_number into v_order_id, v_order_number;

  for v_item in
    select
      (item.value ->> 'variant_id')::uuid as variant_id,
      sum((item.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as item(value)
    group by (item.value ->> 'variant_id')::uuid
    order by (item.value ->> 'variant_id')::uuid
  loop
    select pv.*, p.name_ar as product_name_ar
      into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = v_item.variant_id;

    v_variant_description := concat_ws(
      ' / ',
      nullif(v_variant.flavor_ar, ''),
      case when v_variant.weight_value is not null
        then trim(to_char(v_variant.weight_value, 'FM999999990.###')) || ' ' || v_variant.weight_unit
      end,
      nullif(v_variant.size_label_ar, '')
    );
    if length(v_variant_description) = 0 then
      v_variant_description := v_variant.sku;
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name_snapshot,
      variant_description_snapshot, sku_snapshot, unit_price, quantity, line_total
    ) values (
      v_order_id, v_variant.product_id, v_variant.id, v_variant.product_name_ar,
      v_variant_description, v_variant.sku, v_variant.price, v_item.quantity,
      v_variant.price * v_item.quantity
    );

    update public.product_variants
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_variant.id
    returning stock_quantity into v_stock_after;

    insert into public.inventory_movements (
      variant_id, quantity_change, stock_after, reason, order_id, note
    ) values (
      v_variant.id, -v_item.quantity, v_stock_after, 'sale', v_order_id,
      'Created by submit_order'
    );
  end loop;

  if v_discount_code_id is not null then
    update public.discount_codes
    set redemption_count = redemption_count + 1
    where id = v_discount_code_id;
  end if;

  if v_athlete_id is not null and v_commission_percent > 0 then
    -- Commission is based on the original qualifying subtotal, before discount.
    v_commission_amount := round(v_qualifying_subtotal * v_commission_percent / 100, 3);
    if v_commission_amount > 0 then
      insert into public.commissions (
        order_id, athlete_id, discount_code_id, code_snapshot, scope_snapshot, base_subtotal,
        commission_percent, commission_amount, status
      ) values (
        v_order_id, v_athlete_id, v_discount_code_id, v_code_snapshot, v_code_scope, v_qualifying_subtotal,
        v_commission_percent, v_commission_amount, 'pending'
      );
    end if;
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'currency', 'LYD',
    'subtotal', v_subtotal,
    'code_qualifying_subtotal', v_qualifying_subtotal,
    'discount_amount', v_discount_amount,
    'total', v_total
  );
end;
$$;

revoke all on function public.submit_order(text, text, text, text, jsonb, text, text) from public;
grant execute on function public.submit_order(text, text, text, text, jsonb, text, text) to anon, authenticated;

create or replace function public.adjust_inventory(
  p_variant_id uuid,
  p_quantity_change integer,
  p_reason text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_stock integer;
  v_new_stock integer;
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;
  if p_quantity_change = 0 or p_reason not in ('restock', 'manual_adjustment', 'correction') then
    raise exception 'Invalid inventory adjustment' using errcode = '22023';
  end if;

  select stock_quantity into v_current_stock
  from public.product_variants where id = p_variant_id
  for update;
  if not found then
    raise exception 'Variant not found' using errcode = 'P0001';
  end if;

  v_new_stock := v_current_stock + p_quantity_change;
  if v_new_stock < 0 then
    raise exception 'Inventory cannot become negative' using errcode = 'P0001';
  end if;

  update public.product_variants set stock_quantity = v_new_stock where id = p_variant_id;
  insert into public.inventory_movements (
    variant_id, quantity_change, stock_after, reason, note, actor_user_id
  ) values (
    p_variant_id, p_quantity_change, v_new_stock, p_reason, nullif(btrim(p_note), ''), auth.uid()
  );
  return v_new_stock;
end;
$$;

revoke all on function public.adjust_inventory(uuid, integer, text, text) from public;
grant execute on function public.adjust_inventory(uuid, integer, text, text) to authenticated;

create or replace function public.set_order_status(p_order_id uuid, p_new_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_stock_after integer;
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;
  if p_new_status not in ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled') then
    raise exception 'Invalid order status' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0001'; end if;
  if v_order.status = p_new_status then return; end if;

  if not (
    (v_order.status = 'pending' and p_new_status in ('confirmed', 'cancelled'))
    or (v_order.status = 'confirmed' and p_new_status in ('preparing', 'cancelled'))
    or (v_order.status = 'preparing' and p_new_status in ('delivered', 'cancelled'))
  ) then
    raise exception 'Invalid order status transition: % to %', v_order.status, p_new_status using errcode = 'P0001';
  end if;

  if p_new_status = 'cancelled' then
    for v_item in
      select variant_id, quantity from public.order_items
      where order_id = p_order_id and variant_id is not null
      order by variant_id
    loop
      update public.product_variants
      set stock_quantity = stock_quantity + v_item.quantity
      where id = v_item.variant_id
      returning stock_quantity into v_stock_after;

      insert into public.inventory_movements (
        variant_id, quantity_change, stock_after, reason, order_id, note, actor_user_id
      ) values (
        v_item.variant_id, v_item.quantity, v_stock_after, 'order_cancelled_return',
        p_order_id, 'Restored by set_order_status', auth.uid()
      );
    end loop;

    update public.commissions
    set status = 'void', voided_at = now()
    where order_id = p_order_id and status in ('pending', 'approved');
  elsif p_new_status = 'delivered' then
    update public.commissions
    set status = 'approved', approved_at = now()
    where order_id = p_order_id and status = 'pending';
  end if;

  update public.orders
  set status = p_new_status,
      delivered_at = case when p_new_status = 'delivered' then now() else delivered_at end,
      cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end
  where id = p_order_id;
end;
$$;

revoke all on function public.set_order_status(uuid, text) from public;
grant execute on function public.set_order_status(uuid, text) to authenticated;

create or replace function public.create_commission_payout(
  p_athlete_id uuid,
  p_commission_ids uuid[],
  p_payment_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout_id uuid;
  v_count integer;
  v_total numeric(12,3);
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;
  if p_commission_ids is null or cardinality(p_commission_ids) = 0 then
    raise exception 'At least one commission is required' using errcode = '22023';
  end if;

  perform 1 from public.commissions
  where id = any(p_commission_ids)
  order by id
  for update;

  select count(*), sum(commission_amount)
    into v_count, v_total
  from public.commissions
  where id = any(p_commission_ids)
    and athlete_id = p_athlete_id
    and status = 'approved';

  if v_count <> cardinality(p_commission_ids) then
    raise exception 'Commissions must be unique, approved, and belong to the selected athlete' using errcode = 'P0001';
  end if;

  insert into public.commission_payouts (
    athlete_id, total_amount, payment_reference, notes, created_by
  ) values (
    p_athlete_id, v_total, nullif(btrim(p_payment_reference), ''),
    nullif(btrim(p_notes), ''), auth.uid()
  ) returning id into v_payout_id;

  insert into public.commission_payout_items (payout_id, commission_id, amount)
  select v_payout_id, id, commission_amount
  from public.commissions where id = any(p_commission_ids);

  update public.commissions
  set status = 'paid', paid_at = now()
  where id = any(p_commission_ids);

  return v_payout_id;
end;
$$;

revoke all on function public.create_commission_payout(uuid, uuid[], text, text) from public;
grant execute on function public.create_commission_payout(uuid, uuid[], text, text) to authenticated;

comment on function public.submit_order is 'Transactional trusted checkout boundary: locks stock/code rows, computes exact amounts, snapshots items, records commission and inventory.';
comment on function public.set_order_status is 'Admin lifecycle boundary that approves/voids commission and restores stock on cancellation.';
comment on function public.create_commission_payout is 'Admin-only transactional payout workflow; one payout may settle multiple approved commissions for one athlete.';
