/**
 * SWOTInputExplorationPhase — M12 (FALA 1, 2026-08-25).
 *
 * Owner complaint (R12 / XMOD-MENU-AC-005, tools-uwagi-komplet.md): removing
 * an ALREADY-ACCEPTED point from the "Input & Exploration" phase fired
 * `removeSWOTSignal(signal.id)` directly from the trash-icon button's
 * onClick — no confirmation, no undo, one click and it's gone. This test
 * proves the fix: the click now opens a proportional confirm dialog
 * (canonical `ConfirmModal`, same pattern as `RaidCanvas`'s
 * `pendingDeleteItem` / RB-038) and the signal is removed from the store
 * ONLY after the user confirms — Cancel (or closing the dialog) leaves it
 * untouched.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useToolStore } from '@/store/useToolStore';

import { SWOTInputExplorationPhase } from '../SWOTInputExplorationPhase';

function Harness() {
  const session = useToolStore((state) => state.currentSession);
  return session ? <SWOTInputExplorationPhase session={session} isPolish={false} /> : null;
}

function addAcceptedSignal(sourceLabel: string) {
  useToolStore.getState().addSWOTSignal({
    type: 'interview',
    sourceLabel,
    content: `${sourceLabel} — supporting detail`,
    tags: ['strengths', 'input-proposal'],
    state: 'accepted',
    proposalStatus: 'accepted',
  });
}

describe('SWOTInputExplorationPhase — accepted-point removal requires confirmation (M12)', () => {
  beforeEach(() => {
    useToolStore.setState({ currentSession: null, currentStep: 1, savedSessions: [] });
    useToolStore.getState().createSession('dynamic-swot');
  });

  it('does not remove the signal on the first click — a confirm dialog opens instead', () => {
    addAcceptedSignal('Loyal enterprise customer base');
    render(<Harness />);

    expect(screen.getByText('Loyal enterprise customer base')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'discoveryToolsTools.common.remove' }));

    // Still present — the click only staged the deletion, did not perform it.
    expect(screen.getByText('Loyal enterprise customer base')).toBeInTheDocument();
    expect(
      (useToolStore.getState().currentSession!.inputData as any).signals
    ).toHaveLength(1);

    // A real confirm surface is up.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('Cancel leaves the accepted signal untouched', async () => {
    addAcceptedSignal('Loyal enterprise customer base');
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'discoveryToolsTools.common.remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // ConfirmModal exits via a framer-motion AnimatePresence transition, so
    // removal from the DOM is asynchronous even though the store update
    // (or lack thereof, here) is synchronous.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Loyal enterprise customer base')).toBeInTheDocument();
    expect(
      (useToolStore.getState().currentSession!.inputData as any).signals
    ).toHaveLength(1);
  });

  it('confirming Remove actually deletes the accepted signal from the store', async () => {
    addAcceptedSignal('Loyal enterprise customer base');
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'discoveryToolsTools.common.remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(
        (useToolStore.getState().currentSession!.inputData as any).signals
      ).toHaveLength(0)
    );
    expect(screen.queryByText('Loyal enterprise customer base')).not.toBeInTheDocument();
  });
});
