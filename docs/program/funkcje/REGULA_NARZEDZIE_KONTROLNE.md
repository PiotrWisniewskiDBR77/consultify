---
doc_id: funkcje-regula-narzedzie-kontrolne
status: canonical
owner: piotr
truth_type: process
established: 2026-09-01
---

# Narzędzie kontrolne musi mieć własny dowód mutacyjny ZANIM ktokolwiek zobaczy jego wynik

Reguła wypracowana wspólnie z torem grafiki 1.09, po tym jak **w jednym dniu, w dwóch
niezależnych torach, oba narzędzia kontrolne skłamały o rzeczywistości, którą miały pilnować.**

## Dowód — dwa niezależne przypadki tego samego dnia

**Tor funkcji.** Bezpiecznik spisu ekranów dowodowych, dopisany po to, żeby łapać cudze
błędy. Dwa nowe wymiary kontroli dały **siedem alarmów na siedem — wszystkie fałszywe**.
Trzy przyczyny: nie pomijał **linii zakomentowanych** · dopasowywał tylko wywołania
**bez atrybutów** · łapał nazwę **wewnątrz napisu opisowego**.
**Narzędzie napisane przeciw kłamiącym narzędziom skłamało w pierwszym uruchomieniu.**

**Tor grafiki.** Bramka parytetu czytała `/settings/*` w łańcuchu znaków **jako początek
komentarza** i **zjadała sześćset linii pliku tras**, gubiąc wołacze Ustawień, Organizacji
i Finansów. **Siedem pozycji ich rejestru długu okazało się duchami.**

**Różnica kierunku jest pouczająca:** nasze narzędzie myliło się **w stronę fałszywych
alarmów** (widać od razu, kosztuje czas), ich **w stronę fałszywego spokoju ORAZ fałszywych
alarmów naraz** (nie widać wcale, kosztuje zaufanie).

## Reguła
> **Narzędzie kontrolne dostaje własny dowód mutacyjny ZANIM ktokolwiek zobaczy jego wynik.
> Nie po pierwszym błędzie — od początku.**

Dowód ma tę samą postać, co przy zabezpieczeniach produktu: **zepsuj to, czego narzędzie
pilnuje, pokaż że robi się czerwono; przywróć, pokaż że robi się zielono; potwierdź,
że drzewo jest czyste.**

Powód jest prosty: **wynik narzędzia kontrolnego trafia do rejestru i staje się „faktem".**
Fałszywy alarm marnuje dzień. Fałszywy spokój marnuje tydzień i kończy się tym, że
właściciel dowiaduje się o wadzie **z własnych oczu**.

## Druga reguła, z tej samej wymiany
> **Ostrzeżenie szersze niż fakt kosztuje tę samą walutę co fałszywy alarm.**

Ostrzegliśmy tor grafiki, że „tamta wersja narzędzia kłamała, pobierzcie ponownie".
**Ich to nie dotyczyło** — pobrali wersję **sprzed** dopisania wadliwego wymiaru, a trzy
pierwotne sprawdzenia działały poprawnie i **to one znalazły ich defekt**.
Ostrzeżenie było prawdziwe co do narzędzia, ale **szersze niż fakt** — i kosztowało ich
czas na sprawdzanie czegoś, co było w porządku. **Ostrzegając, podawaj zakres.**

## Trzecia reguła — zawężenie wniosku o archiwum
Nowa kontrola pary zrzutów czyta znaczniki **z żywego drzewa dokumentu w chwili
fotografowania**, więc **archiwum jest dla niej niedostępne**. Wniosek „każdy wcześniejszy
zrzut ma status **nieznany**" jest prawdziwy — ale sam z siebie **mylący**.

**Ryzyko nie rozkłada się równo.** Kształt 19 wymaga, żeby ekran **coś liczył albo
doładowywał po zdarzeniu**. Statyczny widok na danych podstawionych **nie ma czego ścigać**.

> **Nie mów „wszystkie wcześniejsze zrzuty są niepewne" — to formalnie prawdziwe
> i praktycznie mylące. Podaj listę ekranów, na których to naprawdę mogło się wydarzyć.**

### Nasza lista — ekrany dowodowe podwyższonego ryzyka (z 246)
Kryterium: ekran zawiera obliczenie albo doładowanie po zdarzeniu.

**★ Kolumna „status" jest obowiązkowa i wprowadzona na żądanie toru grafiki.**
Mieszanie **zmierzonego** z **przewidywanym** w jednej liście to dokładnie sposób,
w jaki **hipoteza nadzorcy wraca po tygodniu jako „zweryfikowany fakt"**.
Właściciel ma prawo widzieć tę różnicę.

| Ekran | Status |
| --- | --- |
| **panele wyceny** (Monte Carlo, scenariusze, opcje realne, granica, wrażliwość) | **ZMIERZONE — defekt WYSTĄPIŁ**, dyżur 233; jedyne miejsce, gdzie widzieliśmy to na oczy |
| `results-vnext-roi-full-tool` | hipoteza o zasięgu — najwyższe zagęszczenie obliczeń w zbiorze |
| `results-vnext-roi-registry` | hipoteza o zasięgu |
| `finance-statement-pack-workspace-v2` | hipoteza o zasięgu |
| `results-vnext-registry-shell` | hipoteza o zasięgu |
| `document-studio-streaming-honesty-n3` | hipoteza o zasięgu — strumieniowanie treści |
| `deck-artifact` · `karta-insight` · `insight-artifact` | hipoteza o zasięgu — generowanie treści |
| `idea-financial-case-persistence` | hipoteza o zasięgu — zapis i przeliczenie |

**Jeden wiersz zmierzony, osiem hipotez o zasięgu.** Pozostałe ~237 ekranów to widoki
statyczne — ryzyko bliskie zeru.

**Przy najbliższym oglądaniu partii przez właściciela zrzuty z tej listy mają być świeże.**
Reszta może zostać. **Próg uzgodniony z torem grafiki — jeden, nie dwa.**

## Czwarta reguła — zgłoszenie punktowe jest hipotezą o zasięgu
Od toru grafiki, potwierdzona u nich **cztery razy jednego dnia**: cztery zgłoszone
szerokości panelu okazały się **piętnastoma**; dwa paski przyrządu w kadrze okazały się
**dziewiętnastoma ekranami**.

> **Zanim naprawisz punkt, przemieć obszar tym samym wzorcem — inaczej naprawa odrasta.**

**Stosuje się do nas natychmiast, w trzech dzisiejszych sprawach:**
1. **Dziura w uprawnieniach formularzy** — przemiatanie **uruchomione** (audyt wszystkich
   rodzin tras serwera).
2. **Fałszywa obietnica zapisu** (kreator formularzy, dziewiąty przypadek) — przemiatanie
   **wykonane** w Mojej Pracy i Portalu Partnerskim; reszta produktu **nieprzemieciona**.
3. **Rozjazd nazw pól front-zaplecze** (kolumna „Postęp" w Audytach pokazująca literalnie
   ukośnik, bo ekran pyta o `concludedCriteria`, a odpowiedź niesie `criteriaConcluded`) —
   **zgłoszone punktowo, obszar NIEPRZEMIECIONY.** To jest dokładnie ten kształt: brakująca
   wartość **renderuje się cicho**, bez błędu i bez czerwieni, więc **żaden test tego nie łapie**.
   Ta sama rodzina co dwie z trzech przyczyn zer na ekranie polityk AI. **Przemiatanie zlecone.**

---

# PIĄTA REGUŁA — przegląd wszystkich bezpieczników jednym pytaniem (1.09, od toru grafiki)

> **Co robi ten bezpiecznik, gdy NIE MOŻE wykonać pomiaru?**
> **Jeśli odpowiedź brzmi „przechodzi dalej" — to jest ta sama dziura, niezależnie od tego,
> czego pilnuje.**

## Skąd ta reguła
Bramka spisu ekranów opierała kontrolę składni **wyłącznie na jednym narzędziu**. W katalogu
bez zainstalowanych pakietów pisała `• niedostepny — pominieto sprawdzenie` **i kończyła
z wynikiem pozytywnym**. Przepuściła zepsuty plik **dwa razy tego samego dnia**.

**Nadzorca przeczytał „pominięto sprawdzenie" jako „sprawdzenie przeszło".**

Warunek, który przy kontroli par zrzutów uznaliśmy za **jedyną własność odróżniającą
bezpiecznik od ozdoby** — *brak pomiaru nie jest wynikiem pozytywnym* — **nie był zastosowany
do reszty narzędzi.** Nikt tego nie sprawdził, bo każde narzędzie oceniano osobno.

## Przegląd własnych bezpieczników — wykonany, trzy wyniki

| Bezpiecznik | Gdy nie może zmierzyć | Werdykt |
| --- | --- | --- |
| Bramka spisu ekranów | **przechodziła** → naprawione: kontrola strukturalna **bez zależności**, chodzi zawsze | **BYŁA DZIURAWA** |
| Średnia jasność | **rzuca wyjątkiem** przy nieczytelnym pliku — głośno, nie da się przeoczyć | **POPRAWNY** |
| Kontrola pary zrzutów | brak pomiaru → **dopisuje powód → wynik negatywny** | **POPRAWNY** |

## ★ Ale ta sama dziura znalazła się o PIĘTRO WYŻEJ — i tam nadal jest
Kontrola pary zrzutów odmawia przejścia przy braku pomiaru **tylko wtedy, gdy wołający
o ten pomiar poprosi**. Parametr `requiresResultMarker` ma **wartość domyślną `false`**.

**Czyli wołający, który go po prostu nie poda — nie dostanie ani kontroli, ani ostrzeżenia.
Dostanie zielone.**

Bezpiecznik jest poprawny; **jego wartość domyślna nie jest.** To jest ta sama choroba
przeniesiona o warstwę wyżej: **nie „co robi, gdy nie może zmierzyć", tylko „co robi,
gdy nikt nie kazał mu mierzyć".**

Dziś to nie boli — **oba** istniejące wywołania podają ten parametr. Ale **następne
wywołanie napisze ktoś inny**, i cisza będzie jego wynikiem domyślnym.

**Do zrobienia:** odwrócić wartość domyślną — wymagać pomiaru, a **pominięcie kontroli
zrobić jawnym i nazwanym** (osobny parametr „świadomie bez markera, powód: …").
**Domyślna cisza jest błędem projektowym, nawet gdy dziś nikt z niej nie korzysta.**

## Reguła ogólna, która z tego wynika
> **Sprawdź nie tylko, co narzędzie robi przy braku pomiaru — ale też, co robi,
> gdy nikt go o pomiar nie poprosił. Wartość domyślna bezpiecznika to też zachowanie
> bezpiecznika.**
