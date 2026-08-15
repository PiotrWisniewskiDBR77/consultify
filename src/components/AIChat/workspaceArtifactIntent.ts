import type { WorkspaceContext } from '../../types/workspace';

export type WorkspaceArtifactKind = 'presentation' | 'document' | 'sheet';

const ARTIFACT_KIND_ALIASES: Record<string, WorkspaceArtifactKind> = {
  deck: 'presentation',
  presentation: 'presentation',
  doc: 'document',
  document: 'document',
  report: 'document',
  sheet: 'sheet',
  spreadsheet: 'sheet',
  workbook: 'sheet',
  table: 'sheet',
  xlsx: 'sheet',
};

export function resolveWorkspaceArtifactKind(
  workspaceContext?: WorkspaceContext | null
): WorkspaceArtifactKind | null {
  const explicitKind = String(workspaceContext?.entityData?.artifactKind || '')
    .trim()
    .toLowerCase();
  if (explicitKind) return ARTIFACT_KIND_ALIASES[explicitKind] || null;

  const contextType = String(workspaceContext?.type || '')
    .trim()
    .toLowerCase();
  return ARTIFACT_KIND_ALIASES[contextType] || null;
}

export function shouldOfferWorkspaceArtifactIntent(
  workspaceContext: WorkspaceContext | null | undefined,
  attachments?: readonly unknown[]
): boolean {
  return resolveWorkspaceArtifactKind(workspaceContext) !== null && !attachments?.length;
}
