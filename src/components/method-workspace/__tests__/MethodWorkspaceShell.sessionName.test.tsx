/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 04_METHOD DEC-602] Wpis 57 — DRD-2: the frozen DRD workspace
 * header must show the SESSION NAME, not `Session <uuid>`.
 *
 * Measured defect: `MethodWorkspaceShell.tsx` header rendered
 * `methodName · Session <id8>` unconditionally, although `MethodSession.name`
 * exists in the contract (`src/method-core/contracts/session.ts`) and the
 * Assessment list already displays it (`AssessmentHub.tsx`).
 *
 * WHAT THIS FILE GUARDS:
 *   1. name present (trimmed, non-empty) -> header shows the name and NOT the
 *      uuid short label,
 *   2. name missing / blank -> header falls back to the i18n short label
 *      `methodWorkspace.sessionShort` with the 8-char id (legacy behavior).
 *
 * MUTATION PROOF: restoring the unconditional uuid short label turns case 1
 * red.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

type Vars = Record<string, unknown>;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string | Vars, opts?: Vars) => {
      const base = typeof fallback === 'string' ? fallback : _k;
      const vars = (typeof fallback === 'string' ? opts : fallback) as Vars | undefined;
      if (!vars) return base;
      return base.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(vars[key] ?? ''));
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { MethodWorkspaceShell } from '../MethodWorkspaceShell';
import type { MethodSession } from '../../../method-core/contracts/session';
import {
  makeInterviewFocusQuestion,
  makeReadiness,
  makeResolutionData,
  makeSession,
} from './fixtures';

const SESSION_ID = 'abc12345-7f1c-4b9d-9f26-000000000000';
const SESSION_NAME = 'Rotherham and Leeds digital maturity';

function renderShell(session: MethodSession) {
  return render(
    <MethodWorkspaceShell
      session={session}
      methodName="DRD"
      packVersionLabel="2.3.0"
      readiness={makeReadiness()}
      mode="guided_manual"
      onExit={vi.fn()}
      onModeChange={vi.fn()}
      saveState="SAVED"
      saveLastSavedAt={null}
      saveErrorMessage={null}
      onSaveNow={vi.fn()}
      onSaveRetry={vi.fn()}
      onSaveStay={vi.fn()}
      navigatorProps={{ nodes: [], activeUnitId: null, onSelect: vi.fn() }}
      interviewProps={{
        breadcrumb: ['DRD', 'Strategy', 'Unit 1'],
        questions: [makeInterviewFocusQuestion()],
        questionIndex: 0,
        questionTotal: 7,
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
        rows: [],
        levels: [1, 2, 3, 4],
        selection: null,
        onSelect: vi.fn(),
        onCloseSideSheet: vi.fn(),
        renderSideSheet: () => null,
      }}
      reportContent={<span data-testid="report-content">x</span>}
    />
  );
}

describe('DEC-602 (Wpis 57) — DRD header shows the session name, uuid short only as fallback', () => {
  it('name present -> header shows the name and NOT the uuid short label', () => {
    renderShell(makeSession({ id: SESSION_ID, name: SESSION_NAME }));
    expect(screen.getByText(`DRD · ${SESSION_NAME}`)).toBeInTheDocument();
    expect(screen.queryByText('DRD · Session abc12345')).toBeNull();
  });

  it('name missing or blank -> header falls back to the short id label', () => {
    const { unmount } = renderShell(makeSession({ id: SESSION_ID, name: '   ' }));
    expect(screen.getByText('DRD · Session abc12345')).toBeInTheDocument();
    unmount();
    renderShell(makeSession({ id: SESSION_ID }));
    expect(screen.getByText('DRD · Session abc12345')).toBeInTheDocument();
  });
});
