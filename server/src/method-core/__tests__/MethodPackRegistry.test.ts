/**
 * MethodPackRegistry — register/lookup + canStartSession gate.
 *
 * MethodSessionService's own tests stub `PackReadinessLookup`, so this file
 * exercises the REAL registry end to end (register -> getPack ->
 * getReadiness), including requirement 9's underlying rule: a `draft`
 * readiness pack must not be startable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createKernelTestDb, type KernelTestDbHandle } from './kernelTestDb.js';

let testDb: KernelTestDbHandle;

vi.mock('../../utils/DbPromise.js', async () => {
  const { createKernelTestDb } = await import('./kernelTestDb.js');
  testDb = createKernelTestDb();
  return { ...testDb, default: testDb };
});

const { MethodPackRegistry } = await import('../MethodPackRegistry.js');

const organizationId = 'org-1';

describe('MethodPackRegistry', () => {
  let registry: InstanceType<typeof MethodPackRegistry>;

  beforeEach(() => {
    testDb.reset();
    registry = new MethodPackRegistry();
  });

  it('registers a pack and reads it back by (organizationId, packId, version)', async () => {
    await registry.register({
      organizationId,
      packId: 'drd',
      version: '1.0.0',
      name: 'DRD',
      readiness: 'released',
    });
    const pack = await registry.getPack(organizationId, 'drd', '1.0.0');
    expect(pack?.readiness).toBe('released');
  });

  it('distinguishes versions of the same pack', async () => {
    await registry.register({ organizationId, packId: 'drd', version: '1.0.0', name: 'DRD', readiness: 'released' });
    await registry.register({ organizationId, packId: 'drd', version: '2.0.0', name: 'DRD', readiness: 'draft' });

    expect((await registry.getPack(organizationId, 'drd', '1.0.0'))?.readiness).toBe('released');
    expect((await registry.getPack(organizationId, 'drd', '2.0.0'))?.readiness).toBe('draft');
  });

  it('canStartSession is true only for released/pilot', () => {
    expect(registry.canStartSession('released')).toBe(true);
    expect(registry.canStartSession('pilot')).toBe(true);
    for (const readiness of ['draft', 'methodology_review', 'content_approved', 'runtime_validated', 'deprecated'] as const) {
      expect(registry.canStartSession(readiness)).toBe(false);
    }
  });

  it('getReadiness reflects canStartSession for a draft pack (requirement 9)', async () => {
    await registry.register({ organizationId, packId: 'siri', version: '0.1.0', name: 'SIRI', readiness: 'draft' });
    const readiness = await registry.getReadiness(organizationId, 'siri', '0.1.0');
    expect(readiness).toEqual({ canStart: false });
  });

  it('getReadiness returns null for an unregistered pack', async () => {
    const readiness = await registry.getReadiness(organizationId, 'ghost', '1.0.0');
    expect(readiness).toBeNull();
  });
});
