// Three default cadences seeded into a new tenant during onboarding.
// These also drive the demo data — mock-data tenants use these directly.

import type { Cadence } from "@/types";

export type StarterCadence = Omit<Cadence, "id" | "createdAt" | "updatedAt">;

export const STARTER_CADENCES: StarterCadence[] = [
  {
    name: "FTB nurture (deposit-saving)",
    description:
      "Long-cycle warm-up for first-time buyers still saving a deposit. Quarterly check-ins, deposit-progress emails, and a final ready-to-buy nudge.",
    trigger: { type: "stage_entered", stageId: "not_ready_yet" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-ftb-welcome", subject: "Saving for your first home? Here's a plan." },
      { delayDays: 30, channel: "email", templateId: "tpl-ftb-deposit-progress", subject: "How's the deposit coming along?" },
      { delayDays: 90, channel: "task", subject: "Quarterly call — deposit progress check-in" },
      { delayDays: 180, channel: "email", templateId: "tpl-ftb-deposit-progress", subject: "6-month check-in" },
      { delayDays: 270, channel: "sms", subject: "Quick deposit progress nudge" },
      { delayDays: 360, channel: "task", subject: "Annual review — likely ready to buy soon?" },
    ],
  },
  {
    name: "Remortgage 6-month warm-up",
    description:
      "Triggered when an existing client's fixed-rate is 6 months from maturity. Three touches before handing back to the adviser for the rate conversation.",
    trigger: { type: "manual" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-remo-180-day", subject: "Your fixed rate ends in 6 months — let's talk" },
      { delayDays: 30, channel: "email", templateId: "tpl-remo-rate-update", subject: "Rate update for your remortgage" },
      { delayDays: 90, channel: "task", subject: "Schedule rate review call (3 months out)" },
      { delayDays: 150, channel: "reminder", subject: "Confirm new product before rate locks expire" },
    ],
  },
  {
    name: "Cold prospect re-engagement",
    description:
      "Last-chance sequence for prospects who've gone quiet for 90+ days. Mixes a polite check-in, a market-context message, and a final task.",
    trigger: { type: "manual" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-cold-checkin", subject: "Still here when you're ready" },
      { delayDays: 14, channel: "sms", subject: "Quick text — anything we can help with?" },
      { delayDays: 30, channel: "task", subject: "Final outreach call before archiving" },
    ],
  },
];
