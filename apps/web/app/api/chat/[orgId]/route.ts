import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure, localOnly } from "@/lib/http";
import { get, all, rateLimit } from "@reply/database/local";
import {
  startConversation,
  customerConversation,
  customerMessage,
  listMessages,
} from "@reply/database/messaging";
import { createOrder, products } from "@reply/database/business";
import { type Organization, invariant } from "@reply/shared";
export const runtime = "nodejs";
type Context = { params: Promise<{ orgId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    localOnly(request);
    const { orgId } = await context.params;
    const params = new URL(request.url).searchParams;
    const cId = params.get("conversation");
    if (cId) {
      customerConversation(
        orgId,
        cId,
        request.headers.get("authorization")?.replace("Bearer ", "") || "",
      );
      return NextResponse.json({ messages: listMessages(orgId, cId, true) });
    }
    const org = get<Organization>(
      "SELECT * FROM organizations WHERE id=?",
      orgId,
    );
    invariant(org, "Business not found.", 404);
    return NextResponse.json({
      name: org.name,
      locale: org.locale,
      aiMode: org.ai_mode,
      hours: org.hours,
      products: products(orgId, "", 1, false).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency,
        stock: p.stock,
        specs: p.specs,
      })),
      variants: all(
        "SELECT id,product_id,name,price,stock FROM variants WHERE org_id=? LIMIT 500",
        orgId,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { orgId } = await context.params;
    rateLimit("chat:" + orgId, 60);
    const data = z
      .object({
        action: z.enum(["start", "message", "order"]),
        conversationId: z.string().uuid().optional(),
        data: z.unknown(),
      })
      .parse(await body(request));
    if (data.action === "start")
      return NextResponse.json(startConversation(orgId, data.data));
    const c = customerConversation(
      orgId,
      data.conversationId || "",
      request.headers.get("authorization")?.replace("Bearer ", "") || "",
    );
    if (data.action === "message")
      return NextResponse.json({
        messages: await customerMessage(c, data.data),
      });
    const input = z
      .object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullable().optional(),
        quantity: z.number(),
        requestId: z.string().uuid(),
      })
      .parse(data.data);
    const orderId = createOrder(
      orgId,
      { ...input, customerName: c.customer_name },
      c.id,
    );
    return NextResponse.json({ orderId, status: "awaiting_confirmation" });
  } catch (error) {
    return failure(error);
  }
}
