"use client";

import { useState } from "react";
import { Phone, Mail, Calendar, FileText, MessageSquare, MessageCircle, X } from "lucide-react";
import type { ActivityType } from "@/types";

const ACTIVITY_OPTIONS: {
  type: ActivityType;
  label: string;
  icon: typeof Phone;
  color: string;
}[] = [
  { type: "call", label: "Call", icon: Phone, color: "bg-blue-50 text-blue-700 border-blue-100" },
  { type: "email", label: "Email", icon: Mail, color: "bg-violet-50 text-violet-700 border-violet-100" },
  { type: "meeting", label: "Meeting", icon: Calendar, color: "bg-amber-50 text-amber-700 border-amber-100" },
  { type: "note", label: "Note", icon: FileText, color: "bg-gray-50 text-gray-700 border-gray-200" },
  { type: "sms", label: "SMS", icon: MessageSquare, color: "bg-purple-50 text-purple-700 border-purple-100" },
  { type: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
];

export type LogActivityPayload = {
  activityType: ActivityType;
  title: string;
  description: string;
  metadata: Record<string, string | number>;
};

export function LogActivityModal({
  open,
  prospectName,
  onClose,
  onSubmit,
  defaultType,
}: {
  open: boolean;
  prospectName: string;
  onClose: () => void;
  onSubmit: (payload: LogActivityPayload) => void;
  defaultType?: ActivityType;
}) {
  const [type, setType] = useState<ActivityType>(defaultType ?? "call");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("connected");
  const [duration, setDuration] = useState("");
  const [subject, setSubject] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const metadata: Record<string, string | number> = {};
    let resolvedTitle = title;
    let resolvedDescription = description;

    if (type === "call") {
      metadata.outcome = outcome;
      if (duration) metadata.durationMinutes = Number(duration) || 0;
      resolvedTitle = title || `Call with ${prospectName}`;
    } else if (type === "email") {
      metadata.subject = subject;
      resolvedTitle = title || subject || `Email to ${prospectName}`;
    } else if (type === "meeting") {
      metadata.date = meetingDate;
      metadata.location = meetingLocation;
      resolvedTitle = title || `Meeting with ${prospectName}`;
    } else {
      resolvedTitle = title || prospectName;
    }

    onSubmit({
      activityType: type,
      title: resolvedTitle,
      description: resolvedDescription,
      metadata,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[16px] w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Log activity</h2>
            <p className="text-xs text-gray-500 mt-0.5">For {prospectName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = type === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setType(opt.type)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-xs font-medium transition-colors ${
                      active ? opt.color : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <Icon size={16} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {type === "call" && (
            <>
              <Field label="Outcome">
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="connected">Connected</option>
                  <option value="left-voicemail">Left voicemail</option>
                  <option value="no-answer">No answer</option>
                  <option value="wrong-number">Wrong number</option>
                </select>
              </Field>
              <Field label="Duration (minutes)">
                <input
                  type="number"
                  min={0}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. 12"
                />
              </Field>
            </>
          )}

          {type === "email" && (
            <Field label="Subject">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="What was the email about?"
              />
            </Field>
          )}

          {type === "meeting" && (
            <>
              <Field label="Date / time">
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Location">
                <input
                  type="text"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Office, video call, client's home..."
                />
              </Field>
            </>
          )}

          {(type === "note" || type === "sms" || type === "whatsapp") && (
            <Field label="Title (optional)">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder={type === "note" ? "Short headline" : "What was sent?"}
              />
            </Field>
          )}

          <Field label="Notes">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm leading-relaxed"
              placeholder="What happened? Anything to remember for next time?"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 -mx-6 px-6">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark"
            >
              Log activity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
