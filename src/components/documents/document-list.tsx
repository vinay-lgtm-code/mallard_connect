"use client";

import { useState } from "react";
import { FileText, Download, Trash2, Image, File } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORY_LABELS } from "@/schemas/document";
import type { Document, DocumentCategory, User } from "@/types";

interface DocumentListProps {
  documents: (Document & { id: string })[];
  users: (User & { id: string })[];
  onDeleted: () => void;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image size={16} className="text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText size={16} className="text-red-500" />;
  return <File size={16} className="text-text-secondary" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({ documents, users, onDeleted }: DocumentListProps) {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDownload(docId: string) {
    try {
      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("sb-"))
        ?.split("=")
        .slice(1)
        .join("=");

      const res = await fetch(`/api/documents/${docId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) return;
      const { url } = await res.json();
      window.open(url, "_blank", "noopener");
    } catch {
      // silent
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setDeleting(docId);
    try {
      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("sb-"))
        ?.split("=")
        .slice(1)
        .join("=");

      await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      onDeleted();
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  }

  const grouped = documents.reduce<Record<string, (Document & { id: string })[]>>((acc, doc) => {
    const key = doc.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const categoryOrder = Object.keys(CATEGORY_LABELS) as DocumentCategory[];
  const sortedCategories = categoryOrder.filter((c) => grouped[c]?.length);

  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-[12px] p-6 text-center text-sm text-text-muted border border-border">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedCategories.map((cat) => (
        <div key={cat} className="bg-white rounded-[12px] border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-page border-b border-border">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              {CATEGORY_LABELS[cat]} ({grouped[cat].length})
            </h4>
          </div>
          <div className="divide-y divide-gray-50">
            {grouped[cat].map((doc) => {
              const uploaderName = users.find((u) => u.id === doc.uploadedBy)?.fullName ?? "Unknown";
              const date = doc.createdAt ? new Date(doc.createdAt) : undefined;

              return (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-page transition-colors">
                  <div className="flex-shrink-0">{fileIcon(doc.mimeType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{doc.fileName}</p>
                    <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                      <span>{formatSize(doc.fileSize)}</span>
                      <span>&middot;</span>
                      <span>{uploaderName}</span>
                      {date && (
                        <>
                          <span>&middot;</span>
                          <span>{format(date, "d MMM yyyy")}</span>
                        </>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-xs text-text-secondary mt-0.5 truncate">{doc.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className="p-1.5 text-text-muted hover:text-primary rounded-lg hover:bg-page transition-colors"
                      title="Download"
                    >
                      <Download size={16} />
                    </button>
                    {isManager && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deleting === doc.id}
                        className="p-1.5 text-text-muted hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
