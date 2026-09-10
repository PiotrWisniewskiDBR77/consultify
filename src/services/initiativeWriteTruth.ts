import i18n from '@/i18n';
import { Api } from '@/services/api';
import {
  V8PlanningApi,
  type V8PlanningGateReadinessCheck,
  type V8PlanningHistoryEvent,
  type V8PlanningStatusHistoryEntry,
} from '@/services/api/v8/planning';
import { bumpInitiativeRefresh } from '@/store/useInitiativeRefreshStore';
import {
  amendRegisteredInitiative,
  cancelRegisteredInitiative,
  readRegisteredInitiative,
  registerSourceProposal,
  RuntimeApiError,
  submitSourceProposal,
} from '@/services/initiatives-execution/runtimeApi';

export interface InitiativeWriteTruthBundle {
  initiative: any | null;
  gateReadiness: V8PlanningGateReadinessCheck | null;
  statusHistory: V8PlanningStatusHistoryEntry[];
  history: V8PlanningHistoryEvent[];
}

export interface InitiativeStatusPreflightTruth {
  readiness: V8PlanningGateReadinessCheck | null;
  transition: NonNullable<V8PlanningGateReadinessCheck['availableTransitions']>[number] | null;
  blockingItems: string[];
}

export async function getInitiativeReadTruth(initiativeId: string) {
  try {
    return await V8PlanningApi.getInitiative(initiativeId);
  } catch {
    return Api.get(`/initiatives/${initiativeId}`);
  }
}

export async function getInitiativeGateReadinessTruth(initiativeId: string) {
  try {
    return await V8PlanningApi.getGateReadiness(initiativeId);
  } catch {
    const response = await Api.get(`/initiatives/${initiativeId}/gate-readiness-check`);
    if (
      response &&
      typeof response === 'object' &&
      Array.isArray((response as any).readiness) &&
      Array.isArray((response as any).availableTransitions)
    ) {
      return response as V8PlanningGateReadinessCheck;
    }
    if (response?.readiness && typeof response.readiness === 'object') {
      return response.readiness as V8PlanningGateReadinessCheck;
    }
    return response || null;
  }
}

export async function getInitiativeStatusHistoryTruth(initiativeId: string) {
  try {
    return await V8PlanningApi.getStatusHistory(initiativeId);
  } catch {
    const response = await Api.get(`/initiatives/${initiativeId}/status-history`);
    return response?.history || (Array.isArray(response) ? response : []);
  }
}

export async function getInitiativeHistoryTruth(initiativeId: string) {
  try {
    return await V8PlanningApi.getHistory(initiativeId);
  } catch {
    const response = await Api.get(`/initiatives/${initiativeId}/history`);
    return response?.events || response?.history || (Array.isArray(response) ? response : []);
  }
}

export async function refreshInitiativeWriteTruth(
  initiativeId: string
): Promise<InitiativeWriteTruthBundle> {
  const [initiative, gateReadiness, statusHistory, history] = await Promise.all([
    getInitiativeReadTruth(initiativeId).catch(() => null),
    getInitiativeGateReadinessTruth(initiativeId).catch(() => null),
    getInitiativeStatusHistoryTruth(initiativeId).catch(() => []),
    getInitiativeHistoryTruth(initiativeId).catch(() => []),
  ]);

  return {
    initiative,
    gateReadiness,
    statusHistory,
    history,
  };
}

export async function getInitiativeStatusPreflightTruth(
  initiativeId: string,
  targetStatus: string
): Promise<InitiativeStatusPreflightTruth> {
  const readiness = await getInitiativeGateReadinessTruth(initiativeId);
  const transitions: NonNullable<V8PlanningGateReadinessCheck['availableTransitions']> =
    Array.isArray(readiness?.availableTransitions) ? readiness.availableTransitions : [];
  const transition =
    transitions.find(
      (item: NonNullable<V8PlanningGateReadinessCheck['availableTransitions']>[number]) =>
        String(item?.targetStatus || '').toUpperCase() === String(targetStatus || '').toUpperCase()
    ) || null;
  const blockingItems = Array.isArray(readiness?.readiness)
    ? readiness.readiness
        .filter(
          (item: V8PlanningGateReadinessCheck['readiness'][number]) =>
            item?.severity === 'blocking' && !item?.pass
        )
        .map((item: V8PlanningGateReadinessCheck['readiness'][number]) =>
          String(item?.label || item?.key || '').trim()
        )
        .filter(Boolean)
    : [];

  return {
    readiness,
    transition,
    blockingItems,
  };
}

export interface CanonicalInitiativeCreateInput {
  projectId?: string;
  initiativeOwnerId?: string;
  ownerId?: string;
  title: string;
  problem?: string;
  problemStatement?: string;
  summary?: string;
  description?: string;
  proposedOutcome?: string | null;
  visibility?: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
  [key: string]: unknown;
}

const newCommandId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const stableCommandId = (prefix: string, value: unknown) => {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._:-]+/g, '-')
    .slice(0, 180);
  return normalized ? `${prefix}-${normalized}` : newCommandId(prefix);
};

/**
 * ODMOWA MUSI DOJSC DO CZLOWIEKA — po polsku, z powodem i nastepnym krokiem.
 *
 * Zmierzone 10.09: gdy runtime odmawial utworzenia inicjatywy, `RuntimeApiError`
 * niosl w `message` SAM KOD (`INITIATIVE_OWNER_INELIGIBLE`, `CAPABILITY_REQUIRED`,
 * ...), a wszystkie trzy powierzchnie tworzenia (`InitiativesHub`,
 * `InitiativeCharterWizard`, `InitiativeWizardModal`) pokazuja `e?.message`
 * wprost. Uzytkownik dostawal wiec albo surowy kod, albo nic czytelnego —
 * przycisk „Utworz" wygladal, jakby nie robil nic.
 *
 * Tlumaczenie siedzi TU, w jednym wspolnym lejku, a nie w trzech ekranach:
 *   - kazda powierzchnia dostaje ten sam komunikat bez zmian w sobie,
 *   - serwer dalej niesie WYLACZNIE kod i status (bramka jezykowa: tekst
 *     nalezy do klienta, zdan budowanych na serwerze nie dokladamy),
 *   - tresc mieszka w `public/locales/*` i podlega tym samym bramkom
 *     jezykowym co reszta interfejsu.
 */
const KLUCZE_ODMOWY: Record<string, string> = {
  INITIATIVE_OWNER_INELIGIBLE: 'initiatives.form.errorOwnerIneligible',
  CAPABILITY_REQUIRED: 'initiatives.form.errorCapabilityRequired',
  // E1c/F2 (10.09, po E2/E2b): trzy nowe kody odmowy z bramki uprawnień
  // (`effectiveCapability.middleware.ts` — CAPABILITY_OBJECT_OWNERSHIP_REQUIRED /
  // _PREDICATE_MISSING / _CHECK_FAILED). Bez wpisu tutaj `RuntimeApiError.message`
  // niesie SUROWY KOD (ta klasa niesie kod jako `message` — patrz
  // `RuntimeApiError` w `runtimeApi.ts`), a `InitiativeDocumentView`/kreator
  // pokazuja `e?.message` wprost. Wszystkie trzy dostają jedno, uczciwe zdanie —
  // rozróżnienie (brak właściciela / brak predykatu / błąd sprawdzenia) jest
  // techniczne dla serwera, nie dla użytkownika.
  CAPABILITY_OBJECT_OWNERSHIP_REQUIRED: 'initiatives.form.errorOwnershipRequired',
  CAPABILITY_OWNERSHIP_PREDICATE_MISSING: 'initiatives.form.errorOwnershipRequired',
  CAPABILITY_OWNERSHIP_CHECK_FAILED: 'initiatives.form.errorOwnershipRequired',
};

export function opiszOdmoweTworzeniaInicjatywy(error: unknown): Error {
  if (!(error instanceof RuntimeApiError)) return error as Error;
  const klucz = KLUCZE_ODMOWY[error.code];
  if (!klucz) return error;
  return new Error(String(i18n.t(klucz)));
}

export async function createInitiativeWriteTruth(payload: Record<string, unknown>) {
  const projectId = String(payload.projectId || '').trim();
  const initiativeOwnerId = String(payload.initiativeOwnerId || payload.ownerId || '').trim();
  const problem = String(
    payload.problem || payload.problemStatement || payload.summary || payload.description || payload.title
  ).trim();
  if (!projectId || !initiativeOwnerId) {
    throw new Error('Canonical initiative creation requires projectId and initiativeOwnerId');
  }
  const creationRequestId = payload.creationRequestId;
  const proposalId = stableCommandId('proposal', creationRequestId);
  const initiativeId = stableCommandId('initiative', creationRequestId);
  const requestedSourceType = String(payload.sourceType || '').trim();
  const requestedSourceId = String(payload.sourceId || '').trim();
  const sourceType = requestedSourceType || 'MANUAL_HUB';
  const sourceId = requestedSourceId || stableCommandId('manual-hub', creationRequestId);
  const requestedSourceVersion = Number(payload.sourceVersion || 1);
  const sourceVersion = Number.isInteger(requestedSourceVersion) && requestedSourceVersion > 0
    ? requestedSourceVersion
    : 1;
  const evidenceRefs = Array.from(
    new Set(
      (Array.isArray(payload.evidenceRefs) ? payload.evidenceRefs : [])
        .map((ref) => String(ref || '').trim())
        .filter(Boolean)
    )
  );
  const capturedAt = new Date().toISOString();
  const proposedOutcome = String(payload.proposedOutcome || '').trim() || null;
  const requestedPriority = String(payload.priority || 'MEDIUM').trim().toUpperCase();
  const priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = [
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
  ].includes(requestedPriority)
    ? (requestedPriority as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')
    : 'MEDIUM';

  await submitSourceProposal({
    proposalId,
    expectedVersion: 0,
    clientRequestId: stableCommandId('submit', creationRequestId),
    sourceType,
    sourceId,
    sourceVersion,
    provenance: {
      system: 'consultify.initiatives-hub',
      recordType: requestedSourceType ? 'source-backed-initiative-proposal' : 'manual-initiative-proposal',
      capturedAt,
      evidenceRefs: Array.from(
        new Set([...evidenceRefs, `consultify://initiatives/source-proposals/${proposalId}`])
      ),
    },
    title: String(payload.title || '').trim(),
    problem,
    proposedOutcome,
    priority,
    projectId,
    initiativeOwnerId,
    visibility:
      payload.visibility === 'ORGANIZATION_RESTRICTED' ? 'ORGANIZATION_RESTRICTED' : 'PROJECT',
  }).catch((error: unknown) => {
    throw opiszOdmoweTworzeniaInicjatywy(error);
  });

  await registerSourceProposal({
    initiativeId,
    expectedVersion: 0,
    clientRequestId: stableCommandId('register', creationRequestId),
    proposalId,
    proposalVersion: 1,
    sourceType,
    sourceId,
    sourceVersion,
    title: String(payload.title || '').trim(),
    problem,
    proposedOutcome,
    priority,
    projectId,
    visibility:
      payload.visibility === 'ORGANIZATION_RESTRICTED' ? 'ORGANIZATION_RESTRICTED' : 'PROJECT',
    initiativeOwnerId,
  }).catch((error: unknown) => {
    throw opiszOdmoweTworzeniaInicjatywy(error);
  });

  // Cold readback is authoritative; never synthesize success from command responses.
  const cold = await readRegisteredInitiative(initiativeId);
  const created = {
    ...cold,
    initiative: {
      ...cold.initiative,
      id: cold.initiative.initiativeId,
      name: cold.initiative.title,
      summary: cold.initiative.proposedOutcome || cold.initiative.problem || '',
      description: cold.initiative.problem || '',
      axis: String(payload.axis || 'transformational'),
      status: 'DRAFT',
      priority,
      progress: 0,
      budget: 0,
      createdAt: cold.updatedAt,
      created_at: cold.updatedAt,
      updatedAt: cold.updatedAt,
      updated_at: cold.updatedAt,
    },
  };
  bumpInitiativeRefresh();

  return {
    created,
    createdId: initiativeId,
    truth: {
      initiative: created.initiative,
      gateReadiness: null,
      statusHistory: [],
      history: [],
    },
  };
}

export async function updateInitiativeStatusWriteTruth(
  initiativeId: string,
  targetStatus: string,
  overrideReason?: string
): Promise<InitiativeWriteTruthBundle> {
  await Api.patch(`/initiatives/${encodeURIComponent(initiativeId)}/status`, {
    status: targetStatus,
    ...(overrideReason ? { overrideReason } : {}),
  });
  bumpInitiativeRefresh();
  return refreshInitiativeWriteTruth(initiativeId);
}

export async function quickUpdateInitiativeWriteTruth(
  initiativeId: string,
  updates: Record<string, unknown>,
  expectedVersion?: number
): Promise<InitiativeWriteTruthBundle> {
  if (!expectedVersion) throw new Error('Canonical version is required for initiative amendment');
  await amendRegisteredInitiative(initiativeId, {
    expectedVersion,
    clientRequestId: newCommandId('amend'),
    ...(typeof updates.title === 'string' ? { title: updates.title } : {}),
    ...(typeof updates.summary === 'string' ? { proposedOutcome: updates.summary } : {}),
    ...(typeof updates.description === 'string' ? { problem: updates.description } : {}),
    ...(typeof updates.ownerExecutionId === 'string' ? { initiativeOwnerId: updates.ownerExecutionId } : {}),
  });
  bumpInitiativeRefresh();
  const initiative = await readRegisteredInitiative(initiativeId);
  return { initiative: initiative.initiative, gateReadiness: null, statusHistory: [], history: [] };
}

export async function cancelInitiativeWriteTruth(initiativeId: string, expectedVersion: number, reason: string) {
  await cancelRegisteredInitiative(initiativeId, { expectedVersion, clientRequestId: newCommandId('cancel'), reason });
  bumpInitiativeRefresh();
  return readRegisteredInitiative(initiativeId);
}

export async function saveInitiativeWriteTruth(
  initiativeId: string,
  updates: Record<string, unknown>
) {
  await Api.put(`/initiatives/${initiativeId}`, updates);
  bumpInitiativeRefresh();
  return refreshInitiativeWriteTruth(initiativeId);
}
