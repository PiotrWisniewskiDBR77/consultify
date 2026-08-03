/**
 * `/presentations/wizard` redirect — scalenie wejść prezentacji 2026-07-27.
 *
 * Pins the branching that decides where the (now redirect-only)
 * `/presentations/wizard` route sends the browser, so a future edit can't
 * silently reopen the orphaned wizard or point edit/clone at the wrong
 * canonical surface. See `Harvard/wdrozenie-100/_INWENTARZ_GENERATORY_3_FORMATY_2026-07-27.md`
 * ("DO SCALENIA" #1) for the decision this test locks in.
 */

import { describe, expect, it } from 'vitest';

import { resolvePresentationWizardRedirectTarget } from '../presentationWizardRedirect';

describe('resolvePresentationWizardRedirectTarget', () => {
  it('templateArtifactId + edit=true -> Template Architect (edit an existing template)', () => {
    const result = resolvePresentationWizardRedirectTarget('?templateArtifactId=abc-123&edit=true');
    expect(result.target).toBe('/presentations?tab=template_architect');
  });

  it('cloneTemplateArtifactId -> Template Architect (clone an existing template)', () => {
    const result = resolvePresentationWizardRedirectTarget('?cloneTemplateArtifactId=abc-123');
    expect(result.target).toBe('/presentations?tab=template_architect');
  });

  it('templateArtifactId alone (no edit) -> /prezentacje with the same param (generate from template)', () => {
    const result = resolvePresentationWizardRedirectTarget('?templateArtifactId=abc-123');
    expect(result.target).toBe('/prezentacje?templateArtifactId=abc-123');
  });

  it('no query params -> plain /prezentacje', () => {
    const result = resolvePresentationWizardRedirectTarget('');
    expect(result.target).toBe('/prezentacje');
  });

  it('legacy raw templateId (different id space than templateArtifactId) is NOT forwarded', () => {
    // `templateId` here is a raw `presentation_templates` record id (see
    // DeckTemplateGallery.tsx), not the artifact-index id `templateArtifactId`
    // expects. Forwarding it as templateArtifactId would silently send an
    // unvalidated id to POST /presentations/decks/from-template. Dropping it
    // is what actually closes the known 26.07 client-side-resolver gap.
    const result = resolvePresentationWizardRedirectTarget('?templateId=raw-canonical-id');
    expect(result.target).toBe('/prezentacje');
    expect(result.target).not.toContain('raw-canonical-id');
  });

  it('legacy cloneTemplateId (raw id) alone does not route to the Template Architect', () => {
    const result = resolvePresentationWizardRedirectTarget('?cloneTemplateId=raw-canonical-id');
    expect(result.target).toBe('/prezentacje');
  });

  it('never resolves back into the retired /presentations/wizard route', () => {
    const cases = [
      '?templateArtifactId=abc-123&edit=true',
      '?cloneTemplateArtifactId=abc-123',
      '?templateArtifactId=abc-123',
      '',
      '?templateId=raw-canonical-id',
    ];
    for (const search of cases) {
      expect(resolvePresentationWizardRedirectTarget(search).target).not.toContain(
        '/presentations/wizard'
      );
    }
  });
});
