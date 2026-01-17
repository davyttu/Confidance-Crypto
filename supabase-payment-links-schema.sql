-- Payment links schema
-- Run in Supabase SQL editor

create table if not exists public.payment_links (
  id text primary key,
  creator_address text not null,
  amount text not null,
  token_symbol text not null,
  token_address text,
  payment_type text not null, -- instant | scheduled | recurring
  frequency text, -- monthly | weekly
  periods integer,
  start_at bigint,
  execute_at bigint,
  chain_id integer not null,
  description text,
  status text not null default 'pending', -- pending | active | paid | expired | cancelled
  first_month_amount text,
  is_first_month_custom boolean not null default false,
  payer_address text,
  device_id text,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_links_creator_idx on public.payment_links (creator_address);
create index if not exists payment_links_status_idx on public.payment_links (status);
create index if not exists payment_links_chain_idx on public.payment_links (chain_id);
