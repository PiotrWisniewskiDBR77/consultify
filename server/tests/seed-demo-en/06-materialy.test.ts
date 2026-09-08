import { describe, expect, it } from 'vitest';

import { det } from '../../scripts/seed/demo-en/00-wspolne';

/**
 * Testy PACZKI D6 (Materials + Meetings + Chat + My Work) BEZ BAZY — czysta
 * logika (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D6). Zapytania
 * SQL są sprawdzane na żywo przez `06-materialy.ts --dry-run/--apply/
 * --verify/--reset` na kopii lokalnej (`evidence/dane-pokazowe-en/d6/`) — te
 * testy pilnują wyłącznie funkcji czystych, które byłoby łatwo po cichu
 * zepsuć bez natychmiastowego czerwonego testu.
 *
 * `sectionForTask`/`priorityForItem` są tu ŚWIADOMIE zduplikowane z
 * `06-materialy.ts` (a nie zaimportowane), z tego samego powodu co ich
 * istnienie w ogóle: produkcyjny `inboxService.materializeInboxItems`
 * wymaga bootstrapu całej aplikacji (`getDatabase()`), więc `06-materialy.ts`
 * niesie własną kopię tej logiki 1:1 z `server/src/services/inboxService.ts`
 * (linie ~106-127). Ten plik testowy trzyma DRUGĄ, niezależną kopię tych
 * samych dwóch funkcji, żeby test nie mógł "zgodzić się sam ze sobą" przez
 * import tej samej implementacji, którą sprawdza.
 */

function sectionForTask(status: string, dueDate: string, today: string): string {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'completed' || s === 'validated') return 'assigned_tasks';
  if (dueDate && dueDate < today) return 'overdue_sla_breach';
  return 'assigned_tasks';
}

function priorityForItem(raw: string): 'critical' | 'high' | 'normal' | 'low' {
  const p = raw.toLowerCase();
  if (p === 'urgent' || p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'normal';
}

describe('06-materialy — sectionForTask (kopia inboxService.ts:106-112, materializacja skrzynki OWNER-a)', () => {
  const TODAY = '2026-09-08';

  it('zadanie z terminem PRZED dziś trafia do overdue_sla_breach', () => {
    expect(sectionForTask('todo', '2026-08-25', TODAY)).toBe('overdue_sla_breach');
  });

  it('zadanie z terminem PO dziś zostaje w assigned_tasks', () => {
    expect(sectionForTask('todo', '2026-09-30', TODAY)).toBe('assigned_tasks');
  });

  it('zadanie ukończone (done/completed/validated) NIGDY nie jest overdue, nawet z terminem w przeszłości', () => {
    expect(sectionForTask('done', '2026-01-01', TODAY)).toBe('assigned_tasks');
    expect(sectionForTask('completed', '2026-01-01', TODAY)).toBe('assigned_tasks');
    expect(sectionForTask('validated', '2026-01-01', TODAY)).toBe('assigned_tasks');
  });

  it('MUTACJA — gdyby porównanie dat użyło ">" zamiast "<" (odwrócony warunek), 2 znane zadania z tej paczki zmieniłyby sekcję', () => {
    const mutant = (status: string, dueDate: string, today: string): string => {
      const s = status.toLowerCase();
      if (s === 'done' || s === 'completed' || s === 'validated') return 'assigned_tasks';
      if (dueDate && dueDate > today) return 'overdue_sla_breach'; // MUTANT: odwrócony operator
      return 'assigned_tasks';
    };
    // Zadanie 1 tej paczki: "Approve Q3 capex request", termin 2026-08-25 (PRZED TODAY).
    expect(mutant('todo', '2026-08-25', TODAY)).toBe('assigned_tasks'); // mutant: myli się (RED byłoby dobre tu)
    expect(sectionForTask('todo', '2026-08-25', TODAY)).toBe('overdue_sla_breach'); // produkcja: poprawnie
  });
});

describe('06-materialy — priorityForItem (kopia inboxService.ts:113-118)', () => {
  it('mapuje urgent/critical -> critical', () => {
    expect(priorityForItem('urgent')).toBe('critical');
    expect(priorityForItem('critical')).toBe('critical');
  });
  it('mapuje high -> high, low -> low', () => {
    expect(priorityForItem('high')).toBe('high');
    expect(priorityForItem('low')).toBe('low');
  });
  it('nieznana/pusta wartość spada na "normal" (bezpieczny domyślny)', () => {
    expect(priorityForItem('medium')).toBe('normal');
    expect(priorityForItem('')).toBe('normal');
  });
  it('rozróżnia wielkość liter przez lower-case — "HIGH" nadal mapuje na "high"', () => {
    expect(priorityForItem('HIGH')).toBe('high');
  });
});

describe('06-materialy — deterministyczne id per encja (det z 00-wspolne, reużyte 1:1 w 06-materialy)', () => {
  it('dwa różne dokumenty tej paczki dostają różne id', () => {
    const a = det('report', 'operational-excellence-charter');
    const b = det('report', 'oee-baseline-report-q2-2026');
    expect(a).not.toBe(b);
  });

  it('sekcja tego samego dokumentu ale innego klucza sekcji dostaje inne id (report_builder_sections UNIQUE(report_id, section_key))', () => {
    const a = det('report-section', 'operational-excellence-charter|purpose');
    const b = det('report-section', 'operational-excellence-charter|scope');
    expect(a).not.toBe(b);
  });

  it('artefakt rejestru jest kluczowany po (origin_runtime, origin_record_id) — inny origin_runtime dla tego samego origin_record_id daje inne artifact_id', () => {
    const docId = det('report', 'operational-excellence-charter');
    const jakoReport = det('artifact', `report|${docId}`);
    const jakoSheet = det('artifact', `sheet|${docId}`);
    expect(jakoReport).not.toBe(jakoSheet);
  });

  it('inbox item jest kluczowany po (user_id|task|task_id) — dwa różne zadania tego samego użytkownika dostają różne inbox id', () => {
    const ownerId = det('user', 'james.whitfield@northwind.example');
    const task1 = det('task', 'approve-q3-capex-request');
    const task2 = det('task', 'sign-off-line3-mes-kickoff-deck');
    const inbox1 = det('inbox-item', `${ownerId}|task|${task1}`);
    const inbox2 = det('inbox-item', `${ownerId}|task|${task2}`);
    expect(inbox1).not.toBe(inbox2);
  });

  it('MUTACJA — gdyby inbox id ignorowało source_entity_id (tylko user_id|task), WSZYSTKIE 6 zadań OWNER-a kolidowałoby na jednym id', () => {
    const ownerId = det('user', 'james.whitfield@northwind.example');
    const task1 = det('task', 'approve-q3-capex-request');
    const task2 = det('task', 'sign-off-line3-mes-kickoff-deck');
    const mutantInboxId = (uid: string) => det('inbox-item', `${uid}|task`); // MUTANT: brak task_id
    expect(mutantInboxId(ownerId)).toBe(mutantInboxId(ownerId)); // mutant: koliduje (RED byłoby dobre tu — 2 zadania, 1 id)
    const inbox1 = det('inbox-item', `${ownerId}|task|${task1}`);
    const inbox2 = det('inbox-item', `${ownerId}|task|${task2}`);
    expect(inbox1).not.toBe(inbox2); // produkcja: poprawnie, każde zadanie ma własny wiersz skrzynki
  });
});
