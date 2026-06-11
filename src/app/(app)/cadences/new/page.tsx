"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { useTemplates } from "@/hooks/use-templates";
import { isDemoUser } from "@/lib/mock-data";
import type { CadenceTriggerType, CadenceChannel, CadenceStep } from "@/types";

interface StageOption {
  id: string;
  name: string;
}

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

function emptyStep(): CadenceStep {
  return { delayDays: 0, channel: "email" };
}

export default function NewCadencePage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useSupabase();
  const { templates } = useTemplates();
  const demo = user ? isDemoUser(user.id) : false;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<CadenceTriggerType>("manual");
  const [triggerStageId, setTriggerStageId] = useState("");
  const [steps, setSteps] = useState<CadenceStep[]>([emptyStep()]);
  const [stages, setStages] = useState<StageOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch pipeline stages for the trigger selector
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

  function updateStep(index: number, partial: Partial<CadenceStep>) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...partial } : s))
    );
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!name.trim()) {
      setSubmitError("Cadence name is required.");
      return;
    }
    if (steps.length === 0) {
      setSubmitError("Add at least one step.");
      return;
    }
    if (triggerType === "stage_entered" && !triggerStageId) {
      setSubmitError("Select a pipeline stage for the trigger.");
      return;
    }

    if (!user) {
      setSubmitError("You must be logged in.");
      return;
    }

    setSaving(true);
    try {
      if (demo) {
        setShowSuccess(true);
        setTimeout(() => router.push("/cadences"), 1500);
        return;
      }

      if (!supabase) throw new Error("Database not configured");
      await supabase.auth.refreshSession();

      const trigger =
        triggerType === "stage_entered"
          ? { type: triggerType, stageId: triggerStageId }
          : { type: triggerType };

      const { error } = await supabase.from("cadences").insert({
        tenant_id: user.tenantId,
        name: name.trim(),
        description: description.trim() || null,
        trigger,
        steps,
        is_active: true,
      });

      if (error) throw error;
      router.push("/cadences");
    } catch (err: unknown) {
      console.error("Failed to create cadence:", err);
      const detail =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "";
      setSubmitError(
        detail ? `Failed to save cadence: ${detail}` : "Failed to save cadence. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  const emailTemplates = templates.filter((t) => t.channel === "email");
  const smsTemplates = templates.filter((t) => t.channel === "sms");

  return (
    <div className="px-6 py-8 max-w-4xl">
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg">
          Cadence created successfully!
        </div>
      )}

      <Link
        href="/cadences"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={14} /> Back to cadences
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">New cadence</h1>

      <form onSubmit={handleSubmit} noValidate>
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. FTB nurture (deposit-saving)"
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional description of this cadence..."
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
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as CadenceTriggerType)}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                {TRIGGER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {triggerType === "stage_entered" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pipeline stage <span className="text-destructive">*</span>
                </label>
                {demo ? (
                  <select
                    value={triggerStageId}
                    onChange={(e) => setTriggerStageId(e.target.value)}
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
                    value={triggerStageId}
                    onChange={(e) => setTriggerStageId(e.target.value)}
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
              Steps <span className="text-gray-400 font-normal">({steps.length})</span>
            </h2>
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark"
            >
              <Plus size={14} /> Add step
            </button>
          </div>

          {steps.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">
              No steps yet. Add one to get started.
            </p>
          )}

          <div className="space-y-4">
            {steps.map((step, idx) => {
              const showTemplateSelector =
                step.channel === "email" || step.channel === "sms";
              const channelTemplates =
                step.channel === "email" ? emailTemplates : smsTemplates;

              return (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg p-4 relative"
                >
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
                        Delay (days after previous step)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={step.delayDays}
                        onChange={(e) =>
                          updateStep(idx, {
                            delayDays: Math.max(0, parseInt(e.target.value) || 0),
                          })
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Channel
                      </label>
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
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Template (optional)
                        </label>
                        <select
                          value={step.templateId ?? ""}
                          onChange={(e) =>
                            updateStep(idx, {
                              templateId: e.target.value || undefined,
                            })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                        >
                          <option value="">No template (use inline content)</option>
                          {channelTemplates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {!step.templateId && (
                        <>
                          {step.channel === "email" && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Subject
                              </label>
                              <input
                                type="text"
                                value={step.subject ?? ""}
                                onChange={(e) =>
                                  updateStep(idx, { subject: e.target.value || undefined })
                                }
                                placeholder="Email subject line..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Body
                            </label>
                            <textarea
                              value={step.body ?? ""}
                              onChange={(e) =>
                                updateStep(idx, { body: e.target.value || undefined })
                              }
                              rows={3}
                              placeholder="Message body... Use {{firstName}}, {{adviser}}, etc."
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
                        onChange={(e) =>
                          updateStep(idx, { body: e.target.value || undefined })
                        }
                        rows={2}
                        placeholder={
                          step.channel === "task"
                            ? "Describe the task for the adviser..."
                            : "Reminder note..."
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {submitError && (
          <p className="mb-4 text-sm text-destructive text-center">{submitError}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Create cadence"}
          </button>
          <Link
            href="/cadences"
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
