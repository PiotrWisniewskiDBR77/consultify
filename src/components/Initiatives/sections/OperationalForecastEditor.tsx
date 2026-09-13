import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  readInitiativeCapabilities,
  readRegisteredInitiative,
  RuntimeApiError,
  updateInitiativeForecast,
} from '@/services/initiatives-execution/runtimeApi';
import { useAppStore } from '@/store/useAppStore';
import { bumpInitiativeRefresh } from '@/store/useInitiativeRefreshStore';

import { useInitiativeContext } from './InitiativeContext';

type ForecastValue = { known: true; value: string | null } | { known: false; value: null };
type ForecastPair = { start: ForecastValue; end: ForecastValue };

type LoadState =
  | { kind: 'loading'; identityKey: string }
  | {
      kind: 'ready';
      identityKey: string;
      version: number;
      canonical: ForecastPair;
      available: boolean;
      denialCode: string | null;
    }
  | { kind: 'error'; identityKey: string; message: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function ownField(source: unknown, names: readonly string[]): ForecastValue {
  if (!source || typeof source !== 'object') return { known: false, value: null };
  const record = source as Record<string, unknown>;
  for (const name of names) {
    if (!Object.prototype.hasOwnProperty.call(record, name)) continue;
    const value = record[name];
    if (value === null) return { known: true, value: null };
    if (typeof value === 'string' && isCalendarDate(value)) return { known: true, value };
    return { known: false, value: null };
  }
  return { known: false, value: null };
}

function readForecastPair(source: unknown): ForecastPair {
  return {
    start: ownField(source, ['forecastStartDate', 'forecast_start_date']),
    end: ownField(source, ['forecastEndDate', 'forecast_end_date']),
  };
}

function prefer(primary: ForecastValue, fallback: ForecastValue): ForecastValue {
  return primary.known ? primary : fallback;
}

function formatCalendarDate(value: ForecastValue, isPolish: boolean): string {
  if (!value.known) return isPolish ? 'Nieznana' : 'Unknown';
  if (value.value === null) return isPolish ? 'Nie zaplanowano' : 'Not scheduled';
  const [year, month, day] = value.value.split('-').map(Number);
  return new Intl.DateTimeFormat(isPolish ? 'pl-PL' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function createRequestId(initiativeId: string): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `initiative-forecast-${initiativeId}-${suffix}`;
}

function denialMessage(code: string | null, isPolish: boolean): string {
  if (code === 'INITIATIVE_FORECAST_LIFECYCLE_INVALID') {
    return isPolish
      ? 'Prognozę operacyjną można zmieniać tylko dla zaplanowanej lub realizowanej inicjatywy.'
      : 'Operational forecast can be changed only for a scheduled or executing Initiative.';
  }
  if (code === 'INITIATIVE_FORECAST_PROJECTION_NOT_FOUND') {
    return isPolish
      ? 'Zmiana prognozy operacyjnej nie jest jeszcze dostępna dla tej inicjatywy.'
      : 'Operational forecast changes are not available for this Initiative yet.';
  }
  return isPolish
    ? 'Nie masz uprawnienia do zmiany prognozy operacyjnej.'
    : 'You do not have permission to change the operational forecast.';
}

function writeErrorMessage(error: unknown, isPolish: boolean): string {
  if (error instanceof RuntimeApiError && error.code === 'INITIATIVE_FORECAST_RANGE_INVALID') {
    return isPolish
      ? 'Początek prognozy nie może przypadać po jej końcu.'
      : 'Forecast start cannot be later than forecast end.';
  }
  return isPolish
    ? 'Nie udało się zapisać prognozy. Możesz ponowić tę samą propozycję.'
    : 'Could not save the forecast. You can retry the same proposal.';
}

export const OperationalForecastEditor: React.FC = () => {
  const { t } = useTranslation();
  const { initiative, initiativeId, isPolish, fetchAll } = useInitiativeContext();
  const securityScopeKey = useAppStore(
    (store) =>
      `${store.currentOrganization?.id ?? 'no-org'}:${store.currentUser?.id ?? 'no-user'}:${store.currentUser?.role ?? 'no-role'}`
  );
  const identityKey = `${securityScopeKey}:${initiativeId}`;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading', identityKey });
  const [confirmedAfter, setConfirmedAfter] = useState<{
    identityKey: string;
    forecast: ForecastPair;
  } | null>(null);
  const [moduleSnapshot, setModuleSnapshot] = useState<{
    identityKey: string;
    source: unknown;
    forecast: ForecastPair;
  }>(() => ({ identityKey, source: initiative, forecast: readForecastPair(initiative) }));
  const [changeStart, setChangeStart] = useState(false);
  const [changeEnd, setChangeEnd] = useState(false);
  const [startDraft, setStartDraft] = useState('');
  const [endDraft, setEndDraft] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    kind: 'success' | 'conflict' | 'error';
    message: string;
  } | null>(null);
  const requestIdentityRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const loadGenerationRef = useRef(0);
  const identityGenerationRef = useRef(0);
  const activeInitiativeIdRef = useRef(initiativeId);
  const activeSecurityScopeRef = useRef(securityScopeKey);
  activeInitiativeIdRef.current = initiativeId;
  activeSecurityScopeRef.current = securityScopeKey;

  const visibleLoadState = useMemo<LoadState>(
    () => (loadState.identityKey === identityKey ? loadState : { kind: 'loading', identityKey }),
    [identityKey, loadState]
  );

  const moduleForecast =
    moduleSnapshot.identityKey === identityKey && moduleSnapshot.source === initiative
      ? moduleSnapshot.forecast
      : readForecastPair(null);
  const currentForecast = useMemo<ForecastPair>(() => {
    if (confirmedAfter?.identityKey === identityKey) return confirmedAfter.forecast;
    const canonical =
      visibleLoadState.kind === 'ready' ? visibleLoadState.canonical : readForecastPair(null);
    return {
      start: prefer(canonical.start, moduleForecast.start),
      end: prefer(canonical.end, moduleForecast.end),
    };
  }, [confirmedAfter, identityKey, moduleForecast, visibleLoadState]);

  const loadReference = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    const requestedIdentityKey = identityKey;
    setLoadState({ kind: 'loading', identityKey: requestedIdentityKey });
    try {
      const [registration, capabilities] = await Promise.all([
        readRegisteredInitiative(initiativeId),
        readInitiativeCapabilities(initiativeId),
      ]);
      if (
        generation !== loadGenerationRef.current ||
        activeInitiativeIdRef.current !== initiativeId ||
        activeSecurityScopeRef.current !== securityScopeKey
      ) {
        return;
      }
      const canonicalPayload = registration.initiative as unknown as Record<string, unknown>;
      const forecastCapability = capabilities.executionWrites?.forecast;
      setLoadState({
        kind: 'ready',
        identityKey: requestedIdentityKey,
        version: registration.version,
        canonical: readForecastPair(canonicalPayload),
        available: forecastCapability?.available === true,
        denialCode: forecastCapability?.denialCode ?? null,
      });
      setConfirmedAfter(null);
    } catch {
      if (
        generation !== loadGenerationRef.current ||
        activeInitiativeIdRef.current !== initiativeId ||
        activeSecurityScopeRef.current !== securityScopeKey
      ) {
        return;
      }
      setLoadState({
        kind: 'error',
        identityKey: requestedIdentityKey,
        message: isPolish
          ? 'Nie udało się wczytać prognozy operacyjnej. Spróbuj ponownie.'
          : 'Could not load the operational forecast. Try again.',
      });
    }
  }, [identityKey, initiativeId, isPolish, securityScopeKey]);

  useEffect(() => {
    setModuleSnapshot((current) => ({
      identityKey,
      source: initiative,
      forecast:
        current.identityKey !== identityKey && current.source === initiative
          ? readForecastPair(null)
          : readForecastPair(initiative),
    }));
  }, [identityKey, initiative]);

  useEffect(() => {
    identityGenerationRef.current += 1;
    setConfirmedAfter(null);
    setChangeStart(false);
    setChangeEnd(false);
    setStartDraft('');
    setEndDraft('');
    setReason('');
    setSaving(false);
    setNotice(null);
    requestIdentityRef.current = null;
    void loadReference();
    return () => {
      loadGenerationRef.current += 1;
      identityGenerationRef.current += 1;
    };
  }, [initiativeId, loadReference, securityScopeKey]);

  const onRefresh = useCallback(async () => {
    const refreshedInitiativeId = initiativeId;
    const refreshedSecurityScope = securityScopeKey;
    setNotice(null);
    try {
      await fetchAll();
    } finally {
      if (
        activeInitiativeIdRef.current === refreshedInitiativeId &&
        activeSecurityScopeRef.current === refreshedSecurityScope
      ) {
        await loadReference();
      }
    }
  }, [fetchAll, initiativeId, loadReference, securityScopeKey]);

  const commandFields = useMemo(() => {
    const fields: { forecastStartDate?: string | null; forecastEndDate?: string | null } = {};
    if (changeStart) fields.forecastStartDate = startDraft || null;
    if (changeEnd) fields.forecastEndDate = endDraft || null;
    return fields;
  }, [changeEnd, changeStart, endDraft, startDraft]);

  const canSubmit =
    visibleLoadState.kind === 'ready' &&
    visibleLoadState.available &&
    (changeStart || changeEnd) &&
    reason.trim().length > 0 &&
    (!changeStart || startDraft === '' || isCalendarDate(startDraft)) &&
    (!changeEnd || endDraft === '' || isCalendarDate(endDraft));

  const submit = async () => {
    if (!canSubmit || visibleLoadState.kind !== 'ready' || saving) return;
    const trimmedReason = reason.trim();
    const fingerprint = JSON.stringify({
      expectedVersion: visibleLoadState.version,
      ...commandFields,
      reason: trimmedReason,
    });
    if (requestIdentityRef.current?.fingerprint !== fingerprint) {
      requestIdentityRef.current = { fingerprint, id: createRequestId(initiativeId) };
    }
    const clientRequestId = requestIdentityRef.current.id;
    const submittedInitiativeId = initiativeId;
    const submittedSecurityScope = securityScopeKey;
    const submittedIdentityGeneration = identityGenerationRef.current;

    setSaving(true);
    setNotice(null);
    try {
      const result = await updateInitiativeForecast(initiativeId, {
        expectedVersion: visibleLoadState.version,
        clientRequestId,
        ...commandFields,
        reason: trimmedReason,
      });
      if (
        activeInitiativeIdRef.current !== submittedInitiativeId ||
        activeSecurityScopeRef.current !== submittedSecurityScope ||
        identityGenerationRef.current !== submittedIdentityGeneration
      ) {
        return;
      }
      const after = readForecastPair(result.response.after);
      setConfirmedAfter({ identityKey, forecast: after });
      setLoadState((current) =>
        current.kind === 'ready' && current.identityKey === identityKey
          ? { ...current, version: result.aggregateVersion, canonical: after }
          : current
      );
      setChangeStart(false);
      setChangeEnd(false);
      setReason('');
      requestIdentityRef.current = null;
      setNotice({
        kind: 'success',
        message: isPolish ? 'Prognoza operacyjna została zapisana.' : 'Operational forecast saved.',
      });
      bumpInitiativeRefresh();
      try {
        await fetchAll();
      } catch {
        if (
          activeInitiativeIdRef.current === submittedInitiativeId &&
          activeSecurityScopeRef.current === submittedSecurityScope &&
          identityGenerationRef.current === submittedIdentityGeneration
        ) {
          setNotice({
            kind: 'success',
            message: isPolish
              ? 'Prognoza została zapisana, ale karta nie odświeżyła się automatycznie.'
              : 'Forecast saved, but the card did not refresh automatically.',
          });
        }
      }
    } catch (error) {
      if (
        activeInitiativeIdRef.current !== submittedInitiativeId ||
        activeSecurityScopeRef.current !== submittedSecurityScope ||
        identityGenerationRef.current !== submittedIdentityGeneration
      ) {
        return;
      }
      if (
        error instanceof RuntimeApiError &&
        error.status === 409 &&
        error.code === 'VERSION_OR_IDEMPOTENCY_CONFLICT'
      ) {
        setNotice({
          kind: 'conflict',
          message: isPolish
            ? 'Ta korekta nie odpowiada już bieżącej prognozie. Odśwież, sprawdź propozycję i zapisz ponownie.'
            : 'This correction no longer matches the current forecast. Refresh, review your proposal, and save again.',
        });
      } else {
        setNotice({
          kind: 'error',
          message: writeErrorMessage(error, isPolish),
        });
      }
    } finally {
      if (
        activeInitiativeIdRef.current === submittedInitiativeId &&
        activeSecurityScopeRef.current === submittedSecurityScope &&
        identityGenerationRef.current === submittedIdentityGeneration
      ) {
        setSaving(false);
      }
    }
  };

  return (
    <section
      aria-labelledby="operational-forecast-heading"
      className="rounded-2xl border border-blue-200/70 bg-blue-50/40 p-5 dark:border-blue-900/60 dark:bg-blue-950/20"
      data-testid="operational-forecast-editor"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="operational-forecast-heading"
            className="text-sm font-semibold text-slate-800 dark:text-white"
          >
            {t('initiatives.timelineSection.operationalForecast.title', {
              defaultValue: isPolish ? 'Prognoza operacyjna' : 'Operational forecast',
            })}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {t('initiatives.timelineSection.operationalForecast.baselineLocked', {
              defaultValue: isPolish
                ? 'Korekta prognozy nie zmienia zatwierdzonego planu bazowego.'
                : 'A forecast correction does not change the approved baseline.',
            })}
          </p>
        </div>
        {visibleLoadState.kind === 'ready' && (
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-navy-800 dark:text-slate-300">
            {isPolish ? 'Wersja' : 'Version'} {visibleLoadState.version}
          </span>
        )}
      </div>

      <dl
        className="mt-4 grid gap-3 sm:grid-cols-2"
        aria-label={isPolish ? 'Bieżąca prognoza' : 'Current forecast'}
      >
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            {isPolish ? 'Początek prognozy' : 'Forecast start'}
          </dt>
          <dd
            className="mt-1 text-sm text-slate-800 dark:text-slate-100"
            data-testid="current-forecast-start"
          >
            {formatCalendarDate(currentForecast.start, isPolish)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            {isPolish ? 'Koniec prognozy' : 'Forecast end'}
          </dt>
          <dd
            className="mt-1 text-sm text-slate-800 dark:text-slate-100"
            data-testid="current-forecast-end"
          >
            {formatCalendarDate(currentForecast.end, isPolish)}
          </dd>
        </div>
      </dl>

      {visibleLoadState.kind === 'loading' && (
        <p className="mt-4 text-xs text-slate-500" role="status">
          {isPolish ? 'Sprawdzanie dostępności prognozy…' : 'Checking forecast availability…'}
        </p>
      )}

      {visibleLoadState.kind === 'error' && (
        <div className="mt-4" role="alert">
          <p className="text-xs text-danger-600 dark:text-danger-400">{visibleLoadState.message}</p>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-c-info"
            onClick={() => void loadReference()}
          >
            {isPolish ? 'Spróbuj ponownie' : 'Try again'}
          </button>
        </div>
      )}

      {visibleLoadState.kind === 'ready' && !visibleLoadState.available && (
        <p
          className="mt-4 rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-navy-800 dark:text-slate-300"
          role="status"
        >
          {denialMessage(visibleLoadState.denialCode, isPolish)}
        </p>
      )}

      {visibleLoadState.kind === 'ready' && visibleLoadState.available && (
        <div className="mt-4 space-y-3 border-t border-blue-200/60 pt-4 dark:border-blue-900/50">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={changeStart}
              disabled={saving}
              onChange={(event) => setChangeStart(event.target.checked)}
            />
            {isPolish ? 'Zmień początek prognozy' : 'Change forecast start'}
          </label>
          {changeStart && (
            <div>
              <label
                htmlFor="operational-forecast-start"
                className="text-xs text-slate-600 dark:text-slate-300"
              >
                {isPolish
                  ? 'Nowy początek (puste pole usuwa datę)'
                  : 'New start (leave empty to clear)'}
              </label>
              <input
                id="operational-forecast-start"
                type="date"
                value={startDraft}
                disabled={saving}
                onChange={(event) => setStartDraft(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={changeEnd}
              disabled={saving}
              onChange={(event) => setChangeEnd(event.target.checked)}
            />
            {isPolish ? 'Zmień koniec prognozy' : 'Change forecast end'}
          </label>
          {changeEnd && (
            <div>
              <label
                htmlFor="operational-forecast-end"
                className="text-xs text-slate-600 dark:text-slate-300"
              >
                {isPolish
                  ? 'Nowy koniec (puste pole usuwa datę)'
                  : 'New end (leave empty to clear)'}
              </label>
              <input
                id="operational-forecast-end"
                type="date"
                value={endDraft}
                disabled={saving}
                onChange={(event) => setEndDraft(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="operational-forecast-reason"
              className="text-xs text-slate-600 dark:text-slate-300"
            >
              {isPolish ? 'Powód korekty' : 'Reason for correction'}
            </label>
            <textarea
              id="operational-forecast-reason"
              value={reason}
              disabled={saving}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
            />
          </div>

          {notice && (
            <p
              role={notice.kind === 'success' ? 'status' : 'alert'}
              className={`rounded-xl p-3 text-xs ${
                notice.kind === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : notice.kind === 'conflict'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                    : 'bg-danger-50 text-danger-700 dark:bg-danger-950/30 dark:text-danger-300'
              }`}
            >
              {notice.message}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {(notice?.kind === 'conflict' || notice?.kind === 'error') && (
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 dark:border-navy-700 dark:text-slate-300"
                onClick={() => void onRefresh()}
                disabled={saving}
              >
                {isPolish ? 'Odśwież wersję' : 'Refresh version'}
              </button>
            )}
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSubmit || saving}
              onClick={() => void submit()}
            >
              {saving
                ? isPolish
                  ? 'Zapisywanie…'
                  : 'Saving…'
                : isPolish
                  ? 'Zapisz prognozę'
                  : 'Save forecast'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
