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

import { categorizeTask } from '../MyTasksListContent';
import { countTaskHubFilters, filterTasksForHub, parseTaskHubDate } from '../taskHubFilter';

const NOW = new Date(2026, 8, 16, 12, 0, 0); // Wednesday, local time.

const dzien = (przesuniecie: number): string => {
  const d = new Date(NOW);
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
    expect(categorizeTask(zadanie({ dueDate: dzien(-3) }), NOW)).toBe('overdue');
    expect(categorizeTask(zadanie({ dueDate: dzien(0) }), NOW)).toBe('today');
    expect(categorizeTask(zadanie({ dueDate: dzien(3) }), NOW)).toBe('week');
    expect(categorizeTask(zadanie({ dueDate: dzien(30) }), NOW)).toBe('later');
  });

  it('„Ten tydzień" kończy się w niedzielę i nie obejmuje kolejnego poniedziałku', () => {
    expect(categorizeTask(zadanie({ dueDate: dzien(4) }), NOW)).toBe('week');
    expect(categorizeTask(zadanie({ dueDate: dzien(5) }), NOW)).toBe('later');
  });
});

describe('K-31 — terminy DATE pozostają lokalnym dniem', () => {
  it('nie przesuwa YYYY-MM-DD z Today do Overdue w ujemnej strefie czasowej', () => {
    const localNoon = new Date(2026, 8, 17, 12, 0, 0);
    const task = zadanie({ dueDate: '2026-09-17' });

    expect(categorizeTask(task, localNoon)).toBe('today');
  });

  it('formatuje etykietę YYYY-MM-DD jako ten sam lokalny dzień', () => {
    const date = parseTaskHubDate('2026-09-17');

    expect(date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).toBe('Sep 17');
  });
});

describe('K-31 — filtr zakładki naprawdę zwęża listę (nie tylko licznik)', () => {
  const zadania = [
    zadanie({ id: 'zalegle', dueDate: dzien(-2) }),
    zadanie({ id: 'dzisiaj', dueDate: dzien(0) }),
    zadanie({ id: 'tydzien', dueDate: dzien(3) }),
    zadanie({ id: 'pozniej', dueDate: dzien(30) }),
    zadanie({ id: 'bez-terminu', dueDate: undefined }),
  ];

  it('„Zaległe" pokazuje TYLKO zaległe — zadanie bez terminu tam nie wchodzi', () => {
    const widoczne = filterTasksForHub(zadania, 'overdue', { now: NOW });
    expect(widoczne.map((task) => task.id)).toEqual(['zalegle']);
    expect(widoczne.map((task) => task.id)).not.toContain('bez-terminu');
  });

  it('„Dzisiaj" i „Ten tydzień" też zwężają', () => {
    expect(filterTasksForHub(zadania, 'today', { now: NOW }).map((task) => task.id)).toEqual([
      'dzisiaj',
    ]);
    expect(filterTasksForHub(zadania, 'week', { now: NOW }).map((task) => task.id)).toEqual([
      'tydzien',
    ]);
  });

  it('„Wszystkie" nadal pokazuje wszystko, w tym zadanie bez terminu', () => {
    expect(filterTasksForHub(zadania, 'all').map((task) => task.id)).toContain('bez-terminu');
  });

  it('„Pilne" i „Nowe" używają tego samego predykatu co pozostałe powierzchnie', () => {
    const pilne = zadanie({ id: 'pilne', priority: 'high' });
    const nowe = zadanie({ id: 'nowe', createdAt: NOW.toISOString() });
    expect(filterTasksForHub([...zadania, pilne], 'urgent').map((task) => task.id)).toEqual([
      'pilne',
    ]);
    expect(
      filterTasksForHub([...zadania, nowe], 'new', { now: NOW }).map((task) => task.id)
    ).toEqual(['nowe']);
  });

  it('triage natychmiast usuwa zadanie z New i z kanonicznego licznika', () => {
    const nowe = zadanie({ id: 'nowe', createdAt: NOW.toISOString() });
    const przed = countTaskHubFilters([nowe], { now: NOW, triagedTaskIds: new Set() });
    const po = countTaskHubFilters([nowe], { now: NOW, triagedTaskIds: new Set(['nowe']) });

    expect(przed.newUntriaged).toBe(1);
    expect(po.newUntriaged).toBe(0);
    expect(
      filterTasksForHub([nowe], 'new', { now: NOW, triagedTaskIds: new Set(['nowe']) })
    ).toEqual([]);
  });

  it('Today/Week/Urgent mają ten sam kanoniczny wynik i liczniki', () => {
    const pilne = zadanie({ id: 'pilne', priority: 'critical', dueDate: dzien(30) });
    const wszystkie = [...zadania, pilne];
    const counts = countTaskHubFilters(wszystkie, { now: NOW });

    expect(filterTasksForHub(wszystkie, 'today', { now: NOW })).toHaveLength(counts.today);
    expect(filterTasksForHub(wszystkie, 'week', { now: NOW })).toHaveLength(counts.week);
    expect(filterTasksForHub(wszystkie, 'urgent', { now: NOW })).toHaveLength(counts.urgent);
  });
});
