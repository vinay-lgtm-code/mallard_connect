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

// ── Lead assignment notification (internal, sent to assignee + assigner) ─

interface LeadOverview {
  name: string;
  phone: string;
  email: string | null;
  source: string;
  mortgageType: string | null;
  readiness: string | null;
  propertyValue: number | null;
  stage: string;
}

interface SendAssignmentEmailParams {
  to: string[];
  assigneeName: string;
  assignerName: string;
  lead: LeadOverview;
  leadUrl: string;
}

export async function sendLeadAssignmentEmail({
  to,
  assigneeName,
  assignerName,
  lead,
  leadUrl,
}: SendAssignmentEmailParams) {
  const safeName = esc(lead.name);
  const rows = [
    infoRow("Name", safeName),
    infoRow("Phone", `<a href="tel:${esc(lead.phone)}" style="color:#1A5653;text-decoration:none;">${esc(lead.phone)}</a>`),
    ...(lead.email ? [infoRow("Email", esc(lead.email))] : []),
    infoRow("Source", esc(lead.source)),
    ...(lead.mortgageType ? [infoRow("Mortgage Type", esc(formatLabel(lead.mortgageType)))] : []),
    ...(lead.readiness ? [infoRow("Readiness", esc(formatLabel(lead.readiness)))] : []),
    ...(lead.propertyValue ? [infoRow("Property Value", `£${lead.propertyValue.toLocaleString("en-GB")}`)] : []),
    infoRow("Pipeline Stage", esc(lead.stage)),
  ];

  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      <strong>${esc(assignerName)}</strong> assigned <strong>${safeName}</strong> to <strong>${esc(assigneeName)}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
      </td></tr>
    </table>`;

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `Lead assigned: ${lead.name}`,
    html: brandedHtml({
      preheader: `${assignerName} assigned ${lead.name} to ${assigneeName}`,
      heading: `Lead Assigned — ${lead.name}`,
      body,
      ctaLabel: "View Lead in Sequence",
      ctaUrl: leadUrl,
    }),
  });
}

// ── Daily leads digest (internal, sent Mon-Fri 7 AM BST) ────────────────

interface DigestLead {
  name: string;
  phone: string;
  stage: string;
  nextFollowUp: string | null;
  readiness: string | null;
  leadUrl: string;
}

interface SendDailyDigestParams {
  to: string;
  recipientName: string;
  leads: DigestLead[];
  appUrl: string;
}

export async function sendDailyLeadsDigestEmail({
  to,
  recipientName,
  leads,
  appUrl,
}: SendDailyDigestParams) {
  const leadRows = leads.map((l) => {
    const followUp = l.nextFollowUp
      ? new Date(l.nextFollowUp).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : "—";
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
          <a href="${escUrl(l.leadUrl)}" style="color:#1A5653;font-weight:600;text-decoration:none;font-size:14px;">${esc(l.name)}</a>
          <br/><span style="color:#6b7280;font-size:12px;">${esc(l.phone)}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;">${esc(l.stage)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;">${esc(l.readiness ? formatLabel(l.readiness) : "—")}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;">${followUp}</td>
      </tr>`;
  }).join("");

  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      Good morning ${esc(recipientName.split(" ")[0])} — you have <strong>${leads.length}</strong> active lead${leads.length === 1 ? "" : "s"} assigned to you.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background-color:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Lead</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Stage</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Readiness</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Next Follow-up</th>
        </tr>
      </thead>
      <tbody>${leadRows}</tbody>
    </table>`;

  return getResend().emails.send({
    from: FROM(),
    to: [to],
    subject: `Your leads for today — ${leads.length} active`,
    html: brandedHtml({
      preheader: `${leads.length} active lead${leads.length === 1 ? "" : "s"} assigned to you`,
      heading: "Your Daily Leads Summary",
      body,
      ctaLabel: "Open My Dashboard",
      ctaUrl: appUrl,
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

// ── Shared helpers ───────────────────────────────────────────────────────

function infoRow(label: string, value: string) {
  return `<tr><td style="padding:6px 0;border-top:1px solid #e5e7eb;"><span style="color:#6b7280;font-size:13px;font-weight:500;">${label}</span><br/><span style="color:#111827;font-size:15px;">${value}</span></td></tr>`;
}

function formatLabel(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
