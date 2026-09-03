/**
 * MYW-PHOTO-002 (P0) — owner-feedback contract regression.
 *
 * "„Inbox is empty — zero backlog! Everything processed. Great job!"
 * ogłasza sukces, choć zero może wynikać z zakresu najemcy, braku fixture,
 * błędu API albo niedostępnych danych." — the default empty state
 * celebrated a "success" it had no way to actually verify. Loading and
 * error states already exist (SharedLoadingState / ErrorState); the
 * remaining gap was the truly-empty branch asserting an unearned
 * achievement instead of stating the fact plus an invitation.
 *
 * Source: `evidence/exact-candidate-43730-photo-gate-2026-08-23/MY_WORK_EXPERT_REVIEW_2026-08-23.md`.
 * Source-contract check (InboxContent pulls in the full My Work provider
 * stack for a real mount), following `TaskOwnerFeedback.contract.test.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const inboxSource = fs.readFileSync(path.resolve(__dirname, '../InboxContent.tsx'), 'utf8');

describe('MYW-PHOTO-002 — Inbox empty state no longer claims false success', () => {
  it('drops the self-congratulatory "zero backlog / Great job" copy and its old keys', () => {
    expect(inboxSource).not.toContain('inboxIsEmptyZero');
    expect(inboxSource).not.toContain('everythingProcessedGreatJob');
  });

  it('states the honest fact plus an invitation instead', () => {
    expect(inboxSource).toContain('myWork.inboxContent.noItemsInInbox');
    expect(inboxSource).toContain('myWork.inboxContent.newItemsWillAppearHere');
  });

  it('keeps the existing loading state untouched (already honest)', () => {
    expect(inboxSource).toContain('<SharedLoadingState template="list" rows={6} />');
  });

  it('distinguishes access-denied (401/403) from a generic load failure — "Still open" gap', () => {
    // The empty-vs-denied gap noted in MODULE_ACCEPTANCE.md ("a genuinely
    // empty successful query and a silently-scoped-to-nothing query render
    // identically") is only partially closable from the frontend: a 200
    // with an empty array cannot be told apart from a 200 scoped to nothing
    // without a new backend signal. What WAS already available — the HTTP
    // status on a failed request — was not being read. This asserts that
    // gap is closed: 401/403 gets its own title/copy/no-retry instead of
    // the generic "Failed to load Inbox" + always-offered retry.
    expect(inboxSource).toContain('loadErrorIsAccessDenied');
    expect(inboxSource).toContain("httpStatus === 401 || httpStatus === 403");
    expect(inboxSource).toContain('myWork.inboxContent.accessDeniedTitle');
    expect(inboxSource).toContain('myWork.inboxContent.accessDeniedMessage');
    expect(inboxSource).toContain('retry={loadErrorIsAccessDenied ? undefined : () => void fetchInbox()}');
  });
});
