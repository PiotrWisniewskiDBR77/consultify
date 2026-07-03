# M15 „Rezultaty" — WIZJA + KOMPLETNY PLAN FUNKCJONALNY

> Dokument docelowy (target-state) modułu M15 Benefits Realization. **Najpierw definiujemy CO chcemy finalnie osiągnąć**, dopiero potem budujemy/naprawiamy. SSOT wizji.
> Siostrzane: `M15-AUDYT-2026-06-24.md` (stan faktyczny + luki techniczne G1-G5). Stan: 2026-06-24.

---

## CZĘŚĆ I — WIZJA: PO CO ISTNIEJE M15

### Obietnica aplikacji a rola M15
Consultify = „diagnoza → planowanie → wykonanie → **mierzalne rezultaty**" w jednym przepływie. Łańcuch modułów: **M13** (Inicjatywy/plan) → **M14** (Wdrożenie/wykonanie) → **M15** (Rezultaty/wartość) → M16. 

**M15 to miejsce, gdzie aplikacja UDOWADNIA, że transformacja przyniosła wartość.** Bez wiarygodnego M15 cała obietnica „turn knowledge into profits" jest nieudowodniona — klient nie wie, czy zapłacił za efekt. M15 musi odpowiedzieć na jedno pytanie zarządu: **„Czy ta transformacja się opłaciła — ile, gdzie, kiedy i dzięki czemu?"** — z dowodami, nie deklaracjami.

### Docelowy efekt (definicja sukcesu M15)
M15 jest „ukończone", gdy dla dowolnej organizacji-klienta potrafi:
1. **Zdefiniować** każdą oczekiwaną korzyść (finansową i niefinansową) z profilem: właściciel, baseline, cel, metoda pomiaru, zależności, dis-benefity.
2. **Zmierzyć** realizację w czasie (KPI time-series z wielu źródeł: ręczne, konektory, MCP).
3. **Przypisać** zmianę KPI do konkretnej inicjatywy (M14) — atrybucja przyczynowa, nie korelacja.
4. **Przeliczyć na pieniądze** — wpływ KPI na P&L/BS/CF + ROI plan-vs-realized (NPV/payback/variance).
5. **Powiązać ze strategią** — korzyść → cel strategiczny (OKR/Balanced Scorecard), mapa zależności korzyści (BDN).
6. **Reagować na odchylenia** — gdy korzyść nie materializuje się → RCA → akcje naprawcze → eskalacja → zamknięcie.
7. **Utrzymać korzyść po zamknięciu projektu** — handoff własności do biznesu (z M14), cykliczne przeglądy (cadence), accountability właściciela.
8. **Opowiedzieć historię wartości portfela** — agregat zarządczy: „transformacja dostarczyła X PLN / Y% celu, oto dowody".
9. **Zaraportować i zarządzić** — przeglądy korzyści, harmonogramy, wallboardy, pakiet dla zarządu, ślad audytowy.

---

## CZĘŚĆ II — DOKTRYNA (na czym opieramy kompletność)

| Doktryna | Co wnosi do M15 |
|--|--|
| **MSP — Benefits Management Cycle** | Identify→Define→Plan→Realize→Review. Profile korzyści, benefits realization plan, dis-benefits, przeglądy. |
| **PMI — Benefits Realization Management** | Identify→Execute→**Sustain**. Rejestr korzyści, leading vs lagging indicators, utrzymanie po projekcie. |
| **Cranfield — Benefits Dependency Network (BDN)** | Łańcuch przyczynowy: enabler (inicjatywa M14) → zmiana biznesowa → korzyść (KPI) → cel inwestycyjny. Mapa zależności. |
| **Bradley — Benefit Realisation Management** | Profile korzyści, mapy korzyści, własność, śledzenie, zaangażowanie interesariuszy. |
| **Kaplan-Norton — Balanced Scorecard / Strategy Maps** | KPI w 4 perspektywach (finanse/klient/procesy/rozwój), cele strategiczne, łańcuch przyczynowo-skutkowy. |
| **Doerr — OKR** | Objectives + Key Results, kaskadowanie/alignment, scoring, check-iny. |
| **Value/ROI (NPV, payback, IRR, wrażliwość)** | Twardy rachunek opłacalności plan-vs-actual, analiza wariancji. |
| **Attribution / counterfactual** | Ile zmiany KPI jest przypisywalne tej inicjatywie vs czynniki zewnętrzne. |

---

## CZĘŚĆ III — PEŁNY INWENTARZ ISTNIEJĄCYCH FUNKCJI

> Legenda stanu: ✅ realne+DB-backed · 🟡 częściowe/do weryfikacji · ⬜ brak. (Stan wg audytu 2026-06-24; 🟡 wymagają potwierdzenia w kodzie — audyt bywa przeszacowany.)

### Domena A — Definicja korzyści / KPI
| Funkcja | Stan | Gdzie |
|--|--|--|
| Katalog KPI (lista, org-scoped, z initiative/owner/latest/cases) | ✅ | `GET /benefits/kpis`, V8 `/results/kpis/catalog` |
| Tworzenie KPI (name, unit, baseline, target, frequency, direction, progi amber/red) | ✅ | `KPICreateModal`, `POST /results/kpis` |
| Edycja KPI (z state-machine guard `BENEFITS_LOCKED_KPI_STATUSES`) | ✅ | `PUT /results/kpis/:id` |
| Usuwanie KPI + cascade (mappings, TS, deviation) | ✅ | `DELETE /results/kpis/:id` |
| Szczegół KPI — drawer 7 sekcji (summary/record/history/definition/deviation/lineage/danger) | ✅ | `KPITimeSeriesDrawer` |
| Progi i kierunek (HIGHER/LOWER_IS_BETTER, PERCENT/ABSOLUTE) | ✅ | tabela `initiative_kpis` |

### Domena B — Pomiar / time-series
| Funkcja | Stan | Gdzie |
|--|--|--|
| Zapis pomiaru (value, period, source, notes) + trigger deviation | ✅ | `POST /results/kpis/:id/time-series` |
| Historia pomiarów + wykres trendu (up/down/stable) | ✅ | drawer history |
| Derive status (on-target/below/no-data) + trend + stale-detection (needsEntry) | ✅ | `kpiDomain.ts` |
| Częstotliwości DAILY/WEEKLY/MONTHLY/QUARTERLY + okna staleness | ✅ (hardcoded) | `kpiDomain.ts:114` |
| Triage queue (needsEntry/belowTarget/discrepancy/requiresReview) | ✅ | `KpiQueueView` |

### Domena C — Atrybucja inicjatywa↔KPI
| Funkcja | Stan | Gdzie |
|--|--|--|
| Mapowanie KPI↔inicjatywa (impact_weight/direction/expected_delta/lag/confidence) | ✅ | `POST /results/kpi-mappings`, tabela `initiative_kpi_mappings` |
| Atrybucja heurystyczna (T048): contribution = delta × weight/total × portion | ✅ | `kpiAttributionService.computeAttribution` |
| Snapshot atrybucji + historia (20) + unexplained remainder + confidence | ✅ | `kpi_attribution_snapshots` |
| Lineage w drawerze (KPI ↔ inicjatywy) | ✅ | drawer „lineage" |

### Domena D — Realizacja finansowa / ROI
| Funkcja | Stan | Gdzie |
|--|--|--|
| ROI assumptions (capex/opex/revenueDelta/costDelta/horizon/NPV/payback/confidence) | ✅ | `roi_assumptions`, `PUT /roi/:id/assumptions` |
| ROI realized (per period_month: revenue/cost/savings delta) | ✅ | `roi_realized_values`, `POST /roi/:id/realized` |
| Variance projected vs realized (ROI/capex/payback) | ✅ | `GET /roi/:id/variance` |
| Portfolio ROI summary (variance %, status on_track/below/above) | ✅ | `GET /roi/portfolio/summary`, `ROIAnalysisView` |
| KPI → linia finansowa (P&L/BS/CF) mapping (T049, direction/relationship/multiplier/formula) | ✅ | `kpi_financial_mappings`, `financial_statement_lines` (15 seed) |
| Wpływ finansowy KPI (mapping × delta × direction) | ✅ | `GET /financial/impact/:kpiId` |

### Domena E — Strategia / cele / scorecards
| Funkcja | Stan | Gdzie |
|--|--|--|
| Scorecards / Goals (lista, rollup progress, parent/child) | 🟡 | `ResultsKpiScorecardsView` (read ✅, **create celu = do weryfikacji**) |
| Link KPI → Goal | ✅ | `POST /results/kpi-mappings` (lineage) |
| **OKR cascade / alignment (objectives→key results, kaskada org)** | ⬜ | brak pełnej warstwy OKR |
| **Balanced Scorecard (4 perspektywy)** | ⬜ | brak grupowania perspektyw |
| **Mapa zależności korzyści (BDN: enabler→zmiana→korzyść→cel)** | ⬜ | brak wizualizacji łańcucha |

### Domena F — Odchylenia / akcje naprawcze (R1)
| Funkcja | Stan | Gdzie |
|--|--|--|
| Deviation case (severity AMBER/RED, lifecycle OPEN→…→CLOSED, UNIQUE per period) | ✅ | `kpi_deviation_cases` |
| Acknowledge / RCA / resolve / close (z evidence, resolution, linked initiative/task) | ✅ | `/deviation-cases/:id/*` |
| Action items (title/owner/due/status) | ✅ | `kpi_deviation_actions` |
| Auto-detekcja przy zapisie pomiaru | ✅ | `kpiDeviationService.handleTimeSeriesRecorded` |

### Domena G — Utrzymanie / własność / handoff
| Funkcja | Stan | Gdzie |
|--|--|--|
| Handoff M14→M15 (closure → benefits_register, idempotent, source=M14_CLOSURE_HANDOFF) | 🟡 | backend ✅ ale **żywy M15 NIE czyta `benefits_register` (G1!)** |
| Status inicjatywy DRAFT→…→DONE→**TRACKING**→ARCHIVED (faza realizacji) | ✅ | `ResultsHub` status change |
| Filtr lifecycle (in-realization / realized) + observation phase (realization/post-impl) | ✅ | `kpiDomain.ts` |
| **Cykliczne przeglądy korzyści (cadence review z właścicielem, accountability)** | ⬜ | brak harmonogramu przeglądów korzyści |
| **Benefit ownership/transfer do biznesu (operacje przejmują)** | ⬜ | brak formalnego transferu własności |

### Domena H — Raportowanie / governance
| Funkcja | Stan | Gdzie |
|--|--|--|
| Snapshoty raportów KPI (create/refresh/extract-actions AI) | ✅ | `ResultsKpiReportsView`, `/results/kpi-reports` |
| Harmonogramy cron + approval gating (auto/pending/approved) | 🟡 | `ResultsReportSchedulesView` (**submit do weryfikacji**) |
| Wallboardy (auto-rotacja, interwały, progi alertów) | 🟡 | `ResultsWallboardsView` (**submit do weryfikacji**) |
| Konektory danych (cron, last-run status) | 🟡 | `ResultsKpiConnectorsView` (**submit do weryfikacji**) |
| Reconciliation (pending/reconciled/disputed/escalated) | ✅ | `ReconciliationPanel` |
| Ślad audytowy (requireAudit na deviation) | ✅ (częściowo) | middleware |

### Domena I — Integracja danych / automatyzacja
| Funkcja | Stan | Gdzie |
|--|--|--|
| IRIS MCP refresh KPI (read-only proof path) + health + asset search | ✅ | `/benefits/kpis/:id/refresh/iris`, `mcpProviderClient` |
| Konektory danych (źródła zewnętrzne) | 🟡 | jw. |
| Showcase/demo data dla pustego tenanta | ✅ | `resultsShowcaseData.ts` (gated) |

### Domena J — AI
| Funkcja | Stan | Gdzie |
|--|--|--|
| AI extract actions z narracji raportu (refine-text) | ✅ | `POST /ai/refine-text` |
| **AI: prognoza trajektorii (czy trafimy w cel)** | ⬜ | brak |
| **AI: sugestia RCA / akcji naprawczej dla deviation** | ⬜ | brak |
| **AI: narracja wartości (executive summary portfela)** | ⬜ | brak |

---

## CZĘŚĆ IV — KOMPLETNA MAPA DOCELOWA (target-state) + LUKI

> Każdy obszar: **CEL** (co M15 ma finalnie robić) + **mamy?** (✅/🟡/⬜) + **luka do domknięcia**.

### 1. Profil korzyści (Benefit Profile) — fundament
**CEL:** Korzyść to byt SZERSZY niż KPI. Każda ma profil: typ (finansowa/niefinansowa, tangible/intangible), kategoria (przychód/koszt/ryzyko/zgodność/satysfakcja), właściciel biznesowy, baseline+target+metoda pomiaru, powiązane KPI (1..n), powiązane inicjatywy-enablery (M14), zależności, **dis-benefity** (negatywne skutki uboczne), horyzont realizacji, status realizacji. — **Mamy 🟡:** KPI ≈ korzyść, ale brak osobnej encji „benefit" z profilem (typ/kategoria/dis-benefit/wiele-KPI). `benefits_register` jest, ale ubogi i odłączony. **Luka:** wzbogacić model korzyści lub zmapować KPI↔benefit jako profil.

### 2. Handoff M14→M15 widoczny (G1) — domknięcie łańcucha
**CEL:** Korzyść/KPI zdefiniowana przy zamknięciu inicjatywy w M14 automatycznie pojawia się w M15 jako śledzona, z oznaczeniem „przekazane z wdrożenia", właścicielem i cadence. — **Mamy 🟡 (backend), ⬜ (UI):** handoff pisze do `benefits_register`, żywy M15 tego nie czyta. **Luka (P0):** spiąć handoff z kanonem M15 (`initiative_kpis`) ALBO ResultsHub czyta `benefits_register`.

### 3. Pomiar wielo-źródłowy
**CEL:** Wartości KPI z: ręcznych wpisów, konektorów (API/DB/plik), MCP (IRIS), importu. Harmonogram auto-odświeżania, wykrywanie braków/staleness, walidacja. — **Mamy ✅ (ręczne+IRIS), 🟡 (konektory).** **Luka:** domknąć konektory (G2), więcej typów źródeł, auto-refresh schedule.

### 4. Atrybucja przyczynowa
**CEL:** „Ta inicjatywa odpowiada za X% poprawy tego KPI" — z modelem wag, opóźnień (lag), pewności, i jawnie pokazanym „unexplained remainder" (uczciwość: nie wszystko jest naszą zasługą). — **Mamy ✅** (T048 heurystyka). **Luka (ulepszenie):** lepsze modele (regresja/baseline-counterfactual), wizualizacja wkładu.

### 5. Realizacja finansowa pełna
**CEL:** Od KPI do złotówki: KPI → linia P&L/BS/CF → wpływ finansowy; ROI plan vs realized z NPV/payback/IRR/wrażliwość; agregacja do wartości portfela. — **Mamy ✅** (T046 ROI + T049 financial mapping — zaawansowane!). **Luka (ulepszenie):** IRR + analiza wrażliwości + waterfall wartości; spięcie z M11/Finance.

### 6. Warstwa strategiczna (OKR + Balanced Scorecard + BDN)
**CEL:** Korzyści/KPI wpinają się w cele strategiczne (Objectives→Key Results, kaskada org), grupowane w 4 perspektywy Balanced Scorecard; **mapa zależności korzyści (BDN)** pokazuje wizualnie: inicjatywa M14 → zmiana biznesowa → korzyść/KPI → cel strategiczny. To „klej" łączący wykonanie ze strategią. — **Mamy 🟡 (scorecards/Goals częściowe), ⬜ (OKR cascade, BSC perspektywy, BDN map).** **Luka (duża, wysokowartościowa):** pełna warstwa OKR + wizualna mapa zależności korzyści.

### 7. Zarządzanie odchyleniami
**CEL:** Gdy korzyść nie nadąża → case (AMBER/RED) → RCA → akcje naprawcze z właścicielem/terminem → eskalacja → zamknięcie z dowodem. — **Mamy ✅** (R1, pełny lifecycle). **Luka (ulepszenie):** AI-sugestia RCA, predykcja „nie trafimy w cel" zanim się stanie.

### 8. Utrzymanie i własność (Sustain)
**CEL:** Po zamknięciu projektu korzyść żyje dalej: właściciel BIZNESOWY (nie PM) przejmuje, cykliczne przeglądy (cadence review) z check-inem, accountability, „benefit sustainment plan". To różnica między „dostarczyliśmy" a „wartość trwa". — **Mamy 🟡 (lifecycle/phase), ⬜ (cadence reviews, transfer własności, sustainment plan).** **Luka (wysokowartościowa):** cykl przeglądów korzyści + formalny transfer własności do biznesu.

### 9. Raportowanie i governance
**CEL:** Przeglądy korzyści (benefit review meetings), harmonogramy, wallboardy live, **pakiet dla zarządu** (board pack: wartość dostarczona, w realizacji, zagrożona), ślad audytowy, approval gating. — **Mamy ✅ (raporty), 🟡 (schedules/wallboards/connectors).** **Luka:** domknąć enterprise-reporting (G2), dodać board-pack / benefit-review.

### 10. Historia wartości portfela (executive)
**CEL:** Jeden ekran dla zarządu/klienta: „Transformacja dostarczyła **X PLN** zrealizowanej wartości (Y% celu), **Z PLN** w realizacji, **W PLN** zagrożone; oto top-korzyści, oto trend, oto dowody". To FINALNY produkt M15 — dowód opłacalności. — **Mamy 🟡 (ROI Analysis portfela), ⬜ (pełna narracja wartości, waterfall, story).** **Luka (kluczowa dla obietnicy aplikacji):** executive value-story / benefits dashboard.

### 11. AI augmentation
**CEL:** AI: prognoza trajektorii KPI (trafimy w cel?), sugestia RCA i akcji, automatyczna narracja wartości, wykrywanie anomalii w pomiarach. — **Mamy 🟡 (extract-actions), ⬜ (forecast/RCA/narracja/anomalie).** **Luka:** warstwa AI nad istniejącymi danymi.

### 12. Higiena i spójność
**CEL:** Jedna kanoniczna ścieżka backendu (V8), legacy wygaszony; zero martwego kodu; spójny model danych. — **Luka:** G3 (martwy kod), G4 (V8 vs legacy).

---

## CZĘŚĆ V — PROGRAM (fale, od fundamentu do narracji wartości)

> Kolejność: najpierw domknąć łańcuch i fundament (żeby dane wpływały), potem warstwa strategiczna i narracja (żeby był „efekt aplikacji"), na końcu AI i higiena.

| Fala | Cel fali | Zadania (z mapy IV) | Priorytet |
|--|--|--|:--:|
| **W1 — Domknięcie łańcucha** | Dane z M14 realnie wpływają i są widoczne | G1 handoff widoczny (#2); profil korzyści min. (#1); live-verify istniejących ścieżek (G5) | 🔴 P0 |
| **W2 — Domknięcie atrap** | To, co wygląda na gotowe, działa end-to-end | G2 weryfikacja+domknięcie Goals/Schedules/Wallboards/Connectors (#3,#9); higiena martwego kodu G3 (#12) | 🟡 P1 |
| **W3 — Warstwa strategiczna** | KPI łączą się ze strategią (klej wartości) | OKR cascade + Balanced Scorecard perspektywy + mapa zależności korzyści BDN (#6) | 🟡 P1 (wysoka wartość) |
| **W4 — Narracja wartości** | FINALNY produkt: dowód opłacalności dla zarządu | Executive value-story / portfolio benefits dashboard + board-pack (#10); waterfall wartości; sustainment+cadence reviews (#8) | 🔴 P1 (kluczowa dla obietnicy) |
| **W5 — AI + finanse premium** | Inteligencja nad danymi | AI forecast/RCA/narracja/anomalie (#11); IRR+wrażliwość, spięcie z Finance (#5); wygaszenie legacy G4 (#12) | 🟢 P2 |

### Definicja „ukończenia" M15 (Definition of Done na poziomie modułu)
M15 = gotowe, gdy demo na realnych danych pokazuje pełny łańcuch: **inicjatywa (M14) zamknięta → korzyść/KPI przekazana i widoczna → mierzona w czasie → przypisana przyczynowo → przeliczona na PLN → wpięta w cel strategiczny → odchylenie obsłużone → wartość zagregowana w narrację dla zarządu** — wszystko zweryfikowane live (Playwright + screenshoty), za bramkami flag, bez martwego kodu.

---

## CZĘŚĆ VI — DECYZJE DLA PIOTRA (zanim budujemy)
1. **Model korzyści (#1):** czy „benefit" = wzbogacony KPI (prościej, szybciej), czy osobna encja `benefit` z profilem nad KPI (czystsze doktrynalnie, więcej pracy)?
2. **Handoff G1 (#2):** wariant a (handoff→`initiative_kpis`), b (M15 czyta `benefits_register`), czy c (most-serwis)?
3. **Zakres warstwy strategicznej (#6):** pełne OKR + BSC + BDN, czy najpierw sama mapa zależności (BDN) jako największy „wow"?
4. **Priorytet W3 vs W4:** najpierw klej strategiczny (W3) czy od razu narracja wartości dla zarządu (W4, najbliżej obietnicy aplikacji)?
5. **Premium AI (W5):** który model (Sonnet/Opus) i które funkcje AI jako pierwsze?

> Po Twoich decyzjach rozpiszę W1 na konkretne zadania techniczne (jak `M14-STAN-PRACY-ODBIORY.md` z bramkami odbioru) i ruszamy budowę.
