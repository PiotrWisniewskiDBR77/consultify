/**
 * RN-G4 lane `teresa` (FALA 2, 2026-08-11) — thin, hand-written client for
 * the REAL P08 Teresa Copilot proposal REST surface
 * (`server/src/routes/v8/teresa.routes.ts`, mounted at `/api/v8/teresa`).
 *
 * Deliberately NOT reusing `src/services/api.ts`'s existing
 * `getTeresaProposal`/`approveTeresaProposal`/`rejectTeresaProposal`/
 * `executeTeresaProposal`/`undoTeresaProposal` methods (verified present,
 * L2277-2362) — that file is outside this lane's allowlist
 * (`src/components/ResultsVNext/**` only), and critically it has NO
 * `createProposal` method at all (grepped, zero hits) — every existing
 * caller of those five methods (`TeresaProposalCard.tsx`) only ever
 * RENDERS a proposal that some other part of the system already created.
 * This lane is the one that needs to CREATE the proposal (the "Poproś
 * Teresę o szkic wniosków" action), so a new small client — following the
 * exact same hand-written convention `roi/roiApi.ts` documents in its own
 * header ("same fetch + getHeaders() + API_URL convention... rather than
 * adding to the ~19k-line Api object for a handful of endpoints") — is the
 * correct shape here, not a duplicate of the read-only half.
 *
 * Every path/method/body-field/response-envelope-key below was read
 * directly off `server/src/routes/v8/teresa.routes.ts` (cited per
 * function) — not guessed.
 */
import { API_URL, getHeaders } from '@/services/api';

import type {
  HandoffTargetModule,
  TeresaActionEnvelopeState,
  TeresaAuditEntry,
  TeresaChatProposalEnvelope,
  TeresaHandoffContext,
  TeresaHandoffExecutionResult,
} from './teresaHandoffTypes';

const BASE_PATH = `${API_URL}/v8/teresa`;

export class TeresaProposalApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;
  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'TeresaProposalApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseBody(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function requestJson(
  path: string,
  init: RequestInit | undefined,
  fallbackError: string
): Promise<Record<string, unknown>> {
  const url = `${BASE_PATH}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...getHeaders(), ...((init?.headers as Record<string, string>) || {}) },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new TeresaProposalApiError(`Network error contacting ${url}: ${msg}`, 0, 'NETWORK_ERROR');
  }
  const body = await parseBody(res);
  if (!res.ok) {
    throw new TeresaProposalApiError(
      (body.error as string) || fallbackError,
      res.status,
      body.code as string | undefined,
      body
    );
  }
  return body;
}

export interface CreateTeresaProposalInput {
  sessionId: string;
  handoffContext: TeresaHandoffContext;
  targetModule: HandoffTargetModule;
  targetPayload: Record<string, unknown>;
  idempotencyKey?: string;
}

/** POST /proposal (teresa.routes.ts L58-100) — returns 201 with
 * `{data: <TeresaChatProposalEnvelope>, meta}`. */
export async function createTeresaProposal(
  input: CreateTeresaProposalInput
): Promise<TeresaChatProposalEnvelope> {
  const body = await requestJson(
    '/proposal',
    { method: 'POST', body: JSON.stringify(input) },
    'Nie udało się utworzyć propozycji Teresy'
  );
  return body.data as TeresaChatProposalEnvelope;
}

/** POST /proposal/:id/approve (L204-225). */
export async function approveTeresaProposal(proposalId: string): Promise<TeresaChatProposalEnvelope> {
  const body = await requestJson(
    `/proposal/${encodeURIComponent(proposalId)}/approve`,
    { method: 'POST' },
    'Nie udało się zatwierdzić propozycji Teresy'
  );
  return body.data as TeresaChatProposalEnvelope;
}

/** POST /proposal/:id/reject (L231-254) — `reason` is optional but this
 * lane always sends one (a human-readable rejection note), matching D13's
 * "jawna akceptacja albo odrzucenie" requirement that a rejection be an
 * explicit, recorded decision, not a bare no-op. */
export async function rejectTeresaProposal(
  proposalId: string,
  reason?: string
): Promise<TeresaChatProposalEnvelope> {
  const body = await requestJson(
    `/proposal/${encodeURIComponent(proposalId)}/reject`,
    { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) },
    'Nie udało się odrzucić propozycji Teresy'
  );
  return body.data as TeresaChatProposalEnvelope;
}

export interface TeresaExecuteResponse {
  execution: TeresaHandoffExecutionResult;
  proposal: TeresaChatProposalEnvelope | null;
}

/** POST /proposal/:id/execute (L260-286). CRITICAL: the route returns HTTP
 * 500 when `result.success === false` (a domain-level denial such as ROI's
 * `DISPOSITION_ALREADY_RECORDED`/`NOT_EDITABLE` guards, or a KPI
 * `P08_KPI_VISIBILITY_STALE` permission check) — that is a TRUTH-PRESERVING
 * FAILURE (`executeProposal`'s own catch block still writes an audit entry
 * and returns a real `{success:false, error, state:'rejected'}` body), NOT
 * a transport error. This function therefore does NOT throw on a non-2xx
 * response as long as the body parses to the expected
 * `{data:{execution, proposal}}` shape — callers (`TeresaProposalPanel`)
 * must check `execution.success` themselves and render the denial, exactly
 * as D13's "sprawdzenie uprawnień przed wykonaniem" step requires. A
 * genuine transport/shape failure (network error, or a non-2xx body that
 * does NOT even carry `data.execution`) still throws. */
export async function executeTeresaProposal(proposalId: string): Promise<TeresaExecuteResponse> {
  const url = `${BASE_PATH}/proposal/${encodeURIComponent(proposalId)}/execute`;
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: getHeaders() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new TeresaProposalApiError(`Network error contacting ${url}: ${msg}`, 0, 'NETWORK_ERROR');
  }
  const body = await parseBody(res);
  const data = body.data as TeresaExecuteResponse | undefined;
  if (data && typeof data === 'object' && data.execution) {
    return data;
  }
  throw new TeresaProposalApiError(
    (body.error as string) || `Wykonanie propozycji Teresy nie powiodło się (HTTP ${res.status})`,
    res.status,
    body.code as string | undefined,
    body
  );
}

/** GET /proposal/:id (L319-329). */
export async function getTeresaProposal(proposalId: string): Promise<TeresaChatProposalEnvelope | null> {
  const url = `${BASE_PATH}/proposal/${encodeURIComponent(proposalId)}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (res.status === 404) return null;
  const body = await parseBody(res);
  if (!res.ok) {
    throw new TeresaProposalApiError(
      (body.error as string) || `Nie udało się pobrać propozycji Teresy (HTTP ${res.status})`,
      res.status,
      body.code as string | undefined,
      body
    );
  }
  return body.data as TeresaChatProposalEnvelope;
}

/** GET /audit/:proposalId (L352-366) — the audit trail step of the D13
 * pipeline ("audyt/historia"). */
export async function getTeresaAuditTrail(proposalId: string): Promise<TeresaAuditEntry[]> {
  const body = await requestJson(
    `/audit/${encodeURIComponent(proposalId)}`,
    undefined,
    'Nie udało się pobrać śladu audytowego Teresy'
  );
  return (body.data as TeresaAuditEntry[]) || [];
}

export type { TeresaActionEnvelopeState, TeresaAuditEntry, TeresaChatProposalEnvelope, TeresaHandoffExecutionResult };
