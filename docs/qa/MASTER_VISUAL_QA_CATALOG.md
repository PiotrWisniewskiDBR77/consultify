# MASTER Visual QA Catalog

> SSOT długu wizualnego. Findings `VIS-[nr]` z **obiektywnym pomiarem** (computed color/contrast), kanon-ref, severity, tag systemowy/lokalny.
> Sprint A1 (Faza A planu [VISUAL_QUALITY_SPRINT_PLAN.md](VISUAL_QUALITY_SPRINT_PLAN.md)). ZERO naprawiania — tylko spis.
> Metoda: AI proponuje z obrazu → **ZMIERZ** → potwierdź/odrzuć. Pomiar koryguje oko (patrz „odrzucone").

**Postęp sweepa:** **7/7 w-scope — A1 light sweep COMPLETE.** Scope (decyzja Piotra 2026-06-14): moduły sidebara **do poziomu KPI/Results**: Chat, My Work, Interview, Tools, Initiatives, Execution, Results. Moduły poniżej (Finance, Audits, Documents, Document/Presentation/Table Studio, Meeting) = **poza scope (nie gotowe)**. Light = oś priorytetowa.
**Legenda sev:** P0 broken · P1 czytelność/semantyka · P2 spójność · P3 polish.

---

## SYSTEMOWE (C0 — jeden fix czyści wiele obszarów)

### VIS-001 · Badge danger gubi fill w LIGHT · P1 · [SYSTEMIC]
W light tryb badge'e severity/status danger renderują się BEZ tła i bez koloru danger.
- **Pomiar:** My Work „Critical" → `bg=transparent, border=0px, text=slate-500`. Interview „44d overdue" → `bg=transparent, text=slate-900`.
- **Kanon:** light-mode-readability §5 — badge MUSI mieć tło(100)+border(200)+tekst-danger(800); §8 nie tylko kolor.
- **Skutek:** „Critical"/„overdue" w light wyglądają jak szary neutralny tekst — nie czytają się jako alarm.
- **Hipoteza root-cause:** współdzielony komponent badge ma warianty `dark:` bez odpowiednika light → fallback do neutralnego.
- **Dowód:** zrzuty My Work light, Interview light.

### VIS-002 · „Crimson leak" w LIGHT na treści neutralnej/info · P1 · [SYSTEMIC]
Elementy neutralne/informacyjne renderują się crimsonem (kolor dark-only → fallback).
- **Pomiar:** My Work daty „Received" → `rgb(145,10,40)` na **187 komórkach**. Chat cytaty/Reasoning → `rgb(109,20,39)`. Execution daty „Deadline" (05/05/20…) → crimson (3. moduł = mocno systemowy).
- **Kanon:** §2 (metadata=slate-500/600), CANON §0 budżet crimson (5 miejsc: logo, 2px indicator, Talk-to-Teresa, destructive, error).
- **Hipoteza root-cause:** współdzielony komponent komórki daty + markerów cytatów z klasą `text-primary-*`/dark-only.
- **Dowód:** zrzuty My Work light, Chat light.

### VIS-003 · Pusta otchłań composera · P2 · [SYSTEMIC]
Composer „Ask Teresa…" zajmuje ~40% wysokości jako pusty box (dark i light).
- **Kanon:** visual-language (gęstość/rytm, „mniej znaczy więcej" ≠ pustka).
- **Dowód:** zrzuty Chat dark+light.

---

## LOKALNE / per-moduł

### VIS-004 · [Chat] Bańka wiadomości usera crimson-tint · P3
- **Pomiar:** `bg=#FDF2F3` (różowy tint) + `text=#450C16` (ciemny crimson). Kontrast OK, ale crimson-tint dla wiadomości usera to pytanie o paletę (user msg ≠ brand).

### VIS-005 · [Interview] Progress „in-progress" indigo zamiast info-blue · P3
- **Pomiar:** bar 83% = `rgb(59,40,131)` (indigo) vs 100% = `rgb(2,104,51)` (`--c-success`, poprawny). In-progress powinien być `--c-info` (blue), nie indigo. Niespójność tokenów progresu.

### VIS-006 · Primary-CTA: crimson vs navy — niespójne między modułami · P2 · [SYSTEMIC]
- **Obserwacja (4 moduły):** CRIMSON: Tools „Add", Initiatives „New initiative". NAVY: My Work „Nowy X" (po T2), Results „+ Add KPI". Główny CTA modułu nie ma jednego koloru.
- **Kanon:** CANON §0 (budżet crimson) + T2 (primary = navy token). Trzeba JEDNĄ regułę: primary-CTA = navy token; crimson tylko Talk-to-Teresa/destructive.
- **Do potwierdzenia:** źródło crimson (`.backgroundColor`=transparent → gradient/wrapper; mierzyć `background-image`).

### VIS-007 · [My Work] Gęstość Menu 3 · P3
- **Obserwacja:** 8 chipów kontekstu + 3 scope + AI Triage. Rozważyć overflow/grupowanie (echo T6 V8-chip). Kanon TABLE_AND_PREVIEW §15.

### VIS-008 · [Execution] Wyblakłe separatory/tabela w light · P3 · [SUSPECT]
- **Obserwacja:** tabela Summary wygląda wyprana, separatory wierszy ledwo widoczne (light-mode-readability §3 — zakaz ultra-subtelnych borderów `*/10`).
- **Do potwierdzenia:** mogło być nakładką loading; zmierzyć `border-color` wierszy przy załadowanym stanie.

---

## PASS (zweryfikowana zgodność — rejestrujemy, by nie „naprawiać" działającego)

- **My Work tabela (dark):** Status=niebieski dot, Critical=rose+⚠ ikona (§8 spełnione), SLA badge, kebab — zgodne z TABLE_AND_PREVIEW_CANON.
- **Interview progress 100%:** `rgb(2,104,51)` = `--c-success` token (NIE raw green).
- **Chat body text (light):** `rgb(55,65,81)` = slate-700 — poprawny kontrast.
- **Tools Library (light):** tabela 36 narzędzi — nazwy slate-900, status różnicowany (Active/Inactive), tagi pille, „In development" badge. Czysta.
- **Results (light):** empty-state wzorcowy — nagłówek slate-900 + subtitle + chipy bucketów; navy CTA „+ Add KPI".

## ODRZUCONE przez pomiar (dowód, że oko myli — dlatego mierzymy)

- „Wyprany body text Chat (light)" → faktycznie slate-700, OK.
- „Raw green progress Interview" → faktycznie `--c-success` token, OK.

---

## Scope A1 — domknięty (do poziomu KPI)

**Przejrzane (default view, light):** Chat ✓ · My Work ✓ · Interview ✓ · Tools ✓ · Initiatives ✓ · Execution ✓ · Results/KPI ✓. Chat + My Work także dark (pilot).

**Poza scope (decyzja Piotra — nie gotowe):** Finance, Audits, Documents, Document/Presentation/Table Studio, Meeting, Admin/Settings/Organization, SuperAdmin/Partner.

**Głębsze taby (opcjonalnie w razie potrzeby):** My Work (Tasks/Calendar/Decisions/Ideas/Notebook/Home/Manager), Interview (Sessions/Assigned/Templates/Insights/Initiatives), Execution (Rollout/Reporting/Management), Results (KPI/ROI/ROI Analysis) — domyślne widoki pokryte; sub-taby tylko jeśli A1 wymaga większej głębi.

**Wniosek A1:** dominują **2 systemowe wzorce w LIGHT** (VIS-001 badge bez danger-fill, VIS-002 crimson-leak na datach/cytatach) + VIS-006 (CTA navy vs crimson). Dark głównie PASS. → Faza C0 (współdzielone komponenty) da największy zwrot.
