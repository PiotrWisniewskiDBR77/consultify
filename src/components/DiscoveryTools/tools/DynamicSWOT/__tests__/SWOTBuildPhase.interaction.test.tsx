/**
 * SWOTBuildPhase — interaction regression tests.
 *
 * Context (F4 sprint, 2026-08-13): a browser E2E run reported that a
 * "nested-scroll canvas" defeated automation's coordinate-based `scroll`
 * gesture when trying to type into the SWOT quadrants (30s timeouts), and
 * that step was worked around with a direct authenticated HTTP PUT — not
 * acceptable as UI evidence.
 *
 * Live-browser investigation (own harness, own DB, real login, real
 * backend) found:
 *   - The quadrant inputs ARE reachable and typeable via real mouse clicks,
 *     keyboard Tab order, and Enter-to-submit — verified end to end
 *     including autosave -> full page reload -> identical state restored.
 *   - The "nested scroll" is real (NModeShell wraps this canvas with two
 *     extra ancestors that also declare `overflow-auto`/`overflow-y-auto`),
 *     but only ONE of the three is ever actually overflowing
 *     (scrollHeight > clientHeight); the other two are inert by
 *     measurement. Real browsers route wheel/keyboard scroll to the correct
 *     (innermost overflowing) ancestor automatically — this is standard
 *     platform behavior, not something the app implements. The failure was
 *     traced to the browser-automation harness's coordinate-based scroll
 *     simulation getting confused by the inert wrapper divs, not to a
 *     genuine trap for real users.
 *   - Gap found and fixed here: the live SWOT Build phase (`QuadrantCard`
 *     in SWOTBuildPhase.tsx) rendered NO impact selector at all, even
 *     though `SWOTItem.impact` and its i18n labels
 *     (`discoveryToolsTools.dynamicSwot.quadrantStep.*Impact`) already
 *     existed and are used by the disconnected legacy `SWOTQuadrantStep`.
 *     These tests guard the fix.
 *
 * These tests exercise the REAL zustand store (not a mock) through a thin
 * harness that mirrors how `ToolWorkspace` wires `session` from
 * `useToolStore().currentSession`, so add/update/remove actions round-trip
 * exactly like production.
 *
 * i18n note: `tests/setup.ts` mocks `react-i18next` so `t(key)` returns the
 * raw KEY, not the translated string (see that file's comment on avoiding
 * OOM from proxy allocation). Queries below match on those raw keys, same
 * convention as other DiscoveryTools tests in this repo.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useToolStore } from '@/store/useToolStore';

import { SWOTBuildPhase } from '../SWOTBuildPhase';

const KEYS = {
  addPointPlaceholder: 'discoveryToolsTools.dynamicSwot.buildPhase.addPointPlaceholder',
  swotPoint: 'discoveryToolsTools.dynamicSwot.buildPhase.swotPoint',
  accept: 'discoveryToolsTools.dynamicSwot.buildPhase.accept',
  reject: 'discoveryToolsTools.dynamicSwot.buildPhase.reject',
  highImpact: 'discoveryToolsTools.dynamicSwot.quadrantStep.highImpact',
  mediumImpact: 'discoveryToolsTools.dynamicSwot.quadrantStep.mediumImpact',
};

function Harness({ isPolish = false }: { isPolish?: boolean }) {
  const session = useToolStore((s) => s.currentSession);
  if (!session) return null;
  return <SWOTBuildPhase session={session} isPolish={isPolish} />;
}

function resetStore() {
  useToolStore.setState({ currentSession: null, currentStep: 1, savedSessions: [] });
  useToolStore.getState().createSession('dynamic-swot');
}

describe('SWOTBuildPhase — quadrant inputs are reachable and editable', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders all four quadrants with an "add point" input each', () => {
    render(<Harness />);
    const inputs = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);
    expect(inputs).toHaveLength(4);
    expect(screen.getByText('Strengths')).toBeInTheDocument();
    expect(screen.getByText('Weaknesses')).toBeInTheDocument();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Threats')).toBeInTheDocument();
  });

  it('adds an item to Strengths via keyboard Enter (no mouse needed)', () => {
    render(<Harness />);
    const [strengthsInput] = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);

    fireEvent.change(strengthsInput, { target: { value: 'Experienced delivery team' } });
    fireEvent.keyDown(strengthsInput, { key: 'Enter', code: 'Enter' });

    expect(screen.getByDisplayValue('Experienced delivery team')).toBeInTheDocument();
    // Input clears after a successful add.
    expect((strengthsInput as HTMLInputElement).value).toBe('');
  });

  it('adds an item via the mouse-driven "+" button', () => {
    render(<Harness />);
    const inputs = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);
    const weaknessesInput = inputs[1];
    const addButton = weaknessesInput.parentElement?.querySelector('button');
    expect(addButton).toBeTruthy();

    fireEvent.change(weaknessesInput, { target: { value: 'Slow implementation cycle' } });
    fireEvent.click(addButton as HTMLButtonElement);

    expect(screen.getByDisplayValue('Slow implementation cycle')).toBeInTheDocument();
  });

  it('places typed items in the correct quadrant, independently', () => {
    render(<Harness />);
    const [strengths, weaknesses, opportunities, threats] = screen.getAllByPlaceholderText(
      KEYS.addPointPlaceholder
    );

    (
      [
        [strengths, 'S item'],
        [weaknesses, 'W item'],
        [opportunities, 'O item'],
        [threats, 'T item'],
      ] as const
    ).forEach(([input, text]) => {
      fireEvent.change(input, { target: { value: text } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    const items = useToolStore.getState().currentSession?.inputData as any;
    const byQuadrant = (q: string) => items.items.filter((i: any) => i.quadrant === q);
    expect(byQuadrant('strengths').map((i: any) => i.text)).toEqual(['S item']);
    expect(byQuadrant('weaknesses').map((i: any) => i.text)).toEqual(['W item']);
    expect(byQuadrant('opportunities').map((i: any) => i.text)).toEqual(['O item']);
    expect(byQuadrant('threats').map((i: any) => i.text)).toEqual(['T item']);
  });

  it('deletes an item via the trash button', () => {
    render(<Harness />);
    const [strengthsInput] = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);
    fireEvent.change(strengthsInput, { target: { value: 'Temp item' } });
    fireEvent.keyDown(strengthsInput, { key: 'Enter', code: 'Enter' });
    expect(screen.getByDisplayValue('Temp item')).toBeInTheDocument();

    const cardLabel = screen.getByText(KEYS.swotPoint);
    // The label sits in a header row alongside the impact <select> and the
    // trash button — scope to that row and grab its one <button>.
    const headerRow = cardLabel.closest('div')?.parentElement as HTMLElement;
    const trashButton = within(headerRow).getAllByRole('button')[0];
    fireEvent.click(trashButton);

    expect(screen.queryByDisplayValue('Temp item')).not.toBeInTheDocument();
  });
});

describe('SWOTBuildPhase — impact classification (fixed gap)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('defaults a newly-added item to medium impact and exposes a selector to change it', () => {
    render(<Harness />);
    const [strengthsInput] = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);
    fireEvent.change(strengthsInput, { target: { value: 'Some strength' } });
    fireEvent.keyDown(strengthsInput, { key: 'Enter', code: 'Enter' });

    const select = screen.getByDisplayValue(KEYS.mediumImpact) as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'high' } });

    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'Some strength');
    expect(item.impact).toBe('high');
    expect(screen.getByDisplayValue(KEYS.highImpact)).toBeInTheDocument();
  });
});

describe('SWOTBuildPhase — AI proposal accept/reject', () => {
  beforeEach(() => {
    resetStore();
  });

  it('accepting a proposal promotes it into a regular, editable SWOT point', () => {
    useToolStore.getState().addSWOTItem({
      text: 'AI suggested strength',
      quadrant: 'strengths',
      impact: 'medium',
      source: 'ai',
      confidence: 3,
      status: 'proposed',
      proposalStatus: 'ai-proposed',
    });

    render(<Harness />);
    expect(screen.getByText('AI suggested strength')).toBeInTheDocument();

    const acceptButton = screen.getByRole('button', { name: KEYS.accept });
    fireEvent.click(acceptButton);

    expect(screen.getByDisplayValue('AI suggested strength')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: KEYS.accept })).not.toBeInTheDocument();

    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'AI suggested strength');
    expect(item.proposalStatus).toBe('accepted');
  });

  it('rejecting a proposal removes it entirely', () => {
    useToolStore.getState().addSWOTItem({
      text: 'AI suggested weakness',
      quadrant: 'weaknesses',
      impact: 'medium',
      source: 'ai',
      confidence: 3,
      status: 'proposed',
      proposalStatus: 'ai-proposed',
    });

    render(<Harness />);
    const rejectButton = screen.getByRole('button', { name: KEYS.reject });
    fireEvent.click(rejectButton);

    expect(screen.queryByText('AI suggested weakness')).not.toBeInTheDocument();
    const items = useToolStore.getState().currentSession?.inputData as any;
    expect(items.items.find((i: any) => i.text === 'AI suggested weakness')).toBeUndefined();
  });
});
