import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { acquirePgClient } from '../database/PostgresDatabase.js';
import logger from '../utils/Logger.js';
import {
  type OrganizationExportArchiveManifest,
  writeOrganizationExportArchiveStreaming,
} from './organizationExportArchiveService.js';
import { withOrganizationExportSnapshot } from './organizationExportSnapshot.js';

export type OrganizationExportJobPhase = 'queued' | 'running' | 'ready' | 'failed';

export interface OrganizationExportJobView {
  id: string;
  organizationId: string;
  phase: OrganizationExportJobPhase;
  completedTables: number;
  totalTables: number;
  rows: number;
  percent: number;
  createdAt: string;
  updatedAt: string;
  asOf?: string;
  errorCode?: string;
  expiresAt?: string;
}

interface OrganizationExportJob extends OrganizationExportJobView {
  tokenHash: string;
  outputPath: string;
  manifest?: OrganizationExportArchiveManifest;
}

type AuditEmitter = (input: {
  actorType: 'USER';
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
}) => Promise<unknown>;

const jobs = new Map<string, OrganizationExportJob>();
const TERMINAL_JOB_RETENTION_MS = Math.max(
  60_000,
  Number(process.env.ORGANIZATION_EXPORT_JOB_RETENTION_MS || 60 * 60 * 1000)
);
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const publicView = (job: OrganizationExportJob): OrganizationExportJobView => ({
  id: job.id,
  organizationId: job.organizationId,
  phase: job.phase,
  completedTables: job.completedTables,
  totalTables: job.totalTables,
  rows: job.rows,
  percent: job.totalTables ? Math.min(100, Math.floor((job.completedTables / job.totalTables) * 100)) : 0,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  asOf: job.asOf,
  errorCode: job.errorCode,
  expiresAt: job.expiresAt,
});

export async function purgeExpiredOrganizationExportJobs(nowMs = Date.now()): Promise<number> {
  const expired = [...jobs.values()].filter(
    (job) =>
      (job.phase === 'ready' || job.phase === 'failed') &&
      Boolean(job.expiresAt) &&
      Date.parse(job.expiresAt!) <= nowMs
  );
  for (const job of expired) {
    jobs.delete(job.id);
    await fs.rm(job.outputPath, { force: true }).catch(() => undefined);
  }
  return expired.length;
}

const cleanupTimer = setInterval(() => {
  void purgeExpiredOrganizationExportJobs().catch((error) =>
    logger.warn('[OrganizationExportJob] expiry cleanup failed', { err: error })
  );
}, Math.min(TERMINAL_JOB_RETENTION_MS, 5 * 60 * 1000));
cleanupTimer.unref();

function authorizedJob(id: string, organizationId: string, resumeToken: string): OrganizationExportJob {
  const job = jobs.get(id);
  const supplied = Buffer.from(tokenHash(resumeToken));
  const expected = Buffer.from(job?.tokenHash || ''.padStart(64, '0'));
  if (
    !job ||
    job.organizationId !== organizationId ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw Object.assign(new Error('Export job not found'), { code: 'EXPORT_JOB_NOT_FOUND' });
  }
  return job;
}

export function getOrganizationExportJob(
  id: string,
  organizationId: string,
  resumeToken: string
): OrganizationExportJobView {
  void purgeExpiredOrganizationExportJobs();
  return publicView(authorizedJob(id, organizationId, resumeToken));
}

export function getOrganizationExportJobDownload(
  id: string,
  organizationId: string,
  resumeToken: string
): { path: string; manifest: OrganizationExportArchiveManifest } {
  void purgeExpiredOrganizationExportJobs();
  const job = authorizedJob(id, organizationId, resumeToken);
  if (job.phase !== 'ready' || !job.manifest) {
    throw Object.assign(new Error('Export job is not ready'), { code: 'EXPORT_JOB_NOT_READY' });
  }
  return { path: job.outputPath, manifest: job.manifest };
}

export function startOrganizationExportJob(input: {
  organizationId: string;
  actorId?: string;
  emitAudit?: AuditEmitter;
  run?: (input: {
    outputPath: string;
    onProgress: (progress: { completedTables: number; totalTables: number; rows: number }) => void;
  }) => Promise<OrganizationExportArchiveManifest>;
}): { job: OrganizationExportJobView; resumeToken: string } {
  void purgeExpiredOrganizationExportJobs();
  const now = new Date().toISOString();
  const id = randomUUID();
  const resumeToken = randomUUID();
  const job: OrganizationExportJob = {
    id,
    organizationId: input.organizationId,
    phase: 'queued',
    completedTables: 0,
    totalTables: 0,
    rows: 0,
    percent: 0,
    createdAt: now,
    updatedAt: now,
    tokenHash: tokenHash(resumeToken),
    outputPath: path.join(os.tmpdir(), `organization-export-job-${id}.zip`),
  };
  jobs.set(id, job);

  void (async () => {
    try {
      job.phase = 'running';
      job.updatedAt = new Date().toISOString();
      job.expiresAt = new Date(Date.parse(job.updatedAt) + TERMINAL_JOB_RETENTION_MS).toISOString();
      const onProgress = (progress: { completedTables: number; totalTables: number; rows: number }) => {
        job.completedTables = progress.completedTables;
        job.totalTables = progress.totalTables;
        job.rows = progress.rows;
        job.updatedAt = new Date().toISOString();
      };
      const manifest = input.run
        ? await input.run({ outputPath: job.outputPath, onProgress })
        : await (async () => {
            const client = await acquirePgClient();
            return withOrganizationExportSnapshot(client, input.organizationId, (snapshot) =>
              writeOrganizationExportArchiveStreaming(snapshot, input.organizationId, job.outputPath, {
                actorId: input.actorId,
                onProgress,
              })
            );
          })();
      job.manifest = manifest;
      job.asOf = manifest.asOf;
      job.phase = 'ready';
      job.percent = 100;
      job.updatedAt = new Date().toISOString();
      job.expiresAt = new Date(Date.parse(job.updatedAt) + TERMINAL_JOB_RETENTION_MS).toISOString();
      await input.emitAudit?.({
        actorType: 'USER',
        action: 'organization_export_completed',
        resourceType: 'organization_data',
        resourceId: input.organizationId,
        metadata: {
          jobId: id,
          asOf: manifest.asOf,
          scope: 'full_e1',
          totalRows: manifest.totalRows,
          complete: manifest.complete,
        },
      });
    } catch (error) {
      job.phase = 'failed';
      job.errorCode =
        typeof error === 'object' && error && 'code' in error ? String(error.code) : 'ORG_EXPORT_FAILED';
      job.updatedAt = new Date().toISOString();
      // Terminal retention starts when the terminal state is published. A long-running
      // operation must not inherit the already elapsed running deadline and disappear
      // before the client can observe its stable failure code.
      job.expiresAt = new Date(Date.parse(job.updatedAt) + TERMINAL_JOB_RETENTION_MS).toISOString();
      await input.emitAudit?.({
        actorType: 'USER',
        action: 'organization_export_failed',
        resourceType: 'organization_data',
        resourceId: input.organizationId,
        metadata: { jobId: id, scope: 'full_e1', errorCode: job.errorCode },
      });
      logger.error('[OrganizationExportJob] failed', { err: error, jobId: id, organizationId: input.organizationId });
    }
  })();

  return { job: publicView(job), resumeToken };
}

export async function removeOrganizationExportJobForTest(id: string): Promise<void> {
  const job = jobs.get(id);
  jobs.delete(id);
  if (job) await fs.rm(job.outputPath, { force: true });
}
