# PLAN DOJŚCIA DO KOŃCA — stan na 2026-08-28

Cel: 16+1 modułów zintegrowanych, ≥9,5/10 w panelach niezależnych ekspertów,
aplikacja działająca jako całość.

---

## 1. RACHUNEK — uczciwy, z jawnym wzrostem

**Wykonane: 59 dyżurów numerowanych.**

Pozostało — oszacowanie z podziałem, nie jedną liczbą:

| blok | dyżurów | podstawa oszacowania |
|---|---|---|
| 16 modułów × domknięcie | 45–55 | ~3 na moduł: główny + dokończenie + odbiór końcowy |
| dług testowy (~700 czerwonych) | 4–8 | zależne od wyniku diagnozy (dyżur 59) |
| bloki przekrojowe (auth, CI, typy) | 4–6 | dwa już w toku, częściowo domknięte |
| dokumenty i szablony | 6–10 | największa niewiadoma — patrz §4 |
| wygląd i polerowanie | 8–12 | sekwencyjne przez akcept właściciela, nie da się zrównoleglić |
| odbiory końcowe `CLOSED_FINAL` | 16 | po jednym na moduł, nieusuwalne |
| rezerwa na nieprzewidziane | +15% | historyczna, wyliczona z ostatnich trzech dni |

**Razem pozostało: 95–125. Łącznie z wykonanymi: 155–185.**

Poprzedni cel 128 był postawiony, zanim zmierzyliśmy dług testowy i stan CI.
**Nie dopasowuję starego szacunku — podaję nowy z przyczyną.**

Przy rytmie 4 fale × 6 dyżurów = 24 dziennie: **4–5 dni roboczych.**

---

## 2. FAZY

### FAZA A — FUNDAMENT (w toku, kończy się dziś)
Domknięcie dyżurów 55–59. Przyrząd pomiarowy musi działać, zanim ruszy produkcja
seryjna: bez zielonej siatki testów żadna kolejna fala nie wykryje, że coś zepsuła.
**Warunek wyjścia:** 55, 56, 57 scalone; mapa długu testowego z dyżuru 59 gotowa.

### FAZA B — DŁUG TESTOWY (pierwsza fala nowego integratora)
Naprawa ~700 czerwonych, pokrojona na rozłączne pakiety wg mapy z dyżuru 59.
**Warunek wyjścia:** bramka CI potrafi zaświecić na czerwono i świeci na zielono
na czystym przebiegu. Dopiero wtedy „testy przeszły" zaczyna cokolwiek znaczyć.

### FAZA C — MODUŁY (rdzeń, największa objętość)
16 modułów, fale po 6 dyżurów rozłącznych plikowo. Kolejność wg dwóch kryteriów:
najpierw moduły z największą liczbą otwartych pozycji, ale **moduły dzielące pliki
przekrojowe nigdy w tej samej fali**.
**Warunek wyjścia per moduł:** wszystkie pozycje zamknięte albo jawnie odroczone
decyzją właściciela; odbiór adwersaryjny bez blokujących.

### FAZA D — DOKUMENTY I SZABLONY
Wydzielona, bo rządzi się inną regułą: **najpierw prototyp dokumentu jako PLIK
do akceptu właściciela, dopiero potem mechanika.** Powód: przez cały program nie
powstał ani jeden naprawdę dobry dokument z szablonu, a każde podejście „zbudujmy
silnik, potem zobaczymy" kończyło się pustym formularzem.

### FAZA E — WYGLĄD
Nie da się zrównoleglić: każdy ekran wymaga prototypu, akceptu, budowy z parytetem
i oględzin. Planować partiami, rzadziej, większymi. To wąskie gardło całego programu
i trzeba je przyjąć, nie obchodzić.

### FAZA F — INTEGRACJA KOŃCOWA
**Prowadzi nadzorca osobiście, nie integrator.** Powód: to jedyna faza, w której
liczy się nie moduł, lecz produkt jako całość — a nikt, kto budował części, nie
zobaczy ich szwów.
Zakres: przejścia między modułami · spójność danych demo · pełne ścieżki użytkownika
end-to-end · panel ekspercki · promocja na środowisko docelowe.

---

## 3. TEST DYMNY PRODUKTU — czego nam brakuje najbardziej

**Problem:** mierzymy moduły, nie produkt. Każdy moduł może być zielony, a aplikacja
jako całość nie działać, bo pęka na szwach między nimi.

**Rozwiązanie:** jedna ścieżka end-to-end przez cały produkt, uruchamiana **po każdej
fali**, przez realny Gateway na realnej bazie:
```
logowanie → wybór organizacji → utworzenie oceny → wypełnienie →
wygenerowanie dokumentu → utworzenie inicjatywy z wyniku →
zadanie w Mojej pracy → raport → udostępnienie linkiem
```
Wynik binarny: przeszło / nie przeszło, z numerem kroku, na którym pękło.

To jest jedyna liczba, która mówi „produkt żyje". Wszystkie inne mówią o częściach.
**Zbudować w Fazie B**, razem z długiem testowym — bez tego Faza C leci na ślepo.

---

## 4. RZECZY, KTÓRE MOGĄ WYSADZIĆ PLAN

| ryzyko | dlaczego groźne | co robimy |
|---|---|---|
| **Dokumenty i szablony** | nigdy nie powstał dobry dokument z szablonu; nie wiemy, ile pracy dzieli nas od pierwszego | prototyp-plik przed mechaniką; jeśli po dwóch podejściach nie ma dobrego pliku — zawężamy zakres MVP |
| **Wygląd nie skaluje się** | akcept wzrokowy jest sekwencyjny, przez jedną osobę | partie zamiast pojedynczych ekranów; planować od początku, nie na końcu |
| **Dług testowy głębszy niż mapa** | 700 to liczba porażek, nie przyczyn | diagnoza (59) przed naprawą; jeśli przyczyn jest ponad 30 — osobna faza |
| **Integrator bez pamięci wraca do rozstrzygniętych spraw** | brak pamięci między sesjami | rejestr z uzasadnieniami + lista spraw zamkniętych i nieotwieralnych (§5) |
| **Prognoza rośnie dalej** | każdy tydzień odsłania nowe | raportować wzrost jawnie; nigdy nie dopasowywać starych liczb |

---

## 5. SPRAWY ZAMKNIĘTE — NIE OTWIERAĆ BEZ DECYZJI WŁAŚCICIELA

Lista istnieje, bo operator bez pamięci między sesjami będzie próbował je odkryć
ponownie. Każda pozycja: rozstrzygnięta, z powodem, w rejestrze.

- **Gałąź org-context (37)** — NIE przejmujemy w całości. Niesie regresję i +53 czerwone.
- **Katalog narzędzi MVP** — wyłącznie Dynamic SWOT. Zakaz rozszerzania bez decyzji.
- **Bramka CI** — blokująca, bez wyjątków. Dług spłacamy, nie obchodzimy.
- **Migracje demo/staging z poziomu dyżuru** — zakazane. Operacje na środowiskach
  wykonuje wyłącznie właściciel.
- **Produkcja** — nietykalna bez osobnej zgody, za każdym razem.

---

## 6. DOKUMENTACJA POWSTAJE W TRAKCIE, NIE NA KOŃCU

**Zasada:** wykonawca dokumentuje w czasie budowy, nie po niej. Dokumentacja pisana
po fakcie jest rekonstrukcją, a rekonstrukcja gubi to, co najcenniejsze: dlaczego
odrzucono inne rozwiązanie i co nie zadziałało.

**Dziennik budowy modułu** — jeden plik na moduł, dopisywany przez każdy dyżur,
który go dotyka. Cztery rubryki:
1. **Co zbudowano** — jednym zdaniem, z plikami.
2. **Dlaczego tak, a nie inaczej** — jakie rozwiązanie odrzucono i z jakiego powodu.
3. **Czego nie wiemy** — pytania otwarte, założenia niezweryfikowane.
4. **Co się zepsuło po drodze** — ślepe uliczki. To jest rubryka, która ratuje
   następcę przed powtórzeniem tej samej pomyłki.

Wpis do dziennika jest **warunkiem karty dowodowej**, nie dodatkiem.
