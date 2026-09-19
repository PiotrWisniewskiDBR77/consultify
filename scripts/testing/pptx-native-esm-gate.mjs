#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

const PROJECT_ROOT = process.cwd();
const SERVICES = [
  {
    file: 'server/src/services/report/PptxExportService.ts',
    exportedName: 'PptxExportService',
  },
  {
    file: 'server/src/services/assessmentDeckService.ts',
    exportedName: 'generateAssessmentDeck',
  },
];

function isolateNativeModule(source, file) {
  const withoutLoggerImport = source.replace(
    /import logger from ['"][^'"]+Logger\.js['"];?/,
    'const logger = { debug() {}, error() {}, info() {}, warn() {} };'
  );
  if (withoutLoggerImport === source) {
    throw new Error(`${file}: logger import could not be isolated`);
  }
  return ts.transpileModule(withoutLoggerImport, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      isolatedModules: true,
      sourceMap: false,
    },
  }).outputText;
}

const tempDir = mkdtempSync(path.join(PROJECT_ROOT, '.tmp-pptx-native-esm-'));
try {
  for (const [index, service] of SERVICES.entries()) {
    const sourcePath = path.join(PROJECT_ROOT, service.file);
    const source = readFileSync(sourcePath, 'utf8');
    const modulePath = path.join(tempDir, `service-${index + 1}.mjs`);
    writeFileSync(modulePath, isolateNativeModule(source, service.file));
    const loaded = await import(`${pathToFileURL(modulePath).href}?run=${Date.now()}-${index}`);
    if (typeof loaded[service.exportedName] !== 'function') {
      throw new Error(`${service.file}: export ${service.exportedName} is not callable`);
    }
  }
  process.stdout.write(`PPTX_NATIVE_ESM_GATE PASS services=${SERVICES.length} runtime=node\n`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
