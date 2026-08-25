/**
 * MYW-PHOTO-005 (P1) — owner-feedback contract regression.
 *
 * "Zagnieżdżona pionowa rynna przewijania widoczna po lewej mimo pustej
 * powierzchni" — a nested vertical scroll gutter was visible even though the
 * surface had nothing to scroll. Root cause: `InboxContent` already owns its
 * scrolling (root `overflow-hidden`, inner list/preview row has its own
 * `overflow-y-auto`), but `getMyWorkMainContentClassName` did not list
 * `inbox` in `workspaceOwnsScroll`, so the wrapper AROUND it also got its own
 * `overflow-y-auto` — two nested owned-scroll containers for one surface.
 *
 * Source: `evidence/exact-candidate-43730-photo-gate-2026-08-23/MY_WORK_EXPERT_REVIEW_2026-08-23.md`.
 * Source-contract check, following `MyWorkHub.decisionsOwnerFeedback.test.ts`
 * in this directory (full mount pulls in the whole My Work provider stack).
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const hubSource = fs.readFileSync(path.resolve(__dirname, '../MyWorkHub.tsx'), 'utf8');
const inboxSource = fs.readFileSync(path.resolve(__dirname, '../InboxContent.tsx'), 'utf8');

describe('MYW-PHOTO-005 — Inbox does not nest two vertical scroll containers', () => {
  it('adds inbox to the workspace-owns-scroll set so the outer wrapper stops scrolling too', () => {
    const fnMatch = hubSource.match(/export function getMyWorkMainContentClassName[\s\S]*?\n}\n/);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch?.[0]).toContain("activeTab === 'inbox'");
  });

  it('keeps InboxContent as the single owner of its own vertical scroll', () => {
    expect(inboxSource).toContain(
      'className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg"'
    );
  });
});
