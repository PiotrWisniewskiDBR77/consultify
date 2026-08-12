/**
 * @vitest-environment jsdom
 *
 * D1 (P2, 2026-08-12) — the "open documents" session-storage key used to be
 * global (`moduleHub.openDocuments.mywork`), with no owner. Two identities
 * sharing one browser tab (a second user logging in, or the same user
 * switching organizations) would inherit each other's open document tabs.
 *
 * Regression: write as user A + org A, then read as user B + org B must come
 * back empty — the two identities must never share storage.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getMyWorkDocumentsStorageKey,
  LEGACY_MYWORK_OPEN_DOCUMENTS_KEY,
  readStoredMyWorkDocuments,
  writeStoredMyWorkDocuments,
} from '../MyWorkHub';

const USER_A = 'user-a';
const ORG_A = 'org-a';
const USER_B = 'user-b';
const ORG_B = 'org-b';

const sampleState = {
  openDocuments: [
    {
      id: 'task-123',
      type: 'task' as const,
      name: 'Confidential task belonging to user A',
      status: 'todo' as const,
    },
  ],
  activeDocumentId: 'task-123',
};

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('MyWorkHub open-documents storage scoping (D1)', () => {
  it('does not leak open documents between two different identities', () => {
    writeStoredMyWorkDocuments(USER_A, ORG_A, sampleState);

    // Sanity: user A / org A can read back what they just wrote.
    const readByOwner = readStoredMyWorkDocuments(USER_A, ORG_A);
    expect(readByOwner.openDocuments).toHaveLength(1);
    expect(readByOwner.activeDocumentId).toBe('task-123');

    // A second identity (different user AND different org) in the same tab
    // must see nothing.
    const readByOther = readStoredMyWorkDocuments(USER_B, ORG_B);
    expect(readByOther.openDocuments).toEqual([]);
    expect(readByOther.activeDocumentId).toBeNull();
  });

  it('does not leak when only the user changes within the same organization', () => {
    writeStoredMyWorkDocuments(USER_A, ORG_A, sampleState);

    const readByOtherUserSameOrg = readStoredMyWorkDocuments(USER_B, ORG_A);
    expect(readByOtherUserSameOrg.openDocuments).toEqual([]);
  });

  it('does not leak when only the organization changes for the same user', () => {
    writeStoredMyWorkDocuments(USER_A, ORG_A, sampleState);

    const readSameUserOtherOrg = readStoredMyWorkDocuments(USER_A, ORG_B);
    expect(readSameUserOtherOrg.openDocuments).toEqual([]);
  });

  it('builds a key namespaced by organization and user', () => {
    expect(getMyWorkDocumentsStorageKey(USER_A, ORG_A)).toBe(
      `moduleHub.openDocuments.mywork.${ORG_A}.${USER_A}`
    );
    expect(getMyWorkDocumentsStorageKey(USER_A, ORG_A)).not.toBe(
      getMyWorkDocumentsStorageKey(USER_B, ORG_B)
    );
  });

  it('refuses to read or write without both userId and organizationId (pre-login safety)', () => {
    // No identity at all.
    expect(getMyWorkDocumentsStorageKey(null, null)).toBeNull();
    expect(getMyWorkDocumentsStorageKey(undefined, undefined)).toBeNull();
    // Only one half of the identity known.
    expect(getMyWorkDocumentsStorageKey(USER_A, null)).toBeNull();
    expect(getMyWorkDocumentsStorageKey(null, ORG_A)).toBeNull();

    // Writing without a full identity must not touch sessionStorage at all.
    writeStoredMyWorkDocuments(null, null, sampleState);
    expect(window.sessionStorage.length).toBe(0);

    // Reading without a full identity must return an empty state, never
    // fall back to some other/global key.
    const read = readStoredMyWorkDocuments(undefined, undefined);
    expect(read.openDocuments).toEqual([]);
    expect(read.activeDocumentId).toBeNull();
  });

  it('cleans up the legacy unscoped key so it cannot keep leaking', () => {
    // Simulate leftover state from before the D1 fix.
    window.sessionStorage.setItem(
      LEGACY_MYWORK_OPEN_DOCUMENTS_KEY,
      JSON.stringify(sampleState)
    );

    // Any call to readStoredMyWorkDocuments (as happens on every MyWorkHub
    // mount) should purge the legacy key, regardless of whether a scoped
    // identity is available yet.
    readStoredMyWorkDocuments(USER_A, ORG_A);

    expect(window.sessionStorage.getItem(LEGACY_MYWORK_OPEN_DOCUMENTS_KEY)).toBeNull();
  });
});
