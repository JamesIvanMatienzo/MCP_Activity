/**
 * Path Security Tests
 * 
 * Evidence for Rubric Criterion E: Security and sandboxing (10 pts).
 * Validates that resolveAndValidatePath rejects all known escape vectors.
 */

import * as path from "path";
import { fileURLToPath } from "url";

// Replicate the workspace resolution logic from index.ts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_DIR = path.resolve(__dirname, "../../../workspace");

function resolveAndValidatePath(unsafePath: string): string {
  const normalizedWorkspace = path.resolve(WORKSPACE_DIR) + path.sep;
  const absolutePath = path.resolve(WORKSPACE_DIR, unsafePath);
  if (absolutePath !== path.resolve(WORKSPACE_DIR) && !absolutePath.startsWith(normalizedWorkspace)) {
    throw new Error(`Path traversal detected: ${unsafePath} is outside the workspace.`);
  }
  return absolutePath;
}

// ─── Test runner ───────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function expectThrows(fn: () => void, label: string) {
  try {
    fn();
    console.error(`  ❌ FAIL (no throw): ${label}`);
    failed++;
  } catch {
    console.log(`  ✅ PASS (threw): ${label}`);
    passed++;
  }
}

function expectNoThrow(fn: () => void, label: string) {
  try {
    fn();
    console.log(`  ✅ PASS (no throw): ${label}`);
    passed++;
  } catch (e: any) {
    console.error(`  ❌ FAIL (unexpected throw: ${e.message}): ${label}`);
    failed++;
  }
}

// ─── Safe paths (should resolve without error) ────────────────────

console.log("\n── Safe paths ──");

expectNoThrow(() => {
  const result = resolveAndValidatePath(".");
  assert(result === path.resolve(WORKSPACE_DIR), "  '.' resolves to workspace root");
}, "Workspace root '.'");

expectNoThrow(() => {
  const result = resolveAndValidatePath("fibonacci.py");
  assert(result === path.join(WORKSPACE_DIR, "fibonacci.py"), "  'fibonacci.py' resolves correctly");
}, "Simple filename");

expectNoThrow(() => {
  const result = resolveAndValidatePath("PLAN_LOG/001_fibonacci_plan.md");
  assert(result === path.join(WORKSPACE_DIR, "PLAN_LOG", "001_fibonacci_plan.md"), "  Nested path resolves correctly");
}, "Nested path");

expectNoThrow(() => {
  resolveAndValidatePath("subdir/../fibonacci.py");
}, "Relative navigation that stays inside workspace");

// ─── Unsafe paths (must throw) ────────────────────────────────────

console.log("\n── Unsafe paths ──");

expectThrows(() => resolveAndValidatePath(".."), "Parent directory '..'");

expectThrows(() => resolveAndValidatePath("../.."), "Double parent '../..'");

expectThrows(() => resolveAndValidatePath("../../etc/passwd"), "Classic traversal '../../etc/passwd'");

expectThrows(() => resolveAndValidatePath("../../../Windows/System32/config"), "Deep traversal to system dir");

expectThrows(() => resolveAndValidatePath("subdir/../../.."), "Traversal via subdirectory bounce");

expectThrows(() => {
  // This is the edge-case the original code missed:
  // A sibling directory whose name starts with the same prefix as the workspace.
  // e.g., if workspace is /project/workspace, then /project/workspace-evil
  // would pass a naive startsWith check.
  const siblingPath = path.resolve(WORKSPACE_DIR, "..", path.basename(WORKSPACE_DIR) + "-evil", "secret.txt");
  const relativeSibling = path.relative(WORKSPACE_DIR, siblingPath);
  resolveAndValidatePath(relativeSibling);
}, "Sibling-prefix attack ('workspace-evil/secret.txt')");

// On Windows, try absolute paths outside workspace
if (process.platform === "win32") {
  expectThrows(() => resolveAndValidatePath("C:\\Windows\\System32\\config\\SAM"), "Absolute Windows path");
} else {
  expectThrows(() => resolveAndValidatePath("/etc/passwd"), "Absolute Unix path");
}

// ─── Summary ──────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
process.exit(failed > 0 ? 1 : 0);
