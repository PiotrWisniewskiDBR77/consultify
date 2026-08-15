import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

const queryOne = vi.fn();
vi.mock('../../../utils/queryHelpers.js', () => ({ queryOne: (...args: any[]) => queryOne(...args), withPgTransaction: vi.fn() }));

const bytes = Buffer.from('real-docx-binary');
const sha = createHash('sha256').update(bytes).digest('hex');
const row = {
  run_id: 'run-1', transformation_case_id: 'case-1', organization_id: 'org-1', case_version: 7,
  facts_digest: 'facts-1', docx_path: '/exports/report.docx', docx_sha256: sha,
  pptx_path: '/exports/deck.pptx', pptx_sha256: 'ppt-sha', generated_at: '2026-08-15T00:00:00Z',
  native_report_id: 'report-1', native_report_version_id: 'report-v1', native_report_version_number: 1,
  report_registry_artifact_id: 'registry-1', native_deck_id: 'deck-1', native_deck_version_id: 'deck-v1',
  native_deck_version_number: 1, deck_registry_artifact_id: 'registry-2',
  verified_report_version_id: 'report-v1', verified_report_version_number: 1,
  verified_registry_artifact_id: 'registry-1', report_title: 'Final report', report_status: 'APPROVED',
  report_sections: [{ sectionKey: 'executive', title: 'Executive summary', content: 'Done', orderIndex: 0 }],
};

describe('AGT-003 native DOC cold reopen', () => {
  it('reopens owner, immutable version, registry receipt and verified binary', async () => {
    queryOne.mockResolvedValueOnce(row);
    const { coldReopenNativeFinalReport } = await import('../transformationFinalOutputService.js');
    const result = await coldReopenNativeFinalReport('case-1', 'org-1', async () => bytes);
    expect(result).toMatchObject({
      run: { runId: 'run-1', idempotentReplay: true },
      report: { reportId: 'report-1', reportVersionId: 'report-v1', registryArtifactId: 'registry-1' },
      binary: { sha256: sha, verified: true },
    });
    expect(queryOne.mock.calls[0][1]).toEqual(['case-1', 'org-1']);
  });

  it.each([
    ['missing owner', null, bytes],
    ['binary missing', row, new Error('ENOENT')],
    ['binary drift', row, Buffer.from('tampered')],
    ['version drift', { ...row, verified_report_version_id: 'other' }, bytes],
    ['empty owner content', { ...row, report_sections: [] }, bytes],
  ])('fails closed for %s', async (_label, databaseRow, fileResult) => {
    queryOne.mockResolvedValueOnce(databaseRow);
    const { coldReopenNativeFinalReport } = await import('../transformationFinalOutputService.js');
    const reader = async () => { if (fileResult instanceof Error) throw fileResult; return fileResult as Buffer; };
    await expect(coldReopenNativeFinalReport('case-1', 'org-1', reader)).resolves.toBeNull();
  });
});
