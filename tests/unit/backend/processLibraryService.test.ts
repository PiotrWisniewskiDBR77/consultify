/**
 * processLibraryService — unit tests (AGT-006, partia 2).
 *
 * SSOT: Harvard/wdrozenie-100/_SPEC_AGENT_VAULT_2026-07-22.md §4 (PARTIA 2 —
 * generator procesu) + decyzja Piotra 2026-07-22 ("weź klasyczny konsulting
 * jako pierwszy test"). KRYTERIUM ODBIORU (AGT-006): domyślny schemat = 5 faz
 * klasycznego procesu (Kubr/ILO) we właściwej kolejności z modułami/deliverables;
 * wariant DRD (4 kroki) dostępny do wyboru. Czysta funkcja — bez DB, bez sieci.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROCESS_ID,
  PROCESS_LIBRARY,
  buildProcessPlan,
  buildStepsFromProcess,
  listProcesses,
} from '../../../server/src/services/ai/agentPlan/processLibraryService.js';
import { SIDE_EFFECT_TOOLS } from '../../../server/src/services/ai/sideEffectTools.js';

describe('processLibraryService (AGT-006 generator procesu)', () => {
  it('default = classic-5: dokładnie 5 faz klasycznych we właściwej kolejności', () => {
    // brak processId -> domyślny schemat (nowy projekt)
    const phases = buildProcessPlan();

    expect(DEFAULT_PROCESS_ID).toBe('classic-5');
    expect(phases).toHaveLength(5);
    expect(phases.map((p) => p.id)).toEqual([
      'entry',
      'diagnosis',
      'recommendations',
      'execution',
      'closing',
    ]);
    expect(phases.map((p) => p.name)).toEqual([
      'Wejście / Kontraktowanie',
      'Diagnoza',
      'Rekomendacje',
      'Wdrożenie',
      'Zamknięcie',
    ]);
  });

  it('każda faza klasyczna niesie moduł i deliverable', () => {
    const phases = buildProcessPlan('classic-5');
    for (const p of phases) {
      expect(typeof p.module).toBe('string');
      expect(p.module.length).toBeGreaterThan(0);
      expect(typeof p.deliverable).toBe('string');
      expect(p.deliverable.length).toBeGreaterThan(0);
    }
    // moduły z SPEC §4 w kolejności faz
    expect(phases.map((p) => p.module)).toEqual([
      'My Work · Chat',
      'Interview · Assessment',
      'Initiatives · Finance',
      'Execution',
      'Results · Materials',
    ]);
  });

  it('każda faza mapuje na realne narzędzie z rejestru toolDefinitions', () => {
    const knownTools = new Set([
      'search_knowledge_base',
      'get_assessment_data',
      'calculate_financial',
      'get_initiative_status',
      'generate_report_section',
      'compare_benchmarks',
    ]);
    for (const p of buildProcessPlan('classic-5')) {
      expect(knownTools.has(p.toolName)).toBe(true);
      // requiresApproval musi być spójne z rejestrem side-effect — WYJĄTEK:
      // 'recommendations' niesie jawny override (DOROBKA C, patrz test niżej).
      if (p.id !== 'recommendations') {
        expect(p.requiresApproval).toBe(SIDE_EFFECT_TOOLS.has(p.toolName));
      }
    }
  });

  it('DOROBKA C (decyzja Piotra 2026-07-23): faza Rekomendacje ma DRUGĄ bramkę akceptu, obok Zamknięcia', () => {
    const phases = buildProcessPlan('classic-5');

    const recommendations = phases.find((p) => p.id === 'recommendations');
    const closing = phases.find((p) => p.id === 'closing');

    // 'calculate_financial' sam w sobie NIE jest w SIDE_EFFECT_TOOLS (czysty
    // odczyt/kalkulacja) — requiresApproval:true tu jest jawnym override.
    expect(SIDE_EFFECT_TOOLS.has('calculate_financial')).toBe(false);
    expect(recommendations?.requiresApproval).toBe(true);
    // Zamknięcie ('generate_report_section') jest gate'owane naturalnie —
    // niezmienione przez tę dorobkę.
    expect(SIDE_EFFECT_TOOLS.has('generate_report_section')).toBe(true);
    expect(closing?.requiresApproval).toBe(true);

    // Dokładnie DWIE fazy z bramką akceptu w klasycznym 5-fazowym schemacie.
    const gated = phases.filter((p) => p.requiresApproval);
    expect(gated.map((p) => p.id)).toEqual(['recommendations', 'closing']);
    expect(gated).toHaveLength(2);
  });

  it('wariant DRD = dokładnie 4 kroki we właściwej kolejności', () => {
    const phases = buildProcessPlan('drd');
    expect(phases).toHaveLength(4);
    expect(phases.map((p) => p.id)).toEqual([
      'discovery',
      'assessment',
      'initiatives',
      'results',
    ]);
    expect(phases.map((p) => p.name)).toEqual(['Discovery', 'Ocena', 'Inicjatywy', 'Efekty']);
  });

  it('nieznane processId -> bezpieczny fallback do domyślnego (5 faz)', () => {
    const phases = buildProcessPlan('nie-istnieje');
    expect(phases).toHaveLength(5);
    expect(phases[0].id).toBe('entry');
  });

  it('buildStepsFromProcess zwraca kroki {toolName, toolInput} z metadanymi fazy', () => {
    const steps = buildStepsFromProcess('classic-5');
    expect(steps).toHaveLength(5);
    for (const s of steps) {
      expect(typeof s.toolName).toBe('string');
      expect(typeof s.toolInput).toBe('object');
      // metadane fazy trafiają do toolInput (widoczne w sondzie HTTP / ai_agent_plan_steps)
      expect(typeof s.toolInput.phase).toBe('string');
      expect(typeof s.toolInput.module).toBe('string');
      expect(typeof s.toolInput.deliverable).toBe('string');
    }
    expect(steps[0].toolInput.phase).toBe('Wejście / Kontraktowanie');
    expect(steps[4].toolInput.deliverable).toBe('Efekty, deck, przekazanie');
  });

  it('DOROBKA C: buildStepsFromProcess niesie requiresApproval na DWÓCH krokach classic-5 (Rekomendacje + Zamknięcie)', () => {
    const steps = buildStepsFromProcess('classic-5');
    expect(steps.map((s) => s.requiresApproval)).toEqual([false, false, true, false, true]);
    expect(steps.filter((s) => s.requiresApproval)).toHaveLength(2);
  });

  it('dostrajanie pod kontekst modyfikuje toolInput bez zmiany liczby/kolejności faz', () => {
    const base = buildProcessPlan('classic-5');
    const tuned = buildProcessPlan('classic-5', {
      focusAxis: 'data_analytics',
      industry: 'manufacturing',
      hasVaultDocs: true,
      projectSummary: 'transformacja operacji',
    });

    // liczba i kolejność faz niezmienione
    expect(tuned).toHaveLength(base.length);
    expect(tuned.map((p) => p.id)).toEqual(base.map((p) => p.id));

    // Diagnoza dostała oś
    const diag = tuned.find((p) => p.id === 'diagnosis');
    expect(diag?.toolInput.axis).toBe('data_analytics');

    // Rekomendacje (calculate_financial) dostały branżę
    const rec = tuned.find((p) => p.id === 'recommendations');
    expect(rec?.toolInput.industry).toBe('manufacturing');

    // Faza wejścia (search_knowledge_base) wzbogacona o kontekst i Vault
    const entry = tuned.find((p) => p.id === 'entry');
    expect(String(entry?.toolInput.query)).toContain('transformacja operacji');
    expect(String(entry?.toolInput.query)).toContain('Vault');

    // bez kontekstu — query pozostaje bazowe (dowód, że dostrojenie faktycznie zmienia)
    const baseEntry = base.find((p) => p.id === 'entry');
    expect(baseEntry?.toolInput.query).not.toContain('Vault');
  });

  it('listProcesses: klasyczny jest domyślny, oba warianty widoczne', () => {
    const list = listProcesses();
    const ids = list.map((p) => p.id).sort();
    expect(ids).toEqual(['classic-5', 'drd']);

    const classic = list.find((p) => p.id === 'classic-5');
    expect(classic?.isDefault).toBe(true);
    expect(classic?.phaseCount).toBe(5);

    const drd = list.find((p) => p.id === 'drd');
    expect(drd?.isDefault).toBe(false);
    expect(drd?.phaseCount).toBe(4);

    // tylko jeden domyślny w bibliotece
    const defaults = Object.values(PROCESS_LIBRARY).filter((p) => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(DEFAULT_PROCESS_ID);
  });
});
