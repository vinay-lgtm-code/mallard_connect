"use client";

import { useState } from "react";
import { X, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { useCadences, useCadenceEnrollments } from "@/hooks/use-cadences";
import { isDemoUser } from "@/lib/mock-data";

interface EnrollCadenceModalProps {
  leadId: string;
  leadName: string;
  open: boolean;
  onClose: () => void;
  onEnrolled: () => void;
}

export function EnrollCadenceModal({
  leadId,
  leadName,
  open,
  onClose,
  onEnrolled,
}: EnrollCadenceModalProps) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const { cadences, loading: cadencesLoading } = useCadences();
  const { enrollments } = useCadenceEnrollments();

  const [selectedCadenceId, setSelectedCadenceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const activeCadences = cadences.filter((c) => c.isActive);
  const enrolledCadenceIds = new Set(
    enrollments.filter((e) => e.leadId === leadId && e.status === "active").map((e) => e.cadenceId)
  );

  async function handleEnroll() {
    if (!selectedCadenceId || !user) return;

    if (demo) {
      onEnrolled();
      return;
    }

    if (!supabase) return;
    setSaving(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      await supabase.from("cadence_enrollments").insert({
        tenant_id: user.tenantId,
        lead_id: leadId,
        cadence_id: selectedCadenceId,
        current_step: 0,
        next_run_at: now,
        status: "active",
        enrolled_at: now,
        completed_at: null,
      });

      const cadenceName = activeCadences.find((c) => c.id === selectedCadenceId)?.name;
      await supabase.from("activities").insert({
        tenant_id: user.tenantId,
        lead_id: leadId,
        performed_by: user.id,
        activity_type: "note",
        title: `Enrolled in cadence: ${cadenceName}`,
        description: null,
        metadata: { cadenceId: selectedCadenceId },
      });

      onEnrolled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enrol. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[12px] shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Enrol in Cadence</h2>
            <p className="text-xs text-gray-500 mt-0.5">For {leadName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 p-2">
          {cadencesLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeCadences.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No active cadences available.</p>
          ) : (
            activeCadences.map((cadence) => {
              const isEnrolled = enrolledCadenceIds.has(cadence.id);
              const isSelected = selectedCadenceId === cadence.id;

              return (
                <button
                  key={cadence.id}
                  onClick={() => !isEnrolled && setSelectedCadenceId(cadence.id)}
                  disabled={isEnrolled}
                  className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg transition-colors text-left ${
                    isEnrolled
                      ? "opacity-50 cursor-not-allowed"
                      : isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{cadence.name}</p>
                      {isEnrolled && (
                        <span className="text-xs bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">
                          Enrolled
                        </span>
                      )}
                    </div>
                    {cadence.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{cadence.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {cadence.steps.length} step{cadence.steps.length !== 1 ? "s" : ""}
                      {" · "}
                      {cadence.trigger.type.replace(/_/g, " ")}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {error && (
          <div className="px-5 py-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEnroll}
            disabled={!selectedCadenceId || saving}
            className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Enrolling…" : "Enrol"}
          </button>
        </div>
      </div>
    </div>
  );
}
