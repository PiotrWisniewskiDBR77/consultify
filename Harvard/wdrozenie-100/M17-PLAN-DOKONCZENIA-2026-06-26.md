# M17 „Materiały" — PLAN DOKOŃCZENIA do „idealnego konsultanta" (SSOT operacyjny)

Start: 2026-06-26 · Branch: `feat/deliverables-w1` · Deploy odbioru: demo.consultify.ai · Bazuje na 7-agentowym audycie `M17-AUDYT-REALIZACJI-2026-06-26.md` (dowody plik:linia).
**Zasada twarda:** idziemy workstream po workstreamie, task po tasku. Task ZAMKNIĘTY = **8/8 bramek**. Kryterium nadrzędne: **„wpięte w żywy produkt, który klika użytkownik"** — nie „kod istnieje + testy zielone".

---

## 0. WERDYKT AUDYTU (co jest naprawdę)

**Trzy prawdy, które zmieniają plan:**

1. **Dwa równoległe tory.** Dojrzałe studia **M18 Document Studio (~8/10), M19 Prezentacje (~6.5/10), M20 Tabele (~6.5/10)** są ŻYWE, user-reachable, z prawdziwymi silnikami: `documentQaService` (10 kategorii, blokuje eksport), `presentationQualityGatesService` (10 bramek), `presentationVisionQAService` (ŻYWA pętla Vision-QA), `TableQaService` (5 osi), share-linki, approvals, wersjonowanie, `PptxPipelineService` (17 intencji, master slides, branding). Nowy pipeline `/bundle` **reimplementuje cieńszą wersję i IGNORUJE** to wszystko (`bundleContentGate` zamiast `documentQaService`, `bundlePptxRuntime` zamiast `PptxPipelineService`). Żywy frontend (Kimi chat-canvas) woła **stare studia**, nie `/bundle`.

2. **„Mózg premium" jest w 100% MARTWY.** 10 modułów jakości/inteligencji (F1.3/F1.4/F6/F8/F9/F10/F11) = **0 żywych callerów**. `bundleGenerationRuntime` nie importuje ani jednego. Pipeline produkuje wynik bez bramki piękna, bez kontroli treści, bez księgi faktów, bez wykresów, bez brandu, bez obrazów, bez wariantów. **To jest źródło wrażenia „powierzchowności".**

3. **Filary „nie istnieją" istnieją — tylko nie u nas.** F5 (zbieranie danych) jest **~90% zbudowane i ŻYWE** (`connectorFramework` + 6 konektorów w tym `postgres`, `FormIntakeService`) — trzeba je tylko wystawić w Materiałach. F7 (automatyzacja) ma cały szkielet ŻYWY (cron tick, `scheduledReportService`, prawdziwy `emailService`) — ale (a) spięty ze starym report-builderem nie z M17, (b) `deliverViaEmail` to **stub** (loguje, nie wysyła).

**Skorygowana strategia: KOMPONUJ, nie buduj czwartego stosu.** „Materiały" = JEDNA biblioteka + JEDNO unified „Nowy" → **orkiestruje dojrzałe studia + SPINE + wpina mózg premium + odpala flagi premium istniejących silników**. Plus dobuduj brakujące spoiwa (frontend unified flow, persystencja cyklu życia, bridge automatyzacji, live-bind).

**Realny stan jako PRODUKT: ~25-35%.** Backend rdzeń ~70% i żywy; biblioteka FE ~40% i dobra; integracja mózgu ~5%; filary F2/F6-persist/F7-bridge/F12/F13/F14 ~0-10%.

---

## 1. BRAMKI (8) + LEGENDA

**8 bramek per task** (task ZAMKNIĘTY = wszystkie ✅):
1. **Kod** — funkcja zaimplementowana + unit-testy zielone
2. **Wpięte** — *zaimportowane i wołane przez ŻYWY kod* (route/pipeline/UI), nie tylko testy ⟵ **bramka, która dotąd zawodziła**
3. **Testy** — integracja + E2E zielone (nie tylko unit)
4. **DoD 7/7** — front↔back · security · i18n PL/EN · tokeny (0 rose/hex) · §27 · E2E w gate · canon UI/UX
5. **UI/UX** — zgodność ze standardem + bramka piękna (VisionQA)
6. **Deploy demo** — żywe na demo.consultify.ai
7. **→F** — Piotr klika, działa
8. **→UI** — audytor+Piotr, screeny odebrane

**Legenda statusu:** ⬜ niezrobione · 🟡 w toku/częściowe · 🟢 realizacja gotowa (czeka →F/→UI) · ✅ zamknięte (8/8) · ⛔ wymaga Piotra (env/decyzja)

---

## 2. DASHBOARD — pełne dokończenie (task → 8 bramek)

> Kolumny: Kod · Wpięte · Testy · DoD · UI · Dep · →F · →UI. „Wpięte" = czy żywy kod to woła (dowód z audytu).

### W0 — Konwergencja architektury (decyzje + fundament)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W0.1 | DECYZJA: `/bundle` orkiestruje studia (M18/19/20) vs standalone | n/d | n/d | n/d | n/d | n/d | n/d | ⛔ | n/d | ⛔ Piotr (rekom: orkiestruj) |
| W0.2 | Unify entity model — 1 „materiał" = 1 rekord własności studio-artefaktów (`unifiedDocEntityService`) | 🟡 | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 (usługa istnieje, nie spina) |
| W0.3 | Flip flagi premium istniejących silników (`ENABLE_DELIVERABLES_PREMIUM` deck-layout/variants, `ENABLE_TABLE_QA_ENGINE`) | n/d | ⬜ | ⬜ | n/d | n/d | ⛔ | ⬜ | ⬜ | ⛔ Railway (część zrobiona) |

### W1 — Wpiąć MARTWY mózg premium w żywy pipeline (rdzeń „anty-powierzchowności")
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W1.1 | beauty-gate (F1.3) w deck-path — `applyDeckBeautyGate` wrap | ✅ | ✅ | ✅ | 🟡 | ⬜ | 🟢 | ⬜ | ⬜ | 🟢 **WPIĘTE** (bundle.quality.beauty na każdym decku) |
| W1.2 | content-gate (F1.4) w `generateBundleFromSpine` + bundle.quality | ✅ | ✅ | ✅ | 🟡 | n/d | 🟢 | ⬜ | ⬜ | 🟢 **WPIĘTE** (placeholder+hero-consistency) |
| W1.3 | factBook (F10.1) audit + provenance (F10.2) jako QA-pass | ✅ | ✅ | ✅ | 🟡 | n/d | 🟢 | ⬜ | ⬜ | 🟢 **WPIĘTE** (audit; token-subst dalej ⬜) |
| W1.4 | audience-variants (F10.3) — quality.variants + board-cut PPTX w teczce | ✅ | ✅ | ✅ | 🟡 | ⬜ | 🟢 | ⬜ | ⬜ | 🟢 **WPIĘTE** (board deck materializowany w zip) |
| W1.5 | chart-spec (F11.1) → renderer rozumie waterfall/2×2/RAG (`spineToDocPlan` chart hints) | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (M-L, renderer musi switch'ować spec.type) |
| W1.6 | brand-ingestion (F8.1) → upload w `/bundle/export` → `resolveTheme(themeId, override)` | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (S-M, `resolveTheme` gotowy na to) |
| W1.7 | image-router (F9.1) → `deckImageResolverService`/`stockImageProvider` (T0 teraz; T1-3 za adapterami) | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (M; T1-3 executory brak) |
| W1.8 | **ADOPCJA dojrzałych silników QA jako autorytatywnych** (documentQaService/presentationQualityGatesService/VisionQA/TableQaService zamiast cienkich bramek) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (kluczowy, M-L) |

### W2 — Naprawić ŻYWE bugi jakości (z audytu + head-to-head BAR)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W2.1 | **BUG P0: deck LLM bez timeout** → `timeoutMs:120000` | ✅ | ✅ | ✅ | n/d | n/d | 🟢 | ⬜ | n/d | 🟢 **NAPRAWIONE** (deck już nie ginie cicho) |
| W2.2 | CFO range-validators + bug „thousands EUR" (ltv_cac_ceiling/payback_floor/arr_positive/false_precision + normalizeCurrencyUnit) | ✅ | ✅ | ✅ | n/d | n/d | 🟢 | ⬜ | n/d | 🟢 **NAPRAWIONE** (7 testów) |
| W2.3 | Tytuły-headline'y (clamp ✅ F1.1) + **chipy sekcji** + ≥8 distinct layouts egzekwowane na renderze | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (clamp jest; chipy ⬜) |

### W3 — Frontend unified „Materiały" (user dociera do pipeline'u)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W3.1 | Unified panel „Nowy" + wybór formatu (rozszerz `OutputsLauncherModal`) | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (launcher istnieje za flagą) |
| W3.2 | Wejście 1: brief→retrieval z org (F2.2) | ✅ | ✅ | ✅ | ✅ | n/d | ✅ | ⬜ | ⬜ | 🟢 **ZROBIONE** (`briefEnrichment.ts` komponuje searchInsights+searchOrgNotes; opt-in `useOrgContext` w /bundle+/export; 8 testów) |
| W3.3 | Wejście 2: upload pliku→parse (F2.3) | ✅ | ✅ | ✅ | ✅ | 🟡FE | ✅ | ⬜ | ⬜ | 🟢 **BACKEND ZROBIONE** (`uploadContextExtract.ts` komponuje xlsx/jszip/parseCSV/PDFParser → txt/csv/xlsx/docx/pdf; `POST /data/extract`; 11 testów. UI uploadu = sesja FE) |
| W3.4 | Wejście 3: „Przygotuj narzędzie" handoff (F2.4) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (0 hits w src) |
| W3.5 | **FE → `/bundle/export`** (nowy `deliverablesBundle.ts`: `generateBundle`/`exportBundle`) ⟵ największa luka | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (0 frontend callerów) |
| W3.6 | In-app unified viewer (3 formaty z 1 wiersza biblioteki) | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (`ArtifactViewer` częściowy) |
| W3.7 | Share-viewer dla raportu+tabeli (deck już jest) (F4.3) | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (deck-only dziś) |
| W3.8 | Flip `VITE_ENABLE_DELIVERABLES_LIGHT=true` na Railway (launcher renderuje) | n/d | n/d | n/d | n/d | n/d | ⛔ | ⬜ | ⬜ | ⛔ Railway |

### W4 — Persystencja cyklu życia (host dla trio F6)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W4.1 | Encja „materiał": kolumny `lifecycle_state` + `versions` (na `document_studio_artifacts` lub nowa) | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | ⬜ (blokuje F6.1/6.3) |
| W4.2 | Route `PATCH /:id/transition` → `transition()` + gate `isEditable` (F6.1 wpięcie) | ✅kod | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 (modul gotowy, brak hosta) |
| W4.3 | `commitVersion`/`rollbackTo` + RBAC route (F6.3 wpięcie) | ✅kod | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 |
| W4.4 | layered-edit (F6.2) wpięte w pętlę edycji (blockId overrides) | ✅kod | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 (brak edit-loop producenta) |
| W4.5 | feedback-loop (F10.4) → POST do `InitiativeController` (M13) + back-link | ✅kod | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 (wymaga persisted materialId) |

### W5 — Dane (F5) — KOMPONUJ istniejące (~90% gotowe)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W5.1 | Wystaw konektory (`connectorFramework`) na tabelę materiału (`materialDataBinding.ts` + endpointy) | ✅ | ✅ | ✅ | ✅ | n/d | ✅ | ⬜ | ⬜ | 🟢 **ZROBIONE** (connectorDataset + GET /data/connectors + POST /preview; 10 testów) |
| W5.2 | Generowane formularze→tabela materiału (`FormService`) (F5.2) | ✅ | ✅ | ✅ | ✅ | n/d | ✅ | ⬜ | ⬜ | 🟢 **ZROBIONE** (formDataset DI + POST /data/forms/:id/dataset) |
| W5.3 | UI „Dane" tab na materiale (Connect source + Collect via form) | 🟡 | 🟡 | ✅ | ⬜ | 🟡 | ⬜ | ⬜ | ⬜ | 🟡 (FE-klient `materialData.ts` gotowy + 7 testów; komponent tabu = sesja FE) |

### W6 — Automatyzacja (F7) — BRIDGE istniejącego szkieletu
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W6.1 | **Bridge: `executeSchedule` → generator M17** (zamiast legacy report-builder) `scheduledReportService.ts:508` | 🟢infra | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 (M) |
| W6.2 | **Un-stub `deliverViaEmail`** → realny `emailService.send` per odbiorca (fail-soft) | ✅ | ✅ | ✅ | n/d | n/d | 🟢 | ⬜ | n/d | 🟢 **NAPRAWIONE** (4 testy; załącznik→W6.1) |
| W6.3 | Governance odbiorców + opt-out (F7.2) | 🟡 | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 (`notificationService` reuse) |
| W6.4 | UI „Automatyzuj" panel na materiale (cron + odbiorcy) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| W6.5 | F6.4 live-bind resolver (`liveBindingResolver.ts` + refresh-on-open) | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | ⬜ (build new, thin M) |

### W7 — Piękno/kompozycja (Gamma-killer)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W7.1 | Gramatyka układu Krok 2: 12-kol grid + region-archetypy + 14 prymitywów + JEDEN generyczny renderer (FE+PPTX) | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (composition emit jest; renderer nie pokazuje) |
| W7.2 | Krok 3: design-rule critic loop (typo/measure/contrast/≤6 bullets/grid → regen) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| W7.3 | ≥20 archetypów arsenału (exec-SCQA/2×2/before-after/funnel/heatmap/roadmap/Minto/big-number/logo-wall…) | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (17 intencji w PptxPipeline — rozszerzyć) |
| W7.4 | Biblioteka kuratorowanych palet (60-30-10, semantic, brand-aware, dark/light) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| W7.5 | think-cell komplet: mekko/marimekko + harvey-balls + renderer (waterfall/2×2/RAG ✅ kod) | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (mekko/harvey ⬜) |
| W7.6 | Bogactwo PPTX: adoptuj `PptxPipelineService` (17 intencji/master/branding) zamiast minimal `bundlePptxRuntime` | 🟢istnieje | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (retire minimal renderer) |
| W7.7 | Piękny Excel (banded/CF/sparklines/numFmt/freeze) + book-Word (TOC/running-heads/pull-quotes/captions) | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (CF premium istnieje, gated) |

### W8 — Edytor (F12)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W8.1 | WYSIWYG per format (doc→TipTap, retire read-only viewer) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| W8.2 | Inline AI-edit „zaznacz→popraw" (warstwowy, łączy z F6.2) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### W9 — Office fidelity + współpraca + share-security (F13)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W9.1 | Office round-trip fidelity (otwiera się idealnie w MS/Google, 0 „repair") | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| W9.2 | Współpraca: komentarze/review/co-edit (M18 ma async proposals — rozszerz) | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 |
| W9.3 | Share-link security (wygaśnięcie/hasło/dostęp) + IDOR review publicznego resolve | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 (HMAC token jest; expiry/hasło ⬜) |

### W10 — Telemetria + seeding (F14)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W10.1 | Telemetria jakości (edit-rate/regen/share/download/TTFD) (`deliverablesTelemetryService` reuse) | 🟡 | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 |
| W10.2 | First-run seeding (template'y + quick brand-setup nowej org) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### W11 — Dług fasadowy (DELIVERABLES_GENERATORS_SPEC §3/§5)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W11.1 | doc-charts realne (rasteryzacja PNG w DOCX/PDF) | ✅ | ✅ | ✅ | ✅ | n/d | ✅ | ✅CTO=B | ⬜ | 🟢 **ZROBIONE** (decyzja CTO: `@napi-rs/canvas` prebuilt, bez cairo/pango = bezpieczne dla Railway; adapter `NapiChartCanvas` w `documentChartRasterizer.ts`; realny PNG 16KB; 4 testy) |
| W11.2 | Puppeteer HTML→PDF/PNG parity (zamiast słabego PDFKit text-only) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| W11.3 | CF live data-layer (CRUD/persystencja warunkowego formatowania w GridView) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| W11.4 | doc/sheet→deck unified entity (1 encja, zero duplikatów) | 🟡 | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 |
| W11.5 | Outputs transactional registry + lineage | 🟡 | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 |

### W12 — Warstwa inteligencji konsultanta (BUSINESS_PLAN_GENERATOR_SPEC, ukryte wymogi)
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W12.1 | AssumptionsModel A2-A10: anti-pattern detektory (hockey-stick/„1% rynku"/false-precision/hidden-circularity) + reference-class base-rates | 🟡 | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 (część w spine) |
| W12.2 | FinancialEngine: valuation 3-metody (DCF+comps+VC) + sensitivity + machine-validation-report | 🟡 | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 (engine 11/11; valuation ⬜) |
| W12.3 | BundleOrchestrator: parity-validator (zero orphan claims) + glossary + SCQA-per-section + title-read-through | 🟡 | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | 🟡 |

### W13 — Testy + zgodność do realnego 8/8
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W13.1 | Route integration test `/bundle` + `/bundle/export` (404/400/200 + zip/Content-Disposition) | ✅ | ✅ | ✅ | ✅ | n/d | n/d | n/d | n/d | 🟢 **ZROBIONE** (7 testów supertest) |
| W13.2 | `generateBundle` integration test — quality wpięte + fail-soft | ✅ | ✅ | ✅ | ✅ | n/d | n/d | n/d | n/d | 🟢 **ZROBIONE** (7 testów, dowód że mózg żyje) |
| W13.3 | SoT-through-generate: hero-number w DOCX==XLSX==PPTX z realnej generacji | ⬜ | ⬜ | ⬜ | ⬜ | n/d | n/d | n/d | n/d | ⬜ |
| W13.4 | E2E: brief→„Pobierz komplet"→niepusty .zip | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | n/d | ⬜ |
| W13.5 | Color-token sweep (43 wystąpień rose/hex/red w 3 obszarach FE) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (DoD#4 FAIL) |
| W13.6 | i18n PL/EN przez `t()` (12 plików FE z hardcode PL) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (DoD#3 FAIL) |
| W13.7 | §27 per-tabela checklist (Menu 1/2/3 + archive/delete) ×6 powierzchni | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | 🟡 |
| W13.8 | Potwierdź CI uruchamia `test:integration` (security testy dziś mogą być martwe) + guard `git ls-files` | ⬜ | ⬜ | ⬜ | n/d | n/d | n/d | n/d | n/d | ⬜ |
| W13.9 | VTS golden (oprócz DBR77) — „test żywy + ≥1 golden" z DoD modułu | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### W14 — Dostępność (a11y) — spec'd, brak w trackerze
| # | Task | Kod | Wpięte | Testy | DoD | UI | Dep | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| W14.1 | Deck: alt-text + reading-order | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| W14.2 | Doc: tagged-PDF / heading-order / PDF-UA | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| W14.3 | Table/charts: colorblind-safe palety | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

**Postęp jako PRODUKT: ~40-45%** (było ~25-35%). **Sesja nocna 2026-06-26 (autonomiczna):** bramka „Wpięte" zazieleniona dla **W1.1-W1.4** (mózg premium realnie liczy się na każdym materiale — beauty/content/factbook/provenance/warianty w `bundle.quality`), P0 bugi **W2.1** (deck-timeout) + **W2.2** (CFO range-validators + „thousands EUR") naprawione, **W6.2** email un-stub, **W1.4-export** board-cut PPTX w teczce, **W13.1/W13.2** testy integracyjne (dowód że ścieżka HTTP + mózg żyją). Deliverables suite **484/484** + studio **862/862**, 0 błędów tsc w moich plikach. Deploy: feat→demo (non-prod), PROD nietknięty. ZOSTAŁO „Wpięte ⬜": W1.5 charts→renderer, W1.6 brand-upload, W1.7 image-router, W1.8 adopcja studio-QA, W3 frontend unified, W4 persystencja cyklu życia, W5/W6.1 dane/bridge, W7+ piękno/edytor/fidelity/telemetria.

---

## 3. KROKI PER WORKSTREAM (skrót wykonawczy — pełne kroki w sekcjach niżej)

**Rekomendowana kolejność (wartość × odblokowanie):**
1. **W0.1 decyzja architektury** (Piotr) → determinuje czy W1.8/W7.6 (orkiestracja) czy dalej standalone.
2. **W2.1 + W2.2** (P0 bugi: deck-timeout + CFO range-validators) — najszybsza naprawa „liczby wyglądają źle/deck znika".
3. **W1.1-W1.6** (wpiąć martwy mózg w pipeline) — to fizycznie usuwa „powierzchowność": gates + factbook + variants + charts + brand zaczynają działać na realnym materiale.
4. **W3.5 + W3.1-W3.4** (frontend unified flow) — user wreszcie DOCIERA do pipeline'u.
5. **W4 persystencja** (host cyklu życia) → odblokowuje F6 trio + W4.5 feedback-loop.
6. **W5 dane (kompozycja) + W6 automatyzacja (bridge)** — dwa nazwane filary, głównie spinanie istniejącego.
7. **W7 piękno** (Gamma-killer) — najgrubszy blok jakości wizualnej.
8. **W8-W14** — edytor, fidelity/współpraca, telemetria, dług, inteligencja, testy 8/8, a11y.

### Szczegóły kroków W1 (rdzeń — wszystkie wpięcia w `bundleGenerationRuntime.generateBundleFromSpine`, jeden chokepoint):
- **W1.1** po `planDeckLayout` (`:77`): `deck = await applyDeckBeautyGate(first, () => planDeckLayout(...))`. `extractDeckPlans` działa bez zmian (superset).
- **W1.2** przed `return` (`:81`): zserializuj deck/doc/table do tekstu, `runBundleContentGate({deckText,reportText,tableText}, spine.heroNumbers)`, dołącz `bundle.contentGate`, surface w route `:353`. Najpierw warn-only.
- **W1.3** `buildFactBook(spine.heroNumbers)` → `auditFactConsistency` (S, bez zmian upstream). Token-substytucja wymaga, by generatory emitowały `{{fact:key}}` zamiast inline `h.formatted` (`spineToDocPlan:202`) — osobny krok.
- **W1.4** w `bundleExportRuntime:142`: `const {board,working}=buildBothVariants(plans)` → 2 PPTX w zip albo `?variant=board`.
- **W1.5** w `spineToDocPlan` (`:227/:230`) zamień freeform chart hint na `buildWaterfall(...)`/`buildMatrix2x2(...)`; renderer (`documentChartRasterizer`/pptx) musi `switch(spec.type)`.
- **W1.6** dodać multipart upload do `/bundle/export` → `extractBrandTheme(buffer)` → przepuść `override` przez `exportBundleFiles`→`resolveTheme(themeId, override)`.
- **W1.7** w deck-step dla `needsProductGraphic` (`:183`): `routeImage(...)` + `totalCreditCost`; T0 stock działa, T1-3 czekają na adaptery (W7/F9.2).
- **W1.8** (decyzja W0.1=orkiestruj): zamień cienkie bramki na autorytatywne silniki studiów — report→`runDocumentQa`, deck→`presentationQualityGatesService`+`VisionQA`+`PptxPipelineService`, table→`TableQaService`. Bundle-gates zostają jako tani cross-format coherence check.

### Szczegóły W2 (bugi):
- **W2.1**: `presentationLayoutDirectorService.ts:575` dodaj `timeoutMs:120000` (jak w assumptionsModel:88, tableSchema:530, docBlock:493).
- **W2.2**: w `financialEngine` CFO-review dodaj range-validatory: LTV/CAC ∈ [3,8] (>8=flag false-precision), payback ≥ realistyczny dla motion, ARR>0 gdy SaaS, jednostki spójne (bug „thousands EUR" = podwójne skalowanie — napraw formatter hero).

### Szczegóły W3 (frontend):
- **W3.5**: nowy `src/services/deliverablesBundle.ts`: `generateBundle(brief,opts)→POST /api/deliverables/generations/bundle`; `exportBundle(...)→POST .../bundle/export` (zip). Wepnij w rozszerzony `OutputsLauncherModal`.
- **W3.1-3.4**: rozszerz `OutputsLauncherModal` (zachowaj 2-step UX) o 3 wejścia: textarea brief (→W3.5), `<input type=file>` (→parse endpoint, dobuduj backend parse), deep-link handoff (`/presentations?new=1&from=<module>&entityId=`).
- Reuse: `ReportsAndPresentationsHub`/`ModuleHub`/`useRapData`/`ArtifactViewer`/`SharedPresentationView`/`FilterableTable`.

### Szczegóły W5/W6 (kompozycja/bridge):
- **W5**: `deliverables/materialDataBinding.ts` deleguje do `connectorRunner`+`FormService.createForm`; endpointy `POST /materials/:id/connector|form`.
- **W6.1**: w `scheduledReportService.executeSchedule:508` branch na `deliverableType:'material'` → `bundleOrchestrator`/`docGenerationRuntime` + eksport przez `bundleExportRuntime`.
- **W6.2**: `deliverViaEmail:645` zastąp stub: `emailService.send({to:recipients, subject, html, attachments:[plik]})`.

---

## 4. DoD MODUŁU (bramka „consultant-grade" — z PLAN, weryfikowalne)
1. Jeden wpis „Materiały" → biblioteka + „Nowy" (3 wejścia, wybór formatu).
2. Premium ON: 3 formaty z realną treścią (0 placeholderów), **beauty+content gate ZIELONY I WPIĘTY**.
3. Eksport .docx/.xlsx/.pptx + share-link + in-app viewer — z jednego materiału.
4. Template×motyw×formatowanie spójne na 4 powierzchniach; brand klienta nadpisuje.
5. Cykl życia (Draft→Sent=lock) + edycja warstwowa + wersje + RBAC.
6. Live-binding + harmonogram+email + formularze+konektory.
7. Księga faktów (zero sprzecznych liczb, auto-test) + provenance + warianty.
8. Pętla zwrotna materiał→artefakty.
**+ Każdy DoD mierzalny. Test żywy na demo + ≥2 golden (DBR77 + VTS).**

## 5. ⛔ DECYZJE/ENV DLA PIOTRA (odblokowują workstreamy)
- **W0.1** Architektura: `/bundle` ORKIESTRUJE dojrzałe studia (rekomendacja) vs rozwija standalone? ⟵ najważniejsza, determinuje ~40% pracy.
- **W3.8/W0.3** Railway: `VITE_ENABLE_DELIVERABLES_LIGHT=true` (launcher FE) + potwierdź `ENABLE_TABLE_QA_ENGINE`.
- Domyślny motyw „Executive" + zestaw 10 fontów — zatwierdzić?
- Edit MVP: inline-AI (lekki) vs pełny WYSIWYG (F12) — który pierwszy?
- Kolejność: czy najpierw „user dociera do pipeline'u" (W3) czy „mózg działa na materiale" (W1)? (rekom: W2 bugi → W1 wpięcie → W3 frontend.)

---

*Audyt źródłowy: 7 agentów, dowody plik:linia w `M17-AUDYT-REALIZACJI-2026-06-26.md`. Ten plik = SSOT dokończenia. Każdy task domykamy do 8/8, zaczynając od bramki „Wpięte" która dotąd zawodziła.*
