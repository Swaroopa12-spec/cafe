-- Run this once in Supabase SQL Editor to save successful Stripe payments.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  customer_email text,
  total_amount integer not null,
  currency text not null,
  payment_status text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
-- Do not add public policies. The service role key is only used by the API webhook.

