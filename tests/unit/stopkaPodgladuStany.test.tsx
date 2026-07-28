/**
 * Bramka: podgląd przydziału odzywa się w KAŻDYM stanie.
 *
 * Przegląd 128 zrzutów zapisał Interview → Assigned jako „BRAK CAŁEJ STOPKI
 * AKCJI". Przyczyna nie była taka, jak wyglądała: stopka istniała, ale
 * renderowała przyciski wyłącznie dla `assigned` / `in_progress` / `sent_back`.
 * Rekord na zrzucie miał `approved` → lista przycisków pusta → znikał cały blok.
 *
 * Ten test pilnuje obu połówek naprawy:
 *   `submitted` → para decyzyjna recenzenta (wzorzec z Decisions)
 *   `approved`  → baner stanu (wzorzec z Interview → Initiatives)
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InterviewAssignmentPreviewFooter } from '@/components/Interview/InterviewAssignmentPreview';

const bazowe = {
  isPolish: true,
  aiHints: [],
  aiText: null,
  aiError: null,
  aiMenuOpen: false,
  onToggleAiMenu: () => undefined,
  onRunAiHint: () => undefined,
  relations: [],
  onOpenFull: () => undefined,
};

describe('stopka podglądu przydziału — każdy stan się odzywa', () => {
  it('„oddane do oceny" daje recenzentowi parę decyzyjną', () => {
    render(
      <InterviewAssignmentPreviewFooter
        {...bazowe}
        assignment={{ status: 'submitted', sessionId: 's1' }}
        onApproveAssignment={vi.fn()}
        onSendBackAssignment={vi.fn()}
      />
    );

    expect(screen.getByText('Zatwierdź')).toBeTruthy();
    expect(screen.getByText('Odeślij do poprawy')).toBeTruthy();
  });

  it('„zatwierdzone" nie ma akcji, ale MÓWI, że to koniec drogi', () => {
    render(
      <InterviewAssignmentPreviewFooter
        {...bazowe}
        assignment={{ status: 'approved', sessionId: 's1' }}
      />
    );

    // Wczesniej: pustka nie do odroznienia od brakujacej funkcji.
    expect(screen.getByText(/przydział jest zamknięty/i)).toBeTruthy();
  });

  it('stan roboczy nadal ma swoją akcję główną (bez regresji)', () => {
    render(
      <InterviewAssignmentPreviewFooter
        {...bazowe}
        assignment={{ status: 'in_progress', sessionId: 's1' }}
        onContinueAssignment={vi.fn()}
      />
    );

    expect(screen.queryByText(/przydział jest zamknięty/i)).toBeNull();
  });
});
