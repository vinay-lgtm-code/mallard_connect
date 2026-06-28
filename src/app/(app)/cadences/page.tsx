"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Mail, MessageSquare, CheckSquare, Bell, Plus, Zap, Hand, UserPlus2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCadences, useCadenceEnrollments } from "@/hooks/use-cadences";
import { isCadencesTemplatesEnabled } from "@/lib/feature-flags";
import { ComingSoon } from "@/components/coming-soon";
import type { CadenceChannel, CadenceTrigger } from "@/types";

function ChannelIcon({ channel, size = 12 }: { channel: CadenceChannel; size?: number }) {
  const cls = "text-text-secondary";
  switch (channel) {
    case "email":
      return <Mail size={size} className={cls} />;
    case "sms":
      return <MessageSquare size={size} className={cls} />;
    case "task":
      return <CheckSquare size={size} className={cls} />;
    case "reminder":
      return <Bell size={size} className={cls} />;
  }
}

function TriggerPill({ trigger }: { trigger: CadenceTrigger }) {
  const map = {
    stage_entered: { icon: Zap, label: "Auto on stage", color: "bg-blue-50 text-blue-700 border-blue-100" },
    manual: { icon: Hand, label: "Manual enroll", color: "bg-page text-text-secondary border-border" },
    lead_created: { icon: UserPlus2, label: "On new lead", color: "bg-green-50 text-green-700 border-green-100" },
  } as const;
  const { icon: Icon, label, color } = map[trigger.type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${color}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

export default function CadencesListPage() {
  const { user } = useAuth();

  const { cadences } = useCadences();
  const { enrollments } = useCadenceEnrollments();

  const enrolledCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of enrollments) {
      if (e.status === "active") counts[e.cadenceId] = (counts[e.cadenceId] ?? 0) + 1;
    }
    return counts;
  }, [enrollments]);

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

  return (
    <div className="px-6 py-8 max-w-6xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Cadences</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Automated multi-step nurture sequences. Cadences trigger on stage changes or manual
            enrollment, and run via the daily 7am cron.
          </p>
        </div>
        <Link
          href="/cadences/new"
          className="inline-flex items-center justify-center gap-1.5 font-semibold text-sm rounded-[var(--radius-button)] transition-colors bg-accent text-white hover:bg-accent-light px-4 py-2.5"
        >
          <Plus size={16} />
          New cadence
        </Link>
      </div>

      <div className="bg-white border border-border rounded-[12px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-page text-[11px] font-mono font-medium uppercase tracking-wider text-text-muted">
            <tr>
              <th className="text-left px-5 py-3">Name</th>
              <th className="text-left px-5 py-3">Trigger</th>
              <th className="text-left px-5 py-3">Steps</th>
              <th className="text-left px-5 py-3">Active enrollments</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cadences.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-text-muted">
                  No cadences yet. Create one to start nurturing prospects automatically.
                </td>
              </tr>
            )}
            {cadences.map((c) => (
              <tr key={c.id} className="hover:bg-page/60 transition-colors">
                <td className="px-5 py-4">
                  <Link href={`/cadences/${c.id}`} className="font-medium text-text-primary hover:text-primary">
                    {c.name}
                  </Link>
                  {c.description && (
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-1 max-w-md">{c.description}</p>
                  )}
                </td>
                <td className="px-5 py-4">
                  <TriggerPill trigger={c.trigger} />
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    {c.steps.map((s, i) => (
                      <span
                        key={i}
                        title={`Day ${s.delayDays} · ${s.channel}`}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-page border border-border"
                      >
                        <ChannelIcon channel={s.channel} />
                      </span>
                    ))}
                    <span className="ml-1 text-xs text-text-secondary">{c.steps.length} step{c.steps.length === 1 ? "" : "s"}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-text-secondary">{enrolledCount[c.id] ?? 0}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                      c.isActive ? "bg-green-50 text-green-700 border border-green-100" : "bg-page text-text-secondary border border-border"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-green-500" : "bg-text-muted"}`} />
                    {c.isActive ? "Active" : "Paused"}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <Link href={`/cadences/${c.id}`} className="text-primary text-xs font-medium hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-text-muted">
        Channel icons: <Mail className="inline" size={11} /> email · <MessageSquare className="inline" size={11} /> SMS ·
        <CheckSquare className="inline ml-1" size={11} /> task for adviser ·
        <Bell className="inline ml-1" size={11} /> reminder
      </p>
    </div>
  );
}
