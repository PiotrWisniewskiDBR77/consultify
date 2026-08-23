import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { requiresOrganizationVisibilityConsent } from '../chatHistoryVisibility';

describe('Chat history organization visibility consent', () => {
  it('requires consent when an unassigned or personal conversation enters a team folder', () => {
    expect(requiresOrganizationVisibilityConsent('team', undefined)).toBe(true);
    expect(requiresOrganizationVisibilityConsent('team', 'personal')).toBe(true);
  });

  it('does not ask again for moves within organization folders or private destinations', () => {
    expect(requiresOrganizationVisibilityConsent('team', 'team')).toBe(false);
    expect(requiresOrganizationVisibilityConsent('personal', 'personal')).toBe(false);
    expect(requiresOrganizationVisibilityConsent(undefined, 'personal')).toBe(false);
  });

  it('surfaces the persisted consent receipt after drag-and-drop just like the Move modal', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AIChat/ChatHistorySidebar.tsx'),
      'utf8'
    );

    expect(source).toContain('const result = await moveConversationToProject');
    expect(source).toContain('if (result.visibilityReceiptId)');
    expect(source).toContain("t('aiChat.visibilityConsentRecorded'");
  });
});

