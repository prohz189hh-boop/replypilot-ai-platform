import { NextResponse } from "next/server";
import { actor, failure, localOnly } from "@/lib/http";
import { saveImage } from "@reply/database/uploads";
import { invariant } from "@reply/shared";
import { z } from "zod";
import { all, get } from "@reply/database/local";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    localOnly(request);
    invariant(
      request.headers.get("origin") === (process.env.REPLYPILOT_ORIGIN || 'http://127.0.0.1:3000'),
      "Request origin not allowed.",
      403,
    );
    const user = await actor();
    invariant(
      Number(request.headers.get("content-length") || 0) <= 3.1 * 1024 * 1024,
      "Upload too large.",
      413,
    );
    const form = await request.formData();
    const file = form.get("file");
    invariant(file instanceof File, "Select an image.");
    const productId = z.string().uuid().parse(form.get("productId"));
    const imageId = await saveImage(
      user,
      productId,
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    return NextResponse.json({ imageId });
  } catch (error) {
    return failure(error);
  }
}
export async function GET(request: Request) {
  try {
    localOnly(request);
    const user = await actor();
    const params = new URL(request.url).searchParams;
    const imageId = params.get("id");
    if (imageId) {
      const image = get<{ bytes: Uint8Array; mime: string }>(
        "SELECT bytes,mime FROM images WHERE org_id=? AND id=?",
        user.org_id,
        imageId,
      );
      invariant(image, "Image not found.", 404);
      return new Response(new Uint8Array(image.bytes), {
        headers: {
          "Content-Type": image.mime,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const productId = z.string().uuid().parse(params.get("product"));
    return NextResponse.json({
      images: all<{ id: string }>(
        "SELECT id FROM images WHERE org_id=? AND product_id=?",
        user.org_id,
        productId,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
