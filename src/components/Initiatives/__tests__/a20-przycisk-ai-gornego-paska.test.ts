import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildFallbackGateReadiness,
  GATE_READINESS_FALLBACK_SOURCE,
} from '../gateReadinessFallback';

const ROOT = process.cwd();
const cardSource = () =>
  fs.readFileSync(path.join(ROOT, 'src/components/Initiatives/InitiativeDocumentView.tsx'), 'utf8');

/**
 * A20 (uwaga właściciela 2026-09-05): „brak przycisku AI w górnym pasku do
 * wypełnienia karty".
 *
 * ZMIERZONE na żywej aplikacji (2026-09-05, rekord „Pełna identyfikowalność
 * partii", `evidence/inicjatywy-tabela-20260905/`):
 *   - przyciski „Wypełnij z AI" i „Analizuj z AI" ISTNIEJĄ w Menu 2 karty,
 *     ale sonda zwracała `disabled: true` dla obu — razem z „Zapytaj Teresę";
 *   - przełączenie Podgląd → Edycja NIC nie zmieniało (zrzut 03), więc to nie
 *     był `readMode`;
 *   - przebieg sieciowy: 404 na `/api/v8/planning/.../gate-readiness-check`
 *     ORAZ na `/api/initiatives/.../gate-readiness-check`.
 * Stąd `gateReadiness === null` → `canUseAi = !!undefined` → przycisk martwy.
 */
describe('A20 — przycisk AI górnego paska karty inicjatywy', () => {
  it('bez zdania serwera odblokowuje AI dla rekordu, który nie jest terminalny', () => {
    const caps = buildFallbackGateReadiness('IN_EXECUTION')!.capabilities!;
    expect(caps.ctaBar.canUseAi).toBe(true);
    expect(caps.cards?.canEditCards).toBe(true);
    expect(caps.ctaBar.aiAllowedSectionKeys).toEqual(['*']);
  });

  it('zachowuje regułę serwera: rekord terminalny NIE dostaje AI', () => {
    // Parytet z server/src/services/initiative/initiativeCapabilityMatrix.ts:116
    for (const terminal of ['CANCELLED', 'ARCHIVED']) {
      const caps = buildFallbackGateReadiness(terminal)!.capabilities!;
      expect(caps.ctaBar.canUseAi).toBe(false);
      expect(caps.ctaBar.aiAllowedSectionKeys).toEqual([]);
      expect(caps.cards?.reasonCode).toBe('NO_EDIT_PERMISSION_FOR_STATUS_OR_ROLE');
    }
  });

  it('oznacza się jako wyliczone lokalnie, żeby nie udawać kontraktu serwera', () => {
    expect(buildFallbackGateReadiness('DRAFT')!.capabilities!.source).toBe(
      GATE_READINESS_FALLBACK_SOURCE
    );
    expect(GATE_READINESS_FALLBACK_SOURCE).not.toBe('backend');
  });

  it('karta wpina fallback w gałąź błędu gate-readiness, a nie zeruje zdolności', () => {
    const source = cardSource();
    const fetchAt = source.indexOf('V8PlanningApi.getGateReadiness(initiativeId)');
    expect(fetchAt).toBeGreaterThan(-1);
    const branch = source.slice(fetchAt, fetchAt + 2000);
    expect(branch).toContain('buildFallbackGateReadiness(initiativeStatusRef.current)');
    // Regresja A20: powrót do `setGateReadiness(null)` gasi przycisk AI.
    expect(branch).not.toContain('setGateReadiness(null)');
    // Pusta odpowiedź (200 bez `capabilities`) też musi trafiać w fallback.
    expect(branch).toContain('GATE_READINESS_WITHOUT_CAPABILITIES');
  });
});
