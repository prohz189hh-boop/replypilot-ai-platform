import { randomBytes } from "node:crypto";
import { z } from "zod";
import { all, get, run, id, now, transaction, audit } from "./local";
import { tokenHash, requireRole } from "./auth";
import { organization, catalogForAI } from "./business";
import {
  type Actor,
  type Conversation,
  type Message,
  type Organization,
  type Locale,
  invariant,
  localeSchema,
} from "../shared";
import { detectLanguage } from "../localization";
import { MockProvider, renderAnswer } from "../ai";
import { generateSyntheticReply } from "../ai/conversation";
import { entitlement } from "../billing";
export function startConversation(orgId: string, input: unknown) {
  const data = z
    .object({ name: z.string().trim().min(2).max(100), locale: localeSchema.default('en') })
    .parse(input);
  const org = get<Organization>(
    "SELECT * FROM organizations WHERE id=?",
    orgId,
  );
  invariant(org, "Business not found.", 404);
  const token = randomBytes(32).toString("hex");
  const conversationId = id();
  transaction(() => {
    run(
      "INSERT INTO customers VALUES(?,?,?,?,?)",
      id(),
      orgId,
      data.name,
      data.locale,
      now(),
    );
    run(
      "INSERT INTO conversations(id,org_id,customer_name,token_hash,locale,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      conversationId,
      orgId,
      data.name,
      tokenHash(token),
      data.locale,
      now(),
      now(),
    );
  });
  return { id: conversationId, token };
}
export function customerConversation(
  orgId: string,
  conversationId: string,
  token: string,
) {
  const c = get<Conversation>(
    "SELECT * FROM conversations WHERE org_id=? AND id=? AND token_hash=?",
    orgId,
    conversationId,
    tokenHash(token),
  );
  invariant(c, "Conversation not found.", 404);
  return c;
}
export function listMessages(
  orgId: string,
  conversationId: string,
  customer = false,
) {
  return all<Message>(
    `SELECT id,org_id,conversation_id,role,body,kind,provider,created_at FROM messages WHERE org_id=? AND conversation_id=? ${customer ? "AND kind='sent' AND role!='note'" : ""} ORDER BY created_at ASC LIMIT 500`,
    orgId,
    conversationId,
  );
}
function addMessage(
  orgId: string,
  cId: string,
  role: Message["role"],
  body: string,
  kind: Message["kind"] = "sent",
  provider = "",
  messageId = id(),
) {
  run(
    "INSERT INTO messages(id,org_id,conversation_id,role,body,kind,provider,created_at) VALUES(?,?,?,?,?,?,?,?)",
    messageId,
    orgId,
    cId,
    role,
    body,
    kind,
    provider,
    now(),
  );
  run(
    "UPDATE conversations SET updated_at=? WHERE id=? AND org_id=?",
    now(),
    cId,
    orgId,
  );
  return messageId;
}
export async function customerMessage(c: Conversation, input: unknown) {
  const data = z
    .object({
      body: z.string().trim().min(1).max(2000),
      locale: localeSchema.optional(),
      requestId: z.string().uuid(),
    })
    .parse(input);
  const existing = get<Message>(
    "SELECT * FROM messages WHERE id=?",
    data.requestId,
  );
  if (existing) {
    invariant(
      existing.org_id === c.org_id &&
        existing.conversation_id === c.id &&
        existing.body === data.body,
      "Message ID already used.",
      409,
    );
    return listMessages(c.org_id, c.id, true);
  }
  const org = get<Organization>(
    "SELECT * FROM organizations WHERE id=?",
    c.org_id,
  )!;
  const detection = data.locale
    ? { locale: data.locale, uncertain: false }
    : detectLanguage(data.body, c.locale);
  run(
    "UPDATE conversations SET locale=?,status=? WHERE id=? AND org_id=?",
    detection.uncertain ? c.locale : detection.locale,
    "unread",
    c.id,
    c.org_id,
  );
  addMessage(c.org_id, c.id, "customer", data.body, "sent", "", data.requestId);
  if (org.ai_mode === "automatic" && !org.paused && !c.paused) {
    if(detection.uncertain){
      addMessage(c.org_id,c.id,'assistant','Which reply language do you prefer: سۆرانی، بادینی، العربية, or English? Please choose in the language menu.','sent','language-clarification');
      return listMessages(c.org_id,c.id,true);
    }
    try {
      await suggest(
        c.org_id,
        c.id,
        data.body,
        detection.locale,
        "auto:" + data.requestId,
        true,
      );
    } catch {
      addMessage(
        c.org_id,
        c.id,
        "staff",
        "Your message has been received. A staff member will reply.",
      );
    }
  }
  return listMessages(c.org_id, c.id, true);
}
export async function suggest(
  orgId: string,
  cId: string,
  body: string,
  locale: Locale,
  requestId: string,
  send = false,
) {
  const existing = get<{ answer: string }>(
    "SELECT answer FROM usage_records WHERE org_id=? AND request_id=?",
    orgId,
    requestId,
  );
  if (existing) return existing.answer;
  const org = transaction(() => {
    const current=get<Organization>('SELECT * FROM organizations WHERE id=?',orgId);
    invariant(current,'Business not found.',404);
    const e=entitlement(current);
    invariant(e.active,'Trial or subscription inactive.',403);
    const c=get<Conversation>('SELECT * FROM conversations WHERE org_id=? AND id=?',orgId,cId);
    invariant(c,'Conversation not found.',404);
    if(send)invariant(!c.paused&&!current.paused&&current.ai_mode==='automatic'&&e.automatic,'Automation is paused.',409);
    // Provider calls time out after 30 seconds. Recover abandoned reservations after ten minutes.
    run("UPDATE ai_requests SET status='failed' WHERE status='pending' AND created_at<?",new Date(Date.now()-600000).toISOString());
    invariant(!get("SELECT 1 FROM ai_requests WHERE org_id=? AND request_id=? AND status='pending'",orgId,requestId),'AI request is already in progress.',409);
    const period=new Date().toISOString().slice(0,7),trial=current.subscription_status==='trial'?1:0;
    const used=get<{n:number}>('SELECT COUNT(*) n FROM usage_records WHERE org_id=? AND (?=1 OR period=?)',orgId,trial,period)!.n;
    const pending=get<{n:number}>("SELECT COUNT(*) n FROM ai_requests WHERE org_id=? AND status='pending' AND (?=1 OR substr(created_at,1,7)=?)",orgId,trial,period)!.n;
    invariant(used+pending<e.replies,'AI reply quota reached. Staff can still reply manually.',403);
    run("INSERT INTO ai_requests VALUES(?,?,'pending',?) ON CONFLICT(org_id,request_id) DO UPDATE SET status='pending',created_at=excluded.created_at",orgId,requestId,now());
    return current;
  });
  try {
  const catalog=catalogForAI(orgId);
  const selection = org.ai_provider==='gemini'
    ? await generateSyntheticReply(body,catalog,locale,org)
    : await new MockProvider().select(body,catalog);
  const answer = 'answer' in selection ? selection.answer : renderAnswer(selection, locale, org, body);
  return transaction(() => {
    const cached = get<{ answer: string }>(
      "SELECT answer FROM usage_records WHERE org_id=? AND request_id=?",
      orgId,
      requestId,
    );
    if (cached) return cached.answer;
    const currentOrg=get<Organization>('SELECT * FROM organizations WHERE id=?',orgId)!;
    if(org.ai_provider==='gemini')invariant(currentOrg.ai_provider==='gemini'&&currentOrg.synthetic_data===1,'Gemini consent was withdrawn.',409);
    const e = entitlement(currentOrg);
    invariant(e.active, "Trial or subscription inactive.", 403);
    const period = new Date().toISOString().slice(0, 7);
    const used =
      get<{ n: number }>(
        "SELECT COUNT(*) n FROM usage_records WHERE org_id=? AND (?=1 OR period=?)",
        orgId,
        currentOrg.subscription_status==='trial'?1:0,
        period,
      )?.n || 0;
    invariant(
      used < e.replies,
      "AI reply quota reached. Staff can still reply manually.",
      403,
    );
    const c = get<Conversation>(
      "SELECT * FROM conversations WHERE org_id=? AND id=?",
      orgId,
      cId,
    );
    invariant(c, "Conversation not found.", 404);
    if (send)
      invariant(
        !c.paused && !currentOrg.paused && currentOrg.ai_mode === "automatic" && e.automatic,
        "Automation is paused.",
        409,
      );
    run(
      "INSERT INTO usage_records VALUES(?,?,?,?,?,?,?,?)",
      id(),
      orgId,
      period,
      requestId,
      answer,
      selection.provider,
      selection.tokens,
      now(),
    );
    addMessage(
      orgId,
      cId,
      "assistant",
      answer,
      send ? "sent" : "suggestion",
      selection.provider,
    );
    run("UPDATE ai_requests SET status='done' WHERE org_id=? AND request_id=?",orgId,requestId);
    return answer;
  });
  } catch(error) {
    run("UPDATE ai_requests SET status='failed' WHERE org_id=? AND request_id=?",orgId,requestId);
    throw error;
  }
}
export function staffReply(actor: Actor, input: unknown) {
  requireRole(actor, ["owner", "manager", "staff"]);
  const data = z
    .object({
      conversationId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
      note: z.boolean().default(false),
    })
    .parse(input);
  const org = organization(actor);
  invariant(
    get(
      "SELECT id FROM conversations WHERE org_id=? AND id=?",
      org.id,
      data.conversationId,
    ),
    "Conversation not found.",
    404,
  );
  addMessage(
    org.id,
    data.conversationId,
    data.note ? "note" : "staff",
    data.body,
  );
  audit(
    org.id,
    actor.id,
    data.note ? "conversation.note" : "conversation.reply",
    data.conversationId,
  );
}
export function updateConversation(actor: Actor, input: unknown) {
  requireRole(actor, ["owner", "manager", "staff"]);
  const data = z
    .object({
      id: z.string().uuid(),
      paused: z.boolean(),
      status: z.enum(["open", "unread", "resolved"]),
      labels: z.string().max(200).default(""),
      assignedTo: z.string().uuid().nullable().default(null),
    })
    .parse(input);
  const org = organization(actor);
  if (data.assignedTo)
    invariant(
      get(
        "SELECT user_id FROM members WHERE org_id=? AND user_id=?",
        org.id,
        data.assignedTo,
      ),
      "Staff member not found.",
      404,
    );
  const result = run(
    "UPDATE conversations SET paused=?,status=?,labels=?,assigned_to=? WHERE org_id=? AND id=?",
    Number(data.paused),
    data.status,
    data.labels,
    data.assignedTo,
    org.id,
    data.id,
  );
  invariant(Number(result.changes) === 1, "Conversation not found.", 404);
  audit(org.id, actor.id, "conversation.updated", data.id);
}
