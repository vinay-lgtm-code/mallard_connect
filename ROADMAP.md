# Sequence — Roadmap

## Near-term

- **Notification preferences UI** — settings/notifications page with per-event toggles (reminders, assignments, stage changes, new lead). Backend support landed; frontend controls pending.
- **SMS via Brevo** — cadence engine already has the `sms` channel with a task-fallback when Brevo is not connected. Wire Brevo SMS API for tenants with an active integration.
- **Per-tenant email branding** — `from` address and logo in transactional emails. Blocked on Resend domain verification per tenant.

## Mid-term

- **Calendar sync** (Outlook / Google) — two-way sync for follow-up tasks and meetings.
- **MAB weekly-CSV import automation** — scheduled pull from Mortgage Advice Bureau exports; currently manual upload.
- **Reporting depth** — forecast page exists as a scaffold; expand with weighted pipeline, adviser performance trends, and conversion funnel analytics.

## Long-term

These features are scaffolded but not yet implemented:

- Backbook monitoring (Dashly-style 24/7 affordability watcher)
- Affordability fact-find
- Document upload portal
- AI lead summary
- Referral management
- FCA compliance audit-trail export
- Deep MI / reporting
