"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { isCadencesTemplatesEnabled } from "@/lib/feature-flags";
import { ComingSoon } from "@/components/coming-soon";
import { isDemoUser } from "@/lib/mock-data";

const VARIABLES = ["{{firstName}}", "{{lastName}}", "{{adviser}}", "{{firmName}}"];

export default function NewTemplatePage() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const router = useRouter();

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  if (!isCadencesTemplatesEnabled()) {
    return (
      <ComingSoon
        icon={FileText}
        title="Templates"
        description="Reusable email and SMS templates with dynamic variables for cadences and one-click activity logging. Coming soon."
      />
    );
  }

  const isDemo = isDemoUser(user.id);

  function insertVariable(variable: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const updated = before + variable + after;
    setBody(updated);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + variable.length;
      ta.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !body.trim()) {
      setError("Name and body are required.");
      return;
    }
    if (channel === "email" && !subject.trim()) {
      setError("Subject is required for email templates.");
      return;
    }

    setSaving(true);
    try {
      const session = supabase
        ? (await supabase.auth.getSession()).data.session
        : null;
      const token = session?.access_token;

      const payload: Record<string, string> = {
        name: name.trim(),
        channel,
        body: body.trim(),
      };
      if (channel === "email") {
        payload.subject = subject.trim();
      }

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create template");
      }

      router.push("/templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-8 max-w-5xl">
      <Link
        href="/templates"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={15} />
        Back to Templates
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">New template</h1>

      <div className="bg-white border border-gray-100 rounded-[12px] p-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="e.g. FTB deposit-saving check-in"
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="channel"
                  value="email"
                  checked={channel === "email"}
                  onChange={() => setChannel("email")}
                  className="accent-primary"
                />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="channel"
                  value="sms"
                  checked={channel === "sms"}
                  onChange={() => setChannel("sms")}
                  className="accent-primary"
                />
                SMS
              </label>
            </div>
          </div>

          {/* Subject (email only) */}
          {channel === "email" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setError(null); }}
                placeholder="e.g. Just checking in, {{firstName}}"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          )}

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body <span className="text-destructive">*</span>
            </label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => { setBody(e.target.value); setError(null); }}
              rows={12}
              required
              placeholder="Write your template body here..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
            />
          </div>

          {/* Variable insertion */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Insert variable into body</p>
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="text-xs font-mono px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving || isDemo}
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
