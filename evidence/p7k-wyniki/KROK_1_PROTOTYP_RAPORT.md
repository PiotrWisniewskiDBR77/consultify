# P7K Wyniki — KROK 1: prototyp przed kodem

Data: 2026-09-05  
Baza: `origin/staging` @ `8f0070f654accbd636bf3908ac2828d7434e748a`  
Status: **STOP DO AKCEPTU NADZORCY/WŁAŚCICIELA**. Nie rozpoczęto KROKU 2.

## Co pokazuje prototyp

Jeden dev-render `p7k-wyniki-prototype` ma osiem widoków sterowanych parametrem `view`:

- KPI L1: tabela raportów okresowych.
- KPI L2: raport Plant Balanced Scorecard grupowany po obszarze, elementy kontraktu miernika, CEL/Rezultat dla lipca, sierpnia i września oraz YTD, podsumowanie i „Dodaj miernik”.
- KPI L3: jedna karta miernika z siedmioma sekcjami i otwartą kartą działania o polach z arkusza.
- OKR L1: tabela raportów zakres × cykl.
- OKR L2: tabela rezultatów grupowana temat → cel, z właścicielem jako kolumną i widocznym filtrem domyślnym, START/CEL/BIEŻĄCA, postępem, pewnością, terminem oraz check-inem.
- OKR L3: jedna karta celu, a rezultaty są blokami sekcji, nie osobnymi stronami.
- ROI L1: tabela analiz z CAPEX, Annual Net Benefit, ROI z horyzontem, Payback, NPV, IRR, rekomendacją i fazą.
- ROI L2: jedna karta N w kolejności Założenia → Wyliczenia → Realizacja, z Expected/Actual/Wariancją, prawdziwością założeń i ROI po realizacji.

Menu 2 ma dokładnie KPI · OKR · ROI. Dane przykładowe są opisane jako DBR77 i korzystają z mierników/elementów arkusza właściciela. Prototyp korzysta z istniejącego `StandardTable`; nie dodano komponentu tabeli ani kafelków. Kolory korzystają z tokenów `c-*`; skan prototypu nie znalazł `primary-*` ani surowych kolorów czerwonych.

## Zrzuty 1440

Każdy widok ma wariant jasny i ciemny w `evidence/p7k-wyniki/prototype/`:

| Widok | Jasny | Ciemny |
| --- | --- | --- |
| KPI L1 | `kpi-l1--light.png` | `kpi-l1--dark.png` |
| KPI L2 | `kpi-l2--light.png` | `kpi-l2--dark.png` |
| KPI L3 | `kpi-l3--light.png` | `kpi-l3--dark.png` |
| OKR L1 | `okr-l1--light.png` | `okr-l1--dark.png` |
| OKR L2 | `okr-l2--light.png` | `okr-l2--dark.png` |
| OKR L3 | `okr-l3--light.png` | `okr-l3--dark.png` |
| ROI L1 | `roi-l1--light.png` | `roi-l1--dark.png` |
| ROI L2 | `roi-l2--light.png` | `roi-l2--dark.png` |

Obok każdego PNG znajduje się JSON z adresem, HTTP, konsolą, siecią, liczbą `aside`, liczbą tabel i szerokością dokumentu.

## Pomiar automatyczny

Wynik dla 16 renderów:

- HTTP 200: 16/16.
- błędy konsoli: 0.
- odpowiedzi sieciowe ≥400: 0.
- maksymalna liczba `aside`: 1.
- tabele obecne na wszystkich poziomach list/raportów: KPI L1/L2, OKR L1/L2, ROI L1.
- szerokość viewportu: 1440 px; brak przepełnienia dokumentu.
- KPI L2 pokazuje 3 okresy, każdy jako CEL/Rezultat, oraz YTD w tym samym kadrze.
- brak danych jest prezentowany jako „—”, nie jako 0.

Polecenia:

```text
npx esbuild dev-render/screens/p7k-wyniki-prototype.tsx --bundle --platform=browser --outfile=/private/tmp/p7k-prototype.js --log-level=error --loader:.png=file --loader:.svg=file
node scripts/dev/p7k-prototype-capture.mjs
```

Bundlowanie zakończyło się kodem 0. Zrzuty zostały dodatkowo obejrzane dla KPI L2 jasnego, OKR L2 ciemnego, OKR L3 jasnego i ROI L2 ciemnego.

## Granica dowodu

To jest prototyp graficzny, nie implementacja produkcyjna. Nie dowodzi schematu DB, migracji, API, i18n pl+en, wyliczeń NPV/IRR/PP ani przepływu odchylenie → powiadomienie → Skrzynka → karta działania. Te bramki należą do części A/B/C po akcepcie prototypu. KROK 2 nie może rozpocząć się przed akceptem.

## Twierdzenia niezweryfikowane

- Nie wykonano jeszcze §10 i §16 dla kodu produkcyjnego, bo zgodnie z kolejnością praca zatrzymuje się przed KROKIEM 2.
- Klikalna nawigacja L1 → L2 → L3 i brak trasy osobnej karty KR są pokazane jako docelowa architektura, ale nie zostały jeszcze zmienione w produkcyjnych trasach.
- Dane liczbowe prototypu są realistycznym zestawem DBR77 opartym na strukturze arkusza, nie odczytem z produkcyjnej bazy DBR77.
- W prototypie oceniono polską wersję właścicielską; komplet i18n pl+en będzie bramką części A/C.
