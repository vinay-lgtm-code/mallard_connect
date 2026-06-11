"use client";

import { use, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { useTemplates } from "@/hooks/use-templates";
import { isDemoUser } from "@/lib/mock-data";
import type { TemplateChannel } from "@/types";

const CHANNEL_OPTIONS: { value: TemplateChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

const AVAILABLE_VARIABLES = [
  "firstName",
  "lastName",
  "adviser",
  "firmName",
  "nextActionDate",
];

function extractVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useSupabase();
  const { templates } = useTemplates();
  const demo = user ? isDemoUser(user.id) : false;

  const isNew = id === "new";
  const existingTemplate = useMemo(
    () => (isNew ? null : templates.find((t) => t.id === id)),
    [templates, id, isNew]
  );

  const [name, setName] = useState(existingTemplate?.name ?? "");
  const [channel, setChannel] = useState<TemplateChannel>(existingTemplate?.channel ?? "email");
  const [subject, setSubject] = useState(existingTemplate?.subject ?? "");
  const [body, setBody] = useState(existingTemplate?.body ?? "");

  // Sync from existing template when it loads (templates hook is async)
  const [synced, setSynced] = useState(isNew);
  if (!isNew && existingTemplate && !synced) {
    setName(existingTemplate.name);
    setChannel(existingTemplate.channel);
    setSubject(existingTemplate.subject ?? "");
    setBody(existingTemplate.body);
    setSynced(true);
  }

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const detectedVariables = useMemo(() => extractVariables(body), [body]);

  const showSuccessBanner = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!name.trim()) {
      setSubmitError("Template name is required.");
      return;
    }
    if (!body.trim()) {
      setSubmitError("Template body is required.");
      return;
    }
    if (channel === "email" && !subject.trim()) {
      setSubmitError("Email templates require a subject line.");
      return;
    }

    if (!user) {
      setSubmitError("You must be logged in.");
      return;
    }

    setSaving(true);
    try {
      if (demo) {
        showSuccessBanner(isNew ? "Template created!" : "Template updated!");
        setTimeout(() => router.push("/templates"), 1500);
        return;
      }

      if (!supabase) throw new Error("Database not configured");
      await supabase.auth.refreshSession();

      const payload = {
        tenant_id: user.tenantId,
        name: name.trim(),
        channel,
        subject: channel === "email" ? subject.trim() : null,
        body: body.trim(),
        variables: detectedVariables,
        updated_at: new Date().toISOString(),
      };

      if (isNew) {
        const { error } = await supabase.from("templates").insert(payload);
        if (error) throw error;
      } else {
        // Don't send tenant_id on update — it's immutable
        const { tenant_id: _tid, ...updatePayload } = payload;
        void _tid;
        const { error } = await supabase
          .from("templates")
          .update(updatePayload)
          .eq("id", id);
        if (error) throw error;
      }

      router.push("/templates");
    } catch (err: unknown) {
      console.error("Failed to save template:", err);
      const detail = err instanceof Error ? err.message : "";
      setSubmitError(
        detail ? `Failed to save template: ${detail}` : "Failed to save template. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSubmitError(null);
    setDeleting(true);

    try {
      if (demo) {
        showSuccessBanner("Template deleted");
        setTimeout(() => router.push("/templates"), 1000);
        return;
      }

      if (!supabase) throw new Error("Database not configured");
      await supabase.auth.refreshSession();

      const { error } = await supabase.from("templates").delete().eq("id", id);
      if (error) throw error;
      router.push("/templates");
    } catch (err: unknown) {
      console.error("Failed to delete template:", err);
      const detail = err instanceof Error ? err.message : "";
      setSubmitError(detail ? `Failed to delete: ${detail}` : "Failed to delete template.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (!user) return null;

  // If editing an existing template that hasn't loaded yet
  if (!isNew && !existingTemplate && templates.length > 0) {
    return (
      <div className="px-6 py-8">
        <Link href="/templates" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft size={14} /> Back to templates
        </Link>
        <p className="mt-6 text-gray-500">Template not found.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg">
          {successMessage}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[12px] p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete template?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete <strong>{name || "this template"}</strong>. Cadences using
              this template will need to be updated.
            </p>
            {submitError && (
              <p className="mb-4 text-sm text-destructive">{submitError}</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setSubmitError(null); }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Link
        href="/templates"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={14} /> Back to templates
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? "New template" : "Edit template"}
        </h1>
        {!isNew && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Delete
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white border border-gray-100 rounded-[12px] p-6 mb-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. FTB initial welcome"
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as TemplateChannel)}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                {CHANNEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {channel === "email" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. {{firstName}}, here's your next step"
                  className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Body <span className="text-destructive">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder={`Hi {{firstName}},\n\nJust checking in on your mortgage journey...\n\nBest,\n{{adviser}} at {{firmName}}`}
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y font-mono leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Variables section */}
        <div className="bg-white border border-gray-100 rounded-[12px] p-6 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Variables</h2>
          <p className="text-xs text-gray-500 mb-3">
            Use <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-700">{"{{variableName}}"}</code> in
            the body. These are auto-detected from your template content.
          </p>

          {detectedVariables.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {detectedVariables.map((v) => (
                <span
                  key={v}
                  className={`inline-block text-xs px-2 py-1 rounded font-mono ${
                    AVAILABLE_VARIABLES.includes(v)
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {`{{${v}}}`}
                  {!AVAILABLE_VARIABLES.includes(v) && (
                    <span className="ml-1 text-[10px] font-sans">(unknown)</span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-4">No variables detected in the body.</p>
          )}

          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Available variables:</p>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_VARIABLES.map((v) => (
                <span
                  key={v}
                  className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono"
                >
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>
        </div>

        {submitError && !showDeleteConfirm && (
          <p className="mb-4 text-sm text-destructive text-center">{submitError}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : isNew ? "Create template" : "Save changes"}
          </button>
          <Link
            href="/templates"
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
