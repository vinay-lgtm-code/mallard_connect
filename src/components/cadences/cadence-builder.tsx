"use client";

import { useState, useEffect } from "react";
import {
  Trash2,
  Plus,
  Zap,
  Hand,
  UserPlus2,
  Mail,
  MessageSquare,
  CheckSquare,
  Bell,
} from "lucide-react";
import { useSupabase } from "@/hooks/use-supabase";
import { useTemplates } from "@/hooks/use-templates";
import type { CadenceTrigger, CadenceStep, CadenceChannel } from "@/types";

interface CadenceBuilderProps {
  initialData?: {
    name: string;
    description?: string;
    trigger: CadenceTrigger;
    steps: CadenceStep[];
    isActive: boolean;
  };
  onSubmit: (data: {
    name: string;
    description?: string;
    trigger: CadenceTrigger;
    steps: CadenceStep[];
    isActive: boolean;
  }) => Promise<void>;
  isSubmitting: boolean;
  isDemo?: boolean;
}

const defaultStep: CadenceStep = {
  delayDays: 0,
  channel: "email" as CadenceChannel,
  templateId: undefined,
  subject: undefined,
  body: undefined,
};

const CHANNEL_OPTIONS: { value: CadenceChannel; label: string; icon: typeof Mail }[] = [
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageSquare },
  { value: "task", label: "Task", icon: CheckSquare },
  { value: "reminder", label: "Reminder", icon: Bell },
];

interface Stage {
  id: string;
  name: string;
  color: string;
}

export function CadenceBuilder({
  initialData,
  onSubmit,
  isSubmitting,
  isDemo,
}: CadenceBuilderProps) {
  const supabase = useSupabase();
  const { templates } = useTemplates();

  // --- Form state ---
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [trigger, setTrigger] = useState<CadenceTrigger>(
    initialData?.trigger ?? { type: "manual" },
  );
  const [steps, setSteps] = useState<CadenceStep[]>(
    initialData?.steps ?? [{ ...defaultStep }],
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  // --- Stages for stage_entered trigger ---
  const [stages, setStages] = useState<Stage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchStages() {
      if (!supabase) return;
      setStagesLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch("/api/settings", {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            setStages(json.stages ?? []);
          }
        }
      } catch {
        // Silently fail — stages just won't be available
      } finally {
        if (!cancelled) setStagesLoading(false);
      }
    }

    fetchStages();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // --- Step helpers ---
  function updateStep(index: number, patch: Partial<CadenceStep>) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    setSteps((prev) => [...prev, { ...defaultStep }]);
  }

  // --- Submit ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      trigger,
      steps,
      isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ===== Section 1: Basic Info ===== */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Basic Info</h3>

        <div>
          <label htmlFor="cadence-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="cadence-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. FTB nurture (deposit-saving)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="cadence-description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="cadence-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of this cadence..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
          />
        </div>
      </section>

      {/* ===== Section 2: Trigger Config ===== */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Trigger</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { type: "manual" as const, label: "Manual enroll", icon: Hand },
            { type: "stage_entered" as const, label: "Auto on stage entered", icon: Zap },
            { type: "lead_created" as const, label: "On new lead", icon: UserPlus2 },
          ] as const).map(({ type, label, icon: Icon }) => {
            const selected = trigger.type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() =>
                  setTrigger(
                    type === "stage_entered"
                      ? { type, stageId: trigger.stageId }
                      : { type },
                  )
                }
                className={`flex items-center gap-3 p-4 rounded-[12px] border text-left text-sm font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>

        {trigger.type === "stage_entered" && (
          <div>
            <label htmlFor="trigger-stage" className="block text-sm font-medium text-gray-700 mb-1">
              Stage
            </label>
            {stagesLoading ? (
              <p className="text-sm text-gray-400">Loading stages...</p>
            ) : (
              <select
                id="trigger-stage"
                value={trigger.stageId ?? ""}
                onChange={(e) =>
                  setTrigger({ type: "stage_entered", stageId: e.target.value || undefined })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">Select a stage...</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </section>

      {/* ===== Section 3: Steps Editor ===== */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Steps</h3>

        <div className="space-y-4">
          {steps.map((step, index) => {
            const channelSupportsTemplate =
              step.channel === "email" || step.channel === "sms";
            const filteredTemplates = channelSupportsTemplate
              ? templates.filter((t) => t.channel === step.channel)
              : [];

            return (
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 rounded-[12px] p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-500">
                    Step {index + 1}
                  </span>
                  <button
                    type="button"
                    disabled={steps.length <= 1}
                    onClick={() => removeStep(index)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Remove step"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Delay days */}
                  <div>
                    <label
                      htmlFor={`step-delay-${index}`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Delay (days)
                    </label>
                    <input
                      id={`step-delay-${index}`}
                      type="number"
                      min={0}
                      value={step.delayDays}
                      onChange={(e) =>
                        updateStep(index, {
                          delayDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>

                  {/* Channel */}
                  <div>
                    <label
                      htmlFor={`step-channel-${index}`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Channel
                    </label>
                    <select
                      id={`step-channel-${index}`}
                      value={step.channel}
                      onChange={(e) =>
                        updateStep(index, {
                          channel: e.target.value as CadenceChannel,
                          templateId: undefined, // reset template on channel change
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                      {CHANNEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Template picker — only for email / sms */}
                {channelSupportsTemplate && (
                  <div>
                    <label
                      htmlFor={`step-template-${index}`}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Template
                    </label>
                    <select
                      id={`step-template-${index}`}
                      value={step.templateId ?? ""}
                      onChange={(e) =>
                        updateStep(index, {
                          templateId: e.target.value || undefined,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                      <option value="">None (inline)</option>
                      {filteredTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Subject override */}
                <div>
                  <label
                    htmlFor={`step-subject-${index}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Subject override
                  </label>
                  <input
                    id={`step-subject-${index}`}
                    type="text"
                    value={step.subject ?? ""}
                    onChange={(e) =>
                      updateStep(index, {
                        subject: e.target.value || undefined,
                      })
                    }
                    placeholder="Optional subject..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>

                {/* Body override */}
                <div>
                  <label
                    htmlFor={`step-body-${index}`}
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Body override
                  </label>
                  <textarea
                    id={`step-body-${index}`}
                    rows={3}
                    value={step.body ?? ""}
                    onChange={(e) =>
                      updateStep(index, {
                        body: e.target.value || undefined,
                      })
                    }
                    placeholder="Optional body content..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addStep}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Add step
        </button>
      </section>

      {/* ===== Bottom Actions ===== */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-6">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
          />
          Active
        </label>

        <button
          type="submit"
          disabled={isSubmitting || isDemo}
          className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : initialData ? "Save changes" : "Create cadence"}
        </button>
      </div>
    </form>
  );
}
