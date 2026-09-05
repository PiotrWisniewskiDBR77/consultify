# P1 — Jeden prawy panel, zwijany (ekrany listowe)

> Paczka programu naprawczego po audycie „award/CES 2027". Przyczyna źródłowa **nr 1** z
> `docs/program/AUDYT_AWARD_20260905/D_SYNTEZA_I_PLAN.md` §2. Układ pliku wg
> `00_SZABLON_PACZKI.md` (9 punktów, literalnie).
> Numer decyzji do zarejestrowania: **DEC-397** (ostatni użyty w repo: DEC-396).

---

## 1. Cel dla użytkownika

Na każdym ekranie listowym po prawej stronie stoi **jeden** panel z zakładkami „Rekord | Teresa",
który da się zamknąć krzyżykiem i przywrócić pigułką — a nie dwie kolumny naraz, przez które tabela
Skrzynki przy 1280 px kurczy się do jednej kolumny.

---

## 2. Zakres

**Jednostka liczenia:** powierzchnia listowa = plik, który montuje `<TableWithPreviewLayout>` albo
sam `<StandardPreview>` (jedna zakładka Menu 2 = jedna powierzchnia). Pomiar na HEAD m03
(`cc02477c4e`), polecenie:

```
rg -l "<TableWithPreviewLayout|<StandardPreview" src/ --glob '!**/__tests__/**' --glob '!**/*.test.*'
```

64 trafienia − `src/components/standard/StandardPreview.tsx` (sam komponent) −
`src/pages/dev/styleguide/ComponentsSection.tsx` (styleguide) − `src/components/MyWork/IdeasTableContent.tsx`
(warsztat Pomysłów, dok już wyłączony bramką ścieżkową) = **61 powierzchni, na których dziś stoi
trzecia kolumna.**

### 2.1 Rodzina A — 36 powierzchni idą przez `TableWithPreviewLayout` (ZERO edycji per plik)

| Moduł | Powierzchnie | Pliki |
| --- | :-: | --- |
| Moja Praca | 16 | `MyWork/{AIAnalysisProposalReviewQueue,AnalysisDecisionQueue,ClosureDecisionQueue,DecisionsPanelContent,DefinitionDecisionQueue,DefinitionRemediationQueue,DeliveryResultsAcceptanceQueue,EffectivenessClosureQueue,GateSignoffQueue,HandoffAcceptanceQueue,MaterialChangeQueue,MyIdeasListContent,MyTasksListContent,PortfolioDecisionQueue,ScheduleDecisionQueue}.tsx`, `views/vault/VaultSafesTable.tsx` |
| Inicjatywy | 4 | `Initiatives/{CanonicalInitiativeRegister,CapacityScenarioSurface,InitiativesHub,PlanScenarioSurface}.tsx` |
| Realizacja | 4 | `Execution/{ExecutionControlSurface,ExecutionReportsSurface,ExecutionResourcesSurface,ExecutionWorkSurface}.tsx` |
| Wywiad | 2 | `Interview/{InterviewHub,QuestionsList}.tsx` |
| Czat AI | 3 | `AIChat/{AgentHubShell,TransformationCasesPanel,signalsFeed/ChatSignalsFeed}.tsx` |
| Materiały | 3 | `ReportsAndPresentations/{OutputsAggregateTabContent,ReportsTabContent}.tsx`, `AIChat/signalsFeed/ChatSignalsFeedPreview.tsx` |
| Wyniki | 1 | `ResultsVNext/ResultsVNextRegistryShell.tsx` (nośnik wszystkich rejestrów KPI/OKR/ROI) |
| Narzędzia | 1 | `Discovery/DiscoveryToolsHub.tsx` |
| Finanse | 1 | `Economics/FinanceHub.tsx` |
| Raporty zarządcze | 1 | `Reports/Management/ReportsHub.tsx` |

### 2.2 Rodzina B — 25 powierzchni montuje `StandardPreview` samodzielnie (wymagają opakowania)

| Moduł | Powierzchnie | Pliki |
| --- | :-: | --- |
| Audyty | 6 | `Audit/method/tabs/Audit{Findings,Initiatives,Library,Outputs,Processes,Reports}Tab.tsx` |
| Ocena | 3 | `assessment/{AssessmentHub,AssessmentOutputsTab,library/AssessmentLibraryTab}.tsx` |
| Materiały | 2 | `ReportsAndPresentations/{PresentationsTabContent,TemplatesTabContent}.tsx` |
| Realizacja | 2 | `Execution/{ExecutionHub,ExecutionManagementTable}.tsx` |
| Moja Praca | 2 | `MyWork/MyProjects.tsx`, `views/vault/VaultDocumentsView.tsx` |
| Spotkania | 1 | `Meeting/MeetingHub.tsx` |
| Sprawy (CaseWorkspace) | 3 | `CaseWorkspace/{CasesListScreen,RealizacjaView,RezultatyView}.tsx` |
| Report Builder | 2 | `ReportBuilder/{BlockTypesManager,TemplatesManager}.tsx` |
| Wyniki | 1 | `ResultsVNext/attention/ResultsAttentionPage.tsx` |
| SuperAdmin / Partner | 3 | `SuperAdmin/ModelRegistry/ModelCatalogTable.tsx`, `views/superadmin/AIPlatformModule/Development/PromptRegistryTab.tsx`, `views/superadmin/revenue/PartnerSettlementsView.tsx` |

**Kotwice w audycie (id ekranów i dowody):**
`A_moja-praca…` MP1 · MP3 (`moja-praca/01-skrzynka-lista.png`, `19-zadania-lista.png`,
`28-flagowy-skrzynka-1280.png`, `29-flagowy-skrzynka-1920.png`), W3 (`12b-flagowy-1280-loaded.png`),
tabela rankingowa poz. 2; `B_ocena…` poz. 9 (`ocena-05-raporty.png` — CTA „Nowy raport" zasłonięty
przez panel przy 1440 px); `C_finanse…` §32 (Sprawozdania), §58 i §61 (`audyty/01-lista.png`),
§146/§160 (Biblioteka audytów), tabela rankingowa poz. 4. Wzorzec poprawny:
`evidence/odbior-zywo-20260905/02-moja-praca/mapa-jeden-panel/02-element.png`.

**Uwagi właściciela z 05.09 (trzy, wszystkie o tym samym panelu — D §4):**
1. Moja Praca — „mam nadzieję, że ten prawy panel można zwinąć, żeby mieć cały ekran do pracy".
2. Tabela pomysłów — „mam wielki problem z prawym panelem, bo nie mogę go zamknąć".
3. Notatnik — „prawy panel ma przejąć możliwie dużo z ekranu głównego, ma być super lekko"
   (kierunek jakościowy, nie defekt).

**Poza zakresem P1:** ekrany artefaktów (mają własny kanon SPEC-A i są już domknięte przez merge
`eed7b9ba68` / `71c147feeb`), pełne okno czatu `/chat` (`mode="full"`), ekrany bez tabeli.

---

## 3. Przyczyna źródłowa

Wszystko poniżej zweryfikowane `rg`/`sed` na HEAD m03 `cc02477c4e` (nie z dokumentacji).

1. **`src/layouts/MainLayout.tsx:488-538`** — globalny dok Teresy renderuje się jako **rodzeństwo
   flexa** obok `#app-main-content`, ze sztywną szerokością `style={{ width: chatPanelWidth }}` i
   `shrink-0`. Domyślna szerokość: `src/store/slices/uiSlice.ts:171` → `chatPanelWidth: 380`
   (+ 4 px uchwyt `resizer`, `MainLayout.tsx:492`). Dok NIE wie nic o tym, czy ekran pod spodem ma
   już swój prawy panel.
2. **`src/layouts/MainLayout.tsx:132-158`** — jedyny wyłącznik doku to bramka **po ścieżce**
   (`hasEmbeddedModuleChatByPath`: `/wordy`, `/excele`, `/prezentacje`, `/tabele`,
   `/presentations/builder/`, `^/my-work/ideas/[^/]+/workspace`) plus lista widoków
   `VIEWS_WITHOUT_CHAT_PANEL` (`:103-120`). Żaden ekran listowy nie jest na żadnej z tych list —
   więc na wszystkich 61 powierzchniach dok stoi obok podglądu.
3. **`src/components/shared/PreviewPane/previewGeometry.ts:28-31`** — podgląd bierze
   `clamp(340px, 28%, 480px)`, a `28%` liczy się od kontenera **już pomniejszonego o dok**. Przy
   1280 px daje to 340 px podglądu z 640 px, które zostały — i 294 px na tabelę (arytmetyka w §4.3).
   To jest liczbowe źródło „tabela ścieśniona do jednej kolumny" (MP3).
4. **Kanon nie przewiduje trzeciej kolumny.** `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`
   §10.1 pkt 5: lista ma **jeden, opcjonalny** prawy panel = podgląd; wejście do Teresy to
   `①`[AI] w Menu 3 (§10.1 pkt 3), czyli **przycisk**, nie kolumna. §19.1: „≥1280 = rail + centrum
   + prawy panel" — trzy strefy, nie cztery. §11.1: „Responsywność: <1024 preview → drawer".
   Naruszenie jest arytmetyczne, nie estetyczne.
5. **Ten sam produkt ma już poprawny wzorzec** (dwa scalenia z 05.09):
   `eed7b9ba68` — warsztat Pomysłów: `src/components/MyWork/panel/IdeaElementInspector.tsx:97-105`
   (`teresaContent`, `activeTab`, `onClosePanel`), `src/components/MyWork/IdeaMapWorkspace.tsx:411-445`
   (jeden stan `panelZamkniety` + własny stan zakładki, most do `isChatCollapsed` **zdarzeniem**,
   nie poziomem), `:4596-4610` (pigułka „Pokaż panel" w chrome, nie nad płótnem),
   `:343-357` (pamięć zamknięcia w `localStorage`, klucz `myWork.ideaWorkspace.rightPanelClosed`);
   `71c147feeb` — Notatnik: `src/components/MyWork/notebook/NotebookRightRail.tsx:224, 1228-1250`
   (te same zakładki „Notatka | Teresa", jeden X) + **rejestr gospodarzy**
   `src/components/shared/embeddedModuleChatHost.ts` (licznik, nie flaga — obsługuje przeplot
   mount/unmount przy zmianie trasy).
6. **Ryzyko powtórki znanego kształtu.** Bramka po ścieżce była już raz o krok od „zamknięcia przez
   wygaszenie": pod `/my-work/notebook` żyją dwa ekrany (lista i otwarta notatka) i wyłączenie doku
   ścieżką wygasiłoby Teresę na liście. Dlatego rejestr gospodarzy istnieje — i dlatego P1 **nie
   dokłada ani jednej nowej bramki ścieżkowej**.

---

## 4. Projekt rozwiązania

### 4.1 Decyzja architektoniczna (jeden wzorzec, gdzie żyje)

> **Na ekranie listowym prawa krawędź ma dokładnie JEDEN korzeń DOM.** Jest nim panel
> `TableWithPreviewLayout` — ten sam komponent w każdym stanie, o tej samej szerokości i jednej
> pamięci zamknięcia. Teresa jest jego **zakładką**, nigdy sąsiadem. Globalny dok
> `MainLayout` na tych ekranach nie powstaje wcale.

Trzy stany jednego panelu:

| Stan ekranu | Nagłówek panelu | Ciało | Szerokość |
| --- | --- | --- | :-: |
| wiersz zaznaczony | zakładki **„Rekord \| Teresa"** (aktywna: Rekord) + jeden `X` | `StandardPreview` albo `UnifiedChatPanel` | jedna, wspólna |
| brak zaznaczenia, Teresa otwarta z Menu 3 | jedna zakładka **„Teresa"** + `X` | `UnifiedChatPanel` | ta sama |
| zamknięty przez `X` | — | — (tabela pełnej szerokości) | 0 |

**Dlaczego zakładki, a nie „osobny panel Teresy, gdy nic nie zaznaczone":**
- dwa komponenty = dwie szerokości, dwie pamięci i **skok layoutu** przy pierwszym kliknięciu
  w wiersz; jeden komponent w trzech stanach nie ma jak skoczyć;
- kanon (§10.1 pkt 5) zna na liście **jeden** prawy panel — dwa różne komponenty w tym samym
  miejscu to ta sama klasa błędu co dziś, tylko przesunięta w czasie;
- SPEC-A §10.2 (sprostowanie 2026-08-30) rozstrzyga to samo pytanie po stronie artefaktów:
  „Teresa NIGDY nie jest treścią sekcji Historia… wejście do Teresy = przycisk w sekcji Akcje" —
  czyli Teresa jest **trybem jednego panelu**, nie równoległą powierzchnią. Zakładka na liście
  jest dokładnym odpowiednikiem tej reguły;
- produkt ma już dwa odebrane wdrożenia tego kształtu (Pomysły, Notatnik) — trzeci wariant
  zmniejszyłby spójność, o którą cały audyt się rozbija.

**Zamknięcie jest świadome i lepkie.** Klik w wiersz przy zamkniętym panelu **nie przywraca go** —
to jest literalnie uwaga właściciela o tabeli pomysłów („nie mogę go zamknąć": panel wracał przy
każdym kliknięciu). Powrót: pigułka **„Pokaż panel"** w Menu 3 albo pigułka **„Teresa"** (`①`[AI],
kanon §10.1 pkt 3, skraj prawy Menu 3).

**„Prawy panel ma przejąć możliwie dużo z ekranu głównego" (uwaga 3).** Realizacja w P1: pigułki
podglądu-zależne (Otwórz / Teresa / Pokaż panel) mieszkają w Menu 3, akcje rekordu w stopce panelu
(sufit `PREVIEW_FOOTER_MAX_HEIGHT` już istnieje), a ekran główny zostaje tabelą i niczym więcej.
P1 **nie przenosi** treści merytorycznej z centrum do panelu — to osobna robota per moduł w fali (II).

### 4.2 Co się zmienia w komponentach wspólnych

| Plik | Zmiana | Zamrożony? |
| --- | --- | :-: |
| `src/components/shared/TableWithPreviewLayout.tsx` | nowe, addytywne propsy: `teresa?: { kontekst?: WorkspaceContext; wylacz?: boolean }`, `zakladka?`, `onZakladkaChange?`. Domyślnie panel sam buduje zawartość Teresy (lazy `UnifiedChatPanel mode="split"`) i **sam melduje się w rejestrze gospodarzy** na czas montowania. Nagłówek dostaje rząd zakładek wg §4.1. Brak `teresa` ⇒ render 1:1 jak dziś. | nie |
| `src/components/shared/PreviewPane/useJedenPanel.ts` (NOWY) | jedno miejsce na: `zamkniety` (pamięć per moduł), `zakladka` (własny stan, wejście na ekran = „Rekord"), most do `isChatCollapsed` **po zdarzeniu przejścia**, nie po poziomie (kopia lekcji z `IdeaMapWorkspace.tsx:413-431`) | nowy |
| `src/components/shared/PreviewPane/JedenPrawyPanel.tsx` (NOWY) | opakowanie dla rodziny B: przyjmuje gotowy `<StandardPreview>` jako `rekord` i daje tę samą kolumnę, zakładki, `X` i rejestrację gospodarza | nowy |
| `src/components/standard/StandardModuleBar.tsx` | dwie pigułki na prawym skraju Menu 3: `①`[AI] „Teresa" (kanon §10.1 pkt 3 — dziś w ogóle nie istnieje, `rg Sparkles` = 0 trafień) i „Pokaż panel" (widoczna tylko gdy panel zamknięty) | nie |
| `src/components/shared/embeddedModuleChatHost.ts` | bez zmian API; zyskuje drugiego wołacza (layout list). Do dokumentacji dopisać, że to **jedyny** dopuszczony wyłącznik doku | nie |
| `src/layouts/MainLayout.tsx` | `hasEmbeddedModuleChatByPath` przestaje być potrzebne dla list (żadna nowa ścieżka nie dochodzi). Dok pozostaje globalny dla ekranów bez własnego panelu | **tak — 07_MY_WORK_AGENT** |

**Pamięć zamknięcia (per moduł, bez propsa w 61 plikach):** klucz
`consultify.listPanel.<modul>.closed`, gdzie `<modul>` to pierwszy segment ścieżki
(`useLocation().pathname.split('/')[1]`) — `my-work`, `interview`, `assessment`, `initiatives`,
`execution`, `results`, `finance`, `audits`, `meetings`, `vault`, `materials`. Zapis w `try/catch`
(tryb prywatny = brak pamięci, nie awaria), wzorzec 1:1 z `IdeaMapWorkspace.tsx:344-357`.
Zamknięcie w Mojej Pracy nie zamyka panelu w Ocenie — to jest sens klucza per moduł.

### 4.3 Budżet szerokości (1280 / 1440 / 1920)

Składniki (zmierzone w kodzie): sidebar `md:pl-64` = **256 px** rozwinięty / `md:pl-16` = 64 px
zwinięty (`MainLayout.tsx:345`); dok **380 + 4** uchwyt; podgląd `clamp(340px, 28%, 480px)` + 6 px
odstępu (`previewGeometry.ts`).

**Dziś** (sidebar rozwinięty, dok otwarty, wiersz zaznaczony):

| Viewport | Treść | − dok | Podgląd | **Tabela** |
| :-: | :-: | :-: | :-: | :-: |
| 1280 | 1024 | 640 | 340 | **294 px** ← jedna kolumna (MP3) |
| 1440 | 1184 | 800 | 340 | **454 px** |
| 1920 | 1664 | 1280 | 358 | **916 px** ← ostatnia kolumna nadal ucięta |

**Po P1** (bez doku; poniżej 1440 panel jest **nakładką**, czyli nie odbiera szerokości):

| Viewport | Treść | Panel | **Tabela** | Zysk |
| :-: | :-: | :-: | :-: | :-: |
| 1280 | 1024 | 340 (nakładka) | **1024 px** | +730 |
| 1440 | 1184 | 340 (kolumna) | **838 px** | +384 |
| 1920 | 1664 | 466 (kolumna) | **1192 px** | +276 |

**Próg nakładki = 1440 px, nie 1280.** §19.1 stawia drawer w paśmie 1024–1280, ale liczy rail 64 px;
w Consultify rail rozwinięty ma 256 px, więc próg z tabeli §19.1 przeliczony o realny rail wypada
powyżej 1280. Mechanizm już istnieje: `TableWithPreviewLayout` ma prop `desktopPreviewOverlay`
(„preview floats… table keeps full width, zero reflow") — P1 włącza go automatycznie poniżej 1440 px
zamiast wynajdywać drugi. Poniżej 1024 px zostaje dotychczasowy drawer mobilny (bez zmian).

### 4.4 Jak znika globalny dok (rejestr gospodarzy, nie bramki ścieżkowe)

- Layout list woła `registerEmbeddedModuleChatHost()` w `useEffect` **na czas montowania panelu**
  (nie na czas trasy). `MainLayout` czyta `useEmbeddedModuleChatHost()` — kod już istnieje i jest
  w produkcji od `71c147feeb`.
- Do rejestru trafia gospodarz, który **naprawdę renderuje** `UnifiedChatPanel` u siebie. Ekran,
  który nie renderuje, doku nie gasi — to jest bezpiecznik przed kształtem „zamknięte przez
  wygaszenie" (funkcja znika dla wszystkich, a bramka świeci na zielono).
- Test kontraktowy (§6) sprawdza **parę**: przy zamontowanym gospodarzu doku NIE MA, a na liście
  bez gospodarza (np. ekran bez tabeli) dok JEST. Sam brak doku nie jest dowodem.
- Pięć istniejących bramek ścieżkowych (`/wordy`, `/excele`, `/prezentacje`, `/tabele`, warsztat
  Pomysłów) P1 **zostawia nietknięte**. Ich migracja do rejestru to krok 11 — poza MVP, bo kosztuje
  dwa dodatkowe odmrożenia (`KimiWorkspaceShell.tsx` → 13_CHAT, `IdeaMapWorkspace.tsx` →
  07_MY_WORK_AGENT), a zysku dla właściciela nie daje żadnego.

### 4.5 Zakazy (kanon)

- Ekrany listowe **wyłącznie** `StandardModuleBar` / `StandardTable` / `StandardPreview` —
  żadnej własnej tabeli, żadnego bespoke panelu (`scripts/check-list-canon.sh` przed każdym pushem).
- Panel artefaktu = `ArtifactRightPanel` z kanoniczną kolejnością sekcji; P1 go **nie dotyka**.
- Tokeny wyłącznie `c-*`. **Zero `primary-*`** — każdy numer to crimson. Uwaga: dzisiejszy kod doku
  łamie to w dwóch miejscach (`MainLayout.tsx:446` `bg-primary-500/15 text-primary-600`,
  `:492` `hover:bg-primary-500/50 active:bg-primary-500`); nowe pigułki i zakładki mają być
  neutralne, fokus `ring-2 ring-[color:var(--c-focus)]`.
- Kebab pionowy, trzy strefy, separatory — bez zmian.
- i18n **pl + en** dla każdego nowego napisu; zero `bare-missing key`; klucz z polską wartością
  to za mało — wartość `en` musi być angielska, a `pl` polska (znany kształt „klucz istnieje ≠
  przetłumaczony").
- Zero animacji layoutu przy przełączaniu zakładki (`prefers-reduced-motion` respektowane; §19.4).

### 4.6 Nowe klucze i18n

| Klucz | pl | en |
| --- | --- | --- |
| `list.rightPanel.tabRecord` | Rekord | Record |
| `list.rightPanel.tabTeresa` | Teresa | Teresa |
| `list.rightPanel.close` | Zamknij panel | Close panel |
| `list.rightPanel.show` | Pokaż panel | Show panel |
| `list.rightPanel.openTeresa` | Teresa | Teresa |
| `list.rightPanel.teresaEmpty` | Zaznacz wiersz albo zapytaj o cokolwiek z tej listy. | Select a row or ask about anything on this list. |

---

## 5. Kroki wykonania

Kolejność wymuszona: 1 → 2 → 3 → 4 → (5 ‖ 6) → 7 → 8 → 9 → 10. Krok 11 poza MVP.

| # | Krok | Pliki | Nakład | Zamrożenie |
| :-: | --- | --- | :-: | --- |
| 1 | **Hook `useJedenPanel`** — stan `zamkniety` (pamięć per moduł), `zakladka`, most do `isChatCollapsed` po przejściu. Sam hook, bez konsumentów. | `src/components/shared/PreviewPane/useJedenPanel.ts` (nowy) + test | S | — |
| 2 | **Jeden panel w `TableWithPreviewLayout`** — propsy `teresa`/`zakladka`, rząd zakładek w nagłówku, jeden `X`, lazy `UnifiedChatPanel mode="split"`, `registerEmbeddedModuleChatHost()` na czas montowania. Domyślnie **WŁĄCZONE** dla wszystkich konsumentów (rodzina A, 36 powierzchni — zero edycji per plik). | `TableWithPreviewLayout.tsx` | **L** | — |
| 3 | **Pigułki w Menu 3** — `①`[AI] „Teresa" + „Pokaż panel" na prawym skraju `StandardModuleBar`, sterowane tym samym hookiem. | `src/components/standard/StandardModuleBar.tsx` | S | — |
| 4 | **Nakładka poniżej 1440 px** — automatyczne `desktopPreviewOverlay` w zależności od szerokości kontenera (`ResizeObserver`, nie `window.matchMedia` — panel liczy się od kontenera, tak jak `28%`). | `TableWithPreviewLayout.tsx` | S | — |
| 5 | **Rodzina B — 25 powierzchni przez `JedenPrawyPanel`** (jedna linia opakowania per plik). Kolejność wg wagi w audycie: Audyty (6) → Ocena (3) → Realizacja (2) → Materiały (2) → Moja Praca (2) → Spotkania (1) → reszta (9). | `JedenPrawyPanel.tsx` (nowy) + 25 plików z §2.2 | **M** | **6 modułów — patrz §5.1** |
| 6 | **i18n pl + en** — 6 kluczy z §4.6 w obu plikach; sprawdzenie, że `en` nie niesie polskiej wartości i odwrotnie. | `public/locales/{pl,en}/translation.json` | S | — |
| 7 | **Testy jednostkowe + kontraktowe** z dowodem mutacyjnym (§6.1). | `src/components/shared/PreviewPane/__tests__/*`, `src/layouts/__tests__/*` | M | `MainLayout` tylko czytany przez test — bez edycji |
| 8 | **Parametry `--szerokosc` i `--motyw` w kanonicznym `zrzut.mjs`** (dziś `viewport` przybity do 1440 i `colorScheme: 'light'`, `scripts/dev/odbior-zywo/zrzut.mjs:47`). Opt-in, domyślne zachowanie bajt w bajt jak dotąd. **Nie pisać własnego skryptu obok kanonicznego.** | `scripts/dev/odbior-zywo/zrzut.mjs` | S | — |
| 9 | **Przepływ klikany Playwright** (§6.3). | `tests/e2e/ui/jeden-panel-listy.spec.ts` (nowy, `git add -f`) | M | — |
| 10 | **Zrzuty odbiorowe** 1280/1440/1920 × jasny/ciemny, z licznikiem paneli `--dom` (§6.2). | `evidence/p1-jeden-panel/` | S | — |
| 11 | *(poza MVP)* migracja 5 bramek ścieżkowych do rejestru gospodarzy + usunięcie `hasEmbeddedModuleChatByPath`. | `MainLayout.tsx`, `KimiWorkspaceShell.tsx`, `IdeaMapWorkspace.tsx` | M | 07_MY_WORK_AGENT + 13_CHAT |

### 5.1 Moduły ZAMROŻONE dotknięte przez P1 (marker `[ODMROZENIE <MODUL> DEC-397]`)

Rejestr: `docs/program/MVP_FINAL_ZAMROZONE.json`; bramka: `scripts/mvp-final/check-freeze.sh`
wpięta w `.husky/commit-msg` (**w `pre-commit` tylko ostrzega** — blokada jest w `commit-msg`).

| Krok | Moduł | Pliki | Marker w komunikacie commita |
| :-: | --- | --- | --- |
| 5 | `12_AUDITS` | 6 zakładek `Audit/method/tabs/*` | `[ODMROZENIE 12_AUDITS DEC-397]` |
| 5 | `04_ASSESSMENT` | `AssessmentHub`, `AssessmentOutputsTab`, `AssessmentLibraryTab` | `[ODMROZENIE 04_ASSESSMENT DEC-397]` |
| 5 | `11_MATERIALS` | `PresentationsTabContent`, `TemplatesTabContent` | `[ODMROZENIE 11_MATERIALS DEC-397]` |
| 5 | `06_EXECUTION` | `ExecutionHub`, `ExecutionManagementTable` | `[ODMROZENIE 06_EXECUTION DEC-397]` |
| 5 | `08_MEETINGS` | `MeetingHub` | `[ODMROZENIE 08_MEETINGS DEC-397]` |
| 5 | `07_MY_WORK_AGENT` | `MyWork/MyProjects.tsx`, `views/vault/VaultDocumentsView.tsx` | `[ODMROZENIE 07_MY_WORK_AGENT DEC-397]` |
| 2* | `07_MY_WORK_AGENT` | `src/layouts/MainLayout.tsx` — **tylko jeśli** krok 2 wymaga tam zmiany | ten sam marker |

\* Projekt z §4.4 celowo **nie wymaga** edycji `MainLayout.tsx`: dok gaśnie przez istniejący
`useEmbeddedModuleChatHost()`. Jeżeli w trakcie okaże się, że wymaga — jest to zmiana w module
zamrożonym i musi nieść marker.

**Modułów zamrożonych oszczędzonych przez wybór wzorca: cztery.** Rodzina A (36 powierzchni,
33 pliki zamrożone w `13_CHAT`, `03_TOOLS`, `05_INITIATIVES`, `02_INTERVIEW` i częściowo
`07_MY_WORK_AGENT`/`11_MATERIALS`/`06_EXECUTION`) **nie jest edytowana wcale** — zmiana żyje
w niezamrożonym `TableWithPreviewLayout.tsx`. Gdyby wzorzec wymagał propsa per ekran, odmrożeń
byłoby 10 zamiast 6. To jest główny argument za trzymaniem całej mechaniki w komponencie wspólnym.

---

## 6. Testy

### 6.1 Jednostkowe / kontraktowe (co asertują + dowód mutacyjny)

| # | Test | Asercja | Mutacja, która MUSI go zabić |
| :-: | --- | --- | --- |
| T1 | `jedenPanel.liczbaKorzeni.test.tsx` | render listy z `teresa` i zaznaczonym wierszem daje **dokładnie jeden** element `[data-right-panel]` | dopisanie drugiego panelu obok (przywrócenie dzisiejszego stanu) → test czerwony |
| T2 | `jedenPanel.zakladki.test.tsx` | są dwie zakładki `role="tab"`, `aria-selected` startuje na „Rekord", klik przełącza ciało na czat | usunięcie `activeTab` i twarde `'teresa'` → czerwony |
| T3 | `jedenPanel.zamkniecie.test.tsx` | `X` usuwa panel z DOM; **klik w wiersz po zamknięciu NIE przywraca panelu**; „Pokaż panel" przywraca | przywrócenie „selekcja otwiera panel" (dzisiejsze zachowanie tabeli pomysłów) → czerwony |
| T4 | `jedenPanel.pamiec.test.tsx` | zamknięcie zapisuje `consultify.listPanel.my-work.closed=1`; remount czyta; klucz **innego** modułu nie jest ruszany | zapis pod jednym globalnym kluczem → czerwony na drugiej asercji |
| T5 | `mainLayoutDokLista.contract.test.ts` | **para**: (a) gospodarz zamontowany ⇒ `shouldMountChatPanel === false`; (b) ekran **bez** gospodarza ⇒ dok JEST | wygaszenie doku bezwarunkowo („naprawa" przez usunięcie) → czerwony na (b) |
| T6 | `jedenPanel.nakladka.test.tsx` | kontener < 1440 px ⇒ panel ma `position: absolute/fixed` i tabela zachowuje pełną szerokość; ≥ 1440 ⇒ rodzeństwo flexa | przybicie `desktopPreviewOverlay={false}` → czerwony |
| T7 | `jedenPanel.tokeny.test.tsx` | markup panelu i pigułek nie zawiera `primary-` ani `navy-`/`slate-` | wstawienie `bg-primary-500/15` (jak dziś w doku) → czerwony |
| T8 | `jedenPanel.i18n.test.ts` | 6 kluczy z §4.6 istnieje w `pl` **i** `en`, a wartości różnią się tam, gdzie mają się różnić (`close`/`show`) | skopiowanie polskiej wartości do `en` → czerwony |

Uruchamianie: `RUN_DB_TESTS` nie dotyczy (front). Bazą pomiaru jest gałąź, która **kompiluje się**
(`esbuild` per plik przed werdyktem) — „Transform failed" to błąd komendy, nie zielony wynik.

### 6.2 Wizualne (zrzuty)

Narzędzie: `scripts/dev/odbior-zywo/zrzut.mjs` po kroku 8 (parametry `--szerokosc`, `--motyw`).
Katalog: `evidence/p1-jeden-panel/`.

| Zrzut | Ekran | Szerokość | Motyw | Co ma pokazać |
| --- | --- | :-: | :-: | --- |
| `01-skrzynka-1280-jasny.png` | `/my-work` (Skrzynka, wiersz zaznaczony) | **1280** | jasny | **ZRZUT ODBIOROWY**: wszystkie kolumny tabeli + panel jako nakładka |
| `02-skrzynka-1280-zamkniety.png` | `/my-work` po kliknięciu `X` | 1280 | jasny | tabela pełnej szerokości, pigułka „Pokaż panel" w Menu 3 |
| `03-skrzynka-1280-teresa.png` | `/my-work`, zakładka Teresa | 1280 | jasny | ta sama kolumna, ciało = rozmowa |
| `04-skrzynka-1440-jasny.png` / `05-…-1920-jasny.png` | `/my-work` | 1440 / 1920 | jasny | panel jako kolumna, brak trzeciej kolumny |
| `06-skrzynka-1280-ciemny.png` | `/my-work` | 1280 | **ciemny** | zamyka największą dziurę audytu (0 ekranów w ciemnym) |
| `07-wywiad-1280.png` | `/interview` (W3) | 1280 | jasny | prawe kolumny tabeli widoczne |
| `08-ocena-raporty-1440.png` | `/assessment` › Raporty (B poz. 9) | 1440 | jasny | CTA „Nowy raport" nieprzysłonięty |
| `09-audyty-1440.png` | `/audits` › Biblioteka | 1440 | jasny | kolumny bez ucięcia przez panel |
| `10-finanse-1440.png` | `/finance` › Sprawozdania | 1440 | jasny | kolumny STATUS/Waluta widoczne |

**Kontrola mechaniczna, nie oko** (przyrząd kłamie, oko przywyka): każdy zrzut z
`--dom="[data-right-panel]"` — sidecar `.png.json` ma pokazać **`liczba: 1`** (albo `0` dla zrzutu
zamkniętego). Para jasny/ciemny sprawdzana na różnicę `mean_luma` (duplikat pod dwiema nazwami to
znany kształt). Zrzuty robi wykonawca, **nie właściciel** — właściciel dostaje gotowe do akceptu.

### 6.3 Przepływ klikany (Playwright) — `tests/e2e/ui/jeden-panel-listy.spec.ts`

Sesja z `ODBIOR_AUTH_STATE`, `viewport 1280×800`, `locale pl-PL`, motyw jasny.

1. `goto('/my-work')`; poczekaj na `[data-testid="standard-table"]`.
2. **Asercja startowa:** `locator('[data-right-panel]')` → `count() === 0`;
   `locator('#app-main-content ~ div[style*="width"]')` (dok) → `count() === 0`.
3. Zmierz `boundingBox()` tabeli → zapamiętaj `szerokoscA`.
4. Klik w pierwszy wiersz. Asercja: `[data-right-panel]` → `count() === 1`; widoczne dwie
   `role="tab"`; `Rekord` ma `aria-selected="true"`.
5. Zmierz tabelę → `szerokoscB`. **Asercja: `szerokoscB === szerokoscA`** (nakładka nie odbiera
   szerokości przy 1280).
6. Klik zakładki „Teresa". Asercja: pole `textarea`/composer czatu widoczne; nadal
   `[data-right-panel]` → `count() === 1` (dok się NIE dołożył).
7. Klik `X`. Asercja: `[data-right-panel]` → `count() === 0`; pigułka „Pokaż panel" widoczna.
8. **Klik w drugi wiersz.** Asercja: `[data-right-panel]` → `count() === 0` (zamknięcie jest lepkie
   — to jest test uwagi właściciela nr 2).
9. Klik „Pokaż panel". Asercja: `count() === 1`, aktywna zakładka „Rekord", tytuł panelu = tytuł
   drugiego wiersza.
10. `reload()`. Asercja: panel otwarty (pamięć `closed=0`).
11. Klik `X`, `reload()`. Asercja: panel zamknięty (pamięć `closed=1`).
12. `goto('/assessment')`. Asercja: panel **otwarty** — klucz per moduł, zamknięcie Mojej Pracy
    nie przenosi się na Ocenę.
13. `goto('/interview')`, klik wiersza, `Escape`. Asercja: panel zamknięty, **focus wrócił na
    wiersz źródłowy** (kanon UI-PREVIEW-01, krytyczny test rodziny).
14. `goto('/my-work/ideas/<id>/workspace/mindmap')`. Asercja: `count() === 1` — warsztat nie
    zregresował (dwa scalenia z 05.09 nadal działają).
15. `goto('/chat')`. Asercja: pełne okno czatu bez panelu listowego — brak wygaszenia „w drugą
    stronę".
16. Przez cały przepływ: zero błędów konsoli poziomu `error` na tej ścieżce.

---

## 7. Kryterium odbioru właściciela

Na `localhost:3000` (staging pod spodem), na ekranie 1280 px: **otwierasz Moją Pracę → Skrzynkę,
widzisz wszystkie kolumny tabeli, po prawej jeden panel z zakładkami „Rekord | Teresa", zamykasz go
krzyżykiem i masz cały ekran do pracy; wraca pigułką „Pokaż panel", a po powrocie na ten sam ekran
pamięta, że go zamknąłeś.**

---

## 8. Ryzyka i cofanie

| Ryzyko | Objaw | Zapobieganie | Cofanie |
| --- | --- | --- | --- |
| **Wygaszenie Teresy** — gospodarz melduje się na ekranie, który czatu nie renderuje | Teresa znika z ekranu listowego, bramka zielona | rejestracja **na czas montowania panelu**, nie trasy; test T5 sprawdza parę (obcy nie widzi / właściciel widzi) | flaga `ENABLE_LIST_JEDEN_PANEL=0` → dok wraca, zakładki znikają |
| **Podwójna Teresa** — layout listy renderuje czat, a dok się nie wyłączył (przeplot mount/unmount) | dwa czaty obok siebie | rejestr jest **licznikiem**, nie flagą (istniejąca decyzja z `71c147feeb`); T1 liczy korzenie | jw. |
| **Regres warsztatu Pomysłów / Notatnika** | wraca druga kolumna na `/workspace/*` | krok 14 przepływu; bramki ścieżkowe nietknięte (§4.4) | `git revert` kroku 2 |
| **Rodzina B niekompletna** — 25 powierzchni to praca per plik, znany kształt „poprawne w 2 z 3" | jeden moduł naprawiony, sąsiedni nie | KROK 0 kroku 5: wypisz **całą** listę z §2.2 do checklisty i odhaczaj; zrzut per moduł | `git revert` per plik |
| **Blokada zamrożenia** — commit odrzucony przez `check-freeze.sh` | `commit-msg` blokuje | marker `[ODMROZENIE <MODUL> DEC-397]` w każdym commicie kroku 5 (§5.1) | — |
| **Ciemny motyw** — cała rodzina nie była nigdy zmierzona | panel nieczytelny w ciemnym | zrzut `06-…-ciemny.png` + kontrola `mean_luma` w parze | flaga OFF |
| **Skok layoutu na progu 1440** | panel „przeskakuje" z nakładki w kolumnę przy zmianie rozmiaru okna | histereza 24 px w `ResizeObserver`; brak animacji | flaga OFF |

**Punkt powrotu:** tag `demo-safe-<data>` przed startem paczki; flaga `ENABLE_LIST_JEDEN_PANEL`
domyślnie **OFF** do akceptu właściciela, po akcepcie ON + re-tag. Przy dramacie wizualnym: flaga
OFF natychmiast (nie revert). Przy złym deployu: Railway rollback / `git revert` — **nigdy**
force-push na `demo`.

---

## 9. Nakład

| Krok | Model | Osobodni |
| :-: | --- | :-: |
| 1, 3, 4, 6, 8 | Sonnet | 0,8 |
| 2 (jeden panel w layoucie wspólnym) | **Opus** | 1,2 |
| 5 (25 powierzchni rodziny B) | Sonnet, 3 równoległe worktree | 1,0 |
| 7 (testy z dowodem mutacyjnym) | Opus | 0,6 |
| 9 (przepływ Playwright) | Sonnet | 0,4 |
| 10 (zrzuty + kontrola mechaniczna) | Sonnet | 0,3 |
| **RAZEM** | — | **≈4,3 osobodnia** (Opus 1,8 · Sonnet 2,5) |

**Zrównoleglenie:** kroki 1+8 od razu (nie zależą od niczego). Krok 5 dzieli się na trzy niezależne
paczki po odmrożeniu (Audyty+Ocena · Realizacja+Materiały+Spotkania · Moja Praca+reszta) — różne
pliki, zero konfliktów. Kroki 6 i 9 mogą iść równolegle z 5. **Sekwencyjne i nierozdzielne:**
2 → 3 → 4 (wszystkie w `TableWithPreviewLayout.tsx` / `StandardModuleBar.tsx`) i 10 na końcu.

**Krok 11 (poza MVP):** 0,5 osobodnia Sonnet, do fali po MVP — wymaga dwóch dodatkowych odmrożeń
i nie zmienia niczego, co właściciel widzi.

---

## 10. Cel osiągnięty = samokontrola Codexa (praca do celu)

Komendy po każdym kroku (z katalogu roboczego worktree):

| Komenda | Oczekiwany wynik |
| --- | --- |
| `npx esbuild <zmieniony plik> --bundle --platform=browser --outdir=/tmp/esb --log-level=error --loader:.png=file --loader:.svg=file` | brak wyjścia (exit 0) dla KAŻDEGO zmienionego pliku |
| `npx vitest run src/components/shared/PreviewPane/__tests__ src/layouts/__tests__ tests/components/MyWork/IdeasTableContent.previewPanelClose.ownerFeedback.test.tsx` | wszystkie testy PASS; testy z §6.1 mają dowód mutacyjny: po tymczasowym przywróceniu drugiego `aside` w `TableWithPreviewLayout` co najmniej 2 testy padają, po cofnięciu wszystkie zielone (wpisać liczby do raportu) |
| `bash scripts/check-list-canon.sh` | `OK`, dług nie rośnie |
| `bash scripts/check-artefakt.sh` | `OK`, crimson ≤ baseline |
| `git log --oneline origin/staging..HEAD` | każdy krok = osobny commit; commity dotykające plików z §5.1 mają w treści `[ODMROZENIE <MODUL> DEC-397]` |

Pomiar na żywo (własny vite: `cp /private/tmp/m03/.env.local . && npx vite --port <wolny> --strictPort --host 127.0.0.1 &`; sesja `ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json`; tło = staging):

```
node scripts/dev/odbior-zywo/zrzut.mjs --url=/my-work --port=<p> --host=127.0.0.1 --dom=aside --out=ev/skrzynka-1440.png
node scripts/dev/odbior-zywo/zrzut.mjs --url=/my-work --port=<p> --host=127.0.0.1 --dom=aside --szerokosc=1280 --out=ev/skrzynka-1280.png
node scripts/dev/odbior-zywo/zrzut.mjs --url=/interview --port=<p> --host=127.0.0.1 --dom=aside --klik="css=tbody tr:first-child" --out=ev/wywiad-rekord.png
node scripts/dev/odbior-zywo/zrzut.mjs --url=/audit-programs --port=<p> --host=127.0.0.1 --dom=aside --klik="css=tbody tr:first-child" --klik="text=Teresa" --out=ev/audyty-teresa.png
```

Progi (czytane z `.json` obok zrzutu):

- `dom.aside.count` = **1** przy zaznaczonym wierszu i przy otwartej Teresie; = **0** po kliknięciu `X`; nigdy 2 lub 3 — na 8 ekranach: Skrzynka, Pomysły, Zadania, Wywiad Skrzynka, Ocena lista, Audyty program, Materiały biblioteka, Realizacja praca.
- Po `X` i kliknięciu innego wiersza `aside.count` nadal **0**.
- Skrzynka 1280 px: szerokość `table` ≥ **1000 px** (dziś 294); 1440 px ≥ 830; 1920 px ≥ 1180 (odczyt `dom` z selektorem `table`).
- `bledyKonsoli` = 0, wpisy z `status ≥ 400` = 0 na każdym zrzucie.
- Zakładki panelu mają ten sam kształt pigułki co `IdeaElementInspector` (test kontraktowy porównuje klasy — PASS).
- Zrzut odniesienia (identyczna powłoka panelu): `evidence/odbior-zywo-20260905/02-moja-praca/mapa-jeden-panel/02-element.png`.

**STOP:** wszystkie progi spełnione na 8 ekranach × 3 szerokości → commit `evidence/p1-jeden-panel/` + raport z liczbami. Jeżeli próg wymaga edycji `MainLayout.tsx` lub pliku modułu zamrożonego poza listą §5.1 → zatrzymać się i opisać, nie obchodzić. Zakazy: `--no-verify`, `git stash`, nowe flagi, własny skrypt zrzutów obok kanonicznego.

## 11. Wklejka dla Codexa

```
ZADANIE P1 — Jeden prawy panel, zwijany (ekrany listowe). Praca do celu.

Katalog: świeży worktree z origin/staging (git worktree add -b codex/p1-jeden-panel <dir> origin/staging). Commit per krok, bez push, autor Piotr <piotr.wisniewski@dbr77.com>.
Pełna specyfikacja: docs/program/PROGRAM_NAPRAWCZY_20260905/P1_JEDEN_PANEL_ZWIJANY.md — przeczytaj całą przed pierwszą zmianą.

CEL: na każdym ekranie listowym prawa krawędź ma dokładnie JEDEN panel (TableWithPreviewLayout): wiersz zaznaczony → zakładki „Rekord | Teresa” + X; bez zaznaczenia i Teresa otwarta z Menu 3 → ta sama kolumna, zakładka „Teresa”; X zamyka, klik w wiersz NIE otwiera ponownie; wracasz pigułką „Pokaż panel”/„Teresa” w Menu 3; poniżej 1440 px panel jest nakładką. Globalny dok Teresy gaśnie przez rejestr gospodarzy (registerEmbeddedModuleChatHost), nie przez ścieżki.

KROKI (kolejność wymuszona): §5 tabela, kroki 1→2→3→4→(5‖6)→7→8→9→10. Krok 5 dotyka 6 modułów zamrożonych — commit z markerem [ODMROZENIE <MODUL> DEC-397] (lista §5.1). MainLayout.tsx NIE edytować.
KANON: StandardModuleBar/StandardPreview/ArtifactRightPanel, tokeny c-*, zero primary-*, kebab pionowy, i18n pl+en (6 kluczy §4.6).

CEL OSIĄGNIĘTY = §10: wszystkie komendy z oczekiwanym wynikiem + na 8 ekranach × 1280/1440/1920 licznik aside = 1 (0 po X), tabela Skrzynki ≥ 1000 px przy 1280, zero błędów konsoli i ≥400, testy z dowodem mutacyjnym. Dopiero wtedy raport (liczby, ścieżki zrzutów, SHA). Gdy próg wymaga decyzji właściciela lub pliku poza §5.1 — STOP i opis. Zakazy: --no-verify, git stash, flagi, skrypty obok zrzut.mjs.
```
