import { NextResponse } from "next/server";
import { z } from "zod";
import { actor, body, failure, localOnly } from "@/lib/http";
import { all, get, rateLimit } from "@reply/database/local";
import {
  organization,
  onboard,
  products,
  saveProduct,
  deleteProduct,
  addVariant,
  createOrder,
  updateOrder,
  saveService,
  bookAppointment,
  cancelAppointment,
  settings,
  addMember,
  billingRequest,
  appointments,
} from "@reply/database/business";
import {
  listMessages,
  staffReply,
  updateConversation,
  suggest,
} from "@reply/database/messaging";
import { requireRole } from "@reply/database/auth";
import {
  type Conversation,
  type Order,
  type Service,
  invariant,
} from "@reply/shared";
import { entitlement } from "@reply/billing";
import {dashboardSummary} from '@reply/database/analytics';
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    localOnly(request);
    const user = await actor();
    if (!user.org_id) return NextResponse.json({ user, org: null });
    const org = organization(user);
    const params = new URL(request.url).searchParams;
    const conversationId = params.get("conversation");
    if (conversationId) {
      invariant(
        get(
          "SELECT id FROM conversations WHERE org_id=? AND id=?",
          org.id,
          conversationId,
        ),
        "Conversation not found.",
        404,
      );
      return NextResponse.json({
        messages: listMessages(org.id, conversationId),
      });
    }
    const period = new Date().toISOString().slice(0, 7);
    return NextResponse.json({
      user,
      org,
      entitlement: entitlement(org),
      summary: dashboardSummary(org.id),
      products: products(
        org.id,
        params.get("q") || "",
        Math.max(1, Math.min(10000, Number(params.get("page")) || 1)),
      ),
      productCount:
        get<{ n: number }>(
          "SELECT COUNT(*) n FROM products WHERE org_id=?",
          org.id,
        )?.n || 0,
      variants: all("SELECT * FROM variants WHERE org_id=? LIMIT 500", org.id),
      conversations: all<Conversation>(
        "SELECT id,org_id,customer_name,locale,status,paused,assigned_to,labels,created_at,updated_at FROM conversations WHERE org_id=? ORDER BY updated_at DESC LIMIT 100",
        org.id,
      ),
      orders: all<Order>(
        "SELECT * FROM orders WHERE org_id=? ORDER BY created_at DESC LIMIT 200",
        org.id,
      ),
      customers: all(
        "SELECT * FROM customers WHERE org_id=? ORDER BY created_at DESC LIMIT 200",
        org.id,
      ),
      services: all<Service>(
        "SELECT * FROM services WHERE org_id=? LIMIT 100",
        org.id,
      ),
      appointments: appointments(org.id),
      members: all(
        "SELECT u.id,u.name,u.email,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.org_id=?",
        org.id,
      ),
      usage:
        get<{ n: number }>(
          "SELECT COUNT(*) n FROM usage_records WHERE org_id=? AND (?=1 OR period=?)",
          org.id,
          org.subscription_status==='trial'?1:0,
          period,
        )?.n || 0,
      billing: all(
        "SELECT * FROM billing_events WHERE org_id=? ORDER BY created_at DESC LIMIT 50",
        org.id,
      ),
      movements: all(
        "SELECT * FROM inventory_movements WHERE org_id=? ORDER BY created_at DESC LIMIT 50",
        org.id,
      ),
      activity: all(
        "SELECT substr(created_at,1,10) day,COUNT(*) count FROM conversations WHERE org_id=? GROUP BY day ORDER BY day DESC LIMIT 7",
        org.id,
      ),
      revenue: all(
        "SELECT currency,SUM(quantity*unit_price) total FROM orders WHERE org_id=? AND status=? GROUP BY currency",
        org.id,
        "completed",
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await actor();
    rateLimit("workspace:" + user.id, 120);
    const data = z
      .object({ action: z.string(), data: z.unknown() })
      .parse(await body(request));
    let result: unknown = null;
    switch (data.action) {
      case "onboard":
        result = onboard(user, data.data);
        break;
      case "product.save":
        result = saveProduct(user, data.data);
        break;
      case "product.delete":
        deleteProduct(user, z.string().uuid().parse(data.data));
        break;
      case "variant.add":
        result = addVariant(user, data.data);
        break;
      case "order.create":
        requireRole(user, ["owner", "manager", "staff"]);
        result = createOrder(organization(user).id, data.data);
        break;
      case "order.update":
        updateOrder(user, data.data);
        break;
      case "service.create":
        result = saveService(user, data.data);
        break;
      case "appointment.create":
        result = bookAppointment(user, data.data);
        break;
      case "appointment.cancel":
        cancelAppointment(user, z.string().uuid().parse(data.data));
        break;
      case "settings":
        settings(user, data.data);
        break;
      case "member.add":
        addMember(user, data.data);
        break;
      case "billing.request":
        billingRequest(user, data.data);
        break;
      case "reply":
        staffReply(user, data.data);
        break;
      case "conversation.update":
        updateConversation(user, data.data);
        break;
      case "suggest": {
        const p = z
          .object({
            conversationId: z.string().uuid(),
            requestId: z.string().uuid(),
          })
          .parse(data.data);
        const org = organization(user);
        const c = get<Conversation>(
          "SELECT * FROM conversations WHERE id=? AND org_id=?",
          p.conversationId,
          org.id,
        );
        invariant(c, "Conversation not found.", 404);
        const latest = get<{ body: string; id: string }>(
          "SELECT body,id FROM messages WHERE org_id=? AND conversation_id=? AND role='customer' ORDER BY created_at DESC LIMIT 1",
          org.id,
          c.id,
        );
        invariant(latest, "No customer message to answer.");
        result = await suggest(
          org.id,
          c.id,
          latest.body,
          c.locale,
          "suggest:" + latest.id,
        );
        break;
      }
      default:
        invariant(false, "Unknown operation.", 400);
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return failure(error);
  }
}
