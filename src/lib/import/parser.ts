import * as XLSX from "xlsx";
import type { ImportRow } from "./dedup";
import { autoMapColumns, normalizeHeader, normalizeMortgageType } from "./fields";

export type ParseResult = {
  rows: ImportRow[];
  columns: string[];
  columnMapping: Record<string, string>;
};

function valueToString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function makeUniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();

  return headers.map((header, index) => {
    const base = valueToString(header) || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} ${count + 1}`;
  });
}

function findHeaderRow(rows: unknown[][]): number {
  let bestIndex = -1;
  let bestScore = 0;

  rows.forEach((row, index) => {
    const values = row.map(valueToString);
    const nonEmpty = values.filter(Boolean);
    if (nonEmpty.length < 2) return;

    const mappedCount = Object.keys(autoMapColumns(nonEmpty)).length;
    const score = mappedCount * 10 + Math.min(nonEmpty.length, 10);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex !== -1) return bestIndex;
  return rows.findIndex((row) => row.map(valueToString).filter(Boolean).length > 1);
}

export async function parseImportFile(buffer: Buffer, mimeType: string): Promise<ParseResult> {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: mimeType === "text/csv",
    cellDates: false,
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (matrix.length === 0) return { rows: [], columns: [], columnMapping: {} };

  const headerRowIndex = findHeaderRow(matrix);
  if (headerRowIndex < 0) return { rows: [], columns: [], columnMapping: {} };

  const rawHeaders = matrix[headerRowIndex].map(valueToString);
  const headerIndexes = rawHeaders
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.length > 0);
  const headers = makeUniqueHeaders(headerIndexes.map(({ header }) => header));
  const columnMap = autoMapColumns(headers);

  const importRows = matrix.slice(headerRowIndex + 1).map((row) => {
    const rawData: Record<string, string> = {};
    headerIndexes.forEach(({ index }, headerPosition) => {
      rawData[headers[headerPosition]] = valueToString(row[index]);
    });

    const mappedData: ImportRow["mappedData"] = {};
    for (const [csvCol, mallardField] of Object.entries(columnMap)) {
      const value = rawData[csvCol];
      if (value !== undefined) {
        mappedData[mallardField] = value;
      }
    }

    return { rawData, mappedData };
  }).filter((row) => Object.values(row.rawData).some((value) => normalizeHeader(value).length > 0));

  return { rows: importRows, columns: headers, columnMapping: columnMap };
}

export { autoMapColumns, normalizeMortgageType };
