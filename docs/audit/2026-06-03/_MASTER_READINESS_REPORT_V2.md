# Consultify — Master Readiness Report v2 (2026-06-03)

**Zakres:** pełny re‑audyt po fali implementacji (Wave 1+2+fast‑follow+cross‑cutting). 18 modułów w zakresie + 3 audyty przekrojowe (UI/UX, przepływy, engineering). Metoda jak v1: 1 agent / moduł, weryfikacja realnego kodu (nie dokumentów), dowody `plik:linia`.
**Porównanie:** baseline = `docs/audit/2026-06-02/` (śr. ~51/100).

---

## 1. Werdykt
**Średnia gotowość: ~73/100 (było 51, +22).** Skok ogromny: wszystkie moduły w zakresie ruszyły o +11…+44. Backend był mocny już wcześniej — teraz **warstwa produktowa jest realnie wpięta** (mocki/stuby usunięte, ścieżki odsłonięte, dane Atelier spójne). Pozostały **trzy klasy długu**: (A) **UI/UX stabilizacja** (kolory/shell — Twój ból #1, tylko częściowo ruszony, miejscami regres), (B) **kilka zepsutych handoffów + dialekt SQL/migracje** (ryzyko na świeżym Postgresie/SQLite), (C) **CI: testy istnieją, ale glob ich nie uruchamia**.

---

## 2. Tablica gotowości (v2)

| # | Moduł | v1 | **v2** | Δ | Tier |
|---|---|:--:|:--:|:--:|---|
| 01 | Czat / Teresa | 68 | **84** | +16 | RC |
| 03 | Wywiad | 72 | **84** | +12 | RC |
| 12 | Prezentacje | 62 | **79** | +17 | Beta+ |
| 16 | Organizacja | 68 | **79** | +11 | Beta+ |
| 09 | Outputs | 62 | **78** | +16 | RC |
| 11 | Tabele | 42 | **77** | +35 | Beta |
| 18 | Ustawienia | 72 | **76** | +4 | Beta |
| 05 | Inicjatywy | 58 | **74** | +16 | Beta |
| 08b | Model finansowy | (42) | **74** | — | Beta |
| 07 | Rezultaty | 52 | **72** | +20 | Beta |
| 13 | Meeting | 28 | **72** | +44 | Beta+ |
| 06 | Realizacja | 52 | **71** | +19 | Beta |
| 10 | Dokumenty | 52 | **71** | +19 | Beta |
| 19 | Partner (MVP) | 48 | **69** | +21 | Beta |
| 02 | Moja Praca | 57 | **68** | +11 | Beta |
| 17 | Panel Admina | 38 | **67** | +29 | Beta |
| 04 | Narzędzia | 52 | **65** | +13 | Beta |
| 08 | Finanse/billing | 42 | **59** | +17 | Beta (Stripe odłożony D8) |

Poza zakresem: 14 IRIS / 15 Marketplace (wyrzucone, D7). Najwyżej: **Czat 84, Wywiad 84**. Najniżej: **Finanse 59, Narzędzia 65, Admin 67**.

---

## 3. Przepływy (door → spine → output)
Wejścia **Czat / Wywiad / Tools / Assessment** mają wpięte handoffy do spine'u; deep‑linki (`/wordy`, `/excele`, `/prezentacje`, `/roadmap`, `/context`, `/kpi-okr`, `/rollout`) rozwiązują się poprawnie. **Zepsute handoffy do naprawy:**

| Handoff | Status | Dowód |
|---|---|---|
| Execution → Results | ❌ BRAK CTA | `ExecutionHub.tsx` zero ref. do `/benefits` |
| Finance → Initiative | ❌ 404 | `InitiativeLinkingPanel.tsx:269` `/initiatives/${id}` — route niezadeklarowany (tylko `/initiatives` exact) → wpada w `*`→`/chat` |
| Finance export → Initiative | ❌ gubi kontekst | `FinancialModelWorkspace.tsx:711` nie przekazuje `relatedInitiativeIds` |
| Results → Outputs | ❌ BRAK CTA | brak „Publish to Outputs" |
| GapAnalysis → generate | ❌ orphan 404 | `GapAnalysisDashboard.tsx:59` POST `/api/initiatives/generate-from-assessments` (route nie istnieje) |
| Insights→Initiatives, Tools→Initiatives, Canvas→Outputs, Initiatives→Results CTA | ✅ wpięte | — |

Plus: ~30 lazy‑widoków używa gołego `React.lazy` bez retry (ryzyko zawisu Suspense przy fail chunku — m.in. źródło spinnerów).

---

## 4. UI/UX — stabilizacja (ocena **C**, było D)
**Wygrane:** śmieci `" 2"` usunięte, forki `Admin/shared/Button|Card` zwinięte do adapterów, **guardraile ESLint aktywne** (warn na inline‑style/hex/arbitrary‑bg), tokeny crimson/serif/radius **zdefiniowane**.
**Regresy (nowy kod fali pisany w defaultach Tailwinda, nie w tokenach):** `slate-*` 36 366 → **45 696 (+9 330)**; inline `style={{}}` 1 288 → **1 451**; `bg-[#…]` 34 → **45**. crimson użyte 79× vs `primary-600/700/800` **3 846×** (token istnieje, ale nie jest domyślny).
**Nieruszone:** **8 widoków na SplitLayout** (MyWorkView, ExecutiveView, LeadershipDashboardView, InterviewView, StudioView, UserDashboardView, ImplementationView, ProjectIntelligenceView) + 4 lane'y Kimi; prymitywy stanów użyte ~2,3% (1 680 ręcznych spinnerów); tokeny radius/shadow/serif użyte 0×.
→ **To jest dokładnie zakres wspólnej sesji wizualnej (X1):** flip `primary-*`→`crimson-*` w nawigacji+nagłówkach, potem `MyWorkView` jako wzorcowa migracja SplitLayout→ModuleHub, sweep `slate→navy`.

---

## 5. Engineering health — top ryzyka
- 🔴 **KRYTYCZNE — dryf migracji (świeży Postgres):** runner `/^(7\d{2}|\d{8})_/` pomija 446 z ~700 plików; `900_prod_missing_tables_hotfix.sql` łata 57, ale **~138 z 195 osieroconych tabel nadal nie powstaje** na świeżej bazie. **Dobra wiadomość:** wszystkie 9 migracji fali (date‑prefix `2026…`) **są stosowane** — brak nowego regresu. → konieczna migracja konsolidująca (draft gotowy: `docs/db/DRAFT_schema_bootstrap_consolidation.sql`), zwalidować na realnym PG.
- 🔴 **Bezpieczeństwo (NOWE):** `admin-data.routes.ts` ma `verifyToken` globalnie, ale **brak guardu roli** na PUT/DELETE (linie 94/264/484/776/863) → **każdy zalogowany user może mutować dane admina**. (zgłoszone jako task)
- 🟠 **Dialekt SQL:** **477× `NOW()`**, 12× `LEFT JOIN LATERAL` (3 w nowym `benefits.routes.ts`), 58× casty `::`, 23× `ILIKE` — działa na Postgresie (staging/prod), ale **pada na SQLite** (test/dev path). Portability + ryzyko testów.
- 🟠 **Server build `tsc --noCheck`** — ~4 543 błędy typów lecą cicho na Railway.
- 🟠 **CI nie uruchamia testów komponentów** — glob include nie łapie części `tests/unit/components` → smoke‑testy, które dodałem, **przechodzą lokalnie, ale CI ich nie odpala**. Plus padający selektor E2E initiative‑wizard + timeout finance lane.
- 🟠 **Perf N+1:** `my-work.routes.ts:1398` (inbox) 8–9 sekwencyjnych `await` bez `Promise.all` → ~1,4s; Redis client errors w logu.
**Poprawy:** frontend `@ts-nocheck` **207 → 5**; `api.test` 5 fail → **0**; debris `" 2"` usunięte; CI lint zielony.

---

## 6. Najpilniejsze do naprawy (P0/P1, konkret)
1. **`vite.config.ts:48`** — usunąć martwy `'./src/views/AIChatWelcomeView.tsx'` z warmup (to ON powoduje pre‑transform error w dev — Twój bug). *(quick)*
2. **`admin-data.routes.ts`** — dodać guard roli (admin) na PUT/DELETE. *(security)*
3. **Tasks** — backend filtruje `task_type='personal'`, realne zadania mają default `'execution'` → 0 wyników; dodać backfill/rozszerzyć filtr. (mod 02)
4. **4 zepsute handoffy** z §3 (Execution→Results, Finance→Initiative 404, Finance export, Results→Outputs).
5. **`rollout.routes.ts` NOW()** + `benefits.routes.ts` LATERAL — działa na PG, ale ujednolicić pod portability/testy.
6. **CI test glob** — dopiąć `tests/unit/components/**` do include vitest, żeby smoke‑testy realnie się uruchamiały.
7. **Migracja konsolidująca** 138 tabel — walidacja na staging (RAZEM).

---

## 7. Co dalej (sekwencja do GA)
- **Quick fixes (solo, dziś):** §6 p.1 (vite), p.2 (admin guard), p.6 (CI glob), p.3 (Tasks filtr), p.4 (handoffy — drobne route/CTA).
- **RAZEM (sesja):** §4 UI/UX wizualne (crimson flip + SplitLayout→ModuleHub + slate sweep) · §5 walidacja migracji konsolidującej na realnym PG · podłączenia (Railway key, Stripe gdy gotowe).
- **Osobny program:** server type‑safety (4,5k), dialekt SQL portability, perf N+1, dokończenie stubów (generator LLM, invitation SMTP, document prose default‑on).

**Załączniki:** `MODULE_01..19_*.md`, `MODULE_08b_*`, `CROSS_UI_CONSISTENCY.md`, `CROSS_FLOWS_NAVIGATION.md`, `CROSS_ENGINEERING_HEALTH.md`, `schema-bootstrap-orphans.md` (wszystko w `docs/audit/2026-06-03/`).
