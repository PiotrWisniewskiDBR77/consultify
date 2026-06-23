# Generatory Deliverable (M17–M20) — MASTER PLAN TESTÓW (manual + auto/Playwright)

> Cel: pełna, wykonawcza lista testów **wszystkich 24 sub-modułów** programu (E1 → X6) + warstwa jakości FT-6, tak żeby manualne scenariusze dało się **przeprowadzić w Playwright i wygenerować zdjęcia z prac**. Autor: Claude (CTO), 2026-06-22. Branch `feat/deliverables-w1`.
>
> **Uczciwa zasada:** ten plan rozróżnia *co da się zautomatyzować i sfotografować DZIŚ* od *co wymaga (a) dodania `data-testid`, (b) deploya/flagi, (c) wpięcia generatorów premium, (d) decyzji Q1/Q3/Q5*. Nie udajemy zieleni której nie ma.

## Mapa serii (klik → szczegóły)
| Seria | Fala | Zakres | Scenariusze | Plik |
|---|---|---|--:|---|
| **E** | W1 | Wspólne wejście (launcher, 3 ścieżki) | 13 | [E-series.md](E-series.md) |
| **R** | W2 | Edytory (TipTap doc, deck Gamma-flow, table CF) | 8 | [R-series.md](R-series.md) |
| **T** | W3 | Template engine (API, DBR77, user-created, Teresa) | 9 | [T-series.md](T-series.md) |
| **B** | W4 | Mózg premium (deck/doc/table AI) — **FT-6 jakość** | 9 | [B-series.md](B-series.md) |
| **X** | W5 | Eksport + assety + spójność (PDF/PNG, xlsx CF, lineage) | 11 | [X-series.md](X-series.md) |

Scenariusze SSOT jakości (90): [`../scenarios/M18_REPORTS.md`](../scenarios/M18_REPORTS.md) · [`M19_DECKS.md`](../scenarios/M19_DECKS.md) · [`M20_TABLES.md`](../scenarios/M20_TABLES.md).

---

## 1. Cztery tory testowe — co każdy DOWODZI

| Tor | Narzędzie | Co dowodzi | Bezpieczny dziś? |
|---|---|---|---|
| **A. UI E2E + screenshoty** | Playwright (`tests/e2e/deliverables/`) | że launcher/edytory/Outputs renderują i klikają się; **zdjęcia z prac** | ✅ TAK — przez harness E2E z **mock-DB** (NIE dotyka prod) |
| **B. Wierność eksportu (FT-4)** | vitest (parsowanie pptx/docx/xlsx/pdf) | że plik zawiera realne style/CF/wykresy (nie fasada) | ✅ TAK — czyste, offline |
| **C. Round-trip integracji (FT-2/FT-8)** | vitest + `page.request` API | kontrakty API, org-scope 403, persyst, lineage | ✅ TAK (część przez mock-DB / staging) |
| **D. Jakość AI (FT-6)** | plain-node runner + scoring engine | że premium LLM produkuje jakość vs podłoga / vs Gamma | ⚠️ tylko z ważnym kluczem LLM; **NIE pod vitest** (patrz §5) |

**Kluczowa świadomość bezpieczeństwa:** dev-backend domyślnie ładuje `.env.local` → **prod centerbeam**. Tory A/C uruchamiamy WYŁĄCZNIE przez harness E2E z `E2E_MOCK_DB=true` (mock-DB), który NIE łączy się z prod. Tor D (plain-node) ma guard `DOTENV_IGNORE_LOCAL=1`.

---

## 2. Jak uruchomić (komendy)

### Tor A — UI E2E + zdjęcia (bezpieczny, mock-DB)
```bash
# Flaga launchera MUSI być ON na froncie (inaczej legacy nav):
VITE_ENABLE_DELIVERABLES_LIGHT=true \
E2E_USE_WEB_SERVER=true E2E_MOCK_DB=true \
npx playwright test tests/e2e/deliverables/ --project=chromium
```
- baseURL `http://localhost:3000`, API `http://127.0.0.1:3001`, viewport **1680×1050**.
- Auth: `loginAsOwner(page)` / `loginAsMember(page)` z `tests/e2e/smoke/work-canvas-helpers.ts` (token + storageState). `suppressOnboarding(page)` PRZED `page.goto`.
- Zdjęcia: `docs/qa/screens/deliverables-<seria>-2026-06-22/<id>.png` (light + dark; dark przez `consultify-storage` theme).

### Tor B — wierność eksportu (FT-4)
```bash
npx vitest run tests/unit/deliverables/playwrightHtmlToPng.test.ts \
  tests/unit/deliverables/workbookBuilderCf.test.ts \
  tests/unit/deliverables/documentChartRasterizer.test.ts
```
(już istnieją, evidence-grade: PNG magic bytes, xlsx ZIP+XML `<conditionalFormatting>`, chart PNG niepusty).

### Tor C — kontrakty/integracja (FT-2/FT-8)
```bash
npx vitest run tests/integration/deliverables/
```

### Tor D — jakość AI (FT-6, żywy LLM)
```bash
# klucz ze stagingu (NIE prod), guard DOTENV_IGNORE_LOCAL w skrypcie:
ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv | grep ^ANTHROPIC_API_KEY= | cut -d= -f2-) \
node --import tsx scripts/deliverables/live-pilot-ft6.mts
# wynik → docs/qa/deliverables/runs/2026-06-22-live-pilot-sonnet46.json
```

---

## 3. Wynik pilota FT-6 (2026-06-22, Sonnet 4.6 — realny mózg premium)
| Moduł | Podłoga (deterministyczna) | Premium (Sonnet 4.6) | Stan |
|---|--:|--:|---|
| **Deck (B1)** | 58% | **79%** (do 93%) | ✅ premium działa: 10 distinct layoutów, image-brief/slajd, dyscyplina palety |
| **Table (B4)** | 10% | **70%** (S06/S16 90–91%) | ✅ premium działa: typowane pola + seed rows |
| **Doc (B3 struktura)** | — | **premium-grade** (kpi_strip/chart/callout/bullet_list/table) | ✅ struktura |
| **Doc (content-gen)** | 32% | niezmierzone | ⚠️ blokuje timeout + stall inicjalizacji DB w harnessie (patrz §5) |

Pełne liczby + per-scenariusz: [`../runs/2026-06-22-live-pilot-sonnet46.json`](../runs/2026-06-22-live-pilot-sonnet46.json). 0/9 „strict pass" (bramka zero-fail), ale wysokie %; pudła to głównie proxy scoringu i syntetyczny input, nie jakość — szczegóły w [B-series.md](B-series.md).

---

## 4. `data-testid` do dodania (warunek automatyzacji UI)
Większość powierzchni M17–M20 NIE ma stabilnych selektorów. Zebrana lista do wdrożenia (osobny, drobny PR FE):

**Launcher/Outputs (E, T):** `outputs-new-button` · `launcher-type-report|presentation|table` · `launcher-template-blank` · `launcher-template-{id}` · `launcher-suggest-input|btn|result|accept`
**Doc (R):** `doc-inline-ai-trigger|menu|proposal|approve` · `doc-table-block` · `doc-chart-block` · `doc-kpi-strip` · `doc-callout` · `doc-autosave-status`
**Deck (R, B):** `deck-regenerate-slide|input` · `deck-present-button|mode` · `deck-theme-switcher` · `deck-undo` · `deck-brand-logo`
**Table (R):** `platform-grid-view` · `grid-add-row` · `table-cf-panel|add-rule` · `table-formula-input|apply` · `table-view-kanban`
**Wspólne:** `deliverable-generation-error` · `chat-pending-prompt`

Już istnieją: `reports-presentations-hub`, `document-tiptap-editor`, `deck-builder-mels-root`, `cell-cursor-*`, `source-ref-*`, `ai-classification-*`.
Status startowy (ten branch): dodano launcher entry-flow test-id (`outputs-new-button`, `launcher-type-*`, `launcher-template-blank`) — patrz przykładowy spec `tests/e2e/deliverables/e1-launcher.spec.ts`.

---

## 5. Pułapki techniczne (z realnych przebiegów)
1. **vitest NIE nadaje się do żywego FT-6** — `generateObject` (structured) pada pod vitest („Invalid JSON response" na 200-OK, undici/provider-utils). Żywy LLM tylko plain-node (`scripts/deliverables/live-pilot-ft6.mts`).
2. **Import generatorów ciągnie DatabaseInitializer** → bez szybkiego DB stall ~145s zżera budżet i powoduje timeout content-gen. Tor D ma guard; tor A używa mock-DB.
3. **Circuit-breaker**: jeden call >60s otwiera breaker na 60s i „zatruwa" kolejne → fallback. Runner resetuje breaker per scenariusz.
4. **Bug naprawiony**: `llmService.getProviderSync` budował `createAnthropic` bez `baseURL` → `/messages` 404. Fix: `baseURL …/v1`. (Anthropic nigdy nie był używany live → latentne.)
5. **CI pomija `src/**/__tests__`** — testy kładź w `tests/{unit,integration,e2e}`. `tests/` jest w `.gitignore` → `git add -f`.

---

## 6. Wykonalność DZIŚ vs bramki (uczciwy bilans)
**Da się teraz (bezpiecznie):**
- Tor B (FT-4 wierność eksportu) — komplet, offline.
- Tor C (FT-2/FT-8 kontrakty/org-scope) — przez mock-DB / staging.
- Tor D (FT-6 jakość deck/table) — z kluczem ze stagingu; deck/table zmierzone.
- Tor A (UI + zdjęcia) — po dodaniu test-id launchera (start zrobiony) + uruchomieniu harnessu z flagą.

**Bramki (wymaga Piotra / deploya):**
- **Q1** próg jakości FT-6 (propozycja w [B-series.md](B-series.md): deck ≥75%, table ≥75%, doc — po odblokowaniu content-gen).
- **Q3** golden-prompty (3–5 realnych tematów DBR77) → head-to-head vs Gamma/Airtable.
- **Q5** provider stocków (X4).
- **Deploy staging za flagą** → manual FT-7 + →UI/→F Piotra.
- **Wpięcie premium w UI** (`ENABLE_DELIVERABLES_PREMIUM`) → tory A+D razem (jakość widoczna w przeglądarce). Klienci OFF first.
- **content-gen doc**: odblokować timeout/DB-stall + (opcjonalnie) chunkowanie dużych dokumentów → domiar jakości doc.
