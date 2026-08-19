#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

import {
  assertFinanceImportApiSession,
  resolveFinanceImportApiUrl,
  resolveFinanceImportOrgId,
} from './lib/financeImportTarget.js';

type Target = {
  statementType: 'BS' | 'P&L' | 'CF';
  periodLabel?: string;
};

type Entry = {
  label: string;
  filePath: string;
  targets: Target[];
};

type ImportResult = {
  label: string;
  filePath: string;
  statementType: 'BS' | 'P&L' | 'CF';
  statementId: string | null;
  uploadOk: boolean;
  detectOk: boolean;
  extractOk: boolean;
  mapOk: boolean;
  valuesOk: boolean;
  confirmOk: boolean;
  documentClass: string | null;
  extractionStrategy: string | null;
  selectedPeriodLabel: string | null;
  comparisonPeriodLabel: string | null;
  extractedLineCount: number;
  eligibleLineCount: number;
  mappedLineCount: number;
  coveragePct: number;
  readinessStatus: string | null;
  readinessScore: number | null;
  reasonCodes: string[];
  validationCodes: string[];
  topUnmappedLabels: string[];
  error: string | null;
};

const BASE_URL = resolveFinanceImportApiUrl();
const EXPECTED_ORG_ID = resolveFinanceImportOrgId();

function readFlagValue(flag: string): string | null {
  const entry = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return entry ? entry.slice(flag.length + 1) : null;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function toApiStatementAlias(statementType: 'BS' | 'P&L' | 'CF'): 'BS' | 'PL' | 'CF' {
  if (statementType === 'P&L') return 'PL';
  return statementType;
}

function mimeTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (ext === '.xls') return 'application/vnd.ms-excel';
  if (ext === '.csv') return 'text/csv';
  return 'application/octet-stream';
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function getAuthToken(): Promise<string> {
  const seedEmail = `finance-import-bot-${Date.now()}@demo.com`;
  const seedPassword = process.env.FINANCE_IMPORT_BOT_PASSWORD;
  if (!seedPassword) {
    throw new Error('FINANCE_IMPORT_BOT_PASSWORD is required; no password fallback is permitted');
  }

  const registerRes = await fetch(`${BASE_URL}/api/auth/register-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: seedEmail,
      password: seedPassword,
      firstName: 'FinanceImport',
    }),
  });
  const registerData = (await registerRes.json()) as any;
  if (registerData?.token) return String(registerData.token);

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: seedEmail,
      password: seedPassword,
    }),
  });
  const loginData = (await loginRes.json()) as any;
  if (!loginData?.token) {
    throw new Error(`Authentication failed: ${JSON.stringify(loginData || registerData)}`);
  }
  return String(loginData.token);
}

async function fetchJson(
  token: string,
  url: string,
  options?: { method?: string; body?: unknown; formData?: FormData }
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let body: BodyInit | undefined;
  if (options?.formData) {
    body = options.formData;
  } else if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options?.method || 'GET',
    headers,
    body,
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const detail =
      parsed?.error || parsed?.detail || parsed?.message || parsed?.raw || `HTTP ${res.status}`;
    throw new Error(String(detail));
  }
  return parsed;
}

async function uploadSource(token: string, absolutePath: string): Promise<any> {
  const fileBuffer = fs.readFileSync(absolutePath);
  const blob = new Blob([fileBuffer], { type: mimeTypeForFile(absolutePath) });
  const formData = new FormData();
  formData.append('file', blob, path.basename(absolutePath));
  return fetchJson(token, `${BASE_URL}/api/finance-statements/upload`, {
    method: 'POST',
    formData,
  });
}

function buildMarkdown(results: ImportResult[]): string {
  const lines: string[] = ['# Finance Import API Test Report', ''];
  lines.push(`- API URL: \`${BASE_URL}\``);
  lines.push(`- Statements attempted: ${results.length}`);
  lines.push(`- Ready after values: ${results.filter((r) => r.readinessStatus === 'ready').length}`);
  lines.push(
    `- Recoverable after values: ${results.filter((r) => r.readinessStatus === 'recoverable').length}`
  );
  lines.push(`- Rejected after values: ${results.filter((r) => r.readinessStatus === 'rejected').length}`);
  lines.push(`- Hard failures: ${results.filter((r) => r.error).length}`);
  lines.push('');
  lines.push('| Document | Type | Eligible | Mapped | Coverage | Readiness | Confirmed | Error |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- | --- | --- |');
  for (const result of results) {
    lines.push(
      `| ${result.label} | ${result.statementType} | ${result.eligibleLineCount} | ${result.mappedLineCount} | ${result.coveragePct}% | ${result.readinessStatus || 'n/a'} | ${result.confirmOk ? 'yes' : 'no'} | ${result.error || '—'} |`
    );
  }
  lines.push('');

  const grouped = new Map<string, ImportResult[]>();
  for (const result of results) {
    const list = grouped.get(result.label) || [];
    list.push(result);
    grouped.set(result.label, list);
  }

  for (const [label, items] of grouped) {
    lines.push(`## ${label}`);
    lines.push('');
    lines.push(`- File: \`${items[0]?.filePath || ''}\``);
    lines.push('');
    for (const item of items) {
      lines.push(`### ${item.statementType}`);
      lines.push('');
      lines.push(`- Statement ID: \`${item.statementId || 'n/a'}\``);
      lines.push(`- Document class: \`${item.documentClass || 'n/a'}\``);
      lines.push(`- Extraction strategy: \`${item.extractionStrategy || 'n/a'}\``);
      lines.push(`- Selected period: \`${item.selectedPeriodLabel || 'n/a'}\``);
      lines.push(`- Comparison period: \`${item.comparisonPeriodLabel || 'n/a'}\``);
      lines.push(`- Extracted lines: ${item.extractedLineCount}`);
      lines.push(`- Eligible lines: ${item.eligibleLineCount}`);
      lines.push(`- Mapped lines: ${item.mappedLineCount}`);
      lines.push(`- Coverage: ${item.coveragePct}%`);
      lines.push(`- Readiness: \`${item.readinessStatus || 'n/a'}\`${item.readinessScore != null ? ` (${item.readinessScore})` : ''}`);
      lines.push(
        `- Reason codes: ${item.reasonCodes.length ? item.reasonCodes.map((value) => `\`${value}\``).join(', ') : 'none'}`
      );
      lines.push(
        `- Validation codes: ${item.validationCodes.length ? item.validationCodes.map((value) => `\`${value}\``).join(', ') : 'none'}`
      );
      lines.push(
        `- Top unmapped labels: ${item.topUnmappedLabels.length ? item.topUnmappedLabels.map((value) => `\`${value}\``).join(', ') : 'none'}`
      );
      lines.push(`- Error: ${item.error || 'none'}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

async function importTarget(token: string, entry: Entry, target: Target, root: string): Promise<ImportResult> {
  const absolutePath = path.isAbsolute(entry.filePath) ? entry.filePath : path.join(root, entry.filePath);
  const apiStatementType = toApiStatementAlias(target.statementType);
  const result: ImportResult = {
    label: entry.label,
    filePath: entry.filePath,
    statementType: target.statementType,
    statementId: null,
    uploadOk: false,
    detectOk: false,
    extractOk: false,
    mapOk: false,
    valuesOk: false,
    confirmOk: false,
    documentClass: null,
    extractionStrategy: null,
    selectedPeriodLabel: null,
    comparisonPeriodLabel: null,
    extractedLineCount: 0,
    eligibleLineCount: 0,
    mappedLineCount: 0,
    coveragePct: 0,
    readinessStatus: null,
    readinessScore: null,
    reasonCodes: [],
    validationCodes: [],
    topUnmappedLabels: [],
    error: null,
  };

  try {
    const upload = await uploadSource(token, absolutePath);
    result.uploadOk = true;
    result.statementId = String(upload.statementId || '');
    result.documentClass = String(upload.documentClass || upload.documentProfile?.documentClass || '') || null;

    const detect = await fetchJson(
      token,
      `${BASE_URL}/api/finance-statements/${result.statementId}/detect`,
      {
        method: 'POST',
        body: {
          statementType: apiStatementType,
          periodLabel: target.periodLabel || undefined,
        },
      }
    );
    result.detectOk = true;
    result.selectedPeriodLabel = String(detect?.columnSelection?.selectedPeriodLabel || detect?.detection?.periodLabel || '') || null;
    result.comparisonPeriodLabel = String(detect?.columnSelection?.comparisonPeriodLabel || '') || null;
    result.documentClass = String(detect?.documentProfile?.documentClass || result.documentClass || '') || null;

    const extraction = await fetchJson(
      token,
      `${BASE_URL}/api/finance-statements/${result.statementId}/extract`,
      {
        method: 'POST',
        body: {
          statementType: apiStatementType,
          periodLabel: target.periodLabel || undefined,
        },
      }
    );
    result.extractOk = true;
    result.extractedLineCount = Number(extraction?.lineCount || extraction?.lines?.length || 0);
    result.extractionStrategy = String(extraction?.extractionStrategy || '') || null;
    result.selectedPeriodLabel =
      String(extraction?.columnSelection?.selectedPeriodLabel || result.selectedPeriodLabel || '') || null;
    result.comparisonPeriodLabel =
      String(extraction?.columnSelection?.comparisonPeriodLabel || result.comparisonPeriodLabel || '') || null;

    const mapping = await fetchJson(
      token,
      `${BASE_URL}/api/finance-statements/${result.statementId}/map`,
      {
        method: 'POST',
        body: { lines: Array.isArray(extraction?.lines) ? extraction.lines : [] },
      }
    );
    result.mapOk = true;

    const mappedLines = Array.isArray(mapping?.mappedLines) ? mapping.mappedLines : [];
    const eligible = mappedLines.filter((line: any) => !line?.isNonFinancial);
    const mapped = eligible.filter((line: any) => !!line?.suggestedCanonicalId);
    const values = mappedLines
      .filter((line: any) => !line?.isNonFinancial)
      .map((line: any) => ({
        canonicalLineId: line.suggestedCanonicalId || null,
        originalLabel: String(line.originalLabel || ''),
        value: Number(line.value || 0),
        confidence: Number(line.confidence || 0),
        sourcePage: line.sourcePage != null ? Number(line.sourcePage) : null,
        sourceRow: line.sourceRow != null ? Number(line.sourceRow) : null,
        mappingStatus: line.suggestedCanonicalId ? 'auto' : 'unmapped',
        isNonFinancial: false,
        classificationReason: line.classificationReason || null,
      }));

    result.eligibleLineCount = eligible.length;
    result.mappedLineCount = mapped.length;
    result.coveragePct = eligible.length > 0 ? Math.round((mapped.length / eligible.length) * 100) : 0;
    result.topUnmappedLabels = eligible
      .filter((line: any) => !line?.suggestedCanonicalId)
      .slice(0, 10)
      .map((line: any) => String(line.originalLabel || ''));

    const saved = await fetchJson(
      token,
      `${BASE_URL}/api/finance-statements/${result.statementId}/values`,
      {
        method: 'PUT',
        body: { values },
      }
    );
    result.valuesOk = true;
    result.readinessStatus = String(saved?.readiness?.readinessStatus || '') || null;
    result.readinessScore =
      saved?.readiness?.readinessScore != null ? Number(saved.readiness.readinessScore) : null;
    result.reasonCodes = Array.isArray(saved?.readiness?.reasonCodes)
      ? saved.readiness.reasonCodes.map((code: unknown) => String(code))
      : [];
    result.validationCodes = Array.isArray(saved?.validation?.messages)
      ? saved.validation.messages.map((message: any) => String(message?.code || message?.message || ''))
      : [];

    if (result.readinessStatus === 'ready') {
      await fetchJson(
        token,
        `${BASE_URL}/api/finance-statements/${result.statementId}/confirm`,
        {
          method: 'POST',
          body: {},
        }
      );
      result.confirmOk = true;
    }
  } catch (error) {
    result.error = formatError(error);
  }

  return result;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const manifestPath =
    readFlagValue('--manifest') ||
    path.join(root, 'docs/validation/finance-v3/STATEMENT_IMPORT_SAMPLE_MANIFEST_2026-03-15.json');
  const outputJson =
    readFlagValue('--outJson') ||
    path.join(root, 'docs/validation/finance-v3/generated/FINANCE_IMPORT_API_TEST_RESULTS_2026-03-15.json');
  const outputMd =
    readFlagValue('--outMd') ||
    path.join(root, 'docs/validation/finance-v3/generated/FINANCE_IMPORT_API_TEST_RESULTS_2026-03-15.md');

  const manifest = readJson<Entry[]>(manifestPath);
  const token = await getAuthToken();
  const session = await assertFinanceImportApiSession({
    baseUrl: BASE_URL,
    token,
    expectedOrganizationId: EXPECTED_ORG_ID,
  });
  console.log(
    `[import-finance-documents-via-api] Target api=${BASE_URL} org=${session.organizationId} user=${session.userId}`
  );
  const results: ImportResult[] = [];

  for (const entry of manifest) {
    for (const target of entry.targets) {
      console.log(`[import-finance-documents-via-api] ${entry.label} / ${target.statementType}`);
      const result = await importTarget(token, entry, target, root);
      results.push(result);
      console.log(
        `[import-finance-documents-via-api] -> readiness=${result.readinessStatus || 'n/a'} coverage=${result.coveragePct}% error=${result.error || 'none'}`
      );
    }
  }

  fs.mkdirSync(path.dirname(outputJson), { recursive: true });
  fs.writeFileSync(outputJson, JSON.stringify(results, null, 2));
  fs.writeFileSync(outputMd, buildMarkdown(results));

  console.log(`[import-finance-documents-via-api] Wrote ${outputJson}`);
  console.log(`[import-finance-documents-via-api] Wrote ${outputMd}`);
}

main().catch((error) => {
  console.error('[import-finance-documents-via-api] Failed:', (error as Error)?.message || error);
  process.exit(1);
});
