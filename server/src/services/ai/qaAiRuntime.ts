type QaMessage = {
  role?: string;
  content?: unknown;
  [key: string]: unknown;
};

export function isQaAiMode(): boolean {
  const values = [
    process.env.QA_AI_MODE,
    process.env.AI_PROVIDER_MODE,
    process.env.CONSULTIFY_MOCK_AI,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  return values.some((value) => ['1', 'true', 'yes', 'mock', 'qa', 'test'].includes(value));
}

export function getQaAiModeLabel(): string {
  return isQaAiMode() ? 'qa_mock' : 'live';
}

function getLastUserMessage(messages: QaMessage[] = []): string {
  const last = [...messages].reverse().find((message) => message.role === 'user');
  const content = last?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'string'
          ? part
          : typeof (part as any)?.text === 'string'
            ? (part as any).text
            : ''
      )
      .join(' ')
      .trim();
  }
  return '';
}

export function buildQaAiText(params: { messages?: QaMessage[]; systemPrompt?: string }): string {
  const userMessage = getLastUserMessage(params.messages || []);
  const topic = userMessage || 'AI OS runtime check';

  return [
    'QA MOCK RESPONSE',
    '',
    `Request understood: ${topic}`,
    '',
    '- Runtime path is healthy.',
    '- No live provider call was made.',
    '- This response is deterministic for staging and Anygravity acceptance tests.',
    '',
    'Suggested next step: verify the UI state, persisted conversation, audit/run ledger, and visible artifacts.',
  ].join('\n');
}

export async function* createQaAiStream(text: string): AsyncGenerator<string> {
  const chunks = text.match(/.{1,48}(?:\s|$)/g) || [text];
  for (const chunk of chunks) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    yield chunk;
  }
}

export function buildQaAiUsage(text: string): Record<string, number> {
  const completionTokens = Math.max(1, Math.ceil(text.length / 4));
  return {
    promptTokens: 12,
    completionTokens,
    totalTokens: completionTokens + 12,
  };
}

export function buildQaAiStructuredObject(schema: unknown): Record<string, unknown> {
  if (schema === 'magic_wand') {
    return {
      improvedText: 'QA mock improved text.',
      suggestions: ['QA mock suggestion'],
      confidence: 1,
    };
  }
  if (schema === 'analysis') {
    return {
      summary: 'QA mock analysis summary.',
      insights: ['Runtime contract exercised without live AI provider.'],
      confidence: 1,
    };
  }
  if (schema === 'roadmap') {
    return {
      phases: [{ name: 'QA mock phase', description: 'Validate runtime contracts.' }],
      risks: [],
      confidence: 1,
    };
  }
  return {
    summary: 'QA mock structured response.',
    qaMock: true,
  };
}

export function buildQaResearchChatResponse(request: any): string {
  const prompt = String(request?.messages?.[0]?.content || '');
  if (/clarification|questions/i.test(prompt)) {
    return JSON.stringify({ questions: [] });
  }
  if (/follow-up|followup/i.test(prompt)) {
    return JSON.stringify({
      queries: [
        {
          query: 'QA mock follow-up evidence for AI OS runtime',
          purpose: 'Validate iterative research lifecycle without external search.',
        },
      ],
    });
  }
  if (/json object|queries/i.test(prompt) || request?.response_format?.type === 'json_object') {
    return JSON.stringify({
      queries: [
        {
          query: 'QA mock AI OS runtime evidence',
          purpose: 'Validate research session lifecycle.',
        },
        {
          query: 'QA mock staging acceptance evidence',
          purpose: 'Validate visible staging UI evidence.',
        },
      ],
    });
  }
  return [
    'QA mock research synthesis.',
    'The research runtime completed deterministically without live provider or web-search cost.',
    'Evidence supports that approval, queueing, artifact creation, and final report rendering can be tested.',
  ].join('\n');
}

export function buildQaWebSearchResults(query: string): Record<string, unknown> {
  return {
    answer: `QA mock answer for ${query}`,
    results: [
      {
        url: 'https://demo.consultify.ai/qa/mock-evidence',
        title: 'QA mock evidence source',
        snippet: `Deterministic QA evidence for query: ${query}`,
        content: `This mock source validates the AI OS research runtime for query: ${query}.`,
        score: 0.99,
        publishedDate: new Date().toISOString(),
      },
    ],
  };
}
