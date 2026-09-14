# P1 · RP1b — przejazd kanonu „Raport z pracy" (14.09.2026)

Zrzuty z harnessu dev-render `z29-inicjatywy-raport-pracy` (REALNY `<InitiativesHub>`
z Menu 1/2/3, mock-dane, bez logowania i bez bazy), 1440×900, PL, jasny + ciemny.
Pełna rozdzielczość: `~/Developer/cto-codex/zrzuty-p1-kanon-20260914/`
(tu przeskalowane do budżetu repo).

Uruchomienie (flagi czytane W BUDOWIE → ON i OFF to dwa serwery vite):

    VITE_INITIATIVES_WORK_REPORT=true npx vite --config dev-render/vite.config.ts --port 4391 --strictPort
    node scripts/dev/p1-kanon-zrzuty.mjs --port 4391 --case on
    npx vite --config dev-render/vite.config.ts --port 4392 --strictPort
    node scripts/dev/p1-kanon-zrzuty.mjs --port 4392 --case off

## Co widać

| plik | co dowodzi |
|---|---|
| `01-lista-kreator-zwiniety-*` | lista NA GÓRZE, kreator zwinięty za „Nowy raport" (skaza 6); Menu 3 BEZ pigułek rejestru (skaza 5); etykiety „Opublikowany / Zatwierdzony / Co tydzień / Na żądanie" zamiast kodów enuma (skaza 2); kebab ⋮ w wierszu (skaza 3) |
| `02-podglad-przebiegu-*` | podgląd otwarty single-clickiem (skaza 1): nagłówek + „Otwórz" wyłączony z powodem, karta meta (plakietka statusu + kadencja + data), blok „Po co ten raport" z licznikiem słów i kebabem, tabela właściwości |
| `02b-podglad-doreczenia-*` | dolna część podglądu: „Adresaci i doręczenia" — adresat, status doręczenia, czas ostatniej próby |
| `02c-podglad-blad-doreczenia-*` | przebieg z błędem: „Błąd 550 5.1.1 Adresat nie istnieje" na czerwono, drugi adresat „Doręczony" na zielono; akcje-pill „Otwórz PDF" + „Ponów wysyłkę" (wyłączona z powodem — oglądający nie jest zatwierdzającym) |
| `03-kebab-wiersza-*` | kebab wiersza: Otwórz PDF · Wyślij (z powodem blokady) · Otwórz podgląd |
| `04-kreator-rozwiniety-*` | kreator pod listą: 5 pól = kanoniczny `SelectField` (etykieta, chevron, h-9), nie gołe `<select>` (skaza 4) |
| `05-flaga-off-*` | parytet OFF: Menu 2 ma 3 przyciski, brak zakładki „Raport pracy"; rejestr inicjatyw ze swoimi pigułkami Menu 3 nietknięty |

## Uwagi z oglądania (moje, przed pokazaniem właścicielowi)

- Kolumna Status była UCIĘTA w połowie słowa („Opublikowan") na pierwszym przejeździe —
  przyczyna: własny `<span title>` w `render` omija wielokropek `FilterableTable`.
  Poprawione: kolumny status/kadencja bez własnego `render`.
- Plakietka z nazwą szablonu łamała kartę meta na trzy linie — usunięta z meta
  (szablon ma własny wiersz w tabeli właściwości).
- Nagłówek pisał „Kreator raportu z pracy" nad tabelą przebiegów — zmieniony na
  „Raporty z pracy" + zdanie o tym, co lista pokazuje.
- 13 błędów konsoli na KAŻDYM zrzucie (także przy fladze OFF i na zrzutach Z-29
  sprzed tej pracy) — to szum harnessu/atrapy, nie regres tej zmiany; szczegóły
  w plikach `*.png.json` obok zrzutów w katalogu pełnej rozdzielczości.
