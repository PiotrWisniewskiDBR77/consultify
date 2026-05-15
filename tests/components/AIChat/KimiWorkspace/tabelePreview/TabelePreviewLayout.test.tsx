/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import type { ArtifactPreview } from '../../../../../src/components/AIChat/KimiWorkspace/KimiWorkspaceShell';
import TabelePreviewLayout from '../../../../../src/components/AIChat/KimiWorkspace/tabelePreview/TabelePreviewLayout';

const preview: ArtifactPreview & { type: 'tabele' } = {
  type: 'tabele',
  title: 'Vendor Master Data',
  summary: 'Governed operational table for vendors.',
  tableId: 'table-1',
  tableData: {
    columns: ['Vendor', 'Status', 'Owner'],
    rows: [
      { Vendor: 'Northwind', Status: 'Approved', Owner: 'Ops' },
      { Vendor: 'Contoso', Status: 'Pending', Owner: 'Legal' },
    ],
  },
  tabeleSchemaFields: [
    { fieldId: 'f1', name: 'vendor_name', fieldType: 'text', governanceState: 'committed' },
    { fieldId: 'f2', name: 'status', fieldType: 'select', governanceState: 'proposed' },
    { fieldId: 'f3', name: 'owner', fieldType: 'text', governanceState: 'committed' },
    { fieldId: 'f4', name: 'contract', fieldType: 'relation', governanceState: 'committed' },
  ],
  tabeleRelations: [
    {
      fieldId: 'f4',
      fieldName: 'contract',
      targetTableId: 'contracts',
      targetTableName: 'Contracts',
      targetCount: 12,
    },
  ],
  tabeleRationale: {
    summary: 'AI selected vendor governance fields from source records.',
    bullets: ['Vendor identity is required', 'Contract relation supports auditability'],
    citedSourceIds: ['src-1', 'src-2'],
    proposalStatus: 'pending',
  },
};

describe('TabelePreviewLayout', () => {
  it('renders a Word-style document canvas with all required sections', () => {
    render(<TabelePreviewLayout preview={preview} isPolish={false} />);

    expect(screen.getByRole('heading', { level: 1, name: /Vendor Master Data/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Schema/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Records/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Relations/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /AI Rationale/i })).toBeInTheDocument();

    expect(screen.getByText('Northwind')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /contract/i })).toBeInTheDocument();
    expect(screen.getByText(/AI selected vendor governance fields/i)).toBeInTheDocument();
  });

  it('auto-collapses compact schema and empty relations', () => {
    render(
      <TabelePreviewLayout
        preview={{
          ...preview,
          tabeleSchemaFields: preview.tabeleSchemaFields?.slice(0, 3),
          tabeleRelations: [],
        }}
        isPolish={false}
      />
    );

    expect(screen.getByText(/Schema is collapsed for compact review/i)).toBeInTheDocument();
    expect(screen.getByText(/Relations are collapsed because no relations are available/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Expand/i })[0]);
    expect(screen.getByText('vendor_name')).toBeInTheDocument();
  });
});
