import RagService from '../../ragService.js';
import { organizationMemoryStore } from '../organizationMemoryStore.js';

import { searchKB } from './agentKnowledgeBase.js';
import type { SourceUsed } from './types.js';

type KbValidationMode = 'lenient' | 'strict_agent_kb';

type CacheEntry = { ts: number; value: SourceUsed[] };
const KB_CACHE_TTL_MS = 10 * 60 * 1000;
const KB_CACHE_MAX = 200;
const kbCache = new Map<string, CacheEntry>();

function getCacheKey(args: {
  organizationId: string | null;
  agentId: string;
  query: string;
  limit: number;
}): string {
  return `${args.organizationId || 'null'}|${args.agentId}|${args.limit}|${args.query.slice(0, 1200)}`;
}

function cacheGet(key: string): SourceUsed[] | null {
  const e = kbCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > KB_CACHE_TTL_MS) {
    kbCache.delete(key);
    return null;
  }
  return e.value;
}

function cacheSet(key: string, value: SourceUsed[]) {
  if (kbCache.size >= KB_CACHE_MAX) {
    // delete oldest
    let oldestKey: string | null = null;
    let oldestTs = Number.POSITIVE_INFINITY;
    for (const [k, v] of kbCache.entries()) {
      if (v.ts < oldestTs) {
        oldestTs = v.ts;
        oldestKey = k;
      }
    }
    if (oldestKey) kbCache.delete(oldestKey);
  }
  kbCache.set(key, { ts: Date.now(), value });
}

function hasAny(text: string, needles: string[]): boolean {
  const t = String(text || '').toLowerCase();
  return needles.some((n) => t.includes(n.toLowerCase()));
}

function validateKbSnippetForAudit(args: {
  snippet: string;
  mode: KbValidationMode;
}): { ok: boolean; reason?: string } {
  const snippet = String(args.snippet || '').trim();
  if (!snippet) return { ok: false, reason: 'empty_snippet' };

  // Hard block: no URLs in KB snippets used for audit (prevents "web-like" confabulation).
  if (/https?:\/\/\S+/i.test(snippet)) {
    return { ok: false, reason: 'kb_contains_url' };
  }

  // Hard block: vendor/brand injection (policy: KB should not contain vendors/benchmarks "from nowhere")
  const vendorNeedles = [
    'sap',
    's/4hana',
    'oracle',
    'microsoft dynamics',
    'dynamics 365',
    'salesforce',
    'servicenow',
    'workday',
    'netsuite',
    'snowflake',
    'databricks',
    'gcp',
    'aws',
    'azure',
  ];
  if (hasAny(snippet, vendorNeedles)) {
    return { ok: false, reason: 'kb_contains_vendor' };
  }

  // Soft block: "how to implement" instructions (KB is for risks/constraints/checklists)
  const implementationNeedles = [
    'step-by-step',
    'how to implement',
    'implementation guide',
    'install',
    'configure',
    // PL
    'krok po kroku',
    'instrukcja wdrożenia',
    'jak wdrożyć',
    'wdrożenie krok',
    'zainstaluj',
    'skonfiguruj',
  ];
  if (hasAny(snippet, implementationNeedles)) {
    return { ok: false, reason: 'kb_looks_like_implementation_guide' };
  }

  if (args.mode === 'strict_agent_kb') {
    // Strict: enforce "content types" alignment (checklists/failure modes/constraints/metrics/definitions/cases)
    const typeNeedles = [
      'checklist',
      'lista kontrolna',
      'failure mode',
      'tryb awarii',
      'constraints',
      'constraint',
      'ograniczenie',
      'metric',
      'wskaźnik',
      'definition',
      'definicja',
      'case',
      'przypadek',
    ];
    const hasBullets = /^\s*(?:-|\*|\d+\.)\s+\S+/m.test(snippet);
    if (!hasAny(snippet, typeNeedles) && !hasBullets) {
      return { ok: false, reason: 'kb_not_audit_type' };
    }
  }

  return { ok: true };
}

export async function retrieveAgentAuditKnowledge(args: {
  organizationId: string | null;
  agentId: string;
  query: string;
  limit?: number;
}): Promise<SourceUsed[]> {
  const limit = args.limit ?? 4;
  const orgId = args.organizationId || null;

  const cacheKey = getCacheKey({
    organizationId: orgId,
    agentId: args.agentId,
    query: args.query,
    limit,
  });
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const out: SourceUsed[] = [];

  // 1) Global / org-scoped knowledge_chunks via RagService hybrid search
  try {
    const agentCategory = `agent:${args.agentId}`;
    const chunks = await RagService.hybridSearch(args.query, {
      limit,
      organizationId: orgId,
      enableReranking: true,
      alpha: 0.6,
    });

    const raw = Array.isArray(chunks) ? chunks : [];
    const agentSpecific = raw.filter((c: any) => {
      const cat = String(c?.doc_category || c?.category || '').trim();
      return cat.toLowerCase() === agentCategory.toLowerCase();
    });
    const preferred = agentSpecific.length > 0 ? agentSpecific : raw;
    const validationMode: KbValidationMode =
      agentSpecific.length > 0 ? 'strict_agent_kb' : 'lenient';

    for (const c of preferred || []) {
      const docId = String((c as any).doc_id || (c as any).docId || '').trim();
      const docCategory = String((c as any).doc_category || (c as any).category || '').trim();
      const docVersionRaw = (c as any).doc_version ?? (c as any).version;
      const title = String((c as any).filename || (c as any).source || 'Knowledge Base').trim();
      const snippet = String((c as any).content || '').trim().slice(0, 900);
      const score =
        typeof (c as any).hybridScore === 'number'
          ? (c as any).hybridScore
          : typeof (c as any).vectorScore === 'number'
            ? (c as any).vectorScore
            : typeof (c as any).bm25Score === 'number'
              ? (c as any).bm25Score
              : undefined;

      if (!snippet) continue;
      if (!docId) continue;

      const kbValidation = validateKbSnippetForAudit({ snippet, mode: validationMode });
      if (!kbValidation.ok) continue;

      out.push({
        type: 'kb_snippet',
        kbId: docCategory || 'knowledge_chunks',
        docId,
        title,
        version:
          docVersionRaw !== undefined && docVersionRaw !== null && String(docVersionRaw).trim()
            ? String(docVersionRaw).trim()
            : undefined,
        snippet,
        score,
      });
    }

    // If we had agent-specific KB but filtered everything out, fall back to general KB results (lenient)
    if (agentSpecific.length > 0 && out.length === 0) {
      for (const c of raw || []) {
        const docId = String((c as any).doc_id || (c as any).docId || '').trim();
        const docCategory = String((c as any).doc_category || (c as any).category || '').trim();
        const docVersionRaw = (c as any).doc_version ?? (c as any).version;
        const title = String((c as any).filename || (c as any).source || 'Knowledge Base').trim();
        const snippet = String((c as any).content || '').trim().slice(0, 900);
        const score =
          typeof (c as any).hybridScore === 'number'
            ? (c as any).hybridScore
            : typeof (c as any).vectorScore === 'number'
              ? (c as any).vectorScore
              : typeof (c as any).bm25Score === 'number'
                ? (c as any).bm25Score
                : undefined;

        if (!snippet || !docId) continue;
        const kbValidation = validateKbSnippetForAudit({ snippet, mode: 'lenient' });
        if (!kbValidation.ok) continue;

        out.push({
          type: 'kb_snippet',
          kbId: docCategory || 'knowledge_chunks',
          docId,
          title,
          version:
            docVersionRaw !== undefined && docVersionRaw !== null && String(docVersionRaw).trim()
              ? String(docVersionRaw).trim()
              : undefined,
          snippet,
          score,
        });
        if (out.length >= limit) break;
      }
    }
  } catch {
    // best-effort
  }

  // 2) Static agent KB entries (domain-specific checklists, failure patterns, etc.)
  try {
    const staticKb = searchKB(args.query, {
      agentId: args.agentId,
      limit: Math.max(2, Math.min(4, limit)),
    });
    for (const entry of staticKb) {
      // Extract a relevant snippet from the KB entry
      const snippet = [
        entry.purpose,
        '',
        entry.triggerQuestions.length > 0
          ? `Key questions: ${entry.triggerQuestions.slice(0, 3).join('; ')}`
          : '',
        entry.limits.length > 0
          ? `Limits: ${entry.limits.slice(0, 2).join('; ')}`
          : '',
        '',
        entry.content.slice(0, 600),
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 900);

      out.push({
        type: 'kb_snippet',
        kbId: `agent_kb:${args.agentId}`,
        docId: entry.id,
        title: `[${entry.type.toUpperCase()}] ${entry.domain}`,
        version: entry.version,
        snippet,
        score: 0.85, // Static KB is highly relevant when matched
      });
    }
  } catch {
    // best-effort
  }

  // 3) Organization memory patterns (if orgId available)
  if (orgId) {
    try {
      const patterns = await organizationMemoryStore.searchPatterns(orgId, args.query, {
        types: ['BEST_PRACTICE', 'LESSON_LEARNED', 'FAILURE_PATTERN', 'SUCCESS_PATTERN'],
        limit: Math.max(1, Math.min(3, limit)),
        minSimilarity: 0.55,
      });
      for (const p of patterns || []) {
        const docId = String((p as any).id || '').trim();
        const title = String((p as any).title || 'Organization memory').trim();
        const description = String((p as any).description || '').trim();
        if (!docId || !description) continue;
        out.push({
          type: 'kb_snippet',
          kbId: 'organization_memory',
          docId,
          title,
          version: String((p as any).updated_at || (p as any).updatedAt || '').trim() || undefined,
          snippet: description,
          score: typeof (p as any).similarity === 'number' ? (p as any).similarity : undefined,
        });
      }
    } catch {
      // best-effort
    }
  }

  // Deduplicate by (kbId, docId, snippet prefix)
  const seen = new Set<string>();
  const uniq: SourceUsed[] = [];
  for (const s of out) {
    const key =
      s.type === 'kb_snippet'
        ? `${s.kbId}:${s.docId}:${s.snippet.slice(0, 80)}`
        : JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(s);
  }

  const final = uniq.slice(0, 8);
  cacheSet(cacheKey, final);
  return final;
}

