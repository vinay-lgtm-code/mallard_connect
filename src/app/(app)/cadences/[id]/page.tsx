"use client";

import { use, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  CheckSquare,
  Bell,
  Clock,
  Zap,
  Hand,
  UserPlus2,
  Plus,
  Trash2,
  GripVertical,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCadences, useCadenceEnrollments } from "@/hooks/use-cadences";
import { useTemplates } from "@/hooks/use-templates";
import { useLeads } from "@/hooks/use-leads";
import { useSupabase } from "@/hooks/use-supabase";
import { isDemoUser } from "@/lib/mock-data";
import type { CadenceChannel, CadenceTrigger, CadenceTriggerType, CadenceStep } from "@/types";

interface StageOption {
  id: string;
  name: string;
}

const CHANNEL_LABELS: Record<CadenceChannel, string> = {
  email: "Email",
  sms: "SMS",
  task: "Task for adviser",
  reminder: "Reminder",
};

const TRIGGER_OPTIONS: { value: CadenceTriggerType; label: string }[] = [
  { value: "manual", label: "Manual enrollment" },
  { value: "stage_entered", label: "When lead enters stage" },
  { value: "lead_created", label: "When lead is created" },
];

const CHANNEL_OPTIONS: { value: CadenceChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "task", label: "Task for adviser" },
  { value: "reminder", label: "Reminder" },
];

function ChannelIcon({ channel, size = 16 }: { channel: CadenceChannel; size?: number }) {
  const map = {
    email: { Icon: Mail, color: "bg-blue-50 text-blue-700" },
    sms: { Icon: MessageSquare, color: "bg-purple-50 text-purple-700" },
    task: { Icon: CheckSquare, color: "bg-amber-50 text-amber-700" },
    reminder: { Icon: Bell, color: "bg-rose-50 text-rose-700" },
  } as const;
  const { Icon, color } = map[channel];
  return (
    <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
      <Icon size={size} />
    </div>
  );
}

function TriggerLabel({ trigger }: { trigger: CadenceTrigger }) {
  const map = {
    stage_entered: { Icon: Zap, label: `Auto-enrolls when a lead enters stage "${trigger.type === "stage_entered" ? trigger.stageId : ""}"` },
    manual: { Icon: Hand, label: "Manual enrollment from a lead's detail page" },
    lead_created: { Icon: UserPlus2, label: "Auto-enrolls every new lead" },
  } as const;
  const { Icon, label } = map[trigger.type];
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Icon size={14} className="text-gray-400" />
      {label}
    </div>
  );
}

function emptyStep(): CadenceStep {
  return { delayDays: 0, channel: "email" };
}

export default function CadenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;

  const { cadences } = useCadences();
  const { enrollments: allEnrollments } = useCadenceEnrollments(id);
  const { leads } = useLeads();
  const { templates } = useTemplates();

  const cadence = useMemo(() => cadences.find((c) => c.id === id), [cadences, id]);
  const enrollments = useMemo(
    () => allEnrollments.filter((e) => e.cadenceId === id),
    [allEnrollments, id]
  );

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTriggerType, setEditTriggerType] = useState<CadenceTriggerType>("manual");
  const [editTriggerStageId, setEditTriggerStageId] = useState("");
  const [editSteps, setEditSteps] = useState<CadenceStep[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);

  // Action state
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Local override for isActive (for demo mode toggling)
  const [localActive, setLocalActive] = useState<boolean | null>(null);
  const isActive = localActive ?? cadence?.isActive ?? false;

  // Fetch pipeline stages for editing
  useEffect(() => {
    if (demo || !supabase || !user?.tenantId) return;
    supabase
      .from("pipeline_stages")
      .select("id, name")
      .eq("tenant_id", user.tenantId)
      .order("position", { ascending: true })
      .then(({ data }) => {
        if (data) setStages(data as StageOption[]);
      });
  }, [supabase, user?.tenantId, demo]);

  function startEditing() {
    if (!cadence) return;
    setEditName(cadence.name);
    setEditDescription(cadence.description ?? "");
    setEditTriggerType(cadence.trigger.type);
    setEditTriggerStageId(cadence.trigger.stageId ?? "");
    setEditSteps([...cadence.steps]);
    setEditing(true);
    setActionError(null);
  }

  function cancelEditing() {
    setEditing(false);
    setActionError(null);
  }

  function updateStep(index: number, partial: Partial<CadenceStep>) {
    setEditSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...partial } : s)));
  }

  function removeStep(index: number) {
    setEditSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    setEditSteps((prev) => [...prev, emptyStep()]);
  }

  function showSuccessBanner(msg: string) {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);

    if (!editName.trim()) {
      setActionError("Cadence name is required.");
      return;
    }
    if (editSteps.length === 0) {
      setActionError("Add at least one step.");
      return;
    }
    if (editTriggerType === "stage_entered" && !editTriggerStageId) {
      setActionError("Select a pipeline stage for the trigger.");
      return;
    }

    setSaving(true);
    try {
      if (demo) {
        showSuccessBanner("Cadence updated!");
        setEditing(false);
        return;
      }

      if (!supabase) throw new Error("Database not configured");
      await supabase.auth.refreshSession();

      const trigger =
        editTriggerType === "stage_entered"
          ? { type: editTriggerType, stageId: editTriggerStageId }
          : { type: editTriggerType };

      const { error } = await supabase
        .from("cadences")
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          trigger,
          steps: editSteps,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      showSuccessBanner("Cadence updated!");
      setEditing(false);
      // Force re-fetch by navigating to the same page
      router.refresh();
    } catch (err: unknown) {
      console.error("Failed to update cadence:", err);
      const detail = err instanceof Error ? err.message : "";
      setActionError(detail ? `Failed to update: ${detail}` : "Failed to update cadence.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!cadence) return;
    setActionError(null);
    setToggling(true);

    try {
      if (demo) {
        setLocalActive(!isActive);
        showSuccessBanner(isActive ? "Cadence paused" : "Cadence activated");
        return;
      }

      if (!supabase) throw new Error("Database not configured");
      await supabase.auth.refreshSession();

      const { error } = await supabase
        .from("cadences")
        .update({ is_active: !isActive, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      setLocalActive(!isActive);
      showSuccessBanner(isActive ? "Cadence paused" : "Cadence activated");
    } catch (err: unknown) {
      console.error("Failed to toggle cadence:", err);
      const detail = err instanceof Error ? err.message : "";
      setActionError(detail ? `Failed to toggle: ${detail}` : "Failed to toggle cadence status.");
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setActionError(null);
    setDeleting(true);

    try {
      if (demo) {
        showSuccessBanner("Cadence deleted");
        setTimeout(() => router.push("/cadences"), 1000);
        return;
      }

      if (!supabase) throw new Error("Database not configured");
      await supabase.auth.refreshSession();

      const { error } = await supabase.from("cadences").delete().eq("id", id);
      if (error) throw error;
      router.push("/cadences");
    } catch (err: unknown) {
      console.error("Failed to delete cadence:", err);
      const detail = err instanceof Error ? err.message : "";
      setActionError(detail ? `Failed to delete: ${detail}` : "Failed to delete cadence.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (!user) return null;
  if (!cadence) {
    return (
      <div className="px-6 py-8">
        <Link href="/cadences" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft size={14} /> Back to cadences
        </Link>
        <p className="mt-6 text-gray-500">Cadence not found.</p>
      </div>
    );
  }

  const enrolledLeads = enrollments
    .map((e) => ({ enrollment: e, lead: leads.find((l) => l.id === e.leadId) }))
    .filter((x) => x.lead);

  const emailTemplates = templates.filter((t) => t.channel === "email");
  const smsTemplates = templates.filter((t) => t.channel === "sms");

  // ----- EDIT MODE -----
  if (editing) {
    return (
      <div className="px-6 py-8 max-w-4xl">
        {showSuccess && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg">
            {successMessage}
          </div>
        )}

        <Link
          href="/cadences"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={14} /> Back to cadences
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit cadence</h1>

        <form onSubmit={handleSaveEdit} noValidate>
          {/* Basic info */}
          <div className="bg-white border border-gray-100 rounded-[12px] p-6 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>
          </div>

          {/* Trigger */}
          <div className="bg-white border border-gray-100 rounded-[12px] p-6 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Trigger</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">When to enroll leads</label>
                <select
                  value={editTriggerType}
                  onChange={(e) => setEditTriggerType(e.target.value as CadenceTriggerType)}
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  {TRIGGER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {editTriggerType === "stage_entered" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pipeline stage <span className="text-destructive">*</span>
                  </label>
                  {demo ? (
                    <select
                      value={editTriggerStageId}
                      onChange={(e) => setEditTriggerStageId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                      <option value="">Select stage...</option>
                      <option value="new_enquiry">New Enquiry</option>
                      <option value="initial_contact">Initial Contact</option>
                      <option value="fact_find">Fact Find</option>
                      <option value="aip">AIP</option>
                      <option value="application">Application</option>
                      <option value="offer">Offer</option>
                      <option value="completed">Completed</option>
                    </select>
                  ) : (
                    <select
                      value={editTriggerStageId}
                      onChange={(e) => setEditTriggerStageId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                      <option value="">Select stage...</option>
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Steps */}
          <div className="bg-white border border-gray-100 rounded-[12px] p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Steps <span className="text-gray-400 font-normal">({editSteps.length})</span>
              </h2>
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark"
              >
                <Plus size={14} /> Add step
              </button>
            </div>

            {editSteps.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No steps. Add one.</p>
            )}

            <div className="space-y-4">
              {editSteps.map((step, idx) => {
                const showTemplateSelector = step.channel === "email" || step.channel === "sms";
                const channelTemplates = step.channel === "email" ? emailTemplates : smsTemplates;

                return (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-gray-300" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Step {idx + 1}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="text-gray-400 hover:text-destructive p-1"
                        title="Remove step"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Delay (days)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={step.delayDays}
                          onChange={(e) =>
                            updateStep(idx, { delayDays: Math.max(0, parseInt(e.target.value) || 0) })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Channel</label>
                        <select
                          value={step.channel}
                          onChange={(e) =>
                            updateStep(idx, {
                              channel: e.target.value as CadenceChannel,
                              templateId: undefined,
                              subject: undefined,
                              body: undefined,
                            })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                        >
                          {CHANNEL_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {showTemplateSelector && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Template</label>
                          <select
                            value={step.templateId ?? ""}
                            onChange={(e) =>
                              updateStep(idx, { templateId: e.target.value || undefined })
                            }
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                          >
                            <option value="">No template (inline content)</option>
                            {channelTemplates.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        {!step.templateId && (
                          <>
                            {step.channel === "email" && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                                <input
                                  type="text"
                                  value={step.subject ?? ""}
                                  onChange={(e) => updateStep(idx, { subject: e.target.value || undefined })}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </div>
                            )}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
                              <textarea
                                value={step.body ?? ""}
                                onChange={(e) => updateStep(idx, { body: e.target.value || undefined })}
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {(step.channel === "task" || step.channel === "reminder") && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {step.channel === "task" ? "Task description" : "Reminder note"}
                        </label>
                        <textarea
                          value={step.body ?? ""}
                          onChange={(e) => updateStep(idx, { body: e.target.value || undefined })}
                          rows={2}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {actionError && (
            <p className="mb-4 text-sm text-destructive text-center">{actionError}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-white font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ----- READ-ONLY MODE -----
  return (
    <div className="px-6 py-8 max-w-6xl">
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg">
          {successMessage}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[12px] p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete cadence?</h3>
            <p className="text-sm text-gray-600 mb-1">
              This will permanently delete <strong>{cadence.name}</strong>.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              {enrollments.filter((e) => e.status === "active").length > 0
                ? "Active enrollments will be cancelled."
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
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Link href="/cadences" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={14} /> Back to cadences
      </Link>

      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{cadence.name}</h1>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                isActive
                  ? "bg-green-50 text-green-700 border border-green-100"
                  : "bg-gray-50 text-gray-600 border border-gray-200"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-500" : "bg-gray-400"}`} />
              {isActive ? "Active" : "Paused"}
            </span>
          </div>
          {cadence.description && <p className="text-sm text-gray-600 max-w-2xl">{cadence.description}</p>}
          <div className="mt-3">
            <TriggerLabel trigger={cadence.trigger} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {toggling ? "..." : isActive ? "Pause" : "Activate"}
          </button>
          <button
            onClick={startEditing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark"
          >
            <Pencil size={14} />
            Edit cadence
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {actionError && !showDeleteConfirm && (
        <p className="mb-4 text-sm text-destructive">{actionError}</p>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Steps timeline */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-[12px] p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-5">Steps</h2>
          <ol className="relative">
            <span aria-hidden className="absolute left-[18px] top-2 bottom-2 w-px bg-gray-200" />
            {cadence.steps.map((step, idx) => {
              const tpl = templates.find((t) => t.id === step.templateId);
              return (
                <li key={idx} className="relative pl-12 pb-7 last:pb-0">
                  <div className="absolute left-0 top-0">
                    <ChannelIcon channel={step.channel} />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Step {idx + 1}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Clock size={11} />
                          {step.delayDays === 0 ? "Day 0" : `Day +${step.delayDays}`}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {step.subject ?? CHANNEL_LABELS[step.channel]}
                      </p>
                      {tpl && (
                        <p className="mt-1 text-xs text-gray-500">
                          Uses template <span className="font-medium text-gray-700">{tpl.name}</span>
                        </p>
                      )}
                      {step.body && !tpl && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2 max-w-xl">{step.body}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 text-gray-600 flex-shrink-0">
                      {CHANNEL_LABELS[step.channel]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Enrollments sidebar */}
        <aside className="bg-white border border-gray-100 rounded-[12px] p-6 self-start">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Active enrollments</h2>
            <span className="text-xs font-medium text-gray-500">
              {enrolledLeads.filter((x) => x.enrollment.status === "active").length}
            </span>
          </div>
          {enrolledLeads.length === 0 ? (
            <p className="text-xs text-gray-400">No leads currently enrolled.</p>
          ) : (
            <ul className="space-y-3">
              {enrolledLeads.slice(0, 8).map(({ enrollment, lead }) => (
                <li key={enrollment.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/leads/${lead!.id}`}
                    className="text-sm text-gray-900 hover:text-primary truncate"
                  >
                    {lead!.firstName} {lead!.lastName}
                  </Link>
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 flex-shrink-0">
                    Step {enrollment.currentStep + 1}/{cadence.steps.length}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
