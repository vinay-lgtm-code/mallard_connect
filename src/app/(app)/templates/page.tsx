"use client";

import Link from "next/link";
import { Mail, MessageSquare, Plus, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isCadencesTemplatesEnabled } from "@/lib/feature-flags";
import { ComingSoon } from "@/components/coming-soon";
import { useTemplates } from "@/hooks/use-templates";
import type { Template } from "@/types";

export default function TemplatesListPage() {
  const { user } = useAuth();

  const { templates } = useTemplates();
  const emails = templates.filter((t) => t.channel === "email");
  const sms = templates.filter((t) => t.channel === "sms");

  if (!user) return null;

  if (!isCadencesTemplatesEnabled()) {
    return (
      <ComingSoon
        icon={FileText}
        title="Templates"
        description="Reusable email and SMS templates with dynamic variables for cadences and one-click activity logging. Coming soon."
      />
    );
  }

  return (
    <div className="px-6 py-8 max-w-5xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Templates</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Reusable email and SMS bodies. Used by cadences and one-click activity logging. Variables
            like <code className="px-1 py-0.5 rounded bg-page text-text-secondary">{"{{firstName}}"}</code>
            {" "}fill from the lead and adviser context at send time.
          </p>
        </div>
        <Link
          href="/templates/new"
          className="inline-flex items-center justify-center gap-1.5 font-semibold text-sm rounded-[var(--radius-button)] transition-colors bg-accent text-white hover:bg-accent-light px-4 py-2.5"
        >
          <Plus size={16} />
          New template
        </Link>
      </div>

      <Section title="Email" icon={Mail} items={emails} />
      <div className="h-6" />
      <Section title="SMS" icon={MessageSquare} items={sms} />
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Mail;
  items: Template[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-text-secondary" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</h2>
        <span className="text-xs text-text-muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted px-4 py-6 bg-white border border-border rounded-[12px]">
          No {title.toLowerCase()} templates yet.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((t) => (
            <Link
              key={t.id}
              href={`/templates/${t.id}`}
              className="block bg-white border border-border rounded-[12px] p-5 hover:border-primary/30 transition-all"
            >
              <p className="text-sm font-semibold text-text-primary mb-1">{t.name}</p>
              {t.subject && (
                <p className="text-xs text-text-secondary truncate mb-2">Subject: {t.subject}</p>
              )}
              <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">{t.body}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.variables.map((v) => (
                  <span
                    key={v}
                    className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-page text-text-secondary font-mono"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
