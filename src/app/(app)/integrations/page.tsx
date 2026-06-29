"use client";

import Link from "next/link";
import { Database, Mail, Calendar, Building2, Check, Plug } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";

type Connector = {
  id: string;
  name: string;
  description: string;
  icon: typeof Database;
  status: "connected" | "available" | "coming-soon";
  href?: string;
  badge?: string;
};

const CONNECTORS: Connector[] = [
  {
    id: "brevo",
    name: "Brevo",
    description: "Pull contacts and email open/click events into the lead timeline. One-way sync.",
    icon: Database,
    status: "available",
    href: "/integrations/brevo",
    badge: "Recommended",
  },
  {
    id: "mab",
    name: "MAB Platform",
    description: "Weekly CSV/XLS import with auto column-mapping and dedupe.",
    icon: Building2,
    status: "available",
    href: "/import",
  },
  {
    id: "outlook",
    name: "Outlook calendar",
    description: "Two-way appointment sync. Coming soon.",
    icon: Calendar,
    status: "coming-soon",
  },
  {
    id: "gmail",
    name: "Google Workspace",
    description: "Calendar + Gmail send-on-behalf. Coming soon.",
    icon: Mail,
    status: "coming-soon",
  },
];

function StatusBadge({ status }: { status: Connector["status"] }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-100">
        <Check size={11} />
        Connected
      </span>
    );
  }
  if (status === "available") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
        <Plug size={11} />
        Available
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-page text-text-secondary border border-border">
      Coming soon
    </span>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="px-6 py-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-text-primary">Integrations</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Sequence works alongside whatever you already use. Connect a contact source to keep your
        existing system as the source of truth.
      </p>

      <div className="mt-6">
        <SectionLabel>Available connectors</SectionLabel>
        <div className="grid sm:grid-cols-2 gap-3">
          {CONNECTORS.map((c) => {
            const Icon = c.icon;
            const inner = (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-page flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{c.description}</p>
                  {c.badge && (
                    <span className="mt-2 inline-block text-[10px] uppercase tracking-wide font-semibold text-primary">
                      {c.badge}
                    </span>
                  )}
                </div>
              </div>
            );
            const cls = `block bg-white border border-border rounded-[12px] p-5 ${
              c.href ? "hover:border-primary/30 transition-all" : "opacity-70"
            }`;
            return c.href ? (
              <Link key={c.id} href={c.href} className={cls}>
                {inner}
              </Link>
            ) : (
              <div key={c.id} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
