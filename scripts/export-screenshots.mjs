import { spawn } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const MCP_BIN = "/Applications/Pencil.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-arm64";
const OUTPUT_DIR = join(import.meta.dirname, "..", "docs", "screenshots");
const PEN_FILE = "pencil-welcome-desktop.pen";

const SCREENS = [
  { id: "00PCT", filename: "01-manager-dashboard-desktop.png", label: "Manager Dashboard (Desktop)" },
  { id: "xLorR", filename: "02-my-day-desktop.png", label: "My Day Dashboard (Desktop)" },
  { id: "yuS5D", filename: "03-pipeline-kanban-desktop.png", label: "Pipeline Board - Kanban (Desktop)" },
  { id: "S14Wd", filename: "04-my-day-mobile.png", label: "My Day Dashboard (Mobile)" },
  { id: "oluoT", filename: "05-new-lead-form-desktop.png", label: "New Lead Form (Desktop)" },
  { id: "gJmkX", filename: "06-quick-capture-mobile.png", label: "Quick Capture (Mobile)" },
  { id: "CHnFT", filename: "07-prospect-detail-desktop.png", label: "Prospect Detail (Desktop)" },
  { id: "xNuto", filename: "08-pipeline-list-mobile.png", label: "Pipeline List (Mobile)" },
  { id: "oaR0H", filename: "09-mab-import-desktop.png", label: "MAB Import (Desktop)" },
  { id: "bO6Pj", filename: "10-manager-dashboard-mobile.png", label: "Manager Dashboard (Mobile)" },
];

mkdirSync(OUTPUT_DIR, { recursive: true });

async function exportScreenshots() {
  const proc = spawn(MCP_BIN, ["--app", "desktop"], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";
  let resolveResponse = null;

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    // MCP uses newline-delimited JSON
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line
    for (const line of lines) {
      if (line.trim() && resolveResponse) {
        try {
          const msg = JSON.parse(line);
          if (msg.result || msg.error) {
            resolveResponse(msg);
            resolveResponse = null;
          }
        } catch {}
      }
    }
  });

  proc.stderr.on("data", (chunk) => {
    // ignore stderr
  });

  function sendRequest(method, params, id) {
    return new Promise((resolve) => {
      resolveResponse = resolve;
      const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
      proc.stdin.write(msg);
    });
  }

  // Initialize
  const initRes = await sendRequest("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "export-script", version: "1.0" },
  }, 0);
  console.log("MCP initialized:", initRes?.result ? "OK" : "FAILED");

  // Send initialized notification
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  // Wait a moment for the server to be ready
  await new Promise((r) => setTimeout(r, 1000));

  for (let i = 0; i < SCREENS.length; i++) {
    const screen = SCREENS[i];
    console.log(`Exporting ${screen.filename}...`);

    const res = await sendRequest("tools/call", {
      name: "get_screenshot",
      arguments: { nodeId: screen.id, filePath: PEN_FILE },
    }, i + 1);

    if (res?.result?.content) {
      for (const item of res.result.content) {
        if (item.type === "image") {
          const buf = Buffer.from(item.data, "base64");
          const outPath = join(OUTPUT_DIR, screen.filename);
          writeFileSync(outPath, buf);
          console.log(`  Saved ${outPath} (${buf.length} bytes)`);
          break;
        }
      }
    } else {
      console.error(`  Failed: ${JSON.stringify(res?.error || "no image content")}`);
    }
  }

  proc.stdin.end();
  proc.kill();
  console.log("\nDone! All screenshots exported.");
}

exportScreenshots().catch(console.error);
