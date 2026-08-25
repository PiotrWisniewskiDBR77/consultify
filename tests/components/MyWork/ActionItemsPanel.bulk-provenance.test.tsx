/**
 * @vitest-environment jsdom
 *
 * Regression guard (FIX 3): the bulk "Create all" action in the notebook
 * ActionItemsPanel must stamp EVERY created task with notebook provenance
 * (sourceType:'notebook_page' + sourceId:noteId), not just single-create.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

import { ActionItemsPanel } from '../../../src/components/MyWork/notebook/ActionItemsPanel';

// ActionItemsPanel.tsx calls t('myWorkNotebook.actionItemsPanel.aiActions') etc. with NO
// inline fallback (relies on public/locales/en/translation.json). The previous mock omitted
// `t` entirely (`t is not a function`); resolve real English copy instead (same pattern as
// IdeaExportMenu.test.tsx).
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

const { apiMock, trackFunnelEventMock } = vi.hoisted(() => ({
  trackFunnelEventMock: vi.fn(),
  apiMock: {
    streamNotebookActionExtraction: vi.fn(),
    createPersonalTask: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options),
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

vi.mock('../../../src/services/api', () => ({
  Api: apiMock,
}));

const ACTION_ITEMS = [
  { title: 'Email the client', suggestedOwner: null, suggestedDue: null, priority: 'high' },
  { title: 'Draft the SOW', suggestedOwner: null, suggestedDue: null, priority: 'medium' },
  { title: 'Schedule kickoff', suggestedOwner: null, suggestedDue: null, priority: 'low' },
];

describe('ActionItemsPanel bulk-create provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.streamNotebookActionExtraction.mockImplementation(
      async (_noteId: string, opts: { onEvent: (e: any) => void }) => {
        opts.onEvent({ type: 'actions', items: ACTION_ITEMS });
        opts.onEvent({ type: 'done', count: ACTION_ITEMS.length });
      }
    );
    apiMock.createPersonalTask.mockResolvedValue({ id: 'task-x' });
  });

  it('stamps every bulk-created task with notebook_page provenance', async () => {
    render(
      <ActionItemsPanel
        open
        onClose={vi.fn()}
        noteId="note-77"
        noteTitle="Kickoff notes"
      />
    );

    // wait for extracted items to render
    await waitFor(() => expect(screen.getByText('Email the client')).toBeInTheDocument());

    const createAllBtn = screen.getByRole('button', { name: /Create all/i });
    fireEvent.click(createAllBtn);

    await waitFor(() =>
      expect(apiMock.createPersonalTask).toHaveBeenCalledTimes(ACTION_ITEMS.length)
    );

    // EVERY call (not just the first) must carry provenance
    for (const call of apiMock.createPersonalTask.mock.calls) {
      expect(call[0]).toMatchObject({
        sourceType: 'notebook_page',
        sourceId: 'note-77',
      });
    }

    // sanity: titles preserved across the loop
    const titles = apiMock.createPersonalTask.mock.calls.map((c) => c[0].title);
    expect(titles).toEqual(['Email the client', 'Draft the SOW', 'Schedule kickoff']);
  });
});
