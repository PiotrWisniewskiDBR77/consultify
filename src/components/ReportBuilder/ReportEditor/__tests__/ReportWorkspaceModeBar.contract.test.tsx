/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  parseReportBuilderWorkspaceMode,
  type ReportBuilderWorkspaceMode,
} from '../reportBuilderWorkspaceMode';
import { NModeMenu2 } from '@/components/shared/NModeLayout/NModeMenu2';

import { ReportWorkspaceModeBar } from '../ReportWorkspaceModeBar';

let currentLanguage = 'en';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: currentLanguage },
  }),
}));

describe('RB-3 workspace navigation contract', () => {
  it('renders exactly Write, Review and Publish and announces the active mode', () => {
    currentLanguage = 'en';
    render(<ReportWorkspaceModeBar mode="review" onChange={() => undefined} />);

    const navigation = screen.getByRole('navigation', { name: 'Report workspace mode' });
    const buttons = Array.from(navigation.querySelectorAll('button'));
    expect(buttons).toHaveLength(3);
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Write',
      'Review',
      'Publish',
    ]);
    expect(screen.getByRole('button', { name: 'Review' })).toHaveAttribute('aria-current', 'page');
  });

  it('uses local Polish labels without translation keys', () => {
    currentLanguage = 'pl';
    render(<ReportWorkspaceModeBar mode="publish" onChange={() => undefined} />);

    expect(screen.getByRole('navigation', { name: 'Tryb pracy raportu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pisanie' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recenzja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publikacja' })).toHaveAttribute('aria-current', 'page');
  });

  it('mounts the workspace selector inside the existing NModeMenu2 center zone', () => {
    render(
      <NModeMenu2
        sectionsMenu={<span data-testid="sections-slot" />}
        centerControl={<div data-testid="workspace-mode-control" />}
        aiButton={<button type="button" data-testid="ai-slot" />}
      />
    );

    const menu = screen.getByTestId('nmode-menu2');
    const center = menu.querySelector('[data-menu2-zone="center"]');

    expect(center).not.toBeNull();
    expect(center).toContainElement(screen.getByTestId('workspace-mode-control'));
    expect(screen.getAllByTestId('nmode-menu2')).toHaveLength(1);
  });

  it.each<ReportBuilderWorkspaceMode>(['write', 'review', 'publish'])(
    'routes the %s selection through the single mode callback',
    (mode) => {
      currentLanguage = 'en';
      const onChange = vi.fn();
      render(<ReportWorkspaceModeBar mode="write" onChange={onChange} />);

      fireEvent.click(screen.getByTestId(`report-builder-mode-${mode}`));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(mode);
    }
  );

  it('fails closed for unknown URL values', () => {
    expect(parseReportBuilderWorkspaceMode('write')).toBe('write');
    expect(parseReportBuilderWorkspaceMode('review')).toBe('review');
    expect(parseReportBuilderWorkspaceMode('publish')).toBe('publish');
    expect(parseReportBuilderWorkspaceMode('preview')).toBeNull();
    expect(parseReportBuilderWorkspaceMode(null)).toBeNull();
  });
});
