"use client";
import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Send, ShoppingBag } from "lucide-react";
import { api, Field } from "./ui";
import { type Locale, type Message, type Product, money } from "@reply/shared";
import { languages, rtl } from "@reply/localization";
type PublicBusiness = {
  name: string;
  locale: Locale;
  aiMode: string;
  aiProvider: 'mock'|'gemini';
  hours: string;
  products: Product[];
  variants: {
    id: string;
    product_id: string;
    name: string;
    price: number;
    stock: number;
  }[];
};
type Session = { id: string; token: string };
export function CustomerChat({ orgId }: { orgId: string }) {
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [automaticLanguage,setAutomaticLanguage]=useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [variantIds, setVariantIds] = useState<Record<string, string>>({});
  useEffect(() => {
    api<PublicBusiness>("/api/chat/" + orgId)
      .then((b) => {
        setBusiness(b);
        setLocale(b.locale);
      })
      .catch((e) => setError(e.message));
    const stored = sessionStorage.getItem("rp-chat:" + orgId);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        queueMicrotask(() => setSession(parsed));
      } catch {
        sessionStorage.removeItem("rp-chat:" + orgId);
      }
    }
  }, [orgId]);
  const refresh = useCallback(async () => {
    if (session) {
      try {
        const r = await api<{ messages: Message[];locale?:Locale }>(
          `/api/chat/${orgId}?conversation=${session.id}`,
          { headers: { Authorization: "Bearer " + session.token } },
        );
        setMessages(r.messages);
        if(automaticLanguage&&r.locale)setLocale(r.locale);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }, [session, orgId,automaticLanguage]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(refresh, 3000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [refresh]);
  async function send(action: string, data: unknown) {
    return api<{ messages: Message[]; orderId?: string;locale?:Locale }>(
      "/api/chat/" + orgId,
      {
        method: "POST",
        headers: session ? { Authorization: "Bearer " + session.token } : {},
        body: JSON.stringify({ action, conversationId: session?.id, data }),
      },
    );
  }
  const placeholders = {
    en: "Ask about a product…",
    ckb: "پرسیار لەبارەی بەرهەمێک بکە…",
    bad: "دەربارەی بەرهەمەکی بپرسە…",
    ar: "اسأل عن منتج…",
  };
  return (
    <main className="chat-page" dir={rtl(locale) ? "rtl" : "ltr"}>
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <header
          className="row between"
          style={{ padding: 20, borderBottom: "1px solid var(--line)" }}
        >
          <div className="row">
            <span className="logo-mark">
              <MessageCircle size={20} />
            </span>
            <div>
              <strong>{business?.name || "Website chat"}</strong>
              <div className="small muted">
                {business?.aiMode === "automatic"
                  ? business.aiProvider==='gemini' ? "Gemini · fictional messages only · sent to Google for processing" : "Mock AI · Staff are available for handoff"
                  : "Messages are reviewed by staff"}
              </div>
            </div>
          </div>
          <select
            aria-label="Chat language"
            className="language-select"
            value={automaticLanguage?'auto':locale}
            onChange={(e) => {setAutomaticLanguage(e.target.value==='auto');if(e.target.value!=='auto')setLocale(e.target.value as Locale);}}
          >
            <option value="auto">Auto-detect language</option>
            {Object.entries(languages).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {!session ? (
          <form
            className="stack"
            style={{ padding: 25 }}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                const s = await api<Session>("/api/chat/" + orgId, {
                  method: "POST",
                  body: JSON.stringify({
                    action: "start",
                    data: { name: f.get("name"), ...(automaticLanguage?{}:{locale}) },
                  }),
                });
                setSession(s);
                sessionStorage.setItem("rp-chat:" + orgId, JSON.stringify(s));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>Welcome. How can we help?</h2>
            <Field
              label="Your name"
              name="name"
              required
              minLength={2}
              maxLength={100}
            />
            <button className="btn primary" disabled={busy || !business}>
              Start conversation
            </button>
            <p className="muted small">
              Local development only. Please use fictional information.
            </p>
          </form>
        ) : (
          <>
            <div className="messages" aria-live="polite">
              {!messages.length && (
                <div className="notice">
                  Welcome! Ask about our catalog, or request an item below.{" "}
                  {business?.hours}
                </div>
              )}
              {messages.map((m) => (
                <div className={"message " + m.role} key={m.id}>
                  <div className="small muted">
                    {m.role === "customer"
                      ? "You"
                      : m.role === "assistant"
                        ? "Assistant · " + m.provider
                        : m.provider==='local-fallback'?'Local fallback':"Staff"}
                  </div>
                  <p dir="auto">{m.body}</p>
                </div>
              ))}
            </div>
            <form
              className="composer"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const r = await send("message", {
                    body,
                    ...(automaticLanguage?{}:{locale}),
                    requestId: crypto.randomUUID(),
                  });
                  setMessages(r.messages);
                  if(automaticLanguage&&r.locale)setLocale(r.locale);
                  setBody("");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="row">
                <input
                  aria-label="Customer message"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={placeholders[locale]}
                  required
                  maxLength={2000}
                />
                <button
                  className="btn primary"
                  aria-label="Send message"
                  disabled={busy}
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
            <details
              style={{ padding: 20, borderTop: "1px solid var(--line)" }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Browse catalog & request an order
              </summary>
              <p className="muted small">
                Requests need staff confirmation. Delivery is quoted separately.
              </p>
              <div className="grid two">
                {business?.products.map((p) => {
                  const variants = business.variants.filter(
                    (v) => v.product_id === p.id,
                  );
                  return (
                    <div className="chat-product" key={p.id}>
                      <h3>{p.name}</h3>
                      <span>
                        {money(p.price, p.currency, locale)} · {p.stock} in
                        stock
                      </span>
                      {!!variants.length && (
                        <select
                          aria-label={"Variant for " + p.name}
                          value={variantIds[p.id] || variants[0].id}
                          onChange={(e) =>
                            setVariantIds({
                              ...variantIds,
                              [p.id]: e.target.value,
                            })
                          }
                        >
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} · {v.stock} in stock
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            const r = await send("order", {
                              productId: p.id,
                              variantId: variants.length
                                ? variantIds[p.id] || variants[0].id
                                : null,
                              quantity: 1,
                              requestId: crypto.randomUUID(),
                            });
                            setNotice(
                              "Order request #" +
                                r.orderId?.slice(0, 8) +
                                " received. Awaiting staff confirmation.",
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <ShoppingBag size={14} /> Request {p.name}
                      </button>
                    </div>
                  );
                })}
              </div>
            </details>
          </>
        )}
      </div>
      <p className="small muted" style={{ textAlign: "center", marginTop: 16 }}>
        Powered by ReplyPilot · Kurdish translations are under review
      </p>
    </main>
  );
}
