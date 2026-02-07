import { describe, expect, it } from 'vitest';

import { aggregateVerdict, suggestAgents } from '../../../../src/services/ai/agentAudit/orchestratorService.js';

describe('AgentAuditOrchestrator', () => {
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
          // hard overreach -> excluded
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
    // With only medium risk remaining, it must not be FAIL due to the excluded agent
    expect(verdict.qualityStatus).toBe('PASS_WITH_RISKS');
  });
});

