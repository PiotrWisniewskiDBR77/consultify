/**
 * @vitest-environment jsdom
 *
 * K-28 (zgłoszenia testerów #71 i #80, Kasia, `/my-work`):
 *   „Po odświeżeniu strona przeskakuje z «Zadania» na «Skrzynka»."
 *   „po odświeżeniu otwiera się widok «skrzynka», a jak kliknę zakładkę
 *    Zadania, to otwiera się widok listy, a nie kanban."
 *
 * PREMISA ZMIERZONA NA `258043df9f`: zakładka startowa wychodziła WYŁĄCZNIE z
 * URL-a (`getInitialMyWorkTab`) i spadała do `MY_WORK_FALLBACK_TAB = 'inbox'`
 * (`MyWorkHub.tsx:255`), a `tasksViewMode` startował twardym
 * `useState('table')` (`:910`). Żaden wybór użytkownika nie przeżywał
 * przeładowania — nie było czego czytać, bo nic nie było zapisywane.
 *
 * Testy pilnują trzech rzeczy naraz:
 *  1. zapis/odczyt w ogóle działa (usterka = brak pamięci),
 *  2. pamięć jest per TOŻSAMOSĆ (org+user) — dwie osoby na jednej
 *     przeglądarce nie dziedziczą swoich ekranów (ta sama reguła, co D1 dla
 *     otwartych dokumentów),
 *  3. zapisana wartość jest DANYMI, nie prawdą: podrzucona/nieistniejąca
 *     zakładka nie może wybrać ekranu.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getInitialMyWorkTab,
  getMyWorkViewStorageKey,
  readStoredMyWorkView,
  writeStoredMyWorkView,
} from '../MyWorkHub';

const USER_A = 'user-a';
const ORG_A = 'org-a';
const USER_B = 'user-b';
const ORG_B = 'org-b';

beforeEach(() => {
  window.localStorage.clear();
});

describe('K-28 — Moja Praca pamięta zakładkę i widok', () => {
  it('zapisany wybór wraca po „odświeżeniu" (ten sam użytkownik)', () => {
    writeStoredMyWorkView(USER_A, ORG_A, { tab: 'tasks', tasksViewMode: 'kanban' });

    expect(readStoredMyWorkView(USER_A, ORG_A)).toEqual({
      tab: 'tasks',
      tasksViewMode: 'kanban',
    });
  });

  it('klucz jest zakresowany org+user — i bez tożsamości nie ma klucza', () => {
    expect(getMyWorkViewStorageKey(USER_A, ORG_A)).toBe(`moduleHub.view.mywork.${ORG_A}.${USER_A}`);
    expect(getMyWorkViewStorageKey(USER_A, null)).toBeNull();
    expect(getMyWorkViewStorageKey(null, ORG_A)).toBeNull();
    expect(getMyWorkViewStorageKey(undefined, undefined)).toBeNull();
  });

  it('nie przecieka między tożsamościami (inny user, inna org, oba)', () => {
    writeStoredMyWorkView(USER_A, ORG_A, { tab: 'tasks', tasksViewMode: 'kanban' });

    expect(readStoredMyWorkView(USER_B, ORG_B)).toEqual({ tab: null, tasksViewMode: null });
    expect(readStoredMyWorkView(USER_B, ORG_A)).toEqual({ tab: null, tasksViewMode: null });
    expect(readStoredMyWorkView(USER_A, ORG_B)).toEqual({ tab: null, tasksViewMode: null });
  });

  it('bez tożsamości nic nie zapisuje i nic nie czyta', () => {
    writeStoredMyWorkView(null, null, { tab: 'tasks', tasksViewMode: 'kanban' });

    expect(window.localStorage.length).toBe(0);
    expect(readStoredMyWorkView(null, null)).toEqual({ tab: null, tasksViewMode: null });
  });

  it('podrzucona/nieznana zakładka nie wybiera ekranu (wartość = dane, nie prawda)', () => {
    window.localStorage.setItem(
      `moduleHub.view.mywork.${ORG_A}.${USER_A}`,
      JSON.stringify({ tab: 'superadmin', tasksViewMode: 'gantt' })
    );

    expect(readStoredMyWorkView(USER_A, ORG_A)).toEqual({ tab: null, tasksViewMode: null });
  });

  it('wygaszone powierzchnie (home/manager/agent) nie wracają jako ekran startowy', () => {
    for (const tab of ['home', 'manager', 'agent']) {
      window.localStorage.setItem(
        `moduleHub.view.mywork.${ORG_A}.${USER_A}`,
        JSON.stringify({ tab, tasksViewMode: 'table' })
      );
      expect(readStoredMyWorkView(USER_A, ORG_A).tab).toBeNull();
    }
  });

  it('uszkodzony wpis nie wywraca ekranu', () => {
    window.localStorage.setItem(`moduleHub.view.mywork.${ORG_A}.${USER_A}`, '{nie-json');

    expect(readStoredMyWorkView(USER_A, ORG_A)).toEqual({ tab: null, tasksViewMode: null });
  });
});

/**
 * WOŁACZ, nie tylko biblioteka (pamięć „biblioteka bez wywołania"): helper
 * może być zielony i nieużywany. Ten blok pyta o rozstrzyganie zakładki
 * startowej — czyli o miejsce, w którym pamięć naprawdę wchodzi do ekranu —
 * oraz o to, że huba faktycznie czyta i zapisuje pamięć.
 */
describe('K-28 — pamięć wchodzi do rozstrzygania zakładki startowej', () => {
  it('bez URL-a i bez pamięci: fallback „inbox" (zachowanie sprzed naprawy)', () => {
    expect(getInitialMyWorkTab(new URLSearchParams(''), false, true, null)).toBe('inbox');
  });

  it('bez URL-a, z pamięcią: wraca zapamiętana zakładka', () => {
    expect(getInitialMyWorkTab(new URLSearchParams(''), false, true, 'tasks')).toBe('tasks');
  });

  it('głęboki link WYGRYWA z pamięcią (?taskId nie może wylądować na cudzej zakładce)', () => {
    expect(getInitialMyWorkTab(new URLSearchParams('taskId=abc'), false, true, 'decisions')).toBe(
      'tasks'
    );
    expect(getInitialMyWorkTab(new URLSearchParams('tab=calendar'), false, true, 'tasks')).toBe(
      'calendar'
    );
  });

  it('zapamiętane „ideas" nie wraca uczestnikowi pilota (allowIdeas=false)', () => {
    expect(getInitialMyWorkTab(new URLSearchParams(''), false, false, 'ideas')).toBe('inbox');
  });
});

describe('K-28 — huba naprawdę woła pamięć (nie sama biblioteka)', () => {
  const zrodlo = (): string =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, '../MyWorkHub.tsx'),
      'utf8'
    );

  it('czyta pamięć przy montowaniu i podaje ją do rozstrzygania zakładki', () => {
    const src = zrodlo();
    expect(src).toMatch(/readStoredMyWorkView\(myWorkDocumentsUserId, myWorkDocumentsOrgId\)/);
    expect(src).toMatch(/restoredViewState\.tab/);
    expect(src).toMatch(/restoredViewState\.tasksViewMode \?\? 'table'/);
  });

  it('zapisuje zakładkę i widok zadań przy każdej zmianie', () => {
    expect(zrodlo()).toMatch(/writeStoredMyWorkView\(myWorkDocumentsUserId, myWorkDocumentsOrgId/);
  });
});
