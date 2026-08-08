/**
 * @vitest-environment jsdom
 *
 * Regression for the Template Architect's "Version history" panel: opening
 * history for one template must not leak into a subsequently selected
 * template's view. Before the fix, `showHistory` / `auditEntries` /
 * `comparedAuditId` were never reset when `selectedTemplateId` changed via a
 * plain row click, so switching templates while history was open kept
 * showing the PREVIOUS template's audit trail — and "Restore as draft"
 * would fire with an auditId that doesn't belong to the newly selected
 * template.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentStudioTemplateArchitectView } from '@/components/DocumentStudio/DocumentStudioTemplateArchitectView';
import type { DocumentTemplate } from '@/components/DocumentStudio/types';

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  revise: vi.fn(),
  validate: vi.fn(),
  audit: vi.fn(),
  newVersion: vi.fn(),
  deleteDraft: vi.fn(),
  restore: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('@/utils/templateEditorFlag', () => ({ isTemplateStructureEditorEnabled: () => true }));
vi.mock('@/components/shared/colorPatterns/useBrandKitColors', () => ({
  useBrandKitColors: () => [],
}));
vi.mock('@/components/shared/colorPatterns/ColorPatternPicker', () => ({
  ColorPatternPicker: () => <div />,
}));
vi.mock('@/components/shared/ModuleHub', () => ({
  FilterableTable: ({ data, onRowClick, getRowActions }: any) => (
    <div>
      {data.map((row: any) => (
        <div key={row.id} data-testid={`row-${row.id}`}>
          <button data-testid={`template-row-${row.id}`} onClick={() => onRowClick(row)}>
            {row.name}
          </button>
          {getRowActions(row).map((action: any) => (
            <button key={action.id} onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  ),
}));
vi.mock('@/components/DocumentStudio/api', () => ({
  listDocumentStudioTemplates: (...args: unknown[]) => apiMocks.list(...args),
  reviseDocumentStudioTemplateStructure: (...args: unknown[]) => apiMocks.revise(...args),
  approveDocumentStudioTemplate: vi.fn(),
  deprecateDocumentStudioTemplate: vi.fn(),
  planDocumentStudioTemplate: vi.fn(),
  validateDocumentStudioTemplate: (...args: unknown[]) => apiMocks.validate(...args),
  listDocumentStudioTemplateAudit: (...args: unknown[]) => apiMocks.audit(...args),
  createDocumentStudioTemplateVersion: (...args: unknown[]) => apiMocks.newVersion(...args),
  deleteDocumentStudioDraftTemplate: (...args: unknown[]) => apiMocks.deleteDraft(...args),
  restoreDocumentStudioTemplateSnapshotAsDraft: (...args: unknown[]) => apiMocks.restore(...args),
}));

const makeTemplate = (id: string, name: string): DocumentTemplate =>
  ({
    templateId: id,
    name,
    status: 'draft',
    version: '0.1',
    updatedAt: '2026-08-06T10:00:00.000Z',
    documentType: 'board_report',
    requiredInputs: [],
    sectionBlueprint: [
      {
        title: 'Summary',
        purpose: 'Summary',
        level: 1,
        required: true,
        expectedLengthHint: 'short',
      },
    ],
    formattingSchema: {
      fonts: { body: 'Arial', heading: 'Arial' },
      headingStyles: { h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
      headers: { enabled: true },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
      toc: true,
      coverPage: true,
      appendixStyle: 'lettered',
      citationStyle: 'inline_marker',
    },
  }) as DocumentTemplate;

describe('DocumentStudioTemplateArchitectView history panel reset', () => {
  const templateOne = makeTemplate('template-1', 'Board template');
  const templateTwo = makeTemplate('template-2', 'Steering template');

  beforeEach(() => {
    apiMocks.list.mockReset().mockResolvedValue([templateOne, templateTwo]);
    apiMocks.revise.mockReset();
    apiMocks.validate.mockReset().mockResolvedValue({ valid: true, issues: [] });
    apiMocks.audit.mockReset().mockImplementation(async (templateId: string) =>
      templateId === 'template-1'
        ? [
            {
              auditId: 'audit-1-approved',
              action: 'template_approved',
              occurredAt: '2026-08-06T10:02:00.000Z',
              details: { templateSnapshot: templateOne },
            },
          ]
        : []
    );
    apiMocks.newVersion.mockReset();
    apiMocks.deleteDraft.mockReset();
    apiMocks.restore.mockReset();
  });

  it('clears the history/compare panel when a different template row is selected', async () => {
    render(<DocumentStudioTemplateArchitectView />);

    const row1 = await screen.findByTestId('row-template-1');
    fireEvent.click(within(row1).getByRole('button', { name: 'Version history' }));

    await waitFor(() => expect(apiMocks.audit).toHaveBeenCalledWith('template-1'));
    expect(await screen.findByRole('button', { name: 'Restore as draft' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(await screen.findByText('Snapshot comparison')).toBeInTheDocument();

    // Switch to a different template via a plain row click (not the
    // "Version history" action) — the stale history/compare state from
    // template-1 must be dropped immediately.
    const row2 = await screen.findByTestId('row-template-2');
    fireEvent.click(within(row2).getByRole('button', { name: 'Steering template' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Restore as draft' })).not.toBeInTheDocument()
    );
    expect(screen.queryByText('Snapshot comparison')).not.toBeInTheDocument();
  });
});
