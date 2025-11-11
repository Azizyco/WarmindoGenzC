-- Add RPC to safely update orders.proof_url using payment_code
-- Run this in Supabase SQL Editor

create or replace function public.update_order_proof_url(
  p_payment_code text,
  p_proof_url text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  select id, payment_method, status into v_order
  from public.orders
  where payment_code = p_payment_code;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  -- Allow non-cash methods; adjust as needed
  if v_order.payment_method not in ('qris','transfer','ewallet') then
    raise exception 'METHOD_NOT_ALLOWED';
  end if;

  -- Optional: block closed orders
  if v_order.status in ('completed','canceled') then
    raise exception 'ORDER_CLOSED';
  end if;

  update public.orders
  set proof_url = p_proof_url,
      updated_at = now()
  where id = v_order.id;

  return json_build_object('id', v_order.id, 'proof_url', p_proof_url);
end
$$;

grant execute on function public.update_order_proof_url(text, text) to anon;
