-- Admin-only WhatsApp order notification outbox.
-- This migration is intentionally not applied here.

create table public.admin_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (order_id, channel),
  check (status <> 'sent' or sent_at is not null),
  check (status = 'sent' or sent_at is null)
);

create index admin_notification_outbox_pending_idx
  on public.admin_notification_outbox (status, created_at)
  where status in ('pending', 'failed');

create or replace function public.set_admin_notification_outbox_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger admin_notification_outbox_set_updated_at
before update on public.admin_notification_outbox
for each row execute function public.set_admin_notification_outbox_updated_at();

create or replace function public.enqueue_order_whatsapp_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_notification_outbox (order_id, channel)
  values (new.id, 'whatsapp')
  on conflict (order_id, channel) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_order_whatsapp_notification() from public;

create trigger orders_enqueue_whatsapp_notification
after insert on public.orders
for each row execute function public.enqueue_order_whatsapp_notification();

alter table public.admin_notification_outbox enable row level security;

revoke all on table public.admin_notification_outbox from anon, authenticated;
grant select, update on table public.admin_notification_outbox to authenticated;

create policy admin_notification_outbox_admin_read
on public.admin_notification_outbox
for select
to authenticated
using (public.is_admin());

create policy admin_notification_outbox_admin_update
on public.admin_notification_outbox
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.claim_admin_whatsapp_notification(p_order_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.admin_notification_outbox%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select * into v_job
  from public.admin_notification_outbox
  where order_id = p_order_id
    and channel = 'whatsapp'
  for update;

  if not found then
    raise exception 'Notification job not found' using errcode = 'P0002';
  end if;

  if v_job.status = 'sent' then
    return jsonb_build_object(
      'id', v_job.id,
      'order_id', v_job.order_id,
      'status', v_job.status,
      'attempt_count', v_job.attempt_count,
      'sent_at', v_job.sent_at
    );
  end if;

  if v_job.status = 'sending'
    and v_job.updated_at > now() - interval '10 minutes' then
    raise exception 'Notification is already being sent' using errcode = '55P03';
  end if;

  update public.admin_notification_outbox
  set status = 'sending',
      attempt_count = attempt_count + 1,
      last_error = null,
      sent_at = null
  where id = v_job.id;

  return jsonb_build_object(
    'id', v_job.id,
    'order_id', v_job.order_id,
    'status', 'sending',
    'attempt_count', v_job.attempt_count + 1
  );
end;
$$;

revoke all on function public.claim_admin_whatsapp_notification(uuid) from public;
grant execute on function public.claim_admin_whatsapp_notification(uuid) to authenticated;

create or replace function public.complete_admin_whatsapp_notification(
  p_outbox_id uuid,
  p_success boolean,
  p_error text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  if p_success then
    update public.admin_notification_outbox
    set status = 'sent', sent_at = now(), last_error = null
    where id = p_outbox_id and status = 'sending';
  else
    update public.admin_notification_outbox
    set status = 'failed',
        sent_at = null,
        last_error = left(coalesce(nullif(btrim(p_error), ''), 'WhatsApp delivery failed'), 500)
    where id = p_outbox_id and status = 'sending';
  end if;

  select status into v_status
  from public.admin_notification_outbox
  where id = p_outbox_id;

  if not found then
    raise exception 'Notification job not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', p_outbox_id, 'status', v_status);
end;
$$;

revoke all on function public.complete_admin_whatsapp_notification(uuid, boolean, text) from public;
grant execute on function public.complete_admin_whatsapp_notification(uuid, boolean, text) to authenticated;

comment on table public.admin_notification_outbox is
  'Admin-only durable notification jobs. Order history is the source of truth; no provider credentials are stored here.';
