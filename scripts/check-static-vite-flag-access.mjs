#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaults = new Map([
  ['src/utils/ideaNotebookRightPanelPrototypeFlag.ts', 'VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE'],
  ['src/utils/artifactRightRailFlag.ts', 'VITE_ARTIFACT_RIGHT_RAIL_ENABLED'],
  ['src/components/MyWork/notebook/notebookSpecAShellFlag.ts', 'VITE_ENABLE_NOTEBOOK_SPEC_A_SHELL'],
]);
const requested = process.argv.slice(2);
const targets = requested.length > 0 ? requested.map((file) => [file, null]) : [...defaults];
let violations = 0;

for (const [relativeFile, expectedKey] of targets) {
  const absoluteFile = path.resolve(repo, relativeFile);
  if (!fs.existsSync(absoluteFile)) {
    console.error(`STATIC_FLAG_GUARD_COMMAND_ERROR missing=${relativeFile}`);
    process.exit(2);
  }
  const lines = fs.readFileSync(absoluteFile, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\bmeta\??\.env\??\.?\s*\[/.test(line) || /import\.meta[^\n]*\.env\??\.?\s*\[/.test(line)) {
      console.error(`${relativeFile}:${index + 1} computed import.meta.env access is forbidden; use static import.meta.env.VITE_* access`);
      violations += 1;
    }
  });
  if (expectedKey && !lines.some((line) => line.includes(`import.meta.env.${expectedKey}`))) {
    console.error(`${relativeFile}:1 required static expression import.meta.env.${expectedKey} is missing`);
    violations += 1;
  }
}

console.log(`STATIC_FLAG_GUARD analyzedFiles=${targets.length} violations=${violations}`);
process.exit(violations === 0 ? 0 : 1);
