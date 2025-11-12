-- Table Management (Meja) Migration
-- Run this in Supabase SQL Editor
-- Creates enum, tables, indexes, and seed rows for meja management

-- 1) ENUM: public.table_status → 'empty' | 'occupied' | 'reserved' | 'blocked'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'table_status'
  ) THEN
    CREATE TYPE public.table_status AS ENUM ('empty','occupied','reserved','blocked');
  END IF;
END$$;

-- 2) TABLE: public.tables
CREATE TABLE IF NOT EXISTS public.tables (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label text UNIQUE NOT NULL,
  capacity smallint NOT NULL DEFAULT 2 CHECK (capacity > 0),
  status public.table_status NOT NULL DEFAULT 'empty',
  note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
DO $$
BEGIN
  -- status index
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_tables_status' AND n.nspname='public'
  ) THEN
    CREATE INDEX idx_tables_status ON public.tables(status);
  END IF;

  -- label unique index (explicit named)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_tables_label' AND n.nspname='public'
  ) THEN
    CREATE UNIQUE INDEX idx_tables_label ON public.tables(label);
  END IF;
END$$;

-- 3) TABLE: public.table_moves (log perpindahan)
CREATE TABLE IF NOT EXISTS public.table_moves (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL,
  from_label text,
  to_label text NOT NULL,
  reason text,
  actor_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Indexes for table_moves
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_table_moves_order' AND n.nspname='public'
  ) THEN
    CREATE INDEX idx_table_moves_order ON public.table_moves(order_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_table_moves_time' AND n.nspname='public'
  ) THEN
    CREATE INDEX idx_table_moves_time ON public.table_moves(created_at);
  END IF;
END$$;

-- 4) Seed contoh tables: ('1','2','3','4')
INSERT INTO public.tables(label)
VALUES ('1'),('2'),('3'),('4')
ON CONFLICT (label) DO NOTHING;

-- Notes:
-- - No RLS policies are defined here. Add RLS as needed for your app roles.
-- - No foreign keys added to keep it flexible (e.g., orders.id, profiles.id). Add as needed:
--   ALTER TABLE public.table_moves
--     ADD CONSTRAINT table_moves_order_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- 5) RPC: occupy table when an order is placed (atomic, RLS-safe)
create or replace function public.occupy_table_for_order(
  p_table_label text,
  p_order_id uuid,
  p_reason text default 'order placed',
  p_actor_id uuid default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  -- ensure table exists
  if not exists (select 1 from public.tables where label = p_table_label) then
    raise exception 'TABLE_NOT_FOUND';
  end if;

  -- atomic transition: only if currently empty
  update public.tables
  set status = 'occupied',
      updated_at = now()
  where label = p_table_label
    and status = 'empty';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  if v_rows = 0 then
    raise exception 'TABLE_NOT_EMPTY';
  end if;

  -- log move
  insert into public.table_moves(order_id, from_label, to_label, reason, actor_id)
  values (p_order_id, null, p_table_label, p_reason, p_actor_id);

  return json_build_object(
    'order_id', p_order_id,
    'table_label', p_table_label,
    'status', 'occupied'
  );
end
$$;

grant execute on function public.occupy_table_for_order(text, uuid, text, uuid) to anon;
