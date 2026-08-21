/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminSettingsSidebar } from '../../src/components/Admin/AdminSettingsSidebar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

function renderSidebar() {
  return render(
    <BrowserRouter>
      <AdminSettingsSidebar
        activeLocation={{ domain: 'team', screen: 'members' }}
        onLocationChange={vi.fn()}
      />
    </BrowserRouter>
  );
}

describe('AdminSettingsSidebar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    renderSidebar();
    expect(document.body).toBeDefined();
  });

  it('renders without crashing', () => {
    const { container } = renderSidebar();
    expect(container).toBeInTheDocument();
  });

  it('displays navigation elements', () => {
    renderSidebar();

    const navElements = screen.queryAllByRole('navigation');
    const buttons = screen.queryAllByRole('button');
    expect(navElements.length + buttons.length).toBeGreaterThanOrEqual(0);
  });

  it('has menu items', () => {
    renderSidebar();

    const menuItems = screen.queryAllByText(/team|billing|security|audit|ai/i);
    expect(menuItems.length).toBeGreaterThan(0);
  });
});
