"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  MessageCircle,
  Sparkles,
  Package,
  Boxes,
  ShoppingBag,
  Users,
  Scissors,
  CalendarDays,
  ChartNoAxesCombined,
  Zap,
  Languages,
  Plug,
  Wallet,
  Settings as SettingsIcon,
  Search,
  ChevronDown,
  ArrowUpRight,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Logo, api, mutate, Empty } from "./ui";
import { Onboarding } from "./onboarding";
import { Catalog } from "./catalog";
import { Inbox } from "./inbox";
import { TranslationReviews } from './translation-review';
import {
  Orders,
  Services,
  Settings,
  Billing,
  Team,
  Integrations,
  Customers,
  Automations,
} from "./business-panels";
import type { Snapshot } from "./workspace-types";
import { type Locale, money } from "@reply/shared";
import { languages, translations, rtl } from "@reply/localization";
const nav = [
  ["overview", LayoutDashboard],
  ["inbox", MessageCircle],
  ["assistant", Sparkles],
  ["products", Package],
  ["inventory", Boxes],
  ["orders", ShoppingBag],
  ["customers", Users],
  ["services", Scissors],
  ["appointments", CalendarDays],
  ["analytics", ChartNoAxesCombined],
  ["automations", Zap],
  ["team", Users],
  ["language", Languages],
  ["integrations", Plug],
  ["billing", Wallet],
  ["settings", SettingsIcon],
] as const;
type Tab = (typeof nav)[number][0];
export function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [locale, setLocale] = useState<Locale>("en");
  const [dark, setDark] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [globalSearch, setGlobalSearch] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await api<Snapshot>("/api/workspace");
      setData(result);
      setLocale(result.org?.locale || "en");
    } catch (e) {
      const message = (e as Error).message;
      if (message.toLowerCase().includes("log in")) router.replace("/login");
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    return () => clearTimeout(initial);
  }, [load]);
  async function act(action: string, payload: unknown) {
    setError("");
    setSuccess("");
    try {
      await mutate(action, payload);
      await load();
      setSuccess("Saved successfully.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  const t = translations[locale];
  if (loading)
    return (
      <main className="loading">
        <span className="logo-mark">
          <RefreshCw size={20} />
        </span>
        Opening your workspace…
      </main>
    );
  if (!data)
    return (
      <main className="auth">
        <div role="alert" className="error">
          {error || "Workspace unavailable"}
        </div>
        <button className="btn" onClick={load}>
          Try again
        </button>
      </main>
    );
  if (!data.org) return <Onboarding onDone={load} />;
  const serviceBusiness = ["salon", "barber", "repair"].includes(
    data.org.industry,
  );
  return (
    <div
      className={"app-shell " + (dark ? "dark" : "")}
      dir={rtl(locale) ? "rtl" : "ltr"}
      lang={locale === "bad" ? "ku-Arab" : locale}
    >
      <aside className={"sidebar " + (mobile ? "visible" : "")}>
        <div className="row between">
          <Logo />
          <button
            className="icon-btn mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="business-switch row">
          <span className="store-icon">
            <ShoppingBag size={18} />
          </span>
          <div>
            <strong>{data.org.name}</strong>
            <div className="muted small">{data.org.industry} workspace</div>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">{t.business}</div>
        <nav>
          {nav
            .filter(
              ([key]) =>
                !(
                  ["services", "appointments"].includes(key) && !serviceBusiness
                ) && !(serviceBusiness && ["inventory"].includes(key)),
            )
            .map(([key, Icon], i) => (
              <div key={key}>
                {i === 10 && <div className="nav-label">{t.manage}</div>}
                <button
                  className={"nav-item " + (tab === key ? "active" : "")}
                  onClick={() => {
                    setTab(key);
                    setMobile(false);
                    setSuccess("");
                  }}
                >
                  <Icon size={18} />
                  <span>{t[key]}</span>
                  {key === "inbox" &&
                    data.conversations.filter((c) => c.status === "unread")
                      .length > 0 && (
                      <span className="nav-count">
                        {
                          data.conversations.filter(
                            (c) => c.status === "unread",
                          ).length
                        }
                      </span>
                    )}
                  {key === "assistant" && (
                    <span className="tiny-badge">AI</span>
                  )}
                </button>
              </div>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trial-card">
            <div className="row between">
              <strong>
                {data.org.subscription_status === "trial"
                  ? "Your free trial"
                  : "Your subscription"}
              </strong>
              <Sparkles size={16} />
            </div>
            <p className="small muted">
              {data.usage} of {data.entitlement.replies} AI replies used
            </p>
            <div className="progress">
              <span
                style={{
                  width:
                    Math.min(
                      100,
                      (data.usage / data.entitlement.replies) * 100,
                    ) + "%",
                }}
              />
            </div>
            <button className="btn" onClick={() => setTab("billing")}>
              Explore plans <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className="nav-item"
            onClick={async () => {
              await api("/api/auth", {
                method: "POST",
                body: JSON.stringify({ action: "logout" }),
              });
              router.push("/login");
            }}
          >
            <LogOut size={17} />
            {t.logout}
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="row">
            <button
              className="icon-btn mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="muted">Workspace</span>
            <span className="muted">/</span>
            <strong>{t[tab]}</strong>
          </div>
          <div className="row">
            <form
              className="search-box top-search"
              onSubmit={(e) => {
                e.preventDefault();
                setTab("products");
              }}
            >
              <Search size={16} />
              <input
                aria-label="Workspace search"
                placeholder={t.search}
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <select
              aria-label="Interface language"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="language-select"
            >
              {Object.entries(languages).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button
              className="icon-btn"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="avatar">{data.user.name.slice(0, 1)}</span>
          </div>
        </header>
        <main className="workspace-content">
          {error && (
            <div role="alert" className="error row between">
              {error}
              <button
                className="icon-btn"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {success && (
            <div role="status" className="notice row between">
              {success}
              <button
                className="icon-btn"
                aria-label="Dismiss notification"
                onClick={() => setSuccess("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "overview" || tab === "analytics" ? (
            <Overview
              data={data}
              locale={locale}
              select={setTab}
              analytics={tab === "analytics"}
            />
          ) : tab === "products" || tab === "inventory" ? (
            <Catalog key={globalSearch} data={data} act={act} inventory={tab === "inventory"} initialQuery={globalSearch} refresh={load} />
          ) : tab === "inbox" ? (
            <Inbox data={data} act={act} />
          ) : tab === "orders" ? (
            <Orders data={data} act={act} />
          ) : tab === "services" || tab === "appointments" ? (
            <Services data={data} act={act} bookings={tab === "appointments"} />
          ) : tab === 'language' ? <TranslationReviews data={data}/> : tab === "assistant" || tab === "settings" ? (
            <Settings
              key={tab}
              data={data}
              act={act}
              assistant={tab === "assistant"}
            />
          ) : tab === "billing" ? (
            <Billing data={data} act={act} />
          ) : tab === "team" ? (
            <Team data={data} act={act} />
          ) : tab === "integrations" ? (
            <Integrations data={data} />
          ) : tab === "customers" ? (
            <Customers data={data} />
          ) : (
            <Automations data={data} act={act} />
          )}
          <footer className="workspace-footer">
            <span>
              ReplyPilot AI 2.0 · Local development · Mock AI · Simulated
              billing
            </span>
            {!!data.user.platform_admin && (
              <Link href="/admin">
                <ShieldCheck size={14} /> Platform admin
              </Link>
            )}
            <button
              className="icon-btn"
              aria-label="Refresh workspace"
              onClick={load}
            >
              <RefreshCw size={14} />
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Overview({
  data,
  locale,
  select,
  analytics,
}: {
  data: Snapshot;
  locale: Locale;
  select: (tab: Tab) => void;
  analytics: boolean;
}) {
  const t = translations[locale];
  const revenue = data.revenue.length
    ? data.revenue.map((r) => money(r.total, r.currency, locale)).join(" / ")
    : money(0, data.org.currency, locale);
  const low = data.products.filter((p) => !p.archived && p.stock <= 3);
  const metrics = [
    {
      label: t.revenue,
      value: revenue,
      icon: Wallet,
      detail: "Completed orders only",
    },
    {
      label: t.conversations,
      value: data.conversations.length,
      icon: MessageCircle,
      detail: "Website conversations",
    },
    {
      label: t.replies,
      value: data.usage,
      icon: Sparkles,
      detail: `of ${data.entitlement.replies} replies this month`,
    },
    {
      label: t.lowStock,
      value: low.length,
      icon: Package,
      detail: "Products with 3 units or fewer",
    },
  ];
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      label: d.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }),
      value: data.activity.find((a) => a.day === key)?.count || 0,
    };
  });
  const max = Math.max(...days.map((d) => d.value), 1);
  return (
    <div className="stack">
      <div className="row between wrap">
        <div>
          <div className="eyebrow">
            {new Date().toLocaleDateString("en", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
          <h1 style={{ margin: "12px 0 8px" }}>
            {analytics ? "Business analytics" : t.welcome}
            <span className="welcome-dot">.</span>
          </h1>
          <p className="muted">
            A little clarity for your day. Here’s what’s happening at{" "}
            {data.org.name}.
          </p>
        </div>
        <button className="btn" onClick={() => select("integrations")}>
          Open website chat <ArrowUpRight size={16} />
        </button>
      </div>
      {!analytics && (
        <div className="welcome-banner">
          <div>
            <span className="badge">YOUR WORKSPACE IS READY</span>
            <h2>Good conversations start with good information.</h2>
            <p>
              Keep your catalog up to date. Your assistant takes it from there.
            </p>
            <button className="btn" onClick={() => select("products")}>
              Build your catalog <ArrowRight size={15} />
            </button>
          </div>
          <div className="banner-art" aria-hidden="true">
            <MessageCircle size={78} strokeWidth={1} />
            <span>
              <Sparkles size={26} />
            </span>
            <div>سڵاو &nbsp; Hello &nbsp; مرحباً</div>
          </div>
        </div>
      )}
      <div className="grid four">
        {metrics.map((m) => (
          <div className="panel stat" key={m.label}>
            <div className="row between">
              <span className="muted">{m.label}</span>
              <m.icon size={18} color="var(--muted)" />
            </div>
            <div className="stat-value">{m.value}</div>
            <div className="small muted">{m.detail}</div>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <div className="panel">
          <div className="row between">
            <div>
              <h2>{t.activity}</h2>
              <p className="muted small">
                New conversations · Last 7 days (UTC)
              </p>
            </div>
            <span className="badge gray">Website chat</span>
          </div>
          <div
            className="chart"
            role="img"
            aria-label={
              "Daily conversations: " +
              days.map((d) => d.label + " " + d.value).join(", ")
            }
          >
            {days.map((d) => (
              <div className="chart-column" key={d.key}>
                <span className="small muted">{d.value}</span>
                <div className="chart-track">
                  <div
                    className="chart-bar"
                    style={{
                      height: (d.value / max) * 100 + "%",
                      minHeight: d.value ? 4 : 0,
                    }}
                  />
                </div>
                <span className="small muted">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="row between">
            <h2>Assistant status</h2>
            <span className="badge">
              <span className="status-dot" />{" "}
              {data.org.paused ? "Paused" : data.org.ai_mode}
            </span>
          </div>
          <div className="assistant-orb">
            <Sparkles size={32} />
          </div>
          <h3 style={{ textAlign: "center" }}>
            A helpful member of your team.
          </h3>
          <p className="muted small" style={{ textAlign: "center" }}>
            Catalog facts in four languages.
            <br />
            Staff approval keeps you in control.
          </p>
          <div className="list-row small">
            <span>Provider</span>
            <strong>Local mock</strong>
          </div>
          <div className="list-row small">
            <span>Catalog</span>
            <strong>{data.productCount} products</strong>
          </div>
          <button
            className="btn"
            style={{ width: "100%", marginTop: 16 }}
            onClick={() => select("assistant")}
          >
            Manage assistant <ArrowRight size={14} />
          </button>
        </div>
      </div>
      <div className="overview-grid">
        <div className="panel">
          <div className="row between">
            <h2>{t.recent}</h2>
            <button className="btn ghost small" onClick={() => select("inbox")}>
              {t.viewAll} <ArrowUpRight size={14} />
            </button>
          </div>
          {data.conversations.slice(0, 4).map((c) => (
            <button
              className="list-row conversation-row"
              key={c.id}
              onClick={() => select("inbox")}
            >
              <div className="row">
                <span className="avatar">{c.customer_name[0]}</span>
                <div>
                  <strong>{c.customer_name}</strong>
                  <div className="small muted">
                    {languages[c.locale]} · Website chat
                  </div>
                </div>
              </div>
              <span className="badge gray">{c.status}</span>
            </button>
          ))}
          {!data.conversations.length && (
            <Empty>
              No conversations yet. Open your website chat to try it.
            </Empty>
          )}
        </div>
        <div className="panel">
          <div className="row between">
            <h2>Needs your attention</h2>
            <span className="badge amber">{low.length}</span>
          </div>
          {low.slice(0, 4).map((p) => (
            <div className="list-row" key={p.id}>
              <div className="row">
                <span className="product-icon">
                  <Package size={19} />
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <div className="small muted">{p.stock} left in stock</div>
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label={"Manage " + p.name}
                onClick={() => select("inventory")}
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
          ))}
          {!low.length && (
            <p className="muted">Your stocked products are looking good.</p>
          )}
          <button
            className="btn ghost small"
            onClick={() => select("inventory")}
          >
            Manage inventory <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
