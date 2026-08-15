import { beforeEach, describe, expect, it, vi } from 'vitest';

const seedDecks = vi.hoisted(() => vi.fn());

vi.mock('../atelierPresentationDeckSeed.js', () => ({
  seedAtelierPresentationDecks: seedDecks,
}));

const { materializeAtelierPresentationCapability } = await import('../demoSeedService.js');

describe('CLEAN-002-MAT-024 — authorized dataset capability bridge', () => {
  beforeEach(() => {
    seedDecks.mockReset();
    seedDecks.mockResolvedValue({ applied: false, plan: [] });
  });

  it('is dry-run by default and forwards no implicit write authority', async () => {
    await materializeAtelierPresentationCapability({ organizationId: 'atelier' });

    expect(seedDecks).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'atelier', dryRun: true })
    );
  });

  it('enables writes only after an explicit write=true call', async () => {
    await materializeAtelierPresentationCapability({ organizationId: 'atelier', write: true });

    expect(seedDecks).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'atelier', dryRun: false })
    );
  });

  it('rejects a non-canonical tenant even if a caller bypasses TypeScript', async () => {
    await expect(
      materializeAtelierPresentationCapability({ organizationId: 'customer-org' as 'atelier' })
    ).rejects.toThrow('organization_id=atelier');
    expect(seedDecks).not.toHaveBeenCalled();
  });
});
