#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateModules, type ModuleDefinition, type ValidationDiagnostic } from "../../engine-core/src/index.js";

const usage = `Usage: cyoa validate <module.json> [module.json ...]\n\nCommands:\n  validate   Validate one or more CYOA module JSON files.\n`;

export function main(argv = process.argv.slice(2)): number {
  const [command, ...paths] = argv;
  if (command === "--help" || command === "-h" || !command) {
    console.log(usage.trimEnd());
    return command ? 0 : 1;
  }

  if (command !== "validate") {
    console.error(`Unknown command: ${command}`);
    console.error(usage.trimEnd());
    return 1;
  }

  if (paths.length === 0) {
    console.error("Missing module path.");
    console.error(usage.trimEnd());
    return 1;
  }

  const modules: ModuleDefinition[] = [];
  for (const path of paths) {
    try {
      modules.push(JSON.parse(readFileSync(path, "utf8")) as ModuleDefinition);
    } catch (error) {
      console.error(`Failed to read ${path}: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }

  const result = validateModules(modules);
  if (result.valid) {
    console.log(`Valid CYOA module set (${modules.length} ${modules.length === 1 ? "module" : "modules"}).`);
    return 0;
  }

  console.error(`Invalid CYOA module set (${result.diagnostics.length} ${result.diagnostics.length === 1 ? "diagnostic" : "diagnostics"}).`);
  for (const diagnostic of result.diagnostics) console.error(formatDiagnostic(diagnostic));
  return 1;
}

function formatDiagnostic(diagnostic: ValidationDiagnostic): string {
  return `${diagnostic.severity.toUpperCase()} ${diagnostic.path}: ${diagnostic.message}`;
}

function isEntrypoint(metaUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) return false;

  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(argvPath);
  } catch {
    return false;
  }
}

if (isEntrypoint(import.meta.url, process.argv[1])) process.exitCode = main();
