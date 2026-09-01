import featureFlags from '../config/FeatureFlags.js';
import { get as dbGet } from '../utils/DbPromise.js';
import { AppError } from '../utils/ErrorHandler.js';
import { AIPipeline } from './ai/AIPipeline.js';
import { estimateAgentToolCostUsd } from './ai/toolCostEstimates.js';
import { executeToolCall } from './ai/toolDefinitions.js';

export interface KnowledgeOutlineSource {
  typ: string;
  id: string;
  etykieta: string;
}

export interface KnowledgeOutlineItem {
  tytul: string;
  teza: string;
  archetyp: string;
  zrodla: KnowledgeOutlineSource[];
}

export interface GenerateKnowledgeOutlineInput {
  organizationId: string;
  userId: string;
  projectId?: string;
  title: string;
  audience: string;
  goal: string;
  language: string;
  // FIX-4 (ODBIOR_231): tryb prywatny rozmowy musi dotrzeć aż do executora —
  // to on odcina zakresy org_shared/public_kb w chatPolicyGateway (wzorzec
  // FIX-206 pkt 2, ai.routes.ts:5013-5017). Bez tego pola nie da się go
  // przekazać z trasy do tej ścieżki.
  privateMode?: boolean;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse((fenced || trimmed).trim());
}

export function parseKnowledgeOutline(text: string): KnowledgeOutlineItem[] {
  const parsed = extractJson(text);
  const rows = Array.isArray(parsed) ? parsed : (parsed as any)?.outline;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('KNOWLEDGE_OUTLINE_EMPTY');
  return rows.map((row: any) => ({
    tytul: String(row?.tytul || '').trim(),
    teza: String(row?.teza || '').trim(),
    archetyp: String(row?.archetyp || 'key_messages').trim(),
    zrodla: Array.isArray(row?.zrodla)
      ? row.zrodla
          .map((source: any) => ({
            typ: String(source?.typ || '').trim(),
            id: String(source?.id || '').trim(),
            etykieta: String(source?.etykieta || '').trim(),
          }))
          .filter((source: KnowledgeOutlineSource) => source.typ && source.id && source.etykieta)
      : [],
  })).filter((row) => row.tytul && row.teza);
}

// FIX-2 (ODBIOR_231): `evidence` is the raw JSON returned by `executeKBSearch`
// (server/src/services/ai/toolDefinitions.ts:1174-1178, file is write-locked —
// nadzorca decision, separate duty), which exposes only `content` /
// `documentTitle` / `score`. It never carries a `documentId`, so matching
// `source.id` against the raw evidence text (previous behaviour) could never
// succeed — no zrodlo could ever survive the filter. `documentTitle` is the
// only real identifier the tool result exposes, and it is also the only
// identifier the model can plausibly cite back (it never sees a documentId
// either) — normalize both sides (unicode NFKC, collapsed whitespace,
// lowercase) and accept a match on either the model's `id` or its `etykieta`.
function normalizeForEvidenceMatch(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function filterOutlineSourcesByEvidence(
  outline: KnowledgeOutlineItem[],
  evidence: string
): KnowledgeOutlineItem[] {
  const normalizedEvidence = normalizeForEvidenceMatch(evidence);
  return outline.map((item) => ({
    ...item,
    zrodla: item.zrodla.filter((source) => {
      const candidates = [source.id, source.etykieta]
        .map((v) => normalizeForEvidenceMatch(String(v || '')))
        .filter((v) => v.length > 0);
      return candidates.some((candidate) => normalizedEvidence.includes(candidate));
    }),
  }));
}

export async function generateKnowledgeOutline(
  input: GenerateKnowledgeOutlineInput
): Promise<{ outline: KnowledgeOutlineItem[]; provider: string; model: string }> {
  // FIX-5 (P1, ODBIOR_231): `ENABLE_DECK_FROM_KNOWLEDGE` alone is not enough —
  // the read-tool loop that actually calls `search_knowledge_base` is wired
  // by AIPipeline only when `ENABLE_TERESA_TOOL_LOOP` is ALSO on
  // (server/src/services/ai/AIPipeline.ts:466). With only the new flag set,
  // the model never gets the tool, the fail-closed guard below always fires,
  // and the caller previously saw a bare HTTP 500. Fail fast here instead,
  // with a clear operator-facing message — default flag values are untouched.
  if (!featureFlags.ENABLE_TERESA_TOOL_LOOP) {
    throw new AppError(
      'Generowanie konspektu z wiedzy organizacji wymaga włączenia obu flag: ' +
        'ENABLE_DECK_FROM_KNOWLEDGE i ENABLE_TERESA_TOOL_LOOP. Bez pętli narzędziowej ' +
        'model nie ma dostępu do search_knowledge_base.',
      409,
      'DECK_FROM_KNOWLEDGE_TOOL_LOOP_DISABLED'
    );
  }

  const toolEvidence: string[] = [];
  const toolCalls: string[] = [];

  // FIX-4 (P1, ODBIOR_231): `projectId` arrives from the request body and was
  // handed straight to the executor without confirming it belongs to the
  // caller's organization — the exact shape of defect FIX-206 (P0) already
  // fixed once for the sibling tool loop in ai.routes.ts:4944-4961. Second
  // layer of defense (org-scope inside the queries themselves) likely saves
  // this today, but the defense pattern must be copied in full, not partially.
  let verifiedProjectId: string | undefined;
  const claimedProjectId = String(input.projectId || '').trim();
  if (claimedProjectId && input.organizationId) {
    try {
      const ownedProject = (await dbGet(
        `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
        [claimedProjectId, input.organizationId]
      )) as { id?: string } | undefined;
      verifiedProjectId = ownedProject?.id ? claimedProjectId : undefined;
    } catch {
      verifiedProjectId = undefined;
    }
  }

  // FIX-4: cost cap + wall clock for the read-tool loop, mirroring
  // ai.routes.ts:4960-4961/4996-5019 (FIX-206 pkt 5/6) so a single unpriced
  // or slow tool call cannot run away the request or wedge the whole turn.
  let paidCostUsd = 0;
  const maxPaidCostUsd = 0.08;
  const timeoutMs = (() => {
    const parsed = Number(process.env.TERESA_TOOL_LOOP_TIMEOUT_MS || 12_000);
    return Number.isFinite(parsed) && parsed >= 10 && parsed <= 60_000 ? parsed : 12_000;
  })();

  const request: any = {
    capability: 'chatStream',
    purpose: 'presentation_outline_from_organization_knowledge',
    prompt:
      `Przygotuj konspekt prezentacji „${input.title}” dla odbiorcy ${input.audience}, cel: ${input.goal}. ` +
      'Najpierw sam użyj dostępnych narzędzi READ, w szczególności search_knowledge_base, aby znaleźć fakty organizacji. ' +
      'Nie wymyślaj źródeł. Zwróć wyłącznie JSON: {"outline":[{"tytul":"...","teza":"jedno zdanie","archetyp":"key_messages","zrodla":[{"typ":"...","id":"...","etykieta":"..."}]}]}. ' +
      'Jeżeli teza nie ma rozpoznawalnego źródła, zrodla musi być pustą tablicą.',
    userId: input.userId,
    organizationId: input.organizationId,
    projectId: verifiedProjectId,
    context: {
      language: input.language,
      conversationLanguage: input.language,
      projectContext: verifiedProjectId ? { projectId: verifiedProjectId } : undefined,
      knowledgeSources: { pmoDocuments: true, projectData: true, organizationData: true },
    },
    options: {
      language: input.language,
      temperature: 0.2,
      readTools: {
        enabled: true,
        context: {
          executeReadTool: async (toolName: string, args: Record<string, unknown>) => {
            // FIX-4 (pkt 6 wzorca): koperta try — wyjątek z executora nie może
            // wywrócić całej tury generowania konspektu.
            let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
            try {
              const estimatedCostUsd = estimateAgentToolCostUsd(toolName);
              if (paidCostUsd + estimatedCostUsd > maxPaidCostUsd) {
                return JSON.stringify({
                  status: 'BLOCKED',
                  error: 'Conversation tool cost limit reached',
                });
              }
              paidCostUsd += estimatedCostUsd;
              const TIMED_OUT = Symbol('tool_timeout');
              const result = await Promise.race([
                executeToolCall(toolName, args, {
                  organizationId: input.organizationId,
                  userId: input.userId,
                  projectId: verifiedProjectId,
                  privateMode: Boolean(input.privateMode),
                }),
                new Promise<typeof TIMED_OUT>((resolve) => {
                  timeoutHandle = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
                }),
              ]);
              if (result === TIMED_OUT) {
                return JSON.stringify({ status: 'TIMEOUT', error: 'Tool did not answer in time' });
              }
              toolCalls.push(toolName);
              toolEvidence.push(typeof result === 'string' ? result : JSON.stringify(result));
              return result as string;
            } catch (error) {
              return JSON.stringify({
                status: 'ERROR',
                error: String((error as Error)?.message || error),
              });
            } finally {
              if (timeoutHandle) clearTimeout(timeoutHandle);
            }
          },
        },
      },
    },
    stream: true,
  };
  const response: any = await AIPipeline.getInstance().process(request);
  if (!response?.success || !response?.stream) throw new Error('KNOWLEDGE_OUTLINE_MODEL_FAILED');
  let content = '';
  for await (const chunk of response.stream as AsyncIterable<unknown>) {
    if (typeof chunk === 'string') content += chunk;
  }
  if (!toolCalls.includes('search_knowledge_base')) {
    throw new Error('KNOWLEDGE_OUTLINE_SEARCH_NOT_CALLED');
  }
  const evidence = toolEvidence.join('\n');
  const outline = filterOutlineSourcesByEvidence(parseKnowledgeOutline(content), evidence);
  return {
    outline,
    provider: String(response?.metadata?.provider || 'unknown'),
    model: String(response?.metadata?.model || 'unknown'),
  };
}
