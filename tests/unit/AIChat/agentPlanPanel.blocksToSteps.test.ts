/**
 * AgentPlanPanel — blocksToSteps / stepsToBlocks unit tests (AGT-008).
 *
 * KRYTERIUM ODBIORU AGT-008 (rejestr/1-OTWARTE/AGT-008-klocki-typy-wejscie-vault.md
 * §4, doprecyzowane w zleceniu wykonawcy): nowo dodany klocek w canvas NIESIE
 * WYBRANE przez usera narzędzie do wykonania planu (nie sztywny, niewidoczny
 * fallback `search_knowledge_base` — to był PROBLEM zastany, patrz nagłówek
 * `blocksToSteps` w AgentPlanPanel.tsx). Klocek "Vault-kontekst" produkuje
 * krok niosący wybrany poziom sejfu (`vault_scope`/`vault_project_id`).
 * Przestawianie/usuwanie istniejących klocków (dopasowanie po `id`) nadal
 * zachowuje pełny `toolInput` oryginalnego kroku — TEGO nie wolno zepsuć.
 *
 * Czysta logika — bez DOM, bez sieci, bez renderowania React (stąd import
 * bezpośrednio z komponentu, którego reszta się nie ćwiczy tutaj).
 */
import { describe, expect, it } from 'vitest';

import type { AgentPlanStep } from '@/services/api/agentPlan.api';

import { blocksToSteps, stepsToBlocks } from '@/components/AIChat/AgentPlanPanel';
import type { PlanSchemaBlock } from '@/components/AIChat/AgentPlanCanvas';

function makeStep(overrides: Partial<AgentPlanStep> = {}): AgentPlanStep {
  return {
    id: 'step-1',
    stepIndex: 0,
    toolName: 'search_knowledge_base',
    toolInput: { query: 'brief' },
    status: 'pending',
    requiresApproval: false,
    ...overrides,
  };
}

describe('AgentPlanPanel.blocksToSteps (AGT-008 — klocek niesie wybrane narzędzie)', () => {
  it('NOWO DODANY klocek (brak dopasowania po id) niesie WYBRANE narzędzie, nie sztywny fallback', () => {
    const block: PlanSchemaBlock = {
      id: 'block-local-new-1',
      kind: 'etap-modul',
      name: 'Rekomendacje',
      toolName: 'calculate_financial',
    };

    const [step] = blocksToSteps([block], []); // planSteps=[] => na pewno brak dopasowania po id

    expect(step.toolName).toBe('calculate_financial');
    expect(step.toolInput.phase).toBe('Rekomendacje');
  });

  it('NOWY klocek BEZ toolName (schemat sprzed AGT-008) dostaje bezpieczny fallback read-only', () => {
    const block: PlanSchemaBlock = {
      id: 'block-local-new-2',
      kind: 'etap-modul',
      name: 'Coś nowego',
    };

    const [step] = blocksToSteps([block], []);

    expect(step.toolName).toBe('search_knowledge_base');
    expect(step.toolInput.query).toBe('Coś nowego');
  });

  it('klocek "vault-kontekst" produkuje krok z wybranym poziomem sejfu (vault_scope/vault_project_id)', () => {
    const block: PlanSchemaBlock = {
      id: 'block-local-vault-1',
      kind: 'vault-kontekst',
      name: 'Kontekst klienta',
      toolName: 'search_knowledge_base',
      toolInput: {
        vault_safe_id: 'project:proj-42',
        vault_scope: 'project',
        vault_project_id: 'proj-42',
        vault_safe_name: 'Elkomtech',
      },
    };

    const [step] = blocksToSteps([block], []);

    expect(step.toolName).toBe('search_knowledge_base');
    expect(step.toolInput.vault_scope).toBe('project');
    expect(step.toolInput.vault_project_id).toBe('proj-42');
    // query domyślnie z nazwy klocka, gdy brak jawnego query — retrieval musi
    // dostać JAKIŚ tekst wyszukiwania w tym sejfie.
    expect(step.toolInput.query).toBe('Kontekst klienta');
  });

  it('klocek "vault-kontekst" z poziomem "user" (Mój sejf) nie niesie project_id', () => {
    const block: PlanSchemaBlock = {
      id: 'block-local-vault-2',
      kind: 'vault-kontekst',
      name: 'Prywatne notatki',
      toolName: 'search_knowledge_base',
      toolInput: {
        vault_safe_id: 'user',
        vault_scope: 'user',
        vault_project_id: null,
        vault_safe_name: 'Mój sejf',
      },
    };

    const [step] = blocksToSteps([block], []);

    expect(step.toolInput.vault_scope).toBe('user');
    expect(step.toolInput.vault_project_id).toBeNull();
  });

  it('PRZESTAWIENIE istniejącego klocka (dopasowanie po id) zachowuje pełny toolInput oryginalnego kroku', () => {
    const existingStep = makeStep({
      id: 'step-diag',
      toolName: 'get_assessment_data',
      toolInput: { include_benchmarks: true, axis: 'cybersecurity' },
    });
    const block: PlanSchemaBlock = {
      id: 'step-diag', // dopasowanie po id — krok już istnieje na planie
      kind: 'etap-modul',
      name: 'Diagnoza',
      // Nawet gdyby canvas miał inny toolName na bloku, dopasowany krok WYGRYWA
      // (kolejność pierwszeństwa opisana w nagłówku blocksToSteps).
      toolName: 'calculate_financial',
    };

    const [step] = blocksToSteps([block], [existingStep]);

    expect(step.toolName).toBe('get_assessment_data');
    expect(step.toolInput.include_benchmarks).toBe(true);
    expect(step.toolInput.axis).toBe('cybersecurity');
    expect(step.toolInput.phase).toBe('Diagnoza');
  });

  it('USUNIĘCIE klocka ze środka nie wpływa na toolInput pozostałych dopasowanych kroków', () => {
    const step1 = makeStep({ id: 's1', toolName: 'search_knowledge_base', toolInput: { query: 'a' } });
    const step2 = makeStep({ id: 's2', toolName: 'get_assessment_data', toolInput: { axis: 'x' } });
    const step3 = makeStep({
      id: 's3',
      toolName: 'calculate_financial',
      toolInput: { calculation_type: 'roi' },
    });
    const blocksAfterRemovingMiddle: PlanSchemaBlock[] = [
      { id: 's1', kind: 'etap-modul', name: 'Wejście' },
      { id: 's3', kind: 'etap-modul', name: 'Rekomendacje' },
    ];

    const steps = blocksToSteps(blocksAfterRemovingMiddle, [step1, step2, step3]);

    expect(steps).toHaveLength(2);
    expect(steps[0].toolName).toBe('search_knowledge_base');
    expect(steps[0].toolInput.query).toBe('a');
    expect(steps[1].toolName).toBe('calculate_financial');
    expect(steps[1].toolInput.calculation_type).toBe('roi');
  });

  it('stepsToBlocks przenosi toolName/toolInput na blok (round-trip zachowuje wybór usera po przeładowaniu)', () => {
    const step = makeStep({
      id: 's-vault',
      toolName: 'search_knowledge_base',
      toolInput: {
        blockKind: 'vault-kontekst',
        vault_scope: 'organization',
        vault_safe_id: 'organization',
        vault_safe_name: 'Sejf organizacji',
      },
    });

    const [block] = stepsToBlocks([step]);

    expect(block.kind).toBe('vault-kontekst');
    expect(block.toolName).toBe('search_knowledge_base');
    expect(block.toolInput?.vault_scope).toBe('organization');
    expect(block.toolInput?.vault_safe_name).toBe('Sejf organizacji');
  });
});
