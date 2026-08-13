/**
 * @vitest-environment jsdom
 *
 * WORKBENCH §5.1 / UI-NAV §6: Interview / Split / Matrix are three
 * presentations of the SAME state. This test drives the shell through all
 * three view modes with one shared `matrixProps` object and confirms the
 * matrix reflects identical cell data in every mode, and that a selection
 * made in Matrix mode survives switching away and back (no forked state, no
 * silent reset).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MethodWorkspaceShell } from '../MethodWorkspaceShell';
import type { MatrixSelection } from '../types';
import {
  makeInterviewFocusQuestion,
  makeMatrixRow,
  makeReadiness,
  makeResolutionData,
  makeSession,
} from './fixtures';

function Harness({
  initialViewMode,
  readiness = makeReadiness(),
}: {
  initialViewMode: 'interview' | 'split' | 'matrix';
  readiness?: ReturnType<typeof makeReadiness>;
}) {
  const [selection, setSelection] = useState<MatrixSelection | null>(null);
  const [viewMode, setViewMode] = useState(initialViewMode);
  const row = makeMatrixRow();

  return (
    <MethodWorkspaceShell
      session={makeSession()}
      methodName="DRD"
      packVersionLabel="2.3.0"
      readiness={readiness}
      mode="guided_manual"
      onModeChange={vi.fn()}
      onExit={vi.fn()}
      saveState="SAVED"
      saveLastSavedAt={null}
      saveErrorMessage={null}
      onSaveNow={vi.fn()}
      onSaveRetry={vi.fn()}
      onSaveStay={vi.fn()}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      navigatorProps={{ nodes: [], activeUnitId: null, onSelect: vi.fn() }}
      interviewProps={{
        breadcrumb: ['DRD', 'Strategia', 'Unit 1'],
        questions: [makeInterviewFocusQuestion()],
        questionIndex: 0,
        questionTotal: 1,
        resolutionData: makeResolutionData(),
        onAnswerChange: vi.fn(),
        onAnswerStateChange: vi.fn(),
        onResolutionAction: vi.fn(),
        onEvidenceDrop: vi.fn(),
        onBack: vi.fn(),
        onSave: vi.fn(),
        onNext: vi.fn(),
        onSkip: vi.fn(),
        onAskTeresa: vi.fn(),
        canGoBack: false,
        canGoNext: true,
      }}
      teresaProps={{
        sixQuestions: {
          whereAreWe: 'x',
          whatMattersNow: 'x',
          why: 'x',
          whatIsMissing: 'x',
          nextSafeAction: 'x',
        },
        proposalQueue: [],
        onCommit: vi.fn(),
        onTakeLead: vi.fn(),
        onLetMeWorkManually: vi.fn(),
        mode: 'guided_manual',
      }}
      matrixProps={{
        rows: [row],
        levels: [1, 2, 3, 4],
        selection,
        onSelect: setSelection,
        onCloseSideSheet: () => setSelection(null),
        renderSideSheet: (sel) => <p data-testid="shell-side-sheet-content">Wybrano {sel.unitId}/{sel.level}</p>,
      }}
    />
  );
}

describe('MethodWorkspaceShell — view modes share one state', () => {
  it('renders Interview Focus in "interview" mode', () => {
    render(<Harness initialViewMode="interview" />);
    expect(screen.getByTestId('interview-focus-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('live-matrix')).not.toBeInTheDocument();
  });

  it('switching to "matrix" mode shows the same unit/level data as the Graphic Mirror would', () => {
    render(<Harness initialViewMode="interview" />);
    fireEvent.click(screen.getByTestId('view-mode-matrix'));
    expect(screen.getByTestId('live-matrix')).toBeInTheDocument();
    // Same cell semantics as asserted directly on LiveMatrix — proves the shell
    // passes the identical rows/levels through, not a second copy.
    expect(
      screen.getByLabelText('DRD, Strategia i governance, poziom 2, osiągnięty, odpowiedź potwierdzone, dowód kompletny')
    ).toBeInTheDocument();
  });

  it('a selection made in Matrix mode survives switching to Split and back to Matrix', () => {
    render(<Harness initialViewMode="matrix" />);
    fireEvent.click(screen.getByLabelText(/poziom 3,/));
    expect(screen.getByTestId('shell-side-sheet-content')).toHaveTextContent('Wybrano unit-1/3');

    fireEvent.click(screen.getByTestId('view-mode-split'));
    // Split renders a compact matrix mirror; switch back to Matrix.
    fireEvent.click(screen.getByTestId('view-mode-matrix'));
    expect(screen.getByTestId('shell-side-sheet-content')).toHaveTextContent('Wybrano unit-1/3');
  });

  it('Split mode shows both the Interview Focus panel and a compact matrix mirror of the same rows', () => {
    render(<Harness initialViewMode="split" />);
    expect(screen.getByTestId('interview-focus-panel')).toBeInTheDocument();
    expect(screen.getByTestId('live-matrix')).toBeInTheDocument();
  });

  // ★ A10/D4. Fixture domyślny to 12/39 odpowiedzianych i ZERO blokerów —
  // czyli dokładnie scenariusz defektu. Do 2026-08-13 pasek stanu mówił przy
  // nim „Gotowe do zamrożenia" na zielono. Żaden test nie asercjonował tego
  // paska, więc komunikat mógł kłamać bez konsekwencji.
  describe('pasek stanu — pewność nie zastępuje kompletności', () => {
    it('brak blokerów przy niepełnym pokryciu NIE jest ogłaszany jako gotowość', () => {
      render(<Harness initialViewMode="interview" readiness={makeReadiness({ answeredUnits: 1, totalUnits: 39, freezeBlockers: [] })} />);
      expect(screen.queryByText('Gotowe do zamrożenia')).not.toBeInTheDocument();
      expect(screen.getByText(/ocena niekompletna \(1\/39\)/)).toBeInTheDocument();
    });

    it('pełne pokrycie bez blokerów ogłasza gotowość', () => {
      render(<Harness initialViewMode="interview" readiness={makeReadiness({ answeredUnits: 39, totalUnits: 39, freezeBlockers: [] })} />);
      expect(screen.getByText('Gotowe do zamrożenia')).toBeInTheDocument();
    });

    it('bloker ma pierwszeństwo nad informacją o pokryciu', () => {
      render(<Harness initialViewMode="interview" readiness={makeReadiness({ answeredUnits: 39, totalUnits: 39, freezeBlockers: ['x'] })} />);
      expect(screen.queryByText('Gotowe do zamrożenia')).not.toBeInTheDocument();
      expect(screen.getByText(/blokerów freeze/)).toBeInTheDocument();
    });
  });
});
