create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'admin'
      and p.active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'brands', 'categories', 'products', 'product_variants',
    'product_images', 'inventory_movements', 'athletes', 'discount_codes',
    'discount_code_categories', 'discount_code_products',
    'orders', 'order_items', 'commissions', 'commission_payouts',
    'commission_payout_items'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['athletes', 'discount_codes']
  loop
    execute format(
      'create policy admin_manage_without_delete on public.%I for select to authenticated using (public.is_admin())',
      table_name
    );
    execute format(
      'create policy admin_insert on public.%I for insert to authenticated with check (public.is_admin())',
      table_name
    );
    execute format(
      'create policy admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['discount_code_categories', 'discount_code_products']
  loop
    execute format(
      'create policy admin_manage_scope_targets on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inventory_movements', 'orders', 'order_items', 'commissions',
    'commission_payouts', 'commission_payout_items'
  ]
  loop
    execute format(
      'create policy admin_read_history on public.%I for select to authenticated using (public.is_admin())',
      table_name
    );
  end loop;
end;
$$;

create policy profiles_read_own on public.profiles
for select to authenticated
using (user_id = (select auth.uid()));

create policy storefront_read_active_brands on public.brands
for select to anon, authenticated
using (active = true);

create policy storefront_read_active_categories on public.categories
for select to anon, authenticated
using (active = true);

create policy storefront_read_active_products on public.products
for select to anon, authenticated
using (
  status = 'active'
  and exists (select 1 from public.brands b where b.id = brand_id and b.active = true)
  and exists (select 1 from public.categories c where c.id = category_id and c.active = true)
);

create policy storefront_read_active_variants on public.product_variants
for select to anon, authenticated
using (
  active = true
  and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
);

create policy storefront_read_active_product_images on public.product_images
for select to anon, authenticated
using (
  exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
  and (
    variant_id is null
    or exists (select 1 from public.product_variants pv where pv.id = variant_id and pv.active = true)
  )
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'brands', 'categories', 'products', 'product_variants', 'product_images'
  ]
  loop
    execute format(
      'create policy admin_full_access on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      table_name
    );
  end loop;
end;
$$;

revoke all on table public.athletes, public.discount_codes,
  public.discount_code_categories, public.discount_code_products, public.orders,
  public.order_items, public.commissions, public.commission_payouts,
  public.commission_payout_items, public.inventory_movements, public.profiles
from anon;

grant select on table public.brands, public.categories, public.products,
  public.product_variants, public.product_images
to anon, authenticated;

grant all on table public.profiles, public.brands, public.categories, public.products,
  public.product_variants, public.product_images, public.inventory_movements,
  public.athletes, public.discount_codes, public.discount_code_categories,
  public.discount_code_products, public.orders, public.order_items,
  public.commissions, public.commission_payouts, public.commission_payout_items
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

comment on function public.is_admin is 'Authoritative database role check backed by auth.uid() and profiles; never inferred from client state.';
