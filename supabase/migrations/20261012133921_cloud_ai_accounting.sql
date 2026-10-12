-- Prepared for hosted review; application generation remains disabled until verified.
begin;
alter table public.ai_configurations add column synthetic_data boolean not null default false;
alter table public.ai_configurations add column daily_call_limit integer not null default 30 check(daily_call_limit between 1 and 30);
create table private.ai_requests(
 id uuid primary key,org_id uuid not null,conversation_id uuid not null,actor_id uuid not null,
 period_start date not null,created_at timestamptz not null default now(),
 foreign key(org_id,conversation_id) references public.conversations(org_id,id)
);
create index ai_requests_quota on private.ai_requests(org_id,period_start);
alter table private.ai_requests enable row level security;
create table private.ai_attempts(
 id uuid primary key,request_id uuid not null references private.ai_requests(id),org_id uuid not null,
 created_at timestamptz not null default now(),completed_at timestamptz,
 status text not null default 'pending' check(status in ('pending','succeeded','failed')),
 input_tokens bigint check(input_tokens>=0),output_tokens bigint check(output_tokens>=0),total_tokens bigint check(total_tokens>=0),
 error_code text check(error_code in ('timeout','429','503','provider_error','validation_error'))
);
create index ai_attempts_daily on private.ai_attempts(created_at,org_id);
alter table private.ai_attempts enable row level security;
revoke all on private.ai_requests,private.ai_attempts from public,anon,authenticated;

-- Only a trusted server worker may allocate provider calls or report measured usage.
-- The actor is independently checked; a service credential alone is not tenant authorization.
create function private.reserve_ai_attempt(p_actor uuid,p_org uuid,p_conversation uuid,p_request uuid,p_attempt uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare config public.ai_configurations; sub public.subscriptions; plan public.subscription_plans;
 previous private.ai_requests; quota integer; period date; previous_attempt private.ai_attempts;
begin
 if p_actor is null or p_request is null or p_attempt is null or not exists(select 1 from public.organization_members where org_id=p_org and user_id=p_actor) then raise exception 'Workspace permission denied' using errcode='42501';end if;
 -- Serialize the small development ledger globally to enforce the shared daily ceiling.
 perform pg_advisory_xact_lock(7212026);
 if not exists(select 1 from public.conversations where org_id=p_org and id=p_conversation and not paused) then raise exception 'Conversation missing or paused';end if;
 select * into config from public.ai_configurations where org_id=p_org;
 if config.org_id is null or config.provider<>'gemini' or not config.synthetic_data or config.paused or config.mode='manual' then raise exception 'Gemini consent unavailable';end if;
 select * into sub from public.subscriptions where org_id=p_org;
 if sub.org_id is null or not ((sub.status='trial' and sub.trial_end>now()) or (sub.status='active' and sub.period_end>now()) or (sub.status='grace' and sub.grace_end>now())) then raise exception 'Subscription inactive';end if;
 select * into plan from public.subscription_plans where code=sub.plan;
 if config.mode='automatic' and not coalesce((plan.features->>'automatic')::boolean,false) then raise exception 'Automation unavailable';end if;
 quota:=case when sub.status='trial' then 30 else plan.reply_limit end;
 period:=case when sub.status='trial' then (sub.trial_end-interval '7 days')::date else date_trunc('month',now() at time zone 'UTC')::date end;
 select * into previous from private.ai_requests where id=p_request;
 if found and (previous.org_id<>p_org or previous.conversation_id<>p_conversation or previous.actor_id<>p_actor) then raise exception 'AI request ID already used';end if;
 select * into previous_attempt from private.ai_attempts where id=p_attempt;
 if found then
  if previous_attempt.request_id<>p_request or previous_attempt.org_id<>p_org then raise exception 'Attempt ID already used';end if;
  -- Never interpret a replayed reservation as permission to call the provider again.
  raise exception 'Attempt already reserved';
 end if;
 if previous.id is null then
  if (select count(*) from private.ai_requests where org_id=p_org and period_start=period)>=quota then raise exception 'Reply quota reached';end if;
  insert into private.ai_requests(id,org_id,conversation_id,actor_id,period_start) values(p_request,p_org,p_conversation,p_actor,period);
 else
  if previous.period_start<>period then raise exception 'AI request belongs to an earlier period';end if;
  -- Only one completed 503 attempt can authorize a second, separately counted call.
  if (select count(*) from private.ai_attempts where request_id=p_request)<>1 or not exists(select 1 from private.ai_attempts where request_id=p_request and status='failed' and error_code='503') then raise exception 'Retry unavailable';end if;
 end if;
 if (select count(*) from private.ai_attempts where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=100 then raise exception 'Global daily provider limit reached';end if;
 if (select count(*) from private.ai_attempts where org_id=p_org and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=config.daily_call_limit then raise exception 'Daily provider limit reached';end if;
 insert into private.ai_attempts(id,request_id,org_id) values(p_attempt,p_request,p_org);
 return p_attempt;
end $$;
create function private.finish_ai_attempt(p_attempt uuid,p_input bigint,p_output bigint,p_total bigint,p_error text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_error is not null and p_error not in ('timeout','429','503','provider_error','validation_error') then raise exception 'Invalid diagnostic';end if;
 if p_input<0 or p_output<0 or p_total<0 then raise exception 'Invalid usage';end if;
 update private.ai_attempts set input_tokens=p_input,output_tokens=p_output,total_tokens=p_total,error_code=p_error,status=case when p_error is null then 'succeeded' else 'failed' end,completed_at=now() where id=p_attempt and status='pending';
 if not found then raise exception 'Pending attempt not found';end if;
end $$;
create function public.rp_reserve_ai_attempt(p_actor uuid,p_org uuid,p_conversation uuid,p_request uuid,p_attempt uuid) returns uuid language sql security invoker set search_path='' as $$select private.reserve_ai_attempt(p_actor,p_org,p_conversation,p_request,p_attempt)$$;
create function public.rp_finish_ai_attempt(p_attempt uuid,p_input bigint,p_output bigint,p_total bigint,p_error text) returns void language sql security invoker set search_path='' as $$select private.finish_ai_attempt(p_attempt,p_input,p_output,p_total,p_error)$$;
revoke all on function private.reserve_ai_attempt(uuid,uuid,uuid,uuid,uuid),private.finish_ai_attempt(uuid,bigint,bigint,bigint,text),public.rp_reserve_ai_attempt(uuid,uuid,uuid,uuid,uuid),public.rp_finish_ai_attempt(uuid,bigint,bigint,bigint,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.reserve_ai_attempt(uuid,uuid,uuid,uuid,uuid),private.finish_ai_attempt(uuid,bigint,bigint,bigint,text),public.rp_reserve_ai_attempt(uuid,uuid,uuid,uuid,uuid),public.rp_finish_ai_attempt(uuid,bigint,bigint,bigint,text) to service_role;
commit;
