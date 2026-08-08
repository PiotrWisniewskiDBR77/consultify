/** @vitest-environment node */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  fileURLToPath(new URL('../presentations.routes.ts', import.meta.url)),
  'utf8'
);

describe('presentation template custom master persistence wiring', () => {
  it('deletes only organization-owned drafts and fails closed on lifecycle changes', () => {
    const start = source.indexOf("router.delete(\n  '/templates/:id'");
    const end = source.indexOf("router.post(\n  '/templates/:id/clone'", start);
    const route = source.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(route).toContain('readBackOrgTemplate(templateId, orgId)');
    expect(route).toContain("lifecycleState !== 'draft'");
    expect(route).toContain("COALESCE(lifecycle_state, 'draft') = 'draft'");
    expect(route).toContain('organization_id = ?');
    expect(route).toContain('TEMPLATE_DELETE_REQUIRES_DRAFT');
    expect(route).toContain('TEMPLATE_DELETE_CONFLICT');
    expect(route).toContain('deletedTemplateId: templateId');
  });

  it('persists the custom contract when a template is created', () => {
    const start = source.indexOf("'/templates/plan',");
    const end = source.indexOf("'/templates/:id/clone',", start);
    const route = source.slice(start, end);
    expect(route).toContain('layout_policy_json');
    expect(route).toContain('customTemplate: input.customTemplate || null');
    expect(route).toContain('validatePresentationCustomTemplate(input.customTemplate)');
    expect(route).toContain("error: 'custom_template_invalid'");
  });

  it('merges custom contract updates without dropping color-template metadata', () => {
    const start = source.indexOf("'/templates/:id',", source.indexOf('router.put('));
    const route = source.slice(start, source.indexOf('router.', start + 20));
    expect(route).toContain('colorTemplateId !== undefined || customTemplate !== undefined');
    expect(route).toContain('{ customTemplate: customTemplate || null }');
    expect(route).toContain('...currentLayoutPolicy');
    expect(route).toContain('validatePresentationCustomTemplate(customTemplate)');
  });

  it('validates a custom contract again before approval', () => {
    const start = source.indexOf("'/templates/:id/governance/transition',");
    const route = source.slice(
      start,
      source.indexOf("'/templates/:id/governance/deprecate',", start)
    );
    expect(route).toContain("targetState === 'approved'");
    expect(route).toContain('validatePresentationCustomTemplate(customTemplate)');
  });
});
