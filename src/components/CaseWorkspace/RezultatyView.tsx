/**
 * Zlecenie → sekcja REZULTATY (centrum powłoki artefaktu, archetyp C).
 *
 * Rezultaty to OBIEKTY DOMENOWE, nie lista wygenerowanych plików
 * (`02_INFORMATION_ARCHITECTURE_AND_UX.md` §7): cztery osie zamknięcia,
 * zmierzona wartość i powiązane obiekty z innych modułów.
 *
 * ★ CO SIĘ TU ZMIENIŁO (2026-08-10) — wyniki i rezultaty REALNIE SIĘ OTWIERAJĄ.
 * Do tej pory ten plik nie miał ANI JEDNEGO `href`/`navigate`/`window.open`:
 * tabela „Powiązane obiekty" pokazywała, że dokument istnieje, i na tym się
 * kończyło. Otwieranie idzie teraz KANONICZNĄ drogą całej aplikacji —
 * `getArtifactPath(type, id)` z `src/utils/artifactLinks.ts`, czyli dokładnie
 * ten sam adres, którym otwierają swoje obiekty Decyzje
 * (`DecisionWorkspace.tsx:332`), Rezultaty (`ReportDocumentView.tsx:593`) i
 * podgląd Materiałów (`ReportsAndPresentations/artifactNavigation.ts:36-38`).
 * Zero własnej tablicy tras — jedno źródło prawdy dla całego produktu.
 *
 * ★ UCZCIWE STANY zamiast ślepej uliczki. Backend trzyma `artifact_type` jako
 * ZWYKŁY STRING (`artifactLinkService.ts:180-199` — „NOT a DB CHECK enum"),
 * a `link_status` osobno niesie `UNAVAILABLE`/`UNLINKED`. Dlatego przycisk
 * „Otwórz" nie zgaduje adresu: gdy typ jest spoza mapy modułów albo obiekt
 * jest niedostępny/odpięty, przycisk jest wyłączony, a podgląd MÓWI DLACZEGO
 * i zostawia bezpieczne wyjście (powrót do zlecenia i do listy). Nigdy cicha
 * pustka, nigdy skok pod zmyślony adres.
 *
 * Wartość rozróżnia punkt wyjścia, cel, wynik i pewność pomiaru — a stan
 * „brak dowodu" jest osobny od „nieosiągnięte". UI tego nie spłaszcza.
 */

import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  ClipboardCheck,
  Link2,
  Unlink,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getDocumentStudioArtifact } from '@/components/DocumentStudio/api';
import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import {
  ARTIFACT_IDENTITY,
  type ArtifactType,
  getArtifactPath,
  parseArtifactRef,
} from '@/utils/artifactLinks';
import {
  artifactLinkRelationLabel,
  artifactLinkStatusLabel,
  closureAxisLabel,
  closureAxisStatusLabel,
  closureTypeLabel,
  linkedTypeLabel,
  measurementConfidenceLabel,
  planNodeTypeLabel,
  valueMeasurementStatusLabel,
} from '@/utils/enumLabels';

import { resolveArtifactLinkOpen } from './api';
import {
  type CaseRunBinding,
  deliverableRefFromSnapshot,
  getRunBinding,
  listNodeResultAcceptancesForCase,
  nodeCompletionStateLabel,
  type NodeResultAcceptance,
  resultAcceptanceLabel,
  resultAcceptanceTone,
  summaryFromSnapshot,
  toFailure,
} from './apiResults';
import type {
  ArtifactLinkOpenResolution,
  ArtifactLinkReturnContext,
  CaseApiFailure,
  CaseArtifactLink,
  CaseCoreView,
  ValueMeasurement,
} from './types';
import { CaseStateBlock, FOCUS_RING, formatDate, formatDateTime, StatusTag, TechnicalId } from './ui';

// ═══════════════════════════════════════════════════════════════════════════
// OTWIERANIE OBIEKTÓW — jedno miejsce dla całego modułu
// ═══════════════════════════════════════════════════════════════════════════
//
// Powłoka zlecenia (`CaseDetailScreen`) importuje te funkcje, zamiast pisać
// własne: przycisk główny Menu 1, sekcja „Powiązania" prawego panelu i tabela
// niżej MUSZĄ prowadzić pod ten sam adres. Gdyby każde z tych trzech miejsc
// liczyło trasę osobno, rozjazd byłby kwestią czasu — a rozjazd tras to
// dokładnie ta klasa błędu, którą `getArtifactPath` w tym repo już raz
// zlikwidował („preview »Otwórz« must not fork truth").

/**
 * `case_workspace_artifact_links.artifact_type` → typ artefaktu aplikacji.
 *
 * Lewa strona to wartości, których realnie używa backend Zleceń
 * (`KNOWN_ARTIFACT_TYPES` w `artifactLinkService.ts:187-199`) plus warianty
 * zapisu spotykane w innych modułach. Prawa strona to `ArtifactType` —
 * jedyny wejściowy typ `getArtifactPath`.
 *
 * ŚWIADOMIE NIEKOMPLETNA. `mind_map`, `whiteboard`, `process_flow` i `raid`
 * NIE mają dziś w `getArtifactPath` własnego celu (`artifactLinks.ts:258-303`
 * — te typy nie występują w `getBasePath`), więc każde ich „otwarcie"
 * lądowałoby na domyślnym `/my-work` bez wskazanego obiektu, czyli w pustce
 * udającej sukces. Wolimy powiedzieć wprost „tego typu jeszcze nie umiemy
 * otworzyć" niż wysłać użytkownika w ślepą uliczkę.
 */
export const TYP_OBIEKTU_NA_MODUL: Record<string, ArtifactType> = {
  decision: 'decision',
  initiative: 'initiative',
  task: 'task',
  kpi: 'kpi',
  insight: 'insight',
  assessment: 'assessment',
  project: 'project',
  risk: 'risk',
  idea: 'idea',
  meeting: 'meeting',
  tool: 'tool',
  tool_session: 'tool_session',
  notification: 'notification',
  notebook: 'notebook',
  note: 'notebook',
  // Materiały — dokument, prezentacja, arkusz (trzy generatory, trzy moduły).
  document: 'report',
  report: 'report',
  wordy: 'report',
  presentation: 'presentation',
  deck: 'presentation',
  sheet: 'sheet',
  table: 'sheet',
  workbook: 'sheet',
  spreadsheet: 'sheet',
  // Finanse.
  financial_model: 'financial_model',
  budget: 'budget',
  valuation: 'valuation',
  analysis: 'analysis',
  knowledge: 'knowledge',
};

export type OtwarcieObiektu =
  | {
      status: 'otwieralny';
      sciezka: string;
      etykieta: string;
      /**
       * Tylko dla stanu backendowego STALE (`ArtifactLinkOpenState`):
       * obiekt nadal da się otworzyć, ale przypięta rewizja jest starsza —
       * uczciwie oznaczone, nigdy ślepa uliczka.
       */
      ostrzezenie?: string;
      /**
       * Obecny WYŁĄCZNIE, gdy klasyfikacja przyszła z autorytatywnego
       * odczytu backendu (`resolveArtifactLinkOpen`), nie z samego już
       * wczytanego `CaseArtifactLink`. Powłoka (`CaseDetailScreen`) niesie
       * to dalej do migawki powrotu („ta sama faza Zlecenia i grupa
       * Rezultatów", doc 03 §5).
       */
      returnContext?: ArtifactLinkReturnContext;
    }
  | { status: 'niedostepny'; powod: string }
  | { status: 'odpiety'; powod: string }
  | { status: 'nieznany-typ'; powod: string };

/** Stabilny klucz fokusu elementu „Otwórz" — powłoka przywraca po nim fokus. */
export function kluczFokusuObiektu(linkId: string): string {
  return `obiekt:${linkId}`;
}

/** Stabilny klucz fokusu dowodu przy pomiarze wartości. */
export function kluczFokusuDowodu(measurementId: string): string {
  return `dowod:${measurementId}`;
}

/**
 * Czy i jak da się otworzyć obiekt powiązany ze zleceniem.
 *
 * Kolejność sprawdzeń jest istotna: najpierw stan POWIĄZANIA (to fakt z bazy,
 * `link_status`), potem znajomość typu (to ograniczenie naszej nawigacji).
 * Odwrotna kolejność kazałaby nam mówić „nie znamy typu" o obiekcie, który
 * backend już oznaczył jako niedostępny — czyli mylić własną lukę z faktem.
 */
export function rozstrzygnijOtwarcie(link: CaseArtifactLink): OtwarcieObiektu {
  const etykietaTypu = linkedTypeLabel(link.artifactType, true) || link.artifactType;

  if (link.linkStatus === 'UNAVAILABLE') {
    return {
      status: 'niedostepny',
      powod:
        `Moduł źródłowy zgłosił, że tego obiektu nie da się dziś otworzyć ` +
        `(usunięty, wycofany albo poza Twoją organizacją). Zlecenie pamięta, ` +
        `że był — dlatego nie znika z listy.`,
    };
  }
  if (link.linkStatus === 'UNLINKED') {
    return {
      status: 'odpiety',
      powod:
        `Powiązanie zostało odpięte od tego zlecenia. Obiekt może nadal ` +
        `istnieć w swoim module, ale nie jest już rezultatem tego zlecenia.`,
    };
  }

  const typ = TYP_OBIEKTU_NA_MODUL[String(link.artifactType || '').toLowerCase()];
  if (!typ) {
    return {
      status: 'nieznany-typ',
      powod:
        `Consultify nie ma jeszcze ekranu, który otwiera obiekt rodzaju ` +
        `„${etykietaTypu}". Nie zgadujemy adresu — zgadnięty link wyrzuciłby ` +
        `Cię na pustą stronę zamiast pokazać rezultat.`,
    };
  }

  return {
    status: 'otwieralny',
    sciezka: getArtifactPath(typ, link.artifactId),
    etykieta: etykietaTypu,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// OTWARCIE Z BACKENDU — `GET /artifact-links/:linkId/open` (pakiet B5/C4)
// ═══════════════════════════════════════════════════════════════════════════
//
// `rozstrzygnijOtwarcie` wyżej klasyfikuje WYŁĄCZNIE z już wczytanego
// `CaseArtifactLink` (`listArtifactLinksForCase`) — dobre jako pierwszy,
// nie-migoczący render, ale to NIE jest odczyt aktualny w chwili kliknięcia:
// między wczytaniem zlecenia a kliknięciem „Otwórz" ktoś inny mógł oznaczyć
// link jako `UNAVAILABLE`/`UNLINKED`/nieaktualny. `resolveArtifactLinkOpen`
// odpowiada na oba pytania NA ŻYWO w jednym wywołaniu: czy dziś wolno
// otworzyć (AVAILABLE/STALE/UNAVAILABLE/DELETED, z prawdziwym powodem —
// `staleReason`/`unavailableReason`/`unlinkReason`) i dokąd wraca się z
// powrotem (`returnContext`: `caseId`/`casePhase`/`resultsGroup`).
//
// Wzorzec identyczny jak przy weryfikacji dokumentów niżej: START zawsze z
// `rozstrzygnijOtwarcie` (bez flashu złego stanu), NADPISANIE dokłada
// pewność z backendu, nigdy jej nie zdejmuje. Cache per `linkId`, żeby
// dziesięć wierszy tej samej tabeli (i Menu 1 w `CaseDetailScreen`, który
// używa TEJ SAMEJ funkcji) nie odpalało dziesięciu identycznych zapytań.
const otwarcieBackenduCache = new Map<string, Promise<ArtifactLinkOpenResolution | null>>();

/**
 * `null` = wynik NIEJEDNOZNACZNY (sieć/401/404/500/timeout) — celowo NIE
 * nadpisujemy klasyfikacji klienta w dół z powodu chwilowej awarii backendu;
 * `resolveArtifactLinkOpen` jest odczytem WZBOGACAJĄCYM, nie jedynym źródłem
 * prawdy o otwieralności.
 */
function pobierzOtwarcieBackendu(linkId: string): Promise<ArtifactLinkOpenResolution | null> {
  let cached = otwarcieBackenduCache.get(linkId);
  if (!cached) {
    cached = resolveArtifactLinkOpen(linkId).catch(() => null);
    otwarcieBackenduCache.set(linkId, cached);
  }
  return cached;
}

/**
 * Tłumaczy autorytatywną odpowiedź backendu na ten sam kształt, którego
 * używa cała reszta modułu (`OtwarcieObiektu`). Etykieta typu i BAZOWY adres
 * nadal idą przez `TYP_OBIEKTU_NA_MODUL`/`getArtifactPath` — jedno źródło
 * prawdy tras (nagłówek pliku) — backend daje tylko FAKTY (stan, powód,
 * `artifactId`/`artifactRevision` z `deepLink`), nigdy gotowego URL-a.
 */
function otwarcieZOdpowiedziBackendu(
  link: CaseArtifactLink,
  resolution: ArtifactLinkOpenResolution
): OtwarcieObiektu {
  const etykietaTypu = linkedTypeLabel(link.artifactType, true) || link.artifactType;

  if (resolution.state === 'UNAVAILABLE') {
    return {
      status: 'niedostepny',
      powod: resolution.unavailableReason
        ? `Moduł źródłowy potwierdził, że tego obiektu („${etykietaTypu}") już nie ma: ` +
          `${resolution.unavailableReason}.`
        : `Moduł źródłowy potwierdził, że tego obiektu („${etykietaTypu}") nie da się dziś ` +
          `otworzyć. Zlecenie pamięta, że był — dlatego nie znika z listy.`,
    };
  }
  if (resolution.state === 'DELETED') {
    return {
      status: 'odpiety',
      powod: resolution.unlinkReason
        ? `Powiązanie zostało odpięte od tego zlecenia: ${resolution.unlinkReason}.`
        : `Powiązanie zostało odpięte od tego zlecenia. Obiekt może nadal istnieć w swoim ` +
          `module, ale nie jest już rezultatem tego zlecenia.`,
    };
  }

  // AVAILABLE lub STALE — backend gwarantuje `deepLink` dla obu (patrz
  // `ArtifactLinkOpenResolution.deepLink` w `types.ts`).
  const typZrodla = resolution.deepLink?.artifactType ?? link.artifactType;
  const idZrodla = resolution.deepLink?.artifactId ?? link.artifactId;
  const typ = TYP_OBIEKTU_NA_MODUL[String(typZrodla || '').toLowerCase()];
  if (!typ || !resolution.deepLink) {
    return {
      status: 'nieznany-typ',
      powod:
        `Consultify nie ma jeszcze ekranu, który otwiera obiekt rodzaju ` +
        `„${etykietaTypu}". Nie zgadujemy adresu — zgadnięty link wyrzuciłby ` +
        `Cię na pustą stronę zamiast pokazać rezultat.`,
    };
  }

  const sciezka = getArtifactPath(typ, idZrodla);

  if (resolution.state === 'STALE') {
    return {
      status: 'otwieralny',
      sciezka,
      etykieta: etykietaTypu,
      returnContext: resolution.returnContext,
      ostrzezenie: resolution.staleReason
        ? `Przypięta rewizja jest starsza: ${resolution.staleReason}.`
        : 'Przypięta rewizja jest starsza niż aktualna wersja obiektu.',
    };
  }
  return {
    status: 'otwieralny',
    sciezka,
    etykieta: etykietaTypu,
    returnContext: resolution.returnContext,
  };
}

/**
 * Hook: dogania klasyfikację KAŻDEGO powiązania o autorytatywny stan
 * backendu (`resolveArtifactLinkOpen`), po jednym wywołaniu na `linkId`.
 * Współdzielony przez `RezultatyView` i `CaseDetailScreen` (Menu 1 „Otwórz
 * rezultat" + panel „Powiązania") — TA SAMA klasyfikacja wszędzie, bo cache
 * jest per `linkId` na poziomie modułu, nie per instancja komponentu.
 */
export function useOtwarciaZBackendu(
  artifactLinks: CaseArtifactLink[]
): Record<string, OtwarcieObiektu> {
  const [nadpisania, setNadpisania] = useState<Record<string, OtwarcieObiektu>>({});

  useEffect(() => {
    let anulowano = false;
    artifactLinks.forEach((link) => {
      pobierzOtwarcieBackendu(link.linkId).then((resolution) => {
        if (anulowano || !resolution) return;
        setNadpisania((prev) => ({
          ...prev,
          [link.linkId]: otwarcieZOdpowiedziBackendu(link, resolution),
        }));
      });
    });
    return () => {
      anulowano = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- linkId-owy skład, nie referencja tablicy
  }, [artifactLinks.map((l) => l.linkId).join(',')]);

  return nadpisania;
}

// ═══════════════════════════════════════════════════════════════════════════
// WERYFIKACJA ISTNIENIA — dogania klasyfikację o fakt z modułu docelowego
// ═══════════════════════════════════════════════════════════════════════════
//
// ★ ZMIERZONE NA ŻYWEJ BAZIE (2026-08-10, `case_workspace_test`): 0 z 70
// powiązań typu „document" w `case_workspace_artifact_links` wskazuje realny
// wiersz w `wave5_artifacts` (tabeli, z której czyta `GET
// /api/document-studio/:artifactId`). Powód jest udokumentowany wprost w
// `artifactLinkService.ts:432` — `linkArtifactToCase` świadomie NIE
// sprawdza, czy `artifactId` istnieje w swoim module przy powiązaniu.
// `rozstrzygnijOtwarcie` wyżej klasyfikuje WYŁĄCZNIE po znanym typie +
// `link_status` — to jedyne dane, jakie ma; „otwieralny" nie jest więc
// dowodem, że cel istnieje, tylko że NIC dotąd nie powiedziało, że nie
// istnieje. Zaobserwowane na żywo: `cwlink-doc-otwieralny` (relacja
// DELIVERABLE, pierwszeństwo w Menu 1 „Otwórz rezultat") renderował się jako
// aktywny przycisk, a kliknięcie kończyło się na „Nie znaleziono tego
// dokumentu" w Document Studio — poprawny routing, martwa dana.
//
// Doganiamy to JEDNYM bezpiecznym odczytem (ten sam GET, którego Document
// Studio i tak wywołuje przy zwykłym otwarciu — brak efektów ubocznych poza
// normalną ścieżką odczytu), z cache per `artifactId`, żeby dziesięć wierszy
// tej samej tabeli nie odpalało dziesięciu identycznych zapytań. Zasięg:
// WYŁĄCZNIE typ 'report' (Dokument/Document Studio) — to jedyny typ, dla
// którego luka została tu zmierzona; inne typy (prezentacja, arkusz, decyzja…)
// zostają przy klasyfikacji z samego linku, bo weryfikacja każdego z nich
// wymagałaby osobnego, nieprzetestowanego wywołania API cudzego modułu.
const weryfikacjaDokumentowCache = new Map<string, Promise<boolean>>();

/**
 * `true` = dokument realnie istnieje w Document Studio; `false` = potwierdzone
 * 404; `true` też przy błędzie NIEJEDNOZNACZNYM (sieć/401/500/timeout) — nie
 * zgadujemy „nie istnieje" z powodu chwilowej awarii, bo wtedy wyłączylibyśmy
 * DZIAŁAJĄCY przycisk. Jedyny pewny sygnał do wyłączenia to potwierdzone 404.
 */
export function weryfikujIstnienieDokumentu(artifactId: string): Promise<boolean> {
  let cached = weryfikacjaDokumentowCache.get(artifactId);
  if (!cached) {
    cached = getDocumentStudioArtifact(artifactId)
      .then(() => true)
      .catch((error: unknown) => {
        const status = (error as { status?: number } | undefined)?.status;
        return status !== 404;
      });
    weryfikacjaDokumentowCache.set(artifactId, cached);
  }
  return cached;
}

/**
 * Czy powiązanie wskazuje obiekt typu Dokument (Document Studio).
 *
 * ★ PUŁAPKA, w którą sam pierwotnie wpadłem przy tej naprawie: `link.artifactType`
 * to SUROWA wartość z bazy (`'document'`/`'DOCUMENT'`), a `'report'` jest
 * WEWNĘTRZNYM kluczem `ArtifactType`, na który `TYP_OBIEKTU_NA_MODUL` ją
 * dopiero tłumaczy (`getArtifactPath`/`rozstrzygnijOtwarcie` wyżej). Prosto
 * porównanie `link.artifactType.toLowerCase() === 'report'` jest więc ZAWSZE
 * fałszywe — weryfikacja nigdy by się nie odpaliła. Idziemy przez TĘ SAMĄ
 * mapę, której używa klasyfikacja, żeby nie rozjechać definicji „typ Dokument"
 * na dwa niezależne miejsca.
 */
export function jestPowiazaniemDokumentu(link: Pick<CaseArtifactLink, 'artifactType'>): boolean {
  return TYP_OBIEKTU_NA_MODUL[String(link.artifactType ?? '').toLowerCase()] === 'report';
}

/**
 * Dowód przy pomiarze wartości.
 *
 * `value_measurements.evidence_ref` to pole tekstowe: bywa odwołaniem do
 * obiektu w postaci `typ:id` (konwencja `buildArtifactRef`), a bywa zwykłym
 * opisem. Otwieramy WYŁĄCZNIE pierwszy przypadek i tylko wtedy, gdy typ jest
 * nam znany — reszta zostaje uczciwym tekstem.
 */
export function rozstrzygnijOtwarcieDowodu(
  evidenceRef: string | null | undefined
): OtwarcieObiektu | null {
  const surowy = String(evidenceRef ?? '').trim();
  if (!surowy) return null;

  const ref = parseArtifactRef(surowy);
  if (!ref) {
    return {
      status: 'nieznany-typ',
      powod:
        'Dowód jest zapisany jako opis, a nie jako odwołanie do obiektu — ' +
        'nie ma czego otworzyć. Treść widać niżej.',
    };
  }
  const typ = TYP_OBIEKTU_NA_MODUL[String(ref.type).toLowerCase()];
  if (!typ || !ARTIFACT_IDENTITY[typ]) {
    return {
      status: 'nieznany-typ',
      powod: `Dowód wskazuje obiekt rodzaju „${ref.type}", którego nie umiemy jeszcze otworzyć.`,
    };
  }
  return {
    status: 'otwieralny',
    sciezka: getArtifactPath(typ, ref.id),
    etykieta: linkedTypeLabel(ref.type, true) || ref.type,
  };
}

// ═══════════════════════════════════════════════════════════════════════════

export interface OtwarcieZadanie {
  sciezka: string;
  kluczFokusu: string;
  etykieta: string;
  /**
   * Kontekst powrotu z autorytatywnego odczytu backendu
   * (`resolveArtifactLinkOpen` → `returnContext`) — obecny tylko, gdy
   * klasyfikacja przeszła przez `GET /artifact-links/:linkId/open`, a nie
   * wyłącznie przez klienta. Powłoka (`CaseDetailScreen`) niesie to w
   * migawce powrotu razem ze scrollem i fokusem.
   */
  returnContext?: ArtifactLinkReturnContext;
}

export type RezultatSelection =
  | { kind: 'pomiar'; id: string }
  | { kind: 'obiekt'; id: string }
  /** `id` = `nodeRunId` — jedyny stabilny identyfikator wyniku kroku. */
  | { kind: 'wynik-kroku'; id: string }
  | null;

/** Stabilny klucz fokusu przycisku „Otwórz" wewnątrz podglądu wyniku kroku. */
export function kluczFokusuRezultatuKroku(nodeRunId: string): string {
  return `wynik-kroku:${nodeRunId}`;
}

/**
 * Rozstrzyga, czy i jak otworzyć obiekt, na który wskazuje wynik kroku.
 *
 * Kolejność jest istotna, tak jak w `rozstrzygnijOtwarcie` wyżej: najpierw
 * PRAWDA Z BACKENDU, dopiero potem heurystyka.
 *  1. Gdy wyłuskany `typ:id` pasuje do JUŻ WCZYTANEGO, backendowo
 *     zweryfikowanego `CaseArtifactLink` tego zlecenia (to samo `artifactType`
 *     + `artifactId`) — używamy JEGO wpisu w `otwarciaObiektow`, czyli
 *     PRAWDZIWEGO stanu z `GET /artifact-links/:linkId/open` (a do jego
 *     przyjścia — `rozstrzygnijOtwarcie`'s `linkStatus`/`isStale`, ten sam
 *     „bez flashu" wzorzec co reszta modułu), a nie zgadywania. To jedyny
 *     sposób, w jaki „niedostępny/odpięty/nieaktualny" dla wyniku kroku może
 *     być UCZCIWY, skoro `case_workspace_node_result_acceptances` samo w
 *     sobie nie ma kolumny stanu powiązania (patrz nagłówek `apiResults.ts`).
 *  2. Bez dopasowania spada na `rozstrzygnijOtwarcieDowodu` — tę samą,
 *     słabszą ścieżkę „typ jest znany, więc otwieramy", której repo już
 *     używa dla `evidenceRef` pomiaru wartości. Nie silniejszą, nie słabszą.
 */
function rozstrzygnijOtwarcieRezultatuKroku(
  item: NodeResultAcceptance,
  artifactLinks: CaseArtifactLink[],
  otwarciaObiektow: Map<string, OtwarcieObiektu>
): OtwarcieObiektu | null {
  const ref = deliverableRefFromSnapshot(item.acceptanceInputSnapshot);
  if (!ref) return null;

  const parsed = parseArtifactRef(ref);
  if (parsed) {
    const dopasowanie = artifactLinks.find(
      (link) =>
        String(link.artifactType).toLowerCase() === parsed.type.toLowerCase() &&
        String(link.artifactId) === parsed.id
    );
    if (dopasowanie) {
      return otwarciaObiektow.get(dopasowanie.linkId) ?? rozstrzygnijOtwarcie(dopasowanie);
    }
  }
  return rozstrzygnijOtwarcieDowodu(ref);
}

export interface RezultatyViewProps {
  caseItem: CaseCoreView;
  measurements: ValueMeasurement[];
  artifactLinks: CaseArtifactLink[];
  expert?: boolean;
  /**
   * Otwarcie obiektu w JEGO module. Powłoka (nie ten widok) wykonuje
   * nawigację, bo to ona wie, co trzeba zapamiętać na powrót: adres listy,
   * zakładkę, krok planu, pozycję przewijania i element, z którego wyszliśmy.
   */
  onOpenDeliverable?: (zadanie: OtwarcieZadanie) => void;
  /**
   * Zaznaczony wiersz (otwarty podgląd) STEROWANY Z POWŁOKI.
   *
   * ★ ZMIERZONE, nie wymyślone: gdy zaznaczenie żyło wyłącznie tutaj, powrót z
   * otwartego obiektu przywracał przewinięcie na 213 px zamiast zapisanych
   * 237 px. Powód nie miał nic wspólnego z samym przewijaniem: przed wyjściem
   * podgląd był OTWARTY (układ dwukolumnowy, treść wyższa), a po powrocie —
   * zamknięty, więc 237 px po prostu przestawało istnieć. Zaznaczenie musi
   * więc wracać razem z resztą stanu, inaczej „ta sama pozycja" jest niemożliwa.
   */
  wybor?: RezultatSelection;
  onWybor?: (wybor: RezultatSelection) => void;
}

type Selection = RezultatSelection;

function axisTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'COMPLETED' || status === 'VALIDATED') return 'success';
  if (status === 'PENDING') return 'warning';
  return 'neutral';
}

function measurementTone(
  status: ValueMeasurement['measurementStatus']
): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'NOT_ACHIEVED') return 'critical';
  if (status === 'PARTIAL' || status === 'EVIDENCE_MISSING') return 'warning';
  return 'neutral';
}

function formatValue(value: number | null, unit: string | null): string {
  if (value === null || value === undefined) return '—';
  const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value);
  return unit ? `${number} ${unit}` : number;
}

/**
 * Przycisk „Otwórz" — jedyny kształt otwierania rezultatu w tym module.
 *
 * Wyłączony przycisk ZOSTAJE widoczny i zachowuje `title` z powodem: „nie da
 * się otworzyć" jest informacją o obiekcie, a znikający przycisk kazałby
 * użytkownikowi zgadywać, czy funkcji nie ma, czy obiekt jest wyjątkiem.
 */
const OpenButton: React.FC<{
  otwarcie: OtwarcieObiektu;
  kluczFokusu: string;
  etykietaDostepna: string;
  onOpen: (zadanie: OtwarcieZadanie) => void;
  szeroki?: boolean;
}> = ({ otwarcie, kluczFokusu, etykietaDostepna, onOpen, szeroki }) => {
  const otwieralny = otwarcie.status === 'otwieralny';
  const nieaktualny = otwieralny && Boolean(otwarcie.ostrzezenie);
  return (
    <button
      type="button"
      data-cw-focus={kluczFokusu}
      disabled={!otwieralny}
      title={
        otwieralny
          ? nieaktualny
            ? `Otwórz: ${otwarcie.etykieta} — ${otwarcie.ostrzezenie}`
            : `Otwórz: ${otwarcie.etykieta}`
          : otwarcie.powod
      }
      aria-label={
        nieaktualny ? `${etykietaDostepna} (przypięta rewizja jest starsza)` : etykietaDostepna
      }
      onClick={(event) => {
        event.stopPropagation();
        if (otwarcie.status !== 'otwieralny') return;
        onOpen({
          sciezka: otwarcie.sciezka,
          kluczFokusu,
          etykieta: otwarcie.etykieta,
          returnContext: otwarcie.returnContext,
        });
      }}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition ${FOCUS_RING} ${
        szeroki ? 'w-full justify-center' : ''
      } ${
        !otwieralny
          ? 'cursor-not-allowed border-c-border text-c-text-muted opacity-60'
          : nieaktualny
            ? 'border-amber-300 text-c-text hover:bg-c-surface-raised dark:border-amber-500/40'
            : 'border-c-border text-c-text hover:bg-c-surface-raised'
      }`}
    >
      {nieaktualny ? (
        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" aria-hidden />
      ) : (
        <ArrowUpRight size={14} aria-hidden />
      )}
      Otwórz
    </button>
  );
};

export const RezultatyView: React.FC<RezultatyViewProps> = ({
  caseItem,
  measurements,
  artifactLinks,
  expert,
  onOpenDeliverable,
  wybor,
  onWybor,
}) => {
  // Sterowanie z powłoki, gdy powłoka je podaje; własny stan, gdy widok stoi sam
  // (np. w harnessie zrzutowym) — bez tego fallbacku komponent przestałby działać
  // wszędzie poza jednym wywołaniem.
  const [wlasnyWybor, setWlasnyWybor] = useState<Selection>(null);
  const selection = wybor !== undefined ? wybor : wlasnyWybor;
  const setSelection = useCallback(
    (next: Selection) => {
      if (onWybor) onWybor(next);
      else setWlasnyWybor(next);
    },
    [onWybor]
  );

  const otworz = useCallback(
    (zadanie: OtwarcieZadanie) => {
      onOpenDeliverable?.(zadanie);
    },
    [onOpenDeliverable]
  );

  // ═══════════════════════════════════════════════════════════════════════
  // WYNIKI WYKONANIA KROKÓW (node-result-acceptances) — SAMODZIELNY odczyt.
  //
  // ★ DLACZEGO TEN WIDOK CZYTA SAM, a nie dostaje to przez propsy jak
  // `measurements`/`artifactLinks`. `CaseDetailScreen.tsx` (właściciel
  // `CaseBundle` i jedynego `load()`) jest w tym pakiecie ZAKAZANY do
  // edycji — jest własnością równoległych prac A/C. Backend ma trasę
  // (`GET /cases/:caseId/node-result-acceptances`), której `CaseDetailScreen`
  // dziś nie woła; ten `useEffect` woła ją NIEZALEŻNIE, więc funkcja działa
  // BEZ jakiejkolwiek zmiany w powłoce. Odczyt jest ZAWSZE realnym wywołaniem
  // API przy montowaniu (i przy zmianie `caseItem.caseId`) — stąd „po
  // odświeżeniu strony wynik nadal jest widoczny": nic tu nie stoi w
  // fixture'ach ani w pamięci sesji.
  // ═══════════════════════════════════════════════════════════════════════
  const [nodeResults, setNodeResults] = useState<NodeResultAcceptance[]>([]);
  const [nodeResultsStan, setNodeResultsStan] = useState<'ladowanie' | 'ok' | 'blad'>('ladowanie');
  const [nodeResultsBlad, setNodeResultsBlad] = useState<CaseApiFailure | null>(null);
  const [nodeResultsPonow, setNodeResultsPonow] = useState(0);

  useEffect(() => {
    let anulowano = false;
    setNodeResultsStan('ladowanie');
    setNodeResultsBlad(null);
    listNodeResultAcceptancesForCase(caseItem.caseId)
      .then((items) => {
        if (anulowano) return;
        setNodeResults(items);
        setNodeResultsStan('ok');
      })
      .catch((error) => {
        if (anulowano) return;
        setNodeResults([]);
        setNodeResultsBlad(toFailure(error));
        setNodeResultsStan('blad');
      });
    return () => {
      anulowano = true;
    };
  }, [caseItem.caseId, nodeResultsPonow]);

  const axes = useMemo(
    () => [
      { key: 'delivery', status: caseItem.deliveryStatus },
      { key: 'decision', status: caseItem.decisionStatus },
      { key: 'implementation', status: caseItem.implementationStatus },
      { key: 'outcome', status: caseItem.outcomeStatus },
    ],
    [caseItem]
  );

  // Nadpisania „otwieralny" → stan AUTORYTATYWNY z `GET
  // /artifact-links/:linkId/open` (AVAILABLE/STALE/UNAVAILABLE/DELETED, z
  // prawdziwym powodem) — patrz komentarz przy `useOtwarciaZBackendu` wyżej.
  const nadpisaniaBackendu = useOtwarciaZBackendu(artifactLinks);

  // Nadpisania „otwieralny" → „niedostępny" po potwierdzonym 404 z modułu
  // docelowego — patrz komentarz przy `weryfikujIstnienieDokumentu` wyżej.
  // Ta sama zasada co w CaseDetailScreen.tsx (Menu 1/„Powiązania"): start
  // zawsze z `rozstrzygnijOtwarcie` (bez flashu złego stanu), każde
  // nadpisanie tylko DOKŁADA ostrożność, nigdy jej nie zdejmuje.
  const [nadpisaniaWeryfikacji, setNadpisaniaWeryfikacji] = useState<
    Record<string, OtwarcieObiektu>
  >({});

  useEffect(() => {
    let anulowano = false;
    artifactLinks
      .filter(jestPowiazaniemDokumentu)
      .filter((link) => rozstrzygnijOtwarcie(link).status === 'otwieralny')
      .forEach((link) => {
        weryfikujIstnienieDokumentu(link.artifactId).then((istnieje) => {
          if (anulowano || istnieje) return;
          setNadpisaniaWeryfikacji((prev) => ({
            ...prev,
            [link.linkId]: {
              status: 'niedostepny',
              powod:
                'Ten dokument nie istnieje w module Dokumenty (mógł zostać usunięty albo ' +
                'nigdy nie powstał mimo aktywnego powiązania). Sprawdzone na żywo przy ' +
                'otwarciu tego zlecenia.',
            },
          }));
        });
      });
    return () => {
      anulowano = true;
    };
  }, [artifactLinks]);

  /**
   * Stan otwarcia liczony RAZ per obiekt — tabela i podgląd czytają to samo.
   *
   * Pierwszeństwo (mocniejsze nadpisanie zawsze wygrywa, NIEZALEŻNIE od tego,
   * który odczyt dojdzie pierwszy — obie asynchroniczne ścieżki piszą do
   * OSOBNYCH stanów właśnie po to, żeby kolejność odpowiedzi sieci nie
   * decydowała o wyniku):
   *  1. `nadpisaniaWeryfikacji` — potwierdzone 404 w module docelowym (silny
   *     negatywny sygnał specyficzny dla Dokumentów, patrz wyżej),
   *  2. `nadpisaniaBackendu` — autorytatywny stan `resolveArtifactLinkOpen`
   *     (wszystkie typy),
   *  3. `rozstrzygnijOtwarcie(link)` — klasyfikacja z już wczytanego linku,
   *     zanim którykolwiek odczyt z sieci wróci.
   */
  const otwarciaObiektow = useMemo(() => {
    const mapa = new Map<string, OtwarcieObiektu>();
    artifactLinks.forEach((link) =>
      mapa.set(
        link.linkId,
        nadpisaniaWeryfikacji[link.linkId] ?? nadpisaniaBackendu[link.linkId] ?? rozstrzygnijOtwarcie(link)
      )
    );
    return mapa;
  }, [artifactLinks, nadpisaniaWeryfikacji, nadpisaniaBackendu]);

  const measurementRows = useMemo(
    () =>
      measurements.map((item) => ({
        id: item.measurementId,
        wskaznik: item.metricName || item.metricKey,
        punktWyjscia: formatValue(item.baselineValue, item.baselineUnit),
        cel: formatValue(item.targetValue, item.targetUnit),
        wynik: formatValue(item.actualValue, item.actualUnit),
        stan: valueMeasurementStatusLabel(item.measurementStatus, true),
        stanTone: measurementTone(item.measurementStatus),
        pewnosc: measurementConfidenceLabel(item.confidence, true),
        pomiar: item.measurementDate,
      })),
    [measurements]
  );

  const linkRows = useMemo(
    () =>
      artifactLinks.map((link) => {
        const otwarcie = otwarciaObiektow.get(link.linkId);
        return {
          id: link.linkId,
          obiekt: linkedTypeLabel(link.artifactType, true) || link.artifactType,
          rola: artifactLinkRelationLabel(link.relation, true),
          stan: link.isStale ? 'Nieaktualny' : artifactLinkStatusLabel(link.linkStatus, true),
          stanTone:
            link.isStale || link.linkStatus === 'UNAVAILABLE'
              ? ('warning' as const)
              : ('neutral' as const),
          dodane: link.linkedAt,
          otwieralny: otwarcie?.status === 'otwieralny' ? 'tak' : 'nie',
        };
      }),
    [artifactLinks, otwarciaObiektow]
  );

  /**
   * Wiersze tabeli wyników kroku. `krok` opisuje TYP węzła
   * (`planNodeTypeLabel`), nie jego biznesową nazwę — ten widok nie dostaje
   * grafu planu (nie jest mu przekazywany przez `CaseDetailScreen`), więc nie
   * ma skąd wziąć nazwy kroku bez zmyślania jej. `akceptacja` czyta WYŁĄCZNIE
   * `resultAcceptance` — nigdy licznika ostrzeżeń — zgodnie z kanonem
   * (`04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:263`: „Częściowo zakończone
   * derives from explicit PARTIAL, never from warnings or node counts").
   */
  const nodeResultRows = useMemo(
    () =>
      nodeResults.map((item) => ({
        id: item.nodeRunId,
        krok: planNodeTypeLabel(item.nodeType, true) || item.nodeType,
        stan: nodeCompletionStateLabel(item.nodeCompletionState),
        akceptacja: resultAcceptanceLabel(item.resultAcceptance),
        akceptacjaTone: resultAcceptanceTone(item.resultAcceptance),
        kiedy: item.occurredAt,
      })),
    [nodeResults]
  );

  const measurementColumns: TableColumn[] = [
    {
      id: 'wskaznik',
      label: 'Co mierzymy',
      /*
       * ★ SZEROKOŚCI DOBRANE POMIAREM, nie na oko. Suma zadeklarowanych
       * szerokości JEST szerokością tabeli (`table-fixed`, `parsePx` w
       * `FilterableTable.tsx:749`), więc samo zdjęcie `min-width: 980px`
       * niczego nie dało: 240+140+120+120+180+140 = 940 px w kontenerze
       * 700 px = 240 px nadal schowane. Nowa suma (135+100+90+90+175+95
       * = 685) mieści się w środkowej kolumnie powłoki, a `w-full` rozciąga
       * tabelę na szerszych ekranach. Pełne wartości bez skracania pokazuje
       * podgląd po kliknięciu wiersza.
       */
      width: '135px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm font-medium text-c-text">{String(row.wskaznik)}</span>
      ),
    },
    { id: 'punktWyjscia', label: 'Punkt wyjścia', width: '100px', align: 'right' },
    { id: 'cel', label: 'Cel', width: '90px', align: 'right' },
    { id: 'wynik', label: 'Wynik', width: '90px', align: 'right' },
    {
      id: 'stan',
      label: 'Stan pomiaru',
      // Pigułka „Zmierzone częściowo” nie łamie się w linii — na zrzucie przy
      // 120 px nachodziła na kolumnę daty. 175 px ją mieści.
      width: '175px',
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
      ),
    },
    {
      id: 'pomiar',
      label: 'Data pomiaru',
      width: '95px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-c-text-secondary">{formatDate(String(row.pomiar))}</span>
      ),
    },
  ];

  const linkColumns: TableColumn[] = [
    {
      // Suma szerokości = szerokość tabeli (patrz komentarz przy 'wskaznik'):
      // 160+170+130+110+95 = 665 px mieści się w kolumnie 700 px.
      id: 'obiekt',
      label: 'Obiekt',
      width: '160px',
      sortable: true,
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm font-medium text-c-text">{String(row.obiekt)}</span>
      ),
    },
    { id: 'rola', label: 'Rola w zleceniu', width: '170px', filterable: true },
    {
      id: 'stan',
      label: 'Stan powiązania',
      width: '130px',
      render: (row: Record<string, unknown>) => (
        <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
      ),
    },
    {
      id: 'dodane',
      label: 'Powiązane',
      width: '110px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-c-text-secondary">{formatDate(String(row.dodane))}</span>
      ),
    },
    {
      id: 'otwieralny',
      label: 'Otwórz',
      width: '95px',
      align: 'right',
      render: (row: Record<string, unknown>) => {
        const linkId = String(row.id);
        const link = artifactLinks.find((item) => item.linkId === linkId);
        const otwarcie = otwarciaObiektow.get(linkId);
        if (!link || !otwarcie) return null;
        return (
          <OpenButton
            otwarcie={otwarcie}
            kluczFokusu={kluczFokusuObiektu(linkId)}
            etykietaDostepna={`Otwórz obiekt: ${linkedTypeLabel(link.artifactType, true) || link.artifactType}`}
            onOpen={otworz}
          />
        );
      },
    },
  ];

  /*
   * Cztery kolumny, suma 220+100+180+110 = 610 px — mieści się bez
   * przewijania w kolumnie 700 px (ten sam pomiar co przy tabelach wyżej;
   * `minTableWidth="auto"` i tak zwęża tabelę do kontenera, licznik jest tu
   * wyłącznie po to, żeby żadna kolumna nie łamała się w jednej linii przy
   * pełnej szerokości).
   */
  const nodeResultColumns: TableColumn[] = [
    {
      id: 'krok',
      label: 'Krok',
      width: '220px',
      sortable: true,
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <span
          data-cw-focus={`wiersz-wyniku-kroku:${String(row.id)}`}
          tabIndex={-1}
          className="block rounded text-sm font-medium text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {String(row.krok)}
        </span>
      ),
    },
    { id: 'stan', label: 'Stan zakończenia', width: '100px' },
    {
      id: 'akceptacja',
      label: 'Status akceptacji',
      width: '180px',
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <StatusTag tone={row.akceptacjaTone as 'critical'}>{String(row.akceptacja)}</StatusTag>
      ),
    },
    {
      id: 'kiedy',
      label: 'Kiedy',
      width: '110px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-c-text-secondary">{formatDate(String(row.kiedy))}</span>
      ),
    },
  ];

  const selectedMeasurement =
    selection?.kind === 'pomiar'
      ? (measurements.find((item) => item.measurementId === selection.id) ?? null)
      : null;
  const selectedLink =
    selection?.kind === 'obiekt'
      ? (artifactLinks.find((item) => item.linkId === selection.id) ?? null)
      : null;
  const selectedNodeResult =
    selection?.kind === 'wynik-kroku'
      ? (nodeResults.find((item) => item.nodeRunId === selection.id) ?? null)
      : null;
  const selectedLinkOtwarcie = selectedLink ? otwarciaObiektow.get(selectedLink.linkId) : undefined;
  const selectedEvidence = selectedMeasurement
    ? rozstrzygnijOtwarcieDowodu(selectedMeasurement.evidenceRef)
    : null;
  const selectedNodeResultOtwarcie = selectedNodeResult
    ? rozstrzygnijOtwarcieRezultatuKroku(selectedNodeResult, artifactLinks, otwarciaObiektow)
    : null;

  // Kontekst źródłowego Run dla PODGLĄDU wyniku kroku — leniwie, dopiero gdy
  // ktoś otworzy podgląd (patrz komentarz w `apiResults.ts` przy
  // `getRunBinding`: bez tego każdy wiersz tabeli odpalałby własne
  // zapytanie, którego nikt nie zobaczy).
  const [zrodloRun, setZrodloRun] = useState<{
    runId: string | null;
    stan: 'ladowanie' | 'ok' | 'blad';
    dane: CaseRunBinding | null;
    blad: CaseApiFailure | null;
  }>({ runId: null, stan: 'ladowanie', dane: null, blad: null });

  useEffect(() => {
    if (!selectedNodeResult) return undefined;
    let anulowano = false;
    setZrodloRun({ runId: selectedNodeResult.runId, stan: 'ladowanie', dane: null, blad: null });
    getRunBinding(selectedNodeResult.runId)
      .then((binding) => {
        if (anulowano) return;
        setZrodloRun({ runId: selectedNodeResult.runId, stan: 'ok', dane: binding, blad: null });
      })
      .catch((error) => {
        if (anulowano) return;
        setZrodloRun({
          runId: selectedNodeResult.runId,
          stan: 'blad',
          dane: null,
          blad: toFailure(error),
        });
      });
    return () => {
      anulowano = true;
    };
  }, [selectedNodeResult?.runId]);

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="rounded-xl border border-c-border bg-c-surface p-3 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-c-text">Czy zlecenie jest domknięte</h3>
            <span className="text-xs text-c-text-muted">
              Umówione zamknięcie: {closureTypeLabel(caseItem.contractedClosureType, true)}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {axes.map((axis) => (
              <div
                key={axis.key}
                className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-2"
              >
                <div className="text-xs uppercase tracking-wide text-c-text-muted">
                  {closureAxisLabel(axis.key, true)}
                </div>
                <div className="mt-1">
                  <StatusTag tone={axisTone(axis.status)}>
                    {closureAxisStatusLabel(axis.status, true)}
                  </StatusTag>
                </div>
              </div>
            ))}
          </div>
          {caseItem.closedAt ? (
            <p className="mt-3 text-sm text-c-text-secondary">
              Zamknięte {formatDateTime(caseItem.closedAt)} jako{' '}
              {closureTypeLabel(caseItem.closureType, true).toLowerCase()}.
            </p>
          ) : null}
        </div>

        <section aria-labelledby="zlecenia-wyniki-krokow" className="min-w-0">
          <h3 id="zlecenia-wyniki-krokow" className="mb-2 text-sm font-semibold text-c-text">
            Wyniki wykonania kroków
          </h3>
          <div className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3">
            {nodeResultsStan !== 'ok' ? (
              <CaseStateBlock
                loading={nodeResultsStan === 'ladowanie'}
                failure={nodeResultsStan === 'blad' ? nodeResultsBlad : null}
                onRetry={() => setNodeResultsPonow((n) => n + 1)}
                compact
              />
            ) : (
              <StandardTable
                columns={nodeResultColumns}
                data={nodeResultRows}
                selectedRowId={selection?.kind === 'wynik-kroku' ? selection.id : null}
                onRowClick={(row) => setSelection({ kind: 'wynik-kroku', id: String(row.id) })}
                rowDescription={() => null}
                // Ten sam pomiar co reszta tego pliku: 980 px wymuszone w
                // kontenerze 700 px chowa kolumny za przewijaniem bez śladu.
                minTableWidth="auto"
                persistKey="caseWorkspace.results.nodeResults"
                density="compact"
                defaultSort={{ columnId: 'kiedy', direction: 'desc' }}
                empty={{
                  icon: ClipboardCheck,
                  title: 'Żaden krok nie ma jeszcze zapisanego wyniku',
                  description:
                    'Wynik pojawia się tu dopiero, gdy krok wykonania zostanie zakończony albo pominięty — to nie jest błąd.',
                }}
              />
            )}
          </div>
        </section>

        <section aria-labelledby="zlecenia-wartosc" className="min-w-0">
          <h3 id="zlecenia-wartosc" className="mb-2 text-sm font-semibold text-c-text">
            Zmierzona wartość
          </h3>
          <div className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3">
            <StandardTable
              columns={measurementColumns}
              data={measurementRows}
              selectedRowId={selection?.kind === 'pomiar' ? selection.id : null}
              onRowClick={(row) => setSelection({ kind: 'pomiar', id: String(row.id) })}
              rowDescription={() => null}
              /*
               * ★ ZMIERZONE W PRZEGLĄDARCE przy 1440 px (getComputedStyle):
               * `StandardTable` wymusza domyślnie `min-width: 980px`
               * (`FilterableTable.tsx:188`), a ta tabela stoi w środkowej
               * kolumnie powłoki artefaktu szerokiej na 700 px. Efekt:
               * scrollWidth 980 przy clientWidth 700, czyli 280 px tabeli
               * (kolumna „Stan pomiaru" i „Data pomiaru") schowane za
               * przewijaniem BEZ ŻADNEJ oznaki, że jest co przewijać —
               * dokładnie ta pułapka, którą lista zleceń rozbroiła u siebie.
               *
               * `'columns'` tu NIE pomoże: znosi min-width dopiero przy ≤2
               * kolumnach danych (`AUTO_MIN_WIDTH_COLUMN_THRESHOLD`), a mamy
               * ich sześć. `'auto'` znosi wymuszenie, tabela (`table-fixed
               * w-full`) zwęża się do kontenera i WSZYSTKIE kolumny są
               * widoczne. Kanon nietknięty: moduł deklaruje próg, wygląd dalej
               * narzuca komponent wspólny; pełne wartości i tak pokazuje
               * podgląd po kliknięciu wiersza.
               */
              minTableWidth="auto"
              persistKey="caseWorkspace.results.measurements"
              density="compact"
              defaultSort={{ columnId: 'pomiar', direction: 'desc' }}
              empty={{
                icon: BarChart3,
                title: 'Nic jeszcze nie zmierzono',
                description:
                  'Efekt zlecenia mierzy się po wdrożeniu. Do tego czasu ta lista pozostaje pusta — to nie jest błąd.',
              }}
            />
          </div>
        </section>

        <section aria-labelledby="zlecenia-obiekty" className="min-w-0">
          <h3 id="zlecenia-obiekty" className="mb-2 text-sm font-semibold text-c-text">
            Powiązane obiekty
          </h3>
          <div className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3">
            <StandardTable
              columns={linkColumns}
              data={linkRows}
              selectedRowId={selection?.kind === 'obiekt' ? selection.id : null}
              onRowClick={(row) => setSelection({ kind: 'obiekt', id: String(row.id) })}
              rowDescription={() => null}
              // Ten sam pomiar co wyżej: 980 px wymuszone w kontenerze 700 px.
              minTableWidth="auto"
              persistKey="caseWorkspace.results.links"
              density="compact"
              defaultSort={{ columnId: 'dodane', direction: 'desc' }}
              empty={{
                icon: Link2,
                title: 'Brak powiązanych obiektów',
                description:
                  'Tu trafiają dokumenty, decyzje, inicjatywy i dowody, na których opiera się to zlecenie.',
              }}
            />
          </div>
        </section>
      </div>

      {selectedMeasurement ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={selectedMeasurement.metricName || selectedMeasurement.metricKey}
            onClose={() => setSelection(null)}
            meta={{
              pills: [
                {
                  label: valueMeasurementStatusLabel(selectedMeasurement.measurementStatus, true),
                  tone: 'info',
                },
                {
                  label: measurementConfidenceLabel(selectedMeasurement.confidence, true),
                  tone: 'neutral',
                },
              ],
            }}
            details={{
              text: 'Pomiar efektu tego zlecenia.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                {
                  id: 'baza',
                  label: 'Punkt wyjścia',
                  value: formatValue(
                    selectedMeasurement.baselineValue,
                    selectedMeasurement.baselineUnit
                  ),
                },
                {
                  id: 'cel',
                  label: 'Cel',
                  value: formatValue(
                    selectedMeasurement.targetValue,
                    selectedMeasurement.targetUnit
                  ),
                },
                {
                  id: 'wynik',
                  label: 'Wynik',
                  value: formatValue(
                    selectedMeasurement.actualValue,
                    selectedMeasurement.actualUnit
                  ),
                },
                {
                  id: 'data',
                  label: 'Data pomiaru',
                  value: formatDate(selectedMeasurement.measurementDate),
                },
                {
                  id: 'nastepny',
                  label: 'Następny pomiar',
                  value: selectedMeasurement.nextMeasurementDueAt
                    ? formatDate(selectedMeasurement.nextMeasurementDueAt)
                    : 'nie zaplanowano',
                },
                {
                  id: 'dowod',
                  label: 'Dowód',
                  value: selectedMeasurement.evidenceRef ? 'dołączony' : 'brak',
                },
              ],
            }}
          >
            {/* Dowód pomiaru — otwieralny, gdy wskazuje realny obiekt. */}
            <div className="rounded-lg border border-c-border-subtle p-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                Dowód pomiaru
              </div>
              {selectedEvidence === null ? (
                <p className="text-xs italic text-c-text-muted">
                  Do tego pomiaru nie dołączono dowodu. Stan „brak dowodu" jest czymś innym niż
                  „nieosiągnięte" — sam wynik nie jest przez to unieważniony.
                </p>
              ) : selectedEvidence.status === 'otwieralny' ? (
                <div className="space-y-2">
                  <p className="text-xs text-c-text-secondary">
                    Dowód wskazuje obiekt: {selectedEvidence.etykieta}.
                  </p>
                  <OpenButton
                    otwarcie={selectedEvidence}
                    kluczFokusu={kluczFokusuDowodu(selectedMeasurement.measurementId)}
                    etykietaDostepna={`Otwórz dowód pomiaru: ${selectedEvidence.etykieta}`}
                    onOpen={otworz}
                    szeroki
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-c-text-secondary">{selectedEvidence.powod}</p>
                  {expert ? <TechnicalId value={selectedMeasurement.evidenceRef} /> : null}
                </div>
              )}
            </div>
          </StandardPreview>
        </aside>
      ) : selectedLink ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={linkedTypeLabel(selectedLink.artifactType, true) || selectedLink.artifactType}
            onClose={() => setSelection(null)}
            /* Kanon podglądu: „Otwórz" mieszka w nagłówku podglądu, nie w
               dorobionym przycisku w treści. Podajemy go WYŁĄCZNIE wtedy, gdy
               obiekt naprawdę da się otworzyć — przycisk, który po kliknięciu
               nic nie robi, byłby gorszy niż jego brak. */
            onOpenFull={
              selectedLinkOtwarcie?.status === 'otwieralny'
                ? () =>
                    otworz({
                      sciezka: selectedLinkOtwarcie.sciezka,
                      kluczFokusu: kluczFokusuObiektu(selectedLink.linkId),
                      etykieta: selectedLinkOtwarcie.etykieta,
                      returnContext: selectedLinkOtwarcie.returnContext,
                    })
                : undefined
            }
            openLabel="Otwórz obiekt"
            meta={{
              pills: [
                { label: artifactLinkRelationLabel(selectedLink.relation, true), tone: 'info' },
                ...(selectedLink.isStale
                  ? [{ label: 'Nieaktualny', tone: 'warning' as const }]
                  : []),
              ],
            }}
            details={{
              text:
                selectedLinkOtwarcie?.status === 'otwieralny' && selectedLinkOtwarcie.ostrzezenie
                  ? selectedLinkOtwarcie.ostrzezenie
                  : selectedLink.isStale
                    ? 'Obiekt zmienił się po powiązaniu — sprawdź, czy nadal potwierdza to, co miał potwierdzać.'
                    : 'Obiekt powiązany z tym zleceniem.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                {
                  id: 'rola',
                  label: 'Rola w zleceniu',
                  value: artifactLinkRelationLabel(selectedLink.relation, true),
                },
                {
                  id: 'stan',
                  label: 'Stan powiązania',
                  value: artifactLinkStatusLabel(selectedLink.linkStatus, true),
                },
                { id: 'dodane', label: 'Powiązane', value: formatDateTime(selectedLink.linkedAt) },
                {
                  id: 'wersja',
                  label: 'Przypięta wersja',
                  value: selectedLink.artifactRevision ?? 'zawsze najnowsza',
                },
                ...(expert
                  ? [
                      {
                        id: 'id',
                        label: 'Identyfikator obiektu',
                        value: <TechnicalId value={selectedLink.artifactId} />,
                      },
                    ]
                  : []),
              ],
            }}
          >
            {/* Gdy otworzyć NIE można — powód wprost, zamiast martwego przycisku. */}
            {selectedLinkOtwarcie && selectedLinkOtwarcie.status !== 'otwieralny' ? (
              <div className="flex items-start gap-2 rounded-lg border border-c-border bg-c-surface-raised px-3 py-2">
                {selectedLinkOtwarcie.status === 'odpiety' ? (
                  <Unlink className="mt-0.5 h-4 w-4 shrink-0 text-c-text-muted" aria-hidden />
                ) : (
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-c-text-muted"
                    aria-hidden
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-c-text">Tego obiektu nie otworzymy</p>
                  <p className="mt-0.5 text-xs text-c-text-secondary">
                    {selectedLinkOtwarcie.powod}
                  </p>
                </div>
              </div>
            ) : selectedLinkOtwarcie?.status === 'otwieralny' && selectedLinkOtwarcie.ostrzezenie ? (
              // STALE — nadal otwieralny, ale nieaktualny: uczciwe ostrzeżenie
              // zamiast cichego otwarcia przestarzałej wersji.
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-c-text">Otworzysz nieaktualną rewizję</p>
                  <p className="mt-0.5 text-xs text-c-text-secondary">
                    {selectedLinkOtwarcie.ostrzezenie}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-c-text-muted">
                „Otwórz obiekt" w nagłówku podglądu przeniesie Cię do modułu, do którego ten obiekt
                należy. Wrócisz tu tym samym zleceniem, w tej samej sekcji.
              </p>
            )}
          </StandardPreview>
        </aside>
      ) : selectedNodeResult ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={
              planNodeTypeLabel(selectedNodeResult.nodeType, true) || selectedNodeResult.nodeType
            }
            onClose={() => setSelection(null)}
            /* Ten sam kanon co „Powiązane obiekty" wyżej: „Otwórz" w nagłówku
               podglądu, WYŁĄCZNIE gdy naprawdę da się otworzyć. */
            onOpenFull={
              selectedNodeResultOtwarcie?.status === 'otwieralny'
                ? () =>
                    otworz({
                      sciezka: selectedNodeResultOtwarcie.sciezka,
                      kluczFokusu: kluczFokusuRezultatuKroku(selectedNodeResult.nodeRunId),
                      etykieta: selectedNodeResultOtwarcie.etykieta,
                      returnContext: selectedNodeResultOtwarcie.returnContext,
                    })
                : undefined
            }
            openLabel="Otwórz rezultat"
            meta={{
              pills: [
                {
                  label: resultAcceptanceLabel(selectedNodeResult.resultAcceptance),
                  tone:
                    resultAcceptanceTone(selectedNodeResult.resultAcceptance) === 'critical'
                      ? 'danger'
                      : resultAcceptanceTone(selectedNodeResult.resultAcceptance),
                },
                { label: nodeCompletionStateLabel(selectedNodeResult.nodeCompletionState), tone: 'neutral' },
              ],
            }}
            details={{
              text: 'Wynik pojedynczego kroku wykonania tego zlecenia.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                { id: 'run', label: 'Źródłowy Run', value: <TechnicalId value={selectedNodeResult.runId} title="Run" /> },
                {
                  id: 'noderun',
                  label: 'NodeRun',
                  value: <TechnicalId value={selectedNodeResult.nodeRunId} title="NodeRun" />,
                },
                { id: 'zdarzylo', label: 'Zdarzyło się', value: formatDateTime(selectedNodeResult.occurredAt) },
                { id: 'zapisano', label: 'Zapisano', value: formatDateTime(selectedNodeResult.recordedAt) },
                ...(selectedNodeResult.nodeCompletionState === 'SKIPPED'
                  ? [
                      {
                        id: 'pominiecie',
                        label: 'Autoryzacja pominięcia',
                        value:
                          selectedNodeResult.skipAuthorizedByGraphCondition === true
                            ? 'tak — warunek grafu'
                            : selectedNodeResult.skipAuthorizedByGraphCondition === false
                              ? 'nie potwierdzona'
                              : 'nieznana',
                      },
                    ]
                  : []),
              ],
            }}
          >
            {/* Źródłowy Run — dociągnięty leniwie, uczciwy o trzech stanach. */}
            <div className="rounded-lg border border-c-border-subtle p-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                Kontekst Run
              </div>
              {zrodloRun.runId !== selectedNodeResult.runId || zrodloRun.stan === 'ladowanie' ? (
                <p className="text-xs text-c-text-muted">Wczytywanie…</p>
              ) : zrodloRun.stan === 'blad' ? (
                <p className="text-xs text-c-text-secondary">
                  {zrodloRun.blad?.kind === 'blocked'
                    ? 'Nie masz uprawnień do szczegółów tego Run.'
                    : zrodloRun.blad?.kind === 'notFound'
                      ? 'Powiązanie z tym Run nie zostało znalezione — mogło zostać usunięte.'
                      : 'Nie udało się wczytać szczegółów Run. Reszta tego wyniku pozostaje widoczna.'}
                </p>
              ) : zrodloRun.dane ? (
                <dl className="space-y-1 text-xs text-c-text-secondary">
                  <div>
                    Wersja planu: <TechnicalId value={zrodloRun.dane.casePlanVersionId} />
                  </div>
                  <div>
                    Skrót grafu: <TechnicalId value={zrodloRun.dane.graphDigest} />
                  </div>
                  <div>Powiązano z planem: {formatDateTime(zrodloRun.dane.createdAt)}</div>
                </dl>
              ) : null}
            </div>

            {/* Dowód — treść, na której oparto zapisaną akceptację. */}
            <div className="mt-3 rounded-lg border border-c-border-subtle p-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                Dowód
              </div>
              {summaryFromSnapshot(selectedNodeResult.acceptanceInputSnapshot) ? (
                <p className="text-xs text-c-text-secondary">
                  {summaryFromSnapshot(selectedNodeResult.acceptanceInputSnapshot)}
                </p>
              ) : (
                <p className="text-xs italic text-c-text-muted">
                  Do tego kroku nie zapisano czytelnego opisu dowodu.
                  {!expert ? ' Włącz widok ekspercki, by zobaczyć surowe dane.' : ''}
                </p>
              )}
              {expert && selectedNodeResult.acceptanceInputSnapshot != null ? (
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-c-surface-raised p-2 text-[11px] text-c-text-secondary">
                  {JSON.stringify(selectedNodeResult.acceptanceInputSnapshot, null, 2)}
                </pre>
              ) : null}
            </div>

            {/* Gdy otworzyć NIE można — powód wprost, zamiast martwego przycisku. */}
            <div className="mt-3">
              {selectedNodeResultOtwarcie === null ? (
                <p className="text-xs text-c-text-muted">
                  Ten wynik nie wskazuje obiektu do otwarcia.
                </p>
              ) : selectedNodeResultOtwarcie.status !== 'otwieralny' ? (
                <div className="flex items-start gap-2 rounded-lg border border-c-border bg-c-surface-raised px-3 py-2">
                  {selectedNodeResultOtwarcie.status === 'odpiety' ? (
                    <Unlink className="mt-0.5 h-4 w-4 shrink-0 text-c-text-muted" aria-hidden />
                  ) : (
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-c-text-muted"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-c-text">Tego obiektu nie otworzymy</p>
                    <p className="mt-0.5 text-xs text-c-text-secondary">
                      {selectedNodeResultOtwarcie.powod}
                    </p>
                  </div>
                </div>
              ) : selectedNodeResultOtwarcie.ostrzezenie ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-c-text">Otworzysz nieaktualną rewizję</p>
                    <p className="mt-0.5 text-xs text-c-text-secondary">
                      {selectedNodeResultOtwarcie.ostrzezenie}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-c-text-muted">
                  „Otwórz rezultat" w nagłówku podglądu przeniesie Cię do modułu, do którego ten
                  obiekt należy. Wrócisz tu tym samym zleceniem, w tej samej sekcji.
                </p>
              )}
            </div>
          </StandardPreview>
        </aside>
      ) : null}
    </div>
  );
};

export default RezultatyView;
