# CODEX DAY 302 — prawy panel Idei i Notatnika

Stan roboczy: R1–R5 wykonane.

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

## R4 — kadry prototypu

Kanoniczne narzędzie wykonało 16/16 kadrów (cztery ekrany × PL/EN × light/dark), wszystkie z jawnym `ff_idea_notebook_right_panel_prototype=1`, pełnym zestawem flag rozwijania i bez domyślnego kliku. Wszystkie 16 obejrzano osobno. Sumy SHA-256: `/private/tmp/cx-day302-panel-idei-artefakty/kadry-sha256.txt`.

| Ekran | PL light/dark | EN light/dark | Co widać | Czego brakuje |
|---|---|---|---|---|
| `ideas-teresa-panel` | poprawna para motywów | poprawna para motywów | wspólna powłoka Idei, sześć sekcji, akcje i właściwości rozwinięte | brak realnego centrum i danych relacji; to izolowany prototyp |
| `mywork-idea-inspector-lekki` | poprawna para motywów | poprawna para motywów | identyczny komponent Idei jak wyżej | kadr jest celowo duplikatem treści pierwszego ekranu; dowodzi wspólnej powłoki, nie integracji trasy |
| `mywork-notebook-rail-speca` | poprawna para motywów | poprawna para motywów | ta sama powłoka z kontekstem i18n Notatnika | brak realnego edytora i danych; prototyp nie jest podpięty do bieżącego raila |
| `notatnik-centrum-mysli` | poprawna para motywów | poprawna para motywów | identyczny komponent Notatnika jak wyżej | kadr jest celowo duplikatem treści drugiego ekranu; brak dowodu produkcyjnego montażu |

Każda para light/dark różni się obrazem i czytelnie zmienia tokeny powierzchni. PL/EN zmienia tytuły, akcje, właściwości i puste komunikaty. Harness raportuje 0 błędów konsoli po wymuszeniu query. Jednocześnie łańcuch przodków kończy się na `PrototypeHarness` w `dev-render/main.tsx`, a nie na produkcyjnych `IdeaContextPanel`/`NotebookContextPanel`/`NotebookRightRail`; kadry są dowodem projektu wizualnego, nie dowodem migracji ani realnej trasy.

## R5 — literalna lista odbioru §18.1

- `Menu 1`: **n/d** — zakres prototypu to wyłącznie prawy panel, bez powłoki całego artefaktu.
- `Powłoka wg archetypu`: **CZĘŚCIOWE** — wspólny panel jest identyczny, centrum/Menu2/rail nie należą do prototypu.
- `Prawy panel — stała kolejność`: **PASS** — Akcje, Właściwości, Powiązania, Źródła i założenia, Komentarze, Historia; zgodnie z nowszym SSOT kodu obowiązkowa jest także sekcja evidence.
- `Powiązania klikalne`: **n/d na pustym stanie** — model prototypu nie dostarcza relacji; nie dodano atrap linków.
- `Slot AI`: **n/d** — decyzja kanonu kodu przenosi Teresę do Akcji i zabrania dopisku AI w Historii; sam mechanizm AI jest poza zakresem.
- `Otwieranie §12.2 / guard`: **n/d** — prototyp nie migruje wejść produkcyjnych ani edycji.
- `empty/loading/error`: **PASS komponentowo** — wszystkie trzy stany są jawne; kadr pokazuje stan empty/ready, testy nie udają ścieżki HTTP.
- `light/dark + tokeny c-*`: **PASS** — 16 obejrzanych kadrów; zero navy/slate/hex i zero `primary-*` w prototypie.
- `zero crimson fokus/status/badge/selection`: **PASS statycznie** — fokus używa `c-focus`, status neutralnego tekstu.
- `Tab/Shift+Tab`: **PASS punktowo** — test przechodzi od przycisku zamknięcia do nagłówka Akcji bez pułapki; kompletna powłoka Menu 1 jest n/d.
- `Esc zamyka lokalną warstwę`: **PASS punktowo** — event na panelu wywołuje `onClose` raz i zatrzymuje propagację.
- `fokus widoczny`: **PASS dla własnych kontrolek i kanonicznych nagłówków** — każda ma `focus-visible:ring-2` z `c-focus`/`var(--c-focus)`.
- `streaming Teresy role=log`: **n/d** — prototyp nie renderuje strumienia ani nie wywołuje AI.
- `generator/wizard`: **n/d** — panel nie jest generatorem ani wizardem.
- `Canvas zakres AI` i `minimalny zestaw klawiaturowy`: **n/d** — prototyp panelu nie jest canvasem.

Pomiar nazw testów: PRZED 83/83, PO 88/88. Diff zawiera wyłącznie pięć dodanych pełnych nazw kontraktu prototypu; żadna nazwa nie zniknęła. Pliki: `/private/tmp/cx-day302-panel-idei-artefakty/przed-nazwy.txt` i `po-nazwy.txt`. Pakiet jest czysto frontendowy i nie przechodzi przez pułapki auth/DB/Gateway z §0.2d; `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0`.

## Korekty wobec instrukcji

- Cztery ekrany harnessu istnieją zgodnie z tezą.
- Z trzech paneli `NotebookRightRail` już używa `ArtifactRightPanel`; teza o trzech implementacjach oznacza trzy komponenty, nie trzy całkowicie odłączone od kanonu powłoki.
- Instrukcja streszcza §11.2 jako pięć sekcji i „Historia / AI”, natomiast aktualny SSOT `ArtifactRightPanel.tsx` na markerze wymaga sześciu sekcji, dodając „Źródła i założenia”, i jawnie zabrania nazwy „Historia / AI”. Wybrano bezpieczniejszy, nowszy kanon kodu bez modyfikowania wspólnego komponentu.

## Twierdzenia niezweryfikowane

- Nie zweryfikowano integracji z produkcyjną trasą ani realnym modelem danych; to celowo odłączony prototyp.
- Gałąź nie jest scalona i flaga nie jest włączona.
