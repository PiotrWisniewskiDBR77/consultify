/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        <div key={row.id}>
          <button data-testid={`template-row-${row.id}`} onClick={() => onRowClick(row)}>
            {row.name}
          </button>
          {getRowActions(row).map((action: any) => (
            <button key={action.id} onClick={action.onClick}>{action.label}</button>
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

const makeTemplate = (): DocumentTemplate =>
  ({
    templateId: 'template-1',
    name: 'Board template',
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

describe('DocumentStudioTemplateArchitectView header/footer persistence', () => {
  beforeEach(() => {
    let template = makeTemplate();
    apiMocks.list.mockReset().mockImplementation(async () => [template]);
    apiMocks.revise.mockReset().mockImplementation(async (_id, _sections, _color, payload) => {
      template = {
        ...template,
        formattingSchema: payload.formattingSchema,
        updatedAt: '2026-08-06T10:01:00.000Z',
      };
      return template;
    });
    apiMocks.validate.mockReset().mockResolvedValue({ valid: true, issues: [] });
    apiMocks.audit.mockReset().mockResolvedValue([]);
    apiMocks.newVersion.mockReset();
    apiMocks.deleteDraft.mockReset();
    apiMocks.restore.mockReset();
  });

  it('runs explicit validation and surfaces a passing result', async () => {
    render(<DocumentStudioTemplateArchitectView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Validate' }));

    await waitFor(() => expect(apiMocks.validate).toHaveBeenCalledWith('template-1'));
    expect(await screen.findByText('Validation passed')).toBeInTheDocument();
  });

  it('compares an immutable history snapshot and offers restore as a new draft', async () => {
    const snapshot = makeTemplate();
    apiMocks.audit.mockResolvedValue([
      {
        auditId: 'audit-1',
        action: 'template_approved',
        occurredAt: '2026-08-06T10:02:00.000Z',
        details: { templateSnapshot: snapshot },
      },
    ]);
    render(<DocumentStudioTemplateArchitectView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Version history' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Compare' }));

    expect(await screen.findByText('Snapshot comparison')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore as draft' })).toBeInTheDocument();
  });

  it('saves header/footer text and restores it after the registry refresh', async () => {
    render(<DocumentStudioTemplateArchitectView />);
    fireEvent.click(await screen.findByTestId('template-row-template-1'));

    fireEvent.change(await screen.findByTestId('template-header-content'), {
      target: { value: 'Board Confidential' },
    });
    fireEvent.change(screen.getByTestId('template-footer-content'), {
      target: { value: 'Internal use only' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save structure' }));

    await waitFor(() => expect(apiMocks.revise).toHaveBeenCalledTimes(1));
    expect(apiMocks.revise.mock.calls[0]?.[3]).toMatchObject({
      formattingSchema: {
        headers: { content: 'Board Confidential' },
        footers: { content: 'Internal use only' },
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('template-header-content')).toHaveValue('Board Confidential')
    );
    expect(screen.getByTestId('template-footer-content')).toHaveValue('Internal use only');
  });
});
