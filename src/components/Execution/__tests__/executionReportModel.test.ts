/**
 * 1.12-R4 — katalog raportów i migawka na realnych danych.
 *
 * Trzy rzeczy pilnowane tutaj, bo każda z nich już raz poszła źle w tym module:
 *  1. MVP to DOKŁADNIE cztery definicje, po jednej na poziom (DECYZJA CTO, C5 pytanie 4);
 *  2. ich nazwy na ekranie są PO POLSKU — mutacja „angielski tytuł" ma dać RED;
 *  3. migawka zbudowana z realnych kształtów odpowiedzi API ma sekcje Z DANYMI,
 *     a sekcja bez danych ma JAWNĄ etykietę zamiast niemej pustki.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildExecutionReportSnapshot,
  type ExecutionReportInputs,
} from '../executionReportModel';

// Uwaga: `new URL(..., import.meta.url)` wywraca się w środowisku jsdom
// („'toString' called on an object that is not a valid instance of Location"),
// dlatego ścieżka liczona jest od katalogu uruchomienia.
const locales = (lang: string) =>
  JSON.parse(
    readFileSync(path.resolve(process.cwd(), `public/locales/${lang}/translation.json`), 'utf8')
  ) as any;
const pl = locales('pl');
const en = locales('en');

const MVP_KEYS = ['initiative-card', 'weekly-exec', 'program-health', 'sponsor-onepager'];

/** Prosty tłumacz testowy: czyta ten sam plik pl, którego używa aplikacja. */
const t = (key: string, fallback: string, options?: Record<string, unknown>): string => {
  const value = key.split('.').reduce<any>((acc, part) => (acc == null ? acc : acc[part]), pl);
  let out = typeof value === 'string' ? value : fallback;
  for (const [name, replacement] of Object.entries(options ?? {})) {
    out = out.replace(new RegExp(`{{${name}}}`, 'g'), String(replacement));
  }
  return out;
};

const iso = (value: string) => new Date(value).toISOString();
const period = { start: iso('2026-08-31T00:00:00Z'), end: iso('2026-09-07T00:00:00Z') };
const asOf = iso('2026-09-06T12:00:00Z');

/** Kształty 1:1 z odpowiedziami API zmierzonymi 06.09 na org DBR77. */
const inputs: ExecutionReportInputs = {
  initiatives: [
    {
      id: 'init-1',
      name: 'Compliance &amp; GDPR Audit',
      status: 'IN_EXECUTION',
      progress: 72,
      plannedEndDate: iso('2026-09-20T00:00:00Z'),
      ownerExecution: { firstName: 'Katarzyna', lastName: 'Wójcik' },
    },
    { id: 'init-2', name: 'Legacy Decommission', status: 'IN_EXECUTION', progress: 35 },
    { id: 'init-3', name: 'Pomysł w szufladzie', status: 'DRAFT', progress: 0 },
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Zamknąć lukę w monitoringu',
      status: 'blocked',
      dueDate: iso('2026-09-01T00:00:00Z'),
      assignee: { firstName: 'Anna', lastName: 'Kowalska' },
    },
    {
      id: 'task-2',
      title: 'Zadanie domknięte',
      status: 'done',
      updatedAt: iso('2026-09-03T00:00:00Z'),
    },
  ],
  decisions: [
    {
      id: 'dec-1',
      title: 'Zatwierdzić przesunięcie terminu SAP',
      status: 'ESCALATED',
      ownerName: 'Marek Nowak',
      dueDate: iso('2026-08-24T00:00:00Z'),
      isOverdue: true,
      daysOverdue: 12,
      escalationLevel: 2,
      escalationLevelName: 'RED',
    },
  ],
  raid: [
    {
      id: 'raid-1',
      title: 'Zależność od dostawcy',
      type: 'DEPENDENCY',
      status: 'OPEN',
      severity: 'HIGH',
      riskScore: 12,
    },
  ],
  signals: [
    {
      id: 'sig-1',
      entityId: 'init-2',
      entityName: 'Legacy Decommission',
      severity: 'CRITICAL',
      deviationType: 'LATE_START',
      daysDeviation: 40,
      whySlipReasons: [{ reason: 'RAID_HIGH_RISK', detail: '1 high/critical risk(s) active' }],
    },
  ],
  unavailable: [],
};

const build = (definitionKey: string, definitionName = 'Raport') =>
  buildExecutionReportSnapshot({ definitionKey, definitionName, period, asOf, inputs, t });

describe('1.12-R4 — katalog czterech definicji MVP', () => {
  it('ma dokładnie cztery klucze MVP i każdy z nich ma polską nazwę', () => {
    expect(MVP_KEYS).toHaveLength(4);
    for (const key of MVP_KEYS) {
      const name = pl.executionReports.definitions[key]?.name;
      expect(name, `brak nazwy PL dla ${key}`).toBeTruthy();
      // MUTACJA: podmiana tej nazwy na angielski oryginał z bazy (np. „Weekly Execution
      // Pack") musi dać RED — inaczej test nie broni niczego. Sprawdzamy trzy rzeczy:
      // nazwa różni się od angielskiej, nie zawiera typowych angielskich słów katalogu
      // i niesie polską ortografię tam, gdzie powinna.
      const enName = en.executionReports.definitions[key]?.name;
      expect(name).not.toBe(enName);
      expect(name).not.toMatch(
        /\b(Report|Pack|Summary|Review|One-Pager|Card|Weekly|Monthly|Program Health)\b/i
      );
    }
  });

  it('wszystkie dwanaście definicji katalogu ma polską nazwę, kadencję i odbiorców', () => {
    const keys = Object.keys(pl.executionReports.definitions);
    expect(keys).toHaveLength(12);
    for (const key of keys) {
      const entry = pl.executionReports.definitions[key];
      expect(entry.cadence).toMatch(/Tygodniowo|Miesięcznie|Co 2 tygodnie|Na żądanie/);
      expect(entry.audience).toBeTruthy();
      expect(Object.keys(entry.sections)).toHaveLength(5);
      const enSections = en.executionReports.definitions[key].sections;
      for (const [index, section] of Object.entries(entry.sections) as Array<[string, string]>) {
        // MUTACJA: skopiowanie angielskiej nazwy sekcji z bazy do pl → RED.
        expect(section).not.toBe(enSections[index]);
        expect(section).not.toMatch(
          /\b(Progress|Blockers|Overdue|Milestones|Decisions|Risks|Forecast|Utilization|Aging)\b/
        );
      }
    }
  });
});

describe('1.12-R4 — migawka na realnych kształtach danych', () => {
  it('Zdrowie programu liczy RAG per inicjatywa tylko dla inicjatyw w realizacji', () => {
    const snapshot = build('program-health', 'Zdrowie programu');
    const rag = snapshot.sections.find((section) => section.id === 'rag');
    expect(rag?.table?.rows).toHaveLength(2); // DRAFT nie wchodzi
    expect(rag?.table?.rows[0].title).toBe('Compliance & GDPR Audit'); // encja odkodowana
    expect(rag?.table?.rows.map((row) => row.rag)).toContain('Czerwony');
    expect(rag?.empty).toBeUndefined();
  });

  it('alerty biorą powód z KODU sygnału, nie z angielskiego zdania serwera', () => {
    const snapshot = build('program-health', 'Zdrowie programu');
    const alerts = snapshot.sections.find((section) => section.id === 'alerts');
    expect(alerts?.bullets?.[0]).toContain('Legacy Decommission');
    expect(alerts?.bullets?.[0]).toContain('aktywne ryzyko wysokie lub krytyczne');
    expect(alerts?.bullets?.[0]).not.toContain('high/critical');
  });

  it('Tygodniowy pakiet ma tabelę blokad i decyzji po terminie z realnych rekordów', () => {
    const snapshot = build('weekly-exec', 'Tygodniowy pakiet realizacji');
    const blockers = snapshot.sections.find((section) => section.id === 'blockers');
    expect(blockers?.table?.rows[0].title).toBe('Zamknąć lukę w monitoringu');
    expect(blockers?.table?.rows[0].status).toBe('Zablokowane');
    const decisions = snapshot.sections.find((section) => section.id === 'decisions');
    expect(decisions?.table?.rows[0].overdue).toBe('12 dni');
    expect(decisions?.table?.rows[0].escalation).toBe('Czerwona');
  });

  it('RAG całego raportu jest czerwony, gdy są blokady i sygnały krytyczne', () => {
    expect(build('sponsor-onepager', 'Jedna strona dla sponsora').rag).toBe('RED');
  });

  it('sekcja bez danych dostaje JAWNĄ etykietę, a nie niemą pustkę', () => {
    const pusty: ExecutionReportInputs = {
      initiatives: [],
      tasks: [],
      decisions: [],
      raid: [],
      signals: [],
      unavailable: ['tasks', 'decisions'],
    };
    const snapshot = buildExecutionReportSnapshot({
      definitionKey: 'initiative-card',
      definitionName: 'Karta realizacji',
      period,
      asOf,
      inputs: pusty,
      t,
    });
    expect(snapshot.rag).toBe('GREY');
    const overdue = snapshot.sections.find((section) => section.id === 'overdue');
    expect(overdue?.empty).toBe('Brak danych — źródło nie odpowiedziało.');
  });

  it('definicja z Fali 2 nie generuje treści, tylko jawny komunikat', () => {
    const snapshot = build('capacity-utilization', 'Obłożenie zasobów');
    expect(snapshot.sections).toHaveLength(1);
    expect(snapshot.sections[0].title).toBe(pl.executionReports.wave2.title);
    expect(snapshot.sections[0].empty).toBe(pl.executionReports.wave2.body);
  });
});
