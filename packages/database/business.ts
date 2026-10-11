import { z } from "zod";
import { all, get, run, id, now, transaction, audit } from "./local";
import { requireRole, requireAdmin } from "./auth";
import {
  type Actor,
  type Organization,
  type Product,
  type ProductInput,
  type Order,
  type Service,
  type Appointment,
  industries,
  localeSchema,
  productSchema,
  orderStatuses,
  invariant,
} from "../shared";
import { entitlement, requireFeature, plans } from "../billing";
export function organization(actor: Actor) {
  invariant(actor.org_id, "Create your business first.", 409);
  const org = get<Organization>(
    "SELECT * FROM organizations WHERE id=?",
    actor.org_id,
  );
  invariant(org, "Business not found.", 404);
  return org;
}
export function onboard(actor: Actor, input: unknown) {
  const data = z
    .object({
      name: z.string().trim().min(2).max(100),
      industry: z.enum(industries),
      locale: localeSchema,
      currency: z.enum(["IQD", "USD", "EUR"]),
      timezone: z.string().max(60).default("Asia/Baghdad"),
      sample: z.boolean().default(false),
    })
    .parse(input);
  try {
    new Intl.DateTimeFormat("en", { timeZone: data.timezone });
  } catch {
    throw new Error("Invalid timezone");
  }
  return transaction(() => {
    invariant(
      !get("SELECT org_id FROM members WHERE user_id=?", actor.id),
      "This account already has a business.",
      409,
    );
    const orgId = id();
    run(
      "INSERT INTO organizations(id,name,industry,locale,currency,trial_end,timezone,created_at) VALUES(?,?,?,?,?,?,?,?)",
      orgId,
      data.name,
      data.industry,
      data.locale,
      data.currency,
      new Date(Date.now() + 7 * 86400000).toISOString(),
      data.timezone,
      now(),
    );
    run("INSERT INTO members VALUES(?,?,?)", orgId, actor.id, "owner");
    audit(orgId, actor.id, "business.created", orgId);
    if (data.sample) {
      for (const p of demoProducts) {
        insertProduct(orgId, productSchema.parse(p));
      }
    }
    return orgId;
  });
}
export const demoProducts: ProductInput[] = [
  {
    name: "Atlas Gaming 15",
    category: "Laptop",
    brand: "Atlas",
    sku: "DEMO-LAP-01",
    description:
      "Fictional gaming laptop. All specifications, prices and stock are sample data.",
    price: 1450000,
    currency: "IQD",
    stock: 4,
    specs: {
      CPU: "Intel Core i7",
      GPU: "RTX 4060",
      RAM: "16GB",
      Storage: "512GB SSD",
      Display: "15.6 inch",
      "Refresh rate": "144Hz",
    },
    archived: false,
    details: {
      barcode: "",
      condition: "New",
      warranty: "Sample: 1 year",
      shipping: "Ask staff",
      tags: ["sample"],
    },
  },
  {
    name: "Nova Phone 256",
    category: "Smartphone",
    brand: "Nova",
    sku: "DEMO-PHN-01",
    description: "Fictional phone. Sample data only.",
    price: 650000,
    currency: "IQD",
    stock: 8,
    specs: { Storage: "256GB", RAM: "8GB", Color: "Midnight" },
    archived: false,
    details: {
      barcode: "",
      condition: "New",
      warranty: "",
      shipping: "",
      tags: ["sample"],
    },
  },
  {
    name: "Orbit Console",
    category: "Gaming",
    brand: "Orbit",
    sku: "DEMO-GAM-01",
    description: "Fictional console. Sample data only.",
    price: 780000,
    currency: "IQD",
    stock: 3,
    specs: { Storage: "1TB", Accessories: "One controller" },
    archived: false,
    details: {
      barcode: "",
      condition: "New",
      warranty: "",
      shipping: "",
      tags: ["sample"],
    },
  },
  {
    name: "Echo Headphones",
    category: "Audio",
    brand: "Echo",
    sku: "DEMO-AUD-01",
    description: "Fictional headphones. Sample data only.",
    price: 95000,
    currency: "IQD",
    stock: 2,
    specs: { Connectivity: "Bluetooth" },
    archived: false,
    details: {
      barcode: "",
      condition: "New",
      warranty: "",
      shipping: "",
      tags: ["sample"],
    },
  },
  {
    name: "Link USB-C Hub",
    category: "Accessories",
    brand: "Link",
    sku: "DEMO-ACC-01",
    description: "Fictional hub. Sample data only.",
    price: 45000,
    currency: "IQD",
    stock: 12,
    specs: { Ports: "HDMI, USB-A, USB-C" },
    archived: false,
    details: {
      barcode: "",
      condition: "New",
      warranty: "",
      shipping: "",
      tags: ["sample"],
    },
  },
];
type ProductRow = Omit<Product, "specs" | "details" | "archived"> & {
  specs: string;
  details: string;
  archived: number;
};
function decode(p: ProductRow): Product {
  return {
    ...p,
    specs: JSON.parse(p.specs),
    details: JSON.parse(p.details),
    archived: !!p.archived,
  };
}
export function products(
  orgId: string,
  search = "",
  page = 1,
  includeArchived = true,
) {
  return all<ProductRow>(
    `SELECT * FROM products WHERE org_id=? AND (?=1 OR archived=0) AND (name LIKE ? ESCAPE '!' OR sku LIKE ? ESCAPE '!' OR specs LIKE ? ESCAPE '!') ORDER BY created_at DESC LIMIT 100 OFFSET ?`,
    orgId,
    includeArchived ? 1 : 0,
    ...Array(3).fill("%" + search.replace(/[!%_]/g, "!$&") + "%"),
    (page - 1) * 100,
  ).map(decode);
}
export function product(orgId: string, productId: string) {
  const row = get<ProductRow>(
    "SELECT * FROM products WHERE org_id=? AND id=?",
    orgId,
    productId,
  );
  invariant(row, "Product not found.", 404);
  return decode(row);
}
function insertProduct(orgId: string, p: ProductInput) {
  const productId = id();
  run(
    "INSERT INTO products(id,org_id,name,description,category,brand,sku,price,currency,stock,archived,specs,details,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    productId,
    orgId,
    p.name,
    p.description,
    p.category,
    p.brand,
    p.sku,
    p.price,
    p.currency,
    p.stock,
    Number(p.archived),
    JSON.stringify(p.specs),
    JSON.stringify(p.details),
    now(),
  );
  return productId;
}
export function saveProduct(actor: Actor, input: unknown) {
  requireRole(actor);
  const p = productSchema.parse(input);
  return transaction(() => {
    const org = organization(actor);
    const e = entitlement(org);
    invariant(e.active, "Your subscription or trial is inactive.", 403);
    if (p.id) {
      const previous = product(org.id, p.id);
      run(
        "UPDATE products SET name=?,description=?,category=?,brand=?,sku=?,price=?,currency=?,stock=?,archived=?,specs=?,details=? WHERE id=? AND org_id=?",
        p.name,
        p.description,
        p.category,
        p.brand,
        p.sku,
        p.price,
        p.currency,
        p.stock,
        Number(p.archived),
        JSON.stringify(p.specs),
        JSON.stringify(p.details),
        p.id,
        org.id,
      );
      if (p.stock !== previous.stock)
        movement(
          org.id,
          p.id,
          null,
          p.stock - previous.stock,
          "manual adjustment",
          null,
        );
      audit(org.id, actor.id, "product.updated", p.id);
      return p.id;
    }
    invariant(
      (get<{ n: number }>(
        "SELECT COUNT(*) n FROM products WHERE org_id=?",
        org.id,
      )?.n || 0) < e.products,
      "Product limit reached.",
      403,
    );
    const newId = insertProduct(org.id, p);
    movement(org.id, newId, null, p.stock, "opening stock", null);
    audit(org.id, actor.id, "product.created", newId);
    return newId;
  });
}
export function deleteProduct(actor: Actor, productId: string) {
  requireRole(actor);
  const org = organization(actor);
  transaction(() => {
    product(org.id, productId);
    invariant(
      !get(
        "SELECT id FROM orders WHERE org_id=? AND product_id=?",
        org.id,
        productId,
      ),
      "This product has order history. Archive it instead.",
      409,
    );
    run(
      "DELETE FROM variants WHERE org_id=? AND product_id=?",
      org.id,
      productId,
    );
    run(
      "DELETE FROM inventory_movements WHERE org_id=? AND product_id=?",
      org.id,
      productId,
    );
    run("DELETE FROM products WHERE org_id=? AND id=?", org.id, productId);
    audit(org.id, actor.id, "product.deleted", productId);
  });
}
export function addVariant(actor: Actor, input: unknown) {
  requireRole(actor);
  const v = z
    .object({
      productId: z.string().uuid(),
      name: z.string().min(1).max(80),
      price: z.number().int().min(0).max(1e12),
      stock: z.number().int().min(0).max(1e6),
    })
    .parse(input);
  const org = organization(actor);
  product(org.id, v.productId);
  const variantId = id();
  run(
    "INSERT INTO variants VALUES(?,?,?,?,?,?)",
    variantId,
    org.id,
    v.productId,
    v.name,
    v.price,
    v.stock,
  );
  audit(org.id, actor.id, "variant.created", variantId);
  return variantId;
}
function movement(
  orgId: string,
  productId: string,
  variantId: string | null,
  quantity: number,
  reason: string,
  orderId: string | null,
) {
  run(
    "INSERT INTO inventory_movements VALUES(?,?,?,?,?,?,?,?)",
    id(),
    orgId,
    productId,
    variantId,
    quantity,
    reason,
    orderId,
    now(),
  );
}
export const orderInput = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().default(null),
  quantity: z.number().int().min(1).max(100),
  customerName: z.string().trim().min(2).max(100),
  fulfillment: z.enum(["pickup", "delivery_request"]).default("pickup"),
  requestId: z.string().uuid(),
});
export function createOrder(
  orgId: string,
  input: unknown,
  conversationId: string | null = null,
) {
  const data = orderInput.parse(input);
  return transaction(() => {
    const existing = get<Order>(
      "SELECT * FROM orders WHERE org_id=? AND idempotency_key=?",
      orgId,
      data.requestId,
    );
    if (existing) {
      invariant(
        existing.product_id === data.productId &&
          existing.quantity === data.quantity &&
          existing.variant_id === data.variantId &&
          existing.conversation_id === conversationId,
        "Idempotency key already used.",
        409,
      );
      return existing.id;
    }
    const p = product(orgId, data.productId);
    invariant(!p.archived, "Product unavailable.");
    const variant = data.variantId
      ? get<{ id: string; price: number; stock: number; name: string }>(
          "SELECT * FROM variants WHERE org_id=? AND product_id=? AND id=?",
          orgId,
          p.id,
          data.variantId,
        )
      : null;
    invariant(!data.variantId || variant, "Variant not found.", 404);
    invariant(
      data.variantId ||
        !get(
          "SELECT id FROM variants WHERE org_id=? AND product_id=?",
          orgId,
          p.id,
        ),
      "Choose a product variant.",
    );
    invariant(
      (variant?.stock ?? p.stock) >= data.quantity,
      "Not enough stock.",
    );
    const orderId = id();
    run(
      "INSERT INTO orders(id,org_id,customer_name,conversation_id,product_id,product_name,variant_id,quantity,unit_price,currency,status,fulfillment,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      orderId,
      orgId,
      data.customerName,
      conversationId,
      p.id,
      p.name + (variant ? " / " + variant.name : ""),
      data.variantId,
      data.quantity,
      variant?.price ?? p.price,
      p.currency,
      "awaiting_confirmation",
      data.fulfillment,
      data.requestId,
      now(),
    );
    audit(orgId, conversationId || "staff", "order.requested", orderId);
    return orderId;
  });
}
export function updateOrder(actor: Actor, input: unknown) {
  requireRole(actor, ["owner", "manager", "staff"]);
  const data = z
    .object({ id: z.string().uuid(), status: z.enum(orderStatuses) })
    .parse(input);
  const org = organization(actor);
  return transaction(() => {
    const order = get<Order>(
      "SELECT * FROM orders WHERE org_id=? AND id=?",
      org.id,
      data.id,
    );
    invariant(order, "Order not found.", 404);
    if (order.status === data.status) return;
    const transitions: Record<string, string[]> = {
      new: ["awaiting_confirmation", "cancelled"],
      awaiting_confirmation: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["ready", "cancelled"],
      ready: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };
    invariant(
      transitions[order.status].includes(data.status),
      "Invalid order status transition.",
      409,
    );
    const table = order.variant_id ? "variants" : "products";
    const target = order.variant_id || order.product_id;
    if (data.status === "confirmed") {
      const p = product(org.id, order.product_id);
      invariant(!p.archived, "Archived products cannot be confirmed.", 409);
      const result = run(
        `UPDATE ${table} SET stock=stock-? WHERE org_id=? AND id=? AND stock>=?`,
        order.quantity,
        org.id,
        target,
        order.quantity,
      );
      invariant(
        Number(result.changes) === 1,
        "Stock changed. Not enough inventory to confirm.",
        409,
      );
      movement(
        org.id,
        order.product_id,
        order.variant_id,
        -order.quantity,
        "order reservation",
        order.id,
      );
    }
    if (
      data.status === "cancelled" &&
      ["confirmed", "processing", "ready"].includes(order.status)
    ) {
      run(
        `UPDATE ${table} SET stock=stock+? WHERE org_id=? AND id=?`,
        order.quantity,
        org.id,
        target,
      );
      movement(
        org.id,
        order.product_id,
        order.variant_id,
        order.quantity,
        "reservation released",
        order.id,
      );
    }
    run(
      "UPDATE orders SET status=? WHERE id=? AND org_id=?",
      data.status,
      order.id,
      org.id,
    );
    audit(org.id, actor.id, "order." + data.status, order.id);
  });
}
export function saveService(actor: Actor, input: unknown) {
  requireRole(actor);
  const org = organization(actor);
  requireFeature(org, "appointments");
  const data = z
    .object({
      name: z.string().min(2).max(100),
      duration: z.number().int().min(5).max(480),
      price: z.number().int().min(0).max(1e12),
      currency: z.enum(["IQD", "USD", "EUR"]),
    })
    .parse(input);
  const serviceId = id();
  run(
    "INSERT INTO services VALUES(?,?,?,?,?,?)",
    serviceId,
    org.id,
    data.name,
    data.duration,
    data.price,
    data.currency,
  );
  audit(org.id, actor.id, "service.created", serviceId);
  return serviceId;
}
export function bookAppointment(actor: Actor, input: unknown) {
  requireRole(actor, ["owner", "manager", "staff"]);
  const org = organization(actor);
  requireFeature(org, "appointments");
  const data = z
    .object({
      serviceId: z.string().uuid(),
      staffId: z.string().uuid(),
      customerName: z.string().min(2).max(100),
      startsAt: z.iso.datetime({ offset: true }),
    })
    .parse(input);
  return transaction(() => {
    const service = get<Service>(
      "SELECT * FROM services WHERE org_id=? AND id=?",
      org.id,
      data.serviceId,
    );
    invariant(service, "Service not found.", 404);
    invariant(
      get(
        "SELECT user_id FROM members WHERE org_id=? AND user_id=?",
        org.id,
        data.staffId,
      ),
      "Staff member not found.",
      404,
    );
    const start = new Date(data.startsAt);
    invariant(start.getTime() > Date.now(), "Choose a future appointment.");
    const end = new Date(start.getTime() + service.duration * 60_000);
    const a = start.toISOString(),
      b = end.toISOString();
    invariant(
      !get(
        "SELECT id FROM appointments WHERE org_id=? AND staff_id=? AND status=? AND starts_at<? AND ends_at>?",
        org.id,
        data.staffId,
        "confirmed",
        b,
        a,
      ),
      "That staff member is already booked.",
      409,
    );
    const appointmentId = id();
    run(
      "INSERT INTO appointments VALUES(?,?,?,?,?,?,?,?)",
      appointmentId,
      org.id,
      service.id,
      data.staffId,
      data.customerName,
      a,
      b,
      "confirmed",
    );
    audit(org.id, actor.id, "appointment.booked", appointmentId);
    return appointmentId;
  });
}
export function cancelAppointment(actor: Actor, appointmentId: string) {
  requireRole(actor, ["owner", "manager", "staff"]);
  const org = organization(actor);
  const r = run(
    "UPDATE appointments SET status=? WHERE org_id=? AND id=?",
    "cancelled",
    org.id,
    appointmentId,
  );
  invariant(Number(r.changes) === 1, "Appointment not found.", 404);
  audit(org.id, actor.id, "appointment.cancelled", appointmentId);
}
export function settings(actor: Actor, input: unknown) {
  requireRole(actor, ["owner"]);
  const data = z
    .object({
      name: z.string().min(2).max(100),
      locale: localeSchema,
      aiMode: z.enum(["manual", "assisted", "automatic"]),
      paused: z.boolean(),
      policies: z.string().max(4000),
      hours: z.string().max(1000),
    })
    .parse(input);
  const org = organization(actor);
  if (data.aiMode === "automatic") requireFeature(org, "automatic");
  run(
    "UPDATE organizations SET name=?,locale=?,ai_mode=?,paused=?,policies=?,hours=? WHERE id=?",
    data.name,
    data.locale,
    data.aiMode,
    Number(data.paused),
    data.policies,
    data.hours,
    org.id,
  );
  audit(org.id, actor.id, "settings.updated", org.id);
}
export function addMember(actor: Actor, input: unknown) {
  requireRole(actor, ["owner"]);
  const data = z
    .object({
      email: z.email().transform((v) => v.toLowerCase()),
      role: z.enum(["manager", "staff"]),
    })
    .parse(input);
  return transaction(() => {
    const org = organization(actor);
    const e = entitlement(org);
    invariant(e.active, "Subscription inactive.", 403);
    invariant(
      (get<{ n: number }>(
        "SELECT COUNT(*) n FROM members WHERE org_id=?",
        org.id,
      )?.n || 0) < e.staff,
      "Staff limit reached.",
      403,
    );
    const user = get<{ id: string }>(
      "SELECT id FROM users WHERE email=?",
      data.email,
    );
    invariant(user, "Ask this person to register first.");
    invariant(
      !get("SELECT user_id FROM members WHERE user_id=?", user.id),
      "This person already belongs to a workspace.",
    );
    run("INSERT INTO members VALUES(?,?,?)", org.id, user.id, data.role);
    audit(org.id, actor.id, "member.added", user.id);
  });
}
export function billingRequest(actor: Actor, input: unknown) {
  requireRole(actor, ["owner"]);
  const data = z
    .object({
      plan: z.enum(["starter", "growth", "pro"]),
      action: z.enum(["change", "cancel"]),
    })
    .parse(input);
  const org = organization(actor);
  run(
    "INSERT INTO billing_events VALUES(?,?,?,?,?,?,?)",
    id(),
    org.id,
    actor.id,
    data.action,
    data.plan,
    "pending_review",
    now(),
  );
  audit(org.id, actor.id, "billing.requested", org.id);
}
export function adminOverview(actor: Actor) {
  requireAdmin(actor);
  return {
    organizations: all<Organization>(
      "SELECT * FROM organizations ORDER BY created_at DESC LIMIT 200",
    ),
    requests: all(
      "SELECT b.*,o.name FROM billing_events b JOIN organizations o ON o.id=b.org_id ORDER BY b.created_at DESC LIMIT 200",
    ),
    usage: all(
      "SELECT provider,COUNT(*) replies,SUM(tokens) tokens FROM usage_records GROUP BY provider",
    ),
    audit: all("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 100"),
  };
}
export function adminApprove(actor: Actor, input: unknown) {
  requireAdmin(actor);
  const data = z.object({ eventId: z.string().uuid() }).parse(input);
  transaction(() => {
    const event = get<{
      org_id: string;
      plan: keyof typeof plans;
      action: string;
      status: string;
    }>("SELECT * FROM billing_events WHERE id=?", data.eventId);
    invariant(
      event && event.status === "pending_review",
      "Pending request not found.",
      404,
    );
    const count =
      get<{ n: number }>(
        "SELECT COUNT(*) n FROM products WHERE org_id=?",
        event.org_id,
      )?.n || 0;
    const staff =
      get<{ n: number }>(
        "SELECT COUNT(*) n FROM members WHERE org_id=?",
        event.org_id,
      )?.n || 0;
    if (event.action === "change") {
      invariant(
        count <= plans[event.plan].products && staff <= plans[event.plan].staff,
        "Reduce catalog or team size before downgrading.",
      );
      run(
        "UPDATE organizations SET plan=?,subscription_status=? WHERE id=?",
        event.plan,
        "active",
        event.org_id,
      );
    } else
      run(
        "UPDATE organizations SET subscription_status=? WHERE id=?",
        "cancelled",
        event.org_id,
      );
    run(
      "UPDATE billing_events SET status=? WHERE id=?",
      "verified_simulation",
      data.eventId,
    );
    audit(
      event.org_id,
      actor.id,
      "billing.admin_verified_simulation",
      data.eventId,
    );
  });
}
export function appointments(orgId: string) {
  return all<Appointment>(
    "SELECT * FROM appointments WHERE org_id=? ORDER BY starts_at DESC LIMIT 100",
    orgId,
  );
}
