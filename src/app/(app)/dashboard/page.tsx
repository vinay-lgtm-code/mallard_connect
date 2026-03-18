"use client";

import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface KpiCardProps {
  label: string;
  value: number;
  colorClass: string;
  bgClass: string;
}

function KpiCard({ label, value, colorClass, bgClass }: KpiCardProps) {
  return (
    <div className={`rounded-[12px] p-5 ${bgClass}`}>
      <p className={`text-sm font-medium ${colorClass} opacity-80`}>{label}</p>
      <p className={`text-4xl font-bold mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}

const MOCK_KPI = { newLeads: 14, followUpsDue: 7, overdue: 3, dealsClosed: 2 };

const MOCK_PIPELINE_STAGES = [
  { id: "new_enquiry", name: "New Enquiry", count: 14, color: "bg-indigo-500" },
  { id: "initial_contact", name: "Initial Contact", count: 9, color: "bg-blue-500" },
  { id: "not_ready_yet", name: "Not Ready Yet", count: 21, color: "bg-amber-500" },
  { id: "nurturing", name: "Nurturing", count: 11, color: "bg-green-500" },
  { id: "ready_to_proceed", name: "Ready to Proceed", count: 5, color: "bg-blue-600" },
  { id: "referred_to_mab", name: "Referred to MAB", count: 8, color: "bg-purple-500" },
];

const MOCK_TEAM_ACTIVITY = [
  { id: "1", initials: "SW", name: "Sarah W.", action: "moved", leadName: "James Thornton", stage: "Ready to Proceed", ts: new Date(Date.now() - 1000 * 60 * 12) },
  { id: "2", initials: "DM", name: "David M.", action: "called", leadName: "Priya Sharma", stage: "", ts: new Date(Date.now() - 1000 * 60 * 34) },
  { id: "3", initials: "EL", name: "Emma L.", action: "added note on", leadName: "Tom Baker", stage: "", ts: new Date(Date.now() - 1000 * 60 * 58) },
  { id: "4", initials: "SW", name: "Sarah W.", action: "scheduled follow-up for", leadName: "Ayesha Patel", stage: "", ts: new Date(Date.now() - 1000 * 60 * 90) },
  { id: "5", initials: "DM", name: "David M.", action: "imported", leadName: "12 new leads", stage: "", ts: new Date(Date.now() - 1000 * 60 * 120) },
];

const MOCK_MY_FOLLOWUPS = [
  { id: "1", name: "James Thornton", phone: "+44 7700 900123", context: "Saving deposit — target spring", status: "overdue" as const },
  { id: "2", name: "Priya Sharma", phone: "+44 7911 123456", context: "Improving credit score", status: "due_today" as const },
  { id: "3", name: "Tom Baker", phone: "+44 7800 654321", context: "Waiting for P60 documents", status: "planned" as const },
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

function ManagerDashboard() {
  const total = MOCK_PIPELINE_STAGES.reduce((s, st) => s + st.count, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="New Leads" value={MOCK_KPI.newLeads} colorClass="text-indigo-700" bgClass="bg-indigo-50" />
        <KpiCard label="Follow-ups Due" value={MOCK_KPI.followUpsDue} colorClass="text-amber-700" bgClass="bg-amber-50" />
        <KpiCard label="Overdue" value={MOCK_KPI.overdue} colorClass="text-red-700" bgClass="bg-red-50" />
        <KpiCard label="Deals Closed" value={MOCK_KPI.dealsClosed} colorClass="text-green-700" bgClass="bg-green-50" />
      </div>

      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Pipeline Health</h2>
        <div className="flex rounded-lg overflow-hidden h-6">
          {MOCK_PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.id}
              className={`${stage.color} flex-none`}
              style={{ width: `${(stage.count / total) * 100}%` }}
              title={`${stage.name}: ${stage.count}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
          {MOCK_PIPELINE_STAGES.map((stage) => (
            <div key={stage.id} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
              <span className="text-xs text-gray-600">{stage.name} <span className="font-semibold">{stage.count}</span></span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Team Activity</h2>
        <div className="space-y-4">
          {MOCK_TEAM_ACTIVITY.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{item.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{item.name}</span>{" "}
                  {item.action}{" "}
                  <span className="font-medium">{item.leadName}</span>
                  {item.stage && <> → <span className="text-primary">{item.stage}</span></>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDistanceToNow(item.ts, { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdvisorDashboard({ name }: { name: string }) {
  const followUpsDue = MOCK_MY_FOLLOWUPS.filter((f) => f.status !== "planned").length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const total = MOCK_PIPELINE_STAGES.reduce((s, st) => s + st.count, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="bg-primary rounded-[12px] px-5 py-4 text-white">
        <p className="text-lg font-bold">{greeting}, {name.split(" ")[0]}.</p>
        <p className="text-white/80 text-sm mt-0.5">
          You have <span className="font-semibold text-accent">{followUpsDue}</span> follow-up{followUpsDue !== 1 ? "s" : ""} due today.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Today&apos;s Follow-ups</h2>
        <div className="space-y-3">
          {MOCK_MY_FOLLOWUPS.map((item) => (
            <div key={item.id} className="bg-white rounded-[12px] p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                  <a href={`tel:${item.phone}`} className="text-primary text-sm font-medium mt-0.5 block hover:underline">
                    {item.phone}
                  </a>
                  <p className="text-xs text-gray-500 mt-1">{item.context}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[item.status]}`}>
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">My Pipeline</h2>
        <div className="flex rounded-lg overflow-hidden h-4">
          {MOCK_PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.id}
              className={`${stage.color} flex-none`}
              style={{ width: `${(stage.count / total) * 100}%` }}
              title={`${stage.name}: ${stage.count}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {MOCK_PIPELINE_STAGES.map((stage) => (
            <div key={stage.id} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${stage.color}`} />
              <span className="text-xs text-gray-600">{stage.name} <span className="font-semibold">{stage.count}</span></span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">New Assignments</h2>
        <div className="space-y-2">
          {[
            { id: "a1", name: "Olivia Chen", type: "First-time buyer", source: "Website", assignedAt: "Today, 09:14" },
            { id: "a2", name: "Marcus Reid", type: "Remortgage", source: "Referral", assignedAt: "Yesterday, 16:30" },
          ].map((lead) => (
            <div key={lead.id} className="bg-white rounded-[12px] px-4 py-3 shadow-sm border border-gray-100 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-gray-900">{lead.name}</p>
                <p className="text-xs text-gray-500">{lead.type} · {lead.source}</p>
              </div>
              <p className="text-xs text-gray-400 flex-shrink-0">{lead.assignedAt}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const isManager = user.role === "admin" || user.role === "manager";

  return isManager ? (
    <ManagerDashboard />
  ) : (
    <AdvisorDashboard name={user.fullName ?? "there"} />
  );
}
