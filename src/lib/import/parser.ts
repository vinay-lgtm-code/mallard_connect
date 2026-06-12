import * as XLSX from "xlsx";
import type { ImportRow } from "./dedup";

export type ParseResult = {
  rows: ImportRow[];
  columns: string[];
  columnMapping: Record<string, string>;
};

export async function parseImportFile(buffer: Buffer, mimeType: string): Promise<ParseResult> {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: mimeType === "text/csv",
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) return { rows: [], columns: [], columnMapping: {} };

  const headers = Object.keys(rows[0]);
  const columnMap = autoMapColumns(headers);

  const importRows = rows.map((row) => {
    const rawData: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      rawData[key] = String(value);
    }

    const mappedData: ImportRow["mappedData"] = {};
    for (const [csvCol, mallardField] of Object.entries(columnMap)) {
      const value = rawData[csvCol];
      if (value !== undefined) {
        mappedData[mallardField] = value;
      }
    }

    return { rawData, mappedData };
  });

  return { rows: importRows, columns: headers, columnMapping: columnMap };
}

export function autoMapColumns(headers: string[]): Record<string, string> {
  const mappings: Array<{ patterns: string[]; field: string }> = [
    { patterns: ["client", "client name", "name", "full name"], field: "name" },
    { patterns: ["tel number", "phone", "mobile", "telephone"], field: "phone" },
    { patterns: ["email address", "email"], field: "email" },
    { patterns: ["adviser", "advisor", "assigned to"], field: "assignedTo" },
    { patterns: ["case status", "status"], field: "status" },
    { patterns: ["source", "lead source"], field: "source" },
    { patterns: ["date", "created", "date added"], field: "createdAt" },
    { patterns: ["type", "mortgage type", "product type"], field: "mortgageType" },
    { patterns: ["fact find date", "ff date", "fact find"], field: "factFindDate" },
    { patterns: ["case updates", "case update", "notes", "case notes"], field: "notes" },
  ];

  const result: Record<string, string> = {};

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    for (const { patterns, field } of mappings) {
      if (patterns.includes(normalized)) {
        result[header] = field;
        break;
      }
    }
  }

  return result;
}

export function normalizeMortgageType(raw: string): string {
  const map: Record<string, string> = {
    "ftb": "first-time-buyer", "first time buyer": "first-time-buyer", "ftb purchase": "first-time-buyer",
    "btl": "buy-to-let", "buy2let": "buy-to-let", "buy to let": "buy-to-let",
    "remo": "remortgage", "hmo remo": "remortgage", "remortgage": "remortgage", "remo ltd cp": "remortgage",
    "purchase": "other", "purchaser": "other", "flips": "other",
  };
  return map[raw.toLowerCase().trim()] ?? "other";
}
