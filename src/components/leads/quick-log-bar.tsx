"use client";

import { useState } from "react";
import { Phone, Mail, FileText, MoreHorizontal } from "lucide-react";
import { LogActivityModal, type LogActivityPayload } from "./log-activity-modal";
import type { ActivityType } from "@/types";

/**
 * Inline row of one-click activity loggers shown on the lead detail page,
 * just above the activity timeline.
 */
export function QuickLogBar({
  prospectName,
  onLogged,
}: {
  prospectName: string;
  onLogged?: (activity: LogActivityPayload) => void;
}) {
  const [open, setOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<ActivityType>("call");

  function open_(type: ActivityType) {
    setDefaultType(type);
    setOpen(true);
  }

  return (
    <>
      <div className="flex items-center gap-2 p-3 rounded-[12px] bg-gray-50 border border-gray-100">
        <span className="text-xs font-semibold text-gray-500 mr-1">Log:</span>
        <QuickButton icon={Phone} label="Call" onClick={() => open_("call")} />
        <QuickButton icon={Mail} label="Email sent" onClick={() => open_("email")} />
        <QuickButton icon={FileText} label="Note" onClick={() => open_("note")} />
        <button
          onClick={() => open_("meeting")}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-white hover:text-gray-900 border border-transparent hover:border-gray-200 transition-colors"
        >
          <MoreHorizontal size={14} />
          Other...
        </button>
      </div>

      <LogActivityModal
        open={open}
        prospectName={prospectName}
        defaultType={defaultType}
        onClose={() => setOpen(false)}
        onSubmit={(payload) => onLogged?.(payload)}
      />
    </>
  );
}

function QuickButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Phone;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:border-primary/40 hover:text-primary transition-colors"
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
