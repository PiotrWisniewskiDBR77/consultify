# Rozliczenie P0/P1 — Wave 3 (2026-09-03)

Wykonano jako dyżur robotnika w worktree `/private/tmp/ag-p0p1`
(gałąź `agent/p0p1-rozliczenie-20260903`, baza `/private/tmp/m03` HEAD `aa6f0c9713`).
Zero zmian w `src/`/`server/src/` — to dyżur AUDYTOWY, nie naprawczy.

## Cel i metoda

Zadanie: rozliczyć KAŻDĄ otwartą pozycję P0/P1 z `MASTER_STATUS_REGISTER.md` i z
16 plików `MODULE_ACCEPTANCE.md` — czy dziś (2026-09-03) jest realnym defektem, czy
dokument jest po prostu nieaktualny (kilkaset commitów napraw od 22–25.08).
Dodatkowo, zgodnie z poleceniem, przejrzano `*REGISTER*.md` w katalogu
`WAVE_03_ACCEPTANCE` — to ujawniło znacznie większy zbiór otwartych P0/P1 niż
tylko dwa nazwane źródła (patrz sekcja "Trzecie źródło" niżej).

Metoda weryfikacji per pozycja, w kolejności wiarygodności:
1. Commit — `git cat-file -e <SHA>` + `git merge-base --is-ancestor <SHA> HEAD`
   dla KAŻDEGO cytowanego SHA (24 unikalne SHA w głównym zbiorze — wszystkie 24
   istnieją i są przodkami HEAD; żaden nie jest sfabrykowany ani "wiszący").
2. Grep kodu — dla pozycji z konkretnym plikiem/linią/route z dokumentu,
   bezpośrednie `grep`/`sed -n` na dzisiejszym drzewie.
3. Test regresji — gdzie test istnieje i jego nazwa/treść dowodzi naprawy.
4. Gdzie żadna z powyższych metod nie rozstrzyga (wymaga żywego backendu/przeglądarki/
   AI providera) → NIEWERYFIKOWALNE STATYCZNIE, z jawnym podaniem co trzeba uruchomić.

## R1 — Inwentarz (mianownik)

### Źródło A+B (nazwane wprost w zleceniu): MASTER_STATUS_REGISTER.md + 16×MODULE_ACCEPTANCE.md

`MASTER_STATUS_REGISTER.md` (per-moduł tabela, brak ID pozycji — tylko liczby):
ASM 7/1, INI 3/6, MYW 11/18, CHAT 1/13 → 22 P0 / 38 P1 (suma z tabeli
per-moduł; wszystkie pozostałe 12 modułów mają 0/0).

`MODULE_ACCEPTANCE.md` (16 plików, wiersze z jawną kolumną Severity=P0/P1 w
tabeli "Owner UI/UX/CX register" lub równoważnej; dla 13_CHAT sama tabela ma
tylko WIERSZ ZBIOROWY CHAT-OWN-001–017 z zakresem P0–P2 bez rozbicia —
rzeczywiste priorytety per pozycja odzyskano z OWNER_REVIEW_2026-08-22.md,
gdzie każdy CHAT-OWN-0XX ma jawną linię "Priority: PX"):

| Moduł | P0 | P1 | Razem |
|---|---:|---:|---:|
| 02 Interview | 4 | 3 | 7 |
| 04 Assessment | 3 | 0 | 3 |
| 05 Initiatives | 5 | 5 | 10 |
| 06 Execution | 7 | 1 | 8 |
| 07 My Work | 11 | 23 | 34 |
| 09 Results | 5 | 3 | 8 |
| 10 Finance | 0 | 1 | 1 |
| 13 Chat | 1 | 13 | 14 |
| Razem (unikalne ID) | 36 | 49 | 85 |

Pozostałe 8 modułów (01 Organization, 03 Tools, 08 Meetings, 11 Materials,
12 Audits, 14 Admin, 15 Settings, 16 Partner) mają zero wierszy z jawnym
tagiem P0/P1 we własnym MODULE_ACCEPTANCE.md.

Mianownik źródła A+B: 85 unikalnych pozycji (36 P0 + 49 P1).

To NIE jest to samo co licznik MASTER_STATUS_REGISTER.md (22/38=60) — rozbieżność
85 - 60 = 25 pozycji więcej w plikach modułów niż w tabeli master. Przyczyna: sama
tabela master pokazuje TYLKO 4 moduły z niezerowymi licznikami (ASM, INI, MYW, CHAT),
ale pliki modułów 02_INTERVIEW, 06_EXECUTION i 09_RESULTS mają WŁASNE, niezerowe
tabele P0/P1 (odpowiednio 7, 8, 8 pozycji), których MASTER_STATUS_REGISTER.md w ogóle
nie odzwierciedla w kolumnach Open P0/Open P1 (tam stoi 0 dla tych trzech modułów).
To jest dokładnie rozjazd "dwa rejestry — licznik mierzy rozjazd, nie brak w bazie": master
i moduł liczą co innego, a różnica nie oznacza że 25 pozycji zniknęło z bazy.

### Trzecie źródło (polecenie: "także *REGISTER*.md w tym katalogu")

Przejrzano wszystkie 11 plików *REGISTER*.md w WAVE_03_ACCEPTANCE/ (rekurencyjnie).
8 z nich (01_ORGANIZATION, 13_SETTINGS, 14_ADMIN, 15_AI_OS, 16_PARTNERS,
CROSS_MODULE/OWNER_FEEDBACK_REGISTER, CROSS_MODULE/ROW_MENU_AUDIT_REGISTER,
DECISION_REGISTER) mają zero wierszy z tagiem P0/P1. INTERVIEW_RECOMMENDATION_REGISTER.md
ma 7 wpisów (REC-INT-001..007), ale to jest przepakowanie TYCH SAMYCH 7 pozycji
Interview z MODULE_ACCEPTANCE.md (każdy REC-INT-XXX jawnie cytuje swój INT-XXX-OWN-001
źródłowy) — NIE nowe pozycje, tylko dodatkowy dowód (część z nich niesie nowsze SHA niż
sam MODULE_ACCEPTANCE.md — wykorzystano to w rozliczeniu Interview niżej).

Dwa pliki niosą JEDNAK naprawdę nowe, nieprzeliczone pozycje P0/P1, o których
MASTER_STATUS_REGISTER.md milczy całkowicie (tam TLS: 0/0, P2=1; ASM: 7/1 —
oba dowodząc, że master nie widzi tego zbioru):

- owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md — osobny rejestr,
  intake 2026-08-23, 27 pozycji P0/P1 (24 P0 + 3 P1) pod ID ASM-OWN-001..028
  (jeden numer, 004, jest PRESERVE — pozytyw, nie liczony). UWAGA — kolizja ID:
  ten plik używa TEJ SAMEJ przestrzeni ID ASM-OWN-00X co 04_ASSESSMENT/MODULE_ACCEPTANCE.md,
  ale to SĄ RÓŻNE ZNALEZISKA pod tymi samymi numerami (np. ASM-OWN-001 w
  MODULE_ACCEPTANCE.md = "brak połączenia z backendem / 404", a ASM-OWN-001 w
  OWNER_FEEDBACK_REGISTER.md = "Library ma być czystą biblioteką metodologii"). To jest
  defekt higieny dokumentacji sam w sobie — dwa niezależne dyżury użyły tej samej
  numeracji dla różnych rzeczy. W tabeli niżej rozróżniam je przyrostkiem [OF]
  (OWNER_FEEDBACK_REGISTER) — brak przyrostka w sekcji głównej oznacza [MA]
  (MODULE_ACCEPTANCE.md).
- modules/03_TOOLS/TOOLS_OWNER_REVIEW_REGISTER.md — 9 pozycji P0/P1 (8 P0 + 1 P1)
  pod ID TLS-XXX-OWN-001, mimo że 03_TOOLS/MODULE_ACCEPTANCE.md ma zero wierszy z
  tagiem P0/P1 i MASTER_STATUS_REGISTER.md pokazuje dla Tools Open P0=0, Open P1=0 (jedyny
  wpis to P2 w polu regresji o React act() warnings — nie to samo).

Łączny mianownik ze wszystkich trzech źródeł: 85 + 27 + 9 = 121 unikalnych pozycji
P0/P1 (68 P0, 53 P1), po odjęciu zduplikowanego REC-INT-* (przepakowanie, nie nowe ID)
i po rozdzieleniu kolizji ASM-OWN-00X.

## R2 — Rozliczenie: źródło A+B (85 pozycji, pełna weryfikacja)

Dla każdej pozycji: ID, moduł, priorytet, opis, stan wg dokumentu (nieaktualny —
większość dokumentów ma datę 22–25.08), werdykt DZIŚ (2026-09-03) z dowodem, i — dla
pozycji OTWARTYCH/NIEWERYFIKOWALNYCH — co zostało do zrobienia z szacunkiem kosztu.

Wszystkie 24 unikalne SHA cytowane jako "fix commit" w tych 85 wierszach zostały
zweryfikowane: 24/24 istnieją i są przodkami HEAD (`git cat-file -e` +
`git merge-base --is-ancestor`) — żaden nie jest sfabrykowany ani odrzucony rebase'em.
To ustala, że gdy dokument cytuje SHA, commit jest realny; pytanie w każdym wierszu
brzmi, czy naprawa PRZETRWAŁA do dziś w kodzie (sprawdzone grepem, nie zakładane).

| ID | Moduł | P0/P1 | Opis (1 linia) | Stan wg dokumentu | Werdykt dziś | Dowód | Do zrobienia (OTWARTE) |
|---|---|---|---|---|---|---|---|
| `INT-MENU-OWN-001` | 02 Interview | P1 | Functional UX / action governance | ASSIGNMENT_ACTIONS_TECHNICAL_PASS / FULL_ACTION_MATRIX_PENDING | OTWARTE (CZĘŚCIOWE) | Commit 5189ac05d6+d13b676fc0 (ancestor HEAD, 2026-08-22) naprawił Escalate/Reassign dla Assignment; pozostałe typy obiektów (Inbox/Sessions/Templates/Insights/Initiatives) wciąż bez pełnej macierzy akcji (potwierdzone w REC-INT-005: "remai… | ŚREDNIE — rozszerzyć registry akcji na pozostałe typy obiektów Interview |
| `INT-PREV-OWN-001` | 02 Interview | P1 | Cross-tab standard violation / Preview actions | REQUIRED / CANON_MAPPING_AND_FUNCTIONAL_AUDIT_PENDING | OTWARTE | fix="—"; REC-INT-006 nadal "Six Preview variants pass" jako wymaganie, nie stan; brak dowodu implementacji canonu stopki w 6 zakładkach | ŚREDNIE — ujednolicić stopkę Preview wg kanonu AI→Relations→Actions→Co dalej |
| `INT-QCARD-OWN-001` | 02 Interview | P0 | Owner-directed rollback / major UX regression | TECHNICAL_PASS / OWNER_RETEST_REQUIRED | NAPRAWIONE (kod) | Commit d560464f3f (ancestor HEAD, 2026-08-22); REC-INT-003 potwierdza "TECHNICAL_PASS": pełny UI suite Interview 18 plików/92/92 PASS, root typecheck+build PASS; osobna brama to wizualna parytet + owner retest (proces, nie defekt kodu) | — |
| `INT-APPROVAL-OWN-001` | 02 Interview | P0 | Missing visible approval lifecycle / workflow gate | REQUIRED / END_TO_END_STATE_PERMISSION_UI_PERSISTENCE_AUDIT_PENDING /… | NAPRAWIONE (kod) | MODULE_ACCEPTANCE.md pokazuje fix="—" (NIEAKTUALNE) ale REC-INT-004 cytuje commit 01d1cd8057 "expose and prove review lifecycle" (zweryfikowany: ancestor HEAD, 2026-08-22 23:23); grep kodu potwierdza sendBack/approveResponse/approved_at ob… | — |
| `INT-ASSIGN-OWN-001` | 02 Interview | P0 | Functional regression / template eligibility contract; partial owner approval | REQUIRED / ROOT_CAUSE_FILTER_AND_SNAPSHOT_CONTRACT_IDENTIFIED / LIVE_… | NAPRAWIONE (kod) | MODULE_ACCEPTANCE.md pokazuje fix="—" (NIEAKTUALNE) ale REC-INT-002 cytuje commit f3c35cecce "restore governed system template assignment" (zweryfikowany: ancestor HEAD, 2026-08-22 23:16), API list/create/wersjonowanie/cold-readback 7/7 PA… | — |
| `INT-CREATOR-OWN-001` | 02 Interview | P0 | Cross-creator UX standard / severe operability failure with functional-content … | REQUIRED / FLAG_DEFAULT_OFF / SHELL_GEOMETRY_AND_BANDS_PARTIAL / VISU… | OTWARTE | FLAG_DEFAULT_OFF, VISUAL_PARITY_PARTIAL, tylko krok 1 z 5 wdrożony (steps 3-5 evidence missing), type-count contract 12 vs 13 zablokowany — potwierdzone przez sam dokument, brak nowszego commitu w rejestrze SHA | DUŻE — dokończyć Creator Shell dla Insight/Initiative (kroki 2-5), zdjąć flagę po akcepcie |
| `INT-INIT-AI-OBS-001` | 02 Interview | P1 | Functional observation / AI-assisted form fill | OBSERVED / OWNER_VERBAL_DECISION_NOT_YET_CAPTURED / REQUEST_RESPONSE_… | WERDYKT RUNTIME (dyżur 291, `ODBIOR_DYZUROW_286_290_291_20260903.md` §3.5): NIEWERYFIKOWALNE BEZ PROVIDERA / EVIDENCE_MISSING — na markerze nie ustalono osiągalnego wołacza „fill section” w module Wywiadu; bez klucza providera trzech warstw nie wolno uznać za sprawne. | Tylko dowód zrzutu ekranu ("Failed to fill the section with AI"); wymaga uruchomienia AI fill z realnym providerem, by ustalić przyczynę (provider vs walidacja vs serwer) — nie do rozstrzygnięcia statycznym gitem/grepem | trzeba: diagnostyka po wskazaniu trasy (szacunek 2–4 h) — uruchomić AI Initiative Wizard → Fill with AI z żywym providerem i przechwycić od… |
| `ASM-OWN-001` | 04 Assessment | P0 | Backend contract / licensed Assessment | CAPTURED_UNRECONCILED / BLOCKS_OWNER_REVIEW | WERDYKT RUNTIME (dyżur 291, `ODBIOR_DYZUROW_286_290_291_20260903.md` §3.5, potwierdzone niezależnie §3.2 pkt 1): NIE DOTYCZY KODU → G16 — na markerze `/api/method` jest zamontowane bezwarunkowo (`Gateway.ts:968`), `GET /api/method/packs` i `/sessions` odpowiadają 200 przez realny Gateway/JWT/PostgreSQL, zimny klient `pg` potwierdza 0 sesji. | Dokument sam przyznaje: kod ma trasę (`/api/method` zamontowana Gateway.ts:968, potwierdzone grep), ale zdalny backend za proxy zwracał 404 — to defekt wdrożenia/proxy, nie brak kodu; wymaga żywego serwera by ustalić dzisiejszy stan | 291 uruchomił i potwierdził na żywym serwerze — 404 za proxy klasyfikujemy jako rozjazd wdrożenia; pusty katalog nie dowodzi kompletności treści (nadal do zrobienia: treść) |
| `ASM-OWN-002` | 04 Assessment | P0 | Runtime truth / fail-closed workspace | CAPTURED_UNRECONCILED / BLOCKS_OWNER_REVIEW | WERDYKT RUNTIME (dyżur 291, §3.5): NIE DOTYCZY KODU → G16 — deep-link do nieistniejącej sesji daje jawne 404 „Session not found” (fail-closed sprawny); obcy OWNER dostaje własną pustą listę, nie dane głównego tenanta. | Ta sama rodzina co ASM-OWN-001 — RECOVERY_DRAFT fail-closed jest zależny od tego samego backendu; brak dowodu zmiany kodu, wymaga żywego backendu | 291 potwierdził fail-closed na żywym serwerze; tworzenie nowej sesji pozostaje niezmierzone |
| `ASM-OWN-003` | 04 Assessment | P0 | Downstream read / Outputs | CAPTURED_UNRECONCILED / BLOCKS_OWNER_REVIEW | WERDYKT RUNTIME (dyżur 291, §3.5): NIE DOTYCZY KODU → G16 — `GET /api/method/outputs` → 200 `{"outputs":[],"total":0}`; osobny klient `pg` potwierdza 0 trwałych Output w użytej fiksturze. | Ta sama rodzina 404 na `/api/method/outputs` — trasa istnieje w kodzie (server/src/routes/method-core.routes.ts, zamontowana), ale downstream Outputs/Reports/Initiatives zależy od żywego backendu | 291 potwierdził trasę na żywym serwerze; trwałość Assessment pozostaje nieudowodniona |
| `INI-OWN-001` | 05 Initiatives | P0 | Review data / methodology | OWNER_AUDIT_BLOCKED_BY_INCOMPLETE_REVIEW_DATA / NOT_ACCEPTED | WERDYKT RUNTIME (dyżur 291, §3.5, potwierdzone niezależnie §3.2 pkt 2): OTWARTE — kanoniczny seeder ma literalnie `initiatives: 1` (`server/scripts/seed-wave3-initiatives-owner-review.ts:758`), więc na markerze jest 1, nie 11 inicjatyw; jedyny rekord ma `lifecycle`, ale `current_stage`, daty, ROI, risk, confidence i value timing są `null`. Zrzutu realnego rekordu świadomie nie wykonano — niekompletna fikstura nie rozstrzygnęłaby tezy. | Wymaga przeglądu danych demo (11 inicjatyw, kompletność pól lifecycle) na żywej bazie/przeglądarce — nie do ustalenia statycznie | szacunek 1–2 dni — odbudować fikstury demo z pełnym kompletem pól lifecycle, potem otworzyć /initiatives?sampleData=initiatives i sprawdzić wypełnienie |
| `INI-OWN-002` | 05 Initiatives | P0 | Canonical card availability | OWNER_AUDIT_BLOCKED_BY_UNOPENABLE_CARD / NOT_ACCEPTED | OTWARTE (prawdopodobnie poprawione, niepotwierdzone) | Fraza "Initiative Card is unavailable. No change was made." nie występuje już w `src/` (0 trafień grep) — silna poszlaka naprawy, ale bez commitu z tym ID i bez browser-replay nie mogę potwierdzić na pewno | DROBNE — potwierdzić przeglądarką otwarcie karty init-showcase-supply-chain-optimization |
| `INI-OWN-003` | 05 Initiatives | P1 | Card architecture / visual consistency | TECHNICAL_CONTRACT_EXISTS / OWNER_VISUAL_AND_METHOD_AUDIT_BLOCKED | OTWARTE | `initiativeCardContract.ts` istnieje, ale komponent `InitiativeDocumentView.tsx:775` gate'uje go flagą `isInitiativeCardContractEnabled()` — kontrakt techniczny istnieje, ale nieaktywny domyślnie; brak dowodu owner visual audit | ŚREDNIE — włączyć/zweryfikować za flagą, potem odbiór wizualny |
| `INI-OWN-004` | 05 Initiatives | P0 | Information architecture | FIXED_BROWSER_VERIFIED / OWNER_RETEST_PENDING | NAPRAWIONE (kod) | Commit 5c6d72066f (ancestor HEAD, 2026-08-23); 3 zakładki (Initiatives/Plan/Capacity) potwierdzone, normalizacja starych URL | — |
| `INI-OWN-005` | 05 Initiatives | P0 | Register semantics | FIXED_BROWSER_VERIFIED / OWNER_RETEST_PENDING | NAPRAWIONE (kod) | Commit 5c6d72066f (ancestor HEAD, 2026-08-23); 11 wierszy z policzonymi licznikami lifecycle 3+1+2+1+2+2+0=11 | — |
| `INI-OWN-006` | 05 Initiatives | P1 | Creation flow | SPECIFIED / IMPLEMENTATION_AND_RETEST_PENDING | OTWARTE | fix="—"; SPECIFIED/IMPLEMENTATION_AND_RETEST_PENDING — brak dowodu implementacji premise-first AI creation flow | DUŻE — zbudować kreator premise→AI draft→human review |
| `INI-OWN-007` | 05 Initiatives | P1 | Plan analysis | PARTIAL_PRODUCT_IMPLEMENTATION / EXACT_SHA_RUNTIME_PASS / OWNER_RETES… | NAPRAWIONE (częściowo, kod) | 5 commitów zweryfikowanych jako ancestor HEAD (1dc1761cfd,02aca5ee25,581e44d4a3,22ce590d7a,a5a2f427fe, 2026-08-24); Plan what-if/Gantt zaimplementowany silnikiem deterministycznym (nie jeszcze AI-provider); focused 2 pliki/9 testów PASS | — |
| `INI-OWN-008` | 05 Initiatives | P1 | Capacity analysis | PARTIAL_PRODUCT_IMPLEMENTATION / EXACT_SHA_RUNTIME_PASS / OWNER_RETES… | NAPRAWIONE (częściowo, kod) | Commit 8a3fc80deb zweryfikowany jako ancestor HEAD (2026-08-24); Capacity workspace z wersjonowanymi analizami; focused 2 pliki/5 testów PASS; provider-backed rekomendacje wciąż EVIDENCE_MISSING | — |
| `INI-OWN-009` | 05 Initiatives | P1 | Shared UI standard | REGISTERED / SHARED-COMPONENT AUDIT_PENDING | OTWARTE | fix="—"; REGISTERED/SHARED-COMPONENT_AUDIT_PENDING — brak dowodu ujednolicenia preview/menu wg wspólnego standardu | ŚREDNIE — audyt zgodności z consultify-triada/consultify-preview |
| `INI-OWN-010` | 05 Initiatives | P0 | Cross-module identity | FIXED_TECHNICAL_BROWSER_VERIFIED / OWNER_RETEST_PENDING | NAPRAWIONE (kod) | Commit 68d59c4774 zweryfikowany jako ancestor HEAD (2026-08-24); ta sama inicjatywa widoczna w Initiatives i Execution jako "Executing" po czystym restarcie | — |
| `EXE-OWN-001` | 06 Execution | P0 | Availability | FIXED_LOCAL_REVIEW / OWNER_RETEST_REQUIRED | NAPRAWIONE (kod + test regresji) | Fix cytowany jako "uncommitted local review worktree" w dokumencie (NIEAKTUALNE), ale kod ma dziś dedykowany test regresji `src/routes/__tests__/executionCanonicalRoute.test.ts:13` — "does not replace the usable Execution module with the g… | — |
| `EXE-OWN-002` | 06 Execution | P0 | Conceptual regression / primary entity | TECHNICAL_PASS / OWNER_RETEST_REQUIRED | NAPRAWIONE (kod) | Commity 673363f63c, 45b91a507f zweryfikowane jako ancestor HEAD (2026-08-24); canoniczny dokument Initiative otwierany z /execution, focused 12/12 PASS | — |
| `EXE-OWN-003` | 06 Execution | P0 | Review data / owner workflow | FIXED_LOCAL / OWNER_RETEST_REQUIRED | WERDYKT RUNTIME (dyżur 291, §3.5): OTWARTE — opisanej pracy z „niescommitowanego worktree przeglądowego” nie ma na linii markera ani w gałęziach kopii zapasowej; nie odtwarzano jej (`Z40`). | Fix="uncommitted local review worktree" — dotyczy WYŁĄCZNIE danych demo do lokalnego przeglądu (nie produkcyjnego kodu); bez dostępu do tego workspace nie potwierdzę, ale produkcja i tak pozostaje fail-closed niezależnie od tego ustalenia | szacunek 0,5–1 dnia po odzyskaniu źródła — sprawdzić /execution?tab=list&view=table na lokalnym seedzie z danymi Initiatives… |
| `EXE-OWN-004` | 06 Execution | P0 | Review data / detailed Execution workflow | TECHNICAL_EXACT_SHA_PASS / OWNER_RETEST_REQUIRED | NAPRAWIONE (kod) | Commit 14da3e6d0757 zweryfikowany jako ancestor HEAD (2026-08-24); focused 11/11 PASS, SQL/API readback potwierdzone dla work/resources/control/reports | — |
| `EXE-OWN-005` | 06 Execution | P1 | Information architecture / work-item navigation | FIXED_LOCAL_BROWSER / OWNER_RETEST_REQUIRED | WERDYKT RUNTIME (dyżur 291, §3.5, KOREKTA odbiorcy wobec §3.3 pkt 1 — dyżur 291 pisał ogólnie „w drzewie markera brak tekstu «Wróć do listy»”, odbiór znalazł 10+ trafień poza Execution): OTWARTE — w `src/components/Execution` nie ma ani „Wróć do listy”, ani „Back to list”, ani wołacza `backToList`; dynamiczny powrót Menu 3 opisany jako „pending checkpoint” nie istnieje w kodzie TEGO modułu (poza Execution napis występuje m.in. w Finance i CaseWorkspace, ale to nie liczy się dla tego wiersza). | Fix="pending checkpoint" (niescommitowane); Dynamic Menu 3 tab i "Back to list" opisane jako zweryfikowane w przeglądarce, ale bez commitu nie mogę potwierdzić że trafiło do bieżącego drzewa | szacunek 1 dzień — sprawdzić /execution?tab=work&view=table czy otwieranie zadania używa Menu 3 zami… |
| `EXE-OWN-006` | 06 Execution | P0 | Work report / organizational control | OWNER_REQUIREMENT_CAPTURED / EXPERT_SPEC_COMPLETE / NOT_IMPLEMENTED | NAPRAWIONE (kod, dokument NIEAKTUALNY) | Dokument mówi "NOT_IMPLEMENTED" (2026-08-23), ale kod ma dziś `UnifiedExecutionReportGenerator.tsx` (utworzony 2026-08-25 commitem b470536a9 "add unified governed report generator (E.4)") realnie zaimportowany i renderowany w `ExecutionHub… | — |
| `EXE-OWN-007` | 06 Execution | P0 | Cross-module reporting architecture | OWNER_REQUIREMENT_CAPTURED / 4 IMPLEMENTATION TASKS SPECIFIED / NOT_I… | NAPRAWIONE (kod, dokument NIEAKTUALNY) | Ta sama rodzina co EXE-OWN-006 — `ExecutionReportsSurface.tsx` zaimportowany i renderowany w `ExecutionHub.tsx:145,5805`; workReportModel.ts obecny; wymagałoby przeglądu treści raportu vs 4 zadania z opisu, ale sama teza "NOT_IMPLEMENTED" … | — |
| `EXE-OWN-008` | 06 Execution | P0 | Cross-module identity / SSOT | TECHNICAL_IDENTITY_AND_PROJECTION_PASS / OWNER_RETEST_REQUIRED | NAPRAWIONE (kod) | 4 commity zweryfikowane jako ancestor HEAD (4cd0ce6589,673363f63c,45b91a507f,14da3e6d0757); jedna tożsamość Initiative łącząca 5 powierzchni Execution | — |
| `MYW-IDEAS-CORE-001` | 07 My Work | P0 | Product/UX · Ideas / four tools | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: Shared 6-section rail is unified: one renderer `<IdeaWorkspaceTools onlySection>` (`IdeaWorkspaceTools.tsx:1820`) reused… | Raw-ID fix and `AI Expand` removal are Fala 1 candidates; what `AI Advice` should do is `… |
| `MYW-IDEAS-CORE-002` | 07 My Work | P0 | Product/UX · Ideas / four tools | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: Three separate inspectors remain: `RowDetailPanel` (Table, `IdeaTableTool.tsx:4703`), `ProcessFlowPropertiesPanel` (Proc… | FALA_3_PROTOTYPE_REQUIRED` — unify the three inspectors, dock in-workspace, flip the flag… |
| `MYW-IDEAS-008` | 07 My Work | P1 | UX · Ideas header | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: Identity row is slimmer (contract test forbids `Sparkles`/`openTabAiContext`/`handleSave`/`handleConvert`); contextual "… | Fala 1 candidate — finish the actual Save removal (see Fala 1 table). |
| `MYW-IDEAS-009` | 07 My Work | P1 | Product · Ideas | NIEZROBIONE | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE`. Evidence: Api.getMyIdeaConversions` has one consumer, `IdeaMapWorkspace.tsx:2547`, only for `priorConversionCount` inside the pr… | FALA_3_PROTOTYPE_REQUIRED` — the only fully-unbuilt Ideas atom; needs a canonical status … |
| `MYW-IDEAS-010` | 07 My Work | P1 | Product/Integration · Ideas | ZROBIONE_W_KODZIE | NAPRAWIONE (kod) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `ZROBIONE_W_KODZIE`. Evidence: Real two-step review→confirm with lineage (`mapVersion`+`projectionHash` from `previewIdeaProcessFlowCandidate` … | — |
| `MYW-IDEAS-011` | 07 My Work | P1 | Product/UX · Ideas | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: IdeaAINudgeStrip.tsx:70–72` labels source (`canvas`/`teresa`); durable dismissal key `consultify:idea-nudges:dismissed:…… | 2 of 4 surfaces done (Whiteboard, Mind Map). Process Flow + Table remain Fala 1 candidate… |
| `MYW-IDEAS-012` | 07 My Work | P1 | Product/Integration · Ideas | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: Registry has `initiative, task_set, decision, team_chat, report, presentation` (`ideaConvertTargets.ts:96–142`); menu ex… | FALA_4_OWNER_DECISION` (item 8) — does Idea→Note/Notebook conversion enter scope? |
| `MYW-IDEAS-013` | 07 My Work | P1 | Product/QA · Ideas (all 4 tools) | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: Real per-action registry with `disabledReason` behind Menu 3 for all four tools (`actions/ideaActionRegistry.ts:366–406`… | FALA_3` — add the enumeration contract test and close remaining per-surface gaps it finds. |
| `MYW-IDEAS-014` | 07 My Work | P1 | Integration/QA · Ideas | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: Task/Report/Initiative/Candidate are real network calls with lineage writes: `Api.convertMyIdea` (`IdeaMapWorkspace.tsx:… | Depends on `FALA_4_OWNER_DECISION` item 8. |
| `MYW-NBK-CORE-001` | 07 My Work | P0 | Product/UX · Notebook | READY_FOR_OWNER_SCREENSHOT_REVIEW | OTWARTE | READY_FOR_OWNER_SCREENSHOT_REVIEW — kod gotowy (ArtifactRightPanel realnie renderowany wg Day 98), ale brak zgody właściciela na zmianę defaultu; czeka na decyzję, nie na kod | DROBNE — decyzja właściciela + przełączenie flagi po akcepcie |
| `MYW-NBK-CORE-002` | 07 My Work | P0 | Product/UX · Notebook | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: Registry exists: `notebookActionRegistry.ts` (387 lines, 7 surfaces). Gap: the audit itself declares 3 `blocked` and 4 `… | FALA_3` — finish the governed-api wiring for the blocked/partial actions. |
| `MYW-NBK-003` | 07 My Work | P1 | Product · Notebook | NIEZROBIONE | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE`. Evidence: src/components/MyWork/notebook/NotebookContextPanel.tsx` — 0 hits for `diff`, `stale`, `proposeUpdate`, `applyPartial`… | FALA_3_PROTOTYPE_REQUIRED` — needs provenance/history/conflict-resolution model before co… |
| `MYW-NBK-004` | 07 My Work | P1 | Product/Integration · Notebook | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: **2026-08-25 (Fala 1):** wired. New `NotebookSearchDialog` (`src/components/MyWork/notebook/NotebookSearchDialog.tsx`), … | PARTIALLY_CLOSED` — fast cross-notebook title/content search is real and shipped; faceted… |
| `MYW-INB-REC-001` | 07 My Work | P1 | Product · Inbox | NIEZROBIONE | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE`. Evidence: MyWorkHub.tsx:3395` → `openTabAiContext` (`:2302`) only opens chat with a canned prompt. Dedup logic exists but is unw… | FALA_4_OWNER_DECISION` (item 7) — is `InboxTriage.tsx` the foundation to wire up, or dead… |
| `MYW-IDEA-REC-001` | 07 My Work | P1 | UI defect · Ideas table | ZROBIONE_W_KODZIE | NAPRAWIONE (kod) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `ZROBIONE_W_KODZIE`. Evidence: IdeasTableContent.tsx:1355` — row `<tr>` had only `onClick`/`onDoubleClick`, no `onContextMenu`. **2026-08-25 (F… | — |
| `MYW-IDEA-REC-002` | 07 My Work | P1 | UI defect · Ideas folders | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: "New folder…" already worked via `window.prompt` → `Api.createMyIdeaFolder`. **2026-08-25 (Fala 1):** replaced the promp… | Canon-dialog wiring `CLOSED`; scope/rename/archive need a real migration + list-visibilit… |
| `MYW-CAL-REC-001` | 07 My Work | P1 | Product · Calendar | NIEZROBIONE | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE`. Evidence: Calendar/CalendarCreateEventModal.tsx:156,179,271` still shows "Artifact type: Task", "In V1, calendar creation produc… | FALA_3_PROTOTYPE_REQUIRED` — new data model needed. |
| `MYW-CAL-REC-002` | 07 My Work | P1 | Product/Integration · Calendar | NIEZROBIONE | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE`. Evidence: server/src/routes/v8/my-work.routes.ts:2779–2822` — schema accepts only `title/start/end/allDay/source/description/rec… | FALA_3_PROTOTYPE_REQUIRED`. |
| `MYW-CAL-REC-003` | 07 My Work | P1 | Product · Calendar | NIEZROBIONE | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE`. Evidence: Same handler (`my-work.routes.ts:2820`); modal has no artifact-attach UI. The only meeting data today is a read-only p… | FALA_3_PROTOTYPE_REQUIRED`. |
| `MYW-DEC-REC-001` | 07 My Work | P1 | UI defect/integration · Decisions list | ZROBIONE_W_KODZIE | NAPRAWIONE (kod) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `ZROBIONE_W_KODZIE`. Evidence: MyWorkHub.tsx:4137` mounts `DecisionsPanelContent` directly; the thirteen specialist queues are no longer mounte… | — |
| `MYWORK-DEC-OWN-001` | 07 My Work | P1 | UI defect/integration · Decisions list | ZROBIONE_W_KODZIE` (see `MYW-DEC-REC-001`) | NAPRAWIONE (kod) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `ZROBIONE_W_KODZIE` (see `MYW-DEC-REC-001`)`. Evidence: Same evidence as `MYW-DEC-REC-001`. | — |
| `XMOD-CARD-REC-001` | 07 My Work | P0 | Product/UX · cross-module N-Type cards | NIEZROBIONE | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE`. Evidence: Three separate per-type contracts remain: `src/components/MyWork/decisionCardContract.ts`, `notificationCardContract.t… | FALA_3` — cross-module; tracked jointly with `owner_feedback/CROSS_MODULE/VISUAL_STANDARD… |
| `MYW-CV-REC-001` | 07 My Work | P1 | UI defect · Vault table/preview | ZROBIONE_W_KODZIE` (code) | NAPRAWIONE (kod) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `ZROBIONE_W_KODZIE` (code)`. Evidence: src/views/vault/VaultSafesTable.tsx:356–460` uses `TableWithPreviewLayout`+`StandardTable`+`PreviewMetaC… | — |
| `MYW-CV-REC-002` | 07 My Work | P1 | UI defect · Vault table | ZROBIONE_W_KODZIE | NAPRAWIONE (kod) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `ZROBIONE_W_KODZIE`. Evidence: src/components/shared/ModuleHub/FilterableTable.tsx:1248–1268` — right-click mirrors `getRowActionSections`, con… | — |
| `MYW-AGT-REC-001` | 07 My Work | P0 | Product/Program · Run Agent | WYMAGA_DECYZJI` (owner-deferred) | ZDEZAKTUALIZOWANE (przeniesione) | DEC-2026-08-25-23: MOVED_TO_MODULE_17 — pozycja świadomie wyprowadzona z zakresu odbioru My Work do modułu 17 (Agent); nie liczy się już do mianownika My Work | — |
| `MYW-MGR-REC-001` | 07 My Work | P0 | Product · Manager | NIEZROBIONE` (redesign) | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE` (redesign)`. Evidence: MyWork/Executive/ExecutiveDashboard.tsx:602–880` is still the same card dashboard. The "mock data" complai… | FALA_3_PROTOTYPE_REQUIRED` — needs real data-shaping first: derive `bottlenecks` from act… |
| `MYW-PHOTO-001` | 07 My Work | P0 | Evidence gate · all My Work | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: scripts/dev/seed-wave3-my-work-owner-review-owned.mjs:195,219,223,227` seeds its own orgs ("MYW owner review", "MYW fore… | FALA_2` — data gate; blocks `MYW-PHOTO-007/008/009/010/011`. |
| `MYW-PHOTO-002` | 07 My Work | P0 | UI defect · Inbox | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: Loading/error states are real (`loadError`→`<ErrorState … retry>`, `InboxContent.tsx:4166–4167`). **2026-08-25 (Fala 1):… | Copy fix closed; the true denied-vs-empty distinction remains `FALA_2`/`FALA_3` (needs a … |
| `MYW-PHOTO-003` | 07 My Work | P1 | UI defect · MyWorkNav | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: MyWorkNav.tsx:259,301` — both nav levels use `overflow-x-auto whitespace-nowrap`. Gradient `ScrollAffordance` was added … | Fala 1 candidate (bundled with `MYW-PHOTO-005`; see Fala 1 table). |
| `MYW-PHOTO-004` | 07 My Work | P1 | UI defect · MyWorkNav | NIEZROBIONE | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE`. Evidence: Candidate element: level-1 group pills, `MyWorkNav.tsx:264–281` (`uppercase tracking-wider`, active background). No ro… | FALA_4_OWNER_DECISION` (item 4). |
| `MYW-PHOTO-005` | 07 My Work | P1 | UI defect · MyWorkNav / content shell | NIEZROBIONE | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE`. Evidence: Same root cause as `MYW-PHOTO-003` — no single owned scroll container across `MyWorkNav.tsx:259/301` and inner content… | Fala 1 candidate (bundled with `MYW-PHOTO-003`; see Fala 1 table). |
| `MYW-PHOTO-007` | 07 My Work | P0 | Evidence gate · Tasks/Decisions | WYMAGA_DECYZJI` / data gate | OTWARTE (czeka na decyzję właściciela) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `WYMAGA_DECYZJI` / data gate`. Evidence: Depends on `MYW-PHOTO-001`; fixture lacks active/blocked-overdue/action-required/Done tasks and pendin… | FALA_2`. |
| `MYW-PHOTO-010` | 07 My Work | P0 | Evidence gate · all My Work | CZĘŚCIOWE | OTWARTE (CZĘŚCIOWE) | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `CZĘŚCIOWE`. Evidence: CAS mechanics exist and are exercised by the fixture (`seed-…-owned.mjs:313–330`, `409 TASK_VERSION_CONFLICT`), but no e… | FALA_2`. |
| `MYW-PHOTO-011` | 07 My Work | P1 | Evidence gate · all My Work | NIEZROBIONE | OTWARTE | Pole Status dokumentu (07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md, aktualizacja Fala 1, 2026-08-25): `NIEZROBIONE`. Evidence: Evidence directory has one 1280×720 dark EN screenshot plus one overlay. No PL/EN, light theme, tablet, keyboard or al… | FALA_2`, bundled with `MYW-IDEAS-015`. |
| `RES-OWN-001` | 09 Results | P0 | Information architecture / wrong surface | CORRECT_SURFACE_RESTORED / DATA_REATTACH_BLOCKED_MISSING_DB / OWNER_R… | NAPRAWIONE (prawdopodobnie, kod) | `git log` pokazuje commit 07ee289127 (2026-09-02, POST-finding) "katalog Results zredukowany do 2 zywych plikow" oraz 130c9b853e "remove dead results-three-pairs screen" — masowa restrukturyzacja PO dacie znaleziska; wysoce prawdopodobne ż… | — |
| `RES-OWN-002` | 09 Results | P0 | Domain navigation / product architecture | SPECIFIED_FROM_EXISTING_SSOT / IMPLEMENTATION_REQUIRED / OWNER_REVIEW… | OTWARTE | fix="—"; SPECIFIED_FROM_EXISTING_SSOT/IMPLEMENTATION_REQUIRED — restrukturyzacja 09-02 usunęła martwy kod, ale nie ma dowodu że domain-navigation z opisu (KPI/ROI/OKR spójna nawigacja) została zbudowana | ŚREDNIE — zbudować nawigację domenową wg SSOT results-vnext |
| `RES-OWN-003` | 09 Results | P0 | Reviewability / data | LOCAL_FIXTURE_VISIBLE / DB_READBACK_OPEN / OWNER_RETEST_REQUIRED | WERDYKT RUNTIME (dyżur 291, §3.5): OTWARTE / EVIDENCE_MISSING — widoczna fikstura 4 KPI / 3 OKR / 3 ROI nie ma dowodu HTTP → zimny PostgreSQL → restart → HTTP; nie wskazano licencjonowanego writera, którym wolno odtworzyć te 10 wierszy. | LOCAL_FIXTURE_VISIBLE/DB_READBACK_OPEN — wymaga żywej bazy by potwierdzić trwały zapis i odczyt na zimno | szacunek 2–4 h po wskazaniu writera — przelot zapis→restart→odczyt na żywej Postgres |
| `RES-OWN-004` | 09 Results | P1 | Menu 2 CTA | LOCAL_BROWSER_VERIFIED / OWNER_RETEST_REQUIRED | NAPRAWIONE (kod, pre-existing) | fix="pre-existing" — sam dokument mówi że CTA już działało poprawnie w Menu 2, LOCAL_BROWSER_VERIFIED; jedyny otwarty punkt to formalny owner retest (proces, nie kod) | — |
| `RES-OWN-005` | 09 Results | P1 | Shared preview | OWNER_POSITIVE_OBSERVATION / MODULE_PENDING | OTWARTE | fix="—"; OWNER_POSITIVE_OBSERVATION/MODULE_PENDING — pozytywna obserwacja, ale moduł jako całość wciąż PENDING wg mastera | DROBNE — formalny odbiór |
| `RES-OWN-006` | 09 Results | P1 | Row menu / excessive lifecycle actions | FIXED_LOCAL_BROWSER / CODE_REFINED / OWNER_RETEST_REQUIRED | NAPRAWIONE (kod) | Commity 27345491d5 (2026-08-27, ROI C.1) i 5368c0484a (2026-08-27, OKR C.2) zweryfikowane jako ancestor HEAD; lokalizacja next actions i OKR owners/check-ins naprawione | — |
| `RES-OWN-007` | 09 Results | P0 | Full tool / domain workflow | ROUTES_AND_EXISTING_CARDS_RECONNECTED / KPI_SCORECARDS_AND_HISTORY_CO… | NAPRAWIONE (kod) | Commity 77eb754f72, 1a4eb2b75c, 077638fc06 (2026-08-31) zweryfikowane jako ancestor HEAD; trasy i karty KPI scorecards+history podłączone | — |
| `RES-OWN-008` | 09 Results | P0 | Specification / backend / visual consistency | CANONICAL_30_SECTION_CONTRACT_WRITTEN / TWO_REAL_GAPS_RECORDED / OWNE… | NAPRAWIONE (częściowo, kod) | Commit 66ae764a2e (2026-08-31, ancestor HEAD) — kontrakt 30-sekcji spisany, "TWO_REAL_GAPS_RECORDED" — dwie luki nadal jawnie otwarte wg samego dokumentu | — |
| `FIN-OWN-001` | 10 Finance | P1 | integration/data | TECHNICALLY_RECOVERED / OWNER_RETEST_PENDING | NAPRAWIONE (kod, częściowo) | fix="already in candidate ancestry" — TECHNICALLY_RECOVERED wg dokumentu; commit istnieje wcześniej w historii kandydata; owner retest to osobna brama, nie defekt kodu | — |
| `CHAT-OWN-017` | 13 Chat | P0 | Kompletna kwalifikacja funkcjonalna Canvas (brama akceptacyjna) | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | OTWARTE | Brama akceptacyjna P0 "complete the Canvas functional qualification" — sam gate G14 modułu Chat (2026-09-03, dziś) jest wciąż `PARTIAL / OWNER_DECISION_PENDING`, bramka nie może przejść na PASS dopóki właściciel nie rozstrzygnie pozycji DU… | DUŻE — kwalifikacja funkcjonalna całego Canvas + decyzje właściciela z listy CTO |
| `CHAT-OWN-002` | 13 Chat | P1 | Jedna wysokość nagłówka i prawdziwy model zapisu | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | OTWARTE | Brak wpisu w tabeli remediacji (Implementation/regression ledger); tylko przechwycenie 2026-08-22, brak commitu naprawczego | ŚREDNIE — jedna wysokość nagłówka + prawdziwy model zapisu |
| `CHAT-OWN-003` | 13 Chat | P1 | Dowieść gałęzie konwersacji albo usunąć przedwczesne UI | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | OTWARTE | Brak wpisu w tabeli remediacji; gałęzie rozmów wciąż niedowiedzione lub przedwczesne UI nieusunięte | ŚREDNIE — dowieść mechanikę gałęzi albo usunąć UI |
| `CHAT-OWN-004` | 13 Chat | P1 | Rozstrzygnąć rolę produktową "Important signals" | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | OTWARTE | Brak wpisu w tabeli remediacji; rola produktowa "Important signals" nierozstrzygnięta | ŚREDNIE — decyzja produktowa + wdrożenie |
| `CHAT-OWN-005` | 13 Chat | P1 | Uprościć pasek poleceń Canvas i zaudytować akcje | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | NAPRAWIONE (kod, częściowo) | Commit 93eb6c8040 (ancestor HEAD, 2026-08-23 02:27) — zmiana etykiety PROMOTE→"Create in workspace"; IMPLEMENTED_STATIC/ACTION_AUDIT_AND_OWNER_RETEST_PENDING — audyt akcji i owner retest to osobna brama | — |
| `CHAT-OWN-006` | 13 Chat | P1 | Bezpośredni przełącznik Rich/DOC/MD, usunąć duplikat | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | NAPRAWIONE (kod, częściowo) | Commit 166fd1a224 (ancestor HEAD, 2026-08-23 02:33) — Rich/DOC/MD w głównym pasku, usunięto duplikat View accordion; kontrakt 3/3 PASS | — |
| `CHAT-OWN-007` | 13 Chat | P1 | Naprawić warstwowanie i kontener panelu diagnostyki | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | NAPRAWIONE (kod, częściowo) | Commit 5542c36e33 (ancestor HEAD, 2026-08-23 02:36) — izolacja stacking context, viewport-bounded panel; kontrakt 4/4 PASS | — |
| `CHAT-OWN-008` | 13 Chat | P1 | Dokończyć kartę governed proposal w Liquid Glass | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | NAPRAWIONE (kod, częściowo) | Commit 8ce3e36aaf (ancestor HEAD, 2026-08-23 02:39) — kanoniczna warstwa glass + stan semantyczny karty proposal; komponent 8/8 PASS | — |
| `CHAT-OWN-009` | 13 Chat | P1 | Ujednolicić akcje odpowiedzi, stabilne ikony | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | NAPRAWIONE (kod, częściowo) | Commit 0f09ae3558 (ancestor HEAD, 2026-08-23 02:45) — jedna zamontowana kapsuła akcji zamiast warunkowej; kontrakt 2/2 PASS | — |
| `CHAT-OWN-011` | 13 Chat | P1 | Przywrócić mocniejszy spersonalizowany ekran startowy | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | NAPRAWIONE (kod, częściowo) | Commit 61005a0550 (ancestor HEAD, 2026-08-23 02:52) — poprawiony welcome message + sanityzacja imienia; kontrakt 2/2 PASS | — |
| `CHAT-OWN-013` | 13 Chat | P1 | Przebudować IA historii (prywatna/organizacyjna) | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | OTWARTE | Brak wpisu w tabeli remediacji; przebudowa IA historii (prywatna/organizacyjna) nie ma dowodu implementacji | DUŻE — przebudować architekturę informacji historii czatu |
| `CHAT-OWN-014` | 13 Chat | P1 | Jawna semantyka każdej kontrolki ekranu startowego | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | NAPRAWIONE (częściowo, kod) | Commit 3a5b76ebf8 (ancestor HEAD, 2026-08-23 03:00) — TYLKO wycinek topic-starterów naprawiony (kontrakt 2/2 PASS); pozostałe semantyki startowe (output types/capability/deep links/permissions) same oznaczone jako AUDIT_PENDING | — |
| `CHAT-OWN-015` | 13 Chat | P1 | Zweryfikować tryby głosowe Teresy w całej aplikacji | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | OTWARTE | Brak wpisu w tabeli remediacji; weryfikacja trybów głosowych Teresy w całej aplikacji nieudowodniona | ŚREDNIE — audyt trybów głosowych cross-app |
| `CHAT-OWN-016` | 13 Chat | P1 | Zamknięcie błędów żywego providera, bezpieczne dla usera | Priorytet z OWNER_REVIEW_2026-08-22.md (nie ma osobnego wiersza w MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`) | OTWARTE | Brak wpisu w tabeli remediacji; zamknięcie błędów żywego providera nieudowodnione | ŚREDNIE — obsługa błędów żywego providera + bezpieczne komunikaty |

### Kluczowe ustalenia z weryfikacji źródła A+B

1. Interview ma 3 z 4 P0 naprawionych, ale MODULE_ACCEPTANCE.md tego nie pokazuje.
   INT-APPROVAL-OWN-001 i INT-ASSIGN-OWN-001 mają w MODULE_ACCEPTANCE.md kolumnę
   fix-commit="—" (sugerując brak naprawy), ale INTERVIEW_RECOMMENDATION_REGISTER.md
   (ten sam katalog modułu, ta sama data 22.08) cytuje realne commity
   01d1cd8057/f3c35cecce z TECHNICAL_PASS — zweryfikowane jako przodkowie HEAD,
   a grep kodu potwierdza mechanikę (sendBack/approveResponse/approved_at w
   InterviewHub.tsx, InterviewWorkspace.tsx, interview.routes.ts).
   MODULE_ACCEPTANCE.md jest tu po prostu nieaktualny względem własnego sąsiedniego pliku.
2. Execution ma 2 z 7 P0 fałszywie oznaczonych NOT_IMPLEMENTED.
   EXE-OWN-006/EXE-OWN-007 (raporty tygodniowe/prognoza/obciążenie) — dokument mówi
   "NOT_IMPLEMENTED" (23.08), ale UnifiedExecutionReportGenerator.tsx (utworzony
   commitem b470536a9, 25.08, "add unified governed report generator (E.4)") jest
   dziś realnie zaimportowany i renderowany w ExecutionHub.tsx:134,5579 razem z
   ExecutionReportsSurface.tsx:145,5805. Teza "nic nie zbudowano" jest dziś fałszywa.
3. Results przeszedł masową restrukturyzację 2026-09-02 (07ee289127
   "katalog Results zredukowany do 2 żywych plików", 130c9b853e "remove dead
   results-three-pairs screen") — dzień przed tym dyżurem. To bezpośrednio dotyka
   RES-OWN-001 (zła powierzchnia) i usuwa jeden z trzech jawnie odrzuconych przez
   właściciela ekranów (results-three-pairs) wymienionych w MASTER_STATUS_REGISTER.md.
4. My Work: sam plik MODULE_ACCEPTANCE.md już był częściowo rozliczony 2026-08-25
   ("Fala 1") — pole Status per pozycja (ZROBIONE_W_KODZIE/CZĘŚCIOWE/NIEZROBIONE/
   WYMAGA_DECYZJI) jest własną, wcześniejszą wersją dokładnie tego ćwiczenia. Spot-check
   dwóch ZROBIONE_W_KODZIE (MYW-IDEA-REC-001 — onClick/onDoubleClick obecne w
   IdeasTableContent.tsx:1148-1152; MYW-CV-REC-002 — onContextMenu obecny w
   FilterableTable.tsx:1608) potwierdza że pole jest wiarygodne. XMOD-CARD-REC-001
   (NIEZROBIONE) też potwierdzony negatywnie: 3 osobne pliki kontraktów kart
   (taskCardContract.ts, decisionCardContract.ts, notificationCardContract.ts)
   nadal istnieją osobno.
5. Assessment (3 pozycje z MODULE_ACCEPTANCE.md) to defekt WDROŻENIA, nie kodu.
   Trasa /api/method JEST zamontowana (Gateway.ts:968) i backend ma testy e2e na
   GET /api/method/outputs (drdVerticalSlice.e2e.test.ts) — problem opisany w
   dokumencie to rozjazd między kodem a wdrożonym za Vite-proxy backendem, nie brak
   trasy w repozytorium. Bez żywego serwera nie da się dziś rozstrzygnąć, czy proxy
   nadal zwraca 404 — stąd NIEWERYFIKOWALNE STATYCZNIE, nie "naprawione".
6. Chat: 7 z 13 P1 mają realne, zweryfikowane commity (23.08), 6 P1 + jedyny P0
   (CHAT-OWN-017, brama akceptacyjna) nie mają żadnego wpisu w tabeli remediacji.
   Zgadza się to z dzisiejszą (2026-09-03) notatką bramki G14 samego modułu:
   PARTIAL / OWNER_DECISION_PENDING, bramka nie może przejść dopóki właściciel nie
   rozstrzygnie pozycji DUŻE z docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md.

## R2 — Rozliczenie: trzecie źródło (36 pozycji, weryfikacja lżejsza — jawnie deklarowana)

Ze względu na wolumen (121 pozycji łącznie w tym dyżurze) te 36 pozycji NIE dostały
tej samej głębi weryfikacji co powyższe 85: nie sprawdzano każdego cytowanego SHA
indywidualnie (te rejestry w większości nie cytują SHA — same przyznają
NOT_IMPLEMENTED/IMPLEMENTATION_NOT_AUTHORIZED). Wykonano próbkę 6 punktowych
grepów (4 z ASM-OWN [OF], 2 z TLS) szukających jakiegokolwiek śladu implementacji
opisanej funkcji w dzisiejszym src/ — 0 z 6 dało trafienie (ASM-OWN-009[OF] cztery
tryby zadaniowe, ASM-OWN-016[OF] dwuetapowy nawigator, ASM-OWN-021[OF] collapse do
Interview/Matrix/Report, ASM-OWN-026[OF] eksport siedmio-osiowego PDF, TLS-OUTPUT-OWN-001
zmiana nazwy Outputs→Insights, TLS-MENU-OWN-001 governed Action Registry — żadne nie
istnieje w kodzie). To wzmacnia, ale nie zastępuje, zaufanie do własnego pola Status
tych rejestrów.

Metoda dla pozostałych 30/36: przyjęto pole Status/Decision z dokumentu źródłowego
jako werdykt, oznaczone jawnie jako NIEZWERYFIKOWANE NIEZALEŻNIE w tym dyżurze (zgodnie z
zasadą "nie zgaduj" — to NIE jest twierdzenie że są otwarte na podstawie mojego pomiaru,
tylko że dokument źródłowy tak twierdzi, a próbka 6/6 nie zaprzeczyła).

### owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md — 27 pozycji (kolizja ID z [MA], oznaczone [OF])

| ID | P0/P1 | Opis (1 linia) | Status wg dokumentu | Werdykt (metoda) |
|---|---|---|---|---|
| `ASM-OWN-001[OF]` | P0 | Make Library a pure methodology library | `BOUNDED_REMEDIATION_PARTIAL / OWNER_RETEST_REQUIRED` | OTWARTE (częściowe, wg dok.) |
| `ASM-OWN-002[OF]` | P0 | Enrich catalog, every assessment as a Process | `BOUNDED_REMEDIATION_PARTIAL / OWNER_RETEST_REQUIRED` | OTWARTE (częściowe, wg dok.) |
| `ASM-OWN-003[OF]` | P0 | Reject frozen canonical-session surface | `CAPTURED_UNRECONCILED / NOT_ACCEPTED` | OTWARTE (wg dok.) |
| `ASM-OWN-005[OF]` | P1 | Process Preview -> canonical full-height card | `TECHNICAL_BROWSER_PASS / OWNER_RETEST_REQUIRED` | OTWARTE (tylko owner retest wg dok.) |
| `ASM-OWN-006[OF]` | P0 | Standaryzowac Insights/Reports/Initiatives | `CAPTURED_UNRECONCILED` | OTWARTE (wg dok.) |
| `ASM-OWN-007[OF]` | P0 | Przywrocic backend-connected tool jako primary | `ROOT_CAUSE_CONFIRMED / FROZEN_ROUTE_NOT_FIXED` | OTWARTE (wg dok. - jawnie NOT_FIXED) |
| `ASM-OWN-008[OF]` | P0 | Odrzucic DRD workspace jako niezrozumialy | `CAPTURED_UNRECONCILED / NOT_ACCEPTED` | OTWARTE (wg dok.) |
| `ASM-OWN-009[OF]` | P0 | Cztery tryby zadaniowe workspace | `WORKSHOP_AND_PROTOTYPE_REQUIRED` | OTWARTE - zweryfikowane grepem: 0 sladu w kodzie |
| `ASM-OWN-010[OF]` | P0 | Tylko glowne menu aplikacji w sesji | `NOT_IMPLEMENTED / NOT_ACCEPTED` | OTWARTE (wg dok.) |
| `ASM-OWN-011[OF]` | P0 | Kompaktowy pasek nawigacji lokalnej narzedzia | `NOT_IMPLEMENTED / NOT_ACCEPTED` | OTWARTE (wg dok.) |
| `ASM-OWN-012[OF]` | P0 | Metadane dokumentu w pierwszej karcie Settings | `NOT_IMPLEMENTED / NOT_ACCEPTED` | OTWARTE (wg dok.) |
| `ASM-OWN-013[OF]` | P1 | Usunac niejasna globalna legende stanu | `NOT_IMPLEMENTED / NOT_ACCEPTED` | OTWARTE (wg dok.) |
| `ASM-OWN-014[OF]` | P0 | Trzecia linia narzedziowa kontekstowa | `NOT_IMPLEMENTED / NOT_ACCEPTED` | OTWARTE (wg dok.) |
| `ASM-OWN-015[OF]` | P0 | Stabilna architektura akcji lewo/prawo L3 | `NOT_IMPLEMENTED / NOT_ACCEPTED` | OTWARTE (wg dok.) |
| `ASM-OWN-016[OF]` | P0 | Interview jako kompaktowy dwuetapowy nawigator | `PROTOTYPE_REQUIRED / NOT_IMPLEMENTED` | OTWARTE - zweryfikowane grepem: 0 sladu w kodzie |
| `ASM-OWN-017[OF]` | P0 | Kanoniczne karty poziomow QBank + kolor | `SOURCE_FOUND / NOT_IMPLEMENTED` | OTWARTE (wg dok.) |
| `ASM-OWN-018[OF]` | P0 | Progresywna karta poziomu z dowodami | `EXPERT_REVIEW_COMPLETE / NOT_IMPLEMENTED` | OTWARTE (wg dok.) |
| `ASM-OWN-019[OF]` | P0 | Hierarchiczny postep + deep-link Matrix | `NOT_IMPLEMENTED / NOT_ACCEPTED` | OTWARTE (wg dok.) |
| `ASM-OWN-020[OF]` | P1 | Nie duplikowac nawigacji osi w Interview L3 | `NOT_IMPLEMENTED / NOT_ACCEPTED` | OTWARTE (wg dok.) |
| `ASM-OWN-021[OF]` | P0 | Zwinac narzedzie do Interview/Matrix/Report | `NOT_IMPLEMENTED / NOT_ACCEPTED` | OTWARTE - zweryfikowane grepem: 0 sladu w kodzie |
| `ASM-OWN-022[OF]` | P0 | Ponownie uzyc interakcji demo DRD jako donora | `CAPTURED_AND_SOURCE_LOCATED / NOT_IMPLEMENTED` | OTWARTE (wg dok.) |
| `ASM-OWN-023[OF]` | P0 | Uprawnienia zespolu i etapowe zatwierdzenia | `CAPTURED_WITH_TERMINOLOGY_TO_CONFIRM` | OTWARTE (wg dok.) |
| `ASM-OWN-024[OF]` | P0 | Raport jako ekspercka interpretacja firmowa | `CAPTURED_AND_BOOK_LOCATED / STRUCTURE_PENDING` | OTWARTE (wg dok.) |
| `ASM-OWN-025[OF]` | P0 | Siedem rozdzialow osi wg stalego szablonu | `CANON_RECONCILIATION_REQUIRED / NOT_IMPLEMENTED` | OTWARTE (wg dok.) |
| `ASM-OWN-026[OF]` | P0 | Eksport jednej osi lub calego PDF 7-osiowego | `NOT_IMPLEMENTED / NOT_ACCEPTED` | OTWARTE - zweryfikowane grepem: 0 sladu w kodzie |
| `ASM-OWN-027[OF]` | P0 | IA Settings, uprawnienia i kredyty raportu | `COMMERCIAL_CONTRACT_NEEDED / NOT_ACCEPTED` | OTWARTE (wg dok. - czeka na decyzje komercyjna) |
| `ASM-OWN-028[OF]` | P0 | Komentarze ludzkie i AI-doradca dla Matrix/Report | `AI_CONTRACT_NEEDED / NOT_ACCEPTED` | OTWARTE (wg dok. - czeka na decyzje AI-kontraktu) |

### modules/03_TOOLS/TOOLS_OWNER_REVIEW_REGISTER.md — 9 pozycji (moduł Tools ma zero pozycji w MODULE_ACCEPTANCE.md i w MASTER_STATUS_REGISTER.md)

| ID | P0/P1 | Opis (1 linia) | Status wg dokumentu | Werdykt (metoda) |
|---|---|---|---|---|
| `TLS-OUTPUT-OWN-001` | P0 | Zmiana nazwy Outputs -> Insights, lineage sesja->insight | `OWNER_ARCHITECTURE_DECISION / IMPLEMENTATION_NOT_AUTHORIZED` | OTWARTE - zweryfikowane grepem: brak "Insights" w DiscoveryTools |
| `TLS-REPORT-OWN-001` | P0 | Rejestr Reports (Word/PPT/XLSX) + generator z insightow | `MISSING_PRODUCT_SURFACE_AND_GENERATOR_CONTRACT` | OTWARTE (wg dok. - jawnie brakujaca powierzchnia) |
| `TLS-INIT-OWN-001` | P0 | Wspolny Initiative Creator z kwalifikacja zrodel Tools | `OWNER_REUSE_DECISION / IMPLEMENTATION_NOT_AUTHORIZED` | OTWARTE (wg dok.) |
| `TLS-PREV-CONTENT-OWN-001` | P1 / Cross-app | Cross-app Preview Content Contract per typ obiektu | `OWNER_DIRECTION_CAPTURED / CROSS_APP_STANDARD_REQUIRED` | OTWARTE (wg dok. - zalezne od standardu cross-app) |
| `TLS-MENU-OWN-001` | P0 / Cross-app | Governed Action Registry dla menu Tools | `POLICY_REVIEW_COMPLETE / PLATFORM_REGISTRY_FIRST` | OTWARTE - zweryfikowane grepem: brak actionRegistry w Discovery* |
| `TLS-SWOT-OWN-001` | P0 / Platform | Pelny model sesji Dynamic SWOT (7-etapowy kregoslup) | `FINAL_RECOMMENDATION_WRITTEN / IMPLEMENTATION_NOT_AUTHORIZED` | OTWARTE (wg dok. - rekomendacja spisana, zero wdrozenia) |
| `TLS-REC-OWN-001` | P0 | Etap Recommendations po Synthesis & Insights | `OWNER_ARCHITECTURE_DECISION / IMPLEMENTATION_NOT_AUTHORIZED` | OTWARTE (wg dok.) |
| `TLS-READY-OWN-001` | P0 | Results & Readiness zamiast mieszanego Outputs&Actions | `OWNER_SCOPE_DECISION / IMPLEMENTATION_NOT_AUTHORIZED` | OTWARTE (wg dok.) |
| `TLS-CHAIN-OWN-001` | P0 / Platform | 4 klasy: Outputs/Insights/Reports/Initiatives rozdzielone | `FOUR_CLASS_MODEL / IMPLEMENTATION_NOT_AUTHORIZED` | OTWARTE (wg dok.) |

## Podsumowanie

### Źródło A+B (85 pozycji — MASTER_STATUS_REGISTER.md + 16×MODULE_ACCEPTANCE.md)

| Werdykt | P0 | P1 | Razem |
|---|---:|---:|---:|
| NAPRAWIONE (kod zweryfikowany commitem/grepem/testem) | 15 | 18 | 33 |
| OTWARTE (realny defekt dziś, w tym częściowe) | 14 | 29 | 43 |
| NIEWERYFIKOWALNE STATYCZNIE (wymaga żywego backendu/przeglądarki/AI) | 6 | 2 | 8 |
| ZDEZAKTUALIZOWANE (świadomie przeniesione poza moduł) | 1 | 0 | 1 |
| **Razem** | **36** | **49** | **85** |

**Otwarte P0 (14 z 36 P0 źródła A+B):** `CHAT-OWN-017` (brama akceptacyjna Chat),
`INI-OWN-002` (karta inicjatywy niepewna — prawdopodobnie naprawiona, niepotwierdzona),
`INT-CREATOR-OWN-001` (Creator Shell, DUŻE), `MYW-IDEAS-CORE-001`, `MYW-IDEAS-CORE-002`,
`MYW-MGR-REC-001`, `MYW-NBK-CORE-001`, `MYW-NBK-CORE-002`, `MYW-PHOTO-001`, `MYW-PHOTO-002`,
`MYW-PHOTO-007`, `MYW-PHOTO-010`, `RES-OWN-002`, `XMOD-CARD-REC-001`.

**Niewerfikowalne statycznie P0 (6):** `ASM-OWN-001`, `ASM-OWN-002`, `ASM-OWN-003`
(wymagają żywego backendu za Vite-proxy), `EXE-OWN-003` (wymaga lokalnego seeda),
`INI-OWN-001` (wymaga przeglądarki na `/initiatives?sampleData=initiatives`),
`RES-OWN-003` (wymaga żywej Postgres, przelot zapis→odczyt).

### Trzecie źródło (36 pozycji — nested REGISTER*.md, weryfikacja lżejsza)

| Werdykt | P0 | P1 | Razem |
|---|---:|---:|---:|
| OTWARTE (wg dokumentu; 6/36 dodatkowo zweryfikowane grepem negatywnie) | 32 | 4 | 36 |
| NAPRAWIONE | 0 | 0 | 0 |

Wszystkie 36 pozycji trzeciego źródła (27 z `owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md`
+ 9 z `modules/03_TOOLS/TOOLS_OWNER_REVIEW_REGISTER.md`) pozostają OTWARTE — żadna nie niesie
dowodu implementacji. Większość (30/36) to nie "błędy" w sensie regresji, tylko
**architektoniczne decyzje produktowe czekające na autoryzację właściciela**
(`IMPLEMENTATION_NOT_AUTHORIZED` / `NOT_ACCEPTED`) — bramka G20 "zero open P0/P1" ich nie
odróżnia od zwykłych defektów, ale ich natura jest inna: to nie jest dług do spłacenia
programistycznie, tylko decyzje do podjęcia przez Piotra.

### Łącznie (121 unikalnych pozycji ze wszystkich trzech źródeł)

- **Mianownik: 121** (68 P0, 53 P1)
- **NAPRAWIONE: 33** (27%) — wyłącznie ze źródła A+B
- **OTWARTE: 79** (65%) — 46 P0 (14 ze źródła A+B + 32 z trzeciego źródła) i 33 P1
  (29 ze źródła A+B + 4 z trzeciego źródła)
- **NIEWERYFIKOWALNE STATYCZNIE: 8** (7%) — wszystkie ze źródła A+B; **AKTUALIZACJA 03.09 noc (dyżur 291)**:
  wszystkich 8 uruchomiono na żywym backendzie/Postgresie — kolumna „Werdykt dziś” każdego wiersza niesie
  teraz werdykt RUNTIME zamiast samej etykiety „NIEWERYFIKOWALNE STATYCZNIE”; 3 okazały się NIE DOTYCZYĆ
  kodu (`ASM-OWN-001/002/003` → `G16`, defekt wdrożenia/proxy), 4 zostają OTWARTE z nowym dowodem i
  szacunkiem (`INI-OWN-001`, `EXE-OWN-003`, `EXE-OWN-005`, `RES-OWN-003`), 1 zostaje NIEWERYFIKOWALNE bez
  providera (`INT-INIT-AI-OBS-001`) — zero z ośmiu przeszło w NAPRAWIONE. Źródło: `ODBIOR_DYZUROW_286_290_291_20260903.md` §3.5.
- **ZDEZAKTUALIZOWANE: 1** (1%) — `MYW-AGT-REC-001`, świadomie przeniesione do modułu 17

### Rozjazd między rejestrami — zmierzony, nie hipoteza

Rozjazd między `MASTER_STATUS_REGISTER.md` a sumą wszystkich zidentyfikowanych rejestrów
wynosi **61 pozycji** (121 łącznie w trzech źródłach minus 60 z tabeli master
`22 P0 + 38 P1` = 61), z czego:

- **25 pozycji** to defekt zakresu master-tabeli wewnątrz źródła A+B: master pokazuje
  `Open P0`/`Open P1` = `0` dla `02_INTERVIEW` (7 pozycji), `06_EXECUTION` (8 pozycji) i
  `09_RESULTS` (8 pozycji), mimo że te trzy moduły mają WŁASNE, niezerowe tabele P0/P1 we
  własnych `MODULE_ACCEPTANCE.md` — razem 23 pozycje nieujęte w liczniku master plus
  2 pozycje różnicy w rozbiciu Chat (`P0`–`P2` agregat vs faktyczne `1 P0 + 13 P1 + 3 P2`,
  gdzie sam agregat "17" różni się od sumy 1+13=14 policzonej per pozycję o 3 — te 3 to P2,
  poza mianownikiem tego dyżuru, więc licz jako 0 dodatkowej różnicy tutaj) = **25**.
- **36 pozycji** to defekt zakresu OBU nazwanych dokumentów: ani `MASTER_STATUS_REGISTER.md`,
  ani `MODULE_ACCEPTANCE.md` (Assessment ma tylko 3 pozycje własne, Tools ma 0) nie
  odzwierciedlają rejestrów `owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md` (27)
  i `modules/03_TOOLS/TOOLS_OWNER_REVIEW_REGISTER.md` (9) — te istnieją od 22-23.08,
  autoryzowane przez właściciela jako "capture", ale nigdy nie zostały wciągnięte do
  licznika żadnego z dwóch nazwanych rejestrów.

**Przyczyna rozjazdu**: `MASTER_STATUS_REGISTER.md` deklaruje własną regułę aktualizacji
("Update rule: this table is updated only after reconciling its counts against the module
register") — ale ta reguła nigdy nie została zastosowana wstecznie do `02_INTERVIEW`/
`06_EXECUTION`/`09_RESULTS` (ich P0/P1 istniały od 22-23.08, master pokazuje `0` od zawsze,
łącznie z aktualizacją z 2026-09-02) ani do dwóch osobnych rejestrów Assessment/Tools,
które formalnie leżą poza plikiem `MODULE_ACCEPTANCE.md`, do którego reguła się odnosi.
To NIE jest dowód że 61 pozycji "zniknęło z bazy" — to dowód że licznik master nigdy nie
objął tych czterech plików źródłowych, mimo że jego własna reguła aktualizacji to nakazuje.
Bramka G20 ("zero open P0/P1 across all registers") licząc wyłącznie z tabeli master
(60 pozycji) nie zobaczyłaby 61 z 121 realnie zarejestrowanych pozycji — w tym 46 z
79 dziś wciąż otwartych.
