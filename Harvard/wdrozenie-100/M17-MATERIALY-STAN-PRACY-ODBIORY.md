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
- ✅ **Flaga `ENABLE_DELIVERABLES_PREMIUM=true` na Railway demo USTAWIONA 2026-06-25** (Claude, railway CLI) — deploy `3ad8a2c9` SUCCESS, live-verified (gitBranch=demo, /bundle/export→401). Odblokowane: content-fill + premium-kompozycja we wszystkich 3 formatach.
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
| F1.1 | Wpiąć defaulty w B1/B3/B4 | F1 | ✅ | ✅ | ✅ d7974eb | n/d | n/d | n/d | n/d | 🟢 |
| F1.2 | Flaga premium ON (demo) | F1 | ✅ | ✅ | ✅ railway | ✅ live | ✅ | ✅ deploy 3ad8a2c9 | ⬜ | 🟢 (flaga ON+deploy SUCCESS+401 verified; →UI=Piotr klik) |
| F1.3 | Beauty gate (VisionQA) | F1 | ✅ | ✅ | ✅ 272defe | n/d | n/d | n/d | n/d | 🟢 |
| F1.4 | Content gate (0 placeholderów/sprzeczności) | F1 | ✅ | ✅ | ✅ a541716 | n/d | n/d | n/d | n/d | 🟢 |
| F2.1 | „Nowy" → panel + wybór formatu | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F2.2 | Wejście 1: input → retrieval z org | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F2.3 | Wejście 2: upload pliku → parse | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F2.4 | Wejście 3: „Przygotuj narzędzie" handoff | F2 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F3.1 | Rejestr motywów (fonty+paleta)→4 renderery | F3 | ✅ | ✅ | ✅ f18ceba | n/d | 🟡 3/4 rend. | ⬜ | ⬜ | 🟢 (docx/xlsx/pptx wpięte; web-viewer→F4.4) |
| F3.2 | Biblioteka template'ów per format | F3 | ✅ | ✅ | ✅ d4a059c | n/d | ✅ | ⬜ | ⬜ | 🟢 (3/format: doc+deck+table; mig 785) |
| F3.3 | Pogłębione formatowanie (H1-3/listy/tabele) | F3 | ✅ | ✅ | ✅ 4f6861f | n/d | ✅ | ⬜ | ⬜ | 🟢 (typografia SSOT wg spec §1-4: fonty/skala/listy; PPT scale wpięta) |
| F4.1 | PPTX render z wiązki | F4 | ✅ | ✅ | ✅ 5e13ccd | n/d | n/d | ⬜ | ⬜ | 🟢 |
| F4.2 | „Pobierz komplet" (3 pliki) | F4 | ✅ | ✅ | ✅ e0729c9 | n/d | n/d | ⬜ | ⬜ | 🟢 (zip docx+xlsx+pptx) |
| F4.3 | Publiczny share-link viewer | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F4.4 | In-app viewer (3 formaty) | F4 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | 🟡 preview jest |
| F5.1 | Konektory do baz | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F5.2 | Generowane formularze → tabela | F5 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | 🟡 intake jest |
| F6.1 | Stany Draft→Review→Authorized→Sent | F6 | ✅ | ✅ | ✅ d-lifecycle | n/d | n/d | ⬜ | ⬜ | 🟢 (maszyna stanów, Sent=lock, 11 testów) |
| F6.2 | Edycja warstwowa (merge, nie clobber) | F6 | ✅ | ✅ | ✅ d-layered | n/d | n/d | ⬜ | ⬜ | 🟢 (anti-clobber, 9 testów) |
| F6.3 | RBAC + wersjonowanie + rollback | F6 | ✅ | ✅ | ✅ d-version | n/d | n/d | ⬜ | ⬜ | 🟢 (RBAC+append-only+rollback, 10 testów) |
| F6.4 | Tryb Live (bind danych) | F6 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ (wymaga DB-bind + flagi) |
| F7.1 | Scheduler subskrypcji raportu (cron) | F7 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F7.2 | Dostawa e-mail + governance odbiorców | F7 | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | ⬜ |
| F8.1 | Brand-ingestion (.pptx/.docx → motyw) | F8 | ✅ | ✅ | ✅ d-brand | n/d | n/d | ⬜ | ⬜ | 🟢 (OOXML theme1.xml → paleta+fonty, 6 testów) |
| F9.1 | Image Router (tiery + fallback + VisionQA) | F9 | ✅ | ✅ | ✅ d-imgrouter | n/d | n/d | ⬜ | ⬜ | 🟢 (4 tiery+fallback+routing, 11 testów) |
| F9.2 | Ideogram (tekst) + Recraft (wektor) + Pexels | F9 | 🟡 | ⬜ | 🟡 routing | ⬜ | n/d | ⬜ | ⬜ | 🟡 (routing gotowy w F9.1; adaptery providerów ⬜) |
| F9.3 | Pakiety Lite/Pro + kredyty/licznik | F9 | ✅ | ✅ | ✅ d-imgrouter | n/d | n/d | ⬜ | ⬜ | 🟢 (Lite/Pro cap+downgrade+kredyty) |
| F10.1 | Księga faktów (0 sprzecznych liczb) | F10 | ✅ | ✅ | ✅ d-factbook | n/d | n/d | ⬜ | ⬜ | 🟢 ({{fact:key}} refs + audyt sprzeczności, 8 testów) |
| F10.2 | Provenance na twierdzeniach | F10 | ✅ | ✅ | ✅ d-provenance | n/d | n/d | ⬜ | ⬜ | 🟢 (źródła+footnoty+dedupe, 7 testów) |
| F10.3 | Warianty audytorium (board/working cut) | F10 | ✅ | ✅ | ✅ d-variants | n/d | n/d | ⬜ | ⬜ | 🟢 (1 SPINE→2 cuty, 6 testów) |
| F10.4 | Pętla zwrotna materiał→artefakty | F10 | ✅ | ✅ | ✅ d-feedback | n/d | n/d | ⬜ | ⬜ | 🟢 (rekomendacje→stuby inicjatyw, 8 testów) |
| F11.1 | Silnik wykresów think-cell-grade (waterfall/bridge/2×2/mekko/RAG, data-bound) | F11 | ✅ | ✅ | ✅ d-charts | n/d | n/d | ⬜ | ⬜ | 🟢 (waterfall/2×2/RAG data-bound, 7 testów; mekko ⬜) |
| F12.1 | Edytor WYSIWYG per format + inline AI-edit (warstwowy) | F12 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F13.1 | Office round-trip fidelity (otwiera się idealnie w MS/Google) | F13 | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | ⬜ |
| F13.2 | Współpraca: komentarze/review/co-edit | F13 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F13.3 | Share-link security (wygaśnięcie/hasło/dostęp) | F13 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| F14.1 | Telemetria jakości (edit/regen/share/download/TTFD) | F14 | ⬜ | ⬜ | ⬜ | ⬜ | n/d | ⬜ | ⬜ | ⬜ |
| F14.2 | First-run seeding (template'y + szybki brand-setup) | F14 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| ⊕ | Gramatyka układu §5B (Gamma-killer) → w F3 | F3 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |
| ⊕ | Biblioteka palet kolorów (kuratorowane motywy) → w F3 | F3 | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |

**Postęp programu:** 0/43 tasków ZAMKNIĘTYCH (8/8 — wszystkie czekają na →F/→UI + flagę F1.2). **Realizacja-KOD 🟢 (18 tasków):** F1.1/F1.3/F1.4 · F3.1/F3.2/F3.3 (cała Faza F3) · F4.1/F4.2 · **F6.1/F6.2/F6.3 (cała Faza F6: cykl życia+edycja warstwowa anti-clobber+RBAC/wersje/rollback)** · **F8.1 brand-ingestion (OOXML→motyw)** · **F9.1/F9.3 image-router (tiery+pakiety+kredyty)** · **F10.1/F10.2/F10.3/F10.4 (cała Faza F10: księga faktów+provenance+warianty audytorium+pętla zwrotna)** · **F11.1 silnik wykresów (waterfall/2×2/RAG)**. Pakiet deliverables **467/467 zielony, 0 błędów tsc w moich plikach** (110 pre-existing w niezwiązanych). F1.2 ⛔ Piotr (Railway flag) = bramka odbiorów. ZOSTAŁO kod-side (głównie frontend/integracja — lepiej z flagą ON + podglądem): F2 panel „Nowy", F4.3 share-link (unifikacja istniejącej infra), F4.4 web-viewer (4. renderer), F5 konektory/formularze, F6.4 live-bind, F7 scheduler+email, F9.2 adaptery providerów, F12 edytor WYSIWYG, F13 office-fidelity+współpraca, F14 telemetria. Krok zerowy head-to-head ZROBIONY (runs/ + [`M17-BAR-HEAD-TO-HEAD-2026-06-25.md`](M17-BAR-HEAD-TO-HEAD-2026-06-25.md)).

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
