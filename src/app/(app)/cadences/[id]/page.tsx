"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/hooks/use-supabase";
import { isDemoUser } from "@/lib/mock-data";
import { ArrowLeft, Mail, MessageSquare, CheckSquare, Bell, Clock, Zap, Hand, UserPlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCadences, useCadenceEnrollments } from "@/hooks/use-cadences";
import { isCadencesTemplatesEnabled } from "@/lib/feature-flags";
import { ComingSoon } from "@/components/coming-soon";
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
    <div className="flex items-center gap-2 text-sm text-text-secondary">
      <Icon size={14} className="text-text-muted" />
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

  const router = useRouter();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  if (!isCadencesTemplatesEnabled()) {
    return (
      <ComingSoon
        icon={Zap}
        title="Cadences"
        description="Automated multi-step nurture sequences that trigger on stage changes or manual enrollment. This feature is being finalized and will be available soon."
      />
    );
  }

  if (!cadence) {
    return (
      <div className="px-6 py-8">
        <Link href="/cadences" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft size={14} /> Back to cadences
        </Link>
        <p className="mt-6 text-text-secondary">Cadence not found.</p>
      </div>
    );
  }

  const enrolledLeads = enrollments
    .map((e) => ({ enrollment: e, lead: leads.find((l) => l.id === e.leadId) }))
    .filter((x) => x.lead);

  return (
    <div className="px-6 py-8 max-w-6xl">
      <Link href="/cadences" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4">
        <ArrowLeft size={14} /> Back to cadences
      </Link>

      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <h1 className="text-2xl font-bold text-text-primary">{cadence.name}</h1>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                cadence.isActive
                  ? "bg-green-50 text-green-700 border border-green-100"
                  : "bg-page text-text-secondary border border-border"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cadence.isActive ? "bg-green-500" : "bg-text-muted"}`} />
              {cadence.isActive ? "Active" : "Paused"}
            </span>
          </div>
          {cadence.description && <p className="text-sm text-text-secondary max-w-2xl">{cadence.description}</p>}
          <div className="mt-3">
            <TriggerLabel trigger={cadence.trigger} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            disabled={toggling || demo}
            onClick={async () => {
              setToggling(true);
              try {
                const { data: { session } } = await supabase!.auth.getSession();
                const res = await fetch(`/api/cadences/${id}/toggle`, {
                  method: "PATCH",
                  headers: { Authorization: `Bearer ${session?.access_token}` },
                });
                if (res.ok) router.refresh();
              } finally {
                setToggling(false);
              }
            }}
          >
            {toggling ? "..." : cadence.isActive ? "Pause" : "Activate"}
          </Button>
          <Button
            variant="primary"
            onClick={() => router.push(`/cadences/${id}/edit`)}
          >
            Edit cadence
          </Button>
          {(user.role === "admin" || user.role === "manager") && !demo && (
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!window.confirm("Delete this cadence? This cannot be undone.")) return;
                setDeleting(true);
                try {
                  const { data: { session } } = await supabase!.auth.getSession();
                  const res = await fetch(`/api/cadences/${id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${session?.access_token}` },
                  });
                  if (!res.ok) {
                    const err = await res.json();
                    if (res.status === 409) {
                      alert(`Cannot delete: ${err.error}. ${err.count} active enrollment(s).`);
                    } else {
                      alert(err.error ?? "Failed to delete");
                    }
                    return;
                  }
                  router.push("/cadences");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "..." : "Delete"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Steps timeline */}
        <div className="lg:col-span-2 bg-white border border-border rounded-[12px] p-6">
          <h2 className="text-sm font-semibold text-text-secondary mb-5">Steps</h2>
          <ol className="relative">
            <span aria-hidden className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />
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
                        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                          Step {idx + 1}
                        </span>
                        <span className="text-xs text-text-muted">·</span>
                        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                          <Clock size={11} />
                          {step.delayDays === 0 ? "Day 0" : `Day +${step.delayDays}`}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-text-primary">
                        {step.subject ?? CHANNEL_LABELS[step.channel]}
                      </p>
                      {tpl && (
                        <p className="mt-1 text-xs text-text-secondary">
                          Uses template <span className="font-medium text-text-secondary">{tpl.name}</span>
                        </p>
                      )}
                      {step.body && !tpl && (
                        <p className="mt-1 text-xs text-text-secondary line-clamp-2 max-w-xl">{step.body}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-page border border-border text-text-secondary flex-shrink-0">
                      {CHANNEL_LABELS[step.channel]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Enrollments sidebar */}
        <aside className="bg-white border border-border rounded-[12px] p-6 self-start">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-secondary">Active enrollments</h2>
            <span className="text-xs font-medium text-text-secondary">
              {enrolledLeads.filter((x) => x.enrollment.status === "active").length}
            </span>
          </div>
          {enrolledLeads.length === 0 ? (
            <p className="text-xs text-text-muted">No leads currently enrolled.</p>
          ) : (
            <ul className="space-y-3">
              {enrolledLeads.slice(0, 8).map(({ enrollment, lead }) => (
                <li key={enrollment.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/leads/${lead!.id}`}
                    className="text-sm text-text-primary hover:text-primary truncate"
                  >
                    {lead!.firstName} {lead!.lastName}
                  </Link>
                  <span className="text-[10px] uppercase tracking-wide text-text-muted flex-shrink-0">
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
