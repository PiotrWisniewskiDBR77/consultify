import { describe, expect, it } from 'vitest';

import { getMyWorkMainContentClassName } from '@/components/MyWork/MyWorkHub';

describe('getMyWorkMainContentClassName', () => {
  it('lets an open workspace own scroll and canvas gestures', () => {
    const className = getMyWorkMainContentClassName({
      activeDocumentId: 'idea-123',
      activeTab: 'ideas',
      ideasViewMode: 'grid',
    });

    expect(className).toContain('overflow-hidden');
    expect(className).toContain('flex flex-col');
    expect(className).not.toContain('overflow-y-auto');
  });

  it('keeps list/grid pages scrollable when no workspace is open', () => {
    const className = getMyWorkMainContentClassName({
      activeDocumentId: null,
      activeTab: 'ideas',
      ideasViewMode: 'grid',
    });

    expect(className).toContain('overflow-y-auto');
    expect(className).not.toContain('overflow-hidden');
  });
});
