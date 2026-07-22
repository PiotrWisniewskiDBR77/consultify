# PROMPT DLA NASTĘPCY — redesign IDEE (wklej to na start nowej sesji)

Jesteś sesją roboczą Consultify. Kontynuujesz redesign 4 narzędzi canvas grupy IDEE (Mind Map · Whiteboard · Process Flow · Table) do poziomu LIDERA rynku (Miro/FigJam · Whimsical · Lucidchart · Airtable). Poprzednia sesja zamknęła okno kontekstowe — cały stan jest na dysku.

## ZANIM COKOLWIEK ZROBISZ
1. Przeczytaj SSOT stanu: `Harvard/wdrozenie-100/_HANDOFF_IDEE_2026-07-22.md` (od góry — ma wszystko: gałęzie, harness renderu bez logowania, fakty runtime, reguły).
2. Przeczytaj SSOT redesignu: `Harvard/wdrozenie-100/_ANALIZA_IDEE_4_NARZEDZIA_2026-07-22.md` (kryteria K1–K9, macierz PRZED, plan Faza 0–5).
3. Checklisty parytetu lidera: `_FAZA0_PARYTET_{WHITEBOARD_MIRO,TABELA_AIRTABLE,MINDMAP_WHIMSICAL,PROCESS_LUCIDCHART}.md`.
4. Wywołaj skille: `consultify-artefakty`, `consultify-finisz-modulu`, `consultify-petla`, `consultify-test`.

## GDZIE JEST PRACA
- Gałąź robocza: `audyt-idee-2026-07-22` (worktree `.worktrees/audyt-idee`, od origin/demo). **NIC NIE WYPCHNIĘTE, nic na demo.**
- Na niej zacommitowane: 3 fixy silnika (okno budowy honoruje narzędzie = IDE-001, badge listy, jakość treści Teresy) + PO/1 (Mind Map orb zdjęty, trackpad-pan) + wszystkie dokumenty.

## ZADANIE #1 (natychmiast) — zintegruj i zweryfikuj 3 gałęzie PO agentów
Trzy fixy prawego-kliku/toolbara są GOTOWE na osobnych gałęziach, esbuild-czyste, ale **NIE renderowane** (reguła #7 niespełniona — to Twój obowiązek):
- Whiteboard prawy-klik: `worktree-agent-acfd08ac847f8e43e` (`457f2753fb`)
- Process toolbar: `worktree-agent-a4ba735dbf206d5e6` (`d3303857d5`)
- Table prawy-klik: `worktree-agent-aab28db457aa7d60b` (`e30de81093`) — ⚠ SPRAWDŹ czy nowy kebab nie DUBLUJE istniejącego menu (rozbieżność: agent twierdził że menu nie istniało, a zrzut je pokazał — zweryfikuj który widok renderuje).
Dla każdej: przejrzyj diff (`git log -p <gałąź>`), zintegruj do `audyt-idee-2026-07-22` (cherry-pick/merge — pliki są rozłączne, konflikt mało prawdopodobny), **URUCHOM harness renderu (§4 handoffu), zrób zrzut PRZED/PO, oba motywy**. Dopiero z czystymi zrzutami idź do Piotra po akcept.

## HARNESS RENDERU (Twój obowiązek — Piotr NIGDY nie jest pierwszym testerem wizualnym)
Pełna instrukcja w §4 handoffu. Skrót: backend `E2E_MODE=true` + dummy JWT_SECRET + read-only; mint JWT `{e2e:true,id,org}`; **Playwright/chromium** (przeglądarka Claude blokuje wstrzyknięcie tokenu); user renderu = `0fe55f96`/org `7504ff08` (NIE `d2b6a316` — anomalia membership → fałszywy „zawsze mindmap"); idee: mindmap `fb9b7358-...`, whiteboard `7681386f-...`, process `64ed2e0e-...`, table `df41b69d-...`; deep-link `/my-work/ideas/<id>/workspace/<tool>`. iCloud psuje HMR → po edycji frontendu RESTART frontendu + `curl` sprawdza czy kod serwowany.

## POTEM — kolejka PO (kolejność wg planu Faza 3, najboleśniejsze najpierw)
1. Wspólne K9: **snapping + prowadnice wyrównania** (dziś brak w ogóle), **pasek stylu czcionka/kolor per element** (dziś brak — kolor sticky losowany raz przy tworzeniu).
2. Whiteboard: naprawić half-rendered overlay (fazy warsztatu) top-left; empty-state.
3. Table: nawigacja Tab/strzałki między komórkami, zaznaczanie zakresu + kopiuj/wklej.
4. Process: connector magnetyczny (dziś tylko L→P handles).
5. Mind Map: emoji/ikony na węźle; hex `BRANCH_COLORS` → tokeny `c-*`.
6. **Faza 1 = wspólna POWŁOKA** (Menu 1 + jeden wzorzec górnego paska + uproszczony prawy panel + wspólny baseline prawego-kliku + tokeny) — prototyp → wstępny OK Piotra → render → accept.

## REGUŁY (nienaruszalne)
- Nic na demo bez akceptu Piotra na zrzutach. Reguła #7: prototyp→OK→render-SAM→accept.
- Baza gałęzi = origin/demo. Zero crimson w nowym kodzie (hook check-triada/check-artefakt blokuje; uwaga: `c-accent`=crimson). Weryfikuj REALNY runtime, nie flagi/docy.
- Wypuszczaj wielu agentów równolegle (izolacja worktree, żeby się nie klobrowały), ale render/verify serializuj (jeden port). Rób DOKUMENTACJĘ na bieżąco (okna się zamykają).
- Model: Sonnet robotnik, Opus trudny kod, ZERO Fable u robotników.
