# ★★★ ROLLOUT ARTEFAKTU — PLAN WYKONANIA (2026-07-05)
> Następny krok po triadzie (LISTA/SPEC-L done na demo). Teraz: powierzchnia ARTEFAKT/SPEC-A.
> SSOT standardu = `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (v1.0, kompletny).
> Zbudowany po 2 zwiadach kodu w /private/tmp/triada (= demo a1685bb798).

## 0. CO ROBIMY (jednym akapitem)
Standard artefaktu jest GOTOWY jako proza (ARTIFACT_ANATOMY_STANDARD §10.2/§11.2 SPEC-A + §13 instancjacja + §18.1 DoD). Teza identyczna jak triada: **napisz powłokę raz — dostajesz ją za darmo w każdym artefakcie; archetyp zmienia TYLKO centrum**. Powłoka = Menu 1 tożsamości + Menu 3 nawigacja wewn. + **prawy panel accordion (Akcje·Właściwości·Powiązania·Komentarze·Historia/AI)** + kebab + stany. 5 archetypów: A Canvas · B Dokument · C Rekord · D Matryca · E Deck. 2 klasy: S (drawer) · L (pełna strona). ~33 realne artefakty.

## 1. KLUCZOWE ROZPOZNANIE (różnica vs triada)
Triada miała JEDEN wzorzec (MyWork) → zbudowaliśmy JEDEN komponent (StandardTable) → adopcja wszędzie.
Artefakty mają **TRZY dojrzałe powłoki** (nie jedną), każda dla innego archetypu:

| Powłoka | Plik | Archetypy | Artefakty na niej | Stan |
|---|---|---|---|---|
| **NModeShell** | `src/components/shared/NModeLayout/` (NModeHeader/ActionBar/LeftNav/Canvas/CBoard) | C Rekord | Task ✓ · Decision ✓ · Notification ✓ | 70% (brak accordion) |
| **IdeaMapWorkspace** | `src/components/MyWork/IdeaMapWorkspace.tsx` (+ WorkspacePanelStrip) | A Canvas | Mind Map · Process Flow · Whiteboard · Idea Table · Discovery Tools | **~100% — 0% dup, wzorzec** |
| **ExecutiveModuleShell** | (owija) DocumentStudio · Tabele · DeckBuilderMelsView | B Dokument · D · E Deck | Wordy/Document ✓ · Tabele ✓ · Deck(MELS, za flagą) | ~80% |

**+ artefakty z WŁASNYM chrome (ofiary duplikacji — cele migracji):**
| Artefakt | Plik | Duplikacja | Uwaga |
|---|---|---|---|
| **Initiative (C-L)** | `InitiativeDocumentView.tsx` (~9500 linii) | ~95% | NIE używa NModeShell; 20 ekranów wewn.; **największy dług, największe ryzyko migracji** |
| **Report (B-L)** | `PremiumReportEditor.tsx` + `EditorToolbar` | ~80% | własny TipTap chrome; NIE na ExecutiveModuleShell |
| **DeckBuilder legacy (E)** | `DeckBuilder.tsx` (nie-MELS) | ~60% | własny TopBar; MELS variant (20% dup) za flagą `isMelsDeckBuilderEnabled()` |
| **Notatka (B-S)** | `NotebookContent.tsx` | ~30% | Menu1 wspólny, edytor własny |
| **Assessment (D-L)** | `AssessmentSessionEditorView.tsx` | ~15% | własny Menu3 (nie standard); wnętrza=pure renderery |

**Wyrównanie do SPEC-A dziś:** A(~100%) > D(~85%) > B/E-MELS(~80%) >> Initiative/Report/Deck-legacy(~5-40%).

## 2. NAJWIĘKSZA WSPÓLNA LUKA — prawy panel accordion
Standard §10.2 wymaga prawego panelu = accordion 5 sekcji w stałej kolejności (Akcje·Właściwości·Powiązania·Komentarze·Historia/AI). **ŻADNA z 3 powłok go nie ma jako wspólny komponent** — dziś detale = sekcje w canvas (NMode), WorkspacePanelStrip 3-tab (Idea), boczny AI panel (Report). To jest #1 element do zbudowania — daje najwięcej spójności app-wide za najmniej ryzyka. Analog: StandardPreview był tym dla list.

## 3. CO REUŻYWAMY Z TRIADY
NIE cały StandardPreview (to layout listy-preview, 6-blok skrócony). ALE prymitywy `src/components/shared/PreviewPane/` — te same które naprawialiśmy przy crimson-leak:
`PreviewAIHintStrip` · `PreviewRelations` · `PreviewMetaCard` · `PreviewDetailsSection` · `PreviewActionButton`.
To SSOT stylu chipów/akcji. Nowy `ArtifactRightPanel` (accordion) budujemy Z TYCH prymitywów. StandardModuleBar NIE (moduł-specific).

## 4. DECYZJA ARCHITEKTONICZNA #1 (do Piotra — kształtuje cały plan)
Standard §10.2 mówi „powłoka IDENTYCZNA dla wszystkich 5 archetypów" = docelowo JEDNA powłoka. Realia: 3 dojrzałe powłoki + centrum faktycznie różne per archetyp.
- **Opcja A (rekomendacja) — WYRÓWNAĆ, nie scalać:** zostawić 3 powłoki (bo archetypy realnie różnią centrum), ale doprowadzić je do jednego KONTRAKTU: wspólny `ArtifactRightPanel` accordion + te same tokeny `c.*` + ta sama kolejność sekcji + zero crimson + wspólny header. Jak triada wyrównała tabele mimo różnych danych. Niższe ryzyko, szybszy efekt.
- **Opcja B — SCALIĆ w jedną powłokę:** jeden ArtifactShell dla A-E. Czysto wg litery standardu, ale OGROMNY refaktor (Initiative 9500 linii, canvas realtime, deck) = wysokie ryzyko, długie.
→ **Rekomendacja: A.** Litera standardu (jedna powłoka) realizowana przez jeden KONTRAKT, nie jeden komponent.

## 5. PLAN FAL (kolejność wg wartość/ryzyko; wg opcji A)
**Faza 0 — Fundament (bramka jak G0 triady):**
- Zbudować `ArtifactRightPanel` (accordion 5 sekcji z prymitywów PreviewPane) w `src/components/standard/` lub `shared/`.
- Ustalić referencję-wzorzec = **Task na NModeShell** (najbliższy SPEC-A, jak MyWork był dla list) — doprowadzić do 100% DoD §18.1 jako dowód.
- Audyt tokenów/crimson w 3 powłokach (jak crimson-leak w PreviewPane).

**Faza 1 — C Rekord (najczęstszy, największy dług):**
- Dokończyć NModeShell: wpiąć ArtifactRightPanel (Task/Decision/Notification).
- **Initiative → NModeShell** — ⚠ NAJWYŻSZE RYZYKO. Wymaga OSOBNEGO głębokiego zwiadu przed budową (20 ekranów, 9500 linii — NIE prosty adopter). Rozważyć etapowo: najpierw header+panel wspólny, potem centrum.
- KPI/Insight/RAID/Milestone/Change Request/Stage Gate/Action Proposal (C-S drawery) — wyrównać do NModeShell.

**Faza 2 — B Dokument:**
- Report (PremiumReportEditor) → ExecutiveModuleShell (jak DocumentStudio). ~80% dług.
- Notatka wyrównać (accordion). Assessment Report / Audit Report / Executive Summary.

**Faza 3 — D Matryca:**
- Assessment Menu3 → standard (dziś własny topbar). Table Platform / Idea Table / Megatrend — audyt zgodności.

**Faza 4 — E Deck:**
- Włączyć MELS variant (ExecutiveModuleShell) domyślnie, wygasić legacy DeckBuilder TopBar. Decyzja flagi.

**Faza 5 — A Canvas (audyt-only):**
- IdeaMapWorkspace już ~100%. Tylko: swap WorkspacePanelStrip→ArtifactRightPanel dla spójności + audyt DoD. Najniższy wysiłek.

**Sieroty (D-NAV, §20 decyzje już są):** Context Builder = MARTWY (redirect→/organization) — potwierdzić usunięcie. KB legacy `/knowledge` = orphan. Reszta ma domy (§20: Studio→Materiały, KB→Settings, Legal/Partner→dbr77-internal, Megatrend→Context, ProjIntel→Execution, ExecSummary→Materiały).

## 6. KRYTERIA AKCEPTACJI (per artefakt = DoD §18.1)
Menu1(back·ikona·tytuł-inline·status·zapis·[indeks]·1 primary) · powłoka wg archetypu (tylko centrum różne) · prawy panel accordion w kolejności · powiązania klikalne first-class · slot AI stały · otwieranie wg §12.2 (L=pełna/S=drawer) + guard niezapisanych · stany empty/loading/error uczciwe · light+dark tokeny c.* (zero navy/slate/hex) · zero crimson (fokus/status/badge/selection). Odbiór WZROKIEM na demo (jak triada).

## 7. HIGIENA (jak triada)
Robotnicy Sonnet/worktree per artefakt z /private/tmp; NIE tykają wspólnej powłoki bez koordynacji (kolizje); esbuild per plik; audyt oczami przed deployem; demo scalać `git merge origin/demo` NIGDY force-push; primary-* KAŻDY numer=crimson.

## 8. DECYZJE PIOTRA (2026-07-05) — ROZSTRZYGNIĘTE
1. **Decyzja #1: WYRÓWNAĆ 3 powłoki do wspólnego kontraktu** (nie scalać). Litera §10.2 realizowana przez jeden KONTRAKT (wspólny ArtifactRightPanel + tokeny + kolejność sekcji + zero crimson), nie jeden komponent. Jak triada.
2. **Kolejność: Fundament + Rekord (z Initiative).** Najpierw ArtifactRightPanel (accordion), potem archetyp C: dokończyć Task/Decision + zmierzyć się z Initiative.
3. Initiative W SCOPIE tej rundy (Piotr wybrał opcję z Initiative). ⚠ CTO-guard: mimo to Initiative (9500 linii, 20 ekranów) dostaje OSOBNY głęboki zwiad wykonalności PRZED budową — nie obiecuję migracji zanim nie potwierdzę że jest bezpieczna; jeśli zwiad pokaże zbyt duże ryzyko, wrócę do Piotra z etapowaniem.

## 9. WYKONANIE — start (2026-07-05)
Faza 0 w toku. Kroki przygotowawcze przed dotknięciem kodu:
- Zwiad A: kontrakt prymitywów `shared/PreviewPane/*` (propsy) + jak NModeShell dziś renderuje prawą stronę/sekcje → grunt pod budowę `ArtifactRightPanel`.
- Zwiad B: wykonalność migracji Initiative na NModeShell (co realnie trzyma te 9500 linii, co się da wydzielić, ryzyka).
Budowę ArtifactRightPanel robię SAM (wspólna powłoka = jak standard/ w triadzie, robotnicy nie tykają).

### 9a. WERDYKT ZWIADÓW (2026-07-05)
**Zwiad A (kontrakt fundamentu):** 8 prymitywów `shared/PreviewPane/` z pełnymi propsami (MetaCard/DetailsSection/Relations/AIHintStrip/ActionButton/BatchPanel/ActivityStrip/ActionBar). StandardPreview = wzór 6-blok. **NModeShell = 2-kolumnowy (lewy nav + canvas), BRAK prawego panelu** — trzeba dodać prop `rightPanel?: React.ReactNode` + kolumnę w gridzie. Brak Headless UI → własny collapsible (useState). Brak gotowego accordion → budować. Kontrakt ArtifactRightPanel opracowany (sekcje id/label-bilingual/children/collapsible/badge/isEmpty).

**Zwiad B (Initiative) — KLUCZOWA KOREKTA:** poprzednia ocena „~95% duplikacji chrome" = **OVER-REPORT** (potwierdza [[finding_gap_reports_overstate]]). Rzeczywistość: Initiative (10 598 linii) już używa NModeShell/NModeHeader, chrome duplikacja **~5-10%**. Prawdziwy problem = **mega switch/case 2699 linii dla 25 sekcji w jednym pliku** (SECTION_REGISTRY 28 komp. już istnieje w `Initiatives/sections/`). Werdykt: migracja pełna = 12-17 dni refaktoru (ekstrakcja 25 sekcji), wysokie ryzyko (state interdependencje decisions↔tasks↔RAID, approval/gates workflow).

### 9b. ROZRÓŻNIENIE — WYGLĄD vs REFAKTOR (rdzeń tej rundy)
Piotr pytał **jak mają WYGLĄDAĆ** artefakty → rdzeń = **wyrównanie wizualne do SPEC-A** (tokeny c.*, zero crimson, wspólny accordion, kolejność sekcji, stany). To re-skin: tani, niskie ryzyko, dla WSZYSTKICH artefaktów włącznie z Initiative (bo jego chrome już wspólny — wystarczy accordion + audyt tokenów, BEZ ruszania switcha).
Rozbicie Initiative mega-switch na 25 sekcji (12-17 dni) = **osobny dług techniczny (czytelność kodu), NIE wygląd** → ODŁOŻONE, nie mieszać z re-skinem. Zgłosić Piotrowi jako osobny workstream.
**Skorygowany plan Fazy 1:** wyrównanie WIZUALNE wszystkich artefaktów C do SPEC-A (accordion + tokeny + crimson), Initiative wchodzi WIZUALNIE (bez refaktoru). Refaktor Initiative = backlog.

---
# CZĘŚĆ WYKONAWCZA — od 0 do końca (gotowe do startu "po powrocie")

## 10. INFRASTRUKTURA (gotowa 2026-07-05)
- **SSOT standardu:** `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (§10.2/§11.2 SPEC-A, §13 instancjacja, §18.1 DoD).
- **Skill:** `.claude/skills/consultify-artefakty/` — auto-ładuje kanon przy pracy nad ekranem-artefaktem. Wołać ZAWSZE (jak consultify-triada dla list). ✅ gotowy.
- **Hook:** `.claude/hooks/check-artefakt.sh` (w settings.json obok check-triada) — blokuje KAŻDY `primary-*`/navy/slate/hex w plikach WSPÓLNEJ POWŁOKI (shared/PreviewPane, shared/NModeLayout, standard/Artifact*, standard/StandardPreview). Chroni fundament przed crimson-leak. ✅ gotowy + przetestowany.
- **Fundament komponentowy:** `src/components/standard/ArtifactRightPanel.tsx` (accordion 5 sekcji) ✅ zbudowany, na demo (2f587e657b), NIEWPIĘTY.
- **CLAUDE.md:** reguła artefaktów dopisana (pkt 6). ✅
- **Wzorzec jakości:** Task na NModeShell (docelowo) — jak MyWork był dla list.

## 11. HIGIENA WYKONANIA (jak triada — żelazne)
- Robotnicy: Sonnet, worktree per artefakt z `/private/tmp/tr-art-<nazwa>` bazujący na `triada-standard`, symlink node_modules. NIE tykają wspólnej powłoki (ArtifactRightPanel/NModeShell/PreviewPane) — TĘ robi nadzorca sam (kolizje). esbuild per plik, ZAKAZ tsc/vitest, commit-per-krok, NIE push, ZERO wnuków. Prompt = "WYKONAJ, nie deleguj".
- Baza = `triada-standard` (= demo). Sprawdzać `git -C /private/tmp/triada log -1` przed użyciem (worktree bywa wyrejestrowany — praca żyje w branchu).
- Load: `uptime` + `ps aux|grep tsc/vitest/esbuild<8` PRZED dispatchem. Load<100.
- Odbiór OCZAMI (zrzuty) przed deployem — DoD §18.1. Demo scalać `git merge origin/demo`, NIGDY force-push (spotkano 3× cudzy push, wszystkie scalone czysto).
- primary-* KAŻDY numer = crimson (nauczka crimson-leak); grep `primary-[0-9]` w audycie, nie tylko `[4567]00`.

## 12. HARMONOGRAM FAL — od 0 do końca

### FAZA 0 — Fundament (bramka G0 = pierwszy wizualny dowód)
1. ✅ Zbudować `ArtifactRightPanel` (done, na demo).
2. **Wpiąć w NModeShell:** dodać prop `rightPanel?: React.ReactNode` + 3. kolumnę w gridzie (dziś 2-kol: lewy nav + canvas). Bez przebudowy — tylko slot.
3. **Dowód na Task:** przenieść sekcje Task (Właściwości/Powiązania/Komentarze/Historia) z canvasu do `ArtifactRightPanel`, treść z prymitywów PreviewPane. Doprowadzić Task do 100% DoD §18.1.
4. Audyt oczami (Task: prawy panel accordion, Menu1, kebab, dark+light) → zrzuty → **G0 = akceptacja Piotra** → deploy. To odblokowuje fale 1-5 (jak G0 triady).

### FAZA 1 — C Rekord (wyrównanie WIZUALNE; największy dług)
- Decision → jak Task (accordion). KPI/Insight/Idea/RAID/Milestone/ChangeRequest/StageGate/ActionProposal (C-S drawery) → wyrównać do NModeShell+accordion (drawer §12.2).
- **Initiative — WIZUALNIE tylko:** wpiąć ArtifactRightPanel + audyt tokenów/crimson w chrome. NIE ruszać mega-switcha (to backlog §13). Cel = wygląd wg SPEC-A, nie refaktor.
- Interview = wariant Rekordu z centrum-czatem (§20 Q2) — audyt zgodności.
- Bramka G1: golden-path Rekordów oczami → deploy.

### FAZA 2 — B Dokument
- Report (`PremiumReportEditor`) → ExecutiveModuleShell (jak DocumentStudio). Notatka → accordion. Assessment Report / Audit Report / Executive Summary / KB / Legal / Partner / Meeting Notes → audyt + accordion.
- Menu2 formatowania spójne (§13.2). Bramka G2.

### FAZA 3 — D Matryca
- Assessment Session: Menu3 → standard (dziś własny topbar). Nawigacja wewn. Ocena·Mapa·Raporty (§13.4). Table Platform / Idea Table / Megatrend → audyt zgodności powłoki. Bramka G3.

### FAZA 4 — E Deck
- Włączyć MELS variant (ExecutiveModuleShell) domyślnie (flaga `isMelsDeckBuilderEnabled`→ON), wygasić legacy DeckBuilder TopBar. Nawigator slajdów=rail, prawy panel layout/brand→accordion. Bramka G4 (decyzja flagi + odbiór).

### FAZA 5 — A Canvas (audyt-only, najniższy wysiłek)
- IdeaMapWorkspace ~100% — tylko swap WorkspacePanelStrip→ArtifactRightPanel dla spójności + audyt DoD §18.1 (Mind Map/Process Flow/Whiteboard/Discovery Tool/Studio/Playbook). Bramka G5.

### SIEROTY (D-NAV §20 — decyzje są, wykonać)
Context Builder MARTWY (redirect→/organization) → potwierdzić usunięcie. KB `/knowledge` orphan → sprzątnąć. Reszta ma domy: Studio→Materiały, KB→Settings/Help, Legal/Partner→dbr77-internal, Megatrend→Context, ProjIntel→Execution, ExecSummary→Materiały.

## 13. BACKLOG (osobne workstreamy — NIE ta runda)
- **Refaktor Initiative:** mega-switch 2699 linii → 25 sekcji do `Initiatives/sections/` (SECTION_REGISTRY już istnieje). 12-17 dni, wysokie ryzyko (state interdependencje decisions↔tasks↔RAID, approval/gates). Dług CZYTELNOŚCI, nie wygląd. Robić po re-skinie, etapami (5 sekcji/PR).
- Wzmocnienie ExecutiveModuleShell do pełnego SPEC-A gdzie <100%.

## 14. DEFINITION OF DONE (per artefakt = §18.1, egzekwowalne)
Menu1(back·ikona·tytuł-inline·status·zapis-osobno·[indeks]·1 primary) · powłoka wg archetypu (tylko centrum różne) · prawy panel `ArtifactRightPanel` accordion w kolejności Akcje·Właściwości·Powiązania·Komentarze·Historia/AI · powiązania klikalne first-class · slot AI stały · otwieranie §12.2 (L=pełna/S=drawer)+guard niezapisanych · stany empty/loading/error uczciwe · light+dark tokeny c.* (zero navy/slate/hex) · zero crimson (fokus/status/badge/selection). Odbiór OCZAMI na demo, zrzuty do Piotra.

## 15. HANDOFF — jak wznowić (dla następnej sesji/agenta)
1. Czytaj: TEN plik + `ARTIFACT_ANATOMY_STANDARD.md` (§10.2/§11.2/§13/§18.1) + pamięć [[finding_three_artifact_shells]] [[project_artifact_anatomy_standard]].
2. Wołaj skill `consultify-artefakty` przy KAŻDEJ pracy nad artefaktem.
3. Start = FAZA 0 krok 2 (wpiąć ArtifactRightPanel w NModeShell) → dowód na Task → G0 Piotra.
4. Baza kodu = `triada-standard` (/private/tmp/triada = demo). Deploy jak triada (merge origin/demo, nigdy force-push).
5. Stan: fundament ArtifactRightPanel na demo (niewpięty), skill+hook+CLAUDE.md gotowe. Następny klocek = wpięcie.
