/**
 * FIN-006/B — pins that `Gateway.ts` actually applies the exact-match
 * stateless-compute allowlist, not just that the allowlist module itself is
 * correct (that's `financeValueRoutes.demoGuard.test.ts`, which mounts its
 * OWN express app, never `Gateway.ts`).
 *
 * Structural, source-scanning check (Gateway.ts pulls in far too much of the
 * app to mount and exercise directly in a unit test) — the same pattern this
 * repo already uses for `fin005PgTestCommand.test.ts` (scans package.json)
 * and `atelierFinancePrimaryReadStructure.test.ts` (scans a service file).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const GATEWAY_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../Gateway.ts'
);

function readGatewaySource(): string {
  return fs.readFileSync(GATEWAY_PATH, 'utf8');
}

describe('Gateway.ts — FIN-006/B stateless-compute demo allowlist wiring', () => {
  it('imports isStatelessComputeDemoRoute from the audited allowlist module', () => {
    const src = readGatewaySource();
    expect(src).toMatch(
      /import\s*\{\s*isStatelessComputeDemoRoute\s*\}\s*from\s*['"]\.\/routes\/v8\/financeValueDemoAllowlist\.js['"]/
    );
  });

  it('the demo write guard checks isStatelessComputeDemoRoute BEFORE calling demoWriteGuard', () => {
    const src = readGatewaySource();
    const guardIdx = src.indexOf('demoWriteProtection({');
    const checkIdx = src.indexOf('isStatelessComputeDemoRoute(req.method, pathname)');
    const callIdx = src.indexOf('return demoWriteGuard(req, res, next)');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(checkIdx).toBeGreaterThan(-1);
    expect(callIdx).toBeGreaterThan(-1);
    // The guard is still constructed with the ORIGINAL allowlist (unchanged —
    // FIN-006/B does not touch demoGuard.middleware.ts or widen it).
    expect(guardIdx).toBeLessThan(checkIdx);
    expect(checkIdx).toBeLessThan(callIdx);
  });

  it('the original allowedRoutes ["/api/demo/", "/api/auth/"] are untouched — no widening of the guard itself', () => {
    const src = readGatewaySource();
    expect(src).toMatch(/allowedRoutes:\s*\[\s*'\/api\/demo\/',\s*'\/api\/auth\/'\s*\]/);
  });

  it('demoContextMiddleware still mounts before the guard, unchanged ordering', () => {
    const src = readGatewaySource();
    const contextIdx = src.indexOf('app.use(demoContextMiddleware)');
    const guardIdx = src.indexOf('demoWriteProtection({');
    expect(contextIdx).toBeGreaterThan(-1);
    expect(contextIdx).toBeLessThan(guardIdx);
  });
});
