/**
 * Tests for MoreToolsPanel: search filtering.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Whole-module mock — see floatingNodeToolbar.test.tsx: an incomplete one makes the
// file fail to COLLECT the moment the import graph reaches `src/i18n.ts`, which reads
// as "0 test" and hides every test in the file. Shape copied from `tests/setup.ts`.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  Trans: ({ children, i18nKey }: any) => children || i18nKey,
  I18nextProvider: ({ children }: any) => children,
}));

import { MoreToolsPanel } from '@/components/MyWork/mindmap/toolbar-popovers/MoreToolsPanel';

const baseProps = {
  isPl: false,
  onAction: vi.fn(),
  onClose: vi.fn(),
};

describe('MoreToolsPanel', () => {
  it('renders all tool categories', () => {
    render(<MoreToolsPanel {...baseProps} />);
    expect(screen.getByText('Visual Modes')).toBeTruthy();
    expect(screen.getByText('Workflow')).toBeTruthy();
    expect(screen.getByText('Collaboration')).toBeTruthy();
    expect(screen.getByText('Analytics')).toBeTruthy();
  });

  it('filters tools by search query', () => {
    render(<MoreToolsPanel {...baseProps} />);
    const input = screen.getByPlaceholderText('ideas.mindmap.searchTools');
    fireEvent.change(input, { target: { value: 'minimap' } });
    expect(screen.getByText('Minimap')).toBeTruthy();
    expect(screen.queryByText('Webhooks/Integrations')).toBeNull();
  });

  it('shows no results for unmatched search', () => {
    render(<MoreToolsPanel {...baseProps} />);
    const input = screen.getByPlaceholderText('ideas.mindmap.searchTools');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('ideas.mindmap.noResults')).toBeTruthy();
  });

  it('dispatches action and closes on tool click', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(<MoreToolsPanel {...baseProps} onAction={onAction} onClose={onClose} />);
    fireEvent.click(screen.getByText('Fit view'));
    expect(onAction).toHaveBeenCalledWith('mm_fit_view');
    expect(onClose).toHaveBeenCalled();
  });
});
