import { fireEvent, render, screen, within } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookRightRail } from '../NotebookRightRail';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
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

// DEC-2026-08-25-69: the rail no longer implements Work/Context as an
// exclusive tablist ("prawe menu rozwijane pochodzi z wersji aplikacji
// sprzed pół roku") — it is a SPEC-A accordion (ArtifactRightPanel canon,
// Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §9.1a/§11.2) with five
// sections in a fixed order: Akcje · Właściwości · Powiązania · Komentarze ·
// Historia i AI. Governance content that used to live under the "Work" tab
// now lives under "Właściwości"; "Context" relations now live under
// "Powiązania". Both can be open at once.
describe('NotebookRightRail — SPEC-A accordion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the five canonical sections in the fixed order', () => {
    render(<Harness />);
    const headers = screen
      .getAllByRole('button')
      .map((btn) => btn.textContent?.replace(/\s+/g, ' ').trim())
      .filter((text): text is string => !!text);
    // Every section header renders regardless of collapsed state.
    const known = ['Akcje', 'Właściwości', 'Powiązania', 'Komentarze', 'Historia i AI'];
    const seen = known.filter((label) => headers.some((h) => h?.startsWith(label)));
    expect(seen).toEqual(known);
  });

  it('shows governance fields under Właściwości without a separate tab click', () => {
    render(<Harness />);
    expect(screen.getByText('Verification')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Verification' })).toHaveValue('verified');
    expect(screen.getByText('Alex Owner')).toBeInTheDocument();
    expect(screen.getByText(/Source: upload/)).toBeInTheDocument();
    expect(screen.getByText(/Keep current through the next review/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Private' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows Powiązania (Context) content open by default alongside Właściwości', () => {
    render(<Harness />);
    expect(screen.getByText('Context content')).toBeInTheDocument();
  });

  it('collapses and re-expands a section on header click', () => {
    render(<Harness />);
    const header = screen.getByRole('button', { name: /Komentarze/ });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Brak komentarzy do tego dokumentu.')).toBeInTheDocument();
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the rail via the header close button', () => {
    const onClose = vi.fn();
    render(
      <NotebookRightRail
        open
        activeTab="work"
        onTabChange={vi.fn()}
        onClose={onClose}
        activePage={activePage}
        allPages={[activePage]}
        editor={null}
        noteTitle="Decision note"
        noteContent=""
        noteTags={[]}
        notePage={undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('wires Akcje (Export/Share/Version history) to the same handlers as the kebab registry', () => {
    const onExport = vi.fn();
    const onShare = vi.fn();
    const onToggleVersionHistory = vi.fn();
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
        onExport={onExport}
        onShare={onShare}
        onToggleVersionHistory={onToggleVersionHistory}
      />
    );
    const actionsSection = screen.getByRole('button', { name: /^Akcje/ }).closest('section')!;
    fireEvent.click(within(actionsSection).getByText('Eksportuj'));
    fireEvent.click(within(actionsSection).getByText('Udostępnij'));
    fireEvent.click(within(actionsSection).getByText('Historia wersji'));
    expect(onExport).toHaveBeenCalledOnce();
    expect(onShare).toHaveBeenCalledOnce();
    expect(onToggleVersionHistory).toHaveBeenCalledOnce();
  });

  it('disables Kopiuj link with an explicit reason instead of a dead click handler', () => {
    render(<Harness />);
    const button = screen.getByText('Kopiuj link').closest('button')!;
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Akcja czeka na definicję zakresu');
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

  it('keeps conflict resolution in the governance section without discarding local work', () => {
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
