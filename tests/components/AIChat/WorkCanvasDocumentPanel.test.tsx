import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

describe('WorkCanvasDocumentPanel', () => {
  it('switches between document and Markdown views from the same source', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    expect(screen.getByTestId('canvas-document-view')).toHaveTextContent(
      'Start a company work note'
    );
    expect(screen.getByText('Markdown canonical')).toBeInTheDocument();
    expect(screen.getByText('Projection synced')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'MD' }));

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    expect(mdView.value).toContain('# Start a company work note');
    expect(mdView.value).not.toContain('{"');
  });
});

