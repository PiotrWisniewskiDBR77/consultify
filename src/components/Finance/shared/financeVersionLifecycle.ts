/**
 * Etykiety i dozwolone przejścia cyklu życia wersji biznesowej Finansów.
 *
 * PO CO OSOBNY PLIK (2026-09-05, runda 3 odbioru). Ten sam automat stał już
 * słowo w słowo w `BaselineWorkspace.tsx` i `StatementPackWorkspaceV2.tsx`
 * (zmierzone `diff` — różnią się wyłącznie zawijaniem wierszy i komentarzem).
 * Wycena była trzecim ekranem, który go potrzebuje; trzecia kopia zamieniłaby
 * powtórzenie w dryf, a dryf w automacie stanów oznacza dwa różne zestawy
 * przycisków dla tego samego statusu na dwóch ekranach obok siebie.
 *
 * KONTRAKT: oferujemy WYŁĄCZNIE przejścia z realnym odpowiednikiem w API
 * (`transitionFinanceVersion` / `approveFinanceModel` / `reopenFinanceModel`).
 * `save_draft` i `new_version` istnieją w typie kontraktu, ale nie mają dziś
 * endpointu — i dlatego nie wychodzą z tej funkcji.
 */
import type { BusinessVersionStatus } from '@/services/api/financeV2.types';

import { ENABLEMENT_ALWAYS, type WorkspaceBarLifecycleTransition } from './financeWorkspaceBar.contract';

export function lifecycleShortLabel(status: BusinessVersionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Wersja robocza';
    case 'READY_FOR_REVIEW':
      return 'Gotowe do przeglądu';
    case 'IN_REVIEW':
      return 'W przeglądzie';
    case 'APPROVED':
      return 'Zatwierdzone';
    case 'NEEDS_CHANGES':
      return 'Wymaga zmian';
    case 'SUPERSEDED':
      return 'Zastąpione';
    case 'ARCHIVED':
      return 'Zarchiwizowane';
    case 'INVALIDATED':
      return 'Unieważnione';
    default:
      return status;
  }
}

/** G06 i18n (2026-09-03, agent/i18n-pl-en): angielski odpowiednik `lifecycleShortLabel`. */
export function lifecycleShortLabelEn(status: BusinessVersionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'READY_FOR_REVIEW':
      return 'Ready for review';
    case 'IN_REVIEW':
      return 'In review';
    case 'APPROVED':
      return 'Approved';
    case 'NEEDS_CHANGES':
      return 'Needs changes';
    case 'SUPERSEDED':
      return 'Superseded';
    case 'ARCHIVED':
      return 'Archived';
    case 'INVALIDATED':
      return 'Invalidated';
    default:
      return status;
  }
}

/** Tylko przejścia z realnym odpowiednikiem w API — bez fabrykowanych akcji. */
export function lifecycleTransitionsFor(
  status: BusinessVersionStatus
): WorkspaceBarLifecycleTransition[] {
  /**
   * `en` DOŁOŻONE w paczce J9 (program spójności językowej, 08.09). Wcześniej
   * świadomie go nie było — komentarz w tym miejscu opisywał to jako „zastany
   * dług: menu cyklu życia jest po polsku także w wersji angielskiej". To
   * właśnie ten dług; `pickWorkspaceBarLabel` bierze `.en` gdy język konta to
   * angielski, więc od teraz pasek cyklu życia w `BaselineWorkspace.tsx`
   * i `StatementPackWorkspaceV2.tsx` mówi po angielsku do konta EN. Wersja
   * polska (`pl`) nie zmienia się ani o znak.
   */
  const t = (
    action: WorkspaceBarLifecycleTransition['action'],
    pl: string,
    en: string,
    opts: Partial<WorkspaceBarLifecycleTransition> = {}
  ): WorkspaceBarLifecycleTransition => ({
    action,
    label: { key: action, pl, en },
    enablement: ENABLEMENT_ALWAYS,
    destructive: false,
    requiresConfirmation: false,
    requiresReason: false,
    ...opts,
  });

  switch (status) {
    case 'DRAFT':
      return [
        t('submit_for_review', 'Przekaż do przeglądu', 'Submit for review'),
        t('invalidate', 'Unieważnij', 'Invalidate', {
          destructive: true,
          requiresConfirmation: true,
          requiresReason: true,
        }),
      ];
    case 'READY_FOR_REVIEW':
      return [
        t('start_review', 'Rozpocznij przegląd', 'Start review'),
        t('withdraw', 'Wycofaj z przeglądu', 'Withdraw from review'),
      ];
    case 'IN_REVIEW':
      return [
        t('approve', 'Zatwierdź', 'Approve', { requiresConfirmation: true }),
        t('request_changes', 'Poproś o zmiany', 'Request changes', { requiresReason: true }),
      ];
    case 'NEEDS_CHANGES':
      return [t('resume_editing', 'Wróć do edycji', 'Resume editing')];
    case 'APPROVED':
      return [
        t('reopen', 'Otwórz ponownie', 'Reopen', {
          destructive: true,
          requiresConfirmation: true,
          requiresReason: true,
        }),
      ];
    default:
      return [];
  }
}
