"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, CheckSquare, Bell, Clock, Zap, Hand, UserPlus2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCadences, useCadenceEnrollments } from "@/hooks/use-cadences";
import { useTemplates } from "@/hooks/use-templates";
import { useLeads } from "@/hooks/use-leads";
import type { CadenceChannel, CadenceTrigger } from "@/types";

const CHANNEL_LABELS: Record<CadenceChannel, string> = {
  email: "Email",
  sms: "SMS",
  task: "Task for adviser",
  reminder: "Reminder",
};

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

export default function CadenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();

  const { cadences } = useCadences();
  const { enrollments: allEnrollments } = useCadenceEnrollments(id);
  const { leads } = useLeads();
  const { templates } = useTemplates();

  const cadence = useMemo(() => cadences.find((c) => c.id === id), [cadences, id]);
  const enrollments = useMemo(
    () => allEnrollments.filter((e) => e.cadenceId === id),
    [allEnrollments, id]
  );

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

  return (
    <div className="px-6 py-8 max-w-6xl">
      <Link href="/cadences" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={14} /> Back to cadences
      </Link>

      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{cadence.name}</h1>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                cadence.isActive
                  ? "bg-green-50 text-green-700 border border-green-100"
                  : "bg-gray-50 text-gray-600 border border-gray-200"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cadence.isActive ? "bg-green-500" : "bg-gray-400"}`} />
              {cadence.isActive ? "Active" : "Paused"}
            </span>
          </div>
          {cadence.description && <p className="text-sm text-gray-600 max-w-2xl">{cadence.description}</p>}
          <div className="mt-3">
            <TriggerLabel trigger={cadence.trigger} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {cadence.isActive ? "Pause" : "Activate"}
          </button>
          <button className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark">
            Edit cadence
          </button>
        </div>
      </div>

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
