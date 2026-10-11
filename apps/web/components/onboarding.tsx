"use client";
import { useState } from "react";
import { Logo, Field, mutate } from "./ui";
import { industries } from "@reply/shared";
import { languages } from "@reply/localization";
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth" style={{ maxWidth: 600 }}>
      <Logo />
      <div className="panel" style={{ marginTop: 30 }}>
        <span className="eyebrow">LET’S MAKE IT YOURS</span>
        <h1 style={{ marginTop: 14 }}>Tell us about your business.</h1>
        <p className="muted">
          We’ll tailor your workspace to the way you work.
        </p>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await mutate("onboard", {
                name: f.get("name"),
                industry: f.get("industry"),
                locale: f.get("locale"),
                currency: f.get("currency"),
                timezone: f.get("timezone"),
                sample: f.get("sample") === "on",
              });
              onDone();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            label="Business name"
            name="name"
            required
            defaultValue="ReplyPilot Demo Electronics"
          />
          <div className="grid two">
            <label>
              Business type
              <select name="industry">
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {i[0].toUpperCase() + i.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Workspace language
              <select name="locale">
                {Object.entries(languages).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Currency
              <select name="currency">
                <option>IQD</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </label>
            <Field
              label="Timezone"
              name="timezone"
              defaultValue="Asia/Baghdad"
              required
            />
          </div>
          <label className="row">
            <input
              type="checkbox"
              name="sample"
              defaultChecked
              style={{ width: 18 }}
            />{" "}
            Add fictional electronics samples
          </label>
          <div className="notice">
            7-day Growth trial · 30 mock AI replies · No payment details
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Creating workspace…" : "Open my workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}
