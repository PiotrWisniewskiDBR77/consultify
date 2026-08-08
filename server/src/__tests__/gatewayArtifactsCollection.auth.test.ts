/** @vitest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const GATEWAY_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Gateway.ts');

describe('Gateway authenticated GET /api/artifacts collection wiring', () => {
  it('does not hide the customer-facing collection behind the production internal-tools 404', () => {
    const source = fs.readFileSync(GATEWAY_PATH, 'utf8');

    expect(source).not.toContain("app.use('/api/artifacts', ...internalToolsGuard)");
    expect(source).toContain("app.use('/api/artifacts', artifactsRoutes)");
    expect(source).not.toContain("app.use('/api/artifacts', v8FeatureGate, artifactsRoutes)");
  });
});
