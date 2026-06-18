# 📋 HANDOFF — Consultify UI/UX — audyt wizualny CAŁEJ aplikacji (2026-06-17)

> **Dla następnego agenta.** Słowa-klucze do wyszukania: **consultify UI, audyt wizualny, dokumentacja 2026-06-17, visual QA, SCREEN_REVIEW_TABLE, VIS-001..019, handoff UI.**
> Ten plik = punkt wejścia. Czytaj go PIERWSZY, potem 2 pliki SSOT (niżej). Sesja zakończona bo Piotrowi skończył się tygodniowy limit tokenów (przerwa ~4 dni). Praca jest w połowie: **audyt KOMPLETNY, fixy NIE rozpoczęte.**

---

## 1. Co zostało zrobione w tej sesji (2026-06-17)

**Cel programu** (decyzja Piotra): doprowadzić Consultify do „SaaS Enterprise 2026, Apple/Google quality, mniej znaczy więcej". Model pracy: **katalog → zasady → przebudowa per-obszar** (audyt PRZED fixami, żeby nie tracić kontekstu).

**Ta sesja domknęła AUDYT WIZUALNY CAŁEJ APLIKACJI** — wszystkie 19 modułów lewego railu (14 góra + 5 dół) + ich funkcje. Wcześniejsze sesje pokryły moduły do-KPI (#01–29) i częściowo below-KPI; **ta sesja dodała:**

1. **Below-KPI per-funkcja (#30–47)** — dograne 1 zrzut/funkcja (light+dark): Finance (6 funkcji), Documents (4), Presentation/Table Studio, Meeting, Audits, Document Studio. Skrypt: `docs/qa/capture-belowkpi.mjs`.
2. **Admin-tier (#48–53)** — pierwotnie POZA scope (decyzja A1 „nie gotowe"), zaudytowane na żądanie „cały audyt": Organization, Admin Panel, Internal Tools, Settings (~40 sekcji), Partner Portal (~30 sekcji). Skrypt: `docs/qa/capture-admin.mjs` (68 zrzutów). **To była brakująca część — dolny rail nigdy wcześniej nie był capturowany.**
3. **5 nowych findingów** `VIS-014..018` + 1 `VIS-019`; wzmocnienie systemowe `VIS-009` i `VIS-014` (oba → fix TOKENOWY).
4. Zaktualizowane oba SSOT + ten handoff.

**Status: AUDYT KOMPLETNY (#01–53). FIXY NIEROZPOCZĘTE.** Następny etap = całościowe poprawki wg listy akcji.

---

## 2. SSOT — gdzie jest cała wiedza (czytaj w tej kolejności)

| Plik | Co zawiera |
|---|---|
| **`docs/qa/SCREEN_REVIEW_TABLE.md`** | **GŁÓWNA tabela audytu #01–53** — per-ekran/per-funkcja odchyłki od kanonu + **🎯 SKONSOLIDOWANA LISTA AKCJI** (priorytet P0→P3 z loci). To jest mapa „co naprawić". |
| **`docs/qa/MASTER_VISUAL_QA_CATALOG.md`** | Katalog findingów **VIS-001..019** (opis + locus + decyzja per finding) + mapa RECONNECT root-cause dla komponentów współdzielonych. |
| **`docs/qa/VISUAL_QUALITY_SPRINT_PLAN.md`** | Plan faz A (inwentarz ✅) / B (reguły ✅) / C (przebudowa per-obszar C0+C1-C9 — DO ZROBIENIA). |
| **`docs/ui-standards/CANON.md`** | JEDEN żelazny kanon UI/UX (jedyny autorytet). Wszystkie findingi mierzone względem niego. |
| **`docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`** | Kanon tabel + preview + §27 (per-tabela checklist). |

**Zrzuty (archiwum):** `docs/qa/screens/{moduł}/{funkcja}-{light|dark}.png` — ~170 zrzutów. Default-light/dark = wiarygodne; per-sekcja admin = sample (patrz §6 caveat).

---

## 3. ⚠️ AUTH dla headless capture — KRYTYCZNE, nie powtarzaj mojego błędu

Headless Playwright potrzebuje tokenu JWT. **Działający przepływ (NIE proś Piotra o wklejanie tokenu):**

1. `preview_start` z `name: frontend-dev` → serwer na :3000 (to jest MANDATED sposób; **NIGDY nie odpalaj dev-serwera przez Bash** — psuje integrację preview-browser).
2. Token bierzesz z **zalogowanej Chrome Piotra** przez Chrome-MCP:
   - `mcp__Claude_in_Chrome__list_connected_browsers` → weź `deviceId`
   - `select_browser` → `navigate` do `http://localhost:3000/` → `javascript_tool` (action=`javascript_exec`): `localStorage.getItem('token')` + `consultify_current_org_id` + `consultify_anon_id`
3. Zapisz do `/tmp/consultify-auth.json` w formacie: `{"token":"...","consultify_current_org_id":"...","consultify_anon_id":"..."}`
4. Skrypty capture czytają ten plik i wstrzykują przez `addInitScript`.

**Token żyje ~8h, /tmp bywa czyszczony.** Jak wygaśnie — powtórz krok 2 (Piotr musi być zalogowany w swojej Chrome). **Token NIGDY do repo** (`/tmp` only, gitignored).

Backend: `preview_start backend-dev` (port 3001, dev:backend:staging). **Uwaga: dev backend bije w Railway PROD/staging DB** — patrz reguły bezpieczeństwa §7.

---

## 4. Skrypty capture/discovery (wszystkie w `docs/qa/*.mjs`)

| Skrypt | Funkcja | Jak odpalić |
|---|---|---|
| `capture-screens.mjs` | pełne archiwum wszystkich modułów × pod-zakładki × light/dark (MANIFEST w środku) | `node docs/qa/capture-screens.mjs` |
| `capture-belowkpi.mjs` | tylko below-KPI pod-zakładki (Finance/Documents/Studia/Meeting) | `node docs/qa/capture-belowkpi.mjs` |
| `capture-admin.mjs` | admin-tier (Organization/Admin/Internal/Settings/Partner) + sekcje | `node docs/qa/capture-admin.mjs` |
| `discover-tabs.mjs` | wypisz pod-zakładki below-KPI modułów (do MANIFESTU) | `node docs/qa/discover-tabs.mjs` |
| `discover-rail.mjs` | enumeruj WSZYSTKIE przyciski lewego railu (góra+dół) | `node docs/qa/discover-rail.mjs` |
| `discover-admin.mjs` | wypisz sekcje lewego sub-navu admin-tier modułów | `node docs/qa/discover-admin.mjs` |

**Metoda nawigacji:** rail-moduły top = `nav button[title="X"]`; admin-tier (dolny rail) = **page-wide** `button[title="X"]` (są POZA `<nav>`); pod-zakładki = `main getByRole button/tab name=X`.

**Metoda audytu (kluczowe, z `rule_verify_before_claiming`):** AI proponuje z obrazu → **ZMIERZ** (`preview_eval` getComputedStyle / live DOM) → potwierdź/odrzuć. W tej sesji pomiar/weryfikacja na żywo ubił **2 fałszywe P1** (Admin „pusty ekran" = timing >5s, nie bug; „blank" przez headless-timing). NIE raportuj wizualnie bez pomiaru.

---

## 5. WSZYSTKIE findingi (VIS-001..019) — pełna lista do naprawy

### Priorytet do roboty (ze SCREEN_REVIEW_TABLE „Skonsolidowana lista akcji")
- 🔴 **P0** `VIS-013` — **My Work Inbox CRASH** przy kliknięciu wiersza (preview). Przyczyna ≠ PreviewRelations (guarded) → wymaga **żywego stack-trace**. Locus: ścieżka Inbox-preview. Ekran #04.
- 🟠 **P1** `VIS-001` — badge danger w light gubi fill. Locus: `src/components/MyWork/shared/PMOPriorityBadge.tsx` (per-komponent, NIE globalny). #06/#07/#09.
- 🟠 **P1-design** `VIS-012` — „Canonical Path" notatnika zajmuje ~40% kanwy → odchudzić wg `Harvard/SPEC_ZADANIE_07_notebook_workspace.md` (slim chip). Locus: `src/components/MyWork/notebook/NotebookCanonicalPathStrip.tsx`. #03.
- 🟠 **P1-func** `VIS-016` — **Meeting: „Failed to load meetings"** (fetch pada). Zweryfikować env-specyficzne (backend staging) vs realny bug. #44.
- 🟡 **P2-perf** `VIS-019` — Admin Panel ładuje się >5s (pusty ekran) → skeleton/loading. #49.

### Fixy TOKENOWE (największy zysk, najmniej ryzyka — naprawiają wiele ekranów naraz)
- 🟡 **P2** `VIS-009` — **selekcja crimson/rose → neutral/blue. Wzorzec WSZĘDZIE** (tabele, Settings-nav, radio języka, karty szablonów Presentation Studio). **Fix tokenowy**, nie per-komponent. Start: `src/components/MyWork/MyTasksListContent.tsx:123` (`TASK_SELECTED_ROW_CLASS`) + `RowColoringConfig.tsx`. #02/#06/#07/#40/#51.
- 🟡 **P2-color** `VIS-014` — **CTA fioletowy spoza palety, cross-module** (Finance „+ New model/analysis/..." + Admin „Generate code"). Niespójny z crimson. → token palety (crimson/navy). #31–35, #49.
- 🟡 **P2** `VIS-006` — primary-CTA crimson vs navy niespójne (Tools/Initiatives crimson vs Execution/My Work navy). #15/#19/#20 vs #08/#21/#26.

### P2/P3 reszta
- 🟡 **P2-i18n** `VIS-018` — mix PL/EN (Finance + Documents). Najgorsze: Finance „Analiza inwestycyjna" (#35) — breadcrumb „Investment" EN ↔ tab PL ↔ CTA „Nowy case inwestycyjny" Polglish ↔ treść EN + hint ALL-CAPS zdaniem (łamie typografię).
- 🟡 **P2** `VIS-015` — Finance pasek chipów przeładowany (10+) + **nie-scoped** (te same liczniki na każdej zakładce mimo 0 rekordów; „Linkages 01" zero-pad, „Gate pass 100%"). #30/#34.
- 🟡 **P2-data** `VIS-017` — Presentation Studio **zduplikowane szablony** (Assessment ×3, Tool Workshop ×3, Steering ×3) → deduplikacja seed. #40.
- 🟡 **P2** `VIS-003` composer Chat pustka · Calendar eventy bez kodowania source.
- 🔵 **P3** `VIS-005` progress indigo→info-blue · `VIS-010` preview/KPI truncate tytułu · Partner crimson-band + format waluty (EUR 250 vs €0).
- 🔝 `VIS-011` (P1, SYSTEMIC #1) — **PREVIEW standaryzacja** (kształt + stopka + Open + kolory). Locus: `src/components/shared/PreviewPane/{previewStyles.ts, PreviewActionBar, PreviewRelations.tsx}` + `MyWork/table/RowDetailPanel.tsx`. `PreviewActionBar` ma 22 użycia — audyt parytetu które tabele go NIE używają.

### ⚪ VERIFY przed ruszeniem (zmierzyć źródło — aging/link intencjonalny vs leak)
crimson na: Reasoning/cytaty (#01), Insights „Expires" (#13), KPI „Initiative" (#26), Calendar today (#05).

### ❌ ODRZUCONE pomiarem (NIE bug — verify-before-claiming uratował)
`VIS-002` crimson-daty = `AGING_STYLES` INTENCJONALNE (fresh→emerald/warm→amber/critical→rose, `InboxContent.tsx:676`); `VIS-008` Execution separatory = loading-state; KPI „Initiative" crimson = cross-theme link=primary styling (nie light-leak); Admin „pusty" = timing >5s.

---

## 6. Stan modułów — mapa pokrycia (#01–53)

| Tier | # | Moduły | Stan |
|---|---|---|---|
| Do-KPI | #01–29 | Chat, My Work, Interview, Tools, Initiatives, Execution, Results | gruntownie, część zmierzona; findingi VIS-001..013 |
| Below-KPI | #30–47 | Finance(6), Documents(4), Presentation/Table Studio, Meeting, Audits, Document Studio | per-funkcja; VIS-014..018; **Table Studio = wzorzec 100% OK** |
| Admin-tier | #48–53 | Organization, Admin „Team Admin", Internal Tools(dev), Settings(~40 sekcji), Partner(~30 sekcji) | wszystkie **production-grade**; VIS-019; SuperAdmin niedostępny (isSuperAdmin:false) |

**Wzorce referencyjne (jak ma wyglądać dobrze):** Table Studio, Organization, Settings, Partner Portal — dopracowane.

**⚠️ Caveat capturze admin-tier:** labelowanie pojedynczych sekcji jest ZAWODNE (klik filtra trafiał w sąsiedni element → np. plik `settings/ai-automation-light.png` pokazuje „Language"). **Default-light/dark = wiarygodne; per-sekcja = sample, NIE 1:1.** Jeśli admin-tier wejdzie w priorytet → re-capture przez **nawigację po URL** (`/settings/profile`, `/settings/language`, `/partner/dashboard` itd. — sekcje to route'y), nie przez klikanie sub-navu.

---

## 7. Reguły bezpieczeństwa i pracy (PRZESTRZEGAJ — od Piotra)

- **Piotr = Product/Strategy, Claude = CTO** (robi CAŁĄ inżynierię + decyzje techniczne). Komunikacja PL. Miro-style UX.
- **`preview_start` (NIE Bash) do uruchamiania serwerów** — to MANDATED. Bash do serwera złamał integrację w tej sesji.
- **Verify-before-claiming:** każda zmiana UI → otwórz w preview, sprawdź wizualnie+logicznie, udowodnij screenshotem. NIGDY „done" na samym tsc/eslint.
- **PROD caution:** prod = `centerbeam` (Railway). Zmiany na prod ZAWSZE jawnie + osobne potwierdzenie; staging najpierw; **NIGDY deploy kodu na prod bez osobnej zgody**. Odróżniaj migrację-DB od deploy-kodu. Dev backend (:3001) bije w Railway PROD/staging DB — ostrożnie z zapisami.
- **Branch:** `Londyn` (working branch, współdzielony — inny agent robi chat/ai-router/M01-M04 → możliwe git races, weryfikuj HEAD). Commituj/pushuj tylko gdy Piotr poprosi.
- **Faza B (reguły) ustalenie:** `lint:colors` ODRZUCONY (kolor nie jest static-lintowalny) → ratchet koloru = visual sweep, nie linter. Motion = osobny tor `lint:motion`/`lint:motion:ci` + `.motion-baseline.json`.

---

## 8. Następny krok (od czego zacząć po przerwie)

Piotr ma wybrać kolejność (pytanie otwarte na koniec sesji):
1. **P0** `VIS-013` Inbox crash (blocker — wymaga żywego stack-trace) — **LUB**
2. **Fixy tokenowe NAJPIERW** (`VIS-009` selekcja + `VIS-014` fiolet-CTA) — jedno źródło, widoczny efekt na całej aplikacji, niskie ryzyko. **← rekomendacja CTO** (największy zysk/ryzyko).

Potem: P1 (Meeting load / badge-fill / Notebook strip) → P2 (i18n / chipy / duplikaty / composer) → P3.

**Wszystkie loci są gotowe w SCREEN_REVIEW_TABLE + MASTER_VISUAL_QA_CATALOG.** Zacznij od przeczytania tych dwóch plików + tego handoffu.

---

## 9. Pamięć trwała (auto-memory) — powiązane wpisy

Następny agent ma to w `MEMORY.md`. Kluczowe: `project_visual_quality_program` (ten program), `project_ui_canon_consolidation` (kanon), `rule_verify_before_claiming`, `feedback_prod_caution`, `finding_railway_db_topology`, `user_role`, `finding_landing_i18n_gaps` (kontekst i18n DE/ES/JP/AR).
