# RN-G6 — Formalna macierz inwentaryzacyjna 10 torów RN-G5

Data audytu: 2026-08-12 (snapshot punktowy — `rn-g5-authz` i `rn-g5-platform` są w tej chwili aktywnie modyfikowane przez inne sesje; ich dane w tym dokumencie mogą się zdezaktualizować w ciągu godzin).

Repozytorium bazowe (audyt wykonany z tego drzewa, WYŁĄCZNIE odczyt):
`/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify-results-vnext-g0-20260809`
Gałąź robocza tego drzewa: `codex/results-vnext-g0-20260809` @ `8b03e2dba59055cd9abc74b48cea2990d12c0d3b` (2026-08-12 14:07:21 +0200) — niezwiązana z torami G5, tylko punkt odczytu.

Wspólna baza deklarowana: `35a1dee6c0` (pełny SHA `35a1dee6c03b66907219b5b645e4e3ecb267f80a`).

## ALARM — kontrola bezpieczeństwa (5 plików równoległej sesji)

**Sprawdzono wszystkie 10 torów przeciw pełnej liście plików każdego toru (`git diff --name-only 35a1dee6c0..<branch>`).**

| Plik chroniony | Dotknięty przez |
|---|---|
| `server/src/database/PostgresDatabase.ts` | ŻADEN tor — czysto |
| `tests/resultsVnext/kpi/initiativeKpiImpactBaselineFreeze.realdb.test.ts` | ŻADEN tor — czysto |
| `tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts` | ŻADEN tor — czysto |
| `tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts` | ŻADEN tor — czysto |
| `server/migrations/20260810_fix_initiatives_status_default.sql` | ŻADEN tor — czysto |

**Werdykt: BRAK ALARMU.** Żaden z 10 torów RN-G5 nie dotyka żadnego z pięciu plików równoległej sesji. Zweryfikowane grepem pełnej listy 613 wpisów plik-per-tor (`git diff --name-only` × 10 torów), nie próbką.

## Uzgodnienie liczby commitów — 94/94, ZGADZA SIĘ CO DO JEDNEGO

| Tor | Commits (`rev-list --count 35a1dee6c0..branch`) |
|---|---|
| rn-g5-harness | 2 |
| rn-g5-crossdomain | 3 |
| rn-g5-polish2 | 9 |
| rn-g5-kpicreate | 8 |
| rn-g5-deeplink | 6 |
| rn-g5-scopegap | 4 |
| rn-g5-teresa | 10 |
| rn-g5-interactive | 10 |
| rn-g5-authz | 41 |
| rn-g5-platform | 1 |
| **SUMA** | **94** |

Zgadza się dokładnie z deklarowanym `94` — brak rozbieżności do wyjaśnienia. Dodatkowo zweryfikowano:
- **Merge-base każdego toru = `35a1dee6c03b66907219b5b645e4e3ecb267f80a`** (identyczny dla wszystkich 10, `git merge-base 35a1dee6c0 <branch>`) — żadna rozbieżność bazy.
- **Zero duplikatów SHA między torami** — `git log --format=%H 35a1dee6c0..<branch>` dla wszystkich 10 torów, połączone, posortowane, `uniq -d` = pusty wynik. Żaden commit nie występuje w dwóch torach.
- Żaden tor nie ma commitów spoza `35a1dee6c0..HEAD` (rev-list liczy dokładnie tylko commity osiągalne z HEAD-a toru i nieosiągalne z bazy — z definicji nie może zawierać obcych; potwierdzone brakiem duplikatów SHA powyżej, co wykluczyłoby też przypadek "ten sam commit policzony w dwóch torach").

## Macierz per tor

### rn-g5-harness
| Pole | Wartość |
|---|---|
| Branch | `rn-g5-harness` |
| Worktree | `/Users/piotrwisniewski/rn-g2-lanes/g5-harness` |
| Base | `35a1dee6c0` ✓ |
| HEAD | `b644f3adfc952cac434bbccb81e225f5de58b68e` |
| Commits | 2 |
| Dirty | czysto (`git status --short` puste) |
| Scope | Naprawa harnessu dev-render: montuje REALNE wejścia route dla `results-vnext-roi-registry` / `results-vnext-okr-registry` (flaga OFF→EmptyState "…-disabled", ON→realny hub) zamiast opisowego "prezenter-reimplementacja"; dla `results-vnext-okr-workspace` podłącza prawdziwy `onSetChanged`/`onBackToSets` oparty o stan harnessu (status realnie się odświeża po przejściu cyklu życia) zamiast atrapy. Czysto kosmetyczno-uczciwościowa poprawka etykiet + realnego stanu harnessu, ZERO zmian w `src/`. |
| Files | `dev-render/main.tsx`, `dev-render/screens/results-vnext-okr-registry.tsx`, `dev-render/screens/results-vnext-okr-workspace.tsx`, `dev-render/screens/results-vnext-roi-registry.tsx` + 9 zrzutów |
| Collisions | `dev-render/main.tsx` (z `rn-g5-scopegap`, `rn-g5-teresa`) · `dev-render/screens/results-vnext-roi-registry.tsx` (z `rn-g5-deeplink`) · `dev-render/screens/results-vnext-okr-registry.tsx` (z `rn-g5-deeplink`) |
| Dependencies | Brak zależności PRZED — commity samowystarczalne (tylko harness). UWAGA: koliduje SEMANTYCZNIE i TEKSTOWO z `rn-g5-deeplink` w obu plikach ekranów (patrz macierz kolizji niżej — realny konflikt potwierdzony `git merge-tree`). |
| Docs | BRAK własnego dokumentu w `docs/product/results-vnext/` |
| Screens | 9 plików w `docs/qa/screens/rn-g5-harness-2026-08-12/` |

### rn-g5-crossdomain
| Pole | Wartość |
|---|---|
| Branch | `rn-g5-crossdomain` |
| Worktree | `/Users/piotrwisniewski/rn-g2-lanes/g5-crossdomain` |
| Base | `35a1dee6c0` ✓ |
| HEAD | `bebddfc303e79d745fa652aab2c52b02b78eb822` |
| Commits | 3 |
| Dirty | czysto |
| Scope | Weryfikacja istniejących testów e2e RN-G4 cross-domain (My Work/OKR/ROI/KPI/security) przeciw REALNEMU Postgresowi — wzmacnia 2 "słabe" asercje znalezione w przeglądzie negative-control, dokumentuje odpowiedzi Q&A dla orkiestratora. ZERO zmian w kodzie produkcyjnym, tylko `tests/acceptance/*.e2e.test.ts` + doc. |
| Files | 5× `tests/acceptance/rvn-g4-*.e2e.test.ts` + `docs/product/results-vnext/RN_G5_CROSSDOMAIN_EVIDENCE.md` |
| Collisions | Brak — żaden inny tor nie dotyka tych 5 plików testowych. |
| Dependencies | Niezależny — czysta weryfikacja, może wejść w dowolnym momencie, nie blokuje i nie jest blokowany. |
| Docs | `docs/product/results-vnext/RN_G5_CROSSDOMAIN_EVIDENCE.md` ✓ |
| Screens | 0 |

### rn-g5-polish2
| Pole | Wartość |
|---|---|
| Branch | `rn-g5-polish2` |
| Worktree | `/Users/piotrwisniewski/rn-g2-lanes/g5-polish2` |
| Base | `35a1dee6c0` ✓ |
| HEAD | `9942bc6772773d5826a95afb1c80d4452ff7f5ba` |
| Commits | 9 |
| Dirty | `M .claude/launch.json` — WYŁĄCZNIE wspólny plik konfiguracji dev-serwerów (per pamięć: nigdy nie `checkout --` na nim), zero zmian w kodzie produktowym. |
| Scope | Dodaje `toUserFacingErrorMessage()` (`src/components/ResultsVNext/shared/errorMessage.ts`) i podmienia surowe `err instanceof Error ? err.message : String(err)` na przetłumaczone komunikaty w ~14 plikach ROI/OKR/KPI/legacy-archive hubów i workspace'ów. Czysto kosmetyczna poprawka i18n błędów (task1 kebab PL, task2 error PL/EN light/dark), + testy jednostkowe/komponentowe. |
| Files | 24 pliki: `ResultsKpiRegistryPage.tsx`, `kpiMeasurements/ResultsKpiMeasurementsPanel.tsx`, `kpiScorecards/ResultsKpiScorecardDetailPage.tsx`, `kpiTool/KpiDeviationCaseSubview.tsx`, `kpiTool/KpiToolPage.tsx`, `kpiTool/kpiDeviationApi.ts`, `legacy/ResultsVNextLegacyArchivePanel.tsx`, 8× `okr/Okr*.tsx` (w tym `OkrReviewReflectionView.tsx`, `ResultsOkrHub.tsx`), 4× `roi/Roi*.tsx` (w tym `ResultsRoiHub.tsx`, `RoiCaseLearnWorkspace.tsx`), `shared/errorMessage.ts` + 2 pliki testów + doc + 10 zrzutów |
| Collisions | `ResultsKpiRegistryPage.tsx` (z `rn-g5-kpicreate`) · `kpiScorecards/ResultsKpiScorecardDetailPage.tsx` (z `rn-g5-scopegap`) · `kpiTool/KpiDeviationCaseSubview.tsx` (z `rn-g5-teresa`) · `okr/ResultsOkrHub.tsx` (z `rn-g5-deeplink`) · `okr/OkrReviewReflectionView.tsx` (z `rn-g5-teresa`) · `roi/ResultsRoiHub.tsx` (z `rn-g5-deeplink`) · `roi/RoiCaseLearnWorkspace.tsx` (z `rn-g5-teresa`) |
| Dependencies | Niezależny co do funkcji (czysto kosmetyczna warstwa błędów), ale dotyka NAJWIĘCEJ wspólnych plików ze wszystkich torów (7 kolizyjnych plików) → wejście PO strukturalnych torach (`deeplink`, `teresa`, `scopegap`) zmniejsza ryzyko konfliktu, bo polish2 może wtedy dołożyć swoje jednoliniowe zmiany do już-scalonej wersji zamiast odwrotnie. Patrz DAG niżej. |
| Docs | `docs/product/results-vnext/RN_G5_POLISH_EVIDENCE.md` ✓ |
| Screens | 10 plików w `docs/qa/screens/rn-g5-polish-2026-08-12/` |

### rn-g5-kpicreate
| Pole | Wartość |
|---|---|
| Branch | `rn-g5-kpicreate` |
| Worktree | `/Users/piotrwisniewski/rn-g2-lanes/g5-kpicreate` |
| Base | `35a1dee6c0` ✓ |
| HEAD | `4219e70b11aa0d26eea50d9b981c2fcda1838a45` |
| Commits | 8 |
| Dirty | `M .claude/launch.json` — jw., wspólny plik, nieistotne. |
| Scope | Pełny cykl życia definicji KPI z UI: create/edit/submit/approve/reject. Dodaje `KpiDraftFormModal.tsx`, `KpiTransitionDialog.tsx`, write-API wrappers w `kpiApi.ts`, wpina je w `ResultsKpiRegistryPage.tsx` (formularz+kebab+dialogi zatwierdzenia z blokadą samo-zatwierdzenia — zrzut 13/14/15/16 pokazuje przełączenie aktora). Naprawia teraz-odkryty defekt: `approve/reject` musiał się blokować PO decyzji, nie tylko po `submitted`; mocki GET w harnessie musiały zwracać świeże kopie, nie referencje do żywego obiektu. |
| Files | `dev-render/screens/results-vnext-kpi-registry.tsx`, `src/components/ResultsVNext/KpiDraftFormModal.tsx`, `KpiTransitionDialog.tsx`, `ResultsKpiRegistryPage.tsx`, `kpiApi.ts`, 1 plik testu + doc + 32 zrzuty |
| Collisions | `ResultsKpiRegistryPage.tsx` (z `rn-g5-polish2`) |
| Dependencies | Strukturalny (dodaje nową funkcjonalność write) — powinien wejść PRZED `rn-g5-polish2` na `ResultsKpiRegistryPage.tsx` (polish2 ma tam tylko kosmetyczną zmianę błędu, łatwiej domalować ją na już-poszerzonym pliku). Merge-tree potwierdza: `polish2`+`kpicreate` scalają się CZYSTO w tej kolejności lub odwrotnej (exit=0) — mimo to preferowana kolejność kpicreate→polish2 dla mniejszego ryzyka semantycznego. |
| Docs | `docs/product/results-vnext/RN_G5_KPI_CREATE_DESIGN.md` ✓ |
| Screens | 32 pliki w `docs/qa/screens/rn-g5-kpicreate-2026-08-12/` |

### rn-g5-deeplink
| Pole | Wartość |
|---|---|
| Branch | `rn-g5-deeplink` |
| Worktree | `/Users/piotrwisniewski/rn-g2-lanes/g5-deeplink` |
| Base | `35a1dee6c0` ✓ |
| HEAD | `5b9ced83978de2aade179681ef81ecc651039703` |
| Commits | 6 |
| Dirty | czysto |
| Scope | Montuje REALNE trasy `/results/roi/cases/:roiCaseId` (`RoiCaseToolPage.tsx`) i `/results/okr/sets/:okrSetId` (`OkrSetToolPage.tsx`) w `AppRoutes.tsx` — trasy, które `routeConfig.ts` rezerwował, ale nikt nie montował. Przebudowuje `ResultsRoiHub.tsx`/`ResultsOkrHub.tsx`: usuwa lokalny-stanowy `modelCase`/`OkrSetWorkspace`-inline-switch na rzecz `navigate()` do pełnej trasy, DODAJE trwałość kontekstu listy (tab/chip/selected) w `sessionStorage` (klucz per-surface, nie per-rekord) żeby powrót z pełnego narzędzia nie zerował filtrów. Dodaje `getRoiCase()` do `roiApi.ts` (wrapper klienta dla istniejącego route handlera). |
| Files | 12 plików: `okr/OkrSetToolPage.tsx`, `okr/ResultsOkrHub.tsx`, `roi/ResultsRoiHub.tsx`, `roi/RoiCaseToolPage.tsx`, `roi/roiApi.ts`, `routes/AppRoutes.tsx`, 2 pliki testów, 2 pliki dev-render screens, doc, 21 zrzutów |
| Collisions | `src/routes/AppRoutes.tsx` (z `rn-g5-scopegap` — **REALNY KONFLIKT**, patrz niżej) · `src/components/ResultsVNext/roi/roiApi.ts` (z `rn-g5-scopegap` — czysty) · `okr/ResultsOkrHub.tsx` (z `rn-g5-polish2` — **REALNY KONFLIKT**) · `roi/ResultsRoiHub.tsx` (z `rn-g5-polish2` — czysty) · `dev-render/screens/results-vnext-roi-registry.tsx` (z `rn-g5-harness` — **REALNY KONFLIKT**) · `dev-render/screens/results-vnext-okr-registry.tsx` (z `rn-g5-harness` — **REALNY KONFLIKT**) |
| Dependencies | Strukturalnie centralny tor — 4 z 6 jego kolizji są realne konflikty (nie tylko tekstowa bliskość). Musi wejść PRZED `rn-g5-scopegap` na `AppRoutes.tsx` (deeplink jako pierwszy ustala punkt wstawienia tras ROI, scopegap dokłada swoją trasę po fakcie) i PRZED `rn-g5-polish2` na `ResultsOkrHub.tsx`/`ResultsRoiHub.tsx` (deeplink robi strukturalny refaktor, polish2 tylko kosmetykę błędów). Z `rn-g5-harness` — kolejność nie jest oczywista z samej kolizji (obie zmiany są w tym samym obszarze harnessu z RÓŻNYCH powodów: harness = uczciwe etykiety+realny stan, deeplink = realne mockowanie nowych tras); wymaga ręcznej decyzji orkiestratora, patrz sekcja kolizji. |
| Docs | `docs/product/results-vnext/RN_G5_DEEPLINK_DESIGN.md` ✓ |
| Screens | 21 plików w `docs/qa/screens/rn-g5-deeplink-2026-08-12/` |

### rn-g5-scopegap
| Pole | Wartość |
|---|---|
| Branch | `rn-g5-scopegap` |
| Worktree | `/Users/piotrwisniewski/rn-g2-lanes/g5-scopegap` |
| Base | `35a1dee6c0` ✓ |
| HEAD | `d6e33caccdd15d8e12fe8f4e9e278a8629824340` |
| Commits | 4 |
| Dirty | czysto |
| Scope | Trzy niezależne pakiety funkcji z listy braków zakresu (§G): (1) przekrojowy widok "Attention" (`ResultsAttentionPage.tsx`, KPI+OKR razem, D10 — jeden widok, nie 4. rejestr), (2) trasa `ROUTES.RESULTS_ROI.PIR_OUTCOMES` — perspektywa org PIR-outcomes ROI (`ResultsRoiPirOutcomesPage.tsx`/`RoiPirOutcomesTab.tsx`, gotowa do wpięcia jako 3. zakładka `ResultsRoiHub`), (3) akcje zapisu kart wyników KPI (dodaj/usuń pozycję, publikuj migawkę) w `ResultsKpiScorecardDetailPage.tsx` + naprawa fałszywie-pozytywnego tekstu "gestosc". |
| Files | 17 plików: `attention/*` (3 nowe), `index.ts`, `kpiScorecards/*` (4 pliki), `roi/ResultsRoiPirOutcomesPage.tsx`, `roi/RoiPirOutcomesTab.tsx`, `roi/roiApi.ts`, `roi/roiPirOutcomesPresenters.tsx`, `routes/AppRoutes.tsx`, `routes/routeConfig.ts`, 3 pliki testów, `dev-render/main.tsx` + 3 nowe ekrany dev-render, doc, 41 zrzutów |
| Collisions | `dev-render/main.tsx` (z `rn-g5-harness`, `rn-g5-teresa` — czyste) · `src/routes/AppRoutes.tsx` (z `rn-g5-deeplink` — **REALNY KONFLIKT**) · `roi/roiApi.ts` (z `rn-g5-deeplink` — czysty) · `kpiScorecards/ResultsKpiScorecardDetailPage.tsx` (z `rn-g5-polish2` — **REALNY KONFLIKT**) · `index.ts` (z `rn-g5-teresa` — czysty) |
| Dependencies | Wejść PO `rn-g5-deeplink` (żeby jego wstawka trasy ROI w `AppRoutes.tsx` nakładała się na już-zmergowaną wersję deeplinka, nie odwrotnie — patrz DAG) i PO `rn-g5-polish2` NA `ResultsKpiScorecardDetailPage.tsx`, LUB odwrotnie, wymaga jawnej decyzji (patrz sekcja kolizji — scopegap dodaje ~170 linii write-UI dokładnie w obszarze, gdzie polish2 zmienia 5 linii komunikatu błędu; oba diffy nachodzą się w tym samym bloku funkcji komponentu). |
| Docs | `docs/product/results-vnext/RN_G5_SCOPEGAP_DESIGN.md` ✓ |
| Screens | 41 plików w `docs/qa/screens/rn-g5-scopegap-2026-08-12/` |

### rn-g5-teresa
| Pole | Wartość |
|---|---|
| Branch | `rn-g5-teresa` |
| Worktree | `/Users/piotrwisniewski/rn-g2-lanes/g5-teresa` |
| Base | `35a1dee6c0` ✓ |
| HEAD | `9a8498172ca679df44a13c105a956f3c5b6f9f33` |
| Commits | 10 |
| Dirty | czysto |
| Scope | D13 "Teresa proponuje, nigdy nie decyduje" — wspólny panel `TeresaProposalPanel`/`TeresaEvidenceBreakdown`/`TeresaUnavailableBanner` (propose→approve/reject→execute→audit, real `POST /api/v8/teresa/proposal*`), wpięty jako TRZECIA domena do OKR (`reflection_synthesis` w `OkrReviewReflectionView.tsx`) po KPI (`reflection_rca` w `KpiDeviationCaseSubview.tsx`, już istniejące). Manualna ścieżka (bez Teresy) musi działać nawet gdy Teresa jest offline — dowód zrzutami "manual save completes while Teresa is down". |
| Files | 20 plików: `dev-render/main.tsx` + 3 nowe ekrany, `index.ts`, `kpiTool/KpiDeviationCaseSubview.tsx`, `kpiTool/kpiTeresaRcaDraft.ts`, `okr/OkrReviewReflectionView.tsx`, `okr/okrTeresaReflectionDraft.ts`, `roi/RoiCaseLearnWorkspace.tsx`, `roi/roiCaseFullToolPresenters.tsx`, `roi/roiTeresaLessonsDraft.ts`, `teresa/*` (5 nowych plików), 5 plików testów, doc, 21 zrzutów |
| Collisions | `dev-render/main.tsx` (z `rn-g5-harness`, `rn-g5-scopegap` — czyste) · `index.ts` (z `rn-g5-scopegap` — czysty) · `kpiTool/KpiDeviationCaseSubview.tsx` (z `rn-g5-polish2` — czysty) · `okr/OkrReviewReflectionView.tsx` (z `rn-g5-polish2` — **REALNY KONFLIKT**) · `roi/RoiCaseLearnWorkspace.tsx` (z `rn-g5-polish2` — czysty) |
| Dependencies | Głównie niezależny strukturalnie (dodaje nowy panel + 3 domeny), jedyny realny konflikt to `OkrReviewReflectionView.tsx` z polish2. Wejść PRZED `rn-g5-polish2` na tym pliku (teresa dodaje ~150 linii funkcji, polish2 zmienia 1 import + fragment błędu — łatwiej domalować kosmetykę na strukturze). |
| Docs | `docs/product/results-vnext/RN_G5_TERESA_EVIDENCE.md` ✓ |
| Screens | 21 plików w `docs/qa/screens/rn-g5-teresa-2026-08-12/` |

### rn-g5-interactive
| Pole | Wartość |
|---|---|
| Branch | `rn-g5-interactive` |
| Worktree | `/Users/piotrwisniewski/rn-g2-lanes/g5-interactive` |
| Base | `35a1dee6c0` ✓ |
| HEAD | `fc789183b698aff0eff9abce278219d1d4f51f6f` |
| Commits | 10 |
| Dirty | czysto |
| Scope | CZYSTA weryfikacja interaktywna (kliknięcia myszy/klawiatury, nie tylko zrzuty statyczne) 11 ekranów RN-G3/G4 — kebab/Escape-focus-return, tabnav, reload-persist. ZERO zmian w `src/`/`server/`; jedyny nowy plik kodu to `dev-render/verify-reload-persist.mjs` (skrypt weryfikacyjny). Znalazła 6 defektów (3×P1, w tym "4. wariant obsługi Escape" w kebabie rejestru, "3. defekt powrotu fokusu" w rejestrze KPI, "2. defekt powrotu fokusu" w ROI full-tool) — TE DEFEKTY SĄ NAPRAWIANE PRZEZ `rn-g5-platform` (patrz niżej). |
| Files | `dev-render/verify-reload-persist.mjs` + doc + 223 zrzuty (BEZ ŻADNEGO pliku w `src/`/`server/`) |
| Collisions | Brak kolizji plikowych z żadnym innym torem. |
| Dependencies | Musi wejść PRZED `rn-g5-platform` w sensie LOGICZNYM (platform naprawia defekty, które interactive odkrył i udokumentował) — ale nie ma kolizji plikowej, więc kolejność integracji Gita jest dowolna; zależność jest EWIDENCYJNA/przyczynowa, nie techniczna. Po scaleniu `rn-g5-platform` sensowne byłoby PONOWNE uruchomienie weryfikacji `rn-g5-interactive` na już-scalonym stanie, żeby potwierdzić że 6 znalezisk faktycznie zniknęło. |
| Docs | `docs/product/results-vnext/RN_G5_F0_INTERACTIVE_REVERIFY.md` ✓ |
| Screens | 223 pliki w `docs/qa/screens/rn-g5-interactive/` (największy zbiór dowodowy ze wszystkich torów) |

### rn-g5-authz — **NIESTABILNY, aktywnie modyfikowany w chwili audytu**
| Pole | Wartość |
|---|---|
| Branch | `rn-g5-authz` |
| Worktree | `/Users/piotrwisniewski/rn-g2-lanes/g5-authz` |
| Base | `35a1dee6c0` ✓ |
| HEAD | `205c038912248e7eac4269d0ee27d9ca6015dbd8` (snapshot w chwili audytu — MOŻE być już nieaktualny) |
| Commits | 41 (zdecydowanie największy tor) |
| Dirty | czysto w chwili odczytu (`git status --short` puste) — ale tor jest żywy, stan może się zmienić bez ostrzeżenia. Zgodnie z poleceniem NIE wchodzono do worktree poza `git log`/`git diff` po nazwie gałęzi z repo bazowego. |
| Scope | Dodaje `commandCapabilityGuard.ts` (nowy serwis bramkujący komendy wg zdolności) i BRAMKUJE nim praktycznie KAŻDĄ komendę zapisu OKR (Objective/KeyResult/Program/Set/Cycle/CheckIn/Alignment/Decision/Review/Reflection/Support/CarryForward/MaterialChange) i ROI (baseline/scenario/cost-line/benefit-line/calculation-policy/-run/case-lifecycle/case-decision/actual-entry/actual-snapshot/variance/forecast-version/finance-link/finance-reconciliation/benefits-realization/PIR/tracking) oraz KPI (definition/deviation/measurement). Rozwiązuje realny kontekst dostępu (nie mock) w `kpi.routes.ts`/`roi.routes.ts`/`okr.routes.ts`/`kpiDeviation.routes.ts` i w `teresaCopilotService.ts` dla komend gated przez RN-G5. Przestaje wyciekać nazwę capability w treści 403. Nadaje "wildcard access" ISTNIEJĄCYM fixture'om testowym (realdb + unit) żeby nie posypały się od nowego gate'u — to bardzo duży odcisk na `tests/resultsVnext/**`. |
| Files | 79 plików: 4× `server/src/routes/resultsVnext/*.routes.ts` (+testy), 27× `server/src/services/resultsVnext/{kpi,okr,roi,platform}/*Commands.ts`, `server/src/services/v8/teresaCopilotService.ts`, 1 doc, i ~45 plików `tests/resultsVnext/**/*.realdb.test.ts` + `tests/v8/teresa-*-handoff.test.ts` (wildcard-access poprawki fixture'ów). |
| Collisions | **BRAK kolizji plikowej z żadnym z pozostałych 9 torów** — cały odcisk authz leży w `server/src/**` + `tests/resultsVnext/**`/`tests/v8/**`, żaden inny tor nie dotyka tych plików (potwierdzone grepem pełnej listy 613 wpisów). |
| Dependencies | Brak zależności PLIKOWEJ od innych torów. Jest jednak **FUNKCJONALNIE nadrzędny** względem torów piszących (kpicreate, scopegap, teresa) — wprowadza nowe bramkowanie 403 na komendach zapisu, które te tory wywołują z UI. Integrować PO ustabilizowaniu (obecnie żywy) i z PONOWNYM przebiegiem testów torów piszących na scalonym stanie, żeby wychwycić ewentualne nowe 403 na ścieżkach zapisu UI. |
| Docs | `docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md` ✓ |
| Screens | 0 |

### rn-g5-platform — **NIESTABILNY, aktywnie modyfikowany w chwili audytu**
| Pole | Wartość |
|---|---|
| Branch | `rn-g5-platform` |
| Worktree | `/Users/piotrwisniewski/rn-g2-lanes/g5-platform` |
| Base | `35a1dee6c0` ✓ |
| HEAD | `0431e35dbf528af916bf2118b2988b16b2dbad7e` (snapshot w chwili audytu — MOŻE być już nieaktualny) |
| Commits | 1 (jak dotąd) |
| Dirty | czysto w chwili odczytu. Zgodnie z poleceniem NIE wchodzono do worktree poza `git log`/`git diff` po nazwie gałęzi. |
| Scope | Naprawia TRZY defekty P1 znalezione przez rundę interaktywną `rn-g5-interactive`: (1) pusty formularz linku finansowego zgłasza błędy walidacji zamiast cichej porażki, (2) fokus wraca poprawnie po Escape z modala CTA/kebab-transition (2. i 3. "defekt powrotu fokusu"), (3) podwójny Escape na kebab+preview zamyka je po kolei, nie oba naraz. Dotyka współdzielonego `Modal.tsx` (prymityw UI) — to WYJAŚNIA dlaczego commit jest jeden, ale mały: poprawka w jednym miejscu (`Modal.tsx` focus-return) propaguje do 3 miejsc użycia (`ResultsVNextRegistryShell.tsx`, `RoiBuildCaseModals.tsx`, `RoiLearnModals.tsx`, `RoiRealizeValueModals.tsx`). |
| Files | `src/components/ResultsVNext/ResultsVNextRegistryShell.tsx`, `roi/RoiBuildCaseModals.tsx`, `roi/RoiLearnModals.tsx`, `roi/RoiRealizeValueModals.tsx`, `src/components/ui/primitives/Modal.tsx` + 3 pliki testów + 9 zrzutów |
| Collisions | **BRAK kolizji plikowej z żadnym z pozostałych 9 torów** (potwierdzone grepem). |
| Dependencies | Logicznie NASTĘPUJE po `rn-g5-interactive` (naprawia jego znaleziska), ale bez kolizji plikowej integracja techniczna może iść w dowolnej kolejności względem interactive. Ponieważ dotyka współdzielonego `Modal.tsx`, warto zintegrować WCZEŚNIE (blisko bazy) — każdy kolejny tor UI korzystający z modali (kpicreate ma `KpiDraftFormModal`/`KpiTransitionDialog`, scopegap ma dialogi kart wyników, teresa ma `TeresaProposalPanel`) odziedziczy naprawę focus-return automatycznie, zamiast musieć się przeintegrowywać po fakcie. |
| Docs | BRAK własnego dokumentu w `docs/product/results-vnext/` |
| Screens | 9 plików w `docs/qa/screens/rn-g5-platform-2026-08-12/` |

## MACIERZ KOLIZJI — 13 plików dotykanych przez >1 tor

Wszystkie 13 plików z listy "znanych z góry" w briefie POTWIERDZONE jako kompletna lista kolizji (automatyczne przeszukanie 613 wpisów plik-per-tor nie znalazło ŻADNEJ dodatkowej kolizji poza tymi 13).

**Metoda weryfikacji "ta sama linia vs różne miejsce": NIE poleganie na bliskości numerów linii z `git diff` (mylące — patrz przypadki niżej, gdzie linie sąsiadują ale się NIE gryzą, i odwrotnie). Zamiast tego każda para wykonana przez `git merge-tree --write-tree <lane1> <lane2>` — realna symulacja 3-way merge Gita, read-only, bez zapisu do żadnej gałęzi/working tree. `exit=0` = scala się czysto; `exit=1` + `CONFLICT (content)` = wymaga ręcznej decyzji semantycznej.**

| Plik | Tory | Wynik `git merge-tree` | Szczegóły |
|---|---|---|---|
| `dev-render/main.tsx` | harness × scopegap | **CZYSTO** (exit=0) | harness edytuje istniejące etykiety linii ~298-336 (opisy ekranów roi-registry/okr-registry/okr-workspace/kpi-scorecards); scopegap WSTAWIA nowe lazy-importy i wpisy `SCREENS` dla `results-vnext-attention`/`results-vnext-roi-pir-outcomes` w innym miejscu pliku (po `ResultsVNextLegacyArchiveScreen`, przed `RnG3ClassLRecordShellScreen`) — różne linie, mergują się czysto. |
| | harness × teresa | **CZYSTO** (exit=0) | teresa wstawia 2 nowe ekrany (`results-vnext-teresa-kpi-deviation`, `results-vnext-teresa-okr-reflection`) w innym miejscu niż harness. |
| | scopegap × teresa | **CZYSTO** (exit=0) | Oba dodają nowe wpisy `SCREENS`, ale w RÓŻNYCH miejscach: scopegap po `results-vnext-legacy-archive` (przed `rn-g3-class-l-record-shell`), teresa po `results-vnext-kpi-tool` (przed `results-vnext-legacy-archive`). Import-block insercje też nie kolidują (scopegap wstawia przed `RnG3ClassLRecordShellScreen`, teresa po nim — sąsiadujące linie bazowe, ale git merge je łączy poprawnie). |
| **`src/routes/AppRoutes.tsx`** | deeplink × scopegap | **⚠️ KONFLIKT** (exit=1) | Blok importów (deeplink linia ~144, scopegap linia ~129) mergują się czysto — różne miejsca. **REALNY konflikt treści w bloku `<Route>`**: deeplink wstawia `<Route path={ROUTES.RESULTS_ROI.CASE}>` DOKŁADNIE po `ROUTES.RESULTS_ROI.ROOT` (baza linia 2630, przed `ROUTES.RESULTS_OKR.ROOT`); scopegap wstawia `<Route path={ROUTES.RESULTS_ROI.PIR_OUTCOMES}>` W TYM SAMYM MIEJSCU (też bezpośrednio po `ROUTES.RESULTS_ROI.ROOT`, baza linia 2630). Konflikt potwierdzony markerami `<<<<<<< rn-g5-deeplink` (linia 2662 w scalonym pliku) … `=======` (2694) … `>>>>>>> rn-g5-scopegap` (2721). Wymaga ręcznej decyzji: zachować OBA bloki `<Route>` (nie wykluczają się nawzajem — różne ścieżki), w dowolnej kolejności. Drugi blok scopegap (`ROUTES.RESULTS_ATTENTION`, dalej w pliku, po sekcji OKR admin) NIE koliduje z niczym. |
| `src/components/ResultsVNext/roi/roiApi.ts` | deeplink × scopegap | **CZYSTO** (exit=0) | deeplink dodaje `getRoiCase()` po `listRoiCases()` (baza linia ~270); scopegap dodaje `listOrgRoiPirOutcomes()` + typy po `listOrgRoiBenefitsRealization()` (baza linia ~297) — różne miejsca, mimo że oba w tym samym pliku i tej samej sesji roboczej. |
| `src/components/ResultsVNext/roi/RoiCaseLearnWorkspace.tsx` | polish2 × teresa | **CZYSTO** (exit=0) | polish2 zmienia 2 linie (import `toUserFacingErrorMessage` po linii 61, `messageOf` na linii 80); teresa przepisuje nagłówek pliku, dodaje `TeresaProposalPanel` (linie 3-46 importy, 90 state, 278 row-menu, 320 nowy JSX blok) — zero nakładania linii. |
| `src/components/ResultsVNext/roi/ResultsRoiHub.tsx` | polish2 × deeplink | **CZYSTO** (exit=0) | polish2 zmienia WYŁĄCZNIE 5 pojedynczych linii wewnątrz `.catch()` (bazowe linie 187/198/233/272/304 — komunikat błędu); deeplink robi strukturalny refaktor (usuwa `modelCase`/`RoiCaseFullTool` inline-switch, dodaje `sessionStorage` + `navigate()`, linie 7-13/54/153-220/365-373/526) — luka między zmianami polish2 (187-304) a blokami deeplinka wystarczyła Gitowi do czystego 3-way merge. |
| `src/components/ResultsVNext/okr/ResultsOkrHub.tsx` | polish2 × deeplink | **⚠️ KONFLIKT** (exit=1) | Analogiczny wzorzec do ROI-hub (polish2 = kosmetyka błędu na linii ~135, deeplink = strukturalny refaktor linii 52-450), ALE tu deeplink USUWA import `OkrCheckInsView` na bazowej linii 78 podczas gdy polish2 WSTAWIA nowy import `toUserFacingErrorMessage` bezpośrednio PO linii 79 (sąsiadującej) — ta bliskość (usunięcie linii 78 + wstawka po 79) przekroczyła próg kontekstu 3-way merge. Marker `<<<<<<< rn-g5-polish2` w scalonym pliku na linii 102, `=======` 107, `>>>>>>> rn-g5-deeplink` 108 — mały, ale REALNY konflikt (import block), NIE automatyczny. Wymaga ręcznego scalenia bloku importów (zachować usunięcie `OkrCheckInsView` z deeplinka + dodanie `toUserFacingErrorMessage` z polish2, o ile deeplink faktycznie nie potrzebuje już tego importu — DO SPRAWDZENIA przez orkiestratora, nie zgadywane tutaj). |
| `src/components/ResultsVNext/okr/OkrReviewReflectionView.tsx` | polish2 × teresa | **⚠️ KONFLIKT** (exit=1) | polish2: import + fragment linii ~101-110 (komunikat błędu). teresa: przepisuje nagłówek, dodaje `TeresaProposalPanel` w kilku miejscach w tym bloku linii ~88-110 (state) — TU linie polish2 i teresa NAKŁADAJĄ SIĘ bezpośrednio (oba modyfikują ten sam obszar deklaracji błędu/handlera tuż po otwarciu komponentu). Marker `<<<<<<< rn-g5-polish2` linia 47, `=======` 50, `>>>>>>> rn-g5-teresa` 59 w scalonym pliku. Drugi hunk teresy (linie 363-393, 460+) nie koliduje. Wymaga ręcznej decyzji semantycznej: teresa's message-of-err helper prawdopodobnie musi zostać przepisany na `toUserFacingErrorMessage` z polish2 zamiast surowego `err.message`. |
| `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx` | polish2 × teresa | **CZYSTO** (exit=0) | polish2: import + 2 fragmenty (linie 209, 271-275). teresa: import + duży blok D13 Teresa-generation (linie 39-80, 236-250, 606-627, 1010-1052) — zero nakładania linii mimo że oba pliki są duże i gęsto zmienione. |
| `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx` | polish2 × scopegap | **⚠️ KONFLIKT** (exit=1) | polish2: import + 4 pojedyncze linie (149/165/175/196, komunikat błędu). scopegap: MASYWNY dopisek write-UI (~250 nowych linii: dodaj/usuń pozycję, publikuj migawkę, dialogi) rozrzucony po całym pliku (linie 56-732 wg `-U0`). Marker `<<<<<<< rn-g5-polish2` linia 96, `=======` 101, `>>>>>>> rn-g5-scopegap` 117 w scalonym pliku — konflikt w bloku IMPORTÓW (oba pliki dopisują różne importy w bardzo bliskim sąsiedztwie linii bazowej ~90-96). Reszta scopegap-owych dopisków (linie 232+) mergują się czysto — TYLKO blok importów jest sporny. |
| `src/components/ResultsVNext/index.ts` | scopegap × teresa | **CZYSTO** (exit=0) | scopegap dodaje eksporty `attention`/`kpiScorecards`/`roi` po linii 76 (12 nowych linii); teresa dodaje eksporty typów `teresa/*` po linii 87 (29 nowych linii) — różne miejsca w tym samym pliku bareé-eksportów. |
| `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx` | polish2 × kpicreate | **CZYSTO** (exit=0) | polish2: import + 4 pojedyncze linie błędu (486/550/566/587). kpicreate: MASYWNY dopisek (formularz create/edit + dialogi transition, ~700 nowych linii, linie 55-1261) — mimo rozmiaru, żadna linia kpicreate nie pokrywa się z 5 punktowymi zmianami polish2; scala się czysto. |
| `dev-render/screens/results-vnext-roi-registry.tsx` | harness × deeplink | **⚠️ KONFLIKT** (exit=1) | harness: poprawki etykiet/importu na początku pliku (linie 2-91) + linia 317 (opis komponentu ekranu). deeplink: dodaje mockowanie nowych tras deep-link (linie 43-82 importy, 152+ dane testowe `cases`, 298-374 fetch-mock + eksport komponentu) — bezpośrednie nakładanie się w sekcji importów/nagłówka (obie strony edytują niemal te same linie 43-88 z różnych powodów: harness = uczciwe `&ff=off`, deeplink = import `ResultsRoiHub`/`RoiCaseListItem`). Markery: `<<<<<<< rn-g5-harness` linia 56, `=======` 70, `>>>>>>> rn-g5-deeplink` 87 (pierwszy z 4 konfliktowych bloków w tym pliku — kolejne na liniach 99-122 i 422-434 scalonego pliku). To NAJGĘŚCIEJ skonfliktowany plik pary harness×deeplink. |
| `dev-render/screens/results-vnext-okr-registry.tsx` | harness × deeplink | **⚠️ KONFLIKT** (exit=1) | Analogiczny wzorzec — 4 bloki konfliktu (markery na liniach 50/62/77, 83/87/90, 403/420/433, 485/489/504 scalonego pliku) z tego samego powodu: obie strony edytują nagłówek/importy/opis komponentu tego samego harnessu z różnych, ale nachodzących się powodów. |

### Podsumowanie ryzyka konfliktu

| Konflikt | Waga | Charakter |
|---|---|---|
| `AppRoutes.tsx` (deeplink×scopegap) | Średnia | Czysto addytywny (2 różne `<Route>` w tym samym miejscu wstawienia) — bezpieczne ręczne scalenie: zachować oba bloki. |
| `ResultsOkrHub.tsx` (polish2×deeplink) | Niska | Mały konflikt w bloku importów (1 usunięty + 1 dodany import w bliskim sąsiedztwie) — bezpieczne, wymaga tylko potwierdzenia że `OkrCheckInsView` faktycznie jest nieużywany po refaktorze deeplinka. |
| `OkrReviewReflectionView.tsx` (polish2×teresa) | **Wysoka** | Oba modyfikują TĘ SAMĄ logikę obsługi błędu w niemal tej samej linii — wymaga decyzji, czyja wersja `messageOf`/error-handlera wygrywa (prawdopodobnie: teresa's struktura + polish2's `toUserFacingErrorMessage` call). |
| `ResultsKpiScorecardDetailPage.tsx` (polish2×scopegap) | Niska | Konflikt tylko w bloku importów, reszta (250 linii scopegap) scala się czysto. |
| `results-vnext-roi-registry.tsx` + `results-vnext-okr-registry.tsx` (harness×deeplink) | **Wysoka** | Oba pliki mają PO 4 bloki konfliktu każdy — najgęściej skonfliktowana para torów w całym zestawie. Wymaga ręcznego scalenia harness'owych uczciwych etykiet z deeplink'owym mockowaniem nowych tras — realistycznie: zastosować deeplink jako bazę strukturalną (bo dodaje nowe mocki/importy) i domalować na niej harness'owe poprawki tekstu etykiet. |

## Propozycja DAG integracji

Kolejność w MAŁYCH grupach, uzasadniona kolizjami i zależnościami funkcjonalnymi powyżej. NIE scalać wszystkiego naraz.

**Grupa 0 — fundament, zero ryzyka, wejść pierwsza:**
`rn-g5-crossdomain` (tylko testy e2e, zero kolizji) + `rn-g5-interactive` (tylko dowód/skrypt weryfikacyjny, zero kolizji plikowej z kimkolwiek). Można scalić w dowolnej kolejności między sobą, nawet równolegle z resztą grup — nie blokują niczego i nic ich nie blokuje.

**Grupa 1 — wspólny prymityw UI, wejść wcześnie żeby inne tory go odziedziczyły:**
`rn-g5-platform` (naprawia `Modal.tsx` focus-return + 3 konsumentów ROI). Zero kolizji plikowej z pozostałymi torami, ale semantycznie POWINIEN wejść przed dalszymi torami UI, żeby `KpiDraftFormModal`/dialogi scopegap/`TeresaProposalPanel` korzystały z już naprawionego prymitywu zamiast dziedziczyć defekt i wymagać powtórnej weryfikacji. **Warunek: poczekać aż tor się ustabilizuje (obecnie aktywnie modyfikowany).**

**Grupa 2 — warstwa harnessu/tras, wysoko-konfliktowa para, scalić RAZEM w jednej sesji ręcznej:**
`rn-g5-deeplink` → `rn-g5-harness` (w tej kolejności: deeplink jako baza strukturalna dla obu plików `dev-render/screens/results-vnext-{roi,okr}-registry.tsx`, potem ręcznie wplecione poprawki etykiet harnessu). Deeplink też ustala punkt wstawienia w `AppRoutes.tsx`, którego kolejny tor (scopegap) będzie się trzymać.

**Grupa 3 — dopisanie drugiej trasy ROI, zależna od Grupy 2:**
`rn-g5-scopegap` scalony PO `rn-g5-deeplink` — ręcznie rozwiązać konflikt w `AppRoutes.tsx` (zachować oba bloki `<Route>`) i w `roiApi.ts` (czysty automat). Scopegap wnosi też własny, niekolidujący z nikim poza polish2, dopisek do `ResultsKpiScorecardDetailPage.tsx`.

**Grupa 4 — funkcje Teresy, zależna od niczego strukturalnie ale koliduje z polish2:**
`rn-g5-teresa` scalony PO Grupie 2-3 (nie koliduje z deeplink/scopegap bezpośrednio, ale bezpieczniej mieć ustabilizowaną warstwę tras przed dopisywaniem paneli Teresy do workspace'ów ROI/OKR, które te trasy montują).

**Grupa 5 — write-UI KPI, niska kolizja:**
`rn-g5-kpicreate` — koliduje tylko z polish2 na `ResultsKpiRegistryPage.tsx`, ale merge-tree potwierdza CZYSTE scalenie w obu kierunkach. Może wejść równolegle z Grupą 4.

**Grupa 6 — kosmetyka i18n błędów, wejść OSTATNIA spośród torów UI (dotyka najwięcej plików, ale zawsze punktowo):**
`rn-g5-polish2` scalony PO wszystkich powyższych (deeplink, scopegap, teresa, kpicreate). Uzasadnienie: polish2 zmienia pojedyncze linie wewnątrz funkcji, które inne tory strukturalnie przebudowują (`ResultsOkrHub.tsx`, `OkrReviewReflectionView.tsx`) lub rozszerzają (`ResultsKpiScorecardDetailPage.tsx`, `ResultsKpiRegistryPage.tsx`) — łatwiej dopisać "przetłumacz ten jeden komunikat błędu" na już-ukształtowanym kodzie niż odwrotnie. Dwa realne konflikty (`ResultsOkrHub.tsx`, `OkrReviewReflectionView.tsx`) rozwiązać ręcznie w tej sesji integracyjnej — obie strony są już przeanalizowane wyżej.

**Grupa 7 — warstwa serwerowa/autoryzacji, integrować NIEZALEŻNIE od grup UI, ale z ponownym testem:**
`rn-g5-authz` — zero kolizji plikowej z całą resztą (żyje wyłącznie w `server/src/**`/`tests/resultsVnext/**`/`tests/v8/**`), więc technicznie może wejść w DOWOLNYM momencie względem Grup 0-6. Rekomendacja: scalić PO ustabilizowaniu (obecnie aktywnie modyfikowany, 41 commitów to największy i najbardziej ruchomy cel) i PO Grupach 3-5 (kpicreate/scopegap/teresa dodały nowe ścieżki zapisu z UI) — nie dlatego, że pliki kolidują, ale żeby jedna sesja mogła od razu przepuścić WSZYSTKIE UI-piszące ścieżki przez nowy `commandCapabilityGuard` i złapać ewentualne nowe 403 zanim trafią na demo.

### Wizualizacja zależności (tekstowa)

```
Grupa 0 (crossdomain, interactive) ─── niezależne, wejść zawsze
Grupa 1 (platform) ──────────────────┐
                                       ├──> Grupa 2 (deeplink → harness) ──> Grupa 3 (scopegap)
                                       │                                          │
                                       │                                          ▼
                                       └──────────────────────────────────> Grupa 4 (teresa)
                                                                                   │
Grupa 5 (kpicreate) ──────────────────────────────────────────────────────────────┤
                                                                                   ▼
                                                                          Grupa 6 (polish2 — OSTATNIA UI)
                                                                                   │
Grupa 7 (authz — dowolny moment technicznie, rekomendowane PO 3-5) ───────────────┘
                                                                          (re-test wszystkich write-ścieżek UI)
```

## Rzeczy NIEUSTALONE

1. **Dokładny stan `rn-g5-authz` i `rn-g5-platform` w chwili integracji** — te tory były aktywnie modyfikowane przez inne sesje w momencie audytu (2026-08-12, popołudnie). HEAD-y podane w tym dokumencie (`205c038912...` dla authz, `0431e35db...` dla platform) są migawką punktową i mogą być nieaktualne już w chwili czytania tego raportu. Orkiestrator MUSI ponownie odczytać `git rev-parse rn-g5-authz rn-g5-platform` bezpośrednio przed integracją.
2. **Czy `OkrCheckInsView` import faktycznie staje się nieużywany po refaktorze deeplinka w `ResultsOkrHub.tsx`** — deeplink USUWA ten import (baza linia 78) ale nie zweryfikowano czy komponent `OkrCheckInsView` jest nadal używany gdzie indziej w tym samym pliku (np. w starej ścieżce `drill.level === 'checkIns'`, którą nagłówek pliku bazowego opisuje jako "UNCHANGED... nadal osiągalne"). Wymaga przeczytania pełnego diffu deeplinka na tym pliku przez osobę scalającą, nie tylko linii importu — NIEUSTALONE w tym audycie z powodu zakresu czasowego (skupiono się na wykryciu KOLIZJI, nie na pełnej recenzji semantycznej każdego strukturalnego refaktoru).
3. **Czy `commandCapabilityGuard` z `rn-g5-authz` faktycznie zwróci 403 na którejkolwiek z nowych ścieżek zapisu UI** (kpicreate submit/approve/reject, scopegap scorecard write, teresa Teresa-execute) — NIEUSTALONE, bo wymagałoby uruchomienia testów integracyjnych na scalonym drzewie z żywą bazą Postgres, co wykracza poza zakres tego audytu czysto-Gitowego (read-only, bez uruchamiania testów).
4. **Kolejność wewnątrz Grupy 2** (deeplink→harness) jest REKOMENDACJĄ opartą na tym, który plik wygląda strukturalnie "bardziej bazowy" (deeplink dodaje nowe mocki tras, harness tylko poprawia opisy) — nie jest to zweryfikowane przez faktyczne wykonanie merge w tej kolejności z pełną inspekcją wynikowego pliku linia-po-linii; `git merge-tree` potwierdza TYLKO że konflikt istnieje i gdzie, nie który kierunek scalania da poprawny końcowy plik.
