import { describe, expect, it } from 'vitest';

import { toneForState } from '../stateToneMap';

describe('toneForState — Narzędzia (P6 §3.1)', () => {
  it('kategoria "Oceny" (licensed) NIE jest critical — audyt A §N2', () => {
    expect(toneForState('discoveryToolCategory', 'licensed')).not.toBe('critical');
    expect(toneForState('discoveryToolCategory', 'licensed')).toBe('neutral');
  });

  it('pozostałe kategorie narzędzi też nie są critical', () => {
    expect(toneForState('discoveryToolCategory', 'strategic')).toBe('neutral');
    expect(toneForState('discoveryToolCategory', 'operational')).toBe('neutral');
    expect(toneForState('discoveryToolCategory', 'digital')).toBe('neutral');
    expect(toneForState('discoveryToolCategory', 'automation')).not.toBe('critical');
  });

  it('status "Nieaktywny" (inactive) jest neutral, nie critical — audyt A §N2', () => {
    expect(toneForState('discoveryToolActive', 'inactive')).toBe('neutral');
    expect(toneForState('discoveryToolActive', 'active')).toBe('positive');
  });
});

describe('toneForState — Ocena (P6 §3.2)', () => {
  it('status "Final" jest neutral (zgodny z mostem statusChipTone), nie fiolet/critical', () => {
    expect(toneForState('reportStatus', 'final')).toBe('neutral');
    expect(toneForState('reportStatus', 'draft')).toBe('neutral');
  });
});

describe('toneForState — dowód mutacyjny (P6 §6)', () => {
  it('critical jest zarezerwowany dla realnych błędów: error/blocked/overdue, nigdy dla stanów spokojnych', () => {
    expect(toneForState('genericLifecycle', 'error')).toBe('critical');
    expect(toneForState('genericLifecycle', 'blocked')).toBe('critical');
    expect(toneForState('genericLifecycle', 'overdue')).toBe('critical');
    expect(toneForState('genericLifecycle', 'failed')).toBe('critical');

    // Stany spokojne cyklu życia — jeśli ktoś kiedyś "poprawi" te wpisy na 'critical',
    // ten test musi się wywalić (to jest właśnie regresja z audytu Award 2026-09-05).
    expect(toneForState('genericLifecycle', 'inactive')).not.toBe('critical');
    expect(toneForState('genericLifecycle', 'draft')).not.toBe('critical');
    expect(toneForState('genericLifecycle', 'active')).not.toBe('critical');
  });
});

describe('toneForState — fallback bezpieczny', () => {
  it('nieznana wartość i puste wejście dają neutral, nigdy critical po cichu', () => {
    expect(toneForState('discoveryToolCategory', 'nieznana_przyszla_kategoria')).toBe('neutral');
    expect(toneForState('genericLifecycle', null)).toBe('neutral');
    expect(toneForState('genericLifecycle', undefined)).toBe('neutral');
    expect(toneForState('genericLifecycle', '')).toBe('neutral');
  });

  it('normalizuje wielkość liter i myślniki/spacje jak realne dane z UI (np. "Pending Approval")', () => {
    expect(toneForState('reportStatus', 'PENDING_APPROVAL')).toBe('warning');
    expect(toneForState('reportStatus', 'Pending Approval')).toBe('warning');
    expect(toneForState('reportStatus', 'pending-approval')).toBe('warning');
  });
});

describe('toneForState — nigdy nie zwraca tailwind `primary-*` jako klasy dla tonu primary', () => {
  it('STATE_TONE_TEXT_CLASS/CHIP_CLASS dla primary nie zawiera `primary-` (Pułapka nr 1: primary=crimson)', async () => {
    const { STATE_TONE_TEXT_CLASS, STATE_TONE_CHIP_CLASS, STATE_TONE_DOT_CLASS } = await import(
      '../stateToneMap'
    );
    expect(STATE_TONE_TEXT_CLASS.primary).not.toMatch(/\bprimary-/);
    expect(STATE_TONE_CHIP_CLASS.primary).not.toMatch(/\bprimary-/);
    expect(STATE_TONE_DOT_CLASS.primary).not.toMatch(/\bprimary-/);
    expect(STATE_TONE_TEXT_CLASS.primary).not.toContain('bg-c-accent');
  });
});
