import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { z } from "zod";
import { get, run, id, now, transaction, audit } from "./local";
import { type Actor, invariant } from "../shared";
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(2).max(100).optional(),
});
function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function checkPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(key, "hex"),
  );
}
export function register(input: unknown) {
  const data = credentials.parse(input);
  return transaction(() => {
    invariant(
      !get("SELECT id FROM users WHERE email=?", data.email),
      "An account already exists. Please log in.",
      409,
    );
    const userId = id();
    run(
      "INSERT INTO users VALUES(?,?,?,?,0,?)",
      userId,
      data.email,
      data.name || "Business owner",
      hashPassword(data.password),
      now(),
    );
    audit(null, userId, "account.registered");
    return createSession(userId);
  });
}
export function login(input: unknown) {
  const data = credentials.parse(input);
  const u = get<{ id: string; password_hash: string }>(
    "SELECT id,password_hash FROM users WHERE email=?",
    data.email,
  );
  const dummy = "00".repeat(16) + ":" + "00".repeat(64);
  const valid = checkPassword(data.password, u?.password_hash || dummy);
  invariant(u && valid, "Email or password is incorrect.", 401);
  return createSession(u.id);
}
function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  run(
    "INSERT INTO sessions VALUES(?,?,?)",
    tokenHash(token),
    userId,
    new Date(Date.now() + 7 * 86400000).toISOString(),
  );
  return token;
}
export function actorForToken(token: string | undefined): Actor {
  invariant(token, "Please log in.", 401);
  const actor = get<Actor>(
    `SELECT u.id,u.email,u.name,u.platform_admin,m.org_id,m.role FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN members m ON m.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?`,
    tokenHash(token),
    now(),
  );
  invariant(actor, "Your session has expired. Please log in.", 401);
  return actor;
}
export function logout(token: string) {
  run("DELETE FROM sessions WHERE token_hash=?", tokenHash(token));
}
export function requireRole(
  actor: Actor,
  roles: NonNullable<Actor["role"]>[] = ["owner", "manager"],
) {
  invariant(
    actor.org_id && actor.role && roles.includes(actor.role),
    "You do not have permission for this action.",
    403,
  );
}
export function requireAdmin(actor: Actor) {
  invariant(
    actor.platform_admin === 1,
    "Platform administrator access required.",
    403,
  );
}
