/** @vitest-environment node */

import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { FLOWS } from '../../../server/scripts/harvard-cross-module-flows.js';
import { parseExpectedSchema } from '../../../server/scripts/verify-schema-vs-migrations.js';

// Krok 8 — cross-module flow contracts. For each of the canonical INTEGRACJE §B
// flows, every anchor (route/service/table that wires the handoff) must exist in
// the source. A 'stub' flow whose anchor vanishes is still a signal (the broken
// handoff was removed/renamed) — so anchors are asserted for ALL statuses.

const root = process.cwd();

describe('Harvard cross-module flows — contract anchors exist', () => {
  it('encodes a meaningful set of flows with unique ids', () => {
    expect(FLOWS.length).toBeGreaterThanOrEqual(14);
    const ids = FLOWS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FLOWS) {
      expect(['works', 'partial', 'stub']).toContain(f.status);
      expect(f.anchors.length).toBeGreaterThan(0);
    }
  });

  it.each(FLOWS.flatMap((f) => f.anchors.map((a) => [f.id, f.name, a.file, a.needle] as const)))(
    '%s %s — anchor %s contains "%s"',
    (_id, _name, file, needle) => {
      const full = path.join(root, file);
      expect(fs.existsSync(full), `missing file ${file}`).toBe(true);
      const content = fs.readFileSync(full, 'utf-8');
      expect(content.includes(needle), `"${needle}" not found in ${file}`).toBe(true);
    }
  );

  it('every flow targetTable lands in a migration-defined table (data has somewhere real to go)', () => {
    const schema = parseExpectedSchema(path.resolve(root, 'server/migrations'));
    const flowsWithTargets = FLOWS.filter((f) => f.targetTables && f.targetTables.length);
    expect(flowsWithTargets.length).toBeGreaterThanOrEqual(5);
    for (const f of flowsWithTargets) {
      for (const t of f.targetTables!) {
        expect(
          schema.tables.has(t.toLowerCase()),
          `${f.id}: target table "${t}" not defined in migrations`
        ).toBe(true);
      }
    }
  });

  it('tracks known-broken (stub) flows explicitly so they cannot silently pass as healthy', () => {
    const stubs = FLOWS.filter((f) => f.status === 'stub').map((f) => f.id);
    // B8b advanced to PARTIAL when real JSON/Markdown export persistence was
    // added behind its fail-closed feature flag. B9 remains the documented
    // STUB handoff (INTEGRACJE §B), so keep that remaining gap visible.
    expect(stubs).toEqual(expect.arrayContaining(['B9']));
    expect(FLOWS.find((f) => f.id === 'B8b')?.status).toBe('partial');
    // every stub must carry a note explaining the breakage
    for (const f of FLOWS.filter((x) => x.status === 'stub')) {
      expect(f.note, `stub ${f.id} needs a note`).toBeTruthy();
    }
  });
});
