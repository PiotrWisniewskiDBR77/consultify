import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const i18nState = vi.hoisted(() => ({
  language: 'en',
  t: (key: string) =>
    ({
      'myWorkNotebook.topicChips.topic': 'Topic',
      'myWorkNotebook.topicChips.newTopicPlaceholder': 'New topic…',
      'myWorkNotebook.topicChips.unpin': 'Unpin',
    })[key] || key,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState, t: i18nState.t }),
}));

import { NotebookTopicChips } from '@/components/MyWork/notebook/NotebookTopicChips';

const topics = [
  { id: 't1', name: 'Pricing', slug: 'pricing', source: 'ai' },
  { id: 't2', name: 'Logistics', slug: 'logistics', source: 'manual' },
];

describe('NotebookTopicChips', () => {
  beforeEach(() => {
    v8Get.mockReset();
    v8Post.mockReset();
    v8Delete.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
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
