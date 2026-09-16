/**
 * K-31 (zgłoszenie testera #84, Kasia, `/my-work`):
 *   „Zadanie powstało, ale ma przypisaną osobę właściciela zadania. Pojawia
 *    się we wszystkich filtrach oprócz «Pilne»."
 *   Oczekiwanie testera: „zadanie powstaje (brak terminu jest dozwolony), a w
 *   tabeli w kolumnach widnieje czytelne «Brak terminu» i «Nieprzypisany» —
 *   nie puste pole, myślnik ani słowo null/undefined. Filtry «Zaległe» i
 *   «Dzisiaj» nie łapią tego zadania."
 * Bliźniacze zgłoszenie #71: „W zakładkach Zaległe, Dzisiaj i Ten tydzień nie
 * mam żadnych [zadań] (stan «0»), a wyświetlają się wszystkie (2)."
 *
 * PREMISA ZMIERZONA NA `258043df9f`: `categorizeTask` LICZYŁO kubełki czasowe
 * poprawnie (zadanie bez terminu → 'no-date') i te liczby szły do plakietek
 * zakładek, ale tabela rysowała ZAWSZE `groupedTasks.all`
 * (`MyTasksListContent.tsx:2087` i `:2178`). Zwężały listę wyłącznie 'urgent'
 * i 'new', bo robiły to PRZED grupowaniem — dokładnie „wszystkie filtry oprócz
 * Pilne". Stąd też rozjazd „licznik 0, a wiersze są".
 */
import { describe, expect, it } from 'vitest';

import { categorizeTask, selectTasksForFilter } from '../MyTasksListContent';

const dzien = (przesuniecie: number): string => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + przesuniecie);
  return d.toISOString();
};

const zadanie = (nadpisania: Record<string, unknown> = {}): any => ({
  id: 'z1',
  title: 'Nowe zadanie',
  status: 'todo',
  priority: 'medium',
  ...nadpisania,
});

describe('K-31 — zadanie bez terminu nie wpada do kubełków czasowych', () => {
  it('brak terminu → „no-date", nie „overdue" ani „today"', () => {
    expect(categorizeTask(zadanie({ dueDate: undefined }))).toBe('no-date');
    expect(categorizeTask(zadanie({ dueDate: null }))).toBe('no-date');
    expect(categorizeTask(zadanie({ dueDate: '' }))).toBe('no-date');
  });

  it('kubełki z terminem liczą się nadal poprawnie', () => {
    expect(categorizeTask(zadanie({ dueDate: dzien(-3) }))).toBe('overdue');
    expect(categorizeTask(zadanie({ dueDate: dzien(0) }))).toBe('today');
    expect(categorizeTask(zadanie({ dueDate: dzien(3) }))).toBe('week');
    expect(categorizeTask(zadanie({ dueDate: dzien(30) }))).toBe('later');
  });
});

describe('K-31 — filtr zakładki naprawdę zwęża listę (nie tylko licznik)', () => {
  const grupy = {
    all: ['zalegle', 'dzisiaj', 'tydzien', 'pozniej', 'bez-terminu'],
    overdue: ['zalegle'],
    today: ['dzisiaj'],
    week: ['tydzien'],
    later: ['pozniej'],
    'no-date': ['bez-terminu'],
  } as Record<string, string[]>;

  it('„Zaległe" pokazuje TYLKO zaległe — zadanie bez terminu tam nie wchodzi', () => {
    const widoczne = selectTasksForFilter(grupy as any, 'overdue' as any);
    expect(widoczne).toEqual(['zalegle']);
    expect(widoczne).not.toContain('bez-terminu');
  });

  it('„Dzisiaj" i „Ten tydzień" też zwężają', () => {
    expect(selectTasksForFilter(grupy as any, 'today' as any)).toEqual(['dzisiaj']);
    expect(selectTasksForFilter(grupy as any, 'week' as any)).toEqual(['tydzien']);
  });

  it('„Wszystkie" nadal pokazuje wszystko, w tym zadanie bez terminu', () => {
    expect(selectTasksForFilter(grupy as any, 'all' as any)).toContain('bez-terminu');
  });

  it('„Pilne"/„Nowe" biorą kubełek all (zwężony wcześniej po priorytecie)', () => {
    expect(selectTasksForFilter(grupy as any, 'urgent' as any)).toBe(grupy.all);
    expect(selectTasksForFilter(grupy as any, 'new' as any)).toBe(grupy.all);
  });
});
