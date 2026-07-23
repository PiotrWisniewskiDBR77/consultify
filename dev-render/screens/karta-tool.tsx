/**
 * dev-render host dla PRAWDZIWEJ karty narzędzia — `<KnownToolDetailView>`
 * (src/components/DiscoveryTools/KnownToolDetailView.tsx), archetyp A·Canvas
 * w powłoce SPEC-A `NModeShell` (Menu 1 + lewy rail sekcji + centrum N/C).
 *
 * Cel (CLAUDE.md #7): nadzorca robi ZRZUT realnego ekranu z danymi makietowymi
 * — bez backendu i bez logowania Piotra — zanim Piotr zobaczy cokolwiek.
 * Komponent produkcyjny mountowany 1:1, zero re-implementacji wyglądu.
 *
 * ── CO KOMPONENT NAPRAWDĘ POTRZEBUJE (rozpoznanie) ─────────────────────────
 * Propsy (wszystkie WYMAGANE, brak wartości domyślnych):
 *   { toolType: string; onClose: () => void;
 *     onSessionCreated: (sessionId, toolType, name) => void }
 *
 * Sam fetchuje: JEDNO wywołanie `Api.getKnownTool(toolType, { lang })` w
 * useEffect keyed na [toolType, lang]. Błąd → `toast.error` + `tool = null`
 * (ekran zostaje pusty), więc mock jest konieczny. `Api` to zwykły obiekt
 * (`export const Api = {...}`), więc podmiana metody łata ten sam singleton,
 * który widzą wszystkie moduły — wzorzec z decision-record.tsx /
 * melscanvas-workspace.tsx.
 *
 * WAŻNE ustalenie o kształcie danych: obiekt `tool` z API zasila w tym
 * komponencie TYLKO cztery rzeczy (potwierdzone grepem `tool?.`):
 *   • `tool.name`          → tytuł w Menu 1 (NModeHeader)
 *   • `tool.toolType`      → wybór gałęzi sekcji + artifactId w nagłówku
 *   • `tool.libraryCategory` → pole „Kategoria" w pasku właściwości
 *   • `tool.isActive`      → odblokowanie akcji „Startuj sesję"
 * CAŁA treść merytoryczna sekcji (Cel/Proces/Rezultat/Przykład) jest
 * zaszyta w komponencie i pochodzi z i18n (`t('discoveryToolsMain.
 * knownToolDetail.dynamicSwot.…', { returnObjects: true })`), NIE z API.
 * Dlatego nie ma sensu (i nie wolno) „dosypywać" treści przez mock — pola
 * whenToUse/inputs/steps/outputs/commonMistakes/example/nextSteps podajemy
 * dla zgodności z kontraktem typu, ale ekran ich nie czyta.
 *
 * Wybrany `toolType` = 'dynamic-swot' — jedyna gałąź z pełnym kompletem
 * grafik bibliotecznych (`DynamicSwotLibraryGraphic` w wariantach
 * `process` + `example`), więc zrzut pokazuje najbogatszy realny stan karty,
 * a nie pusty szkielet.
 *
 * Konteksty owinięte tutaj: `AppProviders` (BrowserRouter + QueryClient +
 * FeatureFlags + AutoSave + Tour + **HelpProvider** — wymagany przez
 * `useHelpSidePanel`, bez niego komponent rzuca — oraz gałąź
 * AuthenticatedProviders/V8/Org/AccessPolicy/Trial/AI/TeresaVoice, która
 * włącza się dopiero gdy `currentUser` jest zaseedowany) + jawny
 * `FeatureFlagsProvider`. `useAppStore` (currentProjectId, theme) i i18n
 * zaspokaja `seedRealisticSession()`. `usePresentationMode` czyta wyłącznie
 * URL + localStorage — nie wymaga niczego.
 *
 * URL: ?screen=karta-tool[&lang=pl|en][&theme=light|dark][&view=n|c]
 */
import React from 'react';

import { KnownToolDetailView } from '../../src/components/DiscoveryTools/KnownToolDetailView';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import i18n from '../../src/i18n';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const TOOL_TYPE = 'dynamic-swot';

// ── Karta narzędzia z biblioteki (Api.getKnownTool) ────────────────────────
// Realny wpis biblioteczny, tak jak wygląda w praktyce doradczej DBR77:
// narzędzie licencjonowane, aktywne, w kategorii diagnostyki strategicznej.
const MOCK_KNOWN_TOOL = {
  id: 'known-tool-dynamic-swot',
  toolType: TOOL_TYPE,
  name: 'Dynamiczny SWOT',
  libraryCategory: 'Diagnoza strategiczna',
  description:
    'Warsztatowa diagnoza pozycji firmy, w której mocne i słabe strony konfrontuje się ' +
    'z realnym ruchem rynku, a nie z listą życzeń zarządu. Zamiast statycznej macierzy ' +
    'powstaje zestaw napięć strategicznych z przypisanym właścicielem i horyzontem decyzji.',
  whatYouGet: [
    'Macierz SWOT osadzona w sygnałach rynkowych z ostatnich 12 miesięcy',
    'Lista 4–6 napięć strategicznych (mocna strona kontra zagrożenie)',
    'Ruchy pierwszego kroku wraz z właścicielem i horyzontem czasowym',
    'Notatka dla zarządu gotowa do wklejenia w materiał na radę nadzorczą',
  ],
  tags: ['strategia', 'diagnoza', 'warsztat', 'zarząd'],
  icon: 'target',
  isLicensed: true,
  isActive: true,
  isComingSoon: false,
  sortOrder: 10,
  createdAt: '2026-02-11T09:00:00Z',

  // ── Pola kontraktu API, których TA karta nie renderuje (treść sekcji
  // pochodzi z i18n — patrz nagłówek pliku). Wypełnione realistycznie, żeby
  // mock nie kłamał o kształcie odpowiedzi backendu.
  whenToUse:
    'Gdy zarząd ma sprzeczne diagnozy sytuacji firmy, gdy poprzedni SWOT powstał ' +
    'ponad rok temu i zdezaktualizował się, albo przed decyzją o alokacji budżetu ' +
    'inwestycyjnego na kolejny rok.',
  inputs: [
    'Wyniki finansowe i marżowość za ostatnie 8 kwartałów',
    'Wywiady z 5–8 osobami z kadry kierowniczej',
    'Dane o udziałach rynkowych i ruchach konkurencji',
    'Rejestr utraconych i wygranych postępowań ofertowych',
  ],
  /**
   * ★ SPRZECZNOŚĆ LICZBY KROKÓW — częściowo poza mockiem.
   *
   * Ekran pokazuje trzy źródła tej samej informacji i dwa z nich są w kodzie:
   *   (a) „5 KROKÓW PRACY" + pięć ponumerowanych kafli
   *       ← i18n `discoveryToolsMain.dynamicSwotLibraryGraphic.stagesTitleProcess`
   *         oraz stage1..stage5 (DynamicSwotLibraryGraphic.tsx:76-118)
   *   (b) legenda „Dynamic SWOT = brief -> evidence -> matrix -> tension ->
   *       move -> output" — SZEŚĆ etapów
   *       ← i18n `discoveryToolsMain.dynamicSwotLibraryGraphic.legend`
   *   (c) wiersz „Kroki procesu: 5" w tabeli Właściwości
   *       ← DŁUGOŚĆ TEJ TABLICY (KnownToolDetailView.tsx:335-340)
   *
   * Kanonem jest PIĘĆ kroków: piąty łączy ruchy i materiały wyjściowe
   * („Recommended moves" / „Przełóż napięcia na rekomendowane ruchy i materiał
   * do dalszego użycia"). Sprzeczna jest wyłącznie legenda (b), która rozbija
   * krok 5 na dwa i daje sześć. To jedyny element poza tym plikiem —
   * ZGŁOSZONE do poprawki w i18n.
   *
   * Kroki poniżej są teraz nazwane 1:1 jak pięć kafli na ekranie, żeby licznik
   * „Kroki procesu: 5" i treść mówiły dokładnie to samo.
   */
  steps: [
    'Brief: ustawienie pytania decyzyjnego, zakresu, sygnału sukcesu i ograniczeń',
    'Mapa dowodów: zebranie faktów, obserwacji i hipotez z wnętrza firmy oraz z rynku',
    'Budowa macierzy: przypisanie sygnałów do czterech ćwiartek, usunięcie szumu',
    'Napięcia strategiczne: pokazanie, gdzie przewaga zderza się z ograniczeniem lub ryzykiem',
    'Ruchy i materiały wyjściowe: 2-4 rekomendowane ruchy z sekwencją oraz podsumowanie ' +
      'gotowe do raportu, prezentacji lub inicjatywy',
  ],
  outputs: [
    'Macierz SWOT z dowodami przy każdej pozycji',
    'Rejestr napięć strategicznych z oceną pilności',
    'Karta ruchów 90-dniowych',
  ],
  commonMistakes: [
    'Traktowanie SWOT jako ćwiczenia opisowego zamiast podstawy decyzji',
    'Wpisywanie do mocnych stron cech, które ma cała branża',
    'Brak dowodu przy pozycji — „wszyscy wiedzą, że jesteśmy dobrzy w serwisie"',
    'Zamknięcie warsztatu bez właściciela przy żadnym z napięć',
  ],
  example:
    'Producent komponentów przemysłowych, 340 mln zł przychodu: warsztat pokazał, ' +
    'że przewaga serwisowa (mocna strona) była faktycznie kompensacją niskiej ' +
    'niezawodności produktu, a nie samodzielnym atutem. Napięcie skierowało budżet ' +
    'z rozbudowy serwisu na program jakości.',
  nextSteps: [
    'Przekucie napięć na inicjatywy w module Inicjatywy',
    'Warsztat Sił Rynkowych dla napięć o podłożu konkurencyjnym',
    'Karta Priorytetów Portfela przed alokacją budżetu',
  ],
  kbArticleSlug: 'dynamic-swot',
};

Api.getKnownTool = (async () => ({ tool: MOCK_KNOWN_TOOL })) as typeof Api.getKnownTool;

// Akcja „Startuj sesję" (Menu 1) — bez backendu tworzymy sesję lokalnie,
// żeby kliknięcie na zrzucie nie kończyło się czerwonym toastem.
//
// 2026-07-23 (zgłoszenie właściciela, ETAP 2.2 pkt 4: „nie da się przetestować
// Startuj sesję"): mock istniał, ale `onSessionCreated` w harnessie był pustą
// funkcją — po kliknięciu NIC się nie działo poza zielonym toastem, więc
// klikający nie widział, czy akcja zadziałała. Teraz sesja ląduje w widocznym
// pasku potwierdzenia pod kartą (id + typ + nazwa + znacznik czasu), więc
// przycisk da się przeklikać i odebrać oczami, bez backendu.
Api.createToolSession = (async (payload: any) => ({
  id: `tool-session-${TOOL_TYPE}-${Date.now().toString(36)}`,
  name: payload?.name || 'Dynamiczny SWOT — Sesja',
  toolType: TOOL_TYPE,
  status: 'draft',
  progress: 0,
  confidenceAvg: 0,
})) as unknown as typeof Api.createToolSession;

// Historia sesji tego narzędzia — zasila „Liczba użyć" / „Ostatnie użycie"
// w tabeli Właściwości oraz licznik w sekcji Powiązania. Bez tego mocka karta
// pokazywałaby „—" (uczciwie, ale zrzut nie pokazywałby pełnej metryki).
const MOCK_TOOL_SESSIONS = [
  {
    id: 'tool-session-swot-01',
    name: 'Dynamiczny SWOT — zarząd Q1',
    toolType: TOOL_TYPE,
    status: 'completed',
    progress: 100,
    confidenceAvg: 0.82,
    createdAt: '2026-03-04T09:15:00Z',
    updatedAt: '2026-03-06T14:40:00Z',
  },
  {
    id: 'tool-session-swot-02',
    name: 'Dynamiczny SWOT — linia komponentów',
    toolType: TOOL_TYPE,
    status: 'in_progress',
    progress: 55,
    confidenceAvg: 0.61,
    createdAt: '2026-06-18T08:00:00Z',
    updatedAt: '2026-07-11T16:20:00Z',
  },
  {
    id: 'tool-session-swot-03',
    name: 'Dynamiczny SWOT — przegląd budżetu',
    toolType: TOOL_TYPE,
    status: 'draft',
    progress: 12,
    confidenceAvg: 0,
    createdAt: '2026-07-19T11:05:00Z',
    updatedAt: '2026-07-21T10:02:00Z',
  },
];

Api.listToolSessions = (async () => ({
  items: MOCK_TOOL_SESSIONS,
  total: MOCK_TOOL_SESSIONS.length,
  limit: 100,
  offset: 0,
})) as unknown as typeof Api.listToolSessions;

// ── Siatka bezpieczeństwa dla wywołań w tle ────────────────────────────────
// Providery (Org/Trial/AccessPolicy/notyfikacje/presence) strzelają po sieci
// niezależnie od wybranego ekranu. Bez tego dev-server Vite oddaje HTML, a
// `handleResponse` pluje błędami JSON-parse do konsoli i psuje zrzut.
// `/locales/**` MUSI przejść do prawdziwego fetcha — na nim stoi i18n, z
// którego pochodzi cała treść sekcji tej karty.
//
// Instalacja odroczona o jeden tick: ekrany dev-render importują się
// alfabetycznie i patchują `window.fetch` kaskadowo, a szerokie dopasowanie
// `/api/` z innego ekranu potrafi połknąć nasze żądanie. Patch założony jako
// ostatni jest najbardziej zewnętrzny — widzi żądanie pierwszy.
const fetchGuard = window as unknown as { __KARTA_TOOL_FETCH__?: boolean };
// ★ Router instalujemy TYLKO gdy TEN ekran jest wybrany w adresie.
// main.tsx importuje WSZYSTKIE ekrany naraz, wiec bez tego warunku siedem
// routerow podmienia window.fetch jeden po drugim; ostatni jest najbardziej
// zewnetrzny i odpowiada WLASNYM fallbackiem zamiast oddac sterowanie dalej.
// Skutek przed poprawka: karta-initiative dostawala koperte obcego ekranu.
const __tenEkran = new URLSearchParams(window.location.search).get('screen') === 'karta-tool';
if (__tenEkran && !fetchGuard.__KARTA_TOOL_FETCH__) {
  fetchGuard.__KARTA_TOOL_FETCH__ = true;
  setTimeout(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      // OrgContext robi `orgs.find(...)` — na gołym `{ data: [] }` rzuca TypeError.
      if (url.includes('/organizations/current')) return json({ organizations: [] });
      if (url.includes('/known-tools')) return json({ tool: MOCK_KNOWN_TOOL });
      if (url.includes('/api/')) return json({ data: [], items: [] });
      return realFetch(input as RequestInfo, init);
    };
  }, 0);
}

// ── Bramka i18n ────────────────────────────────────────────────────────────
// Cała treść sekcji tej karty to `t(..., { returnObjects: true })`. Zanim
// HttpBackend dociągnie `/locales/**`, `t()` zwraca surowy klucz — wtedy
// `Array.isArray` w komponencie jest false i sekcje renderują placeholder
// „sectionPendingExpansion". Zrzut wyglądałby na pustą kartę, choć ekran jest
// sprawny. Montujemy dopiero po załadowaniu bundla tłumaczeń. To troska
// wyłącznie harnessu — KnownToolDetailView.tsx pozostaje nietknięty.
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

type StartedSession = { id: string; toolType: string; name: string; at: string };

export function KartaToolScreen(): React.ReactElement {
  const i18nReady = useI18nReady();
  // Widoczny dowód, że „Startuj sesję" zadziałało — bez tego harness przyjmował
  // kliknięcie i milczał (zgłoszenie właściciela 2026-07-23).
  const [started, setStarted] = React.useState<StartedSession | null>(null);
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
          className="flex flex-col bg-c-bg"
        >
          <div className="min-h-0 flex-1">
            {i18nReady ? (
              <KnownToolDetailView
                key={`karta-tool-${TOOL_TYPE}`}
                toolType={TOOL_TYPE}
                onClose={() => {}}
                onSessionCreated={(sessionId, toolType, name) =>
                  setStarted({
                    id: sessionId,
                    toolType,
                    name,
                    at: new Date().toLocaleTimeString(),
                  })
                }
              />
            ) : null}
          </div>
          {started && (
            <div className="shrink-0 border-t border-c-border-subtle bg-c-surface-raised px-4 py-2 text-xs text-c-text-secondary">
              <span className="font-semibold text-c-text">Sesja utworzona (harness):</span>{' '}
              <span className="tabular-nums">{started.at}</span> · {started.name} ·{' '}
              <span className="font-mono">{started.toolType}</span> ·{' '}
              <span className="font-mono">{started.id}</span>
              <button
                type="button"
                onClick={() => setStarted(null)}
                className="ml-3 rounded-md px-2 py-0.5 text-c-text-muted hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
              >
                wyczyść
              </button>
            </div>
          )}
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default KartaToolScreen;
