"use client";

import { use, useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { useTemplates } from "@/hooks/use-templates";
import { isCadencesTemplatesEnabled } from "@/lib/feature-flags";
import { isDemoUser } from "@/lib/mock-data";
import { extractVariables } from "@/lib/email/render";
import { ComingSoon } from "@/components/coming-soon";
import type { TemplateChannel } from "@/types";

export default function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useSupabase();
  const { templates, loading: templatesLoading } = useTemplates();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const template = templates.find((t) => t.id === id);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<TemplateChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Populate form when template loads
  useEffect(() => {
    if (template) {
      setName(template.name);
      setChannel(template.channel);
      setSubject(template.subject ?? "");
      setBody(template.body);
    }
  }, [template]);

  const isDemo = user ? isDemoUser(user.id) : false;
  const isAdminOrManager = user?.role === "manager" || user?.role === "admin";

  // Live variable detection from body + subject
  const detectedVariables = useMemo(() => {
    const combined = channel === "email" ? `${subject} ${body}` : body;
    return extractVariables(combined);
  }, [subject, body, channel]);

  function insertVariable(variable: string) {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const newText = text.substring(0, start) + variable + text.substring(end);
    setBody(newText);
    // Restore cursor position after React re-render
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    }, 0);
  }

  async function handleSave() {
    if (!supabase || !name.trim() || !body.trim()) return;
    setSaving(true);
    setFeedback(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/templates/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          channel,
          subject: channel === "email" ? subject.trim() : undefined,
          body: body.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }

      setFeedback({ type: "success", message: "Template saved." });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save template.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!supabase) return;
    const confirmed = window.confirm(
      `Delete "${name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setFeedback(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        const cadenceNames = data.cadences
          ? (data.cadences as string[]).join(", ")
          : "one or more cadences";
        window.alert(
          `Cannot delete this template because it is used by: ${cadenceNames}. Remove it from those cadences first.`
        );
        setDeleting(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${res.status})`);
      }

      router.push("/templates");
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete template.",
      });
      setDeleting(false);
    }
  }

  if (!isCadencesTemplatesEnabled()) {
    return (
      <ComingSoon
        icon={FileText}
        title="Templates"
        description="Reusable email and SMS templates with dynamic variables for cadences and one-click activity logging. Coming soon."
      />
    );
  }

  if (!user || templatesLoading) {
    return (
      <div className="px-6 py-8 max-w-5xl">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={16} className="animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="px-6 py-8 max-w-5xl">
        <Link
          href="/templates"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4"
        >
          <ArrowLeft size={14} /> Back to templates
        </Link>
        <p className="text-sm text-text-secondary">Template not found.</p>
      </div>
    );
  }

  const VARIABLES = [
    "{{firstName}}",
    "{{lastName}}",
    "{{adviser}}",
    "{{firmName}}",
  ];

  return (
    <div className="px-6 py-8 max-w-5xl">
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4"
      >
        <ArrowLeft size={14} /> Back to templates
      </Link>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Edit template</h1>

      <div className="bg-white border border-border rounded-[12px] p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. FTB welcome email"
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
        </div>

        {/* Channel */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Channel
          </label>
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
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
            <label className="inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
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
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. {{firstName}}, here's your next step"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            />
          </div>
        )}

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Body <span className="text-red-400">*</span>
          </label>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder="Write your template body here..."
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10 resize-y"
          />
        </div>

        {/* Variable insertion buttons */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">
            Insert variable
          </p>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="px-2 py-1 rounded border border-border text-xs font-mono text-text-secondary hover:bg-page hover:border-border-strong transition-colors"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Detected variables */}
        {detectedVariables.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-secondary mb-2">
              Detected variables
            </p>
            <div className="flex flex-wrap gap-1.5">
              {detectedVariables.map((v) => (
                <span
                  key={v}
                  className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-page text-text-secondary font-mono"
                >
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <p
            className={`text-sm ${
              feedback.type === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {feedback.message}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {isAdminOrManager && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDemo || deleting}
              >
                {deleting ? "Deleting..." : "Delete template"}
              </Button>
            )}
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={isDemo || saving || !name.trim() || !body.trim()}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving..." : "Save template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
