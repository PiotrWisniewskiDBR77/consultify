import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { OrganizationExportArchiveManifest } from '../organizationExportArchiveService.js';
import {
  getOrganizationExportJob,
  getOrganizationExportJobDownload,
  purgeExpiredOrganizationExportJobs,
  removeOrganizationExportJobForTest,
  startOrganizationExportJob,
} from '../organizationExportJobService.js';

const manifest: OrganizationExportArchiveManifest = {
  formatVersion: 'consultify-organization-export-archive-v1',
  contractVersion: 'test',
  asOf: '2026-09-13T20:00:00.000Z',
  organizationId: 'org-a',
  totalRows: 2,
  rowCounts: { tasks: 2 },
  files: [],
  excludedTables: [],
  derivedTables: [],
  notIncluded: [],
  unresolvedTables: [],
  skippedReads: [],
  complete: true,
};

describe('resumable organization export job', () => {
  it('continues after the initiating call, exposes progress by secret token, and resumes download', async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = startOrganizationExportJob({
      organizationId: 'org-a',
      run: async ({ outputPath, onProgress }) => {
        onProgress({ completedTables: 1, totalTables: 4, rows: 2 });
        await blocked;
        await fs.writeFile(outputPath, 'archive');
        onProgress({ completedTables: 4, totalTables: 4, rows: 2 });
        return manifest;
      },
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getOrganizationExportJob(started.job.id, 'org-a', started.resumeToken)).toMatchObject({
        phase: 'running',
        completedTables: 1,
        percent: 25,
      });
      expect(() => getOrganizationExportJob(started.job.id, 'org-a', 'wrong')).toThrowError();
      release();
      await expect.poll(() => getOrganizationExportJob(started.job.id, 'org-a', started.resumeToken).phase).toBe('ready');
      expect(getOrganizationExportJobDownload(started.job.id, 'org-a', started.resumeToken).manifest.asOf).toBe(manifest.asOf);
    } finally {
      release();
      await removeOrganizationExportJobForTest(started.job.id);
    }
  });

  it('audits a stable failed outcome without exposing internal error details', async () => {
    const audit = vi.fn(async () => undefined);
    const started = startOrganizationExportJob({
      organizationId: 'org-held',
      emitAudit: audit,
      run: async () => {
        throw Object.assign(new Error('private database detail'), { code: 'LEGAL_HOLD' });
      },
    });
    try {
      await expect
        .poll(() => getOrganizationExportJob(started.job.id, 'org-held', started.resumeToken).phase)
        .toBe('failed');
      const view = getOrganizationExportJob(started.job.id, 'org-held', started.resumeToken);
      expect(view).toMatchObject({ phase: 'failed', errorCode: 'LEGAL_HOLD' });
      expect(JSON.stringify(view)).not.toContain('private database detail');
      await expect.poll(() => audit.mock.calls.length).toBe(1);
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'organization_export_failed',
          metadata: expect.objectContaining({ errorCode: 'LEGAL_HOLD', scope: 'full_e1' }),
        })
      );
    } finally {
      await removeOrganizationExportJobForTest(started.job.id);
    }
  });

  it('expires terminal job metadata and removes its ZIP artifact', async () => {
    const started = startOrganizationExportJob({
      organizationId: 'org-expiry',
      run: async ({ outputPath }) => {
        await fs.writeFile(outputPath, 'archive');
        return manifest;
      },
    });
    await expect
      .poll(() => getOrganizationExportJob(started.job.id, 'org-expiry', started.resumeToken).phase)
      .toBe('ready');
    const downloadable = getOrganizationExportJobDownload(
      started.job.id,
      'org-expiry',
      started.resumeToken
    );
    expect(await fs.readFile(downloadable.path, 'utf8')).toBe('archive');

    const expiresAt = getOrganizationExportJob(
      started.job.id,
      'org-expiry',
      started.resumeToken
    ).expiresAt;
    expect(expiresAt).toBeTruthy();
    expect(await purgeExpiredOrganizationExportJobs(Date.parse(expiresAt!) + 1)).toBe(1);
    expect(() => getOrganizationExportJob(started.job.id, 'org-expiry', started.resumeToken)).toThrow();
    await expect(fs.stat(downloadable.path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('starts failed retention at the terminal transition after a run longer than the running TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T20:00:00.000Z'));
    let rejectRun!: (error: Error) => void;
    let markRunBlocked!: () => void;
    const runBlocked = new Promise<void>((resolve) => {
      markRunBlocked = resolve;
    });
    const blocked = new Promise<OrganizationExportArchiveManifest>((_resolve, reject) => {
      rejectRun = reject;
    });
    const started = startOrganizationExportJob({
      organizationId: 'org-long-failure',
      run: async ({ outputPath }) => {
        await fs.writeFile(outputPath, 'partial-archive');
        markRunBlocked();
        return blocked;
      },
    });
    try {
      await runBlocked;
      const running = getOrganizationExportJob(
        started.job.id,
        'org-long-failure',
        started.resumeToken
      );
      expect(running.phase).toBe('running');
      const retentionMs = Date.parse(running.expiresAt!) - Date.parse(running.updatedAt);

      await vi.advanceTimersByTimeAsync(retentionMs + 1_000);
      rejectRun(Object.assign(new Error('late private failure'), { code: 'LATE_FAILURE' }));
      await vi.advanceTimersByTimeAsync(0);

      const failed = getOrganizationExportJob(
        started.job.id,
        'org-long-failure',
        started.resumeToken
      );
      expect(failed).toMatchObject({ phase: 'failed', errorCode: 'LATE_FAILURE' });
      expect(Date.parse(failed.expiresAt!) - Date.parse(failed.updatedAt)).toBe(retentionMs);
      const outputPath = path.join(os.tmpdir(), `organization-export-job-${started.job.id}.zip`);
      expect(await fs.readFile(outputPath, 'utf8')).toBe('partial-archive');

      expect(await purgeExpiredOrganizationExportJobs(Date.parse(failed.expiresAt!) - 1)).toBe(0);
      expect(
        getOrganizationExportJob(started.job.id, 'org-long-failure', started.resumeToken).phase
      ).toBe('failed');
      expect(await purgeExpiredOrganizationExportJobs(Date.parse(failed.expiresAt!) + 1)).toBe(1);
      expect(() =>
        getOrganizationExportJob(started.job.id, 'org-long-failure', started.resumeToken)
      ).toThrow();
      await expect(fs.stat(outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await removeOrganizationExportJobForTest(started.job.id);
      vi.useRealTimers();
    }
  });
});
