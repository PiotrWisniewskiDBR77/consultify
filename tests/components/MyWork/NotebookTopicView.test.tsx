import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

// NotebookTopicView.tsx calls t() with real translation keys and NO inline fallback (relies
// on public/locales/en/translation.json). A `t: (k) => k` identity mock returns the raw key,
// so text/label assertions against real product copy ("Notes", "Close", "Retry", ...) never
// matched. Resolve real English copy instead (same pattern as IdeaExportMenu.test.tsx).
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

const v8Get = vi.fn();
vi.mock('@/services/api/v8/client', () => ({
  v8Get: (...a: any[]) => v8Get(...a),
}));

const i18nState = vi.hoisted(() => ({ language: 'en' }));
// Keep `t` a stable function identity across renders (react-i18next's real `t` is stable).
// A freshly-created arrow per useTranslation() call breaks components that put `t` in a
// useCallback/useEffect dependency array (see tests/setup.ts note on this exact trap) —
// the effect would re-fire every render and refetch data, masking mocked one-shot responses.
const t = (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState, t }),
}));

import { NotebookTopicView } from '@/components/MyWork/notebook/NotebookTopicView';

const aggregate = {
  topic: { id: 't1', name: 'Pricing strategy', slug: 'pricing-strategy' },
  notes: [
    { id: 'n1', title: 'Discount model', updatedAt: '2026-06-18T00:00:00Z', score: 1, source: 'manual' },
  ],
  outputs: [{ type: 'report', id: 'r1', bucket: 'output' }],
  initiatives: [{ type: 'initiative', id: 'i1', bucket: 'initiative' }],
  counts: { notes: 1, outputs: 1, initiatives: 1 },
  lastActiveAt: '2026-06-19T00:00:00Z',
};

describe('NotebookTopicView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = 'en';
    v8Get.mockResolvedValue(aggregate);
  });

  it('renders the topic name, counts and sections', async () => {
    render(<NotebookTopicView topicId="t1" />);
    expect(await screen.findByText('Pricing strategy')).toBeInTheDocument();
    expect(screen.getByText('Discount model')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Linked outputs')).toBeInTheDocument();
    expect(screen.getByText('Linked initiatives')).toBeInTheDocument();
    expect(v8Get).toHaveBeenCalledWith('/notebook/topics/t1');
  });

  it('opens a note via onOpenNote when a note row is clicked', async () => {
    const onOpenNote = vi.fn();
    render(<NotebookTopicView topicId="t1" onOpenNote={onOpenNote} />);
    fireEvent.click(await screen.findByText('Discount model'));
    expect(onOpenNote).toHaveBeenCalledWith('n1');
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(<NotebookTopicView topicId="t1" onClose={onClose} />);
    await screen.findByText('Pricing strategy');
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error with retry when the fetch fails, and retries', async () => {
    v8Get.mockRejectedValueOnce(new Error('Failed to load topic'));
    render(<NotebookTopicView topicId="t1" />);
    expect(await screen.findByText('Failed to load topic')).toBeInTheDocument();
    v8Get.mockResolvedValueOnce(aggregate);
    fireEvent.click(screen.getByText('Retry'));
    expect(await screen.findByText('Pricing strategy')).toBeInTheDocument();
  });

  it('renders empty hints for sections with no items', async () => {
    v8Get.mockResolvedValueOnce({
      ...aggregate,
      notes: [],
      outputs: [],
      initiatives: [],
      counts: { notes: 0, outputs: 0, initiatives: 0 },
    });
    render(<NotebookTopicView topicId="t1" />);
    expect(await screen.findByText('No pinned notes')).toBeInTheDocument();
    expect(screen.getByText('No linked outputs')).toBeInTheDocument();
    expect(screen.getByText('No linked initiatives')).toBeInTheDocument();
  });
});
