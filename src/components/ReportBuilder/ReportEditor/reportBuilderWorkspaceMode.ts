export type ReportBuilderWorkspaceMode = 'write' | 'review' | 'publish';

export function parseReportBuilderWorkspaceMode(
  value: string | null | undefined
): ReportBuilderWorkspaceMode | null {
  return value === 'write' || value === 'review' || value === 'publish' ? value : null;
}
