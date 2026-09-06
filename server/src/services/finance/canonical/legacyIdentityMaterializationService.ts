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
 * istnieje w tej organizacji (`readLegacyRow`). Nieznane/obce id nigdy nie
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
import type { PinnedTransactionClient } from '../../../database/PostgresDatabase.js';
import { createArtifact } from './artifactVersionService.js';
import type { ArtifactRow } from './artifactVersionService.js';
import {
  canonicalArtifactTypesForLegacyTable,
  defaultCanonicalArtifactTypeForLegacyTable,
  isLegacyFinanceTable,
  type LegacyBridgeResolution,
  type LegacyFinanceTable,
} from './legacyIdBridgeService.js';

/**
 * Tabele legacy → wyrażenie SQL z NAZWĄ rekordu, jaką widzi użytkownik na
 * liście. Nazwy tabel i kolumn są WYŁĄCZNIE z tej stałej (nigdy z wejścia
 * użytkownika) — `legacyTable` jest wcześniej zawężony przez
 * `isLegacyFinanceTable`.
 *
 * ★ Po co nazwa: `finance_artifacts.natural_key` pełni w tym kodzie rolę
 * NAZWY artefaktu, a nie tylko klucza (patrz `renameFinanceArtifact` —
 * zmiana nazwy w pasku zapisuje właśnie `natural_key`, a
 * `AnalysisWorkspace` wyświetla `artifact.naturalKey` jako tytuł). Gdyby
 * materializacja wstawiała tu `financial_analyses:<uuid>`, właściciel
 * zobaczyłby w nagłówku surowy ciąg maszynowy zamiast nazwy swojego rekordu
 * — zmierzone na zrzucie `evidence/finance-gate-20260905/05-po-analiza.png`
 * w pierwszym podejściu.
 */
const LEGACY_ROW_SOURCES: Record<LegacyFinanceTable, { table: string; nameSql: string }> = {
  financial_statement_packs: {
    table: 'financial_statement_packs',
    // Ta tabela nie ma kolumny z nazwą — składamy etykietę z pól, które
    // użytkownik i tak widzi na liście sprawozdań (podmiot + okres).
    nameSql: `COALESCE(NULLIF(TRIM(COALESCE(entity_name, '')), ''), 'Sprawozdanie') || COALESCE(' ' || NULLIF(TRIM(COALESCE(period_label, '')), ''), '')`,
  },
  financial_analyses: { table: 'financial_analyses', nameSql: 'title' },
  financial_models: { table: 'financial_models', nameSql: 'name' },
  valuations: { table: 'valuations', nameSql: 'title' },
};

/** Sufiks odróżniający dwa artefakty kanoniczne wywodzące się z JEDNEGO wiersza `financial_models` (Baseline i Predykcja) — etykieta, nie zmyślona treść. */
const ARTIFACT_TYPE_NAME_SUFFIX: Partial<Record<string, string>> = {
  PREDICTION_SCENARIO: ' (predykcja)',
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

/** Wiersz legacy o tym id w TEJ organizacji (z nazwą widoczną dla użytkownika) albo `null`. Fail-closed: brak wiersza = nigdy nie tworzymy tożsamości. */
async function readLegacyRow(
  tx: PinnedTransactionClient,
  legacyTable: LegacyFinanceTable,
  legacyId: string,
  organizationId: string
): Promise<{ displayName: string | null } | null> {
  const source = LEGACY_ROW_SOURCES[legacyTable];
  const row = await tx.queryOne<{ id: string; display_name: string | null }>(
    `SELECT id, ${source.nameSql} AS display_name
       FROM ${source.table}
      WHERE id = ? AND organization_id = ? LIMIT 1`,
    [legacyId, organizationId]
  );
  if (!row) return null;
  const displayName = String(row.display_name ?? '').trim();
  return { displayName: displayName || null };
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
  tx: PinnedTransactionClient,
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
 * ★ ANTY-DUPLIKAT DLA SPRAWOZDAŃ (audyt FIN 2026-09-06, defekt #3 — BLOKER,
 * zrzut `03-sprawozdanie-karta.png`).
 *
 * Zmierzony przebieg: właściciel klika „Otwórz" na wierszu CD PROJEKT
 * (`financial_statement_packs.cdp2025-pack-33d3c3b64a`). Aliasu nie ma, więc
 * materializacja szuka artefaktu WYŁĄCZNIE po `natural_key` zbudowanym z nazwy
 * wiersza legacy („Grupa Kapitałowa CD PROJEKT FY2024"). Prawdziwy pakiet
 * kanoniczny z 238 liniami istnieje, ale nosi klucz seeda
 * (`seed:finance-cdprojekt-2025:<org>:GRUPA_KAPITALOWA_CD_PROJEKT`) — nie pasuje,
 * więc powstaje DRUGI, PUSTY artefakt `STATEMENT_PACK` i to on dostaje alias.
 * Właściciel widzi „Brak linii sprawozdania dla tej wersji." zamiast swojego
 * sprawozdania, a w bazie zostaje rekord-widmo.
 *
 * `natural_key` jest kluczem NAZWY, a nie kluczem ŹRÓDŁA — dlatego drugie
 * kryterium dopasowania idzie po treści: ten sam podmiot (entity) i okresy
 * pokrywające okres pakietu legacy. Warunek `HAVING count(l.id) > 0` jest tu
 * istotny: wiążemy się TYLKO z pakietem, który naprawdę ma linie — pusty
 * artefakt nie jest lepszy od nowego i wiązanie się z nim ukryłoby problem.
 *
 * Zwraca `null`, gdy nic nie pasuje — wołający NIE tworzy wtedy pustego
 * pakietu (patrz `ensureLegacyFinanceArtifactIdentity`), tylko zwraca
 * `NOT_MIGRATED`, co bramka `FinanceLegacyBridgeGate` renderuje jako uczciwy
 * polski komunikat „Ten rekord jeszcze nie ma odpowiednika w nowym systemie".
 */
async function findCanonicalStatementPackBySource(
  tx: PinnedTransactionClient,
  organizationId: string,
  legacyPackId: string
): Promise<{ artifactId: string; businessVersionId: string } | null> {
  const legacyPack = await tx.queryOne<{
    entity_name: string | null;
    period_start: string;
    period_end: string;
  }>(
    `SELECT entity_name, period_start, period_end
       FROM financial_statement_packs
      WHERE id = ? AND organization_id = ? LIMIT 1`,
    [legacyPackId, organizationId]
  );
  if (!legacyPack) return null;
  const entityName = String(legacyPack.entity_name ?? '').trim();
  if (!entityName) return null;

  const match = await tx.queryOne<{ artifact_id: string; business_version_id: string }>(
    `SELECT a.artifact_id, bv.business_version_id
       FROM finance_artifacts a
       JOIN finance_business_versions bv
         ON bv.artifact_id = a.artifact_id AND bv.organization_id = a.organization_id
       JOIN finance_stmt_lines l
         ON l.business_version_id = bv.business_version_id AND l.organization_id = a.organization_id
       JOIN finance_stmt_entities e ON e.id = l.entity_id
       JOIN finance_stmt_periods p ON p.period_id = l.period_id
      WHERE a.organization_id = ?
        AND a.artifact_type = 'STATEMENT_PACK'
        AND a.archived_at IS NULL
        AND (
          LOWER(TRIM(COALESCE(e.legal_name, ''))) = LOWER(?)
          OR e.entity_code = UPPER(REPLACE(?, ' ', '_'))
        )
      GROUP BY a.artifact_id, bv.business_version_id, bv.version_no
     HAVING COUNT(l.id) > 0
        AND MIN(p.period_start) <= ?::date
        AND MAX(p.period_end) >= ?::date
      ORDER BY COUNT(l.id) DESC, bv.version_no DESC
      LIMIT 1`,
    [
      organizationId,
      entityName,
      entityName,
      legacyPack.period_start,
      legacyPack.period_end,
    ]
  );
  return match
    ? { artifactId: match.artifact_id, businessVersionId: match.business_version_id }
    : null;
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

    const legacyRow = await readLegacyRow(
      tx,
      params.legacyTable,
      legacyId,
      params.organizationId
    );
    if (!legacyRow) {
      // Nieznane id albo id z innej organizacji — nigdy nie zakładamy tożsamości
      // dla czegoś, czego nie ma. Ten sam wynik co dotąd.
      return { status: 'NOT_MIGRATED' };
    }

    // Nazwa artefaktu = nazwa rekordu, którą właściciel widzi na liście. Ciąg
    // techniczny `<tabela>:<id>` służy TYLKO jako ostatnia deska ratunku dla
    // rekordu bez nazwy — nigdy jako domyślny tytuł.
    const fallbackKey = `${params.legacyTable}:${legacyId}`;
    const preferredKey =
      (legacyRow.displayName ?? '') +
      (ARTIFACT_TYPE_NAME_SUFFIX[artifactType] ?? '');
    const naturalKeyCandidates = [
      legacyRow.displayName ? preferredKey : null,
      // Kolizja nazw w organizacji (dwa rekordy o tym samym tytule) nie może
      // wywrócić otwierania ekranu — rozstrzygamy krótkim, stabilnym sufiksem id.
      legacyRow.displayName ? `${preferredKey} · ${legacyId.slice(0, 8)}` : null,
      allowedTypes.size > 1 ? `${fallbackKey}:${artifactType}` : fallbackKey,
    ].filter((value): value is string => Boolean(value));

    let artifactId: string | null = null;
    let businessVersionId: string | null = null;
    let created = false;

    // ★ Sprawozdania: NAJPIERW dopasowanie po ŹRÓDLE (podmiot + okresy), dopiero
    // potem po nazwie. Odwrotna kolejność dawała rekord-widmo — patrz nagłówek
    // `findCanonicalStatementPackBySource`.
    if (artifactType === 'STATEMENT_PACK' && params.legacyTable === 'financial_statement_packs') {
      const bySource = await findCanonicalStatementPackBySource(
        tx,
        params.organizationId,
        legacyId
      );
      if (bySource) {
        artifactId = bySource.artifactId;
        businessVersionId = bySource.businessVersionId;
      }
    }

    // Artefakt mógł już powstać (przerwany przebieg backfillu) i brakuje tylko
    // aliasu — wtedy dowiązujemy, nie duplikujemy.
    const artifact = artifactId ? null : await tx.queryOne<ArtifactRow>(
      `SELECT * FROM finance_artifacts
        WHERE organization_id = ? AND artifact_type = ? AND natural_key = ANY(?)`,
      [params.organizationId, artifactType, naturalKeyCandidates]
    );
    if (artifact) {
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
    } else if (!artifactId) {
      // ★ ZAKAZ PUSTEGO SPRAWOZDANIA (audyt FIN 2026-09-06, defekt #3): pakiet
      // sprawozdania bierze treść WYŁĄCZNIE z importu — pusta powłoka nigdy nie
      // jest tym, czego szuka klikający „Otwórz". Skoro ani alias, ani
      // dopasowanie po źródle, ani po nazwie nic nie znalazło, uczciwą
      // odpowiedzią jest `NOT_MIGRATED` (bramka pokazuje polski komunikat), a
      // NIE nowy, pusty artefakt zaśmiecający listę i wyszukiwanie.
      // Pozostałe typy (Baseline/Predykcja/Wycena) tworzy się właśnie jako
      // pustą powłokę do wypełnienia — dla nich zachowanie bez zmian.
      if (artifactType === 'STATEMENT_PACK') {
        return { status: 'NOT_MIGRATED' };
      }
      for (const candidate of naturalKeyCandidates) {
        const taken = await tx.queryOne<{ artifact_id: string }>(
          `SELECT artifact_id FROM finance_artifacts
            WHERE organization_id = ? AND natural_key = ?`,
          [params.organizationId, candidate]
        );
        if (taken) continue;
        const createdArtifact = await createArtifact({
          organizationId: params.organizationId,
          artifactType,
          naturalKey: candidate,
          createdBy: params.userId,
        });
        artifactId = createdArtifact.artifact.artifact_id;
        businessVersionId = createdArtifact.businessVersion.business_version_id;
        created = true;
        break;
      }
    }
    if (!artifactId) {
      // Wszystkie kandydatury nazw są zajęte przez INNE artefakty — nie
      // zgadujemy kolejnej i nie podpinamy się pod cudzy artefakt.
      return { status: 'NOT_MIGRATED' };
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
