# HANDOFF dla następnego agenta — Consultify / moduł WYWIAD (Interview)

**Data:** 2026-06-06 (wieczór) · **Branch:** `Londyn` · **Autor handoffu:** poprzednia sesja Claude
**Ten plik zastępuje** `docs/audit/2026-06-04/_HANDOFF_NEXT_CLAUDE.md` (starszy).

> ⚠️ **NAJWAŻNIEJSZE NA START — przeczytaj zanim cokolwiek dotkniesz.** Cała praca z ostatniej sesji jest zweryfikowana **tylko na poziomie kodu** (FE `tsc`=0, BE `esbuild`=0, `eslint` 0 błędów). **NIC nie zostało potwierdzone wizualnie na żywym koncie** — rozszerzenie „Claude in Chrome" / przeglądarka było OFFLINE przez całą sesję. Owner (Piotr) jest **rozczarowany** dokładnie z tego powodu: dużo zmian, zielone bramki, ale brak dowodu, że to faktycznie działa w UI — a do tego środowisko dev się rozsypało (backend padł). **Twoim priorytetem #1 jest WIZUALNY smoke-test na żywym koncie, zanim ogłosisz cokolwiek „gotowym".** Nie raportuj „done" na podstawie samego `tsc`.

---

## 1. Kim jest owner i czego chce
- **Piotr Wiśniewski** — CTO/właściciel Consultify (org DBR77, rola OWNER), hands-on product+code, lubi UX w stylu Miro/Notion/ClickUp. Pisze po polsku.
- Cel bieżący: **doprowadzić moduł Wywiad (Interview/Wywiad) do 100%** — wizualnie i funkcjonalnie. Lubi pracę **4 równoległymi agentami** („odpal 4 agentów", „jedziemy na maksa", dokupuje tokeny).
- Styl pracy, który zaakceptował: 4 agenci file-disjoint na falę → agenci NIE commitują → orkiestrator robi wspólną bramkę (`tsc`/`esbuild`/`eslint`) + sekwencyjne commity.

## 2. Stack / środowisko (twarde fakty)
- FE: React/TS/**Vite** (port **3000**, mode `staging`). BE: Node/Express/**tsx** (port **3001**). Baza: **Railway Postgres** (`caboose.proxy.rlwy.net`) — `llm_providers` siedzi w bazie (klucze AI raz, używane wszędzie).
- **Start obu serwerów:** `npm run dev:staging` (concurrently BACKEND+FRONTEND, czyta `.env.staging.local` — plik istnieje, jest gitignored). NIE `dev:londyn` (`start-londyn.sh` jest pusty).
- **Bramki weryfikacji:**
  - FE: `rm -f tsconfig.tsbuildinfo && npx tsc --noEmit -p tsconfig.json` (musi być 0; **usuń `.tsbuildinfo`** bo daje fałszywe 0).
  - BE: `cd server && npx esbuild --bundle --platform=node --format=esm '--external:*' --outfile=/dev/null src/index.ts` (exit 0 — **to jest bramka backendu, NIE `tsc`**, bo `tsc` na server/ ma szum).
  - `npx eslint --fix <plik>` (0 błędów; warnings repo-wide OK).
  - Zdrowie: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/health` = 200; `curl ... http://localhost:3000/` = 200.
- **PUŁAPKA Vite stale-cache:** edycja DUŻYCH plików (InterviewHub 11k linii, InsightViewer 7k, InitiativeDocumentView 9k) NIE odświeża się przez HMR. Fix: `lsof -ti:3000 | xargs kill -9; rm -rf node_modules/.vite; ` i restart. Weryfikuj świeżość: `curl -s 'http://localhost:3000/src/.../Plik.tsx' | grep -c <token>`.
- **Twarde ograniczenia (NIE łamać):** ZERO OpenAI (tani stack: OpenRouter default + DeepSeek + ZAI; Voice = `GEMINI_LIVE_API_KEY`). `DB_MANAGED_SCHEMA=off` → nowe kolumny TYLKO przez guarded lazy `ALTER` (`getTableColumns()` + `cols.has(...)`), nigdy migracje. Sekrety nie trafiają do czatu/gita. **GDrive psuje repo** (markery konfliktu) — repo siedzi w `~/Documents` synchronizowanym przez GDrive; jak build się sypie po edycjach, sprawdź `git status` pod kątem śmieci i `scripts/fix-gdrive-pollution.sh`. Format commita kończy się `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## 3. GDZIE SĄ RAPORTY Z AUDYTU (najważniejsze ścieżki)
- **Audyt systemowy 19 modułów (2026-06-02):** `docs/audit/2026-06-02/MODULE_01..18_*.md` + `CROSS_*`. Wywiad = `MODULE_03_wywiad.md`. Średnia ~51/100 wtedy.
- **Głęboki audyt Wywiadu (2026-06-05):** katalog `docs/audit/2026-06-05/`:
  - `_IV_EXECUTION_PLAN.md` — **GŁÓWNY tracker** (82 punkty, wszystkie odhaczone; na końcu DOPISANA sekcja „🚀 WYKOŃCZENIE DO 100% — 2026-06-06" z falami tej sesji).
  - `_IV_TEST_NOTES.md` — **35 obserwacji ownera** z testów ekran-po-ekranie (źródło prawdy „co było nie tak"). 2098 linii.
  - `_IV_WAVE_FINISH_2026-06-06.md` — **raport zamknięcia** z tej sesji (fale 0-4, komendy, co do potwierdzenia wizualnie).
  - Per-feature: `_IV_INBOX.md`, `_IV_SESSIONS.md`, `_IV_ASSIGNED.md`, `_IV_TEMPLATES.md`, `_IV_INSIGHTS.md`, `_IV_INITIATIVES.md`.
  - Decyzje/spec: `_IV_SESSIONS_VS_ASSIGNED_DECISION.md`, `_IV_ANSWER_FORM_REDESIGN.md`, `_IV_MODULE_MASTER_PLAN.md`, `_IV_VISUAL_TABLE_PATTERN.md`.
  - Audyt głęboki: `_INTERVIEW_A_STRUCTURED_CORE.md`, `_INTERVIEW_B_DISCOVERY.md`, `_INTERVIEW_C_ENTERPRISE.md`, `_INTERVIEW_D_ECOSYSTEM_BENCHMARK.md`, `_INTERVIEW_REMEDIATION_SYNTHESIS.md`.
- **Pamięć Claude (persist między sesjami):** `~/.claude/projects/-Users-piotrwisniewski-Documents-Antygracity-DRD-consultify/memory/` → `MEMORY.md` (indeks) + `project_interview_to_100.md` (PEŁNY zapis tej sesji — przeczytaj go).

## 4. Oś czasu — co robiliśmy przez ostatnie ~5 dni
- **06-02:** audyt gotowości 19 modułów (~51/100) + zablokowane decyzje produktowe v1 (D1-D22: GA ~06-08, pricing, marka HBS, AI Credits, demo Atelier Toys). Chat Phase 0 (bezpieczeństwo). System unification Phase 1.
- **06-03 / 06-04:** prace Canvas/Chat „do 100%", deep-audity, handoffy (`docs/audit/2026-06-04/_HANDOFF_NEXT_CLAUDE.md`).
- **06-05:** głęboki audyt modułu Wywiad → 35 notatek testowych + 82-punktowy plan; moduł doprowadzony do „code-complete" (82/82 + domknięte 6 świadomych stubów).
- **06-06 (ta sesja):** „Standard C" (deska ClickUp) + **7 fal po 4 agentów** dociągających Wywiad do 100% (poziom kodu) + **pełny audyt 4 agentami** (scorecard) + fala domknięcia luk + **restart środowiska** (backend był padnięty).

## 5. CO ZROBILIŚMY W TEJ SESJI (06-06) — z commitami (branch `Londyn`)
Wszystko zacommitowane, bramki zielone. Najważniejsze:
- **Standard C (deska ClickUp)** — nowy `src/components/shared/NModeLayout/NModeCBoard.tsx` (górne taby grup + sztywna siatka 3-kol + `cSpan` 1-3 + `cHidden`). Wpięty w `NModeShell` C-mode. Naprawiony blank-C (`children` renderuje się zawsze) i `[object Object]` (`toTextList` w InsightViewer). Initiative C-mode ujednolicony na NModeCBoard (zamiast legacy InitiativeCompactPanel). Discovery-Tool detale dostały grupy/cSpan. Commity: `eb61614e0c`, `bb23576092`, `43293ba7df`, `fbf4a02963`, `d30b40f819`, `8bd1f7f34f`.
- **Tabele** (5 ręcznych w `InterviewHub.tsx`): Templates filtry per-kolumna; Sessions DATE → Due/Submitted/Overdue + kolumna Assignee; StatusPill+em-dash wszędzie; bulk Approve/Send-back na Sessions; row-menu Change-due-date + Reassign; **filtry Insights Source/Exported + sortowanie nagłówkiem Sessions/Insights/Templates**. Commity: `1803d8eae6`, `357d5ea0ee`, `05c5602979`, `afb59420a8`, `4e43bd99bf`.
- **3 wizardy:** i18n InitiativeWizard (był zawsze po PL — **naprawione**), spójność stopki Insight↔Initiative, Audit wizard na wspólnym WizardStepper, **migracja natywnych `<select>/<input date>` na portalowe `forms/`**. Commity: `d91c82fbc0`, `d8b5f32b4c`.
- **Formularz odpowiedzi:** seed-chip cleanup, voice-echo fix, hint #11c, komunikaty pre-approve, StatusPill. Commity: `b4586a7c16`, `30c06e51d6`, `61f4e6559e`.
- **Interview workspace C-mode** — przełącznik N⇄C dodany (`2ebe97f447`).
- **Ekosystem/lineage:** Audit Orchestrator odkrywalny (sidebar „Audits" + route fix + CTA, `a225426303`); Finding→Decision/Task **tagują source lineage** (`4ab8e44809`) + filtr `?source` na listach decisions/tasks (`9b96de03de`) + pasek read-back w hubie (`45ac9e0cc8`); Insight handoff „Link to existing" dostał **realny picker** inicjatyw (był hardcoded fake, `2a49261627`).
- **Backend P0:** dodany brakujący `PATCH /v8/interview/assignments/:id/manage` (Change-due-date dawał 404) — `fc7787df08`.
- **Initiative cleanup:** usunięte **651 linii martwego „D-mode"** + nieużywane importy (`d7f2d3b2c1`).
- **Hygiene:** usunięte 13 debug console.log, poprawione nieaktualne komentarze-stuby (`b874623b44`).

## 6. WERDYKT AUDYTU 4-agentowego (06-06) — gdzie naprawdę jesteśmy (poziom kodu)
| Obszar | Gotowość | Uwagi |
|---|---|---|
| 6 funkcjonalności (Inbox/Sessions/Assigned/Templates/Insights/Initiatives) | **~90%** | Realne, org-scoped, workflow assign→submit→approve/send-back kompletny, AI gate prawdziwy. Initiatives = celowo widok pochodny (read-back), nie pełny CRUD. Zero fake/404. |
| Tabele | **~98%** (po fali 7) | Ustandaryzowane + filtry kategoryczne + sortowanie. Brak filtrów range na kolumnach liczbowych/datowych (świadome). |
| 3 wizardy | **funkcj. ~90% / spójność ~80%** | Działają, wpięte w backend, i18n OK, portalowe inputy. **Pełna powłoka `WizardModal` NIE wpięta** (świadomie, ryzyko>zysk) — dlatego spójność nie 100%. TemplateBuilder to inny frame (z założenia builder). |
| Grafiki artefaktów (Insight/Interview/Initiative) | **~90%** | Wszystkie 3 mają teraz N i C mode + StatusPill/strip. Insight najbliżej wzorca (jedyny w pełni na NModeShell). |

## 7. CO ZOSTAŁO / CO DALEJ (priorytety dla Ciebie)
1. 🔴 **WIZUALNY SMOKE-TEST NA ŻYWYM KONCIE (priorytet #1).** Gdy wróci „Claude in Chrome" (albo użyj `scripts/claude-verify/shoot.mjs` — headless Playwright via `register-demo`, ale uwaga: świeży user demo nie ma seedowanych demo-inicjatyw, więc deep-linki `?open=demo-init-...` lądują na AI Chat). Sprawdź: **Insight C-board** (taby grup + siatka, brak `[object Object]`), **Sessions** (nowe kolumny Due/Submitted/Overdue + Assignee + sortowanie nagłówkiem + filtry), **Audit** (nowy wpis w sidebarze → `/audit-programs`), **Insight handoff „Link to existing"** (picker inicjatyw), **pasek lineage** „Handed off from interviews" w zakładce Initiatives, **3 wizardy** (portalowe inputy się renderują; Initiative wizard po EN gdy locale=en), **Interview workspace** (przełącznik N⇄C). Deep-linki: `/initiatives?open=<id>&mode=doc&view=c` otwiera Initiative w C; `usePresentationMode` czyta `?view=c`. Insight nie ma czystego deep-linka — wchodzi przez listę Insights → wiersz → „Open".
2. **Świadomie odłożone (większe/ryzykowne refaktory — rób z ownerem przy testach):**
   - Pełna migracja 3 wizardów na wspólny `WizardModal` (header/overlay/footer) — dziś dzielą tylko `WizardStepper` + `forms/`.
   - Initiative składa NModeLayout RĘCZNIE (nie przez `NModeShell`) — to wzorzec gold-standardu, migracja ryzykowna.
   - Interview `artifactType:'tool'` (brak dedykowanego `'interview'` w `usePresentationMode` EntityType).
   - my-work read-back decyzji/zadań jest USER-scoped (vs org-wide inicjatywy); `onlyPending`/`onlyOpen` ukrywają zamknięte.
   - Feature przyszłościowy: Teresa Voice w trybie ankiety (#5 część-2) — nie zaczęte.
3. **Push na staging** (jeśli owner zatwierdzi): NIC nie jest wypchnięte. Wszystko lokalnie na `Londyn`. `develop` jest protected → szło przez PR #103 (integration clone `~/consultify-merge`). Backupy: tagi `backup/2026-06-06-cto-merge/*`.

## 8. Kanony których MUSISZ używać (nie dublować)
- Detail-view: `src/components/shared/NModeLayout/` (`NModeShell` → Header/PropertiesStrip/ActionBar/LeftNav/Canvas dla N; `NModeCBoard` dla C). `NModeSection` ma `group?`, `cSpan?`, `cHidden?`, `hasData?`, `alwaysShow?`.
- Statusy: `src/components/shared/StatusPill.tsx` (SSOT).
- Formularze: `src/components/shared/forms/` (portalowe Select/MultiSelect/DatePicker/PriorityPicker/Field).
- Wizard stepper: `src/components/shared/WizardModal/WizardStepper.tsx` (+ pełny `WizardModal.tsx` — istnieje, niewpięty).
- Tabele Interview są RĘCZNE w `InterviewHub.tsx` (NIE migrowane na shared `FilterableTable` — świadoma decyzja, za duże ryzyko na 11k-liniowym pliku).

## 9. Ton/kontekst relacji (ważne)
Owner jest rozczarowany — nie dlatego, że kod jest zły (jest zweryfikowany na poziomie buildu i dwukrotnie adversarialnie przez agentów: P0=0), ale dlatego, że **przez całą sesję nie było dowodu wizualnego** i na koniec rozsypało się środowisko dev. Następnym razem: **najpierw odpal i pokaż, że działa w przeglądarce, potem deklaruj postęp.** Nie zasypuj „zielonymi tsc" jako dowodem gotowości UI.
