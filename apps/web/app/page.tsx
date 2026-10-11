import Link from "next/link";
import {
  ArrowUpRight,
  MessageCircle,
  Sparkles,
  Check,
  Globe,
  Package,
  CalendarDays,
} from "lucide-react";
export default function Home() {
  return (
    <>
      <nav className="public-nav">
        <Link href="/" className="logo">
          <span className="logo-mark">
            <MessageCircle size={21} />
          </span>
          replypilot<span>·</span>
        </Link>
        <div className="public-links">
          <Link href="/features">Features</Link>
          <Link href="/industries">For your business</Link>
          <Link href="/pricing">Pricing</Link>
        </div>
        <div className="row">
          <Link href="/login">Log in</Link>
          <Link className="btn primary" href="/signup">
            Start your free trial <ArrowUpRight size={16} />
          </Link>
        </div>
      </nav>
      <main>
        <section className="hero">
          <div>
            <span className="badge">
              <Sparkles size={13} /> YOUR BUSINESS. IN EVERY LANGUAGE.
            </span>
            <h1>
              A little less busy.
              <br />
              <em>
                A lot more
                <br />
                business.
              </em>
            </h1>
            <p className="muted">
              Turn customer questions into your next opportunity. One thoughtful
              workspace for conversations, products, and everyday business.
            </p>
            <div className="row wrap" style={{ marginTop: 28 }}>
              <Link href="/signup" className="btn primary">
                Build your workspace <ArrowUpRight size={17} />
              </Link>
              <Link href="/demo" className="btn">
                Try the live demo
              </Link>
            </div>
            <p className="small muted" style={{ marginTop: 18 }}>
              7-day trial · No card required · English, کوردی, العربية
            </p>
          </div>
          <div className="hero-preview">
            <div className="row between">
              <div className="row">
                <span className="logo-mark">
                  <MessageCircle size={18} />
                </span>
                <div>
                  <strong>ReplyPilot Demo Electronics</strong>
                  <div className="muted small">Fictional store · Mock AI</div>
                </div>
              </div>
              <span className="badge">Website chat</span>
            </div>
            <div className="bubble">
              Do you have a laptop with RTX 4060 and 16GB RAM?
            </div>
            <div className="bubble answer">
              <div
                className="row small"
                style={{ color: "var(--accent)", marginBottom: 8 }}
              >
                <Sparkles size={15} /> From your verified catalog
              </div>
              <strong>Atlas Gaming 15</strong>
              <p style={{ margin: "7px 0" }}>
                Intel Core i7 · RTX 4060
                <br />
                16GB RAM · 512GB SSD
              </p>
              <div className="row between">
                <strong>1,450,000 IQD</strong>
                <span className="badge">4 in stock</span>
              </div>
              <div className="small muted" style={{ marginTop: 8 }}>
                Sample price and inventory
              </div>
            </div>
            <div className="row small muted" style={{ marginTop: 22 }}>
              <Check size={15} /> Grounded answers. A human when it matters.
            </div>
          </div>
        </section>
        <section className="section">
          <div className="eyebrow">A calmer way to run your business</div>
          <h2 className="section-title">
            Everything connects. You stay in control.
          </h2>
          <div className="grid three">
            {[
              [
                MessageCircle,
                "Every conversation, together",
                "Website messages, customer history, and staff replies in one inbox.",
              ],
              [
                Package,
                "Your catalog is the source",
                "Detailed specifications, real inventory, and order requests that need your approval.",
              ],
              [
                Globe,
                "Closer to your customers",
                "English, Arabic, Sorani, and Badini in Kurdish script. Dialect support is under review.",
              ],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof MessageCircle;
              return (
                <div className="panel" key={String(title)}>
                  <I color="var(--accent)" size={25} />
                  <h2 style={{ marginTop: 24 }}>{String(title)}</h2>
                  <p className="muted">{String(body)}</p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="section">
          <div className="panel row between wrap">
            <div>
              <div className="eyebrow">Built around your work</div>
              <h2 className="section-title" style={{ margin: "12px 0" }}>
                A shop, a salon, or something new.
              </h2>
              <p className="muted">
                Flexible product details and service scheduling for your kind of
                business.
              </p>
            </div>
            <Link className="btn" href="/industries">
              Explore industries <CalendarDays size={16} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="footer">
        <strong>ReplyPilot AI 2.0</strong>
        <div className="row wrap">
          {["about", "faq", "contact", "privacy", "terms"].map((p) => (
            <Link key={p} href={`/${p}`}>
              {p[0].toUpperCase() + p.slice(1)}
            </Link>
          ))}
        </div>
        <span className="muted small">
          Development preview · Simulated billing
        </span>
      </footer>
    </>
  );
}
