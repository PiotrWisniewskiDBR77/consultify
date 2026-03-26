import { z } from 'zod';

import logger from '../utils/Logger.js';

export const InboxAiAssistItemSchema = z.object({
  title: z.string().min(1).max(400),
  description: z.string().max(8000).optional().nullable(),
  type: z.string().max(64).optional().nullable(),
  section: z.string().max(64).optional().nullable(),
  urgency: z.string().max(32).optional().nullable(),
  receivedAt: z.string().max(64).optional().nullable(),
  dueDate: z.string().max(64).optional().nullable(),
  sla: z
    .object({
      level: z.string().max(16).optional().nullable(),
      remainingMs: z.number().optional().nullable(),
      isBreached: z.boolean().optional().nullable(),
    })
    .optional()
    .nullable(),
  reason: z.string().max(2000).optional().nullable(),
  linkedTaskId: z.string().max(128).optional().nullable(),
  linkedDecisionId: z.string().max(128).optional().nullable(),
  source: z
    .object({
      type: z.enum(['user', 'system', 'ai']).optional().nullable(),
      userName: z.string().max(160).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const InboxAiAssistResponseSchema = z.object({
  brief: z.string().min(1).max(280),
  bullets: z.array(z.string().min(1).max(140)).max(4),
  recommendedAction: z.enum([
    'accept_today',
    'accept_week',
    'accept_later',
    'schedule',
    'delegate',
    'archive',
    'dismiss',
    'done',
    'save',
    'reject',
  ]),
  recommendedReason: z.string().min(1).max(260),
});

export type InboxAiAssistItem = z.infer<typeof InboxAiAssistItemSchema>;
export type InboxAiAssistResponse = z.infer<typeof InboxAiAssistResponseSchema>;

export async function runInboxAiAssist(params: {
  organizationId: string;
  language?: string | null;
  item: InboxAiAssistItem;
}): Promise<InboxAiAssistResponse> {
  const language = String(params.language || 'pl')
    .toLowerCase()
    .startsWith('pl')
    ? 'pl'
    : 'en';

  const { llmService } = await import('./ai/llmService.js');
  const modelRouter = (await import('./ai/modelRouter.js')).default;
  const modelCfg = await modelRouter.select({
    capability: 'chat',
    organizationId: params.organizationId,
    options: { tier: 'STANDARD' },
  });

  const item = params.item;
  const prompt =
    language === 'pl'
      ? `Użytkownik ogląda element w panelu Preview (MyWork → Inbox).
Zadanie: wygeneruj krótki BRIEF (max 2 zdania), 2–4 bullet points, oraz rekomendowaną akcję triage (jedna z listy).
Nie powtarzaj tytułu; skup się na tym "co to jest" i "co zrobić dalej".

Dane elementu:
- title: ${JSON.stringify(item.title)}
- type: ${JSON.stringify(item.type || '')}
- section: ${JSON.stringify(item.section || '')}
- urgency: ${JSON.stringify(item.urgency || '')}
- receivedAt: ${JSON.stringify(item.receivedAt || '')}
- dueDate: ${JSON.stringify(item.dueDate || '')}
- SLA: ${item.sla ? JSON.stringify(item.sla) : 'null'}
- source: ${item.source ? JSON.stringify(item.source) : 'null'}
- linkedTaskId: ${JSON.stringify(item.linkedTaskId || '')}
- linkedDecisionId: ${JSON.stringify(item.linkedDecisionId || '')}
- reason (why shown): ${JSON.stringify(item.reason || '')}
- description: ${JSON.stringify(String(item.description || '').slice(0, 2500))}

Zwróć TYLKO JSON obiektu zgodny ze schematem. Bez markdown i bez dodatkowego tekstu.`
      : `The user is viewing a Preview pane item (MyWork → Inbox).
Task: generate a short BRIEF (max 2 sentences), 2–4 bullet points, and one recommended triage action (from the allowed list).
Do not repeat the title; focus on what it is and what to do next.

Item data:
- title: ${JSON.stringify(item.title)}
- type: ${JSON.stringify(item.type || '')}
- section: ${JSON.stringify(item.section || '')}
- urgency: ${JSON.stringify(item.urgency || '')}
- receivedAt: ${JSON.stringify(item.receivedAt || '')}
- dueDate: ${JSON.stringify(item.dueDate || '')}
- SLA: ${item.sla ? JSON.stringify(item.sla) : 'null'}
- source: ${item.source ? JSON.stringify(item.source) : 'null'}
- linkedTaskId: ${JSON.stringify(item.linkedTaskId || '')}
- linkedDecisionId: ${JSON.stringify(item.linkedDecisionId || '')}
- reason (why shown): ${JSON.stringify(item.reason || '')}
- description: ${JSON.stringify(String(item.description || '').slice(0, 2500))}

Return ONLY a JSON object matching the schema. No markdown, no extra text.`;

  const response = await llmService.call({
    type: 'structured',
    schema: InboxAiAssistResponseSchema,
    modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
    systemPrompt:
      language === 'pl'
        ? 'Jesteś asystentem pracy konsultanta. Odpowiadasz zwięźle. Zwracasz wyłącznie poprawny JSON.'
        : 'You are a consulting work assistant. Be concise. Return only valid JSON.',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    maxTokens: 600,
    timeoutMs: 12000,
    breakerOptions: { retryAttempts: 1 },
  });

  const object = (response as any)?.object;
  const parsed = InboxAiAssistResponseSchema.safeParse(object);
  if (!parsed.success) {
    logger.error('[InboxAIAssist] Invalid structured response', parsed.error);
    throw new Error('AI response invalid');
  }

  return parsed.data;
}
