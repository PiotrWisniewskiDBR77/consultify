# HANDOFF 2026-07-15 — przejęcie wątku (Oxford/Harvey/Harvard wiring)

> Dla następnego agenta w nowym planie taryfowym. Czytaj W CAŁOŚCI zanim ruszysz.
> Właściciel: **Piotr** (product/strategy, nie-koder, komunikacja PO POLSKU, krótko, obrazkami).
> Ty jesteś CTO/nadzorcą floty. Rób graficzne wg zatwierdzonego standardu, nie wymyślaj rdzenia.

---

## 0. STAN NA TERAZ (punkt startowy)
- **demo tip = `3fbef633c4`** (origin/demo), żywe: `curl https://demo.consultify.ai/api/health` → status ok.
- **Bezpieczny punkt = tag `demo-safe-2026-07-12` @ `3fbef633c4`** (re-tagowany po każdym zielonym deployu; NIGDY force-push na demo, tylko na ten tag).
- **CAPABILITY_ENFORCE=enforce** ŻYWE na Railway demo (twarde egzekwowanie ról). Odwracalne: `railway variables --set CAPABILITY_ENFORCE=shadow`. Preflight okr.* w szablonach ról zrobiony (819987ecb1) — bez niego byłby 403 na OKR.
- Deploy target = origin/demo → Railway (auto). PROD=centerbeam (NIGDY bez zgody). Staging/demo DB = TROLLEY (współdzielona). Migracje testuj TYLKO na lokalnym docker postgres:15.

## 1. MANDAT PIOTRA (aktywny, nienaruszalny)
"Uruchamiamy maszynę. Zrobimy WSZYSTKIE funkcjonalności, podepniemy przód z tyłem, a NA KOŃCU zrobimy **Vegas** który posprząta całą grafikę." →
- **Funkcje+wiring TERAZ, grafika ZAMROŻONA do Vegas.** Nowe ekrany: kanoniczne komponenty (StandardTable/SPEC-A), plain, ZA FLAGĄ OFF. NIE poleruj wizualnie (dark-mode, tokeny per-panel) — Vegas robi to hurtem.
- Zatwierdzenia podsuwaj POJEDYNCZO gdy realnie trzeba (decyzja produktowa/integralność), nie per-plik.
- Piotr NIGDY nie jest pierwszym testerem wizualnym (reguła #7): TY renderujesz w dev-render harness + robisz zrzut, DOPIERO potem Piotr patrzy do akceptu. Flip default-ON dopiero po jego "tak".

## 2. CO DOWIEZIONO (dziś 07-15 + noc 07-14/15)
### Noc: cały Oxford + Harvey na demo (3 bundle)
- OXFORD `e8cc969e2d`: 6 narzędzi O3 pogłębione (risk/a3/capability/ambition/focus/narrative) + O2 warstwa wniosków (12 walidatorów) + O4 finance-advisory + O5 rejestr promptów + O6 benchmark.
- HARVEY `c0e11ecf7e`: HP-2/3 agentRuntime+31 manifestów, HP-6/7/9 Workflow Engine, HP-14/15 Evidence, HP-22/23 Client Vault.
- D-02 `5267d10443`: sprzątanie Admina (112 plików rm + 21 przeniesionych do views/superadmin/).
### Dzień: 2 fale WIRINGU (podpięcie osieroconych silników)
- FALA 1 `a4c479aa09` (8 gałęzi): Oxford O4 business-case route + scenariusze/value-tree/portfolio + trend/post-mortem (6 silników → raport, 7 warstw analitycznych) · O5.5 ekran rejestru promptów · Harvey HP-7/8 Workflow REST + pasek · HP-16 Evidence 2/8→6/8 · Harvard M17/M16 integralność · M14 3 silniki zmiany.
- FALA 2 `3fbef633c4` (4 gałęzie): Harvey HP-16 Evidence **8/8 KOMPLET** · Harvard §27 M03/M04 (2 tabele StandardTable) · Oxford O5 SIRI/ADMA guidance parity + sheet anty-fabrykacja · M01 agent-manifests endpoint (read-only).
- Wcześniej dziś: fix P1 SCIM cross-org (na demo), coverage F1 (npm ci --prefix server, ~112 plików routes/ odblokowane), pierwszy zielony IRIS na demo w historii.

## 3. ★★★ NAJWAŻNIEJSZE ODKRYCIE (rama myślenia)
Audyt 5 agentów (07-15) na żywym demo: **dokumentacja SSOT jest ~2 tygodnie w tyle i ZANIŻA.** Wzorzec powtarzalny we wszystkich programach: **silniki SĄ zbudowane i przetestowane, ale OSIEROCONE (zero callerów) albo NIEPODPIĘTE do UI/route.** Luka do 100% = najczęściej **WIRING + odbiór Piotra, nie budowa.**
- ZAWSZE weryfikuj żywy runtime (grep callera src/+server/src), nie checkboxy w docach. "Puste ≠ brak".
- Oxford ~80% kodowo (wąskie gardło = ODBIÓR Piotra, sesja B6). Harvard ~72%. Harvey ~41% (bloki C Command Center + E Benchmark nietknięte).
- Pełny audyt: `scratchpad/audyt_dnia/*.md` (8 plików) + artifact https://claude.ai/code/artifact/da7f0d11-91b5-49a3-804b-99f149e868e9

## 4. DECYZJE CZEKAJĄCE NA PIOTRA (żadna nie blokuje)
1. **EXPORT_APPROVAL_ENFORCE** — bramka eksportu (M17) jest w trybie shadow (loguje, nie blokuje), bo większość raportów ma publishState=NULL. Flip na twardy dopiero gdy workflow recenzji się przyjmie.
2. **Portfolio NPV** — proxy `capex×ROI%` (brak prawdziwego DCF w bazie; initiative_financials.npv martwe). Wystarcza do rankingu; prawdziwy silnik NPV = osobny temat.
3. **"Uruchom agenta z Teresy"** (tryb Plan, HP-4/5) — osobna SESJA PROJEKTOWA (trzeba zdefiniować semantykę wykonania agenta; nie da się bezpiecznie doczepić do 9000-liniowego pipeline czatu).
4. **3 ekrany za flagą do akceptu** (zrzuty zweryfikowane przeze mnie 07-15):
   - `promptRegistryUi` — CZYSTY light+dark ✓ gotowy do flipu (AI Platform→Development).
   - `changeSignals` (panel M14) — light OK, DARK białe karty nieczytelne (kopiuje istniejący ExecutionIntelligencePanel bez dark: — Vegas naprawi hurtem). Funkcjonalnie OK.
   - `artifactApprovalUi` (pasek aprobaty) — zbudowany, brak konsumenta/story (Vegas).
   Podgląd na demo za flagą: `?ff_promptRegistryUi=1`, `?ff_execChangeSignals=1`.
5. **Rozszerzyć StandardTable o `rowClassName`** → domknąć §27 dla M03 Tasks/Inbox (nie zmigrowane bo FilterableTable nie ma tego propa + Inbox potrzebuje grouped-rows).
6. **Sesja B6** (live-odbiór Oxford) — prompt-book `_ODBIOR_HARVARD_B6_PROMPTBOOK.md` gotowy. To odblokowuje Oxford do "gotowe".

## 5. OTWARTA KOLEJKA (następne fale)
- **Fala 3 kandydaci**: §27 SuperAdmin (M27 — 59 plików raw <table>, dedykowany sprint) · i18n dług (M08 1113×, M10 ~2090×, M07 382× isPl) · Harvey HP-22 Vault w nawigacji (decyzja gdzie w menu) · Harvey HP-24 SSO self-service · O3 13/19 narzędzi "pogłębić do poziomu SWOT".
- **Integralność (naprawy)**: (a) premium sheet generator `tableSchemaGeneratorService.ts` B4 — każe LLM "realistic estimates" bez groundingu = fabrykacja jak WACC · (b) M17 flip enforce po adopcji · (c) M16 legacy/v8 finance konsolidacja (zrobiony org-scope, warto ujednolicić mechanizm).
- **Burn-down 256 testów** (task #41): F1 zdjął 220→152 plików crashujących; zostaje F2 i18n mock-leak (singleton 'i18next') + realny bug auth.validators password-strength + orphany. Doc `_BURNDOWN_COVERAGE_256`. Po zejściu do 0: usunąć continue-on-error z coverage joba.
- **Duże tematy (sesje)**: Harvey Command Center (HP-10..13 — TenantCommandCenterView to INNY byt), Harvey Benchmark (HP-18..21 zero śladu), **Vegas** (finał wizualny — dopiero po domknięciu mechaniki).
- Docy do aktualizacji: `_PROJEKT_C_OXFORD.md` (zaniża, ~2 tyg w tyle), `MASTER.md` liczby M24, A1-affiliate (plik nie istnieje — descoped).

## 6. ZADANIA W TLE (osobne sesje Piotra, dostaniesz notyfikacje)
- task_d54d6199 — wire livingBusinessCaseService (fantom, docblock kłamał)
- task_1d3a020a — fix check-list-canon.sh multi-line <table> false positive (regex gubi wieloliniowy §27-exempt)
- task_e6f8caf2 — audit premium sheet B4 generator fabrykacja
- task_53b7b458 — dekoracyjne testy stageGate/workqueue (testują własne fake-reimplementacje)
- task_7953f0d5 — audit-organization-context-cross-app po D-02
- (+ starsze: task_23785c61 i18n M13 keys, task_0b51de52 NotebookLibrary "Team"→"Organization" test)

## 7. MECHANIZMY I PUŁAPKI (musisz znać przed pracą)
- **Flota worktree**: `git worktree add -b <nazwa> .worktrees/<nazwa> origin/demo`, symlink node_modules (+ server/node_modules jeśli backend), commit-per-krok, NIE push (tylko Ty-nadzorca pushujesz). ~16 równolegle max.
- **Robotnicy = Sonnet** (mechanika/wiring), Haiku (sweepy), Opus tylko trudny kod. TY (nadzorca) = wysoki model. W promptach: "WYKONAJ SAM, zero sub-agentów" (inaczej delegują i czekają — realny błąd dziś).
- **Deploy**: push origin/demo → boot-poll (`/api/health` aż gitSha==target AND 4× "ok") → `git tag -f demo-safe-2026-07-12 <sha>` + force-push TAGU. Zawsze `git merge-base --is-ancestor origin/demo HEAD` przed push (fala nocy udowodniła: force-with-lease może cicho zgubić commit).
- **★ tsc-at-integration**: esbuild/vitest u robotników NIE robią type-check → integrator MUSI `npm run type-check` (frontend) + `cd server && npx tsc --noEmit` (porównaj z baseline, NOWE=0). Każda integracja łapała 3-5 utajonych długów typów.
- **★ financeReportSectionService.ts** = plik-magnes: FinanceReportSection ma teraz 7 warstw (lineage/trend/evidence/conclusions/scenarios/valueTree/portfolioAdvisory), 9 sekcji markdown. Każda gałąź dotykająca go = UNION wszystkich pól (nie zgub żadnego). 
- **Lint CI**: lintuj PEŁNY diff vs origin/demo (nie tylko własne pliki) — 3 czerwone lint-joby dziś z plików gałęzi pobocznych. Pułapki: hex-parser łyka "#68b"/"#24c" z komentarzy (pisz "ADR 68b"); i18next 'count' zarezerwowany→{{value}} dla stringów; import '@/i18n' w testach=mock-leak→singleton 'i18next'.
- **Bramki przed push UI**: `bash scripts/check-list-canon.sh` (blokuje bespoke tabele) + `node scripts/check-hardcoded-colors.cjs` (ratchet; nowy dług→tokeny c-*, re-baseline `npm run check:colors:update` tylko dla wzorca zastanego w pliku).
- **CI IRIS na demo**: shardy unit/component/integration są POMIJANE na branchu demo (gate ref==main/develop) — realne testy tylko w job coverage (75min, informacyjny). "Zielony IRIS" ≠ pełne testy.
- **Kolory/tokeny**: `primary` w tailwind = crimson #85182F (czerwień TYLKO semantyka). CTA neutralne, fokus niebieski c-focus. Tokeny c-* theme-aware.

## 8. SKILLE (wywołuj wg mandatu)
consultify-plan-master (orkiestracja) · consultify-petla (pętla test-napraw-deploy) · consultify-test (progi/odbiór) · consultify-promocja-demo (deploy) · consultify-triada (kanon list) · consultify-artefakty (kanon SPEC-A) · consultify-fable-sesja (wyzwania ★ koncepcyjne) · consultify-finisz-modulu (8 narzędzi).

## 9. PIERWSZY RUCH NOWEGO AGENTA
1. `git fetch origin demo` (tip mógł uciec), sprawdź health demo.
2. Przeczytaj ten handoff + `scratchpad/audyt_dnia/*.md` (stan 3 programów).
3. Zapytaj Piotra o kierunek LUB kontynuuj kolejkę §5 wg mandatu (funkcje+wiring, grafika=Vegas).
4. Rytm: flota Sonnet per plaster → integrator (pełny tsc) → deploy (boot-poll+re-tag) → podsuń decyzje/zrzuty Piotrowi.
