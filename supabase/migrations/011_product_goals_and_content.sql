-- Normalize product training goals and add optional storefront content.
-- This migration is intentionally local-only until it is reviewed and applied.

alter table public.products
  add column nutrition_facts text,
  add column usage_instructions text;

alter table public.products
  add constraint products_nutrition_facts_length_check
    check (
      nutrition_facts is null
      or length(btrim(nutrition_facts)) between 1 and 10000
    ),
  add constraint products_usage_instructions_length_check
    check (
      usage_instructions is null
      or length(btrim(usage_instructions)) between 1 and 10000
    );

create table public.product_training_goals (
  product_id uuid not null references public.products(id) on delete cascade,
  goal text not null check (
    goal in ('muscle-building', 'energy-endurance', 'weight-management')
  ),
  created_at timestamptz not null default now(),
  primary key (product_id, goal)
);

create index product_training_goals_goal_product_idx
  on public.product_training_goals (goal, product_id);

insert into public.product_training_goals (product_id, goal)
select
  p.id,
  case
    when p.training_goal in ('muscle-support', 'muscle-building')
      then 'muscle-building'
    when p.training_goal in ('energy', 'energy-endurance')
      then 'energy-endurance'
    when p.training_goal = 'weight-management'
      then 'weight-management'
  end
from public.products p
where p.training_goal in (
  'muscle-support',
  'muscle-building',
  'energy',
  'energy-endurance',
  'weight-management'
)
on conflict do nothing;

comment on column public.products.training_goal is
  'Deprecated compatibility column retained for historical data. Use public.product_training_goals.';

comment on table public.product_training_goals is
  'Normalized many-to-many product assignment for the three storefront training goals.';

alter table public.product_training_goals enable row level security;

create policy storefront_read_product_training_goals
on public.product_training_goals
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    join public.brands b on b.id = p.brand_id and b.active = true
    join public.categories c on c.id = p.category_id and c.active = true
    where p.id = product_id
      and p.status = 'active'
  )
);

create policy admin_manage_product_training_goals
on public.product_training_goals
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on table public.product_training_goals to anon, authenticated;
grant insert, update, delete on table public.product_training_goals to authenticated;

create or replace function public.set_product_training_goals(
  p_product_id uuid,
  p_goals text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_goals, array[]::text[])) as requested(goal)
    where requested.goal is null
       or requested.goal <> all (
         array['muscle-building', 'energy-endurance', 'weight-management']::text[]
       )
  ) then
    raise exception 'Invalid training goal' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
  ) then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  delete from public.product_training_goals ptg
  where ptg.product_id = p_product_id;

  insert into public.product_training_goals (product_id, goal)
  select p_product_id, requested.goal
  from (
    select distinct goal
    from unnest(coalesce(p_goals, array[]::text[])) as goals(goal)
  ) requested;
end;
$$;

revoke all on function public.set_product_training_goals(uuid, text[]) from public;
grant execute on function public.set_product_training_goals(uuid, text[]) to authenticated;

comment on function public.set_product_training_goals is
  'Admin-only atomic replacement of normalized product training-goal assignments.';

create or replace function public.list_storefront_products(
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
    null::text as training_goal,
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
  join public.brands b on b.id = p.brand_id and b.active = true
  join public.categories c on c.id = p.category_id and c.active = true
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
      p_category_slugs is null
      or cardinality(p_category_slugs) = 0
      or c.slug = any (p_category_slugs)
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

revoke all on function public.list_storefront_products(
  text[], text[], boolean, text, text, integer, integer
) from public;
grant execute on function public.list_storefront_products(
  text[], text[], boolean, text, text, integer, integer
) to anon, authenticated;

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
    null::text as training_goal,
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
  join public.brands b on b.id = p.brand_id and b.active = true
  join public.categories c on c.id = p.category_id and c.active = true
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

revoke all on function public.list_storefront_products_by_scope(
  text, text[], text[], boolean, text, text, integer, integer
) from public;
grant execute on function public.list_storefront_products_by_scope(
  text, text[], text[], boolean, text, text, integer, integer
) to anon, authenticated;
