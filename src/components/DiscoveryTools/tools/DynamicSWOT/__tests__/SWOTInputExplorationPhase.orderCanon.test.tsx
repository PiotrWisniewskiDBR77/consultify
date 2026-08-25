/**
 * SWOTInputExplorationPhase — M11 (FALA 1, 2026-08-25).
 *
 * Owner complaint (R9, tools-uwagi-komplet.md): "Current AI Proposal" is
 * meant to be the lead component of the stage — directly under the S/W/O/T
 * tabs — with the quadrant's own identity chrome (title/subtitle + "1/4"
 * badge, and the accepted/confirmed count chips) coming AFTER it. The
 * proposal card already carried an explicit `order-1` Tailwind class, but
 * the identity header above it had no `order` class at all — which defaults
 * to flex `order: 0`, so it kept rendering ABOVE the proposal regardless.
 *
 * This test locks the fix in place structurally: both header blocks now
 * carry an explicit `order-2` (i.e. a value greater than the proposal's
 * `order-1`), so a CSS engine lays the proposal out first.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useToolStore } from '@/store/useToolStore';

import { SWOTInputExplorationPhase } from '../SWOTInputExplorationPhase';

function Harness() {
  const session = useToolStore((state) => state.currentSession);
  return session ? <SWOTInputExplorationPhase session={session} isPolish={false} /> : null;
}

describe('SWOTInputExplorationPhase — quadrant header renders after the AI proposal (M11)', () => {
  beforeEach(() => {
    useToolStore.setState({ currentSession: null, currentStep: 1, savedSessions: [] });
    useToolStore.getState().createSession('dynamic-swot');
  });

  it('gives the quadrant identity header block an order class greater than the proposal card', () => {
    render(<Harness />);

    // "Internal advantages" (the Strengths subtitle) is unique — unlike
    // "Strengths" itself, which also labels the S/W/O/T tab button.
    const subtitle = screen.getByText('Internal advantages');
    const headerRow = subtitle.closest('.order-2');
    expect(headerRow).not.toBeNull();
    expect(headerRow?.className).toMatch(/\border-2\b/);

    const badge = screen.getByText('1/4');
    expect(badge.closest('.order-2')).not.toBeNull();

    const proposalHeading = screen.getByText(
      'discoveryToolsTools.dynamicSwot.inputExplorationPhase.aiProposal'
    );
    const proposalCard = proposalHeading.closest('.order-1');
    expect(proposalCard).not.toBeNull();
    expect(proposalCard?.className).toMatch(/\border-1\b/);
  });
});
