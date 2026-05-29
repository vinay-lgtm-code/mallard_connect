"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

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

      await addDoc(collection(db, "leads"), {
        firstName,
        lastName,
        phone: phone.trim(),
        email: null,
        source: "walk-in",
        status: "active",
        currentStageId: "new_enquiry",
        assignedTo: user.id,
        mortgageType: null,
        readiness: null,
        propertyValue: null,
        depositAmount: null,
        loanAmount: null,
        dealValue: null,
        estimatedCloseDate: null,
        confidence: null,
        nextFollowUpDate: null,
        followUpReason: null,
        followUpNotes: notes.trim() || null,
        tags: selectedTags,
        referredBy: null,
        importId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        convertedAt: null,
        lostAt: null,
        lostReason: null,
      });

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white flex items-center justify-between px-4 py-4 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 text-white/80 hover:text-white">
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Back</span>
        </Link>
        <h1 className="text-base font-bold">Quick Capture</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-accent text-white text-sm font-bold px-4 py-2 rounded-lg active:opacity-80 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
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
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Full Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder="e.g. James Thornton"
            autoFocus
            className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Phone Number <span className="text-destructive">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(null); }}
            placeholder="+44 7700 000000"
            className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          />
        </div>

        {/* Type Tags */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Type <span className="text-xs text-gray-400 font-normal">(tap to select)</span>
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
                      : "bg-white text-gray-600 border-gray-300 hover:border-primary/50"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Quick Note</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any initial context — situation, urgency, how they heard about us…"
            rows={4}
            className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary bg-white resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-destructive text-sm font-medium rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Save button (also at bottom for easy thumb reach) */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl text-base hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Lead"}
        </button>
      </div>
    </div>
  );
}
