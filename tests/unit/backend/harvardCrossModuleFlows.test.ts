/** @vitest-environment node */

import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { FLOWS } from '../../../server/scripts/harvard-cross-module-flows.js';

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

  it('tracks known-broken (stub) flows explicitly so they cannot silently pass as healthy', () => {
    const stubs = FLOWS.filter((f) => f.status === 'stub').map((f) => f.id);
    // These are the documented STUB handoffs (INTEGRACJE §B). Keep them visible:
    // if a stub gets fixed, flip its status to 'works'/'partial' and update this list.
    expect(stubs).toEqual(expect.arrayContaining(['B8b', 'B9']));
    // every stub must carry a note explaining the breakage
    for (const f of FLOWS.filter((x) => x.status === 'stub')) {
      expect(f.note, `stub ${f.id} needs a note`).toBeTruthy();
    }
  });
});
