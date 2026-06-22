import { readFileSync } from "node:fs";

const FILES = [
  "src/app/api/cron/daily-digest/route.ts",
  "src/app/api/cron/run-cadences/route.ts",
  "src/app/api/cron/snapshot-analytics/route.ts",
  "src/app/api/cron/sync-brevo/route.ts",
  "src/app/api/dev/seed-demo/route.ts",
  "src/lib/cadences/run.ts",
];

const TENANT_TABLES = new Set([
  "activities",
  "analytics_snapshots",
  "cadence_enrollments",
  "cadences",
  "import_records",
  "integrations",
  "lead_sources",
  "leads",
  "notifications",
  "pipeline_stages",
  "tasks",
  "templates",
  "users",
]);

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function queryChains(source) {
  const chains = [];
  const pattern = /\.from\("([^"]+)"\)/g;
  let match;

  while ((match = pattern.exec(source))) {
    const start = match.index;
    let end = source.indexOf(";", start);
    if (end === -1) end = source.length;
    chains.push({
      table: match[1],
      text: source.slice(start, end + 1),
      line: lineNumber(source, start),
    });
  }

  return chains;
}

function isRiskyTenantOperation(chain) {
  if (!TENANT_TABLES.has(chain.table)) return false;

  const text = chain.text;
  const byId = /\.eq\("id"\s*,/.test(text) || /\.in\("id"\s*,/.test(text);
  const mutation = /\.update\(/.test(text) || /\.delete\(/.test(text);

  if (!byId && !mutation) return false;

  return !/\.eq\("tenant_id"\s*,/.test(text);
}

const failures = [];

for (const file of FILES) {
  const source = readFileSync(file, "utf8");
  for (const chain of queryChains(source)) {
    if (isRiskyTenantOperation(chain)) {
      failures.push(`${file}:${chain.line} ${chain.table} query needs an explicit .eq("tenant_id", ...)`);
    }
  }
}

if (failures.length > 0) {
  console.error("Service-role tenant-scope check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Service-role tenant-scope check passed.");
