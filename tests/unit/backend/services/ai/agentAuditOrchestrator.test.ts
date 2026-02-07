import { describe, expect, it } from 'vitest';

import {
  aggregateVerdict,
  suggestAgents,
} from '../../../../../server/src/services/ai/agentAudit/orchestratorService.js';

describe('Agent Audit Orchestrator', () => {
  it('suggestAgents picks an industry agent and CFO by default', () => {
    const set = suggestAgents({
      decisionContext: { topic: 'Automatyzacja linii produkcyjnej', functions: [], riskFocus: [] },
      userIntent: 'validate',
      language: 'pl',
      maxAgents: 3,
    });

    expect(set.agents.some((a) => a.agentId.startsWith('industry.'))).toBe(true);
    expect(set.agents.some((a) => a.agentId === 'function.cfo_finance')).toBe(true);
    expect(set.constraints.requireManualApproval).toBe(true);
    expect(set.agents.every((a) => a.ruleId === 'default_v1')).toBe(true);
  });

  it('Gate A fails on 1× high finance risk from CFO', () => {
    const verdict = aggregateVerdict({
      decisionContext: { topic: 'CAPEX decision', functions: [], riskFocus: [] },
      userIntent: 'validate',
      iteration: 1,
      reviews: [
        {
          agentId: 'function.cfo_finance',
          verdict: 'risk',
          overreach: 'none',
          findings: [
            {
              area: 'cashflow',
              severity: 'high',
              claim: 'Ryzyko płynności w Q2 przy tym CAPEX.',
              evidenceFromDT: ['DT: "CAPEX 2M"'],
              missingDataQuestions: ['MUST: Aktualny forecast cashflow 6m'],
              suggestedDeepening: 'Dodaj analizę cashflow i scenariusze.',
            },
          ],
          conflicts: [],
        },
      ] as any,
    });

    expect(verdict.qualityStatus).toBe('FAIL');
    expect(verdict.gatesTriggered).toContain('A');
    expect(Array.isArray((verdict as any).gateExplanations)).toBe(true);
    expect((verdict as any).gateExplanations.some((g: any) => g.gate === 'A')).toBe(true);
  });

  it('Gate B fails on 2× high same risk area from different agents', () => {
    const verdict = aggregateVerdict({
      decisionContext: { topic: 'Uptime risk', functions: [], riskFocus: [] },
      userIntent: 'validate',
      iteration: 1,
      reviews: [
        {
          agentId: 'function.maintenance_ur',
          verdict: 'risk',
          overreach: 'none',
          findings: [
            {
              area: 'uptime',
              severity: 'high',
              claim: 'Ryzyko downtime bez części zamiennych.',
              evidenceFromDT: ['DT: "brak SLA"'],
              missingDataQuestions: ['Lista części krytycznych'],
              suggestedDeepening: 'Dodaj plan serwisowy i części.',
            },
          ],
          conflicts: [],
        },
        {
          agentId: 'function.plant_manager',
          verdict: 'risk',
          overreach: 'none',
          findings: [
            {
              area: 'uptime',
              severity: 'high',
              claim: 'Ryzyko przestojów na zmianie nocnej.',
              evidenceFromDT: ['DT: "nocna zmiana"'],
              missingDataQuestions: ['Plan coverage UR 24/7'],
              suggestedDeepening: 'Dodaj coverage i warunki graniczne rollout.',
            },
          ],
          conflicts: [],
        },
      ] as any,
    });

    expect(verdict.qualityStatus).toBe('FAIL');
    expect(verdict.gatesTriggered).toContain('B');
    expect((verdict as any).gateExplanations.some((g: any) => g.gate === 'B')).toBe(true);
  });

  it('Gate D excludes hard overreach agent output', () => {
    const verdict = aggregateVerdict({
      decisionContext: { topic: 'Test', functions: [], riskFocus: [] },
      userIntent: 'validate',
      iteration: 1,
      reviews: [
        {
          agentId: 'function.adversarial',
          verdict: 'risk',
          overreach: 'hard',
          findings: [
            {
              area: 'other',
              severity: 'high',
              claim: 'According to https://example.com ...',
              evidenceFromDT: [],
              missingDataQuestions: [],
              suggestedDeepening: 'Add data.',
            },
          ],
          conflicts: [],
        },
        {
          agentId: 'function.pm_project_management',
          verdict: 'risk',
          overreach: 'none',
          findings: [
            {
              area: 'change_management',
              severity: 'medium',
              claim: 'Brak RACI.',
              evidenceFromDT: ['DT: "RACI TBD"'],
              missingDataQuestions: [],
              suggestedDeepening: 'Dodaj RACI i governance.',
            },
          ],
          conflicts: [],
        },
      ] as any,
    });

    expect(verdict.gatesTriggered).toContain('D');
    expect((verdict as any).gateExplanations.some((g: any) => g.gate === 'D')).toBe(true);
    expect(verdict.qualityStatus).toBe('PASS_WITH_RISKS');
  });

  it('produces agentsSummary and sourcesSummary', () => {
    const verdict = aggregateVerdict({
      decisionContext: { topic: 'Test', functions: [], riskFocus: [] },
      userIntent: 'validate',
      iteration: 1,
      reviews: [
        {
          agentId: 'function.pm_project_management',
          agentVersion: '1',
          verdict: 'risk',
          overreach: 'none',
          observations: ['Obs 1'],
          challengedAssumptions: ['Assumption A'],
          impactIfIgnored: 'Impact',
          whenItFails: 'Fails when',
          topQuestions: ['Q1'],
          findings: [
            {
              area: 'change_management',
              severity: 'medium',
              claim: 'Brak RACI.',
              evidenceFromDT: ['DT: "RACI TBD"'],
              sourcesUsed: [
                { type: 'dt_section', section: 'DeepThinkingReport', quote: 'RACI TBD' },
                {
                  type: 'kb_snippet',
                  kbId: 'methodology',
                  docId: 'doc-1',
                  title: 'KB',
                  version: '1',
                  snippet: 'snippet',
                },
                { type: 'web_source', url: 'https://allowed.example/a', title: 'A', domain: 'allowed.example' },
              ],
              missingDataQuestions: [],
              suggestedDeepening: 'Dodaj RACI i governance.',
            },
          ],
          conflicts: [],
        },
      ] as any,
    });

    expect(Array.isArray((verdict as any).agentsSummary)).toBe(true);
    expect((verdict as any).agentsSummary.length).toBeGreaterThan(0);
    expect((verdict as any).sourcesSummary?.counts?.dt_section).toBeGreaterThan(0);
    expect((verdict as any).sourcesSummary?.kb?.length).toBeGreaterThan(0);
    expect((verdict as any).sourcesSummary?.web?.length).toBeGreaterThan(0);
  });

  it('fails if force-depth deepening was insufficient (iteration 2)', () => {
    const verdict = aggregateVerdict({
      decisionContext: { topic: 'Test', functions: [], riskFocus: [] },
      userIntent: 'validate',
      iteration: 2,
      forceDepthDiff: {
        isSubstantiallyDifferent: false,
        jaccardSimilarity: 0.92,
        rubricDelta: 0,
        newAxesDetected: false,
        failReasons: ['options_too_similar_to_previous', 'no_rubric_improvement_and_no_new_axes'],
      },
      reviews: [
        {
          agentId: 'function.pm_project_management',
          agentVersion: '1',
          verdict: 'ok',
          overreach: 'none',
          observations: ['Obs 1'],
          challengedAssumptions: ['Assumption A'],
          impactIfIgnored: 'Impact',
          whenItFails: 'Fails when',
          topQuestions: ['Q1'],
          findings: [],
          conflicts: [],
        },
      ] as any,
    });

    expect(verdict.qualityStatus).toBe('FAIL');
    expect(verdict.gatesTriggered).toContain('C');
    expect((verdict as any).gateExplanations.some((g: any) => g.gate === 'C')).toBe(true);
    expect(verdict.directedLoop).toBe(null); // max 2 loops
  });
});

