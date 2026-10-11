import Link from "next/link";
import { Logo } from "@/components/ui";
import { plans } from "@reply/billing";
export default function Page() {
  return (
    <main className="pricing-page">
      <Logo />
      <div style={{ textAlign: "center", margin: "60px 0 40px" }}>
        <span className="eyebrow">SMALL BUSINESS. ROOM TO GROW.</span>
        <h1 style={{ fontSize: 44, marginTop: 18 }}>
          A simpler plan for your business.
        </h1>
        <p className="muted">
          Seven days to explore. No card required. All four languages on every
          plan.
        </p>
      </div>
      <div className="grid three">
        {Object.entries(plans).map(([k, p]) => (
          <div
            className={"panel plan " + (k === "growth" ? "selected" : "")}
            key={k}
          >
            <div className="row between">
              <h2>{p.name}</h2>
              {k === "growth" && <span className="badge">Room to grow</span>}
            </div>
            <div className="price">
              ${p.price}
              <small> / month</small>
            </div>
            <ul className="features">
              <li>One business workspace</li>
              <li>{p.products.toLocaleString()} products</li>
              <li>{p.replies.toLocaleString()} AI replies / month</li>
              <li>
                {p.staff} staff account{p.staff > 1 ? "s" : ""}
              </li>
              <li>Website chat and inbox</li>
              <li>Manual order management</li>
              <li>{k === "starter" ? "Basic" : "Advanced"} analytics</li>
              <li>Sorani, Badini, Arabic, English</li>
              {k !== "starter" && (
                <>
                  <li>Automatic response controls</li>
                  <li>Enhanced order management</li>
                  <li>Appointment scheduling</li>
                  <li>CSV import / export</li>
                  <li>Official social integrations*</li>
                </>
              )}
              {k === "pro" && (
                <>
                  <li>Advanced automation*</li>
                  <li>Multi-staff scheduling</li>
                  <li>Reporting exports*</li>
                  <li>More customization*</li>
                  <li>Priority support workflow*</li>
                </>
              )}
            </ul>
            <Link href="/signup" className="btn primary">
              Start your trial
            </Link>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 25 }}>
        Initial configurable offers. Trial includes 30 AI replies. Billing is
        simulated; no commercial subscriptions are sold here. *These planned
        capabilities require further implementation or provider approval. See
        the workspace for current availability.
      </p>
      <Link href="/" className="btn">
        Back to ReplyPilot
      </Link>
    </main>
  );
}
