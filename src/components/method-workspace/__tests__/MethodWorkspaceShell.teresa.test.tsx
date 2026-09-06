/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MethodWorkspaceShell } from '../MethodWorkspaceShell';
import { makeInterviewFocusQuestion, makeMatrixRow, makeReadiness, makeResolutionData, makeSession } from './fixtures';

describe('MethodWorkspaceShell Teresa panel', () => {
  it('renders TeresaPreviewPanel from teresaProps', () => {
    render(
      <MethodWorkspaceShell
        session={makeSession()} methodName="DRD" packVersionLabel="2.3.0" readiness={makeReadiness()}
        mode="guided_manual" onModeChange={vi.fn()} onExit={vi.fn()} saveState="SAVED"
        saveLastSavedAt={null} saveErrorMessage={null} onSaveNow={vi.fn()} onSaveRetry={vi.fn()} onSaveStay={vi.fn()}
        navigatorProps={{ nodes: [], activeUnitId: null, onSelect: vi.fn() }}
        interviewProps={{ breadcrumb: ['DRD'], questions: [makeInterviewFocusQuestion()], questionIndex: 0, questionTotal: 1, resolutionData: makeResolutionData(), onAnswerChange: vi.fn(), onAnswerStateChange: vi.fn(), onResolutionAction: vi.fn(), onEvidenceDrop: vi.fn(), onBack: vi.fn(), onSave: vi.fn(), onNext: vi.fn(), onSkip: vi.fn(), onAskTeresa: vi.fn(), canGoBack: false, canGoNext: true }}
        teresaProps={{ sixQuestions: { whereAreWe: 'Stan sesji P8', whatMattersNow: 'x', why: 'x', whatIsMissing: 'x', nextSafeAction: 'x' }, proposalQueue: [], onCommit: vi.fn(), onTakeLead: vi.fn(), onLetMeWorkManually: vi.fn(), mode: 'guided_manual' }}
        matrixProps={{ rows: [makeMatrixRow()], levels: [1, 2, 3, 4], selection: null, onSelect: vi.fn(), onCloseSideSheet: vi.fn(), renderSideSheet: () => null }}
        reportContent={<div>Raport</div>}
      />
    );
    expect(screen.getByText('Stan sesji P8')).toBeInTheDocument();
  });
});
