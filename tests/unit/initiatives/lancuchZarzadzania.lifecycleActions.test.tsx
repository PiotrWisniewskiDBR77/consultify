// @vitest-environment jsdom
/**
 * Łańcuch zarządzania inicjatywą (DEC-424 / DEC-453) — powierzchnia akcji.
 *
 * Trzy warunki właściciela, oczami użytkownika:
 *   1. brak roli ⇒ przycisku NIE MA (nie: wyszarzony, nie: 403 po kliknięciu),
 *   2. warunek niespełniony ⇒ przycisk nieaktywny, a powód po polsku stoi obok,
 *   3. wymagany powód ⇒ okno tekstowe, bez możliwości pominięcia,
 * plus: nieudany zapis pokazuje komunikat (zero cichych awarii).
 *
 * MUTACJE: usuń `.filter((item) => item.roleAllowed)` z `useInitiativeLifecycle`
 * → test 1 czerwony; usuń `disabled: !item.conditionSatisfied` → test 2 czerwony;
 * dopisz `.catch(() => {})` do `run` → test 4 czerwony.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchPreflightMock, applyTransitionMock, setFlagMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  fetchPreflightMock: vi.fn(),
  applyTransitionMock: vi.fn(),
  setFlagMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown, options?: Record<string, unknown>) => {
      const base = typeof fallback === 'string' ? fallback : String(_key);
      const opts = typeof fallback === 'object' && fallback ? (fallback as Record<string, unknown>) : options;
      return opts
        ? base.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(opts[name] ?? `{{${name}}}`))
        : base;
    },
    i18n: { language: 'pl' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: toastErrorMock, success: toastSuccessMock },
}));

vi.mock('@/services/initiatives/lifecycleApi', () => ({
  fetchInitiativeTransitionPreflight: fetchPreflightMock,
  applyInitiativeTransition: applyTransitionMock,
  setInitiativeLifecycleFlag: setFlagMock,
  readInitiativeFailureRule: (error: unknown) =>
    (error as { data?: { rule?: string } } | null)?.data?.rule ?? null,
}));

import { InitiativeLifecycleActions } from '@/components/Initiatives/lifecycle/InitiativeLifecycleActions';

const preflight = (over: Record<string, unknown>) => ({
  initiativeId: 'ini-1',
  currentStatus: 'DRAFT',
  onHold: false,
  archived: false,
  isAuthor: true,
  effectiveRoles: [],
  transitions: [],
  flags: [],
  ...over,
});

const transition = (over: Record<string, unknown>) => ({
  targetStatus: 'PENDING_APPROVAL',
  gate: 'SUBMIT_FOR_REVIEW',
  requiredRoles: ['CONSULTANT'],
  roleAllowed: true,
  conditionSatisfied: true,
  blockingRule: null,
  blockingItems: [],
  requiresReason: false,
  allowed: true,
  ...over,
});

beforeEach(() => {
  fetchPreflightMock.mockReset();
  applyTransitionMock.mockReset().mockResolvedValue(undefined);
  setFlagMock.mockReset().mockResolvedValue(undefined);
  toastErrorMock.mockReset();
  toastSuccessMock.mockReset();
});

describe('InitiativeLifecycleActions — łańcuch zarządzania', () => {
  it('1. brak roli: przycisk NIE ISTNIEJE, a użytkownik widzi dlaczego nie ma akcji', async () => {
    fetchPreflightMock.mockResolvedValue(
      preflight({ transitions: [transition({ roleAllowed: false, allowed: false })] })
    );
    render(<InitiativeLifecycleActions initiativeId="ini-1" />);
    await screen.findByTestId('initiative-lifecycle-empty');
    expect(screen.queryByTestId('initiative-lifecycle-transition:PENDING_APPROVAL')).toBeNull();
    expect(screen.getByTestId('initiative-lifecycle-empty').textContent).toContain('Nie masz uprawnień');
  });

  it('2. warunek niespełniony: przycisk widoczny, nieaktywny, z powodem po polsku obok', async () => {
    fetchPreflightMock.mockResolvedValue(
      preflight({
        transitions: [
          transition({
            conditionSatisfied: false,
            blockingRule: 'INITIATIVE_CARD_INCOMPLETE',
            allowed: false,
          }),
        ],
      })
    );
    render(<InitiativeLifecycleActions initiativeId="ini-1" />);
    const button = (await screen.findByTestId(
      'initiative-lifecycle-transition:PENDING_APPROVAL'
    )) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Prześlij do zatwierdzenia');
    const reason = screen.getByTestId('initiative-lifecycle-reason-transition:PENDING_APPROVAL');
    expect(reason.textContent).toContain('Karta jest niekompletna');
    fireEvent.click(button);
    expect(applyTransitionMock).not.toHaveBeenCalled();
  });

  it('2b. gotowość bramki (GATE_BLOCKED): powód wymienia brakujące elementy po polsku', async () => {
    fetchPreflightMock.mockResolvedValue(
      preflight({
        currentStatus: 'APPROVED',
        transitions: [
          transition({
            targetStatus: 'IN_EXECUTION',
            gate: 'START',
            conditionSatisfied: false,
            blockingRule: 'GATE_BLOCKED',
            blockingItems: [
              { key: 'timeline_dates', label: 'Planned dates set (start + end)' },
              { key: 'schedule_milestones', label: 'Milestones defined' },
            ],
            allowed: false,
          }),
        ],
      })
    );
    render(<InitiativeLifecycleActions initiativeId="ini-1" />);
    await screen.findByTestId('initiative-lifecycle-transition:IN_EXECUTION');
    const reason = screen.getByTestId('initiative-lifecycle-reason-transition:IN_EXECUTION');
    expect(reason.textContent).toContain('planowane daty startu i końca');
    expect(reason.textContent).toContain('co najmniej jeden kamień milowy');
    expect(reason.textContent).not.toContain('{{items}}');
  });

  it('3. wymagany powód: okno tekstowe, potwierdzenie nieaktywne do wpisania tekstu, powód idzie do zapisu', async () => {
    fetchPreflightMock.mockResolvedValue(
      preflight({
        currentStatus: 'PENDING_APPROVAL',
        transitions: [
          transition({ targetStatus: 'DRAFT', gate: 'SEND_BACK', requiresReason: true }),
        ],
      })
    );
    render(<InitiativeLifecycleActions initiativeId="ini-1" />);
    const button = await screen.findByTestId('initiative-lifecycle-transition:DRAFT');
    fireEvent.click(button);
    expect(applyTransitionMock).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Zwróć do szkicu'
    ) as HTMLButtonElement;
    expect(confirm).toBeDefined();
    expect(confirm.disabled).toBe(true);
    const textarea = dialog.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Brakuje analizy kosztów.' } });
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(applyTransitionMock).toHaveBeenCalledTimes(1));
    expect(applyTransitionMock).toHaveBeenCalledWith('ini-1', 'DRAFT', 'Brakuje analizy kosztów.');
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('4. nieudany zapis: komunikat serwera trafia do użytkownika (zero cichych awarii)', async () => {
    fetchPreflightMock.mockResolvedValue(
      preflight({ transitions: [transition({})] })
    );
    const failure = Object.assign(new Error('Open tasks or blocking decisions prevent closure'), {
      data: { rule: 'OPEN_WORK_BLOCKS_CLOSURE' },
    });
    applyTransitionMock.mockRejectedValueOnce(failure);
    render(<InitiativeLifecycleActions initiativeId="ini-1" />);
    const button = await screen.findByTestId('initiative-lifecycle-transition:PENDING_APPROVAL');
    fireEvent.click(button);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    expect(String(toastErrorMock.mock.calls[0][0])).toContain('Zamknięcie blokują otwarte zadania');
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('5. awaria odczytu podglądu: użytkownik widzi powód, nie pustkę', async () => {
    fetchPreflightMock.mockRejectedValue(new Error('500'));
    render(<InitiativeLifecycleActions initiativeId="ini-1" />);
    const error = await screen.findByTestId('initiative-lifecycle-load-error');
    expect(error.textContent).toContain('Nie udało się sprawdzić');
  });

  it('6. flaga wstrzymania: HOLD wymaga powodu i woła trasę flagi, nie zmiany statusu', async () => {
    fetchPreflightMock.mockResolvedValue(
      preflight({
        currentStatus: 'IN_EXECUTION',
        flags: [
          { operation: 'HOLD', gate: 'BLOCK', requiredRoles: ['PMO'], roleAllowed: true, requiresReason: true, stateAllowed: true, allowed: true },
          { operation: 'RESUME', gate: 'UNBLOCK', requiredRoles: ['PROJECT_SPONSOR'], roleAllowed: true, requiresReason: false, stateAllowed: false, allowed: false },
        ],
      })
    );
    render(<InitiativeLifecycleActions initiativeId="ini-1" />);
    const hold = await screen.findByTestId('initiative-lifecycle-flag:HOLD');
    expect(screen.queryByTestId('initiative-lifecycle-flag:RESUME')).toBeNull();
    fireEvent.click(hold);
    const dialog = await screen.findByRole('dialog');
    const textarea = dialog.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Czekamy na budżet.' } });
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Wstrzymaj realizację'
    ) as HTMLButtonElement;
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() => expect(setFlagMock).toHaveBeenCalledWith('ini-1', 'HOLD', 'Czekamy na budżet.'));
    expect(applyTransitionMock).not.toHaveBeenCalled();
  });
});
