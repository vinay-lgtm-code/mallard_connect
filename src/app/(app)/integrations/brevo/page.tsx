"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Check, AlertCircle, Lock, RefreshCw } from "lucide-react";

type ConnState = "disconnected" | "connecting" | "connected" | "error";

export default function BrevoIntegrationPage() {
  const [state, setState] = useState<ConnState>("disconnected");
  const [apiKey, setApiKey] = useState("");
  const [listId, setListId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function testConnection() {
    setError(null);
    if (!apiKey.startsWith("xkeysib-")) {
      setError("Brevo API keys start with xkeysib-. Double-check Settings → API keys in Brevo.");
      setState("error");
      return;
    }
    setState("connecting");
    // Simulated for demo: a real call would POST /api/integrations/brevo/connect.
    await new Promise((r) => setTimeout(r, 900));
    setState("connected");
  }

  function disconnect() {
    setState("disconnected");
    setApiKey("");
    setListId("");
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={14} /> Back to integrations
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Database size={22} className="text-gray-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brevo</h1>
          <p className="mt-1 text-sm text-gray-500 max-w-xl">
            Pull contacts and email open/click events into Sequence. One-way only — Sequence never
            writes back to Brevo, and Resend handles all outbound email.
          </p>
        </div>
      </div>

      {state === "connected" && (
        <div className="bg-white border border-gray-100 rounded-[12px] p-6 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
              <Check size={12} />
            </div>
            <p className="text-sm font-semibold text-gray-900">Connected</p>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">List</dt>
            <dd className="text-gray-900">{listId || "All contacts"}</dd>
            <dt className="text-gray-500">Last sync</dt>
            <dd className="text-gray-900">A few seconds ago</dd>
            <dt className="text-gray-500">Sync schedule</dt>
            <dd className="text-gray-900">Every 6 hours (cron)</dd>
          </dl>
          <div className="mt-5 flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <RefreshCw size={13} />
              Sync now
            </button>
            <button
              onClick={disconnect}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {state !== "connected" && (
        <div className="bg-white border border-gray-100 rounded-[12px] p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
              Brevo API key
            </label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="xkeysib-…"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Stored encrypted at rest. Read-only access is sufficient.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
              List ID (optional)
            </label>
            <input
              type="text"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              placeholder="Leave blank to sync all contacts"
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-100 text-sm text-rose-800">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={testConnection}
            disabled={state === "connecting" || !apiKey}
            className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-dark disabled:opacity-60"
          >
            {state === "connecting" ? (
              <>
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Testing connection...
              </>
            ) : (
              "Test &amp; connect"
            )}
          </button>
        </div>
      )}

      <div className="mt-6 rounded-[12px] bg-gray-50 border border-gray-100 p-5 text-xs text-gray-600 leading-relaxed">
        <p className="font-semibold text-gray-900 mb-1">What Sequence reads from Brevo</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Contact list members (name, email, phone, custom attributes)</li>
          <li>Email-open and link-click events — appear in the lead activity timeline</li>
        </ul>
        <p className="font-semibold text-gray-900 mt-3 mb-1">What Sequence does not do</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Send email through Brevo (Resend stays as the send engine)</li>
          <li>Push contacts back to Brevo — read-only by design</li>
          <li>Modify your Brevo lists or workflows in any way</li>
        </ul>
      </div>
    </div>
  );
}
