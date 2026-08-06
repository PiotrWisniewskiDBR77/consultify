/**
 * Document Studio — Executive QA tests (Epic E2, Slice 2.3).
 *
 * Executive QA focuses on whether a high-stakes deliverable drives a
 * decision rather than simply describing the world:
 *
 *   1. Executive Summary length cap (≤220 words for executive-grade).
 *   2. Executive Summary contains at least one action / decision verb
 *      ("recommend", "approve", "rekomendujemy", "decydujemy"...).
 *   3. Executive Summary absent on an executive-type document.
 *   4. Decision-driving section has at least 2 actionable blocks.
 *   5. Decision blocks attribute responsibility (owner / role).
 *   6. Decision blocks contain a time anchor (Q1–Q4, deadline, day count).
 *   7. Non-executive types (workshop_summary etc.) are exempt.
 */

import { describe, expect, it } from 'vitest';

import { runDocumentQa } from '../documentQaService.js';
import type { DocumentSchema } from '../documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-exec-1',
    artifactId: 'artifact-exec-1',
    title: 'Executive QA Test Document',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA },
    sections: [],
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeParagraph(blockId: string, text: string) {
  return {
    blockId,
    type: 'paragraph' as const,
    content: { text },
  };
}

function findExecutive(report: ReturnType<typeof runDocumentQa>) {
  const c = report.categories.find((cat) => cat.category === 'executive');
  if (!c) throw new Error('expected executive category in report');
  return c;
}

describe('Document QA — Executive QA category', () => {
  it('returns clean executive QA on a well-formed executive memo', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-exec',
          title: 'Executive Summary',
          level: 1,
          blocks: [
            makeParagraph(
              'b-exec',
              'We recommend approving the Q3 transformation budget reallocation across the three priority initiatives in order to unlock the second wave of execution by end of Q4.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-rec',
          title: 'Recommendations',
          level: 1,
          blocks: [
            makeParagraph(
              'b-rec-1',
              'CFO must approve the budget shift by end of Q4 so that the analytical capacity is in place before the next planning cycle begins.'
            ),
            makeParagraph(
              'b-rec-2',
              'PMO should onboard the two new working teams in October and schedule the 30/60/90-day measurement cadence with the sponsor.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exec = findExecutive(report);
    expect(exec.findings).toHaveLength(0);
    expect(exec.score).toBe(100);
    expect(exec.blocking).toBe(false);
  });

  it('flags executive summaries that exceed the word budget', () => {
    const longText = ('the company '.repeat(120) + 'we recommend approving.').trim();
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-exec',
          title: 'Executive Summary',
          level: 1,
          blocks: [makeParagraph('b-exec', longText)],
          sourceRefs: [],
        },
        {
          sectionId: 's-rec',
          title: 'Recommendations',
          level: 1,
          blocks: [
            makeParagraph(
              'b-rec-1',
              'CFO must approve the budget shift by end of Q4 with the analytical capacity in place before the next planning cycle begins.'
            ),
            makeParagraph(
              'b-rec-2',
              'PMO should onboard the two new working teams in October and confirm the 30/60/90-day cadence with the sponsor.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exec = findExecutive(report);
    expect(exec.findings.map((f) => f.code)).toContain('executive_summary_too_long');
  });

  it('flags executive summaries with no action / decision verb', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-exec',
          title: 'Executive Summary',
          level: 1,
          blocks: [
            // Pure description — no verb like "recommend / approve / decide".
            makeParagraph(
              'b-exec',
              'The portfolio overview describes three initiatives and their progress over the last quarter.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-rec',
          title: 'Recommendations',
          level: 1,
          blocks: [
            makeParagraph(
              'b-rec-1',
              'CFO confirms the budget figures by Q4 to prepare for the next planning cycle.'
            ),
            makeParagraph(
              'b-rec-2',
              'PMO continues the 30/60/90-day cadence with the sponsor in October.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exec = findExecutive(report);
    expect(exec.findings.map((f) => f.code)).toContain('executive_summary_missing_action_verb');
  });

  it('accepts a narrowly explicit no-decision conclusion without inventing an action verb', () => {
    const schema = makeSchema({
      language: 'pl',
      documentType: 'board_report',
      sections: [
        {
          sectionId: 's-exec',
          title: 'Podsumowanie zarządcze',
          level: 1,
          blocks: [makeParagraph('b-exec', 'Realizacja planu wynosi 72%.')],
          sourceRefs: [],
        },
        {
          sectionId: 's-decisions',
          title: 'Wymagane decyzje',
          level: 1,
          blocks: [makeParagraph('b-decision', 'Brief nie wskazuje decyzji do zatwierdzenia.')],
          sourceRefs: [],
        },
      ],
    });
    expect(findExecutive(runDocumentQa(schema)).findings.map((f) => f.code)).not.toContain(
      'executive_summary_missing_action_verb'
    );

    const english = makeSchema({
      sections: [
        {
          sectionId: 's-exec-en',
          title: 'Executive Summary',
          level: 1,
          blocks: [makeParagraph('b-exec-en', 'Delivery remains on the reported baseline.')],
          sourceRefs: [],
        },
        {
          sectionId: 's-decisions-en',
          title: 'Decisions Required',
          level: 1,
          blocks: [makeParagraph('b-decision-en', 'No decision is requested.')],
          sourceRefs: [],
        },
      ],
    });
    expect(findExecutive(runDocumentQa(english)).findings.map((f) => f.code)).not.toContain(
      'executive_summary_missing_action_verb'
    );

    const vague = makeSchema({
      language: 'pl',
      documentType: 'board_report',
      sections: [
        {
          sectionId: 's-exec-vague',
          title: 'Podsumowanie zarządcze',
          level: 1,
          blocks: [makeParagraph('b-exec-vague', 'Brak danych o dalszych działaniach.')],
          sourceRefs: [],
        },
      ],
    });
    expect(findExecutive(runDocumentQa(vague)).findings.map((f) => f.code)).toContain(
      'executive_summary_missing_action_verb'
    );
  });

  it('Polish heuristic: "Rekomendujemy" / "Decydujemy" satisfy the action-verb requirement', () => {
    const schema = makeSchema({
      language: 'pl',
      documentType: 'decision_memo',
      sections: [
        {
          sectionId: 's-exec',
          title: 'Streszczenie zarządcze',
          level: 1,
          blocks: [
            makeParagraph(
              'b-exec',
              'Rekomendujemy realokację budżetu transformacyjnego pomiędzy trzy inicjatywy strategiczne do końca Q4.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-rec',
          title: 'Rekomendacje',
          level: 1,
          blocks: [
            makeParagraph(
              'b-rec-1',
              'CFO zatwierdza zmianę budżetu do końca Q4, a PMO uruchamia dwa nowe zespoły robocze w październiku.'
            ),
            makeParagraph(
              'b-rec-2',
              'Sponsor projektu raportuje status na komitecie sterującym w cyklu 30/60/90-dni.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exec = findExecutive(report);
    expect(exec.findings.map((f) => f.code)).not.toContain('executive_summary_missing_action_verb');
  });

  it('flags thin decision sections (single actionable block)', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-exec',
          title: 'Executive Summary',
          level: 1,
          blocks: [
            makeParagraph(
              'b-exec',
              'We recommend approving the Q3 transformation budget reallocation by end of Q4 so the analytical capacity is in place.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-rec',
          title: 'Recommendations',
          level: 1,
          // Single bullet — too thin for a recommendations section.
          blocks: [
            makeParagraph(
              'b-rec',
              'CFO must approve the budget shift by end of Q4 to prepare for the next planning cycle.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exec = findExecutive(report);
    expect(exec.findings.map((f) => f.code)).toContain('executive_thin_decision_section');
  });

  it('flags decision sections that name no owner', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-exec',
          title: 'Executive Summary',
          level: 1,
          blocks: [
            makeParagraph(
              'b-exec',
              'We recommend approving the budget reallocation by end of Q4 to maintain the strategic timeline.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-rec',
          title: 'Recommendations',
          level: 1,
          blocks: [
            // No CFO/PMO/sponsor/owner mentions anywhere.
            makeParagraph(
              'b-rec-1',
              'The team will reallocate the analytical capacity by end of Q4 across the priority initiatives.'
            ),
            makeParagraph(
              'b-rec-2',
              'A 30/60/90-day cadence will track progress against the strategic timeline.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exec = findExecutive(report);
    expect(exec.findings.map((f) => f.code)).toContain('executive_decisions_without_owner');
  });

  it('flags decision sections with no time anchor', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-exec',
          title: 'Executive Summary',
          level: 1,
          blocks: [
            makeParagraph(
              'b-exec',
              'We recommend approving the budget reallocation across the priority initiatives.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-rec',
          title: 'Recommendations',
          level: 1,
          blocks: [
            // CFO + PMO mentioned but no Q1-Q4 / month / day anchor.
            makeParagraph(
              'b-rec-1',
              'CFO approves the reallocation and PMO reschedules the analytical capacity across teams.'
            ),
            makeParagraph(
              'b-rec-2',
              'PMO confirms the resource plan with the sponsor in the next planning cycle.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exec = findExecutive(report);
    expect(exec.findings.map((f) => f.code)).toContain('executive_decisions_without_time_anchor');
  });

  it('non-executive document types (workshop_summary) are exempt from Executive QA findings', () => {
    const schema = makeSchema({
      documentType: 'workshop_summary',
      sections: [
        {
          sectionId: 's-themes',
          title: 'Themes',
          level: 1,
          blocks: [
            makeParagraph(
              'b-themes',
              'Three dominant themes emerged from the workshop discussion across the breakout groups.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exec = findExecutive(report);
    expect(exec.findings).toHaveLength(0);
    expect(exec.blocking).toBe(false);
  });

  it('flags missing executive summary on an executive document type', () => {
    const schema = makeSchema({
      documentType: 'board_report',
      sections: [
        {
          sectionId: 's-1',
          title: 'Findings',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'Three at-risk programs require board-level intervention to maintain the strategic timeline.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-2',
          title: 'Recommendations',
          level: 1,
          blocks: [
            makeParagraph(
              'b-2',
              'CFO approves the budget shift by end of Q4 to maintain the strategic timeline.'
            ),
            makeParagraph(
              'b-3',
              'PMO reschedules the resource plan with the sponsor in October to align with the new cadence.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exec = findExecutive(report);
    expect(exec.findings.map((f) => f.code)).toContain('executive_summary_absent');
  });

  it('Executive QA participates in `anyBlocking` when multiple high-severity findings stack', () => {
    const schema = makeSchema({
      documentType: 'board_report',
      sections: [
        {
          sectionId: 's-exec',
          title: 'Executive Summary',
          level: 1,
          blocks: [
            // No action verb → high (-25). Plus another high will follow.
            makeParagraph(
              'b-exec',
              'The portfolio overview describes three initiatives and their progress.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-rec',
          title: 'Recommendations',
          level: 1,
          blocks: [
            // Single thin block (-12), no owner (-12), no time anchor (-5).
            makeParagraph('b-rec', 'A team will continue working on the initiatives.'),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exec = findExecutive(report);
    expect(exec.blocking).toBe(true);
    expect(report.anyBlocking).toBe(true);
  });
});
