// Default cadences seeded into a new tenant during onboarding.
// These also drive the demo data — mock-data tenants use these directly.
// New cadences MUST be appended at the end to preserve mock IDs (cad-1, cad-2, …).

import type { Cadence } from "@/types";

export type StarterCadence = Omit<Cadence, "id" | "createdAt" | "updatedAt">;

export const STARTER_CADENCES: StarterCadence[] = [
  // ── 1. FTB nurture (deposit-saving) ─────────────────────────────────
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

  // ── 2. Remortgage 6-month warm-up ───────────────────────────────────
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

  // ── 3. Cold prospect re-engagement ──────────────────────────────────
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

  // ── 4. Protection follow-up ─────────────────────────────────────────
  {
    name: "Protection follow-up",
    description:
      "Follows up on life insurance, critical illness, and income protection after a mortgage conversation. Most clients need a gentle nudge.",
    trigger: { type: "manual" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-protection-intro", subject: "Let's make sure you're covered" },
      { delayDays: 7, channel: "task", subject: "Call to discuss protection needs" },
      { delayDays: 30, channel: "email", templateId: "tpl-protection-reminder", subject: "Quick reminder about cover" },
      { delayDays: 90, channel: "sms", subject: "Protection check-in" },
    ],
  },

  // ── 5. Self-employed mortgage nurture ────────────────────────────────
  {
    name: "Self-employed mortgage nurture",
    description:
      "Year-long nurture for self-employed prospects who need more trading history or accounts before applying. Timed around tax year milestones.",
    trigger: { type: "manual" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-self-emp-welcome", subject: "Self-employed? Here's what lenders want to see" },
      { delayDays: 14, channel: "task", subject: "Check SA302 / accountant status" },
      { delayDays: 90, channel: "email", templateId: "tpl-self-emp-accounts-chase", subject: "Tax year end — time to get accounts sorted" },
      { delayDays: 180, channel: "task", subject: "6-month check — accounts available yet?" },
      { delayDays: 365, channel: "email", templateId: "tpl-self-emp-year-review", subject: "Another year of trading — let's revisit" },
    ],
  },

  // ── 6. Buy-to-let onboarding ────────────────────────────────────────
  {
    name: "Buy-to-let onboarding",
    description:
      "Short sequence for new BTL enquiries. Covers deposit requirements, rental yield, and the personal-vs-limited-company decision.",
    trigger: { type: "manual" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-btl-welcome", subject: "Your buy-to-let mortgage journey" },
      { delayDays: 7, channel: "task", subject: "Discuss portfolio structure and company vs personal" },
      { delayDays: 21, channel: "email", templateId: "tpl-btl-rental-yield", subject: "Rental yield and affordability check" },
      { delayDays: 60, channel: "reminder", subject: "BTL decision deadline approaching" },
    ],
  },

  // ── 7. Post-completion check-in ─────────────────────────────────────
  {
    name: "Post-completion check-in",
    description:
      "Triggered after a lead is referred to MAB and the case completes. Congratulates, checks in at 3 months, and asks for referrals at 6 months.",
    trigger: { type: "stage_entered", stageId: "referred_to_mab" },
    isActive: true,
    steps: [
      { delayDays: 14, channel: "email", templateId: "tpl-post-completion", subject: "Congratulations on your new home!" },
      { delayDays: 90, channel: "task", subject: "3-month post-completion call — any issues?" },
      { delayDays: 180, channel: "email", templateId: "tpl-referral-ask", subject: "Know anyone who needs mortgage help?" },
    ],
  },

  // ── 8. Document chasing ─────────────────────────────────────────────
  {
    name: "Document chasing",
    description:
      "Fast 3-week sequence for chasing outstanding documents. Escalates from a polite email to SMS to a call task to a final deadline email.",
    trigger: { type: "manual" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-docs-needed", subject: "Documents we still need from you" },
      { delayDays: 5, channel: "sms", subject: "Quick reminder — documents outstanding" },
      { delayDays: 10, channel: "task", subject: "Chase call — docs still missing" },
      { delayDays: 21, channel: "email", templateId: "tpl-docs-final-chase", subject: "Final reminder — paperwork needed" },
    ],
  },

  // ── 9. Rate expiry monitoring ───────────────────────────────────────
  {
    name: "Rate expiry monitoring",
    description:
      "6-month countdown for existing clients approaching rate expiry. Starts early to secure the best product, intensifies as the deadline nears.",
    trigger: { type: "manual" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-rate-expiry-180", subject: "Your mortgage rate expires in 6 months" },
      { delayDays: 30, channel: "email", templateId: "tpl-remo-rate-update", subject: "Rate update for your remortgage" },
      { delayDays: 90, channel: "task", subject: "3-month rate check-in call" },
      { delayDays: 150, channel: "email", templateId: "tpl-rate-expiry-30", subject: "30 days until your rate expires" },
      { delayDays: 180, channel: "reminder", subject: "Rate expiry day — confirm new product" },
    ],
  },

  // ── 10. New enquiry welcome ─────────────────────────────────────────
  {
    name: "New enquiry welcome",
    description:
      "Quick 7-day welcome sequence for fresh enquiries. Sends a warm email, prompts the adviser to call, and follows up by text if no contact made.",
    trigger: { type: "stage_entered", stageId: "new_enquiry" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-new-enquiry-welcome", subject: "Thanks for your enquiry" },
      { delayDays: 1, channel: "task", subject: "Initial call to new enquiry" },
      { delayDays: 7, channel: "sms", subject: "Following up on your enquiry" },
    ],
  },

  // ── 11. Referral thank-you ──────────────────────────────────────────
  {
    name: "Referral thank-you",
    description:
      "Automated thank-you when a lead is created via referral. Sends a welcome email and creates a task to personally thank the referrer.",
    trigger: { type: "lead_created" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-new-enquiry-welcome", subject: "Thanks for your enquiry" },
      { delayDays: 7, channel: "task", subject: "Send thank-you to referrer" },
    ],
  },

  // ── 12. Anniversary and retention ───────────────────────────────────
  {
    name: "Anniversary and retention",
    description:
      "Annual touchpoint for completed clients. Checks in on their anniversary, prompts a 6-month call, and reminds them about rate expiry as renewal approaches.",
    trigger: { type: "manual" },
    isActive: true,
    steps: [
      { delayDays: 0, channel: "email", templateId: "tpl-anniversary", subject: "Happy mortgage anniversary!" },
      { delayDays: 180, channel: "task", subject: "6-month check-in — any plans?" },
      { delayDays: 330, channel: "email", templateId: "tpl-rate-expiry-30", subject: "Your rate renewal is coming up" },
    ],
  },
];
