import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getFirestoreAdmin } from "@/lib/firebase/admin";
import * as mallard from "@/lib/mock-data/mallard";
import * as friendsCapital from "@/lib/mock-data/friends-capital";
import * as acme from "@/lib/mock-data/acme";

/**
 * One-shot demo seeder. Writes per-tenant fixtures into demoTenants/{slug}/...
 * via the Admin SDK (bypasses Firestore rules).
 *
 * Local development:
 *   curl -X POST http://localhost:3000/api/dev/seed-demo
 *
 * Production: blocked unless `Authorization: Bearer ${CRON_SECRET}` matches.
 */

const SEEDS = {
  mallard,
  "friends-capital": friendsCapital,
  acme,
} as const;

type Slug = keyof typeof SEEDS;

const SEED_VERSION = 1;

function toTs(value: unknown): Timestamp | null {
  if (value instanceof Date) return Timestamp.fromMillis(value.getTime());
  if (value && typeof value === "object" && "_seconds" in value) {
    const v = value as { _seconds: number; _nanoseconds?: number };
    return new Timestamp(v._seconds, v._nanoseconds ?? 0);
  }
  return null;
}

async function seedTenant(slug: Slug, force: boolean) {
  const db = getFirestoreAdmin();
  const data = SEEDS[slug];
  const root = db.collection("demoTenants").doc(slug);
  const metaRef = root.collection("_meta").doc("info");

  const existing = await metaRef.get();
  if (existing.exists && existing.data()?.version === SEED_VERSION && !force) {
    return { slug, skipped: true, reason: "already-seeded" };
  }

  const batch = db.batch();
  const counts = {
    users: 0,
    leads: 0,
    activities: 0,
    tasks: 0,
    cadences: 0,
    templates: 0,
    enrollments: 0,
  };

  for (const u of data.users) {
    batch.set(root.collection("users").doc(u.id), {
      ...u,
      createdAt: toTs(u.createdAt) ?? Timestamp.now(),
    });
    counts.users++;
  }

  for (const lead of data.leads) {
    batch.set(root.collection("leads").doc(lead.id), {
      ...lead,
      tenantId: slug,
      createdAt: toTs(lead.createdAt) ?? Timestamp.now(),
      updatedAt: toTs(lead.updatedAt) ?? Timestamp.now(),
      nextFollowUpDate: toTs(lead.nextFollowUpDate),
      convertedAt: toTs(lead.convertedAt),
      lostAt: toTs(lead.lostAt),
    });
    counts.leads++;
  }

  for (const a of data.activities) {
    batch.set(
      root.collection("leads").doc(a.leadId).collection("activities").doc(a.id),
      {
        ...a,
        tenantId: slug,
        createdAt: toTs(a.createdAt) ?? Timestamp.now(),
      }
    );
    counts.activities++;
  }

  for (const t of data.tasks) {
    batch.set(root.collection("tasks").doc(t.id), {
      ...t,
      tenantId: slug,
      createdAt: toTs(t.createdAt) ?? Timestamp.now(),
      dueDate: toTs(t.dueDate),
    });
    counts.tasks++;
  }

  for (const c of data.cadences) {
    batch.set(root.collection("cadences").doc(c.id), {
      ...c,
      tenantId: slug,
      createdAt: toTs(c.createdAt) ?? Timestamp.now(),
      updatedAt: toTs(c.updatedAt) ?? Timestamp.now(),
    });
    counts.cadences++;
  }

  for (const tpl of data.templates) {
    batch.set(root.collection("templates").doc(tpl.id), {
      ...tpl,
      tenantId: slug,
      updatedAt: toTs(tpl.updatedAt) ?? Timestamp.now(),
    });
    counts.templates++;
  }

  for (const e of data.enrollments) {
    batch.set(root.collection("cadenceEnrollments").doc(e.id), {
      ...e,
      tenantId: slug,
      enrolledAt: toTs(e.enrolledAt) ?? Timestamp.now(),
      nextRunAt: toTs(e.nextRunAt),
      completedAt: toTs(e.completedAt),
    });
    counts.enrollments++;
  }

  batch.set(metaRef, {
    seededAt: Timestamp.now(),
    version: SEED_VERSION,
    slug,
    counts,
  });

  await batch.commit();
  return { slug, seeded: true, counts };
}

export async function POST(request: NextRequest) {
  // Production gate: require CRON_SECRET. Locally (NODE_ENV=development), skip.
  if (process.env.NODE_ENV === "production") {
    const auth = request.headers.get("authorization");
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const slugParam = url.searchParams.get("slug") as Slug | null;
  const force = url.searchParams.get("force") === "1";

  try {
    if (slugParam && slugParam in SEEDS) {
      const result = await seedTenant(slugParam, force);
      return NextResponse.json({ ok: true, results: [result] });
    }

    const results = [];
    for (const slug of Object.keys(SEEDS) as Slug[]) {
      results.push(await seedTenant(slug, force));
    }
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("Seed failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "seed failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    usage: "POST /api/dev/seed-demo  (?slug=mallard|friends-capital|acme to seed one; ?force=1 to overwrite)",
    tenants: Object.keys(SEEDS),
  });
}
