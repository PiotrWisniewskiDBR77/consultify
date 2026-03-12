import fs from 'fs';
import path from 'path';

import OpenAI from 'openai';

import {
  logFinanceError,
  logFinanceEvent,
} from './financeDiagnosticsService.js';
import type { ExtractionResult } from './financialStatementService.js';
import { llmConfigService } from './ai/llmConfigService.js';

function normalizeBaseUrl(endpoint?: string | null): string | undefined {
  if (!endpoint) return undefined;
  let base = String(endpoint).trim().replace(/\/+$/, '');
  if (!base) return undefined;
  const suffixes = [
    '/chat/completions',
    '/v1/chat/completions',
    '/v1/completions',
    '/v1/responses',
  ];
  const lower = base.toLowerCase();
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix)) {
      base = base.slice(0, -suffix.length).replace(/\/+$/, '');
      break;
    }
  }
  return base || undefined;
}

function isProviderCredentialCompatible(
  provider: 'openai' | 'anthropic',
  apiKey: string,
  baseUrl?: string
): boolean {
  const normalizedKey = String(apiKey || '').trim();
  const normalizedBaseUrl = String(baseUrl || '').trim().toLowerCase();
  if (!normalizedKey) return false;

  if (provider === 'openai') {
    if (normalizedKey.startsWith('sk-or-v1')) {
      return normalizedBaseUrl.includes('openrouter.ai');
    }
    return normalizedKey.startsWith('sk-') || normalizedBaseUrl.includes('openrouter.ai');
  }

  if (normalizedKey.startsWith('sk-or-v1')) {
    return normalizedBaseUrl.includes('openrouter.ai');
  }
  return normalizedKey.startsWith('sk-ant-') || normalizedBaseUrl.includes('openrouter.ai');
}

function resolveMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.xlsx')
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === '.xls') return 'application/vnd.ms-excel';
  if (ext === '.csv') return 'text/csv';
  return 'application/octet-stream';
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildPrompt(statementType: string): string {
  return `Extract financial statement lines from the attached file.

Target statement type: ${statementType || 'UNKNOWN'}.

Rules:
- Return only valid JSON.
- Prefer the main reporting currency/native values, not EUR comparison columns.
- Prefer the most recent period column.
- Keep negative numbers negative, including values shown in parentheses.
- Ignore page headers, footers, table headers, dates-only rows, share-count rows, EPS rows, and narrative text.
- Merge wrapped labels when needed.
- Focus on actual statement lines such as revenue, EBITDA, net profit, cash, assets, liabilities, equity, receivables, payables, inventory, operating cash flow.
- If the file contains many tables, prioritize the core financial statements and summary financial tables.

Return this JSON shape:
{
  "lines": [
    {
      "originalLabel": "Aktywa razem",
      "value": 1040761,
      "confidence": 0.93,
      "sourceRow": 1
    }
  ],
  "warnings": ["optional warning"],
  "rawTableCount": 0
}`;
}

function buildAnthropicPrompt(statementType: string, rawText: string): string {
  const normalizedText = String(rawText || '').trim().slice(0, 120000);
  return `${buildPrompt(statementType)}

Document text to process:
"""
${normalizedText}
"""`;
}

function normalizeParsedExtraction(parsed: Record<string, unknown>): ExtractionResult {
  const lines = ((parsed as any).lines || [])
    .map((line: unknown) => {
      const originalLabel = String((line as any)?.originalLabel || '').trim();
      const value = Number((line as any)?.value);
      const confidence = Number((line as any)?.confidence ?? 0.75);
      const sourceRow = Number((line as any)?.sourceRow);
      if (!originalLabel || !Number.isFinite(value)) return null;
      return {
        originalLabel,
        value,
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(confidence, 1)) : 0.75,
        sourceRow: Number.isFinite(sourceRow) ? sourceRow : undefined,
      };
    })
    .filter(Boolean) as ExtractionResult['lines'];

  return {
    lines,
    rawTableCount: Number((parsed as any).rawTableCount) || lines.length,
    warnings: Array.isArray((parsed as any).warnings)
      ? (parsed as any).warnings.map((item: unknown) => String(item))
      : [],
  };
}

export async function extractFinancialLinesWithOpenAI(params: {
  filePath?: string | null;
  fileName?: string | null;
  statementType?: string | null;
  traceId?: string;
}): Promise<ExtractionResult | null> {
  const filePath = String(params.filePath || '').trim();
  if (!filePath || !fs.existsSync(filePath)) return null;

  const providerConfig = await llmConfigService.getProviderConfig('openai');
  const apiKey = providerConfig?.apiKey || process.env.OPENAI_API_KEY?.trim();
  const baseURL = normalizeBaseUrl(providerConfig?.endpoint);
  if (!apiKey) {
    logFinanceEvent('statement.extract.ai_skipped', {
      traceId: params.traceId,
      reason: 'openai_not_configured',
      fileName: params.fileName || path.basename(filePath),
    });
    return null;
  }
  if (!isProviderCredentialCompatible('openai', apiKey, baseURL)) {
    logFinanceEvent('statement.extract.ai_skipped', {
      traceId: params.traceId,
      reason: 'openai_invalid_provider_credentials',
      fileName: params.fileName || path.basename(filePath),
      hasEndpoint: Boolean(baseURL),
    });
    return null;
  }

  const fileName = params.fileName || path.basename(filePath);
  const model = providerConfig?.modelId || 'gpt-4o';
  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  try {
    const buffer = fs.readFileSync(filePath);
    const mimeType = resolveMimeType(fileName);
    const fileData = `data:${mimeType};base64,${buffer.toString('base64')}`;

    logFinanceEvent('statement.extract.ai_started', {
      traceId: params.traceId,
      fileName,
      mimeType,
      sizeBytes: buffer.length,
      model,
      statementType: params.statementType,
    });

    const response = await client.responses.create({
      model,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              filename: fileName,
              file_data: fileData,
            },
            {
              type: 'input_text',
              text: buildPrompt(params.statementType || 'UNKNOWN'),
            },
          ],
        },
      ],
    });

    const outputText = String((response as any)?.output_text || '');
    const parsed = extractJsonObject(outputText);
    if (!parsed || !Array.isArray(parsed.lines)) {
      throw new Error('OpenAI did not return a valid extraction JSON payload');
    }

    const result = normalizeParsedExtraction(parsed);

    logFinanceEvent('statement.extract.ai_completed', {
      traceId: params.traceId,
      fileName,
      model,
      lineCount: result.lines.length,
      rawTableCount: result.rawTableCount,
      warnings: result.warnings,
    });

    return result;
  } catch (error) {
    logFinanceError('statement.extract.ai_failed', error, {
      traceId: params.traceId,
      fileName,
      model,
      statementType: params.statementType,
    });
    return null;
  }
}

export async function extractFinancialLinesWithAnthropic(params: {
  text?: string | null;
  fileName?: string | null;
  statementType?: string | null;
  traceId?: string;
}): Promise<ExtractionResult | null> {
  const rawText = String(params.text || '').trim();
  if (!rawText) return null;

  const providerConfig = await llmConfigService.getProviderConfig('anthropic');
  const apiKey = providerConfig?.apiKey || process.env.ANTHROPIC_API_KEY?.trim();
  const baseURL = normalizeBaseUrl(providerConfig?.endpoint);
  if (!apiKey) {
    logFinanceEvent('statement.extract.ai_skipped', {
      traceId: params.traceId,
      reason: 'anthropic_not_configured',
      fileName: params.fileName || 'statement.txt',
    });
    return null;
  }
  if (!isProviderCredentialCompatible('anthropic', apiKey, baseURL)) {
    logFinanceEvent('statement.extract.ai_skipped', {
      traceId: params.traceId,
      reason: 'anthropic_invalid_provider_credentials',
      fileName: params.fileName || 'statement.txt',
      hasEndpoint: Boolean(baseURL),
    });
    return null;
  }

  const fileName = params.fileName || 'statement.txt';
  const model = providerConfig?.modelId || 'claude-sonnet-4-6';

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });

    logFinanceEvent('statement.extract.ai_started', {
      traceId: params.traceId,
      fileName,
      sizeBytes: rawText.length,
      model,
      provider: 'anthropic',
      statementType: params.statementType,
    });

    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: buildAnthropicPrompt(params.statementType || 'UNKNOWN', rawText),
        },
      ],
    });

    const outputText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    const parsed = extractJsonObject(outputText);
    if (!parsed || !Array.isArray(parsed.lines)) {
      throw new Error('Anthropic did not return a valid extraction JSON payload');
    }

    const result = normalizeParsedExtraction(parsed);

    logFinanceEvent('statement.extract.ai_completed', {
      traceId: params.traceId,
      fileName,
      model,
      provider: 'anthropic',
      lineCount: result.lines.length,
      rawTableCount: result.rawTableCount,
      warnings: result.warnings,
    });

    return result;
  } catch (error) {
    logFinanceError('statement.extract.ai_failed', error, {
      traceId: params.traceId,
      fileName,
      model,
      provider: 'anthropic',
      statementType: params.statementType,
    });
    return null;
  }
}
