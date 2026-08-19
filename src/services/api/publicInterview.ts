export interface PublicInterviewQuestion {
  answerText: string | null;
  contextNote: string | null;
  id: string;
  isRequired: boolean;
  questionText: string;
  updatedAt: string;
}

export interface PublicInterviewSnapshot {
  anonymityMode: 'anonymous' | 'identified' | 'pseudonymous';
  distributionId: string;
  expiresAt: string;
  questions: PublicInterviewQuestion[];
  sessionId: string;
  status: string;
  templateId: string | null;
  templateVersion: number | null;
}

export class PublicInterviewApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
  }
}

function requireAnswerResult(value: { replayed?: unknown; updatedAt?: unknown }) {
  if (typeof value.updatedAt !== 'string' || !value.updatedAt.trim()) {
    throw new PublicInterviewApiError('INVALID_RESPONSE', 502);
  }
  return { replayed: value.replayed === true, updatedAt: value.updatedAt };
}

function requireCompletionResult(value: { alreadyComplete?: unknown; completed?: unknown }) {
  if (value.completed !== true) throw new PublicInterviewApiError('INVALID_RESPONSE', 502);
  return { alreadyComplete: value.alreadyComplete === true, completed: true as const };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new PublicInterviewApiError(payload.error ?? 'REQUEST_FAILED', response.status);
  }
  return payload;
}

const base = (token: string) =>
  `/api/interview-v4/public/distributions/${encodeURIComponent(token)}`;

export const publicInterviewApi = {
  load: (token: string) => request<PublicInterviewSnapshot>(base(token)),
  answer: (
    token: string,
    questionId: string,
    input: {
      answerText: string;
      contextNote: string | null;
      expectedUpdatedAt: string;
      idempotencyKey: string;
    }
  ) =>
    request<{ replayed?: unknown; updatedAt?: unknown }>(
      `${base(token)}/answers/${encodeURIComponent(questionId)}`,
      { method: 'POST', body: JSON.stringify(input) }
    ).then(requireAnswerResult),
  complete: (token: string) =>
    request<{ alreadyComplete?: unknown; completed?: unknown }>(`${base(token)}/complete`, {
      method: 'POST',
      body: '{}',
    }).then(requireCompletionResult),
};
