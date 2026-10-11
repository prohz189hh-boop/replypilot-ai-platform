"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  Check,
  ExternalLink,
  Shield,
  Globe,
  MessageCircle,
  CalendarDays,
} from "lucide-react";
import { type Snapshot, type Action } from "./workspace-types";
import { Field, Modal, Empty } from "./ui";
import { money, type Locale } from "@reply/shared";
import { languages } from "@reply/localization";
import { plans } from "@reply/billing";
export function Orders({ data, act }: { data: Snapshot; act: Action }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(data.products[0]?.id || "");
  const next: Record<string, string[]> = {
    new: ["awaiting_confirmation", "cancelled"],
    awaiting_confirmation: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["ready", "cancelled"],
    ready: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1>Orders</h1>
          <p className="muted">From first request to a happy customer.</p>
        </div>
        <button className="btn primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> New order
        </button>
      </div>
      <div className="notice">
        Requests do not reserve stock or count as revenue. Confirmation reserves
        stock; only completed orders count as sales.
      </div>
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer / product</th>
              <th>Total</th>
              <th>Status</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <strong>#{o.id.slice(0, 8)}</strong>
                  <div className="small muted">
                    {new Date(o.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td>
                  <strong>{o.customer_name}</strong>
                  <div className="muted small">
                    {o.quantity} × {o.product_name} · {o.fulfillment}
                  </div>
                </td>
                <td>{money(o.quantity * o.unit_price, o.currency)}</td>
                <td>
                  <span
                    className={
                      "badge " +
                      (o.status === "awaiting_confirmation" ? "amber" : "")
                    }
                  >
                    {o.status.replaceAll("_", " ")}
                  </span>
                </td>
                <td>
                  <div className="row wrap">
                    {next[o.status]?.map((status) => (
                      <button
                        className={
                          "btn small " +
                          (status === "cancelled" ? "danger" : "")
                        }
                        key={status}
                        onClick={() =>
                          act("order.update", { id: o.id, status })
                        }
                      >
                        {status === "confirmed"
                          ? "Confirm"
                          : status === "cancelled"
                            ? "Cancel"
                            : "Mark " + status}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.orders.length && (
          <Empty>Your order requests will appear here.</Empty>
        )}
      </div>
      {open && (
        <Modal title="New order request" onClose={() => setOpen(false)}>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await act("order.create", {
                  productId: selected,
                  variantId: f.get("variantId") || null,
                  customerName: f.get("name"),
                  quantity: Number(f.get("quantity")),
                  fulfillment: f.get("fulfillment"),
                  requestId: crypto.randomUUID(),
                })
              )
                setOpen(false);
            }}
          >
            <Field label="Customer name" name="name" required minLength={2} />
            <label>
              Product
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                required
              >
                {data.products
                  .filter((p) => !p.archived)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {money(p.price, p.currency)}
                    </option>
                  ))}
              </select>
            </label>
            {data.variants.some((v) => v.product_id === selected) && (
              <label>
                Variant
                <select name="variantId" required>
                  {data.variants
                    .filter((v) => v.product_id === selected)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} · Stock {v.stock}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <Field
              label="Quantity"
              type="number"
              name="quantity"
              min={1}
              max={100}
              defaultValue={1}
              required
            />
            <label>
              Fulfillment
              <select name="fulfillment">
                <option value="pickup">Pickup</option>
                <option value="delivery_request">
                  Delivery request — staff will quote shipping
                </option>
              </select>
            </label>
            <button className="btn primary">Create order request</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function Services({
  data,
  act,
  bookings = false,
}: {
  data: Snapshot;
  act: Action;
  bookings?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stack">
      <div className="row between">
        <div>
          <h1>{bookings ? "Appointments" : "Your services"}</h1>
          <p className="muted">
            {bookings
              ? "Staff-confirmed bookings · Timezone: " + data.org.timezone
              : "Define what you do, how long it takes, and what it costs."}
          </p>
        </div>
        <button className="btn primary" onClick={() => setOpen(true)}>
          <Plus size={16} />
          {bookings ? "Book appointment" : "Add service"}
        </button>
      </div>
      {bookings ? (
        <div className="panel">
          <div className="notice">
            Staff enter agreed appointment times. Recurring business/staff
            availability and customer self-booking are not configured yet.
          </div>
          {data.appointments.map((a) => (
            <div className="list-row" key={a.id}>
              <div>
                <strong>{a.customer_name}</strong>
                <div className="muted small">
                  {data.services.find((s) => s.id === a.service_id)?.name} ·{" "}
                  {new Date(a.starts_at).toLocaleString("en", {
                    timeZone: data.org.timezone,
                  })}{" "}
                  · {data.members.find((m) => m.id === a.staff_id)?.name}
                </div>
              </div>
              <span className="badge">{a.status}</span>
              {a.status === "confirmed" && (
                <button
                  className="btn danger"
                  onClick={() => act("appointment.cancel", a.id)}
                >
                  Cancel
                </button>
              )}
            </div>
          ))}
          {!data.appointments.length && (
            <Empty>No upcoming appointments.</Empty>
          )}
        </div>
      ) : (
        <div className="grid three">
          {data.services.map((s) => (
            <div className="panel" key={s.id}>
              <CalendarDays color="var(--accent)" />
              <h2 style={{ marginTop: 20 }}>{s.name}</h2>
              <p className="muted">{s.duration} minutes</p>
              <strong>{money(s.price, s.currency)}</strong>
            </div>
          ))}
          {!data.services.length && (
            <Empty>Add a service to begin scheduling.</Empty>
          )}
        </div>
      )}
      {open && (
        <Modal
          title={bookings ? "Book an appointment" : "Add a service"}
          onClose={() => setOpen(false)}
        >
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const payload = bookings
                ? {
                    serviceId: f.get("service"),
                    staffId: f.get("staff"),
                    customerName: f.get("name"),
                    startsAt: new Date(String(f.get("time"))).toISOString(),
                  }
                : {
                    name: f.get("name"),
                    duration: Number(f.get("duration")),
                    price: Number(f.get("price")),
                    currency: data.org.currency,
                  };
              if (
                await act(
                  bookings ? "appointment.create" : "service.create",
                  payload,
                )
              )
                setOpen(false);
            }}
          >
            <Field
              label={bookings ? "Customer name" : "Service name"}
              name="name"
              required
            />
            {bookings ? (
              <>
                <label>
                  Service
                  <select name="service" required>
                    {data.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.duration} min
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Staff
                  <select name="staff" required>
                    {data.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Appointment start (this device’s local timezone)"
                  type="datetime-local"
                  name="time"
                  required
                />
              </>
            ) : (
              <>
                <Field
                  label="Duration (minutes)"
                  type="number"
                  name="duration"
                  min={5}
                  max={480}
                  defaultValue={30}
                  required
                />
                <Field
                  label={"Price in " + data.org.currency + " minor units"}
                  type="number"
                  name="price"
                  min={0}
                  step={1}
                  required
                />
              </>
            )}
            <button className="btn primary">
              {bookings ? "Confirm appointment" : "Save service"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function Settings({
  data,
  act,
  assistant = false,
  language = false,
}: {
  data: Snapshot;
  act: Action;
  assistant?: boolean;
  language?: boolean;
}) {
  const org = data.org;
  return (
    <div className="stack">
      <div>
        <h1>
          {assistant
            ? "Your AI assistant"
            : language
              ? "Language & localization"
              : "Business settings"}
        </h1>
        <p className="muted">
          {assistant
            ? "Helpful answers, grounded in your business. You set the boundaries."
            : "A workspace that feels like your business."}
        </p>
      </div>
      <div className="grid two">
        <form
          className="panel stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await act("settings", {
              name: f.get("name"),
              locale: f.get("locale"),
              aiMode: f.get("mode"),
              paused: f.get("paused") === "on",
              policies: f.get("policies"),
              hours: f.get("hours"),
            });
          }}
        >
          <Field
            label="Business name"
            name="name"
            defaultValue={org.name}
            required
          />
          <label>
            Default language
            <select name="locale" defaultValue={org.locale}>
              {Object.entries(languages).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            AI operating mode
            <select name="mode" defaultValue={org.ai_mode}>
              <option value="manual">Manual — staff reply</option>
              <option value="assisted">
                Assisted — staff approve suggestions
              </option>
              <option value="automatic">
                Automatic — explicitly enable replies
              </option>
            </select>
          </label>
          <label className="row">
            <input
              type="checkbox"
              name="paused"
              defaultChecked={!!org.paused}
              style={{ width: 18 }}
            />{" "}
            Pause all automated replies
          </label>
          <label>
            Business hours
            <textarea
              name="hours"
              defaultValue={org.hours}
              placeholder="Enter verified opening hours"
            />
          </label>
          <label>
            Business policies
            <textarea
              name="policies"
              defaultValue={org.policies}
              placeholder="Delivery, returns, warranty, and other verified policies"
            />
          </label>
          <button className="btn primary">Save settings</button>
        </form>
        <div className="stack" style={{ alignContent: "start" }}>
          <div className="panel">
            <div className="row">
              <Shield size={21} color="var(--accent)" />
              <h2 style={{ margin: 0 }}>You stay in control</h2>
            </div>
            <ul className="features">
              <li>Automatic replies are off by default</li>
              <li>Unknown facts are handed to staff</li>
              <li>AI cannot confirm orders or change stock</li>
              <li>Human takeover pauses a conversation</li>
            </ul>
            <span className="badge">Current provider: deterministic mock</span>
          </div>
          <div className="panel">
            <Globe color="var(--accent)" />
            <h2 style={{ marginTop: 20 }}>
              Built for your customers’ language
            </h2>
            <p className="muted">
              Sorani and Badini use Kurdish Arabic-based script. Product and
              brand names are preserved.
            </p>
            <p className="small muted">
              Translations and dialect handling are draft quality.
              Native-speaker review is required. Some detailed forms remain in
              English.
            </p>
            <div className="row wrap">
              {Object.values(languages).map((v) => (
                <span className="badge gray" key={v}>
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export function Billing({ data, act }: { data: Snapshot; act: Action }) {
  return (
    <div className="stack">
      <div>
        <h1>A plan for your next chapter</h1>
        <p className="muted">
          Simple monthly offers. All payments are simulated in this development
          build.
        </p>
      </div>
      <div className="notice">
        {data.org.subscription_status === "trial"
          ? `Your trial ends ${new Date(data.org.trial_end).toLocaleDateString()}.`
          : `Subscription: ${data.org.subscription_status}.`}{" "}
        {data.usage} / {data.entitlement.replies} AI replies used this calendar
        month.
      </div>
      <div className="grid three">
        {Object.entries(plans).map(([key, p]) => (
          <div
            className={
              "panel plan " + (key === data.org.plan ? "selected" : "")
            }
            key={key}
          >
            <div className="row between">
              <h2>{p.name}</h2>
              {key === data.org.plan && (
                <span className="badge">Current plan</span>
              )}
            </div>
            <div className="price">
              ${p.price}
              <small> / month</small>
            </div>
            <ul className="features">
              <li>{p.products.toLocaleString()} products</li>
              <li>{p.replies.toLocaleString()} AI replies / month</li>
              <li>
                {p.staff} staff account{p.staff > 1 ? "s" : ""}
              </li>
              <li>Website chat & customer inbox</li>
              <li>Four supported languages</li>
              {p.automatic && <li>Automatic response controls</li>}
              {p.appointments && <li>Appointment scheduling</li>}
            </ul>
            <button
              className="btn primary"
              onClick={() =>
                act("billing.request", { plan: key, action: "change" })
              }
            >
              Request {p.name} <ArrowUpRight size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="row between">
          <h2>Subscription history</h2>
          <button
            className="btn danger"
            onClick={() =>
              act("billing.request", { plan: data.org.plan, action: "cancel" })
            }
          >
            Request cancellation
          </button>
        </div>
        <p className="muted small">
          Only a platform administrator can verify a simulated plan change. This
          never charges a card.
        </p>
        {data.billing.map((b) => (
          <div className="list-row" key={b.id}>
            <span>
              {b.action} · {b.plan}
            </span>
            <span className="badge gray">{b.status}</span>
            <span className="small muted">
              {new Date(b.created_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function Team({ data, act }: { data: Snapshot; act: Action }) {
  return (
    <div className="stack">
      <h1>Your team</h1>
      <div className="grid two">
        <div className="panel">
          <h2>
            {data.members.length} / {data.entitlement.staff} staff accounts
          </h2>
          {data.members.map((m) => (
            <div className="list-row" key={m.id}>
              <div>
                <strong>{m.name}</strong>
                <div className="small muted">{m.email}</div>
              </div>
              <span className="badge">{m.role}</span>
            </div>
          ))}
        </div>
        <form
          className="panel stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await act("member.add", {
              email: f.get("email"),
              role: f.get("role"),
            });
          }}
        >
          <h2>Add a registered teammate</h2>
          <p className="muted small">
            For this local build, teammates register an account first and leave
            business onboarding unfinished. Invitations by email are not
            connected.
          </p>
          <Field label="Teammate email" name="email" type="email" required />
          <label>
            Role
            <select name="role">
              <option value="staff">Staff — inbox and orders</option>
              <option value="manager">
                Manager — catalog, inbox and orders
              </option>
            </select>
          </label>
          <button className="btn primary">Add teammate</button>
        </form>
      </div>
    </div>
  );
}
export function Integrations({ data }: { data: Snapshot }) {
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://127.0.0.1:3000";
  const snippet = `<script src="${origin}/widget.js" data-business="${data.org.id}" defer></script>`;
  return (
    <div className="stack">
      <h1>Connect with your customers</h1>
      <div className="panel">
        <div className="row between">
          <div className="row">
            <Globe color="var(--accent)" />
            <h2 style={{ margin: 0 }}>Website chat</h2>
            <span className="badge">Local testing ready</span>
          </div>
          <Link href={"/chat/" + data.org.id} target="_blank" className="btn">
            Open customer chat <ExternalLink size={15} />
          </Link>
        </div>
        <p className="muted" style={{ marginTop: 22 }}>
          Add this snippet to a local test website. It opens an isolated
          customer chat; no staff session is required.
        </p>
        <pre className="code">{snippet}</pre>
        <button
          className="btn"
          onClick={async () => {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy installation snippet"}
        </button>
        <p className="small muted" style={{ marginTop: 14 }}>
          Public hosting and allowed-domain controls are required before
          embedding on a live website.
        </p>
      </div>
      <div className="grid two">
        {["WhatsApp Cloud API", "Instagram professional messaging"].map(
          (name) => (
            <div className="panel" key={name}>
              <MessageCircle color="var(--accent)" />
              <h2 style={{ marginTop: 18 }}>{name}</h2>
              <span className="badge gray">Not connected</span>
              <p className="muted" style={{ marginTop: 15 }}>
                Requires official Meta app setup, business authorization,
                permissions, and a verified HTTPS webhook. No messages are sent
                through this integration.
              </p>
              <a
                className="btn"
                href="https://developers.facebook.com/docs/"
                target="_blank"
                rel="noreferrer"
              >
                Official setup documentation <ExternalLink size={14} />
              </a>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
export function Customers({ data }: { data: Snapshot }) {
  return (
    <div className="stack">
      <h1>Your customers</h1>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Language</th>
              <th>First seen</th>
            </tr>
          </thead>
          <tbody>
            {data.customers.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="row">
                    <span className="avatar">{c.name[0]}</span>
                    <strong>{c.name}</strong>
                  </div>
                </td>
                <td>{languages[c.locale as Locale]}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.customers.length && (
          <Empty>
            Customer profiles are created when a website conversation starts.
          </Empty>
        )}
      </div>
    </div>
  );
}
export function Automations({ data, act }: { data: Snapshot; act: Action }) {
  return (
    <div className="stack">
      <h1>Automation controls</h1>
      <div className="panel">
        <div className="row">
          <Check color="var(--accent)" />
          <h2 style={{ margin: 0 }}>Reply to website inquiries</h2>
          <span className="badge">
            {data.org.ai_mode === "automatic" && !data.org.paused
              ? "Enabled"
              : "Paused / manual approval"}
          </span>
        </div>
        <p className="muted" style={{ marginTop: 20 }}>
          Only grounded catalog replies are supported in this build. Advanced
          triggers and social automations are not implemented.
        </p>
        <button
          className="btn"
          onClick={() =>
            act("settings", {
              name: data.org.name,
              locale: data.org.locale,
              aiMode: data.org.ai_mode,
              paused: !data.org.paused,
              policies: data.org.policies,
              hours: data.org.hours,
            })
          }
        >
          {data.org.paused
            ? "Resume configured automation"
            : "Pause automation immediately"}
        </button>
      </div>
    </div>
  );
}
