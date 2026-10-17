-- Migration: 20261017000001_complete_crud_and_rooms.sql
-- Description: Adds rooms, custom categories, payment methods, spending alerts,
-- soft deletion columns, RLS policies for updates/deletions, and atomic helper functions.

-- 1. Rooms table
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  icon text not null default 'home',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, name)
);
create index if not exists rooms_household_idx on public.rooms(household_id);

-- 2. Add columns to expenses
alter table public.expenses add column if not exists room_id uuid references public.rooms(id) on delete set null;
alter table public.expenses add column if not exists payment_method text not null default 'cash';
alter table public.expenses add column if not exists notes text not null default '';
alter table public.expenses add column if not exists deleted_at timestamptz;
create index if not exists expenses_room_idx on public.expenses(room_id);
create index if not exists expenses_deleted_idx on public.expenses(household_id, deleted_at);

-- 3. Add columns to recurring_bills
alter table public.recurring_bills add column if not exists notes text not null default '';
alter table public.recurring_bills add column if not exists deleted_at timestamptz;

-- 4. Add columns to shopping_items
alter table public.shopping_items add column if not exists category text not null default 'groc';
alter table public.shopping_items add column if not exists notes text not null default '';
alter table public.shopping_items add column if not exists deleted_at timestamptz;

-- 5. Add columns to savings_goals
alter table public.savings_goals add column if not exists category text not null default 'savings';
alter table public.savings_goals add column if not exists notes text not null default '';
alter table public.savings_goals add column if not exists deleted_at timestamptz;

-- 6. Add columns to settlements
alter table public.settlements add column if not exists notes text not null default '';
alter table public.settlements add column if not exists deleted_at timestamptz;

-- 7. Custom categories
create table if not exists public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  key text not null check (length(trim(key)) between 1 and 40),
  icon text not null default 'tag',
  color text not null default '#2563eb',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, key)
);
create index if not exists custom_categories_household_idx on public.custom_categories(household_id);

-- 8. Payment methods
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  key text not null check (length(trim(key)) between 1 and 40),
  icon text not null default 'card',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, key)
);
create index if not exists payment_methods_household_idx on public.payment_methods(household_id);

-- 9. Custom spending alerts
create table if not exists public.spending_alerts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 100),
  category text,
  threshold_amount numeric(12,2) not null check (threshold_amount > 0),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists spending_alerts_household_idx on public.spending_alerts(household_id);

-- 10. Enable Row Level Security on all new tables
alter table public.rooms enable row level security;
alter table public.custom_categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.spending_alerts enable row level security;

-- 11. RLS Policies for new tables
drop policy if exists "members manage rooms" on public.rooms;
create policy "members manage rooms" on public.rooms for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "members manage custom categories" on public.custom_categories;
create policy "members manage custom categories" on public.custom_categories for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "members manage payment methods" on public.payment_methods;
create policy "members manage payment methods" on public.payment_methods for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "members manage spending alerts" on public.spending_alerts;
create policy "members manage spending alerts" on public.spending_alerts for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- 12. RLS Update & Delete policies on existing tables
drop policy if exists "members update expenses" on public.expenses;
create policy "members update expenses" on public.expenses for update to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id) and
    exists (select 1 from public.household_members m where m.household_id = expenses.household_id and m.user_id = expenses.paid_by)
  );

drop policy if exists "members delete expenses" on public.expenses;
create policy "members delete expenses" on public.expenses for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members update bills" on public.recurring_bills;
create policy "members update bills" on public.recurring_bills for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "members delete bills" on public.recurring_bills;
create policy "members delete bills" on public.recurring_bills for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members update shopping" on public.shopping_items;
create policy "members update shopping" on public.shopping_items for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "members update goals" on public.savings_goals;
create policy "members update goals" on public.savings_goals for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "members delete goals" on public.savings_goals;
create policy "members delete goals" on public.savings_goals for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members delete contributions" on public.savings_contributions;
create policy "members delete contributions" on public.savings_contributions for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members update settlements" on public.settlements;
create policy "members update settlements" on public.settlements for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "members delete settlements" on public.settlements;
create policy "members delete settlements" on public.settlements for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "owners delete household" on public.households;
create policy "owners delete household" on public.households for delete to authenticated
  using (public.is_household_owner(id));

drop policy if exists "owners manage memberships" on public.household_members;
create policy "owners manage memberships" on public.household_members for all to authenticated
  using (public.is_household_owner(household_id) or user_id = auth.uid())
  with check (public.is_household_owner(household_id) or user_id = auth.uid());

-- 13. Grants for authenticated users
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.recurring_bills to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;
grant select, insert, update, delete on public.savings_goals to authenticated;
grant select, insert, update, delete on public.savings_contributions to authenticated;
grant select, insert, update, delete on public.settlements to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.custom_categories to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant select, insert, update, delete on public.spending_alerts to authenticated;
grant delete on public.households to authenticated;
grant insert, update, delete on public.household_members to authenticated;

-- 14. Audit triggers for new tables
drop trigger if exists rooms_audit on public.rooms;
create trigger rooms_audit after insert or update or delete on public.rooms for each row execute function public.log_household_change();

drop trigger if exists custom_categories_audit on public.custom_categories;
create trigger custom_categories_audit after insert or update or delete on public.custom_categories for each row execute function public.log_household_change();

drop trigger if exists payment_methods_audit on public.payment_methods;
create trigger payment_methods_audit after insert or update or delete on public.payment_methods for each row execute function public.log_household_change();

drop trigger if exists spending_alerts_audit on public.spending_alerts;
create trigger spending_alerts_audit after insert or update or delete on public.spending_alerts for each row execute function public.log_household_change();

-- 15. Safe Helper RPC functions
-- Safe room deletion: preserves transactions by reassigning to another room or set to null
create or replace function public.delete_room_safe(target_room_id uuid, reassign_to uuid default null)
returns boolean language plpgsql security definer set search_path = public
as $$
declare target_household uuid;
begin
  select household_id into target_household from public.rooms where id = target_room_id;
  if target_household is null or not public.is_household_member(target_household) then
    raise exception 'Room not found or unauthorized';
  end if;
  if reassign_to is not null then
    if not exists (select 1 from public.rooms where id = reassign_to and household_id = target_household and id <> target_room_id) then
      raise exception 'Reassignment room does not exist in this household';
    end if;
    update public.expenses set room_id = reassign_to where room_id = target_room_id;
  else
    update public.expenses set room_id = null where room_id = target_room_id;
  end if;
  delete from public.rooms where id = target_room_id;
  return true;
end $$;

-- Safe reverse settlement RPC
create or replace function public.reverse_settlement(target_settlement_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare record_household uuid;
begin
  select household_id into record_household from public.settlements where id = target_settlement_id;
  if record_household is null or not public.is_household_member(record_household) then
    raise exception 'Settlement record not found or unauthorized';
  end if;
  delete from public.settlements where id = target_settlement_id;
  return true;
end $$;

-- Safe leave household RPC: prevents last owner from leaving without transfer
create or replace function public.leave_household(target_household_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare user_role text; owner_count int;
begin
  select role into user_role from public.household_members where household_id = target_household_id and user_id = auth.uid();
  if user_role is null then raise exception 'You are not a member of this household'; end if;
  if user_role = 'owner' then
    select count(*) into owner_count from public.household_members where household_id = target_household_id and role = 'owner';
    if owner_count <= 1 then
      raise exception 'You are the only owner of this household. Transfer ownership to another member before leaving, or delete the household.';
    end if;
  end if;
  delete from public.household_members where household_id = target_household_id and user_id = auth.uid();
  return true;
end $$;

-- Safe delete household RPC (owner only)
create or replace function public.delete_household_safe(target_household_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_household_owner(target_household_id) then
    raise exception 'Only a household owner can delete the household';
  end if;
  delete from public.households where id = target_household_id;
  return true;
end $$;

grant execute on function public.delete_room_safe(uuid, uuid) to authenticated;
grant execute on function public.reverse_settlement(uuid) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.delete_household_safe(uuid) to authenticated;
