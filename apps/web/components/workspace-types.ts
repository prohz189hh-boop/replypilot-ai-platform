import type {
  Actor,
  Organization,
  Product,
  Conversation,
  Order,
  Service,
  Appointment,
} from "@reply/shared";
import type { entitlement } from "@reply/billing";
export type Snapshot = {
  user: Actor;
  org: Organization;
  entitlement: ReturnType<typeof entitlement>;
  products: Product[];
  productCount: number;
  summary:{conversations:number;lowStock:number;lowProducts:{id:string;name:string;stock:number}[]};
  variants: {
    id: string;
    product_id: string;
    name: string;
    price: number;
    stock: number;
  }[];
  conversations: Conversation[];
  orders: Order[];
  customers: { id: string; name: string; locale: string; created_at: string }[];
  services: Service[];
  appointments: Appointment[];
  members: { id: string; name: string; email: string; role: string }[];
  usage: number;
  billing: {
    id: string;
    action: string;
    plan: string;
    status: string;
    created_at: string;
  }[];
  movements: {
    id: string;
    product_id: string;
    quantity: number;
    reason: string;
    created_at: string;
  }[];
  activity: { day: string; count: number }[];
  revenue: { currency: string; total: number }[];
};
export type Action = (action: string, data: unknown) => Promise<boolean>;
