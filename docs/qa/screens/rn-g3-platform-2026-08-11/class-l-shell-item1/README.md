# Punkt zakresu 1 — powłoka klasy L (archetyp Rekord) — dowód

Ekran: `rn-g3-class-l-record-shell` (dev-render, port 3614). SYNTETYCZNA
demonstracja (nie host realnego komponentu domenowego — żaden z torów
KPI/ROI/OKR jeszcze nie zbudował pełnostronicowego widoku rekordu; patrz
uzasadnienie w nagłówku `dev-render/screens/rn-g3-class-l-record-shell.tsx`).

Złożona WYŁĄCZNIE z istniejących prymitywów `src/components/standard/**` +
`src/components/shared/NModeLayout/NModeShell` (bez bramki rejestru) +
`src/components/shared/states/**` (punkt zakresu 4) — zero nowego standardu,
zero zmian poza allowlistą.

## Pliki

- `classl-1440-{light,dark}-{pl,en}.png` — pełny ekran, 1440×900, 4 kombinacje.
- `classl-1280-{light,dark}-{pl,en}.png` — jw., 1280×800.
- `classl-kebab-open-light-pl.png` — kebab Menu 1 (`extraOverflowItems`)
  otwarty: Skopiuj kod obiektu / Kopiuj link / Eksportuj (własna pozycja).
- `classl-savestate-{saving,error,conflict}-light-pl.png` — `SaveStateIndicator`
  (punkt zakresu 4) osadzony w sekcji „Akcje" prawego panelu.
- `classl-teresa-unavailable-{light,dark}-pl.png` — `TeresaUnavailableNotice`
  (punkt zakresu 4, nowy prymityw) w tej samej sekcji, tryb `compact`.

## Co widać

Menu 1 z okruszkami (`ArtifactBreadcrumb`, NOWY plik) nad nagłówkiem
artefaktu (tytuł inline, pigułka statusu „Aktywny"/„Active", wskaźnik
zapisu „Zapisano"/„Saved" osobno od statusu, jeden primary „Zapisz
pomiar"/„Record measurement", kebab). Lewa nawigacja z PIĘCIOMA sekcjami
(Przegląd/Definicja/Pomiary/Odchylenia/Historia) — dowód, że klasa L
dopuszcza więcej niż limit 4 sekcji klasy S. Prawy panel akordeonowy w
kanonicznej kolejności Akcje·Właściwości·Powiązania·Komentarze·Historia
(`ArtifactRightPanel`), z `ArtifactPropertiesTable` w sekcji Właściwości.
Light/dark i PL/EN oba czytelne, zero crimson, fokus tokenowy (dziedziczone
z `NModeShell`/`NModeHeader`, niezmienione — patrz raport).
