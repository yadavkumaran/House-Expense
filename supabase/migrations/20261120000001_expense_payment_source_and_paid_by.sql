-- Migration: Add payment_source and ensure robust paid_by validation on expenses
-- Values: PERSONAL, SHARED_HOUSEHOLD
-- Default: PERSONAL

alter table public.expenses
  add column if not exists payment_source text check (payment_source in ('PERSONAL', 'SHARED_HOUSEHOLD'));

-- Backfill existing records:
update public.expenses
  set payment_source = case
    when funding = 'shared' then 'SHARED_HOUSEHOLD'
    else 'PERSONAL'
  end
  where payment_source is null;

-- Set default to PERSONAL and make not null
alter table public.expenses
  alter column payment_source set default 'PERSONAL';

alter table public.expenses
  alter column payment_source set not null;

-- Add index on (household_id, paid_by, payment_source) for fast member/source filtering
create index if not exists expenses_household_payer_source_idx
  on public.expenses(household_id, paid_by, payment_source);

-- Synchronize recurring_bills as well so future generated expenses have payment_source
alter table public.recurring_bills
  add column if not exists payment_source text check (payment_source in ('PERSONAL', 'SHARED_HOUSEHOLD'));

update public.recurring_bills
  set payment_source = case
    when funding = 'shared' then 'SHARED_HOUSEHOLD'
    else 'PERSONAL'
  end
  where payment_source is null;

alter table public.recurring_bills
  alter column payment_source set default 'PERSONAL';
