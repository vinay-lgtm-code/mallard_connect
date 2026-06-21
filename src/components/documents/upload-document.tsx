"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { Upload, X, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DOCUMENT_CATEGORIES, CATEGORY_LABELS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/schemas/document";
import type { DocumentCategory } from "@/types";

interface UploadDocumentProps {
  leadId: string;
  onUploaded: () => void;
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDocument({ leadId, onUploaded }: UploadDocumentProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function validateFile(f: File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(f.type)) {
      return "File type not supported. Accepted: PDF, JPEG, PNG, WebP, DOC, DOCX";
    }
    if (f.size > MAX_FILE_SIZE) {
      return `File too large (${formatFileSize(f.size)}). Maximum is 25 MB.`;
    }
    return null;
  }

  function handleFileSelect(f: File) {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) handleFileSelect(selected);
  }

  async function handleUpload() {
    if (!file || !user) return;
    setUploading(true);
    setError(null);

    try {
      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("sb-"))
        ?.split("=")
        .slice(1)
        .join("=");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("leadId", leadId);
      formData.append("category", category);
      if (description.trim()) formData.append("description", description.trim());

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }

      setFile(null);
      setCategory("other");
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Upload Document</h3>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : file
              ? "border-green-300 bg-green-50"
              : "border-gray-200 hover:border-gray-300 bg-gray-50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleInputChange}
          className="hidden"
        />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileText size={20} className="text-green-600" />
            <span className="text-sm font-medium text-green-700">{file.name}</span>
            <span className="text-xs text-green-500">({formatFileSize(file.size)})</span>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <Upload size={24} className="mx-auto text-gray-400" />
            <p className="text-sm text-gray-500">
              Drop a file here or <span className="text-primary font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-400">PDF, JPEG, PNG, WebP, DOC, DOCX up to 25 MB</p>
          </div>
        )}
      </div>

      {/* Category + description */}
      {file && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. March 2025 statement"
              maxLength={500}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {file && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      )}
    </div>
  );
}
