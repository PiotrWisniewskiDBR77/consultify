# P10 — MATRYCA 22 KART N × KONTRAKT K1…K30 (DEC-429)

Kontrakt: `docs/ssot/KARTA_N_KONTRAKT.md`. Pomiar **na żywo**: stanowisko lokalne API `127.0.0.1:4100`
(health 200, `database=connected`), własny vite z worktree `mvp/p10s-kontrakt-kart-n` na porcie 3102
(`VITE_DOTENV_DISABLED=1`, `VITE_API_TARGET=http://127.0.0.1:4100`), organizacja **DBR77**
(`cc9db573-260f-4a19-927f-f3cc1fbaea38`), użytkownik `audyt@dbr77.local` (OWNER), 06.09.2026 19:3x–20:2x.
Zrzuty 1440 · motyw jasny · `evidence/p10-matryca/`. **Zero rekordów utworzonych** — wszystkie rekordy
zastane (jeden kreator prezentacji otworzył się przypadkiem i został zamknięty bez zapisu).

Legenda: `✓` spełnia · `✗` nie spełnia · `~` częściowo/warunkowo · `n/d` nie da się zmierzyć (powód w §3).
Inwentarz = **22 karty**: 13 z `src/components/standard/registry.ts` + 9 jawnych wyjątków
z `src/components/standard/__tests__/registry.kompletnosc.test.ts:30-40` (test `pokryte.size === 22`).
Zlecenie mówiło o 21 — liczba w kodzie to 22; różnicę zgłaszam, nie zaokrąglam.

---

## §1. MATRYCA GŁÓWNA

Kolumny: **K1** kontrakt sekcji · **K2** kontrakt steruje renderem · **K7** prawy panel = tabela
Właściwości · **K8–K10** Powiązania/Źródła/Historia · **K12** Menu 5 · **K14** Edycja/Podgląd wg prawa ·
**K19** pigułka w pasku modułu · **K21** „Pracuj z AI" (3 pozycje) · **K25** brak angielskiego ·
**K27** Teresa tylko w Menu 1.

| # | karta | moduł / trasa | jak otworzyć (realny rekord) | K1 | K2 | K7 | K8–10 | K12 | K14 | K19 | K21 | K25 | K27 | zrzut |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | task | My Work · `/my-work` | Zadania → „DBR77: Ustawić monitoring i alerting dla backendu" → Otwórz | ✓ `taskCardContract.ts` | ✗ flaga OFF (`TaskDetailView.tsx:316-317`) | ✓ | ✓ | ✓ pełny | ✓ | ✓ | ✓ | ✓ | ✓ | `01-task.png` |
| 02 | decision | My Work · `/my-work/decisions` | Decyzje → „DBR77: Czy włączamy publiczne linki do raportów?" → Otwórz | ✓ `decisionCardContract.ts` | ✗ flaga OFF (`DecisionDetailView.tsx:529`) | ✓ | ✓ | ✓ pełny | ✓ | ✓ | ✓ | ✓ | ✓ | `02-decision.png` |
| 03 | notification | My Work · `/my-work` | Skrzynka → „AI: Sugestia priorytetu · System · DBR77" → Otwórz | ✓ `notificationCardContract.ts` | ✗ flaga OFF (`NotificationDetailView.tsx:288`) | ✓ | ~ Komentarze renderują się („KOMENTARZE 0”), choć SPEC-N §7 #3 przewiduje ich brak dla wiadomości systemowej | ~ brak „Sekcje ▾" (2 sekcje) | ✓ | ~ pigułka = „Powiadomienie", nie tytuł | ✓ | ✗ „Typ powiadomienia: **Escalation**" | ✗ `TeresaMark` w karcie (`:1696`, `:3453`) | `03-notification.png` |
| 04 | note | My Work · `/my-work?notebook=…` | Notatnik → „Moje notatki" → „Q2 Strategy — Market expansion playbook" | ✗ brak | ✗ | ✗ brak panelu | ✗ | ✗ brak Menu 5 | ✗ | ✗ (breadcrumb bez pigułki) | ✗ | ~ | ✓ (Teresa = dok Menu 1, `:4228`) | `04-note.png` |
| 05 | idea | My Work · `/my-work/ideas/:id/workspace/whiteboard` | Pomysły → „AI monitoring jakości" → Otwórz | ✗ brak | ✗ | ~ wiersze bez nagłówka tabeli | ✓ | ✗ (Menu 3 ma „Panel" i „AI") | ✗ | ✓ | ✗ „AI" otwiera **czat Teresy** | ~ | ✗ zakładka „Teresa" w prawym panelu | `05-idea.png`, `05-idea-ai.png` |
| 06 | vault-document | My Work · Sejfy | oba sejfy mają **0 dokumentów** | ✗ brak | ✗ | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | `06-vault-lista.png` |
| 07 | initiative | Inicjatywy · `/initiatives?mode=doc&open=…` | Inicjatywy → „Supply Chain Optimization" → Otwórz | ✓ `initiativeCardContract.ts` (35 kart) | ✗ flaga OFF (`initiativeCardContract.ts:1118`) | ✓ | ✓ (+ Rezultaty) | ✓ pełny | ✓ | ✓ | ✓ | ✓ | ✓ (Teresa usunięta świadomie, `:162-168`) | `07-initiative.png` |
| 08 | plan | Inicjatywy · `/initiatives?tab=plan` | Plan → „Plan klikany P11 — Controls Engineer" → Otwórz | ~ `StandardSekcjaDef` w komponencie | ✓ (sekcje z tablicy sterują) | ✗ akapit „Portfel źródłowy · v4" | ~ Historia = „Wersja 3" | ✗ trzy OSOBNE przyciski AI zamiast Menu 5 | ✗ | ✗ | ✗ 3 przyciski, brak listy | ✗ „**WEEK** · Europe/Warsaw" | ✓ | `08-plan.png` |
| 09 | capacity_analysis | Inicjatywy · `/initiatives?tab=capacity` | Obciążenie → „Analiza obciążenia — Controls Engineer" → Otwórz | ~ `StandardSekcjaDef` | ✓ | ✗ akapit | ~ | ✗ jak wyżej | ✗ | ✗ | ✗ | ✓ | ✓ | `09-capacity.png` |
| 10 | insight | Wywiad · `/interview?tab=insights` | Wnioski → „Example: failed insight (for UI states)" → Otwórz | ✓ `insightCardContract.ts` (30 kart) | ✗ flaga OFF (`InsightViewer.tsx:182-186`) | ✓ | ✓ | ✓ pełny | ✓ | ✓ | ~ „Uzupełnij cały dokument" wyszarzone | ~ tytuł rekordu EN (dane) | ✓ | `10-insight.png` |
| 11 | interview | Wywiad · `/interview?tab=sessions` | Sesje → „Inbox — Quick assessment (my assignment)" → Otwórz | ✓ `interviewCardContract.ts` | ✗ flaga OFF (`InterviewWorkspace.tsx:1940`) | ✗ brak prawego panelu | ✗ | ✗ brak Menu 5 (ekran-kreator pytań) | ✗ | ✓ | ✗ | ~ pytania seeda EN | ✓ | `11-interview.png` |
| 12 | metric (KPI) | Wyniki · `/results/kpi/:kpiId` | KPI → raport „KPI jakości — sierpień 2026" → „WARTOŚĆ REKLAMACJI" → „Otwórz KPI" | ✗ brak katalogu | ✗ | ✓ | ✓ | ~ „Sekcje ▾" + AI; brak Edycja/Podgląd | ✓ ZGODNIE z K14 (powód wypisany) | ✓ | ✓ (tylko „Analizuj" — read-only) | ✓ | ✓ | `12-metric.png` |
| 13 | objective (OKR) | Wyniki · `/results/okr/:setId/objectives/:id` | OKR → zestaw → „Uruchomić zrobotyzowane gniazdo spawalnicze" | ✗ brak katalogu | ✗ | ✓ | ✓ | ~ jak KPI | ✓ ZGODNIE z K14 | ✓ | ✓ (read-only) | ✓ | ✓ | `13-objective.png` |
| 14 | roi_case | Wyniki · `/results/roi/:roiCaseId` | ROI → „Automatyzacja magazynu WIP" | ✗ brak katalogu | ✗ | ✓ | ✓ | ~ jak KPI | ✓ ZGODNIE z K14 | ✓ | ✓ (read-only) | ✓ | ✓ | `14-roi.png` |
| 15 | action | Wyniki · sekcja „Karty działania" karty KPI | **brak rekordu**: „Otwarte działania 0" we wszystkich 3 raportach KPI | ~ `ActionCard.types.ts` (model, nie kontrakt sekcji) | ✗ | n/d | n/d | n/d | n/d | n/d | ✗ brak `PracujZAI` w `ActionCard.tsx` | n/d | ✓ | `15-action.png` |
| 16 | tool | Narzędzia · `/discovery-tools?docId=known:…` | Biblioteka → „Dynamic SWOT" → Otwórz | ✓ `toolCards.contract.ts` (4 karty) | ✗ flaga OFF (`KnownToolDetailView.tsx:109`) | ✓ | ~ panel skrócony (Akcje+Właściwości) | ✗ Menu 5 wtopione w Menu 4 | ✗ | ✓ | ✗ przycisk „**Analizuj**", nie „Pracuj z AI" | ✓ | ✓ | `16-tool.png` |
| 17 | tool-document | Narzędzia · `/discovery-tools?tab=sessions&docId=…` | Sesje → „SWOT — ekspansja DACH 2026" → Otwórz | ✗ brak katalogu | ✗ | ✓ | ✓ | ~ sam „Pracuj z AI" (brak Sekcje/Edycja) | ✓ ZGODNIE z K14 („sesja zatwierdzona") | ✓ | ✓ (read-only) | ✓ | ✗ „COPILOT AI: Wyostrz z AI / Szkicuj z AI" + 2× `primary-[0-9]` | `17-tooldoc.png` |
| 18 | audit-criterion | Audyty · `/audit-programs/:programId/criteria/:criterionId` | Sesje → „Audyt procesu zakupowego Q3" → kryterium „D1.1" | ✗ brak katalogu | ✗ | ~ wiersze bez nagłówka tabeli | ~ brak Powiązań/Źródeł/Historii | ✗ własny pasek „Faza audytu" | ✗ | ✗ brak paska modułu | ✗ | ✓ | ✗ przycisk „Teresa" w nagłówku + `TeresaProposalCard` (`:1290`, `:1682`) | `18-audit-criterion.png` |
| 19 | audit-report | Audyty · `/audit-programs/reports/:reportId` | Raporty → „Raport poaudytowy — Output…" → Otwórz | ✗ brak katalogu | ✗ | ✓ | ✗ tylko Akcje+Właściwości | ✗ brak Menu 5 | ✗ | ✗ brak paska modułu | ✗ | ✗ „Macierz **traceability**" | ✓ | `19-audit-report.png` |
| 20 | assessment-report | Ocena · `/assessment/outputs/:outputId/report` | Raporty → „DRD Manufacturing — Executive Summary…" → Otwórz | ~ własny kontrakt raportu w komponencie | ✗ | ✗ brak prawego panelu | ✗ | ✗ brak Menu 4 i Menu 5 | ✗ | ✗ brak paska modułu | ✗ | ~ tytuł rekordu EN | ✓ | `20-assessment-report.png` |
| 21 | presentation | Materiały · `/presentations/builder/:deckId` | Prezentacje → „Nowa prezentacja" → Otwórz | ✗ brak katalogu | ✗ | ~ wiersze bez nagłówka tabeli | ✓ (Powiązania/Źródła/Komentarze/Historia) | ✗ własny pasek edytora slajdów | ✗ | ✗ brak paska modułu | ✗ | ✓ | ✗ „Zapytaj Teresę" w stopce | `21-presentation.png` |
| 22 | meeting | Spotkania · `/meetings` | **moduł poza MVP**: „Spotkania — planowane w Fali 2" | ✗ brak katalogu | ✗ | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | `22-meeting-hub.png` |

**Liczby:** kart w inwentarzu **22** · otwartych na żywo **19** (86 %) · z „Pracuj z AI" **9** ·
z kontraktem sekcji w kodzie **7** (+2 słabsze) · z kontraktem STERUJĄCYM renderem **0** ·
z pełnym prawym panelem wg K6–K11 **11** · z pigułką w pasku modułu **12** · bez wycieku Teresy **17**.

---

## §2. DWA USTALENIA PRZEKROJOWE (ważniejsze niż pojedyncze komórki)

**(A) Kontrakt istnieje i jest wyłączony we WSZYSTKICH kartach.** Siedem katalogów
`KanonicznaKarta` (task, decision, notification, insight, initiative, tool, interview) czyta wyłącznie
flaga `VITE_VF1_*_CARD_CONTRACT`, której rozwiązanie kończy się twardym `return false`
(np. `TaskDetailView.tsx:316-317`), a w `server.env` stanowiska nie ma żadnej z nich. To znaczy:
**na każdym dzisiejszym ekranie kontrakt nie bierze udziału w renderze** — prawdą ekranu są tablice
sekcji w komponentach. Kształt „biblioteka bez wywołania" w czystej postaci.

**(B) „Pracuj z AI" jest zbudowane raz i podpięte w 9 z 22 kart.** Współdzielony `PracujZAI.tsx`
(trzy pozycje, propozycja→Zatwierdź, `c-ai`, `c-focus`) renderuje się w: notification, decision, task,
insight, initiative, metric, objective, roi_case, tool-document. W pozostałych 13 kartach jest albo
stary przycisk „Analizuj" (tool), albo trzy osobne przyciski (plan, capacity_analysis), albo przycisk
„AI" otwierający czat Teresy (idea), albo nic (note, interview, action, audit-criterion, audit-report,
assessment-report, presentation, meeting, vault-document). To jest dokładnie to, o co upomina się
właściciel w DEC-429.

---

## §3. CZEGO NIE ZMIERZYŁEM I DLACZEGO (STOP-y)

| karta | co blokuje | jaki rekord jest potrzebny i jak go zrobić |
|---|---|---|
| action | „Otwarte działania 0" we wszystkich trzech raportach KPI DBR77; sekcja „Karty działania" na karcie miernika pokazuje „Brak kart działania — żaden rezultat tego miernika nie wyszedł poza limit" | karta działania powstaje z **odchylenia KPI**: miernik z rezultatem poza progiem → sekcja „Odchylenia" → sprawa odchylenia → `POST /api/vnext/results/kpi/deviation-cases/:caseId/recovery-card`. Potrzebny seed jednego odchylenia na mierniku „ŚREDNI CZAS ODPOWIEDZI NA REKLAMACJE" (dziś status „Ostrzeżenie”, ale bez sprawy). **Nie tworzyłem — to byłby rekord testowy w danych pokazowych.** |
| meeting | moduł Spotkania zwraca zaślepkę „Spotkania — planowane w Fali 2. Ten moduł nie wchodzi jeszcze do MVP." | pomiar możliwy dopiero po odmrożeniu modułu; do tego czasu `MeetingObjectPage.tsx` mierzalny wyłącznie po kodzie (ma `StandardArtifactShell` 6×, `ArtifactRightPanel` 1×, brak `PracujZAI`) |
| vault-document | oba sejfy DBR77 („Mój sejf", „Sejf organizacji") mają **0 dokumentów** | wgranie jednego pliku do sejfu organizacji (`/my-work` → Sejfy → sejf → Dodaj dokument). Wymaga zgody właściciela na dokument w danych pokazowych — dlatego STOP, nie działanie |

Dodatkowo: rejestr KPI (`/results/kpi`) zwraca **3× HTTP 404** przy wejściu (K29) — zapisane
w `evidence/p10-matryca/12-metric-lista.png.json`. Nie ustalałem, który zasób; to osobne zgłoszenie.

---

## §4. LUKI → PAKIETY PRACY

Rozmiar: S ≤ pół dnia robotnika · M ≤ 1 dyżur · L ≥ 1 dyżur z ryzykiem.

### Pakiet 1 — „Pracuj z AI" w brakujących kartach (rdzeń DEC-429)
| # | karta | co zrobić | rozmiar | kto |
|---|---|---|---|---|
| 1.1 | tool | zamienić przycisk „Analizuj" na współdzielony `PracujZAI` (karta ma już `TOOL_CARDS` i kryteria w rubryce) | S | Sonnet |
| 1.2 | plan, capacity_analysis | trzy osobne przyciski → jedna lista `PracujZAI` w slocie `aiButton` (`StandardArtifactShell` już ma slot) | S | Sonnet |
| 1.3 | idea | „AI" przestaje otwierać Teresę; wchodzi `PracujZAI` na polach inspektora elementu | M | Opus |
| 1.4 | note | `PracujZAI` na dokumencie notatki (sekcje: dokument, powiązania, historia) | M | Sonnet |
| 1.5 | audit-report, assessment-report, presentation | `PracujZAI` na sekcjach dokumentu (raport ma 13 sekcji, oceny 6, deck — narracja) | L | Opus |
| 1.6 | interview | rozstrzygnąć: karta sesji dostaje `PracujZAI` na notatce konsultanta i podsumowaniu (to jest ekran, przy którym padła DEC-407) | M | Opus |
| 1.7 | action, audit-criterion, vault-document, meeting | uzupełnić kryteria w `cardAnalysisRubric.ts` (dziś `[]` albo brak typu) i podpiąć `PracujZAI` | M | Codex P10 r2 |

### Pakiet 2 — kontrakt, który steruje renderem (K2)
| # | zakres | co zrobić | rozmiar | kto |
|---|---|---|---|---|
| 2.1 | 7 kart z katalogiem | włączyć flagi `VITE_VF1_*_CARD_CONTRACT` **po jednej karcie**, z odbiorem na zrzucie (CLAUDE.md reguła 9: zakaz masowego włączania) | M | Sonnet + odbiór |
| 2.2 | 15 kart bez katalogu | spisać kontrakt ZASTANY per karta (sekcja · etykieta pl/en · źródło · rola AI) jako propozycję do słowa właściciela | L | Codex P10 r2 Faza B |
| 2.3 | wszystkie | reguła pustki K4: sekcja bez danych znika + test „bez danych brak / z danymi jest" | M | Codex P10 r2 |

### Pakiet 3 — powłoka: prawy panel, Menu 5, pasek modułu
| # | karta | co zrobić | rozmiar | kto |
|---|---|---|---|---|
| 3.1 | plan, capacity_analysis | akapit → `ArtifactPropertiesTable` (K7) | S | Sonnet |
| 3.2 | audit-report, assessment-report, presentation, audit-criterion | przywrócić pasek modułu z pigułką otwartej karty (K19) | M | Sonnet |
| 3.3 | audit-report | Powiązania · Źródła i założenia · Komentarze · Historia w prawym panelu (K8–K10) | S | Sonnet |
| 3.4 | interview, note, assessment-report | prawy panel wg K6–K11 (dziś brak) | L | Opus |
| 3.5 | idea, presentation, audit-criterion | nagłówek tabeli „Właściwość \| Wartość" | S | Sonnet |

### Pakiet 4 — Teresa i język
| # | zakres | co zrobić | rozmiar | kto |
|---|---|---|---|---|
| 4.1 | idea, audit-criterion, presentation, tool-document, notification | usunąć wejścia do Teresy z kart (DEC-404/419); wzorzec usunięcia jest w `InitiativeDocumentView.tsx:162-168` | M | Sonnet |
| 4.2 | notification | „Typ powiadomienia: **Escalation**" → słownik pl (`Eskalacja`) | S | Sonnet |
| 4.3 | plan | „WEEK · Europe/Warsaw" → „Tydzień · Europa/Warszawa" | S | Sonnet |
| 4.4 | audit-report | „Macierz traceability" → „Macierz identyfikowalności"; skrócone etykiety spisu sekcji (K13) | S | Sonnet |
| 4.5 | tool-document | usunąć 2× `primary-[0-9]` (K17) | S | Sonnet |

---

## §5. PYTANIA DO WŁAŚCICIELA (tylko tam, gdzie potrzebna decyzja produktowa)

| # | pytanie | rekomendacja | co się stanie po „Tak” |
|---|---|---|---|
| P1 | Czy **wszystkie 22 karty** mają dostać „Pracuj z AI", łącznie z tymi, gdzie AI nie ma czego pisać (plan, analiza obciążenia, kryterium audytu — treść liczy solver/audytor)? | **Tak, ale z jedną pozycją**: tam „Pracuj z AI" ma pokazywać samą „Analizuj", a pozycje „Uzupełnij…" mają być wyszarzone z powodem („treść pochodzi z solvera") — zamiast znikać bez wyjaśnienia | Przycisk jest wszędzie, ale nie obiecuje generowania tam, gdzie generować nie ma z czego |
| P2 | Czy **9 kart poza rejestrem** (notatka, pomysł, kryterium audytu, raport audytu, raport oceny, dokument narzędzia, prezentacja, spotkanie, dokument sejfu) wchodzi do `REJESTR_KART_N` jako pełne karty N? | **Tak dla 7**; „spotkanie" dopiero po odmrożeniu modułu (Fala 2), „dokument sejfu" po decyzji o writerze streszczenia | Karty wchodzą pod bramki K1–K30 i mogą wołać silnik AI (`CardAnalysisArtifactType = KartaNKey`) |
| P3 | Czy raport oceny i raport audytu mają być **kartami N w powłoce modułu** (pasek modułu, Menu 4/5, prawy panel), czy zostają dokumentami na pełną szerokość do czytania i eksportu? | **Kartami N** — dziś raport oceny gubi cały pasek modułu i użytkownik nie ma jak wrócić inaczej niż „wstecz" | Oba raporty dostają powłokę wspólną; centrum (treść dokumentu) zostaje bez zmian (SPEC-A archetyp B) |
| P4 | Czy **sekcja bez danych ma znikać** (K4), czy pokazywać się wyszarzona z „brak danych”? | **Znikać z treści, zostawać w spisie sekcji jako wyszarzona** — użytkownik widzi, że sekcja istnieje, ale nie czyta pustej ramki | Znikają dzisiejsze „pustki na wyrost" (10 sekcji policzonych w rundzie 1 Codexa), a karta nie traci mapy |
| P5 | Czy **karta działania** (`action`) zostaje osobną kartą N, skoro dziś nie ma ani jednego rekordu i nie da się jej otworzyć z żadnej listy? | **Tak, ale z własnym wejściem z listy** — dziś jest wyłącznie sekcją karty KPI, więc nikt jej nie „otwiera”; bez wejścia z listy nie ma czego mierzyć | Powstaje lista kart działania (Wyniki → Działania) i karta przechodzi bramki jak reszta |

---

## §6. DOWODY

Zrzuty 1440 · jasny · realna trasa · realny rekord: `evidence/p10-matryca/*.png` (+ `*.json` z adresem
końcowym i liczbą błędów konsoli). Wszystkie karty otwarte z listy, `url` ≠ `/login`.
Zrzuty z listami/hubami (`*-lista.png`, `*-hub.png`) są dowodem ŚCIEŻKI wejścia, nie dowodem karty.
