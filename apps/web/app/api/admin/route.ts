import { NextResponse } from "next/server";
import { actor, body, failure, localOnly } from "@/lib/http";
import { adminOverview, adminApprove,adminBillingLifecycle } from "@reply/database/business";
export async function GET(request: Request) {
  try {
    localOnly(request);
    return NextResponse.json(adminOverview(await actor()));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await actor();
    const input=await body(request);
    if(input.action==='simulate_lifecycle')adminBillingLifecycle(user,input);else adminApprove(user,input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
