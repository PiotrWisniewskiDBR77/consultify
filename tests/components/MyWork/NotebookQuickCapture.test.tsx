import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

// NotebookQuickCapture.tsx calls t() with real translation keys and NO inline fallback
// (relies on public/locales/en/translation.json). A `t: (k) => k` identity mock returns the
// raw key, so text/placeholder assertions against real product copy never matched. Resolve
// real English copy instead (same pattern as IdeaExportMenu.test.tsx).
function resolveTranslation(key: string, options?: Record<string, unknown>): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      enTranslation
    );
  const template = typeof value === 'string' ? value : key;
  if (!options) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    Object.prototype.hasOwnProperty.call(options, name) ? String(options[name]) : `{{${name}}}`
  );
}

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
// Keep `t` a stable function identity across renders (react-i18next's real `t` is stable;
// see tests/setup.ts note on why a per-call arrow can break effect/callback deps).
const t = (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState, t }),
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
    fireEvent.change(screen.getByPlaceholderText('Drop a thought or a link…'), {
      target: { value: 'Call the supplier about Q2 pricing' },
    });
    fireEvent.click(screen.getByText('Capture'));

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
    fireEvent.change(screen.getByPlaceholderText('Drop a thought or a link…'), {
      target: { value: 'https://www.example.com/article/' },
    });
    fireEvent.click(screen.getByText('Capture'));
    await waitFor(() =>
      expect(createNotebookPage).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'example.com/article' })
      )
    );
  });

  it('submits on Enter (without shift)', async () => {
    render(<NotebookQuickCapture />);
    const input = screen.getByPlaceholderText('Drop a thought or a link…');
    fireEvent.change(input, { target: { value: 'quick thought' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(createNotebookPage).toHaveBeenCalled());
  });

  it('does nothing for empty input', () => {
    render(<NotebookQuickCapture />);
    fireEvent.click(screen.getByText('Capture'));
    expect(createNotebookPage).not.toHaveBeenCalled();
  });

  it('passes a notebookId through when provided', async () => {
    render(<NotebookQuickCapture notebookId="nb-7" />);
    fireEvent.change(screen.getByPlaceholderText('Drop a thought or a link…'), {
      target: { value: 'into nb-7' },
    });
    fireEvent.click(screen.getByText('Capture'));
    await waitFor(() =>
      expect(createNotebookPage).toHaveBeenCalledWith(expect.objectContaining({ notebookId: 'nb-7' }))
    );
  });

  it('toasts an error when the create fails', async () => {
    createNotebookPage.mockRejectedValueOnce(new Error('nope'));
    render(<NotebookQuickCapture />);
    fireEvent.change(screen.getByPlaceholderText('Drop a thought or a link…'), {
      target: { value: 'will fail' },
    });
    fireEvent.click(screen.getByText('Capture'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
