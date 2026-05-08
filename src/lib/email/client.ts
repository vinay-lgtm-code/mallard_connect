import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

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
  // EMAIL_FROM lets you use Resend's onboarding sender (`onboarding@resend.dev`)
  // for local demos before your real domain is verified. Defaults to the
  // production sender otherwise.
  const from = process.env.EMAIL_FROM ?? "Sequence <reminders@sequence-ai.com>";

  return getResend().emails.send({
    from,
    to,
    subject: `Follow-up reminder: ${prospectName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Follow-up Reminder</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#1A5653;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Sequence</h1>
              <p style="margin:4px 0 0;color:#bfdbfe;font-size:14px;">Follow-up Reminder</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 24px;color:#111827;font-size:18px;font-weight:600;">
                You have a follow-up due with ${prospectName}
              </h2>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="color:#6b7280;font-size:13px;font-weight:500;">Name</span><br />
                          <span style="color:#111827;font-size:15px;font-weight:600;">${prospectName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-top:1px solid #e5e7eb;">
                          <span style="color:#6b7280;font-size:13px;font-weight:500;">Phone</span><br />
                          <a href="tel:${prospectPhone}" style="color:#1A5653;font-size:15px;font-weight:600;text-decoration:none;">${prospectPhone}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-top:1px solid #e5e7eb;">
                          <span style="color:#6b7280;font-size:13px;font-weight:500;">Reason for follow-up</span><br />
                          <span style="color:#111827;font-size:15px;">${followUpReason}</span>
                        </td>
                      </tr>
                      ${
                        reminderNote
                          ? `
                      <tr>
                        <td style="padding:6px 0;border-top:1px solid #e5e7eb;">
                          <span style="color:#6b7280;font-size:13px;font-weight:500;">Notes</span><br />
                          <span style="color:#374151;font-size:14px;line-height:1.5;">${reminderNote}</span>
                        </td>
                      </tr>`
                          : ""
                      }
                    </table>
                  </td>
                </tr>
              </table>

              <a href="${leadUrl}" style="display:inline-block;background-color:#1A5653;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600;">
                View Lead in Sequence
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                This reminder was sent by Sequence. If you believe this was sent in error, please contact your manager.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
