/**
 * Denominator gate for the Results writer inventory.
 *
 * WHY THIS IS NOT CIRCULAR
 * A test that only re-added the inventory's own numbers would prove nothing. This
 * suite reads the actual Results route files FROM DISK, counts real
 * `router.post|put|patch|delete` registrations and real observation call sites,
 * and compares those counts against `resultsWriterInventory.ts`. It therefore
 * fails when someone adds a Results writer (or removes an observation) without
 * updating the declared denominator — which is exactly the drift that would let
 * "no observations" quietly start meaning "no usage".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  OBSERVED_WRITERS,
  RESULTS_WRITER_DENOMINATOR,
  RESULTS_WRITER_INVENTORY,
  RESULTS_WRITER_OBSERVABILITY_CAVEAT,
  UNOBSERVED_WRITERS,
} from '../resultsWriterInventory.js';

const SERVER_SRC = path.resolve(__dirname, '../../..');

function read(relativeToServerSrc: string): string {
  return readFileSync(path.join(SERVER_SRC, relativeToServerSrc), 'utf8');
}

/** Counts `router.post|put|patch|delete(` registrations. */
function countWriteSites(source: string): number {
  return (source.match(/router\.(post|put|patch|delete)\(/g) ?? []).length;
}

/** Every distinct Results route file named by the inventory. */
const ROUTE_FILES = Array.from(
  new Set(RESULTS_WRITER_INVENTORY.filter((e) => e.source.startsWith('routes/')).map((e) => e.source))
);

/**
 * FILESYSTEM DISCOVERY — makes 216 a discovered denominator rather than a
 * hand-maintained list.
 *
 * Walks `server/src/routes` and returns every non-test `.ts` file whose path
 * looks like a Results surface. Without this, the inventory could stay
 * "complete" simply because nobody remembered to add a new router to it, and the
 * coverage ratio would quietly describe a smaller world than the real one.
 */
function discoverResultsRouteFiles(dir = 'routes'): string[] {
  const found: string[] = [];
  const walk = (relative: string): void => {
    const absolute = path.join(SERVER_SRC, relative);
    for (const entry of readdirSync(absolute)) {
      const relativeEntry = path.join(relative, entry);
      if (statSync(path.join(SERVER_SRC, relativeEntry)).isDirectory()) {
        if (entry !== '__tests__') walk(relativeEntry);
        continue;
      }
      if (!entry.endsWith('.ts')) continue;
      if (!/result|benefit/i.test(relativeEntry)) continue;
      found.push(relativeEntry);
    }
  };
  walk(dir);
  return found.sort();
}

describe('Results writer inventory — denominator gate', () => {
  it('accounts for EVERY write site in each Results route file it names', () => {
    const mismatches: string[] = [];

    for (const file of ROUTE_FILES) {
      const onDisk = countWriteSites(read(file));
      const declared = RESULTS_WRITER_INVENTORY.filter((e) => e.source === file).reduce(
        (total, e) => total + e.writeSites,
        0
      );
      if (onDisk !== declared) {
        mismatches.push(`${file}: ${onDisk} write sites on disk, ${declared} declared in inventory`);
      }
    }

    // A new writer added to any of these files lands here until the inventory
    // classifies it OBSERVED or EXPLICITLY_UNOBSERVED.
    expect(mismatches).toEqual([]);
  });

  it('DISCOVERS Results route files from the filesystem and leaves no writer-bearing file unlisted', () => {
    const discovered = discoverResultsRouteFiles();

    // Files with no write sites (pure read routers, helpers such as
    // resultsVnext/correlationId.ts) legitimately need no inventory entry.
    const discoveredWithWrites = discovered.filter((file) => countWriteSites(read(file)) > 0);

    const unlisted = discoveredWithWrites.filter((file) => !ROUTE_FILES.includes(file));
    // A NEW Results router with writers lands here until it is classified.
    expect(unlisted).toEqual([]);

    // And nothing in the inventory may be stale/renamed away.
    const missingFromDisk = ROUTE_FILES.filter((file) => !discovered.includes(file));
    expect(missingFromDisk).toEqual([]);

    // The discovered write-site total IS the denominator.
    const discoveredTotal = discoveredWithWrites.reduce(
      (total, file) => total + countWriteSites(read(file)),
      0
    );
    expect(discoveredTotal).toBe(RESULTS_WRITER_DENOMINATOR.totalHttpWriteSites);
  });

  it('declares an observation site for every OBSERVED entry and a reason+owner blocker for every gap', () => {
    for (const entry of OBSERVED_WRITERS) {
      expect(entry.observationSite, `${entry.source} OBSERVED without a site`).toBeTruthy();
      expect(entry.family, `${entry.source} OBSERVED without a family`).toBeTruthy();
      expect(entry.ownerBlocker).toBeNull();
    }
    for (const entry of UNOBSERVED_WRITERS) {
      expect(entry.observationSite).toBeNull();
      // A gap without a stated reason and owner blocker is an invisible gap.
      expect(entry.reason.length, `${entry.source} gap without reason`).toBeGreaterThan(20);
      expect(entry.ownerBlocker, `${entry.source} gap without owner blocker`).toBeTruthy();
    }
  });

  it('matches the real number of observation call sites in each instrumented file', () => {
    // Ground truth: `observeWriter({` for direct call sites, plus this router's
    // own local helper `observeVnextKpiWriter(` for the vNext KPI file.
    const actual: Record<string, number> = {
      'routes/benefits.routes.ts': (read('routes/benefits.routes.ts').match(/observeWriter\(\{/g) ?? [])
        .length,
      'routes/results-kpi-reports.routes.ts': (
        read('routes/results-kpi-reports.routes.ts').match(/observeWriter\(\{/g) ?? []
      ).length,
      'routes/v8/results.routes.ts': (read('routes/v8/results.routes.ts').match(/observeWriter\(\{/g) ?? [])
        .length,
      // The 11 vNext sites call the local helper, which wraps observeWriter once.
      'routes/resultsVnext/kpi.routes.ts': (
        read('routes/resultsVnext/kpi.routes.ts').match(/observeVnextKpiWriter\(req, auth,/g) ?? []
      ).length,
      'services/closureDeliveryReceiptService.ts': (
        read('services/closureDeliveryReceiptService.ts').match(/observeWriter\(\{/g) ?? []
      ).length,
      'services/executionBudgetService.ts': (
        read('services/executionBudgetService.ts').match(/observeWriter\(\{/g) ?? []
      ).length,
    };

    for (const [source, count] of Object.entries(actual)) {
      const declared = OBSERVED_WRITERS.filter((e) => e.source === source).reduce(
        (total, e) => total + e.writeSites,
        0
      );
      expect(count, `${source}: ${count} observation call sites vs ${declared} declared`).toBe(
        declared
      );
    }
  });

  it('reports the honest coverage ratio: a small observed subset of a large surface', () => {
    const d = RESULTS_WRITER_DENOMINATOR;

    expect(d.observedHttpWriteSites + d.unobservedHttpWriteSites).toBe(d.totalHttpWriteSites);

    // The packet's actual scope, asserted so nobody can later describe it as
    // "all Results writers" without this test failing.
    expect(d.observedHttpWriteSites).toBe(20);
    expect(d.unobservedHttpWriteSites).toBe(196);
    expect(d.totalHttpWriteSites).toBe(216);
    expect(d.observedServiceWriteSites).toBe(3);
    // 20 sites cover 22 endpoints: the lifecycle factory site mounts 3.
    expect(d.observedEndpoints).toBe(22);

    // Coverage is under 10% of write sites — the reason absence proves nothing.
    expect(d.observedHttpWriteSites / d.totalHttpWriteSites).toBeLessThan(0.1);
  });

  it('states the caveat that forbids using absence as cutover authority', () => {
    expect(RESULTS_WRITER_OBSERVABILITY_CAVEAT).toMatch(/absence proves nothing/i);
    expect(RESULTS_WRITER_OBSERVABILITY_CAVEAT).toMatch(/not cutover authority/i);
    expect(RESULTS_WRITER_OBSERVABILITY_CAVEAT).toMatch(/best-effort/i);
  });
});
