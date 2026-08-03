/**
 * dev-render — host dla PRAWDZIWEJ karty `<InsightViewer>`
 * (src/components/Interview/InsightViewer.tsx, archetyp C·Rekord wg SPEC-A).
 *
 * Cel (CLAUDE.md #7): nadzorca renderuje i zrzuca REALNY ekran-artefakt
 * Insight z danymi makietowymi, ZANIM zobaczy go Piotr. Zero backendu,
 * zero logowania. Komponent produkcyjny — bez re-implementacji, bez atrapy.
 *
 * ── Czym ten ekran różni się od `insight-artifact.tsx` ──────────────────
 * `insight-artifact.tsx` używa WBUDOWANEGO trybu demo komponentu: id z
 * prefiksem `demo-interview-` wpada w branch `applyDemoInsight`
 * (InsightViewer.tsx:1421/1457) i komponent czyta gotowy, ANGIELSKI dataset
 * z `interviewDemoData.ts` — ścieżka sieciowa nie jest w ogóle wykonywana.
 *
 * Ten ekran robi odwrotnie: id NIE jest demo-id, więc `loadInsight` idzie
 * PEŁNĄ, produkcyjną ścieżką (`V8InterviewApi.getInsight` → sesje źródłowe →
 * `getSessionSummary` → activity → comments). Podstawiamy własny, POLSKI
 * insight doradczy. Dzięki temu widać ten sam komponent na realnym torze
 * ładowania i na treści, którą właściciel rozumie bez tłumaczenia.
 *
 * ── Co trzeba było podstawić i dlaczego ────────────────────────────────
 * `V8InterviewApi` to zwykły obiekt (`export const V8InterviewApi = {...}`,
 * src/services/api/v8/interview.ts:575), więc nadpisanie metody patchuje ten
 * sam singleton, który importuje komponent (wzorzec z
 * dev-render/screens/decision-record.tsx i melscanvas-workspace.tsx).
 *
 *   getInsight          → rdzeń artefaktu (themes/issues/opportunities/
 *                         signals/evidenceMap) — WYMAGANE, inaczej `error`.
 *   getSession          → 3 sesje źródłowe (pasek „Źródła").
 *   getSessionSummary   → facts/gaps/constraints/painPoints per sesja.
 *   getInsightActivity  → sekcja Historia w prawym panelu.
 *   getInsightComments  → sekcja Komentarze w prawym panelu.
 *
 * Reszty loaderów (`getAnalysis`, `listCandidates`, `getSourcePack`,
 * `getInsightReportPack`, `getInsightReportReadiness`) świadomie NIE
 * stubujemy — każdy ma własny `.catch(() => null/[])`
 * (InsightViewer.tsx:1170-1240), więc puste dane to normalna, obsłużona
 * ścieżka komponentu, a nie awaria. Sekcje analizy/kandydatów pokażą swój
 * realny stan pusty — i o to chodzi: zrzut ma pokazywać prawdę.
 *
 * Polling po `loadInsight` (InsightViewer.tsx:1546) zatrzymuje się po
 * pierwszym ticku, bo `status === 'completed'` (nie `generating`).
 *
 * URL: ?screen=karta-insight[&lang=pl|en][&theme=light|dark]
 * (rejestrację w dev-render/main.tsx robi nadzorca — ten plik niczego
 * poza sobą nie dotyka).
 */
import React from 'react';

import { InsightViewer } from '../../src/components/Interview/InsightViewer';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import i18n from '../../src/i18n';
import { AppProviders } from '../../src/providers/AppProviders';
import { V8InterviewApi } from '../../src/services/api/v8/interview';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

// Świadomie BEZ prefiksu `demo-interview-` — patrz nagłówek.
const INSIGHT_ID = 'insight-mzt-gotowosc-operacyjna-2026-07';
const ORG_ID = 'org-dbr77-demo';

const SESSION_IDS = [
  'session-mzt-dyrektor-produkcji',
  'session-mzt-kierownik-utrzymania-ruchu',
  'session-mzt-lider-planowania',
];

// ── Sesje źródłowe (pasek „Źródła" + zakładka sesji) ─────────────────────
const MOCK_SESSIONS: Record<string, any> = {
  [SESSION_IDS[0]]: {
    id: SESSION_IDS[0],
    name: 'Wywiad — Dyrektor Produkcji (zakład Toruń)',
    templateName: 'Ocena gotowości operacyjnej',
    completedAt: daysAgoIso(19),
    respondentRole: 'Dyrektor Produkcji',
    department: 'Produkcja',
  },
  [SESSION_IDS[1]]: {
    id: SESSION_IDS[1],
    name: 'Wywiad — Kierownik Utrzymania Ruchu',
    templateName: 'Ocena gotowości operacyjnej',
    completedAt: daysAgoIso(17),
    respondentRole: 'Kierownik Utrzymania Ruchu',
    department: 'Techniczny',
  },
  [SESSION_IDS[2]]: {
    id: SESSION_IDS[2],
    name: 'Wywiad — Lider Planowania Produkcji',
    templateName: 'Ocena gotowości operacyjnej',
    completedAt: daysAgoIso(14),
    respondentRole: 'Lider Planowania',
    department: 'Łańcuch dostaw',
  },
};

const MOCK_SESSION_SUMMARIES: Record<string, any> = {
  [SESSION_IDS[0]]: {
    facts: [
      'Trzy linie montażowe pracują na dwie zmiany, czwarta linia stoi od stycznia 2026.',
      'OEE raportowane ręcznie raz w tygodniu, w arkuszu kalkulacyjnym.',
    ],
    gaps: [
      'Brak jednego wskaźnika dostępności maszyn uzgodnionego między produkcją a utrzymaniem ruchu.',
    ],
    constraints: [
      'Budżet CAPEX na 2026 zamknięty — nowe zakupy dopiero od stycznia 2027.',
      'Umowa związkowa ogranicza zmiany w harmonogramie zmian do 2 razy w roku.',
    ],
    painPoints: [
      'Przezbrojenie linii trwa 95 minut przy założeniu 40 minut w standardzie.',
      'Planista dowiaduje się o awarii dopiero na porannej odprawie, nie w momencie zdarzenia.',
    ],
  },
  [SESSION_IDS[1]]: {
    facts: [
      'System CMMS wdrożony w 2023, używany do zleceń, ale nie do planowania prewencji.',
      '62% zleceń to reakcja na awarię, 38% to prewencja.',
    ],
    gaps: ['Brak historii przyczyn źródłowych — pole „przyczyna" wypełniane w ok. 20% zleceń.'],
    constraints: ['Dwóch automatyków na trzy zmiany — nocna zmiana bez wsparcia technicznego.'],
    painPoints: [
      'Części zamienne do pras zamawiane ad hoc, średni czas oczekiwania 11 dni roboczych.',
    ],
  },
  [SESSION_IDS[2]]: {
    facts: [
      'Harmonogram produkcji zamrażany na 5 dni, realnie zmieniany średnio 3 razy w tygodniu.',
      'Prognoza sprzedaży trafia do planowania w formie pliku, bez integracji z ERP.',
    ],
    gaps: ['Brak wspólnej definicji „zamówienia pilnego" między sprzedażą a produkcją.'],
    constraints: ['ERP w wersji, która nie wspiera planowania skończonych zdolności (APS).'],
    painPoints: [
      'Zamówienia pilne od sprzedaży wchodzą poza kolejką i psują wykonanie planu tygodnia.',
    ],
  },
};

// ── Rdzeń artefaktu ──────────────────────────────────────────────────────
const MOCK_INSIGHT = {
  id: INSIGHT_ID,
  organizationId: ORG_ID,
  title: 'Podsumowanie wykonawcze — gotowość operacyjna MZT Komponenty',
  promptType: 'summary',
  sourceSessionIds: SESSION_IDS,
  status: 'completed',
  reviewStatus: 'in_review',
  sourceSessionCount: SESSION_IDS.length,
  tokensUsed: 18_420,
  generationTimeMs: 41_300,
  /**
   * ★ „PEWNOŚĆ: —" przy jawnym zastrzeżeniu w treści była sprzecznością:
   * karta mówiła „liczby niezweryfikowane", a pole pewności milczało.
   * `panelConfidence` (InsightViewer.tsx:3276) czyta łańcuch
   * findings[0].confidence_level → analysis.topics[0] → insight.confidence,
   * więc podajemy WARTOŚĆ i uzasadniamy ją liczbą źródeł (patrz MOCK_FINDINGS
   * poniżej oraz `confidenceRationale`).
   */
  confidence: 'medium',
  confidenceRationale:
    'Średnia (medium): 3 niezależne sesje wywiadowcze, 13 odpowiedzi w mapie dowodów, ' +
    '2 wzorce potwierdzone we wszystkich trzech perspektywach. Obniżone z wysokiej, bo ' +
    '2 kluczowe liczby (95 minut przezbrojenia, 20% wypełnionych przyczyn) pochodzą ' +
    'z pamięci rozmówców, a nie z systemów źródłowych, i brakuje czwartej perspektywy ' +
    '(sprzedaż), która generuje sporny strumień zamówień pilnych.',
  createdBy: 'user-piotr-demo',
  createdAt: daysAgoIso(12),
  updatedAt: daysAgoIso(2),
  executiveSummary:
    'Zakład ma sprawną załogę i działające narzędzia, ale traci zdolność produkcyjną na styku ' +
    'trzech funkcji: planowania, produkcji i utrzymania ruchu. Trzy wywiady niezależnie wskazały ' +
    'ten sam mechanizm — decyzje operacyjne podejmowane są na danych z wczoraj, a każda z funkcji ' +
    'mierzy się innym wskaźnikiem. Skutkiem jest przezbrojenie trwające 2,4x dłużej od standardu ' +
    'i 62% zleceń serwisowych realizowanych reaktywnie. Największa dostępna dźwignia nie wymaga ' +
    'CAPEX: uwspólnienie definicji wskaźników i przeniesienie sygnału o awarii z porannej odprawy ' +
    'do momentu zdarzenia. Szacowany odzysk to 6-9 punktów OEE w horyzoncie dwóch kwartałów, ' +
    'przy czym liczba wymaga potwierdzenia w logach CMMS przed wpisaniem jej do biznes case.',
  /**
   * ★ ROZDZIELENIE „ODCZYTU" OD „NARRACJI" (naprawa duplikatu 1:1).
   *
   * `InsightViewer` w podglądzie tnie `insight.content` na sekcje przez
   * `buildFilteredMarkdown` (InsightViewer.tsx:2632-2661): dopasowuje NAGŁÓWKI
   * markdown do etykiet sekcji („Odczyt konsultingowy", „Narracja konsultingowa",
   * „Podsumowanie", „Memo zarządcze"). Gdy żaden nagłówek nie pasuje, funkcja
   * zwraca null, a OBIE sekcje spadają na ten sam fallback = całe `content` —
   * i dlatego „Odczyt konsultingowy" był znak w znak równy „Narracji
   * konsultingowej" (złamane MECE).
   *
   * Treść ma teraz nagłówki nazwane dokładnie jak sekcje, więc każda sekcja
   * dostaje SWÓJ, inny fragment:
   *   Podsumowanie            → wniosek + liczba + dźwignia (dla zarządu)
   *   Odczyt konsultingowy    → co mówią rozmówcy vs co z tego wynika
   *   Narracja konsultingowa  → pełny wywód z mechanizmem i falsyfikacją
   *   Memo zarządcze          → decyzja do podjęcia i o co prosimy
   * Pierwszy akapit (bez nagłówka) jest wiodącym zdaniem karty.
   */
  content:
    'Zakład nie jest ograniczony maszynowo — jest ograniczony obiegiem informacji między ' +
    'planowaniem, produkcją i utrzymaniem ruchu. Rozbudowa czwartej linii bez naprawy tego ' +
    'obiegu powieli istniejące straty na większej skali.\n\n' +
    '## Podsumowanie\n\n' +
    'Wniosek: pieniądze leżą w organizacji, nie w maszynach. Trzy niezależne wywiady wskazały ' +
    'ten sam mechanizm — decyzje operacyjne zapadają na danych z wczoraj, bo sygnał o awarii ' +
    'dociera do planisty dopiero na porannej odprawie (deklarowane opóźnienie ok. 16 godzin).\n\n' +
    'Skutek widoczny w liczbach: przezbrojenie 95 minut przy standardzie 40 (2,4×) oraz 62% ' +
    'zleceń serwisowych realizowanych reaktywnie.\n\n' +
    'Największa dostępna dźwignia nie wymaga nakładów inwestycyjnych: uwspólnienie definicji ' +
    'dostępności maszyn i przesunięcie powiadomienia o awarii z odprawy na moment zdarzenia ' +
    '(konfiguracja w istniejącym CMMS). Szacowany odzysk 6-9 punktów OEE w dwa kwartały — ' +
    'to OSZACOWANIE MODELOWE z benchmarku, nie pomiar u tego klienta; do biznes case wchodzi ' +
    'dopiero po pomiarze bazowym.\n\n' +
    '## Odczyt konsultingowy\n\n' +
    'Co mówią rozmówcy (deklaracje) — i co z tego wynika (interpretacja):\n\n' +
    '• Dyrektor Produkcji: „Dostępność maszyn to nie jest mój wskaźnik". Utrzymanie Ruchu: ' +
    '„Rozliczam się z liczby zamkniętych zleceń". Planowanie: z terminowości dostaw.\n' +
    '  → Żaden z trzech wskaźników nie premiuje dostępności linii. Nikt nie odpowiada za nią ' +
    'wprost, więc nikt jej nie broni. To nie jest spór o dobre chęci, to luka w rozliczeniu.\n\n' +
    '• Wszyscy trzej opisali ten sam moment: informacja o zdarzeniu dociera rano.\n' +
    '  → Planista przeplanowuje po fakcie. Zmiana nocna jest stracona, zanim ktokolwiek ' +
    'zdąży zareagować.\n\n' +
    '• Planowanie: „Pilne psują cały tydzień". Produkcja: „Pilne to zwykła praca".\n' +
    '  → Ta rozbieżność jest sama w sobie ustaleniem, nie szumem. Bez wspólnej definicji ' +
    'zamówienia pilnego spór jest nierozstrzygalny, więc wraca co tydzień.\n\n' +
    'Czego NIE mówi ten odczyt: nie wiemy, ile realnie kosztuje godzina przestoju — żaden ' +
    'z rozmówców nie podał tej liczby, a bez niej nie da się uszeregować działań po zwrocie.\n\n' +
    '## Narracja konsultingowa\n\n' +
    'Mechanizm, który tłumaczy wszystkie trzy wywiady naraz, wygląda tak: sygnał o zdarzeniu ' +
    'powstaje na hali, ale trafia do CMMS, a nie do planowania. Planista dowiaduje się na ' +
    'odprawie, więc jego reakcją jest bufor — dłuższe serie i zamrożony plan. Zamrożony plan ' +
    'nie wytrzymuje zamówień pilnych od sprzedaży, więc plan zmienia się i tak, trzy razy ' +
    'w tygodniu. Skoro plan i tak się zmienia, przygotowanie przezbrojenia z wyprzedzeniem ' +
    'traci sens — i przezbrojenie trwa 95 minut zamiast 40. Utrzymanie ruchu, obciążone ' +
    'skutkami przestojów, gasi pożary (62% prac reaktywnych) i nie ma czasu na prewencję, ' +
    'co domyka pętlę: awarii jest więcej.\n\n' +
    'Konsekwencja dla decyzji o czwartej linii: przy tym obiegu informacji każda dodatkowa ' +
    'linia zwiększa liczbę zdarzeń, o których planowanie dowiaduje się z opóźnieniem. ' +
    'Rozbudowa nie rozwiązuje wąskiego gardła, tylko je skaluje.\n\n' +
    'Co obaliłoby tę narrację: gdyby po włączeniu powiadomień z CMMS w czasie rzeczywistym ' +
    'liczba zmian planu w tygodniu nie spadła w ciągu dwóch miesięcy, znaczy to, że źródłem ' +
    'rozjazdu jest sprzedaż, a nie obieg informacji — wtedy priorytetem staje się umowa ' +
    'z handlowcami o definicji zamówienia pilnego, nie integracja systemów.\n\n' +
    /*
     * Ta sekcja domyka trzecią kolumnę „Odczytu konsultingowego" (Sygnały
     * i szanse). `opportunityReadout` (InsightViewer.tsx:1903-1912) zbiera
     * akapity i punkty z bloków, których NAGŁÓWEK pasuje do wzorca — tytuł
     * poniżej jest naturalnie polski i jednocześnie trafia w ten wzorzec,
     * więc kolumna przestaje być pusta bez sztucznych zabiegów.
     */
    '## Trendy i przestrzenie szans\n\n' +
    'Wspólna definicja dostępności maszyn dla trzech funkcji: jeden wskaźnik raportowany ' +
    'codziennie zamiast trzech rozłącznych miar. Bez nakładów inwestycyjnych — potrzebne są ' +
    'dwa tygodnie pracy warsztatowej i decyzja o właścicielu wskaźnika.\n\n' +
    'Powiadomienie o awarii w momencie zdarzenia zamiast na porannej odprawie: skraca czas ' +
    'reakcji planowania z ok. 16 godzin do minut. Konfiguracja w istniejącym systemie CMMS.\n\n' +
    'SMED na linii o największej liczbie przezbrojeń jako dowód wykonalności: cel 95 → 60 minut ' +
    'w 8 tygodni, przed rozszerzeniem na pozostałe linie.\n\n' +
    'Minimum magazynowe dla 20 pozycji krytycznych: skraca przestój awaryjny o czas oczekiwania ' +
    'na dostawę, dziś 11 dni roboczych.\n\n' +
    'Oddolny sygnał, na którym można oprzeć wdrożenie: mistrzowie prowadzą już własne arkusze ' +
    'dostępności maszyn poza systemem. Potrzeba jest realna, brakuje wspólnego narzędzia.\n\n' +
    '## Memo zarządcze\n\n' +
    'Do decyzji zarządu na najbliższym posiedzeniu: wstrzymać decyzję o czwartej linii ' +
    'na jeden kwartał i uruchomić w tym czasie dwa działania bez nakładów inwestycyjnych — ' +
    'wspólną definicję dostępności maszyn oraz powiadomienie o awarii w momencie zdarzenia.\n\n' +
    'O co prosimy: (1) decyzję o właścicielu wskaźnika dostępności — jedna osoba, nie komitet; ' +
    '(2) zgodę na pomiar bazowy OEE i czasu przezbrojenia z rejestratora linii przez 90 dni; ' +
    '(3) czwarty wywiad ze sprzedażą przed domknięciem raportu.\n\n' +
    'Czego NIE rekomendujemy dziś: wpisywania odzysku 6-9 punktów OEE do budżetu 2027. ' +
    'Ta liczba pochodzi z benchmarku branżowego, nie z pomiaru w tym zakładzie.',
  themes: [
    {
      title: 'Decyzje operacyjne oparte na danych z wczoraj',
      description:
        'We wszystkich trzech wywiadach powtarza się ten sam wzorzec: informacja o zdarzeniu ' +
        'na hali dociera do osoby, która może zareagować, dopiero na porannej odprawie następnego ' +
        'dnia. Planista przeplanowuje tydzień po fakcie, nie w trakcie.',
      evidence_refs: ['ans-prod-04', 'ans-utr-02', 'ans-plan-03'],
      strength: 'strong',
      confidence: 'high',
      crossSessionPattern: true,
      perspective_labels: ['Produkcja', 'Utrzymanie ruchu', 'Planowanie'],
      limits: ['Nie zmierzono realnego opóźnienia sygnału — opis pochodzi z deklaracji.'],
    },
    {
      title: 'Każda funkcja mierzy się innym wskaźnikiem',
      description:
        'Produkcja rozlicza się z wykonania planu tygodnia, utrzymanie ruchu z liczby zamkniętych ' +
        'zleceń, planowanie z terminowości dostaw. Żaden z tych wskaźników nie premiuje dostępności ' +
        'maszyny — więc nikt nie odpowiada za nią wprost.',
      evidence_refs: ['ans-prod-02', 'ans-utr-05'],
      strength: 'strong',
      confidence: 'high',
      crossSessionPattern: true,
      perspective_labels: ['Produkcja', 'Utrzymanie ruchu'],
    },
    {
      title: 'Narzędzia są, ale używane poniżej możliwości',
      description:
        'CMMS wdrożony w 2023 obsługuje zlecenia, lecz nie planowanie prewencji. Pole „przyczyna ' +
        'źródłowa" wypełniane w ok. 20% zleceń, co uniemożliwia analizę powtarzalnych awarii.',
      evidence_refs: ['ans-utr-01', 'ans-utr-03'],
      strength: 'moderate',
      confidence: 'medium',
      limits: ['Udział 20% podany z pamięci przez kierownika — do sprawdzenia w bazie CMMS.'],
    },
    {
      title: 'Rozbieżność w ocenie pilności zamówień',
      description:
        'Planowanie opisuje zamówienia pilne jako główne źródło rozjazdu planu. Produkcja traktuje ' +
        'je jako normalny element pracy. Brak wspólnej definicji sprawia, że spór jest nierozstrzygalny.',
      evidence_refs: ['ans-plan-01', 'ans-prod-06'],
      strength: 'moderate',
      confidence: 'medium',
      perspective_labels: ['Planowanie', 'Produkcja'],
      divergence_note:
        'Planowanie: „pilne psują tydzień". Produkcja: „pilne to zwykła praca". Ta sama sytuacja, ' +
        'dwie oceny — rozbieżność jest sama w sobie ustaleniem.',
    },
  ],
  issues: [
    {
      title: 'Przezbrojenie trwa 2,4x dłużej niż zakłada standard',
      description:
        'Standard zakładowy przewiduje 40 minut, praktyka to około 95 minut. Przy trzech ' +
        'przezbrojeniach dziennie na linię daje to ok. 2,7 godziny utraconej zdolności na dobę.',
      severity: 'high',
      evidence_refs: ['ans-prod-01'],
      confidence: 'medium',
      limits: ['Liczba 95 minut z deklaracji dyrektora; brak pomiaru z rejestratora linii.'],
    },
    {
      title: '62% zleceń serwisowych to reakcja na awarię',
      description:
        'Przewaga prac reaktywnych oznacza, że utrzymanie ruchu pracuje w trybie gaszenia pożarów ' +
        'i nie ma zdolności do prewencji, co domyka pętlę — awarii jest więcej.',
      severity: 'high',
      evidence_refs: ['ans-utr-01'],
      confidence: 'high',
    },
    {
      title: 'Nocna zmiana bez wsparcia automatyka',
      description:
        'Dwóch automatyków obsługuje trzy zmiany. Awaria na nocnej zmianie czeka do rana, ' +
        'co wydłuża przestój o pełną zmianę.',
      severity: 'high',
      evidence_refs: ['ans-utr-04'],
      confidence: 'high',
    },
    {
      title: 'Średni czas oczekiwania na części zamienne: 11 dni roboczych',
      description:
        'Części do pras zamawiane ad hoc, bez zdefiniowanego minimum magazynowego dla pozycji ' +
        'krytycznych. Postój maszyny przedłuża się o czas dostawy.',
      severity: 'medium',
      evidence_refs: ['ans-utr-06'],
      confidence: 'medium',
    },
    {
      title: 'Harmonogram zamrażany na 5 dni, zmieniany 3 razy w tygodniu',
      description:
        'Formalne zamrożenie planu nie jest respektowane, co unieważnia planowanie materiałowe ' +
        'i przygotowanie przezbrojeń z wyprzedzeniem.',
      severity: 'medium',
      evidence_refs: ['ans-plan-02'],
      confidence: 'high',
    },
  ],
  opportunities: [
    {
      title: 'Wspólna definicja dostępności maszyn dla trzech funkcji',
      description:
        'Jeden wskaźnik dostępności, uzgodniony i raportowany codziennie, zamiast trzech ' +
        'rozłącznych miar. Nie wymaga CAPEX ani zmian systemowych — wymaga decyzji zarządu ' +
        'i dwóch tygodni pracy warsztatowej.',
      impact: 'high',
      evidence_refs: ['ans-prod-02', 'ans-utr-05'],
      confidence: 'high',
    },
    {
      title: 'Sygnał o awarii w momencie zdarzenia, nie na porannej odprawie',
      description:
        'Powiadomienie z CMMS do planisty i mistrza zmiany w chwili zgłoszenia. Skraca czas ' +
        'reakcji planowania z ok. 16 godzin do minut. Konfiguracja w istniejącym systemie.',
      impact: 'high',
      evidence_refs: ['ans-prod-04', 'ans-plan-03'],
      confidence: 'high',
    },
    {
      title: 'SMED na linii o najwyższej liczbie przezbrojeń',
      description:
        'Pilotaż redukcji czasu przezbrojenia na jednej linii jako dowód wykonalności przed ' +
        'rozszerzeniem. Cel pilotażu: 95 → 60 minut w 8 tygodni.',
      impact: 'high',
      evidence_refs: ['ans-prod-01'],
      confidence: 'medium',
      limits: ['Cel 60 minut wymaga potwierdzenia pomiarem bazowym przed startem pilotażu.'],
    },
    {
      title: 'Minimum magazynowe dla 20 pozycji krytycznych',
      description:
        'Wyznaczenie zapasu bezpieczeństwa dla części o najdłuższym czasie dostawy skraca ' +
        'przestój awaryjny o czas oczekiwania na dostawę.',
      impact: 'medium',
      evidence_refs: ['ans-utr-06'],
      confidence: 'medium',
    },
  ],
  signals: [
    {
      title: 'Zarząd chce rozbudowy, kadra mówi o stracie na istniejących liniach',
      description:
        'Decyzja o czwartej linii jest w toku, podczas gdy trzy działające linie tracą zdolność ' +
        'na przezbrojeniach i awariach. Rozbudowa powieli straty na większej skali.',
      type: 'tension',
    },
    {
      title: 'Brak danych o przyczynach źródłowych awarii',
      description:
        'Pole „przyczyna" wypełniane w ok. 20% zleceń — nie da się wskazać maszyn generujących ' +
        'najwięcej przestoju ani uzasadnić priorytetu prewencji.',
      type: 'gap',
    },
    {
      title: 'Sprzeczna ocena wpływu zamówień pilnych',
      description:
        'Planowanie i produkcja opisują te same zdarzenia jako, odpowiednio, główną przyczynę ' +
        'rozjazdu planu i normalny element pracy.',
      type: 'contradiction',
    },
    {
      title: 'Oddolne arkusze jako obejście braku raportowania',
      description:
        'Mistrzowie prowadzą własne arkusze dostępności maszyn poza systemem — sygnał realnej ' +
        'potrzeby, na której można oprzeć wdrożenie wspólnego wskaźnika.',
      type: 'emerging_pattern',
    },
  ],
  evidenceMap: [
    {
      answer_id: 'ans-prod-01',
      question_text: 'Ile realnie trwa przezbrojenie linii montażowej?',
      answer_snippet:
        'W standardzie mamy czterdzieści minut. Realnie schodzi półtorej godziny, czasem więcej, ' +
        'bo brakuje przygotowanego oprzyrządowania.',
      linked_themes: ['Decyzje operacyjne oparte na danych z wczoraj'],
      linked_issues: ['Przezbrojenie trwa 2,4x dłużej niż zakłada standard'],
    },
    {
      answer_id: 'ans-prod-02',
      question_text: 'Z czego rozlicza się Pana dział?',
      answer_snippet:
        'Z wykonania planu tygodnia. Dostępność maszyn to nie jest mój wskaźnik, to utrzymanie ruchu.',
      linked_themes: ['Każda funkcja mierzy się innym wskaźnikiem'],
      linked_issues: [],
    },
    {
      answer_id: 'ans-prod-04',
      question_text: 'Kiedy dowiaduje się Pan o awarii na hali?',
      answer_snippet:
        'Zwykle na porannej odprawie. Jak jest naprawdę źle, ktoś zadzwoni, ale to nie jest reguła.',
      linked_themes: ['Decyzje operacyjne oparte na danych z wczoraj'],
      linked_issues: [],
    },
    {
      answer_id: 'ans-prod-06',
      question_text: 'Jak wpływają na Państwa zamówienia pilne?',
      answer_snippet: 'To normalna praca. Zawsze coś wchodzi poza kolejką, przywykliśmy.',
      linked_themes: ['Rozbieżność w ocenie pilności zamówień'],
      linked_issues: [],
    },
    {
      answer_id: 'ans-utr-01',
      question_text: 'Jaki jest podział prac prewencyjnych do reaktywnych?',
      answer_snippet:
        'Mniej więcej sześćdziesiąt do czterdziestu na korzyść reakcji. Gasimy pożary, na prewencję ' +
        'zostaje niewiele czasu.',
      linked_themes: ['Narzędzia są, ale używane poniżej możliwości'],
      linked_issues: ['62% zleceń serwisowych to reakcja na awarię'],
    },
    {
      answer_id: 'ans-utr-02',
      question_text: 'Jak przepływa informacja o zdarzeniu do planowania?',
      answer_snippet:
        'Wpisujemy zlecenie w CMMS, ale planista tego nie widzi. Dowiaduje się rano od mistrza.',
      linked_themes: ['Decyzje operacyjne oparte na danych z wczoraj'],
      linked_issues: [],
    },
    {
      answer_id: 'ans-utr-03',
      question_text: 'Czy rejestrujecie przyczyny źródłowe awarii?',
      answer_snippet:
        'Pole jest, ale wypełniane rzadko. Może co piąte zlecenie ma opisaną przyczynę.',
      linked_themes: ['Narzędzia są, ale używane poniżej możliwości'],
      linked_issues: [],
    },
    {
      answer_id: 'ans-utr-04',
      question_text: 'Jak wygląda obsada techniczna na zmianach?',
      answer_snippet:
        'Dwóch automatyków na trzy zmiany. Noc jest bez wsparcia — awaria czeka do rana.',
      linked_themes: [],
      linked_issues: ['Nocna zmiana bez wsparcia automatyka'],
    },
    {
      answer_id: 'ans-utr-05',
      question_text: 'Z jakiego wskaźnika rozlicza się Pana dział?',
      answer_snippet: 'Z liczby zamkniętych zleceń. Im szybciej zamknę, tym lepiej wyglądam.',
      linked_themes: ['Każda funkcja mierzy się innym wskaźnikiem'],
      linked_issues: [],
    },
    {
      answer_id: 'ans-utr-06',
      question_text: 'Jak zarządzacie częściami zamiennymi?',
      answer_snippet:
        'Zamawiamy, kiedy się zepsuje. Na prasy czekamy średnio dwa tygodnie robocze.',
      linked_themes: [],
      linked_issues: ['Średni czas oczekiwania na części zamienne: 11 dni roboczych'],
    },
    {
      answer_id: 'ans-plan-01',
      question_text: 'Co najbardziej zaburza wykonanie planu?',
      answer_snippet:
        'Zamówienia pilne od sprzedaży. Wchodzą poza kolejką i cały tydzień trzeba układać od nowa.',
      linked_themes: ['Rozbieżność w ocenie pilności zamówień'],
      linked_issues: [],
    },
    {
      answer_id: 'ans-plan-02',
      question_text: 'Jak długo plan pozostaje zamrożony?',
      answer_snippet: 'Formalnie pięć dni. W praktyce zmieniam go dwa, trzy razy w tygodniu.',
      linked_themes: [],
      linked_issues: ['Harmonogram zamrażany na 5 dni, zmieniany 3 razy w tygodniu'],
    },
    {
      answer_id: 'ans-plan-03',
      question_text: 'Kiedy dostaje Pan informację o przestoju maszyny?',
      answer_snippet:
        'Rano, na odprawie. Wtedy już przeplanowuję po fakcie, bo zmiana nocna przepadła.',
      linked_themes: ['Decyzje operacyjne oparte na danych z wczoraj'],
      linked_issues: [],
    },
  ],
  missingData: [
    'Rzeczywisty czas przezbrojenia z rejestratora linii (deklaracja: 95 minut).',
    'Udział zleceń z wypełnioną przyczyną źródłową z bazy CMMS (deklaracja: ok. 20%).',
    'Koszt godziny przestoju linii montażowej — nie podany w żadnym z wywiadów.',
    'Stanowisko sprzedaży: żadna z trzech sesji nie objęła autora zamówień pilnych.',
  ],
};

/**
 * ★ UZGODNIENIE LICZNIKÓW (naprawa sprzeczności „Dowody: 0" obok „Mapa dowodów: 13").
 *
 * Karta pokazywała jednocześnie: Mapa dowodów 13 · Źródła 3 · Problemy i ryzyka 5,
 * a obok „Dowody: 0" i „Findingi: 0". Powód: liczniki „Dowody"/„Findingi" nie
 * czytają `evidenceMap`/`issues`, tylko dwa OSOBNE zasoby, których harness
 * wcześniej nie podawał:
 *   • „Dowody"   ← `sourcePack.activePointerCount`  (V8InterviewApi.getSourcePack)
 *   • „Findingi" ← `findings.length`                (V8InterviewApi.listFindings)
 * Oba są tu wyprowadzone Z TYCH SAMYCH danych co reszta karty, żeby liczby nie
 * mogły się rozjechać: pakiet źródeł powstaje z `evidenceMap` (13 pozycji),
 * a ustalenia odpowiadają 1:1 pięciu pozycjom z `issues`.
 */
const wskaznikDowodu = (answerId: string, i: number) => ({
  pointerId: `ptr-${answerId}`,
  type: 'interview_answer',
  sourceRef: answerId,
  capturedAt: daysAgoIso(12),
  sourceFingerprint: `fp-${answerId}`,
  capturedExcerpt: MOCK_INSIGHT.evidenceMap[i]?.answer_snippet?.slice(0, 160) ?? null,
  removalReason: null,
  isTombstone: false,
});

/** Do której sesji należy dana odpowiedź — po prefiksie identyfikatora. */
const sesjaOdpowiedzi = (answerId: string): string => {
  if (answerId.startsWith('ans-prod')) return SESSION_IDS[0];
  if (answerId.startsWith('ans-utr')) return SESSION_IDS[1];
  return SESSION_IDS[2];
};

const MOCK_SOURCE_PACK = {
  insightId: INSIGHT_ID,
  sourceSessionIds: SESSION_IDS,
  entries: MOCK_INSIGHT.evidenceMap.map((e, i) => ({
    answerId: e.answer_id,
    questionText: e.question_text,
    answerSnippet: e.answer_snippet,
    respondentLabel: MOCK_SESSIONS[sesjaOdpowiedzi(e.answer_id)].respondentRole,
    respondentRole: MOCK_SESSIONS[sesjaOdpowiedzi(e.answer_id)].respondentRole,
    department: MOCK_SESSIONS[sesjaOdpowiedzi(e.answer_id)].department,
    sourceSessionId: sesjaOdpowiedzi(e.answer_id),
    linkedThemes: e.linked_themes,
    linkedIssues: e.linked_issues,
    linkedOpportunities: [],
    capturedPointers: [wskaznikDowodu(e.answer_id, i)],
  })),
  degraded: false,
  degradedReasons: [] as string[],
  // 13 = tyle samo, co „Mapa dowodów"; liczba wyprowadzona, nie wpisana ręcznie.
  activePointerCount: MOCK_INSIGHT.evidenceMap.length,
};

/**
 * Ustalenia (findings) — po jednym na każdą pozycję z „Problemy i ryzyka",
 * żeby licznik „Findingi" = 5 zgadzał się z licznikiem sekcji. Poziom pewności
 * per ustalenie odpowiada polu `confidence` w `issues`; pierwszy element
 * (medium) zasila też „Pewność" w prawym panelu.
 */
const MOCK_FINDINGS = MOCK_INSIGHT.issues.map((issue, i) => ({
  id: `finding-${i + 1}`,
  insightId: INSIGHT_ID,
  organizationId: ORG_ID,
  finding_statement: issue.title,
  confidence_level: (issue.confidence === 'high' ? 'high' : 'medium') as 'high' | 'medium',
  limits:
    issue.limits?.[0] ??
    'Ustalenie oparte na deklaracjach z wywiadu; do potwierdzenia w systemie źródłowym.',
  next_action:
    i === 0
      ? 'Odczyt czasów przezbrojenia z rejestratora linii za ostatnie 90 dni.'
      : 'Potwierdzić wartość w systemie źródłowym przed wpisaniem do biznes case.',
  evidence_pointers: (issue.evidence_refs || []).map((ref) =>
    wskaznikDowodu(
      ref,
      MOCK_INSIGHT.evidenceMap.findIndex((e) => e.answer_id === ref)
    )
  ),
  source_section_type: 'issue',
  source_section_index: i,
  source_key: `issue-${i}`,
  review_status: 'in_review' as const,
  readback_status: 'draft_interpretation' as const,
  readback_summary: null,
  readback_updated_at: null,
  created_at: daysAgoIso(12),
  updated_at: daysAgoIso(2),
}));

// ── Historia (prawy panel → Historia) ────────────────────────────────────
const MOCK_ACTIVITY = [
  {
    id: 'act-1',
    type: 'created',
    description: 'Wygenerowano podsumowanie wykonawcze z 3 sesji wywiadowczych',
    timestamp: daysAgoIso(12),
    userName: 'Teresa (AI)',
  },
  {
    id: 'act-2',
    type: 'edited',
    description: 'Skorygowano sformułowanie wniosku głównego',
    timestamp: daysAgoIso(9),
    userName: 'Anna Kowalska',
    oldValue: 'Zakład nie jest gotowy na rozbudowę',
    newValue: 'Problem nie leży w zdolności maszynowej, lecz w obiegu informacji',
  },
  {
    id: 'act-3',
    type: 'commented',
    description: 'Dodano komentarz do sekcji Problemy',
    timestamp: daysAgoIso(6),
    userName: 'Marek Zieliński',
  },
  {
    id: 'act-4',
    type: 'status_changed',
    description: 'Zmieniono status na „W recenzji"',
    timestamp: daysAgoIso(2),
    userName: 'Piotr Wiśniewski',
    oldValue: 'draft',
    newValue: 'in_review',
  },
];

// ── Komentarze (prawy panel → Komentarze) ────────────────────────────────
const MOCK_COMMENTS = [
  {
    id: 'cmt-1',
    authorName: 'Marek Zieliński',
    content:
      'Liczba 95 minut pochodzi z jednej rozmowy. Zanim wejdzie do prezentacji dla zarządu, ' +
      'potrzebujemy odczytu z rejestratora linii — inaczej klient obali ją na pierwszym slajdzie.',
    createdAt: daysAgoIso(6),
    priority: 'high',
  },
  {
    id: 'cmt-2',
    authorName: 'Anna Kowalska',
    content:
      'Rozbieżność planowanie/produkcja przy zamówieniach pilnych warto zostawić jako osobne ' +
      'ustalenie, a nie uśredniać. To najmocniejszy materiał na warsztat z zarządem.',
    createdAt: daysAgoIso(4),
    priority: 'medium',
  },
  {
    id: 'cmt-3',
    authorName: 'Teresa (AI)',
    content:
      'Żadna z trzech sesji nie objęła sprzedaży, a to ona generuje zamówienia pilne wskazywane ' +
      'jako główna przyczyna rozjazdu planu. Sugeruję czwartą sesję przed domknięciem raportu.',
    createdAt: daysAgoIso(3),
    isAIGenerated: true,
    priority: 'high',
  },
];

// ── Patch singletona V8InterviewApi ──────────────────────────────────────
V8InterviewApi.getInsight = (async () => ({
  insight: MOCK_INSIGHT,
})) as unknown as typeof V8InterviewApi.getInsight;

V8InterviewApi.getSession = (async (id: string) => ({
  session: MOCK_SESSIONS[id] ?? null,
})) as unknown as typeof V8InterviewApi.getSession;

V8InterviewApi.getSessionSummary = (async (id: string) =>
  MOCK_SESSION_SUMMARIES[id] ?? {
    facts: [],
    gaps: [],
    constraints: [],
    painPoints: [],
  }) as unknown as typeof V8InterviewApi.getSessionSummary;

V8InterviewApi.getInsightActivity = (async () => ({
  activity: MOCK_ACTIVITY,
})) as unknown as typeof V8InterviewApi.getInsightActivity;

V8InterviewApi.getInsightComments = (async () => ({
  comments: MOCK_COMMENTS,
})) as unknown as typeof V8InterviewApi.getInsightComments;

// Liczniki „Dowody" i „Findingi" — patrz komentarz przy MOCK_SOURCE_PACK.
V8InterviewApi.getSourcePack = (async () => ({
  sourcePack: MOCK_SOURCE_PACK,
  insightId: INSIGHT_ID,
})) as unknown as typeof V8InterviewApi.getSourcePack;

V8InterviewApi.listFindings = (async () => ({
  findings: MOCK_FINDINGS,
  insightId: INSIGHT_ID,
})) as unknown as typeof V8InterviewApi.listFindings;

const MOCK_EVIDENCE_ENVELOPE = {
  envelope: {
    id: 'evidence-envelope-mzt-gotowosc',
    organizationId: ORG_ID,
    artifactType: 'insight',
    artifactId: INSIGHT_ID,
    sources: [
      {
        type: 'interview',
        ref: SESSION_IDS[0],
        snippet: '"W standardzie mamy czterdzieści minut. Realnie schodzi półtorej godziny."',
      },
      {
        type: 'interview',
        ref: SESSION_IDS[1],
        snippet: '"Sześćdziesiąt do czterdziestu na korzyść reakcji. Gasimy pożary."',
      },
      {
        type: 'document',
        ref: 'MZT_Standard_Przezbrojen_rev4.pdf',
        snippet: 'Standard zakładowy: czas przezbrojenia linii montażowej — 40 minut.',
      },
    ],
    assumptions: [
      {
        key: 'czas_przezbrojenia_min',
        value: 95,
        source_type: 'imported',
        rationale: 'Deklaracja Dyrektora Produkcji podczas sesji z 2 lipca 2026.',
        confidence: 0.62,
      },
      {
        key: 'udzial_zlecen_reaktywnych',
        value: '62%',
        source_type: 'imported',
        rationale: 'Deklaracja Kierownika Utrzymania Ruchu, zgodna z obserwacją na hali.',
        confidence: 0.8,
      },
      {
        key: 'odzysk_oee_pp',
        value: '6-9 p.p.',
        source_type: 'ai_assumed',
        rationale:
          'Oszacowanie na podstawie benchmarku SMED dla montażu komponentów; NIE do biznes case ' +
          'przed pomiarem bazowym.',
        confidence: 0.45,
      },
    ],
    confidence: 0.64,
    confidenceLabel: 'medium',
    toVerify: [
      {
        claim: 'Przezbrojenie trwa średnio 95 minut.',
        why: 'Jedno źródło, z pamięci. Kluczowa liczba całego biznes case.',
        suggested_check: 'Odczyt z rejestratora linii za ostatnie 90 dni.',
      },
      {
        claim: 'Odzysk 6-9 punktów OEE w dwa kwartały.',
        why: 'Oszacowanie modelowe, nie pomiar u tego klienta.',
        suggested_check: 'Pomiar bazowy OEE na linii pilotażowej przed startem.',
      },
    ],
    computedBy: { service: 'insightEvidenceAggregator', version: 'v1', at: daysAgoIso(12) },
    createdBy: 'user-piotr-demo',
    createdAt: daysAgoIso(12),
    updatedAt: daysAgoIso(2),
  },
};

// ── Siatka bezpieczeństwa dla fetch ──────────────────────────────────────
// `dev-render/main.tsx` importuje WSZYSTKIE ekrany statycznie, więc
// top-level side-effecty każdego ekranu (część z nich też patchuje
// `window.fetch`) wykonują się przy każdym ładowaniu strony. Instalacja
// odroczona o jeden tick (`setTimeout`) sprawia, że NASZ patch jest
// najbardziej zewnętrzny — nasze specyficzne dopasowania widzą żądanie,
// zanim szerszy catch-all innego ekranu je połknie. Mechanizm żyje
// wyłącznie w tym pliku (wzorzec z insight-artifact.tsx).
const g = window as unknown as { __KARTA_INSIGHT_FETCH__?: boolean };
// ★ Router instalujemy TYLKO gdy TEN ekran jest wybrany w adresie.
// main.tsx importuje WSZYSTKIE ekrany naraz, wiec bez tego warunku siedem
// routerow podmienia window.fetch jeden po drugim; ostatni jest najbardziej
// zewnetrzny i odpowiada WLASNYM fallbackiem zamiast oddac sterowanie dalej.
// Skutek przed poprawka: karta-initiative dostawala koperte obcego ekranu.
const __tenEkran = new URLSearchParams(window.location.search).get('screen') === 'karta-insight';
if (__tenEkran && !g.__KARTA_INSIGHT_FETCH__) {
  g.__KARTA_INSIGHT_FETCH__ = true;
  setTimeout(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      // i18n musi trafić do realnego backendu tłumaczeń.
      if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
      // Sekcja „Źródła i założenia" w prawym panelu (EvidencePanelSection).
      if (url.includes('/evidence/insight/')) {
        return new Response(JSON.stringify(MOCK_EVIDENCE_ENVELOPE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // OrgContext oczekuje `{ organizations: [...] }`; generyczny fallback
      // poniżej wywołuje u niego TypeError w `orgs.find(...)`.
      if (url.includes('/organizations/current')) {
        return new Response(JSON.stringify({ organizations: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/') || url.includes('/interview/') || url.includes('/my-work/')) {
        return new Response(JSON.stringify({ data: [], items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return realFetch(input as RequestInfo, init);
    };
  }, 0);
}

// ── Bramka gotowości i18n ────────────────────────────────────────────────
// ArtifactRightPanel formatuje daty przez
// `d.toLocaleDateString(t('interview.insightViewer.enUs'), {...})` — oczekuje,
// że `t()` zwróci realny tag BCP-47. W samodzielnym harnessie pierwszy paint
// potrafi wyprzedzić asynchroniczny fetch `/locales/**`; `t()` zwraca wtedy
// surowy klucz, `toLocaleDateString` rzuca i wywraca ErrorBoundary aplikacji.
// Montujemy dopiero po załadowaniu bundla tłumaczeń (sprawa harnessu —
// InsightViewer.tsx nietknięty).
function useI18nReady(): boolean {
  const [ready, setReady] = React.useState(() =>
    i18n.hasResourceBundle(i18n.language, 'translation')
  );
  React.useEffect(() => {
    if (ready) return;
    const check = () => {
      if (i18n.hasResourceBundle(i18n.language, 'translation')) setReady(true);
    };
    i18n.on('loaded', check);
    i18n.on('languageChanged', check);
    check();
    return () => {
      i18n.off('loaded', check);
      i18n.off('languageChanged', check);
    };
  }, [ready]);
  return ready;
}

export function KartaInsightScreen(): React.ReactElement {
  const i18nReady = useI18nReady();
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
          {i18nReady ? (
            <InsightViewer
              key={`karta-insight-${INSIGHT_ID}`}
              insightId={INSIGHT_ID}
              onClose={() => {}}
              onRegenerate={async () => {}}
              onSaved={() => {}}
            />
          ) : null}
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default KartaInsightScreen;
