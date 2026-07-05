# ★★★ PLAYBOOK NOCNY — 3 RUNDY × 10 AGENTÓW (handoff dla świeżego agenta)
> Ustanowiony 2026-07-02 wieczór przez Stratega (kończył mu się context). Czytasz to jako ŚWIEŻY agent z zerową pamięcią rozmowy. Ten dokument + 4 pliki niżej = wszystko, czego potrzebujesz.
> **DEADLINE: klient Piotra jutro 16:00.** Cel nocy: podciągnąć wszystkie 3 projekty maksymalnie, złota ścieżka ma lśnić.

## 0. NAJPIERW PRZECZYTAJ (5 plików, w tej kolejności)
1. `_FINISZ_MASTER_PLAN.md` — pakt, 3 projekty, §2b polityka modeli, §0b metoda planowania, macierz pokrycia.
2. `_PROJEKT_A_HARVARD.md` / `_PROJEKT_B_VEGAS.md` / `_PROJEKT_C_OXFORD.md` — zamknięte listy z licznikami (status każdej pozycji).
3. `_TEST_ZAUFANIA_TRZY_FILARY.md` — miara jakości (ŁADNI×NIEZAWODNI×KOMPETENTNI, „czy konsultant HBS pokazałby klientowi").
4. `_KOORDYNACJA_CLAUDE_PIOTR.md` sekcja C — dziennik decyzji + odbiorów (Piotr pisze tu; TY dopisujesz status wykonania do sekcji A/dziennika).
5. Ten plik — kolejka 30 zadań.

## 1. STAN NA START NOCY (demo LIVE `f2e0a3fcd8`)
**Zrobione dziś (2 fale, 16 paczek, wszystko na demo):**
- OXFORD: DRD kanon+spec+raport HTML+narrator LLM+**699 pytań q-bank (7 osi)**+profile branżowe · SIRI/ADMA raporty wnioskowe · **top-5 tooli** (SWOT/Porter/Ansoff/ValueChain/Portfolio z drabinkami+silnikami syntezy+W2 trade-offy) · CONCLUSION_LAYER_STANDARD · prompty 25 sekcji inicjatyw.
- VEGAS: Fala 0-1 (WSZYSTKIE listy app na tokenach c.*) · **Editor Shell na 4 edytorach idea** (Mind Map/Process Flow/Tabela/Whiteboard) · PPTX DeckStyler + XLSX WorkbookStyler (próbki before/after) · standard Empty/Loading + 13 miejsc · Manager redesign (fix 512%).
- HARVARD: bugi M05 foldery/M06 routing/M15 (OEE+wykresy+motyw)/M16 (kreator+grounding)/M24 (add-member+audit-emitter+API-keys) · handoff M14→M15 (zapis+czytnik) · M17 dedup/filtr · **Panel Health (6 probe'ów)** · capacity-fix · M10 STT diagnostyka · M12 Audyty e2e · **M13 generator redesign** (create→dokument) · drobiazgi (role-PATCH/task-load/z-index).

**Liczniki (uczciwe, ✅=z dowodem+odbiorem Piotra — większość dziś = 🟡 wdrożone-czeka-na-odbiór):** HARVARD ~30 pozycji dotkniętych/60 · VEGAS Fala 1/7+ · OXFORD top-5+DRD komplet.

## 2. INSTRUKCJA OPERACYJNA (twarde reguły — łam=psujesz)
- **PROD (centerbeam/consultify.ai) NIETYKALNY.** Wszystko na `feat/deliverables-w1` + deploy na gałąź `demo` → Railway auto-deploy. Login demo: piotr.wisniewski@dbr77.com / 123456. Health: `curl -A "Mozilla/5.0" https://demo.consultify.ai/api/health` (gitSha).
- **Każdy agent = osobny worktree** (`isolation: "worktree"`), NIE pushuje, commituje na swoim branchu. TY (orkiestrator) robisz merge zbiorczy w głównym drzewie.
- **`git stash` ZAKAZANY na ślepo** — stash wspólny dla ~70 worktree = race. Path-scoped tylko z natychmiastowym pop+diff.
- **`/tests/` jest w .gitignore** → testy dodawaj `git add -f` + weryfikuj `git ls-files`.
- **Build:** `NODE_OPTIONS=--max-old-space-size=8192 npm run build` (bez 8GB = OOM). Worktree często nie ma `node_modules` → symlink do parenta na czas builda, usuń przed commitem. tsc bywa OOM — scoped tsconfig jako fallback.
- **Znane pre-existing test-noise (ignoruj przy failures=0):** `highlight.js/lib/core` (tiptap manual-gate), i18n-mock v8-runtime-strip, post-teardown OOM, AuditsHub waitFor-timeouty (3), InitiativeGantt render (3), CreateModelModal v8-create (2).
- **POLITYKA MODELI (§2b):** FABLE 5 = architektura/trudne decyzje/bramki jakości (OSZCZĘDZAJ — najbardziej limitowany!) · OPUS = kodowanie wg spec (koń roboczy, domyślny) · SONNET = treści (q-banki/prompty/raporty/i18n) · HAIKU = trywia. „Kanapka": Fable projektuje→Opus/Sonnet wykonuje→Fable weryfikuje. Eskalacja: 2× zła robota Opusa→Fable. **Ta noc: minimalny Fable** (wzorce już istnieją — klonuj je).
- **MIARA każdego zlecenia:** „czy konsultant HBS (MBA, 10 lat) pokazałby to klientowi?" + „widać bez szukania?".
- **Wolność technologii prezentacji:** HTML→PDF, biblioteki wizualizacji, programowy PPTX — dobieraj najlepsze.

## 3. RECEPTA MIĘDZY-RUNDOWA (wykonujesz TY po każdej rundzie)
Wyślij 1 agenta-mergera (Opus) ze zleceniem: „fetch+race-check (origin ruszył→wmerguj nie nadpisuj); merge N branchy od bezkonfliktowych; konflikty=unia semantyczna, feature-vs-feature splątany→STOP+raport; testy zbiorcze failures=0 (ignoruj znany noise); i18n gate 0; build 8GB zielony; push feat+demo (--force-with-lease); health sha; smoke GET /api/artifacts 200 + /api/admin/health-panel/probes 200". Podaj mu listę branchy+sha z raportów agentów + ostrzeżenia o kolizjach na plikach ewoluujących (MyWorkHub/ResultsHub/translation.json/Gateway/AdminSettingsModule = częste kolizje → struktura HEAD wygrywa, intencje brancha nakładasz).

---

## RUNDA 1 — ZŁOTA ŚCIEŻKA + NAJWYŻSZA WARTOŚĆ KLIENCKA (10 agentów)
*Cel: to, co klient zobaczy jutro, ma działać end-to-end i wyglądać premium.*

| # | Zadanie | Projekt | Model | SSOT/kontekst |
|---|---|---|---|---|
| 1 | **DRD raport → wpięcie w route serwerowy + narrator LLM live** — dziś generator istnieje ale nie ma endpointu HTTP; przycisk „Raport DRD" ma realnie generować z narratorem AI (kontrakt gotowy w `drdLlmNarrator.ts`) i otwierać HTML→PDF | OXFORD | Opus | `drdReportGenerator.ts`, `DRD_REPORT_SPEC.md`, wołaj llmService |
| 2 | **O4 Finanse jako doradztwo** — business case (assumptions→scenariusze nazwane biznesowo→rekomendacja), value tree benefitu, współzależności inicjatyw; wg CONCLUSION_LAYER W3 | OXFORD | Opus | `financialModelingService`, `CONCLUSION_LAYER_STANDARD.md` §W3 |
| 3 | **Tools #6-7: A3 Problem Solving + SOP Builder** do klasy Consultify (klonuj wzorzec `src/config/{swot,porter,ansoff}/`: drabinka+staircase+silnik+W2) | OXFORD | Opus | wzorzec `src/config/ansoff/` (najczystszy), lekcje w raportach |
| 4 | **Tools #8-9: SMED Planner + DMS Builder** — jw. wzorzec | OXFORD | Opus | jw. |
| 5 | **VEGAS Fala 3: Execution hub + Gantt** — anatomia SPEC-H, chrome instrumentu Gantt (M14), tokeny, kolory serii c-tag; NIE ruszaj logiki timeline | VEGAS | Opus | `ARTIFACT_ANATOMY_STANDARD.md` §15/§17 |
| 6 | **VEGAS Fala 3: Finance hub + Results hub polish** — dashboardy/instrumenty do standardu (po redesignie list) | VEGAS | Opus | jw. |
| 7 | **VEGAS Chat SPEC-K** — ramka wokół czatu, bąble AI nie-crimson (dziś czerwone), anatomia konwersacji | VEGAS | Opus | `ARTIFACT_ANATOMY_STANDARD.md` §16 SPEC-K |
| 8 | **HARVARD S6.1: rejestr deliverables z back-reference** — artefakt (czat/tool/inicjatywa) rejestrowany w M17 z odnośnikiem do źródła; `registerChatDeliverable` e2e (dziś stub donikąd) | HARVARD | Opus | finding `deliverables_connection_model`, DEC-1 |
| 9 | **HARVARD: standard obsługi błędów fail-soft** — sweep gołych HTTP 500 (ensure*Table DDL bez try/catch); komponent błędu z Retry (jest w shared/states); koniec białych ekranów | HARVARD | Opus | finding `settings_500_lazy_ddl` |
| 10 | **HARVARD: M17 generator wejście redesign** — „dramat nawigacyjny" step 1 (80 artefaktów płaską listą, 2 paradygmaty): grupowanie źródeł, filtr, IA kroku | HARVARD | Opus | odbiór M17-UI1/2/3 w sekcji C |

**Po Rundzie 1:** merge+deploy (recepta §3). Sprawdź: DRD raport z przycisku działa; A3/SOP/SMED/DMS dają output; Execution/Finance/Chat wyglądają premium.

---

## RUNDA 2 — GŁĘBIA + HARTOWANIE (10 agentów)
| # | Zadanie | Projekt | Model | Kontekst |
|---|---|---|---|---|
| 1 | **Tools #10-11: Inventory Autopilot + AI Discovery** wg wzorca | OXFORD | Opus | `src/config/` wzorce |
| 2 | **Tools #12-13: Pain Explorer + RPA Scanner** wg wzorca | OXFORD | Opus | jw. |
| 3 | **Tools #14 Process Automation + uczciwe gating CMMI/LEAN** („wkrótce", picker nie kłamie — bez startu sesji) | OXFORD | Opus | D-B, frameworkRegistry |
| 4 | **DRD q-bank EN mirror** — dziś tylko PL (runtime); stwórz lustro EN 699 pytań | OXFORD | Sonnet | `drdKnowledgeOverridesAxis*.ts` |
| 5 | **D-H Assessment AI-guidance realny per framework** — LLM podpowiada merytorycznie w trakcie oceny (DRD/SIRI/ADMA), zasilany kanonem+q-bankiem | OXFORD | Opus | D-H, DRD_CANON, CONCLUSION_LAYER |
| 6 | **VEGAS Fala 4: z-index sweep + motyw spójność app-wide** — systematyczny audyt warstw (dropdowny/modale/menu) + reszta jasnych powierzchni→dark tokeny | VEGAS | Opus | wzorce z RESKIN_AUDIT |
| 7 | **VEGAS: Empty/Loading rollout reszta** (pozostałe ~20 ekranów wg mini-kanonu) | VEGAS | Opus | `docs/ui-standards/02-components/empty-loading-states.md` |
| 8 | **HARVARD: RBAC bramki ról M03/M04 jawne + M25 fasady** (urealnić albo ukryć ~8 paneli AI/Voice/Memory) | HARVARD | Opus | H2.4/H6.5/H6.9 |
| 9 | **HARVARD: wydajność** — model loading skeleton+przyczyna, N+1 pomiar, timeouty ciężkich (120s override), strażnik regresji v8-mutacje | HARVARD | Opus | findings baseClient/staging-db-perf/v8-req-destroyed |
| 10 | **HARVARD: M27 SuperAdmin wejście+pakiet + eksport PDF M14** (dziś „PDF"=MD) | HARVARD | Opus | H6.10/H6.13 |

**Po Rundzie 2:** merge+deploy. Sprawdź: wszystkie ~14 tooli dają output; assessmenty mają AI-guidance; app spójnie ciemna; wydajność OK.

---

## RUNDA 3 — KLIENT-READY: ZŁOTA ŚCIEŻKA LŚNI (10 agentów)
*Cel: jutro 16:00 klient przechodzi Czat→Wywiad→Assessment→Tool→Inicjatywa→Wdrożenie→Rezultaty→Materiały bez zgrzytu.*

| # | Zadanie | Projekt | Model | Kontekst |
|---|---|---|---|---|
| 1 | **GOLDEN-PATH E2E probe + fix blockerów** — przejdź całą ścieżkę na demo (skrypt API+UI), zgłoś i napraw każdy blocker przejścia | HARVARD | **Fable** (trudna diagnoza cross-module) | mapa 11 przejść w `_TEST_ZAUFANIA` |
| 2 | **Piękny seed demo (Atelier Toys) dla klienta** — jeden spójny przykład firmy przez całą ścieżkę (insighty→assessment DRD→inicjatywy→rezultaty→materiały); + kasacja 39 śmieci (za zgodą Piotra w sekcji C — jeśli brak, tylko ukryj) | HARVARD | Opus | `docs/demo/ATELIER_TOYS_*`, DOWODY_SESJA1 lista śmieci |
| 3 | **Materiały: pełny 3-pak z golden path premium** — raport DOCX + deck PPTX (DeckStyler) + tabela XLSX (WorkbookStyler) z realnych danych Atelier; jakość „pokazać klientowi" | VEGAS+OXFORD | Opus | stylery gotowe, CONCLUSION_LAYER |
| 4 | **Chat world-class: function-calling smoke + fix** — Teresa generate_deliverable/generate_initiative działa E2E (był AI-SDK-v6 maxSteps bug); bąble po SPEC-K | HARVARD | Opus | findings chat_function_calling/ai_sdk_v6 |
| 5 | **Rozjazd CONCLUSION_LAYER na outputy wszystkich tooli** — każdy z 14 tooli produkuje wniosek wg formuły (nie tylko top-5) | OXFORD | Opus | CONCLUSION_LAYER_STANDARD |
| 6 | **Panel Health: dodaj probe'y golden-path + wszystkie moduły** (rejestrowe — dopisz obiekty do tablicy) | HARVARD | Opus | `healthProbeService.ts` wzorzec |
| 7 | **VEGAS: hartowanie mikro-detali golden-path** (8 ekranów ścieżki dopieszczone do perfekcji — spacing, empty-states, ikony, transitions) | VEGAS | Opus | ARTIFACT_ANATOMY |
| 8 | **HARVARD: beta-gating spójność + i18n reszta** (M18/M20/M02 isPolish→t()) | HARVARD | Sonnet | i18n gate, betaAccess.ts |
| 9 | **VEGAS: light mode golden-path** (jeśli Piotr potwierdził — inaczej dark polish) LUB Fala 5 P3-ekrany | VEGAS | Opus | UI canon light-mode decyzja |
| 10 | **KARTA SESJI 4 + konsolidacja decyzji** — przygotuj kartę odbioru całej nocy dla Piotra (przed/po golden-path + wszystkie otwarte decyzje w 1 miejscu) | koordynacja | Opus (lub sam Strateg) | wzorzec `_KARTY_SESJI/SESJA_2026-07-02_1.md` |

**Po Rundzie 3:** merge+deploy finalny. Napisz podsumowanie nocy do sekcji C tablicy + Karta Sesji 4. Zostaw Piotrowi: co live, co do odbioru, otwarte decyzje.

---

## RUNDA 4 — DOKOŃCZENIE MÓZGU + NASTĘPNA FALA VEGAS + DOMKNIĘCIE ŁAŃCUCHA (10 agentów)
> Dodana przez partnera-CTO 2026-07-03 na polecenie Piotra („zaplanuj jeszcze jedną paczkę, ja mu dam i dospię"). Cel: po złotej ścieżce (R3) dobić to, czego ŻADNA z rund 1-3 nie ruszyła — rozłączne zakresy, wartość+trudność kalibru dziennego.

| # | Zadanie | Projekt | Model | SSOT/kontekst |
|---|---|---|---|---|
| 1 | **Tools #15-16: Capability Mapper + Ambition Decomposer** — klon wzorca `src/config/<metoda>/` (deepeningLadder + moveValidator + conclusionPrompts + silnik syntezy + W2 trade-off) | OXFORD | Opus | wzorzec `src/config/ansoff/`, lekcje top-5 w raportach |
| 2 | **Tools #17-18: Focus & Trade-offs + Narrative Engine** — jw. wzorzec | OXFORD | Opus | jw. |
| 3 | **Tool #19 Risk & Uncertainty** — jw. wzorzec + wpięcie do RAID/rejestru ryzyk inicjatyw (nie osobny silos) | OXFORD | Opus | wzorzec + `INITIATIVE_FORMULA.md` (RAID) |
| 4 | **O1 Ścieżka dojrzałości N→N+1 (DRD/SIRI/ADMA)** — silnik rekomendacji „co konkretnie zrobić, by przejść z poziomu N na N+1" per wymiar (diagnoza→RECEPTA); zamienia assessment z opisu w preskrypcję | OXFORD | Sonnet | `DRD_CANON.md` (32 ścieżki N→N+1), kanony SIRI/ADMA, `CONCLUSION_LAYER_STANDARD.md` |
| 5 | **O4.5-4.7 Finanse domknięcie** — guidance parametrów (WACC/stopy per branża zamiast sztywnych) + analiza sprawozdań (trend+driver+prognoza) + realized-vs-projected post-mortem (dlaczego nie wyszło: rynek vs egzekucja) | OXFORD | Opus | `financialModelingService`, CONCLUSION_LAYER §W3, O6 benchmark branż |
| 6 | **VEGAS Fala 2 domknięcie: 3 EDYTORY DOKUMENTÓW na Editor Shell** (Prezentacja M19 / Tabele M18 / Raporty M17-doc) — idea-edytory mają shell (dzień), dokumentowe NIE (H4.3 ⬜) | VEGAS | Opus | `editor-shell-canon.md`, wzorzec Mind Map |
| 7 | **VEGAS Fala 3 reszta: huby+instrumenty POZA golden-path** (M13 hub, Assessment/DRD huby, Admin/Settings, pozostałe ModuleHuby) do anatomii SPEC | VEGAS | Opus | `ARTIFACT_ANATOMY_STANDARD.md` §15/§17 |
| 8 | **VEGAS Fala 6: JAKOŚĆ szablonów generowanych** — DeckStyler PPTX (layout composition „3-"→premium) + WorkbookStyler XLSX (głębia formatowania) | VEGAS | Opus | DeckStyler/WorkbookStyler, finding `deck_composition_redesign` |
| 9 | **HARVARD H1.4: Tools→Inicjatywy** — ożyw martwy callback (output toola tworzy inicjatywę z back-ref do źródła; S6.2, martwa luka łańcucha #4) | HARVARD | Opus | finding `deliverables_connection_model`, DEC-1, mapa 11 przejść |
| 10 | **HARVARD H1.8 + bug M06** — Rezultaty↔Finanse reconciliation (mapowanie KPI, po fixie jednostek OEE) + fix routingu M06 (Mind Map otwiera Process Flow, #3) | HARVARD | Opus | H1.8, finding `idea_deeplink_tool_routing_race` |

**Dispatch (dla orkiestratora):**
- Wypuść **po** zmerge'owaniu R1-R3 (Runda 4 dobija to, czego rundy nie ruszyły — zależności minimalne).
- Wszyscy **Opus w worktree** oprócz #4 (**Sonnet**, treść) — wzorce istnieją, klonuj (minimalny Fable). 2× zła robota Opusa na toolu → eskalacja Fable.
- **Kolizje:** #7 huby ROZŁĄCZNE z R1 (Execution/Finance/Chat) — bierz tylko pozostałe huby; **#8 stylery ruszaj PO R3 #3** (żeby 3-pak Atelier dało się zregenerować lepszymi szablonami). Reszta w pełni rozłączna.
- Po Rundzie 4: merge+deploy (recepta §3), dopisz do §5b, zaktualizuj liczniki O3 (tools →19/19) i H1.

**Co Piotr dostaje rano po R4:** Oxford **19/19 tooli** + assessmenty preskryptywne (ścieżka N→N+1) + Finanse-doradztwo komplet · Vegas Fale 2-3 w większości domknięte + szablony PPTX/XLSX premium · Harvard **2 martwe ogniwa łańcucha zamknięte** (Tools→Inicjatywy, Rezultaty↔Finanse).

---

## 4. CO POWIEDZIEĆ PIOTROWI RANO (szkielet raportu)
- Ile pozycji przeszło 🟡→wdrożone przez noc (licz z 3 plików projektów).
- Golden-path status: przechodzi/blockery.
- Gotowość na klienta 16:00: co pokazać, czego unikać.
- Otwarte decyzje (skonsolidowane z kart sesji).

## 5. HIGIENA KONTEKSTU (dla Ciebie, następny agent)
Gdy TWÓJ context się zapełni (~15% zostało) — NIE kombinuj, tylko: dopisz stan do tego pliku (które rundy zrobione, które branche czekają na merge, jakie sha), zaktualizuj liczniki w 3 plikach projektów, i poproś Piotra o odpalenie kolejnego świeżego agenta ze zdaniem: „Jesteś Strateg-noc. Przeczytaj `_NOCNY_PLAYBOOK_3RUNDY.md` sekcja 5 (stan) + kontynuuj rundy". Zostaw ślad, nie urwij w połowie.

---

## 5b. STAN WYKONANIA NOCY (żywy log orkiestratora — aktualizowany po każdej rundzie)
**Baza:** `feat/deliverables-w1` @ `f2e0a3fcd8` = live demo. PROD nietknięty.

### RUNDA 1 — DISPATCH (2026-07-02 ~19:45)
10 agentów Opus w worktree, wszyscy async. Mapowanie (agentId → zadanie):
- af14daadb758bbcf1 → #1 DRD raport route+narrator LLM (OXFORD)
- af5f0cbf3432ea6d8 → #2 O4 Finanse doradztwo W3 (OXFORD)
- abefc7eadc9afd059 → #3 Tools A3+SOP (OXFORD, klon ansoff)
- afbbd5460270413e6 → #4 Tools SMED+DMS (OXFORD, klon ansoff)
- a460c1f7ba78475bc → #5 VEGAS Execution hub+Gantt chrome
- aecd6db0aea9d1312 → #6 VEGAS Finance+Results polish
- ad2e3680c3167a0b1 → #7 VEGAS Chat SPEC-K bąble
- a8c947119f721b185 → #8 HARVARD rejestr deliverables (DEC-1)
- ae662cb80c7d195c8 → #9 HARVARD fail-soft 500 sweep
- a820761a46553f9d7 → #10 HARVARD M17 step-1 redesign
STATUS: ✅ 10/10 agentów dostarczyło. Branche do merge (sha · base · hot-spot):
- #1 af14daadb758bbcf1 @ e0aca6c547 · clean · api.ts+method (DRD raport route+narrator; UWAGA generator skopiowany do server/src/services/report/ — dług „keep in sync"→packages/shared)
- #2 af5f0cbf3432ea6d8 @ 16ea00081b · clean · new files only (4 serwisy finance W3)
- #3 abefc7eadc9afd059 @ d13f5b682c · clean · promptRegistry.ts (A3+SOP)
- #4 afbbd5460270413e6 @ 22bd01e24b · clean · promptRegistry.ts (SMED+DMS)
- #5 a460c1f7ba78475bc @ 124839129f · STALE a2b8b8b06a · Execution className
- #6 aecd6db0aea9d1312 @ a3b490d322 · clean · Finance/Results tokeny (31 plików)
- #7 ad2e3680c3167a0b1 @ cfa01ceb02 · STALE a2b8b8b06a · UnifiedChatPanel+css (SPEC-K)
- #8 a8c947119f721b185 @ 5de41cebf5 · clean · artifacts.routes+UnifiedChatPanel (rejestr deliverables; v8-gated=decyzja Piotra)
- #9 ae662cb80c7d195c8 @ 1882a8cb67 · STALE a2b8b8b06a · 5 routes+4 FE (fail-soft)
- #10 a820761a46553f9d7 @ 27527902f5 · SourceStep (M17 step-1)
HOT-SPOTY unii: promptRegistry.ts (#3+#4), UnifiedChatPanel.tsx (#7 wizual + #8 logika), api.ts (#1).
INCYDENT: #6 zrobił reset --hard na feat/deliverables-w1 (cofnięty, HEAD=f2e0a3fcd8 OK); STRATA: uncommitted edit _KOORDYNACJA (docs, niekrytyczny). Guardrail dla R2/R3: zakaz reset --hard/commit na feat na agencie.
### RUNDA 1 — MERGE+DEPLOY ✅ (HEAD `a1ad871593` LIVE na demo)
Wmergowane 8/10 (delta-overlay --3way): #1 DRD raport route+narrator · #2 finance W3 services · #3 A3/SOP · #4 SMED/DMS · #5 Execution tokeny · #7 chat SPEC-K · #8 rejestr deliverables · #9 fail-soft. Build zielony, testy 0 nowych faili, i18n 0, health=a1ad871593, smoke żywe. PROD nietknięty.
SKIP #10 SourceStep (M17 step-1) — feature-vs-feature splątany z HEAD (showDrafts/typeFilter vs redesign group/sort) → DECYZJA PRODUKTOWA PIOTRA (łączyć paradygmaty czy porzucić).
SKIP #6 Finance/Results tokeny — HEAD już przeskinowany dalej niż branch → bez straty.
DŁUG: generator DRD skopiowany FE→server/src/services/report/ („keep in sync"→packages/shared).

### RUNDA 2 — DISPATCH (baza a1ad871593)
Sync-bazy na starcie + guardrail „zakaz reset --hard na feat" + „zawsze commituj". Mapowanie:
- a78e8b6a4e6a90044 → #1 Tools Inventory Autopilot + AI Discovery (Opus)
- a56709417e7e8c77a → #2 Tools Pain Explorer + RPA Scanner (Opus)
- a0897f1b81c567061 → #3 Tool Process Automation + gating CMMI/LEAN coming_soon (Opus)
- a5b9dacbc9ae28e99 → #4 DRD q-bank EN mirror 699 (SONNET)
- a4d37a9ca0c0dc381 → #5 Assessment AI-guidance per framework D-H (Opus)
- a1bb5f6e14e1e4d35 → #6 VEGAS z-index sweep + motyw app-wide (Opus)
- a297dfc6365143231 → #7 VEGAS Empty/Loading rollout ~20 ekranów (Opus)
- a2e589fe354003ab1 → #8 HARVARD RBAC M03/M04 + M25 fasady (Opus)
- a112bac072608c3f2 → #9 HARVARD wydajność (timeout/N+1/v8-guard/skeleton) (Opus)
- a4aa6a4c76f92f225 → #10 HARVARD M27 wejście + M14 PDF export (Opus)
HOT-SPOTY unii R2: promptRegistry.ts (#1+#2+#3), frameworkRegistry.ts (#3 gating vs #5 read-only).
STATUS BUDOWY: ✅ 12/12 (na świeżej bazie a1ad871593 — zero stale-base). Branche do merge:
- #1 a78e8b6a @ 36ab815799 (Inventory+AI Discovery) · promptRegistry
- #2 a56709417 @ 49b7db11d2 (Pain+RPA, dokończ. commitem orkiestratora) · promptRegistry
- #3 a0897f1b @ 07e15cec2f (ProcessAuto+gating CMMI/LEAN) · promptRegistry+frameworkRegistry+NewAssessmentModal+DiscoveryToolsHub
- #4a a00fb33a @ 409a924bb3 (EN axis1-2, 88) · #4b a48960176 @ 4e13d74172 (EN axis3-4, 60) · #4c a6952ab6 @ e76f29b657 (EN axis5-7, 85) = q-bank EN 699 KOMPLET
- #5 a4d37a9c @ 5ebcb03909 (AI-guidance D-H) · nowy serwis + DRDAssessmentEditor
- #6 a1bb5f6e @ 1a3ecf72c3 (z-index skala tailwind + motyw, 26 plików) · AssessmentHub
- #7 a297dfc6 @ 734b4ff84f (Empty/Loading, 12 ekranów) · AssessmentHub+DiscoveryToolsHub
- #8 a2e589fe @ d93b4a69b0 (RBAC+M25 fasada→coming_soon) · translation.json
- #9 a112bac0 @ 3154115d7f (perf: timeout/N+1/v8-guard/skeleton)
- #10 a4aa6a4c @ fd58d47741 (M27 wejście + M14 realny PDF)
HOT-SPOTY: promptRegistry.ts(#1+#2+#3), DiscoveryToolsHub.tsx(#3+#7), AssessmentHub.tsx(#6+#7), translation.json(#8).
WIRING po merge: dodać lang param do getDRDKnowledge (import 3 map EN).
R2#4 oryginał (a5b9dacb) FAILED (thrash empty-tool-calls) → zastąpiony splitem 4a/4b/4c.

### RUNDA 2 — MERGE+DEPLOY ✅ (HEAD `b33d178efd` push feat+demo)
Merge-agent zastosował 12/12 delt (--3way, 0 .rej, 0 konfliktów-markerów) ale zawiesił się przed commitem → orkiestrator dokończył: commit `b33d178efd`, build zielony (55s), i18n 0, targeted testy 1367/1367 (nowe toole+EN wiring+DRD PL+gating+perf+PDF+superadmin+RBAC), push feat+demo. EN wiring getDRDKnowledge(lang) DONE (EN maps + PL fallback). Deploy Railway w toku (poll bgfduju9i).
LEKCJA: merge-agenci wieszają się na buforowanym outpucie build/deploy → orkiestrator robi gates sam (redirect do /tmp, czyta exit+summary).

### RUNDA 3 — DISPATCH (baza b33d178efd)
#2-#9 wypuszczone (Opus, #8=Sonnet). #1 golden-path=FABLE czeka na potwierdzenie deployu R2. Mapowanie:
- ab482c32e903bca3d → #2 Atelier seed PRZYGOTUJ (nie odpalaj na demo, brak zgody na kasację) (Opus)
- a9b2d6007b881db8b → #3 3-pak Atelier premium DOCX+PPTX+XLSX (Opus)
- aa400a4e7527740a3 → #4 Chat function-calling smoke+fix (Opus)
- ab5c20a2c783c7939 → #5 CONCLUSION_LAYER na 14 tooli (Opus)
- a7211cd30e43373ab → #6 Panel Health probe'y golden-path (Opus)
- a4d9db4b3b227c0f0 → #7 VEGAS mikro-detale 8 ekranów ścieżki (Opus)
- ad6abbb6a9ae9350b → #8 beta-gating + i18n M18/M20/M02 (SONNET)
- a1c138279034295b4 → #9 VEGAS dark polish P3 (Piotr NIE potwierdził light) (Opus)
- #1 golden-path E2E probe+fix = FABLE — dispatch po deploy R2.
- #10 Karta Sesji 4 + raport poranny = ORKIESTRATOR sam na końcu.
### RUNDA 3 — MERGE+DEPLOY ✅ (HEAD `d38d699823` push feat+demo)
Wszystkie 10 (9 kod + #1 Fable) dostarczyły. Orkiestrator zmergował sam (8 przez apply --3way, #6 binarny przez cherry-pick -n), commity aa3d6e4d2e+d38d699823. Build zielony (47s), i18n 0, targeted testy 47/47. Deploy Railway (poll bx2cejdv5).
FABLE golden-path: 9/11 przejść zielonych, 5 blokerów FIX (Tools→Init S6.2, overrideReason 422, M14→M15 schema+migration787, finance grounding CASH, OWNER-delete). Migration 787 + CASH + gate_ai-flag JUŻ na demo DB (ręcznie, żywe). Kod fixów deployuje się z d38d699823.
🔴 ZASTRZEŻENIA FABLE dla Piotra: (1) demo DB niestabilna (2× zapaść SELECT1→524) → dogrzać ~30min przed 16:00; (2) re-enable flaga gate_ai dla DBR77 PO deployu; (3) Assessment→Init: przygotuj UKOŃCZONY assessment (na demo same DRAFTy); (4) Rezultaty↔Finanse reconciliation = 🔴 BRAK, osobny strumień; (5) seed Atelier NIE odpalony (npm run db:seed:atelier — czeka na Piotra).
DECYZJA #8: beta-gating otworzył M12/M15/M16, zamknął M21 (zgodne D-A; admin-exempt; rewert 1 linia betaAccess.ts jeśli chcesz).

### ★ R1-R3 WDROŻONE. Karta Sesji 4 + §A tablicy zapisane. Demo zdrowe (DB zapaść przejściowa, wróciła 2ms).
R1 (a1ad871593) + R2 (b33d178efd) + R3 (d38d699823) LIVE. PROD nietknięty.

### RUNDA 4 — DISPATCH (baza d38d699823, dodana przez Piotra po R3)
10 agentów, Opus w worktree (Sonnet tylko #4). Mapowanie:
- a94767d5d95062515 → #1 Tools Capability Mapper + Ambition Decomposer (Opus)
- ae90c17fa18049564 → #2 Tools Focus & Trade-offs + Narrative Engine (Opus)
- a71d813c2e74f63ed → #3 Tool Risk & Uncertainty + RAID (Opus) [domyka 19/19]
- aa463bb9bbd56ad5c → #4 Ścieżka dojrzałości N→N+1 DRD/SIRI/ADMA (SONNET)
- a147b99d271d00bed → #5 Finanse O4.5-4.7 (WACC/branża+sprawozdania+post-mortem) (Opus)
- af85b4daa405c51f9 → #6 3 edytory dokumentów na Editor Shell (Opus, REDO — pierwszy ac02b056 zthrashował/pusty)
- acd48bd7fe061c8ee → #7 VEGAS huby poza golden-path (Opus)
- a75ed688833136592 → #8 Stylery PPTX/XLSX premium (Opus)
- aeced3521e4e01dd6 → #9 Tools→Inicjatywy generyczny handoff (Opus, buduje na Fable-SWOT R3)
- aabd699d016119d87 → #10 Rezultaty↔Finanse reconciliation + M06 routing (Opus)
HOT-SPOTY unii R4: promptRegistry.ts (#1+#2+#3), createInitiative/handoff (#3+#9 — wspólny wzorzec).
### RUNDA 4 — MERGE+DEPLOY ✅ (HEAD `74bdf2762e` push feat+demo)
Wszystkie 10 dostarczyły (#1 i #6-pierwszy zthrashowały uncommitted/pusto → #1 dokończony commitem, #6 re-dispatch af85b4da OK). Merge: cherry-pick wszystkich 10 (apply --3way był zawodny → reset-clean+cherry-pick; promptRegistry union 5 tooli rozwiązany ręcznie 2×). Build zielony (1m29s), i18n 0, targeted testy 246/246. Deploy Railway (poll bajg0nq9e).
DOWIEZIONE: **OXFORD 19/19 tooli** (Capability/Ambition/Focus/Narrative/Risk +RAID) · ścieżka N→N+1 DRD/SIRI/ADMA (serwis, niewpięty w UI — decyzja Piotra o miejscu) · Finanse O4.5-4.7 komplet · VEGAS 3 edytory dok na Editor Shell + 9 hubów c.* + stylery premium (Atelier regen) · HARVARD 2 martwe ogniwa: Tools→Inicjatywy generyczny (9 toolów) + M15↔M16 reconciliation (migration 20260703) + M06 routing residual (forcedIdeaDeepLinkRef nigdy nie trafił do kodu — naprawiony).
LEKCJA: cherry-pick > pipe-apply dla merge (binary-safe + prawdziwy 3-way); promptRegistry = wieczny hot-spot unii przy nowych toolach.
STATUS: ✅ R1-R4 (a1ad871593/b33d178efd/d38d699823/74bdf2762e) LIVE. PROD nietknięty. Następne: aktualizacja Karty Sesji 4 + §A tablicy (dopisać R4).
