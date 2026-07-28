# ⭐ START HERE — Plan domknięcia systemu dokumentacji Consultify (= program „Materiały" / M17)

> **Jesteś zagubiony? Przeczytaj to.** Ten plik mówi: o czym jest projekt, gdzie są dokumenty, jaki jest stan, co robić dalej. Branch: `feat/deliverables-w1`. Deploy odbioru: demo.consultify.ai.

## 1. O czym to jest (jednym akapitem)
Budujemy **„plan domknięcia systemu dokumentacji Consultify"** — czyli program **„Materiały" (M17)**: scalenie 4 osobnych modułów (Outputs/Documents/Presentations/Tables = M17–M20) w **JEDEN moduł „Materiały"** = biblioteka utworzonych materiałów + przycisk „Nowy" → tworzenie deck/raport/tabela z briefu, zasilane **artefaktami** (insighty/inicjatywy/decyzje/KPI/notatki). Cel: jakość i **piękno** klasy najlepszego konsultanta świata — bo *to, jak prezentujemy wyniki, decyduje, czy klienci płacą faktury.* To kluczowy obszar konsorcjum AI.

## 2. Dokumenty (KOLEJNOŚĆ CZYTANIA — to jest „plan i raport", o który pytasz)
0. **`docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md`** ← obowiązujący kanon decyzji dla Materialow i szablonow.
0a. **`docs/product/MATERIALS_RESUSCITATION_PROGRAM_2026-07-24.md`** ← kolejnosc wykonania, bramki i Definition of Done dla programu scalania.
0b. **`docs/product/MATERIALS_R0_ARCHITECT_DECISIONS_2026-07-24.md`** ← rozstrzygniecia po audycie R0 i skorygowany zakres R1.
1. **`Harvard/wdrozenie-100/M17-MATERIALY-HANDOFF.md`** ← historyczny master: pelny kontekst, plan i material odbiorowy.
2. **`Harvard/wdrozenie-100/M17-MATERIALY-PLAN.md`** — fazy → taski → tabele (DoD/epiki/testy/UI).
3. **`Harvard/wdrozenie-100/M17-MATERIALY-STAN-PRACY-ODBIORY.md`** — DASHBOARD tracking (43 taski × 8 bramek, ⬜🟡✅). **Tu odhaczasz postęp.**
4. `docs/product/DOCUMENTATION_SYSTEM_COMPLETION_PLAN.md` — wcześniejszy plan domknięcia (fazy F0-F5, kontekst luk).
5. `docs/product/MATERIALS_MODULE_MASTER_SPEC.md` + `DELIVERABLE_FORMATTING_SPEC.md` + `BUSINESS_PLAN_GENERATOR_SPEC.md` — system/typografia/silnik.
6. Pamięć: `project_materialy_program` (breadcrumb) + `finding_baseclient_20s_timeout`.

## 3. Stan na teraz (2026-06-25) — co JUŻ zrobione (kod 🟢, czeka odbiór →F/→UI + flaga)
- **F0** ✅ konsolidacja sidebara 4→1, założenia startowe `deliverableDefaults.ts`, backbone wiązki (SPINE→B4/B3/B1), fixy żywe (timeout materialize 20s→120s, deck 4→10, Table generuje, czyste tytuły), eksport DOCX/XLSX.
- **F1.1** (`d7974eb`) defaulty wpięte w B1/B3/B4 + enforceMinDistinctLayouts(8) · **F1.3** (`272defe`) deck beauty-gate (VisionQA) · **F1.4** (`a541716`) content-gate (placeholder-scan + hero-number consistency).
- **F3.1** (`f4ab667`+`f18ceba`) themeRegistry SSOT (5 motywów/10 fontów) → wpięty w DOCX+XLSX+PPTX · **F3.2** (`d4a059c7`) ≥3 kuratorowane template'y/format.
- **F4.1** (`5e13ccd`) deck plans→realny .pptx themed · **F4.2** (`e0729c9`) „Pobierz komplet" = teczka ZIP (docx+xlsx+pptx) + route `/bundle/export`.
- **Pakiet deliverables 379/379 testów zielony, tsc czysty.**

## 4. Co ZOSTAŁO (kolejka)
- **Kod-side:** F3.3 (pogłębione formatowanie H1-3/listy/tabele w rendererach) · F4.3 (publiczny share-link viewer) · F4.4 (web-viewer = 4. renderer motywu) · F2 (panel „Nowy" + 3 wejścia kontekstu) · F5–F14 (dane/cykl-życia/harmonogram/brand/obrazy-router/inteligencja + 6 insightów: F11 wykresy think-cell, F12 edytor, F13 office-fidelity+współpraca+share-security, F14 telemetria+seeding).
- **⛔ Bloker jakości (Piotr):** flip `ENABLE_DELIVERABLES_PREMIUM=true` na Railway demo. Bez tego user widzi placeholdery zamiast realnej treści.

## 5. CO ROBIĆ DALEJ (twoje następne kroki)
1. **Przeczytaj** §2 docs (HANDOFF→PLAN→STAN-PRACY). Sprawdź `git log origin/feat/deliverables-w1`.
2. **Krok zerowy = head-to-head** (HANDOFF §11): nasz deck/raport/tabela (premium) OBOK Gammy/Worda/Airtable na realnym temacie (VTS/Apator) → ustal **mierzalny bar piękna**. NIE buduj szeroko bez bara.
3. **Poproś Piotra** o flip flagi premium (§4).
4. **Realizuj fazami** wg trackera: następne ⬜ taski (F3.3 → F4.3/F4.4 → F2 → F5+). Każdy task: kod+test+tsc → **commit NATYCHMIAST** → merge feat→demo → deploy → odbiór Piotra → odhacz w STAN-PRACY.

## 6. Zasady twarde
- **Branch `feat/deliverables-w1` WSPÓŁDZIELONY** (inni agenci: M16/finance, M15, USPOJNIENIE). **Git races realne** — cudza sesja potrafi zmieść Twoje NIEZACOMMITOWANE edycje. **ZASADA: commituj każdy task natychmiast po zielonych testach, nie zostawiaj dużych uncommitted zmian.** Przy konflikcie cudzego kodu — nie ruszaj, commituj przez izolowany `git worktree` z `origin/feat`.
- Flaga premium OFF = byte-identyczne (klienci nietknięci). **PROD (centerbeam) nietknięty bez osobnej zgody.** Deploy: merge feat→demo (worktree)→Railway.
- Harnessy PROD-safe (DOTENV_IGNORE_LOCAL=1 + SKIP_DB_INIT=1 + DATABASE_URL→staging). `tests/` gitignored → `git add -f`. CI tylko `tests/{unit,integration,components}`.
- Teresa = jedyny czat (zero dodatkowych czatów w studiach). „Brzydkich rzeczy nikt nie czyta" = bramka piękna na każdym tasku.
