import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { invariant } from "../shared";
let connection: DatabaseSync | undefined;
export const id = (): string => randomUUID();
export const now = () => new Date().toISOString();
export function db() {
  invariant(
    process.env.REPLYPILOT_LOCAL_DEV === "1",
    "Local database is disabled. Use the documented local launcher; production adapter is not configured.",
    503,
  );
  if (connection) return connection;
  const dir =
    process.env.REPLYPILOT_DATA_DIR || path.resolve(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  connection = new DatabaseSync(path.join(dir, "replypilot.sqlite"));
  connection.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,platform_admin INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS organizations(id TEXT PRIMARY KEY,name TEXT NOT NULL,industry TEXT NOT NULL,locale TEXT NOT NULL,currency TEXT NOT NULL,plan TEXT NOT NULL DEFAULT 'growth',trial_end TEXT NOT NULL,subscription_status TEXT NOT NULL DEFAULT 'trial',ai_mode TEXT NOT NULL DEFAULT 'assisted',paused INTEGER NOT NULL DEFAULT 0,policies TEXT NOT NULL DEFAULT '',hours TEXT NOT NULL DEFAULT '',timezone TEXT NOT NULL DEFAULT 'Asia/Baghdad',created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS members(org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('owner','manager','staff')),PRIMARY KEY(org_id,user_id),UNIQUE(user_id));
 CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,name TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,brand TEXT NOT NULL,sku TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>=0),currency TEXT NOT NULL,stock INTEGER NOT NULL CHECK(stock>=0),archived INTEGER NOT NULL DEFAULT 0,specs TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(org_id,id));
 CREATE INDEX IF NOT EXISTS products_org ON products(org_id,archived,name);
 CREATE TABLE IF NOT EXISTS variants(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,product_id TEXT NOT NULL,name TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>=0),stock INTEGER NOT NULL CHECK(stock>=0),FOREIGN KEY(org_id,product_id) REFERENCES products(org_id,id),UNIQUE(org_id,id));
 CREATE TABLE IF NOT EXISTS images(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,product_id TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,FOREIGN KEY(org_id,product_id) REFERENCES products(org_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,name TEXT NOT NULL,locale TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,customer_name TEXT NOT NULL,token_hash TEXT NOT NULL,locale TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',paused INTEGER NOT NULL DEFAULT 0,assigned_to TEXT,labels TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(org_id,id));
 CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,conversation_id TEXT NOT NULL,role TEXT NOT NULL,body TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'sent',provider TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,FOREIGN KEY(org_id,conversation_id) REFERENCES conversations(org_id,id) ON DELETE CASCADE);
 CREATE INDEX IF NOT EXISTS messages_conversation ON messages(org_id,conversation_id,created_at);
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,customer_name TEXT NOT NULL,conversation_id TEXT,product_id TEXT NOT NULL,product_name TEXT NOT NULL,variant_id TEXT,quantity INTEGER NOT NULL CHECK(quantity>0),unit_price INTEGER NOT NULL CHECK(unit_price>=0),currency TEXT NOT NULL,status TEXT NOT NULL,fulfillment TEXT NOT NULL,idempotency_key TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(org_id,product_id) REFERENCES products(org_id,id),FOREIGN KEY(org_id,conversation_id) REFERENCES conversations(org_id,id),FOREIGN KEY(org_id,variant_id) REFERENCES variants(org_id,id),UNIQUE(org_id,idempotency_key));
 CREATE TABLE IF NOT EXISTS inventory_movements(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,product_id TEXT NOT NULL,variant_id TEXT,quantity INTEGER NOT NULL,reason TEXT NOT NULL,order_id TEXT,created_at TEXT NOT NULL,FOREIGN KEY(org_id,product_id) REFERENCES products(org_id,id));
 CREATE TABLE IF NOT EXISTS services(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES organizations(id),name TEXT NOT NULL,duration INTEGER NOT NULL CHECK(duration BETWEEN 5 AND 480),price INTEGER NOT NULL CHECK(price>=0),currency TEXT NOT NULL,UNIQUE(org_id,id));
 CREATE TABLE IF NOT EXISTS appointments(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,service_id TEXT NOT NULL,staff_id TEXT NOT NULL,customer_name TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'confirmed',FOREIGN KEY(org_id,service_id) REFERENCES services(org_id,id),FOREIGN KEY(org_id,staff_id) REFERENCES members(org_id,user_id));
 CREATE INDEX IF NOT EXISTS appointment_slots ON appointments(org_id,staff_id,starts_at,ends_at);
 CREATE TABLE IF NOT EXISTS usage_records(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES organizations(id),period TEXT NOT NULL,request_id TEXT NOT NULL,answer TEXT NOT NULL,provider TEXT NOT NULL,tokens INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,UNIQUE(org_id,request_id));
 CREATE TABLE IF NOT EXISTS billing_events(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES organizations(id),actor_id TEXT NOT NULL,action TEXT NOT NULL,plan TEXT,status TEXT NOT NULL DEFAULT 'pending_review',created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY,org_id TEXT,actor_id TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
 `);
  const columns=connection.prepare('PRAGMA table_info(products)').all() as {name:string}[];
  if(!columns.some(c=>c.name==='version'))connection.exec('ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 0');
  const conversationColumns=connection.prepare('PRAGMA table_info(conversations)').all() as {name:string}[];
  if(!conversationColumns.some(c=>c.name==='preferred_locale'))connection.exec('ALTER TABLE conversations ADD COLUMN preferred_locale TEXT;');
  const orgColumns=connection.prepare('PRAGMA table_info(organizations)').all() as {name:string}[];
  if(!orgColumns.some(c=>c.name==='ai_provider'))connection.exec("ALTER TABLE organizations ADD COLUMN ai_provider TEXT NOT NULL DEFAULT 'mock'; ALTER TABLE organizations ADD COLUMN synthetic_data INTEGER NOT NULL DEFAULT 0;");
  if(!orgColumns.some(c=>c.name==='subscription_period_end'))connection.exec("ALTER TABLE organizations ADD COLUMN subscription_period_end TEXT; UPDATE organizations SET subscription_period_end=strftime('%Y-%m-%dT%H:%M:%fZ','now','+30 days') WHERE subscription_status='active';");
  if(!orgColumns.some(c=>c.name==='subscription_grace_end'))connection.exec('ALTER TABLE organizations ADD COLUMN subscription_grace_end TEXT;');
  connection.exec(`CREATE TABLE IF NOT EXISTS ai_requests(org_id TEXT NOT NULL,request_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(org_id,request_id));`);
  connection.exec(`CREATE TABLE IF NOT EXISTS translation_reviews(
   id TEXT PRIMARY KEY,org_id TEXT NOT NULL,product_id TEXT NOT NULL,locale TEXT NOT NULL,
   source_text TEXT NOT NULL,draft TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',
   submitted_by TEXT NOT NULL,reviewed_by TEXT,review_notes TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
   FOREIGN KEY(org_id,product_id) REFERENCES products(org_id,id) ON DELETE CASCADE
  );CREATE INDEX IF NOT EXISTS translation_reviews_tenant ON translation_reviews(org_id,product_id,locale);`);
  connection.exec(`CREATE TABLE IF NOT EXISTS provider_calls(
    id TEXT PRIMARY KEY,provider TEXT NOT NULL,model TEXT NOT NULL,prompt_version TEXT NOT NULL,
    status TEXT NOT NULL,input_tokens INTEGER,output_tokens INTEGER,total_tokens INTEGER,
    paid_reference_usd REAL,error_code TEXT,created_at TEXT NOT NULL,completed_at TEXT
  );`);
  connection.exec(`
   CREATE TABLE IF NOT EXISTS whatsapp_integrations(org_id TEXT PRIMARY KEY REFERENCES organizations(id),account_id TEXT NOT NULL UNIQUE,secret TEXT NOT NULL,connected INTEGER NOT NULL DEFAULT 0,automatic INTEGER NOT NULL DEFAULT 0,daily_limit INTEGER NOT NULL DEFAULT 30,simulated_cost_micros INTEGER NOT NULL DEFAULT 0,daily_budget_micros INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS whatsapp_contacts(org_id TEXT NOT NULL REFERENCES organizations(id),customer_ref TEXT NOT NULL,conversation_id TEXT NOT NULL,last_inbound_at TEXT NOT NULL,PRIMARY KEY(org_id,customer_ref),UNIQUE(org_id,conversation_id),FOREIGN KEY(org_id,conversation_id) REFERENCES conversations(org_id,id));
   CREATE TABLE IF NOT EXISTS whatsapp_events(org_id TEXT NOT NULL,event_id TEXT NOT NULL,fingerprint TEXT NOT NULL,status TEXT NOT NULL,conversation_id TEXT NOT NULL,message_id TEXT NOT NULL,created_at TEXT NOT NULL,error_code TEXT,PRIMARY KEY(org_id,event_id),FOREIGN KEY(org_id,conversation_id) REFERENCES conversations(org_id,id));
   CREATE TABLE IF NOT EXISTS whatsapp_outbox(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,conversation_id TEXT NOT NULL,message_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,provider_id TEXT,error_code TEXT,next_attempt_at TEXT,created_at TEXT NOT NULL,UNIQUE(org_id,message_id),FOREIGN KEY(org_id,conversation_id) REFERENCES conversations(org_id,id),FOREIGN KEY(message_id) REFERENCES messages(id));
   CREATE TABLE IF NOT EXISTS whatsapp_attempts(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,outbox_id TEXT NOT NULL,cost_micros INTEGER NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(outbox_id) REFERENCES whatsapp_outbox(id));
  `);
  const providerColumns=connection.prepare('PRAGMA table_info(provider_calls)').all() as {name:string}[];
  for(const [name,type] of [['elapsed_ms','INTEGER'],['headers_ms','INTEGER'],['http_status','INTEGER'],['failure_phase','TEXT']]){
    if(!providerColumns.some(c=>c.name===name))connection.exec(`ALTER TABLE provider_calls ADD COLUMN ${name} ${type};`);
  }
  const contactColumns=connection.prepare('PRAGMA table_info(whatsapp_contacts)').all() as {name:string}[];
  if(!contactColumns.some(c=>c.name==='opted_out'))connection.exec('ALTER TABLE whatsapp_contacts ADD COLUMN opted_out INTEGER NOT NULL DEFAULT 0;');
  if(!contactColumns.some(c=>c.name==='consent_at'))connection.exec('ALTER TABLE whatsapp_contacts ADD COLUMN consent_at TEXT;');
  const eventColumns=connection.prepare('PRAGMA table_info(whatsapp_events)').all() as {name:string}[];
  if(!eventColumns.some(c=>c.name==='received_at'))connection.exec('ALTER TABLE whatsapp_events ADD COLUMN received_at TEXT;');
  return connection;
}
export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return db()
    .prepare(sql)
    .get(...params) as T | undefined;
}
export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db()
    .prepare(sql)
    .all(...params) as T[];
}
export function run(sql: string, ...params: SQLInputValue[]) {
  return db()
    .prepare(sql)
    .run(...params);
}
let transactionDepth = 0;
export function transaction<T>(fn: () => T): T {
  const c = db();
  const nested = transactionDepth > 0;
  const savepoint = "rp_" + transactionDepth;
  c.exec(nested ? "SAVEPOINT " + savepoint : "BEGIN IMMEDIATE");
  transactionDepth++;
  try {
    const value = fn();
    c.exec(nested ? "RELEASE SAVEPOINT " + savepoint : "COMMIT");
    return value;
  } catch (error) {
    c.exec(nested ? "ROLLBACK TO SAVEPOINT " + savepoint : "ROLLBACK");
    if (nested) c.exec("RELEASE SAVEPOINT " + savepoint);
    throw error;
  } finally {
    transactionDepth--;
  }
}
export function audit(
  orgId: string | null,
  actorId: string,
  action: string,
  targetId: string | null = null,
) {
  run(
    "INSERT INTO audit_events VALUES(?,?,?,?,?,?)",
    id(),
    orgId,
    actorId,
    action,
    targetId,
    now(),
  );
}
export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  transaction(() => {
    const time = Date.now();
    const r = get<{ count: number; reset_at: number }>(
      "SELECT * FROM rate_limits WHERE key=?",
      key,
    );
    if (!r || r.reset_at <= time) {
      run(
        "INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1, reset_at=excluded.reset_at",
        key,
        time + windowMs,
      );
    } else {
      invariant(
        r.count < limit,
        "Too many requests. Please try again later.",
        429,
      );
      run("UPDATE rate_limits SET count=count+1 WHERE key=?", key);
    }
  });
}
export function closeDatabase() {
  connection?.close();
  connection = undefined;
}
