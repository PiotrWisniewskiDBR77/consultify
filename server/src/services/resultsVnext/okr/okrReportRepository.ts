/**
 * P7K część A — read model RAPORTU OKR (poziomy 1 i 2 formuły właściciela).
 *
 * ── PO CO ISTNIEJE ────────────────────────────────────────────────────────
 * SSOT (`docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md` §3) każe na
 * poziomie 1 pokazać dla KAŻDEGO raportu: liczbę celów, liczbę rezultatów,
 * rozkład stanu, liczbę właścicieli i ostatni check-in. Żaden istniejący
 * endpoint tego nie daje: `GET /sets` zwraca gołe wiersze `okr_vnext_sets`,
 * a policzenie tego po stronie klienta znaczyłoby `GET /sets/:id/objectives`
 * NA KAŻDY WIERSZ — dokładnie ten N+1 na wiersz, który `okrApi.ts` w swoim
 * nagłówku nazywa po imieniu i którego kanon zabrania.
 *
 * Poziom 2 potrzebuje dodatkowo DATY OSTATNIEGO CHECK-INU PER REZULTAT —
 * `listCheckIns` jest per rezultat, więc tabela 28 rezultatów kosztowałaby
 * 28 wywołań. Druga funkcja tutaj robi to jednym zapytaniem.
 *
 * ── ABAC ──────────────────────────────────────────────────────────────────
 * Ten sam wzorzec, co `okrSetRepository.ts`/`okrObjectiveRepository.ts`:
 * autoryzacja ZAWSZE na widoczności ZESTAWU (`resource_type = 'okr_set'`),
 * z obowiązkowym rzutowaniem `::text` na złączeniu (ten sam cast, którego
 * brak jest najczęściej powtarzanym realnym błędem w tym programie —
 * `okrSetRepository.ts` liczy siedem wystąpień w jednym epiku KPI).
 * Cele, rezultaty i check-iny NIE mają własnych wierszy widoczności —
 * dziedziczą przez `set_id`.
 *
 * ── UCZCIWOŚĆ LICZB ───────────────────────────────────────────────────────
 * Cztery kubełki stanu są ROZŁĄCZNE i WYCZERPUJĄCE (suma = liczba
 * nieanulowanych rezultatów), żeby wiersz raportu nie kłamał ani przez
 * podwójne liczenie, ani przez „gdzieś zniknęło pięć rezultatów”:
 *   · onTrack   — `on_track` albo `achieved`
 *   · atRisk    — `at_risk`
 *   · critical  — `off_track` albo `not_achieved`
 *   · noSignal  — `not_started` ALBO rezultat bez ani jednego check-inu
 * `cancelled` nie wchodzi do żadnego kubełka i nie jest liczone w
 * `keyResultCount` — anulowany rezultat nie jest stanem raportu.
 * `lastCheckinAt` liczymy z REALNYCH check-inów (MAX `submitted_at`), nie z
 * denormalizowanego `okr_vnext_sets.last_checkin_at`, żeby kolumna „OSTATNI
 * CHECK-IN” nie pokazywała daty, za którą nie stoi żaden wpis.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  buildVisibilityScopedCte,
  wrapWithVisibilityScope,
  VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';

import { OKR_SET_RESOURCE_TYPE } from './okrSetCommands.js';

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function queryRows<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values: unknown[]
): Promise<T[]> {
  const result = await client.query<T>(sql, values);
  return result.rows;
}

/** Zamiana `count(*)` (node-pg oddaje `bigint` jako STRING) na liczbę.
 * Ten sam problem numeryczny, o którym mówią komentarze przy `progress`. */
function toCount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ==========================================
// listOkrReportSummaries — poziom 1
// ==========================================

export interface OkrReportStateCounts {
  onTrack: number;
  atRisk: number;
  critical: number;
  /** `not_started` ALBO brak jakiegokolwiek check-inu — patrz nagłówek. */
  noSignal: number;
}

export interface OkrReportSummary {
  setId: string;
  objectiveCount: number;
  keyResultCount: number;
  ownerCount: number;
  stateCounts: OkrReportStateCounts;
  lastCheckinAt: string | null;
}

export interface ListOkrReportSummariesParams {
  userId: string;
  organizationId: string;
  limit?: number;
  offset?: number;
}

interface OkrReportSummaryRow extends QueryResultRow {
  set_id: string;
  objective_count: string | number | null;
  key_result_count: string | number | null;
  owner_count: string | number | null;
  on_track_count: string | number | null;
  at_risk_count: string | number | null;
  critical_count: string | number | null;
  no_signal_count: string | number | null;
  last_checkin_at: string | null;
}

/**
 * Jedno zapytanie na CAŁY rejestr — nie jedno na wiersz.
 *
 * `LEFT JOIN LATERAL` zamiast korelowanych podzapytań w SELECT: rezultaty i
 * cele agregujemy raz, a `EXISTS` na check-inach liczymy wewnątrz agregatu
 * rezultatów, więc nie mnożymy wierszy (klasyczny błąd „join dwóch tabel
 * potomnych naraz” zawyżałby KAŻDY licznik).
 */
export async function listOkrReportSummaries(
  params: ListOkrReportSummariesParams
): Promise<OkrReportSummary[]> {
  const { userId, organizationId, limit = 100, offset = 0 } = params;

  const cte = await buildVisibilityScopedCte({
    userId,
    organizationId,
    resourceType: OKR_SET_RESOURCE_TYPE,
  });
  const values: unknown[] = [...cte.values, limit, offset];
  const limitParamIndex = cte.values.length + 1;
  const offsetParamIndex = cte.values.length + 2;

  const sql = `${cte.sql}
    SELECT s.set_id,
           COALESCE(o.objective_count, 0)  AS objective_count,
           COALESCE(kr.key_result_count, 0) AS key_result_count,
           COALESCE(ow.owner_count, 0)      AS owner_count,
           COALESCE(kr.on_track_count, 0)   AS on_track_count,
           COALESCE(kr.at_risk_count, 0)    AS at_risk_count,
           COALESCE(kr.critical_count, 0)   AS critical_count,
           COALESCE(kr.no_signal_count, 0)  AS no_signal_count,
           ci.last_checkin_at
      FROM okr_vnext_sets s
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = s.set_id::text
      LEFT JOIN LATERAL (
             SELECT count(*) AS objective_count
               FROM okr_vnext_objectives obj
              WHERE obj.set_id = s.set_id AND obj.status <> 'cancelled'
           ) o ON TRUE
      LEFT JOIN LATERAL (
             SELECT count(*) AS key_result_count,
                    count(*) FILTER (WHERE k.status IN ('on_track', 'achieved'))       AS on_track_count,
                    count(*) FILTER (WHERE k.status = 'at_risk')                        AS at_risk_count,
                    count(*) FILTER (WHERE k.status IN ('off_track', 'not_achieved'))   AS critical_count,
                    count(*) FILTER (
                      WHERE k.status = 'not_started'
                         OR NOT EXISTS (
                              SELECT 1 FROM okr_vnext_checkins c
                               WHERE c.key_result_id = k.key_result_id
                            )
                    ) AS no_signal_count
               FROM okr_vnext_key_results k
              WHERE k.set_id = s.set_id AND k.status <> 'cancelled'
           ) kr ON TRUE
      LEFT JOIN LATERAL (
             SELECT count(DISTINCT owner_user_id) AS owner_count
               FROM (
                     SELECT obj.owner_user_id
                       FROM okr_vnext_objectives obj
                      WHERE obj.set_id = s.set_id AND obj.status <> 'cancelled'
                     UNION ALL
                     SELECT k.owner_user_id
                       FROM okr_vnext_key_results k
                      WHERE k.set_id = s.set_id AND k.status <> 'cancelled'
                   ) owners
           ) ow ON TRUE
      LEFT JOIN LATERAL (
             SELECT max(c.submitted_at) AS last_checkin_at
               FROM okr_vnext_checkins c
              WHERE c.set_id = s.set_id
           ) ci ON TRUE
     WHERE s.organization_id = $1
     ORDER BY s.updated_at DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const rows = await withReadClient((client) =>
    queryRows<OkrReportSummaryRow>(client, sql, values)
  );
  return rows.map((row) => ({
    setId: row.set_id,
    objectiveCount: toCount(row.objective_count),
    keyResultCount: toCount(row.key_result_count),
    ownerCount: toCount(row.owner_count),
    stateCounts: {
      onTrack: toCount(row.on_track_count),
      atRisk: toCount(row.at_risk_count),
      critical: toCount(row.critical_count),
      noSignal: toCount(row.no_signal_count),
    },
    lastCheckinAt: row.last_checkin_at,
  }));
}

// ==========================================
// listKeyResultCheckInSummariesForSet — poziom 2
// ==========================================

export interface OkrKeyResultCheckInSummary {
  keyResultId: string;
  lastCheckinAt: string | null;
  /** Notatka z OSTATNIEGO check-inu — dymek kolumny „OSTATNI CHECK-IN”. */
  lastNote: string | null;
  checkInCount: number;
}

export interface ListKeyResultCheckInSummariesParams {
  userId: string;
  organizationId: string;
  setId: string;
}

export async function listKeyResultCheckInSummariesForSet(
  params: ListKeyResultCheckInSummariesParams
): Promise<OkrKeyResultCheckInSummary[]> {
  const { userId, organizationId, setId } = params;
  const baseQuerySql = `
    SELECT k.key_result_id,
           last_ci.submitted_at AS last_checkin_at,
           last_ci.note         AS last_note,
           COALESCE(cnt.checkin_count, 0) AS checkin_count
      FROM okr_vnext_key_results k
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = k.set_id::text
      LEFT JOIN LATERAL (
             SELECT c.submitted_at, c.note
               FROM okr_vnext_checkins c
              WHERE c.key_result_id = k.key_result_id
              ORDER BY c.submitted_at DESC, c.checkin_id DESC
              LIMIT 1
           ) last_ci ON TRUE
      LEFT JOIN LATERAL (
             SELECT count(*) AS checkin_count
               FROM okr_vnext_checkins c
              WHERE c.key_result_id = k.key_result_id
           ) cnt ON TRUE
     WHERE k.organization_id = $1
       AND k.set_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: OKR_SET_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, setId];

  interface Row extends QueryResultRow {
    key_result_id: string;
    last_checkin_at: string | null;
    last_note: string | null;
    checkin_count: string | number | null;
  }
  const rows = await withReadClient((client) => queryRows<Row>(client, wrapped.sql, values));
  return rows.map((row) => ({
    keyResultId: row.key_result_id,
    lastCheckinAt: row.last_checkin_at,
    lastNote: row.last_note,
    checkInCount: toCount(row.checkin_count),
  }));
}
