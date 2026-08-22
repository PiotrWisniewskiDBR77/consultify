/**
 * Pakiet F — stan Compute dla Baseline (`CalculationsView`/`BaselineWorkspace`).
 *
 * DoD: „żadnego Request timed out w UI" (OWN-FIN-018 — dziś Compute kończy
 * się timeoutem bez wyniku) + „ponowienie idempotentne" + „stale po edycji
 * założeń". `POST /baseline/:id/compute` (`baseline.routes.ts`) jest
 * SYNCHRONICZNY (liczy w ramach jednego żądania HTTP, nie kolejka
 * job'ów/polling) — `fetchWithRetry` ma twardy 20s timeout
 * (`src/services/api/baseClient.ts`); duży model może w teorii przekroczyć
 * ten czas mimo że serwer dokończy liczenie. Ten hook NIGDY nie pokazuje
 * surowego komunikatu klienta jako jedynego stanu: po błędzie odpytuje
 * `GET .../outputs`, żeby ustalić, czy compute mimo wszystko dopiął się po
 * stronie serwera (odzysk idempotentny — bez ponownego liczenia).
 *
 * ★ Odkryty podczas budowy tego pakietu, zgłoszony jako defekt spoza
 * allowlisty (server/**, pakiet B2/B3): powtórne POST z TĄ SAMĄ parą
 * (businessVersionId, forecastPeriodIds/entityId) po sukcesie trafia w
 * `computeJobService.enqueue` (idempotencyKey = hash inputów) →
 * `wasExisting:true`, ale zaraz potem `claimById` wymaga status='queued' —
 * dla już-`succeeded` joba to NIGDY nie jest prawda, więc
 * `baselineComputeService.runBaselineCompute` (linia ~447-451) RZUCA
 * „failed to self-claim…" zamiast zwrócić istniejący wynik. To NIE jest coś,
 * co ten hook może naprawić (server/** poza allowlistą) — ale UI musi się z
 * tym obchodzić uczciwie: (1) primary CTA jest wyłączony, gdy świeżość ===
 * CURRENT (nic się nie zmieniło od ostatniego sukcesu, więc nie ma powodu
 * bić w ten sam request), (2) jeśli mimo to compute padnie z powodu tego
 * błędu, odzysk przez `GET .../outputs` (ta sama ścieżka co przy timeoucie)
 * i tak pokaże użytkownikowi poprawny, już policzony wynik zamiast czerwonego
 * ekranu.
 */
import { useCallback, useEffect, useState } from 'react';

import { computeBaseline, listBaselineOutputs } from '@/services/api/financeV2.api';
import {
  describeFinanceV2Error,
  type BaselineComputeParams,
  type BaselineComputeResultDto,
  type FinanceArtifactFreshness,
} from '@/services/api/financeV2.types';

export type BaselineComputeUiState = 'idle' | 'computing' | 'succeeded' | 'recovering' | 'failed';

export type BaselineStaleReason = 'NEVER_COMPUTED' | 'ASSUMPTIONS_EDITED' | 'SOURCE_CHANGED' | null;

export interface UseBaselineComputeResult {
  state: BaselineComputeUiState;
  result: BaselineComputeResultDto | null;
  lastComputedAt: Date | null;
  errorDetail: { title: string; detail: string; code: string | null } | null;
  wasRecovered: boolean;
  stale: { stale: boolean; reason: BaselineStaleReason };
  run: (
    params: Omit<BaselineComputeParams, 'businessVersionId'>
  ) => Promise<{ ok: true; recovered?: true } | { ok: false }>;
  markStale: (reason: Exclude<BaselineStaleReason, null>) => void;
}

export function useBaselineCompute(
  businessVersionId: string,
  initialFreshness: FinanceArtifactFreshness = 'NEVER_COMPUTED'
): UseBaselineComputeResult {
  const [state, setState] = useState<BaselineComputeUiState>('idle');
  const [result, setResult] = useState<BaselineComputeResultDto | null>(null);
  const [lastComputedAt, setLastComputedAt] = useState<Date | null>(null);
  const [errorDetail, setErrorDetail] = useState<{ title: string; detail: string; code: string | null } | null>(null);
  const [wasRecovered, setWasRecovered] = useState(false);
  const [stale, setStale] = useState<{ stale: boolean; reason: BaselineStaleReason }>(() => ({
    stale: initialFreshness !== 'CURRENT',
    reason:
      initialFreshness === 'CURRENT'
        ? null
        : initialFreshness === 'STALE_SOURCE'
          ? 'SOURCE_CHANGED'
          : initialFreshness === 'STALE_ASSUMPTIONS'
            ? 'ASSUMPTIONS_EDITED'
            : 'NEVER_COMPUTED',
  }));

  useEffect(() => {
    setStale({
      stale: initialFreshness !== 'CURRENT',
      reason:
        initialFreshness === 'CURRENT'
          ? null
          : initialFreshness === 'STALE_SOURCE'
            ? 'SOURCE_CHANGED'
            : initialFreshness === 'STALE_ASSUMPTIONS'
              ? 'ASSUMPTIONS_EDITED'
              : 'NEVER_COMPUTED',
    });
  }, [businessVersionId, initialFreshness]);

  const run = useCallback(
    async (params: Omit<BaselineComputeParams, 'businessVersionId'>) => {
      setState('computing');
      setErrorDetail(null);
      setWasRecovered(false);
      try {
        const r = await computeBaseline({ businessVersionId, ...params });
        setResult(r);
        setLastComputedAt(new Date());
        setState('succeeded');
        setStale({ stale: false, reason: null });
        return { ok: true as const };
      } catch (e) {
        setState('recovering');
        const described = describeFinanceV2Error(e);
        try {
          const outputs = await listBaselineOutputs(businessVersionId, { entityId: params.entityId });
          const hasForecastForRequestedPeriods =
            outputs.length > 0 &&
            params.forecastPeriodIds.every((pid) => outputs.some((o) => o.periodId === pid && o.valueKind === 'FORECAST'));
          if (hasForecastForRequestedPeriods) {
            setLastComputedAt(new Date());
            setState('succeeded');
            setStale({ stale: false, reason: null });
            setErrorDetail(null);
            setWasRecovered(true);
            return { ok: true as const, recovered: true as const };
          }
        } catch {
          // Odczyt odzysku też padł — spadamy do `failed` poniżej, uczciwie
          // (nie udajemy sukcesu, którego nie potwierdziliśmy).
        }
        setErrorDetail(described);
        setState('failed');
        return { ok: false as const };
      }
    },
    [businessVersionId]
  );

  const markStale = useCallback((reason: Exclude<BaselineStaleReason, null>) => {
    setStale({ stale: true, reason });
  }, []);

  return { state, result, lastComputedAt, errorDetail, wasRecovered, stale, run, markStale };
}

export default useBaselineCompute;
