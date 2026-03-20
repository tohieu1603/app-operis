/**
 * Build Claude-only edition of Agent Operis Desktop.
 *
 * Swaps config-preset-claude.json → config-preset-operis.json (same filename
 * expected by edition.ts), runs the full build, then restores the original.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = path.join(__dirname, "..", "resources");
const operisPreset = path.join(resourcesDir, "config-preset-operis.json");
const claudePreset = path.join(resourcesDir, "config-preset-claude.json");
const backup = path.join(resourcesDir, "config-preset-operis.json.bak");

if (!fs.existsSync(claudePreset)) {
  console.error("[build-claude] Missing config-preset-claude.json in resources/");
  process.exit(1);
}

const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicKey) {
  console.error("[build-claude] ANTHROPIC_API_KEY env var is required. Set it before building.");
  process.exit(1);
}

// Backup original operis preset
fs.copyFileSync(operisPreset, backup);
// Read claude preset, resolve $ANTHROPIC_API_KEY placeholder, write as operis preset
const claudeRaw = fs.readFileSync(claudePreset, "utf-8");
const resolved = claudeRaw.replace(/"\$ANTHROPIC_API_KEY"/g, JSON.stringify(anthropicKey));
fs.writeFileSync(operisPreset, resolved, "utf-8");
console.log("[build-claude] Swapped preset → anthropic/claude-opus-4-6 (key from env)");

try {
  // Build gateway + UI + bundle + electron, then use claude-specific installer config
  const steps = [
    "pnpm build:gateway",
    "pnpm build:ui",
    "pnpm build:bundle-gateway",
    "pnpm build:electron",
    "npx electron-builder --win --config electron-builder-claude.yml",
  ];
  for (const step of steps) {
    console.log(`[build-claude] Running: ${step}`);
    execSync(step, {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      env: { ...process.env },
    });
  }
  console.log("[build-claude] Build complete. Output: release-claude/");
} finally {
  // Always restore original preset
  fs.copyFileSync(backup, operisPreset);
  fs.unlinkSync(backup);
  console.log("[build-claude] Restored original operis preset.");
}
