"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useSupabase } from "@/hooks/use-supabase";

interface EditableFieldProps {
  label: string;
  value: string | number | null;
  field: string;
  type: "text" | "select" | "date" | "number" | "tel" | "email";
  options?: { value: string; label: string }[];
  leadId: string;
  tenantId: string;
  demo?: boolean;
  onSaved?: () => void;
  displayValue?: string;
  linkHref?: string;
}

export function EditableField({
  label,
  value,
  field,
  type,
  options,
  leadId,
  tenantId,
  demo,
  onSaved,
  displayValue,
  linkHref,
}: EditableFieldProps) {
  const supabase = useSupabase();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  function startEditing() {
    if (demo) return;
    setEditValue(String(value ?? ""));
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setEditValue(String(value ?? ""));
  }

  async function save() {
    if (!supabase) return;
    setSaving(true);
    try {
      const newValue =
        type === "number" ? (editValue === "" ? null : Number(editValue)) : editValue || null;
      await supabase
        .from("leads")
        .update({ [field]: newValue })
        .eq("id", leadId);
      onSaved?.();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      cancel();
    } else if (e.key === "Enter") {
      save();
    }
  }

  const inputClasses =
    "w-full px-2 py-1 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  const rendered = displayValue ?? (value != null && value !== "" ? String(value) : null);

  if (editing) {
    return (
      <div>
        <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</span>
        <div className="flex items-center gap-1 mt-0.5">
          {type === "select" ? (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              className={inputClasses}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
            >
              <option value="">--</option>
              {options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              className={inputClasses}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="p-0.5 hover:bg-green-50 rounded"
          >
            <Check size={14} className="text-green-600" />
          </button>
          <button
            type="button"
            onClick={cancel}
            className="p-0.5 hover:bg-gray-100 rounded"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group cursor-pointer" onClick={startEditing}>
      <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</span>
      <div className="flex items-center gap-1 mt-0.5">
        {rendered ? (
          linkHref ? (
            <a
              href={linkHref}
              className="text-gray-700 text-sm underline hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {rendered}
            </a>
          ) : (
            <span className="text-gray-700 text-sm">{rendered}</span>
          )
        ) : (
          <span className="text-gray-700 text-sm">&mdash;</span>
        )}
        {!demo && (
          <Pencil
            size={12}
            className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
      </div>
    </div>
  );
}
