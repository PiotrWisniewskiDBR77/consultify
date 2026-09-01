# Panele wyceny (5) — zrzuty z czekaniem na wynik (2026-09-01)

Kontekst: `scripts/dev/grafika-zrzuty.mjs` dostał `--wynik-selektor` (opisany
w komentarzu nagłówkowym pliku), żeby zamiast stałego czasu czekać na
realną obecność wyniku w DOM i sprawdzać parę light/dark
`checkScreenshotPairState` (jasność RÓWNOCZEŚNIE z obecnością wyniku).
Powód: odbiór dyżuru 233 (Finanse) zmierzył parę light=sam formularz,
dark=policzony wynik — stary bezpiecznik (tylko jasność) to przepuszczał.

Ekran: `finance-value-panels` (`dev-render/screens/finance-value-panels.tsx`).
Wybór panelu — **zmierzone, nie założone**: parametr adresu `?panel=<wartosc>`
(patrz `dev-render/screens/finance-value-panels.tsx:270`,
`params.get('panel') ?? 'value'`). Wartości pięciu paneli wyceny:
`real-options`, `frontier`, `sensitivity`, `monte-carlo`, `scenarios`.
Wszystkie pięć ma `AutoRun` (linie 245–258), które samo klika przycisk
„policz"/„uruchom" po zamontowaniu — nie trzeba `--klik`.

## Tabela

| panel | selektor(y) wyniku | para przeszła kontrolę stanu? | co pokazywał STARY zrzut | co pokazuje NOWY zrzut (189-panele-wyceny-*) | ocena właściciela stoi na wiarygodnym obrazie? |
|---|---|---|---|---|---|
| real options | `[data-testid="ro-defer-result"]` | **TAK** (1/1, `hasResultMarker: true` oba motywy) | **BRAK — nigdy nie zrobiono.** `evidence/grafika/` nie ma ani jednego zrzutu `finance-value-panels` z `panel=real-options`. | Formularz „Opcje realne" + policzony wynik: WARTOŚĆ OPCJI 285 000, ROZSZERZONE NPV 385 000, REKOMENDACJA „Odrocz". Jasność light=249.8, dark=17.4 (para spójna, oba motywy pokazują ten sam policzony stan). | **NIE** — nie ma obrazu, na którym właściciel mógłby to widzieć. |
| frontier (granica efektywna) | `[data-testid="frontier-chart"]` | **TAK** (1/1) | **BRAK — nigdy nie zrobiono.** | Formularz 4 inicjatyw + „OPTYMALNE — WARTOŚĆ 940 000", „OPTYMALNE — RYZYKO 29%", wykres punktowy z krzywą granicy. Jasność light=249.6, dark=20.4. | **NIE** |
| sensitivity (wrażliwość what-if) | `[data-testid="sens-tornado-chart"]` **ORAZ** `[data-testid="sens-heatmap-chart"]` (oba, AND) | **TAK** (1/1) — oba wykresy potwierdzone w DOM w chwili zrzutu | **BRAK — nigdy nie zrobiono.** | Tornado (3 driver: Revenue growth/Gross margin/Operating costs, baza 1.1M) ORAZ heatmapa 2D 5×5 (price×wacc, 880k–1.4M) — oba wykresy widoczne na jednym zrzucie. Jasność light=245.9, dark=29.3. | **NIE** |
| monte carlo | `[data-testid="mc-histogram"]` | **TAK** (1/1) | **BRAK — nigdy nie zrobiono.** | Formularz 2 czynników (Revenue/Cost) + ŚREDNIE NPV 1 140 000, P10/P50/P90, P(NPV>0) 94%, histogram 6 słupków. Jasność light=245.3, dark=22.8. | **NIE** |
| scenarios | `[data-testid="scenario-fan-chart"]` | **TAK** (1/1) | **BRAK — nigdy nie zrobiono.** | Wykres wachlarzowy (Bazowy/Optymistyczny/Konserwatywny), seria przychodów P1–P6. Jasność light=246.8, dark=20.1. | **NIE** |

Wszystkie 5 plików `_wynik-kontrola__PO.json` (jeden na katalog) potwierdzają
`"ok": true, "reasons": []` — patrz `evidence/grafika/189-panele-wyceny-<nazwa>/`.

## Kluczowe ustalenie (Zadanie 3)

W `evidence/grafika/` istnieją TRZY starsze katalogi z zrzutami ekranu
`finance-value-panels`: `09-finanse`, `137-finanse-admin-powtorka`,
`144-runda-pelna-b`. **Żaden z nich nie ma parametru `panel=` w nazwie pliku
i żaden nie pokazuje żadnego z pięciu paneli wyceny objętych tym zadaniem.**
Sprawdzone: pokazują wyłącznie domyślny panel `value` (Value Office —
most wartości + portfel decyzyjny) w stanie `empty` (`09-finanse`, zrzut
„Brak inicjatyw do pokazania") i w stanie `populated` (`144-runda-pelna-b`,
zrzut z realnym mostem wartości i portfelem). Żaden stary zrzut `driver`
(planer nośników) też nie istnieje pod tą nazwą.

Był jeszcze jeden zestaw — `scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs`
(naprawa wyścigu dyżuru 233), uruchomiony dziś o 11:44 do
`/private/tmp/fix233-zrzuty-artefakty` — ale to katalog TYMCZASOWY (poza
`evidence/`, nigdy niewspomniany w żadnym pliku `docs/`/`Harvard/`), a co
ważniejsze **te zrzuty już same używały poprawionego mechanizmu czekania na
wynik** (ten sam wzorzec co dzisiejsze `--wynik-selektor`) — nie są więc
przykładem „starego, kłamiącego" zrzutu, tylko dowodem naprawy z tej samej
sesji, nigdy niescommitowanym jako dowód dla właściciela.

**Wniosek: 0 z 5 paneli wyceny miało KIEDYKOLWIEK zrzut w `evidence/grafika/`
przed dzisiejszą partią.** Nie da się więc stwierdzić „stary zrzut pokazywał
pustkę zamiast wyniku" dla żadnego z pięciu — bo starego zrzutu w ogóle nie
było. To gorszy przypadek niż „zrzut kłamał": ocena właściciela dla tego
ekranu nie mogła się opierać na obrazie tych pięciu paneli, bo taki obraz
nigdy nie został wyprodukowany.

## Zgodność z `docs/program/grafika/status.json`

Wpis `finance-value-panels` (ocena **C**) ma notatkę z dzisiejszego pomiaru
(„★ POMIAR 2026-09-01, naprawa parytetu, Kategoria 4 audytu przyrządu"):
siedem montowanych paneli (w tym wszystkich pięć z tej tabeli) ma **ZERO
wołaczy JSX w `src/`** — FinanceHub (realny ekran produktu) ich nie renderuje.
Backend zna te panele z nazwy (`financeValueDemoAllowlist.ts`), ale brakuje
przewodu po stronie UI. Innymi słowy: nawet gdyby stary zrzut istniał, i tak
pokazywałby coś, czego klient w produkcie nie widzi — `naprawione: []` w tym
wpisie potwierdza, że nic tu jeszcze nie zamknięto. Nie ma w `wyjatki` żadnego
zdania sugerującego, że właściciel oglądał policzone wykresy tych pięciu
paneli — jedyne dwie uwagi dotyczą języka osi (angielski) i braku wołacza.

## Bezpiecznik narzędzia — dwa selektory naraz

`WYNIK_SELEKTOR` w `grafika-zrzuty.mjs` dzieli `--wynik-selektor` po
przecinku i wymaga **wszystkich** (`sels.every(...)`, AND) — dokładnie jak
`day233-finanse-panele-zrzuty-jasne.mjs`. Użyto tego wprost dla `sensitivity`:
`--wynik-selektor='[data-testid="sens-tornado-chart"],[data-testid="sens-heatmap-chart"]'`
— para przeszła z obydwoma wykresami potwierdzonymi w DOM. Żadnego obejścia
nie było potrzeba.
