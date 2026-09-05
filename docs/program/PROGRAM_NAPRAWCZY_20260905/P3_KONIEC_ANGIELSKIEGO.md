# P3 — Koniec angielskiego

Data: 2026-09-05. Gałąź: `codex/m03-admin-20260824`, HEAD w chwili audytu weryfikacyjnego
`cc02477c4e`. Źródło zlecenia: `docs/program/AUDYT_AWARD_20260905/{A,B,C,D}*.md` (audyt
„award-winning CES 2027", pomiar 2026-09-05 na żywym stagingu). Wszystkie lokalizacje
plik:linia w tym dokumencie zweryfikowane osobno przez `rg`/`sed` na HEAD gałęzi m03
w trakcie pisania tej paczki — nie przepisane bez sprawdzenia z audytu źródłowego.

---

## 1. Cel dla użytkownika

Piotr otwiera dowolny z 16 modułów Consultify i nie widzi ani jednego angielskiego słowa,
surowego kodu enum (`DRAFT`, `MISSING_PLAN`) ani hybrydy językowej (`Resultaty`) — cały
interfejs, włącznie z nagłówkami, chipami, statusami, przyciskami i podpowiedziami
Teresy, jest po polsku.

## 2. Zakres

Audyt źródłowy szacuje **~30 ekranów** dotkniętych (patrz `D_SYNTEZA_I_PLAN.md:52`). Ta
paczka rozbija to na **15 zweryfikowanych ognisk źródłowych** (jedno ognisko = jeden plik/
wzorzec, zwykle zasila kilka ekranów naraz):

| # | Ognisko | Moduł(y) dotknięte | Ekrany (dowód) | Plik:linia (zweryfikowane `rg`) |
| - | --- | --- | --- | --- |
| 1 | `InitiativeFullView.tsx` — cały archetyp pełnej karty, zero `t()` na 1303 liniach poza 5 wywołaniami | Inicjatywy, Moja Praca (kalendarz→karta) | `inicjatywy-09-karta-pelna.png`, `moja-praca/18-kalendarz-preview.png` | `src/components/Initiatives/InitiativeFullView.tsx:438,503,860,964,1003,1013,1056,1218,1240,1258` i dalej (import `useTranslation` w linii 50, `t` użyte tylko 5×, cała reszta to literały) |
| 2 | `canonicalMenu3Definitions` — cały rząd chipów Menu 3 zakładek Plan/Obciążenie, obiekt bez `t()` | Inicjatywy (Plan, Obciążenie) | `inicjatywy-05-plan-tab.png`, `inicjatywy-06-obciazenie-tab.png` | `src/components/Initiatives/InitiativesHub.tsx:2356-2367` (9 etykiet Plan + 9 etykiet Obciążenie) |
| 3 | `STATUS_METADATA` + `TRANSITIONS` — słownik statusów/akcji cyklu życia inicjatywy, źródło dla Kanban/Grid/List/FullView | Inicjatywy (Kanban, Siatka, Tabela) | `inicjatywy-02b-kanban-retry.png`, `inicjatywy-03c-siatka-retry.png` | `src/services/initiativeLifecycle.ts:157,164,171,178,185,192,199,206,213,220,227,234,241` (14 statusów) + `:461,470,479,488,497,506,527,536,545,554,565,574,584` (13 akcji) |
| 4 | Pusta kolumna Kanban „Drop initiatives here” | Inicjatywy (Kanban) | `inicjatywy-02b-kanban-retry.png` | `src/components/Portfolio/PortfolioKanbanView.tsx:340` |
| 5 | Diakrytyki zdarte z chipów priorytetów w Kreatorze („Marza”, „Jakosc”, „Terminowosc”) | Inicjatywy (Wizard) | `inicjatywy-08-wizard.png` | `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx:604-606` |
| 6 | Pasek narzędzi „Wycena przedsiębiorstw” — 22 nazwy narzędzi w jednym obiekcie | Finanse (flagowy ekran) | `finanse/07-wycena-detal.png`, `10-wycena-1280.png`, `11-wycena-1920.png` | `src/components/Economics/FinanceValuePanelsSurface.tsx:80-100` |
| 7 | Breadcrumb Menu 1 „Audits”/„Organization” — literalna tablica fallback w routingu | Audyty (7 zakładek), Organizacja | `audyty/01-lista.png`, `03-raporty-drd.png`, `organizacja/01-profile.png` | `src/routes/AppRoutes.tsx:1709,1733,1755,1779` (Audits) i `:3540` (Organization) |
| 8 | `trust.badge.sources` — klucz i18n używany, ale nie istnieje w PL ani EN | Czat | `czat/04-konwersacja-tresc.png` | `src/components/AIChat/TrustBadge.tsx:384`; klucze `trust.badge.sources`/`trust.badge.noSources` potwierdzone jako `<<MISSING>>` w obu `public/locales/{pl,en}/translation.json` |
| 9 | Domyślny tytuł konwersacji „New conversation” zapisywany w bazie po angielsku | Czat | `czat/02-historia-menu.png` | `server/migrations/073_conversations.sql:17` (`DEFAULT 'New conversation'`), `server/src/routes/conversations.routes.ts:458,1675,1698,2752`, porównanie literalne w `src/components/AIChat/ConversationItem.tsx:126-129` (klucz docelowy `aiChat.newConversation` już użyty poprawnie w `src/components/AIChat/MoveToProjectModal.tsx:232`) |
| 10 | Blok sugestii AI dla spotkania generowany po angielsku po stronie serwera | Spotkania | `spotkania/02-obiekt.png` | `server/src/services/aiOperatorService.ts:673,675,695` |
| 11 | Chipy sugestii Teresy w Skrzynce Moja Praca | Moja Praca | `moja-praca/01-skrzynka-lista.png` | `src/components/MyWork/MyWorkHub.tsx:343,352-354` |
| 12 | Raw fallback roli „Product” obok polskiego „Dział: Produkt” — brakujący klucz `settings.profile.roles.*` | Ustawienia (Profil) | `ustawienia/…profil…` (patrz `C_finanse_…md:293`) | `src/components/settings/ProfileSettings.tsx:603` — klucz `settings.profile.roles.product` (i `sales`/`operations`/`finance`/`partner`/`consultant`) potwierdzony `<<MISSING>>` w PL i EN; osobno `settings.profile.departmentOptions.product` JEST poprawnie przetłumaczony na „Produkt” (to inny klucz, inne pole — źródło rozjazdu) |
| 13 | Format pliku „Unknown” renderowany surowo zamiast fallbacku „—”/i18n | Materiały | `materialy/04c-arkusze.png` | `src/components/ReportsAndPresentations/materialFileFormat.ts:1,87`, `useRapData.ts:526`, `ReportsTabContent.tsx:85,92,150`, `types.ts:414` (`labelPl: 'Nieznany'` istnieje w słowniku statusów, ale ścieżka renderowania w `ReportsTabContent.tsx:150` czyta surowe `fileFormat`, nie ten słownik) |
| 14 | Wzorzec `isPolish ? 'X' : 'X'` — gałęzie identyczne, i18n pozorny (angielskie słowo pod maską warunku PL/EN) | Wyniki (OKR/ROI), Import, Notatnik, Whiteboard i inne — 37 plików | brak osobnych zrzutów — wykryte statycznie | `rg --pcre2 "isPolish \? '([^']+)' : '\1'" src server` → **70 wystąpień w 37 plikach** (pełna lista w kroku wykonania 6) |
| 15 | Legenda osi czasu miesza języki w jednym wierszu („Ready / In Progress / Blocked / Done” obok „Ścieżka krytyczna”, „Dziś”) | Inicjatywy (Oś czasu) | `inicjatywy-04b-timeline-retry.png` | nie zidentyfikowano precyzyjnie w tej sesji — do zlokalizowania w kroku 1 (prawdopodobnie komponent legendy w `src/components/Initiatives/` renderujący `PlanScenarioSurface`/oś czasu) |

Dodatkowo, poza tabelą — cross-cutting sygnały wielkości długu (nie osobne ekrany, tylko
metryka do §6):

- **Kanban/Siatka „HIGH”/„MEDIUM” priorytet bez tłumaczenia** — pochodzi z tego samego
  `STATUS_METADATA`-podobnego wzorca w kodzie priorytetów (do potwierdzenia w kroku 1,
  prawdopodobnie sąsiaduje z `initiativeLifecycle.ts`).
- **„2/2/2 MONTH” — jednostka nieprzetłumaczona** w tabeli Obciążenia: opcja `<option
  value="MONTH">` w `src/components/Initiatives/PlanScenarioSurface.tsx:925,1340` ma
  poprawny klucz `t('initiatives.planScenario.form.monthOption')` w formularzu, ale
  **wartość wyświetlana w tabeli** (nie w formularzu) czyta surowe `windowUnit` (`:341`) —
  dwa różne miejsca renderowania tej samej jednostki, tylko jedno przetłumaczone.
- **Angielskie „Loading...” przy zimnym starcie Realizacji** (`exec-wait8s.png`) —
  potwierdzony poprawny wzorzec `t('execution.timeline.deps.loading', 'Loading...')` w
  `src/components/Execution/ExecutionTimelineView.tsx:1336`, ale to NIE jest ekran z
  dowodu (lista Realizacji, nie oś czasu zależności) — źródło literalnego „Loading...”
  na liście nie zidentyfikowane w tej sesji, do zlokalizowania w kroku 1.
- **Role „Execution Manager”/„Controls Engineer”** w danych demo Sterowania —
  `src/components/Execution/executionLocalReviewData.ts:35-36` — to słownik display-name
  dla ID demo-osób, częściowo angielski; „Intervention Authority” z audytu NIE znaleziony
  literalnym `rg` w `src/`/`server/src/` — prawdopodobnie generowany gdzie indziej
  (seed bazy lub label roli w warstwie serwera execution) — do zlokalizowania w kroku 1.

## 3. Przyczyna źródłowa

Nie ma jednej przyczyny — audyt trafnie nazywa to „archetypami”, nie pojedynczymi
literówkami. Cztery odrębne wzorce źródłowe, każdy wymaga innej naprawy:

1. **Cały komponent budowany bez i18n od początku** (ognisko 1: `InitiativeFullView.tsx`).
   Import `useTranslation` istnieje (linia 50), `t()` użyte 5×, ale >150 literałów JSX
   angielskich obok. To nie jest „zapomniany klucz” — to komponent, którego autor pisał
   po angielsku i nigdy nie wrócił z przejściem i18n. Wchodzi z dwóch niezależnych tras:
   `/initiatives` (Otwórz z pełnej karty) i kalendarz w Mojej Pracy (kliknięcie wydarzenia
   typu Inicjatywa) — czyli jeden plik, dwa wejścia, oba po angielsku.
2. **Słownik wartości enum trzymany jako zwykły obiekt JS z angielskimi `label:`**
   (ogniska 2, 3, 6). `canonicalMenu3Definitions`, `STATUS_METADATA`, `TRANSITIONS`,
   `FinanceValuePanelsSurface` toolbar map — każdy to `Record<string, {label: string}>`
   albo tablica par `[id, label]`, gdzie `label` to gotowy angielski string wyświetlany
   wprost, bez przejścia przez `t()`. Te słowniki są SSOT dla wielu widoków naraz (Kanban +
   Siatka + Tabela + FullView czytają ten sam `STATUS_METADATA`), więc naprawa w jednym
   miejscu naprawia od razu 3-4 ekrany.
3. **Literalna tablica fallback w konfiguracji tras** (ognisko 7): `MainLayout
   breadcrumbs={breadcrumbs || ['Audits']}` — gdy górny komponent nie przekaże własnego
   `breadcrumbs` (co jest normą na 4 z 7 zakładek Audytów), pada literalny angielski
   string wpisany wprost w `AppRoutes.tsx`. To nie błąd tłumaczenia — to brak jakiegokolwiek
   wywołania i18n w tym konkretnym miejscu.
4. **Serwer generuje treść po angielsku niezależnie od locale użytkownika** (ogniska 9, 10).
   `DEFAULT 'New conversation'` w migracji SQL i szablony tekstu w
   `aiOperatorService.ts` (`Focus the meeting on…`) to dane/treść tworzone **przy zapisie**,
   nie przy renderowaniu — frontowy `t()` nie ma szansy tego naprawić, bo string trafia do
   bazy/odpowiedzi API już złożony po angielsku.
5. **Brakujący klucz i18n z sensownym fallbackiem, który maskuje problem** (ogniska 8, 12).
   `t('trust.badge.sources', '{{count}} sources')` i `t('settings.profile.roles.product',
   currentUser.role)` — kod technicznie "używa i18n", ale klucz nigdy nie został dodany do
   `public/locales/{pl,en}/translation.json`, więc zawsze renderuje się fallback (który w
   drugim przypadku jest surową wartością z bazy, nie stringiem). Bramka `check-global.mjs`
   (patrz §6) łapie **3023 takie przypadki** w całym `src/` (klucze użyte w kodzie, których
   nie ma w żadnym locale) — te dwa są tylko udokumentowanymi przykładami klasy problemu.
6. **Pozorne i18n przez identyczne gałęzie `isPolish ? 'X' : 'X'`** (ognisko 14) — ktoś
   napisał wzorzec i18n (warunek na `isPolish`), ale wpisał tę samą angielską wartość po
   obu stronach dwukropka. Wygląda na przetłumaczone w code review, jest angielskie w
   produkcie. **70 wystąpień w 37 plikach**, zweryfikowane `rg --pcre2` na HEAD.

## 4. Projekt rozwiązania

**Jedna decyzja architektoniczna: żaden słownik wartości domenowych (status, priorytet,
rola, nazwa narzędzia, etykieta filtra) nie mieszka jako goły literał w komponencie ani w
`services/*.ts` — każdy trzyma WYŁĄCZNIE klucz i18n, wartość idzie przez `t()` z obu
plików `public/locales/{pl,en}/translation.json`.**

Co się zmienia w komponentach wspólnych:

- **Nowe przestrzenie nazw słownikowe** w `translation.json` (pl+en), jedna na rodzinę
  wartości, nie per-ekran:
  - `initiatives.status.*` (14 kluczy, zasila `initiativeLifecycle.ts` STATUS_METADATA)
  - `initiatives.transition.*` (13 kluczy, zasila TRANSITIONS)
  - `initiatives.menu3.plan.*` / `initiatives.menu3.capacity.*` (18 kluczy razem,
    zasila `canonicalMenu3Definitions`)
  - `finance.valuation.tool.*` (22 klucze, zasila `FinanceValuePanelsSurface`)
  - `settings.profile.roles.*` (dopełnić brakujące: product/sales/operations/finance/
    partner/consultant — admin już istnieje)
  - `layout.breadcrumb.module.*` (jedna wspólna mapa nazwa-modułu → klucz, zamiast
    literalnych tablic `['Audits']`/`['Organization']` rozrzuconych po `AppRoutes.tsx`)
- **`src/services/initiativeLifecycle.ts`**: `STATUS_METADATA`/`TRANSITIONS` przestają
  trzymać gotowy `label: string` — trzymają `labelKey: string` (klucz i18n), konsumenci
  (`PortfolioKanbanView`, `PortfolioGridView`, `PortfolioListView`, `InitiativeGridCard`,
  `InitiativeFullView`) wołają `t(meta.labelKey)` w miejscu renderowania. Jeden plik,
  cztery ekrany naprawione naraz.
- **`AppRoutes.tsx`**: fallback breadcrumbs (`:1709,1733,1755,1779,3540` i podobne, do
  domiary w kroku 1) zamienione na `t('layout.breadcrumb.module.audits')` itd. — zero
  literałów w JSX tras.
- **DB-default strategy** (ognisko 9): migracja zmienia `DEFAULT 'New conversation'` na
  `DEFAULT ''` (pusty tytuł), warstwa API (`conversations.routes.ts`) przestaje wstawiać
  angielski string przy tworzeniu rekordu; UI renderuje pusty tytuł jako
  `t('aiChat.newConversation', 'Nowa rozmowa')` — wzorzec **już istnieje i działa**
  poprawnie w `MoveToProjectModal.tsx:232`, tylko trzeba go rozszerzyć na
  `ConversationItem.tsx` i historię (`ChatHistorySidebar`/listing). Istniejące wiersze z
  literalnym `'New conversation'` w bazie NIE są migrowane wstecz automatycznie (patrz
  Ryzyka) — front i tak renderuje pusty tytuł jako `t()`, więc stare rekordy naprawiają
  się przy pierwszym odczycie (porównanie stringa `=== 'New conversation'` traktowane
  jak pusty tytuł, tak jak już robi `ConversationItem.tsx:126-129`).
- **Serwerowy generator treści spotkań** (ognisko 10, `aiOperatorService.ts`): najmniej
  ryzykowna naprawa to przenieść treść `agendaGaps`/`prepSummary` z gotowych zdań na
  klucze i18n renderowane po stronie klienta z parametrami (`{{topic}}` zamiast
  wstawiania stringa na serwerze) — serwer zwraca strukturę (brak pre-read: bool, temat:
  string), front składa zdanie przez `t()`. Zmiana kontraktu API — patrz Ryzyka.
- **Zakaz**: żaden nowy Kanban/Grid/Tabela poza `StandardTable`/`FilterableTable` już
  istniejącym; zero nowych własnych tabel (kanon `CLAUDE.md` §9). Zero `primary-*` (nie
  dotyczy i18n, ale pilnowane przy okazji dotykania tych plików).

## 5. Kroki wykonania

Kolejność wymuszona zależnościami: najpierw SSOT słowniki (bo 4 ekrany na raz), potem
pojedyncze archetypy, na końcu serwer (bo zmiana kontraktu wymaga koordynacji z klientem).

1. **[S] Dopisać brakujące klucze i18n do obu plików locale** — `trust.badge.sources`,
   `trust.badge.noSources`, `settings.profile.roles.{product,sales,operations,finance,
   partner,consultant}`, `aiChat.newConversation` (sprawdzić czy już jest — TAK, istnieje,
   tylko nieużywany w `ConversationItem.tsx`). Pliki: `public/locales/pl/translation.json`,
   `public/locales/en/translation.json`. Zero zależności, można równolegle z krokiem 2.
2. **[M] `src/services/initiativeLifecycle.ts`** — zamienić `label:` na `labelKey:` w
   `STATUS_METADATA` (14) i `TRANSITIONS` (13), dodać klucze `initiatives.status.*` /
   `initiatives.transition.*` do locale. Zależy od kroku 1 (wzorzec kluczy).
3. **[M] Konsumenci `STATUS_METADATA`/`TRANSITIONS`** — `PortfolioKanbanView.tsx`,
   `PortfolioGridView.tsx`, `PortfolioListView.tsx`, `InitiativeGridCard.tsx` — zamienić
   `meta.label` na `t(meta.labelKey)`. Naprawia Kanban+Siatka+Tabela naraz. **[ODMROZENIE
   05_INITIATIVES DEC-<nr>]** wymagany w commicie (moduł zamrożony 05.09, patrz §5 niżej
   „Moduły zamrożone”). Zależy od kroku 2.
4. **[S] `PortfolioKanbanView.tsx:340`** — „Drop initiatives here” → `t('initiatives.
   kanban.emptyColumn')`. Ten sam plik co krok 3, robić razem (jeden PR, jeden odmrożony
   commit). **[ODMROZENIE 05_INITIATIVES DEC-<nr>]**.
5. **[M] `InitiativesHub.tsx:2356-2367`** — `canonicalMenu3Definitions` na `t()` z 18
   nowymi kluczami `initiatives.menu3.{plan,capacity}.*`. **[ODMROZENIE 05_INITIATIVES
   DEC-<nr>]**. Niezależny od kroków 2-4, może iść równolegle.
6. **[L] `InitiativeFullView.tsx` — pełny sweep** — >150 literałów, plik ma już
   `useTranslation` zaimportowany. Praca mechaniczna: każdy literał JSX → `t('initiatives.
   fullView.<sekcja>.<pole>', 'oryginalny_string_jako_fallback_EN')` + dopisanie tej samej
   ścieżki do PL z tłumaczeniem. **NIE zgadywać kluczy** — trzymać się jednej konwencji
   nazewniczej per sekcja (tabs: overview/tasks/definition/economics/team/history — już
   widoczne w kodzie jako `activeTab === 'tasks'` itd., użyć tych nazw w kluczach).
   **[ODMROZENIE 05_INITIATIVES DEC-<nr>]**. Zależy od kroku 1 (styl kluczy ustalony tam).
   Największy pojedynczy krok w paczce — kandydat na osobnego robotnika Sonnet z jasną
   instrukcją "1 literał = 1 klucz, zero zgadywania treści".
7. **[S] `InitiativeWizardModal.tsx:604-606`** — poprawić diakrytyki w trzech stringach
   (`Marza`→`Marża`, `Jakosc`→`Jakość`, `Terminowosc`→`Terminowość`) — to literalny
   twardy tekst, nie i18n, ale defekt tej samej rodziny (polski wygląda na angielski/łamany).
   **[ODMROZENIE 05_INITIATIVES DEC-<nr>]**.
8. **[M] `FinanceValuePanelsSurface.tsx:80-100`** — 22 etykiety toolbar Wyceny →
   `finance.valuation.tool.*`. Moduł Finanse **NIE jest zamrożony** (nie ma wpisu
   `10_FINANCE` w `MVP_FINAL_ZAMROZONE.json`) — commit bez markera odmrożenia. Niezależny
   od wszystkich powyższych, można równolegle.
9. **[M] `AppRoutes.tsx` — breadcrumb fallback** — zlokalizować WSZYSTKIE literalne
   tablice `[<angielskie_słowo>]` (potwierdzone: `:1709,1733,1755,1779` Audits, `:3540`
   Organization; audyt sugeruje że wzorzec może się powtarzać dla innych modułów — pełny
   `rg "breadcrumbs \|\| \['[A-Z]"` przed startem kroku), zamienić na
   `t('layout.breadcrumb.module.*')`. `AppRoutes.tsx` sam nie jest w żadnym rejestrze
   zamrożonych plików (sprawdzić per-moduł czy dotknięte trasy należą do zamrożonych
   modułów Audyty/Organizacja — TAK, oba zamrożone, więc **[ODMROZENIE 12_AUDITS
   DEC-<nr>]** i **[ODMROZENIE 01_ORGANIZATION DEC-<nr>]** w osobnych commitach, bo to
   dwa różne moduły w jednym pliku).
10. **[S] Materiały — format „Unknown”** — `ReportsTabContent.tsx:150` czytać przez
    `MATERIAL_FILE_FORMAT_META[format]?.labelPl` (wzorzec już istnieje w `types.ts:414`
    dla innego słownika statusów) zamiast surowego `fileFormat`. **[ODMROZENIE
    11_MATERIALS DEC-<nr>]**.
11. **[M] Serwer — tytuł konwersacji** — migracja `DEFAULT ''` zamiast `'New
    conversation'`, `conversations.routes.ts:458,1675,1698` przestają wstawiać angielski
    string, front (`ConversationItem.tsx`, `ChatHistorySidebar`) renderuje pusty tytuł
    jako `t('aiChat.newConversation')`. **[ODMROZENIE 13_CHAT DEC-<nr>]**. Zależy od
    kroku 1 (klucz już dopisany). Wymaga koordynacji backend+frontend w jednym PR (kontrakt
    API się nie zmienia, zmienia się tylko domyślna wartość zapisu).
12. **[L] Serwer — `aiOperatorService.ts:673,675,695`** — przenieść generowanie zdań o
    spotkaniu z gotowego stringa na strukturę + klucze i18n renderowane po stronie
    klienta. **Najbardziej ryzykowny krok** — zmienia kontrakt odpowiedzi API dla bloku
    sugestii AI spotkania. **[ODMROZENIE 08_MEETINGS DEC-<nr>]**. Robić na końcu, osobnym
    PR, z własnym testem kontraktowym przed i po.
13. **[M] `MyWorkHub.tsx:343,352-354`** — 4 chipy sugestii Teresy → `myWork.teresa.
    suggestion.*`. **[ODMROZENIE 07_MY_WORK_AGENT DEC-<nr>]**.
14. **[L] Sweep `isPolish ? 'X' : 'X'`** — 70 wystąpień / 37 plików (pełna lista:
    `rg --pcre2 -l "isPolish \? '([^']+)' : '\1'" src server`). Część to poprawne
    internacjonalizmy (np. „Status”, „Program”, „Import” — patrz whitelist w
    `scripts/dev/i18n-pl-audyt.mjs:18-50`, tam już jest lista ~70 słów uznanych za
    poprawne po polsku) — **NIE zamieniać automatycznie, przejść plik po pliku**, bo
    część `isPolish ? 'X' : 'X'` to świadomie poprawne słowa (np. `'Status'`), a część to
    zapomniane tłumaczenia (`'Program'` w `OkrProgramsPage.tsx:236` obok poprawnie
    przetłumaczonych sąsiadów `'Wyniki'`/`'OKR'` w tej samej linii — podejrzane, do
    ręcznej weryfikacji). Moduły dotknięte: Wyniki/OKR (`ResultsVNext/okr/*` — **nie
    zamrożony**), Import (`UnifiedImportWizard.tsx` — sprawdzić moduł), Notatnik/
    Whiteboard (`MyWork/*` — **[ODMROZENIE 07_MY_WORK_AGENT DEC-<nr>]**). Podzielić na
    pod-kroki per moduł, nie jeden wielki PR.
15. **[S] Legenda osi czasu Inicjatyw** (ognisko 15) i **role Sterowania „Intervention
    Authority”** — najpierw zlokalizować plik (nie znaleziony w tej sesji literalnym
    `rg`), potem naprawić tym samym wzorcem `t()`. **[ODMROZENIE 05_INITIATIVES DEC-<nr>]**
    / **[ODMROZENIE 06_EXECUTION DEC-<nr>]** odpowiednio.

**Moduły ZAMROŻONE dotknięte tą paczką** (z `docs/program/MVP_FINAL_ZAMROZONE.json`,
zamrożone 2026-09-05 — zweryfikowane programowo przez dopasowanie ścieżek plików do
rejestru): `05_INITIATIVES`, `13_CHAT`, `07_MY_WORK_AGENT`, `12_AUDITS`, `01_ORGANIZATION`,
`11_MATERIALS`, `08_MEETINGS`, `06_EXECUTION`. **NIE zamrożone**: Finanse
(`FinanceValuePanelsSurface.tsx`), Wyniki (`ResultsVNext/okr/*`) — te dwa kroki (8, część
14) idą bez markera odmrożenia. Numer `DEC-<nr>` do potwierdzenia z Piotrem przed każdym
commitem dotykającym zamrożony plik — wzorzec z `MVP_FINAL_PROCEDURA.md:54`:
`[ODMROZENIE 13_CHAT DEC-318]` (przykład istniejący w dokumentacji procedury, NIE
potwierdzony jako numer właściwy dla tej konkretnej paczki).

## 6. Testy

**Jednostkowe** — rozszerzyć istniejący `tests/unit/angielskieResztkiPL.test.ts` (dziś: 2
testy, tylko dla dwóch wcześniej naprawionych rodzin kluczy Monte Carlo/`kimi.*` — **nie
jest ogólną bramką**, `npx vitest run` na HEAD potwierdza 2/2 PASS, zero pokrycia nowych
ognisk). Dowód mutacyjny wymagany dla każdego nowego assertu: cofnięcie klucza na
angielski fallback musi failować test.

Dodać do tego samego pliku (lub nowego `tests/unit/i18n/koniecAngielskiego.test.ts`):
- assert że `initiativeLifecycle.ts` STATUS_METADATA/TRANSITIONS mają `labelKey`
  rozwiązywalny w PL i EN (14+13 kluczy),
- assert że `canonicalMenu3Definitions`-owe klucze (18) istnieją w PL,
- assert że 22 klucze `finance.valuation.tool.*` istnieją w PL,
- assert że `trust.badge.sources`/`noSources` i `settings.profile.roles.*` (6 brakujących)
  istnieją w PL i EN.

**Bramka CI ogólna (rozszerzenie, nie nowy mechanizm)** — `scripts/i18n-sweep/
check-global.mjs` już istnieje i mierzy dokładnie tę klasę długu: **27531 kluczy
`t()` użytych w `src/`, z czego 3023 „bare-missing” (nie ma ani w PL ani w EN) i 1
„PL-debt” (jest w EN, brak w PL)** — zmierzone uruchomieniem na HEAD w trakcie audytu.
Dziś skrypt tylko drukuje i zapisuje `scripts/i18n-sweep/_bare_missing.json`/`_pl_debt.
json` — **nie jest wpięty w CI jako bramka blokująca**. Naprawa (d): wpiąć
`check-global.mjs` do CI z progiem `bareMissing.length === 0` dla nowo dotykanych plików
w PR (nie dla całego repo naraz — 3023 to dług zastany, blokowanie całości zamroziłoby
wszystkie PR-y). Wariant praktyczny: hook porównujący listę bare-missing PRZED i PO
zmianach w PR — nowy PR nie może DODAĆ pozycji do listy (regresja=blokada), ale nie musi
naprawić zastałych 3023 od razu.

Osobno, dla wzorca `isPolish ? 'X' : 'X'` (70/37) — nowa bramka statyczna:
`rg --pcre2 -c "isPolish \? '([^']+)' : '\1'" src server` z whitelistą (lista poprawnych
internacjonalizmów z `scripts/dev/i18n-pl-audyt.mjs:18-50` jako punkt startowy) — licznik
nowych (nie-whitelistowanych) wystąpień musi być 0 w diffie PR.

**Wizualne** — zrzuty 1280/1440/1920, jasny+ciemny, per ognisko z tej paczki: Inicjatywy
(Tabela/Kanban/Siatka/Plan/Obciążenie/pełna karta), Finanse (Wycena), Audyty (dowolna
zakładka), Organizacja (profil), Czat (historia+konwersacja), Spotkania (podgląd),
Ustawienia (profil). Zgodnie z `CLAUDE.md` — Piotr NIE jest pierwszym testerem: harness
bez logowania, mock-dane, zrzut ZANIM Piotr zobaczy.

**Przepływ klikany (Playwright, szkic kroków)**:
1. Zaloguj się (auth state), otwórz `/initiatives?tab=list` → sprawdź brak angielskich
   tokenów ze stop-listy w treści strony.
2. Przełącz na `?tab=kanban` → sprawdź nagłówki kolumn i pustą kolumnę.
3. Przełącz na `?tab=plan` i `?tab=capacity` → sprawdź rząd chipów Menu 3.
4. Otwórz pełną kartę inicjatywy (`?mode=doc&open=<id>`) → sprawdź WSZYSTKIE 6 zakładek
   (Overview/Tasks/Definition/Economics/Team/History).
5. Otwórz `/economics/valuations` → rekord → sprawdź pasek narzędzi.
6. Przejdź przez 7 zakładek `/audit-programs` → sprawdź breadcrumb na każdej.
7. Otwórz `/organization/profile` → sprawdź nagłówek Menu 1.
8. Otwórz `/chat` → historia → nowa konwersacja → sprawdź tytuł domyślny.
9. Otwórz `/meetings/:id` → sprawdź blok sugestii AI.
10. Otwórz `/settings/profile` dla użytkownika z rolą inną niż admin → sprawdź plakietkę
    roli.

## 7. Kryterium odbioru właściciela

Piotr przechodzi przez 16 modułów tym samym harnessem co audyt źródłowy (bez logowania,
mock-dane) i na żadnym z ~30 wskazanych ekranów nie widzi angielskiego słowa, surowego
enuma ani hybrydy językowej ze stop-listy audytu (`Initiatives/Organization/Audits/
Resultaty/DRAFT/PENDING REVIEW/Search/Loading…/New conversation` i pochodne) — jednym
zdaniem: „to wygląda jak polska aplikacja, nie jak przetłumaczona w połowie”.

## 8. Ryzyka i cofanie

- **Ryzyko regresji wizualnej**: dodanie `t()` do miejsc renderujących dynamiczne stringi
  (np. `STATUS_METADATA.label` używane też do porównań logicznych gdzieś w kodzie, nie
  tylko do wyświetlania) może zepsuć porównania stringowe, jeśli jakiś inny plik robi
  `if (status.label === 'Draft')`. **Przed krokiem 2/3**: `rg "\.label ===" src` na
  plikach konsumujących `STATUS_METADATA`, żeby wykluczyć logikę opartą na treści etykiety
  zamiast na kluczu `id`/`status`.
- **Ryzyko kontraktu API** (krok 11, 12): zmiana `DEFAULT` w migracji i treści odpowiedzi
  `aiOperatorService` może złamać testy backendu, które asertują dokładny string. Sprawdzić
  `server/src/**/__tests__/**` pod kątem `'New conversation'`/`Focus the meeting` przed
  zmianą.
- **Cofanie**: każdy krok to osobny commit z markerem `[ODMROZENIE <MODUL> DEC-<nr>]`
  tam gdzie wymagany — `git revert <sha>` cofa pojedynczy krok bez wpływu na resztę
  paczki. Zgodnie z `_RUNBOOK_COFANIA.md`: dramat wizualny → flaga OFF natychmiast (jeśli
  krok jest za flagą — kroki i18n typowo NIE są za flagą, więc cofanie = `git revert`
  commita), zły deploy → Railway rollback, nuklearne → restore-commit do przodu z tagu
  `demo-safe-<data>`, NIGDY force-push.
- **Migracja bazy** (krok 11) jest addytywna (zmiana `DEFAULT`, nie zmiana istniejących
  wierszy) — zgodnie z `CLAUDE.md` „migracje sesji addytywne = bez rollbacku” bezpieczna
  do zastosowania bez specjalnej procedury cofania danych.

## 9. Nakład

| Krok | Effort | Model |
| --- | --- | --- |
| 1 (klucze locale) | S | Sonnet |
| 2-3 (initiativeLifecycle + konsumenci) | M+M | Sonnet |
| 4-5 (Kanban empty + Menu3 chips) | S+M | Sonnet |
| 6 (InitiativeFullView pełny sweep) | **L** | Sonnet (mechaniczne, ale duża objętość — dobry kandydat na dedykowanego robotnika z jasną instrukcją) |
| 7 (diakrytyki wizard) | S | Haiku/Sonnet |
| 8 (Finance toolbar 22 etykiety) | M | Sonnet |
| 9 (breadcrumb AppRoutes) | M | Sonnet |
| 10 (Materiały Unknown) | S | Sonnet |
| 11 (New conversation, backend+frontend) | M | Sonnet, **odbiór przez Opus** (dotyka kontraktu API zamrożonego modułu Czat) |
| 12 (aiOperatorService, kontrakt API) | **L** | **Opus** (najbardziej ryzykowny krok, zmiana kontraktu) |
| 13 (Teresa chips MyWork) | M | Sonnet |
| 14 (sweep isPolish 70/37) | **L** | Sonnet, podzielone na paczki per moduł, **każda paczka do ręcznej weryfikacji** (whitelist internacjonalizmów) |
| 15 (legenda osi czasu + role Sterowania) | S | Sonnet — zaczyna się od lokalizacji pliku (nie zidentyfikowany w tej sesji) |

**Sumarycznie: ~5 kroków L, ~6 kroków M, ~5 kroków S.** Zrównoleglić: kroki 1, 8, 10, 13
oraz przygotowanie kluczy dla kroku 6 mogą iść jednocześnie (różne pliki, brak
zależności). Kroki 2→3→4→5→6→7 muszą iść sekwencyjnie w obrębie modułu Inicjatywy
(współdzielą `initiativeLifecycle.ts` i wymagają jednego okna odmrożenia
`05_INITIATIVES`, żeby nie mnożyć osobnych DEC-numerów). Krok 12 (serwer, kontrakt API)
na końcu, osobno, z Opus.

Całościowy szacunek zgodny z oceną audytu źródłowego (`D_SYNTEZA_I_PLAN.md:52`): **effort
L, impact H** dla całej paczki P3.
