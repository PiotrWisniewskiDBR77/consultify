import type { Pool } from 'pg';

/**
 * P.9 (wariant C `E-O4`) — UDOSTĘPNIENIE istniejącej mechaniki, nie budowa drugiej.
 *
 * Wkład liczbowy z zamrożoną bazą żyje w `rvn_kpi_initiative_impacts`
 * (server/migrations/20260813_rvn_kpi_initiative_impacts.sql:16-62). Realizacja NIE
 * kopiuje tej tabeli, nie zmienia jej migracji i nie dotyka `server/src/services/results/**`.
 * Czyta ją czystym SELECT-em z filtrem `organization_id=$1`.
 *
 * Dlaczego to jest legalne bez seamu w Results:
 * 1. Tabela ma DEDYKOWANY indeks pod dokładnie ten odczyt:
 *    `idx_rvn_kpi_initiative_impacts_initiative ON (organization_id, initiative_id)`
 *    (tamże :57-58).
 * 2. Projekt tabeli ANTYCYPUJE ten odczyt — komentarz :9-14: „initiative_id is exposed
 *    without joining to Initiative content (the Initiatives module guards its own content
 *    on its own read path)". Ten czytnik NIE dołącza treści inicjatywy; bierze wyłącznie
 *    identyfikator i liczby wkładu.
 * 3. Tenant jest własnym filtrem tabeli (`organization_id` jest jej kolumną, NOT NULL),
 *    a nie doklejonym po fakcie — ten sam wzorzec, którym Realizacja czyta trzy tabele
 *    spoza rodziny `ie_*` w reportClassificationReadModel.ts:26-31.
 *
 * Stan „brak zatwierdzonego wkładu" to `numericContribution: null` + stan `NONE`.
 * NIGDY `0` — zero jest liczbą, a brak deklaracji liczbą nie jest.
 *
 * WSPÓŁISTNIENIE Z KLASĄ 3-STOPNIOWĄ (P.9 pkt 4 — rozstrzygnięcie przyjęte):
 * wkład liczbowy ma PIERWSZEŃSTWO W PREZENTACJI (`presentationPrecedence`), klasa
 * ZOSTAJE jako deklaracja właściciela celu i jest widoczna w tej samej kopercie.
 * Żadne z nich nie kasuje drugiego — to są dwa różne akty: klasa jest deklaracją
 * ważności, wkład liczbowy jest obietnicą w jednostce miary z zamrożoną bazą.
 */

export type NumericContributionState = 'COMMITTED' | 'NONE';

type ImpactRow = {
  goal_id: string;
  initiative_id: string;
  contribution_class: string | null;
  impact_id: string | null;
  kpi_id: string | null;
  expected_contribution_value: string | null;
  expected_contribution_direction: string | null;
  row_version: number | null;
};

export class NumericContributionReadModel {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async read(organizationId: string) {
    const result = await this.pool.query<ImpactRow>(
      `SELECT gil.goal_id,
              gil.initiative_id,
              gil.contribution_class,
              imp.impact_id::text AS impact_id,
              imp.kpi_id::text AS kpi_id,
              imp.expected_contribution_value::text AS expected_contribution_value,
              imp.expected_contribution_direction,
              imp.row_version
         FROM goal_initiative_links gil
         LEFT JOIN rvn_kpi_initiative_impacts imp
           ON imp.organization_id = $1
          AND imp.initiative_id = gil.initiative_id
          AND imp.status = 'committed'
        WHERE gil.organization_id = $1
        ORDER BY gil.goal_id, gil.initiative_id, imp.impact_id`,
      [organizationId]
    );

    const pairs = new Map<
      string,
      {
        goalId: string;
        initiativeId: string;
        contributionClass: string | null;
        numericContributions: Array<{
          impactId: string;
          kpiId: string;
          expectedContributionValue: string;
          expectedContributionDirection: string | null;
          rowVersion: number;
          sourceRef: string;
        }>;
      }
    >();

    for (const row of result.rows) {
      const key = `${row.goal_id}::${row.initiative_id}`;
      const entry = pairs.get(key) ?? {
        goalId: row.goal_id,
        initiativeId: row.initiative_id,
        contributionClass: row.contribution_class,
        numericContributions: [],
      };
      if (row.impact_id) {
        entry.numericContributions.push({
          impactId: row.impact_id,
          kpiId: row.kpi_id as string,
          // Wartość NUMERIC przechodzi jako tekst — nie zaokrąglamy jej w drodze
          // i nie zamieniamy braku na 0.
          expectedContributionValue: row.expected_contribution_value as string,
          expectedContributionDirection: row.expected_contribution_direction,
          rowVersion: row.row_version as number,
          // ODSYŁACZ wymagany przez P.9 pkt 2 — wskazuje nośnik, nie kopiuje go.
          sourceRef: `rvn_kpi_initiative_impacts:${row.impact_id}`,
        });
      }
      pairs.set(key, entry);
    }

    return [...pairs.values()].map((entry) => {
      const state: NumericContributionState =
        entry.numericContributions.length > 0 ? 'COMMITTED' : 'NONE';
      return {
        ...entry,
        numericContributionState: state,
        presentationPrecedence:
          state === 'COMMITTED'
            ? ('NUMERIC_CONTRIBUTION' as const)
            : entry.contributionClass
              ? ('CONTRIBUTION_CLASS' as const)
              : ('NONE' as const),
      };
    });
  }
}
