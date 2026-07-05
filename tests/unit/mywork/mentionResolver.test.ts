/**
 * Unit — org-scoped @mention parsing + resolution (whiteboard node comments, B2).
 *
 * Asserts extractMentionTokens / resolveMentionedUserIds / resolveMentionsFromComment:
 *  - extract @tokens from free text (ignoring email@host),
 *  - resolve tokens to org-member user ids by id / email / local-part / full name /
 *    unambiguous first name,
 *  - IGNORE tokens that don't match an org member (the org-scoping boundary),
 *  - dedupe + exclude self.
 */
import { describe, expect, it } from 'vitest';

import {
  extractMentionTokens,
  resolveMentionedUserIds,
  resolveMentionsFromComment,
  type OrgMemberLike,
} from '../../../server/src/utils/mentionResolver';

const MEMBERS: OrgMemberLike[] = [
  { user_id: 'u-anna', first_name: 'Anna', last_name: 'Kowalska', email: 'anna@acme.io' },
  { user_id: 'u-bob', first_name: 'Bob', last_name: 'Nowak', email: 'bob@acme.io' },
  { user_id: 'u-carol', first_name: 'Carol', last_name: 'Smith', email: 'carol@acme.io' },
];

describe('extractMentionTokens', () => {
  it('pulls @tokens that follow whitespace or start of string', () => {
    expect(extractMentionTokens('@anna please review with @bob today')).toEqual(['anna', 'bob']);
  });

  it('does NOT treat email addresses as mentions', () => {
    expect(extractMentionTokens('mail me at bob@acme.io please')).toEqual([]);
  });

  it('returns empty for blank / no-mention text', () => {
    expect(extractMentionTokens('')).toEqual([]);
    expect(extractMentionTokens('no mentions here')).toEqual([]);
  });
});

describe('resolveMentionedUserIds', () => {
  it('resolves by user id, email, and email local-part', () => {
    expect(resolveMentionedUserIds(['u-anna'], MEMBERS)).toEqual(['u-anna']);
    expect(resolveMentionedUserIds(['anna@acme.io'], MEMBERS)).toEqual(['u-anna']);
    expect(resolveMentionedUserIds(['bob'], MEMBERS)).toEqual(['u-bob']);
  });

  it('resolves by unambiguous first name (case-insensitive)', () => {
    expect(resolveMentionedUserIds(['Carol'], MEMBERS)).toEqual(['u-carol']);
    expect(resolveMentionedUserIds(['anna'], MEMBERS)).toEqual(['u-anna']);
  });

  it('IGNORES tokens that match no org member (org-scoping boundary)', () => {
    expect(resolveMentionedUserIds(['stranger', 'evil@other.com'], MEMBERS)).toEqual([]);
    // a real user mixed with an outside token → only the org member resolves
    expect(resolveMentionedUserIds(['anna', 'outsider'], MEMBERS)).toEqual(['u-anna']);
  });

  it('dedupes and preserves first-appearance order', () => {
    expect(resolveMentionedUserIds(['anna', 'u-anna', 'bob'], MEMBERS)).toEqual([
      'u-anna',
      'u-bob',
    ]);
  });

  it('excludes the author (self-mention)', () => {
    expect(resolveMentionedUserIds(['anna', 'bob'], MEMBERS, 'u-anna')).toEqual(['u-bob']);
  });

  it('does not guess on an ambiguous first name shared by two members', () => {
    const dupes: OrgMemberLike[] = [
      { user_id: 'u-a1', first_name: 'Sam', last_name: 'One', email: 's1@acme.io' },
      { user_id: 'u-a2', first_name: 'Sam', last_name: 'Two', email: 's2@acme.io' },
    ];
    // bare "@Sam" is ambiguous → dropped; full name still resolves
    expect(resolveMentionedUserIds(['Sam'], dupes)).toEqual([]);
    expect(resolveMentionedUserIds(['Sam Two'], dupes)).toEqual(['u-a2']);
  });

  it('returns [] with empty members or empty tokens', () => {
    expect(resolveMentionedUserIds(['anna'], [])).toEqual([]);
    expect(resolveMentionedUserIds([], MEMBERS)).toEqual([]);
  });
});

describe('resolveMentionsFromComment', () => {
  it('merges explicit tokens with text-extracted @mentions, org-scoped + deduped', () => {
    const ids = resolveMentionsFromComment(
      'ping @bob about this, also anna',
      ['u-anna'],
      MEMBERS
    );
    expect(ids.sort()).toEqual(['u-anna', 'u-bob']);
  });

  it('drops outside tokens even when passed explicitly', () => {
    const ids = resolveMentionsFromComment('hello', ['not-a-member', 'u-carol'], MEMBERS);
    expect(ids).toEqual(['u-carol']);
  });
});
