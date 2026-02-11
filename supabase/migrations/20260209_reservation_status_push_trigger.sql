-- Push notification trigger when reservation status changes
-- Uses pg_net to call the Edge Function.

create extension if not exists pg_net;

create or replace function public.notify_reservation_status()
returns trigger
language plpgsql
as $$
declare
  url text := 'https://njlvwcizwgzpnzqwrnjh.functions.supabase.co/push-reservation-status';
  payload jsonb;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status is distinct from old.status and new.user_id is not null then
    payload := jsonb_build_object(
      'reservation_id', new.id,
      'user_id', new.user_id,
      'status', new.status,
      'vendor_id', new.vendor_id,
      'canceled_by', new.canceled_by
    );

    perform net.http_post(
      url,
      payload,
      '{}'::jsonb,
      '{"Content-Type":"application/json"}'::jsonb,
      10000
    );
  end if;

  return new;
end;
$$;

drop trigger if exists reservation_status_notify on public.reservations;

create trigger reservation_status_notify
after update of status on public.reservations
for each row
execute function public.notify_reservation_status();
