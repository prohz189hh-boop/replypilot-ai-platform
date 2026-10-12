begin;
-- Read-only aggregate endpoint: caller permissions and tenant RLS remain active.
create function public.rp_dashboard_summary(p_org uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.organization_members where org_id=p_org and user_id=(select auth.uid())
 ) then raise exception 'Insufficient permission' using errcode='42501'; end if;
 return jsonb_build_object(
  'activeProducts',(select count(*) from public.products where org_id=p_org and not archived),
  'lowStock',(select count(*) from public.products where org_id=p_org and not archived and stock<=3),
  'orders',(select count(*) from public.orders where org_id=p_org),
  'pendingOrders',(select count(*) from public.orders where org_id=p_org and status in ('new','awaiting_confirmation','confirmed','processing','ready')),
  'completedOrders',(select count(*) from public.orders where org_id=p_org and status='completed'),
  'sales',coalesce((select jsonb_agg(row_to_json(t) order by t.currency) from (
   select o.currency,sum(i.quantity::numeric*i.unit_price_minor) as amount
   from public.orders o join public.order_items i on i.org_id=o.org_id and i.order_id=o.id
   where o.org_id=p_org and i.org_id=p_org and o.status='completed'
   group by o.currency
  ) t),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.rp_dashboard_summary(uuid) from public,anon,authenticated;
grant execute on function public.rp_dashboard_summary(uuid) to authenticated;
commit;
