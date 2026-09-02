# Mapa ekranów rejestru grafiki na 16 modułów Wave 3 — 2026-09-02

Dowód pod bramkami G07–G12/G17/G18 w `modules/*/MODULE_ACCEPTANCE.md`.
Powstała maszynowo z dwóch plików i tylko z nich:

- `docs/program/grafika/status.json` — rejestr ekranów toru grafiki (**319 ekranów, 19 katalogów**;
  opis pliku mówi o 18 katalogach — katalogów jest 19, bo 2026-09-02 doszedł `19-logowanie`);
- `docs/program/grafika/ODBIOR_DECYZJE.json` — trwały eksport decyzji właściciela
  (eksport `2026-09-02T14:15:19`, **265 decyzji**: ok 262, nie 2, poprawka 1).

## Reguła mapowania (jawna, żeby dała się sprawdzić)

1. Domyślnie: katalog grafiki → moduł Wave 3 (`01-czat`→13_CHAT, `02-moja-praca`→07_MY_WORK_AGENT,
   `03-wywiad`→02_INTERVIEW, `04-narzedzia`→03_TOOLS, `05-ocena`→04_ASSESSMENT, `06-inicjatywy`→05_INITIATIVES,
   `07-realizacja`→06_EXECUTION, `08-wyniki`→09_RESULTS, `09-finanse`→10_FINANCE, `10-materialy`→11_MATERIALS,
   `11-audyty`→12_AUDITS, `12-spotkania`→08_MEETINGS, `13-administracja`→14_ADMIN, `14-organizacja`→01_ORGANIZATION,
   `15-agent`→07_MY_WORK_AGENT, `18-ustawienia`→15_SETTINGS).
2. Pierwszeństwo ma pole `gdzie` ekranu: jeśli ścieżka wejścia zaczyna się od innego modułu niż katalog,
   wygrywa `gdzie` (14 takich ekranów, m.in. `karta-insight` z katalogu Moja praca → Wywiad,
   `calendar-sync-settings` ze Spotkań → Ustawienia, `prompt-registry-tab` z Narzędzi → Administracja).
3. Ekrany jawnie wielomodułowe idą do `WSPOLNE` i **nie liczą się** żadnemu modułowi
   (`ntype-analizuj-ai`, `teresa-chipy-panel-artefaktu`, `unified-create-launcher` oraz cały katalog `16-kanon`).
4. `17-aios` (konsola wewnętrzna dbr77.com) i `19-logowanie` (ekrany sprzed zalogowania) to `POZA16` —
   żaden z 16 modułów Wave 3 nie ma ich w zakresie.
5. Mianownik odbioru = ekrany o ocenie **A** lub **B**. Oceny **C** („nie pokazujemy") i **D** („odłożone")
   nigdy nie szły na stronę odbioru; są wypisane z nazwy przy każdym module.

## Pomiar kontrolny

- 319 ekranów = suma wierszy tabel poniżej; 265 decyzji = wszystkie pozycje eksportu; 0 decyzji bez ekranu w rejestrze.
- Ekranów A/B: 258 — **wszystkie 258 mają decyzję**. Bez decyzji jest 54 ekrany i **wszystkie 54 mają ocenę C albo D**
  (sprawdzone maszynowo, nie z pamięci).
- 16_PARTNER (`/partner`) nie ma w rejestrze grafiki ani jednego ekranu. `partner-settlements-view` to ekran
  SuperAdmin → Revenue i jest policzony w 14_ADMIN, zgodnie z jego polem `gdzie`.
- 5 ekranów sprzed zalogowania (`auth-login`, `auth-register`, `auth-code-entry`, `auth-forgot-password`,
  `auth-reset-password`) właściciel objął **akceptem zbiorowym 02.09**, bez oglądania pojedynczo.
  Wpadają do `POZA16`, więc **żadne zamknięcie modułu nie opiera się na tej piątce**.


## 01_ORGANIZATION — Organizacja

Ekranów zmapowanych: **22** · A/B (mianownik odbioru): **21** · z decyzją: **21** · C/D poza odbiorem: **1** · decyzje: ok 21, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **0**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `org-claims-sources` | A | ok | — | `14-organizacja` |
| `org-declared-challenges` | A | ok | — | `14-organizacja` |
| `org-evidence` | A | ok | — | `14-organizacja` |
| `org-executive-brief` | B | ok | — | `14-organizacja` |
| `org-files` | A | ok | — | `14-organizacja` |
| `org-goal-blockers` | B | ok | — | `14-organizacja` |
| `org-identity-operating` | A | ok | — | `14-organizacja` |
| `org-knowledge-graph` | B | ok | — | `14-organizacja` |
| `org-operating-model` | A | ok | — | `14-organizacja` |
| `org-position-direction` | A | ok | — | `14-organizacja` |
| `org-recommendation` | A | ok | — | `14-organizacja` |
| `org-redesign-v1-full-closed-final-20260825` | D | — (poza odbiorem) | — | `14-organizacja` |
| `org-risks-opportunities` | B | ok | — | `14-organizacja` |
| `org-root-causes` | A | ok | — | `14-organizacja` |
| `org-scenarios` | B | ok | — | `14-organizacja` |
| `org-scope-boundaries` | A | ok | — | `14-organizacja` |
| `org-source-conflicts` | A | ok | — | `14-organizacja` |
| `org-stakeholder-expectations` | A | ok | — | `14-organizacja` |
| `org-strategic-intent` | A | ok | — | `14-organizacja` |
| `org-success-metrics` | A | ok | — | `14-organizacja` |
| `org-summary` | A | ok | — | `14-organizacja` |
| `org-technology-culture-constraints` | A | ok | — | `14-organizacja` |

Poza odbiorem (C/D): `org-redesign-v1-full-closed-final-20260825` (D).

## 02_INTERVIEW — Wywiad

Ekranów zmapowanych: **7** · A/B (mianownik odbioru): **6** · z decyzją: **6** · C/D poza odbiorem: **1** · decyzje: ok 6, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **3**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `drd-http-workspace` | A | ok | — | `03-wywiad` |
| `insight-artifact` | C | — (poza odbiorem) | — | `10-materialy` |
| `interview-creator-shell` | A | ok | TAK — otwarta | `03-wywiad` |
| `interview-preview-canon` | A | ok | TAK — otwarta | `03-wywiad` |
| `interview-sessions-status` | A | ok | — | `03-wywiad` |
| `karta-insight` | A | ok | TAK — otwarta | `02-moja-praca` |
| `karta-interview` | A | ok | — | `03-wywiad` |

Poza odbiorem (C/D): `insight-artifact` (C).

Ekrany z otwartą uwagą właściciela: `interview-creator-shell`, `interview-preview-canon`, `karta-insight`.

## 03_TOOLS — Narzędzia

Ekranów zmapowanych: **9** · A/B (mianownik odbioru): **7** · z decyzją: **7** · C/D poza odbiorem: **2** · decyzje: ok 8, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **3**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `karta-tool` | A | ok | TAK — otwarta | `04-narzedzia` |
| `tool-outputs-panel` | C | — (poza odbiorem) | — | `04-narzedzia` |
| `tools-outputs-insights-tab` | B | ok | — | `04-narzedzia` |
| `tools-sesja-wyjscie` | A | ok | — | `04-narzedzia` |
| `tools-swot-initiative-proposal` | A | ok | — | `04-narzedzia` |
| `tools-swot-library-detail` | A | ok | — | `04-narzedzia` |
| `tools-swot-live` | C | ok | — | `04-narzedzia` |
| `tools-swot-report` | A | ok | TAK — otwarta | `04-narzedzia` |
| `tools-swot-session-workspace` | A | ok | TAK — otwarta | `04-narzedzia` |

Poza odbiorem (C/D): `tool-outputs-panel` (C), `tools-swot-live` (C).

Ekrany z otwartą uwagą właściciela: `karta-tool`, `tools-swot-report`, `tools-swot-session-workspace`.

## 04_ASSESSMENT — Ocena

Ekranów zmapowanych: **19** · A/B (mianownik odbioru): **17** · z decyzją: **17** · C/D poza odbiorem: **2** · decyzje: ok 17, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **9**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `assessment-artifacts-restart` | A | ok | — | `05-ocena` |
| `assessment-five-surfaces` | A | ok | TAK — otwarta | `05-ocena` |
| `assessment-initiatives-panel` | A | ok | — | `05-ocena` |
| `assessment-initiatives-table` | A | ok | TAK — otwarta | `05-ocena` |
| `assessment-list` | A | ok | TAK — otwarta | `05-ocena` |
| `assessment-manage-panel` | B | ok | — | `05-ocena` |
| `assessment-matryca` | C | — (poza odbiorem) | — | `05-ocena` |
| `assessment-menu3-status-chips` | A | ok | — | `05-ocena` |
| `assessment-output-report` | B | ok | TAK — otwarta | `05-ocena` |
| `assessment-presentation-view` | A | ok | TAK — otwarta | `05-ocena` |
| `assessment-quality-review-panel` | A | ok | TAK — otwarta | `05-ocena` |
| `assessment-report-contract` | A | ok | — | `05-ocena` |
| `assessment-reports-panel` | A | ok | TAK — otwarta | `05-ocena` |
| `assessment-reports-table` | A | ok | — | `05-ocena` |
| `drd-library-entry` | A | ok | TAK — otwarta | `05-ocena` |
| `drd-macierz-oceny` | B | ok | — | `05-ocena` |
| `method-workspace` | A | ok | — | `05-ocena` |
| `siri-tier` | C | — (poza odbiorem) | — | `05-ocena` |
| `siri-workspace` | B | ok | TAK — otwarta | `05-ocena` |

Poza odbiorem (C/D): `assessment-matryca` (C), `siri-tier` (C).

Ekrany z otwartą uwagą właściciela: `assessment-five-surfaces`, `assessment-initiatives-table`, `assessment-list`, `assessment-output-report`, `assessment-presentation-view`, `assessment-quality-review-panel`, `assessment-reports-panel`, `drd-library-entry`, `siri-workspace`.

## 05_INITIATIVES — Inicjatywy

Ekranów zmapowanych: **8** · A/B (mianownik odbioru): **6** · z decyzją: **6** · C/D poza odbiorem: **2** · decyzje: ok 6, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **5**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `capacity-advisor-a3` | B | ok | TAK — otwarta | `06-inicjatywy` |
| `ev-football-field` | A | ok | — | `06-inicjatywy` |
| `exe-002-004-ui-audit` | B | ok | TAK — otwarta | `07-realizacja` |
| `inicjatywy-lista` | C | — (poza odbiorem) | — | `06-inicjatywy` |
| `initiative-record` | B | ok | TAK — otwarta | `06-inicjatywy` |
| `initiatives-portfolio-analysis` | D | — (poza odbiorem) | — | `06-inicjatywy` |
| `karta-initiative` | A | ok | TAK — otwarta | `06-inicjatywy` |
| `plan-scenario-d1` | A | ok | TAK — otwarta | `06-inicjatywy` |

Poza odbiorem (C/D): `inicjatywy-lista` (C), `initiatives-portfolio-analysis` (D).

Ekrany z otwartą uwagą właściciela: `capacity-advisor-a3`, `exe-002-004-ui-audit`, `initiative-record`, `karta-initiative`, `plan-scenario-d1`.

## 06_EXECUTION — Realizacja

Ekranów zmapowanych: **11** · A/B (mianownik odbioru): **8** · z decyzją: **8** · C/D poza odbiorem: **3** · decyzje: ok 8, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **4**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `exec-summary-onelook` | B | ok | — | `02-moja-praca` |
| `execution-change-signals` | D | — (poza odbiorem) | — | `07-realizacja` |
| `execution-export-prezentacja` | D | — (poza odbiorem) | — | `07-realizacja` |
| `execution-report-day11` | A | ok | — | `07-realizacja` |
| `execution-tab-control` | A | ok | TAK — otwarta | `07-realizacja` |
| `execution-tab-list` | B | ok | — | `07-realizacja` |
| `execution-tab-people_change` | C | — (poza odbiorem) | — | `07-realizacja` |
| `execution-tab-resources` | A | ok | TAK — otwarta | `07-realizacja` |
| `execution-tab-rollout` | B | ok | TAK — otwarta | `07-realizacja` |
| `execution-tab-summary` | B | ok | — | `07-realizacja` |
| `execution-tab-work` | A | ok | TAK — otwarta | `07-realizacja` |

Poza odbiorem (C/D): `execution-change-signals` (D), `execution-export-prezentacja` (D), `execution-tab-people_change` (C).

Ekrany z otwartą uwagą właściciela: `execution-tab-control`, `execution-tab-resources`, `execution-tab-rollout`, `execution-tab-work`.

## 07_MY_WORK_AGENT — Moja praca / Agent

Ekranów zmapowanych: **43** · A/B (mianownik odbioru): **40** · z decyzją: **40** · C/D poza odbiorem: **3** · decyzje: ok 41, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **19**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `agent-hub` | B | ok | — | `15-agent` |
| `agent-plan-canvas` | A | ok | TAK — otwarta | `15-agent` |
| `agent-plan-view` | C | ok | — | `15-agent` |
| `agent-warsztat` | A | ok | TAK — otwarta | `15-agent` |
| `b2-template-gallery` | A | ok | — | `10-materialy` |
| `decision-record` | B | ok | TAK — otwarta | `02-moja-praca` |
| `idea-confidentiality-control` | A | ok | — | `02-moja-praca` |
| `idea-financial-case-persistence` | A | ok | TAK — otwarta | `02-moja-praca` |
| `idea-table` | B | ok | TAK — otwarta | `02-moja-praca` |
| `idea-table-production` | D | — (poza odbiorem) | — | `02-moja-praca` |
| `idea-table-record-templates` | B | ok | — | `02-moja-praca` |
| `idea-table-timeline-stuck` | A | ok | TAK — otwarta | `02-moja-praca` |
| `idea-table-tool-empty-filter` | A | ok | TAK — otwarta | `02-moja-praca` |
| `idea-table-tool-grouping` | A | ok | — | `02-moja-praca` |
| `idea-table-tool-kebab` | A | ok | — | `02-moja-praca` |
| `idea-table-tool-paste` | A | ok | — | `02-moja-praca` |
| `idea-table-tool-sortfilter` | A | ok | — | `02-moja-praca` |
| `idea-templates-catalog` | A | ok | TAK — otwarta | `02-moja-praca` |
| `ideas-preview-overlay` | A | ok | — | `02-moja-praca` |
| `ideas-teresa-panel` | A | ok | TAK — otwarta | `02-moja-praca` |
| `karta-decision` | A | ok | TAK — otwarta | `02-moja-praca` |
| `karta-notification` | A | ok | — | `02-moja-praca` |
| `karta-task` | B | ok | potwierdzenie „ok" | `02-moja-praca` |
| `melscanvas-workspace` | B | ok | potwierdzenie „ok" | `01-czat` |
| `mindmap-canvas` | B | ok | potwierdzenie „ok" | `01-czat` |
| `mindmap-i18n-smoke` | A | ok | potwierdzenie „ok" | `01-czat` |
| `mw-007-calendar-narrow-viewport` | A | ok | — | `16-kanon` |
| `mywork-calendar` | B | ok | — | `02-moja-praca` |
| `mywork-idea-inspector-lekki` | A | ok | TAK — otwarta | `02-moja-praca` |
| `mywork-idea-topbar` | B | ok | — | `02-moja-praca` |
| `mywork-inbox` | B | ok | — | `02-moja-praca` |
| `mywork-notebook-rail-speca` | A | ok | TAK — otwarta | `02-moja-praca` |
| `notatnik-centrum-mysli` | A | ok | TAK — otwarta | `02-moja-praca` |
| `notatnik-osierocone-graf` | A | ok | TAK — otwarta | `02-moja-praca` |
| `notebook-quick-capture` | A | ok | — | `02-moja-praca` |
| `processflow-canvas` | A | ok | TAK — otwarta | `01-czat` |
| `vault-folder-block-proof` | A | ok | TAK — otwarta | `02-moja-praca` |
| `vault-safes-table` | A | ok | TAK — otwarta | `02-moja-praca` |
| `vault-scope-selector` | C | — (poza odbiorem) | — | `02-moja-praca` |
| `vault-sejf-wnetrze` | A | ok | — | `02-moja-praca` |
| `whiteboard-canvas` | B | ok | TAK — otwarta | `01-czat` |
| `whiteboard-workshop` | B | ok | potwierdzenie „ok" | `01-czat` |
| `zwornik-projects` | A | ok | TAK — otwarta | `02-moja-praca` |

Poza odbiorem (C/D): `agent-plan-view` (C), `idea-table-production` (D), `vault-scope-selector` (C).

Ekrany z otwartą uwagą właściciela: `agent-plan-canvas`, `agent-warsztat`, `decision-record`, `idea-financial-case-persistence`, `idea-table`, `idea-table-timeline-stuck`, `idea-table-tool-empty-filter`, `idea-templates-catalog`, `ideas-teresa-panel`, `karta-decision`, `mywork-idea-inspector-lekki`, `mywork-notebook-rail-speca`, `notatnik-centrum-mysli`, `notatnik-osierocone-graf`, `processflow-canvas`, `vault-folder-block-proof`, `vault-safes-table`, `whiteboard-canvas`, `zwornik-projects`.

## 08_MEETINGS — Spotkania

Ekranów zmapowanych: **2** · A/B (mianownik odbioru): **2** · z decyzją: **2** · C/D poza odbiorem: **0** · decyzje: ok 2, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **0**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `meetings-module` | A | ok | — | `12-spotkania` |
| `public-booking-widget` | A | ok | — | `12-spotkania` |

## 09_RESULTS — Wyniki

Ekranów zmapowanych: **22** · A/B (mianownik odbioru): **19** · z decyzją: **19** · C/D poza odbiorem: **3** · decyzje: ok 20, nie 1, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **10**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `cel-jedna-karta` | A | ok | — | `08-wyniki` |
| `results-three-pairs` | D | nie | TAK — otwarta | `08-wyniki` |
| `results-vnext-attention` | B | ok | TAK — otwarta | `08-wyniki` |
| `results-vnext-kpi-registry` | B | ok | — | `08-wyniki` |
| `results-vnext-kpi-scorecards` | B | ok | — | `08-wyniki` |
| `results-vnext-kpi-tool` | C | ok | — | `08-wyniki` |
| `results-vnext-legacy-archive` | A | ok | — | `08-wyniki` |
| `results-vnext-okr-admin` | A | ok | — | `08-wyniki` |
| `results-vnext-okr-objectives` | A | ok | — | `08-wyniki` |
| `results-vnext-okr-registry` | A | ok | TAK — otwarta | `08-wyniki` |
| `results-vnext-okr-workspace` | A | ok | TAK — otwarta | `08-wyniki` |
| `results-vnext-registry-shell` | D | — (poza odbiorem) | — | `08-wyniki` |
| `results-vnext-roi-full-tool` | A | ok | TAK — otwarta | `08-wyniki` |
| `results-vnext-roi-model` | B | ok | TAK — otwarta | `08-wyniki` |
| `results-vnext-roi-pir-outcomes` | A | ok | TAK — otwarta | `08-wyniki` |
| `results-vnext-roi-registry` | A | ok | — | `08-wyniki` |
| `results-vnext-search-registry` | A | ok | TAK — otwarta | `08-wyniki` |
| `results-vnext-teresa-kpi-deviation` | B | ok | TAK — otwarta | `08-wyniki` |
| `results-vnext-teresa-okr-reflection` | A | ok | TAK — otwarta | `08-wyniki` |
| `results-zestawienia` | A | ok | — | `08-wyniki` |
| `roi-jedna-karta` | A | ok | — | `08-wyniki` |
| `wskaznik-jedna-karta` | A | ok | — | `08-wyniki` |

Poza odbiorem (C/D): `results-three-pairs` (D), `results-vnext-kpi-tool` (C), `results-vnext-registry-shell` (D).

Ekrany z otwartą uwagą właściciela: `results-three-pairs`, `results-vnext-attention`, `results-vnext-okr-registry`, `results-vnext-okr-workspace`, `results-vnext-roi-full-tool`, `results-vnext-roi-model`, `results-vnext-roi-pir-outcomes`, `results-vnext-search-registry`, `results-vnext-teresa-kpi-deviation`, `results-vnext-teresa-okr-reflection`.

## 10_FINANCE — Finanse

Ekranów zmapowanych: **16** · A/B (mianownik odbioru): **13** · z decyzją: **13** · C/D poza odbiorem: **3** · decyzje: ok 12, nie 0, poprawka 1 · ekranów z merytoryczną uwagą właściciela: **4**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `finance-analysis-workspace` | A | ok | TAK — otwarta | `09-finanse` |
| `finance-baseline-workspace` | A | poprawka | TAK — otwarta | `09-finanse` |
| `finance-comments-panel` | A | ok | — | `09-finanse` |
| `finance-compare-panel` | B | ok | TAK — otwarta | `09-finanse` |
| `finance-export-import-panel` | B | ok | — | `09-finanse` |
| `finance-focus-mode` | D | — (poza odbiorem) | — | `09-finanse` |
| `finance-hub` | A | ok | — | `09-finanse` |
| `finance-id-bridge` | D | — (poza odbiorem) | — | `09-finanse` |
| `finance-lineage-navigator` | A | ok | — | `09-finanse` |
| `finance-model-workspace` | A | ok | — | `09-finanse` |
| `finance-prediction-workspace` | B | ok | — | `09-finanse` |
| `finance-saved-views-panel` | A | ok | — | `09-finanse` |
| `finance-statement-pack-workspace-v2` | B | ok | — | `09-finanse` |
| `finance-valuation-workspace` | B | ok | TAK — otwarta | `09-finanse` |
| `finance-value-panels` | C | — (poza odbiorem) | — | `09-finanse` |
| `finance-workspace-bar` | A | ok | — | `09-finanse` |

Poza odbiorem (C/D): `finance-focus-mode` (D), `finance-id-bridge` (D), `finance-value-panels` (C).

Ekrany z otwartą uwagą właściciela: `finance-analysis-workspace`, `finance-baseline-workspace`, `finance-compare-panel`, `finance-valuation-workspace`.

## 11_MATERIALS — Materiały

Ekranów zmapowanych: **40** · A/B (mianownik odbioru): **35** · z decyzją: **35** · C/D poza odbiorem: **5** · decyzje: ok 36, nie 1, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **15**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `deck-artifact` | A | ok | TAK — otwarta | `10-materialy` |
| `deck-quality-badge` | C | ok | — | `10-materialy` |
| `document-artifact` | A | ok | — | `10-materialy` |
| `document-studio-ai-teresa` | B | ok | — | `10-materialy` |
| `document-studio-blocks-i18n` | A | ok | — | `10-materialy` |
| `document-studio-context-chip` | A | ok | — | `10-materialy` |
| `document-studio-m1-share-primary` | D | — (poza odbiorem) | — | `10-materialy` |
| `document-studio-menu-pliku` | A | ok | — | `10-materialy` |
| `document-studio-nowy-dokument-martwe-przyciski` | A | ok | — | `10-materialy` |
| `document-studio-resume-error` | A | ok | TAK — otwarta | `10-materialy` |
| `document-studio-save-as-template` | A | ok | — | `10-materialy` |
| `document-studio-streaming-honesty-n3` | B | ok | — | `10-materialy` |
| `document-studio-template-resolve-error` | A | ok | TAK — otwarta | `10-materialy` |
| `excele-edytowalna-siatka` | A | ok | TAK — otwarta | `10-materialy` |
| `excele-engine-reveal` | A | ok | — | `10-materialy` |
| `excele-jeden-widok-materialy` | A | ok | — | `10-materialy` |
| `excele-jeden-widok-pusty` | A | ok | — | `10-materialy` |
| `excele-jeden-widok-recent` | A | ok | TAK — otwarta | `10-materialy` |
| `excele-prawy-panel-standard` | A | ok | TAK — otwarta | `10-materialy` |
| `excele-reopen-verify` | A | ok | — | `10-materialy` |
| `gen-deck-content-hints` | A | ok | TAK — otwarta | `10-materialy` |
| `gen-excel-templates-tab` | D | nie | TAK — otwarta | `10-materialy` |
| `gen-word-content-hints` | A | ok | TAK — otwarta | `10-materialy` |
| `materials-registry` | B | ok | — | `10-materialy` |
| `materialy-draft-template-visibledraft-fix` | A | ok | — | `10-materialy` |
| `materialy-launcher` | A | ok | TAK — otwarta | `10-materialy` |
| `materialy-template-library-slice` | A | ok | — | `10-materialy` |
| `prezentacje-template-states` | A | ok | TAK — otwarta | `10-materialy` |
| `report-artifact` | A | ok | — | `10-materialy` |
| `report-builder-block-types` | C | — (poza odbiorem) | — | `10-materialy` |
| `report-builder-library-template` | B | ok | — | `10-materialy` |
| `report-builder-templates` | C | — (poza odbiorem) | — | `10-materialy` |
| `sheet-artifact` | A | ok | TAK — otwarta | `10-materialy` |
| `template-builder-deck` | A | ok | — | `10-materialy` |
| `template-builder-doc` | A | ok | TAK — otwarta | `10-materialy` |
| `template-builder-table` | A | ok | — | `10-materialy` |
| `template-create-wizard` | A | ok | — | `10-materialy` |
| `template-library-new-entry` | B | ok | TAK — otwarta | `10-materialy` |
| `word-intake-uselm-default` | A | ok | TAK — otwarta | `10-materialy` |
| `word-quality-badge` | A | ok | — | `10-materialy` |

Poza odbiorem (C/D): `deck-quality-badge` (C), `document-studio-m1-share-primary` (D), `gen-excel-templates-tab` (D), `report-builder-block-types` (C), `report-builder-templates` (C).

Ekrany z otwartą uwagą właściciela: `deck-artifact`, `document-studio-resume-error`, `document-studio-template-resolve-error`, `excele-edytowalna-siatka`, `excele-jeden-widok-recent`, `excele-prawy-panel-standard`, `gen-deck-content-hints`, `gen-excel-templates-tab`, `gen-word-content-hints`, `materialy-launcher`, `prezentacje-template-states`, `sheet-artifact`, `template-builder-doc`, `template-library-new-entry`, `word-intake-uselm-default`.

## 12_AUDITS — Audyty

Ekranów zmapowanych: **4** · A/B (mianownik odbioru): **4** · z decyzją: **4** · C/D poza odbiorem: **0** · decyzje: ok 4, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **1**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `audyty-drd-report` | A | ok | TAK — otwarta | `11-audyty` |
| `audyty-piec-powierzchni` | A | ok | — | `11-audyty` |
| `audyty-raport-dokument` | A | ok | — | `11-audyty` |
| `audyty-warsztat-kryterium` | A | ok | — | `11-audyty` |

Ekrany z otwartą uwagą właściciela: `audyty-drd-report`.

## 13_CHAT — Czat

Ekranów zmapowanych: **7** · A/B (mianownik odbioru): **7** · z decyzją: **7** · C/D poza odbiorem: **0** · decyzje: ok 7, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **4**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `canvas-kebab-restructure` | A | ok | TAK — otwarta | `01-czat` |
| `canvas-new-doc` | A | ok | potwierdzenie „ok" | `01-czat` |
| `canvas-toolbar-md-history` | A | ok | potwierdzenie „ok" | `01-czat` |
| `chat-signals-feed` | B | ok | TAK — otwarta | `01-czat` |
| `chat-split-teresa-right` | A | ok | potwierdzenie „ok" | `01-czat` |
| `teresa-chipy-sugestii` | A | ok | TAK — otwarta | `01-czat` |
| `teresa-confirm-chip` | A | ok | TAK — otwarta | `01-czat` |

Ekrany z otwartą uwagą właściciela: `canvas-kebab-restructure`, `chat-signals-feed`, `teresa-chipy-sugestii`, `teresa-confirm-chip`.

## 14_ADMIN — Administracja

Ekranów zmapowanych: **68** · A/B (mianownik odbioru): **42** · z decyzją: **42** · C/D poza odbiorem: **26** · decyzje: ok 42, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **3**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `admin-ai-ai-audit` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-ai-ai-incidents` | A | ok | — | `13-administracja` |
| `admin-ai-ai-limits-budgets` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-ai-ai-operations` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-ai-configuration-versions` | B | ok | — | `13-administracja` |
| `admin-ai-data-privacy` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-ai-models-providers` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-ai-personas` | B | ok | — | `13-administracja` |
| `admin-ai-policy-autonomy` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-ai-quality-evaluations` | B | ok | — | `13-administracja` |
| `admin-audit-compliance-evidence` | C | — (poza odbiorem) | — | `13-administracja` |
| `admin-audit-events` | C | — (poza odbiorem) | — | `13-administracja` |
| `admin-audit-export-history` | A | ok | — | `13-administracja` |
| `admin-audit-high-risk-changes` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-audit-integrity` | A | ok | — | `13-administracja` |
| `admin-audit-legal-hold` | B | ok | — | `13-administracja` |
| `admin-audit-retention-export` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-billing-billing-details` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-billing-budgets-alerts` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-billing-invoices` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-billing-overview` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-billing-payment-methods` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-billing-plan-history` | A | ok | — | `13-administracja` |
| `admin-billing-plan-limits` | C | — (poza odbiorem) | — | `13-administracja` |
| `admin-billing-seats-licences` | A | ok | — | `13-administracja` |
| `admin-billing-usage-costs` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-command-agent-trace` | A | ok | — | `13-administracja` |
| `admin-command-ai-policy` | A | ok | — | `13-administracja` |
| `admin-command-attention-queue` | B | ok | TAK — otwarta | `13-administracja` |
| `admin-command-audit` | A | ok | — | `13-administracja` |
| `admin-command-benchmark` | A | ok | — | `13-administracja` |
| `admin-command-center-panel` | A | ok | TAK — otwarta | `13-administracja` |
| `admin-command-cost-capacity` | A | ok | — | `13-administracja` |
| `admin-command-dlp` | B | ok | — | `13-administracja` |
| `admin-command-organization-defaults` | B | ok | — | `13-administracja` |
| `admin-command-overview` | A | ok | — | `13-administracja` |
| `admin-command-residency` | A | ok | — | `13-administracja` |
| `admin-command-retention` | A | ok | — | `13-administracja` |
| `admin-health-dependencies` | A | ok | — | `13-administracja` |
| `admin-health-diagnostics` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-health-incident-history` | B | ok | — | `13-administracja` |
| `admin-health-platform-operations` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-health-queues-jobs` | B | ok | — | `13-administracja` |
| `admin-health-service-status` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-health-sla-slo` | A | ok | — | `13-administracja` |
| `admin-security-api-access` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-security-break-glass` | A | ok | — | `13-administracja` |
| `admin-security-domains` | A | ok | — | `13-administracja` |
| `admin-security-risk-summary` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-security-scim-lifecycle` | D | — (poza odbiorem) | — | `13-administracja` |
| `admin-security-security-alerts` | C | — (poza odbiorem) | — | `13-administracja` |
| `admin-security-security-policy` | C | — (poza odbiorem) | — | `13-administracja` |
| `admin-security-service-accounts` | A | ok | — | `13-administracja` |
| `admin-security-sessions` | A | ok | — | `13-administracja` |
| `admin-security-sso` | C | — (poza odbiorem) | — | `13-administracja` |
| `admin-sso-self-service-card` | A | ok | — | `13-administracja` |
| `admin-team-access-requests` | B | ok | — | `13-administracja` |
| `admin-team-access-reviews` | A | ok | — | `13-administracja` |
| `admin-team-guests-external` | A | ok | — | `13-administracja` |
| `admin-team-invitations` | A | ok | — | `13-administracja` |
| `admin-team-members` | A | ok | — | `13-administracja` |
| `admin-team-ownership` | A | ok | — | `13-administracja` |
| `admin-team-roles-permissions` | B | ok | — | `13-administracja` |
| `admin-team-teams` | B | ok | — | `13-administracja` |
| `model-catalog-table` | B | ok | — | `13-administracja` |
| `partner-settlements-view` | A | ok | — | `13-administracja` |
| `prompt-registry-tab` | A | ok | TAK — otwarta | `04-narzedzia` |
| `superadmin-platform-operations-day15` | A | ok | — | `13-administracja` |

Poza odbiorem (C/D): `admin-ai-ai-audit` (D), `admin-ai-ai-limits-budgets` (D), `admin-ai-ai-operations` (D), `admin-ai-data-privacy` (D), `admin-ai-models-providers` (D), `admin-ai-policy-autonomy` (D), `admin-audit-compliance-evidence` (C), `admin-audit-events` (C), `admin-audit-high-risk-changes` (D), `admin-audit-retention-export` (D), `admin-billing-billing-details` (D), `admin-billing-budgets-alerts` (D), `admin-billing-invoices` (D), `admin-billing-overview` (D), `admin-billing-payment-methods` (D), `admin-billing-plan-limits` (C), `admin-billing-usage-costs` (D), `admin-health-diagnostics` (D), `admin-health-platform-operations` (D), `admin-health-service-status` (D), `admin-security-api-access` (D), `admin-security-risk-summary` (D), `admin-security-scim-lifecycle` (D), `admin-security-security-alerts` (C), `admin-security-security-policy` (C), `admin-security-sso` (C).

Ekrany z otwartą uwagą właściciela: `admin-command-attention-queue`, `admin-command-center-panel`, `prompt-registry-tab`.

## 15_SETTINGS — Ustawienia

Ekranów zmapowanych: **12** · A/B (mianownik odbioru): **9** · z decyzją: **9** · C/D poza odbiorem: **3** · decyzje: ok 9, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **1**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `calendar-sync-settings` | A | ok | TAK — otwarta | `12-spotkania` |
| `settings-full-module-closed-final-20260825` | D | — (poza odbiorem) | — | `18-ustawienia` |
| `ustawienia-ai-automatyzacja` | B | ok | — | `18-ustawienia` |
| `ustawienia-bezpieczenstwo` | C | — (poza odbiorem) | — | `18-ustawienia` |
| `ustawienia-billing` | C | — (poza odbiorem) | — | `18-ustawienia` |
| `ustawienia-dane-prywatnosc` | B | ok | — | `18-ustawienia` |
| `ustawienia-integracje` | B | ok | — | `18-ustawienia` |
| `ustawienia-personalne` | A | ok | — | `18-ustawienia` |
| `ustawienia-powiadomienia` | B | ok | — | `18-ustawienia` |
| `ustawienia-workflow` | B | ok | — | `18-ustawienia` |
| `ustawienia-wyglad` | A | ok | — | `18-ustawienia` |
| `ustawienia-zaawansowane` | A | ok | — | `18-ustawienia` |

Poza odbiorem (C/D): `settings-full-module-closed-final-20260825` (D), `ustawienia-bezpieczenstwo` (C), `ustawienia-billing` (C).

Ekrany z otwartą uwagą właściciela: `calendar-sync-settings`.

## 16_PARTNER — Partner

Ekranów zmapowanych: **0** · A/B (mianownik odbioru): **0** · z decyzją: **0** · C/D poza odbiorem: **0** · decyzje: ok 0, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **0**

_Brak ekranów w rejestrze grafiki._


## WSPOLNE — Elementy wspólne (poza 16 modułami)

Ekranów zmapowanych: **15** · A/B (mianownik odbioru): **13** · z decyzją: **13** · C/D poza odbiorem: **2** · decyzje: ok 14, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **8**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `fab-rail-kebab` | B | ok | — | `16-kanon` |
| `ntype-analizuj-ai` | B | ok | TAK — otwarta | `01-czat` |
| `prawy-panel-szyna-ikon` | A | ok | TAK — otwarta | `16-kanon` |
| `prawy-pas-jedna-formula-idea-artefakt` | B | ok | — | `16-kanon` |
| `prawy-pas-jedna-formula-idea-teresa` | B | ok | TAK — otwarta | `16-kanon` |
| `prawy-pas-jedna-formula-notatka-artefakt` | B | ok | — | `16-kanon` |
| `prawy-pas-jedna-formula-notatka-teresa` | B | ok | TAK — otwarta | `16-kanon` |
| `prawy-pas-notatnik-system` | D | — (poza odbiorem) | — | `16-kanon` |
| `preview-4-zakladki` | C | ok | TAK — otwarta | `16-kanon` |
| `rn-g3-class-l-record-shell` | A | ok | — | `16-kanon` |
| `standard-grid-card` | A | ok | — | `16-kanon` |
| `standard-kanban-card` | B | ok | TAK — otwarta | `16-kanon` |
| `standard-module-bar-children` | A | ok | TAK — otwarta | `16-kanon` |
| `teresa-chipy-panel-artefaktu` | A | ok | TAK — otwarta | `01-czat` |
| `unified-create-launcher` | A | ok | — | `03-wywiad` |

Poza odbiorem (C/D): `prawy-pas-notatnik-system` (D), `preview-4-zakladki` (C).

Ekrany z otwartą uwagą właściciela: `ntype-analizuj-ai`, `prawy-panel-szyna-ikon`, `prawy-pas-jedna-formula-idea-teresa`, `prawy-pas-jedna-formula-notatka-teresa`, `preview-4-zakladki`, `standard-kanban-card`, `standard-module-bar-children`, `teresa-chipy-panel-artefaktu`.

## POZA16 — Poza 16 modułami (AI OS, ekrany sprzed zalogowania)

Ekranów zmapowanych: **14** · A/B (mianownik odbioru): **9** · z decyzją: **9** · C/D poza odbiorem: **5** · decyzje: ok 9, nie 0, poprawka 0 · ekranów z merytoryczną uwagą właściciela: **1**

| Ekran | Ocena | Decyzja | Uwaga właściciela | Katalog grafiki |
| --- | --- | --- | --- | --- |
| `aios-actions` | C | — (poza odbiorem) | — | `17-aios` |
| `aios-agents` | B | ok | — | `17-aios` |
| `aios-artifacts` | C | — (poza odbiorem) | — | `17-aios` |
| `aios-connectors` | B | ok | TAK — otwarta | `17-aios` |
| `aios-home` | C | — (poza odbiorem) | — | `17-aios` |
| `aios-memory` | B | ok | — | `17-aios` |
| `aios-outcomes` | B | ok | — | `17-aios` |
| `aios-research` | C | — (poza odbiorem) | — | `17-aios` |
| `auth-code-entry` | A | ok | akcept zbiorowy (bez oglądania pojedynczo) | `19-logowanie` |
| `auth-forgot-password` | A | ok | akcept zbiorowy (bez oglądania pojedynczo) | `19-logowanie` |
| `auth-login` | A | ok | akcept zbiorowy (bez oglądania pojedynczo) | `19-logowanie` |
| `auth-register` | A | ok | akcept zbiorowy (bez oglądania pojedynczo) | `19-logowanie` |
| `auth-reset-password` | A | ok | akcept zbiorowy (bez oglądania pojedynczo) | `19-logowanie` |
| `auth-verify-email` | D | — (poza odbiorem) | — | `19-logowanie` |

Poza odbiorem (C/D): `aios-actions` (C), `aios-artifacts` (C), `aios-home` (C), `aios-research` (C), `auth-verify-email` (D).

Ekrany z otwartą uwagą właściciela: `aios-connectors`.
