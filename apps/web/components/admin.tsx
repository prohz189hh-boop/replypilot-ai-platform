"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Logo } from "./ui";
import { type Organization } from "@reply/shared";
type Overview = {
  organizations: Organization[];
  requests: {
    id: string;
    name: string;
    action: string;
    plan: string;
    status: string;
  }[];
  usage: { provider: string; replies: number; tokens: number }[];
  audit: { id: string; action: string; created_at: string }[];
  providerCalls:{model:string;status:string;calls:number;tokens:number|null;paid_reference_usd:number|null}[];
};
export function Admin() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  async function load() {
    try {
      setData(await api<Overview>("/api/admin"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    return () => clearTimeout(initial);
  }, []);
  return (
    <main className="pricing-page stack">
      <div className="row between">
        <Logo />
        <Link href="/dashboard" className="btn">
          Back to workspace
        </Link>
      </div>
      <h1>Platform administration</h1>
      <p className="muted">
        Aggregate workspace and billing records. Customer conversation contents
        are excluded.
      </p>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {data && (
        <>
          <div className="grid three">
            <div className="panel">
              <h2>Businesses</h2>
              <div className="price">{data.organizations.length}</div>
            </div>
            <div className="panel">
              <h2>Trials</h2>
              <div className="price">
                {
                  data.organizations.filter(
                    (o) => o.subscription_status === "trial",
                  ).length
                }
              </div>
            </div>
            <div className="panel">
              <h2>AI replies</h2>
              <div className="price">
                {data.usage.reduce((n, u) => n + u.replies, 0)}
              </div>
              <p className="muted small">
                Mock provider · See synthetic provider usage below
              </p>
            </div>
          </div>
          <div className="panel"><h2>Synthetic provider usage</h2><p className="muted small">Published paid-price comparison, not actual charges. Billing tier is not inferred. Failed calls may have unknown usage.</p>{data.providerCalls.map(row=><div className="list-row" key={row.model+row.status}><span>{row.model} · {row.status} · {row.calls} calls</span><span>{row.tokens??'Unknown'} tokens · {row.paid_reference_usd===null?'Unknown cost':`$${row.paid_reference_usd.toFixed(6)} reference`}</span></div>)}{!data.providerCalls.length&&<p>No recorded provider calls.</p>}</div>
          <div className="panel">
            <h2>Subscription verification</h2>
            <p className="small muted">
              For local simulation only. Verification creates an audit record
              and never charges money.
            </p>
            {data.requests.map((r) => (
              <div className="list-row" key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <p className="muted">
                    {r.action} · {r.plan}
                  </p>
                </div>
                <span className="badge">{r.status}</span>
                {r.status === "pending_review" && (
                  <button
                    className="btn"
                    onClick={async () => {
                      try {
                        await api("/api/admin", {
                          method: "POST",
                          body: JSON.stringify({ eventId: r.id }),
                        });
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Verify simulation
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="panel table-scroll">
            <h2>Registered businesses</h2>
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Industry</th>
                  <th>Plan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.organizations.map((o) => (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td>{o.industry}</td>
                    <td>{o.plan}</td>
                    <td>{o.subscription_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h2>Audit records</h2>
            {data.audit.map((a) => (
              <div className="list-row" key={a.id}>
                <span>{a.action}</span>
                <span className="small muted">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
