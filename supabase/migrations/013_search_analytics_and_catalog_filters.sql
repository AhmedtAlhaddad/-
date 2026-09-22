-- Privacy-minimal aggregate search analytics and catalog brand/type filtering.
-- This migration is intentionally not applied by this change.

create table public.storefront_search_terms (
  normalized_term text primary key,
  search_count bigint not null default 1 check (search_count > 0),
  last_searched_at timestamptz not null default now(),
  check (length(normalized_term) between 2 and 100)
);

create index storefront_search_terms_popular_idx
  on public.storefront_search_terms (
    search_count desc,
    last_searched_at desc,
    normalized_term asc
  );

alter table public.storefront_search_terms enable row level security;

create policy storefront_read_aggregate_search_terms
on public.storefront_search_terms
for select
to anon, authenticated
using (true);

revoke all on table public.storefront_search_terms from public, anon, authenticated;
grant select on table public.storefront_search_terms to anon, authenticated;

create function public.record_storefront_search(p_term text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_term text;
begin
  v_term := lower(
    regexp_replace(
      btrim(coalesce(p_term, '')),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );

  if length(v_term) < 2
    or length(v_term) > 100
    or v_term !~ '[[:alpha:]]'
    or v_term ~ '[0-9]{6,}'
    or position('@' in v_term) > 0
    or v_term ~ '(https?://|www\.)' then
    raise exception 'Search term is not eligible for aggregate analytics'
      using errcode = '22023';
  end if;

  insert into public.storefront_search_terms (
    normalized_term,
    search_count,
    last_searched_at
  ) values (
    v_term,
    1,
    now()
  )
  on conflict (normalized_term) do update
  set search_count = public.storefront_search_terms.search_count + 1,
      last_searched_at = excluded.last_searched_at;
end;
$$;

revoke all on function public.record_storefront_search(text) from public;
grant execute on function public.record_storefront_search(text) to anon, authenticated;

create function public.list_popular_storefront_searches(
  p_limit integer default 8
)
returns table (
  normalized_term text,
  search_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select terms.normalized_term, terms.search_count
  from public.storefront_search_terms terms
  order by
    terms.search_count desc,
    terms.last_searched_at desc,
    terms.normalized_term asc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.list_popular_storefront_searches(integer) from public;
grant execute on function public.list_popular_storefront_searches(integer) to anon, authenticated;

comment on table public.storefront_search_terms is
  'Aggregate normalized search terms only; stores no user, network, device, or request identifiers.';
comment on function public.record_storefront_search(text) is
  'Controlled aggregate increment with length, meaningful-content, and common-PII rejection.';

create function public.list_storefront_products_v2(
  p_product_scope text default null,
  p_category_slugs text[] default null,
  p_brand_slugs text[] default null,
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
  badge_label_ar text,
  featured boolean,
  variant_id uuid,
  variant_flavor_ar text,
  variant_color_ar text,
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
    p.badge_label_ar,
    p.featured,
    first_variant.id as variant_id,
    first_variant.flavor_ar as variant_flavor_ar,
    first_variant.attributes ->> 'color_ar' as variant_color_ar,
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
  join public.brands b on b.id = p.brand_id and b.active = true
  join public.categories c on c.id = p.category_id and c.active = true
  join lateral (
    select
      pv.id,
      pv.flavor_ar,
      pv.attributes,
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
    select pi.storage_path, pi.external_url
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
      p_product_scope is null
      or (
        p_product_scope = 'supplements'
        and coalesce(p.product_type, '') not in ('fitness-accessory', 'apparel')
      )
      or (
        p_product_scope = 'accessories'
        and p.product_type in ('fitness-accessory', 'apparel')
      )
    )
    and (
      p_category_slugs is null
      or cardinality(p_category_slugs) = 0
      or c.slug = any (p_category_slugs)
    )
    and (
      p_brand_slugs is null
      or cardinality(p_brand_slugs) = 0
      or b.slug = any (p_brand_slugs)
    )
    and (
      p_training_goals is null
      or cardinality(p_training_goals) = 0
      or exists (
        select 1
        from public.product_training_goals ptg
        where ptg.product_id = p.id
          and ptg.goal = any (p_training_goals)
      )
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

revoke all on function public.list_storefront_products_v2(
  text, text[], text[], text[], boolean, text, text, integer, integer
) from public;
grant execute on function public.list_storefront_products_v2(
  text, text[], text[], text[], boolean, text, text, integer, integer
) to anon, authenticated;

comment on function public.list_storefront_products_v2 is
  'Cached-storefront catalog query with category, active-brand, goal, availability, search, and product-family filters.';
