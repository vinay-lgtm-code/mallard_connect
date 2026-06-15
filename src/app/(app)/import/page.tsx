"use client";

import { useState, useRef } from "react";
import { Upload, Check, RefreshCw } from "lucide-react";
import { useAuth, isDemoMode } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { IMPORT_TARGET_FIELDS, autoMapColumns } from "@/lib/import/fields";

type Step = "upload" | "mapping" | "preview" | "importing" | "done";

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

interface DuplicateRecord {
  id: string;
  name: string;
  phone: string;
  action: "update";
  selected: boolean;
}

interface StoredRow {
  rawData: Record<string, string>;
  mappedData: Record<string, string | undefined>;
  matchedLeadId?: string;
  matchType?: string;
}

function parseCSVClient(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { columns: [], rows: [] };

  const columns = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    columns.forEach((col, i) => {
      row[col] = values[i] ?? "";
    });
    return row;
  });

  return { columns, rows };
}

function remapRows(rows: StoredRow[], mappingList: ColumnMapping[]): StoredRow[] {
  const mappingMap: Record<string, string> = {};
  for (const m of mappingList) {
    if (m.targetField) mappingMap[m.sourceColumn] = m.targetField;
  }

  return rows.map((row) => {
    const mappedData: Record<string, string | undefined> = {};
    for (const [csvCol, targetField] of Object.entries(mappingMap)) {
      const value = row.rawData[csvCol];
      if (value !== undefined && value !== "") {
        mappedData[targetField] = value;
      }
    }
    return { ...row, mappedData };
  });
}

async function readErrorDetail(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `Request failed with status ${res.status}`;

  try {
    const json = JSON.parse(text) as { error?: unknown; errors?: unknown };
    if (Array.isArray(json.errors) && json.errors[0]) return String(json.errors[0]);
    if (json.error) return String(json.error);
  } catch {
    // Fall through to the raw response body.
  }

  return text;
}

function importFailureDetail(result: { error?: unknown; errors?: unknown }): string {
  if (Array.isArray(result.errors) && result.errors[0]) return String(result.errors[0]);
  if (result.error) return String(result.error);
  return "The server did not return row-level error details.";
}

const VISIBLE_STEPS: Step[] = ["upload", "mapping", "preview", "done"];

function StepIndicator({ current, step, label }: { current: Step; step: Step; label: string }) {
  const allSteps: Step[] = ["upload", "mapping", "preview", "importing", "done"];
  const currentIdx = allSteps.indexOf(current);
  const stepIdx = VISIBLE_STEPS.indexOf(step);
  const fullStepIdx = allSteps.indexOf(step);
  const done = currentIdx > fullStepIdx;
  const active = current === step || (step === "done" && current === "importing");

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          done
            ? "bg-success text-white"
            : active
            ? "bg-primary text-white"
            : "bg-gray-200 text-gray-500"
        }`}
      >
        {done ? <Check size={14} /> : stepIdx + 1}
      </div>
      <span className={`text-sm font-medium hidden sm:block ${active ? "text-gray-900" : "text-gray-400"}`}>
        {label}
      </span>
    </div>
  );
}

export default function ImportPage() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const demo = isDemoMode();
  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [duplicateUpdates, setDuplicateUpdates] = useState<DuplicateRecord[]>([]);
  const [progress, setProgress] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [skipCount, setSkipCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [storedToCreate, setStoredToCreate] = useState<StoredRow[]>([]);
  const [storedToUpdate, setStoredToUpdate] = useState<StoredRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateCount = duplicateUpdates.filter((d) => d.selected).length;
  const totalImporting = newCount + updateCount;

  async function handleFile(file: File) {
    setFileName(file.name);
    setImportError(null);
    setUploadLoading(true);

    try {
      if (demo) {
        const text = await file.text();
        const { columns, rows } = parseCSVClient(text);
        if (columns.length === 0) throw new Error("No columns found in file.");

        const columnMapping = autoMapColumns(columns);
        const toCreate: StoredRow[] = rows.map((rawData) => {
          const mappedData: Record<string, string | undefined> = {};
          for (const [csvCol, field] of Object.entries(columnMapping)) {
            if (rawData[csvCol]) mappedData[field] = rawData[csvCol];
          }
          return { rawData, mappedData };
        });

        setMappings(columns.map((col) => ({
          sourceColumn: col,
          targetField: columnMapping[col] ?? "",
        })));
        setNewCount(toCreate.length);
        setSkipCount(0);
        setDuplicateUpdates([]);
        setStoredToCreate(toCreate);
        setStoredToUpdate([]);
        setStep("mapping");
        return;
      }

      if (!supabase) throw new Error("Database not configured");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated. Please sign in again.");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(await readErrorDetail(res));
      }

      const preview = await res.json();

      const sourceColumns: string[] = preview.columns ?? [];
      const autoMapping = {
        ...autoMapColumns(sourceColumns),
        ...(preview.columnMapping ?? {}),
      };
      setMappings(sourceColumns.map((col: string) => ({
        sourceColumn: col,
        targetField: autoMapping[col] ?? "",
      })));

      setNewCount(preview.stats?.new ?? 0);
      setSkipCount(preview.stats?.skip ?? 0);
      setStoredToCreate(preview.toCreate ?? []);
      setStoredToUpdate(preview.toUpdate ?? []);

      if (Array.isArray(preview.duplicates)) {
        setDuplicateUpdates(
          preview.duplicates.map((d: { id: string; name: string; phone: string }) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            action: "update" as const,
            selected: true,
          }))
        );
      } else {
        setDuplicateUpdates([]);
      }

      setStep("mapping");
    } catch (err) {
      console.error("Upload error:", err);
      setImportError(err instanceof Error ? err.message : "Failed to upload file. Please try again.");
    } finally {
      setUploadLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function updateMapping(sourceColumn: string, targetField: string) {
    setMappings((prev) =>
      prev.map((m) => (m.sourceColumn === sourceColumn ? { ...m, targetField } : m))
    );
  }

  function toggleDuplicateUpdate(id: string) {
    setDuplicateUpdates((prev) =>
      prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d))
    );
  }

  async function startImport() {
    setStep("importing");
    setProgress(0);
    setImportError(null);

    try {
      if (demo) {
        setProgress(100);
        setStep("done");
        return;
      }

      if (!supabase) throw new Error("Database not configured");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated. Please sign in again.");

      const selectedUpdateIds = new Set(
        duplicateUpdates.filter((d) => d.selected).map((d) => d.id)
      );

      const toCreate = remapRows(storedToCreate, mappings);
      const toUpdate = remapRows(
        storedToUpdate.filter((r) => r.matchedLeadId && selectedUpdateIds.has(r.matchedLeadId)),
        mappings
      );

      const res = await fetch("/api/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "execute",
          toCreate,
          toUpdate,
          fileName,
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorDetail(res));
      }

      const result = await res.json();
      setNewCount(result.created ?? 0);

      if (result.failed > 0 && result.created === 0) {
        const detail = importFailureDetail(result);
        throw new Error(`All rows failed to import: ${detail}`);
      }
      if (result.failed > 0) {
        setImportError(`${result.failed} row(s) failed: ${importFailureDetail(result)}`);
      }

      setProgress(100);
      setStep("done");
    } catch (err) {
      console.error("Import error:", err);
      setImportError(err instanceof Error ? err.message : "Import failed. Please try again.");
      setStep("preview");
    }
  }

  function resetImport() {
    setStep("upload");
    setFileName(null);
    setProgress(0);
    setMappings([]);
    setDuplicateUpdates([]);
    setNewCount(0);
    setSkipCount(0);
    setImportError(null);
    setStoredToCreate([]);
    setStoredToUpdate([]);
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-3">
        <StepIndicator current={step} step="upload" label="Upload" />
        <div className="flex-1 h-px bg-gray-200" />
        <StepIndicator current={step} step="mapping" label="Map columns" />
        <div className="flex-1 h-px bg-gray-200" />
        <StepIndicator current={step} step="preview" label="Review" />
        <div className="flex-1 h-px bg-gray-200" />
        <StepIndicator current={step} step="done" label="Done" />
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-1">Upload File</h2>
          <p className="text-sm text-gray-500 mb-5">Import leads from a MAB CSV or Excel export.</p>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-[12px] p-10 text-center transition-colors cursor-pointer ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-gray-300 hover:border-primary hover:bg-gray-50"
            } ${uploadLoading ? "opacity-60 pointer-events-none" : ""}`}
            onClick={() => !uploadLoading && fileInputRef.current?.click()}
          >
            {uploadLoading ? (
              <>
                <RefreshCw className="mx-auto text-primary animate-spin mb-3" size={36} />
                <p className="text-sm font-semibold text-gray-700">Processing file…</p>
              </>
            ) : (
              <>
                <Upload className="mx-auto text-gray-400 mb-3" size={36} />
                <p className="text-sm font-semibold text-gray-700">Drop CSV or XLS file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {importError && (
            <p className="text-sm text-destructive mt-3 text-center">{importError}</p>
          )}

          <p className="text-xs text-gray-400 text-center mt-3">Supported formats: CSV, XLS, XLSX · Max 10 MB</p>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <div className="bg-white rounded-[12px] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-gray-900">Map Columns</h2>
            <span className="text-xs text-gray-400">{fileName}</span>
          </div>
          <p className="text-sm text-gray-500 mb-5">Match each source column to a Sequence field.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2 pr-4">Source column</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2">Maps to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mappings.map((m) => (
                  <tr key={m.sourceColumn} className={!m.targetField ? "opacity-50" : ""}>
                    <td className="py-2.5 pr-4 font-medium text-gray-700">{m.sourceColumn}</td>
                    <td className="py-2">
                      <select
                        value={m.targetField}
                        onChange={(e) => updateMapping(m.sourceColumn, e.target.value)}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white w-full max-w-xs"
                      >
                        {IMPORT_TARGET_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep("upload")}
              className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep("preview")}
              className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors"
            >
              Preview Import →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Dedup Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-4">Review Import</h2>

            {/* New leads */}
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">{newCount}</span>
                </div>
                <div>
                  <p className="font-semibold text-green-800">New leads</p>
                  <p className="text-sm text-green-600">Will be created as new records.</p>
                </div>
              </div>
            </div>

            {/* Skip duplicates */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">{skipCount}</span>
                </div>
                <div>
                  <p className="font-semibold text-amber-800">Duplicates (skip)</p>
                  <p className="text-sm text-amber-600">Existing records are more recent. These will be skipped.</p>
                </div>
              </div>
            </div>

            {/* Update duplicates */}
            {duplicateUpdates.length > 0 && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-info flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{duplicateUpdates.length}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-blue-800">Duplicates (update available)</p>
                    <p className="text-sm text-blue-600">Incoming data is newer. Toggle to update each record.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {duplicateUpdates.map((record) => (
                    <div key={record.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-100">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{record.name}</p>
                        <p className="text-xs text-gray-500">{record.phone}</p>
                      </div>
                      <button
                        onClick={() => toggleDuplicateUpdate(record.id)}
                        className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                          record.selected ? "bg-primary" : "bg-gray-300"
                        }`}
                        role="switch"
                        aria-checked={record.selected}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            record.selected ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importError && (
              <p className="text-sm text-destructive mt-3">{importError}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("mapping")}
              className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={startImport}
              className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg text-sm hover:bg-primary-dark transition-colors"
            >
              Import {totalImporting} Lead{totalImporting !== 1 ? "s" : ""} →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Importing (progress) */}
      {step === "importing" && (
        <div className="bg-white rounded-[12px] p-8 shadow-sm border border-gray-100 text-center">
          <RefreshCw className="mx-auto text-primary animate-spin mb-4" size={36} />
          <h2 className="text-base font-bold text-gray-900 mb-4">Importing leads…</h2>
          <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">{progress}%</p>
        </div>
      )}

      {/* Step 5: Done */}
      {step === "done" && (
        <div className="bg-white rounded-[12px] p-8 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <Check className="text-success" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import complete!</h2>
          <p className="text-gray-600 text-sm">
            Imported <span className="font-semibold text-gray-900">{newCount} new leads</span>.{" "}
            Skipped <span className="font-semibold text-gray-900">{skipCount}</span>.{" "}
            Updated <span className="font-semibold text-gray-900">{updateCount}</span>.
          </p>
          <div className="flex gap-3 mt-6 justify-center">
            <button
              onClick={resetImport}
              className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Import another file
            </button>
            <a
              href="/leads"
              className="px-5 py-2.5 bg-primary text-white font-semibold rounded-lg text-sm hover:bg-primary-dark transition-colors"
            >
              View all leads →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
