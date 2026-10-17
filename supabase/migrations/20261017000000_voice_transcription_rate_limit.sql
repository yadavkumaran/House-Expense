create table if not exists public.voice_transcription_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  request_times timestamptz[] not null default '{}'::timestamptz[]
);

alter table public.voice_transcription_rate_limits enable row level security;
revoke all on public.voice_transcription_rate_limits from anon, authenticated;

create or replace function public.consume_voice_transcription_quota()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  active_requests timestamptz[];
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.voice_transcription_rate_limits (user_id)
  values (actor_id)
  on conflict (user_id) do nothing;

  select request_times into active_requests
  from public.voice_transcription_rate_limits
  where user_id = actor_id
  for update;

  select coalesce(array_agg(requested_at order by requested_at), '{}'::timestamptz[])
  into active_requests
  from unnest(active_requests) as requests(requested_at)
  where requested_at > now() - interval '1 hour';

  if cardinality(active_requests) >= 10 then
    update public.voice_transcription_rate_limits
    set request_times = active_requests
    where user_id = actor_id;
    return false;
  end if;

  update public.voice_transcription_rate_limits
  set request_times = array_append(active_requests, now())
  where user_id = actor_id;

  return true;
end;
$$;

revoke all on function public.consume_voice_transcription_quota() from public, anon;
grant execute on function public.consume_voice_transcription_quota() to authenticated;
