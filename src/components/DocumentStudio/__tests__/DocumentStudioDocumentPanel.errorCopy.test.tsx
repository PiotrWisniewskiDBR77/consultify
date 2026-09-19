/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    listDocumentStudioSnapshots: vi.fn(async () => [
      {
        versionId: 'snapshot-1',
        versionNumber: 1,
        capturedAt: '2026-05-09T00:00:00.000Z',
        origin: 'manual',
      },
    ]),
    getDocumentStudioSchemaDiff: vi.fn(async () => {
      throw { errorCode: 'VALIDATION', correlationId: 'doc-corr-1' };
    }),
    createDocumentStudioSnapshot: vi.fn(),
    rollbackDocumentStudioSnapshot: vi.fn(),
    getDocumentStudioArtifact: vi.fn(),
  };
});

vi.mock('@/services/executionModuleStandard/api', () => ({
  fetchExecutionModuleManifest: vi.fn(),
  validateExecutionModuleManifest: vi.fn(),
}));

vi.mock('@/utils/sheetArtifactOpen', () => ({
  buildMyWorkSheetTableOpenPath: vi.fn(() => '/my-work/table'),
  resolveTablePlatformWorkspaceIdForTable: vi.fn(async () => 'workspace-1'),
}));

import { SchemaDiffPanel } from '../DocumentStudioDocumentPanel';

describe('DocumentStudio SchemaDiffPanel error copy', () => {
  it('renders governed app-error copy through the Document Studio TFunction adapter', async () => {
    render(<SchemaDiffPanel artifactId="artifact-1" onSchemaUpdated={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/doc-corr-1/)).toBeInTheDocument());
    expect(screen.getByText(/Some of the provided information needs attention\./)).toBeInTheDocument();
  });
});
