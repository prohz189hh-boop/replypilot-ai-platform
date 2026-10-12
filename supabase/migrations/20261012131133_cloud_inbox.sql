begin;
alter table public.conversations add column preferred_locale text check(preferred_locale in ('en','ckb','bad','ar'));
alter table public.conversations add column intake_fingerprint text;
create index messages_history_cursor on public.messages(org_id,conversation_id,created_at desc,id desc);

create function private.intake_conversation(p_org uuid,p_request uuid,p_name text,p_body text,p_locale text) returns uuid
language plpgsql security definer set search_path='' as $$
declare customer uuid; fingerprint text; previous public.conversations;
begin
 perform private.require_member(p_org);
 perform 1 from public.organizations where id=p_org for update;
 if p_request is null or p_name is null or length(btrim(p_name)) not between 2 and 100 or p_body is null or length(btrim(p_body)) not between 1 and 2000 or p_locale is null or p_locale not in ('en','ckb','bad','ar') then raise exception 'Invalid conversation input';end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(btrim(p_name),btrim(p_body),p_locale)::text,'UTF8')),'hex');
 select * into previous from public.conversations where id=p_request;
 if found then
  if previous.org_id<>p_org or previous.intake_fingerprint is distinct from fingerprint then raise exception 'Conversation request ID already used';end if;
  return previous.id;
 end if;
 perform private.require_active(p_org);
 insert into public.customers(org_id,display_name,locale) values(p_org,btrim(p_name),p_locale) returning id into customer;
 -- Staff intake has no public bearer-token login. No token hash is returned by the API.
 insert into public.conversations(id,org_id,customer_id,channel,token_hash,status,locale,intake_fingerprint)
 values(p_request,p_org,customer,'staff_intake','disabled','unread',p_locale,fingerprint);
 insert into public.messages(org_id,conversation_id,role,body,provider,external_id) values(p_org,p_request,'customer',btrim(p_body),'staff-intake','intake:'||p_request);
 insert into public.audit_events(org_id,actor_id,action,target_id) values(p_org,auth.uid(),'conversation.intake',p_request);
 return p_request;
end $$;

create function private.reply_conversation(p_org uuid,p_conversation uuid,p_request uuid,p_body text,p_note boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare previous public.messages; reply_role text;
begin
 perform private.require_member(p_org);
 perform 1 from public.conversations where org_id=p_org and id=p_conversation for update;
 if not found then raise exception 'Conversation not found';end if;
 if p_request is null or p_note is null or p_body is null or length(btrim(p_body)) not between 1 and 4000 then raise exception 'Invalid reply';end if;
 reply_role:=case when p_note then 'note' else 'staff' end;
 select * into previous from public.messages where id=p_request;
 if found then
  if previous.org_id<>p_org or previous.conversation_id<>p_conversation or previous.role<>reply_role or previous.body<>btrim(p_body) then raise exception 'Message request ID already used';end if;
  return previous.id;
 end if;
 -- Human service remains available after expiry, as in the local runtime.
 insert into public.messages(id,org_id,conversation_id,role,body,provider) values(p_request,p_org,p_conversation,reply_role,btrim(p_body),'human');
 update public.conversations set updated_at=now() where org_id=p_org and id=p_conversation;
 insert into public.audit_events(org_id,actor_id,action,target_id) values(p_org,auth.uid(),case when p_note then 'conversation.note' else 'conversation.reply' end,p_request);
 return p_request;
end $$;

create function private.control_conversation(p_org uuid,p_conversation uuid,p_paused boolean,p_status text,p_locale text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_member(p_org);
 if p_paused is null or p_status is null or p_status not in ('open','unread','resolved') or (p_locale is not null and p_locale not in ('en','ckb','bad','ar')) then raise exception 'Invalid conversation settings';end if;
 update public.conversations set paused=p_paused,status=p_status,preferred_locale=p_locale,locale=coalesce(p_locale,locale),updated_at=now() where org_id=p_org and id=p_conversation;
 if not found then raise exception 'Conversation not found';end if;
 insert into public.audit_events(org_id,actor_id,action,target_id) values(p_org,auth.uid(),'conversation.settings',p_conversation);
end $$;

create function public.rp_intake_conversation(p_org uuid,p_request uuid,p_name text,p_body text,p_locale text) returns uuid language sql security invoker set search_path='' as $$select private.intake_conversation(p_org,p_request,p_name,p_body,p_locale)$$;
create function public.rp_reply_conversation(p_org uuid,p_conversation uuid,p_request uuid,p_body text,p_note boolean) returns uuid language sql security invoker set search_path='' as $$select private.reply_conversation(p_org,p_conversation,p_request,p_body,p_note)$$;
create function public.rp_control_conversation(p_org uuid,p_conversation uuid,p_paused boolean,p_status text,p_locale text) returns void language sql security invoker set search_path='' as $$select private.control_conversation(p_org,p_conversation,p_paused,p_status,p_locale)$$;
revoke all on function private.intake_conversation(uuid,uuid,text,text,text),private.reply_conversation(uuid,uuid,uuid,text,boolean),private.control_conversation(uuid,uuid,boolean,text,text),public.rp_intake_conversation(uuid,uuid,text,text,text),public.rp_reply_conversation(uuid,uuid,uuid,text,boolean),public.rp_control_conversation(uuid,uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function private.intake_conversation(uuid,uuid,text,text,text),private.reply_conversation(uuid,uuid,uuid,text,boolean),private.control_conversation(uuid,uuid,boolean,text,text),public.rp_intake_conversation(uuid,uuid,text,text,text),public.rp_reply_conversation(uuid,uuid,uuid,text,boolean),public.rp_control_conversation(uuid,uuid,boolean,text,text) to authenticated;
commit;
