"use client";

import { Download } from "lucide-react";

interface Column<T> {
  key: keyof T;
  header: string;
}

interface ExportButtonProps<T> {
  data: T[];
  columns: Column<T>[];
  filename: string;
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
}: ExportButtonProps<T>) {
  function handleExport() {
    const headerRow = columns.map((col) => escapeCsvValue(col.header)).join(",");
    const dataRows = data.map((row) =>
      columns.map((col) => escapeCsvValue(row[col.key as string])).join(",")
    );
    const csvContent = [headerRow, ...dataRows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      disabled={data.length === 0}
      className="inline-flex items-center gap-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download size={15} />
      Export CSV
    </button>
  );
}
