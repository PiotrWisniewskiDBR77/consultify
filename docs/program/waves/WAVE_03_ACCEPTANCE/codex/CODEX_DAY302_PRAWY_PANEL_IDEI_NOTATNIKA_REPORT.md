# CODEX DAY 302 — prawy panel Idei i Notatnika

Stan roboczy: R1–R3 wykonane.

## §0 — baza

```text
MARKER OK
416432abafe31a390a909cf7e460a4bad7bef191
status --short: pusty
```

Tip refa uciekł do przodu; praca zaczęła się dokładnie z markera. Dysk: 39 GiB wolne. Porty 5282, 5283 i 6306 były wolne, liczba kontenerów `cx-day302`: 0.

## Z30

Środowisko: `BRAK ZMIENNYCH POCZTY`; tabela `settings`: 0 wierszy `smtp%`; `Gateway.ts`: 0 trafień drenażu. Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1 — wynik

Pomiar potwierdził 1289 / 867 / 1037 linii oraz 61 plików wspominających `ArtifactRightPanel`. Pełna tabela sekcji, przyczyna rozjazdu powłok i lista brakujących danych są w `docs/program/prototypy/PRAWY_PANEL_IDEI_NOTATNIKA_20260903.md`.

## R2 — wynik

Projekt słowny powstał przed kodem. Utrzymuje jedną kolejność sekcji i jedną powłokę SPEC-A dla obu kontekstów, jawne stany loading/empty/error, szerokość 360 px (320–420) oraz drawer poniżej 1280 px.

## R3 — prototyp za flagą OFF

Dodano jeden komponent dla kontekstów `idea` i `notebook` oraz jedną flagę `ff_idea_notebook_right_panel_prototype`. Bez query, localStorage i env flaga zwraca `false`; każdy błąd odczytu także zamyka prototyp. Wrapper przy OFF zwraca przekazany legacy DOM bez dodatkowej powłoki. Cztery testy pokrywają brak wartości, jawne OFF oraz oba konteksty ON: 4/4 PASS, `--retry=0`. Punktowy esbuild komponentu: PASS. Grep prototypu: zero `primary-*`.

Pułapki §0.2d (a)–(d) nie leżą na ścieżce czysto frontendowego testu flagi: pakiet nie importuje Gateway, middleware, bazy ani auth. Pułapka (e) jest wyłączona konstrukcją: wrapper nie jest podłączony do żadnego produkcyjnego konsumenta, flaga jest default OFF, komponent używa kanonicznego `ArtifactRightPanel`, a test dowodzi niezmienionego legacy DOM przy OFF.

## Korekty wobec instrukcji

- Cztery ekrany harnessu istnieją zgodnie z tezą.
- Z trzech paneli `NotebookRightRail` już używa `ArtifactRightPanel`; teza o trzech implementacjach oznacza trzy komponenty, nie trzy całkowicie odłączone od kanonu powłoki.

## Twierdzenia niezweryfikowane

- Kadry i odbiór §18.1 nie są jeszcze wykonane.
- Gałąź nie jest scalona i flaga nie jest włączona.
