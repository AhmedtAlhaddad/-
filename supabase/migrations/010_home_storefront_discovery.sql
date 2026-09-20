-- Public catalog helpers for type-scoped browsing and stock-aware discovery.
-- The scoped listing remains SECURITY INVOKER so catalog RLS stays authoritative.
create or replace function public.list_storefront_products_by_scope(
  p_product_scope text,
  p_category_slugs text[] default null,
  p_training_goals text[] default null,
  p_available boolean default false,
  p_sort text default 'featured',
  p_search text default null,
  p_offset integer default 0,
  p_limit integer default 24
)
returns table (
  id uuid,
  slug text,
  name_ar text,
  brand_name_ar text,
  category_slug text,
  product_type text,
  training_goal text,
  badge_label_ar text,
  featured boolean,
  variant_id uuid,
  variant_flavor_ar text,
  variant_weight_value numeric,
  variant_weight_unit text,
  variant_size_label_ar text,
  variant_servings integer,
  variant_price numeric,
  variant_compare_at_price numeric,
  variant_stock_quantity integer,
  in_stock boolean,
  image_storage_path text,
  image_external_url text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.slug,
    p.name_ar,
    b.name_ar as brand_name_ar,
    c.slug as category_slug,
    p.product_type,
    p.training_goal,
    p.badge_label_ar,
    p.featured,
    first_variant.id as variant_id,
    first_variant.flavor_ar as variant_flavor_ar,
    first_variant.weight_value as variant_weight_value,
    first_variant.weight_unit as variant_weight_unit,
    first_variant.size_label_ar as variant_size_label_ar,
    first_variant.servings as variant_servings,
    first_variant.price as variant_price,
    first_variant.compare_at_price as variant_compare_at_price,
    first_variant.stock_quantity as variant_stock_quantity,
    exists (
      select 1
      from public.product_variants available_variant
      where available_variant.product_id = p.id
        and available_variant.active = true
        and available_variant.stock_quantity > 0
    ) as in_stock,
    first_image.storage_path as image_storage_path,
    first_image.external_url as image_external_url,
    count(*) over () as total_count
  from public.products p
  join public.brands b
    on b.id = p.brand_id
   and b.active = true
  join public.categories c
    on c.id = p.category_id
   and c.active = true
  join lateral (
    select
      pv.id,
      pv.flavor_ar,
      pv.weight_value,
      pv.weight_unit,
      pv.size_label_ar,
      pv.servings,
      pv.price,
      pv.compare_at_price,
      pv.stock_quantity
    from public.product_variants pv
    where pv.product_id = p.id
      and pv.active = true
    order by
      (pv.stock_quantity > 0) desc,
      pv.sort_order asc,
      pv.id asc
    limit 1
  ) first_variant on true
  left join lateral (
    select
      pi.storage_path,
      pi.external_url
    from public.product_images pi
    where pi.product_id = p.id
      and (
        pi.variant_id is null
        or exists (
          select 1
          from public.product_variants image_variant
          where image_variant.id = pi.variant_id
            and image_variant.active = true
        )
      )
    order by
      (pi.variant_id is null) desc,
      pi.is_primary desc,
      pi.sort_order asc,
      pi.created_at asc,
      pi.id asc
    limit 1
  ) first_image on true
  where p.status = 'active'
    and (
      (p_product_scope = 'supplements' and coalesce(p.product_type, '') <> 'fitness-accessory')
      or (p_product_scope = 'accessories' and p.product_type = 'fitness-accessory')
    )
    and (
      p_category_slugs is null
      or cardinality(p_category_slugs) = 0
      or c.slug = any (p_category_slugs)
    )
    and (
      p_training_goals is null
      or cardinality(p_training_goals) = 0
      or p.training_goal = any (p_training_goals)
    )
    and (
      not p_available
      or exists (
        select 1
        from public.product_variants available_variant
        where available_variant.product_id = p.id
          and available_variant.active = true
          and available_variant.stock_quantity > 0
      )
    )
    and (
      nullif(btrim(p_search), '') is null
      or p.name_ar ilike '%' || p_search || '%'
      or p.name_en ilike '%' || p_search || '%'
      or p.slug ilike '%' || p_search || '%'
      or p.product_type ilike '%' || p_search || '%'
      or p.short_description_ar ilike '%' || p_search || '%'
      or b.name_ar ilike '%' || p_search || '%'
      or b.name_en ilike '%' || p_search || '%'
      or c.name_ar ilike '%' || p_search || '%'
      or c.name_en ilike '%' || p_search || '%'
    )
  order by
    case when p_sort = 'featured' then p.featured end desc,
    case when p_sort = 'price-asc' then first_variant.price end asc,
    case when p_sort = 'price-desc' then first_variant.price end desc,
    p.created_at desc,
    p.id asc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.list_storefront_products_by_scope(
  text, text[], text[], boolean, text, text, integer, integer
) from public;

grant execute on function public.list_storefront_products_by_scope(
  text, text[], text[], boolean, text, text, integer, integer
) to anon, authenticated;

comment on function public.list_storefront_products_by_scope is
  'RLS-aware storefront listing constrained to supplements or fitness accessories.';

-- This function needs aggregate order history that is intentionally hidden from
-- storefront roles. SECURITY DEFINER is narrowly scoped to return public catalog
-- fields only; no order, customer, discount, or commission data can leave it.
create or replace function public.list_storefront_featured_products(
  p_limit integer default 4,
  p_exclude_slug text default null
)
returns table (
  id uuid,
  slug text,
  name_ar text,
  brand_name_ar text,
  category_slug text,
  product_type text,
  training_goal text,
  badge_label_ar text,
  featured boolean,
  variant_id uuid,
  variant_flavor_ar text,
  variant_weight_value numeric,
  variant_weight_unit text,
  variant_size_label_ar text,
  variant_servings integer,
  variant_price numeric,
  variant_compare_at_price numeric,
  variant_stock_quantity integer,
  in_stock boolean,
  image_storage_path text,
  image_external_url text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with sales as (
    select
      oi.product_id,
      sum(oi.quantity)::bigint as units_sold
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.status <> 'cancelled'
      and oi.product_id is not null
    group by oi.product_id
  ),
  stock as (
    select
      pv.product_id,
      sum(pv.stock_quantity)::bigint as available_stock
    from public.product_variants pv
    where pv.active = true
    group by pv.product_id
  )
  select
    p.id,
    p.slug,
    p.name_ar,
    b.name_ar as brand_name_ar,
    c.slug as category_slug,
    p.product_type,
    p.training_goal,
    p.badge_label_ar,
    p.featured,
    first_variant.id as variant_id,
    first_variant.flavor_ar as variant_flavor_ar,
    first_variant.weight_value as variant_weight_value,
    first_variant.weight_unit as variant_weight_unit,
    first_variant.size_label_ar as variant_size_label_ar,
    first_variant.servings as variant_servings,
    first_variant.price as variant_price,
    first_variant.compare_at_price as variant_compare_at_price,
    first_variant.stock_quantity as variant_stock_quantity,
    coalesce(stock.available_stock, 0) > 0 as in_stock,
    first_image.storage_path as image_storage_path,
    first_image.external_url as image_external_url,
    count(*) over () as total_count
  from public.products p
  join public.brands b
    on b.id = p.brand_id
   and b.active = true
  join public.categories c
    on c.id = p.category_id
   and c.active = true
  join lateral (
    select
      pv.id,
      pv.flavor_ar,
      pv.weight_value,
      pv.weight_unit,
      pv.size_label_ar,
      pv.servings,
      pv.price,
      pv.compare_at_price,
      pv.stock_quantity
    from public.product_variants pv
    where pv.product_id = p.id
      and pv.active = true
    order by
      (pv.stock_quantity > 0) desc,
      pv.sort_order asc,
      pv.id asc
    limit 1
  ) first_variant on true
  left join lateral (
    select
      pi.storage_path,
      pi.external_url
    from public.product_images pi
    where pi.product_id = p.id
      and (
        pi.variant_id is null
        or exists (
          select 1
          from public.product_variants image_variant
          where image_variant.id = pi.variant_id
            and image_variant.active = true
        )
      )
    order by
      (pi.variant_id is null) desc,
      pi.is_primary desc,
      pi.sort_order asc,
      pi.created_at asc,
      pi.id asc
    limit 1
  ) first_image on true
  left join sales on sales.product_id = p.id
  left join stock on stock.product_id = p.id
  where p.status = 'active'
    and (p_exclude_slug is null or p.slug <> p_exclude_slug)
  order by
    (coalesce(stock.available_stock, 0) > 0) desc,
    (
      coalesce(stock.available_stock, 0)::numeric
      / (coalesce(sales.units_sold, 0) + 1)
    ) desc,
    coalesce(sales.units_sold, 0) asc,
    coalesce(stock.available_stock, 0) desc,
    p.created_at desc,
    p.id asc
  limit least(greatest(p_limit, 1), 12);
$$;

revoke all on function public.list_storefront_featured_products(
  integer, text
) from public;

grant execute on function public.list_storefront_featured_products(
  integer, text
) to anon, authenticated;

comment on function public.list_storefront_featured_products is
  'Public catalog-only ranking that favors low non-cancelled sales and high active stock without exposing order history.';
