import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookRightRail } from '../NotebookRightRail';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('../AIChatInlinePanel', () => ({
  AIChatInlinePanel: () => <div>Work content</div>,
}));

vi.mock('../NotebookContextPanel', () => ({
  NotebookContextPanel: () => <div>Context content</div>,
}));

const activePage = {
  id: 'page-1',
  title: 'Decision note',
  content: '',
  tags: [],
  convertedTo: [],
  status: 'active',
  maturity: 'growing',
  visibility: 'private',
  ownerUserId: 'owner-1',
  verificationStatus: 'verified',
  reviewCadence: 'monthly',
  captureSource: 'upload',
  captureMetadata: { sourceType: 'meeting', sourceId: 'meeting-1' },
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
} as any;

function Harness() {
  const [activeTab, setActiveTab] = useState<'work' | 'context'>('work');
  return (
    <NotebookRightRail
      open
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={vi.fn()}
      ownerLabel="Alex Owner"
      activePage={activePage}
      allPages={[activePage]}
      editor={null}
      noteTitle="Decision note"
      noteContent=""
      noteTags={[]}
      notePage={undefined}
    />
  );
}

describe('NotebookRightRail keyboard behavior', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses roving tab focus and Arrow keys to activate the adjacent panel', () => {
    render(<Harness />);
    const work = screen.getByRole('tab', { name: 'Work' });
    const context = screen.getByRole('tab', { name: 'Context' });

    expect(work).toHaveAttribute('tabindex', '0');
    expect(context).toHaveAttribute('tabindex', '-1');
    work.focus();
    fireEvent.keyDown(work, { key: 'ArrowRight' });

    expect(context).toHaveFocus();
    expect(context).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Context' })).not.toHaveClass('hidden');
  });

  it('uses Work as a document record instead of a second AI tools panel', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Document record' })).toBeInTheDocument();
    expect(screen.getByText('Verification')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Verification' })).toHaveValue('verified');
    expect(screen.getByText('Alex Owner')).toBeInTheDocument();
    expect(screen.getByText(/Source: upload/)).toBeInTheDocument();
    expect(screen.getByText(/Keep current through the next review/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Private' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Work content')).not.toBeInTheDocument();
  });

  it('supports Home and End without moving focus outside the tablist', () => {
    render(<Harness />);
    const work = screen.getByRole('tab', { name: 'Work' });
    const context = screen.getByRole('tab', { name: 'Context' });

    fireEvent.keyDown(work, { key: 'End' });
    expect(context).toHaveFocus();
    fireEvent.keyDown(context, { key: 'Home' });
    expect(work).toHaveFocus();
    expect(work).toHaveAttribute('aria-selected', 'true');
  });

  it('owns editable governance controls and exposes a truthful failed-save retry', () => {
    const setVerification = vi.fn();
    const setCadence = vi.fn();
    const markReviewed = vi.fn();
    const retrySave = vi.fn();
    render(
      <NotebookRightRail
        open
        activeTab="work"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        ownerLabel="Alex Owner"
        activePage={activePage}
        allPages={[activePage]}
        editor={null}
        noteTitle="Decision note"
        noteContent=""
        noteTags={[]}
        notePage={undefined}
        saveState="error"
        onRetrySave={retrySave}
        onSetVerificationStatus={setVerification}
        onSetReviewCadence={setCadence}
        onMarkReviewed={markReviewed}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Save failed — changes remain local');
    fireEvent.change(screen.getByRole('combobox', { name: 'Verification' }), {
      target: { value: 'disputed' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Review cadence' }), {
      target: { value: 'quarterly' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(setVerification).toHaveBeenCalledWith('disputed');
    expect(setCadence).toHaveBeenCalledWith('quarterly');
    expect(markReviewed).toHaveBeenCalledOnce();
    expect(retrySave).toHaveBeenCalledOnce();
  });

  it('keeps conflict resolution in the governance rail without discarding local work', () => {
    const loadTheirs = vi.fn();
    const keepMine = vi.fn();
    render(
      <NotebookRightRail
        open
        activeTab="work"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        activePage={activePage}
        allPages={[activePage]}
        editor={null}
        noteTitle="Decision note"
        noteContent="local unsaved text"
        noteTags={[]}
        notePage={undefined}
        saveState="conflict"
        onReloadConflict={loadTheirs}
        onKeepMineConflict={keepMine}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Changed elsewhere — your edits remain local'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Load theirs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(loadTheirs).toHaveBeenCalledOnce();
    expect(keepMine).toHaveBeenCalledOnce();
  });

  it('keeps unqualified governance mutations focusable, explained and fail closed', () => {
    const setVisibility = vi.fn();
    const retrySave = vi.fn();
    render(
      <NotebookRightRail
        open
        activeTab="work"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
        activePage={activePage}
        allPages={[activePage]}
        editor={null}
        noteTitle="Decision note"
        noteContent=""
        noteTags={[]}
        notePage={undefined}
        saveState="error"
        onRetrySave={retrySave}
        onSetVisibility={setVisibility}
        receiptCapableActionIds={[]}
      />
    );

    const retry = screen.getByRole('button', { name: 'Retry' });
    const privateAction = screen.getByRole('button', { name: 'Private' });
    expect(retry).toHaveAttribute('aria-disabled', 'true');
    expect(retry).toHaveAccessibleDescription(/durable action receipt/);
    expect(privateAction).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(retry);
    fireEvent.click(privateAction);
    expect(retrySave).not.toHaveBeenCalled();
    expect(setVisibility).not.toHaveBeenCalled();
  });
});
