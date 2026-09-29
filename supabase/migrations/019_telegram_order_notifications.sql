-- Make Telegram the active order-alert channel while preserving historical
-- WhatsApp outbox rows and functions. This migration is intentionally not
-- applied here.

alter table public.admin_notification_outbox
  drop constraint if exists admin_notification_outbox_channel_check;

alter table public.admin_notification_outbox
  alter column channel set default 'telegram';

alter table public.admin_notification_outbox
  add constraint admin_notification_outbox_channel_check
  check (channel in ('whatsapp', 'telegram'));

drop trigger if exists orders_enqueue_whatsapp_notification on public.orders;

create or replace function public.enqueue_order_telegram_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_notification_outbox (order_id, channel)
  values (new.id, 'telegram')
  on conflict (order_id, channel) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_order_telegram_notification() from public;

create trigger orders_enqueue_telegram_notification
after insert on public.orders
for each row execute function public.enqueue_order_telegram_notification();

create or replace function public.claim_admin_telegram_notification(p_order_id uuid)
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
    and channel = 'telegram'
  for update;

  if not found then
    raise exception 'Notification job not found' using errcode = 'P0002';
  end if;

  if v_job.status = 'sent' then
    return jsonb_build_object(
      'id', v_job.id,
      'order_id', v_job.order_id,
      'status', v_job.status
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
    'status', 'sending'
  );
end;
$$;

revoke all on function public.claim_admin_telegram_notification(uuid) from public;
grant execute on function public.claim_admin_telegram_notification(uuid) to authenticated;

create or replace function public.complete_admin_telegram_notification(
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
    where id = p_outbox_id
      and channel = 'telegram'
      and status = 'sending';
  else
    update public.admin_notification_outbox
    set status = 'failed',
        sent_at = null,
        last_error = left(
          coalesce(nullif(btrim(p_error), ''), 'Telegram delivery failed'),
          500
        )
    where id = p_outbox_id
      and channel = 'telegram'
      and status = 'sending';
  end if;

  select status into v_status
  from public.admin_notification_outbox
  where id = p_outbox_id
    and channel = 'telegram';

  if not found then
    raise exception 'Notification job not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', p_outbox_id, 'status', v_status);
end;
$$;

revoke all on function public.complete_admin_telegram_notification(uuid, boolean, text) from public;
grant execute on function public.complete_admin_telegram_notification(uuid, boolean, text) to authenticated;

create or replace function public.claim_checkout_telegram_notification(
  p_order_id uuid,
  p_checkout_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.admin_notification_outbox%rowtype;
  v_order public.orders%rowtype;
  v_payload jsonb;
begin
  if p_order_id is null or p_checkout_idempotency_key is null then
    raise exception 'Checkout notification authorization failed' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and checkout_idempotency_key = p_checkout_idempotency_key;

  if not found then
    raise exception 'Checkout notification authorization failed' using errcode = '42501';
  end if;

  select * into v_job
  from public.admin_notification_outbox
  where order_id = p_order_id
    and channel = 'telegram'
  for update;

  if not found then
    raise exception 'Notification job not found' using errcode = 'P0002';
  end if;

  if v_job.status = 'sent' then
    return jsonb_build_object(
      'id', v_job.id,
      'order_id', v_job.order_id,
      'status', v_job.status
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

  select jsonb_build_object(
    'order_number', v_order.order_number,
    'created_at', v_order.created_at,
    'customer_full_name', v_order.customer_full_name,
    'customer_phone', v_order.customer_phone,
    'customer_city', v_order.customer_city,
    'customer_address', v_order.customer_address,
    'customer_notes', v_order.customer_notes,
    'currency', v_order.currency,
    'subtotal', v_order.subtotal,
    'code_snapshot', v_order.code_snapshot,
    'customer_discount_percent_snapshot', v_order.customer_discount_percent_snapshot,
    'discount_amount', v_order.discount_amount,
    'total', v_order.total,
    'status', v_order.status,
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'product_name_snapshot', oi.product_name_snapshot,
            'variant_description_snapshot', oi.variant_description_snapshot,
            'sku_snapshot', oi.sku_snapshot,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'line_total', oi.line_total
          ) order by oi.created_at, oi.id
        ),
        '[]'::jsonb
      )
      from public.order_items oi
      where oi.order_id = v_order.id
    ),
    'athlete', (
      select jsonb_build_object('display_name', a.display_name)
      from public.athletes a
      where a.id = v_order.athlete_id
    ),
    'commission', (
      select jsonb_build_object(
        'commission_percent', c.commission_percent,
        'commission_amount', c.commission_amount
      )
      from public.commissions c
      where c.order_id = v_order.id
      limit 1
    )
  ) into v_payload;

  return jsonb_build_object(
    'id', v_job.id,
    'order_id', v_job.order_id,
    'status', 'sending',
    'payload', v_payload
  );
end;
$$;

revoke all on function public.claim_checkout_telegram_notification(uuid, uuid) from public;
grant execute on function public.claim_checkout_telegram_notification(uuid, uuid) to anon, authenticated;

create or replace function public.complete_checkout_telegram_notification(
  p_outbox_id uuid,
  p_order_id uuid,
  p_checkout_idempotency_key uuid,
  p_success boolean,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not exists (
    select 1
    from public.orders
    where id = p_order_id
      and checkout_idempotency_key = p_checkout_idempotency_key
  ) then
    raise exception 'Checkout notification authorization failed' using errcode = '42501';
  end if;

  if p_success then
    update public.admin_notification_outbox
    set status = 'sent', sent_at = now(), last_error = null
    where id = p_outbox_id
      and order_id = p_order_id
      and channel = 'telegram'
      and status = 'sending';
  else
    update public.admin_notification_outbox
    set status = 'failed',
        sent_at = null,
        last_error = left(
          coalesce(nullif(btrim(p_error), ''), 'Telegram delivery failed'),
          500
        )
    where id = p_outbox_id
      and order_id = p_order_id
      and channel = 'telegram'
      and status = 'sending';
  end if;

  select status into v_status
  from public.admin_notification_outbox
  where id = p_outbox_id
    and order_id = p_order_id
    and channel = 'telegram';

  if not found then
    raise exception 'Notification job not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', p_outbox_id, 'status', v_status);
end;
$$;

revoke all on function public.complete_checkout_telegram_notification(uuid, uuid, uuid, boolean, text) from public;
grant execute on function public.complete_checkout_telegram_notification(uuid, uuid, uuid, boolean, text) to anon, authenticated;

comment on function public.claim_checkout_telegram_notification(uuid, uuid) is
  'Checkout-bound Telegram dispatch claim. The idempotency key authorizes only the matching order; destination, content, and provider credentials remain server-controlled.';
