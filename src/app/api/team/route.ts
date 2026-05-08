import { NextRequest, NextResponse } from "next/server";
import { getFirestoreAdmin, getAuthAdmin } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";

type UserRole = "admin" | "manager" | "advisor";

async function verifyAdminOrManager(
  request: NextRequest
): Promise<{ uid: string; role: UserRole; tenantId: string } | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const decoded = await getAuthAdmin().verifyIdToken(token);
    const role = decoded.role as UserRole | undefined;
    const tenantId = decoded.tenantId as string | undefined;
    if ((role === "admin" || role === "manager") && tenantId) {
      return { uid: decoded.uid, role, tenantId };
    }
    return null;
  } catch {
    return null;
  }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${password}!1`;
}

export async function GET(request: NextRequest) {
  const caller = await verifyAdminOrManager(request);
  if (!caller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getFirestoreAdmin();
  const snap = await db
    .collection("users")
    .where("tenantId", "==", caller.tenantId)
    .orderBy("createdAt", "desc")
    .get();
  const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const caller = await verifyAdminOrManager(request);
  if (!caller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { action?: string; email?: string; fullName?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "invite") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { email, fullName, role } = body;

  if (!email || !fullName) {
    return NextResponse.json({ error: "email and fullName are required" }, { status: 400 });
  }

  const validRoles: UserRole[] = ["advisor", "manager"];
  const userRole: UserRole = validRoles.includes(role as UserRole) ? (role as UserRole) : "advisor";

  const tempPassword = generateTempPassword();

  const authAdmin = getAuthAdmin();
  const db = getFirestoreAdmin();

  let uid: string;
  try {
    const newUser = await authAdmin.createUser({
      email,
      displayName: fullName,
      password: tempPassword,
      emailVerified: false,
    });
    uid = newUser.uid;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  await authAdmin.setCustomUserClaims(uid, { role: userRole, tenantId: caller.tenantId });

  const now = Timestamp.now();
  await db.collection("users").doc(uid).set({
    tenantId: caller.tenantId,
    email,
    fullName,
    phone: null,
    role: userRole,
    avatarUrl: null,
    isActive: true,
    createdAt: now,
  });

  // Send invite email via Resend
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sequence-ai.com";
    await resend.emails.send({
      from: "Sequence <no-reply@sequence-ai.com>",
      to: [email],
      subject: "You've been invited to Sequence",
      html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Welcome to Sequence</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:#1A5653;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Sequence</h1>
            <p style="margin:4px 0 0;color:#bfdbfe;font-size:14px;">You've been invited</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Welcome, ${fullName}!</h2>
            <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
              You've been added to Sequence as a <strong>${userRole}</strong>. Use the credentials below to log in for the first time.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:20px;">
                <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Email</p>
                <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#111827;">${email}</p>
                <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Temporary Password</p>
                <p style="margin:0;font-size:15px;font-weight:600;color:#111827;font-family:monospace;letter-spacing:0.05em;">${tempPassword}</p>
              </td></tr>
            </table>
            <p style="color:#6b7280;font-size:13px;margin:0 0 24px;">Please change your password after logging in for the first time.</p>
            <a href="${appUrl}/login" style="display:inline-block;background-color:#1A5653;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;font-weight:600;">
              Log In to Sequence
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">If you weren't expecting this invitation, you can ignore this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
    });
  } catch {
    // Email failure is non-fatal — user was created successfully
  }

  return NextResponse.json({ id: uid, email, fullName, role: userRole }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const caller = await verifyAdminOrManager(request);
  if (!caller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string; role?: string; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, role, isActive } = body;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getFirestoreAdmin();
  const authAdmin = getAuthAdmin();

  const updates: Record<string, unknown> = {};

  if (role !== undefined) {
    const validRoles: UserRole[] = ["admin", "advisor", "manager"];
    if (!validRoles.includes(role as UserRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updates.role = role;
    await authAdmin.setCustomUserClaims(userId, { role, tenantId: caller.tenantId });
  }

  if (isActive !== undefined) {
    updates.isActive = isActive;
    await authAdmin.updateUser(userId, { disabled: !isActive });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Verify the target user belongs to the caller's tenant before updating.
  const targetSnap = await db.collection("users").doc(userId).get();
  if (!targetSnap.exists || targetSnap.data()?.tenantId !== caller.tenantId) {
    return NextResponse.json({ error: "Cross-tenant update forbidden" }, { status: 403 });
  }

  await db.collection("users").doc(userId).update(updates);

  return NextResponse.json({ success: true, userId, ...updates });
}
