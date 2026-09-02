---
doc_id: funkcje-gamma-g0-pomiar
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# G-0: co naprawdę leży w kodzie pod prezentacjami

Właściciel: *„to już było przygotowywane w kodzie"*. Zmierzone — i owszem, leży
sporo. Problem nie w tym, że czegoś nie ma. Problem w tym, że **rzeczy są
porozłączane, a interfejs pokazuje co innego niż wychodzi w pliku**.

## ★★ Najgroźniejsze: konsultant edytuje wygląd, klika Zapisz — i dane giną

**System 5 — edytor kolorów i fontów per układ (`PresentationTemplateArchitectView`)
jest MARTWY.** Front wysyła `customTemplate` (`handleSave()`, linia 517), a backend
`PATCH /templates/:id` (`presentations.routes.ts:1566`) **destrukturyzuje `req.body`
bez tego pola**. Nigdy nie trafia do bazy. Konsultant ustawia kroje i kolory, zapisuje,
dostaje potwierdzenie — i **jego praca znika po stronie serwera**.

**System 6 — 13 gotowych zestawów kolorystycznych (`CURATED_COLOR_SETS`) — MARTWY
dla eksportu.** Zapisuje się do bazy, ale funkcja budująca ustawienia renderu czyta
z tego pola tylko `customTemplate`, **nigdy `colorTemplateId`**. Zero wystąpień
`curatedColorSets` w całym `server/src`.

Skutek: **to, co konsultant widzi w edytorze na ekranie, to NIE jest to, co wyleci
w pliku.** Dziewiąta klasa kłamstwa z naszego katalogu — i pierwsza, która okłamuje
płacącego użytkownika w jego własnej pracy.

## Dwa żywe renderery, które się ze sobą nie zgadzają

| | renderer kanoniczny | renderer zapasowy |
| --- | --- | --- |
| gdzie | `report/pptx/PptxPipelineService` + `designTokens.ts` | `deliverables/DeckStyler.ts` + `themeRegistry.ts` |
| margines | **0,5 cala** | **0,6 cala** |
| góra treści | 1,0 cala | 1,7 cala |
| hexów na sztywno | **53** | 10 |

Oba są żywe. Zapasowy jest wołany nie tylko przy awarii pierwszego, ale też
**bezwarunkowo** z trasy inicjatyw (`initiativeMaterializeService.ts:488`,
zamontowana **bez żadnej flagi**). Czyli ten sam produkt potrafi dziś wypuścić dwa
pliki o **różnej geometrii**, zależnie od tego, którędy poszedł.

**Żaden z nich nie czyta tokenów produktu** — potwierdzone: `grep c-accent` w
`server/src` daje zero. To nie jest zaniedbanie, tylko strukturalna przeszkoda:
serwer nie ma dostępu do zmiennych CSS przeglądarki, a pomostu nie zbudowano.
Nawet wewnątrz własnych systemów panuje niespójność — zestaw „harvard" ma crimson
`#A51C30`, a token produktu to `#85182F`.

## Sufit biblioteki — sprawdzony w zainstalowanej paczce, nie z pamięci

`pptxgenjs 4.0.1`:

| cecha | stan |
| --- | --- |
| **gradienty** | **NIEMOŻLIWE** — zero wystąpień słowa „gradient" w całej paczce (typy + wszystkie bundle). Trzeba symulować nakładaniem półprzezroczystych kształtów |
| **osadzanie fontów** | **NIEMOŻLIWE** — biblioteka tego nie oferuje. Twardy sufit |
| przezroczystość | dostępna i już używana |
| kształty | dostępny **duży niewykorzystany zapas** (pełny zestaw OOXML) |
| auto-dopasowanie tekstu | dostępne, używane szeroko |
| obrazy w tle | dostępne, używane na okładce |

Robotnik pomiarowy **sprostował przy tym wstępną ocenę drugiego robotnika**, który
założył wsparcie gradientów z wiedzy ogólnej. Sprawdzenie w realnej paczce tego nie
potwierdziło. **Sufit gammowości tła jest niżej, niż zakładaliśmy.**

## Treść — działa na dwóch z trzech dróg

| droga | treść |
| --- | --- |
| czat / Teresa | **realny model**, działa dziś |
| Kreator z bogatymi źródłami | **realny model** + kontrole po fakcie, działa dziś |
| biblioteka szablonów | **zero modelu** — dopasowanie po słowach kluczowych; **użytkownik nadal dostaje puste miejsca** |

Dyżur 186 dowiózł silnik treści (odbiór B+/A−, akcept właściciela 30.08), ale
**żadne z czterech zmierzonych wejść nawigacyjnych nie przekazuje briefu** do trasy
bibliotecznej. Silnik działa, przewód nie jest podłączony. To decyzja produktowa
(skąd brief: czat? modal?), nie łatka.

## Co z tego wynika dla marzenia
Nie zaczynamy od zera i nie zaczynamy od pisania renderera. Zaczynamy od:
1. **jednej geometrii** zamiast dwóch,
2. **odblokowania tego, co konsultant już ustawia** (dwa martwe kanały),
3. **świadomego przyjęcia sufitu** — bez gradientów i bez osadzania fontów,
4. dopiero potem: motyw „gamma-grade" na tokenach produktu.

Prototyp trzech slajdów **jako plik** idzie przed budową — reguła 7.
