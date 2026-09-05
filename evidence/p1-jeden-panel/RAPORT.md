# P1 — jeden panel zwijany: raport odbioru

Data pomiaru: 2026-09-05  
Gałąź: `codex/p1-jeden-panel`  
Baza porównawcza po `git fetch`: `origin/staging` = `59e282df885161467102ceb0c23a14c8717b2bec`  
Merge wymaganej bazy: `b3f9343eaeee60100c0d5134d4c6088c91cfdda2` (drugi rodzic = wskazany SHA stagingu)

## Werdykt

`EVIDENCE_MISSING / NOT_PROVEN` dla §10 jako całości.

Kod, testy komponentowe, ratchety kanonu i dowód mutacyjny są zielone. Odbiór na żywo oraz macierz zrzutów 8 ekranów × 3 szerokości nie mogą zostać uczciwie zaliczone, ponieważ przekazana sesja `/private/tmp/odbior-auth/auth.json` jest wygasła i nie odnawia się. Nie użyto zastępczej sesji ani obejścia logowania.

## Bramki zaliczone

- Testy wymagane w §10: `8` plików, `27/27 PASS` po merge z aktualnym stagingiem.
- `bash scripts/check-list-canon.sh`: `OK`; pełny skan `155` plików, `361` naruszeń wobec baseline `364` (dług spadł o 3).
- `bash scripts/check-artefakt.sh`: `OK`; crimson `8`, baseline `8`.
- `node --check scripts/dev/odbior-zywo/zrzut.mjs`: PASS.
- Esbuild zmienionych plików aplikacji: PASS. Test Playwright kompiluje się dla platformy Node z natywnym `fsevents` pozostawionym jako external: PASS.
- Konflikt merge w `zrzut.mjs` rozwiązany z zachowaniem obu kontraktów: odporny wybór originu sesji ze stagingu oraz parametry `--szerokosc`/`--motyw`, `odpowiedziHttp` i `bledyKonsoli` z P1.

## Dowód mutacyjny RED → GREEN

Mutacja: tymczasowo dodano drugi korzeń `<aside data-right-panel>` w desktopowej gałęzi `TableWithPreviewLayout`.

- RED: `jedenPanel.contract.test.tsx` — `2/5` testów padły: T1 (dokładnie jeden korzeń) i T6 (geometria nakładki); oba dostały `received 2` zamiast `1`.
- Mutację usunięto w całości.
- GREEN po cofnięciu: pełna komenda §10 — `27/27 PASS`.

## Blokada odbioru na żywo

Vite uruchomiono na własnym porcie `41731`, host `127.0.0.1`, z `.env.local` skopiowanym z `/private/tmp/m03/.env.local`. Zarówno test Playwright, jak i kanoniczny `scripts/dev/odbior-zywo/zrzut.mjs` użyły dokładnie `ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json`.

Kanoniczny probe zakończył się na:

- URL: `http://127.0.0.1:41731/login?redirect=%2Fmy-work`
- `bledyKonsoli`: `9`
- odpowiedzi HTTP ≥400: `6`, wszystkie `401`
- `/api/auth/me`: `401`
- `/api/auth/refresh`: `401`
- komunikat aplikacji: `Token expired`

Dowody:

- `00-auth-probe.png`
- `00-auth-probe.png.json`
- `tests/e2e/ui/jeden-panel-listy.spec.ts` (przepływ dochodzi do bramki widoczności tabeli i zatrzymuje się na ekranie logowania)

## Niezaliczone progi §10

- brak odbiorowych zrzutów 1280/1440/1920 jasny/ciemny na 8 ekranach;
- brak wiarygodnego live `aside.count = 1/0`;
- brak wiarygodnego live pomiaru szerokości tabeli ≥1000/830/1180 px;
- brak live potwierdzenia `0` błędów konsoli i `0` odpowiedzi ≥400;
- pełny klikany przebieg E2E nie może przejść poza uwierzytelnienie.

## Jedyny wymagany następny krok

Odświeżyć `/private/tmp/odbior-auth/auth.json` dla stagingu. Po odświeżeniu należy ponowić istniejący test Playwright i wygenerować kanonicznym `zrzut.mjs` pełną macierz z §6.2/§10. Dopiero wtedy werdykt może zmienić się na `PASS`.
