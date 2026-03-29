/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NotificationsModule } from '../../../src/views/settings/NotificationsModule';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/components/settings/NotificationRulesBuilder', () => ({
  NotificationRulesBuilder: () => <div>NotificationRulesBuilder</div>,
}));

vi.mock('../../../src/components/settings/NotificationSettings', () => ({
  NotificationSettings: () => <div>NotificationSettings</div>,
}));

vi.mock('../../../src/components/SuperAdmin/TabLayout', () => ({
  TabLayout: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

describe('NotificationsModule settings taxonomy', () => {
  it('shows the canonical settings ownership model above notification controls', () => {
    render(
      <NotificationsModule
        currentUser={{ id: 'user-1', email: 'user@example.com' } as any}
        onUpdateUser={vi.fn()}
      />
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('One settings root with clear ownership')).toBeInTheDocument();
    expect(screen.getByText('Module settings')).toBeInTheDocument();
  });
});
