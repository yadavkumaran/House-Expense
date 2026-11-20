-- Migration: Household Member Nicknames and Aliases for Voice Input Accuracy
-- Securely stores family-specific spoken nicknames mapped to member user_ids.
-- Strictly scoped to each household via RLS; never shared across households.

create table if not exists public.household_member_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  alias text not null check (length(trim(alias)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (household_id, alias)
);

alter table public.household_member_aliases enable row level security;

create policy "members read household aliases"
  on public.household_member_aliases for select
  using (exists (
    select 1 from public.household_members m
    where m.household_id = household_member_aliases.household_id
      and m.user_id = auth.uid()
  ));

create policy "members insert household aliases"
  on public.household_member_aliases for insert
  with check (
    exists (
      select 1 from public.household_members m
      where m.household_id = household_member_aliases.household_id
        and m.user_id = auth.uid()
    )
    and exists (
      select 1 from public.household_members m2
      where m2.household_id = household_member_aliases.household_id
        and m2.user_id = household_member_aliases.user_id
    )
  );

create policy "members delete household aliases"
  on public.household_member_aliases for delete
  using (exists (
    select 1 from public.household_members m
    where m.household_id = household_member_aliases.household_id
      and m.user_id = auth.uid()
  ));

create index if not exists household_member_aliases_lookup_idx
  on public.household_member_aliases (household_id, alias);
