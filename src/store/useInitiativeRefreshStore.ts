/**
 * Uspójnienie F4.1 — współdzielony sygnał odświeżenia inicjatyw.
 *
 * Zamiast duplikować fetch-state między InitiativesHub a ExecutionHub,
 * każda mutacja (`create`, `statusUpdate`, `quickUpdate`, `save`) wywołuje
 * `bumpInitiativeRefresh()` — oba huby subskrybują version i przeładowują dane.
 */
import { create } from 'zustand';

interface InitiativeRefreshState {
  version: number;
  bump: () => void;
}

export const useInitiativeRefreshStore = create<InitiativeRefreshState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

/** Imperatywny helper — wywoływany z serwisów (poza React). */
export function bumpInitiativeRefresh(): void {
  useInitiativeRefreshStore.getState().bump();
}
