import { z } from 'zod';
export const localeSchema=z.enum(['en','ckb','bad','ar']);
export type Locale=z.infer<typeof localeSchema>;
export const industries=['electronics','clothing','restaurant','salon','repair','retail','furniture','books','cafe','barber','shoes','gaming'] as const;
export const productSchema=z.object({
 id:z.string().uuid().optional(), name:z.string().trim().min(2).max(160), description:z.string().max(4000).default(''),
 category:z.string().max(80).default('General'), brand:z.string().max(80).default(''), sku:z.string().max(80).default(''),
 price:z.number().int().min(0).max(1_000_000_000_000), currency:z.enum(['IQD','USD','EUR']).default('IQD'),
 stock:z.number().int().min(0).max(1_000_000), archived:z.boolean().default(false),
 specs:z.record(z.string().max(60),z.string().max(300)).refine(v=>Object.keys(v).length<=50).default({}),
 details:z.object({barcode:z.string().max(80).default(''),condition:z.string().max(60).default('New'),warranty:z.string().max(500).default(''),shipping:z.string().max(500).default(''),tags:z.array(z.string().max(60)).max(20).default([])}).default({barcode:'',condition:'New',warranty:'',shipping:'',tags:[]}),
});
export type ProductInput=z.infer<typeof productSchema>;
export type Product=ProductInput & {id:string;org_id:string;created_at:string};
export type Organization={id:string;name:string;industry:typeof industries[number];locale:Locale;currency:string;plan:Plan;trial_end:string;subscription_status:string;ai_mode:'manual'|'assisted'|'automatic';paused:number;policies:string;hours:string;timezone:string;created_at:string};
export type Plan='starter'|'growth'|'pro';
export type Actor={id:string;email:string;name:string;org_id:string|null;role:'owner'|'manager'|'staff'|null;platform_admin:number};
export type Conversation={id:string;org_id:string;customer_name:string;locale:Locale;status:string;paused:number;assigned_to:string|null;labels:string;created_at:string;updated_at:string};
export type Message={id:string;org_id:string;conversation_id:string;role:'customer'|'staff'|'assistant'|'note';body:string;kind:'sent'|'suggestion';created_at:string;provider:string};
export type Order={id:string;org_id:string;customer_name:string;conversation_id:string|null;product_id:string;product_name:string;variant_id:string|null;quantity:number;unit_price:number;currency:string;status:string;fulfillment:string;created_at:string};
export type Service={id:string;org_id:string;name:string;duration:number;price:number;currency:string};
export type Appointment={id:string;org_id:string;service_id:string;staff_id:string;customer_name:string;starts_at:string;ends_at:string;status:string};
export const orderStatuses=['new','awaiting_confirmation','confirmed','processing','ready','completed','cancelled'] as const;
export class AppError extends Error {constructor(message:string,public status=400){super(message);this.name='AppError';}}
export function invariant(condition:unknown,message:string,status=400):asserts condition {if(!condition)throw new AppError(message,status);}
export function money(amount:number,currency:string,locale:Locale='en'){return new Intl.NumberFormat(locale==='bad'?'ckb':locale,{style:'currency',currency,maximumFractionDigits:currency==='IQD'?0:2}).format(amount/(currency==='IQD'?1:100));}
export const specTemplates:Record<string,string[]>={Smartphone:['Manufacturer','Model','Storage','RAM','Chipset','Screen size','Resolution','Refresh rate','Battery','Cameras','Connectivity','SIM','Color','Battery health'],Laptop:['Manufacturer','Model','CPU','GPU','RAM','Storage','Display','Resolution','Refresh rate','Battery','Operating system','Ports'],Gaming:['Manufacturer','Console model','Storage','Accessories','Compatibility'],Clothing:['Size','Color','Material','Style'],Furniture:['Dimensions','Material','Colors','Weight','Delivery options'],Menu:['Ingredients','Options','Add-ons']};
