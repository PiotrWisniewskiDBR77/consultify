/**
 * fixtureGenerator — governed synthetic Audits fixture at scale (AUD-MVP-DATA-001).
 *
 * CO TO JEST I DLACZEGO:
 * Jedyny istniejący mechanizm danych demonstracyjnych dla Audits
 * (`server/src/services/audits/packSeed.ts`, `seedDemoAuditPack`) produkuje
 * 3 domeny / 9 kryteriów i ZERO dowodów/ustaleń/działań/kandydatów na
 * inicjatywę. Ten moduł domyka lukę: generuje w pełni POWIĄZANY graf danych
 * (kryteria → dowody, kryteria → ustalenia, ustalenia → działania, ustalenia
 * → propozycje inicjatyw) o skali wystarczającej do testów wydajnościowych i
 * odbiorowych, PRZEZ prawdziwe serwisy kernela Audits — nie surowe INSERT-y —
 * żeby fixture przechodził tę samą walidację i te same bramki uprawnień co
 * prawdziwy audyt.
 *
 * WŁASNOŚĆ MODUŁU (lease lane A, AUD-MVP-DATA-001):
 * Ten plik i jego `__tests__/` należą do tego zadania. `server/src/services/
 * audits/**` i `server/src/routes/audits/**` są POZA leasingiem — ten moduł
 * WYŁĄCZNIE je IMPORTUJE i WYWOŁUJE (packService/programService/
 * evidenceService/findingService/correctiveActionService/proposalService/
 * permissions), nigdy ich nie edytuje.
 *
 * DYSCYPLINA TREŚCI (audit-rights-sensitive domain — patrz nagłówek
 * `packSeed.ts`): generowana treść jest WŁASNYM, jawnie syntetycznym
 * sformułowaniem Consultify. NIE nazywa ani nie parafrazuje żadnej
 * zewnętrznej normy (ISO 27001, ISO 9001, SOC 2, NIST, COBIT, ITIL, IATF,
 * VDA, HIPAA…) — `assertNoForbiddenStandardTokens` jest bramką defensywną
 * wołaną przy KAŻDYM wygenerowanym fragmencie tekstu kryterium, a testy
 * dodatkowo skanują żywe wiersze w bazie po generacji. Pakiet ma
 * `classification: 'DEMONSTRATION'`, dokładnie jak `packSeed`.
 *
 * TOŻSAMOŚĆ FIXTURE'A I SPRZĄTANIE:
 * Cała generacja żyje pod JEDNĄ deterministyczną organizacją
 * (`FIXTURE_ORG_ID`, `claude_a_org_…`) — nic w tym module nigdy nie pisze do
 * innej organizacji. Wiersze pięciu mierzonych encji (kryteria programu,
 * dowody, ustalenia, działania korygujące, propozycje inicjatyw) oraz program
 * i jego członkowie dostają PRIMARY KEY z prefiksem `claude_a_` — serwisy
 * kernela generują własne id wewnętrznie (`newId(prefix)` w `auditsDb.ts`,
 * nie da się wstrzyknąć id z zewnątrz), więc ten moduł robi kontrolowaną,
 * deterministyczną zamianę PO fakcie (`renameIdsToFixturePrefix`) — string
 * `'claude_a_' || <stary id>` zaaplikowany RÓWNOCZEŚNIE do PK i do każdej
 * kolumny referencyjnej, która tę wartość przechowuje. To bezpieczne
 * WYŁĄCZNIE dlatego, że żadna z tych pięciu tabel nie ma prawdziwego FK
 * między sobą (potwierdzone: jedyne `REFERENCES` w migracji
 * `20260813_audits_method_core.sql` to `audit_pack_criteria.pack_id` i
 * `audit_packs.source_id` — obie z `ON DELETE CASCADE`, bez `ON UPDATE`, co
 * czyni PK `audit_packs`/`audit_norm_sources` NIE-do-bezpiecznego-zmieniania
 * po fakcie). Dlatego pakiet-rusztowanie (`audit_packs`, `audit_pack_criteria`,
 * `audit_norm_sources`) ZOSTAJE z natywnym id kernela — jest identyfikowalny
 * i sprzątalny przez `pack_key`/`source_key` (`FIXTURE_PACK_KEY`/
 * `FIXTURE_SOURCE_KEY`, oba z prefiksem `claude-a-fixture-…`) oraz przez
 * `organization_id = FIXTURE_ORG_ID` — nie przez literalny prefiks na `id`.
 * To jawne, udokumentowane odstępstwo — patrz raport zamknięcia zadania.
 *
 * IDEMPOTENCJA:
 * `generateFixture()` najpierw sprawdza, czy program z `pack_key =
 * FIXTURE_PACK_KEY` już istnieje dla `FIXTURE_ORG_ID` (dokładnie wzorzec
 * `packSeed.findExistingPack`). Jeśli tak — NIC nie tworzy, tylko mierzy i
 * zwraca istniejący stan (`reused: true`). Drugie wywołanie nigdy nie
 * podwaja liczników.
 */

import { auditAll, auditGet, auditRun, newId } from '../audits/auditsDb.js';
import { proposeAction } from '../audits/correctiveActionService.js';
import { submitEvidence } from '../audits/evidenceService.js';
import { createFinding, reviewFinding } from '../audits/findingService.js';
import { createPack, publishPack, approveByExpert, replaceCriteria } from '../audits/packService.js';
import type { ReplaceCriterionInput } from '../audits/packService.js';
import { addMember, createProgramFromPack } from '../audits/programService.js';
import { assertCapability, requireCapability, resolveProgramAccess } from '../audits/permissions.js';
import { AuditPermissionError } from '../audits/auditsDb.js';
import { draftProposalsFromFindings } from '../audits/proposalService.js';
import type { AuditActor, EvidenceKind, FindingTaxonomyEntry } from '../audits/types.js';

// ---------------------------------------------------------------------------
// Tożsamość fixture'a — deterministyczna, zawsze w tej samej organizacji
// ---------------------------------------------------------------------------

export const FIXTURE_ID_PREFIX = 'claude_a_';

export const FIXTURE_ORG_ID = 'claude_a_org_aud_mvp_data_001';
/** Druga organizacja WYŁĄCZNIE do testu negatywnego izolacji najemcy — nigdy nic tu nie zapisujemy. */
export const FIXTURE_ORG_B_ID = 'claude_a_org_tenant_negative_control';

export const FIXTURE_ACTOR_PRIMARY_ID = 'claude_a_actor_primary';
export const FIXTURE_ACTOR_SECONDARY_ID = 'claude_a_actor_secondary';
export const FIXTURE_ACTOR_VIEWER_ID = 'claude_a_actor_viewer';
/** Aktor bez JAKIEJKOLWIEK roli w programie — do testu negatywnego odczytu. */
export const FIXTURE_ACTOR_OUTSIDER_ID = 'claude_a_actor_outsider';

export const FIXTURE_PACK_KEY = 'claude-a-fixture-scale-pack-v1';
export const FIXTURE_SOURCE_KEY = 'claude-a-fixture-scale-source-v1';

function actorFor(userId: string): AuditActor {
  return { organizationId: FIXTURE_ORG_ID, userId, platformRole: 'user' };
}

// ---------------------------------------------------------------------------
// Dyscyplina treści — zero nazw zewnętrznych norm
// ---------------------------------------------------------------------------

/** Ta sama rodzina tokenów, którą zadanie zamyka jako zakazaną bez praw. */
export const FORBIDDEN_STANDARD_PATTERNS: RegExp[] = [
  /\bISO[\s-]?27001\b/i,
  /\bISO[\s-]?9001\b/i,
  /\bSOC\s?2\b/i,
  /\bNIST\b/i,
  /\bCOBIT\b/i,
  /\bITIL\b/i,
  /\bIATF\b/i,
  /\bVDA\b/i,
  /\bHIPAA\b/i,
  /\bGDPR\b/i,
  /\bRODO\b/i,
];

export function assertNoForbiddenStandardTokens(text: string | null | undefined, where: string): void {
  if (!text) return;
  for (const pattern of FORBIDDEN_STANDARD_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(
        `Fixture AUD-MVP-DATA-001 wygenerował treść odwołującą się do zewnętrznej normy (${pattern}) w ${where}: "${text}"`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Generator treści kryteriów — WŁASNE sformułowania, żadnej kopii normy
// ---------------------------------------------------------------------------

interface DomainTheme {
  refCode: string;
  title: string;
}

const DOMAIN_THEMES: DomainTheme[] = [
  { refCode: 'F1', title: 'Planowanie procesu operacyjnego' },
  { refCode: 'F2', title: 'Zasoby i kompetencje zespołu' },
  { refCode: 'F3', title: 'Nadzór nad dokumentacją wewnętrzną' },
  { refCode: 'F4', title: 'Zarządzanie zmianą operacyjną' },
  { refCode: 'F5', title: 'Monitorowanie wskaźników procesu' },
  { refCode: 'F6', title: 'Zarządzanie ryzykiem operacyjnym' },
  { refCode: 'F7', title: 'Ciągłość działania procesu' },
  { refCode: 'F8', title: 'Ochrona informacji wewnętrznej procesu' },
  { refCode: 'F9', title: 'Współpraca z dostawcami zewnętrznymi' },
  { refCode: 'F10', title: 'Szkolenia i rozwój kompetencji zespołu' },
  { refCode: 'F11', title: 'Zarządzanie zdarzeniami operacyjnymi' },
  { refCode: 'F12', title: 'Kontrola jakości wewnętrznej' },
  { refCode: 'F13', title: 'Zarządzanie danymi operacyjnymi' },
  { refCode: 'F14', title: 'Komunikacja wewnętrzna zespołu' },
  { refCode: 'F15', title: 'Zarządzanie projektami usprawnień' },
  { refCode: 'F16', title: 'Okresowy przegląd zarządczy procesu' },
];

interface FacetTemplate {
  code: string;
  labelSuffix: string;
  requirement: (domain: string) => string;
  question: (domain: string) => string;
  procedure: (domain: string) => string;
  evidenceKind: EvidenceKind;
  evidenceDescription: string;
}

const FACET_TEMPLATES: FacetTemplate[] = [
  {
    code: 'a',
    labelSuffix: 'Cel i zakres',
    requirement: (d) => `Obszar „${d}" ma spisany cel działania oraz jasno określone granice zakresu.`,
    question: (d) => `Czy istnieje aktualny opis celu i zakresu dla obszaru „${d}"?`,
    procedure: (d) => `Poproś o dokument opisujący obszar „${d}" i porównaj deklarowany zakres z próbką obserwowanych przypadków.`,
    evidenceKind: 'document',
    evidenceDescription: 'Karta obszaru lub równoważny dokument opisowy',
  },
  {
    code: 'b',
    labelSuffix: 'Właściciel i odpowiedzialność',
    requirement: (d) => `Dla obszaru „${d}" wskazana jest jedna osoba odpowiedzialna za jego działanie.`,
    question: (d) => `Kto odpowiada za obszar „${d}" i skąd to wynika?`,
    procedure: (d) => `Zweryfikuj zapis przypisania odpowiedzialności za „${d}" i porównaj z odpowiedzią wskazanej osoby.`,
    evidenceKind: 'document',
    evidenceDescription: 'Zapis przypisania odpowiedzialności',
  },
  {
    code: 'c',
    labelSuffix: 'Zasoby',
    requirement: (d) => `Obszar „${d}" ma przydzielone zasoby (czas, budżet, narzędzia) adekwatne do jego zakresu.`,
    question: (d) => `Jakie zasoby są przydzielone do obszaru „${d}" i kto je zatwierdził?`,
    procedure: (d) => `Poproś o plan zasobów dla „${d}" za ostatni okres i sprawdź zgodność z rzeczywistym wykorzystaniem.`,
    evidenceKind: 'system_export',
    evidenceDescription: 'Eksport planu/wykorzystania zasobów',
  },
  {
    code: 'd',
    labelSuffix: 'Kompetencje zespołu',
    requirement: (d) => `Osoby wykonujące zadania w obszarze „${d}" mają udokumentowane wymagane kompetencje.`,
    question: (d) => `Skąd wiadomo, że zespół „${d}" ma wymagane kompetencje?`,
    procedure: (d) => `Sprawdź profil kompetencji próbki osób pracujących w obszarze „${d}" wobec wymagań roli.`,
    evidenceKind: 'document',
    evidenceDescription: 'Zapis kompetencji / szkoleń zespołu',
  },
  {
    code: 'e',
    labelSuffix: 'Dokumentacja bieżąca',
    requirement: (d) => `Dokumenty operacyjne obszaru „${d}" mają widoczną wersję i datę ostatniej aktualizacji.`,
    question: (d) => `Po czym poznać, że dokument obszaru „${d}", na którym pracuje zespół, jest aktualną wersją?`,
    procedure: (d) => `Sprawdź próbkę dokumentów obszaru „${d}" pod kątem obecności numeru wersji i daty.`,
    evidenceKind: 'document',
    evidenceDescription: 'Próbka dokumentów operacyjnych z metryczką wersji',
  },
  {
    code: 'f',
    labelSuffix: 'Zapisy z wykonania',
    requirement: (d) => `Kluczowe kroki obszaru „${d}" pozostawiają zapis, który da się odtworzyć po fakcie.`,
    question: (d) => `Jak odtworzyć przebieg konkretnego wykonania w obszarze „${d}" sprzed miesiąca?`,
    procedure: (d) => `Wybierz próbkę zakończonych wykonań w obszarze „${d}" i poproś o odtworzenie przebiegu z zapisów.`,
    evidenceKind: 'system_export',
    evidenceDescription: 'Eksport zapisu z systemu operacyjnego',
  },
  {
    code: 'g',
    labelSuffix: 'Monitorowanie wskaźnika',
    requirement: (d) => `Obszar „${d}" ma zdefiniowany co najmniej jeden miernik skuteczności, okresowo przeglądany.`,
    question: (d) => `Jaki miernik skuteczności jest używany w obszarze „${d}" i kiedy był ostatnio przeglądany?`,
    procedure: (d) => `Poproś o dane miernika obszaru „${d}" za ostatni okres i sprawdź zapis przeglądu wyniku.`,
    evidenceKind: 'document',
    evidenceDescription: 'Zestawienie/raport miernika za ostatni okres',
  },
  {
    code: 'h',
    labelSuffix: 'Zarządzanie ryzykiem operacyjnym',
    requirement: (d) => `Dla obszaru „${d}" zidentyfikowano główne ryzyka operacyjne i sposób ich ograniczania.`,
    question: (d) => `Jakie ryzyka operacyjne zidentyfikowano dla obszaru „${d}" i jak są ograniczane?`,
    procedure: (d) => `Sprawdź rejestr ryzyk obszaru „${d}" i porównaj deklarowane działania ograniczające ze stanem faktycznym.`,
    evidenceKind: 'document',
    evidenceDescription: 'Rejestr ryzyk operacyjnych obszaru',
  },
  {
    code: 'i',
    labelSuffix: 'Komunikacja z interesariuszami',
    requirement: (d) => `Obszar „${d}" ma ustalony sposób komunikowania statusu do zainteresowanych stron.`,
    question: (d) => `Jak i jak często obszar „${d}" komunikuje status do interesariuszy?`,
    procedure: (d) => `Poproś o próbkę komunikatów statusu obszaru „${d}" z ostatniego okresu.`,
    evidenceKind: 'note',
    evidenceDescription: 'Próbka komunikatów statusu',
  },
  {
    code: 'j',
    labelSuffix: 'Przegląd okresowy',
    requirement: (d) => `Obszar „${d}" podlega okresowemu przeglądowi zarządczemu z udokumentowanym wnioskiem.`,
    question: (d) => `Kiedy odbył się ostatni przegląd zarządczy obszaru „${d}" i jaki był wniosek?`,
    procedure: (d) => `Poproś o zapis ostatniego przeglądu zarządczego obszaru „${d}" wraz z wnioskami i działaniami następczymi.`,
    evidenceKind: 'document',
    evidenceDescription: 'Protokół przeglądu zarządczego',
  },
];

/** 16 domen × 10 fasetów = 160 kryteriów-liści (≥150 wymagane), + 16 węzłów domenowych. */
const CRITERIA_PER_DOMAIN = FACET_TEMPLATES.length;
export const EXPECTED_LEAF_CRITERIA = DOMAIN_THEMES.length * CRITERIA_PER_DOMAIN;

const FIXTURE_FINDING_TAXONOMY: FindingTaxonomyEntry[] = [
  { key: 'conforming', label: 'Zgodne', nonConforming: false, requiresCorrectiveAction: false },
  {
    key: 'nonconforming',
    label: 'Niezgodne',
    nonConforming: true,
    requiresCorrectiveAction: true,
    defaultSeverity: 'medium',
  },
  { key: 'observation', label: 'Obserwacja', nonConforming: false, requiresCorrectiveAction: false },
  {
    key: 'opportunity_for_improvement',
    label: 'Szansa na usprawnienie',
    nonConforming: false,
    requiresCorrectiveAction: false,
  },
  { key: 'not_applicable', label: 'Nie dotyczy', nonConforming: false, requiresCorrectiveAction: false },
  {
    key: 'evidence_insufficient',
    label: 'Dowód niewystarczający',
    nonConforming: false,
    requiresCorrectiveAction: false,
  },
];

function buildCriteriaInput(): ReplaceCriterionInput[] {
  const out: ReplaceCriterionInput[] = [];
  DOMAIN_THEMES.forEach((domain, domainIdx) => {
    const domainKey = `domain-${domain.refCode}`;
    assertNoForbiddenStandardTokens(domain.title, `domain ${domain.refCode}`);
    out.push({
      id: domainKey,
      parentId: null,
      ordinal: domainIdx,
      refCode: domain.refCode,
      nodeKind: 'domain',
      title: domain.title,
    });

    FACET_TEMPLATES.forEach((facet, facetIdx) => {
      const refCode = `${domain.refCode}.${facetIdx + 1}`;
      const title = `${domain.title} — ${facet.labelSuffix}`;
      const requirementText = facet.requirement(domain.title);
      const auditQuestion = facet.question(domain.title);
      const auditProcedure = facet.procedure(domain.title);
      assertNoForbiddenStandardTokens(title, `criterion ${refCode} title`);
      assertNoForbiddenStandardTokens(requirementText, `criterion ${refCode} requirementText`);
      assertNoForbiddenStandardTokens(auditQuestion, `criterion ${refCode} auditQuestion`);
      assertNoForbiddenStandardTokens(auditProcedure, `criterion ${refCode} auditProcedure`);

      out.push({
        id: `${domainKey}-${facetIdx}`,
        parentId: domainKey,
        ordinal: facetIdx,
        refCode,
        nodeKind: 'criterion',
        title,
        requirementText,
        auditQuestion,
        auditProcedure,
        expectedEvidence: [{ kind: facet.evidenceKind, description: facet.evidenceDescription, mandatory: true }],
        samplingGuidance: 'Próbka dobierana celowo — priorytet dla przypadków nietypowych i krytycznych dla ciągłości procesu.',
        sourceReference: `Fixture skali Consultify (AUD-MVP-DATA-001), obszar ${domain.refCode}, poz. ${facetIdx + 1}`,
        mandatory: true,
      });
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Zamiana id na prefiks fixture'a — patrz uzasadnienie w nagłówku pliku
// ---------------------------------------------------------------------------

async function renameProgramAndCriteria(oldProgramId: string): Promise<{
  programId: string;
  leafCriterionIds: string[];
  allCriterionIds: string[];
}> {
  const newProgramId = `${FIXTURE_ID_PREFIX}${oldProgramId}`;
  await auditRun(`UPDATE audit_programs SET id = $1 WHERE id = $2 AND organization_id = $3`, [
    newProgramId,
    oldProgramId,
    FIXTURE_ORG_ID,
  ]);
  await auditRun(
    `UPDATE audit_program_criteria SET program_id = $1 WHERE program_id = $2 AND organization_id = $3`,
    [newProgramId, oldProgramId, FIXTURE_ORG_ID],
  );
  await auditRun(
    `UPDATE audit_program_members SET program_id = $1 WHERE program_id = $2 AND organization_id = $3`,
    [newProgramId, oldProgramId, FIXTURE_ORG_ID],
  );

  const rows = await auditAll<{ id: string; parent_id: string | null; node_kind: string }>(
    `SELECT id, parent_id, node_kind FROM audit_program_criteria WHERE organization_id = $1 AND program_id = $2`,
    [FIXTURE_ORG_ID, newProgramId],
  );

  const idMap = new Map<string, string>();
  for (const r of rows) idMap.set(r.id, `${FIXTURE_ID_PREFIX}${r.id}`);

  const leafCriterionIds: string[] = [];
  const allCriterionIds: string[] = [];
  for (const r of rows) {
    const newId_ = idMap.get(r.id)!;
    const newParent = r.parent_id ? (idMap.get(r.parent_id) ?? null) : null;
    await auditRun(`UPDATE audit_program_criteria SET id = $1, parent_id = $2 WHERE id = $3 AND organization_id = $4`, [
      newId_,
      newParent,
      r.id,
      FIXTURE_ORG_ID,
    ]);
    allCriterionIds.push(newId_);
    if (r.node_kind === 'criterion') leafCriterionIds.push(newId_);
  }

  return { programId: newProgramId, leafCriterionIds, allCriterionIds };
}

/**
 * Ostatni przebieg: PK pięciu pozostałych tabel (członkowie, dowody, ustalenia,
 * działania, propozycje) + kolumna referencyjna `finding_id` w działaniach +
 * tablica `source_finding_ids` w propozycjach dostają ten sam deterministyczny
 * prefiks. Bezpieczne w DOWOLNEJ kolejności: `'claude_a_' || <stary string>`
 * daje ten sam wynik niezależnie od tego, kiedy jest zaaplikowany — więc PK i
 * odwołanie zawsze się ponownie zgadzają, mimo że nie ma FK, który by to
 * wymuszał. Idempotentne przez `NOT LIKE 'claude_a_%'`.
 */
async function renameRemainingIdsToFixturePrefix(): Promise<void> {
  await auditRun(
    `UPDATE audit_program_members SET id = $1 || id WHERE organization_id = $2 AND id NOT LIKE $1 || '%'`,
    [FIXTURE_ID_PREFIX, FIXTURE_ORG_ID],
  );
  await auditRun(`UPDATE audit_evidence SET id = $1 || id WHERE organization_id = $2 AND id NOT LIKE $1 || '%'`, [
    FIXTURE_ID_PREFIX,
    FIXTURE_ORG_ID,
  ]);
  await auditRun(
    `UPDATE audit_corrective_actions SET finding_id = $1 || finding_id
       WHERE organization_id = $2 AND finding_id NOT LIKE $1 || '%'`,
    [FIXTURE_ID_PREFIX, FIXTURE_ORG_ID],
  );
  await auditRun(
    `UPDATE audit_program_findings SET id = $1 || id WHERE organization_id = $2 AND id NOT LIKE $1 || '%'`,
    [FIXTURE_ID_PREFIX, FIXTURE_ORG_ID],
  );
  await auditRun(
    `UPDATE audit_corrective_actions SET id = $1 || id WHERE organization_id = $2 AND id NOT LIKE $1 || '%'`,
    [FIXTURE_ID_PREFIX, FIXTURE_ORG_ID],
  );
  await auditRun(
    `UPDATE audit_initiative_proposals SET id = $1 || id WHERE organization_id = $2 AND id NOT LIKE $1 || '%'`,
    [FIXTURE_ID_PREFIX, FIXTURE_ORG_ID],
  );

  // source_finding_ids to jsonb: string-owy prepend na PK nie działa na tablicy,
  // więc przepisujemy element po elemencie w JS (mała liczba wierszy — propozycje).
  const proposals = await auditAll<{ id: string; source_finding_ids: unknown }>(
    `SELECT id, source_finding_ids FROM audit_initiative_proposals WHERE organization_id = $1`,
    [FIXTURE_ORG_ID],
  );
  for (const p of proposals) {
    const raw = p.source_finding_ids;
    const arr: string[] = Array.isArray(raw)
      ? (raw as string[])
      : typeof raw === 'string'
        ? (JSON.parse(raw || '[]') as string[])
        : [];
    const rewritten = arr.map((v) => (v.startsWith(FIXTURE_ID_PREFIX) ? v : `${FIXTURE_ID_PREFIX}${v}`));
    await auditRun(`UPDATE audit_initiative_proposals SET source_finding_ids = $1 WHERE id = $2`, [
      JSON.stringify(rewritten),
      p.id,
    ]);
  }
}

// ---------------------------------------------------------------------------
// Generacja
// ---------------------------------------------------------------------------

export interface FixtureCounts {
  criteria: number;
  criteriaAllNodes: number;
  evidence: number;
  findings: number;
  correctiveActions: number;
  initiativeProposals: number;
}

export interface FixtureIdentity {
  organizationId: string;
  programId: string;
  packId: string;
  sourceId: string;
  actorPrimaryId: string;
  actorSecondaryId: string;
  actorViewerId: string;
  actorOutsiderId: string;
}

export interface GenerateFixtureResult {
  identity: FixtureIdentity;
  counts: FixtureCounts;
  reused: boolean;
  wallClockMs: number;
}

async function findExistingProgramId(): Promise<{ programId: string; packId: string; sourceId: string } | null> {
  const row = await auditGet<{ id: string; pack_id: string }>(
    `SELECT p.id, p.pack_id FROM audit_programs p
       JOIN audit_packs pk ON pk.id = p.pack_id
      WHERE p.organization_id = $1 AND pk.pack_key = $2
      ORDER BY p.created_at ASC LIMIT 1`,
    [FIXTURE_ORG_ID, FIXTURE_PACK_KEY],
  );
  if (!row) return null;
  const packRow = await auditGet<{ id: string; source_id: string | null }>(
    `SELECT id, source_id FROM audit_packs WHERE id = $1`,
    [row.pack_id],
  );
  return { programId: row.id, packId: row.pack_id, sourceId: packRow?.source_id ?? '' };
}

export async function measureCounts(organizationId: string): Promise<FixtureCounts> {
  const [criteriaLeaf, criteriaAll, evidence, findings, actions, proposals] = await Promise.all([
    auditGet<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM audit_program_criteria WHERE organization_id = $1 AND node_kind = 'criterion'`,
      [organizationId],
    ),
    auditGet<{ c: string }>(`SELECT COUNT(*)::text AS c FROM audit_program_criteria WHERE organization_id = $1`, [
      organizationId,
    ]),
    auditGet<{ c: string }>(`SELECT COUNT(*)::text AS c FROM audit_evidence WHERE organization_id = $1`, [
      organizationId,
    ]),
    auditGet<{ c: string }>(`SELECT COUNT(*)::text AS c FROM audit_program_findings WHERE organization_id = $1`, [
      organizationId,
    ]),
    auditGet<{ c: string }>(`SELECT COUNT(*)::text AS c FROM audit_corrective_actions WHERE organization_id = $1`, [
      organizationId,
    ]),
    auditGet<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM audit_initiative_proposals WHERE organization_id = $1`,
      [organizationId],
    ),
  ]);
  return {
    criteria: Number(criteriaLeaf?.c ?? 0),
    criteriaAllNodes: Number(criteriaAll?.c ?? 0),
    evidence: Number(evidence?.c ?? 0),
    findings: Number(findings?.c ?? 0),
    correctiveActions: Number(actions?.c ?? 0),
    initiativeProposals: Number(proposals?.c ?? 0),
  };
}

/** Ile ewidencji dokładamy per kryterium-liść (3 → 160*3 = 480 ≥ 400 wymagane, margines +80). */
const EVIDENCE_PER_CRITERION = 3;
/** Ile kryteriów-liści dostaje ustalenie „niezgodne" + działanie korygujące (48 ≥ 40 wymagane działań, margines +8). */
const NONCONFORMING_FINDINGS_COUNT = 48;
/** Dodatkowe obserwacje na osobnych kryteriach (nie muszą mieć działania; 48+25=73 ≥ 60 wymagane ustalenia, margines +13). */
const OBSERVATION_FINDINGS_COUNT = 25;
/** Ile potwierdzonych ustaleń trafia do draftu propozycji (30 ≥ 12 wymaganych kandydatów, margines +18). */
const CONFIRMED_FOR_PROPOSALS_COUNT = 30;

export async function generateFixture(): Promise<GenerateFixtureResult> {
  const startedAt = Date.now();

  const existing = await findExistingProgramId();
  if (existing) {
    const counts = await measureCounts(FIXTURE_ORG_ID);
    return {
      identity: {
        organizationId: FIXTURE_ORG_ID,
        programId: existing.programId,
        packId: existing.packId,
        sourceId: existing.sourceId,
        actorPrimaryId: FIXTURE_ACTOR_PRIMARY_ID,
        actorSecondaryId: FIXTURE_ACTOR_SECONDARY_ID,
        actorViewerId: FIXTURE_ACTOR_VIEWER_ID,
        actorOutsiderId: FIXTURE_ACTOR_OUTSIDER_ID,
      },
      counts,
      reused: true,
      wallClockMs: Date.now() - startedAt,
    };
  }

  const primary = actorFor(FIXTURE_ACTOR_PRIMARY_ID);
  const secondary = actorFor(FIXTURE_ACTOR_SECONDARY_ID);

  // --- 1. Źródło + pakiet (rusztowanie — id kernela, patrz nagłówek pliku) ---
  const sourceId = newId('ans');
  await auditRun(
    `INSERT INTO audit_norm_sources
       (id, organization_id, source_key, title, publisher, source_version, source_kind,
        rights_status, verification_status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'demonstration','owned_internal','DEMONSTRATION',$7)`,
    [
      sourceId,
      FIXTURE_ORG_ID,
      FIXTURE_SOURCE_KEY,
      'Fixture skali Consultify — procedura demonstracyjna (AUD-MVP-DATA-001)',
      'Consultify',
      '1.0-fixture',
      FIXTURE_ACTOR_PRIMARY_ID,
    ],
  );

  const pack = await createPack(primary, {
    packKey: FIXTURE_PACK_KEY,
    title: 'Fixture skali Audits — pakiet wewnętrzny demonstracyjny (Claude A)',
    summary: 'Wygenerowany fixture skali dla AUD-MVP-DATA-001 — własne kryteria, nie kopia żadnej normy zewnętrznej.',
    purpose: 'Dostarczyć w pełni powiązany graf danych (kryteria/dowody/ustalenia/działania/propozycje) do testów skali i wydajności.',
    sourceId,
    sourceVersion: '1.0-fixture',
    classification: 'DEMONSTRATION',
    scope: 'Dowolny proces wewnętrzny wskazany jako przedmiot demonstracji skali.',
    objectives: 'Zademonstrować mechanikę audytu na dużym, własnym, jawnie niekopiowanym zestawie kryteriów.',
    auditType: 'process',
    requiredRoles: ['lead_auditor', 'auditor', 'auditee'],
    requiredCompetencies: ['podstawy audytu procesowego'],
    findingTaxonomy: FIXTURE_FINDING_TAXONOMY,
    samplingGuidance: 'Próbka dobierana celowo — priorytet dla przypadków nietypowych i krytycznych dla ciągłości procesu.',
  });

  await replaceCriteria(primary, pack.id, buildCriteriaInput());
  await approveByExpert(primary, pack.id, 'Zatwierdzenie eksperckie fixture skali (AUD-MVP-DATA-001) — dane syntetyczne.');
  await publishPack(primary, pack.id);

  // --- 2. Program z pakietu (snapshot kryteriów) ---
  const programDetail = await createProgramFromPack(FIXTURE_ORG_ID, primary, {
    packId: pack.id,
    name: 'Fixture skali Audits (AUD-MVP-DATA-001)',
    objective: 'Dane syntetyczne do testów skali/wydajności/izolacji najemcy modułu Audits.',
    scopeText: 'Cały wygenerowany zestaw kryteriów demonstracyjnych.',
  });
  const oldProgramId = programDetail.program.id;

  // --- 3. Zamiana id programu + kryteriów na prefiks fixture'a, PRZED użyciem ---
  const { programId, leafCriterionIds } = await renameProgramAndCriteria(oldProgramId);

  if (leafCriterionIds.length < EXPECTED_LEAF_CRITERIA) {
    throw new Error(
      `Fixture wygenerował ${leafCriterionIds.length} kryteriów-liści, oczekiwano ${EXPECTED_LEAF_CRITERIA}`,
    );
  }

  // --- 4. Role zespołu — jeden aktor na wiele ról (patrz uzasadnienie w evidence) ---
  await addMember(FIXTURE_ORG_ID, primary, programId, { userId: FIXTURE_ACTOR_PRIMARY_ID, memberRole: 'auditor' });
  await addMember(FIXTURE_ORG_ID, primary, programId, { userId: FIXTURE_ACTOR_PRIMARY_ID, memberRole: 'auditee' });
  await addMember(FIXTURE_ORG_ID, primary, programId, {
    userId: FIXTURE_ACTOR_SECONDARY_ID,
    memberRole: 'lead_auditor',
  });
  await addMember(FIXTURE_ORG_ID, primary, programId, { userId: FIXTURE_ACTOR_SECONDARY_ID, memberRole: 'reviewer' });
  await addMember(FIXTURE_ORG_ID, primary, programId, { userId: FIXTURE_ACTOR_VIEWER_ID, memberRole: 'viewer' });

  // --- 5. Dowody — 3 na kryterium-liść (160*3 = 480 ≥ 400) ---
  const evidenceKinds: EvidenceKind[] = ['document', 'system_export', 'observation', 'note', 'screenshot'];
  let evidenceSeq = 0;
  for (const criterionId of leafCriterionIds) {
    for (let i = 0; i < EVIDENCE_PER_CRITERION; i += 1) {
      evidenceSeq += 1;
      const kind = evidenceKinds[evidenceSeq % evidenceKinds.length];
      await submitEvidence(FIXTURE_ORG_ID, primary, {
        programId,
        criterionId,
        kind,
        title: `Dowód fixture #${evidenceSeq} dla kryterium ${criterionId}`,
        description: 'Dowód syntetyczny wygenerowany dla AUD-MVP-DATA-001 — bez treści zewnętrznej normy.',
        contentSnapshot: `Zrzut treści syntetycznej #${evidenceSeq}.`,
      });
    }
  }

  // --- 6. Ustalenia — niezgodności (45, z akcją) + obserwacje (20) ---
  const nonconformingCriteria = leafCriterionIds.slice(0, NONCONFORMING_FINDINGS_COUNT);
  const observationCriteria = leafCriterionIds.slice(
    NONCONFORMING_FINDINGS_COUNT,
    NONCONFORMING_FINDINGS_COUNT + OBSERVATION_FINDINGS_COUNT,
  );

  const nonconformingFindingIds: string[] = [];
  for (const criterionId of nonconformingCriteria) {
    const finding = await createFinding(FIXTURE_ORG_ID, primary, {
      programId,
      criterionId,
      statement: `Ustalenie fixture: dowody zebrane dla kryterium ${criterionId} wskazują na lukę w spełnieniu wymagania.`,
      requirementText: 'Wymaganie syntetyczne fixture skali — patrz kryterium źródłowe.',
      gapText: 'Zebrane dowody nie potwierdzają pełnego spełnienia wymagania w próbce sprawdzonych przypadków.',
      classification: 'nonconforming',
      severity: 'medium',
      objectiveEvidence: [`Dowód syntetyczny dla kryterium ${criterionId} nie potwierdza zgodności w próbce.`],
      recommendation: 'Wdrożyć działanie korygujące usuwające przyczynę źródłową rozbieżności.',
    });
    nonconformingFindingIds.push(finding.id);
  }

  for (const criterionId of observationCriteria) {
    await createFinding(FIXTURE_ORG_ID, primary, {
      programId,
      criterionId,
      statement: `Obserwacja fixture: proces w obszarze kryterium ${criterionId} działa, ale wskazuje sygnał ryzyka.`,
      classification: 'observation',
      severity: 'low',
      objectiveEvidence: ['Obserwacja syntetyczna zebrana podczas fixture skali.'],
    });
  }

  // --- 7. Działania korygujące — jedno na ustalenie niezgodne (45 ≥ 40) ---
  for (const findingId of nonconformingFindingIds) {
    await proposeAction(FIXTURE_ORG_ID, primary, findingId, {
      actionKind: 'corrective_action',
      title: `Działanie korygujące fixture dla ustalenia ${findingId}`,
      description: 'Działanie syntetyczne usuwające przyczynę źródłową (fixture skali AUD-MVP-DATA-001).',
      ownerUserId: FIXTURE_ACTOR_PRIMARY_ID,
      priority: 'medium',
    });
  }

  // --- 8. Potwierdzenie części ustaleń (recenzent ≠ autor) + draft propozycji ---
  const toConfirm = nonconformingFindingIds.slice(0, CONFIRMED_FOR_PROPOSALS_COUNT);
  for (const findingId of toConfirm) {
    await reviewFinding(FIXTURE_ORG_ID, secondary, findingId, { decision: 'confirm', note: 'Potwierdzone w ramach fixture skali.' });
  }
  await draftProposalsFromFindings(FIXTURE_ORG_ID, secondary, programId, {
    findingIds: toConfirm,
    splitBy: 'criterion',
  });

  // --- 9. Zamiana pozostałych id na prefiks fixture'a ---
  await renameRemainingIdsToFixturePrefix();

  const counts = await measureCounts(FIXTURE_ORG_ID);

  return {
    identity: {
      organizationId: FIXTURE_ORG_ID,
      programId,
      packId: pack.id,
      sourceId,
      actorPrimaryId: FIXTURE_ACTOR_PRIMARY_ID,
      actorSecondaryId: FIXTURE_ACTOR_SECONDARY_ID,
      actorViewerId: FIXTURE_ACTOR_VIEWER_ID,
      actorOutsiderId: FIXTURE_ACTOR_OUTSIDER_ID,
    },
    counts,
    reused: false,
    wallClockMs: Date.now() - startedAt,
  };
}

// ---------------------------------------------------------------------------
// Sprzątanie — usuwa DOKŁADNIE to, co ten moduł mógł stworzyć, nic więcej
// ---------------------------------------------------------------------------

export async function cleanupFixture(): Promise<void> {
  await auditRun(`DELETE FROM audit_domain_events WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_ai_proposals WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_verifications WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_initiative_proposals WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_corrective_actions WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_management_responses WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_program_findings WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_evidence_requests WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_evidence WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_program_criteria WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_program_members WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_programs WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_pack_criteria WHERE pack_id IN (SELECT id FROM audit_packs WHERE organization_id = $1)`, [
    FIXTURE_ORG_ID,
  ]);
  await auditRun(`DELETE FROM audit_packs WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
  await auditRun(`DELETE FROM audit_norm_sources WHERE organization_id = $1`, [FIXTURE_ORG_ID]);
}

// ---------------------------------------------------------------------------
// Pomoc dla testów — dostęp do kernela bez duplikowania importów w plikach testowych
// ---------------------------------------------------------------------------

export { AuditPermissionError, assertCapability, requireCapability, resolveProgramAccess };
export type { AuditActor };
export { actorFor as fixtureActorFor };
