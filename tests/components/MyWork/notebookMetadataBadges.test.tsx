import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { NotebookMetadataBadges } from '@/components/MyWork/notebook/NotebookMetadataBadges';

describe('NotebookMetadataBadges', () => {
  it('renders upload provenance and converted output summary together', () => {
    render(
      <NotebookMetadataBadges
        captureSource="upload"
        captureMetadata={{
          fileOriginalname: 'customer-discovery.xlsx',
          fileMimetype: 'application/vnd.ms-excel',
        }}
        convertedTo={[
          { type: 'report', id: 'report-1' },
          { type: 'presentation', id: 'deck-1' },
          { type: 'assessment', id: 'assessment-1' },
        ]}
        isPolish={false}
      />
    );

    expect(screen.getByText('File: customer-discovery.xlsx')).toBeInTheDocument();
    expect(screen.getByText('report, presentation +1')).toBeInTheDocument();
  });

  it('renders nothing when notebook metadata is absent', () => {
    const { container } = render(<NotebookMetadataBadges isPolish={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
