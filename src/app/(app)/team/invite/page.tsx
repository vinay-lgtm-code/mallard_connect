"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { hasCapability } from "@/lib/auth/roles";

const ROLE_OPTIONS = [
  { value: "advisor", label: "Advisor", description: "Works their own leads and pipeline." },
  { value: "case_manager", label: "Case Manager", description: "Can add and allocate leads and view everyone's pipeline. No Reports or Forecast access." },
  { value: "manager", label: "Manager", description: "Manages team, pipeline, forecasts, reports, and settings." },
];

export default function InviteTeamMemberPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !hasCapability(user.role, "manageTeam")) {
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
  const [success, setSuccess] = useState<"sent" | "pending" | null>(null);
  const selectedRole = ROLE_OPTIONS.find((r) => r.value === form.role) ?? ROLE_OPTIONS[0];

  if (!user || !hasCapability(user.role, "manageTeam")) return null;

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
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send invite");
      }

      setSuccess(data.alreadyPending ? "pending" : "sent");
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
        <h2 className="text-xl font-bold text-text-primary">
          {success === "pending" ? "Invitation Already Pending" : "Invitation Sent!"}
        </h2>
        <p className="text-sm text-text-secondary">
          {success === "pending"
            ? "An active invitation has already been sent to "
            : "An invite email with setup instructions has been sent to "}
          <span className="font-semibold text-text-secondary">{form.email}</span>.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => { setSuccess(null); setForm({ email: "", fullName: "", role: "advisor" }); }}
          >
            Invite Another
          </Button>
          <Link
            href="/team"
            className="w-full inline-flex items-center justify-center gap-1.5 font-semibold text-sm rounded-[var(--radius-button)] transition-colors bg-accent text-white hover:bg-accent-light px-4 py-2.5 text-center"
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
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-secondary"
      >
        <ArrowLeft size={15} />
        Back to Team
      </Link>

      <div className="bg-white rounded-[12px] p-5 border border-border">
        <h1 className="text-lg font-bold text-text-primary mb-1">Invite Team Member</h1>
        <p className="text-sm text-text-secondary mb-5">
          They will receive an email to set their password and join the workspace.
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Full Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="Jane Smith"
              required
              className="w-full border border-border-strong rounded-lg px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Email Address <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="jane@mallardmortgages.co.uk"
              required
              className="w-full border border-border-strong rounded-lg px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className="w-full border border-border-strong rounded-lg px-3.5 py-2.5 text-sm bg-white focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-page px-3 py-2 text-xs text-text-secondary">
              <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-text-muted" />
              <span>
                <strong className="text-text-primary">{selectedRole.label}:</strong>{" "}
                {selectedRole.description}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={saving}
          >
            {saving ? "Sending Invite…" : "Send Invite"}
          </Button>
        </form>
      </div>
    </div>
  );
}
