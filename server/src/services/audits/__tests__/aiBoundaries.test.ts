/**
 * aiBoundaries.test — granice Teresy: co NIE wolno jej wykonać, nawet gdy
 * człowiek kliknął „zastosuj".
 *
 * Trzy warstwy sprawdzane tu osobno:
 *   1. `assertAiMayCommit` (permissions.ts, NIE modyfikowane przez U6) — hard
 *      stop dla każdej czynności z `AI_NEVER_COMMITS`. Testujemy WSZYSTKIE
 *      wpisy tej listy dynamicznie (obecnie 9 — przekracza wymagane „co
 *      najmniej 7"), nie przepisujemy jej ręcznie.
 *   2. Filtry wymuszane przez `aiProposalService` niezależnie od (1):
 *      brak źródeł, halucynacja faktu liczbowego, niezmienność preview,
 *      wymóg uprawnień człowieka przy commit.
 *
 * URUCHOM (z korzenia worktree, NIE z server/):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_audits_u6" \
 *   npx vitest run server/src/services/audits/__tests__/aiBoundaries.test.ts
 */

import { randomUUID } from 'crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import * as aiProposalService from '../aiProposalService.js';
import { auditRun } from '../auditsDb.js';
import { AI_NEVER_COMMITS, assertAiMayCommit, type AuditCapability } from '../permissions.js';
import type { AuditActor } from '../types.js';

const REACHABLE =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && !!process.env.DATABASE_URL;

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    '[aiBoundaries.test SKIPPED — clean skip, not a failure] needs NODE_ENV=test DB_TYPE=postgres ' +
      'RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<consultify_audits_u6>'
  );
}

const describeDb = REACHABLE ? describe : describe.skip;

function uid(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

async function seedProgram(organizationId: string, programId: string): Promise<void> {
  await auditRun(
    `INSERT INTO audit_programs (id, organization_id, name, status, lifecycle_state, created_by)
     VALUES ($1,$2,'U6 boundary program','active','fieldwork','seed')`,
    [programId, organizationId]
  );
}

async function addMember(
  organizationId: string,
  programId: string,
  userId: string,
  role: string
): Promise<void> {
  await auditRun(
    `INSERT INTO audit_program_members (id, program_id, organization_id, user_id, member_role)
     VALUES ($1,$2,$3,$4,$5)`,
    [uid('apm'), programId, organizationId, userId, role]
  );
}

async function seedCriterion(
  organizationId: string,
  programId: string,
  criterionId: string
): Promise<void> {
  await auditRun(
    `INSERT INTO audit_program_criteria
       (id, program_id, organization_id, ordinal, ref_code, title, requirement_text, work_status)
     VALUES ($1,$2,$3,0,'A.1','Polityka bezpieczeństwa jest udokumentowana',
             'Organizacja musi posiadać udokumentowaną politykę bezpieczeństwa.','open')`,
    [criterionId, programId, organizationId]
  );
}

function actorFor(organizationId: string, userId: string): AuditActor {
  return { organizationId, userId };
}

// ---------------------------------------------------------------------------
// 1. Granica bezwarunkowa: AI_NEVER_COMMITS
// ---------------------------------------------------------------------------

describe('assertAiMayCommit — granica bezwarunkowa (nie zależy od bazy)', () => {
  // AI_NEVER_COMMITS niesie CAŁĄ listę operacji, których Teresa nie może
  // wykonać nawet po potwierdzeniu przez człowieka: zatwierdzenie zgodności,
  // wydanie finalnego ustalenia, zamknięcie ustalenia, akceptacja ryzyka
  // rezydualnego, zatwierdzenie skuteczności, finalizacja Outputu, publikacja
  // raportu, rejestracja inicjatywy — testowane tu WSZYSTKIE, dynamicznie.
  it.each(AI_NEVER_COMMITS.map((cap) => [cap] as const))(
    'odrzuca %s z czytelnym komunikatem kierującym do jawnej decyzji człowieka',
    (capability) => {
      expect(() => assertAiMayCommit(capability)).toThrowError(/jawnej decyzji uprawnionej osoby/);
    }
  );

  it('lista pokrywa co najmniej 7 zabronionych operacji (wymóg zadania)', () => {
    expect(AI_NEVER_COMMITS.length).toBeGreaterThanOrEqual(7);
  });

  it('nazwane operacje z opisu zadania są w liście: conclude/confirm/close/accept_residual_risk/verify/publish', () => {
    const named: AuditCapability[] = [
      'criterion.conclude', // zatwierdzenie zgodności
      'finding.confirm', // wydanie finalnego ustalenia
      'finding.close', // zamknięcie ustalenia
      'verification.perform', // zatwierdzenie skuteczności
      'report.publish', // publikacja raportu
      'finding.accept_residual_risk', // akceptacja ryzyka rezydualnego
    ];
    for (const cap of named) {
      expect(AI_NEVER_COMMITS).toContain(cap);
    }
  });

  it('NIE blokuje czynności roboczych, które Teresa faktycznie commituje (draft content)', () => {
    const allowed: AuditCapability[] = [
      'criterion.perform_test',
      'evidence_request.create',
      'finding.draft',
      'action.propose',
      'report.draft',
    ];
    for (const cap of allowed) {
      expect(() => assertAiMayCommit(cap)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Filtr antyhalucynacyjny
// ---------------------------------------------------------------------------

describe('assertGroundedInSources — filtr, nie tylko instrukcja w promptcie', () => {
  it('przepuszcza tekst, którego wszystkie liczby pochodzą ze źródeł', () => {
    expect(() =>
      aiProposalService.assertGroundedInSources('Kryterium A.5.1 ma 3 dowody z 2024 roku.', [
        'ref A.5.1',
        '3 dokumenty zebrane w roku 2024',
      ])
    ).not.toThrow();
  });

  it('odrzuca tekst z liczbą/datą nieobecną w źródłach', () => {
    expect(() =>
      aiProposalService.assertGroundedInSources('Stwierdzono 42 przypadki niezgodności.', [
        'Kryterium bez żadnej liczby w treści wymagania',
      ])
    ).toThrowError(/AUDIT_AI_HALLUCINATION|fakty liczbowe spoza danych/i);
  });

  it('extractNumericTokens wyciąga liczby i fragmenty dat', () => {
    const tokens = aiProposalService.extractNumericTokens('Dowód z 2026-08-13, wersja 2.');
    expect(tokens).toEqual(expect.arrayContaining(['2026', '08', '13', '2']));
  });
});

describe('assertHasSources — propozycja bez źródeł jest błędem', () => {
  it('rzuca, gdy tablica źródeł jest pusta lub brak', () => {
    expect(() => aiProposalService.assertHasSources([])).toThrow(/co najmniej jedno źródło/);
    expect(() => aiProposalService.assertHasSources(undefined)).toThrow(/co najmniej jedno źródło/);
    expect(() => aiProposalService.assertHasSources(null)).toThrow(/co najmniej jedno źródło/);
  });

  it('nie rzuca, gdy jest co najmniej jedno źródło', () => {
    expect(() =>
      aiProposalService.assertHasSources([{ type: 'criterion', id: 'x', excerpt: 'y' }])
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Integracja na bazie: no-hallucination end-to-end, preview niezmienny,
//    commit z uprawnieniami człowieka
// ---------------------------------------------------------------------------

describeDb('granice Teresy — integracja na realnej bazie', () => {
  beforeAll(() => {
    process.env.AI_PROVIDER_MODE = 'mock';
  });

  it('generator nie wpisuje faktu liczbowego spoza danych wejściowych kryterium', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const criterionId = uid('crit');
    const auditor = uid('user-auditor');

    await seedProgram(organizationId, programId);
    await addMember(organizationId, programId, auditor, 'lead_auditor');
    // Celowo BEZ żadnej liczby w treści wymagania/tytule/pytaniu.
    await auditRun(
      `INSERT INTO audit_program_criteria
         (id, program_id, organization_id, ordinal, ref_code, title, requirement_text, audit_question, work_status)
       VALUES ($1,$2,$3,0,'REF','Wymaganie bez liczb','Treść wymagania nie zawiera żadnej liczby ani daty.',
               'Czy wymaganie jest spełnione bez odwołania do liczb?','open')`,
      [criterionId, programId, organizationId]
    );

    const actor = actorFor(organizationId, auditor);
    const created = await aiProposalService.createIntent(organizationId, actor, {
      programId,
      targetType: 'criterion',
      targetId: criterionId,
      intent: 'explain_criterion',
      context: {},
    });

    // Sprawdzamy WYŁĄCZNIE tekst autorski (explanation/goodEvidenceExamples) —
    // `criterionId` w propozycji jest identyfikatorem (UUID), nie faktem, i z
    // natury zawiera cyfry niepowiązane z treścią wymagania.
    const narrativeText = [
      (created.proposal as any).explanation,
      ...(((created.proposal as any).goodEvidenceExamples as string[]) || []),
    ].join('\n');
    // Liczba, która NIE występuje nigdzie w danych wejściowych zasianych wyżej.
    expect(narrativeText).not.toContain('987654');
    expect(aiProposalService.extractNumericTokens(narrativeText).length).toBe(0);
  });

  it('preview zapisany przy tworzeniu jest tym samym, który zwraca getPreview po zmianie danych w tle', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const criterionId = uid('crit');
    const auditor = uid('user-auditor');

    await seedProgram(organizationId, programId);
    await addMember(organizationId, programId, auditor, 'lead_auditor');
    await seedCriterion(organizationId, programId, criterionId);

    const actor = actorFor(organizationId, auditor);
    const created = await aiProposalService.createIntent(organizationId, actor, {
      programId,
      targetType: 'criterion',
      targetId: criterionId,
      intent: 'explain_criterion',
      context: {},
    });
    const originalPreview = created.preview;

    // Zmiana w tle PO utworzeniu propozycji — wprowadza fakt, którego człowiek
    // nigdy nie widział (liczba 555555, nieobecna w oryginalnym wymaganiu).
    await auditRun(
      `UPDATE audit_program_criteria
          SET requirement_text='ZMIENIONE W TLE — nowa wersja 555555'
        WHERE organization_id=$1 AND id=$2`,
      [organizationId, criterionId]
    );

    const preview = await aiProposalService.getPreview(organizationId, created.id);
    expect(preview.preview).toEqual(originalPreview);
    expect(JSON.stringify(preview.preview)).not.toContain('555555');
  });

  it('commit wykonuje się z uprawnieniami człowieka — użytkownik bez roli w programie dostaje odmowę', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const criterionId = uid('crit');
    const auditor = uid('user-auditor');
    const stranger = uid('user-stranger'); // brak wiersza w audit_program_members

    await seedProgram(organizationId, programId);
    await addMember(organizationId, programId, auditor, 'lead_auditor');
    await seedCriterion(organizationId, programId, criterionId);

    const ownerActor = actorFor(organizationId, auditor);
    const strangerActor = actorFor(organizationId, stranger);

    // Osoba bez żadnej roli w programie nie może nawet zaproponować.
    await expect(
      aiProposalService.createIntent(organizationId, strangerActor, {
        programId,
        targetType: 'criterion',
        targetId: criterionId,
        intent: 'explain_criterion',
        context: {},
      })
    ).rejects.toThrow(/ai\.propose|uprawnień/i);

    const created = await aiProposalService.createIntent(organizationId, ownerActor, {
      programId,
      targetType: 'criterion',
      targetId: criterionId,
      intent: 'explain_criterion',
      context: {},
    });
    await aiProposalService.decide(organizationId, ownerActor, created.id, { decision: 'accept' });

    // Osoba bez roli nie może też wykonać (commit) już zaakceptowanej propozycji.
    await expect(
      aiProposalService.commit(organizationId, strangerActor, created.id)
    ).rejects.toThrow(/uprawnień|ai\.commit/i);
  });

  it('commit wymaga ai.commit osobno od ai.propose — auditee widzi Teresę, ale nie wykonuje jej propozycji', async () => {
    const organizationId = uid('org');
    const programId = uid('prog');
    const criterionId = uid('crit');
    const auditeeUser = uid('user-auditee');

    await seedProgram(organizationId, programId);
    // auditee ma ai.propose (może rozmawiać z Teresą) ale NIE ma ai.commit.
    await addMember(organizationId, programId, auditeeUser, 'auditee');
    await seedCriterion(organizationId, programId, criterionId);

    const actor = actorFor(organizationId, auditeeUser);
    const created = await aiProposalService.createIntent(organizationId, actor, {
      programId,
      targetType: 'criterion',
      targetId: criterionId,
      intent: 'explain_criterion',
      context: {},
    });
    await aiProposalService.decide(organizationId, actor, created.id, { decision: 'accept' });

    await expect(aiProposalService.commit(organizationId, actor, created.id)).rejects.toThrow(
      /ai\.commit/i
    );
  });
});
