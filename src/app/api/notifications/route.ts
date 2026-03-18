import { NextRequest, NextResponse } from "next/server";
import { getFirestoreAdmin, getAuthAdmin } from "@/lib/firebase/admin";

async function verifyUser(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = await getAuthAdmin().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const uid = await verifyUser(request);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getFirestoreAdmin();
  const snap = await db
    .collection("notifications")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const notifications = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  return NextResponse.json(notifications);
}

export async function PATCH(request: NextRequest) {
  const uid = await verifyUser(request);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { notificationIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { notificationIds } = body;
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return NextResponse.json({ error: "notificationIds must be a non-empty array" }, { status: 400 });
  }

  const db = getFirestoreAdmin();
  const batch = db.batch();

  for (const id of notificationIds) {
    // Verify the notification belongs to this user before marking read
    const ref = db.collection("notifications").doc(id);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const data = snap.data();
    if (data?.userId !== uid) continue;
    batch.update(ref, { isRead: true });
  }

  await batch.commit();

  return NextResponse.json({ success: true, updated: notificationIds.length });
}
