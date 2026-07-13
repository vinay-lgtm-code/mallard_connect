"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useLeads, useTenantUsers } from "@/hooks/use-leads";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { isDemoUser } from "@/lib/mock-data";
import { formatRelativeDate } from "@/lib/utils";
import { hasCapability } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/ui/query-error";
import type { LeadStatus, Readiness } from "@/types";

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

const STATUS_STYLES: Record<LeadStatus, string> = {
  active: "bg-green-100 text-green-700",
  "on-hold": "bg-page text-text-secondary",
  lost: "bg-red-100 text-red-700",
  converted: "bg-teal-100 text-teal-700",
};

const READINESS_LABELS: Record<Readiness, string> = {
  "ready-now": "Ready now",
  "1-3-months": "1–3 mo",
  "3-6-months": "3–6 mo",
  "6-12-months": "6–12 mo",
  exploring: "Exploring",
};

const ALL_STAGES = [
  { value: "", label: "All Stages" },
  { value: "new_enquiry", label: "New Enquiry" },
  { value: "initial_contact", label: "Initial Contact" },
  { value: "not_ready_yet", label: "Not proceeded." },
  { value: "nurturing", label: "Nurturing" },
  { value: "decision_in_principle_done", label: "Decision in Principle done" },
  { value: "ready_to_proceed", label: "Ready to proceed" },
  { value: "referred_to_mab", label: "Deal Done" },
];

const ALL_STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "on-hold", label: "On Hold" },
  { value: "lost", label: "Lost" },
  { value: "converted", label: "Converted" },
];

export default function LeadsPage() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");

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

  const canViewAllPipeline = hasCapability(user?.role, "viewAllPipeline");

  const resolvedStageId = stageFilter ? slugToId[stageFilter] || stageFilter : undefined;
  const { leads, loading, error, refetch } = useLeads({
    stageId: resolvedStageId,
    status: statusFilter || undefined,
  });
  const { users } = useTenantUsers();

  const stageSlugOf = (currentStageId: string | null | undefined): string =>
    currentStageId ? (idToSlug[currentStageId] ?? currentStageId) : "new_enquiry";

  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) {
      map[u.id] = u.fullName;
    }
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leads.filter((lead) => {
      if (assignedFilter && lead.assignedTo !== assignedFilter) return false;
      if (!q) return true;
      const full = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      const phone = (lead.phone ?? "").toLowerCase();
      const email = (lead.email ?? "").toLowerCase();
      return full.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [leads, search, assignedFilter]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/leads/new">
          <Button variant="primary">
            <Plus size={15} />
            New Lead
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-[12px] p-4 border border-border space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone or email…"
            className="w-full pl-9 pr-3.5 py-2.5 border border-border-strong rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="border border-border-strong rounded-lg px-3 py-2 text-sm bg-white focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          >
            {ALL_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-border-strong rounded-lg px-3 py-2 text-sm bg-white focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {canViewAllPipeline && (
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="border border-border-strong rounded-lg px-3 py-2 text-sm bg-white focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            >
              <option value="">All Advisors</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table / List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <QueryError error={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-[12px] p-10 border border-border text-center">
          <p className="text-text-muted text-sm">No leads found.</p>
          {(search || stageFilter || statusFilter || assignedFilter) && (
            <button
              onClick={() => { setSearch(""); setStageFilter(""); setStatusFilter(""); setAssignedFilter(""); }}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-[12px] border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-[11px] font-mono font-medium text-text-muted uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-[11px] font-mono font-medium text-text-muted uppercase tracking-wider">Phone</th>
                  <th className="text-left px-5 py-3 text-[11px] font-mono font-medium text-text-muted uppercase tracking-wider">Stage</th>
                  <th className="text-left px-5 py-3 text-[11px] font-mono font-medium text-text-muted uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-3 text-[11px] font-mono font-medium text-text-muted uppercase tracking-wider">Readiness</th>
                  {canViewAllPipeline && <th className="text-left px-5 py-3 text-[11px] font-mono font-medium text-text-muted uppercase tracking-wider">Assigned</th>}
                  <th className="text-left px-5 py-3 text-[11px] font-mono font-medium text-text-muted uppercase tracking-wider">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((lead) => {
                  const slug = stageSlugOf(lead.currentStageId);
                  const stageStyle = STAGE_STYLES[slug] ?? "bg-page text-text-secondary";
                  const stageLabel = STAGE_LABELS[slug] ?? (slug || "—");
                  const updatedDate = lead.updatedAt ? new Date(lead.updatedAt) : undefined;
                  return (
                    <tr key={lead.id} className="hover:bg-page transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/leads/${lead.id}`} className="font-semibold text-text-primary hover:text-primary">
                          {lead.firstName} {lead.lastName}
                        </Link>
                        {lead.email && (
                          <p className="text-xs text-text-muted mt-0.5">{lead.email}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-primary">{lead.phone}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${stageStyle}`}>
                          {stageLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary capitalize">
                        {lead.mortgageType ? lead.mortgageType.replace(/-/g, " ") : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">
                        {lead.readiness ? READINESS_LABELS[lead.readiness] : "—"}
                      </td>
                      {canViewAllPipeline && (
                        <td className="px-5 py-3.5 text-text-secondary">
                          {userMap[lead.assignedTo] ?? lead.assignedTo ?? "—"}
                        </td>
                      )}
                      <td className="px-5 py-3.5 text-text-muted text-xs">
                        {updatedDate ? formatRelativeDate(updatedDate) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-border text-xs text-text-muted">
              {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filtered.map((lead) => {
              const stageStyle = STAGE_STYLES[lead.currentStageId] ?? "bg-page text-text-secondary";
              const stageLabel = STAGE_LABELS[lead.currentStageId] ?? lead.currentStageId;
              const statusStyle = STATUS_STYLES[lead.status] ?? "bg-page text-text-secondary";
              const updatedDate = lead.updatedAt ? new Date(lead.updatedAt) : undefined;
              return (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="block bg-white rounded-[12px] p-4 border border-border active:bg-page"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary">{lead.firstName} {lead.lastName}</p>
                      <p className="text-sm font-mono text-primary mt-0.5">{lead.phone}</p>
                      {lead.email && <p className="text-xs text-text-muted mt-0.5 truncate">{lead.email}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stageStyle}`}>
                        {stageLabel}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle}`}>
                        {lead.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
                    <span>{lead.mortgageType ? lead.mortgageType.replace(/-/g, " ") : "No type"}</span>
                    <span>{updatedDate ? formatRelativeDate(updatedDate) : ""}</span>
                  </div>
                </Link>
              );
            })}
            <p className="text-center text-xs text-text-muted py-2">
              {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
