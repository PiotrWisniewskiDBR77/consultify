/**
 * Tests for floating toolbar dropdown sub-components:
 * SemanticTypeDropdown, BranchThemeDropdown, FontSizeDropdown.
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

import { SemanticTypeDropdown } from '@/components/MyWork/mindmap/floating-toolbar/SemanticTypeDropdown';
import { BranchThemeDropdown } from '@/components/MyWork/mindmap/floating-toolbar/BranchThemeDropdown';
import { FontSizeDropdown } from '@/components/MyWork/mindmap/floating-toolbar/FontSizeDropdown';

/* ──────────── SemanticTypeDropdown ──────────── */
describe('SemanticTypeDropdown', () => {
  it('renders all 7 semantic types in English', () => {
    render(
      <SemanticTypeDropdown isPl={false} current={undefined} onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Topic')).toBeTruthy();
    expect(screen.getByText('Hypothesis')).toBeTruthy();
    expect(screen.getByText('Risk')).toBeTruthy();
    expect(screen.getByText('Action')).toBeTruthy();
    expect(screen.getByText('Decision point')).toBeTruthy();
    expect(screen.getByText('Option')).toBeTruthy();
    expect(screen.getByText('Subtopic')).toBeTruthy();
  });

  it('renders Polish labels when isPl is true', () => {
    render(
      <SemanticTypeDropdown isPl={true} current={undefined} onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Temat')).toBeTruthy();
    expect(screen.getByText('Hipoteza')).toBeTruthy();
    expect(screen.getByText('Ryzyko')).toBeTruthy();
  });

  it('highlights current type', () => {
    const { container } = render(
      <SemanticTypeDropdown isPl={false} current="risk" onSelect={vi.fn()} onClose={vi.fn()} />
    );
    const riskBtn = screen.getByText('Risk').closest('button');
    expect(riskBtn?.className).toContain('font-semibold');
  });

  it('calls onSelect and onClose on click', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <SemanticTypeDropdown isPl={false} current={undefined} onSelect={onSelect} onClose={onClose} />
    );
    fireEvent.click(screen.getByText('Action'));
    expect(onSelect).toHaveBeenCalledWith('action');
    expect(onClose).toHaveBeenCalled();
  });
});

/* ──────────── BranchThemeDropdown ──────────── */
describe('BranchThemeDropdown', () => {
  it('renders all 4 line styles in English', () => {
    render(
      <BranchThemeDropdown isPl={false} current={undefined} onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Curved (default)')).toBeTruthy();
    expect(screen.getByText('Orthogonal')).toBeTruthy();
    expect(screen.getByText('Straight')).toBeTruthy();
    expect(screen.getByText('Step')).toBeTruthy();
  });

  it('calls onSelect and onClose on click', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <BranchThemeDropdown isPl={false} current={undefined} onSelect={onSelect} onClose={onClose} />
    );
    fireEvent.click(screen.getByText('Straight'));
    expect(onSelect).toHaveBeenCalledWith('straight');
    expect(onClose).toHaveBeenCalled();
  });

  it('highlights active style', () => {
    render(
      <BranchThemeDropdown isPl={false} current="orthogonal" onSelect={vi.fn()} onClose={vi.fn()} />
    );
    const btn = screen.getByText('Orthogonal').closest('button');
    expect(btn?.className).toContain('font-semibold');
  });
});

/* ──────────── FontSizeDropdown ──────────── */
describe('FontSizeDropdown', () => {
  it('renders all 7 sizes', () => {
    render(<FontSizeDropdown current={14} onSelect={vi.fn()} onClose={vi.fn()} />);
    ['10', '12', '14', '18', '24', '36', '48'].forEach((s) => {
      expect(screen.getByText(s)).toBeTruthy();
    });
  });

  it('highlights current size', () => {
    render(<FontSizeDropdown current={24} onSelect={vi.fn()} onClose={vi.fn()} />);
    const btn = screen.getByText('24').closest('button');
    expect(btn?.className).toContain('font-semibold');
  });

  it('calls onSelect and onClose on click', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<FontSizeDropdown current={14} onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByText('36'));
    expect(onSelect).toHaveBeenCalledWith(36);
    expect(onClose).toHaveBeenCalled();
  });
});
