#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(repo, 'src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx');

if (process.env.DAY356_TYPE_GUARD_HEAP !== '8192') {
  const run = spawnSync(process.execPath, ['--max-old-space-size=8192', fileURLToPath(import.meta.url)], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, DAY356_TYPE_GUARD_HEAP: '8192' },
    maxBuffer: 64 * 1024 * 1024,
  });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.error) {
    console.error(`TYPE_GUARD_COMMAND_ERROR ${run.error.message}`);
    process.exit(2);
  }
  process.exit(run.status ?? 2);
}

const ts = await import('typescript');
const configPath = ts.findConfigFile(repo, ts.sys.fileExists, 'tsconfig.json');
if (!configPath) {
  console.error('TYPE_GUARD_COMMAND_ERROR tsconfig.json not found');
  process.exit(2);
}
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, repo);
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
const source = program.getSourceFile(target);
if (!source) {
  console.error(`TYPE_GUARD_COMMAND_ERROR analyzedFiles=0 missing=${path.relative(repo, target)}`);
  process.exit(2);
}
const diagnostics = ts.getPreEmitDiagnostics(program, source);
console.log(`TYPE_GUARD analyzedFiles=1 heapMb=8192 target=${path.relative(repo, target)} diagnostics=${diagnostics.length}`);
if (diagnostics.length === 0) process.exit(0);
for (const diagnostic of diagnostics) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (diagnostic.file && diagnostic.start !== undefined) {
    const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    console.error(`${path.relative(repo, diagnostic.file.fileName)}:${pos.line + 1}:${pos.character + 1} TS${diagnostic.code} ${message}`);
  } else {
    console.error(`TS${diagnostic.code} ${message}`);
  }
}
process.exit(1);
