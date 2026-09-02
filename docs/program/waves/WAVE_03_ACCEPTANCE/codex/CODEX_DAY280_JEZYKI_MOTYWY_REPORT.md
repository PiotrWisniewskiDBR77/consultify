# CODEX DAY 280 — języki i motywy — raport

## Stan

Wynik końcowy: **PARTIAL / G06 NIEPODNIESIONE**. R1–R5 wykonane; R6 zamyka dokumentację.

## Baza i marker — wyniki dosłowne

```text
eeb253c3ec instrukcja 282: wklejka celuje w grafika/m03-20260902, nie w codex/m03-admin
MARKER OK
eeb253c3ec13195a04b3848ef2566c5c07786e58
```

Stan worktree po utworzeniu: pusty wynik `git status --short | head -3`.

Tip uciekł do przodu; pracuję dokładnie z markera. Rozjazd zapisano komendami z §0.1. Dotyczy m.in. późniejszych zmian w dev-render, tłumaczeniu PL i modułach 06/09/10/11; scalenie należy do nadzorcy.

## Korekty wobec instrukcji

Tezy wejściowe potwierdzone własnym pomiarem: G06 zamknięte 0/16; rejestr 319; A/B 258. Harness: 269 plików w `dev-render/screens`, 290 odwołań `screens/` w `dev-render/main.tsx`.

Instrukcja zawiera literalne polecenia Vitest z tekstem `brak testów vitest`, które nie jest ścieżką testu. Bezpieczna interpretacja: dyżur nie ma licencjonowanego pakietu Vitest; dowód pochodzi z renderów kanonicznego harnessu. Nie ogłaszam żadnego wyniku testów.

## R1 — kontrola przyrządu

Ekran `chat-split-teresa-right`, PL, 1440×900: Δ luminancji 226,7901; różne piksele 99,9026%. Para realnie się różni. Jednocześnie każdy motyw miał 21 błędów konsoli i 16 odpowiedzi 4xx/5xx, więc ekran nie ma PASS G06.

Artefakty: `/private/tmp/cx-day280-jezyki-motywy-artefakty/R1-wzorzec/` oraz `R1-wzorzec.json`.

## R2 — moduły 01–04

Zmierzono 51/51 ekranów A/B, 408 zrzutów: PL/EN × light/dark × 1440/1024. Sześć ekranów użyło osobnych wejść HTML; 45 wspólnego rejestru. Wszystkie pary miały niezerową różnicę luminancji i pikseli; żaden dokument nie miał poziomego overflow przy 1024 px.

To nie zamyka G06. Wykryto ekrany z identycznym renderowanym tekstem PL/EN oraz ekrany z błędami konsoli i 4xx/5xx. Nie wykonano audytu dostępności ani gwarantowanego rozwinięcia wszystkich sekcji. Szczegóły per ekran są w rejestrze.

Pułapki §0.2d (a)–(e): przebieg nie używa Vitest ani `tests/setup.ts`; działa przez Playwright przeciw lokalnemu dev-render. Nie jest dowodem RealPG/ApiGateway i nie jest tak przedstawiany. HTTP pochodzi z realnych odpowiedzi lokalnego harnessu; globalny fetch Vitest nie uczestniczy. Świeży kontekst per zrzut eliminuje przenoszenie stanu motywu/języka.

## R3 — moduły 05–08

Zmierzono 56/56 ekranów A/B, 448 zrzutów w pełnej macierzy. Wyniki per ekran dopisano do rejestru. Werdykty pozostają PARTIAL/NOT_PROVEN według tych samych ograniczeń dowodowych co R2.

## R4 — moduły 09–12

Zmierzono 71/71 ekranów A/B, 568 zrzutów w pełnej macierzy. `materials-registry` użył osobnego wejścia HTML. Wyniki per ekran dopisano do rejestru.

## R5 — moduły 13–16

Zmierzono 58/58 ekranów A/B, 464 zrzuty w pełnej macierzy. Moduł Partner ma 0 ekranów A/B w mapie. `chat-signals-feed` użył osobnego wejścia HTML.

## Podsumowanie R2–R5

Mapa 16 modułów zawiera 236 ekranów A/B (51 + 56 + 71 + 58), a pełny `status.json` ma 258 A/B, ponieważ obejmuje także sekcje WSPOLNE i POZA16. Wykonano 1888 zrzutów dla 236 ekranów modułowych. G06 nie podniesiono w żadnym module: pomiar wykrywa błędy językowe/konsolowe/HTTP, a dostępność, wszystkie stany i rozwinięte sekcje pozostają NOT_PROVEN.

Agregat: 47/236 ekranów dało identyczny wyrenderowany tekst PL i EN; 59/236 miało co najmniej jeden błąd konsoli; 56/236 co najmniej jedną odpowiedź 4xx/5xx. Jedyny poziomy overflow dokumentu przy 1024 px: `admin-command-audit` (1169 px PL, 1165 px EN). Zero par miało 0% różnych pikseli.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Pomiar nazw testów (§0.4a)

Brak licencjonowanego pakietu Vitest w instrukcji (literalne `brak testów vitest`). `przed-nazwy.txt` i `po-nazwy.txt` są puste; diff pusty. Nie raportuję `N passed`.

## TWIERDZENIA NIEZWERYFIKOWANE

Dla wszystkich 236 ekranów modułowych niezweryfikowane są: dostępność, wszystkie stany interakcyjne oraz treść ukryta w sekcjach, których harness nie rozwinął. Poza zakresem 16 modułów pozostają 22 ekrany A/B z sekcji WSPOLNE i POZA16.

## Artefakty

`/private/tmp/cx-day280-jezyki-motywy-artefakty`: 1890 PNG (1888 R2–R5 + 2 R1), 29 JSON i dwa puste pliki nazw testów. Manifest: `SHA256SUMS.txt`, SHA-256 manifestu `06cb5a4d349c672a3f65c4287fa746256815ba829d3905af94bc63301c06f7b2`.

## R6 — werdykt

**PARTIAL / G06 pozostaje otwarte 0/16.** Rejestr ma 236 wierszy ekranów modułowych. Nie ma podstaw do wpisania VERIFIED: przebieg jest przekrojowym pomiarem renderu, nie pełnym dowodem dostępności i wszystkich stanów.
