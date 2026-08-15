import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createNotebookPage = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { createNotebookPage: (...a: any[]) => createNotebookPage(...a) },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: (...a: any[]) => toastSuccess(...a), error: (...a: any[]) => toastError(...a) },
}));

const i18nState = vi.hoisted(() => ({ language: 'en' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState, t: (k: string) => k }),
}));

import { NotebookQuickCapture } from '@/components/MyWork/notebook/NotebookQuickCapture';

describe('NotebookQuickCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = 'en';
    createNotebookPage.mockResolvedValue({ id: 'new1', title: 'derived' });
  });

  it('creates a page with capture_source=quick from free text', async () => {
    const onCreated = vi.fn();
    render(<NotebookQuickCapture onCreated={onCreated} />);
    fireEvent.change(screen.getByPlaceholderText('myWorkNotebook.quickCapture.placeholder'), {
      target: { value: 'Call the supplier about Q2 pricing' },
    });
    fireEvent.click(screen.getByText('myWorkNotebook.quickCapture.capture'));

    await waitFor(() =>
      expect(createNotebookPage).toHaveBeenCalledWith(
        expect.objectContaining({
          captureSource: 'quick',
          visibility: 'private',
          title: 'Call the supplier about Q2 pricing',
        })
      )
    );
    expect(onCreated).toHaveBeenCalledWith({ id: 'new1', title: 'derived' });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('derives a hostname-based title from a URL', async () => {
    render(<NotebookQuickCapture />);
    fireEvent.change(screen.getByPlaceholderText('myWorkNotebook.quickCapture.placeholder'), {
      target: { value: 'https://www.example.com/article/' },
    });
    fireEvent.click(screen.getByText('myWorkNotebook.quickCapture.capture'));
    await waitFor(() =>
      expect(createNotebookPage).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'example.com/article' })
      )
    );
  });

  it('submits on Enter (without shift)', async () => {
    render(<NotebookQuickCapture />);
    const input = screen.getByPlaceholderText('myWorkNotebook.quickCapture.placeholder');
    fireEvent.change(input, { target: { value: 'quick thought' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(createNotebookPage).toHaveBeenCalled());
  });

  it('does nothing for empty input', () => {
    render(<NotebookQuickCapture />);
    fireEvent.click(screen.getByText('myWorkNotebook.quickCapture.capture'));
    expect(createNotebookPage).not.toHaveBeenCalled();
  });

  it('passes a notebookId through when provided', async () => {
    render(<NotebookQuickCapture notebookId="nb-7" />);
    fireEvent.change(screen.getByPlaceholderText('myWorkNotebook.quickCapture.placeholder'), {
      target: { value: 'into nb-7' },
    });
    fireEvent.click(screen.getByText('myWorkNotebook.quickCapture.capture'));
    await waitFor(() =>
      expect(createNotebookPage).toHaveBeenCalledWith(expect.objectContaining({ notebookId: 'nb-7' }))
    );
  });

  it('toasts an error when the create fails', async () => {
    createNotebookPage.mockRejectedValueOnce(new Error('nope'));
    render(<NotebookQuickCapture />);
    fireEvent.change(screen.getByPlaceholderText('myWorkNotebook.quickCapture.placeholder'), {
      target: { value: 'will fail' },
    });
    fireEvent.click(screen.getByText('myWorkNotebook.quickCapture.capture'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
