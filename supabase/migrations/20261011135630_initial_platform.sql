-- ReplyPilot cloud foundation. Not connected to the local application's adapter.
-- Direct authenticated writes are intentionally denied until audited server RPCs exist.
begin;
create extension if not exists btree_gist;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 100),
 industry text not null, locale text not null default 'en' check(locale in ('en','ckb','bad','ar')),
 currency text not null default 'IQD' check(currency ~ '^[A-Z]{3}$'), timezone text not null default 'Asia/Baghdad',
 created_at timestamptz not null default now()
);
create table public.organization_members (
 org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','manager','staff')), primary key(org_id,user_id)
);
create index organization_members_user on public.organization_members(user_id,org_id);
create table public.business_profiles (
 org_id uuid primary key references public.organizations(id) on delete cascade,
 logo_path text, policies text not null default '', business_hours jsonb not null default '{}', delivery jsonb not null default '{}'
);
create table public.subscription_plans (
 code text primary key, name text not null, price_usd_cents integer not null check(price_usd_cents>=0),
 product_limit integer not null, reply_limit integer not null, staff_limit integer not null,
 features jsonb not null default '{}'
);
insert into public.subscription_plans values
 ('starter','Starter',900,100,150,1,'{"automatic":false,"appointments":false,"csv":false}'),
 ('growth','Growth',1800,500,600,3,'{"automatic":true,"appointments":true,"csv":true}'),
 ('pro','Business Pro',3000,2000,1500,10,'{"automatic":true,"appointments":true,"csv":true}');
create table public.subscriptions (
 org_id uuid primary key references public.organizations(id) on delete cascade,
 plan text not null references public.subscription_plans(code), status text not null check(status in ('trial','active','past_due','grace','cancelled','expired')),
 trial_end timestamptz, period_start timestamptz not null default now(),period_end timestamptz,grace_end timestamptz,
 provider text not null default 'simulated',provider_reference text
);
create table public.categories (id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,name text not null,unique(org_id,id),unique(org_id,name));
create table public.products (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 name text not null,description text not null default '',brand text not null default '',category_id uuid,sku text,barcode text,
 price_minor bigint not null check(price_minor>=0),currency text not null check(currency ~ '^[A-Z]{3}$'),
 stock integer not null default 0 check(stock>=0),archived boolean not null default false,
 specifications jsonb not null default '{}' check(jsonb_typeof(specifications)='object'),
 details jsonb not null default '{}' check(jsonb_typeof(details)='object'),
 translations jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(org_id,id),foreign key(org_id,category_id) references public.categories(org_id,id)
);
create index products_catalog on public.products(org_id,archived,name);
create index products_specs on public.products using gin(specifications);
create table public.product_variants (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,product_id uuid not null,name text not null,
 price_minor bigint not null check(price_minor>=0),stock integer not null check(stock>=0),attributes jsonb not null default '{}',
 unique(org_id,id),foreign key(org_id,product_id) references public.products(org_id,id) on delete cascade
);
create table public.product_images (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,product_id uuid not null,storage_path text not null,
 alt_text text not null default '',position integer not null default 0,
 foreign key(org_id,product_id) references public.products(org_id,id) on delete cascade
);
create table public.customers (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 display_name text not null,locale text not null default 'en',created_at timestamptz not null default now(),unique(org_id,id)
);
create table public.conversations (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,customer_id uuid not null,channel text not null default 'website',
 token_hash text not null,status text not null default 'open',locale text not null default 'en',paused boolean not null default false,
 assigned_to uuid,labels text[] not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(org_id,id),foreign key(org_id,customer_id) references public.customers(org_id,id),
 foreign key(org_id,assigned_to) references public.organization_members(org_id,user_id)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,conversation_id uuid not null,
 role text not null check(role in ('customer','staff','assistant','note')),body text not null check(length(body)<=8000),
 kind text not null default 'sent' check(kind in ('sent','suggestion')),provider text,external_id text,
 created_at timestamptz not null default now(),foreign key(org_id,conversation_id) references public.conversations(org_id,id) on delete cascade,
 unique(org_id,external_id)
);
create index messages_conversation_time on public.messages(org_id,conversation_id,created_at);
create index conversations_inbox on public.conversations(org_id,updated_at desc);
create table public.orders (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,customer_id uuid not null,conversation_id uuid,
 status text not null default 'awaiting_confirmation' check(status in ('new','awaiting_confirmation','confirmed','processing','ready','completed','cancelled')),
 fulfillment text not null check(fulfillment in ('pickup','delivery_request')),shipping_minor bigint check(shipping_minor>=0),
 currency text not null,idempotency_key uuid not null,created_at timestamptz not null default now(),unique(org_id,id),unique(org_id,idempotency_key),
 foreign key(org_id,customer_id) references public.customers(org_id,id),foreign key(org_id,conversation_id) references public.conversations(org_id,id)
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,order_id uuid not null,product_id uuid not null,variant_id uuid,
 product_name text not null,quantity integer not null check(quantity>0),unit_price_minor bigint not null check(unit_price_minor>=0),
 foreign key(org_id,order_id) references public.orders(org_id,id),foreign key(org_id,product_id) references public.products(org_id,id),
 foreign key(org_id,variant_id) references public.product_variants(org_id,id)
);
create index orders_org_status on public.orders(org_id,status,created_at desc);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,product_id uuid not null,variant_id uuid,order_id uuid,
 quantity integer not null,reason text not null,created_at timestamptz not null default now(),
 foreign key(org_id,product_id) references public.products(org_id,id),foreign key(org_id,variant_id) references public.product_variants(org_id,id),
 foreign key(org_id,order_id) references public.orders(org_id,id)
);
create table public.services (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id) on delete cascade,
 name text not null,duration_minutes integer not null check(duration_minutes between 5 and 480),price_minor bigint not null check(price_minor>=0),currency text not null,unique(org_id,id)
);
create table public.staff_availability (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,staff_id uuid not null,
 weekday integer not null check(weekday between 0 and 6),opens time not null,closes time not null check(closes>opens),
 foreign key(org_id,staff_id) references public.organization_members(org_id,user_id)
);
create table public.appointments (
 id uuid primary key default gen_random_uuid(),org_id uuid not null,service_id uuid not null,staff_id uuid not null,customer_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),status text not null check(status in ('confirmed','cancelled','completed')),
 foreign key(org_id,service_id) references public.services(org_id,id),foreign key(org_id,staff_id) references public.organization_members(org_id,user_id),
 foreign key(org_id,customer_id) references public.customers(org_id,id),
 exclude using gist(org_id with =,staff_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status='confirmed')
);
create table public.ai_configurations (
 org_id uuid primary key references public.organizations(id) on delete cascade,
 mode text not null default 'assisted' check(mode in ('manual','assisted','automatic')),paused boolean not null default false,
 provider text not null default 'mock',model text,prompt_version text not null default 'catalog-selection-v1',
 max_daily_cost_microusd bigint not null default 0 check(max_daily_cost_microusd>=0)
);
create table public.usage_records (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),request_id uuid not null,
 period_start date not null,provider text not null,model text,prompt_version text not null,input_tokens bigint not null default 0,
 output_tokens bigint not null default 0,cost_microusd bigint not null default 0,created_at timestamptz not null default now(),unique(org_id,request_id)
);
create index usage_period on public.usage_records(org_id,period_start);
create table public.integrations (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),provider text not null,
 status text not null default 'disabled',public_config jsonb not null default '{}',unique(org_id,provider)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(),org_id uuid references public.organizations(id),actor_id uuid,action text not null,target_id uuid,
 created_at timestamptz not null default now()
);
create table public.billing_events (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),actor_id uuid not null,
 action text not null,plan text references public.subscription_plans(code),status text not null,provider_event_id text unique,created_at timestamptz not null default now()
);
create table private.platform_admins(user_id uuid primary key references auth.users(id));
create table private.integration_secrets(integration_id uuid primary key references public.integrations(id),vault_reference text not null);
alter table private.platform_admins enable row level security;
alter table private.integration_secrets enable row level security;
revoke all on all tables in schema private from public,anon,authenticated;

-- Membership has its own non-recursive policy. No role comes from user_metadata.
alter table public.organization_members enable row level security;
create policy own_membership on public.organization_members for select to authenticated using(user_id=(select auth.uid()));
alter table public.organizations enable row level security;
create policy member_organization on public.organizations for select to authenticated using(id in (select org_id from public.organization_members where user_id=(select auth.uid())));
alter table public.subscription_plans enable row level security;
create policy published_plans on public.subscription_plans for select to authenticated using(true);

do $$ declare relation text; begin
 foreach relation in array array['business_profiles','subscriptions','categories','products','product_variants','product_images','customers','conversations','messages','orders','order_items','inventory_movements','services','staff_availability','appointments','ai_configurations','usage_records','integrations','audit_events','billing_events'] loop
 execute format('alter table public.%I enable row level security',relation);
 execute format('create policy tenant_read on public.%I for select to authenticated using (org_id in (select org_id from public.organization_members where user_id=(select auth.uid())))',relation);
 execute format('create index %I on public.%I(org_id)',relation||'_tenant_idx',relation);
 end loop;
end $$;
revoke all on all tables in schema public from anon,authenticated;
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
-- Never grant direct writes to plans, subscriptions, quotas, stock or membership.
-- Server mutation RPCs with explicit authorization are a separate migration/launch gate.
commit;
