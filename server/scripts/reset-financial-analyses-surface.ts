#!/usr/bin/env tsx

import {
  approveAnalysis,
  createAnalysis,
  runFullAnalysis,
} from '../src/services/financialAnalysisService.js';
import { get as dbGet, run as dbRun } from '../src/utils/DbPromise.js';
import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

type AnalysisSeed = {
  title: string;
  description: string;
  sourceFileName: string;
};

const SCRIPT_LABEL = 'reset-financial-analyses-surface';
const DEFAULT_ORG_ID = 'dbr77';
const DEFAULT_USER_ID = 'bf0f01a2-9ada-4cb8-a331-4dce1930e4f3';

const ANALYSIS_SEEDS: AnalysisSeed[] = [
  {
    title: 'DBR77 | Apator SA FY24 Financial Ratio Review',
    description:
      '18 KPI ratio analysis for Apator SA focused on profitability, cost structure, liquidity, working capital and leverage.',
    sourceFileName: 'Apator SA Raport R 2024.pdf',
  },
  {
    title: 'DBR77 | Grupa Apator FY24 Financial Ratio Review',
    description:
      'Board-style financial ratio review for Grupa Apator built around the standard 18 KPI scorecard.',
    sourceFileName: 'Grupa Apator Raport RS 2024.pdf',
  },
  {
    title: 'DBR77 | KGHM FY24 Financial Ratio Review',
    description:
      'CFO ratio analysis for KGHM with emphasis on margin resilience, cash conversion and balance sheet stability.',
    sourceFileName: 'Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf',
  },
  {
    title: 'DBR77 | BMW Group FY24 Financial Ratio Review',
    description:
      'Full 18 KPI financial analysis for BMW Group aligned to the new profitability, cash and leverage template.',
    sourceFileName: 'BMW-Group-Financial-Statements-2024-en.pdf',
  },
];

async function resolveUserId(orgId: string): Promise<string> {
  const explicit = String(process.env.USER_ID || '').trim();
  if (explicit) return explicit;

  const preferred = await dbGet<{ id: string }>(
    `SELECT id FROM users WHERE id = ? AND organization_id = ? LIMIT 1`,
    [DEFAULT_USER_ID, orgId]
  );
  if (preferred?.id) return String(preferred.id);

  const fallback = await dbGet<{ id: string }>(
    `SELECT id FROM users WHERE organization_id = ? ORDER BY created_at ASC NULLS LAST LIMIT 1`,
    [orgId]
  );
  if (!fallback?.id) {
    throw new Error(`[${SCRIPT_LABEL}] No user found for organization "${orgId}".`);
  }
  return String(fallback.id);
}

async function resolveReadyPack(orgId: string, sourceFileName: string): Promise<{ id: string; currency: string }> {
  const pack = await dbGet<{ id: string; currency: string }>(
    `SELECT p.id, COALESCE(p.currency, 'PLN') AS currency
     FROM financial_statement_packs p
     WHERE p.organization_id = ?
       AND LOWER(COALESCE(p.pack_readiness_status, 'pending')) = 'ready'
       AND EXISTS (
         SELECT 1
         FROM financial_statements fs
         WHERE fs.statement_pack_id = p.id
           AND fs.organization_id = p.organization_id
           AND fs.source_file_name = ?
       )
     ORDER BY p.updated_at DESC
     LIMIT 1`,
    [orgId, sourceFileName]
  );

  if (!pack?.id) {
    throw new Error(
      `[${SCRIPT_LABEL}] Ready statement pack not found for source file "${sourceFileName}".`
    );
  }

  return { id: String(pack.id), currency: String(pack.currency || 'PLN') };
}

async function main(): Promise<void> {
  const orgId = String(process.env.ORG_ID || DEFAULT_ORG_ID).trim();
  requireConfirmation('CONFIRM_RESET_FINANCIAL_ANALYSES', 'YES', SCRIPT_LABEL);

  const target = resolveScriptDatabaseTarget({
    label: SCRIPT_LABEL,
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: false,
  });
  logSelectedDatabaseTarget(SCRIPT_LABEL, target);

  const userId = await resolveUserId(orgId);

  const resolvedSeeds = await Promise.all(
    ANALYSIS_SEEDS.map(async (seed) => {
      const pack = await resolveReadyPack(orgId, seed.sourceFileName);
      return { ...seed, packId: pack.id, currency: pack.currency };
    })
  );

  await dbRun(`DELETE FROM financial_analyses WHERE organization_id = ?`, [orgId]);

  const created: Array<{ title: string; analysisId: string; packId: string }> = [];
  for (const seed of resolvedSeeds) {
    const analysis = await createAnalysis(
      orgId,
      {
        title: seed.title,
        description: seed.description,
        analysisType: 'comprehensive',
        currency: seed.currency,
        sourceStatementPackId: seed.packId,
      },
      userId
    );

    await runFullAnalysis(orgId, analysis.id);
    await approveAnalysis(orgId, analysis.id, userId);

    created.push({
      title: seed.title,
      analysisId: analysis.id,
      packId: seed.packId,
    });
  }

  console.log(`✅ Reset financial analyses completed for ${orgId}.`);
  console.table(created);
}

main().catch((error) => {
  console.error(
    `❌ ${SCRIPT_LABEL} failed:`,
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
