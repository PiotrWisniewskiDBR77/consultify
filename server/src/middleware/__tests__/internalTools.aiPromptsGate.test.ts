/**
 * admin-ai-personas defekt 05.09 — dowod mutacyjny.
 *
 * Root cause: Gateway.ts used to mount `requireInternalToolsAccess` (the
 * blanket "internal engineering tools" kill switch, default OFF outside
 * dev/test) IN FRONT OF `/api/ai-prompts` and its legacy alias
 * `/api/ai/prompts`. That route backs the Admin -> AI -> "Persony" screen
 * (a customer/admin-facing feature, not an internal tool) and already
 * enforces its own auth via `verifyToken` + `requireRole('super_admin',
 * 'admin')` per-endpoint (see ai-prompts.routes.ts). Stacking the internal
 * tools gate on top meant every org — including an Owner/Admin who should
 * be allowed in by the route's own RBAC — got a hard 404 in any
 * environment where INTERNAL_TOOLS_ENABLED isn't explicitly "true"
 * (staging/demo included; only local dev/test auto-enable it).
 *
 * This test exercises the two REAL exported middlewares (no mocking of the
 * logic under test) to prove:
 *   1. `requireInternalToolsAccess` alone 404s an Owner/dbr77.com request
 *      when INTERNAL_TOOLS_ENABLED is unset — this is why the screen broke.
 *   2. `requireRole('super_admin', 'admin')` — the guard the ai-prompts
 *      router actually applies — lets that same Owner request through.
 *   3. Gateway.ts no longer wires `requireInternalToolsAccess` in front of
 *      '/api/ai-prompts' / '/api/ai/prompts' (regression guard on the wiring
 *      itself, since the two functions above are otherwise untouched).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthRequest } from '../auth.middleware.js';
import { requireInternalToolsAccess } from '../internalTools.middleware.js';
import { requireRole } from '../rbac.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeRes(): Response & { statusCode?: number; body?: unknown } {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as unknown as Response['status'];
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res as Response;
  }) as unknown as Response['json'];
  return res as Response & { statusCode?: number; body?: unknown };
}

function makeOwnerReq(): AuthRequest {
  return {
    user: { email: 'piotr.wisniewski@dbr77.com', role: 'OWNER', organizationId: 'org-dbr77' },
  } as unknown as AuthRequest;
}

describe('admin-ai-personas: /api/ai-prompts is not behind the internal-tools kill switch', () => {
  const prevEnabled = process.env.INTERNAL_TOOLS_ENABLED;
  const prevNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevEnabled === undefined) delete process.env.INTERNAL_TOOLS_ENABLED;
    else process.env.INTERNAL_TOOLS_ENABLED = prevEnabled;
  });

  it('requireInternalToolsAccess alone 404s an Owner outside dev/test when the flag is unset (documents the old bug)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.INTERNAL_TOOLS_ENABLED;
    const req = makeOwnerReq();
    const res = makeRes();
    const next = vi.fn();
    requireInternalToolsAccess(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("requireRole('super_admin','admin') — the ai-prompts router's own gate — lets that same Owner through", () => {
    const req = makeOwnerReq();
    const res = makeRes();
    const next = vi.fn();
    requireRole('super_admin', 'admin')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('Gateway.ts no longer stacks the internal-tools guard in front of /api/ai-prompts or /api/ai/prompts', () => {
    const gatewaySrc = fs.readFileSync(
      path.join(__dirname, '../../Gateway.ts'),
      'utf8'
    );
    const guardedAiPrompts = /app\.use\(\s*['"]\/api\/ai-prompts['"]\s*,\s*\.\.\.internalToolsGuard\)/;
    const guardedAiPromptsAlias = /app\.use\(\s*['"]\/api\/ai\/prompts['"]\s*,\s*\.\.\.internalToolsGuard\)/;
    expect(guardedAiPrompts.test(gatewaySrc)).toBe(false);
    expect(guardedAiPromptsAlias.test(gatewaySrc)).toBe(false);
    // Sanity: the router itself is still mounted (i.e. we didn't just delete the feature).
    expect(gatewaySrc.includes("app.use('/api/ai-prompts', aiPromptsRoutes)")).toBe(true);
  });
});
