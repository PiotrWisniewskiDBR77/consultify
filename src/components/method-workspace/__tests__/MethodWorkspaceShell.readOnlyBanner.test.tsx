/**
 * @vitest-environment jsdom
 *
 * Z-54 (fala D3, 2026-09-14) — powłoka DRD MÓWI, dlaczego jest tylko do odczytu.
 *
 * PREMISA ZMIERZONA na 08c1bb7a26: dla cudzej sesji
 * `GET /api/method/sessions/:id` zwraca `roles: []`, więc
 * `DrdHttpMethodWorkspaceScreen.tsx:677` liczy `canWrite === false` i podaje
 * powłoce `readOnly={!canWrite}` (linia 1358). Skutek był widoczny — wszystkie
 * pstryczki i „Save" wygaszone — ale powód NIGDZIE nie był napisany. Jedyna
 * wzmianka o trybie odczytu siedziała w ZWINIĘTYM panelu „Settings"
 * (`methodWorkspace.info.readOnly`, MethodWorkspaceShell.tsx:402), którego
 * użytkownik nie otwiera, zanim zgłosi „ekran jest zepsuty".
 *
 * Ten test broni trzech rzeczy naraz:
 *   1. plakietka JEST widoczna bez otwierania czegokolwiek, gdy readOnly,
 *   2. plakietki NIE MA, gdy rola z zapisem jest obecna (nie straszymy),
 *   3. ton jest NEUTRALNY — zero crimson (`primary-*` każdy numer to crimson
 *      w tym repozytorium, a czerwień jest zarezerwowana dla semantyki
 *      krytycznej; brak uprawnienia do zapisu nią nie jest).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string | Record<string, unknown>, opts?: Record<string, unknown>) => {
      const base = typeof fallback === 'string' ? fallback : _k;
      const vars = (typeof fallback === 'string' ? opts : fallback) as
        | Record<string, unknown>
        | undefined;
      if (!vars) return base;
      return base.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(vars[key] ?? ''));
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { MethodWorkspaceShell } from '../MethodWorkspaceShell';
import {
  makeInterviewFocusQuestion,
  makeReadiness,
  makeResolutionData,
  makeSession,
} from './fixtures';

/** Ten sam kształt propsów, co w MethodWorkspaceShell.test.tsx — powłoka jest
 *  montowana REALNIE, nie przez atrapę; różni się wyłącznie `readOnly`. */
function renderShell(readOnly: boolean) {
  return render(
    <MethodWorkspaceShell
      session={makeSession()}
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
        breadcrumb: ['DRD', 'Strategia', 'Unit 1'],
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
      reportContent={<p data-testid="report-content">Raport</p>}
      readOnly={readOnly}
    />
  );
}

describe('Z-54 — powłoka DRD tłumaczy tryb tylko-do-odczytu', () => {
  it('readOnly=true (roles: []) → plakietka z POWODEM widoczna od razu, bez otwierania Ustawień', () => {
    renderShell(true);

    const banner = screen.getByTestId('method-workspace-readonly-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Read only');
    expect(banner.textContent).toContain('not a participant of this session');
    // `role="status"` — czytnik ekranu ma to ogłosić, a nie zostawić jako ozdobę.
    expect(banner.getAttribute('role')).toBe('status');
  });

  it('rola z zapisem (readOnly=false) → ŻADNEJ plakietki (nie straszymy bez powodu)', () => {
    renderShell(false);
    expect(screen.queryByTestId('method-workspace-readonly-banner')).toBeNull();
  });

  it('ton neutralny — plakietka nie używa crimson (primary-*/red-*/c-danger)', () => {
    renderShell(true);
    const cls = screen.getByTestId('method-workspace-readonly-banner').className;
    expect(cls).not.toMatch(/primary-/);
    expect(cls).not.toMatch(/\bred-/);
    expect(cls).not.toMatch(/c-danger/);
    expect(cls).not.toMatch(/c-error/);
    // Pozytywnie: tokeny neutralne z kanonu.
    expect(cls).toMatch(/c-surface-raised/);
    expect(cls).toMatch(/c-text-secondary/);
  });
});
