# STAN PRACY — Materiały (M17) · odbiory tasków do 100% (SSOT operacyjny)

Start: 2026-06-24 · Branch: `feat/deliverables-w1` · Deploy odbioru: demo.consultify.ai (merge feat→demo w worktree → Railway auto-deploy)
**Zasada twarda:** idziemy **faza po fazie** (F0→F10), task po tasku. Nie przechodzę do kolejnej fazy, póki jej taski nie są ZAMKNIĘTE (8/8). Premium-flaga (F1.2) = bramka jakości całości.
Ten plik = jedyne miejsce prawdy o postępie tej przebudowy. Szczegół (epiki/luki/kryteria) = [`M17-MATERIALY-PLAN.md`](M17-MATERIALY-PLAN.md) + [`MATERIALS_MODULE_MASTER_SPEC`](../../docs/product/MATERIALS_MODULE_MASTER_SPEC.md).

## Legenda
⬜ niezrobione · 🟡 w toku/częściowe · ✅ zrobione+odebrane · 🟢 gotowe do odbioru (realizacja ✅, czeka →F/→UI) · ⛔ wymaga Piotra (env/flaga)

## 8 bramek per task
1. **Kod** — funkcja zaimplementowana, luki domknięte · 2. **DoD** — kryteria mierzalne (niżej) · 3. **Epiki** — story zielone · 4. **Testy** — unit+E2E zielone · 5. **UI/UX** — zgodność z SSOT (kryt.7) · 6. **Deploy demo** — żywe na demo · 7. **→F** — Piotr klika, działa · 8. **→UI** — audytor+Piotr, screeny odebrane. **Task ZAMKNIĘTY = 8/8.**

## DoD globalny (7 — wspólne dla każdego taska)
1. Spięcie front↔back (zero fasad/mocków/martwych przycisków) · 2. Bezpieczeństwo (0 P0/P1; fix z testem regresji) · 3. i18n PL/EN przez t() · 4. Tokeny kolorów (0 rose/hex; EntityStatusChip/c.*) · 5. §27 (listy przez FilterableTable + Menu 1/2/3) · 6. E2E w PR-gate (scenariusze S zielone) · 7. Zgodność komponentów ze standardem UI/UX (canon).

## BRAMKA WSTĘPNA (przed pełną jakością)
- ⛔ **Flaga `ENABLE_DELIVERABLES_PREMIUM=true` na Railway demo** (Piotr) — odblokowuje content-fill + premium-kompozycję we wszystkich 3 formatach naraz. **#1 bloker jakości.**
- ⛔ Klucze obrazów na demo: `GEMINI_API_KEY` (nano-banana), później Ideogram/Recraft/Replicate (F9).
- ⛔ Re-login na demo do odbiorów →F/→UI (sesja się wylogowała).
- 🟡 Branch współdzielony (inni agenci) — commity chirurgiczne, git races realne.

---

## DASHBOARD (task → bramki realizacji + odbioru)
Kod: ✅=testy zielone · Manual/→F/→UI wg legendy.

| # | Task | Faza | Epiki | DoD | Kod | Manual | UI | →F | →UI | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| F0.1 | Sidebar 4→1 „Materiały" | F0 | ✅ | 🟡 | ✅ tsc | ⬜ | 🟡 | ⬜ | ⬜ | 🟢 do odbioru |
| F0.2 | Założenia startowe (treść+grafika) | F0 | ✅ | ✅ | ✅ 6/6 | n/d | n/d | n/d | n/d | ✅ |
| F0.3 | Backbone wiązki (SPINE→B4/B3/B1) | F0 | ✅ | ✅ | ✅ 8/8 | ✅ live | n/d | 🟡 | ⬜ | 🟢 |
| F0.4 | Fixy żywe (timeout/deck/table/tytuły) | F0 | ✅ | ✅ | ✅ live | ✅ deck10/table8 | 🟡 | 🟡 | ⬜ | 🟢 |
| F0.5 | Eksport DOCX+XLSX | F0 | ✅ | 🟡 | ✅ 4/4 | ⬜ | n/d | ⬜ | ⬜ | 🟢 |
| F1.1 | Wpiąć defaulty w B1/B3/B4 | F1 | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | ⬜ |
| F1.2 | Flaga premium ON (demo) | F1 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⛔ Piotr |
| F1.3 | Beauty gate (VisionQA) | F1 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F1.4 | Content gate (0 placeholderów/sprzeczności) | F1 | ⬜ | 🟡 | 🟡 | ⬜ | n/d | ⬜ | ⬜ | 🟡 |
| F2.1 | „Nowy" → panel + wybór formatu | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F2.2 | Wejście 1: input → retrieval z org | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F2.3 | Wejście 2: upload pliku → parse | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F2.4 | Wejście 3: „Przygotuj narzędzie" handoff | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F3.1 | Rejestr motywów (fonty+paleta)→4 renderery | F3 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F3.2 | Biblioteka template'ów per format | F3 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | 🟡 galerie są |
| F3.3 | Pogłębione formatowanie (H1-3/listy/tabele) | F3 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F4.1 | PPTX render z wiązki | F4 | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | ⬜ |
| F4.2 | „Pobierz komplet" (3 pliki) | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | 🟡 docx/xlsx są |
| F4.3 | Publiczny share-link viewer | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F4.4 | In-app viewer (3 formaty) | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | 🟡 preview jest |
| F5.1 | Konektory do baz | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F5.2 | Generowane formularze → tabela | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | 🟡 intake jest |
| F6.1 | Stany Draft→Review→Authorized→Sent | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F6.2 | Edycja warstwowa (merge, nie clobber) | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F6.3 | RBAC + wersjonowanie + rollback | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F6.4 | Tryb Live (bind danych) | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F7.1 | Scheduler subskrypcji raportu (cron) | F7 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F7.2 | Dostawa e-mail + governance odbiorców | F7 | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | ⬜ |
| F8.1 | Brand-ingestion (.pptx/.docx → motyw) | F8 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F9.1 | Image Router (tiery + fallback + VisionQA) | F9 | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | 🟡 nano/qwen/unsplash |
| F9.2 | Ideogram (tekst) + Recraft (wektor) + Pexels | F9 | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | ⬜ |
| F9.3 | Pakiety Lite/Pro + kredyty/licznik | F9 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F10.1 | Księga faktów (0 sprzecznych liczb) | F10 | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | 🟡 hero-numbers |
| F10.2 | Provenance na twierdzeniach | F10 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | 🟡 cytowania doc |
| F10.3 | Warianty audytorium (board/working cut) | F10 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F10.4 | Pętla zwrotna materiał→artefakty | F10 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |

**Postęp programu:** 0/35 tasków ZAMKNIĘTYCH (8/8). F0: 5 tasków 🟢 do odbioru (realizacja zielona, czeka →F/→UI + flaga). Reszta ⬜/🟡/⛔.

---

## ODBIORY SZCZEGÓŁOWE — FAZA F0 (realizacja ✅, czeka odbiory)

### F0.1 — Sidebar 4→1 „Materiały" · 🟢 do odbioru
| # | Etap | ✓ | Dowód |
|---|---|---|---|
| 1 | Kod | ✅ | menuConfig 4→1 (relabel #9, usuń #10-12) + breadcrumb; id MODULE_PRESENTATIONS zachowane (gate'y żyją); studia osiągalne route'em. `ce5a96ee56` |
| 2 | DoD | 🟡 | #1 front↔back ✅ · #7 UI ✅ (hub istnieje) · #3 i18n: label `sidebar.materialy` fallback PL — EN-key do dopisania (Faza i18n) |
| 3 | Epiki | ✅ | „Jeden moduł zamiast 4" |
| 4 | Testy | ✅ | tsc czysty (menuConfig+AppRoutes) |
| 5 | UI/UX | 🟡 | hub = ReportsAndPresentationsHub (tabela+taby+Nowy) istnieje; ekran „Materiały" do audytu →UI |
| 6 | Deploy | ✅ | `db914b1da2` na origin/demo (Railway build) |
| 7 | →F | ⬜ | **czeka: re-login Piotra → sidebar 1 wpis „Materiały" → biblioteka+Nowy** |
| 8 | →UI | ⬜ | screeny ekranu Materiały |

### F0.2 — Założenia startowe · ✅
Kod `deliverableDefaults.ts` (content+graphic, resolver merge) · DoD: 3 formaty, override per pole · Testy 6/6 · `b4f968a171`. (Backend config — bez UI/→F/→UI.)

### F0.3 — Backbone wiązki · 🟢
`bundleGenerationRuntime.generateBundle` + route `/business-plan` · 3/3 artefakty live, hero-numbers identyczne · 8/8 unit + e2e `_dbr77-from-brief` · commity c3ec6e18ae→a5bf5febe8. →F: dowód `runs/2026-06-24-AI-readiness-PREMIUM.{docx,xlsx}` (Piotr otwiera).

### F0.4 — Fixy żywe · 🟢
materialize timeout 20s→120s (`6d8c1bf5e6`, deck 8/8 Exported live) · deck 4→10 łuk (`63d8ebf8a9`, **zweryf. live**) · Table Studio generuje (`56d34d4ab4`+`5a5f2707de`, **zweryf. live 8/8 CSV**) · czyste tytuły (`156a48c271`). UI 🟡 (deck/table widziane live, formalny →UI screeny pending). →F 🟡 (deck/table zweryf. przeze mnie; formalny klik Piotra pending re-login).

### F0.5 — Eksport DOCX+XLSX · 🟢
`bundleExportRuntime` (ContentSection→DocumentSchema; tableSchema→workbook) · 4/4 (PK-zip>2KB) · `d6f9a7ad3d`. →F: realne pliki na dysku `docs/qa/deliverables/runs/`.

---

## FAZY F1–F10 — taski do realizacji (gate'y w dashboardzie)
Każdy task ⬜ rusza wg planu: Kod → DoD(7) → Epiki → Testy(unit+E2E) → UI(canon) → Deploy demo → →F → →UI. Detal epików/luk/kryteriów per task = [`M17-MATERIALY-PLAN.md`](M17-MATERIALY-PLAN.md) (sekcje F1-F10). Najpierw odblokowanie bramki wstępnej (flaga premium), bo bez niej F1+ nie pokażą realnej jakości.

**Rekomendowana kolejność:** F1 → F2 → F3 → F4 → (F5–F10). Po każdej fazie: deploy demo → odbiór Piotra (→F/→UI) → następna. Zero przeskoków.

## Sposób pracy
Commity chirurgiczne na `deliverables/`+`KimiWorkspace/`+`ReportsAndPresentations/`+`navigation/`. Flaga OFF=byte-identyczne. Deploy: merge feat→demo (worktree) → Railway → weryfikacja żywa (re-login) → prod osobno (zgoda). Aktualizuję ten plik po każdym tasku (⬜→🟡→✅).
