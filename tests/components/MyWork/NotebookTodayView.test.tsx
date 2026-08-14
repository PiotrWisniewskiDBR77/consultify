import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const v8Get = vi.fn();
vi.mock('@/services/api/v8/client', () => ({
  v8Get: (...a: any[]) => v8Get(...a),
}));

const i18nState = vi.hoisted(() => ({ language: 'en' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: i18nState,
    t: (k: string) =>
      ({
        'myWorkNotebook.todayView.today': i18nState.language === 'pl' ? 'Dziś' : 'Today',
        'myWorkNotebook.todayView.loadingToday': 'Loading Today…',
        'myWorkNotebook.todayView.refresh': 'Refresh',
        'myWorkNotebook.todayView.pinned': 'Pinned',
        'myWorkNotebook.todayView.recent': 'Recent',
        'myWorkNotebook.todayView.toReview': 'To review',
        'myWorkNotebook.todayView.freshCaptures': 'Fresh captures',
        'myWorkNotebook.todayView.pinnedEmpty': 'No pinned notes yet.',
        'myWorkNotebook.todayView.recentEmpty': 'No recent notes.',
        'myWorkNotebook.todayView.toReviewEmpty': 'Nothing waiting for review.',
        'myWorkNotebook.todayView.freshCapturesEmpty': 'No fresh captures.',
        'myWorkNotebook.todayView.loadFailedHint': 'Could not load the Today cockpit.',
      })[k] ?? k,
  }),
}));

import { NotebookTodayView } from '@/components/MyWork/notebook/NotebookTodayView';

const sample = {
  pinned: [{ id: 'a', title: 'Pinned note', pinned: true }],
  recent: [{ id: 'b', title: 'Recent note', updatedAt: '2026-06-19T10:00:00Z' }],
  toReview: [{ id: 'c', title: 'Disputed note', verificationStatus: 'disputed' }],
  freshCaptures: [{ id: 'd', title: 'Captured note', captureSource: 'quick' }],
};

describe('NotebookTodayView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = 'en';
    v8Get.mockResolvedValue(sample);
  });

  it('renders all four cockpit sections with their notes', async () => {
    render(<NotebookTodayView onOpenNote={vi.fn()} />);
    expect(await screen.findByText('Pinned note')).toBeInTheDocument();
    expect(screen.getByText('Recent note')).toBeInTheDocument();
    expect(screen.getByText('Disputed note')).toBeInTheDocument();
    expect(screen.getByText('Captured note')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('calls onOpenNote with the page id when a row is clicked', async () => {
    const onOpen = vi.fn();
    render(<NotebookTodayView onOpenNote={onOpen} />);
    fireEvent.click(await screen.findByText('Pinned note'));
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('shows empty hints when all sections are empty', async () => {
    v8Get.mockResolvedValueOnce({ pinned: [], recent: [], toReview: [], freshCaptures: [] });
    render(<NotebookTodayView onOpenNote={vi.fn()} />);
    expect(await screen.findByText('No pinned notes yet.')).toBeInTheDocument();
    expect(screen.getByText('Nothing waiting for review.')).toBeInTheDocument();
  });

  it('degrades to a non-blocking warning when the fetch fails', async () => {
    v8Get.mockRejectedValueOnce(new Error('boom'));
    render(<NotebookTodayView onOpenNote={vi.fn()} />);
    expect(await screen.findByText(/Could not load the Today cockpit/)).toBeInTheDocument();
  });

  it('refetches when the refreshKey prop changes', async () => {
    const { rerender } = render(<NotebookTodayView onOpenNote={vi.fn()} refreshKey={0} />);
    await screen.findByText('Pinned note');
    expect(v8Get).toHaveBeenCalledTimes(1);
    rerender(<NotebookTodayView onOpenNote={vi.fn()} refreshKey={1} />);
    await waitFor(() => expect(v8Get).toHaveBeenCalledTimes(2));
  });

  it('renders the capture slot above the sections', async () => {
    render(<NotebookTodayView onOpenNote={vi.fn()} captureSlot={<div>CAPTURE-SLOT</div>} />);
    expect(await screen.findByText('CAPTURE-SLOT')).toBeInTheDocument();
  });

  it('renders Polish heading when language is pl', async () => {
    i18nState.language = 'pl';
    render(<NotebookTodayView onOpenNote={vi.fn()} />);
    expect(await screen.findByText('Dziś')).toBeInTheDocument();
  });
});
