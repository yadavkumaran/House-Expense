create or replace function public.delete_user_account()
returns void language plpgsql security definer set search_path = public
as $$
declare
  owned_household_id uuid;
  other_owners int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Check households where current user is owner
  for owned_household_id in
    select household_id from public.household_members
    where user_id = auth.uid() and role = 'owner'
  loop
    select count(*) into other_owners from public.household_members
    where household_id = owned_household_id and role = 'owner' and user_id <> auth.uid();

    if other_owners = 0 then
      -- If caller is the sole owner, delete the entire household (cascades records)
      delete from public.households where id = owned_household_id;
    else
      -- If there are other owners, remove self from the household
      delete from public.household_members where household_id = owned_household_id and user_id = auth.uid();
    end if;
  end loop;

  -- Remove membership from any remaining households
  delete from public.household_members where user_id = auth.uid();

  -- Delete user profile
  delete from public.profiles where user_id = auth.uid();

  -- Delete user from auth.users
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_user_account() to authenticated;
