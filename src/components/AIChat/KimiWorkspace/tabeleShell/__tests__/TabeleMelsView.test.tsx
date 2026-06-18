/**
 * @vitest-environment jsdom
 *
 * Smoke tests for `<TabeleMelsView>` (EPIC-T16-S3 D2 lane swap adapter).
 *
 * Coverage:
 *   * Empty preview path renders the empty-state slot inside the
 *     canvas.
 *   * With preview, the TabelePreviewLayout-mounted canvas appears.
 *   * Top bar chips include the canonical MELS chip ids.
 *   * Left rail outline shows derived badges from the preview.
 *   * Right rail mounts a panel when its tool icon is clicked.
 *   * Confidentiality + governance dot tones reach the chip strip.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defOrOpts?: unknown) => {
      if (typeof defOrOpts === 'string') return defOrOpts;
      if (
        defOrOpts &&
        typeof defOrOpts === 'object' &&
        'defaultValue' in (defOrOpts as Record<string, unknown>)
      ) {
        return String((defOrOpts as Record<string, unknown>).defaultValue);
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => () => undefined,
  };
});

import type { ArtifactPreview } from '../../KimiWorkspaceShell';
import { TabeleMelsView } from '../TabeleMelsView';

const samplePreview: ArtifactPreview & { type: 'tabele' } = {
  type: 'tabele',
  title: 'Sample table',
  fileName: 'sample_table.csv',
  summary: 'Operational sample for unit testing.',
  kpiItems: [
    { label: 'Rows', value: '3' },
    { label: 'Columns', value: '2' },
  ],
  tableId: 'tbl-1',
  tableData: {
    columns: ['name', 'status'],
    rows: [
      { id: 'r1', name: 'Alpha', status: 'open' },
      { id: 'r2', name: 'Beta', status: 'closed' },
      { id: 'r3', name: 'Gamma', status: 'open' },
    ],
  },
  tabeleSchemaFields: [
    { fieldId: 'f1', name: 'name', fieldType: 'text', governanceState: 'committed' },
    { fieldId: 'f2', name: 'status', fieldType: 'text', governanceState: 'committed' },
  ],
  tabeleRelations: [],
  tabeleRationale: {
    summary: 'No relations.',
    bullets: [],
    citedSourceIds: [],
    proposalStatus: 'none',
  },
};

describe('TabeleMelsView', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders the empty-state slot when preview is null', () => {
    render(
      <TabeleMelsView
        preview={null}
        emptyState={<span data-testid="empty-stub">Generating…</span>}
        persistRailState={false}
      />
    );
    expect(screen.getByTestId('tabele-mels-canvas-empty')).toBeInTheDocument();
    expect(screen.getByTestId('empty-stub')).toBeInTheDocument();
  });

  it('mounts the TabelePreviewLayout canvas when preview is present', () => {
    render(<TabeleMelsView preview={samplePreview} persistRailState={false} />);
    expect(screen.getByTestId('tabele-mels-canvas')).toBeInTheDocument();
    // TabelePreviewLayout renders the table title text.
    expect(screen.getAllByText(/Sample table|Operational/i).length).toBeGreaterThan(0);
  });

  it('top bar contains the canonical MELS chip ids', () => {
    render(
      <TabeleMelsView
        preview={samplePreview}
        topBarHandlers={{
          onTheme: vi.fn(),
          onHistory: vi.fn(),
          onQa: vi.fn(),
          onShare: vi.fn(),
          onRun: vi.fn(),
        }}
        persistRailState={false}
      />
    );
    const chipsRow = screen.getByTestId('mels-topbar-chips');
    const ids = within(chipsRow)
      .getAllByRole('button')
      .map((b) => b.getAttribute('data-mels-chip'));
    expect(ids).toEqual([
      'internal',
      'theme',
      'history',
      'qa',
      'governance',
      'analytics',
      'audit',
      'share',
      'agent',
      'run',
    ]);
  });

  it('left rail derives section badges from the preview', () => {
    render(<TabeleMelsView preview={samplePreview} persistRailState={false} />);
    expect(screen.getByTestId('tabele-outline-records')).toHaveTextContent('3');
    expect(screen.getByTestId('tabele-outline-schema')).toHaveTextContent('2');
    expect(screen.getByTestId('tabele-outline-relations')).toHaveTextContent('0');
  });

  it('right rail mounts the supplied panel for the active tool', () => {
    render(
      <TabeleMelsView
        preview={samplePreview}
        rightRailPanels={{
          aiEditor: <div data-testid="ai-editor-panel">AI Editor body</div>,
        }}
        persistRailState={false}
      />
    );
    fireEvent.click(screen.getByTestId('mels-right-rail-tool-ai-editor'));
    expect(screen.getByTestId('ai-editor-panel')).toBeInTheDocument();
  });

  it('confidentiality dot tone reaches the chip strip', () => {
    render(
      <TabeleMelsView
        preview={samplePreview}
        confidentiality="confidential"
        topBarHandlers={{ onConfidentiality: vi.fn() }}
        persistRailState={false}
      />
    );
    const internalChip = screen.getByTestId('mels-chip-internal');
    expect(internalChip.querySelector('.bg-danger-500')).toBeTruthy();
  });
});
