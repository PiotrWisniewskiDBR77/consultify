/**
 * DEC-2026-08-28-154(e) — pins that `Gateway.ts` applies `demoWriteGuard`
 * UNCONDITIONALLY, with no allowlist-driven bypass ahead of it.
 *
 * Prior state (the bug): `Gateway.ts` imported `isStatelessComputeDemoRoute`
 * from `./routes/v8/financeValueDemoAllowlist.js` and called it INSIDE the
 * middleware, calling `next()` directly (skipping `demoWriteGuard` outright)
 * for four Finance value POST routes whenever the path matched — before the
 * guard ever ran, not as an argument to it. That bypass skipped the guard's
 * own demo detection (the `X-Demo-Mode` header / demo org id check), so a
 * POST to those routes could reach the live handler while targeting the demo
 * organization. The owner ruled this a bug, not a feature (decision register
 * `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`,
 * `DEC-2026-08-28-154` point e) and ordered it fixed before deploy.
 *
 * This is a structural, source-scanning check (Gateway.ts pulls in far too
 * much of the app to mount and exercise directly in a unit test) — the same
 * pattern this repo already uses for `fin005PgTestCommand.test.ts` (scans
 * package.json) and `atelierFinancePrimaryReadStructure.test.ts` (scans a
 * service file). The behavioural, mutation-style proof that the guard now
 * actually rejects these routes in demo mode (and still allows them outside
 * demo mode) lives in `routes/v8/__tests__/financeValueRoutes.demoGuard.test.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const GATEWAY_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Gateway.ts');

function readGatewaySource(): string {
  return fs.readFileSync(GATEWAY_PATH, 'utf8');
}

describe('Gateway.ts — DEC-2026-08-28-154(e) demo write guard has no allowlist bypass', () => {
  it('does NOT import isStatelessComputeDemoRoute / financeValueDemoAllowlist — the bypass module is unwired', () => {
    const src = readGatewaySource();
    expect(src).not.toMatch(/isStatelessComputeDemoRoute/);
    expect(src).not.toMatch(
      /import\s*\{[^}]*\}\s*from\s*['"]\.\/routes\/v8\/financeValueDemoAllowlist\.js['"]/
    );
  });

  it('mounts demoWriteGuard directly with app.use — no conditional wrapper that could call next() ahead of it', () => {
    const src = readGatewaySource();
    // The guard construction and its mount must both be present...
    const guardIdx = src.indexOf('demoWriteProtection({');
    const mountIdx = src.indexOf('app.use(demoWriteGuard)');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(mountIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(mountIdx);
    // ...and nothing routes requests to demoWriteGuard conditionally anymore.
    expect(src).not.toMatch(/return demoWriteGuard\(req, res, next\)/);
  });

  it('the allowedRoutes ["/api/demo/", "/api/auth/"] are untouched — no widening of the guard itself', () => {
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
