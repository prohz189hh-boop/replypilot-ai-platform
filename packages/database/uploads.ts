import sharp from "sharp";
import { invariant, type Actor } from "../shared";
import { requireRole } from "./auth";
import { organization, product } from "./business";
import { get, run, id, audit } from "./local";
export async function sanitizeImage(bytes: Buffer, mime: string) {
  invariant(
    bytes.length > 0 && bytes.length <= 3 * 1024 * 1024,
    "Images must be no larger than 3 MB.",
    413,
  );
  invariant(
    ["image/png", "image/jpeg", "image/webp"].includes(mime),
    "Only PNG, JPEG and WebP images are accepted.",
    415,
  );
  const signature = bytes.subarray(0, 12);
  const actual = signature
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : signature[0] === 255 && signature[1] === 216 && signature[2] === 255
      ? "image/jpeg"
      : signature.subarray(0, 4).toString() === "RIFF" &&
          signature.subarray(8, 12).toString() === "WEBP"
        ? "image/webp"
        : null;
  invariant(actual === mime, "Image type does not match its contents.", 415);
  try {
    return await sharp(bytes, { limitInputPixels: 16_000_000, animated: false })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    invariant(false, "Invalid image or excessive image dimensions.", 400);
  }
}
export async function saveImage(
  actor: Actor,
  productId: string,
  bytes: Buffer,
  mime: string,
) {
  requireRole(actor);
  const org = organization(actor);
  product(org.id, productId);
  invariant(
    (get<{ n: number }>(
      "SELECT COUNT(*) n FROM images WHERE org_id=? AND product_id=?",
      org.id,
      productId,
    )?.n || 0) < 6,
    "A product can have up to six images.",
  );
  const safe = await sanitizeImage(bytes, mime);
  const imageId = id();
  run(
    "INSERT INTO images VALUES(?,?,?,?,?)",
    imageId,
    org.id,
    productId,
    "image/webp",
    safe,
  );
  audit(org.id, actor.id, "image.uploaded", imageId);
  return imageId;
}
