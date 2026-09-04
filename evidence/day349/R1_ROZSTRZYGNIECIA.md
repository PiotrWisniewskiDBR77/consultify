# Dyżur 349 — R1: rozstrzygnięcie czterech czerwieni

Pomiar wejściowy: `/private/tmp/cx-day349-czerwien-ui-artefakty/ui-przed.json`, `62` wykonane, `58` zielonych, `4` czerwone, `--retry=0`. Pełne nazwy są w `/private/tmp/cx-day349-czerwien-ui-artefakty/przed-nazwy.txt`.

## 1. Shift+F10 na wierszu

- Pełna nazwa: `R04-2A · interakcja wiersza Shift+F10 na wierszu otwiera ten sam kontekst co kebab`.
- Pełny komunikat asercji: `Error: expect(element).toHaveAttribute("tabindex", "0")`; oczekiwano `tabindex="0"`, otrzymano `null`; stos wskazuje `filterableTable.r04-2a.test.tsx:181:17`.
- Asercja: `src/components/shared/__tests__/filterableTable.r04-2a.test.tsx:181` — `expect(row).toHaveAttribute('tabindex', '0')`.
- Produkt: `src/components/shared/ModuleHub/FilterableTable.tsx:1565` przyznaje `tabIndex` tylko dla `onRowClick || onRowDoubleClick`, mimo że `:1580-1600` obsługuje menu kontekstowe z klawiatury.
- Werdykt: **PRODUKT** — wiersz z akcjami obsługuje `Shift+F10`, więc jest interaktywny i musi być osiągalny klawiaturą; implementacja sama przeczy swojemu handlerowi.
- Wiek: test `07bc597420 2026-08-13`; produkt jako plik `39dd82d301 2026-09-03`, lecz wadliwy warunek pochodzi z `c71959b9293 2026-08-13 15:48:55`; późniejsze zmiany produktu nie naprawiły warunku.

## 2. Relations bez propa

- Pełna nazwa: `R03-1 · Relations jest blokiem obowiązkowym renderuje empty state, gdy ekran NIE poda propa relations`.
- Pełny komunikat asercji: `TestingLibraryElementError: Unable to find an element with the text: No relations. This could be because the text is broken up by multiple elements.` DOM zawiera pusty kontener treści bez bloku relations; stos wskazuje `standardPreview.r03.test.tsx:75:19`.
- Asercja: `src/components/shared/__tests__/standardPreview.r03.test.tsx:75` — `expect(screen.getByText('No relations')).toBeInTheDocument()`.
- Produkt: `src/components/standard/StandardPreview.tsx:353-371` uzależnia cały footer i `PreviewRelations` od prawdziwości `relations`; `undefined` usuwa blok.
- Werdykt: **PRODUKT** — nagłówek pliku produktu deklaruje Relations jako blok 5, a `PreviewRelations` ma kanoniczny empty state; brak propa nie może usuwać obowiązkowego bloku.
- Wiek: test `664ab4aa54 2026-08-08`; produkt jako plik `a143a434dc 2026-09-02`; wadliwy warunek `07bc597420 2026-08-13` jest późniejszy niż test.

## 3. Własna etykieta empty state Relations

- Pełna nazwa: `R03-1 · Relations jest blokiem obowiązkowym respektuje własną etykietę pustego stanu`.
- Pełny komunikat asercji: `TestingLibraryElementError: Unable to find an element with the text: Brak powiązań. This could be because the text is broken up by multiple elements.` DOM zawiera pusty kontener treści bez bloku relations; stos wskazuje `standardPreview.r03.test.tsx:85:19`.
- Asercja: `src/components/shared/__tests__/standardPreview.r03.test.tsx:85` — `expect(screen.getByText('Brak powiązań')).toBeInTheDocument()`.
- Produkt: `src/components/standard/StandardPreview.tsx:363-371` przekazuje `relationsEmptyLabel`, ale tylko wewnątrz gałęzi `relations ? ... : null`, więc sama etykieta nie uruchamia bloku.
- Werdykt: **PRODUKT** — publiczny prop `relationsEmptyLabel` jest bezskuteczny dokładnie w stanie pustym, dla którego istnieje.
- Wiek: taki sam jak w pkt 2. Dwie czerwienie R03-1 mają jedną przyczynę: warunki `:353-354` i `:363` traktują brak propa inaczej niż pustą tablicę.

## 4. Powrót fokusu po zniknięciu elementu otwierającego

- Pełna nazwa: `R03-2 · zamykanie i focus return gdy element otwierający zniknął, focus wraca na kontener — skróty żyją dalej`.
- Pełny komunikat asercji: `AssertionError: expected <body><div>…(1)</div></body> to be <div …(4)>…(2)</div> // Object.is equality`; stos wskazuje `tablePreviewGeometry.r03-2.test.tsx:214:36`.
- Asercja: `src/components/shared/__tests__/tablePreviewGeometry.r03-2.test.tsx:214` — `expect(document.activeElement).toBe(root)`.
- Produkt: `src/components/shared/TableWithPreviewLayout.tsx:223-227` woła jedynie `returnFocusRef.current?.focus()` i nie ma fallbacku, gdy zapamiętany element zniknął; kontener jest fokusowalny na `:435`.
- Werdykt: **PRODUKT** — kontrakt testu cytuje kanon „focus wraca do rekordu”, a dla usuniętego rekordu jedyny bezpieczny fallback to już fokusowalny kontener utrzymujący skróty.
- Wiek: test `664ab4aa54 2026-08-08`; produkt jako katalog `939d0c934a 2026-09-03`; regresyjna linia `requestAnimationFrame(() => returnFocusRef.current?.focus())` pochodzi z `07bc597420 2026-08-13`, po teście, i zastąpiła istniejący fallback na kontener.

## Rodzina

`StandardTable` jest fasadą renderującą przez `FilterableTable`, więc naprawa warunku w jednym współdzielonym miejscu obejmie całą rodzinę konsumentów fasady. Inne znalezione fokusowalne kontenery (`TableWithPreviewLayout`, `PreviewPaneShell`) już mają `tabIndex={0}`; nie rozszerzam zmian na rodzeństwo poza czterema czerwieniami.
