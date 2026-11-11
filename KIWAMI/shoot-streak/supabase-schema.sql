-- DODGE CORE player accounts and cloud progression
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- The browser uses only the public anon key. Never expose a service_role key.

create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'PLAYER',
  total_xp bigint not null default 0 check (total_xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

drop policy if exists "Players can read their own profile" on public.player_profiles;
create policy "Players can read their own profile"
on public.player_profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Players can create their own profile" on public.player_profiles;
create policy "Players can create their own profile"
on public.player_profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Players can update their own profile" on public.player_profiles;
create policy "Players can update their own profile"
on public.player_profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.create_dodge_core_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.player_profiles (id, username)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), 'PLAYER')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_dodge_core on auth.users;
create trigger on_auth_user_created_dodge_core
after insert on auth.users
for each row execute procedure public.create_dodge_core_profile();

create or replace function public.set_dodge_core_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_dodge_core_profile_updated_at on public.player_profiles;
create trigger set_dodge_core_profile_updated_at
before update on public.player_profiles
for each row execute procedure public.set_dodge_core_updated_at();

-- Note: RLS prevents users from reading or writing other players' rows.
-- Client-submitted XP is not tamper-proof; competitive leaderboards need
-- server-validated score submissions before trusting progression.
