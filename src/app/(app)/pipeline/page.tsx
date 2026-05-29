"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useLeads } from "@/hooks/use-leads";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { leadPath, activitiesPath } from "@/lib/firebase/paths";
import { isDemoUser } from "@/lib/mock-data";
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
}

function LeadCard({ lead, index, isOverdue }: LeadCardProps) {
  const mortgageLabel = lead.mortgageType ? MORTGAGE_TYPE_LABELS[lead.mortgageType] : null;
  const initials = getInitials(`${lead.firstName} ${lead.lastName}`);

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-[12px] p-3.5 shadow-sm border border-gray-100 cursor-grab select-none transition-shadow ${
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
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center ml-auto flex-shrink-0">
              <span className="text-white text-[10px] font-bold">{initials}</span>
            </div>
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
                    {format(
                      lead.estimatedCloseDate instanceof Date
                        ? lead.estimatedCloseDate
                        : (lead.estimatedCloseDate as { toDate: () => Date }).toDate(),
                      "d MMM"
                    )}
                  </span>
                </>
              )}
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
  const demo = user ? isDemoUser(user.id) : false;
  const { leads: firestoreLeads, loading } = useLeads();
  // Local state for optimistic UI during drag
  const [localLeads, setLocalLeads] = useState<Lead[] | null>(null);
  const [pendingDrag, setPendingDrag] = useState<{
    leadId: string;
    fromStageId: string;
    toStageId: string;
    stageName: string;
  } | null>(null);

  const baseLeads = firestoreLeads;
  const leads = localLeads ?? baseLeads;

  // Sync local state when Firestore updates (but not during a pending drag)
  if (!pendingDrag && localLeads !== null && JSON.stringify(localLeads) !== JSON.stringify(firestoreLeads)) {
    setLocalLeads(null);
  }

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const stageName = STAGES.find((s) => s.id === destination.droppableId)?.name ?? destination.droppableId;

    // Optimistically update local state
    setLocalLeads(
      (baseLeads).map((lead) =>
        lead.id === draggableId
          ? { ...lead, currentStageId: destination.droppableId }
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
      await updateDoc(doc(db, leadPath(user.tenantId, leadId, demo)), {
        currentStageId: toStageId,
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, activitiesPath(user.tenantId, leadId, demo)), {
        leadId,
        tenantId: user.tenantId,
        performedBy: user.id,
        activityType: "stage-change",
        title: `Stage changed to ${stageName}`,
        description: note || null,
        metadata: null,
        createdAt: serverTimestamp(),
      });
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

  const leadsByStage = (stageId: string) => leads.filter((l) => l.currentStageId === stageId);

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
      <div className="hidden md:block h-full">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 p-4 h-full overflow-x-auto">
              {STAGES.map((stage) => {
                const stageLeads = leadsByStage(stage.id);
                return (
                  <div
                    key={stage.id}
                    className={`flex-none w-64 flex flex-col rounded-[12px] border border-gray-200 bg-gray-50 ${stage.borderAccent ?? ""}`}
                  >
                    <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-[12px] ${stage.headerBg}`}>
                      <h3 className={`text-xs font-bold uppercase tracking-wide ${stage.color}`}>
                        {stage.name}
                      </h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.badgeBg}`}>
                        {stageLeads.length}
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
                            <LeadCard key={lead.id} lead={lead} index={index} />
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
