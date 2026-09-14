/**
 * Fala F3 (15.09) — zgłoszenie właściciela: panel AI na Process Flow kończył się
 * toastem „Invalid request body", „analiza nie działa".
 *
 * ZMIERZONE NA ŻYWYM STAGINGU (konto Irina, DBR77, 14.09):
 *   POST /api/my-work/my-ideas/<id>/ai-generate
 *   {"generatorType":"process_brief","tool":"process_flow",...}
 *   → 400 {"error":"Invalid request body","details":{"fieldErrors":
 *          {"generatorType":["Invalid option: expected one of \"lane_generator\"|..."]}}}
 *   to samo dla "process_savings"; "flow_generator"/"vsm_generator"/"process_coach" → 200.
 *
 * Przyczyna: `ideaAIGeneratorService` MA oba generatory (SCHEMA_MAP +
 * handlery + prompty), ale enum `generatorType` w trasie
 * `server/src/routes/my-work.routes.ts` nigdy ich nie dostał. Realni wołacze:
 *   - src/components/MyWork/canvas/canvasOsContract.ts (`process_brief`,
 *     akcja „Generate structured brief", capability: 'real'),
 *   - src/components/MyWork/IdeaProcessFlowTool.tsx (`process_savings`,
 *     analiza oszczędności).
 *
 * Ten test pilnuje CAŁEJ KLASY, nie dwóch nazw: każdy generatorType, który
 * front umie wysłać (`GENERATOR_STATUS_MAP` w src/services/ideaAIGenerator.ts)
 * ORAZ każdy, który serwer umie obsłużyć (SCHEMA_MAP), musi przechodzić
 * walidację trasy. Czytamy prawdziwe pliki źródłowe — nie atrapę.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../../..');
const ROUTE = path.join(ROOT, 'server/src/routes/my-work.routes.ts');
const SERVICE = path.join(ROOT, 'server/src/services/ideaAIGeneratorService.ts');
const CLIENT = path.join(ROOT, 'src/services/ideaAIGenerator.ts');

function readBlock(file: string, startMarker: string, endMarker: string): string {
  const src = fs.readFileSync(file, 'utf8');
  const from = src.indexOf(startMarker);
  expect(from, `nie znaleziono "${startMarker}" w ${file}`).toBeGreaterThan(-1);
  const to = src.indexOf(endMarker, from);
  expect(to, `nie znaleziono "${endMarker}" w ${file}`).toBeGreaterThan(from);
  return src.slice(from, to);
}

function quotedNames(block: string): Set<string> {
  return new Set(Array.from(block.matchAll(/'([a-z0-9_]+)'/g)).map((m) => m[1]));
}

/** Enum generatorType z walidatora trasy /my-ideas/:id/ai-generate. */
function routeEnum(): Set<string> {
  return quotedNames(
    readBlock(ROUTE, 'const IdeaAIGenerateBodySchema = z.object({', 'tool: z.enum(')
  );
}

/** Generatory faktycznie zaimplementowane po stronie serwera. */
function serviceGenerators(): Set<string> {
  const block = readBlock(SERVICE, 'const SCHEMA_MAP: Record<GeneratorType', '\n};');
  return new Set(
    Array.from(block.matchAll(/^\s{2}([a-z0-9_]+):\s/gm)).map((m) => m[1])
  );
}

/** Generatory, które front umie wysłać (mapa statusów pokrywa cały union). */
function clientGenerators(): Set<string> {
  const block = readBlock(CLIENT, 'const GENERATOR_STATUS_MAP', '};');
  return new Set(Array.from(block.matchAll(/^\s{2}([a-z0-9_]+):\s/gm)).map((m) => m[1]));
}

describe('F3 — kontrakt body panelu AI (POST /my-ideas/:id/ai-generate)', () => {
  it('enum trasy i mapa frontu nie są puste (baza pomiaru się zgadza)', () => {
    expect(routeEnum().size).toBeGreaterThan(20);
    expect(clientGenerators().size).toBeGreaterThan(20);
    expect(serviceGenerators().size).toBeGreaterThan(20);
  });

  it('każdy generatorType wysyłany przez front przechodzi walidację trasy', () => {
    const enumSet = routeEnum();
    const brak = [...clientGenerators()].filter((g) => !enumSet.has(g)).sort();
    expect(brak, `front wyśle te typy, a trasa odpowie 400 "Invalid request body": ${brak.join(', ')}`).toEqual([]);
  });

  it('każdy generator zaimplementowany na serwerze jest osiągalny przez trasę', () => {
    const enumSet = routeEnum();
    const brak = [...serviceGenerators()].filter((g) => !enumSet.has(g)).sort();
    expect(brak, `serwer to umie, ale trasa odrzuci: ${brak.join(', ')}`).toEqual([]);
  });

  it('konkretna regresja ze zgłoszenia: process_brief i process_savings są w enumie', () => {
    const enumSet = routeEnum();
    expect(enumSet.has('process_brief')).toBe(true);
    expect(enumSet.has('process_savings')).toBe(true);
  });
});
