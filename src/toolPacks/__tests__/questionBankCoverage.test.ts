import { describe, expect, it } from 'vitest';

import {
  DYNAMIC_SWOT_QUESTION_BANK,
  validateSwotQuestionBank,
  type SwotQuadrant,
} from '@/config/swot/dynamicSwotQuestionBank';
import { dynamicSwotPack } from '../packs/dynamicSwot.pack';

/**
 * Odpowiedź na zarzut z review Codexa:
 * „Dynamic SWOT nie może być PACK_COMPLETE tylko dlatego, że ma pięć pytań
 *  sterujących. Jeżeli pięć pytań jest celowym indeksem do banku, zakoduj tę
 *  relację i przetestuj."
 *
 * Relacja jest zakodowana w `dynamicSwotPack.engine`. Ten test weryfikuje ją
 * wobec REALNEGO modułu banku — nie wobec opisu w komentarzu.
 */
describe('pokrycie banku pytań — Dynamic SWOT', () => {
  const bank = DYNAMIC_SWOT_QUESTION_BANK;
  const quadrants = Object.keys(bank) as SwotQuadrant[];
  const allNodes = quadrants.flatMap((q) => bank[q]);

  it('realny bank ma dokładnie tyle węzłów, ile deklaruje pack', () => {
    expect(allNodes).toHaveLength(dynamicSwotPack.engine!.expectedQuestionNodeCount);
  });

  it('bank pokrywa wszystkie cztery ćwiartki SWOT', () => {
    expect(quadrants.sort()).toEqual(['opportunities', 'strengths', 'threats', 'weaknesses']);
  });

  it('każda ćwiartka ma pełną drabinkę pogłębiania', () => {
    quadrants.forEach((q) => {
      expect(bank[q].length, `ćwiartka ${q} ma niepełną drabinkę`).toBeGreaterThanOrEqual(4);
    });
  });

  // Drabinka NIE jest równa 4x4 — s2 rozgałęzia się na dwie ścieżki dowodu.
  it('ćwiartka strengths ma rozgałęzienie na poziomie s2', () => {
    const ids = bank.strengths.map((n) => n.id);
    expect(ids).toContain('s2-commercial-proof');
    expect(ids).toContain('s2-external-proof');
    expect(bank.strengths).toHaveLength(5);
  });

  it('bank przechodzi własny walidator spójności', () => {
    // Silnik ma własny walidator drabinki — pusta lista = brak błędów.
    expect(validateSwotQuestionBank()).toEqual([]);
  });

  it('węzły banku mają unikalne identyfikatory', () => {
    const ids = allNodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // To jest sedno relacji: pack NIE duplikuje banku, tylko go indeksuje.
  it('pack deklaruje fazę obsługiwaną przez bank i faza ta istnieje', () => {
    const backed = dynamicSwotPack.engine!.bankBackedPhaseIds;
    expect(backed.length).toBeGreaterThan(0);
    const phaseIds = dynamicSwotPack.phases.map((p) => p.id);
    backed.forEach((id) => expect(phaseIds).toContain(id));
  });

  it('pytania packa są indeksem faz — po jednym na fazę, bez duplikatów', () => {
    const phaseIds = dynamicSwotPack.phases.map((p) => p.id);
    const questionPhases = dynamicSwotPack.questions.map((q) => q.phaseId);
    // każda faza ma pytanie ramujące
    phaseIds.forEach((id) => expect(questionPhases).toContain(id));
    // i żadna nie ma dwóch
    expect(new Set(questionPhases).size).toBe(questionPhases.length);
  });

  it('pack wskazuje istniejący moduł banku pytań', () => {
    expect(dynamicSwotPack.engine!.questionBankModule).toBe(
      'src/config/swot/dynamicSwotQuestionBank.ts'
    );
  });

  // Gdyby ktoś rozbudował bank i nie zaktualizował packa, powyższy test liczby
  // węzłów pęknie — o to chodzi. Ten test dokumentuje intencję wprost.
  it('rozjazd pack ↔ bank jest wykrywalny', () => {
    const declared = dynamicSwotPack.engine!.expectedQuestionNodeCount;
    const actual = allNodes.length;
    expect(
      declared,
      `Pack deklaruje ${declared} węzłów, bank ma ${actual}. Zaktualizuj engine.expectedQuestionNodeCount.`
    ).toBe(actual);
  });
});
