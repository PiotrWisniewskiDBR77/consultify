# Prezentacja — DeckBuilder (`presentation`)

**Status:** PROPOZYCJA — do słowa właściciela. Karta #55 inwentarza, moduł `11_MATERIALS`.
Zrzut żywy z rundy P10-S już istnieje: `evidence/p10-matryca/21-presentation.png` (+ `.json`),
trasa `/presentations/builder/:deckId` → „Nowa prezentacja". Ten kontrakt UAKTUALNIA matrycę
kodem zmierzonym PO zrzucie (DEC-419 wszedł 06.09, ten sam dzień co pomiar P10-S) — jedna
znaleziona rozbieżność opisana w §2/§4.

## §0. Tożsamość

- Nazwa PL: **Prezentacja** (Deck). Moduł: `11_MATERIALS`. Archetyp: **E — Deck**.
- Trasa: `/presentations/builder/:deckId` (`AppRoutes.tsx:2917`).
- Otwarcie: Materiały → Prezentacje → wiersz → Otwórz.
- Komponent-kontener: `src/components/Presentations/DeckBuilder/DeckBuilder.tsx:1` (2507 linii).
  Powłoka: **`ExecutiveModuleShell`** przez adapter
  `DeckBuilderMelsView.tsx` (montowany `DeckBuilder.tsx:1604`), bramkowany
  `isMelsDeckBuilderEnabled()` — **domyślnie ON** („WS-A4: unified ExecutiveModuleShell
  rendering — now the DEFAULT surface", `melsDeckBuilderFlag.ts:20,39-46`).
- Prawy panel: DeckBuilderMelsView **UŻYWA prawdziwego `ArtifactRightPanel`**
  (`DeckBuilderMelsView.tsx:592-596`) — inaczej niż w pierwotnym grepie po `DeckBuilder.tsx`
  (który go nie importuje bezpośrednio; panel żyje w adapterze, nie w kontenerze).

## §1. Sekcje

Treść (slajdy) nie jest „sekcją" tekstową — centrum to `SlideSorter` + `CardRenderer` (płótno
slajdu). Brak katalogu `KanonicznaKarta` (K1 ✗, zgodnie z matrycą).

## §2. Prawy panel (`ArtifactRightPanel`, `DeckBuilderMelsView.tsx:445-596`)

| sekcja | obecna? | treść |
|---|---|---|
| Akcje | ✓ | Motyw i kolorystyka / Historia wersji / Udostępnij — **BEZ** „Zapytaj Teresę" (usunięte DEC-419, `:472-473`, potwierdzone STRUKTURALNIE: `.filter(Boolean)` na tablicy bez wpisu Teresy, nie tylko komentarzem) |
| Właściwości | ✓, **BEZ tabeli** (K7 ✗, zgodnie z matrycą) | `<dl>` własny (`propertyRows`, `:476-521`): Slajdy/Klasyfikacja/Status/Motyw/Wersja/Edytowane ręcznie |
| Powiązania | warunkowa (`rightRailPanels.relations`) | zależy od danych przekazanych z `DeckBuilder.tsx` |
| Źródła i założenia | warunkowa (`rightRailPanels.evidence`) | jw. |
| Komentarze / Historia | warunkowe | jw. — matryca P10-S potwierdziła obecność na zrzucie `21-presentation.png` |

## §3. Menu 5 i nawigacja

Brak Menu 5 kanonu — `TopBar` ma własny zestaw chipów (Motyw/Historia/Jakość/Governance/
Analytics/Audit/Comments/Share/**Teresa**/Present, `DeckBuilder.tsx:1610-1636`). **Chip „Teresa"
w TopBar jest ŻYWY i widoczny w karcie** (`agent: t('presentations.builder.topBar.teresa',
'Teresa')`, `:1625`, `onToggleAgent: openGlobalTeresa`, `:1649`) — patrz §4.

## §4. AI — częściowa naprawa DEC-419, NIE pełna

Historia tego dnia (06.09.2026), zrekonstruowana z komentarzy w kodzie:

1. **2026-09-01** („jedna Teresa, w swoim oknie"): usunięto WBUDOWANĄ kolumnę czatu 360px
   (`UnifiedChatPanel` osadzony obok płótna) — pozytywna naprawa, drugi pełny czat już nie istnieje
   w żadnym torze. W tym momencie WSZYSTKIE cztery wejścia („Zapytaj Teresę" w Akcjach, pigułka
   Menu 2, stopka, paleta poleceń) nadal wołały `openGlobalTeresa()` z WŁASNYMI etykietami.
2. **DEC-419 (06.09.2026, ten sam dzień co pomiar P10-S)**: usunięto explicit „Zapytaj Teresę o tę
   prezentację" Z SEKCJI AKCJE (`DeckBuilderMelsView.tsx:472,592` — dwa niezależne miejsca w tym
   samym pliku, oba z komentarzem DEC-419) — **potwierdzone strukturalnie, nie tylko komentarzem**:
   tablica `actions` faktycznie nie zawiera już tego wpisu.
3. **CO ZOSTAJE, niezależnie od DEC-419**: chip **„Teresa"** w `TopBar` samej karty
   (`:1625`, `onToggleAgent`) — to jest DALEJ przycisk z literalną nazwą „Teresa" WEWNĄTRZ karty,
   niezależnie od tego, że otwiera globalne okno (nie własny panel). Zrzut `21-presentation.png`
   (matryca P10-S, „✗ Zapytaj Teresę w stopce") mierzył stan SPRZED albo RÓWNOLEGLE z commitem
   DEC-419 — możliwe, że dziś stopka faktycznie już nie ma tego wpisu (usunięty razem z Akcjami),
   ale **TopBar chip „Teresa" nie był częścią naprawy DEC-419 i wciąż istnieje w kodzie**.

Zero `PracujZAI`; `presentation` poza `cardAnalysisRubric.ts`/`registry.ts` (K21 ✗, K24 ✗).

**K27 — częściowo naprawione, NIE spełnione w całości**: Akcje ✓ (naprawione), TopBar chip
„Teresa" ✗ (wciąż literalny przycisk w karcie). Literalne brzmienie K27 („żadnego przycisku
Teresa/Zapytaj Teresę w karcie") obejmuje TopBar tak samo jak panel Akcji — DEC-419 naprawił
jedną z dwóch powierzchni, nie obie.

## §5. Czytelność

Zgodnie z matrycą P10-S (`21-presentation.png.json`): zero primary-*, brak paska modułu z
pigułką (K19 ✗), zero angielskich literałów w treści zrzutu (K25 ✓ w zmierzonym zrzucie).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak katalogu |
| K7 tabela Właściwości | ✗ | `<dl>` własny, matryca + kod zgodne |
| K8–K10 Powiązania/Źródła/Komentarze/Historia | ✓ warunkowo | matryca `21-presentation.png` |
| K12 Menu 5 | ✗ | brak, zamiast tego TopBar z chipami |
| K19 pigułka modułu | ✗ | matryca (własny pasek edytora slajdów) |
| K21 Pracuj z AI | ✗ | zero `PracujZAI` |
| K25 i18n | ✓ | matryca (zrzut czysty) |
| K27 Teresa tylko Menu 1 | **~ częściowo naprawione** | Akcje ✓ (DEC-419, strukturalnie potwierdzone), TopBar chip „Teresa" ✗ (wciąż w kodzie) |
| K30 zrzut 1440 z realnym rekordem | ✓ | `evidence/p10-matryca/21-presentation.png`, ale SPRZED/RÓWNOLEGLE z DEC-419 — wymaga re-zrzutu żeby potwierdzić stan PO |

## §7. Luki → naprawa

1. **Chip „Teresa" w TopBar (K27)** — jedyna pozostała żywa etykieta „Teresa" wewnątrz karty po
   DEC-419; usunąć literalną nazwę z chipu albo przenieść samo wejście poza Menu 4/5 karty (do
   Menu 1), zgodnie z duchem DEC-419/DEC-404. Rozmiar S, Sonnet — ale **wymaga potwierdzenia
   właściciela, że to rzeczywiście wykracza poza zakres DEC-419** (mogło być świadomie
   zostawione jako jedyne, legalne wejście „chip → globalne okno").
2. **Właściwości → `ArtifactPropertiesTable`** (K7), analogicznie do `document.md`/`sheet.md`.
   Rozmiar S, Sonnet.
3. **Menu 5 kanoniczne + „Pracuj z AI"** (K12/K21) — ta sama decyzja architektoniczna co w
   `document.md` pkt 3 (deck ma inną naturę treści — slajdy, nie tekst/sekcje). Rozmiar L, Opus.
4. **Pasek modułu z pigułką** (K19) — matryca P10-S już to przypisała jako pozycję 3.2
   (Sonnet, razem z `audit-report`/`assessment-report`/`audit-criterion`).

**STOP:** re-zrzut 1440 potrzebny PO DEC-419, żeby potwierdzić czy stopka/pigułka Menu 2 nadal
pokazują „Zapytaj Teresę" (zrzut istniejący mógł być zrobiony tego samego dnia, przed commitem —
kolejność czasowa nie jest jednoznaczna z samych komentarzy w kodzie).

---

## Alias: Prezentacja udostępniona (`presentation-shared`, #56)

Zobacz `presentation-shared.md` — publiczny widok BEZ logowania, poza zakresem K1–K30 (nie jest
kartą N otwieraną z listy przez członka organizacji).
