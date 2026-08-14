/**
 * packSeed — pakiet demonstracyjny Audits.
 *
 * DLACZEGO WŁASNA TREŚĆ, NIE KOPIA NORMY:
 * Ten pakiet istnieje, żeby ktokolwiek mógł zobaczyć działający audyt bez
 * czekania na wykupienie/zweryfikowanie prawdziwej normy. Dlatego:
 *   - klasyfikacja jest `DEMONSTRATION`, nie `VERIFIED_NORMATIVE` — walidator
 *     pakietu (`packValidator.ts`) i tak by na to nie pozwolił bez
 *     zweryfikowanego źródła, ale intencja jest jawna już w danych;
 *   - tytuł NIE zawiera nazw norm (ISO/IATF/VDA/SOC2/HIPAA) — `packValidator`
 *     blokuje tytuły, które sugerują zgodność z normą bez pokrycia
 *     (`PACK_TITLE_IMPLIES_NORMATIVE`);
 *   - wymagania (`requirement_text`) są WŁASNYM sformułowaniem Consultify,
 *     `source_reference` wskazuje na WŁASNĄ procedurę demonstracyjną, nie na
 *     żaden zewnętrzny dokument objęty prawami autorskimi.
 *
 * Idempotentność: jeśli `pack_key = DEMO_PACK_KEY` już istnieje dla danej
 * organizacji, funkcja zwraca istniejący pakiet zamiast tworzyć duplikat —
 * seed może być wywoływany wielokrotnie (np. przy każdym starcie demo) bez
 * namnażania wierszy.
 */

import { auditGet, auditRun, newId, recordAuditEvent } from './auditsDb.js';
import { createPack, getPack, replaceCriteria } from './packService.js';
import type { AuditActor, AuditPack, ExpectedEvidenceSpec, FindingTaxonomyEntry } from './types.js';
import type { PackCriterionNode } from './packService.js';

export const DEMO_PACK_KEY = 'internal-process-audit-demo';

const DEMO_SOURCE_KEY = 'consultify-demo-procedure';

const DEMO_FINDING_TAXONOMY: FindingTaxonomyEntry[] = [
  {
    key: 'conforming',
    label: 'Zgodne',
    nonConforming: false,
    requiresCorrectiveAction: false,
    description: 'Wymaganie jest spełnione na podstawie zebranych dowodów.',
  },
  {
    key: 'nonconforming',
    label: 'Niezgodne',
    nonConforming: true,
    requiresCorrectiveAction: true,
    description: 'Wymaganie nie jest spełnione — konieczne działanie korygujące.',
    defaultSeverity: 'medium',
  },
  {
    key: 'observation',
    label: 'Obserwacja',
    nonConforming: false,
    requiresCorrectiveAction: false,
    description: 'Sygnał ryzyka, który nie stanowi jeszcze niezgodności.',
  },
  {
    key: 'opportunity_for_improvement',
    label: 'Szansa na usprawnienie',
    nonConforming: false,
    requiresCorrectiveAction: false,
    description: 'Proces jest zgodny, ale da się go usprawnić.',
  },
  {
    key: 'not_applicable',
    label: 'Nie dotyczy',
    nonConforming: false,
    requiresCorrectiveAction: false,
    description: 'Kryterium nie ma zastosowania w tym audycie.',
  },
  {
    key: 'evidence_insufficient',
    label: 'Dowód niewystarczający',
    nonConforming: false,
    requiresCorrectiveAction: false,
    description: 'Zebrany dowód nie pozwala orzec zgodności ani niezgodności.',
  },
];

interface DemoCriterionSeed {
  refCode: string;
  title: string;
  requirementText: string;
  auditQuestion: string;
  expectedEvidence: ExpectedEvidenceSpec[];
  auditProcedure: string;
  samplingGuidance: string;
  sourceReference: string;
}

interface DemoDomainSeed {
  refCode: string;
  title: string;
  criteria: DemoCriterionSeed[];
}

const DEMO_DOMAINS: DemoDomainSeed[] = [
  {
    refCode: 'D1',
    title: 'Zarządzanie procesem',
    criteria: [
      {
        refCode: 'D1.1',
        title: 'Cel i zakres procesu są udokumentowane',
        requirementText:
          'Proces ma spisany cel oraz jasno określony zakres (co wchodzi, a co nie wchodzi w jego granice).',
        auditQuestion:
          'Czy istnieje aktualny opis celu i zakresu procesu, dostępny dla osób go wykonujących?',
        expectedEvidence: [
          {
            kind: 'document',
            description: 'Karta procesu lub równoważny dokument opisowy',
            mandatory: true,
          },
          {
            kind: 'interview_answer',
            description: 'Potwierdzenie właściciela procesu w rozmowie',
            mandatory: false,
          },
        ],
        auditProcedure:
          'Poproś o aktualny dokument opisujący proces. Sprawdź datę ostatniej aktualizacji i porównaj opisany zakres z tym, co faktycznie się dzieje w próbce zaobserwowanych przypadków.',
        samplingGuidance:
          'Jedna aktualna wersja dokumentu wystarcza; przy wątpliwościach poproś o historię zmian.',
        sourceReference: 'Procedura demonstracyjna Consultify, pkt 2.1',
      },
      {
        refCode: 'D1.2',
        title: 'Właściciel procesu jest wyznaczony',
        requirementText:
          'Dla procesu wskazana jest jedna osoba odpowiedzialna za jego działanie i doskonalenie (właściciel procesu).',
        auditQuestion: 'Kto jest właścicielem tego procesu i skąd to wynika?',
        expectedEvidence: [
          {
            kind: 'document',
            description: 'Zapis przypisania roli właściciela procesu',
            mandatory: true,
          },
        ],
        auditProcedure:
          'Zweryfikuj, czy przypisanie właściciela procesu istnieje w formie zapisu (nie tylko ustnie), i porównaj je z odpowiedzią osoby wskazanej jako właściciel.',
        samplingGuidance: 'Nie dotyczy — sprawdzane jednorazowo dla całego procesu.',
        sourceReference: 'Procedura demonstracyjna Consultify, pkt 2.2',
      },
      {
        refCode: 'D1.3',
        title: 'Mierniki skuteczności procesu są monitorowane',
        requirementText:
          'Proces ma zdefiniowany co najmniej jeden miernik skuteczności, który jest okresowo przeglądany.',
        auditQuestion:
          'Jaki miernik(i) skuteczności procesu jest używany i kiedy był ostatnio przeglądany?',
        expectedEvidence: [
          {
            kind: 'document',
            description: 'Zestawienie/raport miernika za ostatni okres',
            mandatory: true,
          },
          {
            kind: 'system_export',
            description: 'Eksport danych źródłowych miernika',
            mandatory: false,
          },
        ],
        auditProcedure:
          'Poproś o dane miernika za ostatni pełny okres raportowy. Sprawdź, czy istnieje zapis przeglądu wyniku (kto, kiedy, jaki wniosek).',
        samplingGuidance:
          'Sprawdź ostatni pełny okres raportowy oraz jeden okres wcześniejszy dla porównania trendu.',
        sourceReference: 'Procedura demonstracyjna Consultify, pkt 2.3',
      },
    ],
  },
  {
    refCode: 'D2',
    title: 'Kompetencje i role',
    criteria: [
      {
        refCode: 'D2.1',
        title: 'Role w procesie są przypisane do konkretnych osób',
        requirementText:
          'Każda rola wymagana do wykonania procesu jest przypisana do zidentyfikowanej osoby lub zespołu.',
        auditQuestion: 'Jak można sprawdzić, kto pełni daną rolę w procesie w danym momencie?',
        expectedEvidence: [
          {
            kind: 'document',
            description: 'Macierz ról/odpowiedzialności lub równoważny zapis',
            mandatory: true,
          },
        ],
        auditProcedure:
          'Porównaj listę ról wymaganych opisem procesu z rzeczywistym przypisaniem osób. Wybierz próbkę ról i zweryfikuj zgodność z zapisem.',
        samplingGuidance: 'Sprawdź minimum 3 role, w tym rolę kluczową dla decyzji w procesie.',
        sourceReference: 'Procedura demonstracyjna Consultify, pkt 3.1',
      },
      {
        refCode: 'D2.2',
        title: 'Kompetencje wymagane do pełnienia roli są zdefiniowane',
        requirementText:
          'Dla każdej roli w procesie określono minimalne wymagane kompetencje (wiedzę, uprawnienia lub doświadczenie).',
        auditQuestion: 'Skąd wiadomo, jakie kompetencje są wymagane do pełnienia danej roli?',
        expectedEvidence: [
          {
            kind: 'document',
            description: 'Opis wymaganych kompetencji dla roli',
            mandatory: true,
          },
        ],
        auditProcedure:
          'Zweryfikuj istnienie opisu wymaganych kompetencji i porównaj go z faktycznym profilem osoby pełniącej rolę w próbce.',
        samplingGuidance: 'Sprawdź te same role, co w D2.1, dla spójności próbki.',
        sourceReference: 'Procedura demonstracyjna Consultify, pkt 3.2',
      },
      {
        refCode: 'D2.3',
        title: 'Zastępowalność kluczowych ról jest zapewniona',
        requirementText:
          'Dla ról krytycznych dla ciągłości procesu istnieje wskazany zastępca lub udokumentowany plan zastępstwa.',
        auditQuestion: 'Co się dzieje z procesem, gdy osoba pełniąca kluczową rolę jest nieobecna?',
        expectedEvidence: [
          {
            kind: 'document',
            description: 'Plan zastępstw lub zapis wyznaczenia zastępcy',
            mandatory: true,
          },
          {
            kind: 'interview_answer',
            description: 'Potwierdzenie w rozmowie z właścicielem procesu',
            mandatory: false,
          },
        ],
        auditProcedure:
          'Zapytaj o rolę uznaną za krytyczną i poproś o dowód istnienia zastępstwa. W braku dokumentu sprawdź w rozmowie, czy zastępstwo faktycznie funkcjonowało w praktyce.',
        samplingGuidance:
          'Wybierz jedną rolę ocenioną jako najbardziej krytyczną dla ciągłości procesu.',
        sourceReference: 'Procedura demonstracyjna Consultify, pkt 3.3',
      },
    ],
  },
  {
    refCode: 'D3',
    title: 'Dokumentacja i zapisy',
    criteria: [
      {
        refCode: 'D3.1',
        title: 'Dokumenty procesu mają widoczną wersję i datę aktualizacji',
        requirementText:
          'Dokumenty opisujące proces jednoznacznie wskazują swoją wersję oraz datę ostatniej aktualizacji.',
        auditQuestion:
          'Po czym poznać, że dokument, na którym pracuje zespół, jest aktualną wersją?',
        expectedEvidence: [
          {
            kind: 'document',
            description: 'Próbka dokumentów procesu z widoczną metryczką wersji',
            mandatory: true,
          },
        ],
        auditProcedure:
          'Sprawdź próbkę dokumentów wykorzystywanych w procesie pod kątem obecności numeru wersji i daty. Porównaj z rejestrem dokumentów, jeśli istnieje.',
        samplingGuidance:
          'Sprawdź co najmniej 3 dokumenty wykorzystywane operacyjnie w ostatnim miesiącu.',
        sourceReference: 'Procedura demonstracyjna Consultify, pkt 4.1',
      },
      {
        refCode: 'D3.2',
        title: 'Zapisy z wykonania procesu są przechowywane i odtwarzalne',
        requirementText:
          'Kluczowe kroki procesu pozostawiają zapis (np. formularz, wpis systemowy), który da się odtworzyć po fakcie.',
        auditQuestion: 'Jak odtworzyć przebieg konkretnego wykonania procesu sprzed miesiąca?',
        expectedEvidence: [
          {
            kind: 'system_export',
            description: 'Eksport zapisu z systemu obsługującego proces',
            mandatory: true,
          },
          {
            kind: 'document',
            description: 'Formularz papierowy/elektroniczny, jeśli proces go używa',
            mandatory: false,
          },
        ],
        auditProcedure:
          'Wybierz próbkę zakończonych wykonań procesu i poproś o odtworzenie ich przebiegu z zapisów. Oceń, czy zapis pozwala jednoznacznie zrekonstruować kto/co/kiedy.',
        samplingGuidance:
          'Wybierz próbkę min. 5 wykonań procesu z ostatnich 3 miesięcy, w tym jedno nietypowe.',
        sourceReference: 'Procedura demonstracyjna Consultify, pkt 4.2',
      },
      {
        refCode: 'D3.3',
        title: 'Zmiany w dokumentacji procesu przechodzą przez zatwierdzenie',
        requirementText:
          'Zmiana dokumentu opisującego proces jest zatwierdzana przez osobę do tego upoważnioną, zanim zacznie obowiązywać.',
        auditQuestion:
          'Kto zatwierdził ostatnią zmianę w dokumentacji tego procesu i jak to udokumentowano?',
        expectedEvidence: [
          {
            kind: 'document',
            description: 'Historia zmian dokumentu z adnotacją zatwierdzającą',
            mandatory: true,
          },
        ],
        auditProcedure:
          'Poproś o historię zmian najważniejszego dokumentu procesu. Sprawdź, czy każda zmiana ma wskazaną osobę zatwierdzającą i datę wejścia w życie.',
        samplingGuidance: 'Sprawdź ostatnie 2 zmiany dokumentu, jeśli historia jest dłuższa.',
        sourceReference: 'Procedura demonstracyjna Consultify, pkt 4.3',
      },
    ],
  },
];

async function findExistingPack(organizationId: string): Promise<{ id: string } | null> {
  const row = await auditGet<{ id: string }>(
    `SELECT id FROM audit_packs WHERE (organization_id = $1 OR organization_id IS NULL) AND pack_key = $2 LIMIT 1`,
    [organizationId, DEMO_PACK_KEY]
  );
  return row ?? null;
}

async function ensureDemoSource(actor: AuditActor): Promise<string> {
  const existing = await auditGet<{ id: string }>(
    `SELECT id FROM audit_norm_sources WHERE (organization_id = $1 OR organization_id IS NULL) AND source_key = $2 LIMIT 1`,
    [actor.organizationId, DEMO_SOURCE_KEY]
  );
  if (existing) return existing.id;

  const id = newId('ans');
  await auditRun(
    `INSERT INTO audit_norm_sources
       (id, organization_id, source_key, title, publisher, source_version, source_kind,
        rights_status, verification_status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'demonstration','owned_internal','DEMONSTRATION',$7)`,
    [
      id,
      actor.organizationId,
      DEMO_SOURCE_KEY,
      'Procedura demonstracyjna Consultify — audyt procesu',
      'Consultify',
      '1.0-demo',
      actor.userId,
    ]
  );
  return id;
}

/**
 * Tworzy (albo zwraca istniejący) demonstracyjny Audit Pack. Idempotentna —
 * bezpieczna do wywołania wielokrotnie, np. przy każdym starcie środowiska
 * demo.
 */
export async function seedDemoAuditPack(
  organizationId: string,
  userId: string
): Promise<AuditPack & { criteria: PackCriterionNode[] }> {
  const actor: AuditActor = { organizationId, userId };

  const existing = await findExistingPack(organizationId);
  if (existing) {
    return getPack(organizationId, existing.id);
  }

  const sourceId = await ensureDemoSource(actor);

  const pack = await createPack(actor, {
    packKey: DEMO_PACK_KEY,
    title: 'Audyt procesu — pakiet demonstracyjny Consultify',
    summary:
      'Pakiet demonstracyjny do prezentacji mechaniki audytu Consultify — własne kryteria, nie kopia żadnej normy zewnętrznej.',
    purpose:
      'Pokazać pełny łańcuch: kryterium → pytanie → dowód → procedura → wniosek → ustalenie → działanie → weryfikacja, bez czekania na zweryfikowaną normę zewnętrzną.',
    sourceId,
    sourceVersion: '1.0-demo',
    classification: 'DEMONSTRATION',
    scope: 'Dowolny proces wewnętrzny wskazany przez zespół jako przedmiot demonstracji.',
    objectives:
      'Zademonstrować mechanikę audytu procesu na własnych, jawnie niekopiowanych kryteriach.',
    auditType: 'process',
    requiredRoles: ['lead_auditor', 'auditor', 'auditee'],
    requiredCompetencies: ['podstawy audytu procesowego'],
    findingTaxonomy: DEMO_FINDING_TAXONOMY,
    samplingGuidance:
      'Próbka dobierana celowo (nie statystycznie) — priorytet dla przypadków nietypowych i krytycznych dla ciągłości procesu.',
  });

  const criteriaInput = DEMO_DOMAINS.flatMap((domain, domainIndex) => {
    const domainKey = `domain-${domain.refCode}`;
    const domainNode = {
      id: domainKey,
      parentId: null as string | null,
      ordinal: domainIndex,
      refCode: domain.refCode,
      nodeKind: 'domain' as const,
      title: domain.title,
    };
    const criterionNodes = domain.criteria.map((c, criterionIndex) => ({
      id: `${domainKey}-${criterionIndex}`,
      parentId: domainKey,
      ordinal: criterionIndex,
      refCode: c.refCode,
      nodeKind: 'criterion' as const,
      title: c.title,
      requirementText: c.requirementText,
      auditQuestion: c.auditQuestion,
      expectedEvidence: c.expectedEvidence,
      auditProcedure: c.auditProcedure,
      samplingGuidance: c.samplingGuidance,
      sourceReference: c.sourceReference,
      mandatory: true,
    }));
    return [domainNode, ...criterionNodes];
  });

  await replaceCriteria(actor, pack.id, criteriaInput);

  await recordAuditEvent({
    organizationId,
    entityType: 'audit_pack',
    entityId: pack.id,
    eventType: 'pack.demo_seeded',
    actorId: userId,
    summary: `Zasiano pakiet demonstracyjny „${pack.title}"`,
  });

  return getPack(organizationId, pack.id);
}
