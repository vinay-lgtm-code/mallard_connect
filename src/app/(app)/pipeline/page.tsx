"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useLeads, useTenantUsers } from "@/hooks/use-leads";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { getInitials, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { isDemoUser } from "@/lib/mock-data";
import {
  daysInStage,
  ragStatus,
  ragBorderClass,
  timeInStageLabel,
  DEMO_STAGE_RAG_CONFIG,
  type StageRagConfig,
  type StageRagConfigMap,
} from "@/lib/stage-timing";
import { Clock } from "lucide-react";
import type { Lead } from "@/types";

interface StageConfig {
  id: string;
  name: string;
  color: string;
  headerBg: string;
  badgeBg: string;
  borderAccent?: string;
}

const STAGES: StageConfig[] = [
  { id: "new_enquiry", name: "New Enquiry", color: "text-indigo-700", headerBg: "bg-indigo-50", badgeBg: "bg-indigo-100 text-indigo-700" },
  { id: "initial_contact", name: "Initial Contact", color: "text-blue-700", headerBg: "bg-blue-50", badgeBg: "bg-blue-100 text-blue-700" },
  { id: "not_ready_yet", name: "Not Ready Yet", color: "text-amber-700", headerBg: "bg-amber-50", badgeBg: "bg-amber-100 text-amber-700", borderAccent: "border-l-4 border-l-amber-400" },
  { id: "nurturing", name: "Nurturing", color: "text-green-700", headerBg: "bg-green-50", badgeBg: "bg-green-100 text-green-700" },
  { id: "ready_to_proceed", name: "Ready to Proceed", color: "text-blue-700", headerBg: "bg-blue-50", badgeBg: "bg-blue-100 text-blue-700" },
  { id: "referred_to_mab", name: "Referred to MAB", color: "text-purple-700", headerBg: "bg-purple-50", badgeBg: "bg-purple-100 text-purple-700" },
];

const MORTGAGE_TYPE_LABELS: Record<string, string> = {
  "first-time-buyer": "FTB",
  remortgage: "Remortgage",
  "self-employed": "Self-Emp",
  "buy-to-let": "BTL",
  other: "Other",
};

interface LeadCardProps {
  lead: Lead;
  index: number;
  isOverdue?: boolean;
  ragConfig?: StageRagConfig;
  adviserName?: string;
}

function LeadCard({ lead, index, isOverdue, ragConfig, adviserName }: LeadCardProps) {
  const mortgageLabel = lead.mortgageType ? MORTGAGE_TYPE_LABELS[lead.mortgageType] : null;
  const adviserInitials = adviserName ? getInitials(adviserName) : null;

  const days = daysInStage(lead);
  // RAG only applies to in-progress leads; closed leads shouldn't show as "stalled".
  const isClosed = lead.status === "converted" || lead.status === "lost";
  const rag = isClosed ? null : ragStatus(days, ragConfig);
  const ragBorder = ragBorderClass(rag);

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-[12px] p-3.5 shadow-sm border border-gray-100 cursor-grab select-none transition-shadow ${ragBorder} ${
            snapshot.isDragging ? "shadow-lg rotate-1" : "hover:shadow-md"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/leads/${lead.id}`}
              className="font-semibold text-sm text-gray-900 hover:text-primary leading-tight"
              onClick={(e) => snapshot.isDragging && e.preventDefault()}
            >
              {lead.firstName} {lead.lastName}
            </Link>
            {isOverdue && (
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex-shrink-0">
                Overdue
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-2.5">
            {mortgageLabel && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                {mortgageLabel}
              </span>
            )}
            {adviserInitials ? (
              <div
                className="w-6 h-6 rounded-full bg-primary flex items-center justify-center ml-auto flex-shrink-0"
                title={`Assigned to ${adviserName}`}
                aria-label={`Assigned to ${adviserName}`}
              >
                <span className="text-white text-[10px] font-bold">{adviserInitials}</span>
              </div>
            ) : (
              <div
                className="w-6 h-6 rounded-full bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center ml-auto flex-shrink-0"
                title="Unassigned"
                aria-label="Unassigned"
              >
                <span className="text-gray-400 text-[10px] font-bold">?</span>
              </div>
            )}
          </div>

          {lead.dealValue != null && (
            <div className="text-xs mt-2 flex items-center gap-1.5">
              <span className="text-green-700 font-semibold">{formatCurrency(lead.dealValue)}</span>
              {lead.confidence != null && (
                <>
                  <span className="text-gray-300">&middot;</span>
                  <span className="text-gray-400">{lead.confidence}%</span>
                </>
              )}
              {lead.estimatedCloseDate && (
                <>
                  <span className="text-gray-300">&middot;</span>
                  <span className="text-gray-400">
                    {format(new Date(lead.estimatedCloseDate), "d MMM")}
                  </span>
                </>
              )}
            </div>
          )}

          {!isClosed && (
            <div
              className={`text-xs mt-2 flex items-center gap-1 ${
                rag === "red"
                  ? "text-red-600 font-medium"
                  : rag === "amber"
                    ? "text-amber-600"
                    : "text-gray-400"
              }`}
              title={
                ragConfig?.expectedDays != null
                  ? `Expected ${ragConfig.expectedDays}d in this stage`
                  : undefined
              }
            >
              <Clock size={12} />
              <span>{timeInStageLabel(days)}</span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

interface StageChangeModalProps {
  stageName: string;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

function StageChangeModal({ stageName, onConfirm, onCancel }: StageChangeModalProps) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-[12px] p-6 shadow-xl w-full max-w-sm mx-4">
        <h2 className="text-base font-bold text-gray-900 mb-1">Stage changed to {stageName}</h2>
        <p className="text-sm text-gray-500 mb-4">Add an optional note about this stage change.</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Optional note…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          autoFocus
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note)}
            className="text-sm text-white bg-primary px-4 py-1.5 rounded-lg font-semibold hover:bg-primary-dark"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = user ? isDemoUser(user.id) : false;
  const { leads: firestoreLeads, loading } = useLeads();
  const { users } = useTenantUsers();
  const isManager = user?.role === "admin" || user?.role === "manager";
  // Adviser filter (manager/admin only) — "" means All advisers
  const [adviserFilter, setAdviserFilter] = useState("");

  // Map of adviser id -> display name, used to render assigned-adviser initials on cards.
  const adviserNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) {
      map[u.id] = u.fullName;
    }
    return map;
  }, [users]);
  // Local state for optimistic UI during drag
  const [localLeads, setLocalLeads] = useState<Lead[] | null>(null);
  const [pendingDrag, setPendingDrag] = useState<{
    leadId: string;
    fromStageId: string;
    toStageId: string;
    stageName: string;
  } | null>(null);

  // baseLeads = full set (drag mutates this); leads = optimistic view used for drag updates.
  const baseLeads = firestoreLeads;
  const leads = localLeads ?? baseLeads;

  // Per-stage RAG config keyed by slug. Demo mode uses sensible defaults; real mode
  // fetches expected_days / amber_pct from pipeline_stages. We also keep a slug -> uuid
  // map so stage-change history can record the real stage_id when available.
  const [ragConfig, setRagConfig] = useState<StageRagConfigMap>(DEMO_STAGE_RAG_CONFIG);
  const [stageIdBySlug, setStageIdBySlug] = useState<Record<string, string>>({});

  useEffect(() => {
    if (demo || !supabase || !user?.tenantId) return;
    supabase
      .from("pipeline_stages")
      .select("id, slug, expected_days, amber_pct")
      .eq("tenant_id", user.tenantId)
      .then(({ data }) => {
        if (!data) return;
        const config: StageRagConfigMap = {};
        const ids: Record<string, string> = {};
        for (const row of data as Array<{ id: string; slug: string; expected_days: number | null; amber_pct: number | null }>) {
          config[row.slug] = { expectedDays: row.expected_days, amberPct: row.amber_pct ?? 75 };
          ids[row.slug] = row.id;
        }
        setRagConfig(config);
        setStageIdBySlug(ids);
      });
  }, [demo, supabase, user?.tenantId]);

  // visibleLeads = what the board renders. Filter only applies for managers with a
  // selection; a stale filter can never hide leads for a non-manager.
  const visibleLeads = useMemo(() => {
    if (!isManager || !adviserFilter) return leads;
    return leads.filter((l) => l.assignedTo === adviserFilter);
  }, [leads, isManager, adviserFilter]);

  // Sync local state when Firestore updates (but not during a pending drag)
  if (!pendingDrag && localLeads !== null && JSON.stringify(localLeads) !== JSON.stringify(firestoreLeads)) {
    setLocalLeads(null);
  }

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const stageName = STAGES.find((s) => s.id === destination.droppableId)?.name ?? destination.droppableId;

    // Optimistically update local state. Reset the stage-entered clock so the card
    // immediately shows "Today" / green in its new column.
    const nowIso = new Date().toISOString();
    setLocalLeads(
      (baseLeads).map((lead) =>
        lead.id === draggableId
          ? { ...lead, currentStageId: destination.droppableId, currentStageEnteredAt: nowIso }
          : lead
      )
    );

    // Show modal for optional note
    setPendingDrag({
      leadId: draggableId,
      fromStageId: source.droppableId,
      toStageId: destination.droppableId,
      stageName,
    });
  }

  async function confirmStageChange(note: string) {
    if (!pendingDrag || !user) return;
    const { leadId, toStageId, stageName } = pendingDrag;

    try {
      if (supabase) {
        const nowIso = new Date().toISOString();
        // Resolve the real stage UUID from the slug when we have it (history.stage_id
        // is a FK to pipeline_stages); fall back to slug-only history otherwise.
        const stageUuid = stageIdBySlug[toStageId] ?? null;

        // Move the lead and reset its stage-entered clock.
        await supabase.from("leads").update({
          current_stage_id: toStageId,
          current_stage_entered_at: nowIso,
          updated_at: nowIso,
        }).eq("id", leadId);

        // Close the previous open stage-history row for this lead.
        await supabase
          .from("lead_stage_history")
          .update({ exited_at: nowIso })
          .eq("lead_id", leadId)
          .is("exited_at", null);

        // Open a new stage-history row.
        await supabase.from("lead_stage_history").insert({
          tenant_id: user.tenantId,
          lead_id: leadId,
          stage_id: stageUuid,
          stage_slug: toStageId,
          entered_at: nowIso,
        });

        await supabase.from("activities").insert({
          tenant_id: user.tenantId,
          lead_id: leadId,
          performed_by: user.id,
          activity_type: "stage-change",
          title: `Stage changed to ${stageName}`,
          description: note || null,
          metadata: null,
        });
      }
    } catch (err) {
      console.error("Failed to update stage:", err);
      setLocalLeads(null);
    } finally {
      setPendingDrag(null);
    }
  }

  function cancelStageChange() {
    // Revert optimistic update
    setLocalLeads(null);
    setPendingDrag(null);
  }

  const leadsByStage = (stageId: string) => visibleLeads.filter((l) => l.currentStageId === stageId);

  return (
    <>
      {pendingDrag && (
        <StageChangeModal
          stageName={pendingDrag.stageName}
          onConfirm={confirmStageChange}
          onCancel={cancelStageChange}
        />
      )}

      {/* Mobile fallback */}
      <div className="md:hidden p-6 text-center">
        <p className="text-gray-600 text-sm">
          The Kanban board is best viewed on a larger screen.
        </p>
        <Link
          href="/leads"
          className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
        >
          Switch to list view →
        </Link>
      </div>

      {/* Desktop Kanban */}
      <div className="hidden md:flex md:flex-col h-full">
        {isManager && (
          <div className="flex items-center justify-end gap-2 px-4 pt-4">
            <label htmlFor="adviser-filter" className="text-sm font-medium text-gray-600">
              Adviser
            </label>
            <select
              id="adviser-filter"
              value={adviserFilter}
              onChange={(e) => setAdviserFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All advisers</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center items-center flex-1">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 p-4 flex-1 min-h-0 overflow-x-auto">
              {STAGES.map((stage) => {
                const stageLeads = leadsByStage(stage.id);
                // Live totals derived from the same leads array the board renders,
                // so optimistic drag moves and lead edits reflect instantly.
                const totalValue = stageLeads.reduce((sum, l) => sum + (l.dealValue ?? 0), 0);
                const weightedValue = stageLeads.reduce(
                  (sum, l) => sum + (l.dealValue ?? 0) * ((l.confidence ?? 0) / 100),
                  0
                );
                return (
                  <div
                    key={stage.id}
                    className={`flex-none w-64 flex flex-col rounded-[12px] border border-gray-200 bg-gray-50 ${stage.borderAccent ?? ""}`}
                  >
                    <div className={`flex items-center justify-between px-3 py-2.5 ${stage.headerBg}`}>
                      <h3 className={`text-xs font-bold uppercase tracking-wide ${stage.color}`}>
                        {stage.name}
                      </h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.badgeBg}`}>
                        {stageLeads.length} {stageLeads.length === 1 ? "lead" : "leads"}
                      </span>
                    </div>
                    <div className={`flex items-center justify-between px-3 pb-2.5 pt-0 text-xs ${stage.headerBg} rounded-b-[12px]`}>
                      <span className="font-semibold text-gray-700">
                        {formatCurrency(totalValue)}
                      </span>
                      <span className="text-gray-500" title="Weighted by confidence">
                        {formatCurrency(Math.round(weightedValue))} weighted
                      </span>
                    </div>

                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-20 transition-colors ${
                            snapshot.isDraggingOver ? "bg-gray-100" : ""
                          }`}
                        >
                          {stageLeads.map((lead, index) => (
                            <LeadCard
                              key={lead.id}
                              lead={lead}
                              index={index}
                              ragConfig={ragConfig[stage.id]}
                              adviserName={lead.assignedTo ? adviserNameById[lead.assignedTo] : undefined}
                            />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>
    </>
  );
}
