import path from "node:path";
import { get, run, audit, closeDatabase } from "../packages/database/local";
process.env.REPLYPILOT_LOCAL_DEV = "1";
process.env.REPLYPILOT_DATA_DIR = process.env.REPLYPILOT_DATA_DIR || path.resolve(".data");
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin -- registered-email");
  process.exit(1);
}
const user = get<{ id: string }>("SELECT id FROM users WHERE email=?", email);
if (!user) {
  console.error("Register this local account first.");
  process.exit(1);
}
run("UPDATE users SET platform_admin=1 WHERE id=?", user.id);
audit(null, "local-operator", "admin.provisioned", user.id);
closeDatabase();
console.log("Local administrator access granted and audited.");
