# MASTER Visual QA Catalog

> SSOT długu wizualnego. Findings `VIS-[nr]` z **obiektywnym pomiarem** (computed color/contrast), kanon-ref, severity, tag systemowy/lokalny.
> Sprint A1 (Faza A planu [VISUAL_QUALITY_SPRINT_PLAN.md](VISUAL_QUALITY_SPRINT_PLAN.md)). ZERO naprawiania — tylko spis.
> Metoda: AI proponuje z obrazu → **ZMIERZ** → potwierdź/odrzuć. Pomiar koryguje oko (patrz „odrzucone").

**Postęp sweepa:** **7/7 w-scope — A1 light sweep COMPLETE.** Scope (decyzja Piotra 2026-06-14): moduły sidebara **do poziomu KPI/Results**: Chat, My Work, Interview, Tools, Initiatives, Execution, Results. Moduły poniżej (Finance, Audits, Documents, Document/Presentation/Table Studio, Meeting) = **poza scope (nie gotowe)**. Light = oś priorytetowa.
**Legenda sev:** P0 broken · P1 czytelność/semantyka · P2 spójność · P3 polish.

---

## SYSTEMOWE (C0 — jeden fix czyści wiele obszarów)

### VIS-011 · 🔝 PREVIEW — standaryzacja (kształt + przyciski dołu + kolory dołu) · P1 · [SYSTEMIC — #1]
> **Reconnect wątku, z którego startowała rozmowa (T1/T5).** Preview jest w KAŻDEJ tabeli (`TableWithPreviewLayout` + `RowDetailPanel`/`PreviewRelations`) → standaryzacja = najwyższy zwrot. Żądanie właściciela 2026-06-15: kształt panelu, **przyciski stopki**, **kolorystyka stopki** — jak uwagi sprzed 2 dni.
- **Kanon (już jest):** TABLE_AND_PREVIEW_CANON §7.3 (anatomia: Header tytuł+Open+X → AI → Relations → Actions) + §7.3b (`PreviewActionBar`+`actionPillClass()` = JEDYNY SSOT przycisków stopki; dozwolone colorScheme; zero inline `bg-*`). T5 (przyciski preview Wywiadu) + T1 (SSOT) z początku wątku.
- **Otwarte z notatek 06-12/13:**
  - **[P0?] `PreviewRelations` React #31** (notatka 06-12: klik w Inbox crashował apkę). Dziś Ideas-preview NIE crashował → **verify Inbox-preview gdy serwer wróci**; jeśli żyje = P0.
  - **UWAGA #15:** brak działającego „Otwórz" z board-preview Inicjatyw (przycisk stopki nieosiągalny) → preview musi mieć JEDEN „Open" (§7.3).
- **Root-cause (C0):** `src/components/shared/PreviewPane/{previewStyles.ts, PreviewActionBar, PreviewRelations.tsx}` + `src/components/MyWork/table/RowDetailPanel.tsx`.
- **Akcja:** audyt KAŻDEJ tabeli czy używa `PreviewActionBar` (parytet stopki) + jednolita stopka (kolor/kształt/Open) + fix crashu jeśli żyje.

### VIS-001 · Badge danger gubi fill w LIGHT · P1 · [SYSTEMIC]
W light tryb badge'e severity/status danger renderują się BEZ tła i bez koloru danger.
- **Pomiar:** My Work „Critical" → `bg=transparent, border=0px, text=slate-500`. Interview „44d overdue" → `bg=transparent, text=slate-900`.
- **Kanon:** light-mode-readability §5 — badge MUSI mieć tło(100)+border(200)+tekst-danger(800); §8 nie tylko kolor.
- **Skutek:** „Critical"/„overdue" w light wyglądają jak szary neutralny tekst — nie czytają się jako alarm.
- **Hipoteza root-cause:** współdzielony komponent badge ma warianty `dark:` bez odpowiednika light → fallback do neutralnego.
- **Dowód:** zrzuty My Work light, Interview light.

### VIS-002 · Daty „critical-aged" rose+pulse · P3 · [SKORYGOWANE po badaniu]
**KOREKTA (verify-before-claiming):** to NIE crimson-leak bug. My Work daty kolorują się przez `AGING_STYLES` (InboxContent.tsx:676) — **intencjonalny sygnał wieku**: fresh→emerald, warm/hot→amber, critical(>3d)→rose-700. `rgb(145,10,40)` = aging-critical rose (config), nie fallback. Demo data jest stare → wszystko „critical" → wszystko czerwone (stąd pozorne „187 leak"). Gdyby odcrimsonić → zniszczony sygnał aging.
- **Realny fix (zrobiony):** usunięto `animate-pulse` z `critical` (pulsujące daty = rozpraszające, anty-§9/„mniej znaczy więcej"). Kolor rose zachowany.
- **Otwarte do osobnego badania:** Chat cytaty/Reasoning `rgb(109,20,39)` + Execution „Deadline" crimson — sprawdzić czy też aging/danger (intencjonalne) czy faktyczny `text-primary` leak. NIE zakładać bez pomiaru źródła.
- **Lekcja:** „187 crimson" z oka = w rzeczywistości intencjonalny aging × stare demo-dane. Pomiar koloru nie wystarczył — trzeba było znaleźć ŹRÓDŁO (komponent).

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

### VIS-009 · [My Work + global] Selekcja wiersza = crimson/rose tint · P2 · [SYSTEMIC?]
- **Pomiar (My Work → Ideas, light):** zaznaczony wiersz `bg=rgba(251,221,224,0.95)` (pale rose, primary-100) **+ crimson lewy-border**. Podwójny crimson na selekcji.
- **Kanon:** §6 mówi „selected=primary-50/100" — ale primary=crimson → selekcja czyta się **alarmowo** (różowy wiersz = „problem", nie „aktywny"). Konwencja enterprise: selekcja neutralna/info-blue.
- **Rekomendacja:** zmienić tint selekcji na slate/info-blue; crimson left-border zostaw jako subtelny wskaźnik LUB też zneutralizuj. Potwierdzona intuicja Piotra.
- **Do sprawdzenia:** czy to globalny komponent wiersza (wtedy SYSTEMIC, dotyka wszystkich tabel) czy lokalne dla Ideas.

### VIS-010 · [My Work] Preview — nad-truncate tytułu · P3
- **Obserwacja (Ideas + preview):** nagłówek preview „QA OWNER 17…" ucięty bardzo krótko mimo dostępnej szerokości. Pełny „QA OWNER 1779033714227" mógłby dostać więcej miejsca przed truncate.
- **PASS w tym samym preview:** anatomia §7.3 poprawna (Header tytuł+Open+X, AI hints, Relations „No linked documents", kolejność AI→Relations).

### VIS-012 · [Notebook] „CANONICAL NOTEBOOK PATH" — gigantyczny pasek (≈40% kanwy) · P1-design
> **Odpowiedź na „ciągle tam jest, czemu":** redesign opisany w `Harvard/SPEC_ZADANIE_07_notebook_workspace.md` (2026-06-13) to **PROPOZYCJA do akceptacji — nigdy nie wdrożona**. Stąd pasek dalej jest.
- **Problem:** `NotebookCanonicalPathStrip.tsx:25-179` (render `NotebookContent.tsx:2503-2523`) = 4 wielkie karty zajmujące ~40% kanwy, **duplikujące akcje prawego panelu** (Add sources=Attachments, AI proposal=AICommand, Review=propozycje, Convert=convert-to). „Powstał gdy aplikacja była wielką tabelą."
- **Fix (wg SPEC_07):** usunąć wielki pasek; workflow → slim progres-chip w nagłówku `① Sources · ② AI · ③ Review · ④ Convert` (4 małe segmenty). Zysk ~40% kanwy, zero duplikacji. „Mniej znaczy więcej."
- **Decyzja:** wdrożyć SPEC_07 (czeka na akceptację) — to design, nie czysty bug.

---

## 🔗 RECONNECT — mapa root-cause dla C0 (komponenty współdzielone)

| Finding | Root-cause komponent | Uwaga |
|---|---|---|
| VIS-011 preview (stopka/kształt/Open/crash) | `shared/PreviewPane/{previewStyles.ts, PreviewActionBar, PreviewRelations.tsx}` + `MyWork/table/RowDetailPanel.tsx` | reconnect T1/T5/§7.3b; verify crash Inbox |
| VIS-009 selekcja rose + VIS-002 aging | `MyWork/table/RowColoringConfig.tsx` | kolory wierszy (selekcja/aging) w jednym miejscu |
| VIS-001 badge danger w light | komponent(y) badge (`PMOPriorityBadge` itp.) | §5 tło+border+text-danger |
| VIS-006 CTA crimson→navy | per-moduł CTA (Tools/Initiatives) | jedna reguła navy |
| VIS-012 notebook strip | `MyWork/notebook/NotebookCanonicalPathStrip.tsx` | SPEC_07 |

**Weryfikacja świeżości:** archiwum (06-14) jest POTOMKIEM codemodu light-contrast `24ccb176d9` (06-04, 7579 zmian) → **findings AKTUALNE, nie przestarzałe** (sprawdzone `git merge-base`).

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
