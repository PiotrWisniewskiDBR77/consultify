/**
 * Finance v3 — leniwa MATERIALIZACJA tożsamości kanonicznej dla rekordów
 * legacy (ID BRIDGE, strona zapisu).
 *
 * ★ POWÓD (pomiar 2026-09-05, `evidence/finance-gate-20260905/`): odczytowa
 * strona mostu (`legacyIdBridgeService.resolveLegacyFinanceArtifact`) czyta
 * `finance_artifact_aliases` i dla KAŻDEGO rekordu założonego przed wejściem
 * serwisów rejestrujących (`valuationRegistrationService`,
 * `statementPackRegistrationService`, …) zwraca `NOT_MIGRATED` — bo aliasy
 * pisze wyłącznie backfill WP-C03, którego nigdy nie uruchomiono na żadnym
 * żywym środowisku. Skutek widziany przez właściciela: 11 z 13 zatwierdzonych
 * ekranów Finansów nigdy się nie montuje (bramka renderuje `unresolvedFallback`
 * — stary widok), mimo że cała reszta łańcucha (flagi, trasy, komponenty,
 * pasek tożsamości, 5 mini-narzędzi) jest wpięta i działa.
 *
 * Ten moduł jest brakującą stroną ZAPISU: robi dla rekordu ZASTANEGO dokładnie
 * to samo, co serwis rejestrujący robi dla rekordu NOWEGO — zakłada
 * `finance_artifacts` + `finance_business_versions` + `finance_working_revisions`
 * (przez `createArtifact`) i wiąże je aliasem z wierszem legacy. NIE wymyśla
 * treści: nie kopiuje ani nie zgaduje danych finansowych — materializuje wyłącznie
 * TOŻSAMOŚĆ. Zawartość kanoniczna pozostaje pusta do czasu, aż użytkownik (albo
 * osobna migracja treści) ją wypełni, i każdy warsztat v3 pokazuje wtedy swój
 * własny, uczciwy stan pusty — nigdy dane udawane.
 *
 * Fail-closed: tożsamość powstaje TYLKO dla wiersza legacy, który naprawdę
 * istnieje w tej organizacji (`legacyRowExists`). Nieznane/obce id nigdy nie
 * dostaje artefaktu — zwracamy `NOT_MIGRATED` tak samo jak dotąd.
 *
 * Idempotencja (trzy warstwy, każda samodzielnie wystarczająca):
 *   1. `pg_advisory_xact_lock` na (org, tabela, id) — dwa równoległe otwarcia
 *      tego samego rekordu szeregują się, drugie widzi już gotowy alias.
 *   2. `uq_finance_artifacts_org_natural_key` — `natural_key` =
 *      `${legacyTable}:${legacyId}` (ta sama konwencja co
 *      `valuationRegistrationService`/backfill WP-C03), więc drugi artefakt dla
 *      tego samego wiersza legacy jest niemożliwy.
 *   3. `uq_finance_alias_legacy` + `ON CONFLICT DO NOTHING` na aliasie.
 *
 * ★ ALIAS Z KWARANTANNY NIE JEST NADPISYWANY: jeżeli backfill kiedyś świadomie
 * odrzucił ten wiersz (`QUARANTINE`/`EXCLUDE_WITH_REASON`), ta funkcja NIE
 * tworzy obejścia — zwraca ten sam `QUARANTINED`, co strona odczytu.
 */

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { createArtifact } from './artifactVersionService.js';
import type { ArtifactRow } from './artifactVersionService.js';
import {
  canonicalArtifactTypesForLegacyTable,
  defaultCanonicalArtifactTypeForLegacyTable,
  isLegacyFinanceTable,
  type LegacyBridgeResolution,
  type LegacyFinanceTable,
} from './legacyIdBridgeService.js';

/** Tabele legacy → kolumna id. Nazwy tabel są WYŁĄCZNIE z tej stałej (nigdy z wejścia użytkownika) — `legacyTable` jest wcześniej zawężony przez `isLegacyFinanceTable`. */
const LEGACY_ROW_SOURCES: Record<LegacyFinanceTable, string> = {
  financial_statement_packs: 'financial_statement_packs',
  financial_analyses: 'financial_analyses',
  financial_models: 'financial_models',
  valuations: 'valuations',
};

export interface EnsureLegacyIdentityParams {
  organizationId: string;
  userId: string;
  legacyTable: LegacyFinanceTable;
  legacyId: string;
  /**
   * Typ kanoniczny, którego oczekuje wołający ekran. Konieczny dla
   * `financial_models`, bo ta jedna tabela legacy karmi DWA różne warsztaty
   * (BASELINE_MODEL i PREDICTION_SCENARIO) — bez tego materializacja musiałaby
   * zgadywać, a zgadnięty typ kończy się `IDENTITY_MISMATCH` na ekranie.
   */
  expectedArtifactType?: ArtifactRow['artifact_type'] | null;
}

export type EnsureLegacyIdentityResult = LegacyBridgeResolution & {
  /** `true` gdy tożsamość powstała w TYM wywołaniu (a nie została odczytana jako już istniejąca) — używane przez backfill do raportu i przez testy idempotencji. */
  created?: boolean;
};

/** Czy wiersz legacy o tym id naprawdę istnieje w TEJ organizacji. Fail-closed: brak wiersza = nigdy nie tworzymy tożsamości. */
async function legacyRowExists(
  tx: { queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> },
  legacyTable: LegacyFinanceTable,
  legacyId: string,
  organizationId: string
): Promise<boolean> {
  const table = LEGACY_ROW_SOURCES[legacyTable];
  const row = await tx.queryOne<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = ? AND organization_id = ? LIMIT 1`,
    [legacyId, organizationId]
  );
  return Boolean(row);
}

interface AliasLookupRow {
  artifact_id: string;
  business_version_id: string | null;
  mapping_confidence:
    | 'AUTO_MIGRATE'
    | 'MIGRATE_WITH_WARNING'
    | 'QUARANTINE'
    | 'EXCLUDE_WITH_REASON';
  mapping_reason: string | null;
  artifact_type: ArtifactRow['artifact_type'] | null;
  resolved_business_version_id: string | null;
}

/**
 * Alias dla tego wiersza legacy, opcjonalnie zawężony do żądanego typu
 * kanonicznego. Zawężenie jest ISTOTNE dla `financial_models`: bez niego
 * otwarcie Predykcji zwróciłoby alias Baseline'u (albo odwrotnie) i ekran
 * padłby na `IDENTITY_MISMATCH` zamiast pokazać własny rekord.
 */
async function findAlias(
  tx: { queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> },
  params: {
    organizationId: string;
    legacyTable: LegacyFinanceTable;
    legacyId: string;
    expectedArtifactType?: ArtifactRow['artifact_type'] | null;
  }
): Promise<AliasLookupRow | null> {
  const typeFilter = params.expectedArtifactType ? `AND a.artifact_type = ?` : '';
  const args: unknown[] = [params.legacyTable, params.legacyId, params.organizationId];
  if (params.expectedArtifactType) args.push(params.expectedArtifactType);
  return tx.queryOne<AliasLookupRow>(
    `SELECT aa.artifact_id,
            aa.business_version_id,
            aa.mapping_confidence,
            aa.mapping_reason,
            a.artifact_type,
            COALESCE(
              aa.business_version_id,
              a.current_business_version_id,
              (SELECT bv.business_version_id FROM finance_business_versions bv
                WHERE bv.artifact_id = a.artifact_id AND bv.organization_id = a.organization_id
                ORDER BY bv.version_no DESC, bv.created_at DESC LIMIT 1)
            ) AS resolved_business_version_id
       FROM finance_artifact_aliases aa
       JOIN finance_artifacts a
         ON a.artifact_id = aa.artifact_id AND a.organization_id = aa.organization_id
      WHERE aa.legacy_table = ? AND aa.legacy_id = ? AND aa.organization_id = ?
        ${typeFilter}
      ORDER BY aa.created_at DESC
      LIMIT 1`,
    args
  );
}

function aliasToResolution(alias: AliasLookupRow): LegacyBridgeResolution {
  if (
    alias.mapping_confidence === 'QUARANTINE' ||
    alias.mapping_confidence === 'EXCLUDE_WITH_REASON'
  ) {
    return {
      status: 'QUARANTINED',
      mappingConfidence: alias.mapping_confidence,
      reason: alias.mapping_reason,
    };
  }
  return {
    status: 'RESOLVED',
    artifactId: alias.artifact_id,
    businessVersionId: alias.resolved_business_version_id,
    artifactType: alias.artifact_type as ArtifactRow['artifact_type'],
    mappingConfidence: alias.mapping_confidence,
  };
}

/**
 * Zakłada (albo odczytuje istniejącą) tożsamość kanoniczną wiersza legacy.
 *
 * Zwraca DOKŁADNIE ten sam kształt, co strona odczytu mostu, żeby wołający
 * (trasa HTTP, hook front-endu, backfill) nie musiał znać dwóch kontraktów.
 */
export async function ensureLegacyFinanceArtifactIdentity(
  params: EnsureLegacyIdentityParams
): Promise<EnsureLegacyIdentityResult> {
  if (!isLegacyFinanceTable(params.legacyTable)) {
    return { status: 'NOT_MIGRATED' };
  }
  const legacyId = params.legacyId.trim();
  if (!legacyId) return { status: 'NOT_MIGRATED' };

  const allowedTypes = canonicalArtifactTypesForLegacyTable(params.legacyTable);
  const expectedArtifactType =
    params.expectedArtifactType && allowedTypes.has(params.expectedArtifactType)
      ? params.expectedArtifactType
      : null;
  const artifactType =
    expectedArtifactType ?? defaultCanonicalArtifactTypeForLegacyTable(params.legacyTable);

  return withPinnedPostgresTransaction(async (tx) => {
    // Serializacja równoległych otwarć tego samego rekordu (warstwa 1 idempotencji).
    await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, [
      `${params.organizationId}:${params.legacyTable}:${legacyId}:LEGACY_IDENTITY`,
    ]);

    const existing = await findAlias(tx, {
      organizationId: params.organizationId,
      legacyTable: params.legacyTable,
      legacyId,
      expectedArtifactType,
    });
    if (existing) return { ...aliasToResolution(existing), created: false };

    if (!(await legacyRowExists(tx, params.legacyTable, legacyId, params.organizationId))) {
      // Nieznane id albo id z innej organizacji — nigdy nie zakładamy tożsamości
      // dla czegoś, czego nie ma. Ten sam wynik co dotąd.
      return { status: 'NOT_MIGRATED' };
    }

    const naturalKey = `${params.legacyTable}:${legacyId}`;
    const artifact = await tx.queryOne<ArtifactRow>(
      `SELECT * FROM finance_artifacts
        WHERE organization_id = ? AND natural_key = ? AND artifact_type = ?`,
      [params.organizationId, naturalKey, artifactType]
    );

    let artifactId: string;
    let businessVersionId: string | null;
    let created = false;
    if (artifact) {
      // Artefakt istnieje (np. z wcześniejszego, przerwanego przebiegu backfillu),
      // brakuje tylko aliasu — dowiązujemy, nie duplikujemy.
      artifactId = artifact.artifact_id;
      businessVersionId =
        artifact.current_business_version_id ??
        (
          await tx.queryOne<{ business_version_id: string }>(
            `SELECT business_version_id FROM finance_business_versions
              WHERE artifact_id = ? AND organization_id = ?
              ORDER BY version_no DESC, created_at DESC LIMIT 1`,
            [artifactId, params.organizationId]
          )
        )?.business_version_id ?? null;
    } else {
      const createdArtifact = await createArtifact({
        organizationId: params.organizationId,
        artifactType,
        naturalKey:
          // `financial_models` karmi dwa typy — natural_key musi je rozróżniać,
          // inaczej drugi warsztat wpada w unikat (organization_id, natural_key).
          allowedTypes.size > 1 ? `${naturalKey}:${artifactType}` : naturalKey,
        createdBy: params.userId,
      });
      artifactId = createdArtifact.artifact.artifact_id;
      businessVersionId = createdArtifact.businessVersion.business_version_id;
      created = true;
    }

    // ★ `finance_artifacts.current_business_version_id` NIGDY nie było ustawiane
    // przez kod produkcyjny (`createArtifact` zostawia NULL — patrz jego własny
    // komentarz oraz `GET /artifacts/:artifactId`). Skutek zmierzony 2026-09-05:
    // `valuationLegacySuccessorService.pinnedIdentity` wymaga
    // `a.current_business_version_id = aa.business_version_id`, więc Wycena
    // odpowiadała 409 `LEGACY_IDENTITY_UNMAPPED` NAWET dla poprawnie zaliasowanego
    // rekordu. Uzupełniamy TYLKO gdy kolumna jest pusta — nigdy nie nadpisujemy
    // wartości, którą ktoś inny już ustawił.
    if (businessVersionId) {
      await tx.queryRun(
        `UPDATE finance_artifacts
            SET current_business_version_id = ?
          WHERE artifact_id = ? AND organization_id = ? AND current_business_version_id IS NULL`,
        [businessVersionId, artifactId, params.organizationId]
      );
    }

    await tx.queryRun(
      `INSERT INTO finance_artifact_aliases
         (legacy_table, legacy_id, legacy_version, artifact_id, organization_id,
          business_version_id, mapping_confidence, mapping_reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'AUTO_MIGRATE', ?, ?)
       ON CONFLICT (legacy_table, legacy_id, legacy_version) DO NOTHING`,
      [
        params.legacyTable,
        legacyId,
        // Pusty string (nie NULL) jako sentinel „brak wersji" — ta sama konwencja
        // co backfill WP-C03; NULL w Postgresie omija UNIQUE i psuje idempotencję.
        // Dla `financial_models` typ kanoniczny JEST rozróżnikiem wersji, bo jeden
        // wiersz legacy może karmić dwa różne warsztaty.
        allowedTypes.size > 1 ? artifactType : '',
        artifactId,
        params.organizationId,
        businessVersionId,
        `materialized_on_open:${artifactType}`,
        params.userId,
      ]
    );

    const after = await findAlias(tx, {
      organizationId: params.organizationId,
      legacyTable: params.legacyTable,
      legacyId,
      expectedArtifactType: artifactType,
    });
    if (!after) return { status: 'NOT_MIGRATED' };
    return { ...aliasToResolution(after), created };
  });
}
