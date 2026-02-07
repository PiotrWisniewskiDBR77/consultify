import { describe, expect, it } from 'vitest';

import { aggregateVerdict } from '../../../../../server/src/services/ai/agentAudit/orchestratorService.js';

/**
 * Agent Audit Gold Standard Set (v1)
 *
 * Regression harness for deterministic aggregation + gates.
 * NOTE: This does NOT call the LLM. We test the audit "verdict engine".
 */
describe('Agent Audit Gold Standard Set', () => {
  const cases: Array<{
    id: string;
    title: string;
    input: Parameters<typeof aggregateVerdict>[0];
    expect: {
      qualityStatus: 'PASS' | 'PASS_WITH_RISKS' | 'FAIL';
      gates: Array<'A' | 'B' | 'C' | 'D'>;
      directedLoop: 'present' | 'absent';
    };
  }> = [
    {
      id: 'AA-1',
      title: 'Gate A: CFO flags high cashflow risk => FAIL + directed loop',
      input: {
        decisionContext: { topic: 'CAPEX 2M', functions: [], riskFocus: [] },
        userIntent: 'validate',
        iteration: 1,
        reviews: [
          {
            agentId: 'function.cfo_finance',
            agentVersion: '1',
            verdict: 'risk',
            overreach: 'none',
            observations: ['Obs'],
            challengedAssumptions: ['Assump'],
            impactIfIgnored: 'Impact',
            whenItFails: 'Fails',
            topQuestions: ['Q1'],
            findings: [
              {
                area: 'cashflow',
                severity: 'high',
                claim: 'Ryzyko płynności w Q2.',
                evidenceFromDT: ['DT: cashflow TBD'],
                missingDataQuestions: ['MUST: forecast cashflow 6m'],
                suggestedDeepening: 'Uzupełnij forecast cashflow i covenanty.',
                sourcesUsed: [],
              },
            ],
            conflicts: [],
          },
        ] as any,
      },
      expect: { qualityStatus: 'FAIL', gates: ['A', 'C'], directedLoop: 'present' },
    },
    {
      id: 'AA-2',
      title: 'Gate B: 2× HIGH in same area (uptime) => FAIL + directed loop',
      input: {
        decisionContext: { topic: 'Uptime risk', functions: [], riskFocus: [] },
        userIntent: 'validate',
        iteration: 1,
        reviews: [
          {
            agentId: 'function.maintenance_ur',
            agentVersion: '1',
            verdict: 'risk',
            overreach: 'none',
            observations: ['Obs'],
            challengedAssumptions: ['Assump'],
            impactIfIgnored: 'Impact',
            whenItFails: 'Fails',
            topQuestions: ['Q1'],
            findings: [
              {
                area: 'uptime',
                severity: 'high',
                claim: 'Ryzyko downtime bez części.',
                evidenceFromDT: ['DT: brak SLA'],
                missingDataQuestions: ['Lista części krytycznych'],
                suggestedDeepening: 'Dodaj plan serwisowy i części krytyczne.',
                sourcesUsed: [],
              },
            ],
            conflicts: [],
          },
          {
            agentId: 'function.plant_manager',
            agentVersion: '1',
            verdict: 'risk',
            overreach: 'none',
            observations: ['Obs'],
            challengedAssumptions: ['Assump'],
            impactIfIgnored: 'Impact',
            whenItFails: 'Fails',
            topQuestions: ['Q1'],
            findings: [
              {
                area: 'uptime',
                severity: 'high',
                claim: 'Ryzyko przestojów na zmianie nocnej.',
                evidenceFromDT: ['DT: nocna zmiana'],
                missingDataQuestions: ['Plan coverage UR 24/7'],
                suggestedDeepening: 'Uzupełnij coverage i warunki rollout.',
                sourcesUsed: [],
              },
            ],
            conflicts: [],
          },
        ] as any,
      },
      expect: { qualityStatus: 'FAIL', gates: ['B'], directedLoop: 'present' },
    },
    {
      id: 'AA-3',
      title: 'Gate D: hard overreach excluded; remaining review => PASS_WITH_RISKS',
      input: {
        decisionContext: { topic: 'Test', functions: [], riskFocus: [] },
        userIntent: 'validate',
        iteration: 1,
        reviews: [
          {
            agentId: 'function.adversarial',
            agentVersion: '1',
            verdict: 'risk',
            overreach: 'hard',
            overreachReason: 'Unauthorized web citations.',
            observations: [],
            challengedAssumptions: [],
            topQuestions: [],
            findings: [],
            conflicts: [],
          },
          {
            agentId: 'function.pm_project_management',
            agentVersion: '1',
            verdict: 'risk',
            overreach: 'none',
            observations: ['Obs'],
            challengedAssumptions: ['Assump'],
            impactIfIgnored: 'Impact',
            whenItFails: 'Fails',
            topQuestions: ['Q1'],
            findings: [
              {
                area: 'change_management',
                severity: 'medium',
                claim: 'Brak RACI/governance.',
                evidenceFromDT: ['DT: RACI TBD'],
                missingDataQuestions: [],
                suggestedDeepening: 'Uzupełnij RACI i governance.',
                sourcesUsed: [],
              },
            ],
            conflicts: [],
          },
        ] as any,
      },
      expect: { qualityStatus: 'PASS_WITH_RISKS', gates: ['D'], directedLoop: 'absent' },
    },
    {
      id: 'AA-4',
      title: 'Gate C only: must-have data missing => FAIL + directed loop',
      input: {
        decisionContext: { topic: 'Vendor selection', functions: [], riskFocus: [] },
        userIntent: 'validate',
        iteration: 1,
        reviews: [
          {
            agentId: 'function.procurement',
            agentVersion: '1',
            verdict: 'risk',
            overreach: 'none',
            observations: ['Obs'],
            challengedAssumptions: ['Assump'],
            impactIfIgnored: 'Impact',
            whenItFails: 'Fails',
            topQuestions: ['Q1'],
            findings: [
              {
                area: 'vendor_risk',
                severity: 'medium',
                claim: 'Brak danych dot. lead time i single-source.',
                evidenceFromDT: ['DT: vendor TBD'],
                missingDataQuestions: ['MUST: warunki umów i lead time', 'MUST: TCO'],
                suggestedDeepening: 'Uzupełnij warunki umów, lead time i TCO.',
                sourcesUsed: [],
              },
            ],
            conflicts: [],
          },
        ] as any,
      },
      expect: { qualityStatus: 'FAIL', gates: ['C'], directedLoop: 'present' },
    },
    {
      id: 'AA-5',
      title: 'Force-depth insufficient on iteration 2 => FAIL without further loop',
      input: {
        decisionContext: { topic: 'Directed deepening attempt', functions: [], riskFocus: [] },
        userIntent: 'validate',
        iteration: 2,
        forceDepthDiff: {
          isSubstantiallyDifferent: false,
          jaccardSimilarity: 0.9,
          rubricDelta: 0,
          newAxesDetected: false,
          failReasons: ['options_too_similar_to_previous'],
        },
        reviews: [
          {
            agentId: 'function.ceo',
            agentVersion: '1',
            verdict: 'ok',
            overreach: 'none',
            observations: ['Obs'],
            challengedAssumptions: ['Assump'],
            impactIfIgnored: 'Impact',
            whenItFails: 'Fails',
            topQuestions: ['Q1'],
            findings: [],
            conflicts: [],
          },
        ] as any,
      },
      expect: { qualityStatus: 'FAIL', gates: ['C'], directedLoop: 'absent' },
    },
    {
      id: 'AA-6',
      title: 'PASS: no findings => PASS',
      input: {
        decisionContext: { topic: 'Low risk admin change', functions: [], riskFocus: [] },
        userIntent: 'approve',
        iteration: 1,
        reviews: [
          {
            agentId: 'function.it_security',
            agentVersion: '1',
            verdict: 'ok',
            overreach: 'none',
            observations: ['No major risks'],
            challengedAssumptions: ['Assump'],
            impactIfIgnored: 'Impact',
            whenItFails: 'Fails',
            topQuestions: ['Q1'],
            findings: [],
            conflicts: [],
          },
        ] as any,
      },
      expect: { qualityStatus: 'PASS', gates: [], directedLoop: 'absent' },
    },
  ];

  for (const c of cases) {
    it(`${c.id} – ${c.title}`, () => {
      const verdict = aggregateVerdict(c.input as any);
      expect(verdict.qualityStatus).toBe(c.expect.qualityStatus);

      for (const g of c.expect.gates) {
        expect(verdict.gatesTriggered).toContain(g);
      }
      // Also assert no unexpected gates (keeps regression tight)
      expect(new Set(verdict.gatesTriggered)).toEqual(new Set(c.expect.gates));

      if (c.expect.directedLoop === 'present') {
        expect(Boolean(verdict.directedLoop?.deepThinkingPrompt)).toBe(true);
      } else {
        expect(verdict.directedLoop).toBe(null);
      }
    });
  }
});

