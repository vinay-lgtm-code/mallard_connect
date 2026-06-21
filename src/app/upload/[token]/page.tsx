"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { Upload, CheckCircle2, Lock, AlertCircle } from "lucide-react";
import { CATEGORY_LABELS } from "@/schemas/document";
import type { DocumentCategory } from "@/types";

interface RequestData {
  leadName: string;
  firmName: string;
  requestedCategories: DocumentCategory[];
  message: string | null;
  uploadedCategories: string[];
}

type UploadState = "idle" | "uploading" | "done" | "error";

function CategoryLabel({ cat }: { cat: DocumentCategory }) {
  return <>{CATEGORY_LABELS[cat] ?? cat.replace(/_/g, " ")}</>;
}

export default function ClientUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<RequestData | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const [uploadedCats, setUploadedCats] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch(`/api/documents/upload/${encodeURIComponent(token)}`)
      .then((r) => {
        if (r.status === 410) { setExpired(true); setLoading(false); return null; }
        if (!r.ok) { setExpired(true); setLoading(false); return null; }
        return r.json();
      })
      .then((d: RequestData | null) => {
        if (d) {
          setData(d);
          setUploadedCats(new Set(d.uploadedCategories));
        }
        setLoading(false);
      })
      .catch(() => { setExpired(true); setLoading(false); });
  }, [token]);

  async function handleUpload(cat: DocumentCategory, file: File) {
    setUploadStates((s) => ({ ...s, [cat]: "uploading" }));
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", cat);

    try {
      const res = await fetch(`/api/documents/upload/${encodeURIComponent(token)}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      setUploadStates((s) => ({ ...s, [cat]: "done" }));
      setUploadedCats((prev) => new Set([...prev, cat]));
    } catch {
      setUploadStates((s) => ({ ...s, [cat]: "error" }));
    }
  }

  function handleFileChange(cat: DocumentCategory, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(cat, file);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (expired || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 max-w-md text-center space-y-3">
          <AlertCircle size={32} className="mx-auto text-red-400" />
          <h1 className="text-lg font-bold text-gray-900">Link expired</h1>
          <p className="text-sm text-gray-500">This upload link is no longer valid. Please contact your adviser for a new link.</p>
        </div>
      </div>
    );
  }

  const totalRequested = data.requestedCategories.length;
  const totalUploaded = data.requestedCategories.filter((c) => uploadedCats.has(c)).length;
  const allDone = totalUploaded === totalRequested;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold text-primary">Sequence</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">Secure portal</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <Lock size={14} />
          <span>Encrypted</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Hi {data.leadName.split(" ")[0]},</h1>
            <p className="text-sm text-gray-500 mt-2">
              {data.firmName} has requested the following documents for your mortgage application.
            </p>
          </div>

          {data.message && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 italic">
              &ldquo;{data.message}&rdquo;
            </div>
          )}

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span className="font-semibold">{totalUploaded} of {totalRequested} uploaded</span>
              {allDone && <span className="text-green-600 font-bold">Complete</span>}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${totalRequested > 0 ? (totalUploaded / totalRequested) * 100 : 0}%` }}
              />
            </div>
          </div>

          {allDone && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-800">All documents received</p>
                <p className="text-xs text-green-600 mt-0.5">Your adviser will review them shortly. You&apos;ll hear from us soon.</p>
              </div>
            </div>
          )}

          {/* Category rows */}
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {data.requestedCategories.map((cat) => {
              const isDone = uploadedCats.has(cat);
              const state = uploadStates[cat] ?? "idle";

              return (
                <div
                  key={cat}
                  className={`flex items-center justify-between px-4 py-3.5 ${isDone ? "bg-gray-50" : "bg-white"}`}
                >
                  <div className="flex items-center gap-3">
                    {isDone ? (
                      <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <span className={`text-sm font-semibold ${isDone ? "text-gray-400" : "text-gray-800"}`}>
                      <CategoryLabel cat={cat} />
                    </span>
                  </div>

                  <div>
                    <input
                      ref={(el) => { fileInputRefs.current[cat] = el; }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      className="hidden"
                      onChange={(e) => handleFileChange(cat, e)}
                    />
                    {isDone ? (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">Done</span>
                    ) : state === "uploading" ? (
                      <span className="text-xs font-semibold text-gray-500">Uploading...</span>
                    ) : state === "error" ? (
                      <button
                        onClick={() => fileInputRefs.current[cat]?.click()}
                        className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg"
                      >
                        Retry
                      </button>
                    ) : (
                      <button
                        onClick={() => fileInputRefs.current[cat]?.click()}
                        className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-primary-dark transition-colors"
                      >
                        <Upload size={14} />
                        Upload
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-2">
            <Lock size={12} />
            <span>Your documents are encrypted and only visible to your adviser.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
