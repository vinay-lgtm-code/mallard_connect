import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = () => process.env.EMAIL_FROM ?? "Sequence <reminders@sequence-ai.com>";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) return "";
  return esc(url);
}

function brandedHtml({
  preheader,
  heading,
  body,
  ctaLabel,
  ctaUrl,
  footer,
}: {
  preheader?: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}) {
  const safeHeading = esc(heading);
  const safePreheader = preheader ? esc(preheader) : "";
  const safeFooter = esc(footer ?? "This email was sent by Sequence. If you believe this was sent in error, please contact your adviser.");

  const ctaBlock = ctaLabel && ctaUrl
    ? `<a href="${escUrl(ctaUrl)}" style="display:inline-block;background-color:#1A5653;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600;">${esc(ctaLabel)}</a>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeHeading}</title>
  ${safePreheader ? `<span style="display:none;font-size:1px;color:#f4f4f5;max-height:0;overflow:hidden;">${safePreheader}</span>` : ""}
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#1A5653;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Sequence</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:600;">${safeHeading}</h2>
              <div style="color:#374151;font-size:15px;line-height:1.6;">${body}</div>
              ${ctaBlock ? `<div style="margin-top:24px;">${ctaBlock}</div>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                ${safeFooter}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function textToHtml(text: string): string {
  return esc(text)
    .split("\n\n")
    .map((para) => `<p style="margin:0 0 12px;">${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

// ── Follow-up reminder (internal, sent to advisers) ───────────────────

interface SendReminderParams {
  to: string[];
  prospectName: string;
  prospectPhone: string;
  followUpReason: string;
  reminderNote: string;
  leadUrl: string;
}

export async function sendReminderEmail({
  to,
  prospectName,
  prospectPhone,
  followUpReason,
  reminderNote,
  leadUrl,
}: SendReminderParams) {
  const safeName = esc(prospectName);
  const safePhone = esc(prospectPhone);
  const safeReason = esc(followUpReason);
  const safeNote = esc(reminderNote);
  const infoRows = [
    `<tr><td style="padding:6px 0;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Name</span><br/><span style="color:#111827;font-size:15px;font-weight:600;">${safeName}</span></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Phone</span><br/><a href="tel:${safePhone}" style="color:#1A5653;font-size:15px;font-weight:600;text-decoration:none;">${safePhone}</a></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Reason for follow-up</span><br/><span style="color:#111827;font-size:15px;">${safeReason}</span></td></tr>`,
    ...(reminderNote
      ? [`<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Notes</span><br/><span style="color:#374151;font-size:14px;line-height:1.5;">${safeNote}</span></td></tr>`]
      : []),
  ];

  const body = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">${infoRows.join("")}</table>
      </td></tr>
    </table>`;

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Follow-up reminder: ${prospectName}`,
    html: brandedHtml({
      heading: `You have a follow-up due with ${prospectName}`,
      body,
      ctaLabel: "View Lead in Sequence",
      ctaUrl: leadUrl,
      footer: "This reminder was sent by Sequence. If you believe this was sent in error, please contact your manager.",
    }),
  });
}

// ── Cadence step email (outbound, sent to prospects) ──────────────────

interface SendCadenceEmailParams {
  to: string;
  subject: string;
  body: string;
  leadUrl: string;
  idempotencyKey?: string;
}

export async function sendCadenceEmail({
  to,
  subject,
  body,
  leadUrl,
  idempotencyKey,
}: SendCadenceEmailParams) {
  return getResend().emails.send(
    {
      from: FROM(),
      to: [to],
      subject,
      html: brandedHtml({
        preheader: subject,
        heading: subject,
        body: textToHtml(body),
        ctaLabel: "Get in Touch",
        ctaUrl: leadUrl,
      }),
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
}

// ── Lead assignment notification (internal, sent to advisers & managers) ─

interface SendAssignmentEmailParams {
  to: string[];
  leadName: string;
  leadPhone: string;
  leadSource: string;
  mortgageType: string;
  assignedByName: string;
  assigneeName: string;
  leadUrl: string;
}

export async function sendAssignmentEmail({
  to,
  leadName,
  leadPhone,
  leadSource,
  mortgageType,
  assignedByName,
  assigneeName,
  leadUrl,
}: SendAssignmentEmailParams) {
  const safeName = esc(leadName);
  const safePhone = esc(leadPhone);
  const safeSource = esc(leadSource);
  const safeMortgage = esc(mortgageType);
  const safeAssigner = esc(assignedByName);
  const safeAssignee = esc(assigneeName);

  const infoRows = [
    `<tr><td style="padding:6px 0;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Lead</span><br/><span style="color:#111827;font-size:15px;font-weight:600;">${safeName}</span></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Phone</span><br/><a href="tel:${safePhone}" style="color:#1A5653;font-size:15px;font-weight:600;text-decoration:none;">${safePhone}</a></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Source</span><br/><span style="color:#111827;font-size:15px;">${safeSource}</span></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Mortgage type</span><br/><span style="color:#111827;font-size:15px;">${safeMortgage}</span></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Assigned to</span><br/><span style="color:#111827;font-size:15px;font-weight:600;">${safeAssignee}</span></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Assigned by</span><br/><span style="color:#111827;font-size:15px;">${safeAssigner}</span></td></tr>`,
  ];

  const body = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">${infoRows.join("")}</table>
      </td></tr>
    </table>`;

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Lead assigned: ${leadName} → ${assigneeName}`,
    html: brandedHtml({
      heading: `${leadName} has been assigned to ${assigneeName}`,
      body,
      ctaLabel: "View Lead in Sequence",
      ctaUrl: leadUrl,
      footer: "This notification was sent by Sequence. If you believe this was sent in error, please contact your manager.",
    }),
  });
}

// ── Daily prospect digest (internal, sent to advisers) ──────────────────

interface DigestLeadCard {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  mortgageType: string;
  source: string;
  taskTitle?: string;
  dueDate?: string;
  isOverdue?: boolean;
}

interface SendDailyDigestParams {
  to: string;
  userName: string;
  date: string;
  overdue: DigestLeadCard[];
  dueThisWeek: DigestLeadCard[];
  recentlyUpdated: DigestLeadCard[];
  appUrl: string;
}

function digestCard(card: DigestLeadCard, borderColor: string, appUrl: string): string {
  const safeName = esc(`${card.firstName} ${card.lastName}`.trim());
  const safePhone = esc(card.phone);
  const safeMortgage = esc(card.mortgageType);
  const safeSource = esc(card.source);

  let taskLine = "";
  if (card.taskTitle) {
    const safeTask = esc(card.taskTitle);
    const safeDue = card.dueDate ? esc(card.dueDate) : "";
    taskLine = `<tr><td style="padding:4px 0 0;"><span style="color:#6b7280;font-size:12px;">${safeTask}${safeDue ? ` &mdash; ${safeDue}` : ""}</span></td></tr>`;
  }

  const leadUrl = escUrl(`${appUrl}/leads/${card.id}`);

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-left:4px solid ${borderColor};background-color:#f9fafb;border-radius:4px;margin-bottom:12px;">
      <tr><td style="padding:14px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="color:#111827;font-size:15px;font-weight:600;">${safeName}</span>
              <span style="color:#6b7280;font-size:13px;margin-left:8px;">${safeMortgage}</span>
            </td>
          </tr>
          <tr><td style="padding:4px 0 0;">
            <span style="color:#6b7280;font-size:13px;">Source: ${safeSource}</span>
            <span style="color:#6b7280;font-size:13px;margin-left:12px;">
              <a href="tel:${safePhone}" style="color:#1A5653;text-decoration:none;">${safePhone}</a>
            </span>
          </td></tr>
          ${taskLine}
          <tr><td style="padding:8px 0 0;">
            <a href="${leadUrl}" style="color:#1A5653;font-size:13px;font-weight:500;text-decoration:none;">View lead &rarr;</a>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

function digestSection(title: string, cards: DigestLeadCard[], borderColor: string, appUrl: string): string {
  if (cards.length === 0) return "";
  return `
    <h3 style="margin:24px 0 12px;color:#111827;font-size:15px;font-weight:600;">${esc(title)}</h3>
    ${cards.map((c) => digestCard(c, borderColor, appUrl)).join("")}`;
}

export async function sendDailyDigestEmail({
  to,
  userName,
  date,
  overdue,
  dueThisWeek,
  recentlyUpdated,
  appUrl,
}: SendDailyDigestParams) {
  const formattedDate = esc(date);
  const safeUser = esc(userName);

  const greeting = `<p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6;">Hi ${safeUser}, here&rsquo;s your prospect update for ${formattedDate}.</p>`;

  const sections = [
    digestSection("Overdue", overdue, "#ef4444", appUrl),
    digestSection("Due This Week", dueThisWeek, "#f59e0b", appUrl),
    digestSection("Recently Updated", recentlyUpdated, "#3b82f6", appUrl),
  ].join("");

  const body = `${greeting}${sections}`;

  return getResend().emails.send({
    from: FROM(),
    to: [to],
    subject: `Your daily prospect update - ${date}`,
    html: brandedHtml({
      preheader: `${overdue.length} overdue, ${dueThisWeek.length} due this week`,
      heading: `Daily Prospect Digest`,
      body,
      ctaLabel: "Open Sequence",
      ctaUrl: appUrl,
      footer: "This digest was sent by Sequence. You receive this because you are an active adviser. Contact your manager to adjust.",
    }),
  });
}

// ── Follow-up scheduled confirmation (internal, sent to advisers & managers) ─

interface SendFollowUpScheduledEmailParams {
  to: string[];
  leadName: string;
  taskTitle: string;
  dueDate: string;
  scheduledByName: string;
  leadUrl: string;
}

export async function sendFollowUpScheduledEmail({
  to,
  leadName,
  taskTitle,
  dueDate,
  scheduledByName,
  leadUrl,
}: SendFollowUpScheduledEmailParams) {
  const safeName = esc(leadName);
  const safeTask = esc(taskTitle);
  const safeDue = esc(dueDate);
  const safeScheduler = esc(scheduledByName);

  const infoRows = [
    `<tr><td style="padding:6px 0;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Lead</span><br/><span style="color:#111827;font-size:15px;font-weight:600;">${safeName}</span></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Task</span><br/><span style="color:#111827;font-size:15px;">${safeTask}</span></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Due date</span><br/><span style="color:#111827;font-size:15px;font-weight:600;">${safeDue}</span></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Scheduled by</span><br/><span style="color:#111827;font-size:15px;">${safeScheduler}</span></td></tr>`,
  ];

  const body = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">${infoRows.join("")}</table>
      </td></tr>
    </table>`;

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Follow-up scheduled: ${leadName}`,
    html: brandedHtml({
      heading: `A follow-up has been scheduled for ${leadName}`,
      body,
      ctaLabel: "View Lead in Sequence",
      ctaUrl: leadUrl,
      footer: "This notification was sent by Sequence. If you believe this was sent in error, please contact your manager.",
    }),
  });
}

// ── Team member invite (sent to new member) ─────────────────────────────

interface SendTeamInviteParams {
  to: string;
  fullName: string;
  role: string;
  tempPassword: string;
  loginUrl: string;
}

function formatLabel(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function infoRow(label: string, value: string) {
  return `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">${label}</span><br/><span style="color:#111827;font-size:15px;">${value}</span></td></tr>`;
}

export async function sendTeamInviteEmail({
  to,
  fullName,
  role,
  tempPassword,
  loginUrl,
}: SendTeamInviteParams) {
  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      Welcome, <strong>${esc(fullName)}</strong>! You've been added to Sequence as a <strong>${esc(formatLabel(role))}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Email", esc(to))}
          ${infoRow("Temporary Password", `<code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-size:14px;">${esc(tempPassword)}</code>`)}
        </table>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Please change your password after your first login.</p>`;

  return getResend().emails.send({
    from: FROM(),
    to: [to],
    subject: "You've been invited to Sequence",
    html: brandedHtml({
      preheader: "You've been added to Sequence — log in to get started",
      heading: "Welcome to Sequence",
      body,
      ctaLabel: "Log In to Sequence",
      ctaUrl: loginUrl,
    }),
  });
}

// ── Signup confirmation (sent to new signups) ───────────────────────────

interface SendSignupConfirmationParams {
  to: string;
  fullName: string;
  confirmUrl: string;
}

export async function sendSignupConfirmationEmail({
  to,
  fullName,
  confirmUrl,
}: SendSignupConfirmationParams) {
  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      Hi <strong>${esc(fullName.split(" ")[0])}</strong>, thanks for signing up for Sequence!
    </p>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;">
      Please confirm your email address to activate your account and get started.
    </p>`;

  return getResend().emails.send({
    from: FROM(),
    to: [to],
    subject: "Confirm your Sequence account",
    html: brandedHtml({
      preheader: "One click to activate your Sequence account",
      heading: "Confirm Your Email",
      body,
      ctaLabel: "Confirm Email Address",
      ctaUrl: confirmUrl,
      footer: "If you didn't create an account on Sequence, you can safely ignore this email.",
    }),
  });
}

// ── OAuth welcome (sent to first-time OAuth signups) ────────────────────

interface SendOAuthWelcomeParams {
  to: string;
  fullName: string;
  provider: string;
}

export async function sendOAuthWelcomeEmail({
  to,
  fullName,
  provider,
}: SendOAuthWelcomeParams) {
  const providerName = provider === "azure" ? "Microsoft" : provider.charAt(0).toUpperCase() + provider.slice(1);

  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      Hi <strong>${esc(fullName.split(" ")[0])}</strong>, welcome to Sequence!
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      Your account has been created using <strong>${esc(providerName)}</strong>. You're all set — complete the onboarding steps to get your team up and running.
    </p>`;

  return getResend().emails.send({
    from: FROM(),
    to: [to],
    subject: "Welcome to Sequence",
    html: brandedHtml({
      preheader: `Your Sequence account is ready — signed up with ${providerName}`,
      heading: "Welcome to Sequence",
      body,
      ctaLabel: "Get Started",
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://sequence-ai.com"}/onboarding`,
      footer: "If you didn't create an account on Sequence, you can safely ignore this email.",
    }),
  });
}

// ── New lead created (internal, sent to managers) ───────────────────────

interface SendLeadCreatedParams {
  to: string[];
  leadName: string;
  leadPhone: string;
  leadEmail: string | null;
  leadSource: string;
  mortgageType: string | null;
  readiness: string | null;
  nextFollowUpDate: string | null;
  followUpReason: string | null;
  followUpNotes: string | null;
  createdByName: string;
  leadUrl: string;
}

function formatFollowUpDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export async function sendLeadCreatedEmail({
  to,
  leadName,
  leadPhone,
  leadEmail,
  leadSource,
  mortgageType,
  readiness,
  nextFollowUpDate,
  followUpReason,
  followUpNotes,
  createdByName,
  leadUrl,
}: SendLeadCreatedParams) {
  const rows = [
    `<tr><td style="padding:6px 0;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Name</span><br/><span style="color:#111827;font-size:15px;font-weight:600;">${esc(leadName)}</span></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Phone</span><br/><a href="tel:${esc(leadPhone)}" style="color:#1A5653;font-size:15px;font-weight:600;text-decoration:none;">${esc(leadPhone)}</a></td></tr>`,
    ...(leadEmail ? [`<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Email</span><br/><span style="color:#111827;font-size:15px;">${esc(leadEmail)}</span></td></tr>`] : []),
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Source</span><br/><span style="color:#111827;font-size:15px;">${esc(leadSource)}</span></td></tr>`,
    ...(mortgageType ? [`<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Mortgage type</span><br/><span style="color:#111827;font-size:15px;">${esc(formatLabel(mortgageType))}</span></td></tr>`] : []),
    ...(readiness ? [`<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Readiness</span><br/><span style="color:#111827;font-size:15px;">${esc(formatLabel(readiness))}</span></td></tr>`] : []),
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Added by</span><br/><span style="color:#111827;font-size:15px;">${esc(createdByName)}</span></td></tr>`,
  ];

  const followUpRows = [
    ...(nextFollowUpDate ? [`<tr><td style="padding:6px 0;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Date of follow-up</span><br/><span style="color:#111827;font-size:15px;font-weight:600;">${esc(formatFollowUpDate(nextFollowUpDate))}</span></td></tr>`] : []),
    ...(followUpReason ? [`<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Reason for follow-up</span><br/><span style="color:#111827;font-size:15px;">${esc(followUpReason)}</span></td></tr>`] : []),
    ...(followUpNotes ? [`<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Notes</span><br/><span style="color:#374151;font-size:14px;line-height:1.5;">${esc(followUpNotes)}</span></td></tr>`] : []),
  ];

  const followUpBlock = followUpRows.length > 0
    ? `
    <h3 style="margin:24px 0 12px;color:#111827;font-size:15px;font-weight:600;">Next Follow-up</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">${followUpRows.join("")}</table>
      </td></tr>
    </table>`
    : "";

  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      <strong>${esc(leadName)}</strong> has been saved in Sequence.
    </p>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      Added by <strong>${esc(createdByName)}</strong>. The lead record is ready for review and follow-up.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
      </td></tr>
    </table>
    ${followUpBlock}`;

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Lead saved: ${leadName}`,
    html: brandedHtml({
      preheader: `${leadName} was saved in Sequence by ${createdByName}`,
      heading: `Lead Saved - ${leadName}`,
      body,
      ctaLabel: "View Lead in Sequence",
      ctaUrl: leadUrl,
      footer: "This notification was sent by Sequence. If you believe this was sent in error, please contact your manager.",
    }),
  });
}

// ── Stage change notification (internal, sent to advisers & managers) ──

interface SendStageChangeEmailParams {
  to: string[];
  leadName: string;
  toStageName: string;
  note: string | null;
  leadUrl: string;
}

export async function sendStageChangeEmail({
  to,
  leadName,
  toStageName,
  note,
  leadUrl,
}: SendStageChangeEmailParams) {
  const rows = [
    `<tr><td style="padding:6px 0;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Lead</span><br/><span style="color:#111827;font-size:15px;font-weight:600;">${esc(leadName)}</span></td></tr>`,
    `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">New stage</span><br/><span style="color:#111827;font-size:15px;">${esc(toStageName)}</span></td></tr>`,
    ...(note ? [`<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">Note</span><br/><span style="color:#374151;font-size:14px;line-height:1.5;">${esc(note)}</span></td></tr>`] : []),
  ];

  const body = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
      </td></tr>
    </table>`;

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Stage change: ${leadName} → ${toStageName}`,
    html: brandedHtml({
      heading: `${leadName} moved to ${toStageName}`,
      body,
      ctaLabel: "View Lead in Sequence",
      ctaUrl: leadUrl,
      footer: "This notification was sent by Sequence. If you believe this was sent in error, please contact your manager.",
    }),
  });
}

// ── Lead converted/lost (internal, sent to managers) ─────────────────

interface SendLeadConvertedEmailParams {
  to: string[];
  leadName: string;
  outcome: "converted" | "lost";
  leadUrl: string;
}

export async function sendLeadConvertedEmail({
  to,
  leadName,
  outcome,
  leadUrl,
}: SendLeadConvertedEmailParams) {
  const isConverted = outcome === "converted";
  const heading = isConverted
    ? `${leadName} has been converted`
    : `${leadName} has been marked as lost`;
  const emoji = isConverted ? "&#127881;" : "";

  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      ${emoji} <strong>${esc(leadName)}</strong> has been ${isConverted ? "converted to a client" : "marked as lost"}.
    </p>`;

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Lead ${outcome}: ${leadName}`,
    html: brandedHtml({
      heading,
      body,
      ctaLabel: "View Lead in Sequence",
      ctaUrl: leadUrl,
      footer: "This notification was sent by Sequence.",
    }),
  });
}

// ── Import summary (internal, sent to uploader) ──────────────────────

interface SendImportSummaryEmailParams {
  to: string;
  uploaderName: string;
  created: number;
  updated: number;
  failed: number;
  total: number;
  importUrl: string;
}

export async function sendImportSummaryEmail({
  to,
  uploaderName,
  created,
  updated,
  failed,
  total,
  importUrl,
}: SendImportSummaryEmailParams) {
  const rows = [
    infoRow("Total rows", String(total)),
    infoRow("Created", String(created)),
    infoRow("Updated", String(updated)),
    ...(failed > 0 ? [infoRow("Failed", `<span style="color:#ef4444;font-weight:600;">${failed}</span>`)] : []),
  ];

  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      Hi <strong>${esc(uploaderName.split(" ")[0])}</strong>, your import has completed.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
      </td></tr>
    </table>`;

  return getResend().emails.send({
    from: FROM(),
    to: [to],
    subject: `Import complete: ${created + updated} of ${total} leads processed`,
    html: brandedHtml({
      preheader: `${created} created, ${updated} updated${failed > 0 ? `, ${failed} failed` : ""}`,
      heading: "Import Summary",
      body,
      ctaLabel: "View Leads",
      ctaUrl: importUrl,
    }),
  });
}

// ── Password reset (sent to user) ─────────────────────────────────────

interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: SendPasswordResetEmailParams) {
  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      We received a request to reset your password. Click the button below to set a new password.
    </p>
    <p style="margin:0 0 0;color:#9ca3af;font-size:13px;">
      If you didn&rsquo;t request this, you can safely ignore this email. The link expires in 1 hour.
    </p>`;

  return getResend().emails.send({
    from: FROM(),
    to: [to],
    subject: "Reset your Sequence password",
    html: brandedHtml({
      preheader: "Reset your password for Sequence",
      heading: "Reset Your Password",
      body,
      ctaLabel: "Reset Password",
      ctaUrl: resetUrl,
      footer: "If you didn't request a password reset, you can safely ignore this email.",
    }),
  });
}
