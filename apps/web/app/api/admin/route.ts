import { NextResponse } from "next/server";
import { actor, body, failure, localOnly } from "@/lib/http";
import { adminOverview, adminApprove } from "@reply/database/business";
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
    adminApprove(user, await body(request));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
