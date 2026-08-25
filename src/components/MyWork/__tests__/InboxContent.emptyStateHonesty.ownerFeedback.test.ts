import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// MYW-PHOTO-002: the Inbox's truly-empty state announced "Everything
// processed. Great job!" even though a zero count can come from tenant
// scope, a missing fixture, an API error, or genuinely unavailable data —
// not necessarily because the user actually processed everything. The
// loading/error states already existed and are real; this closes the
// remaining defect: an unverifiable "you succeeded" claim on a plain zero
// count. Source-level lock (component is too large/dependency-heavy to
// mount in a unit test — no existing InboxContent test file exists yet).
const source = fs.readFileSync(path.resolve(__dirname, '../InboxContent.tsx'), 'utf8');

describe('Inbox empty state no longer claims an unverifiable success (MYW-PHOTO-002)', () => {
  it('does not present the empty inbox as a congratulatory "Great job!" claim', () => {
    expect(source).not.toContain('Everything processed. Great job!');
    expect(source).not.toContain('Inbox is empty — zero backlog!');
  });

  it('still distinguishes loading, error and filtered-empty from the truly-empty state', () => {
    expect(source).toContain('loading ? (');
    expect(source).toContain('loadError ? (');
    expect(source).toContain('<ErrorState message={loadError} retry={() => void fetchInbox()} />');
    expect(source).toContain("variant=\"filter\"");
  });

  it('uses the real i18n keys for the truly-empty inbox copy, not a hardcoded string', () => {
    // Keys renamed during the codex/mod07-photo-20260825 merge (see
    // InboxContent.photo002.contract.test.ts) to drop the stale
    // "everythingProcessedGreatJob" name now that the copy no longer claims
    // a success — the honest fact-plus-invitation wording lives under
    // `noItemsInInbox` / `newItemsWillAppearHere` instead.
    expect(source).toContain("t('myWork.inboxContent.noItemsInInbox'");
    expect(source).toContain("'myWork.inboxContent.newItemsWillAppearHere'");
  });
});
