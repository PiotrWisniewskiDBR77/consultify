/**
 * cardAnalysisRubric — CZYM AI mierzy kartę (ETAP 3 standardu n-Type).
 *
 * Trzy źródła, ZERO wymyślania faktów o produkcie:
 *
 *  (1) KRYTERIA PER TYP ARTEFAKTU — `ARTIFACT_CRITERIA` niżej. Osie oceny są
 *      spisane z kontraktu właściciela (2026-07-23). Kontrakt mówi wprost, że
 *      kryteria oceny SĄ RÓŻNE per typ artefaktu, więc nie ma jednej listy dla
 *      wszystkich.
 *
 *  (2) PRÓG KAŻDEGO KRYTERIUM — `definition` + `failsWhen`. Sama NAZWA osi
 *      („ryzyko", „zależności") nie jest rubryką: model nie wie, kiedy uznać
 *      kryterium za spełnione, więc zwraca ogólniki. Każde kryterium ma więc
 *      dwa zdania rozstrzygające: co MUSI być, żeby uznać je za spełnione,
 *      i przy czym jest NIESPEŁNIONE. To jest warstwa dopisana przez silnik
 *      (nie cytat z kontraktu) — jej celem jest falsyfikowalność oceny.
 *
 *  (3) CEL KARTY + STANDARD JEJ TREŚCI — NIE są tu przepisywane. Czytamy je
 *      z KANONU KART, który już istnieje i jest wiążący typem:
 *        · `KanonicznaKarta.opis`             → „po co ta karta jest",
 *        · `KanonicznaKarta.aiPrompt.szablon` → „co ta karta ma zawierać",
 *        · `KanonicznaKarta.rolaAI`           → czy AI w ogóle pisze tę treść.
 *      Deskryptory: TASK_CARDS · DECISION_CARDS · NOTIFICATION_CARDS ·
 *      INSIGHT_CARDS · INITIATIVE_CANONICAL_CARDS · TOOL_CARDS.
 *      Duplikowanie tego tutaj oznaczałoby drugi SSOT, który zestarzeje się
 *      w tydzień — dlatego rubryka tylko WYSZUKUJE kartę w kanonie.
 *
 * ── CO ROBIMY, GDY KANON MILCZY ─────────────────────────────────────────────
 * `opis` jest w kanonie polem OPCJONALNYM i dziś wypełnionym częściowo
 * (Decision 0/8, Tool 0/4, Task 3/10, Insight 12, Initiative 11). Rubryka NIE
 * zmyśla wtedy celu karty — zwraca `standardZnany: false` i prompt jawnie mówi
 * modelowi: „kanon nie deklaruje standardu tej karty; oceniaj wobec kryteriów
 * typu artefaktu i nie wymyślaj wymagań". Uczciwość > kompletność.
 *
 * ── DOKTRYNA (przekrojowa, ponad kryteriami typu) ───────────────────────────
 * `DOCTRINE_RULES` — pięć reguł warsztatu (piramida · MECE · kwantyfikacja
 * z jawnymi założeniami · falsyfikowalność · uczciwa niepewność) plus dwie
 * reguły higieny, których brak realnie przepuszczał wady: JĘZYK (kalki
 * i niespójna terminologia) i SPÓJNOŚĆ LICZBOWA (ta sama metryka z dwiema
 * wartościami). Bez tego bloku system-prompt mówił „poziom BCG/McKinsey",
 * ale nie dawał modelowi ŻADNEJ podstawy, by ukarać zdanie „to ważne dla
 * organizacji".
 *
 * @see src/components/standard/cardContract.types.ts — schemat KanonicznaKarta
 */

import { TOOL_CARDS } from '@/components/DiscoveryTools/toolCards.contract';
import { INITIATIVE_CANONICAL_CARDS } from '@/components/Initiatives/sections/initiativeCardContract';
import { INSIGHT_CARDS } from '@/components/Interview/insightCardContract';
import { DECISION_CARDS } from '@/components/MyWork/decisionCardContract';
import { NOTIFICATION_CARDS } from '@/components/MyWork/notificationCardContract';
import { TASK_CARDS } from '@/components/MyWork/taskCardContract';
import type { KanonicznaKarta } from '@/components/standard/cardContract.types';

import type { CardAnalysisArtifactType } from './cardAnalysisTypes';

// ─────────────────────────────────────────────────────────────────────────────
// (1+2) KRYTERIA PER TYP ARTEFAKTU — oś (kontrakt) + próg (silnik).
// ─────────────────────────────────────────────────────────────────────────────

/** Tekst dwujęzyczny. Nazwa pól zgodna z kanonem kart (`label.pl` / `label.en`). */
export interface Bilingual {
  pl: string;
  en: string;
}

export interface AnalysisCriterion {
  /** Stabilny id — wraca w `CardAnalysisFinding.criterionId`, więc nie zmieniać. */
  id: string;
  pl: string;
  en: string;
  /**
   * PRÓG SPEŁNIENIA — co konkretnie musi być w karcie, żeby uznać kryterium za
   * spełnione. Zdanie musi dać się sprawdzić przez osobę trzecią bez pytania
   * autora („ma właściciela" można sprawdzić; „jest dobrze opisane" nie).
   */
  definition: Bilingual;
  /**
   * PRÓG ODCIĘCIA — obserwowalny objaw, przy którym kryterium jest
   * NIESPEŁNIONE. To jest to, czego brakowało: bez tego model nie miał podstawy
   * zgłosić braku i zwracał ogólniki.
   */
  failsWhen: Bilingual;
}

/**
 * Kryteria oceny. Kolejność = kolejność z kontraktu (właściciel czyta je jako lista).
 * Zmiana OSI (`pl`/`en`) = zmiana kontraktu, nie refactor. Zmiana `definition`
 * / `failsWhen` = zaostrzenie lub poluzowanie progu — wymaga świadomej decyzji,
 * bo bezpośrednio przesuwa liczbę zgłaszanych braków.
 */
export const ARTIFACT_CRITERIA: Record<CardAnalysisArtifactType, AnalysisCriterion[]> = {
  task: [
    {
      id: 'description-completeness',
      pl: 'kompletność opisu',
      en: 'description completeness',
      definition: {
        pl: 'Opis mówi CO ma powstać, DLA KOGO i PO CO, i zawiera tyle kontekstu, że wykonawca może zacząć bez dopytywania autora.',
        en: 'The description states WHAT is to be produced, FOR WHOM and WHY, with enough context for an assignee to start without asking the author.',
      },
      failsWhen: {
        pl: 'Opis powtarza tytuł innymi słowami, albo nie da się z niego wyprowadzić pierwszego kroku wykonania.',
        en: 'The description restates the title, or the first execution step cannot be derived from it.',
      },
    },
    {
      id: 'scope-clarity',
      pl: 'jasność zakresu',
      en: 'scope clarity',
      definition: {
        pl: 'Zakres wylicza co WCHODZI i co NIE WCHODZI, a granica z sąsiednimi zadaniami jest nazwana wprost.',
        en: 'Scope lists what is IN and what is OUT, and the boundary with adjacent tasks is named explicitly.',
      },
      failsWhen: {
        pl: 'Brak listy wyłączeń, albo zakres domyka się zwrotem rozmytym („itp.", „i inne", „w razie potrzeby").',
        en: 'No exclusion list, or scope is closed with a vague phrase ("etc.", "and others", "as needed").',
      },
    },
    {
      id: 'acceptance-criteria',
      pl: 'kryteria akceptacji',
      en: 'acceptance criteria',
      definition: {
        pl: 'Każde kryterium jest zerojedynkowo sprawdzalne przez osobę trzecią: ma obserwowalny artefakt lub pomiar, warunek i próg.',
        en: 'Every criterion is pass/fail checkable by a third party: it names an observable artifact or measurement, a condition and a threshold.',
      },
      failsWhen: {
        pl: 'Kryterium używa słów „poprawnie", „dobrze", „zgodnie z oczekiwaniami" bez definicji, albo nie da się wskazać KTO i CZYM je sprawdzi.',
        en: 'A criterion says "correctly", "properly", "as expected" without a definition, or one cannot say WHO checks it and WITH WHAT.',
      },
    },
    {
      id: 'dependencies',
      pl: 'zależności',
      en: 'dependencies',
      definition: {
        pl: 'Każda zależność ma kierunek (blokuje / jest blokowana), nazwany obiekt po drugiej stronie (zadanie, osoba, system) i stan.',
        en: 'Every dependency has a direction (blocks / is blocked by), a named counterpart (task, person, system) and a status.',
      },
      failsWhen: {
        pl: 'Zależność wymieniona hasłowo („zależy od IT") bez obiektu, bez kierunku albo bez daty potrzeby.',
        en: 'A dependency is a slogan ("depends on IT") without a counterpart, direction or need-by date.',
      },
    },
    {
      id: 'blocking-risks',
      pl: 'ryzyka blokady',
      en: 'blocking risks',
      definition: {
        pl: 'Każde ryzyko ma prawdopodobieństwo, wpływ (na termin lub zakres), właściciela, mitygację, wyzwalacz i ryzyko rezydualne — brak choćby jednego z sześciu = brak.',
        en: 'Every risk has probability, impact (on schedule or scope), an owner, a mitigation, a trigger and residual risk — any one of the six missing = a gap.',
      },
      failsWhen: {
        pl: 'Ryzyko opisane jednym zdaniem bez właściciela lub bez mitygacji, albo jako sama nazwa kategorii („ryzyko techniczne").',
        en: 'A risk is one sentence with no owner or no mitigation, or just a category label ("technical risk").',
      },
    },
    {
      id: 'evidence-completeness',
      pl: 'kompletność dowodów',
      en: 'evidence completeness',
      definition: {
        pl: 'Każde twierdzenie o stanie faktycznym ma źródło (dokument, rozmowa z datą, pomiar); każda liczba ma jednostkę i moment pomiaru.',
        en: 'Every factual claim carries a source (document, dated conversation, measurement); every number carries a unit and a measurement moment.',
      },
      failsWhen: {
        pl: 'Twierdzenie o faktach bez źródła, liczba bez jednostki albo bez daty, „wiadomo, że…" jako uzasadnienie.',
        en: 'A factual claim with no source, a number with no unit or date, "it is known that…" used as justification.',
      },
    },
    {
      id: 'source-decision-consistency',
      pl: 'spójność z decyzją źródłową',
      en: 'consistency with the source decision',
      definition: {
        pl: 'Wskazana jest decyzja źródłowa, a zakres i termin zadania mieszczą się w wybranej w niej opcji.',
        en: 'The source decision is named, and the task scope and deadline fit inside the option chosen there.',
      },
      failsWhen: {
        pl: 'Brak wskazania decyzji źródłowej, zadanie realizuje opcję odrzuconą, albo wykracza poza zakres, który decyzja autoryzowała.',
        en: 'No source decision named, the task pursues a rejected option, or it exceeds the scope the decision authorised.',
      },
    },
  ],

  decision: [
    {
      id: 'options-tradeoffs',
      pl: 'jakość opcji i trade-offów',
      en: 'quality of options and trade-offs',
      definition: {
        pl: 'Co najmniej dwie realnie rozważane opcje; każda ma koszt, korzyść, czas i warunek, w którym wygrywa. Trade-off nazywa, CZEGO SIĘ ZRZEKAMY wybierając daną opcję.',
        en: 'At least two genuinely considered options; each with cost, benefit, time and the condition under which it wins. The trade-off names WHAT IS GIVEN UP by choosing it.',
      },
      failsWhen: {
        pl: 'Jedna opcja, albo opcja-atrapa („nic nie robić") postawiona tylko po to, by wybór wyglądał na porównanie; opcje bez kosztu lub bez czasu.',
        en: 'A single option, or a straw option ("do nothing") added only to make the choice look like a comparison; options without cost or time.',
      },
    },
    {
      id: 'risk',
      pl: 'ryzyko',
      en: 'risk',
      definition: {
        pl: 'Każde ryzyko ma prawdopodobieństwo, wpływ, właściciela, mitygację, wyzwalacz i ryzyko rezydualne — brak choćby jednego z sześciu = brak.',
        en: 'Every risk has probability, impact, an owner, a mitigation, a trigger and residual risk — any one of the six missing = a gap.',
      },
      failsWhen: {
        pl: 'Ryzyko jest nazwą kategorii („ryzyko wdrożeniowe") bez pozostałych pięciu elementów, albo mitygacja to „monitorować".',
        en: 'A risk is a category label ("implementation risk") without the other five elements, or the mitigation is "monitor it".',
      },
    },
    {
      id: 'consequences',
      pl: 'konsekwencje',
      en: 'consequences',
      definition: {
        pl: 'Konsekwencje rozpisane w horyzoncie (natychmiast / kwartał / rok), z nazwaniem KTO je odczuje i CO staje się nieodwracalne.',
        en: 'Consequences laid out over a horizon (immediate / quarter / year), naming WHO feels them and WHAT becomes irreversible.',
      },
      failsWhen: {
        pl: 'Wypisane wyłącznie skutki pozytywne, brak kosztu odwrócenia decyzji, brak wskazania kto ponosi skutek.',
        en: 'Only positive effects listed, no cost of reversing the decision, no one named as bearing the effect.',
      },
    },
    {
      id: 'approval-readiness',
      pl: 'gotowość do zatwierdzenia',
      en: 'readiness for approval',
      definition: {
        pl: 'Wskazany imiennie decydent (lub rola z mandatem), próg mandatu, data ważności decyzji i to, co decydent musi zobaczyć, żeby zatwierdzić.',
        en: 'A named decision-maker (or mandated role), the mandate threshold, the decision expiry date, and what the decision-maker must see in order to approve.',
      },
      failsWhen: {
        pl: 'Brak imiennego decydenta, brak daty ważności, albo „do akceptacji zarządu" bez wskazania kto i do kiedy.',
        en: 'No named decision-maker, no expiry date, or "for board approval" without naming who and by when.',
      },
    },
  ],

  insight: [
    {
      id: 'thesis-clarity',
      pl: 'jasność tezy',
      en: 'clarity of the thesis',
      definition: {
        pl: 'Teza to JEDNO zdanie orzekające z podmiotem i wielkością, postawione na początku (piramida), które da się obalić.',
        en: 'The thesis is ONE declarative sentence with a subject and a magnitude, placed first (pyramid), and it can be disproven.',
      },
      failsWhen: {
        pl: 'Teza jest tematem („kwestia kosztów magazynu"), pytaniem, albo trzeba przeczytać akapit, żeby ją odnaleźć.',
        en: 'The thesis is a topic ("the warehouse cost question"), a question, or one must read a paragraph to find it.',
      },
    },
    {
      id: 'evidence-quality',
      pl: 'jakość dowodów',
      en: 'quality of evidence',
      definition: {
        pl: 'Każdy dowód ma źródło, datę i typ (pomiar / dokument / wypowiedź); przy wypowiedzi podana jest rola mówcy.',
        en: 'Every piece of evidence has a source, a date and a type (measurement / document / statement); for a statement the speaker role is given.',
      },
      failsWhen: {
        pl: 'Dowód to parafraza bez źródła, ten sam fakt policzony jako dwa dowody, albo dowód starszy niż okres, którego dotyczy teza, bez adnotacji.',
        en: 'Evidence is a paraphrase with no source, the same fact counted as two pieces, or evidence older than the period the thesis covers with no note.',
      },
    },
    {
      id: 'confidence-level',
      pl: 'poziom pewności',
      en: 'confidence level',
      definition: {
        pl: 'Poziom pewności podany jawnie WRAZ z uzasadnieniem, co go obniża (wielkość próby, wiek danych, jedno źródło).',
        en: 'The confidence level is stated explicitly TOGETHER with what lowers it (sample size, data age, single source).',
      },
      failsWhen: {
        pl: 'Brak poziomu pewności, albo „wysoka pewność" bez wskazania, jaka obserwacja by tezę obaliła.',
        en: 'No confidence level, or "high confidence" without saying which observation would disprove the thesis.',
      },
    },
    {
      id: 'missing-sources',
      pl: 'brakujące źródła',
      en: 'missing sources',
      definition: {
        pl: 'Nazwane są źródła, których zabrakło, i wpływ ich braku na tezę (co by się zmieniło, gdyby były).',
        en: 'The sources that are missing are named, along with the effect of their absence on the thesis (what would change if they existed).',
      },
      failsWhen: {
        pl: 'Brak sekcji o lukach dowodowych, mimo że teza opiera się na jednym źródle lub na jednej rozmowie.',
        en: 'No evidence-gap section although the thesis rests on a single source or a single conversation.',
      },
    },
    {
      id: 'contradictions',
      pl: 'sprzeczności',
      en: 'contradictions',
      definition: {
        pl: 'Sprzeczności między dowodami są wypisane i albo rozstrzygnięte z uzasadnieniem, albo jawnie oznaczone jako nierozstrzygnięte.',
        en: 'Contradictions between pieces of evidence are listed and either resolved with a rationale or explicitly marked unresolved.',
      },
      failsWhen: {
        pl: 'Dwa dowody dają różne wartości tej samej metryki albo przeciwne wnioski, a karta tego nie zauważa.',
        en: 'Two pieces of evidence give different values for the same metric or opposite conclusions, and the card does not notice.',
      },
    },
    {
      id: 'potential-impact',
      pl: 'potencjalny wpływ',
      en: 'potential impact',
      definition: {
        pl: 'Wpływ skwantyfikowany: wielkość, jednostka, horyzont i jawne założenie przeliczenia (z czego ta liczba wynika).',
        en: 'Impact is quantified: magnitude, unit, horizon and an explicit conversion assumption (where the number comes from).',
      },
      failsWhen: {
        pl: 'Wpływ opisany jako „istotny", „duży", „kluczowy dla organizacji" — bez liczby i bez założeń.',
        en: 'Impact described as "significant", "large", "key for the organisation" — with no number and no assumptions.',
      },
    },
    {
      id: 'conversion-readiness',
      pl: 'gotowość do konwersji',
      en: 'readiness for conversion',
      definition: {
        pl: 'Wskazano, w co insight ma się zamienić (decyzja / inicjatywa / zadanie), kto to podejmie i czego brakuje do konwersji.',
        en: 'It is stated what the insight should become (decision / initiative / task), who takes it forward and what is missing to convert it.',
      },
      failsWhen: {
        pl: 'Brak następnego kroku, albo następny krok to „przeanalizować dalej" / „omówić" bez adresata i terminu.',
        en: 'No next step, or the next step is "analyse further" / "discuss" with no addressee and no deadline.',
      },
    },
  ],

  initiative: [
    {
      id: 'goal-clarity',
      pl: 'jasność celu',
      en: 'clarity of the goal',
      definition: {
        pl: 'Cel opisuje STAN docelowy, ma miarę, wartość bazową i termin; da się orzec „osiągnięty / nieosiągnięty".',
        en: 'The goal describes a target STATE, with a measure, a baseline value and a deadline; it can be judged "achieved / not achieved".',
      },
      failsWhen: {
        pl: 'Cel jest czynnością („wdrożyć system") zamiast stanem, albo brakuje wartości bazowej, więc nie da się zmierzyć poprawy.',
        en: 'The goal is an activity ("implement the system") instead of a state, or the baseline is missing so improvement cannot be measured.',
      },
    },
    {
      id: 'scope-exclusions',
      pl: 'zakres i wyłączenia',
      en: 'scope and exclusions',
      definition: {
        pl: 'Zakres jest MECE: lista IN i lista OUT, pozycje wzajemnie rozłączne i razem pokrywające cel.',
        en: 'Scope is MECE: an IN list and an OUT list, items mutually exclusive and collectively covering the goal.',
      },
      failsWhen: {
        pl: 'Brak listy OUT, pozycje IN nakładają się na siebie, albo między zakresem a celem zostaje jawna luka.',
        en: 'No OUT list, IN items overlap, or an explicit gap remains between scope and goal.',
      },
    },
    {
      id: 'kpi-quality',
      pl: 'jakość KPI',
      en: 'KPI quality',
      definition: {
        pl: 'Każde KPI ma definicję pomiaru, źródło danych, częstotliwość, wartość bazową i wartość docelową.',
        en: 'Every KPI has a measurement definition, a data source, a frequency, a baseline and a target value.',
      },
      failsWhen: {
        pl: 'KPI bez źródła danych lub bez wartości bazowej (nie da się stwierdzić poprawy), albo KPI mierzące aktywność zamiast efektu.',
        en: 'A KPI with no data source or no baseline (improvement cannot be established), or a KPI measuring activity instead of effect.',
      },
    },
    {
      id: 'success-criteria',
      pl: 'kryteria sukcesu',
      en: 'success criteria',
      definition: {
        pl: 'Kryteria sukcesu są warunkami ODBIORU (rozłącznymi z KPI), sprawdzalnymi, z nazwanym właścicielem odbioru.',
        en: 'Success criteria are ACCEPTANCE conditions (disjoint from KPIs), checkable, with a named acceptance owner.',
      },
      failsWhen: {
        pl: 'Kryteria powtarzają KPI innymi słowami, albo nie wskazują, kto orzeka o sukcesie i na jakiej podstawie.',
        en: 'Criteria restate the KPIs, or do not say who judges success and on what basis.',
      },
    },
    {
      id: 'task-completeness',
      pl: 'kompletność zadań',
      en: 'completeness of tasks',
      definition: {
        pl: 'Zadania pokrywają cały zakres IN (MECE), każde ma właściciela i termin; żaden element zakresu nie zostaje bez zadania.',
        en: 'Tasks cover the whole IN scope (MECE), each has an owner and a deadline; no scope item is left without a task.',
      },
      failsWhen: {
        pl: 'Istnieje element zakresu IN bez ani jednego zadania, albo zadanie bez właściciela lub bez terminu.',
        en: 'An IN scope item has no task at all, or a task has no owner or no deadline.',
      },
    },
    {
      id: 'dependencies',
      pl: 'zależności',
      en: 'dependencies',
      definition: {
        pl: 'Zależności wewnętrzne i zewnętrzne mają kierunek, osobę lub zespół po drugiej stronie oraz datę potrzeby.',
        en: 'Internal and external dependencies have a direction, a person or team on the other side, and a need-by date.',
      },
      failsWhen: {
        pl: 'Zależność bez adresata po drugiej stronie, bez daty, albo wpisana jako „współpraca z biznesem".',
        en: 'A dependency with no counterpart, no date, or written as "cooperation with the business".',
      },
    },
    {
      id: 'risks',
      pl: 'ryzyka',
      en: 'risks',
      definition: {
        pl: 'Każde ryzyko ma prawdopodobieństwo, wpływ, właściciela, mitygację, wyzwalacz i ryzyko rezydualne — brak choćby jednego z sześciu = brak.',
        en: 'Every risk has probability, impact, an owner, a mitigation, a trigger and residual risk — any one of the six missing = a gap.',
      },
      failsWhen: {
        pl: 'Lista ryzyk to kategorie bez mitygacji i bez właściciela, albo ryzyka dotyczą wyłącznie czynników zewnętrznych.',
        en: 'The risk list is categories with no mitigation and no owner, or all risks are external factors only.',
      },
    },
    {
      id: 'source-consistency',
      pl: 'zgodność z decyzją/insightem źródłowym',
      en: 'consistency with the source decision/insight',
      definition: {
        pl: 'Wskazana jest decyzja lub insight źródłowy, a cel i zakres inicjatywy mieszczą się w tym, co tam ustalono.',
        en: 'The source decision or insight is named, and the initiative goal and scope fit within what was established there.',
      },
      failsWhen: {
        pl: 'Brak wskazania źródła, albo zakres wykracza poza to, co decyzja autoryzowała, bez adnotacji o rozszerzeniu.',
        en: 'No source named, or scope exceeds what the decision authorised with no note about the extension.',
      },
    },
    {
      id: 'gate-readiness',
      pl: 'gotowość do bramy',
      en: 'readiness for the gate',
      definition: {
        pl: 'Nazwana jest najbliższa brama, jej kryteria wejścia oraz lista tego, czego jeszcze brakuje, z terminem uzupełnienia.',
        en: 'The next gate is named, with its entry criteria and a list of what is still missing, each with a completion date.',
      },
      failsWhen: {
        pl: 'Brak nazwanej bramy, brak jej kryteriów, albo „gotowe do bramy" bez listy braków.',
        en: 'No gate named, no entry criteria, or "gate-ready" asserted with no list of outstanding items.',
      },
    },
  ],

  tool: [
    {
      id: 'goal-alignment',
      pl: 'zgodność treści z celem',
      en: 'alignment of content with the goal',
      definition: {
        pl: 'Każda sekcja treści daje się przypisać do celu narzędzia, a każdy element celu ma pokrycie w treści.',
        en: 'Every content section maps to the tool goal, and every element of the goal is covered by content.',
      },
      failsWhen: {
        pl: 'Istnieje sekcja, której usunięcie nie zmienia realizacji celu, albo element celu bez odpowiadającej treści.',
        en: 'A section exists whose removal would not affect the goal, or an element of the goal has no matching content.',
      },
    },
    {
      id: 'inputs-completeness',
      pl: 'kompletność wejść',
      en: 'completeness of inputs',
      definition: {
        pl: 'Wypisane są wejścia (dane, uczestnicy, materiały, czas), każde ze źródłem i osobą odpowiedzialną za dostarczenie.',
        en: 'Inputs are listed (data, participants, materials, time), each with a source and a person responsible for providing it.',
      },
      failsWhen: {
        pl: 'Wejście wymienione bez wskazania, skąd pochodzi lub kto je dostarcza; „dane historyczne" bez zakresu i formatu.',
        en: 'An input is listed without saying where it comes from or who provides it; "historical data" with no range or format.',
      },
    },
    {
      id: 'process-clarity',
      pl: 'klarowność procesu',
      en: 'clarity of the process',
      definition: {
        pl: 'Kroki są ponumerowane; każdy ma wykonawcę, czas trwania i wynik cząstkowy; kolejność jest wymuszona albo jawnie dowolna.',
        en: 'Steps are numbered; each has a performer, a duration and an intermediate output; the order is either enforced or explicitly free.',
      },
      failsWhen: {
        pl: 'Krok bez wyniku cząstkowego, albo instrukcja typu „omówić temat" / „przeanalizować" bez określenia JAK.',
        en: 'A step with no intermediate output, or an instruction like "discuss the topic" / "analyse" without saying HOW.',
      },
    },
    {
      id: 'outcome-quality',
      pl: 'jakość rezultatu',
      en: 'quality of the outcome',
      definition: {
        pl: 'Rezultat opisany jako ARTEFAKT: co powstaje, w jakiej formie, kto go odbiera i po czym poznać, że jest dobry.',
        en: 'The outcome is described as an ARTIFACT: what is produced, in what form, who receives it and how its quality is recognised.',
      },
      failsWhen: {
        pl: 'Rezultat to „zrozumienie", „wnioski", „wspólny obraz" — bez artefaktu i bez kryterium jakości.',
        en: 'The outcome is "understanding", "conclusions", "shared picture" — with no artifact and no quality criterion.',
      },
    },
    {
      id: 'limitations',
      pl: 'ograniczenia',
      en: 'limitations',
      definition: {
        pl: 'Nazwane granice stosowalności: kiedy narzędzie NIE działa, jakich pytań nie rozstrzyga, jakie założenia musi spełnić kontekst.',
        en: 'Boundaries of applicability are named: when the tool does NOT work, which questions it does not settle, what the context must satisfy.',
      },
      failsWhen: {
        pl: 'Brak sekcji ograniczeń, albo ograniczenia sprowadzone do „wymaga zaangażowania uczestników".',
        en: 'No limitations section, or limitations reduced to "requires participant engagement".',
      },
    },
    {
      id: 'session-readiness',
      pl: 'gotowość do sesji',
      en: 'readiness for the session',
      definition: {
        pl: 'Wskazani uczestnicy z rolami, agenda z czasami, materiały do wysłania przed sesją i warunek jej odwołania.',
        en: 'Participants with roles are named, an agenda with timings, materials to send beforehand, and the condition for cancelling.',
      },
      failsWhen: {
        pl: 'Brak ról uczestników, brak listy materiałów wymaganych przed sesją, albo agenda bez czasów.',
        en: 'No participant roles, no list of pre-session materials, or an agenda without timings.',
      },
    },
  ],

  // ── POWIADOMIENIE ──────────────────────────────────────────────────────────
  // Kontrakt właściciela dla Powiadomienia nie wylicza osi tak jak dla pozostałych
  // pięciu — mówi: „treść aktywnej karty względem jej celu — braki, ryzyka,
  // proponowane poprawki". Poprzednia wersja brała to zdanie DOSŁOWNIE i robiła
  // z „braków" i „ryzyk" IDENTYFIKATORY KRYTERIÓW, przez co `criterionId: 'gaps'`
  // w liście `gaps` był tautologią („brak, bo brak") i nie mierzył niczego.
  // Osie poniżej to realne wymiary jakości powiadomienia; „braki" i „ryzyka"
  // zostają tam, gdzie ich miejsce — jako KOSZYKI WYNIKU, nie kryteria.
  notification: [
    {
      id: 'event-clarity',
      pl: 'jasność zdarzenia',
      en: 'clarity of the event',
      definition: {
        pl: 'Pierwsze zdanie mówi CO się stało, KIEDY i w którym obiekcie (nazwa lub identyfikator) — bez otwierania innego ekranu.',
        en: 'The first sentence states WHAT happened, WHEN and in WHICH object (name or identifier) — without opening another screen.',
      },
      failsWhen: {
        pl: 'Treść wymaga otwarcia innego ekranu, żeby zrozumieć, czego dotyczy, albo brakuje momentu zdarzenia.',
        en: 'The reader must open another screen to understand what it concerns, or the moment of the event is missing.',
      },
    },
    {
      id: 'required-action',
      pl: 'konkretność wymaganej akcji',
      en: 'specificity of the required action',
      definition: {
        pl: 'Wskazana jest JEDNA akcja w trybie rozkazującym wraz z miejscem jej wykonania — albo jawne „do wiadomości, nie wymaga akcji".',
        en: 'ONE action is given in the imperative together with where to perform it — or an explicit "for information, no action required".',
      },
      failsWhen: {
        pl: 'Akcja brzmi „zapoznaj się" / „zweryfikuj" bez wskazania czego i gdzie, albo w jednym powiadomieniu są trzy akcje bez priorytetu.',
        en: 'The action reads "review" / "verify" without saying what and where, or three actions are bundled with no priority.',
      },
    },
    {
      id: 'deadline-urgency',
      pl: 'termin i pilność',
      en: 'deadline and urgency',
      definition: {
        pl: 'Podany jest termin (data lub okno czasowe), a pilność wynika ze zdarzenia, nie z etykiety.',
        en: 'A deadline is given (date or time window), and the urgency follows from the event, not from a label.',
      },
      failsWhen: {
        pl: 'Brak terminu przy wymaganej akcji, albo pilność deklarowana słowem („PILNE", „ASAP") bez daty.',
        en: 'No deadline for a required action, or urgency declared by a word ("URGENT", "ASAP") with no date.',
      },
    },
    {
      id: 'addressee',
      pl: 'adresat',
      en: 'addressee',
      definition: {
        pl: 'Jasne jest, KTO ma zadziałać (osoba lub rola) i czym jego rola różni się od pozostałych odbiorców.',
        en: 'It is clear WHO must act (person or role) and how their role differs from the other recipients.',
      },
      failsWhen: {
        pl: 'Adresatem jest grupa bez wskazania odpowiedzialnego, albo przy wymaganej akcji nie ma adresata w ogóle.',
        en: 'The addressee is a group with no responsible person, or a required action has no addressee at all.',
      },
    },
    {
      id: 'ignore-consequence',
      pl: 'konsekwencja zignorowania',
      en: 'consequence of ignoring',
      definition: {
        pl: 'Napisane jest, CO się stanie, jeśli nikt nie zareaguje do terminu, i KTO lub CO na tym ucierpi.',
        en: 'It states WHAT happens if nobody reacts by the deadline, and WHO or WHAT is harmed.',
      },
      failsWhen: {
        pl: 'Brak konsekwencji, przez co odbiorca nie ma jak ustawić priorytetu wobec innych powiadomień.',
        en: 'No consequence stated, so the recipient cannot prioritise it against other notifications.',
      },
    },
  ],

  // Interview Session jest w rejestrze kart N (registry.ts), ale NIE ma przycisku
  // „Analizuj z AI". Zweryfikowane w realnym kodzie 2026-07-23:
  // `src/components/Interview/InterviewWorkspace.tsx` NIE importuje
  // `useCardAIAnalysis` ani `Menu2AIButton` (grep: zero trafień), więc silnik nie
  // jest z tej karty wywoływalny. Wpis istnieje WYŁĄCZNIE dlatego, że
  // `Record<KartaNKey, …>` wymaga kompletu kluczy — pusta lista jest UCZCIWA:
  // brak zadeklarowanych kryteriów, nie „kryteria domyślne". Dopisanie tu kryteriów
  // byłoby projektowaniem rubryki dla ekranu, którego kontrakt ETAPU 3 nie obejmuje
  // (kontrakt wylicza sześć kart: Decision, Task, Notification, Insight, Tool,
  // Initiative). Gdyby przycisk kiedyś powstał — najpierw decyzja właściciela
  // o osiach, potem wpis tutaj.
  interview: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// DOKTRYNA — reguły przekrojowe, obowiązujące niezależnie od typu artefaktu.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reguła doktryny. `id` trafia do `CardAnalysisFinding.criterionId` tak samo jak
 * id kryterium — panel pokazuje go w polu „kryterium", więc użytkownik widzi,
 * że zgłoszenie wynika z reguły warsztatu, a nie z osi typu artefaktu.
 */
export interface DoctrineRule {
  id: string;
  /** Nagłówek reguły (WERSALIKAMI w prompcie). */
  name: Bilingual;
  /** Co reguła nakazuje. */
  rule: Bilingual;
  /** Obserwowalny objaw naruszenia — model ma czego szukać. */
  violation: Bilingual;
}

/**
 * Pięć reguł warsztatu doradczego + dwie reguły higieny, których brak realnie
 * przepuszczał wady (język, spójność liczbowa). Kolejność jest wiążąca —
 * prompt renderuje je w tej samej kolejności.
 */
export const DOCTRINE_RULES: readonly DoctrineRule[] = [
  {
    id: 'doktryna-piramida',
    name: { pl: 'PIRAMIDA (wniosek najpierw)', en: 'PYRAMID (answer first)' },
    rule: {
      pl: 'Treść zaczyna się od wniosku lub odpowiedzi; dopiero pod nim stoją argumenty, a pod nimi dane. Argumenty muszą wspierać dokładnie ten wniosek.',
      en: 'Content starts with the conclusion or answer; arguments sit beneath it and data beneath those. The arguments must support exactly that conclusion.',
    },
    violation: {
      pl: 'Karta zaczyna się od tła, historii lub metodyki, a wniosek pojawia się na końcu albo wcale; argumenty dotyczą czegoś innego niż postawiony wniosek.',
      en: 'The card starts with background, history or methodology and the conclusion comes last or never; arguments address something other than the stated conclusion.',
    },
  },
  {
    id: 'doktryna-mece',
    name: {
      pl: 'MECE (rozłączne i wyczerpujące)',
      en: 'MECE (mutually exclusive, collectively exhaustive)',
    },
    rule: {
      pl: 'Każda lista (opcje, ryzyka, zakres, zadania, przyczyny) ma pozycje wzajemnie rozłączne, razem wyczerpujące temat i na jednym poziomie ogólności.',
      en: 'Every list (options, risks, scope, tasks, causes) has items that are mutually exclusive, collectively exhaustive and at one level of abstraction.',
    },
    violation: {
      pl: 'Pozycje zachodzą na siebie, mieszają poziomy („koszt" obok „koszt licencji"), albo zostawiają jawną lukę wobec tematu listy.',
      en: 'Items overlap, mix levels ("cost" next to "licence cost"), or leave an explicit gap relative to the list topic.',
    },
  },
  {
    id: 'doktryna-kwantyfikacja',
    name: {
      pl: 'KWANTYFIKACJA Z JAWNYMI ZAŁOŻENIAMI',
      en: 'QUANTIFICATION WITH EXPLICIT ASSUMPTIONS',
    },
    rule: {
      pl: 'Twierdzenie o wielkości ma liczbę, jednostkę, okres i źródło. Jeśli liczba jest szacunkiem — obok stoi założenie, z którego wynika, i sposób przeliczenia.',
      en: 'A claim about magnitude has a number, a unit, a period and a source. If the number is an estimate, the assumption behind it and the conversion are stated next to it.',
    },
    violation: {
      pl: 'Ocena wielkości bez liczby („znaczna oszczędność", „istotny wzrost", „to ważne dla organizacji"), albo liczba bez jednostki, okresu lub założenia.',
      en: 'A magnitude judged with no number ("significant savings", "material growth", "this matters to the organisation"), or a number with no unit, period or assumption.',
    },
  },
  {
    id: 'doktryna-falsyfikowalnosc',
    name: { pl: 'FALSYFIKOWALNOŚĆ', en: 'FALSIFIABILITY' },
    rule: {
      pl: 'Każde twierdzenie da się obalić: można wskazać obserwację, pomiar lub zdarzenie, które by je unieważniło.',
      en: 'Every claim can be disproven: one can point to an observation, measurement or event that would invalidate it.',
    },
    violation: {
      pl: 'Zdanie prawdziwe zawsze i dla każdego („usprawnienie procesu przyniesie korzyści", „lepsza komunikacja poprawi współpracę"), którego nie da się sprawdzić ani obalić.',
      en: 'A sentence true always and for everyone ("process improvement will bring benefits", "better communication improves collaboration") that cannot be checked or refuted.',
    },
  },
  {
    id: 'doktryna-niepewnosc',
    name: { pl: 'UCZCIWA NIEPEWNOŚĆ', en: 'HONEST UNCERTAINTY' },
    rule: {
      pl: 'To, czego nie wiadomo, jest nazwane wprost: luka w danych, jedno źródło, dane starsze niż okres decyzji. Pewność deklarowana jest z uzasadnieniem.',
      en: 'What is unknown is named plainly: data gap, single source, data older than the decision period. Confidence is declared with a justification.',
    },
    violation: {
      pl: 'Kategoryczny ton przy jednym źródle lub przy danych bez daty; brak wskazania, co mogłoby zmienić wniosek; szacunek podany jak fakt.',
      en: 'A categorical tone on a single source or undated data; no statement of what could change the conclusion; an estimate presented as a fact.',
    },
  },
  {
    id: 'doktryna-jezyk',
    name: { pl: 'JĘZYK', en: 'LANGUAGE' },
    rule: {
      pl: 'Tekst po polsku, bez kalek i wtrętów angielskich tam, gdzie istnieje polski odpowiednik. Jedno pojęcie = jeden termin w całym widoku.',
      en: 'Text in English, without untranslated foreign terms where an English equivalent exists. One concept = one term across the whole view.',
    },
    violation: {
      pl: 'Kalki i wtręty („Findingi", „downstream", „forkuj", „ownership", „insighty" zamiast „wnioski/ustalenia"); ten sam obiekt raz „karta", raz „card", raz „sekcja"; spolszczone czasowniki angielskie.',
      en: 'Untranslated or hybrid terms; the same object called "card" here and "tile" there; inconsistent terminology within one view.',
    },
  },
  {
    id: 'doktryna-liczby',
    name: { pl: 'SPÓJNOŚĆ LICZBOWA', en: 'NUMERIC CONSISTENCY' },
    rule: {
      pl: 'Zanim ocenisz, wypisz sobie KAŻDĄ liczbę z karty i z kontekstu artefaktu wraz z nazwą metryki, jednostką i momentem pomiaru. Wartości tej samej metryki muszą się zgadzać.',
      en: 'Before assessing, list EVERY number from the card and from the artifact context together with its metric name, unit and measurement moment. Values of the same metric must agree.',
    },
    violation: {
      pl: 'Ta sama metryka ma dwie różne wartości (karta mówi „96 min", historia pokazuje „84 → 71"), albo liczba stoi bez nazwy metryki i jednostki („35 → 42" — czego?). Sprzeczne wartości tej samej metryki zgłaszaj w „risks" z severity „high".',
      en: 'The same metric carries two different values (the card says "96 min", the history shows "84 → 71"), or a number stands with no metric name and unit ("35 → 42" — of what?). Report conflicting values of the same metric in "risks" with severity "high".',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// KALIBRACJA `completeness` — pasma z opisem, czego każde wymaga.
// ─────────────────────────────────────────────────────────────────────────────

/** Jedno pasmo oceny 0-100 wraz z warunkiem, który trzeba spełnić, żeby w nim być. */
export interface CompletenessBand {
  label: string;
  meaning: Bilingual;
}

/**
 * Bez tych kotwic `completeness` była liczbą bez kalibracji — dwa przebiegi na
 * tym samym wsadzie rozjeżdżały się o 20+ punktów, bo model nie miał pojęcia,
 * co znaczy „78". Pasma są opisane WARUNKAMI (ile braków i jakiej wagi), więc
 * ocena wynika z listy znalezisk, a nie z wrażenia.
 */
export const COMPLETENESS_BANDS: readonly CompletenessBand[] = [
  {
    label: '90-100',
    meaning: {
      pl: 'Wszystkie kryteria spełnione wg progu „SPEŁNIONE GDY"; zero braków o wadze high i medium; każda liczba ma jednostkę i źródło lub jawne założenie; kartę można przekazać klientowi bez poprawek.',
      en: 'All criteria met per the "MET WHEN" threshold; zero high or medium gaps; every number has a unit and a source or an explicit assumption; the card can go to the client unchanged.',
    },
  },
  {
    label: '70-89',
    meaning: {
      pl: 'Każde kryterium jest zaadresowane; najwyżej dwa braki o wadze medium; zero braków high. Karta wymaga UZUPEŁNIEŃ, nie przepisania.',
      en: 'Every criterion is addressed; at most two medium gaps; zero high gaps. The card needs ADDITIONS, not a rewrite.',
    },
  },
  {
    label: '50-69',
    meaning: {
      pl: 'Co najmniej jedno kryterium jest niespełnione wg progu „NIESPEŁNIONE GDY", albo jest przynajmniej jeden brak o wadze high. Szkielet jest, ale karta nie nadaje się do przekazania.',
      en: 'At least one criterion fails per the "FAILS WHEN" threshold, or there is at least one high gap. The skeleton exists but the card is not fit to hand over.',
    },
  },
  {
    label: '< 50',
    meaning: {
      pl: 'Większość kryteriów bez pokrycia albo treść jest ogólnikowa (twierdzenia bez liczb, źródeł i właścicieli). Karta pusta lub zawierająca sam tytuł/placeholder: nie więcej niż 10.',
      en: 'Most criteria uncovered, or the content is generic (claims with no numbers, sources or owners). An empty card or one holding only a title/placeholder: no more than 10.',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WAGA (severity) — kotwice, żeby „medium" nie było workiem na wszystko.
// ─────────────────────────────────────────────────────────────────────────────

/** Kotwica jednej wagi. Renderowana w prompcie, egzekwowana przy parsowaniu. */
export interface SeverityAnchor {
  level: 'high' | 'medium' | 'low';
  meaning: Bilingual;
}

export const SEVERITY_ANCHORS: readonly SeverityAnchor[] = [
  {
    level: 'high',
    meaning: {
      pl: 'BLOKUJE — w tym stanie karty nie wolno pokazać klientowi ani skierować do zatwierdzenia (brak kryteriów akceptacji, sprzeczne wartości tej samej metryki, ryzyko bez właściciela, brak decydenta).',
      en: 'BLOCKING — in this state the card must not be shown to a client or sent for approval (no acceptance criteria, conflicting values of the same metric, a risk with no owner, no decision-maker).',
    },
  },
  {
    level: 'medium',
    meaning: {
      pl: 'OBNIŻA JAKOŚĆ, nie blokuje — treść jest, ale brakuje precyzji, źródła, jednostki albo kwantyfikacji.',
      en: 'LOWERS QUALITY, does not block — the content exists but lacks precision, a source, a unit or quantification.',
    },
  },
  {
    level: 'low',
    meaning: {
      pl: 'ROZWINIĘCIE lub kosmetyka — karta działa bez tego.',
      en: 'AN EXPANSION or cosmetics — the card works without it.',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// (3) CEL KARTY + STANDARD TREŚCI — wyszukanie w kanonie kart.
// ─────────────────────────────────────────────────────────────────────────────

/** Deskryptory kanoniczne per artefakt. Klucz = `KartaNKey`. */
const CARD_DESCRIPTORS: Record<CardAnalysisArtifactType, readonly KanonicznaKarta[]> = {
  task: TASK_CARDS,
  decision: DECISION_CARDS,
  notification: NOTIFICATION_CARDS,
  insight: INSIGHT_CARDS,
  initiative: INITIATIVE_CANONICAL_CARDS,
  tool: TOOL_CARDS,
  interview: [],
};

/**
 * Id, pod którym artefakt RENDERUJE kartę. Kanon dopuszcza alias dedup
 * (`idWArtefakcie`), np. kanoniczne `governance` renderuje się w Decision jako
 * `governance-escalation`. Aktywna sekcja w widoku niesie render-id, więc
 * dopasowanie MUSI iść przez alias, inaczej Decision/Task nie znajdą połowy kart.
 */
function renderIdFor(karta: KanonicznaKarta, artefakt: CardAnalysisArtifactType): string | null {
  const m = karta.kompozycja.find((p) => p.artefakt === artefakt);
  if (!m) return null;
  return m.idWArtefakcie ?? karta.id;
}

/** Cel + standard karty, wyprowadzone z kanonu (nie wymyślone tutaj). */
export interface CardStandard {
  /** Nazwa karty w języku UI. */
  label: string;
  /** „Po co ta karta jest" — `KanonicznaKarta.opis`. Pusty gdy kanon milczy. */
  purpose: string;
  /**
   * „Co ta karta ma zawierać" — `aiPrompt.szablon` dla kart, których treść pisze
   * lub asystuje AI. Dla kart `dane`/`systemowa`/`transakcyjna` kanon deklaruje
   * JAWNY brak z powodem — wtedy tu ląduje ten powód, poprzedzony etykietą.
   */
  standard: string;
  /** Rola AI wobec tej karty — panel/prompt musi wiedzieć, czy AI wolno tu pisać. */
  aiRole: KanonicznaKarta['rolaAI'];
  /**
   * `false` ⇒ kanon nie deklaruje ani `opis`, ani treści promptu. Prompt powie
   * modelowi wprost, żeby nie wymyślał wymagań tej karty.
   */
  standardZnany: boolean;
  /** Status rozjazdu z kanonu — uczciwa flaga, pokazywana w panelu jako notka. */
  statusKanonu: KanonicznaKarta['statusKanonu'];
}

/**
 * Znajduje kartę w kanonie po render-id. Zwraca `null`, gdy karty nie ma
 * w deskryptorze — wtedy wywołujący pracuje na samej etykiecie sekcji
 * i kryteriach typu artefaktu (patrz `buildCardStandard`).
 */
export function findCanonicalCard(
  artifactType: CardAnalysisArtifactType,
  cardId: string
): KanonicznaKarta | null {
  const descriptors = CARD_DESCRIPTORS[artifactType] ?? [];
  return (
    descriptors.find((k) => renderIdFor(k, artifactType) === cardId) ??
    // Zapasowo po id kanonicznym — Initiative renderuje część kart pod camelCase
    // kluczem sekcji, który BYWA równy id kanonicznemu bez wpisu `idWArtefakcie`.
    descriptors.find((k) => k.id === cardId) ??
    null
  );
}

/**
 * Buduje cel+standard karty. `fallbackLabel` (etykieta sekcji z widoku) jest
 * używana, gdy karty nie ma w kanonie — nadal analizujemy, ale MÓWIMY, że
 * standard jest nieznany, zamiast go zmyślić.
 */
export function buildCardStandard(
  artifactType: CardAnalysisArtifactType,
  cardId: string,
  fallbackLabel: string,
  isPolish: boolean
): CardStandard {
  const karta = findCanonicalCard(artifactType, cardId);

  if (!karta) {
    return {
      label: fallbackLabel,
      purpose: '',
      standard: '',
      aiRole: 'asystuje',
      standardZnany: false,
      statusKanonu: {
        stan: 'do-decyzji-piotra',
        opis: `Karta "${cardId}" nie występuje w deskryptorze kanonicznym artefaktu "${artifactType}".`,
      },
    };
  }

  const purpose = karta.opis ? (isPolish ? karta.opis.pl : karta.opis.en) : '';

  const standard =
    'none' in karta.aiPrompt
      ? // Jawny brak promptu — to NIE jest luka, tylko deklaracja („AI tu nie pisze").
        // Niesiemy powód, żeby model wiedział, dlaczego nie ma czego generować.
        `${isPolish ? 'Kanon deklaruje BRAK generacji AI dla tej karty' : 'The canon declares NO AI generation for this card'}: ${karta.aiPrompt.reason}`
      : karta.aiPrompt.szablon;

  return {
    label: isPolish ? karta.label.pl : karta.label.en,
    purpose,
    standard,
    aiRole: karta.rolaAI,
    standardZnany: Boolean(purpose) || !('none' in karta.aiPrompt),
    statusKanonu: karta.statusKanonu,
  };
}

/** Kryterium w języku UI — oś + oba progi. */
export interface ResolvedCriterion {
  id: string;
  text: string;
  definition: string;
  failsWhen: string;
}

/**
 * Kryteria typu artefaktu w języku UI. Zwraca TRZY teksty na kryterium (oś,
 * próg spełnienia, próg odcięcia) — sama oś nie jest rubryką i nie pozwala
 * modelowi orzec, czy kryterium jest spełnione.
 */
export function criteriaFor(
  artifactType: CardAnalysisArtifactType,
  isPolish: boolean
): ResolvedCriterion[] {
  return (ARTIFACT_CRITERIA[artifactType] ?? []).map((c) => ({
    id: c.id,
    text: isPolish ? c.pl : c.en,
    definition: isPolish ? c.definition.pl : c.definition.en,
    failsWhen: isPolish ? c.failsWhen.pl : c.failsWhen.en,
  }));
}

/** Reguły doktryny w języku UI. */
export function doctrineFor(isPolish: boolean): Array<{
  id: string;
  name: string;
  rule: string;
  violation: string;
}> {
  return DOCTRINE_RULES.map((d) => ({
    id: d.id,
    name: isPolish ? d.name.pl : d.name.en,
    rule: isPolish ? d.rule.pl : d.rule.en,
    violation: isPolish ? d.violation.pl : d.violation.en,
  }));
}

/** Pasma kalibracji `completeness` w języku UI. */
export function completenessBandsFor(isPolish: boolean): Array<{ label: string; meaning: string }> {
  return COMPLETENESS_BANDS.map((b) => ({
    label: b.label,
    meaning: isPolish ? b.meaning.pl : b.meaning.en,
  }));
}

/** Kotwice wag w języku UI. */
export function severityAnchorsFor(isPolish: boolean): Array<{ level: string; meaning: string }> {
  return SEVERITY_ANCHORS.map((s) => ({
    level: s.level,
    meaning: isPolish ? s.meaning.pl : s.meaning.en,
  }));
}
