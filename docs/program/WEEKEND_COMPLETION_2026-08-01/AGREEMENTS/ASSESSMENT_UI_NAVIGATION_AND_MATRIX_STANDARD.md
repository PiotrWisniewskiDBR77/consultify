---
document_id: ASSESSMENT-UI-NAVIGATION-MATRIX-STANDARD
module: Assessment
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Assessment — nawigacja i standard graficznej macierzy

## 1. Zasada

Macierz jest centralnym modelem mentalnym Assessmentu. Formularz wyjaśnia i
udowadnia wynik; macierz pokazuje jego kształt, kompletność i luki. Nie wolno
zastąpić jej zwykłą listą pytań ani schować wyłącznie w raporcie.

Standard graficzny Assessmentu nie dziedziczy obecnego wyglądu Tools. Ma być
spójny z kanonem UI aplikacji, ale projektowany dla innego rodzaju pracy:
sekwencyjnego pogłębiania tematu, skupienia i szybkiego powrotu do mapy całości.

## 1.1 Interview Focus — nowoczesny przepływ pytań

Domyślny ekran pracy nad jednostką zawiera:

- kompaktowy kontekst: axis/pillar, area/dimension i rozważany poziom;
- jedno główne pytanie albo 2–3 pytania tworzące nierozdzielną sekwencję;
- krótkie wyjaśnienie `dlaczego pytamy`;
- odpowiedź użytkownika i proponowane warianty jako pomoc, nie test ABC;
- evidence drop zone/link oraz stan dowodu;
- `Wstecz`, `Zapisz`, `Dalej`, `Pomiń z uzasadnieniem`;
- dyskretną akcję `Zapytaj Teresę` i lokalne AI actions;
- breadcrumb pytań i progress jednostki, bez wizualnego przeładowania.

Następne pytanie wynika z odpowiedzi i pogłębia temat. Historia rozmowy jest
dostępna jako zwijany context trail; nie zajmuje stale połowy ekranu. Użytkownik
może cofnąć się do wcześniejszego pytania bez utraty późniejszych odpowiedzi;
system oznacza zależne conclusions jako `needs review`.

## 2. Poziomy nawigacji

1. breadcrumb: `Assessment / Processes / [method] / [session]`;
2. Method Navigator: axis/pillar/building block → dimension/area;
3. level rail albo komórki macierzy;
4. zakładki jednostki: Interview, Evidence, Decision, Notes;
5. utilities: Comments, Activity, History, Relations, Used In.

Użytkownik może przejść z macierzy do dowolnej jednostki i wrócić dokładnie do
tego samego miejsca. `Next` przechodzi do następnej sensownej jednostki, ale nie
zatwierdza odpowiedzi ani poziomu.

## 2.1 Round-trip macierz ↔ pytanie

1. Użytkownik wybiera prostokąt/komórkę.
2. Otwiera się side sheet lub Focus View z area/dimension i dokładnym levelem.
3. System pokazuje pytania, udzielone odpowiedzi, evidence, proposal i decyzję.
4. Użytkownik może zmienić odpowiedź, dowód, rationale albo poprosić o review.
5. System pokazuje impact preview: które score/findings/outputy staną się stale.
6. Po zapisie użytkownik wraca do tej samej macierzy, pozycji i zaznaczenia.
7. Komórka oraz zależne summary aktualizują się z jednego modelu danych.

Quick edit może zmienić wyłącznie pola bezpieczne. Zmiana approved score wymaga
pełnego Decision View i zachowuje poprzednią decyzję w historii.

## 3. Semantyka komórki

Każda komórka dimension/area × level może mieć niezależne sygnały:

- poziom osiągnięty;
- poziom rozważany/proponowany;
- target;
- confirmed / partial / claimed / absent / unresolved / N/A;
- evidence complete / weak / missing / conflicting;
- AI proposal pending;
- review required;
- blocker.

Kolor podstawowy oznacza poziom dojrzałości. Obramowanie, ikona i pattern
oznaczają workflow/evidence. Nie wolno używać jednego koloru jednocześnie jako
poziomu, statusu oraz confidence. Każdy stan ma tekstowy odpowiednik i tooltip.

## 4. Zachowanie dojrzałości kumulatywnej

Jeżeli metodyka jest kumulatywna, wybór poziomu L oznacza, że warunki poziomów
niższych również muszą być spełnione zgodnie z regułami Method Pack. UI może
kolorować rampę 1..L, ale nie może uznać niższych poziomów bez walidacji.

Kliknięcie L:

1. otwiera definicję i atrybuty L;
2. pokazuje stan poziomów poprzednich;
3. uruchamia pytania różnicujące L-1/L/L+1;
4. pokazuje dowody i braki;
5. pozwala zapisać proposal, nie final score;
6. odświeża macierz dopiero zgodnie z semantyką proposal/approved.

## 5. Widoki graficzne

### DRD

- primary: 39 areas × właściwa skala poziomów, grupowanie w 7 osi;
- secondary: axis summary, current/target/gap i pathway;
- click-through z każdej komórki.

### SIRI

- primary: kanoniczne 16 dimensions × Bands 0–5;
- grouping: 3 building blocks i 8 pillars;
- osobny widok Prioritisation Matrix po freeze Assessment Matrix;
- agregacja nie może utracić danych 16D.

### ADMA

- primary work view: 12 dimensions × Levels 1–5 w 5 filarach;
- output mirror: jawna agregacja T1–T7;
- overlay: company/current, target i FoF benchmark ze źródłem.

## 6. Layout

Desktop: Navigator po lewej, Canvas centralnie, Teresa po prawej; macierz jako
sticky/expandable dolny panel lub pełnoekranowy tryb bez utraty Canvas context.

Docelowo użytkownik może wybrać:

- `Interview` — maksymalne skupienie na aktualnym pytaniu;
- `Split` — wywiad oraz kompaktowa macierz osi;
- `Matrix` — pełnoekranowa macierz z edycją komórki w side sheet.

Tryby są prezentacją tego samego stanu. System zapamiętuje preferowany widok
użytkownika i ostatnią pozycję w sesji.

Narrow: Navigator i Teresa stają się drawerami, macierz zachowuje zoom,
pan/scroll, legendę i focus. Nie powstaje uproszczony drugi runtime.

## 7. Accessibility i jakość

- pełna obsługa klawiatury i focus ring;
- komórka ma accessible name: metoda, jednostka, poziom, stan i evidence;
- legenda jest stale dostępna;
- zoom nie ucina nazw ani tooltipów;
- druk/eksport używa grafiki wektorowej lub semantic HTML/SVG;
- grafika w raporcie pochodzi z tego samego snapshotu co score.
