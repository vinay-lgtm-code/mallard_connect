import * as XLSX from "xlsx";
import type { ImportRow } from "./dedup";

export interface ParseResult {
  rows: ImportRow[];
  columns: string[];
  columnMapping: Record<string, string>;
}

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

  const columns = Object.keys(rows[0]);
  const columnMapping = autoMapColumns(columns);

  const importRows = rows.map((row) => {
    const rawData: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      rawData[key] = String(value);
    }

    const mappedData: ImportRow["mappedData"] = {};
    for (const [csvCol, field] of Object.entries(columnMapping)) {
      const value = rawData[csvCol];
      if (value !== undefined) {
        mappedData[field] = value;
      }
    }

    return { rawData, mappedData };
  });

  return { rows: importRows, columns, columnMapping };
}

export function autoMapColumns(headers: string[]): Record<string, string> {
  const mappings: Array<{ patterns: string[]; field: string }> = [
    { patterns: ["first name", "firstname"], field: "firstName" },
    { patterns: ["last name", "lastname", "surname"], field: "lastName" },
    { patterns: ["client name", "name", "full name", "client"], field: "firstName" },
    { patterns: ["tel number", "phone", "mobile", "telephone", "phone number", "contact number"], field: "phone" },
    { patterns: ["email address", "email"], field: "email" },
    { patterns: ["adviser", "advisor", "assigned to"], field: "assignedTo" },
    { patterns: ["source", "lead source", "enquiry source"], field: "source" },
    { patterns: ["type", "mortgage type", "product type"], field: "mortgageType" },
    { patterns: ["readiness", "lead readiness"], field: "readiness" },
    { patterns: ["notes", "comments", "case notes", "case updates"], field: "notes" },
    { patterns: ["referred by", "referral", "referrer"], field: "referredBy" },
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
