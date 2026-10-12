import {all,get} from './local';
// Aggregate independently of paginated UI lists; every query stays within the tenant.
export function dashboardSummary(orgId:string){
 return {
  conversations:get<{n:number}>('SELECT COUNT(*) n FROM conversations WHERE org_id=?',orgId)!.n,
  lowStock:get<{n:number}>('SELECT COUNT(*) n FROM products WHERE org_id=? AND archived=0 AND stock<=3',orgId)!.n,
  lowProducts:all<{id:string;name:string;stock:number}>('SELECT id,name,stock FROM products WHERE org_id=? AND archived=0 AND stock<=3 ORDER BY stock,name LIMIT 4',orgId),
 };
}
