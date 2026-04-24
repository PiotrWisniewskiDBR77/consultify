import type { ExportFormat } from './ArtifactTypeRegistry.js';

export const DATA_CLASSIFICATIONS = ['Public', 'Internal', 'Confidential', 'Restricted'] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export function canExportToFormat(
  _classification: DataClassification,
  _format: ExportFormat
): boolean {
  // MVP policy: all formats are allowed for all classifications; higher-level
  // enforcement lives in routing / policy services.
  return true;
}
