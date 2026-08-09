import { Api } from '@/services/api';

import { buildMyWorkSheetTableOpenPath } from './artifactLinks';
import {
  resolveTablePlatformArtifactIdentity,
  type TablePlatformArtifactIdentity,
} from './sheetArtifactOpen';

export type SpreadsheetArtifactIdentity =
  | {
      kind: 'workbook';
      requestedId: string;
      workbookId: string;
      workbook: any;
      canonicalOpenPath: string;
    }
  | {
      kind: 'table';
      requestedId: string;
      tableId: string;
      workspaceId: string;
      canonicalOpenPath: string;
    }
  | {
      kind: 'missing';
      requestedId: string;
      canonicalOpenPath: null;
    };

export interface SpreadsheetArtifactIdentityDependencies {
  loadWorkbook: (id: string) => Promise<any>;
  resolveTableIdentity: (id: string) => Promise<TablePlatformArtifactIdentity | null>;
}

const defaultDependencies: SpreadsheetArtifactIdentityDependencies = {
  loadWorkbook: (id) => Api.get(`/workbook/${encodeURIComponent(id)}`),
  resolveTableIdentity: resolveTablePlatformArtifactIdentity,
};

/**
 * Resolves the ambiguous `artifactId` used by legacy sheet links without
 * fabricating an empty workbook. Generated workbooks stay in Spreadsheet
 * Studio; governed table artifacts navigate to their canonical Table Studio.
 */
export async function resolveSpreadsheetArtifactIdentity(
  requestedId: string,
  dependencies: SpreadsheetArtifactIdentityDependencies = defaultDependencies
): Promise<SpreadsheetArtifactIdentity> {
  const id = requestedId.trim();
  if (!id) return { kind: 'missing', requestedId: requestedId, canonicalOpenPath: null };

  try {
    const workbook = await dependencies.loadWorkbook(id);
    return {
      kind: 'workbook',
      requestedId: id,
      workbookId: id,
      workbook,
      canonicalOpenPath: `/excele?artifactId=${encodeURIComponent(id)}`,
    };
  } catch {
    // An artifact-registry id or tp_tables.id is not a generated_workbooks id.
  }

  const tableIdentity = await dependencies.resolveTableIdentity(id);
  if (tableIdentity) {
    return {
      kind: 'table',
      requestedId: id,
      tableId: tableIdentity.tableId,
      workspaceId: tableIdentity.workspaceId,
      canonicalOpenPath: buildMyWorkSheetTableOpenPath(
        tableIdentity.workspaceId,
        tableIdentity.tableId
      ),
    };
  }

  return { kind: 'missing', requestedId: id, canonicalOpenPath: null };
}
