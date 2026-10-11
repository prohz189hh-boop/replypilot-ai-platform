import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure } from "@/lib/http";
import { MockProvider, GeminiProvider, renderAnswer } from "@reply/ai";
import { demoProducts } from "@reply/database/business";
import { localeSchema, type Product } from "@reply/shared";
import { rateLimit } from "@reply/database/local";
export async function POST(request: Request) {
  try {
    const data = z
      .object({
        question: z.string().min(1).max(1000),
        locale: localeSchema,
        gemini: z.boolean().default(false),
      })
      .parse(await body(request));
    rateLimit("demo", 30);
    const catalog = demoProducts.map((p, i) => ({
      ...p,
      id: "demo-" + i,
      org_id: "demo",
      created_at: "",
    })) as Product[];
    // Only the fixed fictional question can leave this machine in the optional provider smoke test.
    const provider = data.gemini ? new GeminiProvider() : new MockProvider();
    const question = data.gemini
      ? "Do you have a laptop with RTX 4060 and 16GB RAM?"
      : data.question;
    const selection = await provider.select(question, catalog, data.locale);
    return NextResponse.json({
      answer: renderAnswer(selection, data.locale),
      provider: selection.provider,
      tokens: selection.tokens,
    });
  } catch (error) {
    return failure(error);
  }
}
