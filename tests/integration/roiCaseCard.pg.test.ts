/**
 * ROI (P7K C) — karta analizy CZYTANA Z REALNEGO POSTGRESA.
 *
 * Co ten test naprawdę udowadnia (a czego nie udowodni żaden test na atrapie):
 *  1. migracja `20260906_rvn_roi_card_three_parts.sql` działa na bazie od zera
 *     (uruchamiana tu wprost, na świeżym schemacie),
 *  2. `listRoiRegistryRows` i `getRoiCaseCard` wykonują SWÓJ SQL — z LATERAL-ami,
 *     agregatami i `NUMERIC`-ami, które `pg` zwraca jako NAPISY (gdyby konwersja
 *     zniknęła, sumy byłyby konkatenacją, a nie liczbą),
 *  3. wskaźniki z karty ZGADZAJĄ SIĘ z tym, co zapisał silnik — czyli karta nie
 *     opowiada innej arytmetyki niż przebieg kalkulacji,
 *  4. brak danych wraca jako `null` („—" w UI), a nie 0.
 *
 * OPT-IN. Wymaga jednorazowego Postgresa; NIGDY nie kierować na demo ani
 * produkcję — test zakłada i kasuje własne wiersze.
 *
 *   docker run -d --name roi-p7kc-pg -e POSTGRES_PASSWORD=roi -e POSTGRES_USER=roi \
 *     -e POSTGRES_DB=roi -p 127.0.0.1:56123:5432 pgvector/pgvector:pg17
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 \
 *     DATABASE_URL=postgresql://roi:roi@127.0.0.1:56123/roi \
 *     ROI_CARD_PG_URL=postgresql://roi:roi@127.0.0.1:56123/roi \
 *     npx vitest run tests/integration/roiCaseCard.pg.test.ts --retry=0
 *
 * `--retry=0` nie jest ozdobą: powtórka maskuje test, który leczy się skutkiem
 * własnego pierwszego przebiegu (bezpiecznik Z29).
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PG_URL = process.env.ROI_CARD_PG_URL;
const describeIfPg = PG_URL ? describe : describe.skip;

/** Organizacja i sprawa założone przez `server/scripts/seed-wyniki-dbr77.ts`. */
const ORG_NEEDLE = 'DBR77';
const CASE_TITLE = 'Robotyzacja gniazda spawalniczego';
const EMPTY_CASE_TITLE = 'Automatyzacja magazynu WIP';

let client: Client;
let organizationId: string;
let ownerUserId: string;
let caseId: string;
let emptyCaseId: string;

describeIfPg('ROI (P7K C) — karta analizy na realnym Postgresie', () => {
  beforeAll(async () => {
    client = new Client({ connectionString: PG_URL });
    await client.connect();

    const org = await client.query<{ id: string }>(
      `SELECT id FROM organizations WHERE name = $1 OR id = $1 LIMIT 1`,
      [ORG_NEEDLE]
    );
    organizationId = org.rows[0]!.id;

    const cases = await client.query<{ case_id: string; title: string; owner_user_id: string }>(
      `SELECT case_id, title, owner_user_id FROM rvn_roi_cases WHERE organization_id = $1`,
      [organizationId]
    );
    caseId = cases.rows.find((r) => r.title === CASE_TITLE)!.case_id;
    emptyCaseId = cases.rows.find((r) => r.title === EMPTY_CASE_TITLE)!.case_id;
    ownerUserId = cases.rows.find((r) => r.title === CASE_TITLE)!.owner_user_id;
  }, 60_000);

  afterAll(async () => {
    await client?.end();
  });

  it('migracja dołożyła WSZYSTKIE pola karty — na bazie zbudowanej od zera', async () => {
    const cols = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_name IN ('rvn_roi_cases','rvn_roi_benefit_lines','rvn_roi_post_investment_reviews')`
    );
    const has = (t: string, c: string) =>
      cols.rows.some((r) => r.table_name === t && r.column_name === c);
    for (const c of [
      'subject_type',
      'option_variant',
      'option_variant_label',
      'investment_recommendation',
      'recommendation_condition',
      'problem_statement',
      'scope_summary',
      'bau_option_label',
    ]) {
      expect(has('rvn_roi_cases', c), `rvn_roi_cases.${c}`).toBe(true);
    }
    expect(has('rvn_roi_benefit_lines', 'benefit_class')).toBe(true);
    expect(has('rvn_roi_benefit_lines', 'kpi_chain_note')).toBe(true);
    expect(has('rvn_roi_post_investment_reviews', 'milestone_months')).toBe(true);
    expect(has('rvn_roi_post_investment_reviews', 'realized_roi_pct')).toBe(true);

    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_name IN ('rvn_roi_assumption_outcomes','rvn_roi_risks')`
    );
    expect(tables.rows.map((r) => r.table_name).sort()).toEqual([
      'rvn_roi_assumption_outcomes',
      'rvn_roi_risks',
    ]);
  });

  it('rejestr analiz liczy CAPEX i roczną korzyść AGREGATEM, a nie N+1 wywołaniami', async () => {
    const { listRoiRegistryRows } = await import(
      '../../server/src/services/resultsVnext/roi/card/roiCaseCardRepository.js'
    );
    const rows = await listRoiRegistryRows({ userId: ownerUserId, organizationId });
    expect(rows.length).toBeGreaterThanOrEqual(3);

    const robot = rows.find((r) => r.caseId === caseId)!;
    // Sumy MUSZĄ być liczbami. Gdyby konwersja NUMERIC→number zniknęła,
    // 909000 + 91000 dałoby napis "90900091000", a nie 1 000 000.
    expect(typeof robot.capex).toBe('number');
    expect(robot.capex).toBe(1_000_000);
    expect(robot.annualNetBenefit).toBe(400_000);
    expect(robot.horizonYears).toBe(5);
    expect(robot.roiPct).toBeCloseTo(100, 6);
    expect(robot.paybackYears).toBeCloseTo(2.5, 6);
    expect(robot.recommendation).toBe('conditional_go');
    expect(robot.subjectType).toBe('Robotyzacja');
    expect(robot.optionVariant).toBe(2);
  });

  it('FAZA wiersza jest wyprowadzona z FAKTÓW, nie ze statusu cyklu życia', async () => {
    const { listRoiRegistryRows } = await import(
      '../../server/src/services/resultsVnext/roi/card/roiCaseCardRepository.js'
    );
    const rows = await listRoiRegistryRows({ userId: ownerUserId, organizationId });
    // Analiza z przeglądem PIR i wariancjami = Realizacja.
    expect(rows.find((r) => r.caseId === caseId)!.phase).toBe('realization');
    // Analiza bez pozycji i bez przebiegu = Założenia.
    expect(rows.find((r) => r.caseId === emptyCaseId)!.phase).toBe('assumptions');
  });

  it('analiza bez modelu ma same null — „—" w UI, nigdy 0', async () => {
    const { listRoiRegistryRows } = await import(
      '../../server/src/services/resultsVnext/roi/card/roiCaseCardRepository.js'
    );
    const rows = await listRoiRegistryRows({ userId: ownerUserId, organizationId });
    const wip = rows.find((r) => r.caseId === emptyCaseId)!;
    expect(wip.capex).toBeNull();
    expect(wip.annualNetBenefit).toBeNull();
    expect(wip.roiPct).toBeNull();
    expect(wip.paybackYears).toBeNull();
    expect(wip.npv).toBeNull();
    expect(wip.recommendation).toBeNull();
  });

  it('karta niesie TRZY części i zgadza się z liczbami zapisanymi przez silnik', async () => {
    const { getRoiCaseCard } = await import(
      '../../server/src/services/resultsVnext/roi/card/roiCaseCardRepository.js'
    );
    const card = await getRoiCaseCard({ userId: ownerUserId, organizationId, caseId });
    expect(card).not.toBeNull();
    const c = card!;

    // — część 1: Założenia —
    expect(c.problemStatement).toContain('gniazda');
    expect(c.bauOptionLabel).toContain('Wariant 0');
    expect(c.costLines.length).toBeGreaterThanOrEqual(2);
    expect(c.assumptions.length).toBeGreaterThanOrEqual(6);
    expect(c.risks.length).toBeGreaterThanOrEqual(4);
    // Klasy korzyści z metodyki §33-35, w tym dwie ŚWIADOMIE niemonetyzowane.
    const classes = new Set(c.benefitLines.map((b) => b.benefitClass));
    expect(classes.has('hard')).toBe(true);
    expect(classes.has('avoided')).toBe(true);
    expect(classes.has('soft')).toBe(true);
    expect(classes.has('strategic')).toBe(true);
    const soft = c.benefitLines.find((b) => b.benefitClass === 'soft')!;
    expect(soft.isFinancial).toBe(false);
    expect(soft.amount).toBeNull();

    // — część 2: Wyliczenia —
    expect(c.storedRun).not.toBeNull();
    expect(c.storedRun!.npv).toBeCloseTo(516_315, 0);
    expect(c.indicators.capex).toBe(1_000_000);
    expect(c.indicators.annualNetBenefit).toBe(400_000);
    // Karta liczy NPV z tych samych wejść co silnik — więc musi trafić w to samo.
    expect(c.indicators.npv as number).toBeCloseTo(c.storedRun!.npv as number, 0);
    expect(c.cashFlow).toHaveLength(6);
    expect(c.cashFlow[0]!.net).toBe(-1_000_000);
    expect(c.sensitivity.length).toBeGreaterThanOrEqual(3);
    expect(c.scenarios.length).toBeGreaterThanOrEqual(2);
    // Scenariusz bez własnego przebiegu NIE dostaje liczb wariantu bazowego.
    for (const s of c.scenarios) {
      expect(s.hasRun).toBe(false);
      expect(s.npv).toBeNull();
    }

    // — część 3: Realizacja —
    expect(c.variances.length).toBe(4);
    const capexVar = c.variances.find((v) => v.metric === 'CAPEX')!;
    expect(capexVar.expected).toBe(1_000_000);
    expect(capexVar.actual).toBe(1_080_000);
    expect(capexVar.varianceAmount).toBe(80_000);
    expect(c.pirs).toHaveLength(1);
    expect(c.pirs[0]!.milestoneMonths).toBe(6);
    expect(c.pirs[0]!.realizedRoiPct).toBeCloseTo(44.4, 1);
    const verdicts = c.assumptions.filter((a) => a.verdict !== null).map((a) => a.verdict);
    expect(verdicts.sort()).toEqual(['confirmed', 'partially_confirmed', 'refuted']);

    expect(c.phase).toBe('realization');
  });

  it('analiza z polityką „bez NPV/IRR" NIE dostaje policzonego przez nas NPV', async () => {
    const { getRoiCaseCard } = await import(
      '../../server/src/services/resultsVnext/roi/card/roiCaseCardRepository.js'
    );
    const wizja = await client.query<{ case_id: string }>(
      `SELECT case_id FROM rvn_roi_cases WHERE organization_id = $1 AND title = $2`,
      [organizationId, 'System wizyjny kontroli jakości']
    );
    const card = (await getRoiCaseCard({
      userId: ownerUserId,
      organizationId,
      caseId: wizja.rows[0]!.case_id,
    }))!;
    expect(card.storedRun!.npv).toBeNull();
    expect(card.storedRun!.irrStatus).toBe('not_required_by_policy');
    // Sedno: nie podstawiamy własnego NPV pod politykę, która go nie zamawiała.
    expect(card.indicators.npv).toBeNull();
    expect(card.indicators.profitabilityIndex).toBeNull();
    // ROI i Payback, których polityka WYMAGA, są policzone.
    expect(card.storedRun!.roiPct).toBeCloseTo(15.16, 1);
    expect(card.storedRun!.paybackPeriods).toBeCloseTo(2.6, 1);
  });

  it('sprawa spoza organizacji jest nieodróżnialna od nieistniejącej (null, nie wyciek)', async () => {
    const { getRoiCaseCard } = await import(
      '../../server/src/services/resultsVnext/roi/card/roiCaseCardRepository.js'
    );
    const obca = await getRoiCaseCard({
      userId: ownerUserId,
      organizationId: 'organizacja-ktora-nie-istnieje',
      caseId,
    });
    expect(obca).toBeNull();
  });
});
