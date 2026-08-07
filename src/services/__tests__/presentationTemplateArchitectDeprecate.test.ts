/**
 * presentationTemplateArchitectDeprecate.test
 *
 * `deprecatePresentationTemplate` is the FE caller for the existing
 * `POST /templates/:id/governance/deprecate` governance endpoint
 * (presentations.routes.ts:1310) — added so the Deck Template Architect
 * view can withdraw a `draft` template without a second copy of the
 * endpoint string. This is a thin pass-through; the test only pins the
 * request shape (URL + body) and the unwrap of the `{ data: { data } }`
 * envelope, mirroring `clonePresentationTemplate`'s existing coverage
 * pattern (`Api` is mocked, no real network).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    post: (...a: unknown[]) => post(...a),
  },
}));

import { deprecatePresentationTemplate } from '../presentationTemplateArchitect';

describe('deprecatePresentationTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs to the governance/deprecate endpoint with the trimmed reason', async () => {
    post.mockResolvedValue({
      data: { data: { record: { id: 'tpl_1', lifecycle_state: 'deprecated' } } },
    });

    const result = await deprecatePresentationTemplate('tpl_1', 'Superseded by v2 template');

    expect(post).toHaveBeenCalledWith('/presentations/templates/tpl_1/governance/deprecate', {
      reason: 'Superseded by v2 template',
    });
    expect(result).toEqual({ record: { id: 'tpl_1', lifecycle_state: 'deprecated' } });
  });

  it('URL-encodes the template id', async () => {
    post.mockResolvedValue({
      data: { data: { record: { id: 'tpl with space', lifecycle_state: 'deprecated' } } },
    });

    await deprecatePresentationTemplate('tpl with space', 'reason');

    expect(post).toHaveBeenCalledWith(
      '/presentations/templates/tpl%20with%20space/governance/deprecate',
      { reason: 'reason' }
    );
  });

  it('rejects a successful HTTP response unless lifecycle readback confirms withdrawal', async () => {
    post.mockResolvedValue({
      data: { data: { record: { id: 'tpl_1', lifecycle_state: 'draft' } } },
    });

    await expect(deprecatePresentationTemplate('tpl_1', 'obsolete')).rejects.toThrow(
      'Template withdrawal was not confirmed by server readback.'
    );
  });

  it('propagates a rejection when the request fails (e.g. missing capability / 400 empty reason)', async () => {
    post.mockRejectedValue(new Error('A non-empty `reason` is required to deprecate a template.'));

    await expect(deprecatePresentationTemplate('tpl_1', 'anything')).rejects.toThrow(
      'A non-empty `reason` is required to deprecate a template.'
    );
  });
});
