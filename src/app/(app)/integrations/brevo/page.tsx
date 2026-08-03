"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Check, AlertCircle, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import posthog from "posthog-js";

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
    posthog.capture("brevo_connection_tested");
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
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4"
      >
        <ArrowLeft size={14} /> Back to integrations
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-page flex items-center justify-center flex-shrink-0">
          <Database size={22} className="text-text-secondary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Brevo</h1>
          <p className="mt-1 text-sm text-text-secondary max-w-xl">
            Pull contacts and email open/click events into Sequence. One-way only — Sequence never
            writes back to Brevo, and Resend handles all outbound email.
          </p>
        </div>
      </div>

      {state === "connected" && (
        <div className="bg-white border border-border rounded-[12px] p-6 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
              <Check size={12} />
            </div>
            <p className="text-sm font-semibold text-text-primary">Connected</p>
          </div>
          <SectionLabel>Connection details</SectionLabel>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-text-secondary">List</dt>
            <dd className="text-text-primary">{listId || "All contacts"}</dd>
            <dt className="text-text-secondary">Last sync</dt>
            <dd className="text-text-primary">A few seconds ago</dd>
            <dt className="text-text-secondary">Sync schedule</dt>
            <dd className="text-text-primary">Every 6 hours (cron)</dd>
          </dl>
          <div className="mt-5 flex items-center gap-2">
            <Button variant="secondary">
              <RefreshCw size={13} />
              Sync now
            </Button>
            <Button variant="destructive" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {state !== "connected" && (
        <div className="bg-white border border-border rounded-[12px] p-6 space-y-5">
          <SectionLabel>Credentials</SectionLabel>
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
              Brevo API key
            </label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="xkeysib-…"
                className="w-full border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm font-mono focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              />
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
            </div>
            <p className="mt-1.5 text-xs text-text-secondary">
              Stored encrypted at rest. Read-only access is sufficient.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
              List ID (optional)
            </label>
            <input
              type="text"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              placeholder="Leave blank to sync all contacts"
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-100 text-sm text-rose-800">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <Button
            variant="primary"
            onClick={testConnection}
            disabled={state === "connecting" || !apiKey}
          >
            {state === "connecting" ? (
              <>
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Testing connection...
              </>
            ) : (
              "Test & connect"
            )}
          </Button>
        </div>
      )}

      <div className="mt-6 rounded-[12px] bg-page border border-border p-5 text-xs text-text-secondary leading-relaxed">
        <SectionLabel>How the integration works</SectionLabel>
        <p className="font-semibold text-text-primary mb-1">What Sequence reads from Brevo</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Contact list members (name, email, phone, custom attributes)</li>
          <li>Email-open and link-click events — appear in the lead activity timeline</li>
        </ul>
        <p className="font-semibold text-text-primary mt-3 mb-1">What Sequence does not do</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Send email through Brevo (Resend stays as the send engine)</li>
          <li>Push contacts back to Brevo — read-only by design</li>
          <li>Modify your Brevo lists or workflows in any way</li>
        </ul>
      </div>
    </div>
  );
}
