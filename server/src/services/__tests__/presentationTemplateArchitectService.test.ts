import { describe, expect, it } from 'vitest';

import type { DeckSetup, OutlineItem } from '../presentationGeneratorService.js';
import { buildPresentationNarrativePlan } from '../presentationNarrativePlannerService.js';
import { buildPresentationSourcePack } from '../presentationSourcePackService.js';
import { buildPresentationTemplateArchitectPlan } from '../presentationTemplateArchitectService.js';

function steeringSetup(overrides: Partial<DeckSetup> = {}): DeckSetup {
  return {
    title: 'KS Project Steering Committee',
    audience: 'executive',
    goal: 'decide',
    language: 'en',
    theme: 'corporate',
    confidentiality: 'confidential',
    sourceArtifacts: [
      {
        type: 'assessment',
        id: 'assessment-1',
        artifactId: 'artifact-assessment-1',
        label: 'Project health assessment',
        confidence: 0.86,
        readiness: 'ready',
      },
      {
        type: 'initiative_portfolio',
        id: 'portfolio-1',
        artifactId: 'artifact-portfolio-1',
        label: 'Workstream status portfolio',
        confidence: 0.8,
        readiness: 'ready',
      },
      {
        type: 'kpi_roi',
        id: 'kpi-1',
        artifactId: 'artifact-kpi-1',
        label: 'Project KPI snapshot',
        confidence: 0.82,
        readiness: 'ready',
      },
      {
        type: 'raid',
        id: 'raid-1',
        artifactId: 'artifact-raid-1',
        label: 'RAID register',
        confidence: 0.78,
        readiness: 'ready',
      },
      {
        type: 'execution_status',
        id: 'execution-1',
        artifactId: 'artifact-execution-1',
        label: 'Milestone execution status',
        confidence: 0.81,
        readiness: 'ready',
      },
    ],
    ...overrides,
  };
}

const outline: OutlineItem[] = [
  { intent: 'cover', title: 'KS Project Steering Committee', enabled: true },
  { intent: 'executive_summary', title: 'Executive Summary', enabled: true },
  { intent: 'initiative_portfolio', title: 'Workstream Status', enabled: true },
  { intent: 'risk_management', title: 'Risks And Decisions', enabled: true },
  { intent: 'next_steps', title: 'Decisions And Next Steps', enabled: true },
];

describe('presentationTemplateArchitectService', () => {
  it('creates a governed reviewable template plan with slide blueprints', () => {
    const setup = steeringSetup();
    const sourcePack = buildPresentationSourcePack({
      setup,
      organizationId: 'org-1',
      now: new Date('2026-05-08T12:00:00.000Z'),
    });
    const narrativePlan = buildPresentationNarrativePlan({
      setup,
      outline,
      sourcePack,
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    const plan = buildPresentationTemplateArchitectPlan({
      setup,
      sourcePack,
      narrativePlan,
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    expect(plan.status).toBe('ready_for_review');
    expect(plan.templateFamily).toBe('Steering Committee Deck');
    expect(plan.recommendedFrequency).toBe('weekly or bi-weekly');
    expect(plan.governance).toMatchObject({
      initialStatus: 'draft',
      approvalRequired: true,
      auditEvent: 'template_architect_plan_created',
    });
    expect(plan.sections.some((section) => section.name === 'Decisions And Governance')).toBe(true);
    expect(plan.requiredInputs).toContain('assessment');
    expect(plan.requiredInputs).toContain('initiative_portfolio');
    expect(plan.requiredInputs).toContain('raid');
    expect(plan.runtimePreview.mustHaveIntents).toContain('executive_summary');
    expect(
      plan.sections.flatMap((section) => section.slides).some((slide) => slide.approvalRequired)
    ).toBe(true);
  });

  it('keeps template proposals in needs_sources when no source examples exist', () => {
    const setup = steeringSetup({ sourceArtifacts: [] });
    const sourcePack = buildPresentationSourcePack({
      setup,
      organizationId: 'org-1',
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    const plan = buildPresentationTemplateArchitectPlan({
      setup,
      sourcePack,
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    expect(plan.status).toBe('needs_sources');
    expect(plan.warnings.join(' ')).toContain('without source examples');
    expect(plan.governance.initialStatus).toBe('draft');
  });
});
