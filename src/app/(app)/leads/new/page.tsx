"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { isDemoUser } from "@/lib/mock-data";
import { createLeadSchema, type CreateLeadInput } from "@/schemas/lead";

type FieldErrors = Partial<Record<keyof CreateLeadInput, string>>;

const SOURCE_OPTIONS = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "phone", label: "Phone" },
  { value: "walk-in", label: "Walk-in" },
  { value: "social", label: "Social Media" },
  { value: "mab-import", label: "MAB Import" },
  { value: "other", label: "Other" },
];

const MORTGAGE_TYPE_OPTIONS = [
  { value: "first-time-buyer", label: "First-time Buyer" },
  { value: "remortgage", label: "Remortgage" },
  { value: "self-employed", label: "Self-employed" },
  { value: "buy-to-let", label: "Buy-to-let" },
  { value: "other", label: "Other" },
];

const READINESS_OPTIONS = [
  { value: "ready-now", label: "Ready now" },
  { value: "1-3-months", label: "1–3 months" },
  { value: "3-6-months", label: "3–6 months" },
  { value: "6-12-months", label: "6–12 months" },
  { value: "exploring", label: "Just exploring" },
];

const FOLLOW_UP_REASON_OPTIONS = [
  { value: "saving_deposit", label: "Saving deposit" },
  { value: "improving_credit", label: "Improving credit score" },
  { value: "building_account_history", label: "Building account history" },
  { value: "waiting_for_documents", label: "Waiting for documents" },
  { value: "other", label: "Other" },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function Field({ label, error, ...props }: InputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        {...props}
        className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
          error ? "border-destructive" : "border-gray-300"
        }`}
      />
      <FieldError message={error} />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

function SelectField({ label, error, options, placeholder, ...props }: SelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        {...props}
        className={`w-full border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white ${
          error ? "border-destructive" : "border-gray-300"
        }`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}

export default function NewLeadPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useSupabase();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    source: "",
    mortgageType: "",
    readiness: "",
    notes: "",
    followUpDate: "",
    followUpReason: "",
    reminderEmail1: "",
    reminderEmail2: "",
    reminderEmail3: "",
    reminderNote: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      email: form.email || undefined,
      source: form.source as CreateLeadInput["source"],
      mortgageType: form.mortgageType as CreateLeadInput["mortgageType"] || undefined,
      readiness: form.readiness as CreateLeadInput["readiness"] || undefined,
      notes: form.notes || undefined,
      followUpDate: form.followUpDate || undefined,
      followUpReason: form.followUpReason as CreateLeadInput["followUpReason"] || undefined,
      reminderEmails: [form.reminderEmail1, form.reminderEmail2, form.reminderEmail3].filter(Boolean),
      reminderNote: form.reminderNote || undefined,
    };

    const result = createLeadSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      result.error.errors.forEach((err) => {
        const key = err.path[0] as keyof CreateLeadInput;
        if (key) fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!user) {
      setSubmitError("You must be logged in to create a lead.");
      return;
    }

    setSaving(true);
    try {
      const demo = isDemoUser(user.id);

      if (demo) {
        setShowSuccess(true);
        setTimeout(() => {
          router.push("/leads");
        }, 1500);
        return;
      }

      if (!supabase) throw new Error("Database not configured");
      await supabase.auth.refreshSession();

      const { data: firstStage } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("tenant_id", user.tenantId)
        .order("position", { ascending: true })
        .limit(1)
        .single();

      let sourceId: string | null = null;
      if (form.source) {
        const { data: sourceRow, error: sourceErr } = await supabase
          .from("lead_sources")
          .select("id")
          .eq("tenant_id", user.tenantId)
          .eq("slug", form.source)
          .maybeSingle();
        if (sourceErr) throw sourceErr;
        sourceId = sourceRow?.id ?? null;
      }

      const { data: newLead, error: insertErr } = await supabase.from("leads").insert({
        tenant_id: user.tenantId,
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
        email: form.email || null,
        source_id: sourceId,
        mortgage_type: form.mortgageType || null,
        readiness: form.readiness || null,
        status: "active",
        current_stage_id: firstStage?.id ?? null,
        current_stage_entered_at: new Date().toISOString(),
        assigned_to: user.id,
        next_follow_up_date: form.followUpDate ? new Date(form.followUpDate).toISOString() : null,
        follow_up_reason: form.followUpReason || null,
        follow_up_notes: form.reminderNote || null,
        tags: [],
        referred_by: null,
      }).select("id").single();

      if (insertErr) throw insertErr;

      if (form.followUpDate && newLead) {
        const reminderEmails = [form.reminderEmail1, form.reminderEmail2, form.reminderEmail3].filter(Boolean);
        await supabase.from("tasks").insert({
          tenant_id: user.tenantId,
          lead_id: newLead.id,
          assigned_to: user.id,
          created_by: user.id,
          title: `Follow up: ${form.firstName} ${form.lastName}`,
          description: form.reminderNote || null,
          due_date: new Date(form.followUpDate).toISOString(),
          priority: "normal",
          status: "pending",
          reminder_emails: reminderEmails,
          reminder_sent: false,
        });
      }

      // Notify managers about new lead (non-blocking)
      if (newLead?.id && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            fetch("/api/notifications/lead-created", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ leadId: newLead.id }),
            }).catch(() => {});
          }
        } catch { /* non-fatal */ }
      }

      router.push(`/leads/${newLead?.id}`);
    } catch (err: unknown) {
      console.error("Failed to create lead:", err);
      const detail = err instanceof Error ? err.message
        : typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message)
        : "";
      setSubmitError(detail ? `Failed to save lead: ${detail}` : "Failed to save lead. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg">
          Lead saved successfully!
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Contact Details */}
          <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-base font-bold text-gray-900">Contact Details</h2>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="First Name"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                placeholder="Jane"
                error={errors.firstName}
                required
              />
              <Field
                label="Last Name"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                placeholder="Smith"
                error={errors.lastName}
                required
              />
            </div>

            <Field
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+44 7700 000000"
              error={errors.phone}
              required
            />

            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="jane@example.com"
              error={errors.email}
            />

            <SelectField
              label="Lead Source"
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
              options={SOURCE_OPTIONS}
              placeholder="Select source…"
              error={errors.source}
              required
            />

            <SelectField
              label="Mortgage Type"
              value={form.mortgageType}
              onChange={(e) => set("mortgageType", e.target.value)}
              options={MORTGAGE_TYPE_OPTIONS}
              placeholder="Select type…"
            />

            <SelectField
              label="Readiness"
              value={form.readiness}
              onChange={(e) => set("readiness", e.target.value)}
              options={READINESS_OPTIONS}
              placeholder="Select readiness…"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quick Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                placeholder="Any initial context…"
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>

          {/* Right: Follow-up Reminder */}
          <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-base font-bold text-gray-900">Follow-up Reminder</h2>
            <p className="text-xs text-gray-500">Optional — schedule a reminder to follow up with this lead.</p>

            <Field
              label="Follow-up Date"
              type="date"
              value={form.followUpDate}
              onChange={(e) => set("followUpDate", e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />

            <SelectField
              label="Reason"
              value={form.followUpReason}
              onChange={(e) => set("followUpReason", e.target.value)}
              options={FOLLOW_UP_REASON_OPTIONS}
              placeholder="Select reason…"
            />

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Reminder Recipients (up to 3)</label>
              {[
                { key: "reminderEmail1", placeholder: "advisor@mallard.co.uk" },
                { key: "reminderEmail2", placeholder: "manager@mallard.co.uk" },
                { key: "reminderEmail3", placeholder: "extra@mallard.co.uk" },
              ].map(({ key, placeholder }) => (
                <input
                  key={key}
                  type="email"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Note</label>
              <textarea
                value={form.reminderNote}
                onChange={(e) => set("reminderNote", e.target.value)}
                rows={3}
                placeholder="Context to include in the reminder email…"
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>
        </div>

        {submitError && (
          <p className="mt-4 text-sm text-destructive text-center">{submitError}</p>
        )}

        <div className="mt-6">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-white font-bold py-3 rounded-lg text-base hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
