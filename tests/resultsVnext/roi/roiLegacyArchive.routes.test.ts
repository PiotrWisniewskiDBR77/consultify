/**
 * ROI-E008 — Legacy Archive routes — physical write-denial proof (design
 * §3/B3).
 *
 * No database needed: `denyMutations` (`readOnlyGuard.middleware.ts`)
 * rejects every non-GET/HEAD/OPTIONS request before it reaches auth or any
 * handler that would touch Postgres — see that middleware's own header
 * comment and `roiLegacyArchive.routes.ts`'s middleware-chain comment for
 * why it is mounted first.
 *
 * Two proofs, both required (design §3/B3), mirroring KPI-E007's own
 * `kpiLegacyArchive.routes.test.ts` exactly:
 *   1. Behavioral: mount the real router in an isolated Express app
 *      (supertest) and, for each of the 15 route paths, send
 *      POST/PUT/PATCH/DELETE — assert 405 + `LEGACY_ARCHIVE_READ_ONLY` for
 *      every combination (15 paths × 4 verbs = 60 assertions).
 *   2. Static: `readFileSync` on `roiLegacyArchive.routes.ts`, regex
 *      `/router\.(post|put|patch|delete)\(/i` — assert zero matches, so a
 *      future "just for debugging" write handler fails immediately.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_FILE = path.resolve(__dirname, '../../../server/src/routes/resultsVnext/roiLegacyArchive.routes.ts');

const LEGACY_ROUTE_PATHS = [
  '/',
  '/analysis-financials',
  '/analysis-financials/some-legacy-id',
  '/digitization-analyses',
  '/digitization-analyses/some-legacy-id',
  '/initiative-benefits',
  '/initiative-benefits/some-legacy-id',
  '/roi-assumptions',
  '/roi-assumptions/some-legacy-id',
  '/roi-realized-values',
  '/roi-realized-values/some-legacy-id',
  '/benefits-register',
  '/benefits-register/some-legacy-id',
  '/v8-roi-realization-entries',
  '/v8-roi-realization-entries/some-legacy-id',
];

const MUTATING_VERBS = ['post', 'put', 'patch', 'delete'] as const;

describe('ROI-E008 roiLegacyArchive.routes — physical write-denial', () => {
  let app: Express;

  beforeAll(async () => {
    const router = (await import('../../../server/src/routes/resultsVnext/roiLegacyArchive.routes.js')).default;
    app = express();
    app.use('/api/vnext/results/roi/legacy', router);
  });

  it('LEGACY_ROUTE_PATHS is exactly 15 paths (1 index + 7 tables × 2)', () => {
    expect(LEGACY_ROUTE_PATHS).toHaveLength(15);
  });

  describe('Behavioral — every path × every mutating verb -> 405 LEGACY_ARCHIVE_READ_ONLY', () => {
    for (const routePath of LEGACY_ROUTE_PATHS) {
      for (const verb of MUTATING_VERBS) {
        it(`${verb.toUpperCase()} /api/vnext/results/roi/legacy${routePath} -> 405`, async () => {
          const fullPath = `/api/vnext/results/roi/legacy${routePath}`;
          const res = await (request(app) as any)[verb](fullPath);
          expect(res.status).toBe(405);
          expect(res.body).toMatchObject({ code: 'LEGACY_ARCHIVE_READ_ONLY' });
        });
      }
    }
  });

  describe('Static — zero router.post/put/patch/delete in the routes file', () => {
    it('roiLegacyArchive.routes.ts never registers a write handler', () => {
      const source = readFileSync(ROUTES_FILE, 'utf8');
      const matches = source.match(/router\.(post|put|patch|delete)\(/gi) ?? [];
      expect(matches).toEqual([]);
    });
  });
});
