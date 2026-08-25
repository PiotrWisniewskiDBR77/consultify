import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

// NotebookTopicChips.tsx calls t() with real translation keys and NO inline fallback (relies
// on public/locales/en/translation.json). A `t: (k) => k` identity mock returns the raw key,
// so text/label assertions against real product copy ("Topic", "Unpin", ...) never matched.
// Resolve real English copy instead (same pattern as IdeaExportMenu.test.tsx).
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
const v8Post = vi.fn();
const v8Delete = vi.fn();
vi.mock('@/services/api/v8/client', () => ({
  v8Get: (...a: any[]) => v8Get(...a),
  v8Post: (...a: any[]) => v8Post(...a),
  v8Delete: (...a: any[]) => v8Delete(...a),
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

import { NotebookTopicChips } from '@/components/MyWork/notebook/NotebookTopicChips';

const topics = [
  { id: 't1', name: 'Pricing', slug: 'pricing', source: 'ai' },
  { id: 't2', name: 'Logistics', slug: 'logistics', source: 'manual' },
];

describe('NotebookTopicChips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = 'en';
    v8Get.mockResolvedValue(topics);
  });

  it('loads and renders pinned topic chips', async () => {
    render(<NotebookTopicChips noteId="p1" />);
    expect(await screen.findByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Logistics')).toBeInTheDocument();
    expect(v8Get).toHaveBeenCalledWith('/notebook/pages/p1/topics');
  });

  it('opens the topic aggregate via onOpenTopic on chip click', async () => {
    const onOpenTopic = vi.fn();
    render(<NotebookTopicChips noteId="p1" onOpenTopic={onOpenTopic} />);
    fireEvent.click(await screen.findByText('Pricing'));
    expect(onOpenTopic).toHaveBeenCalledWith('t1');
  });

  it('renders nothing when read-only and there are no topics', async () => {
    v8Get.mockResolvedValueOnce([]);
    const { container } = render(<NotebookTopicChips noteId="p1" canEdit={false} />);
    await waitFor(() => expect(v8Get).toHaveBeenCalled());
    expect(container.querySelector('button')).toBeNull();
  });

  it('pins a new topic when canEdit', async () => {
    v8Get.mockResolvedValueOnce([]);
    v8Post.mockResolvedValueOnce({ topic: { id: 't9', name: 'New topic', slug: 'new-topic' } });
    render(<NotebookTopicChips noteId="p1" canEdit />);
    fireEvent.click(await screen.findByText('Topic'));
    const input = await screen.findByPlaceholderText('New topic…');
    fireEvent.change(input, { target: { value: 'New topic' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(v8Post).toHaveBeenCalledWith('/notebook/pages/p1/topics', {
        topicName: 'New topic',
        source: 'manual',
      })
    );
    expect(await screen.findByText('New topic')).toBeInTheDocument();
  });

  it('removes a topic optimistically when canEdit', async () => {
    v8Delete.mockResolvedValueOnce({});
    render(<NotebookTopicChips noteId="p1" canEdit />);
    await screen.findByText('Pricing');
    fireEvent.click(screen.getAllByLabelText('Unpin')[0]);
    await waitFor(() => expect(v8Delete).toHaveBeenCalledWith('/notebook/pages/p1/topics/t1'));
  });

  it('rolls back and toasts when unpin fails', async () => {
    v8Delete.mockRejectedValueOnce(new Error('fail'));
    render(<NotebookTopicChips noteId="p1" canEdit />);
    await screen.findByText('Pricing');
    fireEvent.click(screen.getAllByLabelText('Unpin')[0]);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByText('Pricing')).toBeInTheDocument();
  });
});
