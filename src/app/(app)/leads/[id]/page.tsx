"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { Phone, Mail, Plus, ChevronDown, Check, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { useLead, useLeadActivities, useLeadTasks, useTenantUsers } from "@/hooks/use-leads";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { QuickLogBar } from "@/components/leads/quick-log-bar";
import { AssignLeadModal } from "@/components/leads/assign-lead-modal";
import { isDemoUser } from "@/lib/mock-data";
import type { LogActivityPayload } from "@/components/leads/log-activity-modal";
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
  tenantId: string;
  demo: boolean;
  onClose: (saved: boolean) => void;
}

function FollowUpModal({ leadId, userId, tenantId, demo, onClose }: FollowUpModalProps) {
  const supabase = useSupabase();
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
      if (!demo && supabase) {
        await supabase.from("tasks").insert({
          tenant_id: tenantId,
          lead_id: leadId,
          assigned_to: userId,
          created_by: userId,
          title: title.trim(),
          description: null,
          due_date: new Date(dueDate).toISOString(),
          priority: "normal",
          status: "pending",
          reminder_emails: [email1, email2, email3].filter(Boolean),
          reminder_sent: false,
        });
      }
      onClose(true);
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
              onClick={() => onClose(false)}
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

const MORTGAGE_TYPE_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "first-time-buyer", label: "First-time Buyer" },
  { value: "remortgage", label: "Remortgage" },
  { value: "self-employed", label: "Self-employed" },
  { value: "buy-to-let", label: "Buy-to-let" },
  { value: "other", label: "Other" },
];

const READINESS_OPTIONS = [
  { value: "", label: "Unknown" },
  { value: "ready-now", label: "Ready now" },
  { value: "1-3-months", label: "1–3 months" },
  { value: "3-6-months", label: "3–6 months" },
  { value: "6-12-months", label: "6–12 months" },
  { value: "exploring", label: "Just exploring" },
];

interface OverviewTabProps {
  lead: { phone: string; email: string | null; mortgageType: string | null; readiness: string | null; assignedTo: string; nextFollowUpDate: string | null; followUpReason: string | null; followUpNotes: string | null };
  leadId: string;
  demo: boolean;
  supabase: ReturnType<typeof useSupabase>;
  userNameById: Record<string, string>;
  onShowAssignModal: () => void;
  onSaved: () => void;
}

function OverviewTab({ lead, leadId, demo, supabase, userNameById, onShowAssignModal, onSaved }: OverviewTabProps) {
  const [phone, setPhone] = useState(lead.phone);
  const [email, setEmail] = useState(lead.email ?? "");
  const [mortgageType, setMortgageType] = useState(lead.mortgageType ?? "");
  const [readiness, setReadiness] = useState(lead.readiness ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    phone !== lead.phone ||
    email !== (lead.email ?? "") ||
    mortgageType !== (lead.mortgageType ?? "") ||
    readiness !== (lead.readiness ?? "");

  async function handleSave() {
    setSaving(true);
    try {
      if (!demo && supabase) {
        await supabase.from("leads").update({
          phone: phone.trim(),
          email: email.trim() || null,
          mortgage_type: mortgageType || null,
          readiness: readiness || null,
          updated_at: new Date().toISOString(),
        }).eq("id", leadId);
        onSaved();
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save overview:", err);
    } finally {
      setSaving(false);
    }
  }

  const assigneeName = lead.assignedTo ? (userNameById[lead.assignedTo] ?? "Unknown") : "Unassigned";

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Contact Info</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide font-medium">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="—"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide font-medium">Mortgage Type</label>
            <select
              value={mortgageType}
              onChange={(e) => setMortgageType(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              {MORTGAGE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide font-medium">Readiness</label>
            <select
              value={readiness}
              onChange={(e) => setReadiness(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              {READINESS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-400 uppercase tracking-wide font-medium">Assigned To</label>
            <button
              onClick={onShowAssignModal}
              className="mt-1 w-full text-left border border-gray-300 rounded-lg px-3 py-2 text-sm text-primary font-medium hover:bg-gray-50 flex items-center justify-between"
            >
              {assigneeName}
              <UserPlus size={14} className="text-gray-400" />
            </button>
          </div>
        </div>

        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </button>
        )}
        {saved && !dirty && (
          <p className="text-center text-sm text-green-600 font-medium">Saved!</p>
        )}
      </div>

      {lead.nextFollowUpDate && (
        <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-5">
          <h2 className="text-sm font-semibold text-amber-800">Next Follow-up</h2>
          <p className="text-lg font-bold text-amber-900 mt-1">
            {format(new Date(lead.nextFollowUpDate), "EEEE, d MMMM yyyy")}
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
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();

  const demo = user ? isDemoUser(user.id) : false;

  const { lead, loading, refetch: refetchLead } = useLead(id);
  const { activities, refetch: refetchActivities } = useLeadActivities(id);
  const { tasks, refetch: refetchTasks } = useLeadTasks(id);
  const { users } = useTenantUsers();
  const supabase = useSupabase();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [localStageOverride, setLocalStageOverride] = useState<string | null>(null);

  const [slugToId, setSlugToId] = useState<Record<string, string>>({});
  const [idToSlug, setIdToSlug] = useState<Record<string, string>>({});

  useEffect(() => {
    if (demo || !supabase || !user?.tenantId) return;
    supabase
      .from("pipeline_stages")
      .select("id, slug")
      .eq("tenant_id", user.tenantId)
      .then(({ data }) => {
        if (!data) return;
        const s2i: Record<string, string> = {};
        const i2s: Record<string, string> = {};
        for (const row of data) {
          s2i[row.slug] = row.id;
          i2s[row.id] = row.slug;
        }
        setSlugToId(s2i);
        setIdToSlug(i2s);
      });
  }, [demo, supabase, user?.tenantId]);

  const userNameById = (() => {
    const map: Record<string, string> = {};
    for (const u of users) map[u.id] = u.fullName;
    return map;
  })();

  const stageDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(e.target as Node)) {
        setStageDropdownOpen(false);
      }
    }
    if (stageDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [stageDropdownOpen]);

  // Qualification state — controlled, pre-populated from lead
  const [qualEmployment, setQualEmployment] = useState("");
  const [qualIncome, setQualIncome] = useState("");
  const [qualCreditBand, setQualCreditBand] = useState("");
  const [qualHasCCJs, setQualHasCCJs] = useState(false);
  const [qualHasDefaults, setQualHasDefaults] = useState(false);
  const [qualHasIVA, setQualHasIVA] = useState(false);
  const [qualPropertyValue, setQualPropertyValue] = useState("");
  const [qualDepositAmount, setQualDepositAmount] = useState("");
  const [qualDealValue, setQualDealValue] = useState("");
  const [qualEstimatedCloseDate, setQualEstimatedCloseDate] = useState("");
  const [qualConfidence, setQualConfidence] = useState("");
  const [savingQual, setSavingQual] = useState(false);
  const [qualSaved, setQualSaved] = useState(false);

  // Pre-populate qualification fields from lead when it first loads
  const [qualPopulated, setQualPopulated] = useState(false);
  if (lead && !qualPopulated) {
    setQualPropertyValue(lead.propertyValue ? String(lead.propertyValue) : "");
    setQualDepositAmount(lead.depositAmount ? String(lead.depositAmount) : "");
    setQualDealValue(lead.dealValue ? String(lead.dealValue) : "");
    setQualEstimatedCloseDate(
      lead.estimatedCloseDate
        ? new Date(lead.estimatedCloseDate).toISOString().split("T")[0]
        : ""
    );
    setQualConfidence(lead.confidence != null ? String(lead.confidence) : "");
    setQualPopulated(true);
  }

  async function handleSaveNote() {
    if (!noteText.trim() || !user) return;
    setSavingNote(true);
    try {
      if (!demo && supabase) {
        await supabase.from("activities").insert({
          tenant_id: user.tenantId,
          lead_id: id,
          performed_by: user.id,
          activity_type: "note",
          title: "Note added",
          description: noteText,
          metadata: null,
        });
        refetchActivities();
      }
      setNoteText("");
      setAddingNote(false);
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleStageChange(stageSlug: string) {
    setStageDropdownOpen(false);
    if (!user) return;

    if (demo) {
      setLocalStageOverride(stageSlug);
      return;
    }

    if (!supabase) return;
    const stageUuid = slugToId[stageSlug] ?? stageSlug;
    try {
      await supabase.from("leads").update({
        current_stage_id: stageUuid,
        current_stage_entered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      await supabase.from("activities").insert({
        tenant_id: user.tenantId,
        lead_id: id,
        performed_by: user.id,
        activity_type: "stage-change",
        title: `Stage changed to ${STAGE_LABELS[stageSlug] ?? stageSlug}`,
        description: null,
        metadata: null,
      });
      refetchLead();
      refetchActivities();
    } catch (err) {
      console.error("Failed to change stage:", err);
    }
  }

  async function handleLogActivity(payload: LogActivityPayload) {
    if (!user) return;
    if (!demo && supabase) {
      try {
        await supabase.from("activities").insert({
          tenant_id: user.tenantId,
          lead_id: id,
          performed_by: user.id,
          activity_type: payload.activityType,
          title: payload.title,
          description: payload.description || null,
          metadata: Object.keys(payload.metadata).length > 0 ? payload.metadata : null,
        });
        refetchActivities();
      } catch (err) {
        console.error("Failed to log activity:", err);
      }
    }
  }

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    if (!demo && supabase) {
      try {
        await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
        refetchTasks();
      } catch (err) {
        console.error("Failed to update task:", err);
      }
    }
  }

  async function handleSaveQualification() {
    if (!user) return;
    setSavingQual(true);
    setQualSaved(false);
    try {
      if (!demo && supabase) {
        await supabase.from("leads").update({
          property_value: qualPropertyValue ? Number(qualPropertyValue) : null,
          deposit_amount: qualDepositAmount ? Number(qualDepositAmount) : null,
          deal_value: qualDealValue ? Number(qualDealValue) : null,
          estimated_close_date: qualEstimatedCloseDate || null,
          confidence: qualConfidence ? Number(qualConfidence) : null,
        }).eq("id", id);
      }
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

  const currentSlug = localStageOverride
    ?? (lead.currentStageId
      ? (idToSlug[lead.currentStageId] ?? lead.currentStageId)
      : "new_enquiry");
  const stageStyle = STAGE_STYLES[currentSlug] ?? "bg-gray-100 text-gray-700";
  const stageLabel = STAGE_LABELS[currentSlug] ?? currentSlug;

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
          tenantId={user.tenantId}
          demo={demo}
          onClose={() => { setShowFollowUpModal(false); refetchTasks(); }}
        />
      )}

      {showAssignModal && (
        <AssignLeadModal
          leadId={id}
          currentAssignee={lead.assignedTo}
          demo={demo}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => { setShowAssignModal(false); refetchLead(); refetchActivities(); }}
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
                <div className="relative" ref={stageDropdownRef}>
                  <button
                    onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${stageStyle}`}
                  >
                    {stageLabel}
                    <ChevronDown size={12} />
                  </button>
                  {stageDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[180px]">
                      {Object.entries(STAGE_LABELS)
                        .filter(([key]) => key !== currentSlug)
                        .map(([key, label]) => (
                          <button
                            key={key}
                            onClick={() => handleStageChange(key)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                          >
                            <span className={`w-2 h-2 rounded-full ${STAGE_STYLES[key]?.split(" ")[0] ?? "bg-gray-200"}`} />
                            {label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                {lead.mortgageType && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {lead.mortgageType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                )}
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
          <OverviewTab
            lead={lead}
            leadId={id}
            demo={demo}
            supabase={supabase}
            userNameById={userNameById}
            onShowAssignModal={() => setShowAssignModal(true)}
            onSaved={refetchLead}
          />
        )}

        {activeTab === "activity" && (
          <div className="space-y-4">
            <QuickLogBar prospectName={`${lead.firstName} ${lead.lastName}`} onLogged={handleLogActivity} />
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
                  const date = activity.createdAt ? new Date(activity.createdAt) : undefined;
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

              <fieldset className="border border-gray-200 rounded-lg p-4">
                <legend className="text-xs font-semibold text-gray-500 uppercase px-1">Deal</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Est. Commission (£)</label>
                    <input
                      type="number"
                      value={qualDealValue}
                      onChange={(e) => setQualDealValue(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Est. Close Date</label>
                    <input
                      type="date"
                      value={qualEstimatedCloseDate}
                      onChange={(e) => setQualEstimatedCloseDate(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Confidence (%)</label>
                    <input
                      type="number"
                      value={qualConfidence}
                      onChange={(e) => setQualConfidence(e.target.value)}
                      placeholder="0"
                      min={0}
                      max={100}
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
                  const due = task.dueDate ? new Date(task.dueDate) : undefined;
                  const isOverdue = due ? due < new Date() && task.status === "pending" : false;
                  return (
                    <div key={task.id} className={`bg-white rounded-[12px] p-4 shadow-sm border ${isOverdue ? "border-red-200" : "border-gray-100"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handleToggleTask(task.id, task.status)}
                            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              task.status === "completed"
                                ? "border-green-500 bg-green-500"
                                : "border-gray-300 hover:border-primary"
                            }`}
                          >
                            {task.status === "completed" && <Check size={12} className="text-white" />}
                          </button>
                          <div>
                          <p className={`text-sm font-semibold ${task.status === "completed" ? "text-gray-400 line-through" : "text-gray-900"}`}>{task.title}</p>
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
