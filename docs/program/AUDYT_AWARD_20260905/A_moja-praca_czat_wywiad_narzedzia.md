# Audyt „award-winning, CES 2027" — Moja Praca · Czat · Wywiad · Narzędzia

Data: 2026-09-05. Środowisko: `http://127.0.0.1:3000` (dev-serwer Vite na kodzie m03) → backend
i dane stagingu (`5097394eb6`). Sesja właściciela, motyw jasny, szerokość 1440 px; ekrany flagowe
dodatkowo przy 1280 i 1920 px. Metoda: harness Playwright `scripts/dev/audyt-award-20260905/audyt.mjs`,
jeden kontekst przeglądarki na moduł, klik po realnym DOM, przechwyt błędów konsoli, odpowiedzi ≥400,
zapytań >5 s, przepełnień poziomych i podejrzanych tekstów (sidecar `*.png.json` przy każdym zrzucie).
Zero utworzonych/usuniętych rekordów, zero wywołań płatnych do AI, zero zmian w kodzie.

Skala: **A = Stabilność** (błędy konsoli, 4xx/5xx, martwe kontrolki, nieskończone ładowanie,
utrata stanu), **B = Spójność grafiki** (skala typu, siatka 8 px, tokeny `c-*`, jeden kształt
Menu 1/2/3 i prawego panelu, puste stany, chipy, ikony, kebab, polszczyzna bez angielskich etykiet,
surowych enumów i obciętego tekstu bez tooltipa). 0 = nie działa / rażące złamanie kanonu,
1 = działa, ale wyraźne naruszenia, 2 = drobne naruszenia, 3 = gotowe na scenę CES.

Uwaga metodyczna: plakietki deweloperskie („LOCAL @sha", „N V9 overrides") widoczne na części
zrzutów są **artefaktem dev-serwera**, nie stanem demo/produkcji — `src/utils/debugOverlays.ts`
i `src/components/layout/EnvironmentBadge.tsx` zostały 05.09 ustawione tak, by poza `import.meta.env.DEV`
pokazywać się wyłącznie ADMIN/SUPERADMIN po `?debug=1`. Nie liczone jako uchybienie.

---

## 1. MOJA PRACA

| Ekran | Trasa | A | B | Kluczowe odchylenia |
| --- | --- | :-: | :-: | --- |
| Skrzynka — lista | `/my-work` | 3 | 2 | Dok Teresy jako trzecia stała kolumna zamiast zakładek Element/Teresa; ucięte nagłówki kolumn („STA…", „PILN…"); angielskie chipy sugestii. `moja-praca/01-skrzynka-lista.png` |
| Skrzynka — podgląd | `/my-work` | 3 | 2 | Podgląd wąski, bo dzieli miejsce z dokiem Teresy. `02-skrzynka-preview.png` |
| Skrzynka — kebab | `/my-work` | 3 | 3 | Poprawne 3 strefy, kolory zgodne. `03-skrzynka-kebab.png` |
| Skrzynka — pstryczek kolumn | `/my-work` | 3 | 3 | Wzorcowy popover. `04-skrzynka-kolumny.png` |
| Skrzynka — flagowy 1280 px | `/my-work` | 2 | 1 | Tabela ścieśniona do jednej kolumny (Tytuł), reszta niewidoczna. `28-flagowy-skrzynka-1280.png` |
| Skrzynka — flagowy 1920 px | `/my-work` | 3 | 2 | Nawet przy 1920 px ostatnia kolumna ucięta do jednej litery. `29-flagowy-skrzynka-1920.png` |
| Pomysły — lista | `/my-work` | 3 | 2 | Wiersz 1 wygląda na zaznaczony, choć podgląd nie jest otwarty. `05-pomysly-lista.png` |
| Pomysły — podgląd | `/my-work` | 3 | 1 | Surowy enum „Źródło: manual". `06-pomysly-preview.png` |
| Pomysły — kebab | `/my-work` | 3 | 3 | 3 strefy poprawne (weryfikacja zoomem `_zoom-kebab-pomysly.png`). `07-pomysly-kebab.png` |
| Pomysły — pstryczek kolumn | `/my-work` | 3 | 3 | Bez zastrzeżeń. `08-pomysly-kolumny.png` |
| Pomysł → Mapa myśli (wejście URL-em) | `/my-work/ideas/:id/workspace/mindmap` | 1 | 2 | 4–6 s ciszy bez spinnera; 2× 404 `/map/candidate`; breadcrumb nie pokazuje tytułu; „1 elementów". `09b-idea-mapa-myśli.png` → `10b-idea-mindmap-6s.png` |
| Pomysł → Whiteboard (URL) | `…/workspace/whiteboard` | 1 | 2 | Jak wyżej. `11-idea-whiteboard.png` → `11b-idea-whiteboard-6s.png` |
| Pomysł → Process Flow (URL) | `…/workspace/process-flow` | 1 | 2 | Jak wyżej, „1 kroków". `12b-idea-processflow-6s.png` |
| Pomysł → Tabela (przejście kliknięciem) | `…/workspace/table` | 2 | 3 | 404 `/map/candidate` nadal w konsoli; poza tym wzorcowo. `09-idea-open.png` |
| Pomysł → zakładka Teresa | `…/workspace/*` | 3 | 2 | Surowy markdown `##` / `-` w automatycznej wiadomości. `13-idea-mindmap-teresa-tab.png` |
| Notatnik — lista | `/my-work` | 1 | 3 | Liczniki pokazują „0" przez ~3 s zamiast stanu ładowania; sporadycznie 4× 404 + błąd OrgContext. `14-notatnik-lista.png` → `14b-notatnik-lista-4s.png` |
| Notatnik — notatka otwarta | `/my-work` | 3 | 2 | Tytuł notatki wychodzi poza kontener (delta 44 px, brak zawijania). `15-notatnik-otwarty.png` |
| Notatnik — menu notatki | `/my-work` | 3 | 3 | Dobry wzorzec „wyszarzone z powodem". `16-notatnik-kebab.png` |
| Kalendarz — siatka | `/my-work` | 2 | 3 | Integracje Google/Outlook: backend 501, a UI zaprasza „Połącz". `17-kalendarz-lista.png` |
| Kalendarz → wydarzenie → workspace Inicjatywy | `/my-work` → karta | 3 | 0 | **CAŁY ekran po angielsku** w polskiej aplikacji. `18-kalendarz-preview.png` |
| Zadania — lista i podgląd | `/my-work` | 3 | 3 | Czysto. `19-zadania-lista.png`, `20-zadania-preview.png` |
| Zadania — kebab | `/my-work` | 3 | 2 | „Archiwizuj" (odwracalne) i „Usuń" w jednej strefie danger, bez separatora. `21-zadania-kebab.png`, `_zoom-kebab-zadania.png` |
| Decyzje — lista/podgląd/kebab | `/my-work` | 3 | 3 | Wzorcowe. `22-decyzje-lista.png`, `23-decyzje-preview.png`, `24-decyzje-kebab.png` |
| Sejf klienta — lista/podgląd/kebab | `/my-work` | 3 | 3 | Drobne ucięcie nagłówków (liczone globalnie). `25-sejf-lista.png` … `27-sejf-kebab.png` |
| Trwałość stanu Menu 3 przy zmianie zakładek | `/my-work` | 1 | 3 | Filtr „Krytyczne" gubi się po powrocie do zakładki. `30-tab-switch-powrot.png` |

**Średnia Moja Praca: A = 2,48 · B = 2,32** (25 ekranów/stanów; 1 pozycja `NIE_DOTARŁEM`).

### Pełna lista uchybień (Moja Praca)

**MP1. Prawy panel ma dwa różne kształty w tym samym module.** Ekrany listowe (Skrzynka, Pomysły,
Zadania) pokazują stały dok „Teresa" jako osobną **trzecią kolumnę**, zamiast zakładek Element/Teresa
wewnątrz JEDNEGO panelu — tak jak robi to Idea Workspace.
Dowód: `01-skrzynka-lista.png`, `19-zadania-lista.png` vs `13-idea-mindmap-teresa-tab.png`.
Plik: nie zidentyfikowano jednego pliku — w Mojej Pracy współistnieją dwa różne komponenty prawego panelu.
Naprawa: ujednolicić na wzorzec Idea Workspace. Effort **L** · Impact **H** (to źródło MP3).

**MP2. Nagłówki kolumn ucinane do 3–4 znaków**, oparte wyłącznie o natywny `title` (wolny tooltip przeglądarki).
Dowód: `01-skrzynka-lista.png`, `25-sejf-lista.png`, `29-flagowy-skrzynka-1920.png`.
Plik: `src/components/shared/ModuleHub/FilterableTable.tsx:788-789` (domyślna szerokość 140 px / min 90 px).
Naprawa: podnieść domyślną szerokość kolumn nietytułowych (160–180 px) lub skrócić etykiety. Effort **S** · Impact **M**.

**MP3. Przy 1280 px tabela Skrzynki kurczy się do jednej kolumny** — trzecia stała kolumna (dok Teresy,
MP1) nie jest ujęta w budżecie szerokości §19.1 kanonu, mimo że kanon deklaruje „≥1280 = pełny układ".
Dowód: `28-flagowy-skrzynka-1280.png`. Naprawa: dok Teresy chowa się/dzieli przestrzeń z podglądem poniżej 1440 px.
Effort **M** · Impact **H**.

**MP4. Surowy enum w podglądzie pomysłu**: „Źródło: manual" zamiast etykiety polskiej.
Dowód: `06-pomysly-preview.png`. Plik: `src/components/MyWork/IdeaPreview.tsx:183` i `:318` (`String(idea.sourceType)`).
Naprawa: mapa `manual→Ręcznie`, `ai→AI`. Effort **S** · Impact **M**.

**MP5. Otwarcie canvasu pomysłu trwa 4–6 s w kompletnej ciszy** — pusty, nieopisany prostokąt bez ikony,
tekstu i spinnera; wygląda jak zawieszony ekran.
Dowód: `09b-idea-mapa-myśli.png` (puste) vs `10b-idea-mindmap-6s.png` (załadowane).
Plik: `src/components/MyWork/IdeaMapWorkspace.tsx` (ścieżka ładowania mapy/whiteboard/process-flow;
konkretnej linii nie doprecyzowano). Naprawa: szkielet z ruchem albo komunikat „Ładowanie mapy…". Effort **M** · Impact **H**.

**MP6. Podwójne 404 do `/api/my-work/my-ideas/:id/map/candidate` przy każdym otwarciu pomysłu.**
Dowód: sidecary `10b-idea-mindmap-6s.png.json`, `09c-idea-mapa-myśli-7s.png.json`.
Plik: `server/src/routes/my-work.routes.ts:4673` (brak kandydata mapowany na 404 zamiast 200 z pustą treścią)
+ podwójne wywołanie po stronie klienta. Naprawa: 200 `{candidate:null}` i deduplikacja efektu.
Effort **S** · Impact **M** (szum maskujący realne błędy — wzorzec „fałszywe 404 / V8" z rejestru).

**MP7. Breadcrumb i chip zakładki nie pokazują tytułu pomysłu przy wejściu bezpośrednim URL-em** —
zostają generyczne „Pomysł", choć panel boczny zna pełny tytuł.
Dowód: `10b-idea-mindmap-6s.png`. Plik: nie zidentyfikowano (hydratacja w `IdeaMapWorkspace.tsx`).
Naprawa: hydratować breadcrumb z tego samego źródła co panel. Effort **M** · Impact **M** (dotyczy odświeżeń i linków dzielonych).

**MP8. Zła polska liczba mnoga w podpowiedziach AI**: „Mapa ma tylko 1 elementów", „Diagram ma tylko 1 kroków".
Dowód: `10b-idea-mindmap-6s.png`, `11b-idea-whiteboard-6s.png`, `12b-idea-processflow-6s.png`.
Plik: `src/components/MyWork/IdeaAINudgeStrip.tsx:111,122,133,145`. Naprawa: funkcja pluralizacji PL (1 / 2-4 / 5+).
Effort **S** · Impact **M**.

**MP9. Surowy markdown w wiadomości Teresy** — literalne `##` i `-` widoczne jako tekst.
Dowód: `13-idea-mindmap-teresa-tab.png`. Plik: nie zidentyfikowano (renderer zakładki Teresa w Idea Workspace,
inny niż `UnifiedChatPanel.tsx`). Naprawa: przepuścić treść przez parser markdown. Effort **S** · Impact **M**.

**MP10. Liczniki zakładek Notatnika pokazują twarde „0" podczas ładowania** (fałszywa, pewna wartość),
zanim po ~3 s pokażą prawdziwe „2". Dowód: `14-notatnik-lista.png` vs `14b-notatnik-lista-4s.png`.
Naprawa: „—" lub szkielet do czasu odpowiedzi. Effort **S** · Impact **M**.

**MP11. Sporadyczne błędy przy wejściu w Notatnik**: `[OrgContext] Error fetching orgs`, 404 na
`/api/organizations/current`, `/api/settings/preferences/accessibility`, `/api/feature-flags/runtime`,
POST `/api/v10/teresa/voice-event`. Dowód: `14-notatnik-lista.png.json` (wystąpiło raz, nie powtórzyło się — flaky).
Naprawa: zbadać wyścig na starcie modułu głosowego/dostępności. Effort **M** · Impact **M**.

**MP12. Tytuł notatki wychodzi poza kontener** (~44 px, brak zawijania/elipsy), dotyka krawędzi panelu.
Dowód: `15-notatnik-otwarty.png` + sidecar. Plik: nie zidentyfikowano (nagłówek edytora notatnika).
Effort **S** · Impact **L**.

**MP13. Kalendarz → integracje Google/Outlook zwracają 501 Not Implemented**, mimo że UI zaprasza „Połącz".
Dowód: `17-kalendarz-lista.png.json`. Naprawa: wdrożyć endpoint albo uczciwie oznaczyć „Wkrótce" i ukryć CTA.
Effort **L** (backend) / **S** (uczciwe UI) · Impact **M**.

**MP14. Kliknięcie wydarzenia kalendarza, którego encją jest Inicjatywa, otwiera CAŁY ekran workspace
Inicjatywy w 100 % po angielsku** — „Approve/Cancel", „SOURCE/REVIEW/PLANNING/EXECUTION/BENEFITS",
„TASKS (0)/No tasks yet", „KEY METRICS/CAPEX/OPEX/Expected ROI", „TIMELINE/Start Date/End Date",
„OWNERSHIP/Business Owner/Execution Owner/Not assigned", zakładki „Overview/Tasks/Definition/Economics/Team/History".
Dowód: `18-kalendarz-preview.png`.
Plik: `src/components/Initiatives/InitiativeFullView.tsx:438,503,860,964,1003,1013,1056,1218,1240,1258` (i dalej —
literalne stringi, zero `t()`). Naprawa: pełny sweep i18n archetypu. Effort **L** · Impact **H** —
**najpoważniejsze pojedyncze znalezisko części A** (nieprzetłumaczony cały archetyp ekranu).

**MP15. Kebab Zadań łączy „Archiwizuj" (odwracalne) i „Usuń" (nieodwracalne) w jednej strefie danger,
bez separatora** — inaczej niż w Pomysłach i Decyzjach.
Dowód: `21-zadania-kebab.png`, `_zoom-kebab-zadania.png`.
Plik: `src/components/MyWork/MyTasksListContent.tsx:829-849` (i zduplikowany blok `:1309-1329`).
Naprawa: „Archiwizuj" do sekcji `kind:'manage'`. Effort **S** · Impact **M**.

**MP16. Filtr Menu 3 („Krytyczne") gubi się po przejściu na inną zakładkę i powrocie.**
Dowód: `30-tab-switch-powrot.png`. Plik: nie zidentyfikowano. Naprawa: persystować filtr per zakładka.
Effort **M** · Impact **M**.

**MP17. Wiersz listy Pomysłów wygląda na zaznaczony (podświetlenie + pasek z lewej), zanim jakikolwiek
klik nastąpił, a podgląd nie jest otwarty** — stan wizualny kłamie o stanie interakcji.
Dowód: `05-pomysly-lista.png`. Plik: nie zidentyfikowano. Effort **S** · Impact **L**.

**MP18. Angielskie chipy sugestii Teresy** („Triage all new items for me", „Summarize notifications
since yesterday", „What needs urgent attention?", „Build an initial structure for my idea") w polskiej aplikacji.
Dowód: obecne na niemal każdym zrzucie z dokiem Teresy, m.in. `01-skrzynka-lista.png`.
Plik: nie zidentyfikowano (generator sugestii kontekstowych). Effort **M** · Impact **M**.

**NIE_DOTARŁEM (Moja Praca):** Kalendarz → przełącznik widoku „Lista" (segment Miesiąc/Tydzień/Dzień/Lista).
Dwie niezależne próby kliknięcia selektorem tekstowym trafiały powtarzalnie w INNY, tak samo nazwany
element (przycisk powrotu do listy w zakładce Zadania) i przenosiły na niepowiązany rekord
(`17b-kalendarz-widok-lista.png`, `17c-kalendarz-lista-retry.png`). Nie rozstrzygam, czy dotyka to
realnego użytkownika klikającego myszką — wymaga inspekcji DOM, nie zgaduję oceny.

**Ekran flagowy Moja Praca:** **Skrzynka — tabela z otwartym podglądem**. Jedyny ekran zmierzony na
wszystkich trzech szerokościach; demonstruje jednocześnie główny problem architektoniczny modułu
(MP1+MP3) i najbardziej widoczny defekt kosmetyczny (MP2). Naprawa tych dwóch rzeczy na Skrzynce daje
gotowy wzorzec do skopiowania na Pomysły/Zadania/Decyzje/Sejf — dzielą ten sam komponent tabeli.

---

## 2. CZAT AI

| Ekran | Trasa | A | B | Kluczowe odchylenia |
| --- | --- | :-: | :-: | --- |
| Ekran startowy (powitanie) | `/chat` | 3 | 3 | Brak realnych odchyleń. `czat/01-powitanie.png` |
| Historia — panel rozwinięty | `/chat` | 3 | 2 | Dane testowe w panelu (dwa foldery „TEST_PROJ_P2", „QA folder 1778037649725", przypięta „test Tomek"); pozycje „New conversation" po angielsku. `02-historia-menu.png` |
| Otwarta konwersacja | `/chat/:id` | 2 | 2 | 2× 404 na `stream/partial`; chip „1 sources" po angielsku; brak znaczników czasu. `03-konwersacja-otwarta.png`, `04-konwersacja-tresc.png` |
| Górny pasek — „Model" | `/chat` | 3 | 3 | Bez zastrzeżeń. `05-model-dropdown.png` |
| Górny pasek — „Dane" | `/chat` | 3 | 1 | Pełny panel diagnostyki technicznej (opóźnienie API, status bazy, limity) widoczny zwykłemu użytkownikowi. `06-dane-dropdown.png` |
| Ekran flagowy 1280 px | `/chat/:id` | 2 | 3 | Te same 404 co wyżej. `07-flagowy-1280.png` |
| Ekran flagowy 1920 px | `/chat/:id` | 2 | 3 | Te same 404; layout poprawnie wyśrodkowany (`max-w-5xl mx-auto`). `08-flagowy-1920.png` |

**Średnia Czat: A = 2,57 · B = 2,43** (7 ekranów).

### Pełna lista uchybień (Czat)

**CZ1. 404 na `/api/ai/stream/partial/:id` przy każdym otwarciu historycznej konwersacji.**
Dowód: `03-konwersacja-otwarta.png(.json)`, `04-konwersacja-tresc.png(.json)`, `07`/`08-flagowy-*.png(.json)`.
Plik: wołacz `src/hooks/useAIStream.ts:1479`; handler `server/src/routes/ai.routes.ts:6446`. 404 jest
zamierzonym kontraktem („brak partial do wznowienia" — front obsługuje bez awarii), ale zaśmieca konsolę
realnym błędem HTTP przy każdej wizycie. Naprawa: 200 `{found:false}` zamiast 404.
Effort **M** · Impact **L/M**. *Dotyka rdzenia wznawiania streamu — zmiana kontraktu API, wymaga koordynacji.*

**CZ2. Chip „1 sources" — brak klucza i18n.** Dowód: `04-konwersacja-tresc.png`.
Plik: `src/components/AIChat/TrustBadge.tsx:384` — `t('trust.badge.sources','{{count}} sources')`; klucz
`trust.badge.sources` NIE istnieje ani w `public/locales/pl/translation.json`, ani w `en/` (sprawdzone odczytem obu plików).
Naprawa: dodać klucz z formami `_one/_few/_many`. Effort **S** · Impact **M**.

**CZ3. Brak znaczników czasu wiadomości.** Dowód: `04-konwersacja-tresc.png`.
Plik: `src/components/AIChat/MessageRenderer.tsx` — zero odwołań do `.timestamp`, choć pole istnieje w typie
(`src/types/core.ts:2317`, `src/types/domain/ai.ts:465`). Naprawa: subtelny znacznik (hover lub grupowanie po dniu).
Effort **S/M** · Impact **M**.

**CZ4. Dane testowe/QA widoczne w panelu Historii.** Dowód: `02-historia-menu.png`.
Plik: nie dotyczy — to dane w bazie stagingu. Naprawa: wyczyścić konto używane do demo.
Effort **S** (operacja na danych) · Impact **H** dla wrażenia jakości — bezpośrednie naruszenie własnej zasady
„zero rekordów testowych" z `CLAUDE.md`.

**CZ5. Konwersacje z angielskim tytułem domyślnym „New conversation" w polskim UI.** Dowód: `02-historia-menu.png`.
Plik: `server/migrations/073_conversations.sql:17` (`DEFAULT 'New conversation'`),
`server/src/routes/conversations.routes.ts:458,1675,1698` (hardkodowany fallback), porównanie literalne w
`src/components/AIChat/ConversationItem.tsx:128`. Naprawa: nie zapisywać zlokalizowanego stringa w bazie —
pusty tytuł + placeholder z klucza `aiChat.newConversation` (już użyty w `MoveToProjectModal.tsx:232`).
Effort **S/M** · Impact **M**.

**CZ6. Panel „Dane" (SystemHealth) ujawnia surową diagnostykę zwykłemu użytkownikowi** —
„Status systemu: Połączony", „Opóźnienie API: 337 ms", „Pamięć 0/1000 MB", „production · v0.0.1 · 5097394eb646".
Dowód: `06-dane-dropdown.png`. Plik: `src/layouts/MainLayout.tsx:428` (`<SystemHealth />` renderowany
bezwarunkowo w globalnym Menu 1 **każdego** modułu); gate tylko po `isDemoContext` w
`src/components/SystemHealth.tsx:21-26`, brak gate po roli.
Naprawa: pełny panel dla ADMIN/SUPERADMIN, dla reszty uproszczony wskaźnik statusu.
Effort **M** · Impact **H** (komponent globalny, widoczny w każdym module — naprawialny bez odmrażania Czatu).

**CZ7. Tytuł karty przeglądarki „AI Chat — Consultify" niespójny z polskim UI („Czat AI").**
Dowód: pole `tytul` w każdym sidecarze `*.png.json`. Plik: nie zidentyfikowano (prawdopodobnie generowany
z angielskiej nazwy modułu w konfiguracji tras). Effort **S** · Impact **L**.

**NIE_DOTARŁEM (Czat):** tryb ciemny (harness wymusza `colorScheme:'light'` i czyści motyw w localStorage);
zachowanie przycisku „Wstecz" przeglądarki po otwarciu konwersacji (brak `page.goBack()` w harnessie);
kliknięcie chipów sugestii i wysłanie wiadomości (celowo pominięte — generowałoby płatne żądanie AI);
hover nad wiadomością (harness nie wspiera hover — z kodu wynika, że timestampu nie ma nawet na hover,
ale nie potwierdzono wzrokiem).

**Ekran flagowy Czat:** **otwarta konwersacja przy 1920 px** (`08-flagowy-1920.png`) — najlepiej pokazuje
realną wartość produktu (AI odpowiadające merytorycznie o inicjatywach, fazach i decyzjach organizacji),
layout poprawnie wyśrodkowany, zero przepełnień. **Warunek:** naprawić najpierw CZ2 (chip „1 sources") —
to jedyny defekt widoczny gołym okiem; 404 z CZ1 widać wyłącznie w DevTools. Wariant zapasowy bez żadnej
poprawki: ekran startowy (`01-powitanie.png`) — zero błędów, zero angielszczyzny, zero danych testowych w kadrze.

---

## 3. WYWIAD

| Ekran | Trasa | A | B | Kluczowe odchylenia |
| --- | --- | :-: | :-: | --- |
| Lista główna — Skrzynka | `/interview` | 2 | 2 | Podwójna nawigacja (Menu 2 + PipelineStepper), przepełnienie nagłówka. `wywiad/01-lista-glowna.png` |
| Zakładka Sesje | `?tab=sessions` | 2 | 2 | To samo przepełnienie nagłówka. `02-tab-sesje.png` |
| Zakładka Przydzielone | `?tab=managed` | 2 | 1 | Przepełnienie komórki nazwa+kategoria; niespójna wielkość liter `commercial`/`COMMERCIAL`. `03-tab-przydzielone.png` |
| Zakładka Szablony | `?tab=templates` | 3 | 3 | Czysto. `04-tab-szablony.png` |
| Zakładka Dopuszczenie (pusty stan) | `?tab=pending_review` | 3 | 2 | Brak wiersza chipów Menu 3 — inny szkielet niż siostrzane zakładki. `05-tab-dopuszczenie.png` |
| Zakładka Wnioski | `?tab=insights` | 3 | 3 | Czysto. `06-tab-wnioski.png` |
| Zakładka Inicjatywy | `?tab=initiatives` | 1 | 2 | Klik w stepper przewinął CAŁY nagłówek w bok, chowając breadcrumb. `07-tab-inicjatywy.png` vs `07b-tab-inicjatywy-direct-url.png` |
| Podgląd (Skrzynka → rekord) | `/interview` | 3 | 2 | Pigułka „Otwórz" z bezsensownym badge'em „0". `08-preview-open.png`, `08e-zoom-actions.png` |
| Kebab wiersza | `/interview` | 3 | 3 | Zgodny z kanonem (weryfikacja zoomem). `09-kebab-open.png`, `09d-zoom-kebab.png` |
| Pstryczek kolumn | `/interview` | 3 | 3 | Zgodny z kanonem (lock Typ/Nazwa/Akcje). `10-pstryczek.png` |
| Kreator „Przydziel" — krok 1 | `/interview` | 3 | 2 | Amber-panel „szablony niedostępne" dominuje nad właściwym polem wyboru. `11b-przydziel-krok1.png` |
| Ekran flagowy 1280 px | `/interview` | 1 | 1 | Prawe kolumny tabeli ucięte przez sztywny panel Teresy, bez scrolla. `12b-flagowy-1280-loaded.png` |
| Ekran flagowy 1920 px | `/interview` | 3 | 3 | Czysto, zero przepełnień. `13-flagowy-1920.png` |

**Średnia Wywiad: A = 2,46 · B = 2,23** (13 ekranów/stanów).

### Pełna lista uchybień (Wywiad)

**W1. Podwójna, rozjeżdżająca się nawigacja sekcji.** Nad tabelą są DWA rzędy zakładek dla tych samych
6 sekcji, w RÓŻNEJ kolejności (Menu 2: Skrzynka·Sesje·Przydzielone·Szablony·Dopuszczenie·Wnioski·Inicjatywy;
Stepper: ①Szablony·②Przydzielone·③Skrzynka·④Dopuszczenie·⑤Wnioski·⑥Inicjatywy), przy czym „Sesje" nie
występuje w drugim rzędzie. To nieudokumentowany trzeci poziom nawigacji, spoza architektury Menu 1/2/3.
Dowód: `01b-lista-glowna-zoom.png`. Plik: `src/components/Interview/InterviewPipelineStepper.tsx` (cały
komponent), montaż `src/components/Interview/InterviewHub.tsx:9659-9660`, górny rząd z
`src/components/shared/ModuleHub/ModuleNavBar.tsx`. Naprawa: scalić w jeden rząd albo ograniczyć stepper do
niekilkalnego wskaźnika postępu. Effort **M** · Impact **M**.

**W2. Klik w daleką pozycję steppera przewija CAŁY nagłówek, chowając breadcrumb.**
Dowód: `07-tab-inicjatywy.png` (breadcrumb „Wywiad" zniknął, Menu 2 ucięte) vs `07b-tab-inicjatywy-direct-url.png`
(ten sam ekran z URL-a — nagłówek w porządku). Plik: `InterviewPipelineStepper.tsx` (siatka pigułek nie kurczy
się poniżej ~1920 px; zmierzona delta 247–407 px w sidecarach `01`,`02`,`03`,`07`,`12`) + kontekst montażu
`InterviewHub.tsx:9659`. Naprawa: własny `overflow-x-auto` na samym rzędzie pigułek, nie na wspólnym przodku
z breadcrumbem (usunięcie duplikatu z W1 rozwiązałoby to przy okazji). Effort **M** · Impact **H**.

**W3. Ekran flagowy 1280 px — prawe kolumny tabeli ucięte, zero scrolla.** Przy typowej szerokości laptopa
treść modułu ma ~840 px, prawy panel AI trzyma stałą szerokość i się nie zwęża, tabela nie oferuje scrolla
poziomego — realna utrata dostępu do danych („Dni do terminu", „Przypisany", kebab tylko fragmentem).
Dowód: `12b-flagowy-1280-loaded.png`. Plik: nie zidentyfikowano dokładnie (poziom `AppShell`/`InterviewHub`).
Naprawa: responsywne zwężanie/chowanie panelu poniżej ~1440 px albo scroll poziomy tabeli. Effort **M/L** · Impact **H**.

**W4. Niespójna wielkość liter w tej samej kolumnie kategorii** — wiersze 1 i 4 „commercial", wiersze 2–3
„COMMERCIAL". Dowód: `03b-zoom-overflow-row.png`. Plik: `InterviewHub.tsx:6887`
(`{assignment.template?.category || assignment.template?.name || '—'}` — surowa wartość bez normalizacji);
analogicznie `InterviewHub.tsx:5719` dla zakładki Szablony. Naprawa: normalizacja w warstwie prezentacji.
Effort **S** · Impact **M**.

**W5. Komórka nazwa+kategoria przelewa się poza kontener (Przydzielone).** Dowód: `03-tab-przydzielone.png.json`,
pole `przepelnieniaPoziome` — 10 wpisów typu „DBR77 — Jak sprzedawać lepiej (pomysły)COMMERCIAL", delta 33 px
(telemetria; wiersze poza widocznym obszarem, więc bez potwierdzenia zrzutem 1:1 — tabela ma własny scroll).
Plik: nie zidentyfikowano dokładnej linii. Naprawa: `truncate`/`min-w-0` na komórce nazwa+badge.
Effort **S** · Impact **M**.

**W6. Pigułka akcji „Otwórz" pokazuje bezsensowny badge „0".** Dowód: `08e-zoom-actions.png`.
Plik: kontrakt badge'a `src/components/shared/PreviewPane/PreviewActionButton.tsx:42` mówi wprost, że badge
niesie **klawisz skrótu**, nie licznik; miejsca wywołania z wartością `0` nie namierzono.
Naprawa: ukryć badge dla wartości falsy albo podać właściwy skrót. Effort **S** · Impact **M**.

**W7. Kolumna „DNI DO TERMINU" za wąska przy 1440 px — obcina tekst** („48 dni p…" vs pełne „48 dni po terminie"
dopiero przy 1920 px). Dowód: `01-lista-glowna.png` vs `01c-lista-glowna-1920-full.png`.
Plik: nie zidentyfikowano (domyślne szerokości kolumn Wywiadu). Effort **S** · Impact **L**.

**W8. Zakładka „Dopuszczenie" (pusty stan) ma inny szkielet niż siostrzane zakładki** — brak wiersza chipów
Menu 3. Dowód: `05-tab-dopuszczenie.png`. Plik: nie zidentyfikowano. Naprawa: rozstrzygnąć, czy to celowe
(0 elementów = brak filtrów) i ujednolicić. Effort **S** · Impact **L**.

**W9. Krok 1 kreatora „Przydziel" — odwrócona hierarchia wizualna**: długa amber-lista „Szablony niedostępne
do przydzielenia" (15+ pozycji) zajmuje niemal cały modal, przygniatając właściwy dropdown wyboru.
Dowód: `11b-przydziel-krok1.png`. Naprawa: zwinąć listę niedostępnych domyślnie (disclosure).
Effort **M** · Impact **L** (może być artefakt danych demo).

**Finding wycofany po weryfikacji:** wstępnie wyglądało, że w kebabie brakuje separatora między
„Kontynuuj/Otwórz podgląd/Edytuj" a „Odłóż termin". Po przybliżeniu (`09d-zoom-kebab.png`) oba wymagane
hairline-separatory SĄ obecne — struktura context/manage/danger z `src/components/shared/RowActionsMenu.tsx:146-166,604-608`
działa zgodnie z kanonem. Nie zgłaszam jako defektu.

**NIE_DOTARŁEM (Wywiad):** tryb ciemny (harness wymusza jasny); dokładna linia źródłowa dla W3, W5, W7, W8, W9
(celowo „nie zidentyfikowano" zamiast zgadywania); pełny scroll wewnętrznej listy w zakładce Przydzielone
(wiersze będące źródłem W5 potwierdzone tylko telemetrią, nie zrzutem 1:1).

**Ekran flagowy Wywiad:** **lista główna „Skrzynka" przy 1920 px** (`01c-lista-glowna-1920-full.png`) —
jedyny wariant z zerem przepełnień, czytelną tabelą, chipami statusu, paskiem postępu i poprawnym pstryczkiem
kolumn. **Nie** pokazywać wariantu 1280 px (W3 — realna utrata treści), podglądu (W6) ani interakcji ze
stepperem (W2) przed naprawą.

---

## 4. NARZĘDZIA

| Ekran | Trasa | A | B | Kluczowe odchylenia |
| --- | --- | :-: | :-: | --- |
| Biblioteka (hub) | `/discovery-tools` | 3 | 1 | Crimson dla kategorii „Oceny" (stan niekrytyczny); brak checkboxów/bulk mimo kontraktu T15; pusty slot AI w Menu 3; przelewanie „Licencjonowane". `narzedzia/01-root.png`, `01e-root-oceny.png` |
| Analiza strategiczna | `/discovery-tools/strategic` | 2 | 1 | Gołe, wolne ładowanie 3–5 s bez powłoki aplikacji; te same defekty co hub. `04-strategic.png`, `04b-strategic-wait.png` |
| Megatrendy | `…/strategic/megatrends` | 0 | 2 | `GET /api/megatrends/baseline` trwale 503 — ekran nigdy nie pokazuje danych, „Spróbuj ponownie" też pada; sam stan błędu zaprojektowany poprawnie. `05b-megatrends-wait.png`, `05c-megatrends-retry.png` |
| Operacyjne | `/discovery-tools/operational` | 1 | 1 | Ekstremalnie wolne pierwsze ładowanie (5–10 s, goły spinner); status „Nieaktywny" w podglądzie jako wypełniona czerwona pigułka. `06c-operational-wait10.png`, `07-operational-row-open.png` |
| Cyfrowe | `/discovery-tools/digital` | 2 | 1 | Wolne pierwsze ładowanie; kebab poprawny (disabled z wyjaśnieniem); te same defekty systemowe. `08-digital.png`, `09-digital-kebab.png` |
| Automatyzacja procesów | `…/process-automation` | 3 | 1 | Stabilnie (1 wiersz danych); te same defekty systemowe. `10-process-automation.png` |

**Średnia Narzędzia: A = 1,83 · B = 1,17** (6 tras). Dodatkowo zmierzono drill-down z hubu (podgląd i pełny
widok „Dynamic SWOT" — jedyne aktywne narzędzie), opisany przy hubie i w uchybieniu N7.

### Pełna lista uchybień (Narzędzia)

**N1. Brak checkboxów/trybu masowego w tabeli Biblioteki, mimo że kontrakt to deklaruje.**
Dowód: `01-root.png(.json)`. Plik: `src/components/Discovery/DiscoveryToolsHub.tsx:4066` (wywołanie
`<StandardTable>` bez propa `selection`) vs kontrakt `src/contracts/tableSurface/surfaceRegister.ts:369-388`
(T15: `bulkActions: ['add-to-process']`, domyślnie `selection:'bulk'`).
Naprawa: podłączyć `selection` i zaimplementować akcję masową. Effort **M** · Impact **M**.

**N2. Crimson/danger użyty dla stanu niekrytycznego** (pułapka nr 1 z `CLAUDE.md`): kategoria „Oceny" na
czerwono w tabeli, status „Nieaktywny" jako wypełniona czerwona pigułka w podglądzie.
Dowód: `01e-root-oceny.png`, `07-operational-row-open.png`.
Plik: `src/components/Discovery/DiscoveryToolsHub.tsx:318` (`licensed: { name:'Oceny', textClass:'text-danger-700…' }`),
`src/components/DiscoveryTools/KnownToolPreviewV3.tsx:287-293` (`bg-danger-50 text-danger-700` dla „Inactive").
Naprawa: neutralny ton kategorii; cichy chip z kropką dla „Nieaktywny". Effort **S** · Impact **M**.

**N3. Kolumna LICENCJA (100 px) za wąska — „Licencjonowane" przelewa się o 48 px.**
Dowód: sidecary `02-root-pstryczek.png.json`, `03-dynamicswot-open.png.json`, `11-flagship-1280.png.json`.
Plik: `DiscoveryToolsHub.tsx:~2019-2033` (kolumna `license`, `width:'100px'`). Effort **S** · Impact **L**.

**N4. Menu 3 nie ma przycisku AI po prawej (kanon pkt 7) — slot jawnie pusty w kodzie.**
Dowód: `01-root.png`. Plik: `DiscoveryToolsHub.tsx` ~linia 5639, komentarz „Right slot: contextual AI / actions —
empty for now, reserved per §3.4". Naprawa: dodać funkcjonalny przycisk albo formalnie zarejestrować odstępstwo.
Effort **M** · Impact **L**.

**N5. `/api/megatrends/baseline` trwale 503 — ekran „Megatrendy" martwy.** Trzykrotnie zarejestrowany
status 503, ponowienie też pada. Dowód: `05b-megatrends-wait.png(.json)`, `05c-megatrends-retry.png(.json)`.
Plik: `server/src/routes/megatrend.routes.ts:18-31` (`notConfigured` 503, gdy `MegatrendService?.getBaselineTrends`
niedostępne); przyczyna: dynamiczny `import('../models/megatrend.js')` (~linia 46) nie rozwiązuje się w tym
środowisku, mimo że plik istnieje jako `server/src/models/megatrend.ts`.
Naprawa: naprawić rozwiązywanie importu `.js`→`.ts` / zweryfikować, że serwis jest budowany przed startem.
Effort **M/L** · Impact **H** — cały ekran nigdy nie pokazuje treści.

**N6. Bardzo wolne, gołe ładowanie bez powłoki aplikacji** na `/operational` (5–10 s) i `/strategic` (3–5 s).
Dowód: `06-operational.png`, `06b-`, `06c-…wait10.png`; `04-strategic.png`, `04b-…wait.png`.
Plik: nie zidentyfikowano jednoznacznie (prawdopodobnie code-splitting per widok).
**Zastrzeżenie uczciwości:** może to być artefakt dev-servera (zimna kompilacja Vite) — wymaga weryfikacji
na buildzie produkcyjnym. Naprawa (jeśli się utrzyma): natychmiastowy app-shell zamiast pustego ekranu.
Effort **S/M** · Impact **M**.

**N7. Nakładające się teksty w nagłówku pełnego widoku „Dynamic SWOT" przy ~1440 px** — „Aktywne"/„Sekcje"
oraz „Zapisano"/„Baza wiedzy" renderowane w tym samym miejscu; przy 1920 px poprawnie.
Dowód: `13-dynamicswot-fullopen.png(.json)` vs `14-dynamicswot-fullopen-1920.png`.
Plik: `src/components/shared/NModeLayout/NModeHeader.tsx:354-450` (`statusLabel` L432, stan zapisu ~L440)
w połączeniu z `inlineActions` z `src/components/DiscoveryTools/KnownToolDetailView.tsx:2521-2540`.
Naprawa: ograniczenia szerokości/zawijanie między tytułem a akcjami zamiast `lg:flex-nowrap` bez rezerwy.
Effort **M** · Impact **H** — to jedyne w pełni aktywne narzędzie modułu, a defekt widać na standardowej
szerokości laptopa.

**N8. CTA „Dodaj narzędzie" łamie się do dwóch linii przy 1280 px, przepełnienie paska Menu 2 o 27 px.**
Dowód: `11-flagship-1280.png(.json)`. Plik: nie zidentyfikowano dokładnie (`PrimaryCta`/`StandardModuleBar`).
Naprawa: `whitespace-nowrap` lub responsywne skrócenie etykiety. Effort **S** · Impact **L**.

**NIE_DOTARŁEM (Narzędzia):** tryb ciemny (harness wymusza jasny, linie 33-42 skryptu); pełny cykl klawiatury
Tab/Esc (brak interaktywnej zalogowanej sesji w tym uruchomieniu); pozostałe zakładki Megatrendów
(„Mapa radaru trendów", „Szczegóły trendu", „Własne trendy", „Wnioski AI" — dzielą ten sam serwis, więc
prawdopodobnie ten sam defekt, ale nie zmierzono); widok Grid w Bibliotece (widoczny, nieklikany);
realny canvas sesji narzędzia po „Rozpocznij sesję" (celowo pominięty — zakaz tworzenia rekordów).

**Ekran flagowy Narzędzia:** **hub `/discovery-tools` (Biblioteka)** — jedyny ekran z realnym, aktywnym
narzędziem i jedyne miejsce pokazujące pełną triadę tabela → podgląd → pełny widok. Uwaga: „flagowy" znaczy
tu „najbardziej reprezentatywny", **nie** „gotowy na scenę bez poprawek" — ma udokumentowane defekty
(N1, N2, oraz N7 w widoku pełnym przy 1440 px). To najsłabszy moduł całego audytu i jedyny z oceną 0 (Megatrendy).

---

## Zbiorczo — część A

| Moduł | Ekranów/stanów | Śr. A | Śr. B |
| --- | :-: | :-: | :-: |
| Moja Praca | 25 | 2,48 | 2,32 |
| Czat AI | 7 | 2,57 | 2,43 |
| Wywiad | 13 | 2,46 | 2,23 |
| Narzędzia | 6 | 1,83 | 1,17 |
| **Razem** | **51** | **2,41** | **2,18** |

---

## TOP 10 znalezisk części A wg wpływu/nakładu

| # | Znalezisko | Moduł | Impact | Effort |
| :-: | --- | --- | :-: | :-: |
| 1 | Cały archetyp `InitiativeFullView` w 100 % po angielsku (wejście z kalendarza) | Moja Praca | H | L |
| 2 | Panel Teresy jako trzecia stała kolumna — tabela ścieśniona do jednej kolumny przy 1280 px | Moja Praca, Wywiad | H | L |
| 3 | `/api/megatrends/baseline` trwale 503 — cały ekran Megatrendów martwy | Narzędzia | H | M/L |
| 4 | Canvasy pomysłu ładują się 4–6 s w kompletnej ciszy (bez szkieletu) | Moja Praca | H | M |
| 5 | Nakładające się teksty nagłówka „Dynamic SWOT" przy 1440 px | Narzędzia | H | M |
| 6 | Klik w stepper przewija cały nagłówek i chowa breadcrumb | Wywiad | H | M |
| 7 | Panel „Dane"/SystemHealth pokazuje diagnostykę techniczną każdemu użytkownikowi w każdym module | Czat (globalnie) | H | M |
| 8 | Dane testowe/QA („QA folder 1778…", „test Tomek") widoczne w Historii czatu | Czat | H | S |
| 9 | Nagłówki kolumn ucinane do 3–4 znaków bez tooltipa (`FilterableTable:788-789`) | Moja Praca, Wywiad, Narzędzia | M | S |
| 10 | Crimson dla stanów niekrytycznych („Oceny", „Nieaktywny") | Narzędzia | M | S |

### Pozytywne wzorce warte skopiowania
- **Idea Workspace (Moja Praca)** — jeden prawy panel z zakładkami Element/Teresa; wzorzec, do którego
  należy sprowadzić ekrany listowe całego produktu.
- **Kebab i pstryczek kolumn w Mojej Pracy i Wywiadzie** — trzy strefy, poprawne separatory, wyszarzenie
  z podanym powodem; zgodne z kanonem bez zastrzeżeń.
- **Decyzje i Sejf klienta (Moja Praca)** — 3/3 na liście, podglądzie i kebabie; gotowy dowód, że kanon
  triady jest wykonalny w tym kodzie.
- **Stan błędu Megatrendów** — zaprojektowany poprawnie (ikona, tekst, „Spróbuj ponownie"); problemem jest
  backend, nie ekran.

## Rekomendacje „ekran flagowy" — podsumowanie części A

| Moduł | Rekomendowany ekran | Warunek pokazania |
| --- | --- | --- |
| Moja Praca | Skrzynka — tabela z otwartym podglądem | po naprawie MP1+MP3 (jeden zwijalny panel) i MP2 (szerokości kolumn) |
| Czat AI | Otwarta konwersacja @1920 px | po dodaniu klucza i18n `trust.badge.sources` i wyczyszczeniu danych testowych |
| Wywiad | Lista główna „Skrzynka" @1920 px | gotowy; nie pokazywać wariantu 1280 px ani interakcji ze stepperem |
| Narzędzia | Biblioteka `/discovery-tools` | po naprawie crimsonu (N2) i nagłówka Dynamic SWOT (N7) |

## Liczby

- Ekranów/stanów zmierzonych na żywo: **51** (Moja Praca 25 · Czat 7 · Wywiad 13 · Narzędzia 6).
- Średnia A (Stabilność): **2,41 / 3**. Średnia B (Spójność grafiki): **2,18 / 3**.
- Ekranów gotowych bez zastrzeżeń (A = 3 i B = 3): **13 z 51**.
- Ekranów z realnym błędem 4xx/5xx w konsoli: **11 z 51** (Czat 4, Moja Praca 6, Narzędzia 1).
- Ocen 0: **2** (Megatrendy A = 0 — ekran martwy; workspace Inicjatywy z kalendarza B = 0 — cały ekran po angielsku).
- Pozycji `NIE_DOTARŁEM`: 1 wprost (Kalendarz → widok „Lista") + tryb ciemny i pełny cykl klawiatury
  dla wszystkich czterech modułów (ograniczenie harnessu, nie brak dostępu).

## Indeks dowodów

`evidence/audyt-award-20260905/{moja-praca,czat,wywiad,narzedzia}/` — 100 zrzutów `.png` z sidecarami
`.png.json` (błędy konsoli, odpowiedzi ≥400, żądania >5 s, przepełnienia poziome, podejrzane teksty).
Pliki z sufiksem literowym (`09b-`, `14b-`, `05c-`) to kolejne próby tego samego ekranu przy dłuższym
oczekiwaniu — ostatnia w serii jest wersją cytowaną. Pliki `_zoom-*.png` i `*-zoom.png` to kadry
powiększone użyte do weryfikacji separatorów, kolorów i przepełnień.
