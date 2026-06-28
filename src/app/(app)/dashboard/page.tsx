"use client";

import { useAuth } from "@/hooks/useAuth";
import { useLeads, useRecentActivities, useTenantUsers } from "@/hooks/use-leads";
import { useTodayTasks, useOverdueTasks } from "@/hooks/use-tasks";
import { useWeeklyActivitySummary } from "@/hooks/use-weekly-activity-summary";
import { formatDistanceToNow } from "date-fns";
import { getInitials } from "@/lib/utils";
import { hasCapability } from "@/lib/auth/roles";
import { SectionLabel } from "@/components/ui/section-label";
import type { Activity, User } from "@/types";

interface KpiCardProps {
  label: string;
  value: number;
  colorClass: string;
  bgClass: string;
  borderAccent?: string;
}

function KpiCard({ label, value, colorClass, bgClass, borderAccent = "border-l-primary" }: KpiCardProps) {
  return (
    <div className={`rounded-[12px] p-5 border-l-3 ${borderAccent} ${bgClass}`}>
      <p className={`text-sm font-medium ${colorClass} opacity-80`}>{label}</p>
      <p className={`text-4xl font-bold mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}

const PIPELINE_STAGE_CONFIG = [
  { id: "new_enquiry", name: "New Enquiry", color: "bg-[#1A5653]" },
  { id: "initial_contact", name: "Initial Contact", color: "bg-[#3B82F6]" },
  { id: "not_ready_yet", name: "Not proceeded.", color: "bg-[#F59E0B]" },
  { id: "nurturing", name: "Nurturing", color: "bg-[#7C3AED]" },
  { id: "decision_in_principle_done", name: "Decision in Principle done", color: "bg-[#22C55E]" },
  { id: "ready_to_proceed", name: "Ready to proceed", color: "bg-[#22C55E]" },
  { id: "referred_to_mab", name: "Deal Done", color: "bg-[#64748B]" },
];

const STATUS_STYLES = {
  overdue: "bg-red-100 text-red-700",
  due_today: "bg-amber-100 text-amber-700",
  planned: "bg-blue-100 text-blue-700",
};

const STATUS_LABELS = {
  overdue: "Overdue",
  due_today: "Due today",
  planned: "Planned",
};

const ACTIVITY_ACTION_LABEL: Record<string, string> = {
  call: "called",
  email: "emailed",
  meeting: "met with",
  note: "added note on",
  sms: "sent SMS to",
  whatsapp: "WhatsApp'd",
  "stage-change": "moved",
};

function useDashboardData(userId: string, isManager: boolean) {
  const { leads, loading: leadsLoading } = useLeads(
    isManager ? undefined : { assignedTo: userId }
  );
  const { tasks: todayTasks, loading: todayLoading } = useTodayTasks(
    isManager ? "__manager__" : userId
  );
  const { tasks: overdueTasks, loading: overdueLoading } = useOverdueTasks(
    isManager ? "__manager__" : userId
  );
  const { activities, loading: activitiesLoading } = useRecentActivities(10);
  const { users } = useTenantUsers();

  const filteredTodayTasks = isManager ? todayTasks : todayTasks.filter((t) => t.assignedTo === userId);
  const filteredOverdueTasks = isManager
    ? overdueTasks
    : overdueTasks.filter((t) => t.assignedTo === userId);

  return {
    leads,
    todayTasks: filteredTodayTasks,
    overdueTasks: filteredOverdueTasks,
    activities,
    users,
    loading: leadsLoading || todayLoading || overdueLoading || activitiesLoading,
  };
}

function WeeklyActivitySummary({ users }: { users: (User & { id: string })[] }) {
  const { summary, loading } = useWeeklyActivitySummary();
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = users.map((u) => {
    const counts = summary.find((s) => s.userId === u.id);
    return { userId: u.id, thisWeek: counts?.thisWeek ?? 0, lastWeek: counts?.lastWeek ?? 0 };
  }).sort((a, b) => (b.thisWeek + b.lastWeek) - (a.thisWeek + a.lastWeek));

  return (
    <div className="bg-white rounded-[12px] p-5 border border-border">
      <SectionLabel>Weekly Activity</SectionLabel>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.every((r) => r.thisWeek === 0 && r.lastWeek === 0) ? (
        <p className="text-sm text-text-muted text-center py-4">No activity in the last two weeks.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-mono font-medium uppercase tracking-wider text-text-muted">
              <th className="pb-3">Team Member</th>
              <th className="pb-3 text-right">This Week</th>
              <th className="pb-3 text-right">Last Week</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const u = userMap.get(row.userId);
              const name = u?.fullName ?? row.userId;
              const initials = u ? getInitials(u.fullName) : row.userId.slice(0, 2).toUpperCase();
              return (
                <tr key={row.userId}>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{initials}</span>
                      </div>
                      <span className="font-medium text-text-secondary">{name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-semibold text-text-primary">{row.thisWeek}</td>
                  <td className="py-2.5 text-right font-semibold text-text-primary">{row.lastWeek}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ManagerDashboard({ userId }: { userId: string }) {
  const { leads, todayTasks, overdueTasks, activities, users, loading } = useDashboardData(userId, true);

  const newLeads = leads.filter((l) => l.currentStageId === "new_enquiry").length;
  const dealsClosed = leads.filter((l) => l.status === "converted").length;

  const pipelineStages = PIPELINE_STAGE_CONFIG.map((cfg) => ({
    ...cfg,
    count: leads.filter((l) => l.currentStageId === cfg.id).length,
  }));
  const total = pipelineStages.reduce((s, st) => s + st.count, 0);

  const userMap = new Map(users.map((u: User) => [u.id, u]));

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="New Leads" value={newLeads} colorClass="text-indigo-700" bgClass="bg-indigo-50" />
        <KpiCard label="Follow-ups Due" value={todayTasks.length} colorClass="text-amber-700" bgClass="bg-amber-50" />
        <KpiCard label="Overdue" value={overdueTasks.length} colorClass="text-red-700" bgClass="bg-red-50" borderAccent="border-l-accent-warm" />
        <KpiCard label="Deals Closed" value={dealsClosed} colorClass="text-green-700" bgClass="bg-green-50" />
      </div>

      <div className="bg-white rounded-[12px] p-5 border border-border">
        <SectionLabel>Pipeline Health</SectionLabel>
        {total === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No leads in pipeline yet.</p>
        ) : (
          <>
            <div className="flex w-full rounded-lg overflow-hidden h-6" aria-hidden="true">
              {pipelineStages.filter((s) => s.count > 0).map((stage) => (
                <div
                  key={stage.id}
                  className={`${stage.color} flex-none`}
                  style={{ width: `${(stage.count / total) * 100}%` }}
                  title={`${stage.name}: ${stage.count}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
              {pipelineStages.map((stage) => (
                <div key={stage.id} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                  <span className="text-sm text-text-secondary">{stage.name} <span className="font-semibold text-text-primary">{stage.count}</span></span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <WeeklyActivitySummary users={users} />

      <div className="bg-white rounded-[12px] p-5 border border-border">
        <SectionLabel>Team Activity</SectionLabel>
        {activities.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No recent activity.</p>
        ) : (
          <div className="space-y-4">
            {activities.map((item: Activity) => {
              const performer = userMap.get(item.performedBy);
              const name = performer?.fullName ?? item.performedBy;
              const initials = performer ? getInitials(performer.fullName) : item.performedBy.slice(0, 2).toUpperCase();
              const action = ACTIVITY_ACTION_LABEL[item.activityType] ?? item.activityType;
              const ts = item.createdAt ? new Date(item.createdAt) : new Date();
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-secondary">
                      <span className="font-medium">{name}</span>{" "}
                      {action}{" "}
                      <span className="font-medium">{item.title}</span>
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatDistanceToNow(ts, { addSuffix: true })}
                    </p>
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

function AdvisorDashboard({ userId, name }: { userId: string; name: string }) {
  const { leads, todayTasks, overdueTasks, loading } = useDashboardData(userId, false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const newAssignments = leads.filter((l) => {
    const created = l.createdAt ? new Date(l.createdAt) : undefined;
    return created ? created >= fortyEightHoursAgo : false;
  });

  const pipelineStages = PIPELINE_STAGE_CONFIG.map((cfg) => ({
    ...cfg,
    count: leads.filter((l) => l.currentStageId === cfg.id).length,
  }));
  const total = pipelineStages.reduce((s, st) => s + st.count, 0);

  const allDueTasks = [
    ...overdueTasks.map((t) => ({ ...t, _status: "overdue" as const })),
    ...todayTasks.map((t) => ({ ...t, _status: "due_today" as const })),
  ];
  const followUpsDue = allDueTasks.length;

  const leadMap = new Map(leads.map((l) => [l.id, l]));

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="bg-primary rounded-[12px] px-5 py-4 text-white">
        <p className="text-lg font-bold">{greeting}, {name.split(" ")[0]}.</p>
        <p className="text-white/80 text-sm mt-0.5">
          You have <span className="font-semibold text-accent">{followUpsDue}</span> follow-up{followUpsDue !== 1 ? "s" : ""} due today.
        </p>
      </div>

      <div>
        <SectionLabel>Today&apos;s Follow-ups</SectionLabel>
        {allDueTasks.length === 0 ? (
          <div className="bg-white rounded-[12px] p-6 text-center text-sm text-text-muted border border-border">
            No follow-ups due today.
          </div>
        ) : (
          <div className="space-y-3">
            {allDueTasks.map((task) => {
              const lead = leadMap.get(task.leadId);
              const leadName = lead ? `${lead.firstName} ${lead.lastName}` : task.leadId;
              const phone = lead?.phone ?? "";
              return (
                <div key={task.id} className="bg-white rounded-[12px] p-4 border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary text-sm">{leadName}</p>
                      {phone && (
                        <a href={`tel:${phone}`} className="font-mono text-primary text-sm font-medium mt-0.5 block hover:underline">
                          {phone}
                        </a>
                      )}
                      <p className="text-xs text-text-secondary mt-1">{task.title}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[task._status]}`}>
                      {STATUS_LABELS[task._status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[12px] p-5 border border-border">
        <SectionLabel>My Pipeline</SectionLabel>
        {total === 0 ? (
          <p className="text-sm text-text-muted text-center py-2">No leads assigned yet.</p>
        ) : (
          <>
            <div className="flex w-full rounded-lg overflow-hidden h-6" aria-hidden="true">
              {pipelineStages.filter((s) => s.count > 0).map((stage) => (
                <div
                  key={stage.id}
                  className={`${stage.color} flex-none`}
                  style={{ width: `${(stage.count / total) * 100}%` }}
                  title={`${stage.name}: ${stage.count}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
              {pipelineStages.map((stage) => (
                <div key={stage.id} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                  <span className="text-sm text-text-secondary">{stage.name} <span className="font-semibold text-text-primary">{stage.count}</span></span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div>
        <SectionLabel>New Assignments</SectionLabel>
        {newAssignments.length === 0 ? (
          <div className="bg-white rounded-[12px] p-6 text-center text-sm text-text-muted border border-border">
            No new assignments in the last 48 hours.
          </div>
        ) : (
          <div className="space-y-2">
            {newAssignments.map((lead) => {
              const created = lead.createdAt ? new Date(lead.createdAt) : new Date();
              const assignedAt = formatDistanceToNow(created, { addSuffix: true });
              return (
                <div key={lead.id} className="bg-white rounded-[12px] px-4 py-3 border border-border flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-text-primary">{lead.firstName} {lead.lastName}</p>
                    <p className="text-xs text-text-secondary">{lead.mortgageType ?? "Unknown type"} · {lead.source}</p>
                  </div>
                  <p className="text-xs text-text-muted flex-shrink-0">{assignedAt}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const isManager = hasCapability(user.role, "viewAllPipeline");

  return isManager ? (
    <ManagerDashboard userId={user.id} />
  ) : (
    <AdvisorDashboard userId={user.id} name={user.fullName ?? "there"} />
  );
}
