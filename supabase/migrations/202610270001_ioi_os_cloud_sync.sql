create table if not exists public.ioi_os_cloud_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision >= 1),
  client_updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ioi_os_cloud_state_object check (jsonb_typeof(state) = 'object'),
  constraint ioi_os_cloud_state_size check (octet_length(state::text) <= 1000000)
);

alter table public.ioi_os_cloud_state enable row level security;

drop policy if exists "ioi_os_select_own_state" on public.ioi_os_cloud_state;
create policy "ioi_os_select_own_state" on public.ioi_os_cloud_state for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "ioi_os_insert_own_state" on public.ioi_os_cloud_state;
create policy "ioi_os_insert_own_state" on public.ioi_os_cloud_state for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "ioi_os_update_own_state" on public.ioi_os_cloud_state;
create policy "ioi_os_update_own_state" on public.ioi_os_cloud_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "ioi_os_delete_own_state" on public.ioi_os_cloud_state;
create policy "ioi_os_delete_own_state" on public.ioi_os_cloud_state for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.ioi_os_cloud_state to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ioi_os_cloud_state'
  ) then alter publication supabase_realtime add table public.ioi_os_cloud_state; end if;
end $$;

create or replace function public.ioi_os_merge_cloud_state(p_state jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid(); v_existing jsonb; v_merged jsonb; v_topics jsonb := '{}'::jsonb;
  v_key text; v_local_topic jsonb; v_remote_topic jsonb; v_sessions jsonb; v_days jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 1000000 then raise exception 'Invalid or oversized IOI OS state'; end if;
  select state into v_existing from public.ioi_os_cloud_state where user_id = v_user_id for update;
  if v_existing is null then
    insert into public.ioi_os_cloud_state(user_id,state,revision,client_updated_at,server_updated_at) values(v_user_id,p_state,1,now(),now()) on conflict(user_id) do nothing;
    select state into v_existing from public.ioi_os_cloud_state where user_id = v_user_id for update;
  end if;
  for v_key in select key from jsonb_object_keys(coalesce(v_existing->'topics','{}'::jsonb) || coalesce(p_state->'topics','{}'::jsonb)) as keys(key) loop
    v_local_topic := coalesce(p_state->'topics'->v_key,'{}'::jsonb); v_remote_topic := coalesce(v_existing->'topics'->v_key,'{}'::jsonb);
    if v_local_topic = '{}'::jsonb then v_topics := v_topics || jsonb_build_object(v_key,v_remote_topic);
    elsif v_remote_topic = '{}'::jsonb then v_topics := v_topics || jsonb_build_object(v_key,v_local_topic);
    elsif coalesce(v_local_topic->>'updatedAt','') <> '' or coalesce(v_remote_topic->>'updatedAt','') <> '' then
      v_topics := v_topics || jsonb_build_object(v_key,case when coalesce(nullif(v_local_topic->>'updatedAt',''),'epoch')::timestamptz >= coalesce(nullif(v_remote_topic->>'updatedAt',''),'epoch')::timestamptz then v_local_topic else v_remote_topic end);
    else
      v_topics := v_topics || jsonb_build_object(v_key,v_remote_topic || v_local_topic || jsonb_build_object(
        'playlistDone',coalesce((v_remote_topic->>'playlistDone')::boolean,false) or coalesce((v_local_topic->>'playlistDone')::boolean,false),
        'solved',(select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) from (select distinct value from jsonb_array_elements(coalesce(v_remote_topic->'solved','[]'::jsonb)) union select distinct value from jsonb_array_elements(coalesce(v_local_topic->'solved','[]'::jsonb))) s)));
    end if;
  end loop;
  select coalesce(jsonb_agg(item order by item->>'createdAt'),'[]'::jsonb) into v_sessions from (
    select distinct on (coalesce(item->>'createdAt',md5(item::text))) item from (
      select value as item from jsonb_array_elements(coalesce(v_existing->'sessions','[]'::jsonb)) union all
      select value as item from jsonb_array_elements(coalesce(p_state->'sessions','[]'::jsonb))
    ) all_sessions order by coalesce(item->>'createdAt',md5(item::text)),item::text
  ) deduped;
  select coalesce(jsonb_agg(to_jsonb(day) order by day),'[]'::jsonb) into v_days from (
    select distinct value #>> '{}' as day from (
      select value from jsonb_array_elements(coalesce(v_existing->'activeDays','[]'::jsonb)) union all
      select value from jsonb_array_elements(coalesce(p_state->'activeDays','[]'::jsonb))
    ) all_days
  ) days;
  v_merged := v_existing || p_state || jsonb_build_object('topics',v_topics,'sessions',v_sessions,'activeDays',v_days,'preferences',coalesce(v_existing->'preferences','{}'::jsonb) || coalesce(p_state->'preferences','{}'::jsonb));
  insert into public.ioi_os_cloud_state(user_id,state,revision,client_updated_at,server_updated_at) values(v_user_id,v_merged,1,now(),now())
  on conflict(user_id) do update set state=excluded.state,revision=public.ioi_os_cloud_state.revision+1,client_updated_at=now(),server_updated_at=now();
  return v_merged;
end; $$;
revoke all on function public.ioi_os_merge_cloud_state(jsonb) from public, anon;
grant execute on function public.ioi_os_merge_cloud_state(jsonb) to authenticated;
