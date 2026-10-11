"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo, Field, api } from "./ui";
export function AuthForm({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="auth">
      <Logo />
      <div className="panel" style={{ marginTop: 30 }}>
        <span className="eyebrow">YOUR NEXT CHAPTER</span>
        <h1 style={{ margin: "15px 0" }}>
          {signup ? "Make room for growth." : "Welcome back."}
        </h1>
        <p className="muted">
          {signup
            ? "Create your account, then tell us about your business."
            : "Your conversations and customers are waiting."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await api("/api/auth", {
                method: "POST",
                body: JSON.stringify({
                  action: signup ? "register" : "login",
                  email: f.get("email"),
                  password: f.get("password"),
                  ...(signup ? { name: f.get("name") } : {}),
                }),
              });
              router.push("/dashboard");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {signup && (
            <Field
              label="Your name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          )}
          <Field
            label="Email address"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete={signup ? "new-password" : "current-password"}
          />
          {signup && (
            <span className="small muted">Use at least 12 characters.</span>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
          </button>
        </form>
        <p className="small muted" style={{ marginTop: 22 }}>
          {signup ? "Already have an account?" : "New to ReplyPilot?"}{" "}
          <Link
            href={signup ? "/login" : "/signup"}
            style={{ color: "var(--accent)" }}
          >
            {signup ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
      <p className="small muted" style={{ marginTop: 20 }}>
        Local development · Use fictional data. Billing is simulated. Cloud
        authentication is not connected.
      </p>
    </main>
  );
}
