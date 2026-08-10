/**
 * OKR-E008 Half C — D09 zero-FK isolation static proof (design §5.5,
 * Decision D-OKR8-20).
 *
 * OKR-F-029's Schema cell requires "ZERO FK z okr_vnext_* do
 * okr_key_results/initiative_kpis/kpi_definition_versions" — i.e. the two
 * live D09-violating FKs on the LEGACY `okr_key_results` table
 * (`kpi_id` -> `initiative_kpis`, `kpi_definition_version_id` ->
 * `kpi_definition_versions`, both confirmed by direct read of
 * `server/migrations/914_okr_management.sql` and
 * `server/migrations/20260803_res009_okr_key_result_definition_version.sql`)
 * must never be inherited by the vNext `okr_vnext_*`/`rvn_okr_*` schema or
 * service layer.
 *
 * Genuinely new proof shape this epic needs that KPI-E007/ROI-E008 didn't —
 * neither of THEIR legacy inventories had a legacy table with a live
 * INBOUND cross-domain FK pointed at another domain's scoring logic. Two
 * static-only assertions, no DB needed:
 *   1. Every `server/migrations/*rvn_okr*.sql` / `*okr_vnext*.sql` file:
 *      zero `REFERENCES <legacy-name>` matches for
 *      okr_key_results/initiative_kpis/kpi_definition_versions/
 *      kpi_time_series.
 *   2. Every `server/src/services/resultsVnext/okr/*.ts` file (excluding
 *      this epic's own `okrLegacyArchiveRepository.ts`, which legitimately
 *      documents these names in prose comments, and re-verification
 *      confirms it never queries them): zero literal
 *      `kpiDefinitionService`/`kpi_time_series` string matches — the exact
 *      violation `okrService.ts` (legacy) itself has, structurally
 *      forbidden from recurring in vNext.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'server/migrations');
const OKR_VNEXT_SERVICE_DIR = path.join(REPO_ROOT, 'server/src/services/resultsVnext/okr');

const FORBIDDEN_FK_TARGETS = 'okr_key_results|initiative_kpis|kpi_definition_versions|kpi_time_series';
const REFERENCES_REGEX = new RegExp(`REFERENCES\\s+(${FORBIDDEN_FK_TARGETS})\\b`, 'gi');

describe('OKR-E008 D09 zero-FK isolation (static)', () => {
  describe('§1 — no okr_vnext / rvn_okr migration declares an FK to a legacy D09 table', () => {
    it('zero REFERENCES to okr_key_results/initiative_kpis/kpi_definition_versions/kpi_time_series', () => {
      const migrationFiles = readdirSync(MIGRATIONS_DIR).filter(
        (f) => f.endsWith('.sql') && (f.includes('rvn_okr') || f.includes('okr_vnext'))
      );
      // Sanity: OKR-E001's own migration must be found by this glob, or the
      // test would vacuously pass on an empty file list.
      expect(
        migrationFiles.length,
        'No *rvn_okr*.sql / *okr_vnext*.sql migration file found — this test would pass vacuously; ' +
          'check the glob against server/migrations/ naming conventions'
      ).toBeGreaterThan(0);

      for (const file of migrationFiles) {
        const source = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        const matches = source.match(REFERENCES_REGEX) ?? [];
        expect(matches, `${file} declares a forbidden FK: ${JSON.stringify(matches)}`).toEqual([]);
      }
    });
  });

  describe('§2 — no okr vNext service file imports the legacy KPI cross-domain read path', () => {
    it('zero references to kpiDefinitionService / kpi_time_series outside okrLegacyArchiveRepository.ts', () => {
      const files = readdirSync(OKR_VNEXT_SERVICE_DIR).filter(
        (f) => f.endsWith('.ts') && f !== 'okrLegacyArchiveRepository.ts'
      );
      expect(files.length).toBeGreaterThan(0);

      const forbiddenRef = /\b(kpiDefinitionService|kpi_time_series)\b/;

      for (const file of files) {
        const fullPath = path.join(OKR_VNEXT_SERVICE_DIR, file);
        const source = readFileSync(fullPath, 'utf8');
        const matches = source.match(new RegExp(forbiddenRef, 'g')) ?? [];
        expect(matches, `${file} references the legacy KPI cross-domain read path: ${JSON.stringify(matches)}`).toEqual(
          []
        );
      }
    });

    it('okrLegacyArchiveRepository.ts itself never queries kpi_time_series (comments-only reference allowed)', () => {
      const fullPath = path.join(OKR_VNEXT_SERVICE_DIR, 'okrLegacyArchiveRepository.ts');
      const source = readFileSync(fullPath, 'utf8');
      const codeLines = source
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
      const matches = codeLines.join('\n').match(/\bkpi_time_series\b/g) ?? [];
      expect(
        matches,
        `okrLegacyArchiveRepository.ts has a non-comment reference to kpi_time_series: ${JSON.stringify(matches)}`
      ).toEqual([]);
    });
  });
});
