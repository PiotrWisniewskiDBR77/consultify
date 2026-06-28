# HANDOFF — sesja 2026-06-28 (redesign Notatnika + UI/UX Ideas) → następny agent

> **Po co ten plik:** Piotr przenosi się do drugiego agenta. To SAMOWYSTARCZALNY pełen kontekst tej sesji. Przeczytaj w całości, potem `git log --oneline -20`, `git status`, i wystartuj od §8 „Jak wznowić".
> **Branch:** `feat/deliverables-w1` · **Demo:** demo.consultify.ai (`b5032410` na 2026-06-28 16:36, build SUCCESS) · **Deploy:** `./scripts/deploy-demo.sh` (NIE w subshellu `&` — ginie; uruchom z `run_in_background`).

## 0. Kim jesteś / reguły twarde (NIE łam)
CTO projektu Consultify (SaaS diagnoza/transformacja AI; klienci prod: VTS/Apator/Elkomtech). Piotr = product+strategy, robi odbiory, komunikacja PL. Ty robisz CAŁĄ inżynierię + decyzje techniczne.
- **PROD = świętość** (Railway „centerbeam"). Zmiany prod tylko jawnie + osobna zgoda. Demo (gałąź `demo`) najpierw. `.env.local` wskazuje prod — uważaj.
- **Weryfikuj przed „done"** (tsc+vitest minimum; UI → demo/screen, nie sam tsc).
- **Testy w `tests/`** (NIE `src/__tests__` — CI pomija). `tests/` GITIGNOROWANE → `git add -f`.
- **Branch współdzielony z innymi agentami — GIT-RACES REALNE.** `git fetch`+sprawdź `git log` przed reset/rebase. Commity chirurgiczne per ścieżka.
- **Piotr: cofalność.** Każda logiczna zmiana = osobny commit (cofnięcie = `git revert <sha>` + redeploy). „Nie umiem zgadywać linii" → pokazuj EFEKT (demo/screen/mockup), nie kod.

## 1. CO ZROBIONO TEJ SESJI (chronologicznie)
1. **Deck/bundle smoke na demo** — warstwa Materiałów (M17) generuje realne pliki Office: deck 11 slajdów + bundle ZIP 4×OOXML poprawne (`docs/qa/deliverables/runs/2026-06-28-DEMO-LIVE-*`). Jakość treści: „template+liczby" nie premium (zmyślone źródła, model fin. szkielet) — patrz `_UWAGI` U1 + task.
2. **Sprzątanie repo (~117 martwych plików)** — 3 fale fixpoint (assessment/settings/Admin orphany), tsc+vitest zielone. Commity `e90a…`/`48601…`/`67fb…`.
3. **UI/UX Ideas (crimson sweep + toolbar)** — F-A..F-H: crimson-leak→monochrome (mindmap/Table/Workspace), ProcessFlowToolbar 4-karty→1-pasek, context-menu „Edit label" fix. Na demo.
4. **★ REDESIGN NOTATNIKA — główny temat (FAZA 1) ★** — patrz §3.
5. **Audyt 9 modułów M10/M12/M21-M27** = wszystkie ZIELONA-REALIZACJA (nie „NIE ROZP."). Dashboard główny zaktualizowany (`_STAN_PRACY_ODBIORY.md` notka 2026-06-26).

## 2. UWAGI PIOTRA z testów (SSOT: `Harvard/wdrozenie-100/_UWAGI_TESTY_PIOTR_2026-06-28.md`)
U1-U14. Kluczowe nieadresowane/funkcjonalne:
- **U4** 🔴 mind-map „AI returned no output" — root-cause w pamięci [[finding_ui_primary_is_crimson]] §U4: `generate_deliverable` enum w `mcpServer.ts` bez `mindmap` → intencja mapy w czacie bez handlera. **UWAGA: ktoś właśnie commitnął `b5032410 feat(teresa): expose generate_initiative to chat tool loop` — może powiązane, SPRAWDŹ.** Osobny task `task_348af251`.
- **U9** 🔴 „Failed to save notebook" (Edit notebook modal) — `NotebookLibraryContent.tsx:498 handleSave`→`Api.updateNotebook` rzuca. Do diagnozy API-smoke demo.
- **U13** 4 killery funkcjonalne (slash/@mention-linki/AI-rozszerzone/bookmark) = FAZA 2.

## 3. REDESIGN NOTATNIKA — stan (SSOT: `Harvard/wdrozenie-100/NOTATNIK-REDESIGN-2026-06-28.md`)
**5 mockupów** (widgety w transkrypcie) + spec z planem 2-faz + rozstrzygnięcia D1-D4.
**FAZA 1 (UI) — ZROBIONE na demo (multi-agent: 4 agenty rozłączne pliki + ja monolit):**
- **N1 ✅** hamburger ⋯ wpięty (`c8fb71081e`): `NotebookHamburgerMenu.tsx` (nowy) + ⋯ button w prawym menu edytora `NotebookContent.tsx:~2716`. ADDYTYWNY — stary panel/rail JESZCZE ZOSTAJE (pełne zastąpienie po N7 slash przejmie Insert).
- **N2 ✅** 3-tools-strip ukryty za flagą `SHOW_LEGACY_NOTEBOOK_TOOLS_STRIP=false` w `MyWorkHub.tsx` (cofalne: `true`).
- **N3 ✅** nagłówek: lifecycle dropdowny→status-pigułki (`NotebookContent.tsx:~2888`) + flow-stepper numerki→chevrony (`NotebookProgressChip.tsx`).
- **N4 ✅** prawe menu ikony+tooltip (Expand→ikona, History/Network monochrome) `NotebookContent.tsx:~2665`.
- **N6 ✅** Context: UUID-leak fix + puste sekcje ukryte + Insert/Open ZWERYFIKOWANE ŻYWE `NotebookContextPanel.tsx`.

**ZOSTAŁO FAZA 1:**
- **N5 ✅ ZROBIONE** (`b3dc957231`, na demo z U9) — lewa kolumna przebudowana: **Capture** na górze + **segmented zakres** Wszystkie·Moje·Zespół (wg `ownerUserId`, auto-chowa się gdy brak stron zespołu) + **chipy widoku** Wszystkie·Przypięte·Ostatnie·Do przeglądu·Świeże (spłaszczone sekcje Today, live-liczniki) + czysta lista. Usunięte: taby Inbox/Active/All (status żyje w Menu 3 huba — koniec dublowania), słońce/Today-mode, filtr-ikona+selecty, pasek maturity. Empty-state świadomy filtra. tsc+vitest (57/260) zielone. **Decyzja: „Moje/Zespół"=autor strony** (oś niezależna od statusu). Mockup efektu = widget `notatnik_lewa_kolumna_N5`. *Czeka na żywy odbiór Piotra na demo.*
- **N7 🟡 = NASTĘPNA fala FAZA 1 (NIE drop-in swap — scoping zrobiony 2026-06-28):** stary `SlashMenu.tsx` jest SAMOWYSTARCZALNY (props `editor`+`state`+`onAICommand`; sam zarządza detekcją „/", stanem `slashState`/`SlashMenuState`@`NotebookContent.tsx:775`, pozycją karetki i wstawianiem bloków przez `editor` — render @`NotebookContent.tsx:3267`). Nowy `NotebookSlashMenu.tsx` (`5bc77b5861`) to CZYSTY komponent prezentacyjny: props `open/query/position/onSelect(blockType: NotebookBlockType)/onClose` — sam NIC nie wstawia ani nie wykrywa. Wpięcie wymaga: (1) podpiąć istniejącą detekcję `slashState` (już działa w starym) do `open/query/position` nowego; (2) mapować ~15 `NotebookBlockType`→komendy TipTap (`editor.chain()...`); (3) routing AI (`onAICommand`→`setAiCommand`). **Live-test = wpisać „/" w żywym notatniku na demo i przejść wszystkie bloki.** Stary DZIAŁA — nie ruszać dopóki nowy w pełni wpięty+zweryfikowany. Ostrożnie (trzewia edytora, żywi klienci).
- N6-2 reszta (drobne), N8 polish.

**ZROBIONE PO HANDOFFIE (sesja-kontynuacja 2026-06-28):**
- **U9 ✅** „Failed to save notebook" (`6d72aab903`) — goły `catch{}` w `NotebookModal.handleSave` połykał realny błąd serwera (403 owner-only / „Not a team member" / 5xx) → teraz doklejony do toasta, generyczny szum (Failed to fetch) ukryty. +2 testy komponentu. *Root-cause najpewniej `canMutateNotebook` owner-only (notatnik nie-własny) — realna przyczyna pokaże się teraz w toaście na żywo.*
- **N5 ✅** (powyżej).

**FAZA 2 (funkcje, ~tygodnie, backend) — D4:** K1 @mention+dwukierunkowe linki (rozbudowa Context=graf wiedzy, NASZ wyróżnik) · K2 bookmark rich-link (backend fetch) · K3 AI rozszerzone · K4 więcej bloków.

**Rozstrzygnięcia (rekomendacje, do potwierdzenia Piotra):** D1 stepper w nagłówku · D2 status pigułka+popover · D3 rich-link FAZA 2 · D4 redesign-UI-najpierw.

## 4. NOWE/ZMIENIONE PLIKI (Notatnik)
Nowe: `src/components/MyWork/notebook/NotebookHamburgerMenu.tsx` (props: x/y/onClose/isPolish + onConvert/onExpandDocument/onAskAI/onDelete… — renderuje item tylko gdy handler), `NotebookSlashMenu.tsx` (props: open/query/position/onSelect/onClose/isPolish; bloki realne vs `// wymaga rozszerzenia edytora`).
Zmienione: `NotebookContent.tsx` (monolit 3505 lin — N1/N3/N4), `NotebookProgressChip.tsx` (flow-stepper), `NotebookContextPanel.tsx` (N6), `MyWorkHub.tsx` (N2 flaga), `tests/components/MyWork/NotebookProgressChip.test.tsx` (labele bez numerków).

## 5. ⚠️ BLOKERY / RYZYKA
- **GIT-RACES: 10 cudzych tsc błędów na branchu** (Ideas reactflow `useNodesInitialized`/`useUpdateNodeInternals`/`fitView`/`DEP_EDGE_COLOR` + Economics brakujące moduły + DocumentStudio `PMDoc`). NIE z Notatnika. **Vite buduje mimo nich** (esbuild ignoruje typy — demo zbudował). ALE Ideas runtime-glitch ryzyko. Zgłoszone: `task_c4a0f1ec`. Gdy robisz tsc, te 10 błędów to szum — filtruj po swoich plikach.
- **Cudzy uncommitted WIP w working tree** (persona.ts/mcpServer.ts/documentSchemaRenderer.ts + nowe pliki) — PRE-EXISTING od początku sesji, NIE moje. NIE commituj ich (cudze).
- **U4/U9 funkcjonalne** niezaadresowane (osobne taski).

## 6. ŚRODOWISKO / DEPLOY
- Demo: `git push origin HEAD:demo` + `./scripts/deploy-demo.sh` (railway session żywa; build ~5min; **uruchom przez run_in_background, NIE `cmd &`** — subshell ginie, build nie triggeruje).
- Weryfikacja: `curl -s -A "Mozilla/5.0" https://demo.consultify.ai/api/health | grep gitSha`.
- tsc duży OOM → `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`.
- vitest Notatnik: `npx vitest run tests/components/MyWork tests/unit/components/MyWork`.

## 7. WZORZEC MULTI-AGENT (reużyj — działał szybko, zero kolizji)
Monolit (NotebookContent 3505 lin) blokuje równoległość. Podział: **agenty na ROZŁĄCZNYCH plikach** (nowe komponenty / izolowane pliki: Context/Hamburger/Slash/MyWorkHub), **ja na monolicie** równolegle (agenty NIE dotykają NotebookContent). Po agentach: ja wpinam komponenty + tsc+vitest całość + commit fale. Każdy agent: „NIE commituj, NIE git, NIE dotykaj <monolit>, tsc czysty na swoim, zwróć props+przykład wpięcia".

## 8. JAK WZNOWIĆ (następny agent)
1. Przeczytaj: TEN plik → `NOTATNIK-REDESIGN-2026-06-28.md` → `_UWAGI_TESTY_PIOTR_2026-06-28.md`. `git log --oneline -20` (stan mógł się ruszyć — inni agenci).
2. **Potwierdź z Piotrem stan demo** (przetestował 5 fal Notatnika? co zostawić/cofnąć?).
3. **Domknij FAZA 1:** N5 lewa kolumna (mockup gotowy) → N7 slash wpięcie (NotebookSlashMenu zamienić stary) → N8 polish. Fala po fali: kod→tsc(filtruj cudzy szum)→vitest→commit(cofalny)→demo.
4. **Potem decyzja Piotra:** FAZA 2 killery (@mention/linki = wyróżnik) czy inny moduł.
5. Każda zmiana UI: pokaż EFEKT Piotrowi (demo/screen/mockup widget), nie kod. Aktualizuj SSOT + pamięć po fali.

## 9. GŁÓWNY PROGRAM (kontekst szerszy)
SSOT: `Harvard/wdrozenie-100/_STAN_PRACY_ODBIORY.md` (8-bramkowy odbiór per moduł, M01-M27). M01-M04 zamknięte 8/8. M05-M17 realizacja zielona (dużo dalej niż dashboard pokazywał — notka 2026-06-26), czeka odbiorów Piotra. Notatnik (M04) był „zamknięty" ale Piotr zażądał redesignu UI (ta sesja). Pamięć między-sesyjna: `memory/MEMORY.md` (findingi/decyzje).
