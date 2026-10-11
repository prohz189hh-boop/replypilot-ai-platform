"use client";
import { useCallback, useEffect, useState } from "react";
import { Search, Send, Sparkles, Pause, Play, Globe } from "lucide-react";
import type { Message } from "@reply/shared";
import { languages } from "@reply/localization";
import { api, Empty } from "./ui";
import type { Snapshot, Action } from "./workspace-types";
export function Inbox({ data, act }: { data: Snapshot; act: Action }) {
  const [selected, setSelected] = useState<string | null>(
    data.conversations[0]?.id || null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const c = data.conversations.find((c) => c.id === selected);
  const refresh = useCallback(async () => {
    if (selected) {
      try {
        const result = await api<{ messages: Message[] }>(
          "/api/workspace?conversation=" + selected,
        );
        setMessages(result.messages);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }, [selected]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(refresh, 5000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [refresh]);
  return (
    <div className="stack">
      <div>
        <h1>Customer inbox</h1>
        <p className="muted">
          One conversation at a time. A better experience for everyone.
        </p>
      </div>
      <div className="inbox panel" style={{ padding: 0 }}>
        <aside className="conversation-list">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search conversations"
              aria-label="Search conversations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {data.conversations
            .filter((c) =>
              (c.customer_name + " " + c.labels)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((c) => (
              <button
                className={
                  "conversation-item " + (selected === c.id ? "active" : "")
                }
                key={c.id}
                onClick={() => {
                  setSelected(c.id);
                  setDraft("");
                }}
              >
                <div className="row between">
                  <strong>{c.customer_name}</strong>
                  {c.status === "unread" && <span className="unread-dot" />}
                </div>
                <div className="small muted" style={{ marginTop: 8 }}>
                  {languages[c.locale]} · Website chat
                </div>
                <div className="small muted" style={{ marginTop: 7 }}>
                  {new Date(c.updated_at).toLocaleString()}
                </div>
              </button>
            ))}
          {!data.conversations.length && (
            <Empty>Install your widget to start a conversation.</Empty>
          )}
        </aside>
        <section className="conversation-body">
          {c ? (
            <>
              <header className="row between wrap">
                <div className="row">
                  <span className="avatar">{c.customer_name[0]}</span>
                  <div>
                    <strong>{c.customer_name}</strong>
                    <div className="small muted">
                      {languages[c.locale]} · {c.status}
                    </div>
                  </div>
                </div>
                <button
                  className="btn"
                  onClick={() =>
                    act("conversation.update", {
                      id: c.id,
                      paused: !c.paused,
                      status: "open",
                      labels: c.labels,
                      assignedTo: c.assigned_to,
                    })
                  }
                >
                  {c.paused ? <Play size={15} /> : <Pause size={15} />}{" "}
                  {c.paused ? "Resume AI" : "Human takeover"}
                </button>
              </header>
              <div className="messages">
                {messages.map((m) => (
                  <div
                    className={
                      "message " +
                      m.role +
                      (m.kind === "suggestion" ? " suggestion" : "")
                    }
                    key={m.id}
                  >
                    <div className="small muted">
                      {m.role === "assistant" ? "AI · " + m.provider : m.role}{" "}
                      {m.kind === "suggestion" ? "· Draft for review" : ""}
                    </div>
                    <p dir="auto">{m.body}</p>
                    <div className="row between">
                      <time className="small muted">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      {m.kind === "suggestion" && (
                        <button
                          className="btn small"
                          onClick={() => setDraft(m.body)}
                        >
                          Use this draft
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!messages.length && <Empty>No messages yet.</Empty>}
              </div>
              <form
                className="composer"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  if (
                    await act("reply", {
                      conversationId: c.id,
                      body: draft,
                      note,
                    })
                  ) {
                    setDraft("");
                    await refresh();
                  }
                  setBusy(false);
                }}
              >
                <div className="row between wrap">
                  <label className="row small">
                    <input
                      type="checkbox"
                      checked={note}
                      onChange={(e) => setNote(e.target.checked)}
                      style={{ width: 15 }}
                    />{" "}
                    Internal note
                  </label>
                  <button
                    type="button"
                    className="btn ghost small"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      await act("suggest", {
                        conversationId: c.id,
                        requestId: crypto.randomUUID(),
                      });
                      await refresh();
                      setBusy(false);
                    }}
                  >
                    <Sparkles size={14} /> Suggest a reply
                  </button>
                </div>
                <textarea
                  aria-label="Reply message"
                  placeholder={
                    note
                      ? "Only your team can see this note…"
                      : "Write a helpful reply…"
                  }
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  required
                  maxLength={4000}
                />
                <div className="row between">
                  <span className="small muted">
                    AI suggestions require staff review.
                  </span>
                  <button
                    className="btn primary"
                    disabled={busy || !draft.trim()}
                  >
                    <Send size={14} /> {note ? "Save note" : "Send reply"}
                  </button>
                </div>
              </form>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
            </>
          ) : (
            <Empty>
              <Globe size={26} />
              Your next customer conversation starts here.
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}
