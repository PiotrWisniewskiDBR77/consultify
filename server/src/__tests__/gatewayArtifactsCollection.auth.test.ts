/** @vitest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const GATEWAY_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../Gateway.ts');
const ARTIFACT_RUNS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../routes/artifact-runs.routes.ts'
);

describe('Gateway authenticated GET /api/artifacts collection wiring', () => {
  it('does not hide the customer-facing collection behind the production internal-tools 404', () => {
    const source = fs.readFileSync(GATEWAY_PATH, 'utf8');

    expect(source).not.toContain("app.use('/api/artifacts', ...internalToolsGuard)");
    expect(source).toContain("app.use('/api/artifacts', artifactsRoutes)");
    expect(source).not.toContain("app.use('/api/artifacts', v8FeatureGate, artifactsRoutes)");
  });

  it('does not hide customer-facing artifact runs behind the internal-tools allowlist', () => {
    const source = fs.readFileSync(GATEWAY_PATH, 'utf8');
    const routerSource = fs.readFileSync(ARTIFACT_RUNS_PATH, 'utf8');

    expect(source).not.toContain("app.use('/api/artifact-runs', ...internalToolsGuard)");
    expect(source).toContain("app.use('/api/artifact-runs', v8FeatureGate, artifactRunsRoutes)");
    expect(routerSource).toMatch(
      /router\.use\(verifyToken\);\s*router\.use\(requireV8OrgContext\);\s*router\.use\(v8OutputsGate\);/
    );
  });
});
