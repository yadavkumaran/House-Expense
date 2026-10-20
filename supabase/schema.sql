-- House Expense schema. Run in the Supabase SQL Editor before launching the app.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  language text not null default 'en' check (language in ('en', 'ta')),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  description text not null,
  occurred_on date not null default current_date,
  paid_by uuid not null references auth.users(id),
  funding text not null check (funding in ('personal', 'shared')),
  source text not null default 'manual' check (source in ('manual','receipt','recurring','grocery')),
  receipt_fingerprint text,
  grocery_item_id uuid,
  recurring_bill_id uuid,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (grocery_item_id),
  unique (recurring_bill_id, occurred_on)
);
create index if not exists expenses_household_date_idx on public.expenses(household_id, occurred_on desc);
create unique index if not exists expenses_receipt_fingerprint_uidx on public.expenses(household_id, receipt_fingerprint) where receipt_fingerprint is not null;

create table if not exists public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  updated_by uuid not null default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (household_id, category)
);

create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  paid_by uuid not null references auth.users(id),
  funding text not null default 'shared' check (funding in ('personal','shared')),
  cadence text not null check (cadence in ('weekly','monthly','yearly')),
  next_due date not null,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit text not null default '',
  estimated_unit_price numeric(12,2) check (estimated_unit_price is null or estimated_unit_price >= 0),
  purchased boolean not null default false,
  purchased_by uuid references auth.users(id),
  purchased_at timestamptz,
  expense_id uuid unique references public.expenses(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check ((purchased = false) or purchased_by is not null)
);
create index if not exists shopping_items_household_idx on public.shopping_items(household_id, purchased, created_at);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  deadline date,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  contributed_by uuid not null default auth.uid() references auth.users(id),
  contributed_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_user uuid not null references auth.users(id),
  to_user uuid not null references auth.users(id),
  amount numeric(12,2) not null check (amount > 0),
  settled_on date not null default current_date,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_events_household_created_idx on public.activity_events(household_id, created_at desc);

create or replace function public.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.household_members m where m.household_id = target_household and m.user_id = auth.uid()) $$;

create or replace function public.is_household_owner(target_household uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.household_members m where m.household_id = target_household and m.user_id = auth.uid() and m.role = 'owner') $$;
revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;

create or replace function public.create_household(household_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if length(trim(household_name)) not between 1 and 80 then raise exception 'Household name must be 1 to 80 characters'; end if;
  insert into public.households(name, created_by) values (trim(household_name), auth.uid()) returning id into new_id;
  insert into public.household_members(household_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;

create or replace function public.join_household(invite text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare target_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select id into target_id from public.households where invite_code = upper(trim(invite));
  if target_id is null then raise exception 'That invite code was not found'; end if;
  insert into public.household_members(household_id, user_id) values (target_id, auth.uid()) on conflict do nothing;
  return target_id;
end $$;

drop function if exists public.add_bill_payment(uuid, date);
drop function if exists public.add_bill_payment(uuid, numeric, date);
create or replace function public.add_bill_payment(bill_id uuid, actual_amount numeric, actual_paid_by uuid, actual_funding text, paid_on date default current_date)
returns uuid language plpgsql security definer set search_path = public
as $$
declare bill public.recurring_bills%rowtype; expense_id uuid; next_date date;
begin
  select * into bill from public.recurring_bills where id = bill_id and active for update;
  if not found or not public.is_household_member(bill.household_id) then raise exception 'Bill not found in this household'; end if;
  if paid_on < bill.next_due then raise exception 'This bill is not due yet'; end if;
  if actual_amount is null or actual_amount <= 0 then raise exception 'Enter the actual amount paid'; end if;
  if actual_funding not in ('personal','shared') or not exists (
    select 1 from public.household_members m where m.household_id = bill.household_id and m.user_id = actual_paid_by
  ) then raise exception 'Select an actual payer and valid funding source'; end if;
  insert into public.expenses(household_id, amount, category, description, occurred_on, paid_by, funding, source, recurring_bill_id)
    values (bill.household_id, actual_amount, bill.category, bill.title, paid_on, actual_paid_by, actual_funding, 'recurring', bill.id)
    on conflict (recurring_bill_id, occurred_on) do nothing returning id into expense_id;
  if expense_id is null then raise exception 'This bill payment has already been recorded'; end if;
  next_date := case bill.cadence
    when 'weekly' then bill.next_due + 7
    when 'monthly' then (bill.next_due + interval '1 month')::date
    else (bill.next_due + interval '1 year')::date
  end;
  update public.recurring_bills set next_due = next_date where id = bill.id;
  return expense_id;
end $$;

drop function if exists public.convert_shopping_item(uuid, numeric, uuid, text);
create or replace function public.convert_shopping_item(item_id uuid, actual_unit_price numeric, paid_by_user uuid, funding_source text, purchased_on date default current_date)
returns uuid language plpgsql security definer set search_path = public
as $$
declare item public.shopping_items%rowtype; new_expense_id uuid;
begin
  select * into item from public.shopping_items where id = item_id for update;
  if not found or not public.is_household_member(item.household_id) then raise exception 'Shopping item not found in this household'; end if;
  if not item.purchased then raise exception 'Mark the item as purchased before converting it'; end if;
  if actual_unit_price is null or actual_unit_price <= 0 or paid_by_user <> auth.uid() or funding_source not in ('personal','shared') then raise exception 'Enter the actual price paid and valid purchase details'; end if;
  if item.expense_id is not null then return item.expense_id; end if;
  insert into public.expenses(household_id, amount, category, description, occurred_on, paid_by, funding, source, grocery_item_id)
    values (item.household_id, actual_unit_price * item.quantity, 'groc', item.name, purchased_on, paid_by_user, funding_source, 'grocery', item.id)
    on conflict (grocery_item_id) do nothing returning id into new_expense_id;
  if new_expense_id is null then select e.id into new_expense_id from public.expenses e where e.grocery_item_id = item.id; end if;
  update public.shopping_items set expense_id = new_expense_id where id = item.id;
  return new_expense_id;
end $$;

drop function if exists public.record_settlement(uuid, uuid, numeric, date);
create function public.record_settlement(
  household uuid,
  other_user uuid,
  paid_amount numeric,
  payment_date date default current_date,
  payment_notes text default ''
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  settlement_id uuid;
  total_personal numeric;
  total_sent numeric;
  total_returned numeric;
  outstanding numeric;
begin
  if not public.is_household_owner(household) then
    raise exception 'Only the household owner can record reimbursements';
  end if;
  if not public.is_household_member(household) or not exists (select 1 from public.household_members where household_id = household and user_id = other_user) then
    raise exception 'Settlement members must belong to this household';
  end if;
  if paid_amount is null or paid_amount <= 0 or paid_amount <> round(paid_amount, 2)
    or other_user = auth.uid() or payment_date is null or payment_date > current_date then
    raise exception 'Invalid settlement amount, date, or member';
  end if;
  if length(coalesce(payment_notes, '')) > 100 then raise exception 'Settlement notes must be 100 characters or fewer'; end if;

  perform 1 from public.households h where h.id = household for update;
  select coalesce(sum(e.amount), 0) into total_personal
    from public.expenses e
    where e.household_id = household and e.paid_by = other_user and e.funding = 'personal' and e.deleted_at is null;
  select
    coalesce(sum(s.amount) filter (where s.from_user = auth.uid() and s.to_user = other_user), 0),
    coalesce(sum(s.amount) filter (where s.from_user = other_user and s.to_user = auth.uid()), 0)
    into total_sent, total_returned
    from public.settlements s
    where s.household_id = household and s.deleted_at is null;
  outstanding := greatest(0, total_personal - greatest(0, total_sent - total_returned));
  if paid_amount > outstanding then raise exception 'Settlement exceeds the outstanding personal reimbursement balance'; end if;

  insert into public.settlements(household_id, from_user, to_user, amount, settled_on, notes)
    values (household, auth.uid(), other_user, paid_amount, payment_date, coalesce(payment_notes, ''))
    returning id into settlement_id;
  return settlement_id;
end $$;

revoke all on function public.create_household(text) from public;
revoke all on function public.join_household(text) from public;
revoke all on function public.add_bill_payment(uuid, numeric, uuid, text, date) from public;
revoke all on function public.convert_shopping_item(uuid, numeric, uuid, text, date) from public;
revoke all on function public.record_settlement(uuid, uuid, numeric, date, text) from public;

create or replace function public.log_household_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare room_id uuid; record_id text; event_details jsonb;
begin
  if tg_op = 'DELETE' then room_id := old.household_id; record_id := old.id::text;
    event_details := jsonb_build_object('before', to_jsonb(old));
  elsif tg_op = 'UPDATE' then room_id := new.household_id; record_id := new.id::text;
    event_details := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
  else room_id := new.household_id; record_id := new.id::text;
    event_details := jsonb_build_object('after', to_jsonb(new));
  end if;
  insert into public.activity_events(household_id, actor_id, action, entity, entity_id, details)
    values (room_id, auth.uid(), lower(tg_op), tg_table_name, record_id, event_details);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists expenses_audit on public.expenses;
create trigger expenses_audit after insert or update or delete on public.expenses for each row execute function public.log_household_change();
drop trigger if exists budgets_audit on public.category_budgets;
create trigger budgets_audit after insert or update or delete on public.category_budgets for each row execute function public.log_household_change();
drop trigger if exists bills_audit on public.recurring_bills;
create trigger bills_audit after insert or update or delete on public.recurring_bills for each row execute function public.log_household_change();
drop trigger if exists shopping_audit on public.shopping_items;
create trigger shopping_audit after insert or update or delete on public.shopping_items for each row execute function public.log_household_change();
drop trigger if exists goals_audit on public.savings_goals;
create trigger goals_audit after insert or update or delete on public.savings_goals for each row execute function public.log_household_change();
drop trigger if exists contributions_audit on public.savings_contributions;
create trigger contributions_audit after insert or update or delete on public.savings_contributions for each row execute function public.log_household_change();
drop trigger if exists settlements_audit on public.settlements;
create trigger settlements_audit after insert or update or delete on public.settlements for each row execute function public.log_household_change();

alter table public.user_profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.expenses enable row level security;
alter table public.category_budgets enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.shopping_items enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_contributions enable row level security;
alter table public.settlements enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "profile self select" on public.user_profiles;
drop policy if exists "profile household select" on public.user_profiles;
create policy "profile household select" on public.user_profiles for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = user_profiles.user_id
  )
);
drop policy if exists "profile self insert" on public.user_profiles;
create policy "profile self insert" on public.user_profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "profile self update" on public.user_profiles;
create policy "profile self update" on public.user_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "household members read room" on public.households;
create policy "household members read room" on public.households for select to authenticated using (public.is_household_member(id));
drop policy if exists "owners update room" on public.households;
create policy "owners update room" on public.households for update to authenticated using (public.is_household_owner(id)) with check (public.is_household_owner(id));
drop policy if exists "members read membership" on public.household_members;
create policy "members read membership" on public.household_members for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "owners manage memberships" on public.household_members;

drop policy if exists "members read expenses" on public.expenses;
create policy "members read expenses" on public.expenses for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "members add expenses" on public.expenses;
create policy "members add expenses" on public.expenses for insert to authenticated with check (
  public.is_household_member(household_id) and created_by = auth.uid() and
  source in ('manual','receipt') and recurring_bill_id is null and grocery_item_id is null and
  exists (select 1 from public.household_members m where m.household_id = expenses.household_id and m.user_id = expenses.paid_by)
);
drop policy if exists "members manage budgets" on public.category_budgets;
create policy "members manage budgets" on public.category_budgets for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and updated_by = auth.uid());
drop policy if exists "members manage bills" on public.recurring_bills;
create policy "members manage bills" on public.recurring_bills for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "members add bills" on public.recurring_bills;
create policy "members add bills" on public.recurring_bills for insert to authenticated with check (public.is_household_member(household_id) and created_by = auth.uid() and exists (select 1 from public.household_members m where m.household_id = recurring_bills.household_id and m.user_id = recurring_bills.paid_by));
drop policy if exists "members manage shopping" on public.shopping_items;
drop policy if exists "members read shopping" on public.shopping_items;
create policy "members read shopping" on public.shopping_items for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "members add shopping" on public.shopping_items;
create policy "members add shopping" on public.shopping_items for insert to authenticated with check (public.is_household_member(household_id) and created_by = auth.uid());
drop policy if exists "members update shopping" on public.shopping_items;
create policy "members update shopping" on public.shopping_items for update to authenticated using (public.is_household_member(household_id)) with check (
  public.is_household_member(household_id) and
  (purchased_by is null or exists (select 1 from public.household_members m where m.household_id = shopping_items.household_id and m.user_id = shopping_items.purchased_by))
);
drop policy if exists "members delete shopping" on public.shopping_items;
create policy "members delete shopping" on public.shopping_items for delete to authenticated using (public.is_household_member(household_id));
drop policy if exists "members manage goals" on public.savings_goals;
create policy "members manage goals" on public.savings_goals for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and created_by = auth.uid());
drop policy if exists "members manage contributions" on public.savings_contributions;
create policy "members manage contributions" on public.savings_contributions for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id) and contributed_by = auth.uid() and exists (select 1 from public.savings_goals g where g.id = savings_contributions.goal_id and g.household_id = savings_contributions.household_id));
drop policy if exists "members read settlements" on public.settlements;
create policy "members read settlements" on public.settlements for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "members add settlements" on public.settlements;
drop policy if exists "members update settlements" on public.settlements;
drop policy if exists "members read activity" on public.activity_events;
create policy "members read activity" on public.activity_events for select to authenticated using (public.is_household_member(household_id));

grant select, insert, update on public.user_profiles to authenticated;
grant select on public.households to authenticated;
grant update(name) on public.households to authenticated;
grant delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.category_budgets to authenticated;
revoke update on public.category_budgets from authenticated;
grant update(monthly_limit, updated_by, updated_at) on public.category_budgets to authenticated;
grant select, insert, update, delete on public.recurring_bills to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;
grant select, insert, update, delete on public.savings_goals, public.savings_contributions to authenticated;
grant select, insert, update, delete on public.settlements to authenticated;
revoke insert, update on public.settlements from authenticated;
grant select on public.activity_events to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.add_bill_payment(uuid, numeric, uuid, text, date) to authenticated;
grant execute on function public.convert_shopping_item(uuid, numeric, uuid, text, date) to authenticated;
grant execute on function public.record_settlement(uuid, uuid, numeric, date, text) to authenticated;

-- Rooms table
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

-- Optional columns on existing tables
alter table public.expenses add column if not exists room_id uuid references public.rooms(id) on delete set null;
alter table public.expenses add column if not exists payment_method text not null default 'cash';
alter table public.expenses add column if not exists notes text not null default '';
alter table public.expenses add column if not exists deleted_at timestamptz;
create index if not exists expenses_room_idx on public.expenses(room_id);
create index if not exists expenses_deleted_idx on public.expenses(household_id, deleted_at);

alter table public.recurring_bills add column if not exists notes text not null default '';
alter table public.recurring_bills add column if not exists deleted_at timestamptz;

alter table public.shopping_items add column if not exists category text not null default 'groc';
alter table public.shopping_items add column if not exists notes text not null default '';
alter table public.shopping_items add column if not exists deleted_at timestamptz;

alter table public.savings_goals add column if not exists category text not null default 'savings';
alter table public.savings_goals add column if not exists notes text not null default '';
alter table public.savings_goals add column if not exists deleted_at timestamptz;

alter table public.settlements add column if not exists notes text not null default '';
alter table public.settlements add column if not exists deleted_at timestamptz;

-- Custom categories & payment methods
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

drop trigger if exists rooms_audit on public.rooms;
create trigger rooms_audit after insert or update or delete on public.rooms for each row execute function public.log_household_change();
drop trigger if exists custom_categories_audit on public.custom_categories;
create trigger custom_categories_audit after insert or update or delete on public.custom_categories for each row execute function public.log_household_change();
drop trigger if exists payment_methods_audit on public.payment_methods;
create trigger payment_methods_audit after insert or update or delete on public.payment_methods for each row execute function public.log_household_change();
drop trigger if exists spending_alerts_audit on public.spending_alerts;
create trigger spending_alerts_audit after insert or update or delete on public.spending_alerts for each row execute function public.log_household_change();

alter table public.rooms enable row level security;
alter table public.custom_categories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.spending_alerts enable row level security;

create policy "members manage rooms" on public.rooms for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage custom categories" on public.custom_categories for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage payment methods" on public.payment_methods for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage spending alerts" on public.spending_alerts for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

drop policy if exists "members update expenses" on public.expenses;
create policy "members update expenses" on public.expenses for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id) and exists (select 1 from public.household_members m where m.household_id = expenses.household_id and m.user_id = expenses.paid_by));

drop policy if exists "members delete expenses" on public.expenses;
create policy "members delete expenses" on public.expenses for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members update bills" on public.recurring_bills;
create policy "members update bills" on public.recurring_bills for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

drop policy if exists "members delete bills" on public.recurring_bills;
create policy "members delete bills" on public.recurring_bills for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members update goals" on public.savings_goals;
create policy "members update goals" on public.savings_goals for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

drop policy if exists "members delete goals" on public.savings_goals;
create policy "members delete goals" on public.savings_goals for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members delete contributions" on public.savings_contributions;
create policy "members delete contributions" on public.savings_contributions for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "members update settlements" on public.settlements;
create policy "members update settlements" on public.settlements for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

drop policy if exists "members delete settlements" on public.settlements;
create policy "owners delete settlements" on public.settlements for delete to authenticated
  using (public.is_household_owner(household_id));

drop policy if exists "owners delete household" on public.households;
create policy "owners delete household" on public.households for delete to authenticated
  using (public.is_household_owner(id));

grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.custom_categories to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant select, insert, update, delete on public.spending_alerts to authenticated;

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

do $$
declare realtime_table text;
begin
  foreach realtime_table in array array[
    'expenses', 'category_budgets', 'recurring_bills', 'shopping_items',
    'savings_goals', 'savings_contributions', 'settlements', 'activity_events',
    'household_members', 'households', 'rooms', 'custom_categories',
    'payment_methods', 'spending_alerts'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end $$;
