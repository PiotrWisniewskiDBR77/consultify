/**
 * Consultify Document Studio — Source Pack Connectors (Epic E4, Slice 4.2).
 *
 * Connectors are pure async adapters that take a connector-native input
 * (URL, raw text, V8 artifact id, file payload, integration handle) and
 * normalize it into a `SourcePackItem`-shaped value the registry can
 * persist via `addSourcePackItem`. They are intentionally:
 *
 *   - Stateless. Connectors do not touch the in-process registry; the
 *     route layer / chat-first entry composes them with the service.
 *   - Failure-honest. Network/format/extraction failures throw
 *     `SourcePackConnectorError` with a stable `code` so the route layer
 *     can map them to actionable HTTP responses without leaking internals.
 *   - Budget-bounded. Every connector clips body content to
 *     `DEFAULT_BODY_BUDGET_CHARS` (configurable per ingestion) and sets
 *     `bodyTruncated: true` so the LLM contract is preserved (no surprise
 *     OOM). `contentLength` carries the pre-truncation length so the
 *     audit trail shows the real source size.
 *
 * Real Notion / Drive / SharePoint integrations are stubbed in slice 4.2
 * (the `integration` connector validates shape and persists a reference
 * but does not perform the network call); concrete handlers wire in a
 * follow-up slice once the integration secrets path is approved.
 */

import { getWave5Artifact } from '../wave5ArtifactRuntimeService.js';
import type { DocumentSourceRef, SourcePackItem } from './documentStudioTypes.js';

/**
 * Default body-content budget. URLs and V8 artifacts can be large; the
 * pipeline does not want to push 5 MB transcripts into LLM prompts. A
 * 32 000-char window is enough for executive memos / interview decks
 * while keeping prompts inside provider budgets. Callers can override
 * per ingestion via the `bodyBudgetChars` option.
 */
export const DEFAULT_BODY_BUDGET_CHARS = 32_000;

/**
 * Default URL fetch timeout (ms). Short enough to keep the route layer
 * responsive; the connector aborts via `AbortController` rather than
 * blocking on slow hosts.
 */
export const DEFAULT_URL_TIMEOUT_MS = 10_000;

/**
 * Connector input shape returned to the service. `addSourcePackItem`
 * accepts exactly this shape — `itemId` and `ingestedAt`/`ingestedBy`
 * are filled by the service so connectors stay stateless.
 */
export type SourcePackItemDraft = Omit<
  SourcePackItem,
  'itemId' | 'ingestedAt' | 'ingestedBy'
>;

/**
 * Stable error code vocabulary for connector failures. The route layer
 * maps these to HTTP status codes; the chat-first entry maps them to
 * Teresa-rendered remediation hints.
 */
export type SourcePackConnectorErrorCode =
  | 'invalid_input'
  | 'unsupported_scheme'
  | 'fetch_failed'
  | 'fetch_timeout'
  | 'fetch_too_large'
  | 'extraction_failed'
  | 'artifact_not_found'
  | 'integration_not_configured';

export class SourcePackConnectorError extends Error {
  readonly code: SourcePackConnectorErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: SourcePackConnectorErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SourcePackConnectorError';
    this.code = code;
    this.details = details;
  }
}

interface BudgetOptions {
  bodyBudgetChars?: number;
}

interface RawTextConnectorInput extends BudgetOptions {
  title: string;
  body: string;
  language?: 'pl' | 'en';
  sourceTitle?: string;
  notes?: string;
}

/**
 * Wrap a consultant-pasted block of text or markdown into a normalized
 * source pack item. The body is taken verbatim — no parsing, no
 * normalization — so the consultant's exact transcript / quote is what
 * lands in the LLM prompt.
 */
export function ingestRawTextSource(input: RawTextConnectorInput): SourcePackItemDraft {
  if (!input || !input.title || !input.title.trim()) {
    throw new SourcePackConnectorError('invalid_input', 'title is required');
  }
  if (typeof input.body !== 'string' || input.body.length === 0) {
    throw new SourcePackConnectorError('invalid_input', 'body is required');
  }
  const budget = input.bodyBudgetChars ?? DEFAULT_BODY_BUDGET_CHARS;
  const fullLength = input.body.length;
  const body = input.body.length > budget ? input.body.slice(0, budget) : input.body;
  const sourceRef: DocumentSourceRef = {
    sourceType: 'text',
    sourceId: stableTextId(input.title, body),
    sourceTitle: input.sourceTitle ?? input.title,
  };
  return {
    itemType: 'text',
    title: input.title.trim(),
    body,
    bodyTruncated: body.length < fullLength,
    contentLength: fullLength,
    language: input.language,
    notes: input.notes,
    sourceRef,
  };
}

interface UrlConnectorInput extends BudgetOptions {
  url: string;
  title?: string;
  language?: 'pl' | 'en';
  notes?: string;
  /** Override the abort timeout (ms). */
  timeoutMs?: number;
  /**
   * Optional `fetch` injection for tests and offline runs. When unset,
   * the connector uses the global `fetch` available since Node 18.
   */
  fetcher?: typeof fetch;
}

const SUPPORTED_URL_SCHEMES = new Set(['http:', 'https:']);

/**
 * Fetch a URL, strip script/style and HTML tags, collapse whitespace,
 * and project to a `SourcePackItem`. Title is read from the first
 * `<title>` tag when not explicitly provided.
 */
export async function ingestUrlSource(input: UrlConnectorInput): Promise<SourcePackItemDraft> {
  if (!input || !input.url || !input.url.trim()) {
    throw new SourcePackConnectorError('invalid_input', 'url is required');
  }
  let parsed: URL;
  try {
    parsed = new URL(input.url.trim());
  } catch {
    throw new SourcePackConnectorError('invalid_input', `not a valid URL: ${input.url}`);
  }
  if (!SUPPORTED_URL_SCHEMES.has(parsed.protocol)) {
    throw new SourcePackConnectorError('unsupported_scheme', `unsupported URL scheme: ${parsed.protocol}`);
  }
  const fetcher = input.fetcher ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_URL_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  let raw: string;
  try {
    const response = await fetcher(parsed.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new SourcePackConnectorError(
        'fetch_failed',
        `URL fetch returned status ${response.status}`,
        { status: response.status, url: parsed.toString() }
      );
    }
    raw = await response.text();
  } catch (err) {
    if (err instanceof SourcePackConnectorError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SourcePackConnectorError('fetch_timeout', `URL fetch timed out after ${timeoutMs}ms`);
    }
    throw new SourcePackConnectorError('fetch_failed', `URL fetch threw: ${(err as Error).message ?? err}`);
  } finally {
    clearTimeout(timeoutHandle);
  }
  const extracted = extractTextFromHtml(raw);
  if (!extracted.body.trim()) {
    throw new SourcePackConnectorError('extraction_failed', 'no readable text extracted from URL');
  }
  const budget = input.bodyBudgetChars ?? DEFAULT_BODY_BUDGET_CHARS;
  const fullLength = extracted.body.length;
  const body = extracted.body.length > budget ? extracted.body.slice(0, budget) : extracted.body;
  const title = (input.title?.trim() || extracted.title || parsed.hostname).slice(0, 200);
  const sourceRef: DocumentSourceRef = {
    sourceType: 'url',
    sourceId: parsed.toString(),
    sourceTitle: title,
  };
  return {
    itemType: 'url',
    title,
    body,
    bodyTruncated: body.length < fullLength,
    contentLength: fullLength,
    uri: parsed.toString(),
    language: input.language,
    notes: input.notes,
    sourceRef,
  };
}

interface FileConnectorInput extends BudgetOptions {
  filename: string;
  mimeType: string;
  /**
   * Already-extracted text content. Binary file extraction (PDF, DOCX,
   * XLSX) ships in a follow-up slice; today the file connector accepts
   * plain text / markdown and rejects unknown media types so the
   * registry never persists a file it cannot consume.
   */
  body: string;
  title?: string;
  language?: 'pl' | 'en';
  notes?: string;
}

const TEXT_FILE_MIME_PREFIXES = ['text/', 'application/json', 'application/xml'];
const TEXT_FILE_EXTENSIONS = new Set(['md', 'txt', 'csv', 'tsv', 'json', 'xml', 'log']);

/**
 * Wrap an uploaded file into a normalized item. MVP scope is text / md;
 * unsupported binaries throw `extraction_failed` so the route layer can
 * surface a clear error.
 */
export function ingestFileSource(input: FileConnectorInput): SourcePackItemDraft {
  if (!input || !input.filename || !input.filename.trim()) {
    throw new SourcePackConnectorError('invalid_input', 'filename is required');
  }
  if (typeof input.body !== 'string' || input.body.length === 0) {
    throw new SourcePackConnectorError('invalid_input', 'file body must be a non-empty text string');
  }
  const mime = (input.mimeType || '').toLowerCase();
  const extension = (input.filename.split('.').pop() ?? '').toLowerCase();
  const supported =
    TEXT_FILE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) ||
    TEXT_FILE_EXTENSIONS.has(extension);
  if (!supported) {
    throw new SourcePackConnectorError(
      'extraction_failed',
      `binary file extraction not supported in MVP (mime=${mime || 'unknown'}, ext=${extension || 'unknown'})`,
      { mime, extension }
    );
  }
  const budget = input.bodyBudgetChars ?? DEFAULT_BODY_BUDGET_CHARS;
  const fullLength = input.body.length;
  const body = input.body.length > budget ? input.body.slice(0, budget) : input.body;
  const title = (input.title?.trim() || input.filename.trim()).slice(0, 200);
  const sourceRef: DocumentSourceRef = {
    sourceType: 'file',
    sourceId: `file://${input.filename.trim()}`,
    sourceTitle: title,
  };
  return {
    itemType: 'file',
    title,
    body,
    bodyTruncated: body.length < fullLength,
    contentLength: fullLength,
    uri: `file://${input.filename.trim()}`,
    language: input.language,
    notes: input.notes,
    sourceRef,
  };
}

interface V8ArtifactConnectorInput extends BudgetOptions {
  artifactId: string;
  organizationId: string;
  language?: 'pl' | 'en';
  title?: string;
  notes?: string;
  /**
   * Test-only injection: lets specs supply a fake artifact loader so the
   * connector can be unit-tested without a wave5 fixture.
   */
  loader?: typeof getWave5Artifact;
}

interface MaybeArtifact {
  artifactId?: unknown;
  artifact_id?: unknown;
  title?: unknown;
  content?: unknown;
  content_md?: unknown;
  content_text?: unknown;
}

/**
 * Reference an existing wave5 artifact in the same tenant. The connector
 * extracts the markdown / text projection and copies it into the pack
 * item body so downstream LLM prompts do not need to re-fetch.
 */
export async function ingestV8ArtifactSource(
  input: V8ArtifactConnectorInput
): Promise<SourcePackItemDraft> {
  if (!input || !input.artifactId || !input.organizationId) {
    throw new SourcePackConnectorError(
      'invalid_input',
      'artifactId and organizationId are required'
    );
  }
  const loader = input.loader ?? getWave5Artifact;
  const artifact = (await loader(input.artifactId, input.organizationId)) as MaybeArtifact | null;
  if (!artifact) {
    throw new SourcePackConnectorError('artifact_not_found', `artifact ${input.artifactId} not found`);
  }
  const candidates = [
    typeof artifact.content_md === 'string' ? (artifact.content_md as string) : undefined,
    typeof artifact.content === 'string' ? (artifact.content as string) : undefined,
    typeof artifact.content_text === 'string' ? (artifact.content_text as string) : undefined,
  ].filter((value): value is string => Boolean(value && value.trim().length));
  const rawBody = candidates[0] ?? '';
  if (!rawBody.trim()) {
    throw new SourcePackConnectorError(
      'extraction_failed',
      `artifact ${input.artifactId} has no readable content`
    );
  }
  const budget = input.bodyBudgetChars ?? DEFAULT_BODY_BUDGET_CHARS;
  const fullLength = rawBody.length;
  const body = rawBody.length > budget ? rawBody.slice(0, budget) : rawBody;
  const artifactTitle = typeof artifact.title === 'string' ? (artifact.title as string).trim() : '';
  const title = (input.title?.trim() || artifactTitle || `V8 artifact ${input.artifactId}`).slice(0, 200);
  const sourceRef: DocumentSourceRef = {
    sourceType: 'v8_artifact',
    sourceId: input.artifactId,
    sourceTitle: title,
  };
  return {
    itemType: 'v8_artifact',
    title,
    body,
    bodyTruncated: body.length < fullLength,
    contentLength: fullLength,
    uri: `wave5://artifact/${input.artifactId}`,
    language: input.language,
    notes: input.notes,
    sourceRef,
  };
}

interface IntegrationConnectorInput {
  integration: 'notion' | 'drive' | 'sharepoint' | 'confluence';
  externalId: string;
  title: string;
  preview?: string;
  language?: 'pl' | 'en';
  notes?: string;
}

/**
 * Stub connector for third-party integrations. Validates shape and
 * returns a reference-only `SourcePackItem` (no body) so the pack can
 * record that an external resource was attached without performing the
 * network call. Real handlers wire in once the integration secrets and
 * ACL scopes are approved.
 */
export function ingestIntegrationSource(input: IntegrationConnectorInput): SourcePackItemDraft {
  if (!input || !input.externalId || !input.externalId.trim()) {
    throw new SourcePackConnectorError('invalid_input', 'externalId is required');
  }
  if (!input.title || !input.title.trim()) {
    throw new SourcePackConnectorError('invalid_input', 'title is required');
  }
  const allowed: IntegrationConnectorInput['integration'][] = [
    'notion',
    'drive',
    'sharepoint',
    'confluence',
  ];
  if (!allowed.includes(input.integration)) {
    throw new SourcePackConnectorError(
      'integration_not_configured',
      `unsupported integration: ${input.integration}`
    );
  }
  const sourceRef: DocumentSourceRef = {
    sourceType: input.integration,
    sourceId: input.externalId.trim(),
    sourceTitle: input.title.trim(),
  };
  const body = input.preview?.trim() ? input.preview.trim() : undefined;
  return {
    itemType: 'integration',
    title: input.title.trim(),
    body,
    contentLength: body ? body.length : 0,
    uri: `${input.integration}://${input.externalId.trim()}`,
    language: input.language,
    notes: input.notes,
    sourceRef,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function stableTextId(title: string, body: string): string {
  // Hash-free stable id: short, deterministic, and unique enough for
  // pack items (the registry does not require a global uuid here; the
  // pack key is `${packId}::${itemId}`). Sufficient entropy comes from
  // body length and the first 32 chars.
  const head = body.slice(0, 32).replace(/[^a-zA-Z0-9]+/g, '_');
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 64);
  return `text::${safeTitle}::${body.length}::${head}`;
}

const SCRIPT_BLOCK_RE = /<script[\s\S]*?<\/script>/gi;
const STYLE_BLOCK_RE = /<style[\s\S]*?<\/style>/gi;
const NOSCRIPT_BLOCK_RE = /<noscript[\s\S]*?<\/noscript>/gi;
const TAG_RE = /<[^>]+>/g;
const TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;
const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(value: string): string {
  let out = value;
  for (const [pattern, replacement] of Object.entries(ENTITY_MAP)) {
    out = out.split(pattern).join(replacement);
  }
  out = out.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  return out;
}

interface ExtractedHtml {
  title: string;
  body: string;
}

/**
 * Strip HTML to readable text. Intentionally simple: removes script /
 * style / noscript blocks, then strips remaining tags and decodes the
 * common entities. This is good enough for evidence ingestion where
 * the consultant will glance at the text and decide whether to keep it.
 */
function extractTextFromHtml(raw: string): ExtractedHtml {
  if (!raw || typeof raw !== 'string') {
    return { title: '', body: '' };
  }
  const titleMatch = raw.match(TITLE_RE);
  const title = titleMatch && titleMatch[1] ? decodeEntities(titleMatch[1]).trim() : '';
  const stripped = raw
    .replace(SCRIPT_BLOCK_RE, ' ')
    .replace(STYLE_BLOCK_RE, ' ')
    .replace(NOSCRIPT_BLOCK_RE, ' ')
    .replace(TAG_RE, ' ');
  const decoded = decodeEntities(stripped)
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n[ \n]+/g, '\n')
    .trim();
  return { title, body: decoded };
}
