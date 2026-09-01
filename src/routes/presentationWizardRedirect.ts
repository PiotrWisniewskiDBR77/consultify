/**
 * `/presentations/wizard` redirect target — scalenie wejść prezentacji
 * 2026-07-27 (Harvard/wdrozenie-100/_INWENTARZ_GENERATORY_3_FORMATY_2026-07-27.md,
 * "DO SCALENIA" #1). Extracted as a pure function so the branching can be unit
 * tested without mounting the full router tree (`AppRoutes.tsx` pulls in the
 * entire lazy-loaded app). See `PresentationWizardRedirect` in
 * `src/routes/AppRoutes.tsx` for the component that uses this.
 *
 * `PresentationWizard` was orphaned from navigation (zero UI links) and lived
 * only off deep links built by artifactNavigation.ts / chatActionHandler.ts /
 * useChatActions.ts / server `artifacts.routes.ts` (openPath for
 * `presentation_template`) — all four were repointed at the canonical
 * destinations (Teresa `/prezentacje` for generation, the Template Architect
 * for edit/clone). This route stays as a redirect for old bookmarks instead
 * of being deleted outright — see the "przycisk cofania" rule (CLAUDE.md #8).
 */
export interface PresentationWizardRedirectTarget {
  target: string;
  reason: string;
}

export function resolvePresentationWizardRedirectTarget(
  search: string
): PresentationWizardRedirectTarget {
  const params = new URLSearchParams(search || '');
  const templateArtifactId = params.get('templateArtifactId');
  const cloneTemplateArtifactId = params.get('cloneTemplateArtifactId');
  const isEdit = params.get('edit') === 'true';

  // `templateArtifactId` + `edit=true` OR `cloneTemplateArtifactId` → editing
  // or cloning a template record itself → canonical Template Architect
  // (`?tab=template_architect` deep link exists since 26.07 —
  // ReportsAndPresentationsHub.tsx).
  if (cloneTemplateArtifactId || (templateArtifactId && isEdit)) {
    return {
      target: '/presentations?tab=template_architect',
      reason: 'presentation_wizard_edit_clone_to_template_architect',
    };
  }

  // `templateArtifactId` alone (no edit) → generate a NEW deck from the
  // template → `/prezentacje` with the same param PrezentacjeView already
  // reads (`POST /presentations/decks/from-template`, R1.1 26.07).
  if (templateArtifactId) {
    return {
      target: `/prezentacje?templateArtifactId=${encodeURIComponent(templateArtifactId)}`,
      reason: 'presentation_wizard_generate_to_prezentacje',
    };
  }

  // Anything else — including legacy `templateId`/`cloneTemplateId` (a RAW
  // `presentation_templates` record id, a DIFFERENT id space than
  // `templateArtifactId`; the old PresentationWizard.tsx translated these
  // client-side WITHOUT server validation — the known 26.07 gap, naturally
  // closed here by simply not forwarding them) — plain `/prezentacje`.
  return {
    target: '/prezentacje',
    reason: 'presentation_wizard_retired_to_prezentacje',
  };
}
