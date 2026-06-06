# 🤝 HANDOFF — przekazanie pracy kolejnemu Claude'owi
**Data:** 2026-06-06 · **Branch:** `Londyn` · **Repo:** `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify`

> Ten dokument daje świeżej sesji (bez pamięci) PEŁEN kontekst, by płynnie przejąć robotę.
> Na końcu jest **gotowy prompt do wklejenia** (sekcja 11).

---

## 1. Kim jest user i czym jest produkt
- **Piotr Wiśniewski** — CTO/właściciel **Consultify** (DBR77). Hands-on: produkt + kod. Pisze po polsku, oczekuje odpowiedzi po polsku.
- **Consultify** = platforma SaaS dla konsultingu (React + Vite + TypeScript frontend, Node/Express backend, Supabase/Postgres). ~19 modułów funkcjonalnych + Teresa (AI host).
- **Cel jakościowy (locked):** „aplikacja klasy Google/OpenAI/Apple, w kolorystyce Harvardu (lekko), technologicznie i profesjonalnie." GA ~2026-06-08.
- **Brand:** akcent = **Burgundy/Harvard Crimson** (`#85182F`/`#A51C30` rodzina, token `crimson-*` / `primary`), neutrale = navy/slate, komplementarne = `hbs-*`. Indigo/violet/fuchsia/purple = **OFF-BRAND** (poza wykresami/paletami użytkownika).

## 2. Metoda pracy (KONTRAKT — przestrzegać dosłownie)
**Plik:** `docs/audit/2026-06-04/_PROCEDURE_MODULE_BY_MODULE.md` (przeczytaj w całości na start).
Skrót:
- Jedziemy **moduł po module** (mapowanie func#↔UI# w procedurze). Każdy moduł domykamy do **100% Funkcjonalność + 100% UI** — bez „prawie", bez cichych odroczeń. Dopiero potem następny.
- **Commit po każdym kroku** (jeden krok = jeden commit). Odporność na sync + czytelna historia.
- **Nie pomijaj ryzykownych** — Piotr jest obecny do weryfikacji; robimy je teraz. Blokuje TYLKO realna zależność zewnętrzna (3rd-party/klucz API/decyzja biznesowa) → oznacz `🔌 BLOCKED-EXTERNAL`, zapytaj, NIE pomijaj po cichu.
- **Nie rozszerzaj zakresu** poza bieżący moduł — znaleziska z innych modułów dopisz do backlogu, nie naprawiaj od razu.
- **Pytaj tylko** gdy to decyzja produktowa/biznesowa Piotra; resztę rozstrzygaj z kodu/standardu.

## 3. Dwa plany prawdy (aktualizuj na bieżąco)
- **Funkcjonalny:** `docs/audit/2026-06-03/deep/_REMEDIATION_BACKLOG_BY_POSITION.md` (pozycje `FIX-NNN`).
- **UI:** `docs/audit/2026-06-04/UI_STANDARD_TRACKER.md` (żywa lista, statusy per moduł) + szczegóły file:line w `MODULE_BY_MODULE_REPORT.md` i `MODULE_REPORT_PART_1..4.md`.
- **Standard graficzny (DoD/kolory/kontrast):** `docs/audit/2026-06-04/_DESIGN_STANDARD.md`.

## 4. Stan NA TERAZ (co zrobione, co w toku)
- **Moduł 01 Czat** — ✅ ZAMKNIĘTY (func 100% + UI 🟢 PASS), 2026-06-04.
- **Moduł 03 Wywiad (Interview)** — to był OSTATNI obszar pracy (2026-06-06, branch `Londyn`). Wykonano 5 fal (Standard-C board `NModeCBoard`, kolumny Sessions, bulk approve, Audit Orchestrator discoverable, lineage Finding→Decision/Task, Assigned row-menu). **Cały kod skompilowany i scommitowany (FE tsc=0, BE esbuild=0).**
  - ⚠️ **WYMAGA WIZUALNEGO POTWIERDZENIA na żywym koncie** (lista w `docs/audit/2026-06-05/_IV_WAVE_FINISH_2026-06-06.md`, sekcja „Pozostałe / do potwierdzenia wizualnie"): Standard-C density, nowe kolumny Sessions, „Audits" w sidebarze + route `/audit-programs`, Assigned row-menu end-to-end, voice-echo fix.
- **Globalne UI (rundy Wave 1/2, wcześniej):** naprawiony bug „pusto-zamiast-błędu" (ErrorState+retry) w 6 miejscach; sweep off-brand violet→crimson (0 off-brand gradientów app-wide); kontrast dark `dark:text-slate-600`→`-400` (212 plików). Szczegóły: `_ROUND2_FIXES_REPORT.md`.
- **Working tree:** CZYSTY (0 uncommitted). **Branch:** `Londyn`.
- **Serwery:** frontend `:3000` był UP; backend `:3001` **może być DOWN** — uruchom `npm run dev` (startuje oba: backend 3001 + frontend 3000, tryb staging).

## 5. Kolejka modułów (UI tracker — co jeszcze do wyrównania)
Z `UI_STANDARD_TRACKER.md` (status UI; func osobno w backlogu):
- 🔴 **NEEDS-WORK:** My Work, Assessment, Inicjatywy, Finanse, Organizacja, Ustawienia, Table Studio
- 🟡 **MINOR:** Wywiad (UI-resztki), Narzędzia, Realizacja, Rezultaty, Spotkania, Admin, Landing
- 🟢 **PASS/DONE:** Czat, Decyzje, Outputs/Reports, Prezentacje, Document Studio, Partner

**Punktowe bugi brandowe (wysoka wartość, bezpieczne):** `FinanceHub.tsx:1180` `bg-purple-600`→crimson; Organization brand default `#6366f1`→crimson; `PublicMiniAssessmentView` cały indigo→crimson (prospect-facing!); Meeting `[#A51C30]`→token `crimson`; martwy kod do usunięcia: `Economics/EconomicsHub.tsx`, `Landing/HeroSection.tsx`.

## 6. Gating (TWARDY, przy każdym commicie)
```bash
# Frontend typecheck — MUSI = 0 (cały projekt)
npx tsc --noEmit -p tsconfig.json
# Backend gate = esbuild ESM (NIE tsc! tsc ma ~4543 pre-existing błędów — NIE ruszać)
cd server && npx esbuild --bundle --platform=node --format=esm '--external:*' --outfile=/dev/null src/index.ts
# Lint (zmienione pliki) — autofix
npx eslint --fix <plik>     # lint config: prettier=error, hex/violet-gradient = warn (CI: --max-warnings 0)
# Zamknięcie modułu:
npm run build               # zielony
# Zdrowie serwerów:
curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health   # 200
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000              # 200
```
Czerwony gate = NIE commituj, napraw.

## 7. Komponenty kanoniczne (używać, NIE dublować)
- **Shell:** `ModuleHub` + `ModuleNavBar` (Menu 2) + `Menu3Row`/`ModuleMenu3` (Menu 3) — z `@/components/shared/ModuleHub`.
- **Tabele:** `FilterableTable`/`DataTable` + `TableWithPreviewLayout`/`PreviewPane`; `TableSettingsPopover`; `FilterDropdown`.
- **Stany:** `LoadingState`, `EmptyState` (z `./composed`), `ErrorState` (z `@/components/ui/primitives`). Empty ≠ Error!
- **Chipy:** chip-system (`StatusChip`/`PriorityChip`/`MetaChip`/`ToolChip`/`DueChip`) + `StatusPill` (`@/components/shared/StatusPill`).
- **Formularze:** `SelectField`, `Switch`, `Toggle`, `Input` (z `@/components/ui/primitives` — token-enforcing; NIE raw `<select>`/shadcn).
- **Modale:** `Modal`/`ConfirmModal`/`Drawer` (NIE raw `fixed inset-0` — wyjątek: in-canvas/lightbox/backdrop-catcher).
- **Akcje wierszy:** `RowActionsMenu` (NIE hand-rolled kebaby).
- **Banery:** `Banner` (`@/components/shared/Banner`).
- **Inne kanony z fal Wywiadu:** `NModeCBoard` (ClickUp-dense C-board), `WizardStepper` (clickable stepper).
- **Lint guard:** `src/components/ui/**` ma wyłączone guardrails (warstwa prymitywów). Poza nią: zakaz inline `style={{}}`, hex literals, `bg-[#…]`, off-brand gradientów.

## 8. KRYTYCZNE zasady (nie powtórz błędów)
- **❌ ZAKAZ `git stash`** — w przeszłości zgubił pliki podczas równoległej pracy. Nie używaj stash/pop.
- **Branch `Londyn`** — pracujemy tu (procedura wspomina `feat/wave1-foundations`, ale realny aktywny branch to `Londyn`; potwierdź z Piotrem jeśli wątpliwość).
- **Commit po każdym kroku.** Stopka commita: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Backend tsc jest „brudny" z założenia** (4543 pre-existing) — gate backendu to esbuild, NIE tsc.
- Pamięć użytkownika (cross-session) jest w `~/.claude/.../memory/MEMORY.md` — kluczowe decyzje produktowe tam.

## 9. Dokumenty, które warto przeczytać na start (kolejność)
1. `docs/audit/2026-06-04/_PROCEDURE_MODULE_BY_MODULE.md` — kontrakt pracy + log postępu.
2. `docs/audit/2026-06-04/UI_STANDARD_TRACKER.md` — żywa lista UI.
3. `docs/audit/2026-06-05/_IV_WAVE_FINISH_2026-06-06.md` — co dokładnie zrobiono w Wywiadzie + co do potwierdzenia.
4. `docs/audit/2026-06-04/_DESIGN_STANDARD.md` — standard kolorów/kontrastu/DoD.
5. `docs/audit/2026-06-03/deep/_REMEDIATION_BACKLOG_BY_POSITION.md` — backlog funkcjonalny.

## 10. Rekomendowany następny krok
Najpierw **domknij Moduł 03 Wywiad**: uruchom `npm run dev`, przejdź wizualnie listę z `_IV_WAVE_FINISH_2026-06-06.md` (sekcja „do potwierdzenia wizualnie"), napraw co się rozjeżdża, potem zaktualizuj log postępu w procedurze (03 → ✅/🟢) i dopiero przejdź do kolejnego modułu wg kolejki. Zacznij od ogłoszenia zakresu (KROK 0 procedury) i poproś Piotra o potwierdzenie, że ma podgląd na żywym koncie.

---

## 11. ✅ GOTOWY PROMPT DO WKLEJENIA (skopiuj całość do nowej sesji)

```
Jesteś Claude (Opus 4.8) i przejmujesz pracę nad projektem Consultify po poprzedniej sesji.
Repo: /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify · branch: Londyn.
User: Piotr Wiśniewski (CTO/właściciel, DBR77) — pisze i oczekuje odpowiedzi PO POLSKU.

ZANIM COKOLWIEK ZROBISZ, przeczytaj w tej kolejności:
1. docs/audit/2026-06-04/_HANDOFF_NEXT_CLAUDE.md  (pełny kontekst przekazania — START TUTAJ)
2. docs/audit/2026-06-04/_PROCEDURE_MODULE_BY_MODULE.md  (kontrakt pracy + log postępu)
3. docs/audit/2026-06-04/UI_STANDARD_TRACKER.md  (żywa lista UI)
4. docs/audit/2026-06-05/_IV_WAVE_FINISH_2026-06-06.md  (stan modułu Wywiad + co do potwierdzenia)
5. docs/audit/2026-06-04/_DESIGN_STANDARD.md  (standard kolorów/kontrastu/DoD)

CEL: doprowadzić aplikację do poziomu „Google/OpenAI/Apple w kolorystyce Harvardu (crimson lekko, navy)",
moduł po module — każdy do 100% Funkcjonalność + 100% UI, wg kontraktu z _PROCEDURE_MODULE_BY_MODULE.md.

ZASADY (twarde):
- Commit po KAŻDYM kroku (jeden krok = jeden commit). Stopka: Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
- Gating przed commitem: FE `npx tsc --noEmit` = 0 (cały projekt) + `eslint --fix` na zmienionych; BE gate = esbuild ESM (NIE tsc — backend ma ~4543 pre-existing błędów); zamknięcie modułu = `npm run build` zielony.
- ❌ NIGDY `git stash` (w przeszłości zgubił pliki).
- Nie pomijaj ryzykownych pozycji po cichu — rób je z weryfikacją; blokuje tylko realna zależność zewnętrzna → oznacz 🔌 BLOCKED-EXTERNAL i zapytaj.
- Nie rozszerzaj zakresu poza bieżący moduł (znaleziska → do backlogu).
- Komponenty kanoniczne (NIE dubluj): ModuleHub/ModuleNavBar/Menu3Row, FilterableTable/DataTable, LoadingState/EmptyState/ErrorState, chip-system/StatusPill, SelectField/Switch/Toggle, Modal/Drawer, RowActionsMenu, Banner, NModeCBoard, WizardStepper.
- Kolory: akcent crimson/primary „lekko", neutrale navy/slate; indigo/violet/fuchsia/purple = off-brand (poza wykresami/paletami usera); zero hardcoded hex poza tokenami; light body ≥ slate-600, dark body ≥ slate-400; Empty ≠ Error (awaria → ErrorState z retry).

STAN: Moduł 01 Czat ✅ zamknięty. Moduł 03 Wywiad — kod 5 fal scommitowany (FE tsc=0, BE esbuild=0), ale wymaga WIZUALNEGO potwierdzenia na żywym koncie (lista w _IV_WAVE_FINISH_2026-06-06.md). Working tree czysty.

PIERWSZY KROK: uruchom `npm run dev` (startuje backend :3001 + frontend :3000, staging), potwierdź zdrowie serwerów (curl /api/health = 200, :3000 = 200), a następnie ogłoś mi (Piotrowi) zakres domknięcia Modułu 03 Wywiad (KROK 0 procedury) i poproś o potwierdzenie, że mam podgląd na żywym koncie, zanim ruszysz z wizualną weryfikacją i naprawami. Czekaj na moje „jedź" przed większymi zmianami.
```
