# Sequence — Codebase Contract

This file is loaded into every Claude Code session and referenced in every PR. Read first. Keep current.

---

## 1. User

### Who uses Sequence

Sequence serves **UK mortgage advisory firms** — small teams (2-15 people) that already have a primary CRM or back-office system (MAB Platform, FLG, Dashly, Intelligent Office) for in-flight cases but lack a structured process for long-cycle nurturing.

### Roles

| Role | What they do in Sequence | Access level |
|---|---|---|
| **Owner / Manager** | Pipeline visibility, team performance, contact import, cadence & template management, integration setup, pipeline stage config | `admin` or `manager` — full read/write, team management, settings |
| **Adviser** | Daily follow-up list ("My Day"), quick lead capture, activity logging, pipeline drag-drop | `advisor` — read/write on leads, activities, tasks; no team or settings |

### Personas

- **Della Mallard** — Owner/Manager at Mallard Mortgages (Sheffield). Runs a team of 3 advisers. Cares about pipeline visibility, overdue follow-ups, and making sure no prospect falls through the cracks. Demo user: `demo-manager`.
- **Alex Rivera** — Adviser. Spends mornings on the phone following up with prospects, afternoons in appointments. Needs a "what do I do next?" list and quick capture between meetings. Demo user: `demo-sales`.

### Tenants in scope

| Tenant | Profile | Demo flavour |
|---|---|---|
| **Mallard Mortgages** (Sheffield) | FTB-heavy, MAB network, 4 staff | First-time buyers, deposit savers |
| **Friends Capital** | High-end advisory | BTL, equity release, high-net-worth |
| **Acme Mortgages** | Generic placeholder | Balanced mix — used for cold demos |

A user belongs to exactly one tenant. Cross-tenant access requires a separate login. There is no "switch workspace" today.

---

## 2. Product

### What Sequence is

**Sequence** is a multi-tenant SaaS bolt-on nurture layer for UK mortgage advisers, hosted at `sequence-ai.com`. It is **not** a CRM replacement.

**The problem:** Prospects who enquire but aren't transaction-ready (first-time buyers saving a deposit, self-employed clients building accounts history, remortgages months out) fall through the cracks. Advisers note "call again in January" but there's no structured process to make that follow-up happen.

**Guiding principle:** *Sequence works with existing workflows without disrupting them.* When a firm has Brevo, we pull contacts from Brevo. When they don't, we ingest CSV exports from MAB. We never ask a firm to abandon their primary CRM.

### Core features

- **Pipeline** — Kanban board with drag-drop between stages. First-class "Not Ready Yet" column where most leads currently die. List view on mobile.
- **Cadence engine** — Multi-step automations (Day 0 email, Day 7 SMS, Day 30 reminder) tied to stage changes or triggered manually. See Cadence Engine section below.
- **Activity logging** — Call, email, meeting, note, SMS, WhatsApp. One-click quick-log bar on lead detail; full timeline per prospect.
- **Email/SMS templates** — Variables (`{{firstName}}`, `{{adviser}}`, `{{firmName}}`, `{{nextActionDate}}`). Feed both cadences and ad-hoc sends.
- **Daily digest & reminders** — Cron-driven Resend emails with full prospect context, deep-linking back into the lead.
- **CSV/XLS import** — Auto column-mapping, UK phone normalization (+44/0 handling), duplicate detection by phone+email.
- **Brevo connector** — One-way pull of contacts and email open/click events. See Brevo Principles below.
- **Self-serve onboarding** — Firm details, invite team, connect data source, import contacts, pick starter cadences.
- **Multi-tenant demo** — `/demo` switches between Mallard, Friends Capital, Acme. Fully synthetic data, no real DB queries.
- **Reports & forecasting** — Monthly KPIs, conversion rates, lead source breakdown, team performance, pipeline forecasts.
- **Idle timeout** — 5-minute inactivity modal with countdown, auto-logout for security.

### Cadence engine

Cadences are stored in the `cadences` table and executed by a daily cron (`/api/cron/run-cadences` at 6 AM UTC).

- **Trigger types:** `stage_entered` (auto-enroll when lead enters a stage), `manual` (enroll via modal on lead detail), `lead_created` (auto-enroll on new lead).
- **Step channels:** `email` (Resend send + activity log), `sms` (Brevo SMS if connected, otherwise fallback to task), `task` / `reminder` (write to tasks table with assigned adviser).
- **Enrollment lifecycle:** `active` -> steps execute on schedule -> `completed` when all steps done. Can be `paused` or `unsubscribed`.
- **Three seeded cadences** per new tenant: "FTB nurture (deposit-saving)", "Remortgage 6-month warm-up", "Cold prospect re-engagement".
- **Feature-flagged:** Behind `NEXT_PUBLIC_ENABLE_CADENCES_TEMPLATES=true`.

### Brevo principles

- **One-way pull only.** Read from Brevo into Sequence. Never push contacts to Brevo. Brevo is **never** the email send engine.
- **API key encrypted at rest.** Stored in `integrations` table via `BREVO_ENCRYPTION_KEY`.
- **Sync cron:** `/api/cron/sync-brevo` every 6 hours.
- **Webhook receiver:** `/api/integrations/brevo/webhook` writes email opens/clicks into the activity timeline.
- If a tenant doesn't have Brevo, the integration card shows "Not connected". CSV import covers ingestion.

### Demo mode

- `/demo` shows a tenant switcher: Mallard, Friends Capital, Acme.
- Click sets `localStorage.sequence_demo_tenant` and routes to dashboard.
- `getDemoTenant()` dispatches to `src/lib/mock-data/{tenant}.ts` — all hooks check this first and return mock data, skipping real Supabase queries.
- "Demo mode" banner always visible; switcher is one click away.

---

## 3. Code Architecture

### Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript, React 19 |
| Database | Supabase (Postgres) — multi-tenant with RLS, region `eu-west-2` (London) |
| Auth | Supabase Auth + `app_metadata` claims (`role`, `tenant_id`) |
| Email | Resend (always — never replace, never split) |
| Contact source | Brevo (one-way pull) or CSV/XLS import |
| Hosting | Vercel, region `lhr1` (London), cron jobs in `vercel.json` |
| Styling | Tailwind v4 (no shadcn/ui, custom components in `src/components/ui/`) |
| Validation | Zod (shared client/server schemas in `src/schemas/`) |
| Drag & drop | `@hello-pangea/dnd` |
| Import | SheetJS (`xlsx`) |
| Analytics | `@vercel/analytics` |
| Icons | `lucide-react` |

### Domain map

| Host | Purpose | Route group |
|---|---|---|
| `www.sequence-ai.com` | Marketing landing page | `src/app/(marketing)/` |
| `app.sequence-ai.com` | Authenticated app (default) | `src/app/(app)/`, `(auth)/`, `(onboarding)/`, `demo/` |
| `{firm}.sequence-ai.com` | Tenant vanity subdomain — same as `app.*` but tenant pre-resolved | Same as above |

`src/middleware.ts` resolves the host header: parses subdomain -> sets `x-sequence-tenant-slug` header. Marketing routes are blocked on app/vanity hosts; app routes are blocked on `www`. Public paths (`/login`, `/signup`, `/demo`, `/onboarding`, `/api/*`, `/auth/*`) bypass auth checks.

### Directory structure

```
src/
  app/
    (app)/          # Authenticated routes: dashboard, pipeline, leads, cadences,
                    # templates, team, reports, settings, integrations, import, capture
    (auth)/         # login, signup, forgot-password, reset-password, accept-invite
    (marketing)/    # Landing page (www.sequence-ai.com)
    (onboarding)/   # Firm setup wizard (details, invite, connect, import, cadences)
    api/            # API routes (see API Routes below)
    auth/           # OAuth callback + email confirmation handlers
    demo/           # Multi-tenant demo switcher
    layout.tsx      # Root layout (Providers, Analytics, metadata)
    globals.css     # Tailwind v4 theme tokens
  components/
    ui/             # button, input, modal, toast, confirm-dialog
    auth/           # oauth-buttons
    leads/          # assign-lead-modal, enroll-cadence-modal, log-activity-modal,
                    # quick-log-bar, editable-field
    cadences/       # cadence-builder
    tenant/         # tenant-provider, tenant-switcher, tenant-logo
    onboarding/     # progress-bar
  hooks/            # useAuth, useTenant, useLeads, useCadences, useTemplates,
                    # useTasks, useWeeklyActivitySummary, useSupabase
  lib/
    supabase/       # client.ts (browser), server.ts (service role), middleware.ts,
                    # mappers.ts (snake_case <-> camelCase)
    auth/           # verify-token.ts (Bearer token middleware with role checks)
    cadences/       # triggers.ts, seeds.ts, run.ts, seed-tenant.ts
    email/          # client.ts (14 Resend email functions), render.ts (template vars)
    import/         # parser.ts (CSV/XLS), dedup.ts (phone+email dedup)
    integrations/   # brevo.ts, encryption.ts
    mock-data/      # index.ts (dispatcher), mallard.ts, friends-capital.ts, acme.ts
    analytics/      # compute.ts (snapshot metrics)
    onboarding/     # state.ts (localStorage-backed wizard state)
    tenant.ts       # parseSubdomain()
    feature-flags.ts
    stage-timing.ts # RAG status (red/amber/green) from days-in-stage
    utils.ts        # cn(), formatPhone(), formatDate(), formatCurrency(), slugify()
  schemas/          # Zod: lead, cadence, activity, task, template, integration, tenant
  types/
    index.ts        # Lead, Activity, Task, User, Tenant, Cadence, CadenceEnrollment,
                    # Template, Integration, PipelineStage, LeadStageHistory, etc.
supabase/
  migrations/       # 11 SQL files: schema, RLS, seed, qualifications, stage tracking,
                    # forecast accuracy, analytics, cadence advancement
```

### Database (Supabase Postgres)

**Tables:** `tenants`, `users`, `pipeline_stages`, `lead_sources`, `leads`, `activities`, `tasks`, `templates`, `cadences`, `cadence_enrollments`, `integrations`, `notifications`, `import_records`

**Key enums:** `user_role` (admin, manager, advisor), `mortgage_type` (first-time-buyer, purchase, remortgage, self-employed, buy-to-let, other), `readiness` (ready-now, 1-3-months, 3-6-months, 6-12-months, exploring), `lead_status` (active, on-hold, lost, converted), `activity_type` (call, email, meeting, note, sms, whatsapp, stage-change), `cadence_trigger_type` (stage_entered, manual, lead_created), `cadence_channel` (email, sms, task, reminder), `enrollment_status` (active, paused, completed, unsubscribed)

**RLS enforcement:** Every table has RLS enabled. Two helper functions drive all policies:
- `public.tenant_id()` — extracts `tenant_id` from JWT `app_metadata`
- `public.is_manager()` — checks role is `manager` or `admin`

**Policy pattern:** All tenant-scoped tables enforce `tenant_id = public.tenant_id()`. Manager-only writes on: `pipeline_stages`, `lead_sources`, `templates`, `cadences`, `integrations`. Demo tenants (`is_demo = true`) are readable by the `anon` role.

**Migrations** live in `supabase/migrations/` (00001-00011). When adding a new table, add the migration + RLS policies in the same PR.

### Tenant isolation — non-negotiable rules

1. **Every query is tenant-scoped.** All tables except `tenants` itself have a `tenant_id` FK. Never write a query that crosses tenants.
2. **JWT claim `tenant_id` is the source of truth on the server.** API routes use `verifyToken()` from `src/lib/auth/verify-token.ts` which extracts `tenant_id` from `app_metadata`.
3. **RLS enforces `tenant_id = public.tenant_id()` on every table.** Add RLS policies for any new table in the same PR as the migration.
4. **A user belongs to exactly one tenant.** No workspace switching.
5. **Vanity subdomain -> tenantId** resolved via subdomain lookup, not from the URL alone.

### API routes

**Auth:** `/api/auth/signup`, `/api/auth/forgot-password`, `/api/auth/callback` (OAuth), `/api/auth/confirm` (email verification)

**Core CRUD:** `/api/leads`, `/api/activities`, `/api/tasks`, `/api/team`, `/api/settings`, `/api/notifications/*`, `/api/cadences` (+ `/[id]`, `/[id]/toggle`, `/enroll`), `/api/templates` (+ `/[id]`), `/api/import`, `/api/reports`

**Integrations:** `/api/integrations/brevo/connect`, `/api/integrations/brevo/webhook`

**Cron jobs** (defined in `vercel.json`, region `lhr1`):

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/run-cadences` | `0 6 * * *` (daily 6 AM UTC) | Execute enrolled cadence steps |
| `/api/cron/sync-brevo` | `0 */6 * * *` (every 6h) | Pull contacts from Brevo |
| `/api/cron/daily-digest` | `0 6 * * 1-5` (weekdays 6 AM) | Email digest to advisers |
| `/api/cron/daily-digest` | `0 6 * * *` (daily 6 AM) | Email digest (weekend catch-up) |
| `/api/cron/snapshot-analytics?period=current` | `0 3 * * *` (daily 3 AM) | Snapshot current month metrics |
| `/api/cron/snapshot-analytics?period=previous` | `0 2 1 * *` (1st of month, 2 AM) | Finalize previous month |

All cron routes validate `Authorization: Bearer $CRON_SECRET`.

**Onboarding:** `/api/onboarding/provision`

**Dev:** `/api/dev/seed-demo`

### Auth flow

1. **Email/password:** Supabase Auth creates user -> `app_metadata` gets `{ role, tenant_id }` -> JWT carries claims.
2. **OAuth:** Google/Microsoft via Supabase -> callback at `/api/auth/callback` -> welcome email via Resend -> redirect to onboarding or dashboard.
3. **Team invite:** Manager creates invite at `/api/team` -> sends email with temp password via Resend -> invitee logs in and lands in the tenant.
4. **Token refresh:** `useAuth` hook detects stale JWT and calls `supabase.auth.refreshSession()`.

### Email system

Resend is the **only** send engine. 14 branded email functions in `src/lib/email/client.ts`, all using a shared HTML template (teal header, 600px centered layout, CTA button, footer). Key functions: `sendReminderEmail`, `sendCadenceEmail`, `sendDailyDigestEmail`, `sendTeamInviteEmail`, `sendLeadCreatedEmail`, `sendStageChangeEmail`, `sendImportSummaryEmail`.

Template variables rendered via `src/lib/email/render.ts`: `{{firstName}}`, `{{adviser}}`, `{{firmName}}`, `{{nextActionDate}}`.

From address: `Sequence <reminders@sequence-ai.com>`. Override via `EMAIL_FROM` env var for dev.

### Environment variables

See `.env.local.example` for the full shape. Key groups:
- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Resend:** `RESEND_API_KEY`, `EMAIL_FROM` (optional override)
- **Cron:** `CRON_SECRET`
- **Brevo:** `BREVO_ENCRYPTION_KEY` (optional)
- **Domains:** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_MARKETING_DOMAIN`
- **Feature flags:** `NEXT_PUBLIC_ENABLE_CADENCES_TEMPLATES`
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (reserved, mock checkout for now)

### Hooks pattern

All data-fetching hooks (`useLeads`, `useCadences`, `useTemplates`, `useTasks`, etc.) check `isDemoUser(user.id)` first. If true, they return mock data from `src/lib/mock-data/` and skip Supabase queries entirely.

### Adding a new entity — checklist

1. Type definition in `src/types/index.ts`
2. Zod schema in `src/schemas/`
3. SQL migration in `supabase/migrations/` with RLS policies
4. Hook in `src/hooks/` (with demo mode check)
5. API route in `src/app/api/`
6. Component(s) as needed

---

## 4. User Experience

### Laptop-first design

Owners and advisers work at a desk. Primary breakpoint is **>=1280px**. The pipeline kanban, multi-column forms, manager dashboard, leads table, lead-detail tabs, cadence builder, and templates editor are all designed for laptop screens first.

**Mobile is secondary.** It covers what's useful between appointments:
- **Quick Capture** — fast lead intake with minimal fields
- **My Day** — today's follow-up list with tap-to-call
- **Pipeline list view** — compact card list (kanban falls back to list)
- **Bottom tab bar** — 5 primary nav items + FAB for Quick Capture

When adding a feature, design the laptop view first. Add a mobile variant only if the feature has a real "between appointments" use case.

### Theme (Tailwind v4)

Defined in `src/app/globals.css` via `@theme`:

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#1A5653` | Teal — buttons, links, active states |
| `--color-primary-light` | `#2A7A76` | Hover states |
| `--color-primary-dark` | `#0F3B39` | Pressed states |
| `--color-sidebar` | `#0F2E2D` | Dark sidebar background |
| `--color-accent` | `#F59E0B` | Amber — warnings, highlights |
| `--color-destructive` | `#DC2626` | Red — errors, delete actions |
| `--color-success` | `#22C55E` | Green — completed, converted |
| `--color-card` | `#F9FAFB` | Light card backgrounds |
| `--font-sans` | Inter | Primary font family |
| `--radius-card` | `12px` | Card border radius |
| `--radius-button` | `8px` | Button border radius |

### Component library

Custom UI components in `src/components/ui/` — **no shadcn/ui**, no external component library. Components: `button`, `input`, `modal`, `toast`, `confirm-dialog`. All use `class-variance-authority` for variants and `tailwind-merge` via the `cn()` utility.

### Branding

- Default logo: `public/sequence-logo.svg`, `public/sequence-mark.svg`
- Per-tenant override: `tenants` table holds `primary_color` and `logo_url`. Sidebar, login page, and email header use the tenant logo on vanity subdomains.
- Email from: `Sequence <reminders@sequence-ai.com>`. Per-tenant white-label from addresses are deferred.

---

## 5. Development & Deployment

### Common commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # Production build — must pass before any merge
npm run lint         # ESLint
npx tsc --noEmit     # Type check — run before committing
```

### Local subdomain testing

Add to `/etc/hosts`:
```
127.0.0.1 mallard.localhost
127.0.0.1 friendscapital.localhost
127.0.0.1 acme.localhost
```

### Cron simulation

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/run-cadences
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-brevo
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-digest
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/snapshot-analytics?period=current"
```

### Vercel project

- **Branch:** `brasilia` is the target branch for all PRs. Create PRs with `--base brasilia`.
- **Region:** `lhr1` (London) — UK data residency requirement.
- **Live site:** `sequence-ai.com` (marketing: `www`, app: `app`, vanity: `{firm}`)
- **Preview deployments:** Every PR gets a Vercel preview URL automatically.

### PR checklist

Before merging any PR:

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] New tables have RLS policies (migration + policy in same PR)
- [ ] All queries are tenant-scoped (`tenant_id` filter present)
- [ ] Demo mode works if touching hooks or data-fetching code
- [ ] No `.env.local` or secrets committed — use `.env.local.example` for shape only

### Things to never do

- Never query Supabase without a `tenant_id` scope.
- Never replace Resend with another email send engine.
- Never push data to Brevo. Read only.
- Never store unencrypted third-party API keys in the database.
- Never check in `.env.local`. Use `.env.local.example` for shape only.
- Never commit `pencil-welcome-desktop.pen` or other large design binaries unless asked.
- Never assume a single tenant. Even local-dev paths must respect the tenant model.
- Never skip RLS policies when adding a new table.

### Out of scope (scaffolding only)

These exist as empty pages or stubs but are not implemented: backbook monitoring, affordability fact-find, document upload portal, calendar sync (Outlook/Google), AI lead summary, referral management, FCA compliance audit-trail export, deep MI/reporting. If a customer asks during demo: "on the roadmap, contact us."

### Design reference

UI mockups for Mallard's screens live in `pencil-welcome-desktop.pen` (Pencil/Lunaris design system). These are reference-only — Sequence's visual design generalizes Mallard's screens to fit any firm.

---

## 6. Changelog

> **Living document rule:** When a PR is merged that introduces a notable feature, fix, or improvement, add a one-line entry below with the date, PR number, and summary. Skip trivial changes (typos, formatting, dependency bumps, minor refactors). This keeps the CLAUDE.md current with the product's evolution.
>
> Format: `- YYYY-MM-DD — PR #N: summary`

- 2026-06-14 — PR #67: Editable follow-up date on lead detail page with inline date picker
- 2026-06-14 — PR #66: Idle timeout modal that logs out after 5 minutes of inactivity
- 2026-06-13 — PR #65: Email confirmation sent to managers when a lead is saved with follow-up details
- 2026-06-12 — PR #58: Fix Resend email delivery and React hooks crash on team member page
- 2026-06-12 — PR #57: Rename pipeline stage "Referred to MAB" to "Deal Done"
- 2026-06-11 — PR #56: Fix CSV/XLSX import: response shape, snake_case keys, dedup, Full Name field
- 2026-06-11 — PR #54: Fix /api/reports security hole, centralize auth, add email flows, UX quick wins
