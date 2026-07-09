# PRZEGLĄD DOMOWY — plan (wklej sobie, klikaj po kolei)

> demo.consultify.ai · zaloguj się normalnie · Ctrl/Cmd+Shift+R jeśli coś nie odświeżone.
> Dla każdego ekranu: obejrzyj dark+light, powiedz **✅ promuj / ✏️ popraw: co / ⏸ cofnij**.
> Stan repo posprzątany: worktree/gałęzie zredukowane, demo = `643f4f19cd`, health OK.

## CZĘŚĆ A — domyślnie WIDOCZNE, kliknij po kolei (11 ekranów)

| # | Ekran | Co sprawdzić | Skąd |
|---|-------|--------------|------|
| 1 | **Initiative** (dowolna) | Primary CTA w nagłówku (przejście stanu) — działa, nie zawija się | A3 |
| 2 | **Insight** (Interview → dowolny) | Prawy panel: Akcje/Właściwości/Powiązania/Komentarze/Historia, primary CTA | A1 |
| 3 | **Decision** (My Work → Decisions) | Prawy panel, primary „Zatwierdź", nagłówek się nie przelewa | A1 |
| 4 | **Mind Map** (My Work → Ideas) | Prawy panel bez ściśnięcia; z Insight/Decision kafelki statystyk się nie ściskają | A1+A2 fix |
| 5 | **Idea Table** (My Work → Ideas → Table) | **Prawy klik na wierszu** → Edytuj/Dodaj notatkę/Powiel/Usuń — nowa funkcja; sprawdź czy „Powiel wiersz" faktycznie klonuje | quick-wins |
| 6 | **Deck** (Materiały → Prezentacje → dowolny) | Nagłówek: status „Saving/Saved" + pill draft/generated widoczne w nagłówku (nie w Historii) | quick-wins |
| 7 | **Deck → prawy klik na slajdzie** (nawigator z lewej) | Nowa pozycja „Przenieś ▸" (góra/dół/pozycja) | quick-wins |
| 8 | **Deck → prawy rail → zakładka „Powiązania"** (ikona łańcucha, 5. zakładka) | Zbiorcza lista źródeł decka (inicjatywy/insighty), dedup + licznik „użyte N×", klik → skok do rodzica | deck-relations |
| 9 | **Prezentacje** (Materiały → Prezentacje, ekran generatora) | **CAŁA NOWA POWŁOKA** — Export PPTX primary, nawigator slajdów z lewej, activity z prawej. Praca równoległej sesji nocnej — patrz krytycznie | flip ON |
| 10 | **Tabele** (Materiały → Tabele) | **CAŁA NOWA POWŁOKA** — jak wyżej | flip ON |
| 11 | **Excel** (Materiały → Excel/Sheet, generator) ⚠ NOWE, nieobejrzane nawet przeze mnie | Nowa powłoka MELS: sprawdź czy w ogóle renderuje się bez błędu, Export .xlsx primary, lewy rail | vegas/excel-mels-shell — **jeszcze NA GAŁĘZI, nie na demo** — patrz uwaga niżej |

**Uwaga #11:** ta gałąź nie jest scalona (zbudowana równolegle w nocy, 1064 linii, 7 nowych plików — nie zdążyłem jej zweryfikować). Jeśli chcesz ją zobaczyć dziś, powiedz — scalam ostrożnie na osobnej gałęzi testowej, nie na żywe demo, zanim ją obejrzysz.

## CZĘŚĆ B — ZA FLAGĄ (dopisz do URL paska adresu, Enter — świadomie NIE promowane)

| # | Ekran | URL-dopisek | Dlaczego OFF |
|---|-------|-------------|---------------|
| 12 | Mind Map — nowa powłoka canvas | `?ff_melsCanvas=1` | Rdzeń Ideas (90+) — nie ryzykowałem regresji bez Twojego oka |
| 13 | Mind Map — skonsolidowany panel | `?ff_melsMindmapPanel=1` | jw. — 1 ArtifactRightPanel zamiast 3 legacy paneli |

Werdykt #12-13 decyduje: zostać na legacy, czy flip domyślnie ON.

## CZĘŚĆ C — Oxford: 3 rzeczy do zobaczenia i 1 decyzja (nowe dziś, jeszcze nigdzie nieklikane)

| # | Co | Gdzie | Pytanie |
|---|----|-------|---------|
| 14 | **Risk & Uncertainty** (Tools → biblioteka) | jedyne z 19 narzędzi Oxford realnie użyte (1 sesja w bazie) — poziom SWOT | Otwórz, sprawdź czy output faktycznie jest board-ready |
| 15 | **13 „prawie gotowych" narzędzi** (SOP/A3/SMED/DMS/Inventory/AI Discovery/Pain Explorer/RPA/Process Automation/Capability Mapper/Ambition Decomposer/Focus&Trade-offs/Narrative Engine) | Tools → biblioteka | Są technicznie klikalne, ale **0 sesji nigdy** — kliknij 2-3 na chybił trafił i powiedz czy output jest sensowny, czy się sypie |
| — | **Decyzja UX „Pogłęb pozycję"** | — | 12/14 narzędzi ma martwy przycisk dogłębiania (surface→evidence→quantification→risk). To nowa funkcja UI, nie bug — wymaga Twojej decyzji: budować teraz, czy odłożyć? |

## CZĘŚĆ D — wyrównanie kontraktu (status po dziś)
- **Deck „Powiązania"** ✅ zrobione → ekran #8.
- **Word „Powiązania"** (link do rodzica) ⏸ czeka Twoją decyzję o miejscu (Sources ≠ Powiązania).
- **Notatnik „AI w zaznaczeniu"** ⛔ to nowa funkcja backendu (endpoint replace-in-range) — osobny task po zgodzie.

## CZĘŚĆ E — świadomie NIE dotykane w tej fali
- Kolorystyka/crimson-sweep — osobny etap na koniec (Twoja decyzja 07-08).
- Landing — osobny etap (Twój werdykt 07-09: prod delikatniejszy).
- Excel-grid — decyzja D-EXCEL: Idea Table = powłoka, nie budujemy edytora-grida.
- Silnik B2 (Teresa→WorkbookGeneratorService) — osobny tor, nie powłoka.

## Dashboard żywy (obraz całości, aktualny)
[status-3-filary](https://claude.ai/code/artifact/02cf797f-9791-43ef-ad3e-392cdc0ad533) — ma teraz kolumnę **„Twój odbiór"** przy każdym elemencie (Harvard/Vegas-tabele/Vegas-artefakty/Oxford) — możesz wpisywać werdykt bezpośrednio tam po przejściu checklisty.

## Jak wydawać werdykt (żeby było szybkie)
Dla każdego numeru: **✅ promuj** / **✏️ popraw: co** / **⏸ cofnij flagę**. Wklej mi listę numer→werdykt, rozdzielę na zadania dla robotników.
