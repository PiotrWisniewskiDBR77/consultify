#!/usr/bin/env tsx
/**
 * Wave 3 local-only owner-review fixtures for Dynamic SWOT.
 *
 * Creates a credible in-progress journey and an approved cold-readback state.
 * Existing fixture rows are never overwritten, so Piotr's review progress is
 * preserved across reruns. The script refuses every non-loopback database.
 */
import pg from 'pg';

const CONFIRM_ENV = 'SEED_WAVE3_TOOLS_OWNER_REVIEW';
const databaseUrl = process.env.DATABASE_URL ?? '';
const organizationId =
  process.env.WAVE3_ORGANIZATION_ID ?? 'fd1827ef-7e39-4c64-bf78-26a2c514adf1';
const ownerId = process.env.WAVE3_OWNER_ID ?? '0c13d1af-af67-4683-ad01-a3ea6fda2340';

if (process.env[CONFIRM_ENV] !== 'YES') {
  throw new Error(`${CONFIRM_ENV}=YES is required`);
}
if (!/^postgres(?:ql)?:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl)) {
  throw new Error('Wave 3 Tools fixture requires loopback PostgreSQL');
}

const ids = {
  guidedSession: 'wave3-tools-owner-guided-v1',
  approvedSession: 'wave3-tools-owner-approved-v1',
} as const;

const acceptedItems = [
  {
    id: 's1',
    text: 'Doświadczony zespół konsultingowy rozumie proces klienta od sprzedaży do uruchomienia.',
    quadrant: 'strengths',
    impact: 'high',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
    evidence: 'Trzy zakończone wdrożenia prowadzone przez ten sam zespół sprzedażowo-dostawczy.',
  },
  {
    id: 's2',
    text: 'Zespół potrafi szybko przygotować dopasowany warsztat diagnostyczny.',
    quadrant: 'strengths',
    impact: 'medium',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
    evidence: 'Gotowy scenariusz warsztatu i biblioteka pytań branżowych.',
  },
  {
    id: 'w1',
    text: 'Przekazanie ustaleń do wdrożenia nie ma jednej definicji gotowości.',
    quadrant: 'weaknesses',
    impact: 'high',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
    evidence: 'W ostatnim kwartale start projektu przesunął się o dziewięć dni z powodu brakującego właściciela danych.',
  },
  {
    id: 'o1',
    text: 'Klienci oczekują krótkiego, mierzalnego etapu przygotowania przed pełnym wdrożeniem.',
    quadrant: 'opportunities',
    impact: 'high',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
    evidence: 'Powtarzające się pytania o pilotaż, zakres odpowiedzialności i kryteria startu.',
  },
  {
    id: 't1',
    text: 'Niepełne przekazanie obniża zaufanie klienta jeszcze przed rozpoczęciem dostawy.',
    quadrant: 'threats',
    impact: 'high',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
    evidence: 'Eskalacje dotyczące rozbieżności między obietnicą sprzedażową a planem wdrożenia.',
  },
];

const completeAnswers = {
  items: acceptedItems,
  tensions: [
    {
      id: 'tn1',
      title: 'Skalowanie wiedzy bez utraty jakości przekazania',
      type: 'attack',
      linkedItemIds: ['s1', 'o1', 'w1'],
      linkedCorrelationIds: [],
      insight: 'Popyt na szybki etap przygotowania można wykorzystać tylko wtedy, gdy wiedza konsultanta zostanie zamieniona w jawną bramkę gotowości.',
    },
    {
      id: 'tn2',
      title: 'Obietnica sprzedażowa kontra zaufanie podczas startu',
      type: 'defend',
      linkedItemIds: ['s2', 'w1', 't1'],
      linkedCorrelationIds: [],
      insight: 'Dopasowany warsztat nie ochroni relacji, jeżeli jego ustalenia nie mają właściciela i obowiązkowego readbacku.',
    },
  ],
  recommendedMoves: [
    {
      id: 'm1',
      title: 'Wprowadzić bramkę gotowości klienta do wdrożenia',
      category: 'quick-win',
      rationale: 'Jedna decyzja gotowe albo zwrot do uzupełnienia ograniczy rozbieżności między sprzedażą a dostawą.',
      linkedTensionIds: ['tn1', 'tn2'],
      linkedItemIds: ['s1', 'w1', 'o1', 't1'],
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      firstStep: 'Uzgodnić pięć wymaganych pól i właściciela decyzji podczas jednego warsztatu operacyjnego.',
      ownerRole: 'Dyrektor operacyjny',
      tradeoff: {
        chosen: 'Jedna obowiązkowa bramka przed startem',
        deferred: 'Automatyzacja całego procesu ofertowania',
        cost: 'Dodatkowe 30 minut pracy przed każdym uruchomieniem',
      },
      rejectedAlternative: {
        option: 'Pozostawić kontrolę gotowości każdemu kierownikowi projektu',
        reason: 'Nie daje porównywalnego standardu ani jednoznacznej odpowiedzialności.',
      },
    },
  ],
};

const guidedAnswers = {
  items: acceptedItems,
  tensions: completeAnswers.tensions.slice(0, 1),
  recommendedMoves: [],
};

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const identity = await client.query<{ organization_id: string; role: string }>(
    'SELECT organization_id, role FROM users WHERE id=$1',
    [ownerId]
  );
  if (identity.rows[0]?.organization_id !== organizationId) {
    throw new Error('Wave 3 owner does not belong to the requested organization');
  }

  await client.query('BEGIN');
  for (const fixture of [
    {
      id: ids.guidedSession,
      name: 'Odbiór właścicielski — Dynamic SWOT: przekazanie klienta',
      status: 'IN_PROGRESS',
      completion: 70,
      confidence: 4,
      answers: guidedAnswers,
    },
    {
      id: ids.approvedSession,
      name: 'Odbiór właścicielski — Dynamic SWOT: zatwierdzony przykład',
      status: 'APPROVED',
      completion: 100,
      confidence: 4.5,
      answers: completeAnswers,
    },
  ]) {
    await client.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status,
          completion_percent, confidence_avg, answers_json, context_snapshot,
          dod_status, version, approved_at, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,NULL,'dynamic-swot',$3,$4,$5,$6,$7,$8,$9,1,$10,$11,$11,NOW(),NOW())
       ON CONFLICT(id) DO NOTHING`,
      [
        fixture.id,
        organizationId,
        fixture.name,
        fixture.status,
        fixture.completion,
        fixture.confidence,
        JSON.stringify(fixture.answers),
        JSON.stringify({
          businessContext: 'Jakość przekazania klienta ze sprzedaży do wdrożenia',
          reviewPurpose: 'Wave 3 owner acceptance — local only',
        }),
        fixture.status === 'APPROVED' ? 'passed' : 'pending',
        fixture.status === 'APPROVED' ? new Date() : null,
        ownerId,
      ]
    );
  }
  await client.query('COMMIT');

  const readback = await client.query(
    `SELECT id, name, status, completion_percent, confidence_avg, version,
            jsonb_array_length(answers_json::jsonb->'items') AS items,
            jsonb_array_length(answers_json::jsonb->'tensions') AS tensions,
            jsonb_array_length(answers_json::jsonb->'recommendedMoves') AS moves
       FROM tool_sessions WHERE id=ANY($1::text[]) ORDER BY id`,
    [Object.values(ids)]
  );
  console.log(JSON.stringify({
    fixture: 'wave3-tools-owner-review-v1',
    organizationId,
    ownerId,
    routes: {
      guided: `/discovery-tools?docId=${ids.guidedSession}`,
      approved: `/discovery-tools?docId=${ids.approvedSession}`,
    },
    readback: readback.rows,
  }, null, 2));
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
