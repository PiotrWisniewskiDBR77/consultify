/**
 * @vitest-environment node
 *
 * P12-int-b / DEC-424 — `InitiativeDetailModal` czytał słownik 13.
 *
 * POMIAR (evidence/p12int/pomiar-resztek-slownika.txt, sekcja C): linie
 * 460/466/542 i 2265-2384 porównywały `initiative.status` z literałami
 * 'PLANNING' · 'REVIEW' · 'EXECUTING' · 'BLOCKED' · 'DONE' · 'ARCHIVED' ·
 * 'CANCELLED'. Po migracji `20262103_p12_initiative_status_slownik.sql`
 * kolumna `initiatives.status` trzyma WYŁĄCZNIE 7 kodów
 * (PROPOSED·DRAFT·PENDING_APPROVAL·APPROVED·IN_EXECUTION·CLOSED·REJECTED),
 * więc ŻADEN z tych warunków nie mógł już trafić: pasek modułów nie
 * podświetlał kroku, stepper zatwierdzeń był pusty, a kolor statusu zawsze
 * schodził do gałęzi `else` (żółty „w toku").
 *
 * Modal jest za ciężki do zamontowania (3 tys. linii, Api + i18n + 6
 * podkomponentów), więc — jak reszta rodziny (`ExecutionHub.*.source.test.ts`)
 * — regresję blokujemy na źródle.
 *
 * MUTACJA (dowód): przywrócenie w bloku steppera literału `'EXECUTING'`
 * albo w pasku modułów `statuses: ['PLANNING', 'REVIEW', 'APPROVED']`
 * wywraca odpowiednio przypadek 2 i 1.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { InitiativeStatus } from '../../../packages/shared/src/constants/initiativeStatuses.generated';

const source = readFileSync(new URL('../InitiativeDetailModal.tsx', import.meta.url), 'utf8');

const blok = (od: string, doTekstu: string): string => {
  const start = source.indexOf(od);
  expect(start, `nie znaleziono kotwicy: ${od}`).toBeGreaterThan(-1);
  const end = source.indexOf(doTekstu, start);
  return source.slice(start, end === -1 ? source.length : end);
};

/** Kody, których po migracji NIE MA w `initiatives.status`. */
const MARTWE_KODY = [
  'PENDING_REVIEW',
  'REVIEW',
  'PROMOTED',
  'PLANNING',
  'SCHEDULED',
  'EXECUTING',
  'BLOCKED',
  'DONE',
  'TRACKING',
  'ARCHIVED',
  'CANCELLED',
] as const;

describe('DEC-424 — InitiativeDetailModal na słowniku 7', () => {
  it('1) pasek modułów cyklu życia grupuje wyłącznie kody słownika 7', () => {
    const pasek = blok('{/* Module Transition Indicator */}', 'const isActive =');
    for (const kod of MARTWE_KODY) {
      expect(pasek, `pasek modułów nadal wymienia martwy kod ${kod}`).not.toContain(`'${kod}'`);
    }
    expect(pasek).toContain('InitiativeStatusCodes.IN_EXECUTION');
    expect(pasek).toContain('InitiativeStatusCodes.PENDING_APPROVAL');
    expect(pasek).toContain('InitiativeStatusCodes.CLOSED');
  });

  it('2) stepper zatwierdzeń liczy „done" po kolejności LIFECYCLE_STEPS, bez literałów', () => {
    const stepper = blok('{/* Status Timeline */}', '{/* Current Status Info */}');
    for (const kod of MARTWE_KODY) {
      expect(stepper, `stepper nadal wymienia martwy kod ${kod}`).not.toContain(`'${kod}'`);
    }
    expect(stepper).toContain('LIFECYCLE_STEPS.indexOf');
    expect(stepper).toContain('INITIATIVE_STATUS_LABEL_KEYS');
  });

  it('3) LIFECYCLE_STEPS to dokładnie ścieżka „do przodu" słownika 7 (bez REJECTED)', () => {
    const stala = blok('const LIFECYCLE_STEPS = [', '] as const;');
    const oczekiwane = [
      InitiativeStatus.PROPOSED,
      InitiativeStatus.DRAFT,
      InitiativeStatus.PENDING_APPROVAL,
      InitiativeStatus.APPROVED,
      InitiativeStatus.IN_EXECUTION,
      InitiativeStatus.CLOSED,
    ];
    for (const kod of oczekiwane) {
      expect(stala).toContain(`InitiativeStatusCodes.${kod}`);
    }
    expect(stala).not.toContain('REJECTED');
  });

  it('4) „wstrzymana" czyta flagę on_hold, nie status BLOCKED', () => {
    expect(source).not.toMatch(/initiative\.status === 'BLOCKED'/);
    expect(source).toContain('const isOnHold = Boolean(');
    expect(source).toContain('{isOnHold && (');
  });

  it('5) etykieta statusu idzie przez klucz i18n ze SSOT, nie przez namespace `status.`', () => {
    expect(source).not.toMatch(/t\(`status\.\$\{/);
    expect(source).toContain("INITIATIVE_STATUS_LABEL_KEYS[currentStatusCode] ?? 'initiatives.status.unknown'");
  });
});
