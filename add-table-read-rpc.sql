-- Read RPCs for tables (RLS-safe)
-- Run this in Supabase SQL Editor

create or replace function public.get_empty_tables()
returns table(label text, capacity smallint, status public.table_status)
language sql
security definer
set search_path = public
as $$
  select label, capacity, status
  from public.tables
  where status = 'empty'
  order by label asc;
$$;

grant execute on function public.get_empty_tables() to anon;
