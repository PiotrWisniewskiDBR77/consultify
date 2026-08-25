import { describe, expect, it, vi } from 'vitest';

// Mirrors public/locales/en/translation.json → initiatives.initiativeSourceLink.
// Keeping this dictionary explicit (rather than passing keys through) means the
// test also catches an EN copy regression, not just a wiring regression.
const EN_LABELS: Record<string, string> = {
  'initiatives.initiativeSourceLink.ideaWorkspace': 'Idea Workspace',
  'initiatives.initiativeSourceLink.assessment': 'Assessment',
  'initiatives.initiativeSourceLink.auditReadout': 'Audit readout',
  'initiatives.initiativeSourceLink.source': 'Source',
  'initiatives.initiativeSourceLink.interviewInsight': 'Interview Insight',
  'initiatives.initiativeSourceLink.insight': 'Insight',
  'initiatives.initiativeSourceLink.task': 'Task',
  'initiatives.initiativeSourceLink.decision': 'Decision',
  'initiatives.initiativeSourceLink.notebook': 'Notebook',
  'initiatives.initiativeSourceLink.initiativeLabel': 'Initiative',
  'initiatives.initiativeSourceLink.report': 'Report',
  'initiatives.initiativeSourceLink.presentation': 'Presentation',
  'initiatives.initiativeSourceLink.teamChat': 'Task list',
};

vi.mock('@/i18n', () => ({
  default: { t: (key: string) => EN_LABELS[key] ?? key, language: 'en' },
}));

const { getSourceDisplayLabel } = await import('../InitiativeSourceLink');

// MYW-IDEAS-CORE-001: the Ideas shared left rail's "Used in" backlinks list
// used to print bl.sourceType verbatim (e.g. "task", "process_flow_candidate")
// to the owner. getSourceDisplayLabel() is the shared "never show a raw
// technical slug" mapping already used by Initiatives/ReportEditor; these
// assertions lock the additional source types Idea backlinks can carry, plus
// the safety-net fallback for anything unmapped.
describe('getSourceDisplayLabel — known source types used by Idea backlinks', () => {
  it.each([
    ['task', 'Task'],
    ['task_set', 'Task'],
    ['decision', 'Decision'],
    ['notebook', 'Notebook'],
    ['notebook_page', 'Notebook'],
    ['initiative', 'Initiative'],
    ['report', 'Report'],
    ['presentation', 'Presentation'],
    ['team_chat', 'Task list'],
    ['idea', 'Idea Workspace'],
  ])('maps %s to a human label, never the raw slug', (sourceType, expected) => {
    expect(getSourceDisplayLabel(sourceType)).toBe(expected);
  });

  it('falls back to a Title Case label instead of a raw, unmapped slug', () => {
    expect(getSourceDisplayLabel('process_flow_candidate')).toBe('Process Flow Candidate');
    expect(getSourceDisplayLabel('some-unknown-type')).toBe('Some Unknown Type');
  });

  it('never returns a lowercase/underscored technical value for a non-empty input', () => {
    const inputs = ['task', 'decision', 'notebook', 'initiative', 'report', 'weird_new_type'];
    for (const input of inputs) {
      const label = getSourceDisplayLabel(input);
      expect(label).not.toBe(input);
      expect(label.includes('_')).toBe(false);
    }
  });

  it('returns an empty string for an empty/missing source type instead of throwing', () => {
    expect(getSourceDisplayLabel('')).toBe('');
  });
});
