"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { useTenantUsers, useLeads } from "@/hooks/use-leads";
import { getInitials } from "@/lib/utils";
import { notifyAssignment } from "@/lib/email/notify-client";

interface AssignLeadModalProps {
  leadId: string;
  currentAssignee: string | null;
  demo?: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

export function AssignLeadModal({
  leadId,
  currentAssignee,
  demo,
  onClose,
  onAssigned,
}: AssignLeadModalProps) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { users, loading: usersLoading } = useTenantUsers();
  const { leads } = useLeads({ status: "active" });

  const activeUsers = users.filter((u) => u.isActive);

  const leadCountByUser: Record<string, number> = {};
  for (const lead of leads) {
    if (lead.assignedTo) {
      leadCountByUser[lead.assignedTo] = (leadCountByUser[lead.assignedTo] ?? 0) + 1;
    }
  }

  async function handleAssign() {
    if (!selectedUserId || !user) return;

    if (demo) {
      onAssigned();
      return;
    }

    if (!supabase) return;
    setSaving(true);
    setError(null);

    try {
      await supabase.from("leads").update({
        assigned_to: selectedUserId,
      }).eq("id", leadId);

      await supabase.from("activities").insert({
        tenant_id: user.tenantId,
        lead_id: leadId,
        performed_by: user.id,
        activity_type: "note",
        title: `Lead assigned to ${users.find((u) => u.id === selectedUserId)?.fullName ?? selectedUserId}`,
        description: null,
        metadata: {
          previousAssignee: currentAssignee,
          newAssignee: selectedUserId,
        },
      });

      notifyAssignment(leadId).catch(() => {});

      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign lead. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[12px] shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Assign Lead</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 p-2">
          {usersLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeUsers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No active team members found.</p>
          ) : (
            activeUsers.map((member) => {
              const isSelected = selectedUserId === member.id;
              const isCurrent = member.id === currentAssignee;
              const leadCount = leadCountByUser[member.id] ?? 0;

              return (
                <button
                  key={member.id}
                  onClick={() => setSelectedUserId(member.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left ${
                    isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {getInitials(member.fullName)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{member.fullName}</p>
                      {isCurrent && (
                        <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-700">{leadCount}</p>
                    <p className="text-xs text-gray-400">leads</p>
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
            onClick={handleAssign}
            disabled={!selectedUserId || saving}
            className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Assigning…" : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
