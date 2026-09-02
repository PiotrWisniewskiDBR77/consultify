# CODEX DAY 284 — domknięcie G06 — raport

## Wynik

**PARTIAL / G06 zamknięte 0/16.** R1 i pełne R2 wykonane. R3 rozpoczęto, lecz
przerwano zgodnie z regułą „Urwanie okna”; R3–R5 nie są zaliczone. Wszystkie
szesnaście wierszy G06 ma stan ze słownika instrukcji: `NOT_STARTED`.

## Baza, marker i rozjazd

Wynik markera, dosłownie:

```text
MARKER OK
```

Sanity worktree, dosłownie:

```text
b68c382874f004aa6cf58697fec0db8925f681b9
```

`git status --short | head -3` po utworzeniu worktree zwrócił pusty wynik.
Tip `github-backup/grafika/m03-20260902` był przed pracą o 11 commitów przed
markerem. Lista zmienionych ścieżek została zmierzona komendami z §0.1;
obejmowała m.in. instrukcje 283/284, moduły 13–15, `server/src/Gateway.ts` i
`src/hooks/useUserNotificationPreferences.tsx`. Pracowałem dokładnie z markera;
nie wykonywałem rebase.

Dysk po ponowieniu: 71 GiB wolne. Porty 6286, 5290 i 5291 były wolne.

## Stan wejściowy i korekty wobec instrukcji

- `grep -c '^| ' ...REJESTR...` → `238`, ale są to 236 wierszy danych oraz dwa
  wiersze składni tabeli; rejestr nie zawierał modułu Partner.
- `grep -c 'PARTIAL' ...REJESTR...` → `190`, nie 238.
- G06 zamknięte `0 z 16` — teza potwierdzona.
- `status.json` → `ekranow 319 | A/B 258` — teza potwierdzona.
- Mapa 16 modułów i rejestr dyżuru 280 mają 236 ekranów A/B. Partner ma w tym
  mianowniku 0 ekranów; 22 z 258 ekranów A/B należą do WSPOLNE/POZA16.
- Identycznych wartości PL/EN w plikach tłumaczeń: 715. Ta liczba nie była
  traktowana jako dowód wyrenderowanego tłumaczenia.
- Instrukcja nie licencjonuje pakietu Vitest: literalnie zawiera tekst
  `brak testów vitest — dowód idzie zrzutami z harnessu i pomiarem`. Nie
  ogłaszam wyniku testów.

## Migracje i Z30

Kontener: `cx-day284-pg`, wyłącznie `127.0.0.1:6286`, baza `cx284`, obraz
`pgvector/pgvector:pg16`. Pierwszy przebieg: `Applying migrations: 883` i
`Postgres migrations complete`. Drugi: `Applying migrations: 0` i
`Postgres migrations complete`.

Dowody przed runtime: `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key
LIKE 'smtp%'` → `(0 rows)`; grep drenaży w `server/src/Gateway.ts` → 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## R1 — kontrola przyrządu

Ekran wzorcowy `results-vnext-attention`, PL, 1440×900:

- różnica luminancji: `230.84716192997683` (próg 150);
- różne piksele: `99.98846450617283%`;
- 1 rozwinięta kontrolka w każdym motywie, 0 nadal zwiniętych;
- brak błędów konsoli i HTTP;
- axe: `landmark-one-main`, `page-has-heading-one`, `region` w obu motywach.

Kadr nie zawiera kontrolek harnessu. Host ma korzeń `#dev-render-root` z
`height: 100vh; width: 100vw`; nie używa wadliwego `min-h-screen` jako korzenia.

Pierwszy commit i push: `017b44655b`.

## R2 — Organizacja, Wywiad, Narzędzia, Ocena

Pełny mianownik: 51 ekranów × PL/EN × light/dark × 1440/1024 = **408/408
rekordów pomiarowych**. Osiem kombinacji zakończyło się kodem 1, ponieważ
narzędzie fail-closed zgłaszało sekcje nadal zwinięte. Brak `504 Outdated
Optimize Dep` w przyjętym zestawie.

| Moduł | Ekrany | Kadry | status błędu | nadal zwinięte | axe z naruszeniami | konsola | HTTP |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 01 Organizacja | 21 | 168 | 0 | 0 | 168 | 168 | 168 |
| 02 Wywiad | 6 | 48 | 32 | 32 | 48 | 8 | 8 |
| 03 Narzędzia | 7 | 56 | 40 | 40 | 56 | 16 | 16 |
| 04 Ocena | 17 | 136 | 88 | 86 | 134 | 40 | 40 |

20 ekranów pozostawiło widoczne kontrolki `aria-expanded=false` po
automatycznym rozwijaniu. `assessment-initiatives-panel` miał dwa puste
rendery dark (PL i EN). Dokładne wyniki per ekran dopisano do istniejącego
rejestru. Cytaty obcych tekstów z wyrenderowanego pomiaru dyżuru 280 zostały
zachowane; nie zastępowano ich audytem kluczy tłumaczeń.

## Fałszywy przebieg odrzucony

Pierwsza próba równoległa użyła jednocześnie 5290 i 5291, które zapisywały ten
sam `dev-render/.vite-cache`. Wynik zawierał `504 Outdated Optimize Dep`, puste
białe kadry i mimo tego `exit=0`. Próba została odrzucona w całości; jej pliki
zachowano w `/private/tmp/cx-day284-g06-scratch/invalid-multiserver/` i nie
wchodzą do wyników R2. Powtórka używała jednego serwera na 5290.

## R3–R5 — niezaliczone

R3 rozpoczęto po R2, lecz tempo ekranów dochodzących do timeoutu nie dawało
bezpiecznego domknięcia w oknie. Proces zatrzymano na uczciwej granicy po
pełnym R2. Moduły 05–16 mają wpis `NOT_STARTED` i dowód „niezmierzone w
dyżurze 284”. Nie wykorzystano niepełnych plików R3 jako dowodu.

## Pomiar nazw testów (§0.4a)

Brak licencjonowanego pakietu Vitest. `przed-nazwy.txt` i `po-nazwy.txt` są
puste, a ich diff jest pusty. Nie raportuję liczby testów ani `passed`.

Pułapki §0.2d (a)–(e): pomiar nie używa Vitest, `tests/setup.ts`, ApiGateway
ani testowego mocka `global.fetch`. Playwright trafiał wyłącznie do lokalnego
dev-render. To nie jest dowód RealPG/ApiGateway. Świeży kontekst na każdy kadr
ogranicza przenoszenie motywu i języka. Fałszywy kształt Vite 504 wykryto przez
kontrolę HTTP/pustego tekstu i odrzucono, jak opisano wyżej.

## Artefakty

Przyjęty zestaw w `/private/tmp/cx-day284-g06-artefakty` zawiera 410 PNG
(408 R2 + dwie pary R1), 10 JSON, logi migracji i puste pliki nazw testów.
Manifest: `SHA256SUMS.txt`; SHA-256 manifestu:
`872b4924bc8dd18351909b75af7539d78e63aca3e920f200ab6244bdca26ab8b`.
Niepełne i odrzucone przebiegi leżą wyłącznie w scratch i nie są częścią
manifestu.

## TWIERDZENIA NIEZWERYFIKOWANE

- R3–R5: 185 ekranów w modułach 05–15; Partner ma 0 ekranów w tym rejestrze.
- Pełna dostępność poza automatycznym axe, obsługa czytnikiem ekranu i
  klawiaturą.
- Wszystkie stany interakcyjne, których nie reprezentują osobne wpisy ekranu.
- Produkcyjna ścieżka HTTP/ApiGateway; dyżur był frontowym pomiarem harnessu.

## Werdykt R6

**G06 pozostaje zamknięte 0/16.** R2 obala możliwość podniesienia pierwszych
czterech modułów, a pozostałe dwanaście nie zostało zmierzone. Nie wykonano
napraw produktu (`Z40`).
