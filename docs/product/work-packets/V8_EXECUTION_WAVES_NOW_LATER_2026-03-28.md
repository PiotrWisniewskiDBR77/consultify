# V8 Execution Waves - Now / Later

> Date: 2026-03-28
> Owner: Product + Engineering
> Purpose: zamrozic aktualny podzial pracy na dwie fale wykonawcze, zeby dalszy delivery nie rozjechal sie z uzgodnionym kierunkiem
> Status: active working split

---

## 1. Zasada

Od tego momentu nie prowadzimy juz rozmowy w logice:

- `must have / nice have`

Prowadzimy ja w logice:

- `teraz`
- `pozniej`

To oznacza:

- `teraz` = zakres, ktory chcemy realnie doprowadzic do odbieralnego stanu w obecnej fali
- `pozniej` = rzeczy swiadomie odroczone, nie dlatego ze sa niewazne, tylko dlatego ze sa zbyt szerokie, zbyt chaotyczne albo wymagaja osobnego programu

---

## 2. Fala `teraz`

To jest zakres, dla ktorego przygotowujemy dokument wykonawczy i pakiety delivery.

### Core product surfaces

- `Czat / Teresa`
- `Landing / Anna`
- `MyWork`
- `Radar`
- `Idea founder / Idea maker`
- `Mindmap`
- `Whiteboard`
- `Proces flow`
- `Tabele`
- `Notatki`
- `Kalendarz`
- `Integracja`
- `Komunikacja dwukierunkowa`
- `Interview / Ankiety`

### Delivery / analysis / support surfaces

- `Tools / Assessment / DRD / SIRI / ADMA`
- `Inicjatywy / Projekty`
- `Wdrożenia / Execution`
- `KPI / BI`
- `Finanse`
- `Help / Baza wiedzy`
- `Program partnerski`
- `Superadmin`

### Interpretacja tej fali

Ta fala nie zaklada dowiezienia `100%` pierwotnej wizji dla kazdego modulu.

Zaklada dowiezienie:

- minimalnego stanu odbiorowego,
- sensownego flow usera,
- i braku kompromitujacych dziur na glownych surfaces.

---

## 3. Fala `pozniej`

To sa obszary, ktorych na ten moment nie wciskamy do biezacej fali wykonawczej.

### Osobny program `Outputs`

- `Outputs Library`
- `Documents / Word`
- `Presentations`
- `Sheet / Excel`
- `ArtifactRun z czatu`
- `Object-linked outputs`
- `Notebook outputs`
- `Report -> Presentation`
- `Provenance / review / visibility`
- `Pelny Reports / Presentations builder`

Status docelowy:

- `coming soon`

Powod:

- obecny stan jest zbyt chaotyczny i nierowny,
- ten obszar wymaga osobnego uporzadkowania,
- nie chcemy, zeby rozwalil tempo biezacej fali.

### Szersze programy poza biezacym delivery

- `Agenci / KIMI / Prompty / Palantir` jako osobne silne produkty
- `Organization`
- `Settings`
- `Admin`
- `Edukacja`
- szeroka `Komunikacja` jako osobny produkt, jesli wyjdzie poza biezace flows
- inne duze rozbudowy, ktore nie sluza bezposrednio odbiorowi obecnej fali

---

## 4. Zasady operacyjne

### Dla fali `teraz`

Kazdy modul musi dostac:

- definicje minimalnego stanu odbiorowego,
- liste brakujacych funkcji,
- najmniejsze sensowne pakiety wykonawcze,
- jasny proof odbioru.

### Dla fali `pozniej`

Nie robimy teraz:

- ukrytego rozszerzania zakresu,
- dorzucania pojedynczych patchy tylko dlatego, ze cos "juz prawie jest",
- mieszania porzadkowania `Outputs` z biezacym delivery glownych modulow.

---

## 5. Kolejny krok

Nastepny dokument / krok roboczy ma odpowiedziec na pytanie:

- `jakie konkretne funkcje trzeba jeszcze dowiezc w modulach z fali teraz`

Czyli dla kazdego modulu z sekcji `teraz` powstanie:

- krotki opis celu,
- lista brakujacych funkcji,
- i minimalny stan odbiorowy.
