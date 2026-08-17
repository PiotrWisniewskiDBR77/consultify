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
}

export class PublicInterviewApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
  }
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
    request<{ replayed: boolean; updatedAt: string }>(
      `${base(token)}/answers/${encodeURIComponent(questionId)}`,
      { method: 'POST', body: JSON.stringify(input) }
    ),
  complete: (token: string) =>
    request<{ alreadyComplete: boolean; completed: boolean }>(`${base(token)}/complete`, {
      method: 'POST',
      body: '{}',
    }),
};
