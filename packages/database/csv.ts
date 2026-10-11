import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { z } from "zod";
import { type Actor, invariant, productSchema, AppError } from "../shared";
import { organization, saveProduct, products } from "./business";
import { requireRole } from "./auth";
import { requireFeature } from "../billing";
import { transaction } from "./local";
const rowSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  category: z.string().default("General"),
  brand: z.string().default(""),
  sku: z.string().default(""),
  price: z.coerce.number().int().min(0),
  currency: z.enum(["IQD", "USD", "EUR"]),
  stock: z.coerce.number().int().min(0),
  specs: z.string().default("{}"),
});
export function parseProductsCSV(text: string) {
  invariant(Buffer.byteLength(text) <= 512000, "CSV exceeds 500 KB.", 413);
  let rows: unknown[];
  try {
    rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      max_record_size: 12000,
    });
  } catch {
    throw new AppError("Invalid CSV. Check headers and quoting.");
  }
  invariant(
    rows.length > 0 && rows.length <= 100,
    "Import between 1 and 100 products at a time.",
  );
  return rows.map((row) => {
    const r = rowSchema.parse(row);
    let specs: unknown;
    try {
      specs = JSON.parse(r.specs || "{}");
    } catch {
      throw new AppError("Specifications must be a JSON object.");
    }
    return productSchema.parse({ ...r, specs });
  });
}
export function importCSV(actor: Actor, text: string) {
  requireRole(actor);
  const org = organization(actor);
  requireFeature(org, "csv");
  const rows = parseProductsCSV(text);
  return transaction(() => rows.map((row) => saveProduct(actor, row)));
}
export function exportCSV(actor: Actor) {
  const org = organization(actor);
  requireFeature(org, "csv");
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const batch = products(org.id, "", page);
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return stringify(
    rows.map((p) => ({
      name: p.name,
      description: p.description,
      category: p.category,
      brand: p.brand,
      sku: p.sku,
      price: p.price,
      currency: p.currency,
      stock: p.stock,
      specs: JSON.stringify(p.specs),
    })),
    { header: true, escape_formulas: true },
  );
}
