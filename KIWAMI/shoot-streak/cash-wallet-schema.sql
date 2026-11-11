-- DODGE CORE wallet: persistent in-game cash balance
-- Run this once in Supabase Dashboard > SQL Editor.
-- Existing player profile RLS policies already allow an authenticated player
-- to update only their own profile row.

alter table public.player_profiles
  add column if not exists cash_balance bigint not null default 0;

alter table public.player_profiles
  drop constraint if exists player_profiles_cash_balance_nonnegative;

alter table public.player_profiles
  add constraint player_profiles_cash_balance_nonnegative
  check (cash_balance >= 0);

comment on column public.player_profiles.cash_balance is
  'DODGE CORE soft currency wallet balance. Cash is earned from completed runs.';
