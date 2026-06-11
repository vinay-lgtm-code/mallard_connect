"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, RefreshCw, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { useLeads, useTenantUsers } from "@/hooks/use-leads";
import { isDemoUser } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { rowsToApp, rowToApp } from "@/lib/supabase/mappers";
import { useState, useCallback, useMemo } from "react";
import { getInitials, formatRelativeDate } from "@/lib/utils";
import type { User, Activity, UserRole } from "@/types";

const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  advisor: "bg-gray-100 text-gray-600",
};

const STAGE_STYLES: Record<string, string> = {
  new_enquiry: "bg-indigo-100 text-indigo-700",
  initial_contact: "bg-blue-100 text-blue-700",
  not_ready_yet: "bg-amber-100 text-amber-700",
  nurturing: "bg-green-100 text-green-700",
  ready_to_proceed: "bg-blue-100 text-blue-700",
  referred_to_mab: "bg-purple-100 text-purple-700",
};

const STAGE_LABELS: Record<string, string> = {
  new_enquiry: "New Enquiry",
  initial_contact: "Initial Contact",
  not_ready_yet: "Not Ready Yet",
  nurturing: "Nurturing",
  ready_to_proceed: "Ready to Proceed",
  referred_to_mab: "Referred to MAB",
};

const ACTIVITY_DOT: Record<string, string> = {
  call: "bg-green-500",
  email: "bg-blue-500",
  meeting: "bg-purple-500",
  note: "bg-gray-400",
  sms: "bg-cyan-500",
  whatsapp: "bg-emerald-500",
  "stage-change": "bg-amber-500",
  assignment: "bg-indigo-500",
};

export default function TeamMemberPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (currentUser && currentUser.role === "advisor") {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  const supabase = useSupabase();
  const demo = currentUser ? isDemoUser(currentUser.id) : false;
  const [member, setMember] = useState<(User & { id: string }) | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);
  const [activities, setActivities] = useState<(Activity & { id: string })[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  const [idToSlug, setIdToSlug] = useState<Record<string, string>>({});

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  function showSuccessBanner(msg: string) {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }

  const fetchMember = useCallback(() => {
    if (!supabase) return;
    supabase.from("users").select("*").eq("id", id).single().then(({ data }) => {
      setMember(data ? rowToApp<User & { id: string }>(data) : null);
      setMemberLoading(false);
    });
    supabase.from("activities").select("*").eq("performed_by", id).order("created_at", { ascending: false }).limit(20).then(({ data }) => {
      setActivities(data ? rowsToApp<Activity & { id: string }>(data) : []);
      setActivitiesLoading(false);
    });
  }, [supabase, id]);

  useEffect(() => { fetchMember(); }, [fetchMember]);

  useEffect(() => {
    if (demo || !supabase || !currentUser?.tenantId) return;
    supabase
      .from("pipeline_stages")
      .select("id, slug")
      .eq("tenant_id", currentUser.tenantId)
      .then(({ data }) => {
        if (!data) return;
        const i2s: Record<string, string> = {};
        for (const row of data) {
          i2s[row.id] = row.slug;
        }
        setIdToSlug(i2s);
      });
  }, [demo, supabase, currentUser?.tenantId]);

  const { leads, loading: leadsLoading } = useLeads({ assignedTo: id });
  const { users: allUsers } = useTenantUsers();

  const isManager = currentUser?.role === "admin" || currentUser?.role === "manager";

  if (!currentUser || currentUser.role === "advisor") return null;

  if (memberLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Team member not found.</p>
        <Link href="/team" className="mt-3 text-primary text-sm hover:underline inline-block">
          Back to Team
        </Link>
      </div>
    );
  }

  const activeLeads = leads.filter((l) => l.status === "active");
  const convertedLeads = leads.filter((l) => l.status === "converted");
  const conversionRate = leads.length > 0 ? Math.round((convertedLeads.length / leads.length) * 100) : 0;

  const stageSlugOf = (stageId: string | null | undefined): string =>
    stageId ? (idToSlug[stageId] ?? stageId) : "new_enquiry";

  const reassignableUsers = useMemo(
    () => allUsers.filter((u) => u.isActive && u.id !== id),
    [allUsers, id],
  );

  const leadCountByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const lead of leads) {
      if (lead.assignedTo) {
        map[lead.assignedTo] = (map[lead.assignedTo] ?? 0) + 1;
      }
    }
    return map;
  }, [leads]);

  const canDelete = isManager && member && member.id !== currentUser?.id && member.role !== "admin";

  async function handleReassign() {
    if (!reassignTarget || !currentUser) return;
    setReassigning(true);
    setReassignError(null);

    const targetName = allUsers.find((u) => u.id === reassignTarget)?.fullName ?? reassignTarget;

    try {
      if (!demo && supabase) {
        const leadIds = activeLeads.map((l) => l.id);
        await supabase.from("leads").update({ assigned_to: reassignTarget }).in("id", leadIds);
        await supabase.from("activities").insert(
          activeLeads.map((lead) => ({
            tenant_id: currentUser.tenantId,
            lead_id: lead.id,
            performed_by: currentUser.id,
            activity_type: "assignment" as const,
            title: `Lead reassigned to ${targetName}`,
            description: null,
            metadata: {
              previousAssignee: id,
              newAssignee: reassignTarget,
            },
          })),
        );
      }
      setShowReassignModal(false);
      setReassignTarget(null);
      showSuccessBanner(`${activeLeads.length} lead${activeLeads.length !== 1 ? "s" : ""} reassigned`);
      setTimeout(() => router.push("/team"), 1000);
    } catch (err) {
      setReassignError(err instanceof Error ? err.message : "Failed to reassign leads");
    } finally {
      setReassigning(false);
    }
  }

  async function handleDelete() {
    if (!member) return;
    setDeleting(true);
    setActionError(null);

    try {
      if (demo) {
        showSuccessBanner("Team member removed");
        setTimeout(() => router.push("/team"), 1000);
        return;
      }

      const authClient = createClient();
      const { data: { session } } = await authClient.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const res = await fetch("/api/team", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: member.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }

      showSuccessBanner("Team member removed");
      setTimeout(() => router.push("/team"), 1000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg">
          {successMessage}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[12px] p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove team member?</h3>
            <p className="text-sm text-gray-600 mb-1">
              This will permanently remove <strong>{member?.fullName}</strong> from your team.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              {activeLeads.length > 0
                ? `Their ${activeLeads.length} assigned lead${activeLeads.length !== 1 ? "s" : ""} will be unassigned.`
                : "This action cannot be undone."}
            </p>
            {actionError && (
              <p className="mb-4 text-sm text-destructive">{actionError}</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setActionError(null); }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReassignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[12px] shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Reassign {activeLeads.length} Lead{activeLeads.length !== 1 ? "s" : ""}</h2>
              <button
                onClick={() => setShowReassignModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 p-2">
              {reassignableUsers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No other active team members.</p>
              ) : (
                reassignableUsers.map((u) => {
                  const isSelected = reassignTarget === u.id;
                  const count = leadCountByUser[u.id] ?? 0;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setReassignTarget(u.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{getInitials(u.fullName)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{u.fullName}</p>
                        <p className="text-xs text-gray-500 capitalize">{u.role}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-700">{count}</p>
                        <p className="text-xs text-gray-400">leads</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {reassignError && (
              <div className="px-5 py-2">
                <p className="text-xs text-destructive">{reassignError}</p>
              </div>
            )}

            <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
              <button
                onClick={() => setShowReassignModal(false)}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={!reassignTarget || reassigning}
                className="flex-1 bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reassigning ? "Reassigning…" : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <Link
        href="/team"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={15} />
        Back to Team
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl font-bold">{getInitials(member.fullName)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{member.fullName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{member.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${ROLE_STYLES[member.role]}`}>
                {member.role}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${member.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {member.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        {isManager && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => { setReassignTarget(null); setReassignError(null); setShowReassignModal(true); }}
              disabled={activeLeads.length === 0}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} />
              Reassign Leads
            </button>
            {canDelete && (
              <button
                onClick={() => { setActionError(null); setShowDeleteConfirm(true); }}
                className="flex items-center gap-1.5 border border-red-200 text-red-600 text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
                Remove Member
              </button>
            )}
          </div>
        )}
      </div>

      {/* Performance */}
      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Performance</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{leads.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total Leads</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{activeLeads.length}</p>
            <p className="text-xs text-gray-500 mt-1">Active</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{conversionRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Conversion</p>
          </div>
        </div>
      </div>

      {/* Assigned Leads */}
      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Assigned Leads</h2>
          <span className="ml-auto text-xs text-gray-400">{activeLeads.length} active</span>
        </div>

        {leadsLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeLeads.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No active leads assigned.</p>
        ) : (
          <div className="space-y-2">
            {activeLeads.slice(0, 10).map((lead) => {
              const slug = stageSlugOf(lead.currentStageId);
              const stageStyle = STAGE_STYLES[slug] ?? "bg-gray-100 text-gray-600";
              const stageLabel = STAGE_LABELS[slug] ?? slug;
              const updatedDate = lead.updatedAt ? new Date(lead.updatedAt) : undefined;
              return (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {lead.firstName} {lead.lastName}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{lead.phone}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stageStyle}`}>
                      {stageLabel}
                    </span>
                    {updatedDate && (
                      <span className="text-xs text-gray-400 hidden sm:inline">
                        {formatRelativeDate(updatedDate)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
            {activeLeads.length > 10 && (
              <p className="text-xs text-gray-400 text-center pt-1">
                +{activeLeads.length - 10} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h2>

        {activitiesLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No recent activity.</p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const dotColor = ACTIVITY_DOT[activity.activityType] ?? "bg-gray-400";
              const date = activity.createdAt ? new Date(activity.createdAt) : undefined;
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />
                    <div className="w-px flex-1 bg-gray-200 mt-1" />
                  </div>
                  <div className="pb-4 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{activity.title}</p>
                    {activity.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                    )}
                    {date && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRelativeDate(date)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
