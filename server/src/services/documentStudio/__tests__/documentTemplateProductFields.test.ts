/**
 * Document Studio — Template product fields tests (Slice E14).
 *
 * Verifies the substrate added in slice E14:
 *
 *   - `recordTemplateUsage()` increments `usageCount` and refreshes
 *     `lastUsedAt`, and emits a `template_usage_recorded` audit entry.
 *   - `recordTemplateFeedback()` updates the running average
 *     `feedbackQualityScore` + `feedbackSampleSize` in O(1) and emits
 *     a `template_feedback_recorded` audit entry.
 *   - Both helpers reject invalid inputs (empty IDs, out-of-range
 *     ratings) without mutating the registry.
 *   - Pre-E14 templates (no product fields populated) start from
 *     `undefined` and surface as "no signal yet".
 *
 * The DAO / migration that persists these fields across process
 * restarts is a follow-up slice (E14.persistence). This test pins the
 * in-process contract so the follow-up has a stable target.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __recordTemplateAuditActionForTests,
  __resetTemplateRegistryForTests,
  draftTemplate,
  listTemplateAuditEntries,
  recordTemplateFeedback,
  recordTemplateUsage,
} from '../documentTemplateService.js';

// Avoid the seeder hitting the persistence layer in unit tests.
vi.mock('../documentTemplateSeeder.js', () => ({
  seedSystemDocumentTemplates: vi.fn(async () => undefined),
}));
vi.mock('../documentTemplateRegistryDao.js', () => ({
  loadTemplatesForOrg: vi.fn(async () => []),
  loadAuditForTemplate: vi.fn(async () => []),
  persistTemplate: vi.fn(async () => ({ ok: true })),
  persistAuditEntry: vi.fn(async () => ({ ok: true })),
  __resetTemplateRegistryDaoForTests: vi.fn(async () => undefined),
}));
// `draftTemplate()` invokes the synchronous narrative planner to derive
// a section blueprint; we provide a minimal but well-typed outline so
// the helper produces a valid template without dragging the planner
// heuristics into this unit boundary.
vi.mock('../documentNarrativePlanner.js', () => ({
  planDocumentOutline: vi.fn(() => ({
    documentType: 'executive_memo',
    title: 'Stub outline',
    sections: [
      {
        title: 'Executive Summary',
        level: 1,
        purpose: 'Open with the decision and the recommendation.',
        expectedLengthHint: 'short',
      },
      {
        title: 'Recommendation',
        level: 1,
        purpose: 'Spell out the recommendation and trade-offs.',
        expectedLengthHint: 'medium',
      },
    ],
    recommendedDensity: 'standard',
    recommendedRegister: 'executive',
    recommendedLanguageStyle: 'consulting',
  })),
}));

afterEach(() => {
  __resetTemplateRegistryForTests();
});

function seedDraftTemplate() {
  const result = draftTemplate({
    organizationId: 'org-A',
    userId: 'user-1',
    input: {
      purpose: 'Quarterly board memo template for E14 product field tests.',
      documentType: 'executive_memo',
      audience: ['Board'],
      language: 'en',
    },
  });
  return result.template;
}

describe('Template product fields — recordTemplateUsage (Slice E14)', () => {
  beforeEach(() => {
    __resetTemplateRegistryForTests();
  });

  it('starts pre-E14 templates with undefined product fields', () => {
    const template = seedDraftTemplate();
    expect(template.usageCount).toBeUndefined();
    expect(template.lastUsedAt).toBeUndefined();
    expect(template.feedbackQualityScore).toBeUndefined();
    expect(template.feedbackSampleSize).toBeUndefined();
  });

  it('increments usageCount from undefined → 1 on first usage and sets lastUsedAt', () => {
    const seeded = seedDraftTemplate();
    const updated = recordTemplateUsage({
      templateId: seeded.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
      occurredAt: '2026-05-08T10:00:00.000Z',
    });
    expect(updated).not.toBeNull();
    expect(updated?.usageCount).toBe(1);
    expect(updated?.lastUsedAt).toBe('2026-05-08T10:00:00.000Z');
  });

  it('continues incrementing usageCount on subsequent usages', () => {
    const seeded = seedDraftTemplate();
    recordTemplateUsage({
      templateId: seeded.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
    });
    recordTemplateUsage({
      templateId: seeded.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
    });
    const final = recordTemplateUsage({
      templateId: seeded.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
    });
    expect(final?.usageCount).toBe(3);
  });

  it('emits a template_usage_recorded audit entry with prev / next counts and optional artifactId', () => {
    const seeded = seedDraftTemplate();
    recordTemplateUsage({
      templateId: seeded.templateId,
      organizationId: 'org-A',
      userId: 'user-2',
      artifactId: 'artifact-77',
    });
    const audit = listTemplateAuditEntries(seeded.templateId, 'org-A');
    const usage = audit.find((entry) => entry.action === 'template_usage_recorded');
    expect(usage).toBeTruthy();
    expect(usage?.actorId).toBe('user-2');
    expect(usage?.details).toMatchObject({
      previousUsageCount: 0,
      nextUsageCount: 1,
      artifactId: 'artifact-77',
    });
  });

  it('returns null and does not mutate the registry on missing template', () => {
    const result = recordTemplateUsage({
      templateId: 'does-not-exist',
      organizationId: 'org-A',
      userId: 'user-1',
    });
    expect(result).toBeNull();
  });

  it('returns null on empty templateId / organizationId / userId', () => {
    const seeded = seedDraftTemplate();
    expect(
      recordTemplateUsage({
        templateId: '   ',
        organizationId: 'org-A',
        userId: 'user-1',
      })
    ).toBeNull();
    expect(
      recordTemplateUsage({
        templateId: seeded.templateId,
        organizationId: '',
        userId: 'user-1',
      })
    ).toBeNull();
    expect(
      recordTemplateUsage({
        templateId: seeded.templateId,
        organizationId: 'org-A',
        userId: '',
      })
    ).toBeNull();
  });
});

describe('Template product fields — recordTemplateFeedback (Slice E14)', () => {
  beforeEach(() => {
    __resetTemplateRegistryForTests();
  });

  it('first rating: score = rating, sampleSize = 1', () => {
    const seeded = seedDraftTemplate();
    const updated = recordTemplateFeedback({
      templateId: seeded.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
      rating: 4,
    });
    expect(updated?.feedbackQualityScore).toBe(4);
    expect(updated?.feedbackSampleSize).toBe(1);
  });

  it('running average converges correctly across multiple ratings', () => {
    const seeded = seedDraftTemplate();
    recordTemplateFeedback({
      templateId: seeded.templateId,
      organizationId: 'org-A',
      userId: 'user-1',
      rating: 5,
    }); // score=5, n=1
    recordTemplateFeedback({
      templateId: seeded.templateId,
      organizationId: 'org-A',
      userId: 'user-2',
      rating: 3,
    }); // score=4, n=2
    const updated = recordTemplateFeedback({
      templateId: seeded.templateId,
      organizationId: 'org-A',
      userId: 'user-3',
      rating: 4,
    }); // score=4, n=3
    expect(updated?.feedbackQualityScore).toBe(4);
    expect(updated?.feedbackSampleSize).toBe(3);
  });

  it('emits a template_feedback_recorded audit entry with rating + prev/next aggregates + optional comment', () => {
    const seeded = seedDraftTemplate();
    recordTemplateFeedback({
      templateId: seeded.templateId,
      organizationId: 'org-A',
      userId: 'user-2',
      rating: 5,
      comment: 'Saved me 3 hours on the board memo.',
    });
    const audit = listTemplateAuditEntries(seeded.templateId, 'org-A');
    const feedback = audit.find((entry) => entry.action === 'template_feedback_recorded');
    expect(feedback).toBeTruthy();
    expect(feedback?.details).toMatchObject({
      rating: 5,
      previousScore: 0,
      previousSampleSize: 0,
      nextScore: 5,
      nextSampleSize: 1,
      comment: 'Saved me 3 hours on the board memo.',
    });
  });

  it('rejects out-of-range ratings (0, 6, NaN, non-integer)', () => {
    const seeded = seedDraftTemplate();
    for (const bad of [0, 6, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        recordTemplateFeedback({
          templateId: seeded.templateId,
          organizationId: 'org-A',
          userId: 'user-1',
          rating: bad,
        })
      ).toBeNull();
    }
  });

  it('rejects empty IDs without mutating the registry', () => {
    const seeded = seedDraftTemplate();
    expect(
      recordTemplateFeedback({
        templateId: '',
        organizationId: 'org-A',
        userId: 'user-1',
        rating: 5,
      })
    ).toBeNull();
    expect(
      recordTemplateFeedback({
        templateId: seeded.templateId,
        organizationId: '   ',
        userId: 'user-1',
        rating: 5,
      })
    ).toBeNull();
  });

  it('returns null when the template does not exist in the registry', () => {
    expect(
      recordTemplateFeedback({
        templateId: 'no-such-template',
        organizationId: 'org-A',
        userId: 'user-1',
        rating: 5,
      })
    ).toBeNull();
  });
});

// Smoke test to confirm the audit-trail action union accepts both new
// E14 actions in the existing __recordTemplateAuditActionForTests helper.
describe('Template product fields — TemplateAuditAction union', () => {
  beforeEach(() => {
    __resetTemplateRegistryForTests();
  });

  it('accepts the two new E14 audit actions in the audit-action union', () => {
    const seeded = seedDraftTemplate();
    __recordTemplateAuditActionForTests(
      seeded.templateId,
      'org-A',
      'template_usage_recorded',
      'user-1'
    );
    __recordTemplateAuditActionForTests(
      seeded.templateId,
      'org-A',
      'template_feedback_recorded',
      'user-1'
    );
    const audit = listTemplateAuditEntries(seeded.templateId, 'org-A');
    expect(audit.some((e) => e.action === 'template_usage_recorded')).toBe(true);
    expect(audit.some((e) => e.action === 'template_feedback_recorded')).toBe(true);
  });
});
