"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Phone, Mail, Plus, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import {
  addDoc,
  updateDoc,
  doc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useLead, useLeadActivities, useLeadTasks } from "@/hooks/use-leads";
import { useAuth } from "@/hooks/useAuth";
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

function getInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

interface FollowUpModalProps {
  leadId: string;
  userId: string;
  onClose: () => void;
}

function FollowUpModal({ leadId, userId, onClose }: FollowUpModalProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [email1, setEmail1] = useState("");
  const [email2, setEmail2] = useState("");
  const [email3, setEmail3] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    setSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, "tasks"), {
        leadId,
        assignedTo: userId,
        createdBy: userId,
        title: title.trim(),
        description: null,
        dueDate: Timestamp.fromDate(new Date(dueDate)),
        priority: "normal",
        status: "pending",
        reminderEmails: [email1, email2, email3].filter(Boolean),
        reminderSent: false,
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      console.error("Failed to create follow-up:", err);
      setError("Failed to schedule follow-up. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-[12px] p-6 shadow-xl w-full max-w-sm mx-4">
        <h2 className="text-base font-bold text-gray-900 mb-4">Schedule Follow-up</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Follow up call…"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              min={new Date().toISOString().split("T")[0]}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Emails (optional)</label>
            <div className="space-y-2">
              {[
                { val: email1, set: setEmail1, ph: "advisor@mallard.co.uk" },
                { val: email2, set: setEmail2, ph: "manager@mallard.co.uk" },
                { val: email3, set: setEmail3, ph: "extra@mallard.co.uk" },
              ].map(({ val, set: setter, ph }, i) => (
                <input
                  key={i}
                  type="email"
                  value={val}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={ph}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm text-white bg-primary px-4 py-1.5 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-60"
            >
              {saving ? "Saving…" : "Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();

  const { lead, loading } = useLead(id);
  const { activities } = useLeadActivities(id);
  const { tasks } = useLeadTasks(id);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  // Qualification state — controlled, pre-populated from lead
  const [qualEmployment, setQualEmployment] = useState("");
  const [qualIncome, setQualIncome] = useState("");
  const [qualCreditBand, setQualCreditBand] = useState("");
  const [qualHasCCJs, setQualHasCCJs] = useState(false);
  const [qualHasDefaults, setQualHasDefaults] = useState(false);
  const [qualHasIVA, setQualHasIVA] = useState(false);
  const [qualPropertyValue, setQualPropertyValue] = useState("");
  const [qualDepositAmount, setQualDepositAmount] = useState("");
  const [savingQual, setSavingQual] = useState(false);
  const [qualSaved, setQualSaved] = useState(false);

  // Pre-populate qualification fields from lead when it first loads
  const [qualPopulated, setQualPopulated] = useState(false);
  if (lead && !qualPopulated) {
    setQualPropertyValue(lead.propertyValue ? String(lead.propertyValue) : "");
    setQualDepositAmount(lead.depositAmount ? String(lead.depositAmount) : "");
    setQualPopulated(true);
  }

  async function handleSaveNote() {
    if (!noteText.trim() || !user) return;
    setSavingNote(true);
    try {
      await addDoc(collection(db, "leads", id, "activities"), {
        leadId: id,
        performedBy: user.id,
        activityType: "note",
        title: "Note added",
        description: noteText,
        metadata: null,
        createdAt: serverTimestamp(),
      });
      setNoteText("");
      setAddingNote(false);
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSaveQualification() {
    if (!user) return;
    setSavingQual(true);
    setQualSaved(false);
    try {
      await updateDoc(doc(db, "leads", id), {
        propertyValue: qualPropertyValue ? Number(qualPropertyValue) : null,
        depositAmount: qualDepositAmount ? Number(qualDepositAmount) : null,
        updatedAt: serverTimestamp(),
      });
      setQualSaved(true);
      setTimeout(() => setQualSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save qualification:", err);
    } finally {
      setSavingQual(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Lead not found.</p>
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
    <>
      {showFollowUpModal && user && (
        <FollowUpModal
          leadId={id}
          userId={user.id}
          onClose={() => setShowFollowUpModal(false)}
        />
      )}

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
              onClick={() => { setAddingNote(true); setActiveTab("activity"); }}
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
                  {format(
                    lead.nextFollowUpDate instanceof Date
                      ? lead.nextFollowUpDate
                      : (lead.nextFollowUpDate as { toDate: () => Date }).toDate(),
                    "EEEE, d MMMM yyyy"
                  )}
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
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote || !noteText.trim()}
                    className="text-sm text-white bg-primary px-3 py-1.5 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-60"
                  >
                    {savingNote ? "Saving…" : "Save Note"}
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

            {activities.length === 0 ? (
              <div className="bg-white rounded-[12px] p-6 text-center text-sm text-gray-400 border border-gray-100">
                No activity recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const dotColor = ACTIVITY_DOT[activity.activityType] ?? "bg-gray-400";
                  const typeLabel = ACTIVITY_LABEL[activity.activityType] ?? activity.activityType;
                  const date = activity.createdAt instanceof Date
                    ? activity.createdAt
                    : (activity.createdAt as { toDate?: () => Date })?.toDate?.();
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
            )}
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
                    <select
                      value={qualEmployment}
                      onChange={(e) => setQualEmployment(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
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
                    <input
                      type="number"
                      value={qualIncome}
                      onChange={(e) => setQualIncome(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="text-xs font-semibold text-gray-500 uppercase px-1">Credit</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Credit Score Band</label>
                    <select
                      value={qualCreditBand}
                      onChange={(e) => setQualCreditBand(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
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
                      <input
                        type="checkbox"
                        checked={qualHasCCJs}
                        onChange={(e) => setQualHasCCJs(e.target.checked)}
                        className="rounded accent-primary"
                      />
                      Has CCJs
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qualHasDefaults}
                        onChange={(e) => setQualHasDefaults(e.target.checked)}
                        className="rounded accent-primary"
                      />
                      Has Defaults
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qualHasIVA}
                        onChange={(e) => setQualHasIVA(e.target.checked)}
                        className="rounded accent-primary"
                      />
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
                    <input
                      type="number"
                      value={qualPropertyValue}
                      onChange={(e) => setQualPropertyValue(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Deposit Amount (£)</label>
                    <input
                      type="number"
                      value={qualDepositAmount}
                      onChange={(e) => setQualDepositAmount(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </fieldset>

              <button
                onClick={handleSaveQualification}
                disabled={savingQual}
                className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
              >
                {savingQual ? "Saving…" : qualSaved ? "Saved!" : "Save Qualification"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "followups" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowFollowUpModal(true)}
                className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
              >
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
                  const due = task.dueDate instanceof Date
                    ? task.dueDate
                    : (task.dueDate as { toDate?: () => Date } | null)?.toDate?.();
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
                          {task.reminderEmails && (task.reminderEmails as string[]).filter(Boolean).length > 0 && (
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
    </>
  );
}
