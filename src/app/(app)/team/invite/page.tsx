"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase/client";

const ROLE_OPTIONS = [
  { value: "advisor", label: "Advisor" },
  { value: "manager", label: "Manager" },
];

export default function InviteTeamMemberPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role === "advisor") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const [form, setForm] = useState({
    email: "",
    fullName: "",
    role: "advisor",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!user || user.role === "advisor") return null;

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.email.trim() || !form.fullName.trim()) {
      setError("Email and full name are required.");
      return;
    }

    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/team", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "invite",
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          role: form.role,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send invite");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle size={56} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Invitation Sent!</h2>
        <p className="text-sm text-gray-500">
          An invite email with login instructions has been sent to{" "}
          <span className="font-semibold text-gray-700">{form.email}</span>.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => { setSuccess(false); setForm({ email: "", fullName: "", role: "advisor" }); }}
            className="w-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Invite Another
          </button>
          <Link
            href="/team"
            className="w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-dark transition-colors text-center block"
          >
            Back to Team
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6 space-y-5">
      <Link
        href="/team"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={15} />
        Back to Team
      </Link>

      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <h1 className="text-lg font-bold text-gray-900 mb-1">Invite Team Member</h1>
        <p className="text-sm text-gray-500 mb-5">
          They will receive an email with a temporary password to log in.
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="Jane Smith"
              required
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="jane@mallardmortgages.co.uk"
              required
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-white font-bold py-3 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Sending Invite…" : "Send Invite"}
          </button>
        </form>
      </div>
    </div>
  );
}
