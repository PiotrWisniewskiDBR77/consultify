import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const exportNotebookPage = vi.fn().mockResolvedValue(undefined);
vi.mock('@/utils/notebookExport', () => ({
  exportNotebookPage: (...a: any[]) => exportNotebookPage(...a),
}));

import { NotebookExportMenu } from '@/components/MyWork/notebook/NotebookExportMenu';

const page = { id: 'p1', title: 'My note', contentText: 'body', contentJson: null };

describe('NotebookExportMenu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is collapsed by default and shows the trigger label', () => {
    render(<NotebookExportMenu page={page} />);
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the menu with all three formats on click', () => {
    render(<NotebookExportMenu page={page} />);
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Markdown (.md)')).toBeInTheDocument();
    expect(screen.getByText('PDF (.pdf)')).toBeInTheDocument();
    expect(screen.getByText(/Word \(\.docx\)/)).toBeInTheDocument();
  });

  it('exports markdown when the markdown item is clicked', async () => {
    render(<NotebookExportMenu page={page} />);
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('Markdown (.md)'));
    await waitFor(() => expect(exportNotebookPage).toHaveBeenCalledWith(page, 'markdown'));
  });

  it('exports pdf when the pdf item is clicked', async () => {
    render(<NotebookExportMenu page={page} />);
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('PDF (.pdf)'));
    await waitFor(() => expect(exportNotebookPage).toHaveBeenCalledWith(page, 'pdf'));
  });

  it('closes on Escape', () => {
    render(<NotebookExportMenu page={page} />);
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders the trigger label via t() (language-driven, not isPolish prop)', () => {
    // i18n(M04): label moved from isPolish-ternary to t(); test env resolves EN defaultValue.
    render(<NotebookExportMenu page={page} isPolish />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('disables the trigger when disabled', () => {
    render(<NotebookExportMenu page={page} disabled />);
    expect(screen.getByText('Export').closest('button')).toBeDisabled();
  });
});
