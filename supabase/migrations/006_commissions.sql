create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  discount_code_id uuid references public.discount_codes(id) on delete set null,
  code_snapshot text not null check (length(btrim(code_snapshot)) > 0),
  scope_snapshot text not null check (scope_snapshot in ('global', 'category', 'product')),
  base_subtotal numeric(12,3) not null check (base_subtotal >= 0),
  commission_percent numeric(5,2) not null check (commission_percent between 0 and 100),
  commission_amount numeric(12,3) not null check (commission_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'void')),
  approved_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (commission_amount = round(base_subtotal * commission_percent / 100, 3)),
  check (status <> 'approved' or approved_at is not null),
  check (status <> 'paid' or paid_at is not null),
  check (status <> 'void' or voided_at is not null)
);

create table public.commission_payouts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  currency text not null default 'LYD' check (currency = 'LYD'),
  total_amount numeric(12,3) not null check (total_amount > 0),
  payment_reference text,
  notes text,
  paid_at timestamptz not null default now(),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.commission_payout_items (
  payout_id uuid not null references public.commission_payouts(id) on delete restrict,
  commission_id uuid not null unique references public.commissions(id) on delete restrict,
  amount numeric(12,3) not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (payout_id, commission_id)
);

create index commissions_athlete_status_idx on public.commissions (athlete_id, status, created_at desc);
create index commissions_order_id_idx on public.commissions (order_id);
create index commission_payouts_athlete_paid_idx on public.commission_payouts (athlete_id, paid_at desc);
create index commission_payout_items_payout_idx on public.commission_payout_items (payout_id);

create trigger commissions_set_updated_at before update on public.commissions
for each row execute function public.set_updated_at();

create or replace function public.protect_commission_history_and_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_id is distinct from old.order_id
    or new.athlete_id is distinct from old.athlete_id
    or new.discount_code_id is distinct from old.discount_code_id
    or new.code_snapshot is distinct from old.code_snapshot
    or new.scope_snapshot is distinct from old.scope_snapshot
    or new.base_subtotal is distinct from old.base_subtotal
    or new.commission_percent is distinct from old.commission_percent
    or new.commission_amount is distinct from old.commission_amount then
    raise exception 'Historical commission calculation fields are immutable' using errcode = '55000';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'pending' and new.status in ('approved', 'void'))
    or (old.status = 'approved' and new.status in ('paid', 'void'))
  ) then
    raise exception 'Invalid commission status transition: % to %', old.status, new.status using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger commissions_protect_history_and_transition
before update on public.commissions
for each row execute function public.protect_commission_history_and_transition();

create or replace function public.validate_commission_payout_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_payout_athlete_id uuid;
  v_commission_athlete_id uuid;
  v_commission_amount numeric(12,3);
  v_commission_status text;
begin
  select athlete_id into v_payout_athlete_id
  from public.commission_payouts where id = new.payout_id;

  select athlete_id, commission_amount, status
    into v_commission_athlete_id, v_commission_amount, v_commission_status
  from public.commissions where id = new.commission_id;

  if v_payout_athlete_id is distinct from v_commission_athlete_id then
    raise exception 'Payout and commission must belong to the same athlete';
  end if;
  if v_commission_status not in ('approved', 'paid') then
    raise exception 'Only approved commissions may be paid';
  end if;

  new.amount := v_commission_amount;
  return new;
end;
$$;

create trigger commission_payout_item_validate
before insert or update on public.commission_payout_items
for each row execute function public.validate_commission_payout_item();

create trigger commission_payouts_immutable
before update or delete on public.commission_payouts
for each row execute function public.prevent_immutable_row_change();
create trigger commission_payout_items_immutable
before update or delete on public.commission_payout_items
for each row execute function public.prevent_immutable_row_change();

comment on table public.commissions is 'Historical amount is based on the original qualifying subtotal, before customer discount, and never recomputed later.';
comment on table public.commission_payout_items is 'Join ledger allowing one athlete payout to settle multiple commissions exactly once.';
