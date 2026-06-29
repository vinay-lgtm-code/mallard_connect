"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { useTenantUsers } from "@/hooks/use-leads";
import { isDemoUser } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

const TYPE_TAGS = [
  { value: "first-time-buyer", label: "First-time buyer" },
  { value: "remortgage", label: "Remortgage" },
  { value: "self-employed", label: "Self-employed" },
  { value: "buy-to-let", label: "Buy-to-let" },
  { value: "referral", label: "Referral" },
  { value: "walk-in", label: "Walk-in" },
];

export default function CapturePage() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const { users: tenantUsers } = useTenantUsers();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const activeAdvisers = tenantUsers.filter(
    (u) => u.isActive && (u.role === "advisor" || u.role === "admin" || u.role === "manager")
  );

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSave() {
    setError(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!user) {
      setError("You must be logged in.");
      return;
    }

    setSaving(true);
    try {
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0] ?? "";
      const lastName = parts.slice(1).join(" ");

      if (isDemoUser(user.id)) {
        setShowToast(true);
        setTimeout(() => router.push("/dashboard"), 1200);
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

      const effectiveAssignee = assignedTo || user.id;
      const { data: newLead, error: insertErr } = await supabase.from("leads").insert({
        tenant_id: user.tenantId,
        first_name: firstName,
        last_name: lastName,
        phone: phone.trim(),
        email: null,
        source_id: null,
        status: "active",
        current_stage_id: firstStage?.id ?? null,
        current_stage_entered_at: new Date().toISOString(),
        assigned_to: effectiveAssignee,
        mortgage_type: null,
        readiness: null,
        follow_up_notes: notes.trim() || null,
        tags: selectedTags,
      }).select("id").single();
      if (insertErr) throw insertErr;

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

      setShowToast(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white flex items-center justify-between px-4 py-4 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 text-white/80 hover:text-white">
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Back</span>
        </Link>
        <h1 className="text-base font-bold">Quick Capture</h1>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="primary"
          size="sm"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </header>

      {/* Toast */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg">
          Lead saved successfully!
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-text-secondary mb-2">
            Full Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder="e.g. James Thornton"
            autoFocus
            className="w-full border border-border-strong rounded-xl px-4 py-4 text-base focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10 bg-white"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-text-secondary mb-2">
            Phone Number <span className="text-destructive">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(null); }}
            placeholder="+44 7700 000000"
            className="w-full border border-border-strong rounded-xl px-4 py-4 text-base font-mono focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10 bg-white"
          />
        </div>

        {/* Type Tags */}
        <div>
          <label className="block text-sm font-semibold text-text-secondary mb-2">
            Type <span className="text-xs text-text-muted font-normal">(tap to select)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TYPE_TAGS.map((tag) => {
              const active = selectedTags.includes(tag.value);
              return (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => toggleTag(tag.value)}
                  className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-colors border ${
                    active
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-text-secondary border-border-strong hover:border-primary/50"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Assign to */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Assign to</label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            <option value="">Me ({user?.fullName ?? "current user"})</option>
            {activeAdvisers
              .filter((u) => u.id !== user?.id)
              .map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-text-secondary mb-2">Quick Note</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any initial context — situation, urgency, how they heard about us…"
            rows={4}
            className="w-full border border-border-strong rounded-xl px-4 py-4 text-base focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10 bg-white resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-destructive text-sm font-medium rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Save button (also at bottom for easy thumb reach) */}
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="primary"
          size="lg"
          className="w-full py-4 rounded-xl"
        >
          {saving ? "Saving…" : "Save Lead"}
        </Button>
      </div>
    </div>
  );
}
