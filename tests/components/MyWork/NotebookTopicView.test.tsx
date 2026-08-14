import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const v8Get = vi.fn();
vi.mock('@/services/api/v8/client', () => ({
  v8Get: (...a: any[]) => v8Get(...a),
}));

const i18nState = vi.hoisted(() => ({
  language: 'en',
  t: (key: string) =>
    ({
      'myWorkNotebook.topicView.close': 'Close',
      'myWorkNotebook.topicView.retry': 'Retry',
      'myWorkNotebook.topicView.notesSection': 'Notes',
      'myWorkNotebook.topicView.linkedOutputs': 'Linked outputs',
      'myWorkNotebook.topicView.linkedInitiatives': 'Linked initiatives',
      'myWorkNotebook.topicView.noPinnedNotes': 'No pinned notes',
      'myWorkNotebook.topicView.noLinkedOutputs': 'No linked outputs',
      'myWorkNotebook.topicView.noLinkedInitiatives': 'No linked initiatives',
    })[key] || key,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: i18nState,
    t: i18nState.t,
  }),
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
    v8Get.mockReset();
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
