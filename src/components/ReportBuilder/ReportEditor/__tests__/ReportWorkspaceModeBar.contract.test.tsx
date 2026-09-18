/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  parseReportBuilderWorkspaceMode,
  type ReportBuilderWorkspaceMode,
} from '../reportBuilderWorkspaceMode';
import { ReportWorkspaceModeBar } from '../ReportWorkspaceModeBar';

describe('RB-3 workspace navigation contract', () => {
  it('renders exactly Write, Review and Publish and announces the active mode', () => {
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

  it.each<ReportBuilderWorkspaceMode>(['write', 'review', 'publish'])(
    'routes the %s selection through the single mode callback',
    (mode) => {
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
