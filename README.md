# Sequence

> Lead nurturing and follow-up for UK mortgage advisers. Bolts on to whatever you already use — MAB Platform, FLG, Dashly, Intelligent Office — without replacing it.

`www.sequence-ai.com` (marketing) · `app.sequence-ai.com` (app) · vanity subdomains per firm (e.g. `mallard.sequence-ai.com`, `friendscapital.sequence-ai.com`)

## The problem we solve

Prospects who enquire but aren't transaction-ready — first-time buyers still saving a deposit, self-employed clients building accounts history, remortgages months out — fall through the cracks. Advisers note "contact again in January", but there's no structured process to make sure the follow-up happens. A standalone CRM is overkill (and expensive) for firms whose primary system is fine for in-flight cases. They just need the nurture layer.

Sequence is that layer. It plugs into existing data sources, runs cadences automatically, and gives the owner at-a-glance visibility on where every prospect sits and what the next action is.

## What's inside

- **Pipeline (Kanban + list)** with a first-class "Not Ready Yet" stage — the column where most leads currently die.
- **Cadences** — multi-step automations (Day 0 email, Day 7 SMS, Day 30 reminder) tied to stage changes or triggered manually. Three starter cadences seeded per firm: FTB deposit-saving, remortgage warm-up, cold re-engagement.
- **Activity logging** — call, email, meeting, note, SMS, WhatsApp. One-click quick-log on the lead page; full timeline on every prospect.
- **Email/SMS templates** with variables. Templates feed both cadences and ad-hoc activity logging.
- **Daily reminder cron** — Resend emails to up to 3 recipients with full prospect context, deep-linking back into the lead.
- **MAB CSV/XLS import** with auto column-mapping and duplicate detection.
- **Brevo connector** *(opportunistic)* — one-way pull of contacts and email open/click events into the activity timeline. Resend stays as the send engine.
- **Self-serve onboarding** — firm details → invite team → connect data source → import → pick starter cadences.
- **Multi-tenant demo** — `app.sequence-ai.com/demo` switches between Mallard, Friends Capital, and Acme so prospects can feel the product.

**Optimised for laptop-first usage.** Owners and advisers do most of their work at a desk: pipeline kanban, multi-column lead forms, manager dashboards, and table views are designed for ≥1280px. Mobile is secondary — kept for what it's actually good at: quick lead capture between appointments and tap-to-call from a "today" follow-up list.

## Pricing

£50 / month for 5 users. £8 / month per additional user. All features included. 14-day free trial. See `/pricing`.

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript), React 19 |
| Database | Firebase Firestore — multi-tenant under `tenants/{tid}/...` |
| Auth | Firebase Auth + custom claims (`role`, `tenantId`) |
| Email | Resend (always — Brevo is read-only) |
| Cron | Vercel Cron — `run-cadences` daily 7am UK, `sync-brevo` every 6h |
| Hosting | Vercel; wildcard subdomain routing via `src/middleware.ts` |
| Styling | Tailwind v4 |
| Validation | Zod (shared client/server) |
| Real-time | Firestore `onSnapshot` |
| Import | SheetJS (`xlsx`) |
| Drag and drop | `@hello-pangea/dnd` |

See [`CLAUDE.md`](./CLAUDE.md) for the codebase contract — tenant rules, cadence engine, Brevo principles, branding rules, and conventions.

## Local development

```bash
cp .env.local.example .env.local      # fill in Firebase + Resend + (optional) Brevo keys
npm install
npm run dev
```

Visit:
- `http://localhost:3000` — marketing landing.
- `http://localhost:3000/demo` — multi-tenant demo switcher.
- `http://localhost:3000/onboarding` — onboarding wizard.

For local vanity-subdomain testing, add to `/etc/hosts`:
```
127.0.0.1 mallard.localhost
127.0.0.1 friendscapital.localhost
127.0.0.1 acme.localhost
```

## System architecture

```mermaid
graph TB
    subgraph Web["Web (multiple hosts)"]
        Marketing["www.sequence-ai.com<br/><small>Marketing + pricing + checkout</small>"]
        App["app.sequence-ai.com<br/><small>Authed app + onboarding + demo</small>"]
        Vanity["{firm}.sequence-ai.com<br/><small>Tenant-pinned via subdomain map</small>"]
    end

    subgraph Middleware["src/middleware.ts"]
        Resolver["Host → tenantId resolver<br/><small>subdomains/{slug} lookup<br/>+ cookie tenant guard</small>"]
    end

    subgraph NextAPI["Next.js API (Vercel)"]
        CronCadences["/api/cron/run-cadences<br/><small>Daily 7am UK</small>"]
        CronBrevo["/api/cron/sync-brevo<br/><small>Every 6h</small>"]
        Provision["/api/onboarding/provision<br/><small>Tenant + claim setup</small>"]
        ImportAPI["/api/import<br/><small>CSV/XLS upload + dedup</small>"]
        BrevoConnect["/api/integrations/brevo/connect<br/><small>API-key validate</small>"]
        BrevoWebhook["/api/integrations/brevo/webhook<br/><small>Open/click events</small>"]
    end

    subgraph Firebase["Firebase (GCP)"]
        FireAuth["Firebase Auth<br/><small>Custom claims:<br/>role, tenantId</small>"]
        Firestore["Cloud Firestore<br/><small>tenants/{tid}/<br/>leads · cadences · enrollments<br/>templates · integrations · imports</small>"]
    end

    subgraph External["External Services"]
        Resend["Resend<br/><small>All outbound email</small>"]
        Brevo["Brevo<br/><small>Optional: contact pull only</small>"]
        VercelCron["Vercel Cron"]
        MAB["MAB Platform / other CRM<br/><small>Weekly CSV/XLS export</small>"]
    end

    Marketing --> App
    App --> Vanity
    Web --> Resolver
    Resolver -- "tenantId" --> NextAPI
    Resolver -- "tenantId" --> Firestore

    VercelCron --> CronCadences
    VercelCron --> CronBrevo
    CronCadences --> Firestore
    CronCadences --> Resend
    CronBrevo --> Brevo
    CronBrevo --> Firestore

    Provision --> FireAuth
    Provision --> Firestore
    BrevoConnect --> Firestore
    BrevoWebhook --> Firestore
    ImportAPI --> Firestore

    MAB -. "Manual export" .-> ImportAPI

    classDef web fill:#EFF6FF,stroke:#3B82F6,color:#1E3A5F
    classDef api fill:#F0FDF4,stroke:#22C55E,color:#14532D
    classDef firebase fill:#FEF3C7,stroke:#F59E0B,color:#78350F
    classDef external fill:#F5F3FF,stroke:#7C3AED,color:#4C1D95
    classDef middleware fill:#FFE4E6,stroke:#E11D48,color:#881337

    class Marketing,App,Vanity web
    class CronCadences,CronBrevo,Provision,ImportAPI,BrevoConnect,BrevoWebhook api
    class FireAuth,Firestore firebase
    class Resend,Brevo,VercelCron,MAB external
    class Resolver middleware
```

## Cadence run flow

```mermaid
sequenceDiagram
    participant Lead as Lead enters stage
    participant Pipeline as Pipeline UI
    participant FS as Firestore
    participant Cron as Vercel Cron (7am)
    participant Run as run-cadences
    participant Resend as Resend

    Lead->>Pipeline: Stage change → "Not Ready Yet"
    Pipeline->>FS: Find cadences with trigger.stageId match
    FS-->>Pipeline: [FTB nurture cadence]
    Pipeline->>FS: Create cadenceEnrollment {currentStep:0, nextRunAt: now}

    Cron->>Run: GET /api/cron/run-cadences
    Run->>FS: Query enrollments where nextRunAt ≤ now
    FS-->>Run: [enrollment_1, ...]
    loop Each due enrollment
        Run->>FS: Read cadence.steps[currentStep]
        alt channel = email
            Run->>Resend: Send rendered template
        else channel = task / reminder
            Run->>FS: Create task for adviser
        end
        Run->>FS: Append activity row
        Run->>FS: Advance currentStep, recompute nextRunAt
    end
```

## Tenant data model

```mermaid
erDiagram
    TENANT ||--o{ USER : "has"
    TENANT ||--o{ LEAD : "owns"
    TENANT ||--o{ CADENCE : "owns"
    TENANT ||--o{ TEMPLATE : "owns"
    TENANT ||--o{ INTEGRATION : "configured"
    LEAD ||--o{ ACTIVITY : "timeline"
    LEAD ||--o{ TASK : "scheduled"
    LEAD ||--o{ ENROLLMENT : "enrolled in"
    CADENCE ||--o{ ENROLLMENT : "drives"
    CADENCE ||--o{ STEP : "ordered"
    STEP }o--|| TEMPLATE : "uses"

    TENANT {
        string id PK
        string name
        string slug "vanity subdomain"
        string primaryColor
        string logoUrl
        string plan
        int seatLimit
    }

    USER {
        string id PK
        string tenantId FK
        enum role "admin | manager | advisor"
    }

    LEAD {
        string id PK
        string tenantId FK
        enum status "active | on-hold | lost | converted"
        string currentStageId
        string assignedTo FK
    }

    CADENCE {
        string id PK
        string tenantId FK
        json trigger "stage_entered | manual | lead_created"
        bool isActive
    }

    STEP {
        int delayDays
        enum channel "email | sms | task | reminder"
        string templateId FK
    }

    ENROLLMENT {
        string leadId FK
        string cadenceId FK
        int currentStep
        timestamp nextRunAt
        enum status "active | paused | completed | unsubscribed"
    }

    TEMPLATE {
        string id PK
        string tenantId FK
        enum channel "email | sms"
        string body "with {{variables}}"
    }

    INTEGRATION {
        string provider "brevo | mab | other"
        string apiKey "encrypted at rest"
        timestamp lastSyncAt
    }
```

## UK mortgage industry notes

- UK terminology: deposit (not down payment), remortgage (not refinance), adviser (not agent).
- Self-employment: years trading, SA302, accountant details — prominent in the qualification view.
- Credit profile: factual non-judgemental language for CCJs, defaults, IVAs.
- Long nurture cycles are normal — 6–12 month follow-ups, plus annual remortgage warm-ups, are first-class.
- FCA: 6-year retention, GDPR/UK DPA 2018, soft delete + hard purge.

## Reference: Mallard case study

Mallard Mortgages (Sheffield) is the founding tenant. UI mockups for their specific screens live in `pencil-welcome-desktop.pen` (Pencil/Lunaris design system). The screen map below is reference only — Sequence's actual visual design generalises these screens for any firm.

| # | Screen | Node ID | Persona | Layout |
|---|--------|---------|---------|--------|
| 1 | Manager Dashboard | `00PCT` | Della (owner) | Desktop |
| 2 | My Day | `xLorR` | Adviser | Desktop |
| 3 | Pipeline Kanban | `yuS5D` | Della | Desktop |
| 4 | My Day | `S14Wd` | Adviser | Mobile |
| 5 | New Lead Form | `oluoT` | Adviser | Desktop |
| 6 | Quick Capture | `gJmkX` | Adviser (field) | Mobile |
| 7 | Prospect Detail | `CHnFT` | Adviser | Desktop |
| 8 | Pipeline List | `xNuto` | Adviser (field) | Mobile |
| 9 | MAB Import | `oaR0H` | Della | Desktop |
| 10 | Manager Dashboard | `bO6Pj` | Della | Mobile |

---

Built by Storyboard Digital / Legacy Labs.
