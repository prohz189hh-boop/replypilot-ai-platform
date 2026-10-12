import {boundedJson} from '@reply/security/request';
import {safeErrorText} from '@reply/security/secrets';
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { actorForToken } from "@reply/database/auth";
import { AppError, invariant } from "@reply/shared";
export async function actor() {
  return actorForToken((await cookies()).get("rp_session")?.value);
}
export function localOnly(request: Request) {
  const u = new URL(request.url);
  const configured = new URL(process.env.REPLYPILOT_ORIGIN || 'http://127.0.0.1:3000');
  invariant(
    process.env.REPLYPILOT_LOCAL_DEV === "1" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) &&
      request.headers.get('host') === configured.host,
    "This development server accepts local requests only.",
    403,
  );
}
export function verifyOrigin(request: Request) {
  localOnly(request);
  const origin = request.headers.get("origin");
  invariant(
    origin === (process.env.REPLYPILOT_ORIGIN || 'http://127.0.0.1:3000'),
    "Request origin is not allowed.",
    403,
  );
  invariant(
    request.headers.get("content-type")?.startsWith("application/json"),
    "Expected JSON request.",
    415,
  );
}
export async function body(request: Request) {
  verifyOrigin(request);
  return boundedJson(request);
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: safeErrorText(error.issues[0]?.message || "Invalid input.") },
      { status: 400, headers: {'Cache-Control':'private, no-store'} },
    );
  if (error instanceof AppError)
    return NextResponse.json(
      { error: safeErrorText(error.message) },
      { status: error.status, headers: {'Cache-Control':'private, no-store'} },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: {'Cache-Control':'private, no-store'} });
  return NextResponse.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500, headers: {'Cache-Control':'private, no-store'} },
  );
}
