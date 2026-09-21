-- Commerce write hardening. This migration is intentionally not applied here.

alter table public.orders
  add column checkout_idempotency_key uuid,
  add column checkout_request_fingerprint text,
  add constraint orders_checkout_idempotency_key_key
    unique (checkout_idempotency_key),
  add constraint orders_checkout_identity_pair_check
    check (
      (checkout_idempotency_key is null) =
      (checkout_request_fingerprint is null)
    ),
  add constraint orders_checkout_request_fingerprint_check
    check (
      checkout_request_fingerprint is null
      or checkout_request_fingerprint ~ '^[0-9a-f]{32}$'
    ),
  add constraint orders_customer_notes_length_check
    check (customer_notes is null or length(customer_notes) <= 2000);

comment on column public.orders.checkout_idempotency_key is
  'Client-generated UUID that makes submit_order safe to retry.';

comment on column public.orders.checkout_request_fingerprint is
  'Canonical request fingerprint; prevents reuse of an idempotency key for different checkout data.';

create or replace function public.protect_order_checkout_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.checkout_idempotency_key is distinct from old.checkout_idempotency_key
    or new.checkout_request_fingerprint is distinct from old.checkout_request_fingerprint then
    raise exception 'Order checkout identity is immutable' using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger orders_protect_checkout_identity
before update on public.orders
for each row execute function public.protect_order_checkout_identity();

revoke all on function public.submit_order(
  text, text, text, text, jsonb, text, text
) from public;

drop function public.submit_order(
  text, text, text, text, jsonb, text, text
);

create function public.submit_order(
  p_customer_full_name text,
  p_customer_phone text,
  p_customer_city text,
  p_customer_address text,
  p_items jsonb,
  p_idempotency_key uuid,
  p_customer_notes text default null,
  p_code text default null
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
  v_existing_order public.orders%rowtype;
  v_normalized_items jsonb;
  v_request_fingerprint text;
  v_normalized_code text;
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
  if p_idempotency_key is null then
    raise exception 'Checkout idempotency key is required' using errcode = '22023';
  end if;

  if length(coalesce(p_customer_full_name, '')) > 160
    or length(btrim(coalesce(p_customer_full_name, ''))) < 2
    or length(coalesce(p_customer_phone, '')) > 32
    or length(btrim(coalesce(p_customer_phone, ''))) < 6
    or length(coalesce(p_customer_city, '')) > 120
    or length(btrim(coalesce(p_customer_city, ''))) < 2
    or length(coalesce(p_customer_address, '')) > 500
    or length(btrim(coalesce(p_customer_address, ''))) < 5
    or (p_customer_notes is not null and length(p_customer_notes) > 2000) then
    raise exception 'Customer information exceeds accepted limits or is incomplete'
      using errcode = '22023';
  end if;

  v_normalized_code := nullif(upper(btrim(p_code)), '');

  if v_normalized_code is not null
    and (
      length(coalesce(p_code, '')) > 32
      or v_normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'
    ) then
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

  v_request_fingerprint := md5(
    jsonb_build_object(
      'customer_full_name', btrim(p_customer_full_name),
      'customer_phone', btrim(p_customer_phone),
      'customer_city', btrim(p_customer_city),
      'customer_address', btrim(p_customer_address),
      'customer_notes', nullif(btrim(p_customer_notes), ''),
      'code', v_normalized_code,
      'items', v_normalized_items
    )::text
  );

  -- A transaction-scoped lock makes parallel calls with the same key converge
  -- before either can consume stock or increment a redemption count.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select *
    into v_existing_order
  from public.orders o
  where o.checkout_idempotency_key = p_idempotency_key;

  if found then
    if v_existing_order.checkout_request_fingerprint <> v_request_fingerprint then
      raise exception 'Idempotency key reused with different payload'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'order_id', v_existing_order.id,
      'order_number', v_existing_order.order_number,
      'currency', v_existing_order.currency,
      'subtotal', v_existing_order.subtotal,
      'code_qualifying_subtotal', v_existing_order.code_qualifying_subtotal,
      'discount_amount', v_existing_order.discount_amount,
      'total', v_existing_order.total
    );
  end if;

  for v_item in
    select
      (item.value ->> 'variant_id')::uuid as variant_id,
      (item.value ->> 'quantity')::integer as quantity
    from jsonb_array_elements(v_normalized_items) as item(value)
    order by (item.value ->> 'variant_id')::uuid
  loop
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

  if v_normalized_code is not null then
    select dc.*, a.active as athlete_active
      into v_code
    from public.discount_codes dc
    left join public.athletes a on a.id = dc.athlete_id
    where dc.code = v_normalized_code
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
    customer_discount_percent_snapshot, athlete_id,
    checkout_idempotency_key, checkout_request_fingerprint
  ) values (
    btrim(p_customer_full_name), btrim(p_customer_phone), btrim(p_customer_city),
    btrim(p_customer_address), nullif(btrim(p_customer_notes), ''), v_subtotal,
    v_discount_amount, v_total, v_discount_code_id,
    v_code_snapshot, v_code_scope, v_qualifying_subtotal,
    v_discount_percent, v_athlete_id,
    p_idempotency_key, v_request_fingerprint
  )
  returning id, order_number into v_order_id, v_order_number;

  for v_item in
    select
      (item.value ->> 'variant_id')::uuid as variant_id,
      (item.value ->> 'quantity')::integer as quantity
    from jsonb_array_elements(v_normalized_items) as item(value)
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
    v_commission_amount := round(v_qualifying_subtotal * v_commission_percent / 100, 3);
    if v_commission_amount > 0 then
      insert into public.commissions (
        order_id, athlete_id, discount_code_id, code_snapshot, scope_snapshot,
        base_subtotal, commission_percent, commission_amount, status
      ) values (
        v_order_id, v_athlete_id, v_discount_code_id, v_code_snapshot, v_code_scope,
        v_qualifying_subtotal, v_commission_percent, v_commission_amount, 'pending'
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

revoke all on function public.submit_order(
  text, text, text, text, jsonb, uuid, text, text
) from public;
grant execute on function public.submit_order(
  text, text, text, text, jsonb, uuid, text, text
) to anon, authenticated;

comment on function public.submit_order is
  'Transactional checkout boundary with request limits, stock/code locks, and database-backed idempotent replay.';

create function public.create_admin_product(
  p_product jsonb,
  p_variants jsonb,
  p_goals text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_variant_id uuid;
  v_slug text;
  v_variant record;
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  if p_product is null or jsonb_typeof(p_product) <> 'object' then
    raise exception 'Product payload must be an object' using errcode = '22023';
  end if;
  if p_variants is null
    or jsonb_typeof(p_variants) <> 'array'
    or jsonb_array_length(p_variants) = 0
    or jsonb_array_length(p_variants) > 100 then
    raise exception 'Product requires 1 to 100 variants' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_product -> 'highlights', '[]'::jsonb)) <> 'array' then
    raise exception 'Product highlights must be an array' using errcode = '22023';
  end if;
  if coalesce(p_product ->> 'status', '') not in ('draft', 'active', 'archived')
    or coalesce(p_product ->> 'slug', '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or length(btrim(coalesce(p_product ->> 'name_ar', ''))) = 0
    or length(btrim(coalesce(p_product ->> 'short_description_ar', ''))) = 0
    or length(btrim(coalesce(p_product ->> 'product_type', ''))) = 0
    or length(coalesce(p_product ->> 'nutrition_facts', '')) > 10000
    or length(coalesce(p_product ->> 'usage_instructions', '')) > 10000 then
    raise exception 'Product payload is invalid' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_goals, array[]::text[])) requested(goal)
    where requested.goal is null
      or requested.goal <> all (
        array['muscle-building', 'energy-endurance', 'weight-management']::text[]
      )
  ) then
    raise exception 'Invalid training goal' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_variants) item(value)
    where jsonb_typeof(value) <> 'object'
  ) or exists (
    select 1
    from jsonb_array_elements(p_variants) item(value)
    group by lower(btrim(value ->> 'sku'))
    having count(*) > 1
  ) then
    raise exception 'Variant payload is invalid or contains duplicate SKUs' using errcode = '22023';
  end if;

  v_slug := p_product ->> 'slug';

  insert into public.products (
    slug, name_ar, name_en, short_description_ar, full_description_ar,
    nutrition_facts, usage_instructions, brand_id, category_id, product_type,
    highlights, badge_label_ar, status, featured
  ) values (
    v_slug,
    p_product ->> 'name_ar',
    nullif(p_product ->> 'name_en', ''),
    p_product ->> 'short_description_ar',
    nullif(p_product ->> 'full_description_ar', ''),
    nullif(p_product ->> 'nutrition_facts', ''),
    nullif(p_product ->> 'usage_instructions', ''),
    (p_product ->> 'brand_id')::uuid,
    (p_product ->> 'category_id')::uuid,
    p_product ->> 'product_type',
    coalesce(p_product -> 'highlights', '[]'::jsonb),
    nullif(p_product ->> 'badge_label_ar', ''),
    p_product ->> 'status',
    coalesce((p_product ->> 'featured')::boolean, false)
  ) returning id into v_product_id;

  perform public.set_product_training_goals(v_product_id, p_goals);

  for v_variant in
    select *
    from jsonb_to_recordset(p_variants) as requested(
      sku text,
      flavor_ar text,
      flavor_en text,
      weight_value numeric,
      weight_unit text,
      size_label_ar text,
      size_label_en text,
      servings integer,
      attributes jsonb,
      price numeric,
      compare_at_price numeric,
      stock_quantity integer,
      active boolean,
      sort_order integer
    )
  loop
    if length(btrim(coalesce(v_variant.sku, ''))) = 0
      or v_variant.price is null
      or v_variant.stock_quantity is null then
      raise exception 'Variant requires SKU, price, and stock quantity' using errcode = '22023';
    end if;

    insert into public.product_variants (
      product_id, sku, flavor_ar, flavor_en, weight_value, weight_unit,
      size_label_ar, size_label_en, servings, attributes, price,
      compare_at_price, stock_quantity, active, sort_order
    ) values (
      v_product_id, upper(btrim(v_variant.sku)), v_variant.flavor_ar,
      v_variant.flavor_en, v_variant.weight_value, v_variant.weight_unit,
      v_variant.size_label_ar, v_variant.size_label_en, v_variant.servings,
      coalesce(v_variant.attributes, '{}'::jsonb), v_variant.price,
      v_variant.compare_at_price, 0, coalesce(v_variant.active, true),
      coalesce(v_variant.sort_order, 0)
    ) returning id into v_variant_id;

    if v_variant.stock_quantity <> 0 then
      perform public.adjust_inventory(
        v_variant_id,
        v_variant.stock_quantity,
        'restock',
        'Initial stock during product creation'
      );
    end if;
  end loop;

  return jsonb_build_object('id', v_product_id, 'slug', v_slug);
end;
$$;

revoke all on function public.create_admin_product(jsonb, jsonb, text[]) from public;
grant execute on function public.create_admin_product(jsonb, jsonb, text[]) to authenticated;

create function public.update_admin_product(
  p_product_id uuid,
  p_product jsonb,
  p_variants jsonb,
  p_goals text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_product public.products%rowtype;
  v_variant_id uuid;
  v_current_stock integer;
  v_variant record;
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select * into v_existing_product
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  if p_product is null or jsonb_typeof(p_product) <> 'object' then
    raise exception 'Product payload must be an object' using errcode = '22023';
  end if;
  if p_variants is null
    or jsonb_typeof(p_variants) <> 'array'
    or jsonb_array_length(p_variants) = 0
    or jsonb_array_length(p_variants) > 100 then
    raise exception 'Product requires 1 to 100 variants' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_product -> 'highlights', '[]'::jsonb)) <> 'array' then
    raise exception 'Product highlights must be an array' using errcode = '22023';
  end if;
  if coalesce(p_product ->> 'status', '') not in ('draft', 'active', 'archived')
    or coalesce(p_product ->> 'slug', '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or length(btrim(coalesce(p_product ->> 'name_ar', ''))) = 0
    or length(btrim(coalesce(p_product ->> 'short_description_ar', ''))) = 0
    or length(btrim(coalesce(p_product ->> 'product_type', ''))) = 0
    or length(coalesce(p_product ->> 'nutrition_facts', '')) > 10000
    or length(coalesce(p_product ->> 'usage_instructions', '')) > 10000 then
    raise exception 'Product payload is invalid' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_goals, array[]::text[])) requested(goal)
    where requested.goal is null
      or requested.goal <> all (
        array['muscle-building', 'energy-endurance', 'weight-management']::text[]
      )
  ) then
    raise exception 'Invalid training goal' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_variants) item(value)
    where jsonb_typeof(value) <> 'object'
  ) or exists (
    select 1
    from jsonb_array_elements(p_variants) item(value)
    group by lower(btrim(value ->> 'sku'))
    having count(*) > 1
  ) or exists (
    select 1
    from jsonb_array_elements(p_variants) item(value)
    where nullif(item.value ->> 'id', '') is not null
    group by item.value ->> 'id'
    having count(*) > 1
  ) then
    raise exception 'Variant payload is invalid or contains duplicate identifiers'
      using errcode = '22023';
  end if;

  update public.products
  set slug = p_product ->> 'slug',
      name_ar = p_product ->> 'name_ar',
      name_en = nullif(p_product ->> 'name_en', ''),
      short_description_ar = p_product ->> 'short_description_ar',
      full_description_ar = nullif(p_product ->> 'full_description_ar', ''),
      nutrition_facts = nullif(p_product ->> 'nutrition_facts', ''),
      usage_instructions = nullif(p_product ->> 'usage_instructions', ''),
      brand_id = (p_product ->> 'brand_id')::uuid,
      category_id = (p_product ->> 'category_id')::uuid,
      product_type = p_product ->> 'product_type',
      training_goal = null,
      highlights = coalesce(p_product -> 'highlights', '[]'::jsonb),
      badge_label_ar = nullif(p_product ->> 'badge_label_ar', ''),
      status = p_product ->> 'status',
      featured = coalesce((p_product ->> 'featured')::boolean, false)
  where id = p_product_id;

  perform public.set_product_training_goals(p_product_id, p_goals);

  for v_variant in
    select *
    from jsonb_to_recordset(p_variants) as requested(
      id uuid,
      sku text,
      flavor_ar text,
      flavor_en text,
      weight_value numeric,
      weight_unit text,
      size_label_ar text,
      size_label_en text,
      servings integer,
      attributes jsonb,
      price numeric,
      compare_at_price numeric,
      stock_quantity integer,
      active boolean,
      sort_order integer
    )
  loop
    if length(btrim(coalesce(v_variant.sku, ''))) = 0
      or v_variant.price is null
      or v_variant.stock_quantity is null then
      raise exception 'Variant requires SKU, price, and stock quantity' using errcode = '22023';
    end if;

    if v_variant.id is null then
      insert into public.product_variants (
        product_id, sku, flavor_ar, flavor_en, weight_value, weight_unit,
        size_label_ar, size_label_en, servings, attributes, price,
        compare_at_price, stock_quantity, active, sort_order
      ) values (
        p_product_id, upper(btrim(v_variant.sku)), v_variant.flavor_ar,
        v_variant.flavor_en, v_variant.weight_value, v_variant.weight_unit,
        v_variant.size_label_ar, v_variant.size_label_en, v_variant.servings,
        coalesce(v_variant.attributes, '{}'::jsonb), v_variant.price,
        v_variant.compare_at_price, 0, coalesce(v_variant.active, true),
        coalesce(v_variant.sort_order, 0)
      ) returning id into v_variant_id;

      if v_variant.stock_quantity <> 0 then
        perform public.adjust_inventory(
          v_variant_id,
          v_variant.stock_quantity,
          'restock',
          'Initial stock for new product variant'
        );
      end if;
    else
      select pv.stock_quantity
        into v_current_stock
      from public.product_variants pv
      where pv.id = v_variant.id
        and pv.product_id = p_product_id
      for update;

      if not found then
        raise exception 'Variant does not belong to product' using errcode = '22023';
      end if;

      update public.product_variants
      set sku = upper(btrim(v_variant.sku)),
          flavor_ar = v_variant.flavor_ar,
          flavor_en = v_variant.flavor_en,
          weight_value = v_variant.weight_value,
          weight_unit = v_variant.weight_unit,
          size_label_ar = v_variant.size_label_ar,
          size_label_en = v_variant.size_label_en,
          servings = v_variant.servings,
          attributes = coalesce(v_variant.attributes, '{}'::jsonb),
          price = v_variant.price,
          compare_at_price = v_variant.compare_at_price,
          active = coalesce(v_variant.active, true),
          sort_order = coalesce(v_variant.sort_order, 0)
      where id = v_variant.id;

      if v_variant.stock_quantity <> v_current_stock then
        perform public.adjust_inventory(
          v_variant.id,
          v_variant.stock_quantity - v_current_stock,
          'correction',
          'Stock adjusted from product editor'
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object('id', p_product_id, 'slug', p_product ->> 'slug');
end;
$$;

revoke all on function public.update_admin_product(uuid, jsonb, jsonb, text[]) from public;
grant execute on function public.update_admin_product(uuid, jsonb, jsonb, text[]) to authenticated;

comment on function public.create_admin_product is
  'Admin-only atomic product, goal, variant, and initial inventory creation.';
comment on function public.update_admin_product is
  'Admin-only atomic product, goal, variant, and inventory update.';
