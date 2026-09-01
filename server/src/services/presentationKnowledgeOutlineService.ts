import { AIPipeline } from './ai/AIPipeline.js';
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

export function filterOutlineSourcesByEvidence(
  outline: KnowledgeOutlineItem[],
  evidence: string
): KnowledgeOutlineItem[] {
  return outline.map((item) => ({
    ...item,
    zrodla: item.zrodla.filter((source) => evidence.includes(source.id)),
  }));
}

export async function generateKnowledgeOutline(
  input: GenerateKnowledgeOutlineInput
): Promise<{ outline: KnowledgeOutlineItem[]; provider: string; model: string }> {
  const toolEvidence: string[] = [];
  const toolCalls: string[] = [];
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
    projectId: input.projectId,
    context: {
      language: input.language,
      conversationLanguage: input.language,
      projectContext: input.projectId ? { projectId: input.projectId } : undefined,
      knowledgeSources: { pmoDocuments: true, projectData: true, organizationData: true },
    },
    options: {
      language: input.language,
      temperature: 0.2,
      readTools: {
        enabled: true,
        context: {
          executeReadTool: (toolName: string, args: Record<string, unknown>) =>
            executeToolCall(toolName, args, {
              organizationId: input.organizationId,
              userId: input.userId,
              projectId: input.projectId,
            }).then((result) => {
              toolCalls.push(toolName);
              toolEvidence.push(typeof result === 'string' ? result : JSON.stringify(result));
              return result;
            }),
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
