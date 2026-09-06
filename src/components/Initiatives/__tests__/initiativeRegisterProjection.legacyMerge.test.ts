import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { InitiativeStatus } from '@/types';
import { mapInitiativeStatus } from '@/contracts/initiatives-execution/statusMapping';
import type { LegacyInitiativeApiRow } from '@/services/initiatives-execution/runtimeApi';

import {
  mergeLegacyInitiativesIntoRegister,
  toCanonicalInitiativeRegisterItemFromLegacyRow,
} from '../initiativeRegisterProjection';

/**
 * Regression for the MVP defect measured 2026-09-05 on org DBR77
 * (stanowisko lokalne, konto audyt@dbr77.local): `GET /api/initiatives`
 * (legacy classic table) returned 71 real rows, but `/initiatives` rendered
 * 0 — because `InitiativesHub` only ever read the runtime-v1 event-sourced
 * projection (`listRegisteredInitiatives`), which had zero rows for that
 * org (those 71 rows were never promoted through the runtime-v1 command
 * surface). This fixture is the ACTUAL captured API response
 * (`curl .../api/initiatives` with a real bearer token), not a synthetic
 * sample — see tests/fixtures/initiatives-local.json.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, '../../../../tests/fixtures/initiatives-local.json');
const legacyFixtureRows: LegacyInitiativeApiRow[] = JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('legacy initiative register bridge (MVP fix, org DBR77 empty list)', () => {
  it('fixture is the real measured payload: 71 legacy rows, all mapped explicitly to DEC-424', () => {
    expect(legacyFixtureRows.length).toBe(71);
    const knownStatuses = new Set(Object.values(InitiativeStatus) as string[]);
    for (const row of legacyFixtureRows) {
      const runtime = mapInitiativeStatus({ direction: 'legacy-to-runtime', status: String(row.status) });
      const mapped = runtime ? mapInitiativeStatus({ direction: 'runtime-to-status', lifecycle: runtime }).status : null;
      expect(knownStatuses.has(String(mapped))).toBe(true);
    }
  });

  it(
    'mergeLegacyInitiativesIntoRegister backfills every legacy row when the ' +
      'runtime-v1 projection is empty — the exact org DBR77 measurement ' +
      '(71 legacy vs 0 canonical must yield 71 visible, not 0)',
    () => {
      const canonicalRows: ReturnType<typeof toCanonicalInitiativeRegisterItemFromLegacyRow>[] = [];
      const legacyCanonicalRows = legacyFixtureRows.map(toCanonicalInitiativeRegisterItemFromLegacyRow);

      const merged = mergeLegacyInitiativesIntoRegister(canonicalRows, legacyCanonicalRows);

      // MUTATION GUARD: if the merge is ever removed/bypassed and the hub
      // goes back to `canonicalRows` alone (the pre-fix behavior), this
      // assertion fails at 0 — reproducing the measured defect exactly.
      expect(merged.length).toBe(71);
      expect(new Set(merged.map((row) => row.id)).size).toBe(71);
    }
  );

  it('canonical (runtime-v1) rows win on id collision instead of being duplicated', () => {
    const sharedId = legacyFixtureRows[0].id;
    const canonicalRow = toCanonicalInitiativeRegisterItemFromLegacyRow(legacyFixtureRows[0]);
    const legacyRows = legacyFixtureRows.map(toCanonicalInitiativeRegisterItemFromLegacyRow);

    const merged = mergeLegacyInitiativesIntoRegister([canonicalRow], legacyRows);

    expect(merged.filter((row) => row.id === sharedId)).toHaveLength(1);
    expect(merged.length).toBe(71);
  });

  it('never drops a row for an unrecognized status — buckets it as DRAFT, keeps raw value visible', () => {
    const row: LegacyInitiativeApiRow = {
      id: 'weird-status-row',
      name: 'Row with a status outside the enum',
      status: 'SOME_FUTURE_STATUS_NOT_YET_KNOWN',
    };

    const mapped = toCanonicalInitiativeRegisterItemFromLegacyRow(row);

    expect(mapped.status).toBe(InitiativeStatus.DRAFT);
    expect(mapped.displayStatus).toBe('SOME_FUTURE_STATUS_NOT_YET_KNOWN');
  });

  it('returns the canonical rows unchanged (same reference) when there are no legacy rows', () => {
    const canonicalRows = [toCanonicalInitiativeRegisterItemFromLegacyRow(legacyFixtureRows[0])];
    expect(mergeLegacyInitiativesIntoRegister(canonicalRows, [])).toBe(canonicalRows);
  });
});
