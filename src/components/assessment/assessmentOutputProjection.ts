/**
 * assessmentOutputProjection — JEDNO miejsce, w którym moduł Ocena scala DWA
 * magazyny wyników w jeden kształt.
 *
 * ★ PO CO TO ISTNIEJE (zmierzone, nie założone). Moduł Ocena trzyma wyniki
 * w dwóch niezależnych magazynach:
 *
 *   (a) KANONICZNY — jądro method-core: `method_outputs` + `method_findings`,
 *       czytane przez `GET /api/method/outputs[/:id]`. Tu trafia wynik, który
 *       sesja assessmentu ZAMROZIŁA (`POST /sessions/:id/freeze`).
 *   (b) ZASTANY (legacy) — klasyczna tabela `assessments` (kolumna
 *       `answers_json`, kształt `answers.drd.areas`) plus `assessment_reports`,
 *       czytane przez `GET /api/v8/assessment/:id` i `GET /api/assessment-reports`.
 *       Tu leżą oceny prowadzone w warsztacie DRD, które nigdy nie przeszły
 *       przez zamrożenie jądra.
 *
 * Pomiar z 06.09 (dwa środowiska, zapytania wprost do bazy, nie do kodu):
 *   • stanowisko lokalne, org DBR77 — `assessments` 4, `assessment_reports` 4,
 *     `method_outputs` 0, `method_sessions` 0;
 *   • staging, org właściciela `a3e05d4a-…` — `assessments` 10,
 *     `assessment_reports` 1, `method_outputs` 1, `method_sessions` 3.
 * Czyli 10 z 11 realnych ocen właściciela leży w magazynie ZASTANYM, a lista
 * Outputów i trasa raportu (`/assessment/outputs/:id/report`) czytały wyłącznie
 * magazyn KANONICZNY. Skutek widoczny dla właściciela: pusta lista i „Nie
 * znaleziono zamrożonego Outputu" zamiast raportu z jego własnej oceny.
 *
 * ★ WZORZEC. To ten sam ruch, który naprawił Inicjatywy
 * (`src/components/Initiatives/initiativeRegisterProjection.ts`,
 * `mergeLegacyInitiativesIntoRegister`): obie listy normalizujemy do JEDNEGO
 * kształtu, kluczem dopasowania jest czyste `id`, przy kolizji wygrywa
 * KANONICZNA (jest bogatsza i autorytatywna), a wiersze zastane tylko
 * DOPEŁNIAJĄ lukę i są doklejane na koniec.
 *
 * ★ CZEGO TU NIE MA — i dlaczego. Nie liczymy tu ani jednej nowej liczby:
 * `achievedLevel` → `current`, `targetLevel` → `target`, `gap` = różnica tych
 * dwóch (jedyne działanie arytmetyczne, ta sama definicja co w jądrze).
 * Obszar bez pomiaru NIE dostaje wpisu, więc raport pokazuje go jako
 * „nie rozstrzygnięto" (—), a nie jako zmierzone zero. Żaden tekst
 * (wnioski, rekomendacje, notatki) nie jest tu wymyślany — wszystko pochodzi
 * z zapisanych wierszy, a projekcja zastana jest oznaczona `source: 'legacy'`,
 * żeby dokument mógł to czytelnikowi powiedzieć wprost.
 */
import type { MethodOutputListItem } from '@/method-core/api/methodCoreApi';

import {
  DRD_METHOD_PACK_ID,
  DRD_METHOD_PACK_VERSION,
} from '@/method-core/methods/drd/compileDrdPack';

import type { FullAssessmentOutput } from './report/types';

/** Wiersz z `GET /api/assessments` (lista) — tylko pola, których naprawdę
 * używamy. Endpoint celowo NIE zwraca `answers_json`, więc lista potrafi
 * pokazać wiersz, a treść macierzy dociąga dopiero trasa raportu. */
export interface LegacyAssessmentListRow {
  readonly id: string;
  readonly organizationId?: string | null;
  readonly name?: string | null;
  readonly status?: string | null;
  readonly type?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly progress?: number | null;
}

/** Pojedynczy obszar w `answers.drd.areas` (kształt zapisywany przez warsztat DRD). */
export interface LegacyDrdArea {
  readonly achievedLevel?: number | null;
  readonly targetLevel?: number | null;
  readonly levelNotes?: Readonly<Record<string, string>> | null;
}

/** Pełny wiersz oceny z `GET /api/v8/assessment/:id` (pole `answers`). */
export interface LegacyAssessmentDetail {
  readonly id: string;
  readonly organization_id?: string | null;
  readonly name?: string | null;
  readonly status?: string | null;
  readonly framework_type?: string | null;
  readonly assessment_type?: string | null;
  readonly created_at?: string | null;
  readonly updated_at?: string | null;
  readonly completionPercent?: number | null;
  readonly answers?: unknown;
}

/** Treść raportu zastanego (`GET /api/assessment-reports/:id`). */
export interface LegacyReportNarrative {
  readonly reportId: string;
  readonly reportName: string | null;
  readonly reportStatus: string | null;
  readonly executiveSummary: string | null;
  readonly detailedAnalysis: string | null;
  readonly recommendations: readonly string[];
}

function czyLiczbaPoziomu(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function tekstAlboNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

/**
 * Wyciąga poziomy obecny/docelowy per obszar z `answers_json`.
 *
 * Obsługuje DWA kształty spotkane w realnych danych (zmierzone, nie zgadnięte):
 *   • `answers.drd.areas['1A'] = { achievedLevel, targetLevel, levelNotes }`
 *     — warsztat DRD, stanowisko lokalne i 5 z 10 ocen właściciela;
 *   • `answers.drd.<filar>.areaScores['1A'] = [obecny, docelowy]`
 *     — starszy zapis kreatora, pozostałe oceny właściciela na stagingu.
 * Wartość 0 traktujemy jako BRAK pomiaru (skala DRD zaczyna się od 1), więc
 * obszar bez odpowiedzi nie udaje zmierzonego zera.
 */
export function odczytajPoziomyZOdpowiedzi(answers: unknown): {
  current: Record<string, number | null>;
  target: Record<string, number | null>;
  notes: Record<string, string>;
} {
  const current: Record<string, number | null> = {};
  const target: Record<string, number | null> = {};
  const notes: Record<string, string> = {};
  if (!answers || typeof answers !== 'object') return { current, target, notes };
  const drd = (answers as { drd?: unknown }).drd;
  if (!drd || typeof drd !== 'object') return { current, target, notes };

  const areas = (drd as { areas?: unknown }).areas;
  if (areas && typeof areas === 'object') {
    for (const [areaId, raw] of Object.entries(areas as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const area = raw as LegacyDrdArea;
      if (czyLiczbaPoziomu(area.achievedLevel)) current[areaId] = area.achievedLevel;
      if (czyLiczbaPoziomu(area.targetLevel)) target[areaId] = area.targetLevel;
      const levelNotes = area.levelNotes;
      if (levelNotes && typeof levelNotes === 'object') {
        // Notatka przypisana do poziomu OBECNEGO jest tą, którą konsultant
        // napisał o stanie zastanym — ona ma sens w raporcie. Notatki innych
        // poziomów zostają w warsztacie; nie zlepiamy ich w jeden akapit.
        const klucz = czyLiczbaPoziomu(area.achievedLevel) ? String(area.achievedLevel) : null;
        const nota = klucz ? tekstAlboNull((levelNotes as Record<string, unknown>)[klucz]) : null;
        if (nota) notes[areaId] = nota;
      }
    }
  }

  for (const filar of Object.values(drd as Record<string, unknown>)) {
    if (!filar || typeof filar !== 'object') continue;
    const areaScores = (filar as { areaScores?: unknown }).areaScores;
    if (!areaScores || typeof areaScores !== 'object') continue;
    for (const [areaId, para] of Object.entries(areaScores as Record<string, unknown>)) {
      if (!Array.isArray(para)) continue;
      // Kształt `areas` (nowszy, bogatszy) wygrywa nad `areaScores` — ta sama
      // reguła co przy scalaniu list: kanoniczne/bogatsze nie jest nadpisywane.
      if (!(areaId in current) && czyLiczbaPoziomu(para[0])) current[areaId] = para[0] as number;
      if (!(areaId in target) && czyLiczbaPoziomu(para[1])) target[areaId] = para[1] as number;
    }
  }

  return { current, target, notes };
}

function policzLuki(
  current: Readonly<Record<string, number | null>>,
  target: Readonly<Record<string, number | null>>
): Record<string, number | null> {
  const gap: Record<string, number | null> = {};
  for (const areaId of new Set([...Object.keys(current), ...Object.keys(target)])) {
    const c = current[areaId];
    const t = target[areaId];
    gap[areaId] = typeof c === 'number' && typeof t === 'number' ? t - c : null;
  }
  return gap;
}

/** Prefiks id wiersza zastanego w liście Outputów i w URL raportu.
 * Osobna przestrzeń nazw = zero ryzyka, że id oceny zastanej zostanie wzięte
 * za id zamrożonego Outputu jądra (i odwrotnie). Znak `~` jest bezpieczny
 * w segmencie ścieżki URL i nie wymaga kodowania. */
export const PREFIKS_OCENY_ZASTANEJ = 'ocena~';

export function idWierszaZastanego(assessmentId: string): string {
  return `${PREFIKS_OCENY_ZASTANEJ}${assessmentId}`;
}

/** `null`, gdy id nie należy do przestrzeni zastanej. */
export function idOcenyZWierszaZastanego(rowId: string): string | null {
  return rowId.startsWith(PREFIKS_OCENY_ZASTANEJ)
    ? rowId.slice(PREFIKS_OCENY_ZASTANEJ.length) || null
    : null;
}

/** Wiersz listy Outputów zbudowany z oceny zastanej. Pola, których magazyn
 * zastany nie ma (hash treści, wersja rewizji, zamrożenie), zostają `null` —
 * lista pokaże „—", zamiast udawać, że wynik został zamrożony. */
export function projektujOceneZastanaNaWierszListy(
  row: LegacyAssessmentListRow
): MethodOutputListItem {
  return {
    id: idWierszaZastanego(row.id),
    organizationId: row.organizationId ?? null,
    sessionId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: null,
    outputVersion: null,
    revisionOfOutputId: null,
    scope: tekstAlboNull(row.name) ?? row.id,
    limitationsCount: null,
    findingsCount: null,
    contentHash: null,
    frozenAt: null,
    createdAt: row.createdAt ?? null,
    demoBypassActive: false,
    isSuperseded: false,
    supersededByOutputId: null,
  };
}

/**
 * Scala listę kanoniczną z listą zastaną. Reguła 1:1 jak w Inicjatywach:
 * klucz = `id`, przy kolizji wygrywa wiersz KANONICZNY, wiersze zastane
 * doklejane na koniec. Gdy nie ma czego dokleić, zwracamy tę SAMĄ referencję
 * tablicy — React nie przerysowuje bez powodu.
 *
 * Uwaga o kluczu (świadome ograniczenie, nie przeoczenie): magazyn kanoniczny
 * nie niesie ŻADNEGO odnośnika do id oceny zastanej — `method_sessions` nie ma
 * kolumny wskazującej na `assessments`. Dopasowanie po nazwie byłoby zgadywaniem,
 * więc go nie ma; wiersze zastane żyją we własnej przestrzeni id (`ocena~…`)
 * i kolizja jest z definicji niemożliwa. Cena: ocena, którą KTOŚ zamroził do
 * jądra, może pokazać się dwa razy — raz jako Output, raz jako wiersz zastany.
 * Wybór świadomy: duplikat jest widoczny i wytłumaczalny, zniknięcie realnej
 * oceny właściciela — nie.
 */
export function scalOcenyZastaneZOutputami(
  kanoniczne: readonly MethodOutputListItem[],
  zastane: readonly MethodOutputListItem[]
): MethodOutputListItem[] {
  if (zastane.length === 0) return kanoniczne as MethodOutputListItem[];
  const idKanoniczne = new Set(kanoniczne.map((row) => row.id));
  const dodatkowe = zastane.filter((row) => !idKanoniczne.has(row.id));
  if (dodatkowe.length === 0) return kanoniczne as MethodOutputListItem[];
  return [...kanoniczne, ...dodatkowe];
}

/**
 * Projekcja pełnej oceny zastanej na kształt zamrożonego Outputu, którego
 * oczekuje `AssessmentReportDocument`.
 *
 * `methodPackVersion` bierzemy z pakietu SKOMPILOWANEGO w tej wersji aplikacji
 * (`DRD_METHOD_PACK_VERSION`), bo ocena zastana nie przypięła żadnej wersji
 * metodyki — to jedyna wersja, o której cokolwiek wiemy. Dzięki temu słownik
 * nazw osi/obszarów i opisy poziomów w ogóle się rozwiążą (przy niezgodnej
 * wersji `drdLabels` zwraca `null` i dokument degraduje się do gołych liczb).
 * Dokument oznacza taki raport jako pochodzący z zapisu sesji, nie z zamrożenia.
 */
export function projektujOceneZastanaNaOutput(
  assessment: LegacyAssessmentDetail
): { output: FullAssessmentOutput; notatkiObszarow: Record<string, string> } {
  const { current, target, notes } = odczytajPoziomyZOdpowiedzi(assessment.answers);
  const gap = policzLuki(current, target);
  const utworzono = assessment.created_at ?? assessment.updated_at ?? '';

  const output: FullAssessmentOutput = {
    id: idWierszaZastanego(assessment.id),
    organizationId: assessment.organization_id ?? '',
    sessionId: '',
    snapshotId: '',
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    outputVersion: 1,
    revisionOfOutputId: null,
    scope: tekstAlboNull(assessment.name) ?? assessment.id,
    current,
    target,
    gap,
    // Agregacja per-oś jest regułą metody liczoną przez adapter przy
    // zamrażaniu. Ocena zastana nigdy przez to nie przeszła, więc mówimy
    // „brak", zamiast policzyć średnią własnym pomysłem.
    aggregation: null,
    visualModel: null,
    evidenceCompleteness: null,
    limitations: [
      'Wynik pochodzi z zapisu sesji oceny (magazyn zastany), a nie z zamrożonego, niezmiennego Outputu jądra metodycznego — liczby mogą się jeszcze zmienić, dopóki ocena nie zostanie zamrożona.',
      'Obszary bez odpowiedzi nie są pokazywane jako zero, tylko jako „—" (nie rozstrzygnięto).',
      'Materiał dowodowy i ślad zatwierdzeń nie istnieją dla ocen z magazynu zastanego — dlatego każdy obszar jest oznaczony jako „brak przyjętego dowodu".',
    ],
    findings: [],
    prioritisationResult: null,
    sourceRevisionOfSessionId: null,
    contentHash: '',
    createdAt: utworzono,
    frozenAt: '',
    demoBypassActive: false,
  };

  return { output, notatkiObszarow: notes };
}

/** Normalizuje odpowiedź `GET /api/assessment-reports/:id` do treści, którą
 * dokument może pokazać. Puste pola zostają `null` — dokument narysuje wtedy
 * „—"/pominie blok, nigdy wypełniacz. */
export function projektujRaportZastanyNaTresc(raw: unknown): LegacyReportNarrative | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = tekstAlboNull(r.id);
  if (!id) return null;
  const content = (r.content && typeof r.content === 'object' ? r.content : {}) as Record<
    string,
    unknown
  >;
  const rekomendacje = Array.isArray(content.recommendations)
    ? content.recommendations.map(tekstAlboNull).filter((s): s is string => !!s)
    : [];
  return {
    reportId: id,
    reportName: tekstAlboNull(r.name),
    reportStatus: tekstAlboNull(r.status),
    executiveSummary: tekstAlboNull(content.executiveSummary),
    detailedAnalysis: tekstAlboNull(content.detailedAnalysis) ?? tekstAlboNull(content.notes),
    recommendations: rekomendacje,
  };
}

/** Wiersz zakładki „Raporty" (`AssessmentHub`, gałąź `case 'reports'`) —
 * wyłącznie pola, których potrzebuje wybór celu dla „Otwórz". */
export interface WierszRaportuOceny {
  readonly id: string;
  readonly assessmentId?: string | null;
  readonly _isImported?: boolean | null;
}

/**
 * [ODMROZENIE 04_ASSESSMENT DEC-397] Trasa, pod którą „Otwórz" ma pokazać
 * RAPORT OCENY, albo `null`, gdy dokument nie jest raportem oceny i ma
 * zostać przy Kreatorze raportów.
 *
 * ★ PO CO (zmierzone 06.09 na stanowisku lokalnym, nie założone). Zakładka
 * Ocena → Raporty → wiersz „DRD Manufacturing … (Zatwierdzone, 100 %)" →
 * podgląd → „Otwórz" prowadziło do `/reports/builder/report-drd-test-exec`,
 * czyli do PUSTEGO kreatora („Zacznij budować raport", zero bloków —
 * `GET /api/report-builder/report-drd-test-exec` nie ma pola `sections`),
 * podczas gdy ta sama ocena pod `/assessment/outputs/ocena~assess-drd-
 * manufacturing-01/report` rysuje pełny raport: 4 rozdziały, macierz DRD
 * dla 7 osi, 39 obszarów i przepisaną treść raportu (17 pozycji).
 * Właściciel widział „raport zatwierdzony w 100 %", klikał „Otwórz"
 * i dostawał pustą kartkę.
 *
 * ★ REGUŁA. Raport, który MA ocenę źródłową (`assessmentId`), jest raportem
 * oceny — jego kanoniczny CZYTNIK to `AssessmentReportDocument`. Kreator
 * raportów zostaje ścieżką EDYCJI (podgląd: „Otwórz w edytorze",
 * kebab: „Edytuj” → `/reports/builder/:id`), więc żadna praca zrobiona
 * w kreatorze nie znika — zmienia się tylko to, co robi „Otwórz”.
 * Raport bez oceny źródłowej i import PDF zostają bez zmian.
 *
 * ★ KTÓRY IDENTYFIKATOR. Ten sam wybór, co na liście „Wnioski": ocena
 * obecna w magazynie ZASTANYM (tabela `assessments`, przekazana tu jako
 * `idOcenZastanych`) dostaje przestrzeń `ocena~<id>`; każdy inny
 * identyfikator idzie surowy — `fetchOutputForReport` rozstrzyga wtedy
 * sam (UUID → jądro, reszta → magazyn zastany, z wzajemnym odwrotem
 * przy 404). Nie zgadujemy tu niczego, czego nie widać w danych.
 */
export function trasaOtwarciaRaportuOceny(
  row: WierszRaportuOceny,
  idOcenZastanych: ReadonlySet<string>
): string | null {
  if (row._isImported) return null;
  const assessmentId = tekstAlboNull(row.assessmentId);
  if (!assessmentId) return null;
  const outputId = idOcenZastanych.has(assessmentId)
    ? idWierszaZastanego(assessmentId)
    : assessmentId;
  return `/assessment/outputs/${encodeURIComponent(outputId)}/report`;
}
