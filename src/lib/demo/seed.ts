"use client";

import {
  doc,
  collection,
  getDoc,
  writeBatch,
  Timestamp,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase/client";
import * as mallard from "@/lib/mock-data/mallard";
import * as friendsCapital from "@/lib/mock-data/friends-capital";
import * as acme from "@/lib/mock-data/acme";
import {
  tenantRoot,
  leadsPath,
  activitiesPath,
  tasksPath,
  cadencesPath,
  cadenceEnrollmentsPath,
  templatesPath,
  usersPath,
  seedMetaPath,
} from "@/lib/firebase/paths";

const SEEDS = {
  mallard,
  "friends-capital": friendsCapital,
  acme,
} as const;

export type DemoSlug = keyof typeof SEEDS;

const SEED_VERSION = 1;

function toTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (value instanceof Timestamp) return value;
  return null;
}

/**
 * Seed a demo tenant once. Reads the per-tenant mock-data module and batch-writes
 * users, leads, activities, tasks, cadences, templates, and enrollments under
 * demoTenants/{slug}/...
 *
 * Idempotent: a `_meta/info` doc with `seededAt + version` is created on success.
 * Subsequent calls short-circuit.
 *
 * Returns true if seeding ran, false if already seeded or Firebase unavailable.
 */
export async function seedDemoTenantIfNeeded(slug: DemoSlug): Promise<boolean> {
  if (!isFirebaseConfigured) return false;
  if (!(slug in SEEDS)) return false;

  const metaRef = doc(db, seedMetaPath(slug));
  const existing = await getDoc(metaRef);
  if (existing.exists() && existing.data()?.version === SEED_VERSION) return false;

  const data = SEEDS[slug];
  const batch = writeBatch(db);

  for (const u of data.users) {
    batch.set(doc(db, usersPath(slug, true), u.id), {
      ...u,
      createdAt: toTimestamp(u.createdAt) ?? Timestamp.now(),
    });
  }

  for (const lead of data.leads) {
    batch.set(doc(db, leadsPath(slug, true), lead.id), {
      ...lead,
      tenantId: slug,
      createdAt: toTimestamp(lead.createdAt) ?? Timestamp.now(),
      updatedAt: toTimestamp(lead.updatedAt) ?? Timestamp.now(),
      nextFollowUpDate: toTimestamp(lead.nextFollowUpDate),
      convertedAt: toTimestamp(lead.convertedAt),
      lostAt: toTimestamp(lead.lostAt),
    });
  }

  for (const a of data.activities) {
    batch.set(doc(db, activitiesPath(slug, a.leadId, true), a.id), {
      ...a,
      tenantId: slug,
      createdAt: toTimestamp(a.createdAt) ?? Timestamp.now(),
    });
  }

  for (const t of data.tasks) {
    batch.set(doc(db, tasksPath(slug, true), t.id), {
      ...t,
      tenantId: slug,
      createdAt: toTimestamp(t.createdAt) ?? Timestamp.now(),
      dueDate: toTimestamp(t.dueDate),
    });
  }

  for (const c of data.cadences) {
    batch.set(doc(db, cadencesPath(slug, true), c.id), {
      ...c,
      tenantId: slug,
      createdAt: toTimestamp(c.createdAt) ?? Timestamp.now(),
      updatedAt: toTimestamp(c.updatedAt) ?? Timestamp.now(),
    });
  }

  for (const tpl of data.templates) {
    batch.set(doc(db, templatesPath(slug, true), tpl.id), {
      ...tpl,
      tenantId: slug,
      updatedAt: toTimestamp(tpl.updatedAt) ?? Timestamp.now(),
    });
  }

  for (const e of data.enrollments) {
    batch.set(doc(db, cadenceEnrollmentsPath(slug, true), e.id), {
      ...e,
      tenantId: slug,
      enrolledAt: toTimestamp(e.enrolledAt) ?? Timestamp.now(),
      nextRunAt: toTimestamp(e.nextRunAt),
      completedAt: toTimestamp(e.completedAt),
    });
  }

  batch.set(metaRef, {
    seededAt: Timestamp.now(),
    version: SEED_VERSION,
    slug,
    counts: {
      users: data.users.length,
      leads: data.leads.length,
      activities: data.activities.length,
      tasks: data.tasks.length,
      cadences: data.cadences.length,
      templates: data.templates.length,
      enrollments: data.enrollments.length,
    },
  });

  await batch.commit();
  return true;
}

/**
 * Wipe a demo tenant and re-seed it from the mock-data fixtures.
 * Use this from the "Reset demo" link on the demo banner.
 */
export async function resetDemoTenant(slug: DemoSlug): Promise<void> {
  if (!isFirebaseConfigured) return;
  if (!(slug in SEEDS)) return;

  // Best-effort cleanup: collections we know about.
  const collectionsToWipe = [
    leadsPath(slug, true),
    tasksPath(slug, true),
    cadencesPath(slug, true),
    cadenceEnrollmentsPath(slug, true),
    templatesPath(slug, true),
    usersPath(slug, true),
  ];

  // Also wipe activities (subcollection per lead). Read leads first.
  const leadDocs = await getDocs(collection(db, leadsPath(slug, true)));
  for (const leadDoc of leadDocs.docs) {
    const acts = await getDocs(collection(db, activitiesPath(slug, leadDoc.id, true)));
    await Promise.all(acts.docs.map((d) => deleteDoc(d.ref)));
  }

  for (const path of collectionsToWipe) {
    const snap = await getDocs(collection(db, path));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  // Drop the seed marker so the next seedDemoTenantIfNeeded call re-runs.
  await deleteDoc(doc(db, seedMetaPath(slug))).catch(() => undefined);

  await seedDemoTenantIfNeeded(slug);
}

export function isValidDemoSlug(slug: string): slug is DemoSlug {
  return slug in SEEDS;
}

// Re-export the tenant root helper so callers don't need to know the prefix.
export { tenantRoot };
