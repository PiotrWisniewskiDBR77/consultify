export const ARTIFACT_TYPES = ['memo', 'spreadsheet', 'decision_doc', 'presentation', 'generic'] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const EXPORT_FORMATS = ['pdf', 'docx', 'pptx', 'xlsx', 'json'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

