#!/usr/bin/env tsx
/**
 * SKRZYNKA-DUPLIKATY [ODMROZENIE 07_MY_WORK_AGENT DEC-397].
 *
 * Porządkuje ISTNIEJĄCE duplikaty w `notifications` dla starego kanału
 * odchyleń KPI (`myworkProjectionConsumer.handleKpiDeviationOpened`,
 * `type='DEVIATION_CASE_OPENED'`, `entity_type='deviation_case'`) — patrz
 * `../services/resultsVnext/platform/myworkProjectionConsumer.ts` dla
 * naprawy u PRODUCENTA (ten skrypt sprząta tylko wiersze zapisane PRZED tą
 * naprawą / poza jej zasięgiem).
 *
 * Pomiar na bazie 54400 (2026-09-06): 7 wpisów „Odchylenie KPI wymaga
 * wyjaśnienia" dla org DBR77, każdy z INNYM `entity_id` (7 różnych
 * `rvn_kpi_deviation_cases`) — więc NIE jest to jeden przypadek zgłaszany
 * wielokrotnie. Front (`InboxContent.tsx` `buildDuplicateIdentityKey`)
 * grupuje je jako „Możliwy duplikat", bo tytuł jest identyczny dla KAŻDEGO
 * miernika (nieparametryzowany). Sam `rvn_kpi_deviation_cases` był PUSTY w
 * chwili pomiaru — sprawy, które wygenerowały te 7 zdarzeń, już nie
 * istnieją (posprzątane demo/testy tej sesji, notifications nie zostały
 * wtedy dotknięte). Trzy niezależne przyczyny obsłużone tu, każda osobno
 * mierzalna w PLAN:
 *
 *  A) DOKŁADNY DUPLIKAT — kilka wpisów tego samego użytkownika na TĘ SAMĄ
 *     sprawę (`entity_type`+`entity_id`) — zwinięcie do JEDNEGO (najstarszy
 *     zostaje, reszta → resolved).
 *  B) KARTA JUŻ POKRYWA SPRAWĘ — sprawa istnieje w `rvn_kpi_deviation_cases`
 *     i P7K-B ma już `action_cards` dla tego samego `kpiId`+okresu (ta sama
 *     reguła co strażnik u producenta, DEC-397) → resolved, karta jest
 *     jedynym wpisem.
 *  C) SPRAWA OSIEROCONA — `entity_id` nie wskazuje już na żaden wiersz w
 *     `rvn_kpi_deviation_cases` (usunięty bez zamknięcia — `kpi.deviation_
 *     closed`/`resolveStaleNotifications` nigdy nie zadziałało) → resolved,
 *     nie ma czego pokazywać w Skrzynce. To DOKŁADNIE przypadek zmierzony
 *     na 54400 (7/7 w grupie C).
 *
 * Działanie = UPDATE notifications SET read=1,is_read=1,read_at=now()
 * (jak `resolveStaleNotifications` — nigdy DELETE, zero utraty danych;
 * `--rollback` przywraca read/is_read/read_at sprzed zmiany z manifestu).
 * Filtr WEJŚCIOWY zawsze `COALESCE(read,0)=0`, więc drugi `--apply` na tym
 * samym stanie bazy nie znajduje nic do zrobienia (ZMIENIONE: 0).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import {
  qi,
  readManifest,
  restore,
  runMain,
  writeManifest,
  type Manifest,
  type ManifestEntry,
  type Mode,
} from './wspolne.js';

const ENTITY_TYPE = 'deviation_case';
const NOTIFICATION_TYPE = 'DEVIATION_CASE_OPENED';

export type PlanRow = {
  row: Record<string, unknown>;
  reason: 'exact_duplicate' | 'covered_by_action_card' | 'orphaned_case';
};

/**
 * PLAN — czysty odczyt, bez zapisu. Używany przez `--dry-run` i jako
 * podstawa `--apply` (ten sam kod liczy, co zobaczy właściciel).
 */
export async function planDuplikaty(c: PoolClient, organizationId: string): Promise<PlanRow[]> {
  const candidates = (
    await c.query<Record<string, unknown> & { id: string; entity_id: string; created_at: string }>(
      `SELECT n.* FROM notifications n
        WHERE n.organization_id = $1
          AND n.entity_type = $2
          AND n.type = $3
          AND COALESCE(n.read, 0) = 0
        ORDER BY n.entity_id, n.created_at ASC`,
      [organizationId, ENTITY_TYPE, NOTIFICATION_TYPE]
    )
  ).rows;
  if (candidates.length === 0) return [];

  // A) dokładny duplikat — kilka wpisów na TĘ SAMĄ sprawę; najstarszy zostaje.
  const seenEntity = new Set<string>();
  const exactDuplicateIds = new Set<string>();
  for (const row of candidates) {
    const key = String(row.entity_id);
    if (seenEntity.has(key)) exactDuplicateIds.add(String(row.id));
    else seenEntity.add(key);
  }

  // B/C) sprawdź istnienie sprawy i pokrycie kartą P7K-B w JEDNYM zapytaniu —
  // ta sama logika co strażnik producenta (myworkProjectionConsumer.ts).
  const entityIds = [...new Set(candidates.map((r) => String(r.entity_id)))];
  const coverage = (
    await c.query<{ entity_id: string; case_exists: boolean; covered: boolean }>(
      `SELECT ids.entity_id,
              (dc.case_id IS NOT NULL) AS case_exists,
              (ac.id IS NOT NULL) AS covered
         FROM unnest($2::text[]) AS ids(entity_id)
         LEFT JOIN rvn_kpi_deviation_cases dc
           ON dc.organization_id = $1 AND dc.case_id::text = ids.entity_id
         LEFT JOIN rvn_kpi_measurements m ON m.measurement_id = dc.trigger_measurement_id
         LEFT JOIN action_cards ac
           ON ac.organization_id = $1 AND ac.source_kind = 'kpi_deviation'
          AND ac.source_id = dc.kpi_id::text || ':' || m.period_start::date::text || ':' || m.period_end::date::text`,
      [organizationId, entityIds]
    )
  ).rows;
  const byEntity = new Map(coverage.map((r) => [r.entity_id, r]));

  const out: PlanRow[] = [];
  for (const row of candidates) {
    const id = String(row.id);
    if (exactDuplicateIds.has(id)) {
      out.push({ row, reason: 'exact_duplicate' });
      continue;
    }
    const cov = byEntity.get(String(row.entity_id));
    if (cov?.covered) {
      out.push({ row, reason: 'covered_by_action_card' });
    } else if (!cov?.case_exists) {
      out.push({ row, reason: 'orphaned_case' });
    }
    // sprawa istnieje, otwarta, bez karty P7K-B (typowo `warning`) —
    // jedyny sygnał w Skrzynce, NIETKNIĘTA.
  }
  return out;
}

export async function mainDuplikatyPowiadomien(
  c: PoolClient,
  org: { id: string; name: string },
  mode: Mode
): Promise<void> {
  if (mode.kind === 'rollback') {
    const m = readManifest(mode.manifest!, 'duplikaty-powiadomien');
    if (m.organizationId !== org.id) throw new Error('Manifest innej organizacji');
    await c.query('BEGIN');
    try {
      const n = await restore(c, m);
      await c.query('COMMIT');
      console.log(`PRZYWRÓCONE: ${n}`);
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }
    return;
  }

  const plan = await planDuplikaty(c, org.id);
  const counts = { exact_duplicate: 0, covered_by_action_card: 0, orphaned_case: 0 };
  for (const x of plan) {
    counts[x.reason]++;
    console.log(
      `notifications · ${x.row.id} · entity_id=${x.row.entity_id} · ${x.row.created_at} · ${x.reason}`
    );
  }
  console.log(
    `PLAN: ${plan.length} do zwinięcia (dokładny duplikat=${counts.exact_duplicate}, ` +
      `pokryte kartą P7K-B=${counts.covered_by_action_card}, sprawa osierocona=${counts.orphaned_case})`
  );
  if (mode.kind === 'dry-run') return;

  const entries: ManifestEntry[] = [];
  await c.query('BEGIN');
  try {
    for (const x of plan) {
      const id = String(x.row.id);
      const q = await c.query(
        `UPDATE ${qi('notifications')}
            SET read = 1, is_read = 1, read_at = now()
          WHERE organization_id = $1 AND id = $2 AND COALESCE(read, 0) = 0
          RETURNING *`,
        [org.id, id]
      );
      if (q.rowCount) {
        entries.push({ table: 'notifications', idColumn: 'id', id, action: 'archive', before: x.row });
      }
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  const manifest: Manifest = {
    version: 1,
    script: 'duplikaty-powiadomien',
    organizationId: org.id,
    organizationName: org.name,
    createdAt: new Date().toISOString(),
    entries,
  };
  console.log(`ZMIENIONE: ${entries.length}; manifest: ${writeManifest('duplikaty-powiadomien', manifest)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMain('duplikaty-powiadomien', mainDuplikatyPowiadomien).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
