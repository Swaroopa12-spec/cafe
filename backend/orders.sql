-- Run once in the Supabase SQL Editor. Safe to rerun if the table already exists.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  customer_email text,
  customer_name text,
  customer_phone text,
  fulfillment_type text not null default 'pickup',
  order_note text,
  fulfillment_status text not null default 'new',
  total_amount integer not null,
  currency text not null,
  payment_status text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Add the operational fields when upgrading an existing orders table.
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists fulfillment_type text not null default 'pickup';
alter table public.orders add column if not exists order_note text;
alter table public.orders add column if not exists fulfillment_status text not null default 'new';

create index if not exists orders_created_at_idx on public.orders (created_at desc);
alter table public.orders enable row level security;
-- Do not add public access policies. Only the server's service-role key writes orders.
