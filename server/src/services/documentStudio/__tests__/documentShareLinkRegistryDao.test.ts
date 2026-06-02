import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetShareLinkRegistryDaoForTests,
  loadShareLinkByToken,
  loadShareLinkByTokenHash,
  persistShareLink,
} from '../documentShareLinkRegistryDao.js';
import type { DocumentShareLink } from '../documentStudioTypes.js';

function baseLink(overrides: Partial<DocumentShareLink> = {}): DocumentShareLink {
  return {
    shareLinkId: 'share-link-1',
    artifactId: 'artifact-1',
    organizationId: 'org-1',
    token: 'token-plaintext-1',
    tokenHash: 'a'.repeat(64),
    accessScope: 'read',
    status: 'active',
    createdBy: 'user-1',
    createdAt: '2026-05-09T00:00:00.000Z',
    consumeCount: 0,
    ...overrides,
  };
}

beforeEach(async () => {
  await __resetShareLinkRegistryDaoForTests();
});

describe('documentShareLinkRegistryDao token indexes', () => {
  it('resolves by plaintext token and by tokenHash', async () => {
    const link = baseLink();
    await persistShareLink(link);

    const byToken = await loadShareLinkByToken(link.token);
    const byHash = await loadShareLinkByTokenHash(link.tokenHash ?? '');

    expect(byToken?.shareLinkId).toBe(link.shareLinkId);
    expect(byHash?.shareLinkId).toBe(link.shareLinkId);
  });

  it('drops stale token/tokenHash indexes when re-persisting rotated token', async () => {
    const link = baseLink();
    await persistShareLink(link);

    const rotated = baseLink({
      token: 'token-plaintext-2',
      tokenHash: 'b'.repeat(64),
    });
    await persistShareLink(rotated);

    expect(await loadShareLinkByToken('token-plaintext-1')).toBeNull();
    expect(await loadShareLinkByTokenHash('a'.repeat(64))).toBeNull();

    const byNewToken = await loadShareLinkByToken('token-plaintext-2');
    const byNewHash = await loadShareLinkByTokenHash('b'.repeat(64));

    expect(byNewToken?.shareLinkId).toBe(link.shareLinkId);
    expect(byNewHash?.shareLinkId).toBe(link.shareLinkId);
  });
});
