---
doc_id: funkcje-rejestr-wdrozenia
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# Rejestr wdrożenia — tor FUNKCJE

Jeden wiersz na funkcję. **Zapis w tej samej godzinie, w której powstał pomiar** —
rozmowa nie jest nośnikiem wiedzy (`00_ZASADY_PRACY.md`, reguła nr 5).

## Jak czytać kolumnę „stan"

| Stan | Znaczenie | Co dalej |
| --- | --- | --- |
| `NIEZBADANE` | nikt nie zmierzył czterech warstw | pomiar przed jakąkolwiek decyzją |
| `ISTNIEJE_NIEAKTYWNE` | kod jest, brak wołacza albo brak renderu | **najtańsza robota w programie** — podłączyć |
| `ZA_FLAGA` | kod jest, flaga domyślnie OFF | zmierzyć przy włączonej, potem decyzja o domyślnej |
| `DZIALA` | cztery warstwy zamknięte, łańcuch renderowania podany | odbiór adwersaryjny → ocena A/B |
| `DO_ZBUDOWANIA` | **dowód nieistnienia** pokazany komendami | dopiero teraz wolno budować |
| `ODLOZONE` | martwe albo poza rundą | wpis do `ODLOZONE.md`, kod zostaje |

## Cztery warstwy — bez nich wiersz nie wchodzi

`W1` typ/komponent · `W2` baza/backend · `W3` endpoint **i realny wołacz w `src/`** ·
`W4` **czy to się renderuje / wykonuje**.

**To nie są dowody:** sam `import` · wpis w rejestrze albo karcie odbioru ·
obecność w mapie widoczności · istnienie testu · nazwa katalogu · napis `CLOSED_FINAL`
w dokumentacji. W tym repozytorium `grep` systematycznie kłamie w stronę „działa".

## Ocena A–D (reguła nr 2 zasad pracy)

`A` działa przez interfejs, dowód mutacyjny w obie strony · `B` działa z **nazwanymi**
ograniczeniami · `C` nie działa albo dowód nie trzyma · `D` martwe / za flagą bez decyzji.
**Do właściciela idą wyłącznie `A` i `B`.**

---

## Rejestr

| Moduł | Funkcja | Trasa / serwis | Stan | Flaga (domyślna) | Dowód (ścieżka:linia) | Ocena | Werdykt właściciela |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Moja praca | Zapis komentarza Zadania i Decyzji do serwera | `TaskDetailView` · `DecisionDetailView` | `DO_ZBUDOWANIA` | brak | **handlery wykonują wyłącznie `setComments`** — zero `fetch`/`Api`/`axios`; dowód nieistnienia z dyżuru 133. Trasy `my-work.routes.ts` istnieją, ale **nikt ich nie woła** | `C` | — |
| Moja praca | Pulpit / Radar (zakładka „Home") | `MyWorkHub.tsx` case `'home'` | `ISTNIEJE_NIEAKTYWNE` | **brak flagi — literał `RADAR_ENABLED = false`** | `src/components/MyWork/MyWorkHub.tsx:240` (gate w 5 miejscach: `:583 :893 :1774 :3934`) | `D` | — |
| Wywiad | Skrzynka „Do dopuszczenia" (etap ④) | `isInterviewPendingReviewTabEnabled()` | `ZA_FLAGA` | `VITE_INTERVIEW_PENDING_REVIEW_TAB` (OFF, decyzja D-04) | `src/utils/interviewPendingReviewTabFlag.ts`; punkty gate `InterviewHub.tsx:2282,2337,6955,8835` | `D` | — |
| Narzędzia | Wyniki narzędzi w zbiorczej liście Outputs/Insights | `GET /api/tool-outputs`, `toolOutputs.routes.ts` | `ZA_FLAGA` | `VITE_TOOLS_INSIGHTS_WIRING` (OFF — cofnięte 28.08, DEC-158) | `src/utils/toolsInsightsWiringFlag.ts:45`; migracja `server/migrations/946_tool_outputs_reports_lineage.sql` | `D` | — |
| Czat | „Napisz raport" — lekka ścieżka `plan→generate→poll` | `POST /api/deliverables/generations` | `ZA_FLAGA` | `VITE_ENABLE_DELIVERABLES_LIGHT` (OFF) + bliźniacza flaga serwera **niezlokalizowana** | `src/utils/…deliverablesLight…`; 3 wołacze w `UnifiedChatPanel.tsx` | `D` | — |
| Czat | Trasa `/internal/v10-runtime` | `AppView.AI_CHAT_V10_RUNTIME` | `ODLOZONE` | — | `src/routes/routeConfig.ts:32,365,747`; **zero `<Route>` w `AppRoutes.tsx`**; `V10RuntimeWorkspaceView.tsx` nie jest nigdzie renderowany | `D` | — |
| Finanse | Dziewiętnaście paneli wyceny (Monte Carlo NPV, drzewo nośników, opcje realne, mostek odchyleń, biuro wartości…) | `src/components/Economics/panels/*` + `server/src/routes/v8/finance-valuation.routes.ts` | `ISTNIEJE_NIEAKTYWNE` **i** `ZA_FLAGA` | `ENABLE_V8_GLOBAL` — **domyślnie `false`** (`server/src/config/FeatureFlags.ts:31`) | **21 plików paneli; JSX-owego użycia w `src/` nie ma 19 z nich** (przeliczone przez nadzorcę); backend kompletny — **19 tras** w `finance-valuation.routes.ts`; render tylko w `dev-render/screens/finance-value-panels.tsx` | `D` | — |
| Materiały | Generator prozy dokumentu | `DocumentStudioIntakeForm` | `DZIALA` | `useLlm` — stan React, **domyślnie `true`** | `src/components/DocumentStudio/DocumentStudioIntakeForm.tsx:171`; komentarz `:168` mówi wprost, że bramkuje CAŁĄ generację treści | `A/B` — do odbioru rubryką pliku | — |
| Materiały | Pięć niezależnych systemów stylowania eksportu | `DeckStyler` · `DocxStyles` · `WorkbookStyler` · `report-pptx-designTokens` · `documentPdfRenderer` | `DZIALA` z ograniczeniem | brak | policzone wyczerpująco przez tor C, nie na próbce; **żaden nie czyta tokenów produktu** | `B` | — |
| Audyty | Eksport raportu do PDF | — | `DO_ZBUDOWANIA` | — | dowód nieistnienia: zero trafień `export.pdf` w trasach audytów | `C` | — |
| Audyty | Eksport raportu do DOCX | — | `ZA_FLAGA` | flaga domyślnie OFF | — | `D` | — |
| Audyty | Kreator programu audytu (`AuditOrchestratorWizard`, 511 linii) | — | `ISTNIEJE_NIEAKTYWNE` | brak | własny komentarz w pliku: „owner flagged direction" | `D` | — |
| Spotkania | Cały moduł — backend | `server/src/routes/meeting*` | `ZA_FLAGA` | `beta = 'closed'` dla zwykłych ról | **nie jest zaślepką**: 3077 linii serwisów, router 1348 linii, 8 tabel, testy na Postgresie — obala opis „zaślepka" w warstwie źródłowej | `D` | — |
| Czat · Teresa | Strażnik poufności na drodze załączników (E1) | `ContextRetrievalService.ts:142` | `DZIALA` | brak | dyżur 132; mutacja powtórzona przez nadzorcę na realnym Postgresie | `B` | — |
| Czat · Teresa | Strażnik poufności na drodze awaryjnej (E2) | `ai.routes.ts:4368` | `DZIALA` | brak | dyżur 132; bramkowane przez `governedAttachmentDocIds` | `B` | — |
| Czat · Teresa | Strażnik poufności na drodze metadanych (E3) | `ai.routes.ts:4460` | `DZIALA` | brak | dyżur 132; nazwy plików filtrowane | `B` | — |
| Czat · Teresa | Wołacz strażnika w `aiContextBuilder` | `aiContextBuilder.ts:974` | `DZIALA` | brak | dyżur 132 — `fail-open` zamieniony na `fail-closed`, mutacja potwierdzona | `B` | — |
| Inicjatywy | Most `adoptions/accepted-classic` — wołacz w interfejsie | `InitiativesHub.tsx` + trasa `:1732` | `ZA_FLAGA` | `VITE_INITIATIVE_BRIDGE` — OFF, **nie włączać** | dyżur 134; mutacja powtórzona przez nadzorcę (1/11 na markerze, 12/12 po). **Warunki mostu: zaakceptowany kandydat SWOT + pokwitowanie + zatwierdzony wynik narzędzia** — sprawdzone w SQL-u przez nadzorcę | `B` | — |
| Inicjatywy | Droga do rejestru kanonicznego dla rekordów **bez** kandydata SWOT | — | `DO_ZBUDOWANIA` | — | most ich nie obsłuży; to jest większość ze 170 rekordów tabeli klasycznej | `C` | — |
| Inicjatywy | Trzynaście kolejek bramkowych w Mojej pracy | komponenty `*Queue` | `ODLOZONE` | brak | **test pilnuje, żeby nie były zamontowane**: `src/components/MyWork/__tests__/MyWorkHub.decisionsOwnerFeedback.test.ts:8-29`, 13 nazw imiennie | `D` | — |
| Wyniki | Wspólny rejestr wskaźnika (handoff Inicjatywa→KPI) | `rvn_kpi_initiative_impacts` | `DZIALA` z ograniczeniem | brak | migracja `20260813_rvn_kpi_initiative_impacts.sql` **przyznaje wprost, że stary `initiative_kpis` NIE został scalony**; obok żyje ≥7 osobnych magazynów KPI | `B` | — |
| Organizacja | Nowy układ 11 ekranów (redesign) | `isOrgRedesignV1Enabled()` | `ZA_FLAGA` | `VITE_ORG_REDESIGN_V1_ENABLED` — **OFF**, mimo że nagłówek tego samego pliku pisze „DEFAULT ON" | `src/utils/orgRedesignFlag.ts` — komentarz nagłówkowy i kod mówią co innego; kod: `return parsed === null ? false : parsed` | `D` | — |
| Panel administratora | Sloty ustawień | `src/components/Admin/adminNavigation.ts` | `DZIALA` z ograniczeniem | `platform-operations` za literałem | **62 sloty** — przeliczone przez nadzorcę (`grep -c "c('"` = 62); 61 renderuje realny panel, 1 zablokowany stałą `CAN_ACCESS_PLATFORM_OPERATIONS=false` (`AdminSettingsModule.tsx:79`) | `B` | — |
| Ustawienia | Sekcje niedostępne dla roli członka | `SettingsView.tsx:247,281-284` | `DZIALA` z ograniczeniem | brak | rola `MEMBER` → `USER` → pilot-restricted; dozwolone 4 sekcje, reszta **cicho** przekierowuje na profil (`pilotAccess.ts:15-20,90-92`) | `B` | — |
| Portal partnerski | Cały moduł | `PartnerPortalView.tsx` | `DZIALA` | brak | 22 wołacze API, wejście przez `SidebarFooter.tsx:44-52`; **`getPartnerMenuItem` (`menuConfig.ts:280`) jest martwa — nigdy niewołana** | `B` | — |
| Czat · Teresa | Teksty projektu w promptcie (`project_knowledge kind='text'`) | `AIPipeline` | `DO_ZBUDOWANIA` | brak | **ścieżka sąsiednia poza strażnikiem** — strażnik działa na `knowledge_docs`; zgłoszone samodzielnie przez wykonawcę 132 | `C` | — |
| Czat · Teresa | Korpus wiedzy organizacji | `fetchOrgApprovedContext` | `ZA_FLAGA` | `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` (OFF) — **zastrzeżenie: nie włączać przed osobnym dyżurem** | `ai.routes.ts:4077`; strażnik obecny `ContextRetrievalService.ts:333` | `D` | — |

---

## Pomiary w toku

| Tor | Moduły | Wydany | Stan |
| --- | --- | --- | --- |
| A | Chat · Moja praca · Wywiad · Narzędzia | 2026-08-30 | **wrócił, trzy twierdzenia przeliczone przez nadzorcę — zgadzają się** |
| B | Ocena · Inicjatywy · Realizacja · Wyniki | 2026-08-30 | **wrócił, dwa twierdzenia przeliczone — zgadzają się** |
| C | Finanse · Materiały · Audyty · Spotkania | 2026-08-30 | **wrócił, trzy twierdzenia przeliczone — zgadzają się, jedno ostrzejsze niż raport** |
| D | Organizacja · Panel administratora · Ustawienia · Portal partnerski | 2026-08-30 | **wrócił, dwa twierdzenia przeliczone — zgadzają się; obalił jedną tezę briefu** |

Wynik każdego toru wchodzi do rejestru **po przeliczeniu liczb przez nadzorcę**, nie
z raportu wykonawcy (reguła nr 3 — raport wykonawcy nie jest dowodem).

## Dyżury Codexa — tor funkcji

| Nr | Temat | Stan | Zastrzeżenie |
| --- | --- | --- | --- |
| 130 | Utrata danych — miejsca zapisu bez trwałości | biegnie u wykonawcy | klon `/private/tmp/cx-day130-utrata-danych` |
| 131 | Teresa i granice wiedzy | scalony po naprawie i odbiorze | **flagi `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` nie wolno włączyć przed osobnym dyżurem** |
| 130 | Utrata danych — miejsca zapisu bez trwałości | **zamknięty `PARTIAL / EVIDENCE_MISSING`** | instrukcja **nie miała tabeli licencji** — błąd autora, nie wykonawcy; wykonawca oddał czerwony kontrakt zamiast łamać zasady. `T3` potwierdzone: **0 tras uploadu i 0 migracji** załączników Inicjatywy/Zadania/Decyzji. Mianowniki `35` i `28` **niepotwierdzone — nie cytować** |
| 133 | Kontrakt mutacji w widżetach Mojej pracy | **SCALONY 2026-08-30**, merge `f9848d75a0`, ocena **`B`** | odbiór: `ODBIOR_133_ZAPIS_MOJEJ_PRACY.md`. Mutacja **4/4 odtworzona** przez nadzorcę, regresja różnicowa 120→128 czysta. **Ścieżka notatnika nadal pokazuje sprzeczne komunikaty** — defekt zastany, host połyka błąd |
| 134 | Most inicjatyw dostaje wołacza w interfejsie | **wydany 2026-08-30**, marker `64d3de306c` | faza 3 **krok (a) wyłącznie**; flaga `initiativeBridgeFlag` domyślnie OFF; zasoby 6017 / 4934–4935 |
| 135 | Dziewiętnaście paneli wyceny podpiętych za flagą + harness do zrzutów | **wydany 2026-08-30**, marker `64d3de306c` | flaga `financeValuePanelsFlag` domyślnie OFF; zakaz projektowania wyglądu; zasoby 6018 / 4936–4937 |
| 132 | Jeden strażnik poufności na trzech żywych wejściach do promptu | **SCALONY 2026-08-30**, merge `9e81bd473c`, ocena **`B`** | odbiór: `ODBIOR_132_STRAZNIK_POUFNOSCI.md`. Cztery mutacje powtórzone przez nadzorcę, `R1` na realnym Postgresie. Jedna regresja złapana i naprawiona (`b87b5af3b5`). **Liczby 220 zastanych porażek nie wolno cytować** — niezweryfikowana różnicowo |


---

## Tor A — co przeliczył nadzorca, a co pozostaje twierdzeniem wykonawcy

**Przeliczone własnymi rękami 2026-08-30, zgadza się co do znaku i miejsca:**
`RADAR_ENABLED = false` jest **literałem**, nie flagą — nie da się go włączyć zmienną
środowiskową ani parametrem adresu; brak `<Route>` dla `/internal/v10-runtime`
w `AppRoutes.tsx`; migracja `946_tool_outputs_reports_lineage.sql` istnieje, a flaga
`toolsInsightsWiringFlag.ts` niesie w komentarzu pełną historię cofnięcia (DEC-158).

**★ Korekta liczby wykonawcy.** Tor A podał „24 pozycje `DZIALA`". Ta liczba **nie
spełnia definicji `DZIALA` z tego rejestru** — wykonawca sam napisał, że zamknął
`W1` i `W4`, a `W3` (realny wołacz API) oznaczał jako „zakładany" dla zakładek-dzieci,
bo cztery huby to ponad 27 000 linii. Do rejestru **nie wchodzi ani jedna z tych 24
pozycji jako `DZIALA`.** Pozostają `NIEZBADANE` na poziomie `W3`. Wpisujemy wyłącznie
to, co ma komplet czterech warstw albo dowód nieaktywności.

**Otwarte po torze A — do domknięcia, nie do zapomnienia:**
stan tabeli `tool_outputs` na bazie demo (pomiar kodu nie odpowiada na pytanie o bazę) ·
lokalizacja serwerowej bliźniaczki `ENABLE_DELIVERABLES_LIGHT` ·
czy `src/components/Discovery/InterviewHub.tsx` (drugi plik o tej nazwie) żyje ·
czy `canViewManager`/`canViewManaged`/`canViewInsights` to realne role, czy zawsze-prawda.


---

## Tory B i D — co przeliczył nadzorca

**Przeliczone własnymi rękami 2026-08-30:** trasa mostu `adoptions/accepted-classic`
istnieje (`initiativesExecutionRuntime.routes.ts:1732`), a `grep` po niej w `src/`
daje **zero** — most jest napisany i nigdy niepodłączony, dokładnie jak mówił plan ·
test blokujący trzynaście kolejek istnieje i wymienia je imiennie · slotów panelu
administratora jest **62**, policzone niezależnie · flaga `orgRedesignFlag` zwraca
przy braku zmiennej `false`, choć nagłówek tego samego pliku deklaruje „DEFAULT ON".

**★ OBALENIE TEZY Z BRIEFU — moja teza, nie wykonawcy.** Do pracy weszło zdanie
„pięć ekranów Organizacji stoi na pamięci przeglądarki". Tor D pokazał, że ekranów
jest **dwanaście**, i że **wszystkie mają zapis do bazy** — globalny auto-save
`src/hooks/useOrgContextSync.ts` → `PUT /api/organization-context-store`, z realną
tabelą i migracją `779_organization_context_store.sql`. Liczba „pięć" pochodzi
z komentarza w kodzie mówiącego o pięciu ekranach, które kiedyś miały **zduplikowany**
zapis — nie o braku zapisu. **Warunek odbioru Organizacji oparty na tej tezie jest
nieaktualny i trzeba go przepisać.**

**★ SYGNAŁ METODYCZNY — test tekstowy jako kanon.** Test blokujący trzynaście kolejek
czyta `MyWorkHub.tsx` jako **tekst** i sprawdza brak napisów. To ten sam kształt, który
w dyżurze 131 uznaliśmy za tautologię i podstawę odrzucenia. Tutaj pełni rolę zapisu
decyzji architektonicznej, nie dowodu działania. **Przed pracą nad bramką analizy trzeba
rozstrzygnąć, czy ten test jest kanonem, czy długiem** — plan funkcji stawia to pytanie
w fazie 3 i pozostaje ono otwarte.

**Rozbieżność do wyjaśnienia, nierozstrzygnięta.** Brief mówił o Ustawieniach „dla roli
członka 2 z 10". Tor D przeliczył: **4 sekcje dozwolone**, 50 sekcji w typie ogółem.
Żadna z tych par nie jest oczywiście prawdziwa — mianownik jest inny w obu. Do pomiaru
osobno, nie do wpisania jako fakt.

**Otwarte po torach B i D — ZAMKNIĘTE 30.08:** źródło liczby „11 bramek, 12 statusów,
26 kart" istnieje: `docs/modules/initiatives-execution-canon/01_PROCESS_GOVERNANCE_AND_GATES.md`
§8 (tabela liczy dokładnie 11 bramek; statusy w §7, karty w `03_UI_UX_AND_INTERACTION_SPEC.md:425`).
Tor B go nie znalazł, ale plan cytował prawdę. **Nowe otwarcie w zamian:** ten kanon nosi
`OD-02` i pozostaje `draft_for_owner_review` — stan docelowy fazy 3 sam czeka na odbiór
właściciela. Wpisane też do planu funkcji (aneks 30.08).


---

## Tor C — co przeliczył nadzorca

**★ NAJWIĘKSZE ZNALEZISKO DNIA, przeliczone własnymi rękami.** W katalogu
`src/components/Economics/panels/` leży **21 paneli** analizy finansowej. Sprawdziłem
każdy osobno komendą `grep -rl "<NazwaPanelu" src/` z wykluczeniem samego pliku panelu:

- `EvBasketFootballField` — renderowany w `src/components/Benefits/ValuationWorkspace.tsx`,
- `InvestmentAppraisalPanel` — występuje **wyłącznie we własnym teście**,
- **pozostałe 19 — zero użycia w JSX w całym `src/`.**

Pod spodem stoi kompletny backend: `server/src/routes/v8/finance-valuation.routes.ts`,
**19 tras**. Całość jest przy tym podwójnie zamknięta — nawet gdyby panele podłączyć,
`ENABLE_V8_GLOBAL` ma w schemacie `default(false)` (`server/src/config/FeatureFlags.ts:31`).
Jedyne miejsce, w którym te ekrany kiedykolwiek widać, to harness `dev-render`.

To jest dokładnie ta kategoria, o której mówił właściciel: **zbudowane, opłacone,
przetestowane i niepodłączone**. Podłączenie jest tańsze niż cokolwiek, co dziś budujemy.

**Sprostowanie wobec raportu wykonawcy — na jego niekorzyść i naszą.** Tor C napisał
„19 z 20 paneli". Plików jest 21, a nie 20, i przeliczenie zmienia obraz: jeden panel
naprawdę żyje w aplikacji, drugi żyje tylko w teście. Substancja bez zmian, mianownik był zły.

**Trzeci parametr dokumentu — potwierdzony.** Generator prozy stoi za `useLlm`,
stanem Reacta o wartości początkowej `true` (`DocumentStudioIntakeForm.tsx:171`).
To domyka wątek zamknięty tezą, że winna była flaga `ENABLE_DELIVERABLES_PREMIUM`:
**żadna flaga środowiskowa nie odpowiada za pustkę w dokumentach.**

**Obalenie opisu w warstwie źródłowej.** Spotkania są tam opisane jako zaślepka.
Kodowo zaślepką nie są — jest realny router, serwisy, osiem tabel i testy na Postgresie.
Zamknięte są dostępem beta dla zwykłych ról, co jest zupełnie innym problemem
i inną naprawą.


---

## Rozłączność czterech biegnących dyżurów — sprawdzona automatem 2026-08-30

Tabele licencji plikowych dyżurów 132, 133, 134 i 135 przecięto programowo
(ścieżki z licencją `zapis`/`utworzenie`, porównanie każdy z każdym wraz z prefiksami
katalogów). Wynik: **zero kolizji**.

| Dyżur | Terytorium zapisu |
| --- | --- |
| 132 | `server/src/routes/ai.routes.ts` · `services/aiContextBuilder.ts` · `services/organizationContext/ContextRetrievalService.ts` |
| 133 | `src/components/MyWork/shared/*Section.tsx` · `TaskDetailView` · `DecisionDetailView` |
| 134 | `src/components/Initiatives/InitiativesHub.tsx` · `src/utils/initiativeBridgeFlag.ts` |
| 135 | `src/components/Economics/**` · `dev-render/screens/**` · `src/utils/financeValuePanelsFlag.ts` |

**Kolizja złapana i naprawiona przed wydaniem:** dyżury 134 i 135 miały w tabelach
tę samą zaślepkę `src/utils/<nowa-flaga>.ts`. Nazwy zostały **przybite imiennie**
w obu instrukcjach, z jawnym zdaniem, że nie wolno ich zmienić.

**Kandydat odrzucony przed wydaniem — wektor maskowania testów.** Plan wymienia go
jako otwarty i groźniejszy niż którakolwiek faza. Pomiar 30.08: `vitest.config.ts:331`
ma `retry: 0`, a pozostałe dziesięć konfiguracji nie ustawia `retry` wcale i dziedziczy
zero z Vitest 4. **Wektor jest zamknięty** — dyżuru na fantom nie wydano. Do planu
wchodzi jako pozycja do sprostowania, nie do naprawy.
