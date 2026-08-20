import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const gatewayPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Gateway.ts');

describe('Gateway V8 capability discovery mount', () => {
  it('mounts only exact authenticated org-scoped GET flags before the gated V8 router', () => {
    const source = readFileSync(gatewayPath, 'utf8');
    const exactRead = source.indexOf("app.get(\n        '/api/v8/admin/flags'");
    const gatedRouter = source.indexOf("app.use('/api/v8', v8FeatureGate, v8Router)");

    expect(exactRead).toBeGreaterThan(-1);
    expect(gatedRouter).toBeGreaterThan(exactRead);
    const mount = source.slice(exactRead, gatedRouter);
    expect(mount).toContain('gatewayVerifyToken');
    expect(mount).toContain('requireV8OrgContext');
    expect(mount).toContain('getV8Flags(organizationId)');
    expect(mount).not.toContain("'/api/v8/admin/flags/all'");
    expect(mount).not.toContain('app.put(');
  });
});
