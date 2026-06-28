# NOTATNIK (M04) — redesign UI/UX do 2026-grade (spec, ZATWIERDZONY KIERUNEK)

> **Status:** Piotr zatwierdził kierunek 2026-06-28 („tak robimy"). Zbieram jeszcze uwagi przed implementacją (NotebookContent.tsx = 3505 linii → komplet wymagań przed kodem).
> **Mandat:** „nie wygląda jak profesjonalny notatnik… zaplanuj układ lepiej… nazwa i z prawej hamburger… super profesjonalne, zgodne z naszymi planami."
> **Mockupy zatwierdzone:** czysty edytor + hamburger (widget `notebook_redesign_clean_layout`) · nagłówek (widget `notebook_header_redesign`).
> **Zasada nadrzędna:** funkcje OK — przebudowa CZYSTO prezentacyjna + reorganizacja (zero utraty funkcji). Egzekucja kanonu, nie nowy kanon.

## 1. Diagnoza (co nieprofesjonalne dziś)
3 konkurujące strefy akcji naraz: (a) górny stepper `① Sources · ② AI · ③ Review · ④ Convert · Initiatives` (numerki = mylący wymuszony porządek), (b) surowe `<select>` Verification/Review z zielonymi tekstami inline, (c) **stały prawy panel „Tools"** (Insert block / AI / Create from note / Transform). To „panel sterowania", nie notatnik. Anty-Notion/Craft.

## 2. Docelowy układ (zatwierdzony)
**Czysty edytor + JEDNO hamburger menu (⋯) z prawej.** Mapowanie:
| Element dziś | Cel |
|---|---|
| Pasek Sources/AI/Review/Convert/Initiatives | lekki „flow dojrzewania notatki" (chevrony, monochrome) — **decyzja D1**: w nagłówku czy pod hamburger |
| Stały prawy panel „Tools" | **USUNĄĆ** — Insert przez slash `/`, reszta → hamburger |
| Insert block (Callout/Table/Toggle/Divider) | slash `/` w treści |
| Create from note (7 kafli) | hamburger „Convert to" |
| Transform text | hamburger „AI" + floating toolbar na zaznaczeniu |
| Verification/Review `<select>` inline | **wyciszone pigułki + popover** (klik → zmień), nie surowy select |
| Expand into document | hamburger „Note" |
| Top formatting toolbar | zostaje SLIM lub floating na zaznaczeniu |

## 3. Nagłówek notatki (zatwierdzony mockup)
- Ikona w subtelnym kontenerze (nie gołe emoji) + tytuł **22px/500**.
- Tagi + plik = jedna wyciszona monochrome linia.
- Status = pigułki: `Verified` (success subtelny zielony — semantyczny, w budżecie czerwieni), `Reviewed 3h · monthly` (neutral), `Mark reviewed` (ghost). Zmiana = popover (**decyzja D2**).
- Flow-stepper: chevrony zamiast numerków, aktywny etap monochrome-podświetlony, w jednym wyciszonym kontenerze.

## 4. Zgodność z kanonem
monochrome-chrome (slate/navy, aktywne podświetlone nie kolorowe) · budżet czerwieni (tylko success/danger semantyczne) · typografia 22/12px · hierarchia tytuł›meta›status›flow · module-hub progresywne ujawnianie · workspace-3-tools-strip (panel prawy on-demand, nie stały).

## 5. Plan implementacji (fale — po zebraniu wszystkich uwag)
- **N1** — komponent hamburger menu (zbiera akcje z paska + RightRail → pogrupowany dropdown: Note / Convert to / AI / Danger).
- **N2** — usunięcie stałego RightRail (`NotebookRightRail.tsx`) + numerowanego paska z głównego widoku → przeniesienie do N1.
- **N3** — nagłówek: tytuł+ikona, metadata 1-linia, status-pigułki+popover (wg §3).
- **N4** — slash `/` insert + floating format toolbar na zaznaczeniu.
- **N5** — polish: typografia, spacing, oddech Notion-grade.
Każda fala: kod → tsc → vitest → commit → demo. Funkcje zachowane.

## 6. DECYZJE — rozstrzygnięte (rekomendacja CTO 2026-06-28, do potwierdzenia Piotra)
- **D1** — flow-stepper: **w nagłówku, czysty** (chevrony, monochrome). Wartość workflow widoczna, zajmuje 1 wąski rząd. Mockup zaakceptowany.
- **D2** — status: **pigułka + popover** (klik „Verified"/„Reviewed" → zmiana w popoverze). Zero surowych `<select>` w głównym widoku.
- **D3** — rich-link: **FAZA 2** (po redesign UI). Wymaga backendu (fetch metadanych).
- **D4** — skala: **redesign UI najpierw (FAZA 1, dni), killery FAZA 2 (program, tygodnie).** Wyjątek: slash `/` menu wchodzi do FAZA 1 (fundament UX + szybkość). Uzasadnienie: na czystym edytorze łatwiej dokładać moc; szybka widoczna wygrana.

## 8. SYNTEZA — pełny układ (mockup `notebook_full_redesign_overview`)
Wszystkie uwagi w jednym spójnym ekranie: górny pasek **bez 3-tools-strip** (U10) · lewa kolumna = **Capture + filtr zakresu + filtr widoku + lista** (U11) · główny **czysty edytor** z przeprojektowanym nagłówkiem (§3) + **ikony-tooltip prawego menu** (U12) + **akcje pod ⋯** (hamburger zamiast stałego panelu Tools) · podpowiedzi `/` i `@` w treści. Spójność z aplikacją: **monochrome-chrome, budżet czerwieni, typografia 22/18/12px, hamburger-wzorzec jak Ideas (U5/U6), te same prymitywy** (`Button` ghost/secondary, chipy Menu3). Notatnik przestaje być „panelem sterowania" → staje się czystym narzędziem klasy Notion/Craft z konsultingowym grafem wiedzy.

## 9. PLAN WYKONAWCZY — 2 fazy

### FAZA 1 — Redesign UI (spójny wygląd, ~dni, niskie ryzyko, demo-first)
- **N1** ⬜ — hamburger ⋯ menu: zbiera akcje z paska (Sources/Convert/Initiatives) + `NotebookRightRail` Tools → pogrupowany dropdown (Note / Convert to / AI / Danger). Usuwa stały prawy panel.
- **N2** ⬜ — usuń 3-tools-strip z topbara My Work (U10); Context → on-demand pod ⋯ / ikona grafu.
- **N3** ✅ — nagłówek lifecycle strip: surowe `<select>` Verification/Review + UPPERCASE labele + emerald-fill button → **czyste status-pigułki** (verified→emerald, disputed→amber, unverified→slate; review neutral; Mark reviewed ghost). `56b53ca9` na demo. *(pełny header §3 — ikona+tytuł 22/500 + meta 1-linia + flow-stepper chevrony = kolejny krok)*.
- **N4** ✅ — prawe menu edytora ikony+tooltip (U12): Expand→ikona, History/Network→monochrome. `e727ee1af2`. *(Layers/rail toggle zostaje do N1)*.
- **N5** ✅ — lewa kolumna (U11): Capture + 2 filtry + czysta lista; usuń Inbox/Active/All taby, progress bar, słońce-toggle, filtr-ikonę. **ZROBIONE** `b3dc957231` (patrz niżej).
- **N6** 🟡 — Context panel (U14): **UUID→czytelne nazwy ✅** (`e727ee1af2`: usunięty `typ·UUID` row, etykiety PL/EN, status-chip). ZOSTAJE: ukryć puste sekcje, zweryfikować Insert/Open.
- **N7** ⬜ — slash `/` menu: insert bloków (`BLOCK_TYPES_CANON.md`) + markdown skróty.
- **N8** ✅ — **floating format toolbar** (`dfbb6fd53f`): selection bubble menu (Bold/Italic/Underline/Strike·Code/Highlight/Link) = `NotebookBubbleToolbar.tsx`, reużywa komend `NotebookToolbar`, monochrome, `shouldShow` chowa dla pustego/code-block/node-selection. TipTap v3 → `@tiptap/react/menus`. Stub w manual-gate (BubbleMenu nie montuje się na mocku edytora). 260 testów zielone. *(typografia/spacing = drobny dalszy szlif, nie-blokujący)*.
Każda fala: kod → tsc → vitest → commit → demo. Funkcje zachowane. **Zrobione 2026-06-28 (multi-agent, 4 agenty równolegle + ja na monolicie):**
- **N1 ✅** hamburger ⋯ wpięty (`c8fb71081e`): ⋯ button → NotebookHamburgerMenu (Note/Convert/AI/Danger). *(addytywny — panel/rail jeszcze zostaje, pełne zastąpienie po N7 slash przejmie Insert)*.
- **N2 ✅** 3-tools-strip ukryty za odwracalną flagą `SHOW_LEGACY_NOTEBOOK_TOOLS_STRIP=false` (`ee300c1598`).
- **N3 ✅** nagłówek: lifecycle pigułki + flow-stepper numerki→chevrony (`0721098362`) + N4 ikony+tooltip (wcześniej).
- **N6 ✅** Context: UUID-fix + puste sekcje ukryte + Insert/Open zweryfikowane żywe (`8a419df97f`).
- **N7 ✅** slash premium (`85e975df76`): upgrade **sprawdzonego** `SlashMenu.tsx` na grupowany layout (nagłówki Basic/Insert/AI/Create + kafelki ikon + czysty active-state), zachowując WSZYSTKIE 23 komendy + detekcję „/" + wstawianie + AI-routing + klawiaturę. **Świadomie NIE wpięto `NotebookSlashMenu.tsx`** (build równoległy): gubił 6 działających komend (date/columns/warning + Create Task/Decision/Idea) i emitował AI-słownik bez backendu (ai-continue/ai-summarize) → wpięcie = regresja. Premium-UX dostarczony w żywym komponencie, zero ryzyka trzewi edytora. Grupa z `id` mapą (23 obiekty nietknięte). Behavior 17/17 zielone. *NotebookSlashMenu = martwy/superseded, do usunięcia po koordynacji z autorem.*
- **N5 ✅** lewa kolumna (`b3dc957231`): **Capture** (NotebookQuickCapture na górze) + **segmented zakres** Wszystkie·Moje·Zespół (wg `ownerUserId`, auto-chowa się gdy brak stron zespołu) + **chipy widoku** Wszystkie·Przypięte·Ostatnie·Do przeglądu·Świeże (spłaszczone sekcje Today, z live-licznikami) + czysta lista. Usunięte: taby Inbox/Active/All (status żyje w **Menu 3 huba** — koniec dublowania), słońce/Today-mode, filtr-ikona+selecty sort/maturity, pasek „progress" maturity. Empty-state świadomy filtra. Martwe importy (Sun/Filter/Inbox/ChevronDown/NotebookTodayView) + `todayRefreshKey` usunięte. tsc+vitest (57 plików/260) zielone. *Decyzja: „Moje/Zespół" = autor strony (oś niezależna od statusu); rich-link wrzutek = FAZA 2 (D3).*
- **U9 ✅** (przy okazji) „Failed to save notebook" (`6d72aab903`): goły `catch{}` w NotebookModal połykał realny błąd serwera (403 owner-only / 5xx) → teraz doklejony, generyczny szum ukryty; +2 testy.
**Cofalność:** każda fala = osobny commit (Piotr: „żeby móc cofnąć"). **GIT-RACES:** rebase wciągnął cudzy WIP z 10 tsc-błędami (Ideas reactflow/Economics/DocumentStudio — NIE Notatnik; vite buduje, ale Ideas runtime ryzyko — osobny problem brancha).

### FAZA 2 — Killery funkcjonalne (program, ~tygodnie, backend) — D4
- **K1** 🟢 PIERWSZY PRZYROST DONE (`df21cc84ac`) — @mention + **dwukierunkowe linki** notatka↔artefakty. Wpisz „@" w edytorze → szukaj inicjatyw/zadań/decyzji/pomysłów/notatek → wstaw inline `embeddedRef` + krawędź grafu (note→encja) → encja dostaje backlink do notatki (Context panel już pokazuje). **REUŻYTO CAŁY istniejący backend** (`link_graph_edges`+backlinks API, `EmbeddedRefNode`, search endpointy, embed-chip resolve) — zero nowego backendu, zero nowych zależności. Nowy `NotebookMentionMenu.tsx` (mirror wzorca SlashMenu: `detectMentionTrigger`, „@" tylko po spacji/starcie→maile nie triggerują, query wielowyrazowe+PL). tsc+260+7 testów+vite build zielone. **ZOSTAŁO K1:** podgląd backlinków w samym edytorze (nie tylko Context panel) + ewentualnie note↔note widoczność. NASZ wyróżnik ponad Notion.
- **K2** — bookmark rich-link (backend fetch tytuł/opis/favicon + AI-summary) — wiąże capture U11/D3.
- **K3** — AI rozszerzone (pisz-dalej / podsumuj / action-items / zapytaj-o-notatkę) — ponad obecne Command/Chat/Translate/Style.
- **K4** — więcej bloków (nagłówki/listy/kod/obraz/cytat) — pełny edytor blokowy.

## 7. DALSZE UWAGI PIOTRA (zbieram — „to nie koniec moich uwag")

- **U10 — usunąć redundantny 3-tools-strip** (3 ikony: suwaki=Tools / żarówka=Context / dymek=AI-suggestions) z topbara. Piotr: „kilka poziomów menu i sterowania — te przyciski nie są już potrzebne, bo mamy te w oknie." **Ustalenie:** to `workspace-3-tools-strip` (kanon `02-components/workspace-3-tools-strip.md`) otwierający prawy panel — ale po wprowadzeniu hamburger ⋯ + akcji w oknie staje się **zdublowanym poziomem nawigacji**. **UWAGA: strip jest WSPÓLNY** dla zakładek My Work (Ideas/Notebook/Inbox/…), nie tylko Notatnika → usunięcie/konsolidacja dotyka całego huba My Work (komponent topbar `MyWorkHub`/wspólny). Decyzja architektury: hamburger per-kontekst zastępuje globalny 3-strip. **Wiąże z redesignem (N1 hamburger).** Spójność: ten sam wzorzec „1 menu zamiast kilku poziomów" w Ideas (U5/U6) i Notatkach.

- **U11 — lewa kolumna (sterowanie listy):** z 5 nakładających się przełączników (Inbox/Active/All taby + Today-toggle + filtr-ikona + 4 sekcje Today) → **2 filtry + Capture**. (1) Capture na wierzchu („Drop a thought or link"); (2) filtr zakresu segmented `Wszystkie · Moje · Zespół` (`scopeFilter` istnieje); (3) filtr widoku chipy `Wszystkie · Przypięte · Ostatnie · Do przeglądu · Świeże` (spłaszczone sekcje Today); (4) czysta lista kart. Znika: Inbox/Active/All taby, progress bar, słońce-toggle, osobna filtr-ikona. Mockup: widget `notebook_left_column_control`. **RICH-LINK (osobny feature, decyzja D3):** dziś `NotebookQuickCapture.tsx` zapisuje surowy URL jako treść; propozycja = backend fetch tytuł+opis+favicon (+AI-summary 1 zdanie) → czytelny bookmark zamiast gołego URL. Wymaga server-side (CORS). *(domyślnie: UI sterowania teraz, rich-link osobny krok)*.
- **U12 — prawe menu edytora = same ikony + tooltip** (Piotr: „zrob same ikony z rozwijanym tekstem czego dotyczą"). `NotebookContent.tsx:~2695`: „Expand into document" (tekst) → **ikona `file-export` + tooltip** „Rozwiń w dokument"; Network (graf powiązań) już ikona+tooltip ✓; Layers (toggle prawego rail) → **USUNĄĆ** (rail znika wg U10, hamburger ⋯ zastępuje). Wzorzec spójny z F-B ProcessFlowToolbar (icon-only+title). Wpina się w N4.

- **U13 — panel Tools funkcjonalnie ubogi** (Piotr: „graficznie OK, funkcjonalnie ubogie, nie na poziomie najlepszych"). Mamy: 5 bloków (Callout/Warning/Toggle/Table/Divider) + AI (Command/Chat) + 7 convert + 2 transform. Brak vs Notion/Craft/Reflect: slash `/` menu + markdown skróty, bogate bloki (nagłówki/listy/kod/obraz/bookmark/kolumny/równania), @mention + dwukierunkowe linki, AI rozszerzone (pisz-dalej/podsumuj/action-items/zapytaj). **4 KILLERY (rekomendacja, nie cały Notion):** (1) slash `/` + markdown; (2) @mention + dwukierunkowe linki notatka↔artefakty (NASZ wyróżnik — patrz U14); (3) AI rozszerzone; (4) bookmark z podglądem (wiąże U11 rich-link). Mockup: widget `notebook_slash_command_premium`. **D4 (decyzja skali):** killery RAZEM z redesignem (program tygodnie+backend) czy redesign-UI-najpierw (dni) → killery jako następny program? *(rekomendacja: redesign najpierw, killery potem)*.
- **U14 — panel Context „nie działa + vintage"** (Piotr). **Ustalenie: NIE martwy** — `NotebookContextPanel.tsx` (850 lin) ma realne API (initiatives/backlinks/tasks/decisions/linked-outputs via `useArtifactOutputsForInitiatives`). **Wrażenie „nie działa" z prezentacji:** (a) **surowe UUID zamiast nazw** (`adec3630-ce63…` jako nazwa inicjatywy = dev-leak/„vintage"); (b) puste sekcje renderowane mimo 0 (Ideas/Linked outputs „No suggestions" — martwo wygląda); (c) za dużo sekcji bez hierarchii; (d) Insert/Open — zweryfikować czy handlery żywe (ryzyko martwe jak U7). **To FUNDAMENT killera #2** (graf wiedzy) — naprawa: UUID→nazwy, ukryć/zwinąć puste, zweryfikować Insert/Open, redesign kart, scalić z hamburgerem (Context = część ⋯ lub on-demand, nie stały vintage panel). Wiąże U13.

*(dopisuję U15+ w miarę testów, zanim ruszę kod)*
