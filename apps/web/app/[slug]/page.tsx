import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui";
const pages: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  features: {
    title: "More clarity. Less busywork.",
    intro:
      "ReplyPilot brings your catalog, conversations, and everyday business together.",
    sections: [
      [
        "A catalog your assistant can trust",
        "Store prices, quantities, warranties and custom specifications. Answers use stored facts; missing information is handed to staff.",
      ],
      [
        "Conversations with context",
        "Read website messages, review AI suggestions, reply yourself, and pause automation whenever you need to.",
      ],
      [
        "Orders you control",
        "Customer requests await your approval. Confirmation reserves inventory. Cancelled reservations release it.",
      ],
      [
        "Your language, your workspace",
        "English, Arabic, Sorani and Badini navigation with RTL support. Language templates are in development and need native-speaker review.",
      ],
    ],
  },
  industries: {
    title: "Built around your kind of business.",
    intro: "Flexible information and focused workflows for the work you do.",
    sections: [
      [
        "Electronics & gaming",
        "CPU, GPU, memory, storage, battery, compatibility and warranty fields make detailed product questions easier.",
      ],
      [
        "Clothing, shoes & furniture",
        "Use sizes, colors, materials and dimensions, with variant prices and stock.",
      ],
      [
        "Restaurants & cafés",
        "Store menu items, ingredients, add-ons and availability as structured information.",
      ],
      [
        "Salons, barbers & repair shops",
        "Define service duration and prices, assign staff, and create bookings with overlap prevention. Recurring availability is still in development.",
      ],
      [
        "General retail & books",
        "Start with the essentials and add the specifications your customers ask about.",
      ],
    ],
  },
  about: {
    title: "Good service should feel personal.",
    intro:
      "ReplyPilot AI 2.0 is a new multilingual business workspace being developed for small shops and service businesses.",
    sections: [
      [
        "Our focus",
        "Give business owners a clear place to manage customer questions, accurate catalog information, order requests and staff workflows.",
      ],
      [
        "Language matters",
        "Sorani and Badini in Kurdish Arabic-based script are first-class goals. We show draft language support honestly and plan native-speaker evaluation before commercial launch.",
      ],
      [
        "Development status",
        "This is a local development release with mock AI and simulated billing. It is not a launched production service.",
      ],
    ],
  },
  faq: {
    title: "A few helpful answers.",
    intro: "What to know before trying the development preview.",
    sections: [
      [
        "Will I be charged?",
        "No. Billing is simulated and no card details are collected. Listed prices are initial offers for a future commercial service.",
      ],
      [
        "Is the AI connected to Gemini?",
        "Customer conversations currently use a deterministic local mock. A server-only Gemini adapter is provided for a fixed synthetic smoke test but has not been verified with live credentials.",
      ],
      [
        "Does it send messages automatically?",
        "Automatic mode is disabled by default. An owner can explicitly enable it on eligible plans. Staff can pause any conversation immediately.",
      ],
      [
        "Are Sorani and Badini perfect?",
        "No. Both use Kurdish Arabic-based script, but translations and dialect detection need native-speaker review.",
      ],
      [
        "Can I connect WhatsApp or Instagram?",
        "Setup documentation is included. External channels remain disabled until official credentials, permissions, and webhook verification are configured.",
      ],
    ],
  },
  contact: {
    title: "Let’s build better customer service.",
    intro:
      "Contact and support delivery are not connected in this local preview.",
    sections: [
      [
        "For product feedback",
        "Record your feedback in the project issue tracker once the private repository is connected. Avoid posting customer data or secrets.",
      ],
      [
        "For help in the preview",
        "Your workspace includes setup guidance under Integrations. The project documentation contains startup steps, test results, and known limitations.",
      ],
    ],
  },
  privacy: {
    title: "Privacy — development notice",
    intro:
      "Draft information for a local preview, not a finalized production privacy policy.",
    sections: [
      [
        "What is stored locally",
        "Registered account information, password hashes, session hashes, business records, customer names, messages, orders and audit events are stored in the project’s local SQLite database. Use fictional data only.",
      ],
      [
        "AI processing",
        "Customer chat uses a local mock and does not send customer messages to Gemini. The optional Gemini smoke test sends only a fixed fictional catalog question and fictional products.",
      ],
      [
        "Access",
        "Workspace membership controls staff access. Platform admin views show aggregate business and usage information without conversation contents by default.",
      ],
      [
        "Before commercial launch",
        "Finalize lawful processing grounds, retention periods, export and deletion tools, processor agreements, and a support contact. Cloud hosting, backups and account recovery require operational review.",
      ],
    ],
  },
  terms: {
    title: "Terms — development preview",
    intro:
      "Draft terms for local evaluation. These are not finalized commercial terms.",
    sections: [
      [
        "Development use",
        "This build is intended for local evaluation with fictional data. It is not approved for live customer operations.",
      ],
      [
        "Orders and appointments",
        "Customer order requests need staff confirmation. Listed sample prices and stock are fictional. Booking confirmation is a local record and does not send an external notification.",
      ],
      [
        "Subscriptions",
        "All billing is simulated. No payment is collected or real subscription activated.",
      ],
      [
        "Launch prerequisites",
        "Commercial service requires a jurisdiction-appropriate legal review, production privacy protections, payment setup, operational testing, and approved external messaging integrations.",
      ],
    ],
  },
};
export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = pages[(await params).slug];
  if (!p) notFound();
  return (
    <main className="public-document">
      <Logo />
      <h1 style={{ marginTop: 55 }}>{p.title}</h1>
      <p className="muted" style={{ fontSize: 18 }}>
        {p.intro}
      </p>
      {p.sections.map(([title, text]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p className="muted">{text}</p>
        </section>
      ))}
      <div className="row" style={{ marginTop: 35 }}>
        <Link href="/demo" className="btn primary">
          Try the demonstration
        </Link>
        <Link href="/" className="btn">
          Back home
        </Link>
      </div>
    </main>
  );
}
