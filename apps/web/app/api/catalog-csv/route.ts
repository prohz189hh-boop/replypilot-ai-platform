import { NextResponse } from "next/server";
import { z } from "zod";
import { actor, body, failure, localOnly } from "@/lib/http";
import { importCSV, exportCSV } from "@reply/database/csv";
export async function GET(request: Request) {
  try {
    localOnly(request);
    const text = exportCSV(await actor());
    return new Response(text, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="replypilot-products.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await actor();
    const input = z
      .object({ csv: z.string().max(50000) })
      .parse(await body(request));
    const ids = importCSV(user, input.csv);
    return NextResponse.json({ count: ids.length });
  } catch (error) {
    return failure(error);
  }
}
