"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Phone, Mail, Plus, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { useLead, useLeadActivities, useLeadTasks } from "@/hooks/use-leads";
import type { ActivityType } from "@/types";

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

const ACTIVITY_DOT: Record<ActivityType, string> = {
  call: "bg-green-500",
  email: "bg-blue-500",
  meeting: "bg-purple-500",
  note: "bg-gray-400",
  sms: "bg-cyan-500",
  whatsapp: "bg-emerald-500",
  "stage-change": "bg-amber-500",
};

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  sms: "SMS",
  whatsapp: "WhatsApp",
  "stage-change": "Stage change",
};

type Tab = "overview" | "activity" | "qualification" | "followups";

const MOCK_ACTIVITIES = [
  { id: "a1", leadId: "l1", performedBy: "u1", activityType: "call" as ActivityType, title: "Introductory call", description: "Discussed FTB options, interested in 5% deposit scheme.", metadata: null, createdAt: { toDate: () => new Date(Date.now() - 86400000 * 2) } as never },
  { id: "a2", leadId: "l1", performedBy: "u2", activityType: "note" as ActivityType, title: "Note added", description: "Saving deposit target date: April. Wants to act quickly.", metadata: null, createdAt: { toDate: () => new Date(Date.now() - 86400000) } as never },
  { id: "a3", leadId: "l1", performedBy: "u1", activityType: "stage-change" as ActivityType, title: "Moved to Nurturing", description: "Not quite ready — follow up in 3 months.", metadata: null, createdAt: { toDate: () => new Date(Date.now() - 3600000) } as never },
];

const MOCK_TASKS = [
  { id: "t1", leadId: "l1", assignedTo: "u1", createdBy: "u1", title: "Call to check deposit progress", description: null, dueDate: { toDate: () => new Date(Date.now() + 86400000 * 7) } as never, priority: "normal" as const, status: "pending" as const, reminderEmails: [] as never, reminderSent: false, createdAt: null as never },
];

const MOCK_LEAD = {
  id: "l1", firstName: "James", lastName: "Thornton", email: "james.thornton@example.com",
  phone: "+44 7700 900123", source: "website" as const, status: "active" as const,
  currentStageId: "nurturing", assignedTo: "u1", mortgageType: "first-time-buyer" as const,
  readiness: "3-6-months" as const, propertyValue: null, depositAmount: null, loanAmount: null,
  nextFollowUpDate: { toDate: () => new Date(Date.now() + 86400000 * 7) } as never,
  followUpReason: "Saving deposit", followUpNotes: "Target spring purchase",
  tags: [], referredBy: null, importId: null,
  createdAt: { toDate: () => new Date(Date.now() - 86400000 * 10) } as never,
  updatedAt: null as never, convertedAt: null, lostAt: null, lostReason: null,
};

function getInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { lead: firestoreLead, loading } = useLead(id);
  const { activities: firestoreActivities } = useLeadActivities(id);
  const { tasks: firestoreTasks } = useLeadTasks(id);

  const lead = firestoreLead ?? MOCK_LEAD;
  const activities = firestoreActivities.length ? firestoreActivities : MOCK_ACTIVITIES;
  const tasks = firestoreTasks.length ? firestoreTasks : MOCK_TASKS;

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stageStyle = STAGE_STYLES[lead.currentStageId] ?? "bg-gray-100 text-gray-700";
  const stageLabel = STAGE_LABELS[lead.currentStageId] ?? lead.currentStageId;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Notes & Activity" },
    { id: "qualification", label: "Qualification" },
    { id: "followups", label: "Follow-ups" },
  ];

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg font-bold">
              {getInitials(lead.firstName, lead.lastName)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">
              {lead.firstName} {lead.lastName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <button className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${stageStyle}`}>
                {stageLabel}
                <ChevronDown size={12} />
              </button>
              {lead.mortgageType && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {lead.mortgageType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              )}
              <span className="text-xs text-gray-500">via {lead.source}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Phone size={15} />
            Call
          </a>
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Mail size={15} />
              Email
            </a>
          )}
          <button
            onClick={() => setAddingNote(true)}
            className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Plus size={15} />
            Log Activity
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-[12px] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Contact Info</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Phone</p>
                <a href={`tel:${lead.phone}`} className="text-primary font-medium hover:underline">{lead.phone}</a>
              </div>
              {lead.email && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Email</p>
                  <a href={`mailto:${lead.email}`} className="text-primary font-medium hover:underline truncate block">{lead.email}</a>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Source</p>
                <p className="text-gray-700 capitalize">{lead.source}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Readiness</p>
                <p className="text-gray-700">{lead.readiness ?? "Unknown"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Mortgage Type</p>
                <p className="text-gray-700">{lead.mortgageType ?? "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Assigned To</p>
                <p className="text-gray-700">{lead.assignedTo ?? "Unassigned"}</p>
              </div>
            </div>
          </div>

          {lead.nextFollowUpDate && (
            <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-5">
              <h2 className="text-sm font-semibold text-amber-800">Next Follow-up</h2>
              <p className="text-lg font-bold text-amber-900 mt-1">
                {format(lead.nextFollowUpDate.toDate(), "EEEE, d MMMM yyyy")}
              </p>
              {lead.followUpReason && (
                <p className="text-sm text-amber-700 mt-1">{lead.followUpReason}</p>
              )}
              {lead.followUpNotes && (
                <p className="text-sm text-amber-600 mt-0.5 italic">{lead.followUpNotes}</p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="space-y-4">
          {addingNote && (
            <div className="bg-white rounded-[12px] p-4 shadow-sm border border-gray-100">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note…"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                autoFocus
              />
              <div className="flex gap-2 mt-2 justify-end">
                <button
                  onClick={() => { setAddingNote(false); setNoteText(""); }}
                  className="text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button className="text-sm text-white bg-primary px-3 py-1.5 rounded-lg font-semibold hover:bg-primary-dark">
                  Save Note
                </button>
              </div>
            </div>
          )}

          {!addingNote && (
            <button
              onClick={() => setAddingNote(true)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Plus size={16} />
              Add Note
            </button>
          )}

          <div className="space-y-4">
            {activities.map((activity) => {
              const dotColor = ACTIVITY_DOT[activity.activityType] ?? "bg-gray-400";
              const typeLabel = ACTIVITY_LABEL[activity.activityType] ?? activity.activityType;
              const date = activity.createdAt?.toDate?.();
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />
                    <div className="w-px flex-1 bg-gray-200 mt-1" />
                  </div>
                  <div className="pb-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {typeLabel}
                      </span>
                      {date && (
                        <span className="text-xs text-gray-400">
                          {format(date, "d MMM yyyy, HH:mm")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800 mt-1">{activity.title}</p>
                    {activity.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{activity.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "qualification" && (
        <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Qualification Details</h2>
          <div className="space-y-4">
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-xs font-semibold text-gray-500 uppercase px-1">Employment</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Employment Status</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select…</option>
                    <option>Employed</option>
                    <option>Self-employed</option>
                    <option>Contractor</option>
                    <option>Retired</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Annual Income (£)</label>
                  <input type="number" placeholder="0" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-xs font-semibold text-gray-500 uppercase px-1">Credit</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Credit Score Band</label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="">Select…</option>
                    <option>Excellent</option>
                    <option>Good</option>
                    <option>Fair</option>
                    <option>Poor</option>
                    <option>Unknown</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 mt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="rounded accent-primary" />
                    Has CCJs
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="rounded accent-primary" />
                    Has Defaults
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="rounded accent-primary" />
                    Has IVA
                  </label>
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-xs font-semibold text-gray-500 uppercase px-1">Property</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Property Value (£)</label>
                  <input type="number" placeholder="0" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Deposit Amount (£)</label>
                  <input type="number" placeholder="0" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            </fieldset>

            <button className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors">
              Save Qualification
            </button>
          </div>
        </div>
      )}

      {activeTab === "followups" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors">
              <Plus size={15} />
              Schedule Follow-up
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="bg-white rounded-[12px] p-6 text-center text-sm text-gray-400 border border-gray-100">
              No follow-ups scheduled.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const due = task.dueDate?.toDate?.();
                const isOverdue = due ? due < new Date() && task.status === "pending" : false;
                return (
                  <div key={task.id} className={`bg-white rounded-[12px] p-4 shadow-sm border ${isOverdue ? "border-red-200" : "border-gray-100"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                        {due && (
                          <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                            Due {format(due, "d MMM yyyy")}
                          </p>
                        )}
                        {task.reminderEmails?.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Reminders: {(task.reminderEmails as string[]).filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                          task.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : isOverdue
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {isOverdue ? "Overdue" : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
