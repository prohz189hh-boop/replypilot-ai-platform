import { type Organization, invariant } from "../shared";
export const plans = {
  starter: {
    name: "Starter",
    price: 9,
    products: 100,
    replies: 150,
    staff: 1,
    automatic: false,
    appointments: false,
    csv: false,
  },
  growth: {
    name: "Growth",
    price: 18,
    products: 500,
    replies: 600,
    staff: 3,
    automatic: true,
    appointments: true,
    csv: true,
  },
  pro: {
    name: "Business Pro",
    price: 30,
    products: 2000,
    replies: 1500,
    staff: 10,
    automatic: true,
    appointments: true,
    csv: true,
  },
} as const;
export function entitlement(org: Organization, now = new Date()) {
  const trial = org.subscription_status === "trial";
  const active = trial
    ? new Date(org.trial_end) > now
    : org.subscription_status === "active";
  return {
    ...plans[org.plan],
    replies: trial ? 30 : plans[org.plan].replies,
    active,
  };
}
export function requireFeature(
  org: Organization,
  feature: "automatic" | "appointments" | "csv",
) {
  const e = entitlement(org);
  invariant(e.active, "Your subscription or trial is inactive.", 403);
  invariant(e[feature], `This feature requires Growth or Business Pro.`, 403);
}
export interface PaymentAdapter {
  kind: "simulated";
  requestChange(
    orgId: string,
    plan: keyof typeof plans,
  ): Promise<{ status: "pending_review"; plan: string }>;
}
export class SimulatedBilling implements PaymentAdapter {
  kind = "simulated" as const;
  async requestChange(_orgId: string, plan: keyof typeof plans) {
    return { status: "pending_review" as const, plan };
  }
}
