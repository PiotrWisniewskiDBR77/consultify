import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const exportNotebookPage = vi.fn().mockResolvedValue(undefined);
vi.mock('@/utils/notebookExport', () => ({
  exportNotebookPage: (...a: any[]) => exportNotebookPage(...a),
}));

import { NotebookExportMenu } from '@/components/MyWork/notebook/NotebookExportMenu';

const page = { id: 'p1', title: 'My note', contentText: 'body', contentJson: null };

describe('NotebookExportMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportNotebookPage.mockResolvedValue(undefined);
  });

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

  it('keeps a failed export visible and retries the same format', async () => {
    exportNotebookPage.mockRejectedValueOnce(new Error('disk unavailable'));
    render(<NotebookExportMenu page={page} />);
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('PDF (.pdf)'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Export failed. Your note was not changed.'
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(exportNotebookPage).toHaveBeenCalledTimes(2));
    expect(exportNotebookPage).toHaveBeenLastCalledWith(page, 'pdf');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('locks duplicate export activation before React can rerender busy state', async () => {
    let resolveExport: (() => void) | undefined;
    exportNotebookPage.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveExport = resolve))
    );
    render(<NotebookExportMenu page={page} />);
    fireEvent.click(screen.getByText('Export'));
    const pdf = screen.getByText('PDF (.pdf)');
    fireEvent.click(pdf);
    fireEvent.click(pdf);

    expect(exportNotebookPage).toHaveBeenCalledTimes(1);
    resolveExport?.();
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('closes on Escape', () => {
    render(<NotebookExportMenu page={page} />);
    fireEvent.click(screen.getByText('Export'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves focus through the real menu and restores it on Escape', async () => {
    const user = userEvent.setup();
    render(<NotebookExportMenu page={page} />);
    const trigger = screen.getByRole('button', { name: 'Export' });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Markdown (.md)' })).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'PDF (.pdf)' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: /Word/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
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
