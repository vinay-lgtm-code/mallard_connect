"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, RefreshCw } from "lucide-react";
import { where, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeDoc, useRealtimeCollection } from "@/hooks/use-realtime";
import { useLeads } from "@/hooks/use-leads";
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

  const { data: member, loading: memberLoading } = useRealtimeDoc<User>(`users/${id}`);
  const { leads, loading: leadsLoading } = useLeads({ assignedTo: id });

  const activityConstraints = [
    where("performedBy", "==", id),
    orderBy("createdAt", "desc"),
    limit(20),
  ];
  const { data: activities, loading: activitiesLoading } = useRealtimeCollection<Activity>(
    "activities",
    activityConstraints
  );

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

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
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
            <button className="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} />
              Reassign Leads
            </button>
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
              const stageStyle = STAGE_STYLES[lead.currentStageId] ?? "bg-gray-100 text-gray-600";
              const stageLabel = STAGE_LABELS[lead.currentStageId] ?? lead.currentStageId;
              const updatedDate = lead.updatedAt?.toDate?.();
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
              const date = activity.createdAt?.toDate?.();
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
