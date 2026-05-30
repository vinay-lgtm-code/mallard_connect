type AnyRecord = Record<string, unknown>;

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function rowToApp<T>(row: AnyRecord): T {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return out as T;
}

export function rowsToApp<T>(rows: AnyRecord[]): T[] {
  return rows.map((r) => rowToApp<T>(r));
}

export function appToRow(data: AnyRecord | object): AnyRecord {
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(data as AnyRecord)) {
    if (v !== undefined) {
      out[camelToSnake(k)] = v;
    }
  }
  return out;
}
