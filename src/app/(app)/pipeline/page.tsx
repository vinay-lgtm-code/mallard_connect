"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
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

const MOCK_LEADS: Lead[] = [
  {
    id: "l1", firstName: "James", lastName: "Thornton", email: "james@example.com",
    phone: "+44 7700 900123", source: "website", status: "active", currentStageId: "new_enquiry",
    assignedTo: "u1", mortgageType: "first-time-buyer", readiness: "3-6-months",
    propertyValue: null, depositAmount: null, loanAmount: null,
    nextFollowUpDate: null, followUpReason: null, followUpNotes: null,
    tags: [], referredBy: null, importId: null,
    createdAt: null as never, updatedAt: null as never, convertedAt: null, lostAt: null, lostReason: null,
  },
  {
    id: "l2", firstName: "Priya", lastName: "Sharma", email: "priya@example.com",
    phone: "+44 7911 123456", source: "referral", status: "active", currentStageId: "new_enquiry",
    assignedTo: "u2", mortgageType: "remortgage", readiness: "ready-now",
    propertyValue: null, depositAmount: null, loanAmount: null,
    nextFollowUpDate: null, followUpReason: null, followUpNotes: null,
    tags: [], referredBy: null, importId: null,
    createdAt: null as never, updatedAt: null as never, convertedAt: null, lostAt: null, lostReason: null,
  },
  {
    id: "l3", firstName: "Tom", lastName: "Baker", email: "tom@example.com",
    phone: "+44 7800 654321", source: "phone", status: "active", currentStageId: "initial_contact",
    assignedTo: "u1", mortgageType: "buy-to-let", readiness: "1-3-months",
    propertyValue: null, depositAmount: null, loanAmount: null,
    nextFollowUpDate: null, followUpReason: null, followUpNotes: null,
    tags: [], referredBy: null, importId: null,
    createdAt: null as never, updatedAt: null as never, convertedAt: null, lostAt: null, lostReason: null,
  },
  {
    id: "l4", firstName: "Ayesha", lastName: "Patel", email: "ayesha@example.com",
    phone: "+44 7700 111222", source: "social", status: "active", currentStageId: "not_ready_yet",
    assignedTo: "u2", mortgageType: "first-time-buyer", readiness: "6-12-months",
    propertyValue: null, depositAmount: null, loanAmount: null,
    nextFollowUpDate: null, followUpReason: null, followUpNotes: null,
    tags: [], referredBy: null, importId: null,
    createdAt: null as never, updatedAt: null as never, convertedAt: null, lostAt: null, lostReason: null,
  },
  {
    id: "l5", firstName: "Marcus", lastName: "Reid", email: "marcus@example.com",
    phone: "+44 7800 333444", source: "referral", status: "active", currentStageId: "nurturing",
    assignedTo: "u1", mortgageType: "remortgage", readiness: "3-6-months",
    propertyValue: null, depositAmount: null, loanAmount: null,
    nextFollowUpDate: null, followUpReason: null, followUpNotes: null,
    tags: [], referredBy: null, importId: null,
    createdAt: null as never, updatedAt: null as never, convertedAt: null, lostAt: null, lostReason: null,
  },
  {
    id: "l6", firstName: "Olivia", lastName: "Chen", email: "olivia@example.com",
    phone: "+44 7911 555666", source: "website", status: "active", currentStageId: "ready_to_proceed",
    assignedTo: "u2", mortgageType: "first-time-buyer", readiness: "ready-now",
    propertyValue: null, depositAmount: null, loanAmount: null,
    nextFollowUpDate: null, followUpReason: null, followUpNotes: null,
    tags: [], referredBy: null, importId: null,
    createdAt: null as never, updatedAt: null as never, convertedAt: null, lostAt: null, lostReason: null,
  },
];

const ASSIGNEE_INITIALS: Record<string, string> = { u1: "SW", u2: "DM" };
const ASSIGNEE_COLORS: Record<string, string> = { u1: "bg-indigo-500", u2: "bg-green-500" };

interface LeadCardProps {
  lead: Lead;
  index: number;
  isOverdue?: boolean;
}

function LeadCard({ lead, index, isOverdue }: LeadCardProps) {
  const mortgageLabel = lead.mortgageType ? MORTGAGE_TYPE_LABELS[lead.mortgageType] : null;
  const initials = ASSIGNEE_INITIALS[lead.assignedTo] ?? "?";
  const avatarColor = ASSIGNEE_COLORS[lead.assignedTo] ?? "bg-gray-400";

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
            <div className={`w-6 h-6 rounded-full ${avatarColor} flex items-center justify-center ml-auto flex-shrink-0`}>
              <span className="text-white text-[10px] font-bold">{initials}</span>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === draggableId
          ? { ...lead, currentStageId: destination.droppableId }
          : lead
      )
    );
    // In production: update Firestore + log stage-change activity
  }

  const leadsByStage = (stageId: string) => leads.filter((l) => l.currentStageId === stageId);

  return (
    <>
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
      </div>
    </>
  );
}
