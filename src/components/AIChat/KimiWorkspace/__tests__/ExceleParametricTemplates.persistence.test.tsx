/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listWorkbookTemplates, getWorkbook, getWorkbookSchema } = vi.hoisted(() => ({
  listWorkbookTemplates: vi.fn(),
  getWorkbook: vi.fn(),
  getWorkbookSchema: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  API_URL: '/api',
  Api: {
    listWorkbookTemplates,
    getWorkbook,
    getWorkbookSchema,
    buildWorkbookTemplate: vi.fn(),
  },
}));

vi.mock('../EditableSpreadsheetGrid', () => ({
  EditableSpreadsheetGrid: ({ workbookId }: { workbookId: string }) => (
    <div data-testid="editable-workbook">{workbookId}</div>
  ),
}));

import { ExceleParametricTemplates } from '../ExceleParametricTemplates';

describe('ExceleParametricTemplates durable custom build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listWorkbookTemplates.mockResolvedValue({
      templates: [
        {
          id: 'template-42',
          name: 'Portfolio template',
          description: 'Four-sheet organization template',
          kind: 'custom',
          params: [],
        },
      ],
    });
    getWorkbook.mockResolvedValue({
      id: 'workbook-42',
      title: 'Portfolio Transformation Control',
      file_name: 'Portfolio_Transformation_Control.xlsx',
      downloadUrl: '/api/workbook/workbook-42/download',
    });
    getWorkbookSchema.mockResolvedValue({
      id: 'workbook-42',
      title: 'Portfolio Transformation Control',
      sheets: ['Portfolio', 'Milestones', 'Summary', 'Info'].map((name) => ({
        name,
        columns: [{ key: 'A', header: 'A' }],
        rows: [{ cells: { A: { value: name } } }],
      })),
    });
  });

  it('reopens the persisted id after reload with all sheets and exact export URL', async () => {
    render(
      <ExceleParametricTemplates
        isPolish={false}
        initialTemplateId="template-42"
        initialWorkbookId="workbook-42"
      />
    );

    await waitFor(() => expect(getWorkbook).toHaveBeenCalledWith('workbook-42'));
    expect(getWorkbookSchema).toHaveBeenCalledWith('workbook-42');
    expect(await screen.findByText(/Ready: Portfolio Transformation Control/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Portfolio_Transformation_Control.xlsx/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in Sheets/ })).toHaveAttribute(
      'href',
      '/excele?artifactId=workbook-42'
    );
    expect(screen.getByTestId('editable-workbook')).toHaveTextContent('workbook-42');
    expect(screen.getByRole('button', { name: 'Portfolio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Milestones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Info' })).toBeInTheDocument();
  });
});
