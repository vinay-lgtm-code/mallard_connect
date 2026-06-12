# Sequence — Codebase Contract

This file is loaded into every Claude Code session. Read first.

## What this product is

**Sequence** is a multi-tenant SaaS for UK mortgage advisers, hosted at `sequence-ai.com`. It is a **bolt-on nurture layer** that sits alongside whatever CRM/back-office system a firm already uses (Mortgage Advice Bureau "Platform", FLG, Dashly, Intelligent Office, etc.). It is **not** a CRM replacement.

The product directly addresses one customer pain: prospects who enquire but are not transaction-ready (e.g. first-time buyers still saving a deposit, self-employed clients building accounts history) fall through the cracks. Sequence solves this with structured cadences, complete activity logging, and at-a-glance pipeline visibility.

**Guiding principle.** *Sequence works with existing workflows without disrupting them.* When a firm has Brevo, we pull contacts from Brevo. When they don't, we ingest weekly CSV exports from MAB. We never ask a firm to abandon their primary CRM.

## Who uses it

- **Owner / Manager** (e.g. Della at Mallard Mortgages) — pipeline visibility, team performance, importing contacts.
- **Adviser** — daily follow-up list ("My Day"), quick lead capture, activity logging.
- **Tenants currently in scope:** Mallard Mortgages (Sheffield), Friends Capital (high-end), generic "Acme Mortgages" (used for cold demos and general showcasing).

## Architecture

- **Framework:** Next.js 15 App Router, TypeScript, React 19.
- **Database:** Supabase (Postgres) — multi-tenant, see Tenant Model rules below.
- **Auth:** Supabase Auth + `app_metadata` claims (`role`, `tenant_id`).
- **Email send engine:** Resend. **Always Resend** for outbound transactional email — never replace, never split.
- **Optional contact source:** Brevo, opportunistic one-way pull only. Tenants without Brevo use CSV import.
- **Hosting:** Vercel. Cron jobs in `vercel.json`. Vercel Analytics enabled.
- **State:** Supabase realtime subscriptions for live data; client-side Supabase SDK for queries.
- **UI:** Tailwind v4 only (no shadcn/ui, no component library beyond what we ship in `src/components/ui/`).

## Domain map

| Host | Purpose | Route group |
|---|---|---|
| `www.sequence-ai.com` | Marketing landing | `app/(marketing)/` |
| `app.sequence-ai.com` | Authenticated app (default) | `app/(app)/`, `app/(auth)/`, `app/(onboarding)/`, `app/demo/` |
| `{firm}.sequence-ai.com` (e.g. `mallard.*`, `friendscapital.*`) | Same as `app.*` but tenant pre-resolved from `subdomains/{firm}` map | same as above |

`src/middleware.ts` resolves the host header to a tenant. `(marketing)` is blocked on app/vanity hosts; `(app)` is blocked on `www`.

## Tenant Model — non-negotiable rules

1. **Every Firestore query is tenant-scoped.** All collections except `tenants/`, `users/`, and `subdomains/` live under `tenants/{tenantId}/...`. Never write a query that crosses tenants.
2. **Custom claim `tenantId` is the source of truth on the server.** Middleware and API routes verify `decoded.tenantId === resolvedTenantId` before any read/write.
3. **`firestore.rules` enforces `request.auth.token.tenantId == tid` on every `tenants/{tid}/...` path.** Add rules for any new collection in the same PR.
4. **A user belongs to exactly one tenant.** Cross-tenant access requires re-auth. We do not support "switch workspace" today.
5. **Vanity subdomain → tenantId** is resolved through the `subdomains/{slug}` lookup, not from the URL alone. The slug is reserved at onboarding time; collisions are rejected.

When you add a collection, follow this checklist: type added in `src/types/index.ts`, Zod schema added in `src/schemas/`, Firestore rule added in `firestore.rules`, hook (if needed) wired through `useTenant()`.

## Cadence engine

Cadences are how Sequence does long-cycle nurturing. They are stored in `tenants/{tid}/cadences` and run by a single daily cron (`/api/cron/run-cadences`) extended from the original reminder cron.

- **Cadence shape:** `{ name, trigger: { type: 'stage_entered'|'manual'|'lead_created', stageId? }, steps: [{ delayDays, channel: 'email'|'sms'|'task'|'reminder', templateId, subject?, body? }], isActive }`.
- **Enrollments:** `tenants/{tid}/cadenceEnrollments` with `{ leadId, cadenceId, currentStep, nextRunAt, status }`.
- **Triggers:** stage-change auto-enroll fires from `src/app/(app)/pipeline/page.tsx` and lead-edit handlers; manual enroll is a modal on lead detail.
- **Channels:**
  - `email` → Resend send + activity row.
  - `sms` → Brevo SMS if connected; otherwise create a `task` reminder telling the adviser to call.
  - `task` / `reminder` → write to `tasks` subcollection with assigned adviser.
- **Templates** live in `tenants/{tid}/templates` with variables `{{firstName}}`, `{{adviser}}`, `{{firmName}}`, `{{nextActionDate}}`. Render via `src/lib/email/render.ts`.
- **Three seeded starter cadences** per new tenant: "FTB nurture (deposit-saving)", "Remortgage 6-month warm-up", "Cold prospect re-engagement".

## Brevo principles

- **One-way pull only.** Read from Brevo into Sequence. We never push contacts from Sequence to Brevo, and Brevo is **never** the email send engine.
- **API key encrypted at rest.** Stored in `tenants/{tid}/integrations/brevo` wrapped with `BREVO_ENCRYPTION_KEY`.
- **Sync cron:** `/api/cron/sync-brevo` every 6 hours.
- **Webhook receiver:** `/api/integrations/brevo/webhook` writes email opens/clicks into the lead's activity timeline.
- If a tenant doesn't have Brevo, the integration card stays in "Not connected" state. CSV import covers ingestion.

## Demo mode

- `/demo` shows a tenant switcher: Mallard, Friends Capital, Acme Mortgages.
- Click sets `localStorage.sequence_demo_tenant` and routes to the dashboard. `getDemoTenant()` (replaces the older `isDemoUser()`) reads this and dispatches to the right `mock-data/{tenant}.ts` module.
- Demo data is fully synthetic and tenant-flavored: Mallard skews FTB, Friends Capital skews high-net-worth/BTL/equity release, Acme is balanced.
- A "Demo mode" banner is always visible while in demo mode; the switcher is one click away.
- Real Firebase queries are skipped in demo mode — every hook checks `getDemoTenant()` first.

## UX principle: laptop-first

Owners (e.g. Della) and advisers do most of their day on a laptop, not a phone. UK mortgage advisers told us mobile apps weren't a priority. Design accordingly:

- **Primary breakpoint is ≥1280px.** The pipeline kanban, multi-column "new lead" form, manager dashboard, leads table, lead-detail tabs, cadence builder, templates editor, and onboarding wizard are all designed for laptop-sized screens first.
- **Mobile views are intentionally narrower in scope.** They cover Quick Capture (between-appointments lead intake), the My Day follow-up list with tap-to-call, and a compact pipeline list. The kanban falls back to list view on mobile.
- When adding a feature, design the laptop view first. Add a mobile variant only if the feature has a real "between appointments" use case. Don't squeeze laptop tables into mobile viewports.

## Branding

- Default Sequence wordmark and palette ship in `public/sequence-logo.svg`, `public/sequence-mark.svg`, and `public/icons/`.
- Per-tenant override: `tenants/{tid}` doc holds `primaryColor` and `logoUrl`. The sidebar, login page, and email header use the tenant logo when on a vanity subdomain.
- Email `from`: `Sequence <reminders@sequence-ai.com>`. Per-tenant white-label `from` addresses are deferred (would require Resend domain verification per tenant).

## Common commands

```bash
npm run dev        # Next.js dev server
npm run build      # Production build (must pass before any merge)
npm run lint       # ESLint
npx tsc --noEmit   # Typecheck (run before committing)
```

Cron simulation:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/run-cadences
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-brevo
```

Local subdomain testing — add to `/etc/hosts`:
```
127.0.0.1 mallard.localhost
127.0.0.1 friendscapital.localhost
127.0.0.1 acme.localhost
```

## Things to never do

- Never query Firestore without a `tenantId` scope.
- Never replace Resend with another send engine.
- Never push data to Brevo. Read only.
- Never store unencrypted third-party API keys in Firestore.
- Never check in `.env.local`. Use `.env.local.example` for shape only.
- Never commit `pencil-welcome-desktop.pen` or other large design binaries unless asked.
- Never assume a single tenant. Even local-dev paths must respect the tenant model.

## Out of scope (stays as scaffolding for now)

These exist as empty pages or referenced features, but are not implemented in this rework: backbook monitoring (Dashly's 24/7 affordability watcher), affordability fact-find, document upload portal, calendar sync (Outlook/Google), AI lead summary, referral management, FCA compliance audit-trail export, deep MI/reporting. If a customer asks during demo, the answer is "on the roadmap, contact us."

## Reference: design files

UI mockups for Mallard's specific screens live in `pencil-welcome-desktop.pen` (Pencil/Lunaris design system). The README has a screen-ID map. These are reference-only — Sequence's actual visual design generalizes Mallard's screens to fit any firm.
