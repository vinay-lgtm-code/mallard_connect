"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DOCUMENT_CATEGORIES, CATEGORY_LABELS } from "@/schemas/document";
import type { DocumentCategory } from "@/types";

interface RequestDocumentsModalProps {
  leadId: string;
  leadEmail: string | null;
  leadFirstName: string;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

const DEFAULT_CATEGORIES: DocumentCategory[] = [
  "proof_of_id",
  "proof_of_address",
  "bank_statement",
  "payslip",
  "credit_report",
];

export function RequestDocumentsModal({
  leadId,
  leadEmail,
  leadFirstName,
  open,
  onClose,
  onSent,
}: RequestDocumentsModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState(leadEmail ?? "");
  const [selected, setSelected] = useState<Set<DocumentCategory>>(new Set(DEFAULT_CATEGORIES));
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function toggle(cat: DocumentCategory) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  async function handleSend() {
    if (!email.trim() || selected.size === 0) return;
    setSending(true);
    setError(null);

    try {
      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("sb-"))
        ?.split("=")
        .slice(1)
        .join("=");

      const res = await fetch("/api/documents/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          leadId,
          leadEmail: email.trim(),
          categories: Array.from(selected),
          message: message.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }

      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-extrabold text-gray-900">Request Documents</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Send to */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Send to</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`${leadFirstName}'s email`}
              className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Category checkboxes */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Select documents to request</label>
            <div className="mt-2 space-y-1">
              {DOCUMENT_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-2.5 py-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(cat)}
                    onChange={() => toggle(cat)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className={`text-sm ${selected.has(cat) ? "text-gray-800 font-medium" : "text-gray-400"}`}>
                    {CATEGORY_LABELS[cat]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Personal message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Hi ${leadFirstName}, could you please upload...`}
              rows={3}
              className="mt-1.5 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="text-xs text-gray-400">
            {selected.size} document(s) selected &middot; Link expires in 14 days
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !email.trim() || selected.size === 0}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold py-3 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            <Send size={16} />
            {sending ? "Sending..." : "Send request"}
          </button>

          <p className="text-center text-xs text-gray-400">
            Email sent via Resend from {user?.email ?? "reminders@sequence-ai.com"}
          </p>
        </div>
      </div>
    </div>
  );
}
