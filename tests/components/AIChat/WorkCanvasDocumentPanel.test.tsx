import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

describe('WorkCanvasDocumentPanel', () => {
  it('switches between document and Markdown views from the same source', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    expect(screen.getByTestId('canvas-document-view')).toHaveTextContent(
      'Company Work Note'
    );
    expect(screen.getByText('Canvas work area')).toBeInTheDocument();
    expect(screen.getByText('Markdown canonical')).toBeInTheDocument();
    expect(screen.getByText('Projection synced')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'MD' }));

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    expect(mdView.value).toContain('# Company Work Note');
    expect(mdView.value).not.toContain('{"');
  });

  it('renders GFM tables and checkboxes without raw Markdown bullets as the document UI', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    expect(screen.getByText('Define the business question.')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Zrób research/i }));

    expect(screen.getByRole('columnheader', { name: 'Dimension' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Definition' })).toBeInTheDocument();
    expect(screen.getByTestId('canvas-document-view')).not.toHaveTextContent('{"');
  });
});

