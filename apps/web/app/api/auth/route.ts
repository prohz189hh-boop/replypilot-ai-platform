import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { register, login, logout } from "@reply/database/auth";
import { rateLimit } from "@reply/database/local";
import { body, failure } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const data = z
      .object({
        action: z.enum(["register", "login", "logout"]),
        email: z.string().optional(),
        password: z.string().optional(),
        name: z.string().optional(),
      })
      .parse(await body(request));
    rateLimit("auth:local", 40, 60_000);
    if (data.action === "logout") {
      const token = (await cookies()).get("rp_session")?.value;
      if (token) logout(token);
      const response = NextResponse.json({ ok: true });
      response.cookies.delete("rp_session");
      return response;
    }
    rateLimit("auth:" + data.email?.toLowerCase(), 10, 60_000);
    const token = data.action === "register" ? register(data) : login(data);
    const response = NextResponse.json({ ok: true });
    response.cookies.set("rp_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 604800,
    });
    return response;
  } catch (error) {
    return failure(error);
  }
}
