/**
 * @vitest-environment jsdom
 *
 * CB-05/RB-017/RV-007 — Process Flow's horizontal toolbar used to render its
 * own Start/Action/Decision/Lane creation buttons alongside the left rail's
 * identical ones (CanvasLeftToolbar PF_CONTEXT_SLOTS), giving every basic
 * step two competing entry points. The rail is now the sole owner of those
 * four; the horizontal build palette must render everything else in
 * `availableShapes` (mode/kit-specific shapes) but never start/action/decision,
 * and the standalone "Lane" button must be gone entirely (rail-only).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CLASSIC_SHAPES, ProcessFlowToolbar, VSM_SHAPES } from '../ProcessFlowToolbar';

const noop = () => {};

function baseProps(overrides: Partial<React.ComponentProps<typeof ProcessFlowToolbar>> = {}) {
  return {
    isPl: false,
    locked: false,
    flowMode: 'classic' as const,
    setFlowMode: vi.fn(),
    semanticKit: '',
    availableShapes: CLASSIC_SHAPES,
    addNode: vi.fn(),
    insertBetween: vi.fn(),
    splitPath: vi.fn(),
    runValidation: noop,
    showWarnings: false,
    warnings: [],
    showCoach: false,
    setShowCoach: noop,
    coachLoading: false,
    runProcessCoach: noop,
    showSummary: false,
    setShowSummary: noop,
    summaryLoading: false,
    generateSummary: noop,
    showKPIDashboard: false,
    setShowKPIDashboard: noop,
    canUndo: false,
    canRedo: false,
    undo: noop,
    redo: noop,
    handleAutoLayout: noop,
    duplicateSelected: noop,
    deleteSelected: noop,
    saving: false,
    syncLabel: '',
    handleSave: noop,
    stepCount: 0,
    laneCount: 0,
    guidance: { en: 'Guide', pl: 'Wskazówka', stageEn: 'Stage', stagePl: 'Etap' },
    ...overrides,
  } as React.ComponentProps<typeof ProcessFlowToolbar>;
}

describe('ProcessFlowToolbar — rail-owned shapes are not duplicated locally', () => {
  it('does not render Start/Action/Decision build-palette buttons (rail-owned) in classic mode', () => {
    render(<ProcessFlowToolbar {...baseProps({ availableShapes: CLASSIC_SHAPES })} />);
    expect(screen.queryByText('Start')).not.toBeInTheDocument();
    expect(screen.queryByText('Action')).not.toBeInTheDocument();
    expect(screen.queryByText('Decision')).not.toBeInTheDocument();
  });

  it('still renders the mode-specific shape the rail has no equivalent for (End)', () => {
    render(<ProcessFlowToolbar {...baseProps({ availableShapes: CLASSIC_SHAPES })} />);
    expect(screen.getByText('End')).toBeInTheDocument();
  });

  it('never renders a standalone "Lane" build button (rail-owned)', () => {
    render(<ProcessFlowToolbar {...baseProps({ availableShapes: CLASSIC_SHAPES })} />);
    expect(screen.queryByText('Lane')).not.toBeInTheDocument();
  });

  it('VSM mode (no rail overlap) still renders its own fully local shapes', () => {
    render(<ProcessFlowToolbar {...baseProps({ flowMode: 'vsm', availableShapes: VSM_SHAPES })} />);
    // At least one VSM-only shape must still render (nothing to dedupe there).
    expect(screen.getByText('VSM Process')).toBeInTheDocument();
  });
});
