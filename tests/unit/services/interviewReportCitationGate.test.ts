import { describe, expect, it } from 'vitest';

import {
  buildInterviewReportPackDraft,
  evaluateInterviewReportPackReadiness,
  evaluateReportCitationGate,
  type ReportPackSourceInsight,
} from '../../../server/src/services/interviewInsightReportPackService.js';

// §D20 verbatim-citation gate — HARD only on the client-report path. A finding
// reaches the client report ONLY when at least one of its evidence_refs resolves
// to an evidence_map entry with a verbatim (non-paraphrased) answer_snippet.

function baseInsight(): ReportPackSourceInsight {
  return {
    id: 'ins_test',
    title: 'Warstwa planowania hamuje transformację',
    executiveSummary:
      'Transformacja utknie na warstwie planowania, nie technologii: lead-time ~34 dni napędza ręczny ' +
      'handoff między sprzedażą a produkcją, a nie brak systemu. Trzy dźwignie mają najwyższy zwrot. ' +
      'Pewność wysoka co do diagnozy lead-time, umiarkowana co do sizingu marży.',
    themes: [
      { title: 'Brak triage wydłuża obsługę zapytań', description: 'Mechanizm opóźnień.', evidence_refs: ['H7'], strength: 'strong' },
    ],
    issues: [{ title: 'Master danych rozjeżdża się między zakładami', description: 'Blokuje wspólne zakupy.', severity: 'high', evidence_refs: ['H3'] }],
    opportunities: [],
    signals: [],
    missingData: ['Brak baseline COPQ', 'Brak wolumenu zapytań'],
  };
}

describe('report-path citation gate (§D20)', () => {
  it('PRZED: findings without a verbatim evidence snippet BLOCK the report path', () => {
    const insight = baseInsight();
    // Paraphrased snippet — not a source voice → does not satisfy the citation gate.
    insight.evidenceMap = [
      { answer_id: 'H7', question_text: 'Jak powstaje harmonogram?', answer_snippet: 'Respondent opisał proces jako suboptymalny.', linked_themes: [], linked_issues: [] },
    ];
    const reasons = evaluateReportCitationGate(insight);
    expect(reasons.some((r) => r.startsWith('CITATION_GATE:'))).toBe(true);

    const readiness = evaluateInterviewReportPackReadiness(buildInterviewReportPackDraft(insight));
    // The paraphrase means the H7 finding is uncited → a hard blocker exists.
    expect(readiness.blockers.some((b) => /cytat/i.test(b.message))).toBe(true);
    expect(readiness.status).toBe('blocked');
  });

  it('PO: a verbatim, attributed snippet backing each finding clears the citation gate', () => {
    const insight = baseInsight();
    insight.evidenceMap = [
      { answer_id: 'H7', question_text: 'Jak powstaje harmonogram?', answer_snippet: 'Robię go w swoim Excelu rano, SAP dostaje to po fakcie.', linked_themes: ['Brak triage'], linked_issues: [] },
      { answer_id: 'H3', question_text: 'Co blokuje wspólne zakupy?', answer_snippet: 'Ten sam komponent ma dwa różne indeksy w dwóch zakładach.', linked_themes: [], linked_issues: ['Master danych'] },
    ];
    const reasons = evaluateReportCitationGate(insight);
    expect(reasons).toEqual([]);

    const readiness = evaluateInterviewReportPackReadiness(buildInterviewReportPackDraft(insight));
    // No citation blockers remain (other readiness blockers may exist, but none about quotes).
    expect(readiness.blockers.some((b) => /cytat/i.test(b.message))).toBe(false);
  });

  it('tools path is untouched: the gate only runs for the report pack', () => {
    // evaluateReportCitationGate is report-path-specific; with no findings it is a no-op.
    expect(evaluateReportCitationGate({ id: 'x', themes: [], issues: [] })).toEqual([]);
  });
});
