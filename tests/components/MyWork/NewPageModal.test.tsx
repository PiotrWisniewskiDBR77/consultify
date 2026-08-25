import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';
import plTranslation from '../../../public/locales/pl/translation.json';

const uploadNotebookFile = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { uploadNotebookFile: (...a: any[]) => uploadNotebookFile(...a) },
}));

const i18nState = vi.hoisted(() => ({ language: 'en' }));

// NewPageModal.tsx calls t('myWorkNotebook.newPageModal.title') etc. with NO inline fallback
// (relies on public/locales/{en,pl}/translation.json). A `t: (k) => k` identity mock returns
// the raw key, so text assertions against real product copy ("New Note", "Nowa notatka", ...)
// never matched. Resolve real copy for the active test language instead (same pattern as
// IdeaExportMenu.test.tsx, extended for the pl-language test case in this file).
function resolveTranslation(key: string, options?: Record<string, unknown>): string {
  const dict = i18nState.language === 'pl' ? plTranslation : enTranslation;
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      dict
    );
  const template = typeof value === 'string' ? value : key;
  if (!options) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    Object.prototype.hasOwnProperty.call(options, name) ? String(options[name]) : `{{${name}}}`
  );
}

// Keep `t` a stable function identity across renders (react-i18next's real `t` is stable;
// see tests/setup.ts note on why a per-call arrow can break effect/callback deps).
const t = (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState, t }),
}));

import { NewPageModal } from '@/components/MyWork/notebook/NewPageModal';

describe('NewPageModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = 'en';
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <NewPageModal open={false} onClose={vi.fn()} onSelectTemplate={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the template grid when open', () => {
    render(<NewPageModal open onClose={vi.fn()} onSelectTemplate={vi.fn()} />);
    expect(screen.getByText('New Note')).toBeInTheDocument();
    expect(screen.getByText('Blank page')).toBeInTheDocument();
    expect(screen.getByText('Strategic Observation')).toBeInTheDocument();
    expect(screen.getByText('Risk Analysis')).toBeInTheDocument();
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
  });

  it('selects a static template and closes', () => {
    const onSelectTemplate = vi.fn();
    const onClose = vi.fn();
    render(<NewPageModal open onClose={onClose} onSelectTemplate={onSelectTemplate} />);
    fireEvent.click(screen.getByText('Blank page'));
    expect(onSelectTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 'blank' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<NewPageModal open onClose={onClose} onSelectTemplate={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the upload affordance only when onUploadComplete is provided', () => {
    const { rerender } = render(
      <NewPageModal open onClose={vi.fn()} onSelectTemplate={vi.fn()} />
    );
    expect(screen.queryByText(/Upload file/i)).not.toBeInTheDocument();
    rerender(
      <NewPageModal open onClose={vi.fn()} onSelectTemplate={vi.fn()} onUploadComplete={vi.fn()} />
    );
    expect(screen.getByText(/Upload file/i)).toBeInTheDocument();
  });

  it('uploads a file and forwards the created page', async () => {
    const onUploadComplete = vi.fn();
    const created = { id: 'page-1', title: 'Uploaded' };
    uploadNotebookFile.mockResolvedValueOnce(created);
    const { container } = render(
      <NewPageModal open onClose={vi.fn()} onSelectTemplate={vi.fn()} onUploadComplete={onUploadComplete} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'notes.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadNotebookFile).toHaveBeenCalledWith(file));
    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith(created));
  });

  it('renders Polish labels when language is pl', () => {
    i18nState.language = 'pl';
    render(<NewPageModal open onClose={vi.fn()} onSelectTemplate={vi.fn()} />);
    expect(screen.getByText('Nowa notatka')).toBeInTheDocument();
    expect(screen.getByText('Pusta strona')).toBeInTheDocument();
  });
});
