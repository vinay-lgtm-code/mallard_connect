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
    createdAt: daysAgo(60 - i * 4) as never,
    updatedAt: daysAgo(20 - i * 1) as never,
  }));
}

export const SEEDED_TEMPLATES: Template[] = [
  // ── Existing templates ──────────────────────────────────────────────
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

  // ── Protection ──────────────────────────────────────────────────────
  {
    id: "tpl-protection-intro",
    name: "Protection intro",
    channel: "email",
    subject: "Let's make sure you're covered, {{firstName}}",
    body: "Hi {{firstName}},\n\nNow that we're progressing with your mortgage, it's worth thinking about protection. Life insurance, critical illness cover, and income protection aren't the most exciting topics — but they're the ones that matter most if something unexpected happens.\n\nI can run through your options in about 15 minutes. Most of my clients find it's much more affordable than they expected.\n\nShall I send over some quotes?\n\n{{adviser}} at {{firmName}}",
    variables: ["firstName", "adviser", "firmName"],
    updatedAt: daysAgo(18) as never,
  },
  {
    id: "tpl-protection-reminder",
    name: "Protection reminder",
    channel: "email",
    subject: "Quick reminder about cover, {{firstName}}",
    body: "Hi {{firstName}},\n\nJust a gentle nudge — we chatted about protection a few weeks back. I know it's easy to push down the list, but getting it sorted while you're healthy and young means lower premiums.\n\nHappy to keep it brief — 10 minutes is usually enough to get the right cover in place.\n\n{{adviser}}",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(16) as never,
  },
  {
    id: "tpl-sms-protection-nudge",
    name: "SMS — protection nudge",
    channel: "sms",
    body: "Hi {{firstName}}, {{adviser}} here. Quick one — have you had a chance to think about the protection cover we discussed? Happy to do a 10-min call whenever suits.",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(14) as never,
  },

  // ── Self-employed ───────────────────────────────────────────────────
  {
    id: "tpl-self-emp-welcome",
    name: "Self-employed welcome",
    channel: "email",
    subject: "Self-employed? Here's what lenders want to see, {{firstName}}",
    body: "Hi {{firstName}},\n\nGetting a mortgage when you're self-employed is absolutely doable — you just need the right paperwork. Most lenders want to see at least two years of SA302s or accountant-certified accounts.\n\nHere's a quick checklist:\n• Two years of SA302 tax calculations (from HMRC or your accountant)\n• Corresponding tax year overviews\n• Company accounts if you trade through a limited company\n• Three months of business bank statements\n\nIf you're not quite there yet, don't worry — we'll work out a timeline and I'll check in as we go.\n\n{{adviser}} at {{firmName}}",
    variables: ["firstName", "adviser", "firmName"],
    updatedAt: daysAgo(22) as never,
  },
  {
    id: "tpl-self-emp-accounts-chase",
    name: "Self-employed accounts chase",
    channel: "email",
    subject: "Tax year end approaching — time to get your accounts sorted, {{firstName}}",
    body: "Hi {{firstName}},\n\nWith the tax year wrapping up soon, now's a good time to chase your accountant for finalised accounts. The sooner they're done, the sooner we can get your application moving.\n\nIf your accountant needs a letter from me outlining what lenders require, I'm happy to send one over.\n\n{{adviser}}",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(19) as never,
  },
  {
    id: "tpl-self-emp-year-review",
    name: "Self-employed year review",
    channel: "email",
    subject: "Another year of trading, {{firstName}} — let's revisit your mortgage options",
    body: "Hi {{firstName}},\n\nYou've now got another year of trading history under your belt, which opens up more lender options. Rates and criteria change regularly, so it's worth a fresh look.\n\nWant me to run the numbers again with your latest figures?\n\n{{adviser}}",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(12) as never,
  },

  // ── Buy-to-let ──────────────────────────────────────────────────────
  {
    id: "tpl-btl-welcome",
    name: "BTL welcome",
    channel: "email",
    subject: "Your buy-to-let mortgage journey, {{firstName}}",
    body: "Hi {{firstName}},\n\nThanks for getting in touch about a buy-to-let mortgage. A few things to be aware of upfront:\n\n• Most BTL lenders require a minimum 25% deposit\n• Rental income typically needs to cover 125–145% of the mortgage payment\n• If you're considering a limited company structure, we should discuss that early — it affects which lenders and products are available\n\nI'll put together some options based on what we discussed. In the meantime, if you've got a specific property in mind, send me the details and I'll run the rental yield calculation.\n\n{{adviser}} at {{firmName}}",
    variables: ["firstName", "adviser", "firmName"],
    updatedAt: daysAgo(17) as never,
  },
  {
    id: "tpl-btl-rental-yield",
    name: "BTL rental yield check",
    channel: "email",
    subject: "Rental yield and affordability check for your BTL, {{firstName}}",
    body: "Hi {{firstName}},\n\nI've run the numbers on the property we discussed. For BTL mortgages, lenders use a stress-tested rental calculation — so even if the actual yield looks healthy, we need to make sure it passes their affordability model.\n\nI've attached a summary of your options. A couple of things to consider: fixed vs tracker, interest-only vs repayment, and whether a limited company purchase makes sense for your tax position.\n\nShall we book a call to go through them?\n\n{{adviser}}",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(13) as never,
  },

  // ── Post-completion & referrals ─────────────────────────────────────
  {
    id: "tpl-post-completion",
    name: "Post-completion congrats",
    channel: "email",
    subject: "Congratulations on your new home, {{firstName}}!",
    body: "Hi {{firstName}},\n\nHuge congratulations — you've completed! I hope moving day goes smoothly.\n\nA couple of things worth knowing:\n• Keep your mortgage documents somewhere safe — you'll need your offer letter and direct debit details\n• Your first payment usually goes out about a month after completion\n• If you took out protection cover, those policies are now active\n\nI'll check in again in a few months to make sure everything's settled. In the meantime, enjoy the new place!\n\n{{adviser}} at {{firmName}}",
    variables: ["firstName", "adviser", "firmName"],
    updatedAt: daysAgo(10) as never,
  },
  {
    id: "tpl-referral-ask",
    name: "Referral ask",
    channel: "email",
    subject: "Know anyone who needs mortgage help, {{firstName}}?",
    body: "Hi {{firstName}},\n\nHope you're settled in and enjoying the new place. I wanted to ask — if you know anyone who's thinking about buying, remortgaging, or investing in property, I'd be happy to have a chat with them. No hard sell, just the same straightforward advice I gave you.\n\nA quick introduction by text or email is all it takes. I really appreciate the trust.\n\n{{adviser}} at {{firmName}}",
    variables: ["firstName", "adviser", "firmName"],
    updatedAt: daysAgo(8) as never,
  },

  // ── Document chasing ────────────────────────────────────────────────
  {
    id: "tpl-docs-needed",
    name: "Documents needed",
    channel: "email",
    subject: "Documents we still need from you, {{firstName}}",
    body: "Hi {{firstName}},\n\nJust a quick note — we're still waiting on a few documents to get your application moving. I know paperwork isn't the fun part, but the sooner we have everything, the sooner we can submit.\n\nCould you send over the outstanding items at your earliest convenience? If you're not sure what's still needed, just reply and I'll send the list again.\n\n{{adviser}} at {{firmName}}",
    variables: ["firstName", "adviser", "firmName"],
    updatedAt: daysAgo(7) as never,
  },
  {
    id: "tpl-docs-final-chase",
    name: "Documents final chase",
    channel: "email",
    subject: "Final reminder — paperwork needed, {{firstName}}",
    body: "Hi {{firstName}},\n\nThis is a last nudge about the outstanding documents. Without them, I'm unable to progress your application and we risk losing the product rate we've earmarked.\n\nIf there's a problem getting hold of anything, let me know — there might be an alternative we can use.\n\n{{adviser}}",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(6) as never,
  },
  {
    id: "tpl-sms-docs-reminder",
    name: "SMS — docs reminder",
    channel: "sms",
    body: "Hi {{firstName}}, {{adviser}} here. Quick reminder — we're still waiting on a few documents for your mortgage application. Drop me a message if you need the list again.",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(5) as never,
  },

  // ── Rate expiry ─────────────────────────────────────────────────────
  {
    id: "tpl-rate-expiry-180",
    name: "Rate expiry 6-month warning",
    channel: "email",
    subject: "{{firstName}}, your mortgage rate expires in 6 months",
    body: "Hi {{firstName}},\n\nYour current mortgage rate is due to expire in about 6 months. That might feel like ages away, but most lenders let us lock in a new rate up to 6 months early — with no obligation to take it if something better comes along.\n\nIt's a free option, basically. Want me to run a comparison and send you the top picks?\n\n{{adviser}}",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(9) as never,
  },
  {
    id: "tpl-rate-expiry-30",
    name: "Rate expiry 30-day warning",
    channel: "email",
    subject: "30 days until your mortgage rate expires, {{firstName}}",
    body: "Hi {{firstName}},\n\nYour current rate expires in about 30 days. If we haven't already secured a new product, now's the time — once it lapses you'll move onto the lender's standard variable rate, which is usually significantly higher.\n\nIf we've already got something lined up, no action needed. Otherwise, give me a ring and we'll get it sorted quickly.\n\n{{adviser}}",
    variables: ["firstName", "adviser"],
    updatedAt: daysAgo(4) as never,
  },

  // ── New enquiry ─────────────────────────────────────────────────────
  {
    id: "tpl-new-enquiry-welcome",
    name: "New enquiry welcome",
    channel: "email",
    subject: "Thanks for your enquiry, {{firstName}}",
    body: "Hi {{firstName}},\n\nThanks for getting in touch — I'll be looking after your mortgage enquiry.\n\nI'll give you a call shortly to understand what you're looking for. In the meantime, it's helpful if you have a rough idea of:\n• Your budget or the property value you're looking at\n• Your deposit amount (or equity if remortgaging)\n• Your employment situation\n\nNo need to have everything nailed down — that's what I'm here for.\n\nSpeak soon,\n{{adviser}} at {{firmName}}",
    variables: ["firstName", "adviser", "firmName"],
    updatedAt: daysAgo(3) as never,
  },
  {
    id: "tpl-sms-enquiry-followup",
    name: "SMS — enquiry follow-up",
    channel: "sms",
    body: "Hi {{firstName}}, thanks for your enquiry with {{firmName}}. I tried calling earlier — when's a good time to chat about your mortgage options?",
    variables: ["firstName", "firmName"],
    updatedAt: daysAgo(2) as never,
  },

  // ── Anniversary & retention ─────────────────────────────────────────
  {
    id: "tpl-anniversary",
    name: "Mortgage anniversary",
    channel: "email",
    subject: "Happy mortgage anniversary, {{firstName}}!",
    body: "Hi {{firstName}},\n\nIt's been a year since your mortgage completed — time flies! Just a quick note to check in:\n\n• Is everything going well with the property?\n• Have your circumstances changed at all (new job, growing family, thinking about moving)?\n• Are you keeping an eye on your rate expiry date?\n\nI keep track of when your deal ends so I can get in touch at the right time. But if anything comes up before then, I'm always here.\n\n{{adviser}} at {{firmName}}",
    variables: ["firstName", "adviser", "firmName"],
    updatedAt: daysAgo(1) as never,
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
