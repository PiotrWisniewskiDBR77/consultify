# Odbiór na żywo 05.09 — pakiet 04 „Narzędzia” (8 ekranów)

## Liczby
- ZGODNY: 2
- ROZNI_SIE: 4
- NIE_DOTARLEM: 2

## ★ Ustalenie, które psuje sam pomiar
Cztery z ośmiu „obrazów zatwierdzonych” w tym pakiecie (wszystkie z `evidence/grafika/15-domkniecie/`: tools-swot-library-detail, tools-swot-session-workspace, tools-outputs-insights-tab, tools-sesja-wyjscie) **nie są zrzutami ekranu**. Każdy z nich ma 2880×11666 px i pokazuje stronę błędu harnessu: „Dev Render Harness · Unknown ?screen=… · Available screens:” z listą wszystkich dostępnych ekranów. Właściciel nigdy nie widział tych czterech ekranów — ocenił ścianę tekstu. Dla nich zapisałem realny stan na żywo, ale werdyktu „zgodny” postawić się nie da.

## Różnice
1. **tools-swot-library-detail** — obraz odniesienia to strona błędu harnessu; na żywo karta „Dynamic SWOT” istnieje i wygląda poprawnie.
2. **tools-swot-session-workspace** — obraz odniesienia to strona błędu harnessu; na żywo warsztat pięciu kroków z licznikami istnieje, ale sesja ma 0% i nie widać propozycji AI.
3. **tools-outputs-insights-tab** — obraz odniesienia to strona błędu harnessu; na żywo zakładka „Insighty” NIE jest pusta (7 wierszy), w tym trzy identyczne duplikaty „Sekcja finansowa — 2025 (2026-08-09)”; typy w kolumnie TYP mieszają polski z angielskim.
4. **tools-sesja-wyjscie** — obraz odniesienia to strona błędu harnessu; zmierzone: kebab sesji ma tylko „Skopiuj kod obiektu” i „Kopiuj link”, bez pauzy i zakończenia — wychodzi się strzałką „<” albo chipem „Lista”.

## Zgodne
- **karta-tool** — pełna zgodność kompozycji z obrazem (nagłówek z sześcioma akcjami, szyna sekcji, blok pozycjonowania, cztery kafle, prawy panel AKCJE + WŁAŚCIWOŚCI + pięć zwiniętych sekcji). Różnice tylko w danych/języku treści (nazwa „Dynamic SWOT”, tagi po angielsku).
- **tools-swot-initiative-proposal** — karta „Wyniki i gotowość” ma tę samą budowę i te same cztery pozycje kompletności; różnica to 0/4 „Niegotowe” zamiast 4/4 (sesja pusta). Uwaga: „Niegotowe” jest w czerwieni mimo braku znaczenia krytycznego.

## Nie dotarłem
- **tools-swot-report** — raport powstaje z ZAKOŃCZONEJ sesji SWOT, a chip „Zakończony” = 0 i wszystkie sesje „Dynamic SWOT — Session” stoją na 0%; generowania nie uruchamiałem.
- **prompt-registry-tab** — konto właściciela nie ma dostępu do SuperAdmina: `/superadmin*` przekierowuje na `/chat`; dodatkowo rejestr jest za flagą `promptRegistryUiEnabled`.

## Inne rzeczy warte uwagi
- Wszystkie **29 sesji ze statusem „Zatwierdzone”** (typ SWT, 100%, nazwy „MyWork idea: …”) otwierają się w angielskim widoku awaryjnym z surowym JSON-em: „Why you saw the placeholder — This session uses a tool type that doesn't have a dedicated UI yet”. To najbardziej rzucający się w oczy defekt tego modułu.
- Zakładka „Sesje” ładuje się bardzo długo (>20 s) i w trakcie ładowania sypie ~21 błędami konsoli typu „Failed to fetch”.
- Podtrasy `/discovery-tools/{strategic,operational,digital,process-automation}` działają i filtrują listę, ale chip „Wszystkie 36” zostaje wizualnie aktywny, więc nie widać, że filtr jest nałożony.

## Czas i trudności
Ok. 50 min. Trudności: (1) cztery bezużyteczne obrazy odniesienia; (2) karty narzędzi nie da się otworzyć adresem — parametr `docId` jest gubiony przy wejściu z URL, trzeba dwuklikać wiersz; (3) w połowie pracy zniknął mój katalog na skrypty w /private/tmp (usunięty spoza tej sesji) i trzeba go było odtworzyć.
