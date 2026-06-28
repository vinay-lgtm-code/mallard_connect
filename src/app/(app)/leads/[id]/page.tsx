"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { Phone, Mail, Plus, ChevronDown, Check, Zap, UserPlus, Pencil, X, Send } from "lucide-react";
import { format } from "date-fns";
import { useLead, useLeadActivities, useLeadTasks, useTenantUsers } from "@/hooks/use-leads";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { QuickLogBar } from "@/components/leads/quick-log-bar";
import { EnrollCadenceModal } from "@/components/leads/enroll-cadence-modal";
import { AssignLeadModal } from "@/components/leads/assign-lead-modal";
import { EditableField } from "@/components/leads/editable-field";
import { isDemoUser } from "@/lib/mock-data";
import { isCadencesTemplatesEnabled, isDocumentsEnabled } from "@/lib/feature-flags";
import { useLeadDocuments } from "@/hooks/use-documents";
import { UploadDocument } from "@/components/documents/upload-document";
import { DocumentList } from "@/components/documents/document-list";
import { RequestDocumentsModal } from "@/components/documents/request-documents-modal";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import type { LogActivityPayload } from "@/components/leads/log-activity-modal";
import type { ActivityType } from "@/types";

const STAGE_STYLES: Record<string, string> = {
  new_enquiry: "bg-[#E6EDEC] text-[#1A5653]",
  initial_contact: "bg-blue-100 text-blue-700",
  not_ready_yet: "bg-amber-100 text-amber-700",
  nurturing: "bg-purple-100 text-purple-700",
  decision_in_principle_done: "bg-green-100 text-green-700",
  ready_to_proceed: "bg-green-100 text-green-700",
  referred_to_mab: "bg-slate-100 text-slate-700",
};

const STAGE_LABELS: Record<string, string> = {
  new_enquiry: "New Enquiry",
  initial_contact: "Initial Contact",
  not_ready_yet: "Not proceeded.",
  nurturing: "Nurturing",
  decision_in_principle_done: "Decision in Principle done",
  ready_to_proceed: "Ready to proceed",
  referred_to_mab: "Deal Done",
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

type Tab = "overview" | "activity" | "qualification" | "followups" | "documents";

type StageOption = {
  id: string;
  slug: string;
  name: string;
  color: string | null;
};

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
    if (!title.trim() || !dueDate || !supabase) return;
    setSaving(true);
    setError(null);
    try {
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
      supabase?.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          fetch("/api/notifications/follow-up-scheduled", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
            body: JSON.stringify({ leadId, taskTitle: title.trim(), dueDate }),
          }).catch(() => {});
        }
      });
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
        <h2 className="text-base font-bold text-text-primary mb-4">Schedule Follow-up</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Follow up call…"
              required
              className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              min={new Date().toISOString().split("T")[0]}
              className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Reminder Emails (optional)</label>
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
                  className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Schedule"}
            </Button>
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

  const demo = user ? isDemoUser(user.id) : false;

  const { lead, loading, refetch: refetchLead } = useLead(id);
  const { activities, refetch: refetchActivities } = useLeadActivities(id);
  const { tasks, refetch: refetchTasks } = useLeadTasks(id);
  const { documents, refetch: refetchDocuments } = useLeadDocuments(id);
  const supabase = useSupabase();
  const { users: tenantUsers } = useTenantUsers();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const [showCadenceModal, setShowCadenceModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRequestDocsModal, setShowRequestDocsModal] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState(false);
  const [followUpDateValue, setFollowUpDateValue] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [stageOptions, setStageOptions] = useState<StageOption[]>([]);

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

  useEffect(() => {
    if (demo) {
      setStageOptions(
        Object.entries(STAGE_LABELS).map(([slug, name]) => ({
          id: slug,
          slug,
          name,
          color: null,
        }))
      );
      return;
    }

    if (!supabase || !user?.tenantId) return;

    supabase
      .from("pipeline_stages")
      .select("id, slug, name, color")
      .eq("tenant_id", user.tenantId)
      .order("position")
      .then(({ data }) => {
        setStageOptions(
          (data ?? []).map((stage) => ({
            id: stage.id,
            slug: stage.slug,
            name: stage.name,
            color: stage.color,
          }))
        );
      });
  }, [demo, supabase, user?.tenantId]);

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
    if (!noteText.trim() || !user || !supabase) return;
    setSavingNote(true);
    try {
      await supabase.from("activities").insert({
        tenant_id: user.tenantId,
        lead_id: id,
        performed_by: user.id,
        activity_type: "note",
        title: "Note added",
        description: noteText,
        metadata: null,
      });
      setNoteText("");
      setAddingNote(false);
      refetchActivities();
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleStageChange(stage: StageOption) {
    setStageDropdownOpen(false);
    if (!user) return;
    if (demo) return;
    if (!supabase) return;
    try {
      await supabase.from("leads").update({
        current_stage_id: stage.id,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      await supabase.from("activities").insert({
        tenant_id: user.tenantId,
        lead_id: id,
        performed_by: user.id,
        activity_type: "stage-change",
        title: `Stage changed to ${stage.name}`,
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
    if (demo) return;
    if (!supabase) return;
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

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    if (demo) return;
    if (!supabase) return;
    try {
      await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
      refetchTasks();
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  }

  async function handleSaveQualification() {
    if (!user || !supabase) return;
    setSavingQual(true);
    setQualSaved(false);
    try {
      await supabase.from("leads").update({
        property_value: qualPropertyValue ? Number(qualPropertyValue) : null,
        deposit_amount: qualDepositAmount ? Number(qualDepositAmount) : null,
        deal_value: qualDealValue ? Number(qualDealValue) : null,
        estimated_close_date: qualEstimatedCloseDate || null,
        confidence: qualConfidence ? Number(qualConfidence) : null,
      }).eq("id", id);
      setQualSaved(true);
      setTimeout(() => setQualSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save qualification:", err);
    } finally {
      setSavingQual(false);
    }
  }

  function startEditingFollowUp() {
    if (demo) return;
    setFollowUpDateValue(
      lead?.nextFollowUpDate
        ? new Date(lead.nextFollowUpDate).toISOString().split("T")[0]
        : ""
    );
    setEditingFollowUp(true);
  }

  async function handleSaveFollowUpDate() {
    if (demo || !supabase || !user) return;
    setSavingFollowUp(true);
    try {
      await supabase
        .from("leads")
        .update({
          next_follow_up_date: followUpDateValue
            ? new Date(followUpDateValue).toISOString()
            : null,
        })
        .eq("id", id)
        .eq("tenant_id", user.tenantId);
      setEditingFollowUp(false);
      refetchLead();
    } catch (err) {
      console.error("Failed to update follow-up date:", err);
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function handleClearFollowUpDate() {
    if (demo || !supabase || !user) return;
    try {
      await supabase
        .from("leads")
        .update({ next_follow_up_date: null })
        .eq("id", id)
        .eq("tenant_id", user.tenantId);
      refetchLead();
    } catch (err) {
      console.error("Failed to clear follow-up date:", err);
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
        <p className="text-text-secondary">Lead not found.</p>
      </div>
    );
  }

  const assigneeName = tenantUsers.find(u => u.id === lead.assignedTo)?.fullName;
  const currentStage = stageOptions.find((stage) => stage.id === lead.currentStageId || stage.slug === lead.currentStageId);
  const stageStyle = STAGE_STYLES[currentStage?.slug ?? ""] ?? "bg-page text-text-secondary";
  const stageLabel = currentStage?.name ?? "";
  const otherStages = stageOptions.filter(
    (stage) => stage.id !== lead.currentStageId && stage.slug !== lead.currentStageId
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Notes & Activity" },
    { id: "qualification", label: "Qualification" },
    { id: "followups", label: "Follow-ups" },
    ...(isDocumentsEnabled() ? [{ id: "documents" as Tab, label: "Documents" }] : []),
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

      {showCadenceModal && (
        <EnrollCadenceModal
          leadId={id}
          leadName={`${lead.firstName} ${lead.lastName}`}
          open={showCadenceModal}
          onClose={() => setShowCadenceModal(false)}
          onEnrolled={() => { setShowCadenceModal(false); refetchActivities(); }}
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
        <div className="bg-white rounded-[12px] p-5 border border-border">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-bold">
                {getInitials(lead.firstName, lead.lastName)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-text-primary">
                {lead.firstName} {lead.lastName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {stageLabel && (
                  <div className="relative" ref={stageDropdownRef}>
                    <button
                      onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${stageStyle}`}
                    >
                      {stageLabel}
                      <ChevronDown size={12} />
                    </button>
                    {stageDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-border py-1 z-20 min-w-[180px]">
                        {otherStages.map((stage) => (
                          <button
                            key={stage.id}
                            onClick={() => handleStageChange(stage)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-page transition-colors flex items-center gap-2"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${STAGE_STYLES[stage.slug]?.split(" ")[0] ?? "bg-border"}`}
                              style={stage.color && !STAGE_STYLES[stage.slug] ? { backgroundColor: stage.color } : undefined}
                            />
                            {stage.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {lead.mortgageType && (
                  <span className="text-xs bg-page text-text-secondary px-2 py-0.5 rounded-full">
                    {lead.mortgageType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                )}
                <span className="text-xs text-text-secondary">via {lead.source}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center justify-center gap-1.5 font-semibold text-sm rounded-[var(--radius-button)] transition-colors bg-accent text-white hover:bg-accent-light px-4 py-2.5"
            >
              <Phone size={15} />
              Call
            </a>
            {lead.email && (
              <Button variant="secondary" onClick={() => window.location.href = `mailto:${lead.email}`}>
                <Mail size={15} />
                Email
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => { setAddingNote(true); setActiveTab("activity"); }}
            >
              <Plus size={15} />
              Log Activity
            </Button>
            {isCadencesTemplatesEnabled() && (
              <Button variant="secondary" onClick={() => setShowCadenceModal(true)}>
                <Zap size={15} />
                Cadence
              </Button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border bg-white rounded-t-[12px] overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="bg-white rounded-[12px] p-5 border border-border space-y-3">
              <SectionLabel>Contact information</SectionLabel>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <EditableField
                  label="Phone"
                  value={lead.phone}
                  field="phone"
                  type="tel"
                  linkHref={lead.phone ? `tel:${lead.phone}` : undefined}
                  leadId={id}
                  tenantId={user!.tenantId}
                  demo={demo}
                  onSaved={refetchLead}
                />
                <EditableField
                  label="Email"
                  value={lead.email}
                  field="email"
                  type="email"
                  linkHref={lead.email ? `mailto:${lead.email}` : undefined}
                  leadId={id}
                  tenantId={user!.tenantId}
                  demo={demo}
                  onSaved={refetchLead}
                />
                <EditableField
                  label="Source"
                  value={lead.source}
                  field="source"
                  type="select"
                  options={[
                    { value: "website", label: "Website" },
                    { value: "referral", label: "Referral" },
                    { value: "phone", label: "Phone" },
                    { value: "walk-in", label: "Walk-in" },
                    { value: "social", label: "Social" },
                    { value: "mab-import", label: "MAB Import" },
                    { value: "other", label: "Other" },
                  ]}
                  leadId={id}
                  tenantId={user!.tenantId}
                  demo={demo}
                  onSaved={refetchLead}
                />
                <EditableField
                  label="Readiness"
                  value={lead.readiness}
                  field="readiness"
                  type="select"
                  options={[
                    { value: "ready-now", label: "Ready Now" },
                    { value: "1-3-months", label: "1-3 Months" },
                    { value: "3-6-months", label: "3-6 Months" },
                    { value: "6-12-months", label: "6-12 Months" },
                    { value: "exploring", label: "Exploring" },
                  ]}
                  leadId={id}
                  tenantId={user!.tenantId}
                  demo={demo}
                  onSaved={refetchLead}
                />
                <EditableField
                  label="Mortgage Type"
                  value={lead.mortgageType}
                  field="mortgage_type"
                  type="select"
                  options={[
                    { value: "first-time-buyer", label: "First Time Buyer" },
                    { value: "remortgage", label: "Remortgage" },
                    { value: "self-employed", label: "Self Employed" },
                    { value: "buy-to-let", label: "Buy to Let" },
                    { value: "other", label: "Other" },
                  ]}
                  leadId={id}
                  tenantId={user!.tenantId}
                  demo={demo}
                  onSaved={refetchLead}
                />
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wide font-medium">Assigned To</p>
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="text-primary font-medium hover:underline text-sm flex items-center gap-1"
                  >
                    {assigneeName ?? "Unassigned"}
                    <UserPlus size={12} className="text-text-muted" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-5 group/followup">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-amber-800">Next Follow-up</h2>
                {lead.nextFollowUpDate && !editingFollowUp && !demo && (
                  <button
                    onClick={handleClearFollowUpDate}
                    className="text-amber-400 hover:text-amber-600 opacity-0 group-hover/followup:opacity-100 transition-opacity"
                    title="Clear follow-up date"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {editingFollowUp ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="date"
                    value={followUpDateValue}
                    onChange={(e) => setFollowUpDateValue(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    autoFocus
                    className="border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white text-amber-900 focus:border-amber-400 focus:outline-none focus:ring-[3px] focus:ring-amber-400/10"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingFollowUp(false);
                      if (e.key === "Enter") handleSaveFollowUpDate();
                    }}
                  />
                  <button
                    onClick={handleSaveFollowUpDate}
                    disabled={savingFollowUp || !followUpDateValue}
                    className="p-1 hover:bg-amber-100 rounded disabled:opacity-40"
                  >
                    <Check size={16} className="text-amber-700" />
                  </button>
                  <button
                    onClick={() => setEditingFollowUp(false)}
                    className="p-1 hover:bg-amber-100 rounded"
                  >
                    <X size={16} className="text-amber-400" />
                  </button>
                </div>
              ) : lead.nextFollowUpDate ? (
                <p
                  className={`text-lg font-bold text-amber-900 mt-1${!demo ? " cursor-pointer hover:underline decoration-amber-300" : ""}`}
                  onClick={startEditingFollowUp}
                >
                  {format(new Date(lead.nextFollowUpDate), "EEEE, d MMMM yyyy")}
                  {!demo && (
                    <Pencil size={12} className="inline ml-2 text-amber-400 opacity-0 group-hover/followup:opacity-100 transition-opacity" />
                  )}
                </p>
              ) : (
                <button
                  onClick={startEditingFollowUp}
                  disabled={demo}
                  className="text-sm font-medium text-amber-700 mt-1 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Set follow-up date
                </button>
              )}

              {lead.followUpReason && (
                <p className="text-sm text-amber-700 mt-1">{lead.followUpReason}</p>
              )}
              {lead.followUpNotes && (
                <p className="text-sm text-amber-600 mt-0.5 italic">{lead.followUpNotes}</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-4">
            <QuickLogBar prospectName={`${lead.firstName} ${lead.lastName}`} onLogged={handleLogActivity} />
            {addingNote && (
              <div className="bg-white rounded-[12px] p-4 border border-border">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note…"
                  rows={3}
                  className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10 resize-none"
                  autoFocus
                />
                <div className="flex gap-2 mt-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setAddingNote(false); setNoteText(""); }}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={savingNote || !noteText.trim()}
                  >
                    {savingNote ? "Saving…" : "Save Note"}
                  </Button>
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
              <div className="bg-white rounded-[12px] p-6 text-center text-sm text-text-muted border border-border">
                No activity recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const dotColor = ACTIVITY_DOT[activity.activityType] ?? "bg-text-muted";
                  const typeLabel = ACTIVITY_LABEL[activity.activityType] ?? activity.activityType;
                  const date = activity.createdAt ? new Date(activity.createdAt) : undefined;
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dotColor}`} />
                        <div className="w-px flex-1 bg-border mt-1" />
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold bg-page text-text-secondary px-2 py-0.5 rounded-full">
                            {typeLabel}
                          </span>
                          {date && (
                            <span className="text-xs text-text-muted">
                              {format(date, "d MMM yyyy, HH:mm")}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-text-primary mt-1">{activity.title}</p>
                        {activity.description && (
                          <p className="text-sm text-text-secondary mt-0.5">{activity.description}</p>
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
          <div className="bg-white rounded-[12px] p-5 border border-border">
            <SectionLabel>Qualification Details</SectionLabel>
            <div className="space-y-4 mt-4">
              <fieldset className="border border-border rounded-lg p-4">
                <legend className="text-xs font-semibold text-text-secondary uppercase px-1">Employment</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Employment Status</label>
                    <select
                      value={qualEmployment}
                      onChange={(e) => setQualEmployment(e.target.value)}
                      className="mt-1 w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
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
                    <label className="text-xs font-medium text-text-secondary">Annual Income (£)</label>
                    <input
                      type="number"
                      value={qualIncome}
                      onChange={(e) => setQualIncome(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="border border-border rounded-lg p-4">
                <legend className="text-xs font-semibold text-text-secondary uppercase px-1">Credit</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Credit Score Band</label>
                    <select
                      value={qualCreditBand}
                      onChange={(e) => setQualCreditBand(e.target.value)}
                      className="mt-1 w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
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
                    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qualHasCCJs}
                        onChange={(e) => setQualHasCCJs(e.target.checked)}
                        className="rounded accent-primary"
                      />
                      Has CCJs
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qualHasDefaults}
                        onChange={(e) => setQualHasDefaults(e.target.checked)}
                        className="rounded accent-primary"
                      />
                      Has Defaults
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
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

              <fieldset className="border border-border rounded-lg p-4">
                <legend className="text-xs font-semibold text-text-secondary uppercase px-1">Property</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Property Value (£)</label>
                    <input
                      type="number"
                      value={qualPropertyValue}
                      onChange={(e) => setQualPropertyValue(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Deposit Amount (£)</label>
                    <input
                      type="number"
                      value={qualDepositAmount}
                      onChange={(e) => setQualDepositAmount(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="border border-border rounded-lg p-4">
                <legend className="text-xs font-semibold text-text-secondary uppercase px-1">Deal</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Forecast Amount (£)</label>
                    <input
                      type="number"
                      value={qualDealValue}
                      onChange={(e) => setQualDealValue(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Est. Close Date</label>
                    <input
                      type="date"
                      value={qualEstimatedCloseDate}
                      onChange={(e) => setQualEstimatedCloseDate(e.target.value)}
                      className="mt-1 w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Confidence (%)</label>
                    <input
                      type="number"
                      value={qualConfidence}
                      onChange={(e) => setQualConfidence(e.target.value)}
                      placeholder="0"
                      min={0}
                      max={100}
                      className="mt-1 w-full border border-border-strong rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                    />
                  </div>
                </div>
              </fieldset>

              <Button
                variant="primary"
                onClick={handleSaveQualification}
                disabled={savingQual}
                className="w-full"
              >
                {savingQual ? "Saving…" : qualSaved ? "Saved!" : "Save Qualification"}
              </Button>
            </div>
          </div>
        )}

        {activeTab === "followups" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setShowFollowUpModal(true)}>
                <Plus size={15} />
                Schedule Follow-up
              </Button>
            </div>

            {tasks.length === 0 ? (
              <div className="bg-white rounded-[12px] p-6 text-center text-sm text-text-muted border border-border">
                No follow-ups scheduled.
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const due = task.dueDate ? new Date(task.dueDate) : undefined;
                  const isOverdue = due ? due < new Date() && task.status === "pending" : false;
                  return (
                    <div key={task.id} className={`bg-white rounded-[12px] p-4 border ${isOverdue ? "border-red-200" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handleToggleTask(task.id, task.status)}
                            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              task.status === "completed"
                                ? "border-green-500 bg-green-500"
                                : "border-border-strong hover:border-primary"
                            }`}
                          >
                            {task.status === "completed" && <Check size={12} className="text-white" />}
                          </button>
                          <div>
                          <p className={`text-sm font-semibold ${task.status === "completed" ? "text-text-muted line-through" : "text-text-primary"}`}>{task.title}</p>
                          {due && (
                            <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-600 font-semibold" : "text-text-secondary"}`}>
                              Due {format(due, "d MMM yyyy")}
                            </p>
                          )}
                          {task.reminderEmails && (task.reminderEmails as string[]).filter(Boolean).length > 0 && (
                            <p className="text-xs text-text-muted mt-1">
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
                              : "bg-page text-text-secondary"
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

        {activeTab === "documents" && isDocumentsEnabled() && (
          <div className="space-y-4">
            {!demo && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <UploadDocument
                    leadId={id}
                    onUploaded={() => { refetchDocuments(); refetchActivities(); }}
                  />
                </div>
                {lead.email && (
                  <button
                    onClick={() => setShowRequestDocsModal(true)}
                    className="flex-shrink-0 flex flex-col items-center justify-center gap-2 bg-accent text-white rounded-[12px] px-6 hover:bg-accent-light transition-colors"
                  >
                    <Send size={20} />
                    <span className="text-xs font-semibold">Request from client</span>
                  </button>
                )}
              </div>
            )}
            <DocumentList
              documents={documents}
              users={tenantUsers}
              onDeleted={refetchDocuments}
            />
          </div>
        )}

        {showRequestDocsModal && lead && (
          <RequestDocumentsModal
            leadId={id}
            leadEmail={lead.email}
            leadFirstName={lead.firstName}
            open={showRequestDocsModal}
            onClose={() => setShowRequestDocsModal(false)}
            onSent={() => { setShowRequestDocsModal(false); refetchActivities(); }}
          />
        )}
      </div>
    </>
  );
}
