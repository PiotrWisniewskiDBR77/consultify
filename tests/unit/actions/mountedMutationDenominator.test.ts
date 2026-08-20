import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFederatedActionManifest } from '../../../shared/contracts/federatedActionManifest';
import {
  adaptMountedMutationDenominator,
  extractMountedMutationRoutes,
  mountedMutationId,
  type MountedMutationRoute,
} from '../../../server/src/services/teresa/mountedMutationDenominator';

const ROOT = process.cwd();
const sources: Array<{ module: MountedMutationRoute['module']; path: string }> = [
  { module: 'IDEA', path: 'server/src/routes/my-work.routes.ts' },
  { module: 'DYNAMIC_SWOT', path: 'server/src/routes/method-core.routes.ts' },
  { module: 'CHAT', path: 'server/src/routes/ai.routes.ts' },
  { module: 'EXECUTION', path: 'server/src/routes/pmo/initiativesExecutionRuntime.routes.ts' },
  ...readdirSync(join(ROOT, 'server/src/routes/caseWorkspace'))
    .filter((name) => name.endsWith('.routes.ts'))
    .map((name) => ({ module: 'CASE_WORKSPACE' as const, path: `server/src/routes/caseWorkspace/${name}` })),
];

describe('mounted MVP mutation denominator', () => {
  it('extracts every mounted write route and emits an explicit supported-or-out row', () => {
    const routes = sources.flatMap(({ module, path }) =>
      extractMountedMutationRoutes(readFileSync(join(ROOT, path), 'utf8'), module, path)
    );
    expect(routes.length).toBeGreaterThan(100);
    const ids = routes.map(mountedMutationId);
    expect(new Set(ids).size).toBe(ids.length);
    const adapter = () => adaptMountedMutationDenominator(routes);
    const manifest = buildFederatedActionManifest([adapter], ids);
    expect(manifest.entries).toHaveLength(routes.length);
    expect(manifest.entries.every((entry) => entry.mvpDisposition === 'NOT_SUPPORTED_IN_MVP')).toBe(true);
    expect(manifest.entries.every((entry) => entry.teresaExecutor === null)).toBe(true);
  });

  it('detects route additions automatically rather than relying on a copied route list', () => {
    const extracted = extractMountedMutationRoutes(
      `router.get('/read', h); router.post('/new', h); router.patch('/new/:id', h);`,
      'CHAT', 'fixture.routes.ts'
    );
    expect(extracted.map(mountedMutationId)).toEqual(['CHAT:POST:/new', 'CHAT:PATCH:/new/:id']);
  });
});
