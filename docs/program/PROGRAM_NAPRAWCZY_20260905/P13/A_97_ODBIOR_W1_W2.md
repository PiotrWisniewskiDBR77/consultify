# P13-A — ODBIÓR TRÓJWARSTWOWY (warstwa 1 kod + warstwa 2 runtime)

Data: 2026-09-10 · Odbierający: robotnik A1 (Opus) · Zlecenie: nadzorca (CTO)
Dostawa: `codex/p13a-karty-n` = `6acbf68cfb` (18 commitów ponad `29992c920b`)
Linia integracyjna (baza odbioru): `0416c9ba55` · gałąź odbioru: `mvp/a1-karty-n-20260910`
Powód odbioru w tym trybie: Codex zameldował runtime **BLOCKED — awaria stanowiska**
(`A_98_RAPORT.md`), więc warstwa 2 nie została u niego wykonana ANI RAZ.

---

## 0. KROK 0 — scalenie dostawy na linię

`git merge --no-ff --no-commit codex/p13a-karty-n` — **scalenie wykonalne**, 2 konflikty
(mimo 714 commitów linii ponad bazą Codexa). `public/locales/{pl,en}/translation.json`
**nie konfliktował** (Codex go nie dotknął).

| plik | konflikt | decyzja |
|---|---|---|
| `src/components/MyWork/NotificationDetailView.tsx:101-106` | import: linia miała `NOTIFICATION_CARD_RENDER_IDS` + `formatListDateTime`, Codex `NOTIFICATION_CARDS` | **suma**: `NOTIFICATION_CARDS` (Codex — jego plik kart) + `formatListDateTime` (linia — dalej używany w L932). `NOTIFICATION_CARD_RENDER_IDS` porzucony świadomie: jedyny konsument (dev-only `console.warn` o rozjeździe id, HEAD L2266-2279) był bramkowany flagą, którą Codex usunął |
| `src/services/cardAnalysis/cardAnalysisRubric.ts:109-179` | linia dopisała 21 typów na `STRUCTURAL_COMPLETENESS` + `action: []`; Codex dopisał pełne rubryki `action`/`idea`/`interview_template` | **suma**: zachowane 21 wpisów linii, usunięty duplikat `action: []`, przyjęte 3 rubryki Codexa |

Automatycznie scalone bez konfliktu (do świadomości nadzorcy): `InsightViewer.tsx` (−262 l.),
`InterviewWorkspace.tsx`, `InitiativeDocumentView.tsx`, `TaskDetailView.tsx`,
`DecisionDetailView.tsx`, `registry.ts`, `AppRoutes.tsx`, `IdeaMapWorkspace.tsx`.

### Bramka po scaleniu (liczby, jeden bieg)

| bramka | wynik | próg |
|---|---|---|
| `tsc` serwera (3072 MB) | **0 błędów** | 0 |
| `tsc` frontu (8192 MB, jeden bieg) | **192 błędy**, z tego **0 w plikach dotkniętych/nowych P13-A** (`ActionCardPage.tsx`, `contractSections.ts`, `actionCardContract.ts` = 0) | ≤192 |
| `scripts/check-list-canon.sh` | ✓ naruszeń 36 = baseline 36 (dług nie rośnie) | brak nowych |
| `scripts/check-artefakt.sh` | ✓ crimson w powłoce 8 = baseline 8; karty N SPEC-N §5B: **R1 ostrzeżeń 2** (`InitiativeDocumentView` L2567, `TaskDetailView` L7746 — solid CTA poza slotem primary), **R2+R3 = 0 / baseline 0** | R2/R3 bez wzrostu |
| `scripts/i18n/pomiar-jezyka.mjs` | **NIE URUCHOMIONY** — wymaga własnego przebiegu przeglądarkowego po ekranach; zamiast tego język zmierzony na 18 realnych zrzutach (§3) | — |

Rozkład 192 błędów frontu: `useReportBuilder.ts` 27 · `DocumentStudioDocumentPanel.tsx` 23 ·
`ExecutionHub.tsx` 12 · `useReportSections.ts` 11 · `InitiativeDocumentView.tsx` 10 (porównania
enumów statusu w liniach, których Codex nie dotykał) · reszta ogonem. Żaden nie pochodzi z P13-A.

---

## 1. WARSTWA 1 — kod vs kontrakt K1–K30 (`docs/ssot/KARTA_N_KONTRAKT.md`)

| # | karta | K1 kontrakt | K2 kontrakt steruje | K6–K11 panel | K12 Menu 5 | K17/K18 tokeny | K21 „Pracuj z AI" | K25 i18n | uwagi (plik:linia) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Zadanie | ✓ `TASK_CARDS` | ✓ `TaskDetailView.tsx:3014` `sekcjeZKontraktu(TASK_CARDS,'task')`, flaga `useTaskCardContractEnabled` usunięta | ✓ | ✓ | ✓ zero `primary-*` | ✓ | ✓ | `spec: TASK_CARD_SPEC` na stałe (`:4759`) ⇒ **zmienia się domyślny zestaw sekcji dla WSZYSTKICH**, a raport Codexa pisze „bez zmiany zachowania" |
| 2 | Decyzja | ✓ `DECISION_CARDS` | ✓ `DecisionDetailView.tsx:1583` | ✓ | ✓ | ✓ | ✓ (K23) | ✓ | — |
| 3 | Powiadomienie | ✓ `NOTIFICATION_CARDS` | ✓ `NotificationDetailView.tsx:1372` | **✗ K7** — panel bez tabeli Właściwości (§3) | ✓ | ✓ | ✓ | ✓ | TeresaMark usunięty ✓ (DEC-434) |
| 4 | Wniosek | ✓ `INSIGHT_CARDS` | ✓ `InsightViewer.tsx:733` | ✓ | ✓ | ✓ | ✓ (K23) | ✓ | **✗ REGRESJA**: adapter gubi `cSpan` (13 deklaracji w usuniętej `INSIGHT_SECTIONS`), a `NModeCBoard.tsx:141` i `InsightViewer.tsx:7986` je czytają; `KanonicznaKarta` nie ma pola szerokości |
| 5 | Sesja wywiadu | ✓ `INTERVIEW_CARDS` | ✓ `InterviewWorkspace.tsx:3131` (wzorcowo: kontrakt daje id/label/ikonę, lokalne właściwości doklejane — jedyna karta, która NIE gubi metadanych) | ✓ | ~ | ✓ | **✗ BRAK** — `grep '<PracujZAI' InterviewWorkspace.tsx` = **0** | ✓ | K21 to jeden z dwóch wymogów, których brak = „karta nie jest gotowa" (KONTRAKT §8) |
| 6 | Inicjatywa | ✓ | ✓ `InitiativeDocumentView.tsx:5888` | ✓ | ✓ | ✓ | ✓ | ✓ | **dług czystości**: flaga podmieniona literałem `true` w miejscu — `if (!import.meta.env.DEV \|\| !true)` (`:2277`), `}, [true, leftSections, rightSections])` (`:2290`), `if (!true) return;` (`:9356`, `:9385`), `{true && (...)}` (`:11871`), `const isCore = true && ...` (`:11938`), `true` w tablicy zależności `useMemo` (`:9415`) |
| 7 | Pomysł (4 centra) | ~ (workspace, nie katalog sekcji) | n/d | ~ K7 (wiersze bez nagłówka „Właściwość \| Wartość") | ✓ | ✓ | ✓ | ✓ | ✓ DEC-442: przycisk narożny AI usunięty (`IdeaCanvasMenu1Bits.tsx:157-167`), ✓ DEC-434: `teresaContent`/`teresaCommands`/`IdeaTeresaSection` odpięte. **Dług**: `teresaPanelNode`, `teresaCommands`, `zakladkaPanelu` zostały zadeklarowane i nieużywane |
| 8 | Wzorzec wywiadu | ~ 1 sekcja `template-content` | ~ | ✓ (nowy) | ~ brak „Sekcje ▾" i „Edycja/Podgląd" | ✓ | ✓ | **✗** twarde polskie literały: `'Akcje'`, `'Zapisz wersję roboczą'`, `'Opublikuj'`, `'Roboczy'`, `'Wersja'`, `'Liczba pytań'`, `panelAriaLabel` (`TemplateBuilder.tsx`, blok po `if (!isDocumentMode) return builderContent;`) | powłoka działa TYLKO dla `presentation="document"` — jedyny taki wołacz to `InterviewHub.tsx:6014`; ścieżki `ReportBuilder/TemplatePickerModal.tsx:675` i `assessment/modals/ReportTemplatePickerModal.tsx:831` dalej mają 3 osobne przyciski AI |
| 9 | Karta działania | ✓ `actionCardContract.ts:4` (4 sekcje) | ✓ `ActionCardPage.tsx:52` | ~ (§3) | **✗** brak „Sekcje ▾" i „Edycja/Podgląd" | ✓ | ✓ | **✗** cała karta po polsku na sztywno: `isPolish: true` (`ActionCardPage.tsx:29`, `:61`), literały `'Wczytywanie karty działania…'`, `'Nie znaleziono…'`, `'Wróć do listy'`, `'Otwarta'/'Zamknięta'`, breadcrumb `'Karta działania'` (`AppRoutes.tsx:1665`) | **✗ K28**: `card.sourceKind.replaceAll('_',' ')` (`:48`) wypisuje nazwę enuma. **✗ K4**: `value()` (`:13`) zwraca `—` zamiast ukryć sekcję. **✗ ATRAPA**: `primaryAction: {intentionallyNone, reason:'Zmiana stanu karty jest dostępna w sekcji Akcje'}` (`:61`), a sekcja Akcje ma wyłącznie „Wróć do listy" (`:54`) |

### Znaleziska przekrojowe warstwy 1

**W1-A (bramka bez wołacza).** `wymagajSekcjiZKontraktu` (`src/components/standard/contractSections.ts:151`)
— **zero wołaczy produkcyjnych**; jedyne odwołania to `src/components/standard/__tests__/p13a.contract-and-ai-mutations.test.tsx`.
Raport Codexa podaje „Mutacja sekcji: dodatkowe id poza kontraktem rzuca `SEKCJE_POZA_KONTRAKTEM` — RED"
jako dowód K2; to dowód, że **funkcja pomocnicza działa**, a nie że którakolwiek karta jest nią pilnowana.

**W1-B (test, który nie może się zaczerwienić).** `p13a.contract-and-ai-mutations.test.tsx`, przypadek
„mutacja AI: bez kliknięcia Zatwierdź pozostaje RED": `const zapis = vi.fn(); expect(zapis).not.toHaveBeenCalled();`
— asercja na świeżej atrapie, niepowiązana z produktem. Nie zaczerwieni się po żadnej zmianie kodu.
(Trzeci przypadek w tym pliku — realny render `PracujZAI` z `zastosuj` — jest dobry i wystarcza za dowód K22.)

**W1-C (test po tekście źródła).** `tests/unit/cards/p13a.dec432-single-section-contract.test.ts` sprawdza
`readFileSync` + regex na braku napisów (`VITE_VF1_*`, `taskNSections`, …). To bramka anty-nawrotowa, nie
dowód, że render płynie z kontraktu. Dowodem jest dopiero warstwa 2.

**W1-D (rzut w renderze).** `sekcjeZKontraktu` robi `throw new Error('Brak ikony kontraktu…')`
(`contractSections.ts:137`), a `InsightViewer.tsx:733` woła go **na poziomie modułu**. Literówka w polu
`ikona` katalogu = wywalony cały chunk, nie brakująca ikona.

**W1-E (rejestr mówi co innego niż kod).** `registry.ts:148` — `action.komponent` dalej wskazuje
`src/components/standard/ActionCard.tsx` (kafel w skrzynce), choć kartą jest nowy `ActionCardPage.tsx`.

**W1-F (powiadomienie nie prowadzi do karty).** `actionCardService.ts:192` ustawia
`actionUrl: '/my-work/inbox?actionCardId=…'`, a nie nową trasę `/action-cards/:id`.

**W1-G (walidacja pominięta).** `POST /api/action-cards` (`actionCards.routes.ts:41`) nie waliduje
`sourceKind` mimo istniejącej stałej `ACTION_CARD_SOURCE_KINDS`; wartość spoza słownika przechodzi do
bazy i wraca jako **HTTP 500** z `action_cards_source_kind_check` zamiast 400. Zmierzone.

---

## 2. STANOWISKO WARSTWY 2 (odtworzone od zera — to, czego Codexowi zabrakło)

- baza: kontener `consultify-pg18` (54418) → `CREATE DATABASE consultify_kopia_a1 TEMPLATE consultify_staging_1009`
- konto: `audyt@dbr77.local` / `AudytDBR77!2026`, ADMIN w org DBR77 `a3e05d4a-5397-419d-b486-8e44366c0063`,
  wpis w `organization_members`, `onboarding_completed = true`
- API `:4235` (`NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false`, `DB_TYPE=postgres`, `ENABLE_V8_GLOBAL=true`,
  `DATABASE_URL` → kopia), Vite `:3255` (`VITE_API_TARGET=http://127.0.0.1:4235`)
- `/api/health` → `{"status":"ok","database":"connected","environment":"test"}`
- motyw przełączany przez **zustand** (`consultify-storage.state.theme`), nie przez `prefers-color-scheme`
- rekord pokazowy karty działania utworzony **przez kontrakt produktu** (`POST /api/action-cards`,
  `sourceKind: kpi_deviation`), id `0c61eef4-a81b-4faf-9c7e-83e63363b49b` — nie SQL-em

Trzy pułapki stanowiska, które zjadły czas i warto zapisać na przyszłość:
1. `server.env` ma wartości ze spacjami bez cudzysłowów — `source` w zsh wywala się na linii 32.
2. `databaseTargetResolver.ts:151` odrzuca `127.0.0.1` poza testami — jedyne przejście to `NODE_ENV=test`
   (+ `RUN_DB_TESTS=1 MOCK_DB=false`, żeby nie podstawiła się atrapa bazy).
3. Detale `personal-tasks`, `my-ideas` są scope'owane po właścicielu — bez przepisania rekordu na konto
   audytowe każde otwarcie kończy się 404 (nie jest to defekt produktu).

Sprawdzian rozdzielności motywów (bezpiecznik „duplikat zamiast motywu"): średnia jasność
jasny **243–250** vs ciemny **23–32** dla wszystkich 9 par. Zero par identycznych.

---

## 3. WARSTWA 2 — 9 kart na żywym runtime (zrzuty `evidence/a1-karty-n/`)

| # | karta | trasa (realny rekord) | jasny+ciemny | błędy konsoli | Menu 5 (K12) | pozycje „Pracuj z AI" (K21) | pigułka modułu (K19) | tabela Właściwości (K7) | werdykt |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Zadanie | `/my-work?taskId=5227e6c8…` | ✓ | **0** | ✓ pełne trio | ✓ `Analizuj · Uzupełnij tę sekcję · Uzupełnij cały dokument` | ✓ | ✓ 6 wierszy | **SCAL** |
| 2 | Decyzja | `/my-work?decisionId=c1c8cac3…` | ✓ | **4** (403 `object-attachments/decision/…` — zastane, poza P13-A) | ✓ | ✓ `Analizuj` + powód „Tylko do odczytu: karta otwarta w trybie Podgląd" (K23 spełnione) | ✓ | ✓ | **SCAL Z FIX-EM** |
| 3 | Powiadomienie | `/my-work?tab=inbox` → wiersz → `Otwórz` | ✓ | **0** | ✓ | ✓ 3 pozycje | ✓ | **✗ brak** — panel ma tylko `AKCJE` + `HISTORIA AKTYWNOŚCI` | **SCAL Z FIX-EM** |
| 4 | Wniosek | `/interview?tab=insights` → wiersz → `Otwórz` | ✓ | **24** (404 `/api/v8/interview/sessions/…` ×6 sesji źródłowych — dane, zastane) | ✓ | ✓ `Analizuj` (tryb Podgląd, powód w sekcji Akcje) | ✓ | ✓ 6 wierszy | **NIE SCALAJ bez FIX-u R1** |
| 5 | Sesja wywiadu | `/interview?sessionId=4d7ea778…` | ✓ | **0** | ~ `Sekcje ▾` + `Nowa karta` + `Ocena AI`/`Markdown`/`Kopiuj` | **✗ BRAK przycisku**; zamiast niego osobno nazwany `Ocena AI` | ✓ | ✓ | **SCAL Z FIX-EM** |
| 6 | Inicjatywa | `/initiatives?mode=doc&open=da588307…` | ✓ | **0** | ✓ | ✓ 3 pozycje | ✓ | ✓ 6 wierszy | **SCAL** |
| 7 | Pomysł (4 centra) | `/my-work?ideaId=b9f9ae19…` → `/workspace/process-flow` | ✓ | **0** | ✓ `Panel` + `Pracuj z AI` (narożny „AI" ZNIKNĄŁ ✓) | ✓ 3 pozycje | ✓ | ~ wiersze bez nagłówka | **SCAL** |
| 8 | Wzorzec wywiadu | `/interview?tab=templates` → wzorzec → `Otwórz` | ✓ | **0** | ~ brak „Sekcje ▾"/„Edycja\|Podgląd" | ✓ 3 pozycje | ✓ | ✓ 3 wiersze | **SCAL Z FIX-EM** |
| 9 | Karta działania | `/action-cards/0c61eef4…` | ✓ | **0** | ✗ tylko etykieta sekcji + `Pracuj z AI` | ✓ 3 pozycje | **✗ brak paska modułu** (sam breadcrumb) | ✓ 3 wiersze | **SCAL Z FIX-EM** |

Dowody: `NN-*-jasny.png` / `NN-*-ciemny.png` (widok karty) + `NN-*-ai-menu.png` (K30: rozwinięte
„Pracuj z AI") + `.json` z `url` i `bledyKonsoli` przy każdym.

### R1 — DEFEKT BLOKUJĄCY (Wniosek otwiera się z pustym centrum)

Zmierzone: po otwarciu wniosku z listy **środek karty jest pusty** — widać wyłącznie lewy spis sekcji
i prawy panel (`04-wniosek-jasny.png`, `04-wniosek-tresc-przewinieta.png`). Treść pojawia się dopiero po
ręcznym kliknięciu innej sekcji (`Podsumowanie` → treść jest, dowód w `evidence/`).

Przyczyna (plik:linia): `INSIGHT_CONTRACT_SECTIONS = sekcjeZKontraktu(INSIGHT_CARDS,'insight')`
(`InsightViewer.tsx:733`) zwraca jako **pierwszą** pozycję `ARTIFACT_ACTIONS`
(`insightCardContract.ts:109`, id `artifact-actions`, label PL „Rezultaty",
`kompozycja: [{artefakt:'insight', kolumna:'left', kolejnosc:0}]`), a `InsightViewer.tsx:1141` robi
`useState(INSIGHT_CONTRACT_SECTIONS[0].id)`. Dla `artifact-actions` nie ma komponentu centrum
⇒ białe centrum na pierwszym ekranie.

Usunięta tablica `INSIGHT_SECTIONS` tej pozycji **świadomie nie zawierała** — komentarz w kodzie cytuje
właściciela: „Nie dubluj: jeśli kafel idzie do Rezultatów, znika z centrum". Dziś „Rezultaty" stoją
jednocześnie w lewej nawigacji centrum i w prawym panelu.

### R2 — zapis z karty (sprawdzian „widoczny po reload")

Karty z zapisem: Zadanie, Decyzja, Inicjatywa, Sesja wywiadu, Wzorzec. Karta działania **nie ma żadnej
ręcznej ścieżki zapisu w UI** — jedynym writerem jest `apply()` z propozycji AI (`ActionCardPage.tsx:22`),
a generacji nie uruchamiam (STOP na kredytach LLM zgodnie ze zleceniem).

Na karcie Zadania sprawdzian **wykrył defekt ZASTANY linii** (pliki poza dostawą Codexa):
edycja opisu → `PUT /api/my-work/personal-tasks/:id` → **200**, tekst LĄDUJE w bazie, ale po odświeżeniu
karta pokazuje „Nie znaleziono zadania", bo `tasks.assignee_id` zostało **wyzerowane**.
Łańcuch: GET detalu nie zwraca `assignee_id` (`server/src/routes/my-work.routes.ts:1417-1433`) →
front wysyła puste `assigneeId` → `my-work.routes.ts:1544-1547` zapisuje NULL →
`buildPersonalTaskOwnerScope` (`:701`) scope'uje po `assignee_id`, więc rekord wypada właścicielowi.
Sprawdzian kontrolny: samo otwarcie karty (bez interakcji) **nie** zeruje przypisania — zeruje dopiero zapis.
**To nie jest defekt P13-A**, ale jest to utrata dostępu do danych i wymaga osobnego zlecenia.

---

## 4. WERDYKT

**Scalać całość na linię przed Tokio — TAK, pod warunkiem naprawy R1 przed wdrożeniem.**
Uzasadnienie: scalenie jest czyste (2 konflikty, bramki bez wzrostu długu, 0 błędów typów w plikach
dostawy), DEC-432 jest realnie wykonana dla 6 z 6 kart z katalogiem, DEC-434 i DEC-442 potwierdzone
wzrokiem, a dwie karty (Wzorzec wywiadu, Karta działania) dostały powłokę, której wcześniej nie miały.
Staging jest zamrożony na noc, więc **wdrożenie po Tokio** — R1 mieści się w tym oknie.

| werdykt | karty |
|---|---|
| **SCAL** (bez zastrzeżeń) | Zadanie, Inicjatywa, Pomysł |
| **SCAL Z FIX-EM** | Decyzja, Powiadomienie, Sesja wywiadu, Wzorzec wywiadu, Karta działania |
| **NIE SCALAJ bez FIX-u** | Wniosek (R1 — puste centrum przy otwarciu) |

### FIX-y dla Sonneta (kolejność = priorytet)

| # | waga | plik:linia | co zrobić |
|---|---|---|---|
| F1 | **blokujący** | `src/components/Interview/insightCardContract.ts:124` (kompozycja `ARTIFACT_ACTIONS`) + `src/components/Interview/InsightViewer.tsx:1141` | `kolumna: 'right'` dla członkostwa `insight` (albo filtr w widoku) — „Rezultaty" znikają z lewej kolumny; aktywną sekcją startową ustawić pierwszą sekcję, która MA komponent, nie `[0]` |
| F2 | wysoki | `src/components/Interview/InterviewWorkspace.tsx` (pasek Menu 5, ~`:3590`) | dołożyć `<PracujZAI>` (3 pozycje) i wchłonąć obecny `Ocena AI` jako pozycję `Analizuj`; DEC-433 |
| F3 | wysoki | `src/components/standard/contractSections.ts:138-144` | przenieść metadane prezentacyjne (`cSpan`, `quoteRequirementLevel`) wzorem `InterviewWorkspace.tsx:3131` (doklejanie lokalnych właściwości poza `id`/`label`/`icon`) albo dodać pole szerokości do `KanonicznaKarta` |
| F4 | wysoki | `src/components/standard/ActionCardPage.tsx:48` | `sourceKind` przez `t()` ze słownikiem etykiet — koniec z nazwą enuma w DOM (K28) |
| F5 | wysoki | `src/components/standard/ActionCardPage.tsx:54,61` | sekcja Akcje musi mieć realną akcję (Zamknij/Otwórz ponownie — `POST /api/action-cards/:id/close` już istnieje) ALBO zmienić `reason` przy `intentionallyNone`, żeby nie obiecywał nieistniejącego przycisku |
| F6 | średni | `src/components/standard/ActionCardPage.tsx` (cały) + `src/routes/AppRoutes.tsx:1665` | i18n: `isPolish` z UI zamiast `true`, literały przez `t()` z kluczami w `public/locales/{pl,en}` |
| F7 | średni | `src/components/Interview/TemplateBuilder.tsx` (blok `rightPanel`/`StandardArtifactShell`) | te same literały przez `t()`; usunąć duplikat „Opublikuj" z sekcji Akcje (primary CTA mieszka w Menu 1 — K6) |
| F8 | średni | `src/components/MyWork/NotificationDetailView.tsx` (`rightPanelSections`) | dołożyć tabelę Właściwości (K7 obowiązkowa) oraz Powiązania/Źródła/Komentarze albo jawne `pominieta: {reason}` (K10 — milczenie jest błędem) |
| F9 | średni | `src/components/Initiatives/InitiativeDocumentView.tsx:2277, 2290, 9356, 9385, 9415, 11871, 11938` | posprzątać literały `true` po usuniętej fladze (`!true`, `[true, …]` w tablicach zależności) |
| F10 | niski | `src/components/standard/contractSections.ts:151` + `__tests__/p13a.contract-and-ai-mutations.test.tsx` | albo wpiąć `wymagajSekcjiZKontraktu` w realną kartę (wtedy bramka istnieje), albo usunąć ją i test — dziś jest to biblioteka bez wołacza; usunąć tautologiczny przypadek „mutacja AI … pozostaje RED" |
| F11 | niski | `server/src/routes/actionCards.routes.ts:41` | walidacja `sourceKind` przeciw `ACTION_CARD_SOURCE_KINDS` → 400 zamiast 500 |
| F12 | niski | `src/components/standard/registry.ts:148` · `server/src/services/actionCard/actionCardService.ts:192` | `komponent` → `ActionCardPage.tsx`; `actionUrl` → `/action-cards/:id` |

### Poza zakresem P13-A (osobne zlecenia — nie mieszać z tą dostawą)

| # | plik:linia | opis |
|---|---|---|
| Z1 | `server/src/routes/my-work.routes.ts:1417-1433, 1544-1547, 701` | **utrata danych**: zapis z karty Zadania zeruje `assignee_id` i rekord znika właścicielowi (§3 R2) |
| Z2 | `/api/my-work/object-attachments/decision/:id` | 403 przy otwarciu cudzej decyzji → 4 błędy konsoli, K29 |
| Z3 | dane `interview_insights` | 6× 404 `/api/v8/interview/sessions/:id` (sesje źródłowe wniosku nie istnieją) → 24 błędy konsoli, K29 |

---

## 5. STOP-y odbioru (czego NIE zmierzyłem i dlaczego)

1. **Generacja AI** — zatrzymana na otwarciu menu „Pracuj z AI" i odczytaniu pozycji (zlecenie:
   bez kredytów LLM). Ścieżka propozycja→„Zatwierdź" (K22) potwierdzona wyłącznie testem jednostkowym
   renderującym `PracujZAI` z atrapą `zastosuj`, nie na żywym modelu.
2. **`pomiar-jezyka.mjs --baseline`** — nie uruchomiony (wymaga własnego przebiegu po ekranach);
   język oceniony z 18 zrzutów i `innerText` w `.json`.
3. **Zapis z Karty działania po reload** — niewykonalny bez LLM (karta nie ma ręcznego writera).
4. **Porównanie „przed/po" na linii bez dostawy** — nie robiłem osobnego stanowiska na `0416c9ba55`;
   przypisania regresji do P13-A opieram na diffie (`git diff HEAD..`), nie na drugim runtimie.
   R1 jest wyprowadzony wprost z usuniętej tablicy i jej komentarza — to wystarcza.
5. **Higiena danych** — cała praca na kopii `consultify_kopia_a1` (DROP po odbiorze), żywe bazy nietknięte,
   rekord karty działania powstał tylko w kopii.
