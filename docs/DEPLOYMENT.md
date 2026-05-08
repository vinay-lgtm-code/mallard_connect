# Deployment — Sequence

Last updated for the Mallard Connect → Sequence rebrand. Run each section in order. Sections marked **owner** must be done by the user — Claude has no access to DNS, Vercel project settings, or Resend domain verification.

## 1. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production + Preview).

```
# Firebase Client SDK (browser)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin (server)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...   # multiline OK; the app strips \n on read

# Resend (always the email send engine)
RESEND_API_KEY=...

# Vercel Cron Bearer token
CRON_SECRET=...            # generate with `openssl rand -hex 32`

# Brevo (optional — only firms that connect)
BREVO_ENCRYPTION_KEY=...   # generate with `openssl rand -hex 32`

# Stripe (reserved — mock checkout for now, leave blank)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Domain map
NEXT_PUBLIC_APP_URL=https://app.sequence-ai.com
NEXT_PUBLIC_APP_DOMAIN=app.sequence-ai.com
NEXT_PUBLIC_MARKETING_DOMAIN=www.sequence-ai.com
```

## 2. DNS migration — Namecheap → Vercel **(owner)**

The `sequence-ai.com` domain currently uses Namecheap nameservers. Two options:

### Option A — Move nameservers to Vercel (simplest)

1. In **Namecheap → Domain List → sequence-ai.com → Nameservers**, set Custom DNS to:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```
2. In **Vercel → Domains**, add `sequence-ai.com`. Vercel auto-creates apex + www records.
3. Add wildcard:
   ```
   Type: CNAME
   Name: *
   Value: cname.vercel-dns.com
   ```
4. Wait for propagation (usually < 1 hour, can be up to 48).

### Option B — Keep Namecheap DNS, add records manually

In **Namecheap → Advanced DNS** for `sequence-ai.com`:

| Type  | Host | Value                   | TTL       |
|-------|------|-------------------------|-----------|
| A     | @    | 76.76.21.21             | Automatic |
| CNAME | www  | cname.vercel-dns.com    | Automatic |
| CNAME | app  | cname.vercel-dns.com    | Automatic |
| CNAME | \*   | cname.vercel-dns.com    | Automatic |

The wildcard CNAME enables `{firm}.sequence-ai.com` for each tenant without manual DNS work.

## 3. Vercel project domains **(owner)**

In **Vercel → Project → Settings → Domains** add:
- `www.sequence-ai.com` (mark as primary)
- `app.sequence-ai.com`
- `sequence-ai.com` → redirect to `www.sequence-ai.com`
- `*.sequence-ai.com` (wildcard for vanity tenants)

Optionally pre-add specific vanities you want to demo:
- `mallard.sequence-ai.com`
- `friendscapital.sequence-ai.com`
- `acme.sequence-ai.com`

## 4. Resend sender domain **(owner)**

Sequence sends from `*@sequence-ai.com`. Verify the domain in Resend:

1. **Resend → Domains → Add domain → sequence-ai.com**.
2. Add the SPF, DKIM, and DMARC records Resend gives you to your DNS (Vercel or Namecheap, whichever holds the zone).
3. Wait for verification.
4. Senders used by the app:
   - `Sequence <reminders@sequence-ai.com>` — daily cron + cadence emails (`src/lib/email/client.ts:28`).
   - `Sequence <no-reply@sequence-ai.com>` — team invites (`src/app/api/team/route.ts:112`).

If verification stalls, sends will silently fail — check Resend dashboard for delivery errors.

## 5. Firebase project setup **(owner)**

If migrating from the old Mallard project:

1. Create new Firebase project for Sequence (or rename existing).
2. **Firestore → Rules** — paste contents of [`firestore.rules`](../firestore.rules). The rules enforce per-tenant isolation; deploying these is mandatory before public launch.
3. **Authentication → Sign-in methods** — enable Email/Password (the only one we use).
4. **Service accounts** — generate a new admin key, paste private key into `FIREBASE_PRIVATE_KEY` env var.

## 6. Cron jobs

Already declared in [`vercel.json`](../vercel.json):

| Path                     | Schedule       | Purpose                          |
|--------------------------|----------------|----------------------------------|
| `/api/cron/run-cadences` | `0 7 * * *`    | Daily 7am UK reminder + cadence step runner |
| `/api/cron/sync-brevo`   | `0 */6 * * *`  | Pull Brevo contacts/events for connected tenants |

Both endpoints check `Authorization: Bearer ${CRON_SECRET}`. Vercel automatically attaches this if `CRON_SECRET` is set as an env var.

To smoke test after deploy:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://app.sequence-ai.com/api/cron/run-cadences
```

## 7. Smoke tests after deploy

| Surface                            | Expected                                                  |
|------------------------------------|-----------------------------------------------------------|
| `https://www.sequence-ai.com`      | Marketing landing — Sequence branding, hero, pricing      |
| `https://www.sequence-ai.com/pricing` | Pricing page — £50 base tier, Growth tier card         |
| `https://www.sequence-ai.com/checkout` | Mock Stripe checkout, "Start free trial" button       |
| `https://app.sequence-ai.com/demo` | Three-tenant demo switcher (Mallard / Friends Capital / Acme) |
| `https://app.sequence-ai.com/login` | Sequence login page with two demo personas              |
| `https://mallard.sequence-ai.com/dashboard` | Lands on the demo dashboard with Mallard data    |
| `https://app.sequence-ai.com/onboarding` | 5-step wizard, progress bar visible                |
| `https://app.sequence-ai.com/cadences` | Three seeded cadences in a table                      |
| Cron simulation (above)            | `{"sent":0,"errors":0}` or similar success response       |
| Send a test follow-up reminder     | Email lands in inbox from `reminders@sequence-ai.com`     |

## 8. Old domain transition

Once `app.sequence-ai.com` is live and verified:

1. In Vercel, leave the old `mallard-connect.vercel.app` deployment alive but redirect to `https://app.sequence-ai.com`.
2. Update any third-party references (Resend webhook URL, Firebase OAuth allowed origins, etc.) to point at the new domain.
3. Announce the URL change to existing Mallard users with a one-line note in the next reminder email.

## Common issues

- **Vanity subdomain redirects to login** — middleware requires the user's session-cookie `tenantId` claim to match the host's tenant. Re-run `/api/onboarding/provision` to set the claim, or have the user sign out + sign in.
- **Brevo connection silently fails** — check `BREVO_ENCRYPTION_KEY` is set; without it the connector won't store the API key.
- **Cron returns 401** — `CRON_SECRET` mismatch between Vercel cron headers and env var. Regenerate and redeploy.
- **Email from address fails** — Resend domain not verified yet, or DNS records still propagating. Check Resend dashboard.
