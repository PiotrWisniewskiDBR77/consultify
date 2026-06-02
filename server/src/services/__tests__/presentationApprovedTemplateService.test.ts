import { describe, expect, it } from 'vitest';

import {
  applyApprovedTemplateToOutline,
  resolveApprovedPresentationTemplate,
} from '../presentationApprovedTemplateService.js';
import type { OutlineItem, SourceArtifact } from '../presentationGeneratorService.js';

const approvedTemplateRow = {
  id: 'tpl-approved-1',
  name: 'Approved Steering Template',
  lifecycle_state: 'approved',
  deck_type: 'steering_committee',
  outline_json: JSON.stringify([
    { intent: 'cover', title: 'Steering Committee Update' },
    { intent: 'executive_summary', title: 'Executive Summary' },
    { intent: 'performance_overview', title: 'Portfolio Health' },
    { intent: 'risk_management', title: 'Risks And Decisions' },
    { intent: 'next_steps', title: 'Decisions And Next Steps' },
  ]),
  source_requirements_json: JSON.stringify([
    { type: 'assessment', required: true, readiness: 'ready' },
    { type: 'raid', required: true, readiness: 'ready' },
  ]),
};

const outline: OutlineItem[] = [
  { intent: 'cover', title: 'Steering Committee Update', enabled: true },
  { intent: 'executive_summary', title: 'Executive Summary', enabled: true },
  { intent: 'performance_overview', title: 'Portfolio Health', enabled: true },
  { intent: 'risk_management', title: 'Risks And Decisions', enabled: true },
  { intent: 'next_steps', title: 'Decisions And Next Steps', enabled: true },
];

const sources: SourceArtifact[] = [
  {
    type: 'assessment',
    id: 'assessment-1',
    artifactId: 'artifact-assessment-1',
    label: 'Project assessment',
    readiness: 'ready',
  },
  {
    type: 'raid',
    id: 'raid-1',
    artifactId: 'artifact-raid-1',
    label: 'RAID register',
    readiness: 'ready',
  },
];

describe('presentationApprovedTemplateService', () => {
  it('resolves only approved templates', () => {
    const resolved = resolveApprovedPresentationTemplate(approvedTemplateRow);
    expect(resolved.runtime.templateId).toBe('tpl-approved-1');
    expect(resolved.runtime.templateFamily).toBe('Steering Committee Deck');

    expect(() =>
      resolveApprovedPresentationTemplate({ ...approvedTemplateRow, lifecycle_state: 'draft' })
    ).toThrow('template_not_approved:draft');
    expect(() => resolveApprovedPresentationTemplate(null)).toThrow('approved_template_not_found');
  });

  it('maps approved template slots to selected source artifacts', () => {
    const runtime = resolveApprovedPresentationTemplate(approvedTemplateRow).runtime;
    const result = applyApprovedTemplateToOutline({ runtime, outline, sources });

    expect(result.slotMapping.templateId).toBe('tpl-approved-1');
    expect(result.slotMapping.missingRequiredInputs).toEqual([]);
    expect(result.slotMapping.slots).toHaveLength(5);
    expect(
      result.slotMapping.slots.find((slot) => slot.intent === 'risk_management')
    ).toMatchObject({
      sourceTypes: ['raid'],
      mappedSourceIds: ['artifact-raid-1'],
      missingSourceTypes: [],
    });
  });

  it('surfaces missing required template inputs in mapping warnings', () => {
    const runtime = resolveApprovedPresentationTemplate(approvedTemplateRow).runtime;
    const result = applyApprovedTemplateToOutline({
      runtime,
      outline,
      sources: sources.filter((source) => source.type !== 'raid'),
    });

    expect(result.slotMapping.missingRequiredInputs).toEqual(['raid']);
    expect(result.warnings.join(' ')).toContain('Approved template requires source type raid');
  });
});
