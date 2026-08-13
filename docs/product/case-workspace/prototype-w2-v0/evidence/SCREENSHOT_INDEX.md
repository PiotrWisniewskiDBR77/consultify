# Screenshot index — Case Workspace prototyp W2-V0

116 plików PNG w `screenshots/`. Nazewnictwo:
`<ekran>__<viewport>__<motyw>__<stan>[__<zakładka>].png`

Przechwycone: Playwright (chromium headless) w`1440×900` (desktop) i `390×844` (mobile), przeciwko
lokalnemu `python3 -m http.server` serwującemu wyłącznie ten katalog prototypu. Motyw i stan sterowane
parametrami URL (`?theme=&state=&tab=&view=`) — patrz `../js/app.js` i inline skrypty w każdym
ekranie. Skrypt przechwytujący nie jest częścią repo (uruchomiony z tymczasowego katalogu sesji poza
worktree) — metodyka opisana w `../DECISIONS.md`.

## 1. Zlecenia — lista (`list__*`)

Pełna macierz: 7 stanów × 2 viewporty × 2 motywy = 28 zrzutów.

| Stan | Desktop light | Desktop dark | Mobile light | Mobile dark |
|---|---|---|---|---|
| default | ✓ | ✓ | ✓ | ✓ |
| empty | ✓ | ✓ | ✓ | ✓ |
| loading | ✓ | ✓ | ✓ | ✓ |
| error | ✓ | ✓ | ✓ | ✓ |
| stale | ✓ | ✓ | ✓ | ✓ |
| partial | ✓ | ✓ | ✓ | ✓ |
| blocked | ✓ | ✓ | ✓ | ✓ |

## 2. Zlecenie — pełna powłoka artefaktu (`case__*`)

### 2a. Stan domyślny — wszystkie zakładki/widoki × 2 viewporty × 2 motywy = 32 zrzuty

| Zakładka / widok | Desktop light | Desktop dark | Mobile light | Mobile dark |
|---|---|---|---|---|
| Przegląd (`przeglad`) | ✓ | ✓ | ✓ | ✓ |
| Plan · Prosty (`plan-prosty`) | ✓ | ✓ | ✓ | ✓ |
| Plan · Ekspercki (`plan-ekspercki`) | ✓ | ✓ | ✓ | ✓ |
| Plan · Lista (`plan-lista`) | ✓ | ✓ | ✓ | ✓ |
| Realizacja (`realizacja`) | ✓ | ✓ | ✓ | ✓ |
| Rezultaty (`rezultaty`) | ✓ | ✓ | ✓ | ✓ |
| Powiązania (`powiazania`) | ✓ | ✓ | ✓ | ✓ |
| Aktywność (`aktywnosc`) | ✓ | ✓ | ✓ | ✓ |

### 2b. Stany nie-domyślne — zakładka reprezentatywna × 2 viewporty × 2 motywy = 48 zrzutów

Nie jest to pełna macierz 6 stanów × 8 zakładek (48 kombinacji byłoby ~192 zrzutów) — celowo
ograniczone do zakładek, w których dany stan ma realną, odróżnialną treść (patrz DECISIONS.md,
sekcja „Znane uproszczenia”).

| Stan | Zakładka | Desktop light | Desktop dark | Mobile light | Mobile dark |
|---|---|---|---|---|---|
| empty | Przegląd | ✓ | ✓ | ✓ | ✓ |
| empty | Plan · Prosty | ✓ | ✓ | ✓ | ✓ |
| empty | Realizacja | ✓ | ✓ | ✓ | ✓ |
| empty | Rezultaty | ✓ | ✓ | ✓ | ✓ |
| loading | Przegląd | ✓ | ✓ | ✓ | ✓ |
| error | Przegląd | ✓ | ✓ | ✓ | ✓ |
| stale | Przegląd | ✓ | ✓ | ✓ | ✓ |
| stale | Plan · Ekspercki | ✓ | ✓ | ✓ | ✓ |
| partial | Przegląd | ✓ | ✓ | ✓ | ✓ |
| partial | Realizacja | ✓ | ✓ | ✓ | ✓ |
| blocked | Przegląd | ✓ | ✓ | ✓ | ✓ |
| blocked | Realizacja | ✓ | ✓ | ✓ | ✓ |

### 2c. Return-to-Case (powrót do zlecenia po otwarciu dostawy) — 4 zrzuty

Desktop/mobile × light/dark, klik na kartę dostawy w zakładce Rezultaty → nakładka z paskiem powrotu.

## 3. Zlecenie nieznalezione / brak dostępu (`not-found__*`) — 4 zrzuty

Desktop/mobile × light/dark. Ten sam ekran dla nieistniejącego ID i dla ID bez uprawnień
(enumeration-safe — patrz DECISIONS.md punkt 5).

## Suma

28 + 32 + 48 + 4 + 4 = **116 zrzutów**.
