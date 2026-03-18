import { NextRequest, NextResponse } from "next/server";
import { getFirestoreAdmin, getAuthAdmin } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

async function verifyToken(request: NextRequest): Promise<{ uid: string; role: string } | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const auth = getAuthAdmin();
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, role: (decoded.role as string) ?? "advisor" };
  } catch {
    return null;
  }
}

function isAdminOrManager(role: string) {
  return role === "admin" || role === "manager";
}

// GET /api/settings — returns user profile + notification prefs + pipeline stages
export async function GET(request: NextRequest) {
  const auth = await verifyToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getFirestoreAdmin();

  const [userDoc, stagesSnap] = await Promise.all([
    db.collection("users").doc(auth.uid).get(),
    db.collection("pipelines").doc("default").collection("stages").orderBy("position").get(),
  ]);

  const userData = userDoc.exists ? userDoc.data() : {};
  const stages = stagesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({
    user: {
      fullName: userData?.fullName ?? "",
      email: userData?.email ?? "",
      phone: userData?.phone ?? null,
      notificationPreferences: userData?.notificationPreferences ?? {
        reminders: true,
        assignments: true,
        stageChanges: false,
      },
    },
    stages,
  });
}

// PATCH /api/settings — update profile or notification preferences
export async function PATCH(request: NextRequest) {
  const auth = await verifyToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const db = getFirestoreAdmin();

  const allowedProfileFields = ["fullName", "phone"];
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  for (const field of allowedProfileFields) {
    if (field in body) {
      update[field] = body[field];
    }
  }

  if (body.notificationPreferences && typeof body.notificationPreferences === "object") {
    const prefs = body.notificationPreferences as Record<string, unknown>;
    update["notificationPreferences"] = {
      reminders: Boolean(prefs.reminders),
      assignments: Boolean(prefs.assignments),
      stageChanges: Boolean(prefs.stageChanges),
    };
  }

  await db.collection("users").doc(auth.uid).update(update);

  return NextResponse.json({ success: true });
}

// POST /api/settings — add or update pipeline stages (admin/manager only)
export async function POST(request: NextRequest) {
  const auth = await verifyToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminOrManager(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const db = getFirestoreAdmin();

  // body.action can be "add", "update", or "reorder"
  const { action } = body;

  if (action === "add") {
    const { name, color, position } = body;
    if (!name || !color || position === undefined) {
      return NextResponse.json({ error: "name, color, and position are required" }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const ref = db.collection("pipelines").doc("default").collection("stages").doc();
    await ref.set({
      name,
      slug,
      color,
      position: Number(position),
      isTerminal: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: ref.id });
  }

  if (action === "update") {
    const { stageId, name, color, position } = body;
    if (!stageId) {
      return NextResponse.json({ error: "stageId is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (position !== undefined) updateData.position = Number(position);

    await db
      .collection("pipelines")
      .doc("default")
      .collection("stages")
      .doc(stageId)
      .update(updateData);

    return NextResponse.json({ success: true });
  }

  if (action === "reorder") {
    const { order } = body as { order: { id: string; position: number }[] };
    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "order array is required" }, { status: 400 });
    }

    const batch = db.batch();
    for (const item of order) {
      const ref = db.collection("pipelines").doc("default").collection("stages").doc(item.id);
      batch.update(ref, { position: item.position });
    }
    await batch.commit();

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
