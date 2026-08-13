/**
 * CW-PERF — records the exact runner environment, per document 14 DoD-I
 * ("Record exact CPU, RAM, OS, Node/browser/PostgreSQL versions, database
 * size, concurrency, warm/cold state and network-throttling profile.").
 *
 * This harness is a SERVER/DB-ONLY performance profile (see
 * PERFORMANCE_EVIDENCE.md for the exact scope boundary) — it therefore
 * records CPU/RAM/OS/Node/PostgreSQL, never a browser/network-throttle
 * profile (there is no browser in this harness's path).
 */

import os from 'node:os';
import type { Pool } from 'pg';

export interface RunnerEnvInfo {
  cpuModel: string;
  logicalCpuCount: number;
  totalMemGB: number;
  freeMemGBAtStart: number;
  os: string;
  osRelease: string;
  arch: string;
  nodeVersion: string;
  pgVersion: string | null;
  gcExposed: boolean;
}

export async function collectRunnerEnvInfo(pool: Pool): Promise<RunnerEnvInfo> {
  const cpus = os.cpus();
  let pgVersion: string | null = null;
  try {
    const r = await pool.query<{ version: string }>('SELECT version()');
    pgVersion = r.rows[0]?.version ?? null;
  } catch {
    pgVersion = null;
  }
  return {
    cpuModel: cpus[0]?.model ?? 'unknown',
    logicalCpuCount: cpus.length,
    totalMemGB: Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 100) / 100,
    freeMemGBAtStart: Math.round((os.freemem() / (1024 * 1024 * 1024)) * 100) / 100,
    os: os.platform(),
    osRelease: os.release(),
    arch: os.arch(),
    nodeVersion: process.version,
    pgVersion,
    gcExposed: typeof (globalThis as { gc?: () => void }).gc === 'function',
  };
}
