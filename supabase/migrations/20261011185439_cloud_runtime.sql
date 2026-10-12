begin;
create schema if not exists extensions;
alter extension btree_gist set schema extensions;
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $$;
alter table public.products add column version integer not null default 0;
alter table public.orders add column request_fingerprint text;
create unique index one_workspace_per_user on public.organization_members(user_id);

-- Privileged functions stay outside the exposed API schema; every entry checks auth.uid().
create function private.require_member(p_org uuid,p_roles text[] default array['owner','manager','staff']) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.organization_members where org_id=p_org and user_id=auth.uid() and role=any(p_roles)) then
  raise exception 'Workspace permission denied' using errcode='42501';
 end if;
end $$;
create function private.require_active(p_org uuid) returns public.subscription_plans
language plpgsql security definer set search_path='' as $$
declare sub public.subscriptions; plan public.subscription_plans;
begin
 perform private.require_member(p_org);
 select * into sub from public.subscriptions where org_id=p_org;
 if sub.org_id is null or not ((sub.status='trial' and sub.trial_end>now()) or (sub.status='active' and sub.period_end>now()) or (sub.status='grace' and sub.grace_end>now())) then
  raise exception 'Subscription inactive' using errcode='42501';
 end if;
 select * into plan from public.subscription_plans where code=sub.plan;
 return plan;
end $$;
create function private.onboard(p_name text,p_industry text,p_locale text,p_currency text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.organization_members where user_id=auth.uid()) then raise exception 'Workspace already exists';end if;
 if p_industry not in ('electronics','clothing','restaurant','salon','repair','retail','furniture','books','cafe','barber','shoes','gaming') then raise exception 'Invalid industry';end if;
 insert into public.organizations(name,industry,locale,currency) values(p_name,p_industry,p_locale,p_currency) returning id into result;
 insert into public.organization_members values(result,auth.uid(),'owner');
 insert into public.business_profiles(org_id) values(result);
 insert into public.subscriptions(org_id,plan,status,trial_end,period_end) values(result,'growth','trial',now()+interval '7 days',now()+interval '7 days');
 insert into public.ai_configurations(org_id) values(result);
 insert into public.audit_events(org_id,actor_id,action,target_id) values(result,auth.uid(),'business.created',result);
 return result;
end $$;
create function private.save_product(p_org uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare plan public.subscription_plans; result uuid; current_product public.products; category uuid; new_stock integer;
begin
 perform private.require_member(p_org,array['owner','manager']);
 perform 1 from public.organizations where id=p_org for update;
 plan:=private.require_active(p_org);
 if length(p_data->>'name') not between 2 and 160 or coalesce(length(p_data->>'description'),0)>4000 then raise exception 'Invalid product';end if;
 if jsonb_typeof(coalesce(p_data->'specs','{}'))<>'object' or jsonb_typeof(coalesce(p_data->'details','{}'))<>'object' then raise exception 'Invalid product attributes';end if;
 if (p_data->>'price')::bigint not between 0 and 1000000000000 or (p_data->>'stock')::integer not between 0 and 1000000 then raise exception 'Invalid price or stock';end if;
 result:=nullif(p_data->>'id','')::uuid;
 new_stock:=(p_data->>'stock')::integer;
 if result is null then
  if (select count(*) from public.products where org_id=p_org and not archived)>=plan.product_limit then raise exception 'Product limit reached';end if;
 else
  select * into current_product from public.products where org_id=p_org and id=result for update;
  if current_product.id is null then raise exception 'Product not found' using errcode='42501';end if;
  if (p_data->>'version')::integer is distinct from current_product.version then raise exception 'Product changed; refresh before saving';end if;
  if current_product.archived and not coalesce((p_data->>'archived')::boolean,false) and (select count(*) from public.products where org_id=p_org and not archived)>=plan.product_limit then raise exception 'Product limit reached';end if;
 end if;
 insert into public.categories(org_id,name) values(p_org,left(coalesce(p_data->>'category','General'),80)) on conflict(org_id,name) do update set name=excluded.name returning id into category;
 if result is null then
  insert into public.products(org_id,name,description,brand,category_id,sku,price_minor,currency,stock,archived,specifications,details)
  values(p_org,p_data->>'name',coalesce(p_data->>'description',''),coalesce(p_data->>'brand',''),category,coalesce(p_data->>'sku',''),(p_data->>'price')::bigint,p_data->>'currency',new_stock,coalesce((p_data->>'archived')::boolean,false),coalesce(p_data->'specs','{}'),coalesce(p_data->'details','{}')) returning id into result;
 else
  update public.products set name=p_data->>'name',description=coalesce(p_data->>'description',''),brand=coalesce(p_data->>'brand',''),category_id=category,sku=coalesce(p_data->>'sku',''),price_minor=(p_data->>'price')::bigint,currency=p_data->>'currency',stock=new_stock,archived=coalesce((p_data->>'archived')::boolean,false),specifications=coalesce(p_data->'specs','{}'),details=coalesce(p_data->'details','{}'),version=version+1 where org_id=p_org and id=result;
 end if;
 if new_stock<>coalesce(current_product.stock,0) then insert into public.inventory_movements(org_id,product_id,quantity,reason) values(p_org,result,new_stock-coalesce(current_product.stock,0),'catalog_adjustment');end if;
 insert into public.audit_events(org_id,actor_id,action,target_id) values(p_org,auth.uid(),'product.saved',result);
 return result;
end $$;
create function private.request_order(p_org uuid,p_request uuid,p_customer text,p_items jsonb,p_fulfillment text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; fingerprint text; customer uuid; item jsonb; p public.products; v public.product_variants; qty integer; currency_code text;
begin
 perform private.require_member(p_org);perform private.require_active(p_org);
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||p_request::text,0));
 fingerprint:=md5(jsonb_build_object('customer',p_customer,'items',p_items,'fulfillment',p_fulfillment)::text);
 select id into result from public.orders where org_id=p_org and idempotency_key=p_request;
 if result is not null then
  if (select request_fingerprint from public.orders where id=result) is distinct from fingerprint then raise exception 'Order request ID already used';end if;
  return result;
 end if;
 if p_request is null or p_items is null or p_customer is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 20 or length(p_customer) not between 2 and 100 then raise exception 'Invalid order';end if;
 insert into public.customers(org_id,display_name) values(p_org,p_customer) returning id into customer;
 result:=gen_random_uuid();
 for item in select value from jsonb_array_elements(p_items) loop
  qty:=(item->>'quantity')::integer;
  if qty not between 1 and 100 then raise exception 'Invalid quantity';end if;
  select * into p from public.products where org_id=p_org and id=(item->>'productId')::uuid and not archived;
  if p.id is null then raise exception 'Product not found' using errcode='42501';end if;
  if currency_code is null then
   currency_code:=p.currency;
   insert into public.orders(id,org_id,customer_id,fulfillment,currency,idempotency_key,request_fingerprint) values(result,p_org,customer,p_fulfillment,currency_code,p_request,fingerprint);
  elsif currency_code<>p.currency then raise exception 'Mixed currencies are not supported';end if;
  v:=null;
  if nullif(item->>'variantId','') is not null then
   select * into v from public.product_variants where org_id=p_org and product_id=p.id and id=(item->>'variantId')::uuid;
   if v.id is null then raise exception 'Variant not found' using errcode='42501';end if;
  end if;
  insert into public.order_items(org_id,order_id,product_id,variant_id,product_name,quantity,unit_price_minor) values(p_org,result,p.id,v.id,p.name,qty,coalesce(v.price_minor,p.price_minor));
 end loop;
 insert into public.audit_events(org_id,actor_id,action,target_id) values(p_org,auth.uid(),'order.requested',result);
 return result;
end $$;
create function private.update_order(p_org uuid,p_order uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare ord public.orders; line record; delta integer;
begin
 perform private.require_member(p_org);
 perform 1 from public.organizations where id=p_org for update;
 select * into ord from public.orders where org_id=p_org and id=p_order for update;
 if ord.id is null then raise exception 'Order not found' using errcode='42501';end if;
 if ord.status=p_status then return;end if;
 if not ((ord.status in ('new','awaiting_confirmation') and p_status in ('confirmed','cancelled')) or (ord.status='confirmed' and p_status in ('processing','cancelled')) or (ord.status='processing' and p_status in ('ready','cancelled')) or (ord.status='ready' and p_status in ('completed','cancelled'))) then raise exception 'Invalid order transition';end if;
 if p_status<>'cancelled' then perform private.require_active(p_org);end if;
 delta:=case when p_status='confirmed' then -1 when p_status='cancelled' and ord.status in ('confirmed','processing','ready') then 1 else 0 end;
 if delta<>0 then
  for line in select * from public.order_items where org_id=p_org and order_id=p_order order by product_id,variant_id loop
   if line.variant_id is null then
    update public.products set stock=stock+delta*line.quantity,version=version+1 where org_id=p_org and id=line.product_id and (delta=1 or (not archived and stock>=line.quantity));
   else
    update public.product_variants set stock=stock+delta*line.quantity where org_id=p_org and id=line.variant_id and (delta=1 or stock>=line.quantity);
   end if;
   if not found then raise exception 'Insufficient stock';end if;
   insert into public.inventory_movements(org_id,product_id,variant_id,order_id,quantity,reason) values(p_org,line.product_id,line.variant_id,p_order,delta*line.quantity,case when delta=-1 then 'order_reserved' else 'order_released' end);
  end loop;
 end if;
 update public.orders set status=p_status where org_id=p_org and id=p_order;
 insert into public.audit_events(org_id,actor_id,action,target_id) values(p_org,auth.uid(),'order.'||p_status,p_order);
end $$;

create function public.rp_onboard(p_name text,p_industry text,p_locale text,p_currency text) returns uuid language sql security invoker set search_path='' as $$select private.onboard(p_name,p_industry,p_locale,p_currency)$$;
create function public.rp_save_product(p_org uuid,p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select private.save_product(p_org,p_data)$$;
create function public.rp_request_order(p_org uuid,p_request uuid,p_customer text,p_items jsonb,p_fulfillment text) returns uuid language sql security invoker set search_path='' as $$select private.request_order(p_org,p_request,p_customer,p_items,p_fulfillment)$$;
create function public.rp_update_order(p_org uuid,p_order uuid,p_status text) returns void language sql security invoker set search_path='' as $$select private.update_order(p_org,p_order,p_status)$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.onboard(text,text,text,text),private.save_product(uuid,jsonb),private.request_order(uuid,uuid,text,jsonb,text),private.update_order(uuid,uuid,text) to authenticated;
revoke all on function public.rp_onboard(text,text,text,text),public.rp_save_product(uuid,jsonb),public.rp_request_order(uuid,uuid,text,jsonb,text),public.rp_update_order(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.rp_onboard(text,text,text,text),public.rp_save_product(uuid,jsonb),public.rp_request_order(uuid,uuid,text,jsonb,text),public.rp_update_order(uuid,uuid,text) to authenticated;

-- Private product images. No public bucket and no service-role key in the application.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('replypilot-products','replypilot-products',false,3145728,array['image/webp']) on conflict(id) do nothing;
create policy product_image_read on storage.objects for select to authenticated using(bucket_id='replypilot-products' and (storage.foldername(storage.objects.name))[1] in (select org_id::text from public.organization_members where user_id=(select auth.uid())));
create policy product_image_insert on storage.objects for insert to authenticated with check(bucket_id='replypilot-products' and exists(select 1 from public.organization_members m join public.products p on p.org_id=m.org_id where m.user_id=(select auth.uid()) and m.role in ('owner','manager') and m.org_id::text=(storage.foldername(storage.objects.name))[1] and p.id::text=(storage.foldername(storage.objects.name))[2]));
commit;

