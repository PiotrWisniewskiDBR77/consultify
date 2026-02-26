/**
 * Architecture Sanity Checks (T122)
 * Detects duplicate mounts, missing modules, provides health checks.
 */
import logger from './Logger.js';

export interface SanityReport {
  duplicateMounts: Array<{ path: string; count: number }>;
  healthChecks: Array<{
    name: string;
    status: 'ok' | 'warn' | 'error';
    detail: string;
  }>;
  timestamp: string;
}

interface ExpressLayer {
  name?: string;
  regexp?: { source?: string };
}

export function detectDuplicateMounts(app: {
  _router?: { stack?: ExpressLayer[] };
}): Array<{ path: string; count: number }> {
  const duplicates: Array<{ path: string; count: number }> = [];
  try {
    const stack = app._router?.stack;
    if (!stack) return duplicates;
    const pathCounts = new Map<string, number>();
    for (const layer of stack) {
      if (layer.name === 'router' && layer.regexp?.source) {
        const match = layer.regexp.source.match(/\^\\\/([^?]+)/);
        if (match) {
          const path = '/' + match[1].replace(/\\\//g, '/').replace(/\\/g, '');
          pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
        }
      }
    }
    for (const [path, count] of pathCounts) {
      if (count > 1) duplicates.push({ path, count });
    }
  } catch {
    // Non-critical
  }
  return duplicates;
}

export async function runAIHealthChecks(): Promise<SanityReport['healthChecks']> {
  const checks: SanityReport['healthChecks'] = [];

  try {
    const { all } = await import('../utils/DbPromise.js');
    const tables = [
      'ai_system_prompts',
      'ai_usage_logs',
      'knowledge_documents',
      'knowledge_chunks',
      'ai_feedback',
      'ai_doc_usage_log',
      'ai_doc_access_approvals',
    ];
    for (const table of tables) {
      try {
        await all(`SELECT 1 FROM ${table} LIMIT 1`);
        checks.push({
          name: `db:${table}`,
          status: 'ok',
          detail: 'Table accessible',
        });
      } catch {
        checks.push({
          name: `db:${table}`,
          status: 'warn',
          detail: 'Table not accessible',
        });
      }
    }
  } catch {
    checks.push({
      name: 'db:connection',
      status: 'error',
      detail: 'DB unavailable',
    });
  }

  checks.push({
    name: 'env:TAVILY_API_KEY',
    status: process.env.TAVILY_API_KEY ? 'ok' : 'warn',
    detail: process.env.TAVILY_API_KEY ? 'Configured' : 'Not configured — web search disabled',
  });

  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    checks.push({
      name: 'env:ENABLE_STUB_ROUTES',
      status:
        String(process.env.ENABLE_STUB_ROUTES || '').toLowerCase() === 'true' ? 'error' : 'ok',
      detail:
        String(process.env.ENABLE_STUB_ROUTES || '').toLowerCase() === 'true'
          ? 'Stub routes enabled in production'
          : 'Stub routes disabled in production',
    });
  }

  try {
    const mod = await import('../services/ai/promptAssembler.js');
    const assembler = mod.promptAssembler || mod.default;
    const isUnavailable =
      assembler && (assembler as unknown as Record<string, unknown>).__unavailable__;
    checks.push({
      name: 'service:promptAssembler',
      status: assembler && !isUnavailable ? 'ok' : 'warn',
      detail: assembler && !isUnavailable ? 'Available' : 'Unavailable',
    });
  } catch {
    checks.push({
      name: 'service:promptAssembler',
      status: 'warn',
      detail: 'Import failed',
    });
  }

  try {
    await import('../services/ai/citationVerifier.js');
    checks.push({
      name: 'service:citationVerifier',
      status: 'ok',
      detail: 'Available',
    });
  } catch {
    checks.push({
      name: 'service:citationVerifier',
      status: 'warn',
      detail: 'Import failed',
    });
  }

  return checks;
}

export async function runFullSanityCheck(app?: {
  _router?: { stack?: ExpressLayer[] };
}): Promise<SanityReport> {
  const duplicateMounts = app ? detectDuplicateMounts(app) : [];
  const healthChecks = await runAIHealthChecks();

  if (duplicateMounts.length > 0) {
    logger.warn(`[ArchSanity] ${duplicateMounts.length} duplicate route mounts detected`);
  }
  const errors = healthChecks.filter((c) => c.status === 'error');
  if (errors.length > 0) {
    logger.error(`[ArchSanity] ${errors.length} critical health check failures`);
  }

  return {
    duplicateMounts,
    healthChecks,
    timestamp: new Date().toISOString(),
  };
}

export default { detectDuplicateMounts, runAIHealthChecks, runFullSanityCheck };
