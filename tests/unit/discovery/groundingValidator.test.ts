import { describe, expect, it } from 'vitest';

import { validateGrounding } from '@/hooks/discovery/toolAi/groundingValidator';

/**
 * O-C2 (2026-07-09, panel v2): GROUNDING_RULES (prompt-only) improved 4/6
 * Discovery tools but capability-mapper kept fabricating numbers stamped
 * evidenceType:'fact' / confidence:5 / provenance:'Platform data' with no
 * such figures anywhere in the session input. This is the deterministic
 * post-parse backstop — same spirit as BusinessCaseService.checkNarrativeNumbers.
 */
describe('groundingValidator — validateGrounding', () => {
  it('leaves a number untouched when it is present in the grounding sources', () => {
    const parsed = {
      signals: [
        {
          type: 'ai',
          content: 'Onboarding trwa 21 dni',
          confidence: 5,
          evidenceType: 'fact',
          provenance: 'Client briefing data',
        },
      ],
    };
    const sources = ['Onboarding proces trwa obecnie 21 dni kalendarzowych.'];
    const { output, downgrades } = validateGrounding(parsed, sources);

    expect(downgrades).toHaveLength(0);
    expect(output.signals[0].evidenceType).toBe('fact');
    expect(output.signals[0].confidence).toBe(5);
    expect(output.signals[0].provenance).toBe('Client briefing data');
  });

  it('downgrades a fabricated number stamped as fact + client provenance', () => {
    const parsed = {
      signals: [
        {
          type: 'ai',
          content: 'Obecny poziom dojrzałości PMO: BASIC',
          confidence: 5,
          evidenceType: 'fact',
          state: 'confirmed',
          provenance: 'Platform data',
        },
      ],
      capabilities: [
        {
          name: 'Execution capability',
          domain: 'processes',
          currentMaturity: 1,
          targetMaturity: 4,
          importance: 'high',
          gapSize: 'critical',
          sourcing: 'build',
          drivers: ['0% success rate inicjatyw'],
          evidence: ['0 ukończonych z 25 inicjatyw', '14 anulowanych'],
          implication: 'Bez poprawy execution capability ekspansja się nie powiedzie',
          confidence: 5,
        },
      ],
      gaps: [
        {
          title: 'Brak zdolności execution - 0% success rate inicjatyw',
          capabilityIds: [5],
          insight:
            'Organizacja ma fundamentalny problem z realizacją inicjatyw (0/25 ukończonych)',
          priority: 'high',
          urgency: 'high',
          recommendation: 'Natychmiastowa naprawa PMO',
          confidence: 5,
        },
      ],
    };
    // Grounding sources: the case_input from the panel bundle — NO number
    // matching "25" or "14" appears anywhere in it.
    const sources = [
      'Które zdolności zbudować/kupić/zapartnerować, by skalować na DACH do 10M EUR w 3 lata? ' +
        '15 certyfikowanych integratorów DACH + 2M EUR GMV z DACH w 18 mies. Max 3 nowe etaty sprzedaży w 2026.',
    ];

    const { output, downgrades } = validateGrounding(parsed, sources);

    // capability.evidence carries "25" and "14" — neither is in the sources.
    const capability = output.capabilities[0];
    expect(capability.evidenceType).toBe('hypothesis');
    expect(capability.confidence).toBe(2);
    expect(capability.requires_evidence).toBe(true);
    expect(capability.provenance).toBe('AI-estimate (auto-downgraded: number not in source)');

    // gap.insight carries "25" via "0/25 ukończonych" — downgraded too.
    const gap = output.gaps[0];
    expect(gap.confidence).toBe(2);
    expect(gap.evidenceType).toBe('hypothesis');

    const numbersFlagged = downgrades.map((d) => d.number);
    expect(numbersFlagged).toContain('25');
    expect(numbersFlagged).toContain('14');
  });

  it('leaves a record untouched when confidence is low and evidenceType is already hypothesis', () => {
    const parsed = {
      capabilities: [
        {
          name: 'Speculative capability',
          evidence: ['estimated 40% adoption in year 2'],
          evidenceType: 'hypothesis',
          confidence: 2,
        },
      ],
    };
    const { output, downgrades } = validateGrounding(parsed, ['no matching numbers here']);
    expect(downgrades).toHaveLength(0);
    expect(output.capabilities[0].evidenceType).toBe('hypothesis');
    expect(output.capabilities[0].confidence).toBe(2);
  });

  it('recurses into nested arrays/objects — initiatives inside a summary object', () => {
    const parsed = {
      summary: {
        executiveSummary: 'ok',
        initiatives: [
          {
            title: 'Scale DACH sales',
            rationale: 'Based on 47 qualified leads in pipeline',
            evidenceType: 'fact',
            confidence: 5,
            provenance: 'DBR77 CRM export',
          },
        ],
      },
    };
    const { output, downgrades } = validateGrounding(parsed, ['no leads mentioned anywhere']);
    const initiative = output.summary.initiatives[0];
    expect(initiative.evidenceType).toBe('hypothesis');
    expect(initiative.confidence).toBe(2);
    expect(downgrades[0].path).toBe('root.summary.initiatives[0]');
    expect(downgrades[0].number).toBe('47');
  });

  it('catches the "0/25" pattern (slash-separated numerator/denominator)', () => {
    const parsed = {
      gaps: [
        {
          title: 'Execution gap',
          insight: 'Zero ukończonych z 25 zaplanowanych: 0/25 completion rate',
          evidenceType: 'fact',
          confidence: 4,
        },
      ],
    };
    const { output, downgrades } = validateGrounding(parsed, ['brief mentions nothing numeric']);
    expect(output.gaps[0].evidenceType).toBe('hypothesis');
    expect(downgrades.some((d) => d.number === '25')).toBe(true);
  });

  it('normalizes thousand-separated numbers so "4 200" matches "4200" in source', () => {
    const parsed = {
      capabilities: [
        {
          name: 'Revenue capability',
          evidence: ['Roczny przychód: 4 200 EUR'],
          evidenceType: 'fact',
          confidence: 5,
        },
      ],
    };
    const sources = ['Kontekst organizacji: bieżący przychód to 4200 EUR rocznie.'];
    const { output, downgrades } = validateGrounding(parsed, sources);
    expect(downgrades).toHaveLength(0);
    expect(output.capabilities[0].evidenceType).toBe('fact');
  });

  it('N2: caps QA/test-fixture-named signals below fact/confirmed', () => {
    const parsed = {
      signals: [
        {
          type: 'file',
          content: 'DEF-421 zgłoszenie serwisowe QA closed',
          sourceLabel: 'QA-TICKET-421',
          evidenceType: 'fact',
          state: 'confirmed',
          confidence: 3,
        },
      ],
    };
    const { output } = validateGrounding(parsed, ['some unrelated context']);
    const signal = output.signals[0];
    expect(signal.evidenceType).toBe('observation');
    expect(signal.state).toBe('proposed');
    expect(signal.requires_evidence).toBe(true);
  });

  it('is a no-op when the output has no numbers at all', () => {
    const parsed = {
      summary: { executiveSummary: 'All qualitative, no metrics mentioned here.' },
    };
    const { output, downgrades } = validateGrounding(parsed, ['also no numbers in the source']);
    expect(downgrades).toHaveLength(0);
    expect(output).toEqual(parsed);
  });

  it('does not flag numbers embedded only in id/ref fields', () => {
    const parsed = {
      priorities: [
        {
          title: 'Priority A',
          themeIds: ['theme-1720000000000-ab12cd'],
          insight: 'qualitative only',
          evidenceType: 'fact',
          confidence: 5,
        },
      ],
    };
    const { output, downgrades } = validateGrounding(parsed, ['no matching numbers anywhere']);
    expect(downgrades).toHaveLength(0);
    expect(output.priorities[0].evidenceType).toBe('fact');
  });
});
