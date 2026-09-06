#!/usr/bin/env node
/** Generuje frontendowy kontrakt z serwerowego SSOT DEC-424. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'server/src/constants/initiativeStatuses.ts');
const targetPath = resolve(root, 'packages/shared/src/constants/initiativeStatuses.generated.ts');
const source = readFileSync(sourcePath, 'utf8');
const body = source.match(/export const InitiativeStatus = \{([\s\S]*?)\} as const;/)?.[1];
if (!body) throw new Error('Nie znaleziono kanonicznego InitiativeStatus');
const codes = [...body.matchAll(/^\s*([A-Z_]+):\s*'([A-Z_]+)'/gm)].map((match) => match[1]);
if (codes.length !== 7 || new Set(codes).size !== 7) throw new Error(`Oczekiwano 7 statusów, jest ${codes.length}`);

const entries = codes.map((code) => `  ${code}: '${code}',`).join('\n');
const labels = codes.map((code) => `  ${code}: 'initiatives.status.${code}',`).join('\n');
const legacyCodes = [...source.matchAll(/^\s*([A-Z_]+):\s*InitiativeStatus\.[A-Z_]+,/gm)]
  .map((match) => `'${match[1]}'`).join(', ');
const output = `// NIE EDYTUJ RĘCZNIE. Źródło: server/src/constants/initiativeStatuses.ts
// Generator: scripts/generate-initiative-statuses.mjs
export const InitiativeStatus = {
${entries}
} as const;

export type InitiativeStatus = (typeof InitiativeStatus)[keyof typeof InitiativeStatus];
export const INITIATIVE_FLAGS = ['on_hold', 'archived'] as const;
export type InitiativeFlag = (typeof INITIATIVE_FLAGS)[number];
export const LEGACY_INITIATIVE_STATUS_CODES = [${legacyCodes}] as const;

export const INITIATIVE_STATUS_LABEL_KEYS: Record<InitiativeStatus, string> = {
${labels}
};
`;
writeFileSync(targetPath, output);
