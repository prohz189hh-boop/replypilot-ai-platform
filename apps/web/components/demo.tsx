"use client";
import { useState } from "react";
import Link from "next/link";
import { Sparkles, Send } from "lucide-react";
import { api, Logo } from "./ui";
import { languages, rtl } from "@reply/localization";
import type { Locale } from "@reply/shared";
export function Demo() {
  const [locale, setLocale] = useState<Locale>("en");
  const [question, setQuestion] = useState(
    "Do you have a laptop with RTX 4060 and 16GB RAM?",
  );
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gemini,setGemini]=useState(false);
  const [providerLabel,setProviderLabel]=useState('Mock');
  return (
    <main className="chat-page">
      <Logo />
      <div className="panel stack" style={{ marginTop: 30 }}>
        <span className="eyebrow">TRY A REAL CATALOG LOOKUP</span>
        <h1>Meet your next assistant.</h1>
        <p className="muted">
          ReplyPilot Demo Electronics · Fictional products, prices, and
          inventory. Choose the local mock or a live Gemini catalog-selection test using a fixed fictional question. Replies are rendered from catalog facts.
        </p>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await api<{ answer: string;provider:string;tokens:number;fallback:boolean }>("/api/demo", {
                method: "POST",
                body: JSON.stringify({ question, locale,gemini }),
              });
              setAnswer(result.answer);
              setProviderLabel(result.fallback?'Mock fallback · Gemini unavailable':result.provider==='gemini'?`Live Gemini · ${result.tokens} tokens`:'Mock');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>Demo engine<select value={gemini?'gemini':'mock'} onChange={e=>setGemini(e.target.value==='gemini')}><option value="mock">Local deterministic mock</option><option value="gemini">Live Gemini · fixed synthetic data</option></select></label>
          {gemini&&<p className="small muted">Only fictional laptop specifications and a fixed RTX 4060 question are sent to Google. Your typed question is not sent. No customer conversations are used.</p>}
          <label>
            Reply language
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              {Object.entries(languages).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Your question
            <textarea
              value={gemini?'Do you have a laptop with RTX 4060 and 16GB RAM?':question}
              disabled={gemini}
              onChange={(e) => setQuestion(e.target.value)}
              required
              maxLength={1000}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            <Send size={16} />
            {busy ? "Checking catalog…" : "Ask the assistant"}
          </button>
        </form>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {answer && (
          <div className="notice" dir={rtl(locale) ? "rtl" : "ltr"}>
            <span className="row small">
              <Sparkles size={14} /> {providerLabel} · Catalog-backed answer
            </span>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{answer}</p>
          </div>
        )}
        <p className="small muted">
          Sorani and Badini templates require native-speaker review. Create a
          workspace to try the full customer chat → inbox → order approval flow.
        </p>
        <Link className="btn" href="/signup">
          Create your free workspace
        </Link>
      </div>
    </main>
  );
}
