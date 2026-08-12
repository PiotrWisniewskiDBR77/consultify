# Wypróbuj sam — Results Next (KPI / ROI / OKR)

Krótka instrukcja, żeby wejść i poklikać. Środowisko jest lokalne (tylko na
tym komputerze), sprawdzone wcześniej przeze mnie — te ekrany działają.

---

## 1. Adres

```
http://localhost:3197
```

Zwykłe wejście na `http://localhost:3197/results/kpi` NIE POKAŻE ekranu —
trzeba dokleić parametr flagi (patrz punkt 3). Najprościej: użyj gotowych
linków niżej.

## 2. Login i hasło

```
login:  rn-g6-user-a-admin@consultify.local
hasło:  RnG6Runtime!2026
```

To jest rola ADMIN — jedna z dwóch, które w ogóle widzą ekrany Results Next
w tej wersji kodu (druga to OWNER). Jeśli spróbujesz zalogować się na
jakikolwiek inny testowy login, aplikacja grzecznie odeśle Cię na `/interview`
zamiast pokazać błąd — **to jest znany, zapisany stan, nie Twoja pomyłka**
(patrz punkt 5).

## 3. Gotowe linki (kliknij/skopiuj — flaga już wklejona)

- KPI: `http://localhost:3197/results/kpi?ff_resultsVNextKpi=1`
- ROI: `http://localhost:3197/results/roi?ff_resultsVNextRoi=1`
- OKR: `http://localhost:3197/results/okr?ff_resultsVNextOkr=1`
- Uwaga (przekrojowy widok KPI+OKR):
  `http://localhost:3197/results/attention?ff_resultsVNextKpi=1&ff_resultsVNextOkr=1`

**Ważne:** jeśli klikniesz coś WEWNĄTRZ aplikacji (np. wiersz w tabeli →
"Open") i strona pokaże "not yet enabled" zamiast treści — to znaczy, że
nawigacja zgubiła flagę po drodze (znany defekt, punkt 5). Wróć przez pasek
adresu na jeden z linków wyżej, albo dopisz ręcznie `?ff_resultsVNextKpi=1`
na końcu adresu, na którym akurat jesteś.

## 4. Co warto kliknąć (sprawdzone przeze mnie, działa)

1. **Rejestr KPI** — wejdź na link KPI wyżej, przełącz zakładkę **"Org"**
   (domyślna zakładka "My" jest pusta — pokazuje tylko Twoje własne KPI).
   Zobaczysz 8 KPI w różnych stanach (Draft, Pending approval, Active,
   Suspended, Archived).
2. **Podgląd wiersza** — kliknij raz na dowolny wiersz (np. `KPI-A-002`) —
   otworzy się panel podglądu z prawej strony.
3. **Pełne narzędzie** — w panelu podglądu kliknij **"Open"** — otworzy się
   pełny ekran KPI z zakładkami (Performance, Contract, Measurements,
   Deviations, Corrective actions...).
4. **Zapis pomiaru** — w pełnym narzędziu wejdź w zakładkę **"Measurements"**,
   kliknij **"Record measurement"**, wypełnij okres i wartość, zapisz. To jest
   najważniejszy test: wcześniej to się wywalało błędem 500 dla KAŻDEGO
   świeżego logowania — teraz działa (sprawdzone przeze mnie, zapis trafia
   realnie do bazy).
5. **ROI i OKR** — listy pod linkami wyżej pokazują realne dane (6 spraw ROI
   we wszystkich fazach; 1 zestaw OKR na 58% postępu).

## 5. Co JUŻ WIEMY, że jest zepsute (nie zgłaszaj tego, mamy to zapisane)

- **Pełne narzędzie KPI**: brak zakładki historii pełnej wersji, brak pola
  kadencji i właściciela w formularzu, wybór KPI (np. do karty wyników)
  pokazuje surowy identyfikator zamiast nazwy.
- **Brak formularza "Nowa karta wyników"** — karty wyników trzeba oglądać
  z istniejących, nie da się jeszcze założyć nowej przez UI.
- **Nawigacja wewnątrz aplikacji gubi flagę** — po kliknięciu np. "Open" z
  listy trzeba czasem wrócić przez adres z parametrem (opisane w punkcie 3).
- **Do ekranów Results Next dociera TYLKO rola OWNER i ADMIN** — każda inna
  rola (współtwórca, recenzent, gość) zostaje grzecznie odesłana na
  `/interview` bez komunikatu błędu. To ograniczenie obecnego modelu ról,
  nie błąd Twojego loginu.
- **Adres `/attention` (bez `/results/`) donikąd nie prowadzi** — po cichu
  ląduje na czacie zamiast pokazać błąd. Właściwy adres to
  `/results/attention` (link w punkcie 3).
- **ROI i OKR nie były jeszcze przejechane od początku do końca** — same
  listy działają i pokazują realne dane, ale pełne przepływy (np. założenie
  nowej sprawy ROI, zmiana statusu OKR) nie były testowane tak dokładnie jak
  zapis pomiaru KPI. Mogą się tam kryć defekty, których jeszcze nie znamy —
  jeśli coś się zepsuje, to jest cenne znalezisko, zgłoś śmiało.

## 6. Jak zatrzymać środowisko, gdy skończysz

Nie musisz nic robić — zostaw wszystko uruchomione, jeśli chcesz wrócić
później. Jeśli chcesz, żebym zatrzymał backend i frontend (baza zostaje,
dane nie znikają), po prostu daj znać w rozmowie — zamknę to precyzyjnymi
komendami, bez ryzyka dla innych sesji na tym komputerze.
