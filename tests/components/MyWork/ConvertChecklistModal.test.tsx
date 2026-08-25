import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

// ConvertChecklistModal.tsx calls t('myWorkNotebook.convertChecklistModal.selected', {...})
// etc. with NO inline fallback (relies on public/locales/en/translation.json). A `t: (k) => k`
// identity mock returns the raw key, so text assertions against real product copy ("2 / 2
// selected", "Create 2 tasks", ...) never matched. Resolve real English copy with {{var}}
// interpolation instead (same pattern as IdeaExportMenu.test.tsx).
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

const createPersonalTask = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { createPersonalTask: (...a: any[]) => createPersonalTask(...a) },
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const i18nState = vi.hoisted(() => ({ language: 'en' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState, t: (k: string, opts?: Record<string, unknown>) => resolveTranslation(k, opts) }),
}));

import { ConvertChecklistModal } from '@/components/MyWork/notebook/ConvertChecklistModal';

const taskDoc = {
  type: 'doc',
  content: [
    { type: 'taskList', content: [
      { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Call supplier' }] }] },
      { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft proposal' }] }] },
    ] },
  ],
};

const baseProps = {
  open: true,
  onClose: vi.fn(),
  contentJson: taskDoc,
  noteId: 'note-1',
  noteTitle: 'Sprint plan',
};

describe('ConvertChecklistModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = 'en';
    createPersonalTask.mockResolvedValue({ id: 'task-x' });
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ConvertChecklistModal {...baseProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('extracts checklist items from the note content', () => {
    render(<ConvertChecklistModal {...baseProps} />);
    expect(screen.getByText('Call supplier')).toBeInTheDocument();
    expect(screen.getByText('Draft proposal')).toBeInTheDocument();
    expect(screen.getByText('2 / 2 selected')).toBeInTheDocument();
  });

  it('shows an empty message when there are no task items', () => {
    render(<ConvertChecklistModal {...baseProps} contentJson={{ type: 'doc', content: [] }} />);
    expect(screen.getByText('No checklist items found in note.')).toBeInTheDocument();
  });

  it('creates one personal task per selected item', async () => {
    const onConverted = vi.fn();
    createPersonalTask.mockResolvedValueOnce({ id: 't1' }).mockResolvedValueOnce({ id: 't2' });
    render(<ConvertChecklistModal {...baseProps} onConverted={onConverted} />);
    fireEvent.click(screen.getByText('Create 2 tasks'));
    await waitFor(() => expect(createPersonalTask).toHaveBeenCalledTimes(2));
    expect(createPersonalTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Call supplier', tags: ['from-notebook'] })
    );
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(['t1', 't2']));
  });

  it('deselecting an item reduces the create count', () => {
    render(<ConvertChecklistModal {...baseProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText('1 / 2 selected')).toBeInTheDocument();
    expect(screen.getByText('Create 1 task')).toBeInTheDocument();
  });

  it('toggle-all deselects everything then the create button is disabled', () => {
    render(<ConvertChecklistModal {...baseProps} />);
    fireEvent.click(screen.getByText('Deselect all'));
    expect(screen.getByText('0 / 2 selected')).toBeInTheDocument();
    expect(screen.getByText('Create 0 tasks').closest('button')).toBeDisabled();
  });
});
