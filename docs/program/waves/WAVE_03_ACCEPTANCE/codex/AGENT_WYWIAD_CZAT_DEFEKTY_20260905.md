# Dyżur "wywiad-czat-defekty" — 05.09.2026

Worktree: `agent/wywiad-czat-defekty-20260905` (baza `m03` @ `fae624aaea7`).
Autor commitów: Piotr <piotr.wisniewski@dbr77.com> (per instrukcję dyżuru).
Push: NIE wykonano (zakaz).

Komity (kolejność chronologiczna, jeden per defekt):

| # | SHA | Commit |
|---|---|---|
| 1 | `c42178799ed1` | test(interview): dowód że interview-creator-shell jest osiągalny i renderuje się zgodnie z obrazem |
| 2 | `23fcc65b5663` | test(unified-create-launcher): dodaj testy komponentu i bezpiecznik D-01; NIE wpinam launchera (konflikt decyzji) |
| 3 | `c3d5288f85` | fix(interview): karta-interview — nie zgub sesji którą już mamy, gdy oba API 404 |
| 4 | `57eaa48659` | fix(mindmap-i18n-smoke): collapsed ToggleBlock content jest inert, nie tylko niewidoczny |
| 5 | `1848296c3b` | test(chat-split-teresa-right): zablokuj regresję ikon paska kanwy; NIE potwierdzam "globe/szablon" |

Zero commitów dla punktu (4) `drd-http-workspace` — decyzja świadoma, uzasadnienie niżej. Zero zmian w kodzie produkcyjnym dla (2) i (6) — powody niżej.

---

## (1) `interview-creator-shell` — FAŁSZYWY ALARM poprzedniego odbioru

**Zlecenie:** flaga `interviewCreatorShellFlag.ts` ma `?? true` od DEC-350 (03.09), ale poprzedni odbiór zgłosił ją jako "domyślnie OFF, niedostępna". Zmierzyć czemu i naprawić dostępność.

**Zmierzone na żywym stagingu** (`b852ade6`, port 3042, własny vite, `ODBIOR_AUTH_STATE`): flaga jest **rzeczywiście ON domyślnie**, bez żadnego override w localStorage/query z auth.json. Ekran jest osiągalny w **2 kliknięciach** z `/interview`: Wywiad → zakładka "Wnioski" → przycisk "Nowy insight". Otwarty kreator renderuje się **1:1 zgodnie** z zatwierdzonym obrazem (`evidence/grafika/195-przelot-A/interview-creator-shell--step1`), zero błędów konsoli, light i dark.

Poprzedni raport odbioru (`evidence/odbior-zywo-20260905/03-wywiad/RAPORT.md`) się mylił — klasyczny przypadek "hipoteza staje się faktem": ktoś założył, że flaga jest OFF, bez sprawdzenia `?? true` w kodzie.

**Zrzuty:** `evidence/wywiad-czat-20260905/01-interview-creator-shell__{light,dark}.png` (+ `.json` z listą błędów konsoli — pusta).

**Test:** `src/components/Interview/__tests__/InterviewHub.smoke.test.tsx` — nowy przypadek odtwarza dokładnie tę ścieżkę kliknięć i sprawdza obecność pasma "What will be created" (WizardModal/creatorShellEnabled), którego NIE MA w starej (legacy) gałęzi modala — więc test faktycznie łapie regresję flagi, nie tylko obecność wspólnych etykiet kroku. Przy okazji uzupełniono mock `react-i18next` w tym pliku o `i18n.getFixedT` (używane przez `WizardStepper`), którego brak wcześniej maskował tę ścieżkę renderu.

**Dowód mutacyjny:** wymuszenie fallbacku env-flagi na `?? false` → czerwony test (brak pasma "What will be created"); przywrócenie → 13/13 zielone.

**Kod produkcyjny:** NIE zmieniony.

---

## (2) `unified-create-launcher` — KONFLIKT z decyzją właściciela D-01, NIE wpięty

**Zlecenie:** komponent zbudowany, flaga `unifiedCreateLauncherFlag.ts` ON, ale zero wołaczy w `src/` — podłącz w Wywiad → "+ Nowy".

**Zmierzone:** rzeczywiście zero żywych wołaczy (`grep -rn "isUnifiedCreateLauncherEnabled\|<UnifiedCreateLauncher" src/` trafia tylko we własną definicję). ALE `InterviewHub.tsx:9589` i `MyWorkHub.tsx:4763` niosą jawny, datowany komentarz:

> D-01 (Piotr, OBR-28 2026-07-27): uniwersalny „+ Nowy"/„+ New" launcher USUNIĘTY — w Menu 2 zostaje WYŁĄCZNIE kontekstowe CTA zakładki. Kanon: maks. JEDEN primary CTA, kontekstowy.

Commity `47f51800e9` (Interview) i `255366d01b` (My Work), oba 2026-07-27 22:30, opisują to jako świadomą decyzję właściciela z `_ODBIOR_TABELE_PREVIEW_2026-07-27.md §D-01` (plik dziś nie istnieje w repo — zgubiony przy jednym z odzyskiwań, widoczny tylko w `docs/program/recovery-2026-08-08/FILE_OWNERSHIP_MATRIX.tsv`).

Mimo to 5 **późniejszych** sesji grafiki (30.08–02.09, wszystkie PO dacie D-01) dalej zatwierdzało wygląd tego ekranu w izolacji (dev-render harness), a dzisiejszy `docs/program/AUDYT_16_MODULOW_20260905/03_Wywiad.md` listuje go jako zaakceptowany ekran Wywiadu ("Ocena: A, Decyzja: ok"). To jest **realny, nierozstrzygnięty konflikt** między ścieżką wizualnego QA (zatwierdza WYGLĄD w izolacji) a jawną decyzją wiązania (D-01 zakazuje dokładnie tego wzorca w Menu 2) — nie coś, co robotnik powinien rozstrzygać samodzielnie, tym bardziej że dotyczy komponentu obsługującego licencjonowaną metodykę i wzorzec UI, który sam właściciel już raz świadomie wycofał.

**Decyzja:** NIE wpiąłem launchera. Zrobienie tego złamałoby D-01 bez udziału właściciela w tej sesji.

**Zgłoszony task do supervisora** (`task_59ff9aba`): rozstrzygnięcie, czy D-01 nadal obowiązuje (→ usunąć martwy komponent+flagę i zaktualizować dokumentację grafiki) czy ma być świadomie odwrócone (→ wskazać dokładne miejsce wpięcia i realnie to zrobić).

**Testy dodane** (zero zmian w kodzie produkcyjnym):
- `src/components/shared/__tests__/UnifiedCreateLauncher.test.tsx` — komponent **w izolacji** działa poprawnie: Krok 0 pokazuje 3 kafle PL (Wniosek/Inicjatywa/Decyzja), każdy deleguje do właściwego generatora, `defaultType` pomija Krok 0 (kontrakt Fazy 1).
- `src/components/shared/__tests__/UnifiedCreateLauncher.d01Wiring.test.ts` — bezpiecznik source-grep chroniący D-01 przed przypadkowym cofnięciem bez świadomej decyzji.

**Dowód mutacyjny:** (a) zmiana gałęzi routingu `selected === 'initiative'` na `'decision'` w komponencie → 3 czerwone testy; (b) dopisanie importu `UnifiedCreateLauncher` do `InterviewHub.tsx` → czerwony bezpiecznik D-01. Oba przywrócone → 8/8 zielone.

---

## (3) `karta-interview` — NAPRAWIONY (prawdziwy defekt)

**Zlecenie:** otwarcie jedynego pasującego rekordu ("Ocena Dojrzałości Cyfrowej") daje błąd konsoli "Nie udało się wczytać sesji".

**Zmierzone i odtworzone na żywo:** przydział `ia_91d9fbca-...` (szablon `lib-tpl-digital-001`) ma `sessionId: f7847468-...`, ale **zarówno** `GET /api/v8/interview/sessions/:id` **jak i** legacy `GET /api/interview/sessions/:id` zwracają 404 dla tego ID — osierocony/niepełny rekord sesji na bazie stagingu (utworzony 2026-04-30), którego nie wolno mi naprawiać zapisem (zakaz zapisu do bazy stagingu/demo w tym dyżurze). Skutek w UI: czerwony toast "Nie udało się wczytać sesji", `console.error`, powrót do listy bez otwarcia karty.

**Przyczyna i naprawa:** ta sama odpowiedź `/interview/assignments/my`, która dała ten `sessionId`, niesie **też** wbudowany podsumowujący obiekt `session` (id/status/liczniki pytań) — dane już pobrane po stronie klienta, ale nieużywane jako fallback. `InterviewHub.tsx` (`openInterviewAssignmentFull`, ~linia 6275): łańcuch `getSession → Api.get → demoSession` teraz kończy się `demoSession || embeddedSession || null` zamiast `demoSession || null`. Zero fabrykowanych danych.

**Zmierzone ponownie po naprawie:** karta otwiera się honestnie (lewe menu Wywiad/Kontekst/Podsumowanie, tryby pytań, sekcje — zgodnie z `evidence/grafika/132-noc-wywiad-ocena/karta-interview__PRZED__light.png`), 0/0 pytań (to faktycznie pusta/testowa sesja), **bez** toastu błędu i bez `[InterviewHub] Failed to open assignment` w konsoli. Jedyne pozostałe wpisy konsoli to surowe "Failed to load resource: 404" przeglądarki dla samych prób sieciowych (nieuniknione przy jakimkolwiek obsłużonym 404).

**Zrzuty:** `evidence/wywiad-czat-20260905/03-karta-interview__{light,dark}.png`.

**Test:** `InterviewHub.smoke.test.tsx` — nowy przypadek odtwarza dokładnie ten przydział (podwójne 404 na obu endpointach), klika wiersz i sprawdza: oba fallbacki faktycznie wywołane, breadcrumb-efekt odpala się z nazwą otwartego dokumentu, `toast.error` nigdy nie wywołany.

**Dowód mutacyjny:** cofnięcie fallbacku do `demoSession || null` → czerwony test (timeout, breadcrumb nigdy nie nadchodzi); przywrócenie → 14/14 zielone w całym pliku.

---

## (4) `drdHttpSourceOfTruthV1` — NIE zmieniony domyślnie; ryzyko opisane

**Zlecenie:** zmierzyć co włącza flaga i czy jest bezpieczna; jeśli ekran wymaga, włączyć domyślnie poza produkcją publiczną (wzór `isPublicProductionHost`).

**Co robi:** podmienia `DrdSessionRuntime` (localStorage) na `DrdHttpSessionRuntime` — serwer (`/api/method/...`) staje się jedynym źródłem prawdy sesji/eventów/Outputu. Kategoria `experimental`, `defaultValue: false`.

**Zmierzone bezpieczeństwo (dev-render harness, `dev-render/screens/drd-http-workspace.tsx`, fake in-memory server, bez realnego backendu):**
- Stany `fresh`/`inprogress`/`frozen` renderują się poprawnie, **zero błędów konsoli**, light i dark.
- Stan `conflict` pokazuje **jawny** dialog "Sesja zmieniła się na serwerze... Nic nie zostało nadpisane automatycznie — wybierz jak kontynuować" z dwiema jasnymi opcjami — dokładnie tak, jak opisuje własna dokumentacja flagi (nigdy silent auto-merge).
- **Realny backend na stagingu DZIAŁA**: `GET /api/method/packs` (odczyt, bez zapisu) zwraca 200 z prawdziwym pakietem DRD 2.0.0 dla organizacji tego użytkownika; `GET /api/method/sessions` pokazuje 2 realne sesje HTTP-owe utworzone dziś/wczoraj (06:07 i wczoraj 20:42) — ktoś już to realnie przetestował na żywej bazie. Trasy zamontowane w `server/src/Gateway.ts:968` (`app.use('/api/method', methodCoreRoutes)`), z obszernym pokryciem testami integracyjnymi/e2e po stronie serwera (7 osobnych plików `__tests__`).
- Znane, udokumentowane ograniczenia: brak endpointu HTTP do nadawania dodatkowych ról po utworzeniu sesji i do ponownego otwarcia zamrożonej sesji — oba przypadki jawnie wyłączone z komunikatem, nie udawane.

**Dlaczego NIE flipuję domyślnej wartości:** CLAUDE.md §7 (nienaruszalne) wymaga akceptacji właściciela NA ZRZUTACH z izolowanego harnessu PRZED wejściem na żywo — nie samego faktu, że ekran "działa technicznie". Zrzuty tego ekranu ISTNIEJĄ i są zatwierdzone (`evidence/grafika/132-noc-wywiad-ocena/drd-http-workspace__PRZED__light.png`, "Ocena: A, Decyzja: ok"), ale to jest zatwierdzenie WYGLĄDU w izolacji, nie decyzja "idź live" — komentarz w kodzie flagi mówi wprost "OFF by default until owner acceptance", bez towarzyszącego wpisu decyzji (typu DEC-350 dla interview-creator-shell), który by to rozstrzygał. Dodatkowo dotyczy to metodyki licencjonowanej (DRD/Digital Pathfinder, właściciel: Dr. Piotr Wiśniewski) — zmiana źródła prawdy danych oceny klienta z lokalnego na serwerowe to decyzja produktowa, nie kosmetyczna.

**Rekomendacja:** ekran jest technicznie gotowy do włączenia (dowody wyżej), ale włączenie (nawet tylko poza produkcją publiczną) wymaga jednego zdania decyzji właściciela, analogicznego do DEC-350. Nie dodano nowego testu — istniejący `src/components/assessment/drd/__tests__/drdMethodWorkspaceGating.test.tsx` już wyczerpująco kryje kontrakt ON/OFF i pierwszeństwo providera nad gołym hookiem.

---

## (5) `mindmap-i18n-smoke` — NAPRAWIONY (prawdziwy defekt, systemowy)

**Zlecenie:** modal "Dodaj dowód" nieosiągalny — sekcja "Dowody i źródła" w panelu węzła mapy myśli nie reaguje na klik.

**Zmierzone:** `UnifiedNodeDetailDrawer.tsx` (2101 linii, żywy domyślnie od 07-16 przez `mindmapDrawerUnified`) miał **zero** dedykowanych testów. Napisanie testu na sekcji "Evidence & Sources" ujawniło prawdziwą przyczynę: `ToggleBlock` (`src/components/shared/NModeBlocks/ToggleBlock.tsx`, wspólny blok N-mode) chowa zawartość **wyłącznie przez CSS** (`max-h-0 opacity-0`), bez `hidden`/`inert`. Skutek: przycisk "Add evidence" jest **cały czas obecny w drzewie dostępności i hit-testable**, nawet gdy sekcja jest wizualnie zwinięta do 0px. Automat sprawdzający rolę/tekst elementu (jak Playwright `getByRole`) znajduje ten przycisk PRZED kliknięciem nagłówka sekcji — narzędzie próbujące kliknąć bezpośrednio po roli trafia w element obecny-ale-niewidoczny zamiast dostać czytelny błąd "not visible". To dokładnie pasuje do zgłoszenia "sekcja nie reagowała na kliknięcia w automacie".

Siostrzany, starszy `SectionToggle` w `IdeaNodeDetailDrawer.tsx` (legacy ścieżka, flaga OFF) używa poprawnego wzorca `{expanded && <div>...}` — warunkowego renderu. `ToggleBlock` (kanoniczny, używany też w `NodeDetailDrawer.tsx` i `OrganizationContextOverview.tsx`) regresował ten wzorzec przy migracji na animowane collapse/expand.

**Naprawa:** `aria-expanded` na przycisku nagłówka (brakowało), `aria-hidden` + `inert` na kontenerze treści gdy zwinięty. React 19 wspiera `inert` jako zwykły prop JSX. Zmiana jest czysto semantyczna/interaktywna — wygląd wizualny bez zmian (treść i tak miała 0 wysokości/przezroczystość).

**Test:** `src/components/MyWork/mindmap/__tests__/UnifiedNodeDetailDrawer.evidenceSection.test.tsx` — 2 przypadki (rozwinięcie sekcji ujawnia "Add evidence"; otwarcie `AddEvidenceModal` z rozwiniętej sekcji).

**Dowód mutacyjny:** usunięcie `aria-hidden`/`inert` z `ToggleBlock.tsx` → czerwony pierwszy test (przycisk queryable PRZED kliknięciem nagłówka — dokładnie odtworzony zgłoszony objaw); przywrócenie → 2/2 zielone. esbuild per plik: 3 realnych konsumentów `ToggleBlock` kompilują się bez zmian.

**Nie zrobione:** żywy zrzut z realnej mapy myśli. Sesja `ODBIOR_AUTH_STATE` wygasła w trakcie pracy (token stracił ważność ~08:40, plik `auth.json` w ogóle zniknął ~08:50 w trakcie ponownego logowania przez zewnętrzny proces `zaloguj.mjs`, który do końca dyżuru nie zakończył się mimo ~20 minut oczekiwania w tle) — nie zalogowałem się sam (zakaz wpisywania haseł), tylko czekałem. Naprawa i test opierają się o realny kod produkcyjny i dokładną rekonstrukcję zgłoszonego scenariusza w jsdom, nie o zgadywanie.

---

## (6) `chat-split-teresa-right` — NIE POTWIERDZONE (brak żywego zrzutu), test-bezpiecznik dodany

**Zlecenie:** porównać ikony paska kanwy z zatwierdzonym obrazem i wyrównać; pominąć zakładki Edytor/Dok/MD i kebab pionowy (świadome zmiany 05.09).

**Zastrzeżenie źródła:** `docs/program/AUDYT_16_MODULOW_20260905/01_Czat.md §B2` opisuje ten dokładny zatwierdzony obraz jako "atrapa obu stron (`ArtifactMock` + mock czatu)" — to zrzut z izolowanego harnessu-mocka, nie 1:1 zrzut realnego komponentu. Nie zwalnia to z porównania, ale znaczy, że różnicę trzeba zweryfikować w realnym kodzie, nie założyć że mock jest wyrocznią.

**Zmierzone (source-grep + przepływ kodu — bez żywego zrzutu, powód niżej):**
1. "Main" (`BranchSelector`) w `UnifiedChatPanel.tsx` renderuje się WYŁĄCZNIE gdy `activeConversationId && !activeConversationId.startsWith('local-')` — świadome (finding M01-035, komentarz w kodzie): rozmowa `local-*` nie ma jeszcze wiersza na serwerze, `GET /:id/branches` dałby 404. Świeży dokument w nowej rozmowie ZACZYNA jako `local-*` — brak "Main" na tym etapie jest oczekiwanym, udokumentowanym zachowaniem, **nie regresją**.
2. `copy/share/save/close` w `WorkCanvasDocumentPanel.tsx` (`canvas-file-actions`) są renderowane **bezwarunkowo** przez `renderCommandButton`, z ikonami Copy/Share2/Save/X (`actionIcons`) — nawet gdy `getCanvasActionAvailability` zwraca `disabled_*`, ikona nigdy nie jest podmieniana (przycisk jest tylko wyszarzony). Przeszukałem `WorkCanvasDocumentPanel.tsx`, `CanvasArtifactSwitcher.tsx` i `canvasActionAvailability.ts` — zero wystąpień ikony Globe lub "szablonu" w tej okolicy kodu.

**Nie potwierdziłem ani nie obaliłem** dokładnie "globe/szablon" z raportu — to wymaga żywego zrzutu świeżego dokumentu w widoku split, którego nie zdołałem zrobić: `ODBIOR_AUTH_STATE` wygasło w trakcie tego dyżuru i zewnętrzny proces logowania (`/private/tmp/odbior-auth/zaloguj3.log`) nie zakończył się mimo długiego oczekiwania. Nie zgadywałem kodu na siłę i nie zalogowałem się sam.

**Test:** `src/components/AIChat/__tests__/canvasSplitTeresaRight.iconParity.test.ts` — blokuje regresję punktów 1–2 (source-grep, wzorem `chatHeaderControls.ownerFeedback.test.ts`).

**Dowód mutacyjny:** zamiana `share: Share2` na `share: FileText` w `WorkCanvasDocumentPanel.tsx` → czerwony test; przywrócenie → 2/2 zielone.

**Rekomendacja:** gdy sesja odbioru znów będzie żywa, zrobić świeży zrzut `chat-split-teresa-right` (nowy dokument, natychmiast po utworzeniu) i porównać z tym raportem — jeśli "globe/szablon" nadal się pojawia, to jest coś POZA zbadanym przeze mnie kodem (może inny wariant kanwy, może stary bundle na stagingu w chwili poprzedniego odbioru).

---

## Higiena wykonania

- Zero `git push`, zero `git stash`, zero zapisu do baz stagingu/demo (tylko GET z tokenem gdzie potrzebne).
- `pkill` użyty raz, wyłącznie po dokładnym wzorcu własnego procesu (`vite --config dev-render/vite.config.ts --port 4610`) — zatrzymany własny dev-render harness.
- Testy uruchamiane per plik (`vitest run <plik>`), nigdy cały pakiet; kompilacja sprawdzana `esbuild` per plik zmieniony.
- Nowe pliki testowe dodane `git add -f` (katalog `tests/`-owy wzorzec `__tests__/` w `src/` nie wymaga tego, ale zrobiłem to i tak dla nowych plików w katalogach, które mogły być objęte `.gitignore` per bezpieczeństwo).
- Nie dotknięto `UnifiedChatPanel.tsx` sekcji powitania ani kart Inicjatyw.
- Zgłoszony 1 task do supervisora (`task_59ff9aba`) — konflikt D-01 vs. akceptacje grafiki dla `unified-create-launcher`.
