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

const inboxSource = fs.readFileSync(
  path.resolve(__dirname, '../InboxContent.tsx'),
  'utf8'
);

describe('MYW-PHOTO-002 — Inbox empty state no longer claims false success', () => {
  it('drops the self-congratulatory "zero backlog / Great job" copy and its old keys', () => {
    expect(inboxSource).not.toContain('inboxIsEmptyZero');
    expect(inboxSource).not.toContain('everythingProcessedGreatJob');
  });

  it('states the honest fact plus an invitation instead', () => {
    expect(inboxSource).toContain('myWork.inboxContent.noItemsInInbox');
    expect(inboxSource).toContain('myWork.inboxContent.newItemsWillAppearHere');
  });

  it('keeps the existing loading and error states untouched (already honest)', () => {
    expect(inboxSource).toContain('<SharedLoadingState template="list" rows={6} />');
    expect(inboxSource).toContain('<ErrorState message={loadError} retry={() => void fetchInbox()} />');
  });
});
