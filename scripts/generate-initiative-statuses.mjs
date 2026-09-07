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
// Macierz przejść DEC-424 — jedyny powód, dla którego front może narysować przycisk.
// Do 2026-09-07 front miał WŁASNĄ, ręcznie pisaną kopię (`src/services/initiativeLifecycle.ts`)
// i ta kopia się rozjechała: pozwalała odrzucić szkic (serwer: brak takiej krawędzi),
// a zwrot do szkicu przypisywała PROJECT_MANAGER/PMO zamiast sponsorowi/komitetowi.
const matrixBody = source.match(/export const INITIATIVE_TRANSITION_MATRIX = \[([\s\S]*?)\] as const satisfies/)?.[1];
if (!matrixBody) throw new Error('Nie znaleziono INITIATIVE_TRANSITION_MATRIX');
const rowPattern = /\{\s*from:\s*InitiativeStatus\.([A-Z_]+),\s*to:\s*InitiativeStatus\.([A-Z_]+),\s*gate:\s*GateType\.([A-Z_]+),\s*roles:\s*\[([^\]]*)\],\s*condition:\s*'([A-Z_]+)'(,\s*authorOnly:\s*(true|false))?\s*\}/g;
const rows = [...matrixBody.matchAll(rowPattern)].map((m) => ({
  from: m[1],
  to: m[2],
  gate: m[3],
  roles: m[4].split(',').map((r) => r.trim().replace(/^Role\./, '')).filter(Boolean),
  condition: m[5],
  authorOnly: m[7] === 'true',
}));
if (rows.length === 0) throw new Error('Macierz przejść pusta — regex nie trafił w źródło');

const flagBody = source.match(/export const INITIATIVE_FLAG_RULES = \{([\s\S]*?)\} as const;/)?.[1];
if (!flagBody) throw new Error('Nie znaleziono INITIATIVE_FLAG_RULES');
const flagRows = [...flagBody.matchAll(/([A-Z_]+):\s*\{\s*gate:\s*GateType\.([A-Z_]+),\s*roles:\s*\[([^\]]*)\],\s*reasonRequired:\s*(true|false)\s*\}/g)].map((m) => ({
  operation: m[1],
  gate: m[2],
  roles: m[3].split(',').map((r) => r.trim().replace(/^Role\./, '')).filter(Boolean),
  reasonRequired: m[4] === 'true',
}));
if (flagRows.length === 0) throw new Error('Reguły flag puste — regex nie trafił w źródło');

const matrixLiteral = rows.map((row) => `  { from: '${row.from}', to: '${row.to}', gate: '${row.gate}', roles: [${row.roles.map((r) => `'${r}'`).join(', ')}], condition: '${row.condition}', authorOnly: ${row.authorOnly} },`).join('\n');
const flagLiteral = flagRows.map((row) => `  { operation: '${row.operation}', gate: '${row.gate}', roles: [${row.roles.map((r) => `'${r}'`).join(', ')}], reasonRequired: ${row.reasonRequired} },`).join('\n');
const validNext = codes.map((code) => `  ${code}: [${rows.filter((row) => row.from === code).map((row) => `'${row.to}'`).join(', ')}],`).join('\n');

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

export type InitiativeGate = (typeof INITIATIVE_TRANSITION_MATRIX)[number]['gate'];
export type InitiativeTransitionCondition = (typeof INITIATIVE_TRANSITION_MATRIX)[number]['condition'];

/** Macierz DEC-424 — brak wiersza oznacza zakaz. Nie dopisuj krawędzi tutaj. */
export const INITIATIVE_TRANSITION_MATRIX = [
${matrixLiteral}
] as const;

export const INITIATIVE_FLAG_RULES = [
${flagLiteral}
] as const;

export const INITIATIVE_VALID_TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
${validNext}
};
`;
writeFileSync(targetPath, output);
