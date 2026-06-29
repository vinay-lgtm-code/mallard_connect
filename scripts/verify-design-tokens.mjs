#!/usr/bin/env node

/**
 * Design token verifier — scans globals.css and all TSX/TS source files to
 * ensure design tokens match the DESIGN.md spec. Flags deviant hex values,
 * stale token names, and hardcoded colours that should use tokens.
 *
 * Exit 0 = all OK, exit 1 = deviations found.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const EXPECTED_TOKENS = {
  "--color-primary": "#1A5653",
  "--color-primary-light": "#2A7A76",
  "--color-primary-dark": "#0F3B39",
  "--color-accent": "#E8981A",
  "--color-accent-light": "#F5C46B",
  "--color-accent-warm": "#F59E0B",
  "--color-destructive": "#DC2626",
  "--color-success": "#1A5653",
  "--color-warning": "#F59E0B",
  "--color-info": "#3B82F6",
  "--color-purple": "#7C3AED",
  "--color-sidebar": "#0F2E2D",
  "--color-surface": "#FFFFFF",
  "--color-page": "#F8FAFB",
  "--color-section-dark": "#1B2B3A",
  "--color-text-primary": "#111827",
  "--color-text-secondary": "#6B7280",
  "--color-text-muted": "#9CA3AF",
  "--color-border": "#E5E7EB",
  "--color-border-strong": "#D1D5DB",
};

const REMOVED_TOKENS = ["--color-card", "--color-accent: #F59E0B", "--color-success: #22C55E"];

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠️  ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

// ─── 1. Verify globals.css token values ────────────────────────────────────

console.log("\n🎨 Verifying globals.css token values...\n");

const globalsPath = join(process.cwd(), "src/app/globals.css");
let globalsContent;
try {
  globalsContent = readFileSync(globalsPath, "utf-8");
} catch {
  error("Could not read src/app/globals.css");
  process.exit(1);
}

for (const [token, expectedHex] of Object.entries(EXPECTED_TOKENS)) {
  const regex = new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(#[0-9A-Fa-f]{3,8})`);
  const match = globalsContent.match(regex);
  if (!match) {
    error(`Token ${token} not found in globals.css`);
  } else if (match[1].toUpperCase() !== expectedHex.toUpperCase()) {
    error(`Token ${token} = ${match[1]} (expected ${expectedHex})`);
  } else {
    ok(`${token}: ${match[1]}`);
  }
}

for (const removed of REMOVED_TOKENS) {
  if (globalsContent.includes(removed)) {
    error(`Stale/removed token found in globals.css: ${removed}`);
  }
}

// ─── 2. Verify font-mono is defined ────────────────────────────────────────

if (!globalsContent.includes("--font-mono")) {
  error("--font-mono token not defined in globals.css");
} else {
  ok("--font-mono defined");
}

// ─── 3. Scan source files for deviant patterns ─────────────────────────────

console.log("\n🔍 Scanning source files for deviant colour patterns...\n");

const OLD_ACCENT_HEX = /#F59E0B/gi;
const OLD_SUCCESS_HEX = /#22C55E/gi;

function walk(dir, exts) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full, exts));
    } else if (exts.includes(extname(full))) {
      results.push(full);
    }
  }
  return results;
}

const srcFiles = walk(join(process.cwd(), "src"), [".tsx", ".ts", ".css"]);
let hardcodedAccent = 0;
let hardcodedOldSuccess = 0;
let shadowSmCount = 0;
let oldFocusRing = 0;

for (const file of srcFiles) {
  const content = readFileSync(file, "utf-8");
  const rel = file.replace(process.cwd() + "/", "");

  // Skip globals.css (tokens define these values legitimately)
  if (rel === "src/app/globals.css") continue;

  // Check for old accent hex used as if it were the primary accent
  // #F59E0B is now --color-accent-warm, not --color-accent
  const accentMatches = content.match(/background-color:\s*#F59E0B/gi);
  if (accentMatches) {
    warn(`${rel}: hardcoded old accent hex #F59E0B in inline style (should be #E8981A or token)`);
    hardcodedAccent += accentMatches.length;
  }

  // Check for old success green in non-pipeline contexts
  const successMatches = content.match(/background-color:\s*#22C55E/gi);
  if (successMatches) {
    warn(`${rel}: hardcoded old success green #22C55E in inline style`);
    hardcodedOldSuccess += successMatches.length;
  }

  // Check for shadow-sm on cards (should be removed)
  if (content.includes("shadow-sm") && !rel.includes("toast") && !rel.includes("modal")) {
    warn(`${rel}: still has shadow-sm (should be flat cards per DESIGN.md)`);
    shadowSmCount++;
  }

  // Check for old focus ring pattern
  if (content.includes("focus:ring-2 focus:ring-primary") && !content.includes("focus:ring-[3px]")) {
    warn(`${rel}: old focus ring pattern (should use focus:ring-[3px] focus:ring-primary/10)`);
    oldFocusRing++;
  }
}

// ─── 4. Report ─────────────────────────────────────────────────────────────

console.log("\n📊 Summary\n");
console.log(`  Token values:     ${errors === 0 ? "✅ All correct" : `❌ ${errors} error(s)`}`);
console.log(`  Deviant patterns: ${warnings === 0 ? "✅ None found" : `⚠️  ${warnings} warning(s)`}`);
console.log(`  Files scanned:    ${srcFiles.length}`);
console.log("");

if (errors > 0) {
  console.error("🚨 Design token verification FAILED — fix the errors above.\n");
  process.exit(1);
}

if (warnings > 0) {
  console.warn("⚠️  Design token verification passed with warnings.\n");
  process.exit(0);
}

console.log("✅ Design token verification passed.\n");
process.exit(0);
