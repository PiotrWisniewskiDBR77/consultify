#!/usr/bin/env tsx
/**
 * Automated import of all Apator PDF financial statements.
 * Runs the full pipeline: Upload → Detect → Extract → Map → Save Values → Confirm
 * for each document × statement type combination (4 PDFs × 3 types = 12 statements).
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  assertFinanceImportApiSession,
  resolveFinanceImportApiUrl,
  resolveFinanceImportOrgId,
} from './lib/financeImportTarget.js';

const BASE_URL = resolveFinanceImportApiUrl();
const EXPECTED_ORG_ID = resolveFinanceImportOrgId();

const DOCUMENTS = [
  { label: 'Apator SA Raport R 2024', file: 'knowledge/Finanse/Apator SA Raport R 2024.pdf' },
  { label: 'Grupa Apator Raport RS 2023', file: 'knowledge/Finanse/Grupa Apator Raport RS 2023.pdf' },
  { label: 'Grupa Apator Raport RS 2024', file: 'knowledge/Finanse/Grupa Apator Raport RS 2024.pdf' },
  { label: 'Raport skonsolidowany Apator RS 2022', file: 'knowledge/Finanse/Raport-skonsolidowany-Apator.pdf' },
];

const STATEMENT_TYPES: Array<{ type: 'BS' | 'P&L' | 'CF'; apiAlias: string }> = [
  { type: 'BS', apiAlias: 'BS' },
  { type: 'P&L', apiAlias: 'PL' },
  { type: 'CF', apiAlias: 'CF' },
];

async function getAuthToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/register-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `import-bot-${Date.now()}@demo.com`,
      password: 'ImportBot2026!',
      firstName: 'AutoImport',
    }),
  });
  const data = (await res.json()) as any;
  if (!data.token) {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'import-bot@demo.com', password: 'ImportBot2026!' }),
    });
    const loginData = (await loginRes.json()) as any;
    if (!loginData.token) throw new Error('Failed to authenticate: ' + JSON.stringify(loginData));
    return loginData.token;
  }
  return data.token;
}

async function uploadPDF(
  token: string,
  filePath: string,
): Promise<{ statementId: string; detection: any; columnSelection: any }> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const fileBuffer = fs.readFileSync(absolutePath);
  const fileName = path.basename(absolutePath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, fileName);

  const res = await fetch(`${BASE_URL}/api/finance-statements/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = (await res.json()) as any;
  if (!data.statementId) throw new Error(`Upload failed for ${fileName}: ${JSON.stringify(data)}`);
  return data;
}

async function detectType(
  token: string,
  statementId: string,
  statementType: string,
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/finance-statements/${statementId}/detect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ statementType }),
  });
  return (await res.json()) as any;
}

async function extractLines(
  token: string,
  statementId: string,
  statementType: string,
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/finance-statements/${statementId}/extract`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ statementType }),
  });
  return (await res.json()) as any;
}

async function mapLines(
  token: string,
  statementId: string,
  lines?: any[],
): Promise<any> {
  const body = lines && lines.length > 0 ? { lines } : {};
  const res = await fetch(`${BASE_URL}/api/finance-statements/${statementId}/map`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as any;
}

async function saveValues(
  token: string,
  statementId: string,
  mappedLines: any[],
): Promise<any> {
  const values = mappedLines
    .filter((line: any) => !line.isNonFinancial)
    .map((line: any) => ({
      canonicalLineId: line.suggestedCanonicalId || null,
      originalLabel: line.originalLabel,
      value: Number(line.value || 0),
      confidence: Number(line.confidence || 0),
      sourcePage: line.sourcePage ?? null,
      sourceRow: line.sourceRow ?? null,
      mappingStatus: line.suggestedCanonicalId ? 'auto' : 'unmapped',
      isNonFinancial: false,
      mappingConfidence: Number(
        line.mappingCandidates?.find((c: any) => c.selected)?.score || line.confidence || 0,
      ),
    }));

  const res = await fetch(`${BASE_URL}/api/finance-statements/${statementId}/values`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  const data = (await res.json()) as any;
  return {
    savedCount: data.savedCount || 0,
    readinessStatus: data.readiness?.readinessStatus || 'unknown',
    isReady: data.readiness?.isReady || false,
    ...data,
  };
}

async function confirmStatement(
  token: string,
  statementId: string,
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/finance-statements/${statementId}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return (await res.json()) as any;
}

interface ImportResult {
  document: string;
  statementType: string;
  statementId: string;
  extractedLines: number;
  mappedLines: number;
  coveragePct: number;
  status: string;
  readinessStatus: string;
}

async function importSingleStatement(
  token: string,
  doc: { label: string; file: string },
  statementType: 'BS' | 'P&L' | 'CF',
  apiAlias: string,
): Promise<ImportResult> {
  const tag = `[${doc.label} / ${statementType}]`;
  console.log(`\n${tag} Starting import...`);

  // Step 1: Upload
  console.log(`${tag} Step 1/6: Uploading PDF...`);
  const upload = await uploadPDF(token, doc.file);
  const { statementId } = upload;
  console.log(`${tag}   → statementId: ${statementId}`);

  // Step 2: Detect with correct type (use apiAlias to avoid & encoding issues)
  console.log(`${tag} Step 2/6: Detecting as ${statementType}...`);
  const detection = await detectType(token, statementId, apiAlias);
  console.log(`${tag}   → detected: ${detection.detection?.statementType}, period: ${detection.detection?.periodLabel}`);

  // Step 3: Extract
  console.log(`${tag} Step 3/6: Extracting financial lines...`);
  const extraction = await extractLines(token, statementId, apiAlias);
  const lineCount = extraction.lineCount || extraction.lines?.length || 0;
  console.log(`${tag}   → extracted ${lineCount} lines (strategy: ${extraction.extractionStrategy})`);

  // Step 4: Map (pass extracted lines directly to avoid DB persistence issues)
  console.log(`${tag} Step 4/6: Mapping to canonical lines...`);
  const mapping = await mapLines(token, statementId, extraction.lines);
  if (mapping.error) {
    console.error(`${tag}   ✗ Map failed: ${typeof mapping.error === 'string' ? mapping.error : mapping.error?.message || JSON.stringify(mapping.error).slice(0, 200)}`);
    throw new Error(`Map failed: ${typeof mapping.error === 'string' ? mapping.error : mapping.error?.message || 'unknown'}`);
  }
  const allLines = mapping.mappedLines || [];
  const eligible = allLines.filter((l: any) => !l.isNonFinancial);
  const mapped = eligible.filter((l: any) => l.suggestedCanonicalId);
  const coverage = eligible.length > 0 ? Math.round((mapped.length / eligible.length) * 100) : 0;
  console.log(`${tag}   → mapped: ${mapped.length}/${eligible.length} (${coverage}%)`);

  // Step 5: Save values
  console.log(`${tag} Step 5/6: Saving values...`);
  const saved = await saveValues(token, statementId, allLines);
  console.log(`${tag}   → saved ${saved.savedCount} values, readiness: ${saved.readinessStatus}`);

  // Step 6: Confirm (only if ready)
  let confirmStatus = saved.readinessStatus;
  if (saved.isReady) {
    console.log(`${tag} Step 6/6: Confirming statement...`);
    const confirmed = await confirmStatement(token, statementId);
    confirmStatus = confirmed.status || confirmed.readinessStatus || 'confirmed';
    console.log(`${tag}   → status: ${confirmStatus}`);
  } else {
    console.log(`${tag} Step 6/6: Skipping confirm (readiness: ${saved.readinessStatus})`);
  }

  return {
    document: doc.label,
    statementType,
    statementId,
    extractedLines: eligible.length,
    mappedLines: mapped.length,
    coveragePct: coverage,
    status: confirmStatus,
    readinessStatus: saved.readinessStatus,
  };
}

async function main(): Promise<void> {
  console.log('=== Apator Financial Statements Auto-Import ===');
  console.log(`API: ${BASE_URL}`);
  console.log(`Documents: ${DOCUMENTS.length}`);
  console.log(`Types per document: ${STATEMENT_TYPES.join(', ')}`);
  console.log(`Total statements to import: ${DOCUMENTS.length * STATEMENT_TYPES.length}`);
  console.log('');

  const token = await getAuthToken();
  const session = await assertFinanceImportApiSession({
    baseUrl: BASE_URL,
    token,
    expectedOrganizationId: EXPECTED_ORG_ID,
  });
  console.log(`Target org: ${session.organizationId} | user: ${session.userId}`);
  console.log('Authenticated successfully.\n');

  const results: ImportResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const doc of DOCUMENTS) {
    for (const { type: stType, apiAlias } of STATEMENT_TYPES) {
      try {
        const result = await importSingleStatement(token, doc, stType, apiAlias);
        results.push(result);
        successCount++;
      } catch (error) {
        console.error(`\n[ERROR] ${doc.label} / ${stType}: ${(error as Error).message}`);
        failCount++;
        results.push({
          document: doc.label,
          statementType: stType,
          statementId: 'FAILED',
          extractedLines: 0,
          mappedLines: 0,
          coveragePct: 0,
          status: 'error',
          readinessStatus: (error as Error).message.slice(0, 80),
        });
      }
    }
  }

  console.log('\n\n========================================');
  console.log('       IMPORT SUMMARY');
  console.log('========================================\n');
  console.log(`Total: ${results.length} | Success: ${successCount} | Failed: ${failCount}\n`);

  console.log(
    'Document'.padEnd(45) +
      'Type'.padEnd(6) +
      'Lines'.padEnd(8) +
      'Mapped'.padEnd(8) +
      'Coverage'.padEnd(10) +
      'Readiness',
  );
  console.log('-'.repeat(95));

  let totalMapped = 0;
  let totalEligible = 0;
  for (const r of results) {
    totalMapped += r.mappedLines;
    totalEligible += r.extractedLines;
    console.log(
      r.document.padEnd(45) +
        r.statementType.padEnd(6) +
        String(r.extractedLines).padEnd(8) +
        String(r.mappedLines).padEnd(8) +
        `${r.coveragePct}%`.padEnd(10) +
        r.readinessStatus,
    );
  }
  console.log('-'.repeat(95));
  const totalCoverage = totalEligible > 0 ? Math.round((totalMapped / totalEligible) * 100) : 0;
  console.log(
    'TOTAL'.padEnd(45) +
      ''.padEnd(6) +
      String(totalEligible).padEnd(8) +
      String(totalMapped).padEnd(8) +
      `${totalCoverage}%`.padEnd(10),
  );
}

main().catch((error) => {
  console.error('Fatal error:', (error as Error).message);
  process.exit(1);
});
