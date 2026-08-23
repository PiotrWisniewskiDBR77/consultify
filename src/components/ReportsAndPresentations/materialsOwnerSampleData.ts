/**
 * Deterministic Wave 3 owner-review data for the Materials registries.
 *
 * This is deliberately query-gated and never substitutes canonical tenant data.
 * Full-card routes still require their canonical runtime records and readback.
 */

export const MATERIALS_OWNER_SAMPLE_QUERY = 'materials-vnext';

export function isMaterialsOwnerSampleEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('sampleData') === MATERIALS_OWNER_SAMPLE_QUERY;
}

export const materialsOwnerRegistryRows = [
  {
    artifactId: 'materials-review-document-artifact',
    originRuntime: 'native_artifact',
    originRecordId: 'materials-review-document',
    resolvedTitle: 'Plan transformacji operacyjnej',
    originStatus: 'ready',
    deliveryState: 'ready',
    ownerName: 'Piotr Wisniewski',
    createdAt: '2026-08-21T08:00:00.000Z',
    updatedAt: '2026-08-23T12:00:00.000Z',
    lastTransitionAt: '2026-08-23T12:00:00.000Z',
    publishState: 'approved',
    validationState: 'validated',
    visibilityScope: 'organization',
    exportFormat: 'docx',
    reportType: 'executive_memo',
    openPath: '/document-studio/materials-review-document',
    authority: 'document_studio',
  },
  {
    artifactId: 'materials-review-presentation-artifact',
    originRuntime: 'presentation',
    originRecordId: 'materials-review-presentation',
    resolvedTitle: 'Transformacja operacyjna — decyzja 90 dni',
    originStatus: 'ready',
    deliveryState: 'ready',
    ownerName: 'Piotr Wisniewski',
    createdAt: '2026-08-21T08:00:00.000Z',
    updatedAt: '2026-08-23T12:15:00.000Z',
    lastTransitionAt: '2026-08-23T12:15:00.000Z',
    publishState: 'approved',
    validationState: 'validated',
    visibilityScope: 'organization',
    exportFormat: 'pptx',
    originSummary: { deckType: 'tool', slideCount: 4 },
    slideCount: 4,
    openPath: '/presentation-builder/materials-review-presentation',
    authority: 'presentation_builder',
  },
  {
    artifactId: 'materials-review-sheet-artifact',
    originRuntime: 'sheet',
    originRecordId: 'materials-review-workbook',
    resolvedTitle: 'Model korzyści transformacji',
    originStatus: 'ready',
    deliveryState: 'ready',
    ownerName: 'Piotr Wisniewski',
    createdAt: '2026-08-21T08:00:00.000Z',
    updatedAt: '2026-08-23T12:30:00.000Z',
    lastTransitionAt: '2026-08-23T12:30:00.000Z',
    publishState: 'approved',
    validationState: 'validated',
    visibilityScope: 'organization',
    exportFormat: 'xlsx',
    originSummary: { source: 'workbook_generator', sheetCount: 1 },
    openPath: '/workbook/materials-review-workbook',
    authority: 'workbook',
  },
] as const;
