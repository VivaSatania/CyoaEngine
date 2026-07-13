import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ModuleDefinition } from "../../engine-core/src/index.js";

const cli = "dist/packages/cli/src/index.js";
const fixturePath = "examples/arcana-crossroads/module.json";

test("CLI validates the Arcana fixture", () => {
  const result = spawnSync(process.execPath, [cli, "validate", fixturePath], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid CYOA module set \(1 module\)\./);
});

test("CLI reports semantic diagnostics for invalid modules", () => {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as ModuleDefinition;
  fixture.choices[0].effects.push({ type: "grantTag", subject: { ref: "self" }, tag: "missing/tag" });
  const dir = mkdtempSync(join(tmpdir(), "cyoa-cli-"));
  const brokenPath = join(dir, "broken.json");
  writeFileSync(brokenPath, JSON.stringify(fixture));

  const result = spawnSync(process.execPath, [cli, "validate", brokenPath], { encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid CYOA module set/);
  assert.match(result.stderr, /ERROR modules\[0\]\.choices\[0\]\.effects\[3\]\.tag: Unknown tag missing\/tag/);
});
