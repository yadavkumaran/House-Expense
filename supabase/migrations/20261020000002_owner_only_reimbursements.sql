create or replace function public.record_settlement(
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
  if not public.is_household_member(household)
    or not exists (
      select 1 from public.household_members
      where household_id = household and user_id = other_user
    ) then
    raise exception 'Settlement members must belong to this household';
  end if;

  if paid_amount is null or paid_amount <= 0 or paid_amount <> round(paid_amount, 2)
    or other_user = auth.uid() or payment_date is null or payment_date > current_date then
    raise exception 'Invalid settlement amount, date, or member';
  end if;
  if length(coalesce(payment_notes, '')) > 100 then
    raise exception 'Settlement notes must be 100 characters or fewer';
  end if;

  perform 1 from public.households h where h.id = household for update;

  select coalesce(sum(e.amount), 0) into total_personal
  from public.expenses e
  where e.household_id = household
    and e.paid_by = other_user
    and e.funding = 'personal'
    and e.deleted_at is null;

  select
    coalesce(sum(s.amount) filter (where s.from_user = auth.uid() and s.to_user = other_user), 0),
    coalesce(sum(s.amount) filter (where s.from_user = other_user and s.to_user = auth.uid()), 0)
  into total_sent, total_returned
  from public.settlements s
  where s.household_id = household and s.deleted_at is null;

  outstanding := greatest(0, total_personal - greatest(0, total_sent - total_returned));
  if paid_amount > outstanding then
    raise exception 'Settlement exceeds the outstanding personal reimbursement balance';
  end if;

  insert into public.settlements(household_id, from_user, to_user, amount, settled_on, notes)
  values (household, auth.uid(), other_user, paid_amount, payment_date, coalesce(payment_notes, ''))
  returning id into settlement_id;
  return settlement_id;
end
$$;

revoke all on function public.record_settlement(uuid, uuid, numeric, date, text) from public;
grant execute on function public.record_settlement(uuid, uuid, numeric, date, text) to authenticated;

revoke insert, update on public.settlements from authenticated;
drop policy if exists "members add settlements" on public.settlements;
drop policy if exists "members update settlements" on public.settlements;

drop policy if exists "members delete settlements" on public.settlements;
drop policy if exists "owners delete settlements" on public.settlements;
create policy "owners delete settlements" on public.settlements for delete to authenticated
  using (public.is_household_owner(household_id));
