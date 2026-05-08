// Shared cadence + template + enrollment fixtures used by all demo tenants.
// Each tenant file imports and re-exports these with tenant-flavored adjustments.

import type { Cadence, CadenceEnrollment, Template } from "@/types";
import { STARTER_CADENCES } from "@/lib/cadences/seeds";

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

export function buildSeededCadences(): Cadence[] {
  return STARTER_CADENCES.map((s, i) => ({
    ...s,
    id: `cad-${i + 1}`,
    createdAt: daysAgo(60 - i * 10) as never,
    updatedAt: daysAgo(20 - i * 5) as never,
  }));
}

export const SEEDED_TEMPLATES: Template[] = [
  {
    id: "tpl-ftb-welcome",
    name: "FTB welcome",
    channel: "email",
    subject: "Saving for your first home, {{firstName}}? Here's a plan.",
    body: "Hi {{firstName}},\n\nGreat to chat earlier. Here's a quick checklist that'll get you mortgage-ready 6–12 months out: open a Lifetime ISA, fix any credit-file issues, and aim for at least a 5% deposit (10% gives you a better rate).\n\nI'll check in every couple of months — or just shout sooner if anything changes.\n\n{{adviser}}",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(30) as never,
  },
  {
    id: "tpl-ftb-deposit-progress",
    name: "FTB deposit progress",
    channel: "email",
    subject: "How's the deposit coming along, {{firstName}}?",
    body: "Hi {{firstName}},\n\nQuick check-in — how's the deposit pot looking? If you're getting close to your target (or rates have shifted), we should talk options.\n\nReply with your current deposit balance and I'll send back a fresh affordability estimate.\n\n{{adviser}} at {{firmName}}",
    variables: ["firstName", "adviser", "firmName"],
    updatedAt: daysAgo(20) as never,
  },
  {
    id: "tpl-remo-180-day",
    name: "Remortgage 6-month warning",
    channel: "email",
    subject: "{{firstName}}, your fixed rate ends in 6 months",
    body: "Hi {{firstName}},\n\nA quick heads-up: your current fixed rate ends in 6 months. The earlier we start, the more options you'll have — most lenders let us secure a new rate up to 6 months ahead.\n\nWant to find a 30-min slot in the next two weeks?\n\n{{adviser}}",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(40) as never,
  },
  {
    id: "tpl-remo-rate-update",
    name: "Remortgage rate update",
    channel: "email",
    subject: "Rate update for your remortgage",
    body: "Hi {{firstName}},\n\nMonthly rate watch: 5-year fixed rates moved {{rateMove}} this month. Based on your loan-to-value, the best product I'm seeing is {{bestRate}}%.\n\nLet me know if you want to lock it.\n\n{{adviser}}",
    variables: ["firstName", "rateMove", "bestRate", "adviser"],
    updatedAt: daysAgo(15) as never,
  },
  {
    id: "tpl-cold-checkin",
    name: "Cold check-in",
    channel: "email",
    subject: "Still here when you're ready, {{firstName}}",
    body: "Hi {{firstName}},\n\nIt's been a while — just wanted to say I'm still here if/when the time's right. No pressure, no chase. If circumstances have changed (new job, deposit landed, looking at a different area), drop me a line and we'll reset.\n\n{{adviser}}",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(50) as never,
  },
  {
    id: "tpl-sms-deposit-nudge",
    name: "SMS — deposit nudge",
    channel: "sms",
    body: "Hi {{firstName}}, {{adviser}} at {{firmName}}. Quick deposit progress nudge — drop me a text with your current pot and I'll re-run your affordability. No pressure.",
    variables: ["firstName", "adviser", "firmName"],
    updatedAt: daysAgo(25) as never,
  },
];

export function buildSeededEnrollments(leadIdsByCadence: Record<string, string[]>): CadenceEnrollment[] {
  const enrollments: CadenceEnrollment[] = [];
  for (const [cadenceId, leadIds] of Object.entries(leadIdsByCadence)) {
    leadIds.forEach((leadId, idx) => {
      enrollments.push({
        id: `enr-${cadenceId}-${idx}`,
        leadId,
        cadenceId,
        currentStep: idx % 4,
        nextRunAt: daysAgo(-(idx * 7 + 3)) as never,
        status: "active",
        enrolledAt: daysAgo(idx * 14 + 5) as never,
        completedAt: null,
      });
    });
  }
  return enrollments;
}
