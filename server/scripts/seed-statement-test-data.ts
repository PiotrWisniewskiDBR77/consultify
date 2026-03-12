#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

import { all as dbAll, get as dbGet, run as dbRun } from '../src/utils/DbPromise.js';
import {
  autoMapLines,
  classifyStatementDocument,
  confirmStatement,
  createStatement,
  detectStatementType,
  evaluateStatementReadiness,
  extractFinancialLines,
  locateStatementSections,
  openStatementRepairSession,
  persistStatementCandidateRows,
  persistStatementExtractedSections,
  persistStatementMappingCandidates,
  recordStatementQualityRun,
  recordStatementSourceArtifact,
  resolveDuplicateSuggestedMappings,
  resolveStatementColumnSelection,
  saveStatementValues,
  snapshotStatementValueVersion,
  startStatementIngestRun,
  updateStatementIngestRun,
  updateStatementReadinessState,
  updateStatementStatus,
} from '../src/services/financialStatementService.js';
import logger from '../src/utils/Logger.js';

type SeedFixture = {
  name: string;
  fileName: string;
  text: string;
  expectedStatementType: 'P&L' | 'BS' | 'CF';
  expectedDocumentClass: string;
  entityName?: string;
  periodStart?: string;
  periodEnd?: string;
  periodLabel?: string;
  seedOutcome?: 'ready' | 'recoverable';
  forceUnmappedContains?: string[];
};

function env(name: string, fallback?: string): string | undefined {
  const raw = process.env[name];
  const value = raw != null ? String(raw).trim() : '';
  return value || fallback;
}

async function pickOrgId(): Promise<string | undefined> {
  const fromEnv = env('ORG_ID');
  if (fromEnv) return fromEnv;
  const row = await dbGet<{ id: string }>(`SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`, []);
  return row?.id ? String(row.id) : undefined;
}

async function pickUserId(orgId: string): Promise<string | undefined> {
  const fromEnv = env('USER_ID');
  if (fromEnv) return fromEnv;
  const row = await dbGet<{ id: string }>(
    `SELECT id FROM users WHERE organization_id = ? ORDER BY created_at ASC LIMIT 1`,
    [orgId]
  );
  return row?.id ? String(row.id) : undefined;
}

function loadFixtures(): SeedFixture[] {
  const root = process.cwd();
  const fixtureDir = path.join(root, 'server/scripts/fixtures/statement-ready');
  const targets = [
    'pl-polish-manufacturing.json',
    'bs-polish-manufacturing.xlsx.json',
    'cf-polish-manufacturing.json',
  ];
  return targets.map((file) =>
    JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'))
  ) as SeedFixture[];
}

async function deleteExistingSeededStatements(orgId: string, fixtures: SeedFixture[]): Promise<void> {
  const fileNames = fixtures.map((fixture) => fixture.fileName);
  for (const fileName of fileNames) {
    await dbRun(
      `DELETE FROM financial_statements
       WHERE organization_id = ?
         AND source_file_name = ?`,
      [orgId, fileName],
      { fallback: false }
    );
  }
}

function buildValidationMessages(fixture: SeedFixture, forcedUnmappedCount: number) {
  if ((fixture.seedOutcome || 'ready') === 'ready') return [] as Array<{ type: 'warning'; code: string; message: string }>;
  return [
    {
      type: 'warning' as const,
      code: 'UNMAPPED_FINANCIAL_LINES',
      message:
        forcedUnmappedCount > 0
          ? `Seeded recoverable scenario with ${forcedUnmappedCount} unresolved financial line(s).`
          : 'Seeded recoverable scenario for workspace recovery testing.',
    },
  ];
}

async function seedFixture(orgId: string, userId: string, fixture: SeedFixture): Promise<{ statementId: string; outcome: string }> {
  const documentProfile = classifyStatementDocument({
    fileName: fixture.fileName,
    parseMethod: fixture.fileName.endsWith('.xlsx') ? 'excel_import' : 'text_extraction',
    text: fixture.text,
  });
  const detection = detectStatementType(fixture.text);
  const sections = locateStatementSections(fixture.text, detection.statementType);
  const columnSelection = resolveStatementColumnSelection(fixture.text, detection);
  const extracted = extractFinancialLines(fixture.text, detection.statementType);
  const mapped = resolveDuplicateSuggestedMappings(
    await autoMapLines(extracted.lines, detection.statementType, {
      organizationId: orgId,
      templateFamily: documentProfile.templateFamily,
    })
  );

  const outcome = fixture.seedOutcome || 'ready';
  const forceUnmappedTerms = new Set((fixture.forceUnmappedContains || []).map((entry) => String(entry).trim()));
  const preparedRows = mapped.map((row) => {
    const shouldUnmap =
      outcome === 'recoverable' &&
      Array.from(forceUnmappedTerms).some((term) => term && row.originalLabel.includes(term));
    if (!shouldUnmap) return row;
    return {
      ...row,
      suggestedCanonicalId: undefined,
      suggestedCanonicalLabel: undefined,
      mappingReason: 'seeded_recovery_case',
      classificationReason: 'seed_forced_unmapped',
      mappingCandidates: (row.mappingCandidates || []).map((candidate) => ({
        ...candidate,
        selected: false,
      })),
    };
  });

  const periodStart = fixture.periodStart || detection.periodStart || '2025-01-01';
  const periodEnd = fixture.periodEnd || detection.periodEnd || '2025-12-31';
  const periodLabel = fixture.periodLabel || detection.periodLabel || 'FY 2025';
  const statementId = await createStatement({
    organizationId: orgId,
    statementType:
      detection.statementType === 'UNKNOWN' ? fixture.expectedStatementType : detection.statementType,
    periodStart,
    periodEnd,
    periodLabel,
    currency: detection.currency || 'PLN',
    scaling: detection.scaling || 'units',
    sourceFileName: fixture.fileName,
    sourceFilePath: `seed://statement-test-data/${fixture.fileName}`,
    parseMethod: fixture.fileName.endsWith('.xlsx') ? 'manual' : 'text_extraction',
    overallConfidence: Math.max(0.82, detection.confidence || 0.82),
    documentClass: documentProfile.documentClass,
    extractionStrategy: documentProfile.extractionStrategy,
    templateFamily: documentProfile.templateFamily,
    createdBy: userId,
  });

  await dbRun(
    `UPDATE financial_statements
     SET entity_name = ?, notes = ?
     WHERE id = ?`,
    [
      fixture.entityName || 'Seeded statement',
      `Seeded by seed-statement-test-data.ts from fixture ${fixture.name}.`,
      statementId,
    ],
    { fallback: false }
  );

  const ingestRunId = await startStatementIngestRun({
    statementId,
    organizationId: orgId,
    sourceFileName: fixture.fileName,
    sourceFilePath: `seed://statement-test-data/${fixture.fileName}`,
    parseMethod: fixture.fileName.endsWith('.xlsx') ? 'manual' : 'text_extraction',
    documentClass: documentProfile.documentClass,
    extractionStrategy: documentProfile.extractionStrategy,
    templateFamily: documentProfile.templateFamily,
    rawTextLength: fixture.text.length,
    summary: { fixture: fixture.name, seeded: true },
    createdBy: userId,
  });

  await recordStatementSourceArtifact({
    statementId,
    ingestRunId,
    artifactType: 'raw_text',
    stage: 'upload',
    contentText: fixture.text,
    metadata: { fixture: fixture.name, seeded: true },
    createdBy: userId,
  });

  await recordStatementSourceArtifact({
    statementId,
    ingestRunId,
    artifactType: 'document_profile',
    stage: 'detect',
    contentJson: {
      detection,
      columnSelection,
      documentProfile,
    },
    metadata: { fixture: fixture.name, seeded: true },
    createdBy: userId,
  });

  const persistedSections = await persistStatementExtractedSections({
    statementId,
    ingestRunId,
    sections,
  });
  const sectionIdsByKey = Object.fromEntries(
    persistedSections.map((section) => [section.sectionKey, section.sectionId])
  );

  const candidateRows = await persistStatementCandidateRows({
    statementId,
    ingestRunId,
    rows: preparedRows,
    sectionIdsByKey,
    statementType: detection.statementType,
    currency: detection.currency,
    scaling: detection.scaling,
  });
  const candidateRowIdsBySourceRow = Object.fromEntries(
    candidateRows
      .filter((row) => typeof row.sourceRow === 'number')
      .map((row) => [Number(row.sourceRow), row.candidateRowId])
  ) as Record<number, string>;

  await persistStatementMappingCandidates({
    statementId,
    ingestRunId,
    rows: preparedRows,
    candidateRowIdsBySourceRow,
  });

  const values = preparedRows.map((row) => ({
    canonicalLineId: row.suggestedCanonicalId || null,
    originalLabel: row.originalLabel,
    value: row.value,
    confidence: row.confidence,
    sourceRow: row.sourceRow,
    mappingStatus: row.suggestedCanonicalId ? 'auto' : 'unmapped',
    isNonFinancial: !!row.isNonFinancial,
    classificationReason: row.classificationReason,
  }));

  await saveStatementValues(statementId, values);
  await snapshotStatementValueVersion({
    statementId,
    sourceStage: outcome === 'ready' ? 'confirm' : 'repair',
    values,
    createdBy: userId,
  });

  const validationStatus = outcome === 'ready' ? 'pass' : 'needs_review';
  const validationMessages = buildValidationMessages(
    fixture,
    values.filter((value) => !value.canonicalLineId && !value.isNonFinancial).length
  );

  await updateStatementStatus(statementId, 'mapped', validationStatus, validationMessages);
  const readiness = evaluateStatementReadiness({
    rawStatus: outcome === 'ready' ? 'confirmed' : 'mapped',
    statementType: detection.statementType,
    validationStatus,
    currency: detection.currency,
    scaling: detection.scaling,
    validationMessages,
    values,
  });
  await updateStatementReadinessState(statementId, readiness);

  await recordStatementQualityRun({
    statementId,
    organizationId: orgId,
    stage: 'upload',
    resultStatus: 'info',
    summary: `Seeded source fixture ${fixture.name}.`,
    payload: { fileName: fixture.fileName },
    createdBy: userId,
  });
  await recordStatementQualityRun({
    statementId,
    organizationId: orgId,
    stage: 'detect',
    resultStatus: 'pass',
    readinessStatus: readiness.readinessStatus,
    strategy: documentProfile.extractionStrategy,
    summary: `Detected ${detection.statementType} from seeded fixture.`,
    payload: { detection, columnSelection, documentProfile },
    createdBy: userId,
  });
  await recordStatementQualityRun({
    statementId,
    organizationId: orgId,
    stage: 'extract',
    resultStatus: 'pass',
    readinessStatus: readiness.readinessStatus,
    summary: `Extracted ${preparedRows.length} candidate rows from seeded fixture.`,
    payload: { extractedCount: preparedRows.length, sectionCount: sections.length },
    createdBy: userId,
  });
  await recordStatementQualityRun({
    statementId,
    organizationId: orgId,
    stage: 'map',
    resultStatus: outcome === 'ready' ? 'pass' : 'warning',
    readinessStatus: readiness.readinessStatus,
    summary:
      outcome === 'ready'
        ? 'All seeded financial lines remained mapped.'
        : 'Seeded recoverable case keeps one financial line unresolved.',
    reasonCodes: readiness.reasonCodes,
    payload: { values },
    createdBy: userId,
  });
  await recordStatementQualityRun({
    statementId,
    organizationId: orgId,
    stage: 'readiness',
    resultStatus: outcome === 'ready' ? 'pass' : 'warning',
    readinessStatus: readiness.readinessStatus,
    summary: readiness.summary,
    reasonCodes: readiness.reasonCodes,
    payload: readiness,
    createdBy: userId,
  });

  if (outcome === 'ready') {
    await confirmStatement(statementId, userId, readiness);
    await recordStatementQualityRun({
      statementId,
      organizationId: orgId,
      stage: 'confirm',
      resultStatus: 'pass',
      readinessStatus: readiness.readinessStatus,
      summary: 'Seeded statement is confirmed and ready for downstream workflows.',
      payload: { statementId },
      createdBy: userId,
    });
  } else {
    await openStatementRepairSession({
      statementId,
      organizationId: orgId,
      ingestRunId,
      startedBy: userId,
      summary: 'Seeded recoverable statement for recovery workbench testing.',
      payload: {
        fixture: fixture.name,
        forceUnmappedContains: fixture.forceUnmappedContains || [],
      },
    });
    await recordStatementQualityRun({
      statementId,
      organizationId: orgId,
      stage: 'repair',
      resultStatus: 'warning',
      readinessStatus: readiness.readinessStatus,
      summary: 'Repair session opened for seeded recoverable statement.',
      reasonCodes: readiness.reasonCodes,
      payload: { statementId },
      createdBy: userId,
    });
  }

  await updateStatementIngestRun({
    ingestRunId,
    currentStage: outcome === 'ready' ? 'confirm' : 'repair',
    runStatus: 'completed',
    documentClass: documentProfile.documentClass,
    extractionStrategy: documentProfile.extractionStrategy,
    templateFamily: documentProfile.templateFamily,
    rawTextLength: fixture.text.length,
    reasonCodes: readiness.reasonCodes,
    summary: {
      fixture: fixture.name,
      seeded: true,
      outcome,
      readinessStatus: readiness.readinessStatus,
      valuesCount: values.length,
    },
  });

  return { statementId, outcome };
}

async function main(): Promise<void> {
  const orgId = await pickOrgId();
  if (!orgId) {
    throw new Error('No organizations found. Pass ORG_ID=<id> or seed an organization first.');
  }
  const userId = await pickUserId(orgId);
  if (!userId) {
    throw new Error(`No users found for organization ${orgId}. Pass USER_ID=<id> or seed a user first.`);
  }

  const fixtures = loadFixtures();
  await deleteExistingSeededStatements(orgId, fixtures);

  const created: Array<{ name: string; statementId: string; outcome: string }> = [];
  for (const fixture of fixtures) {
    const seeded = await seedFixture(orgId, userId, fixture);
    created.push({
      name: fixture.name,
      statementId: seeded.statementId,
      outcome: seeded.outcome,
    });
  }

  logger.info(
    `[seed-statement-test-data] Seeded ${created.length} statements for org=${orgId}: ${created
      .map((entry) => `${entry.name}:${entry.outcome}:${entry.statementId}`)
      .join(', ')}`
  );
}

main().catch((error) => {
  logger.error('[seed-statement-test-data] Failed:', (error as Error)?.message || error);
  process.exit(1);
});
