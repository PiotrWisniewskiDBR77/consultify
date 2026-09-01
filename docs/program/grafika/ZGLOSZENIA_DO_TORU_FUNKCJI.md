---
doc_id: grafika-zgloszenia-funkcje
status: living
truth_type: handover
established: 2026-08-31
---

# ZGŁOSZENIA DO TORU FUNKCJI — rejestr

Ten plik zbiera sprawy **wykryte w torze grafiki, które nie należą do toru
grafiki** — nie dotyczą wyglądu ekranów (StandardTable/StandardModuleBar/
ArtifactRightPanel), tylko mechaniki, backendu, treści merytorycznej albo
długu wobec licencjodawcy. Tor grafiki je zauważa (bo ogląda żywe ekrany
oczami i mierzy realny runtime), ale ich naprawa jest poza jego mandatem.

**Zasada:** wpis tu ≠ zamknięcie sprawy. To przekazanie, nie odbiór. Każda
pozycja zostaje, dopóki ktoś z toru funkcji jej nie podejmie i nie oznaczy
jako zamkniętą (dopisując datę/SHA obok pozycji, nie kasując wiersza).

## Format wpisu

| # | Priorytet | Charakter ustalenia | Tytuł | Gdzie (plik:linia) | Status |
| --- | --- | --- | --- | --- | --- |

`Charakter ustalenia` rozróżnia dwie jakości dowodu (patrz `korpus pułapek
harnessu` — hipoteza staje się faktem tylko przez pomiar mutacyjny na żywym
systemie, nie przez lekturę kodu):
- **hipoteza z dowodem kodowym** — ścieżka w kodzie prowadzi jednoznacznie do
  problemu, ale NIE zmierzono efektu na żywym/deployowanym systemie.
- **potwierdzone mutacyjnie** — ktoś wywołał defekt na żywo i zaobserwował
  skutek, nie tylko przeczytał kod.
- **zastane, nienaprawione** — znany od wcześniej, zgłoszenie tu tylko
  konsoliduje odnośnik.

---

## Rejestr

| # | Priorytet | Charakter | Tytuł | Gdzie | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | P0-bezpieczeństwo | hipoteza z dowodem kodowym | Okno 300 ms bez ochrony demo przy przełączaniu trybu | `src/store/useAppStore.ts:94-95` → `src/services/api.ts:761,778-780` | otwarte |
| 2 | P1 | hipoteza z dowodem kodowym | `runtimeApi.ts` łyka nie-JSON jako `null` → anonimowy TypeError → mylący `INITIATIVE_DATA_CONTRACT_ERROR` | `src/services/initiatives-execution/runtimeApi.ts:510-516,1059-1078` | otwarte |
| 3 | P1 | potwierdzone mutacyjnie | Arkusz: wpisana wartość znika po Enter | ekran „excele-edytowalna-siatka" (dyżur wcześniejszy) | otwarte — NIE zapalać właścicielowi |
| 4 | P2 | potwierdzone mutacyjnie | `SwotLiveArtifact.tsx` bez wołacza w produkcie | `src/components/.../SwotLiveArtifact.tsx` (przegląd nocny 04-narzedzia) | otwarte |
| 5 | P2 | potwierdzone mutacyjnie | Żargon inżynierski w treści raportu z oceny | `src/method-core/methods/drd/drdSessionRuntime.ts:507,613,621-623` | otwarte |
| 6 | P2 | potwierdzone mutacyjnie | Jądro `FilterableTable` — podłoga 112px w `columnFit` ściska kolumny przy przepełnieniu | jądro `FilterableTable` (228 importerów) + `ExecutionSummaryOneLook.tsx` (tabela „TOP ryzyka", wymuszone 980px) | otwarte — wymaga osobnego nadzorowanego dyżuru |
| 7 | P2 | zastane, nienaprawione (wymaganie właściciela) | System bramki zapisu dla metod licencjonowanych (SIRI) | `KANON_Z_ODBIOROW.md` (wpis 31.08) | otwarte — tor grafiki odpowiada tylko za uczciwy komunikat |
| 8 | P3 | zastane, nienaprawione | Excel: „Zadanie ukończone / 0-z-8" po ponownym otwarciu | ekran „excele-edytowalna-siatka" | otwarte — zgłoszone wcześniej torowi funkcji |
| 9 | P1 | potwierdzone mutacyjnie | `AdminComplianceEvidencePanel` — puste kolumny Zdarzenie/Aktor/Ryzyko (camelCase vs snake_case) | `AdminComplianceEvidencePanel.tsx:81-110` vs `adminP32.routes.ts:2208-2296` | otwarte |
| 10 | P2 | hipoteza z dowodem kodowym | `check-list-canon.sh` nie skanuje paneli Admina (detekcja ograniczona do `*Hub.tsx`/`*LightShell.tsx`) — dług cichy | `scripts/check-list-canon.sh` | otwarte — rozszerzenie bramki to osobny dyżur |
| 11 | P2 | hipoteza z dowodem kodowym | Flaga `summaryOneLook`: komentarz „Default OFF do akceptu" vs logika ON wszędzie poza public-prod | `executionFeatureFlags.ts:41-48,115` | otwarte — wymaga weryfikacji, czy właściciel akceptował |
| 12 | P2 | hipoteza z dowodem kodowym | `RolloutTab.tsx:987` — błąd sieci gasi zakładkę mimo istniejącej ścieżki degradacji (kod martwy w swoim scenariuszu) | `RolloutTab.tsx:987` | otwarte |
| 13 | P2 | hipoteza z dowodem kodowym | `SOURCE_COLORS` kalendarza — crimson hexy jako kolory kategorii | `calendarTypes.ts:91-99` | otwarte |
| 14 | P2 | potwierdzone mutacyjnie | `TaskDetailView`/`NModeHeader` — przycisk PRIMARY na surowych klasach navy zamiast tokenów `c-*` | `NModeHeader` (karta `karta-task`), zweryfikowane w DOM | otwarte |
| 15 | P3 | hipoteza z dowodem kodowym | Martwy kod `NotificationsContent.tsx` (1426 linii) + `NotificationsHub.tsx` (1217) — zero importerów | `NotificationsContent.tsx`, `NotificationsHub.tsx` | otwarte |
| 16 | P3 | potwierdzone mutacyjnie | `ExecutionResourcesSurface.tsx:68` — kapitalizacja `\b\w` łamie polskie diakrytyki („WóJcik") | `ExecutionResourcesSurface.tsx:68` | otwarte |
| 17 | P3 | hipoteza z dowodem kodowym | `AdminIncidentHistoryPanel.tsx:76` — link do nieistniejącego `/admin/health/overview` | `AdminIncidentHistoryPanel.tsx:76` | otwarte |
| 18 | P1 | potwierdzone mutacyjnie | `SettingsCard.tsx:74` + `SettingsToggle.tsx:56` (`src/components/AISettings/`) — `text-navy-900` bez `dark:` → treść znika w ciemnym motywie; komponenty WSPÓŁDZIELONE | `src/components/AISettings/SettingsCard.tsx:74`, `SettingsToggle.tsx:56` | otwarte — promień rażenia poza domeną AI |
| 19 | P2 | hipoteza z dowodem kodowym | `c-accent-soft` (`src/index.css:70,295`) = crimson w rgba pod nazwą tokenu — nie łapie go grep `primary-*`; bramki kanonu ślepe na ten wektor | `src/index.css:70,295` | otwarte |
| 20 | P2 | hipoteza z dowodem kodowym | Samowolne adnotacje `§27-exempt` na tabelach z akcjami — obejście kanonu | `ModelsProvidersTab.tsx:649` | otwarte — przegląd wszystkich wystąpień `§27-exempt` osobnym dyżurem |
| 21 | P2 | hipoteza z dowodem kodowym | Podwójne/potrójne zagnieżdżenie nawigacji w domenie ai (`AdminAIControlCenterPanel` → `AIModule` TabLayout EN → `OrgAISettingsView` taby) — 4 zakładki osiągalne tylko wewnętrznym paskiem, bez slotu menu | `AdminAIControlCenterPanel` → `AIModule` → `OrgAISettingsView` | otwarte |
| 22 | P1 | potwierdzone mutacyjnie | `CommandCenterAttentionQueue` — `highRiskCount` zawsze 0 (płaska vs zagnieżdżona odpowiedź) | `AdminCommandCenterPanel.tsx:106` vs `adminP32.routes.ts:2942-2950,2139-2164` | otwarte |
| 23 | P2 | potwierdzone mutacyjnie | `CommandCenterDlpTab.tsx:244` — waga „Wysoka" dostaje ten sam kolor co „Krytyczna"; rozdzielić semantykę | `CommandCenterDlpTab.tsx:244` | otwarte |

---

## Szczegóły

### 1. [P0-bezpieczeństwo] Okno 300 ms bez ochrony demo przy przełączaniu trybu

**Charakter:** hipoteza z dowodem kodowym — ścieżka w kodzie jest jednoznaczna,
ale NIE zmierzone na żywym backendzie. Wymaga osobnego dyżuru pomiarowego
z instrumentacją (np. przechwycenie realnych żądań w oknie 0-300ms po
przełączeniu), zanim to wejdzie do rejestru jako potwierdzone.

Flaga `isDemoMode` trafia do nagłówka `X-Demo-Mode` przez lustro w
`localStorage`, a nie bezpośrednio z pamięci store'a:

- Zapis do `localStorage` idzie z debounce 300 ms:
  `src/store/useAppStore.ts:94-95` (funkcja `setItem` w `appStoreStorage`,
  `window.setTimeout(..., 300)`).
- `getHeaders()` czyta ten sam `localStorage` przez `getDemoFlags()` i dopina
  `X-Demo-Mode`: `src/services/api.ts:761` (`const { isDemoMode, demoSessionOrgId } = getDemoFlags();`),
  `src/services/api.ts:778-780` (dopięcie nagłówka, tylko gdy `isDemoMode`).
- Przełącznik użytkownika: `src/hooks/useDemo.ts:86` (`toggleDemoMode`) wywołuje
  `setState` na store, co jest natychmiastowe w pamięci, ale localStorage
  aktualizuje się dopiero po debounce.
- Po stronie serwera: `server/src/middleware/auth.middleware.ts:773-777`
  rozstrzyga PRAWDZIWĄ organizację, gdy nagłówek demo nie przyszedł.
  `server/src/middleware/demoGuard.middleware.ts:266` — `demoWriteProtection`
  nie blokuje zapisu, gdy nagłówek jest nieobecny.

**Efekt hipotetyczny:** przez ~300 ms po włączeniu trybu demo żądania mogą
lecieć BEZ `X-Demo-Mode` → serwer rozstrzyga prawdziwą organizację zamiast
demo, `demoWriteProtection` nie blokuje zapisów. Symetrycznie przy
WYŁĄCZANIU trybu demo: przez ~300 ms nagłówek demo może jeszcze być
wysyłany, co przy złej kolejności warunków po stronie serwera dawałoby
fałszywe 403 realnemu użytkownikowi.

**Rekomendacja naprawcza (najlepszy stosunek zysku do ryzyka):** w `setItem`
(`src/store/useAppStore.ts:92-96`) zapisywać `isDemoMode`/`demoSessionOrgId`
NATYCHMIAST (bez debounce) przy zmianie tych dwóch pól konkretnie, zostawiając
debounce dla reszty stanu (UI, aiConfig, itd. — te nie są bramką
bezpieczeństwa).

**Ten sam wzorzec odłożonego odczytu (localStorage zamiast store) występuje
w 7 dalszych miejscach produktu** — nie są to bramki bezpieczeństwa, ale
warto je znać przy naprawie jądra:
- `src/index.tsx:40`
- `src/contexts/HelpContext.tsx:147`
- `src/contexts/AccessPolicyContext.tsx:123`
- `src/components/Help/FeatureUpdatesPanel.tsx:31`
- `src/hooks/useModuleVideoHelp.ts:8`
- `src/store/useConversationStore.ts:1664`

(To 6 pozycji z opisu źródłowego — siódme miejsce to sam
`src/store/useAppStore.ts:94-95`, źródło debounce'a.)

### 2. [P1] `runtimeApi.ts` łyka nie-JSON jako `null`

`src/services/initiatives-execution/runtimeApi.ts:510-516,1059-1078` — brak
strażnika content-type/kształtu odpowiedzi w warstwie odczytu JSON. Gdy
backend (albo — jak w naprawie H2 tego samego dyżuru — dev-render bez
proxy) odda coś innego niż oczekiwany JSON, wywołanie kończy się anonimowym
`TypeError`, który `src/components/Initiatives/initiativeLoadError.ts:20`
tłumaczy na mylący `INITIATIVE_DATA_CONTRACT_ERROR` — komunikat sugeruje
problem z kontraktem danych, nie z siecią/serwerem.

**Naprawa:** strażnik content-type i kształtu odpowiedzi przed próbą
`JSON.parse`/użyciem wyniku. Ten sam wzorzec (`readJson` bez strażnika)
powtarza się w ~20 wywołaniach w tym samym pliku — naprawa jądra ma sens
zamiast łatania punktowo.

**Powiązanie z H2 tego dyżuru:** naprawa vite proxy w dev-render (honest 404
zamiast 200 text/html) jest bezpiecznikiem STANOWISKA POMIAROWEGO, nie tego
kodu — łata objaw (fałszywy `INITIATIVE_DATA_CONTRACT_ERROR` w harnessie),
nie przyczynę (brak strażnika w `runtimeApi.ts`, który zamieni DOWOLNĄ
nie-JSON odpowiedź w mylący komunikat, także na prawdziwym backendzie przy
awarii/przekierowaniu/proxy).

### 3. [P1] Arkusz: wpisana wartość znika po Enter

Defekt zastany, **potwierdzony mutacyjnie** w poprzedniej sesji (nie tylko
przeczytany w kodzie). Wymaga dyżuru z instrumentacją, żeby ustalić
dokładny mechanizm (re-render czyszczący komórkę? race warunku zapisu?
kolizja z autosave?). **NIE zapalać właścicielowi** przed zmierzeniem
przyczyny — pokazanie mu żywego bug'u bez planu naprawy łamie regułę
„Piotr nigdy nie jest pierwszym testerem" w drugą stronę (pierwszym
świadkiem regresji).

### 4. [P2] `SwotLiveArtifact.tsx` bez wołacza w produkcie

Komponent zbudowany i przetestowany, ale **nigdy nie montowany**
w `ToolWorkspace` — jedenasty kształt fałszywego „gotowe" (biblioteka bez
wywołania). Wykryte w przeglądzie nocnym modułu 04-narzedzia. Wymaga
decyzji: albo dopiąć wołacza w `ToolWorkspace`, albo świadomie przenieść do
`ODLOZONE.md` jeśli SWOT ma inną docelową powierzchnię.

### 5. [P2] Żargon inżynierski w treści raportu z oceny

Sekcja „Ograniczenia i założenia" generowanego raportu cytuje nazwy
wewnętrzne zamiast tłumaczyć je na język biznesowy:
`EventDerivedOutputBridge`, `vertical-slice demo`,
`businessMeaning/recommendation`, `aggregation.byGroup`.

Źródło: `src/method-core/methods/drd/drdSessionRuntime.ts:507,613,621-623`.
Wykryte w przeglądzie nocnym 03/05. To treść trafiająca bezpośrednio do
klienta — priorytet P2 mimo że „tylko tekst", bo psuje wiarygodność
dokumentu przed odbiorcą zewnętrznym.

### 6. [P2] Jądro `FilterableTable` — podłoga 112px w `columnFit`

Mechanizm dopasowania szerokości kolumn ma twardą podłogę 112px, która przy
przepełnieniu ściska WSZYSTKIE kolumny jednakowo (zamiast np. przycinać
najmniej istotne albo włączać przewijanie). Naprawy jak dotąd robione
per-konsument (`OutputsAggregateTabContent`, `ExecutionSummaryOneLook`), nie
w jądrze — bo **228 importerów** i poprzednia zmiana jądra dała regresję
rozrywania wyrazów w produkcji. Zmiana jądra = osobny, nadzorowany dyżur
z pełnym przeglądem importerów, nie punktowa łatka.

**Powiązane, ten sam mechanizm:** tabela „TOP ryzyka" w
`src/components/Execution/ExecutionSummaryOneLook.tsx` ma kolumny
niewidoczne bez przewijania przy wymuszonych 980px szerokości.

### 7. [P2] System bramki zapisu dla metod licencjonowanych (SIRI)

Wymaganie właścicielskie zapisane w `docs/program/grafika/KANON_Z_ODBIOROW.md`
(wpis 31.08): potrzebna bramka klient → Consultify na zapisie efektów metod
objętych licencją zewnętrzną. Kluczowe: dług Consultify wobec
licencjodawcy **NIGDY** nie może zatrzymać klienta (nie jest to jego wina
ani problem, którym ma się przejmować w danej chwili pracy).

Zakres toru grafiki w tej sprawie jest wąski i celowo ograniczony: tor
grafiki odpowiada WYŁĄCZNIE za to, żeby komunikat pokazywany użytkownikowi
przy tej bramce był uczciwy (nie za mechanikę samej bramki, nie za
rozliczenia z licencjodawcą — to należy do toru funkcji/biznesu).

### 8. [P3] Excel: „Zadanie ukończone / 0-z-8" po ponownym otwarciu

Zastany defekt na ekranie „excele-edytowalna-siatka" — po ponownym otwarciu
arkusza licznik zadań resetuje się do „0-z-8" mimo że zadanie było
oznaczone jako ukończone. Zgłoszony wcześniej torowi funkcji; ta pozycja
tylko konsoliduje odnośnik w jednym rejestrze zamiast rozpraszać go po
dziennikach sesji.

### 9. [P1] `AdminComplianceEvidencePanel` — puste kolumny

Rejestrowane jako REALNY BUG podczas pomiaru ekranu `admin-audit-compliance-evidence`
(runda 2026-08-31): kolumny Zdarzenie/Aktor/Ryzyko renderują się puste na żywym
ekranie. Przyczyna zlokalizowana w kodzie: frontend czyta pola `action`/`actor`/`risk`,
backend zwraca `action_type`/`admin_id`/`risk_level` — rozjazd camelCase vs snake_case.
Źródło: `AdminComplianceEvidencePanel.tsx:81-110` vs `adminP32.routes.ts:2208-2296`.

### 10. [P2] `check-list-canon.sh` nie widzi paneli Admina

Bramka pre-commit kanonu list skanuje tylko pliki `*Hub.tsx`/`*LightShell.tsx`.
Panele Administracji (billing/team/security/audit/health/ai/command) nie pasują
do tego wzorca nazw plików, więc mogą łamać kanon list (surowe `FilterableTable`
zamiast `StandardTable`, brak kebab) i przejść bramkę bez ostrzeżenia. To luka
w zasięgu bezpiecznika, nie w samej regule. Rozszerzenie wzorca detekcji o
komponenty panelu Admina to osobny, nadzorowany dyżur — nie punktowa łatka.

### 11. [P2] Sprzeczność flagi `summaryOneLook`

Komentarz w kodzie mówi „Default OFF do akceptu Piotra", ale logika
(`executionFeatureFlags.ts:41-48,115`) włącza flagę wszędzie poza public-prod —
czyli ekran `execution-tab-summary` jest dziś widoczny szerzej, niż komentarz
sugeruje. Ten sam kształt sprzeczności co DEC-317. Wymaga potwierdzenia z
właścicielem, czy taki zakres widoczności był świadomie akceptowany, zanim
ktokolwiek uzna flagę za „bezpiecznie OFF".

### 12. [P2] `RolloutTab.tsx:987` — błąd sieci gasi całą zakładkę

Zakładka „Rollout" ma zaimplementowaną ścieżkę degradacji, ale błąd sieci
gasi całą zakładkę, zanim ta ścieżka zdąży zadziałać — czyli kod degradacji
jest dziś martwy we własnym scenariuszu awaryjnym. Zmierzone przy pomiarze
`execution-tab-rollout` (runda 2026-08-31), zawężone tylko do podwidoku KPI.

### 13. [P2] `SOURCE_COLORS` kalendarza — crimson jako kolor kategorii

`src/components/MyWork/Calendar/calendarTypes.ts:91-99` hardkoduje crimson
hexy (`#A51C30`, `#D42B3D`) jako kolory KATEGORII wydarzeń w kalendarzu Mojej
Pracy — dokładnie Pułapka nr 1 z `CLAUDE.md` (czerwień tylko semantyka
krytyczna), tyle że w miejscu, gdzie crimson koduje zwykłą kategorię, nie
stan krytyczny.

### 14. [P2] `NModeHeader` karty zadania — CTA na surowych klasach

Przycisk PRIMARY „Wyślij do przeglądu" w `NModeHeader` (używanym przez kartę
`karta-task`) używa surowych `bg-navy-900` / `dark:bg-[#F4F7FB]` zamiast
tokenów `c-*`. Zweryfikowane w DOM, nie tylko w kodzie. To odkrycie
skorygowało dawny wpis rejestru „karta-task: A / Bez odchyleń" na B — patrz
`status.json` i `DZIENNIK_GRAFIKA.md` Z-19.

### 15. [P3] Martwy kod `NotificationsContent.tsx` + `NotificationsHub.tsx`

`NotificationsContent.tsx` (1426 linii) i `NotificationsHub.tsx` (1217 linii)
nie mają dziś żadnego importera w produkcie — kandydat do usunięcia, zgodnie
z praktyką czyszczenia martwego kodu stosowaną gdzie indziej w repo.

### 16. [P3] `ExecutionResourcesSurface.tsx:68` — kapitalizacja łamie diakrytyki

Wyrażenie regularne oparte na `\b\w` do kapitalizacji nazwisk/etykiet psuje
polskie znaki diakrytyczne — zaobserwowane na żywo jako „WóJcik" zamiast
„Wójcik" na ekranie `execution-tab-resources` (runda 2026-08-31).

### 17. [P3] `AdminIncidentHistoryPanel.tsx:76` — martwy link

Link na ekranie Historia incydentów (`admin-health-incident-history`)
prowadzi do `/admin/health/overview`, trasa która nie istnieje w produkcie.

### 18. [P1] `SettingsCard`/`SettingsToggle` — tekst znika w ciemnym motywie

`src/components/AISettings/SettingsCard.tsx:74` ma `text-navy-900` bez
wariantu `dark:`, więc nagłówki kart są niewidoczne w ciemnym motywie.
`SettingsToggle.tsx:56` ma ten sam problem dla WSZYSTKICH etykiet
przełączników. Oba komponenty są WSPÓŁDZIELONE poza domeną AI (zaobserwowane
przy pomiarze `admin-ai-ai-limits-budgets` i `admin-ai-data-privacy`), więc
promień rażenia defektu jest szerszy niż panel Sterowania AI, w którym
został znaleziony — wymaga sprawdzenia wszystkich konsumentów tych dwóch
komponentów.

### 19. [P2] `c-accent-soft` — crimson pod nazwą tokenu

`src/index.css:70,295` definiuje `c-accent-soft` jako crimson w zapisie
`rgba(...)` — czyli formalnie „token", ale realnie ten sam kolor, którego
kanon zakazuje poza semantyką krytyczną. Grep po `primary-*` (standardowy
sposób szukania naruszeń Pułapki nr 1) tego nie łapie, bo nazwa tokenu nie
zawiera `primary`. Używany m.in. w stanie ON `SettingsToggle` — bramki
kanonu są dziś ślepe na ten konkretny wektor obejścia.

### 20. [P2] Samowolne adnotacje `§27-exempt`

`ModelsProvidersTab.tsx:649` ma adnotację `§27-exempt` przy surowej tabeli
`<table>` z akcjami — czyli ktoś oznaczył kod jako świadomie zwolniony z
kanonu list, bez udokumentowanej decyzji właściciela w `KANON_Z_ODBIOROW.md`.
Wymaga przeglądu wszystkich wystąpień `§27-exempt` w repo osobnym dyżurem —
część może być zasadna, część może być cichym obejściem bramki.

### 21. [P2] Potrójne zagnieżdżenie nawigacji w domenie ai

`AdminAIControlCenterPanel` → `AIModule` (TabLayout po angielsku) →
`OrgAISettingsView` (własne taby) — cztery zakładki (`llm-config`,
`policy-governance`, `help-analytics`, `token-management`) osiągalne tylko
przez wewnętrzny pasek nawigacji trzeciego poziomu, bez odpowiadającego im
slotu w menu głównym. Użytkownik, który nie trafi na właściwy wewnętrzny
pasek, nie wie, że te ekrany istnieją.

### 22. [P1] `CommandCenterAttentionQueue` — `highRiskCount` zawsze 0

Rejestrowane jako REALNY BUG przy pomiarze `admin-command-attention-queue`
(runda 2026-08-31, dyżur 2): sygnał „Ryzyka wymagające przeglądu" pokazuje
zawsze 0/info. `AdminCommandCenterPanel.tsx:106` czyta `risk?.highRiskCount`
płasko, backend zwraca zagnieżdżone `summary.audit.highRiskCount` —
`adminP32.routes.ts:2942-2950,2139-2164`. Ten sam kształt defektu co
zgłoszenie #9 (rozjazd kształtu odpowiedzi między frontendem a backendem).

### 23. [P2] `CommandCenterDlpTab.tsx:244` — kolizja koloru wagi

Waga „Wysoka" i waga „Krytyczna" dostają ten sam kolor `text-c-danger` —
dwa różne poziomy ryzyka są dziś nieodróżnialne kolorem na ekranie
`admin-command-dlp`. Wymaga rozdzielenia semantyki kolorów (np. `c-warning`
dla „Wysoka", `c-danger` zarezerwowane dla „Krytyczna").
