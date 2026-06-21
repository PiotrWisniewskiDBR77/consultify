import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();

vi.mock('../../../server/src/services/initiativeGenerationService.js', () => ({
  createInitiative: (...a: unknown[]) => mockCreate(...a),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { generateInitiative } from '../../../server/src/services/ai/tools/generateInitiative.js';

const ORG = 'org-1';

describe('generate_initiative tool (C2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ok:false when there is no organization context', async () => {
    const r = await generateInitiative({ title: 'X' }, {});
    expect(r.ok).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a draft and returns ok:true + id (org-scoped, source=teresa_chat)', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-9' });
    const r = await generateInitiative(
      { title: 'Robotic picking', problem: 'manual picking is slow' },
      { organizationId: ORG }
    );
    expect(r).toMatchObject({ ok: true, id: 'init-9', title: 'Robotic picking' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        title: 'Robotic picking',
        description: 'manual picking is slow',
        source: 'teresa_chat',
      })
    );
  });

  it('defaults the title when blank', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-10' });
    const r = await generateInitiative({ title: '   ' }, { organizationId: ORG });
    expect(r.title).toBe('New initiative');
  });

  it('ok:false when the create returns no id', async () => {
    mockCreate.mockResolvedValueOnce({ id: '' });
    const r = await generateInitiative({ title: 'X' }, { organizationId: ORG });
    expect(r.ok).toBe(false);
  });

  it('ok:false (swallowed) when the create throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('db down'));
    const r = await generateInitiative({ title: 'X' }, { organizationId: ORG });
    expect(r.ok).toBe(false);
  });
});
