---
doc_id: funkcje-regula-licencja-rodzina
status: canonical
owner: piotr
truth_type: process
established: 2026-09-01
---

# Zlecenie ma z definicji obejmować RODZINĘ, nie zgłoszoną pozycję

## Obserwacja, która to wymusiła — cztery wystąpienia jednego dnia, w dwóch torach

| Sprawa | Poprawne | Pominięte |
| --- | --- | --- |
| Kontrola dostępu do formularzy | 2 trasy rodziny | **3 trasy** |
| Bramki widoczności Spotkań | 2 bramki | **1 bramka** |
| Przemapowanie nazw pól, ustawienia AI | piętro użytkownika i superadministratora | **piętro organizacji** — wzorzec **kilkadziesiąt linii obok** |
| Przemapowanie nazw pól, Audyty | panel podglądu (**z komentarzem ostrzegającym przed tym błędem**) | **zakładka Sesje** |

**Za każdym razem ktoś wiedział, jak to zrobić — i zrobił to nie wszędzie.**

## ★ Diagnoza przyczyny (tor grafiki) — to NIE jest niedbałość

> **To jest skutek pracy per-zgłoszenie: wykonawca dostaje zgłoszenie o jednym piętrze,
> naprawia je poprawnie i NIE MA POWODU patrzeć na sąsiednie.**

**Lekarstwem nie jest uważność — uważność zawodzi zawsze.** Lekarstwem jest
**zlecenie, które z definicji obejmuje rodzinę.**

**To jest do zrobienia w sposobie pisania instrukcji, nie w kodzie.** Czyli **po stronie
nadzorcy, nie wykonawcy.** Cztery powyższe defekty są **moim błędem projektowania zleceń**,
nie błędem czterech różnych ludzi.

## Zmiana w szkielecie instrukcji — obowiązuje od zaraz

Tabela licencji dotąd wymieniała **ścieżkę** dotkniętą zgłoszeniem (walidator · trasa ·
kontroler · serwis · repozytorium). **To jest za mało** — pokrywa jedną pozycję w głąb,
a **nie pokrywa rodzeństwa wszerz**.

**Każde zlecenie naprawcze zawiera odtąd obowiązkowy krok zerowy:**

> **KROK 0 — WYPISZ RODZINĘ.**
> Zanim tkniesz zgłoszoną pozycję, wypisz **wszystkie jej rodzeństwo**: pozostałe trasy tej
> samej rodziny · pozostałe piętra tego samego mechanizmu · pozostałe zakładki tego samego
> ekranu · pozostałe wywołania tej samej funkcji. **Dla każdego podaj, czy ma poprawkę,
> czy jej nie ma.**
> **Zgłoszona pozycja jest PRÓBKĄ, nie zakresem.**

Dodatkowo, jako trop pierwszej klasy:

> **Szukaj rodzeństwa, które JUŻ MA poprawkę.** Gdzie ktoś raz mapował, kontrolował
> albo tłumaczył — tam prawie na pewno są miejsca, gdzie zapomniał. **Istniejąca poprawna
> implementacja obok jest najsilniejszym sygnałem, że reszta rodziny jest zepsuta.**

## Wniosek wspólny obu torów o bezpiecznikach

> **Gdy dwa niezależne bezpieczniki mówią to samo, sprawdź najpierw, czy nie karmią się
> z tego samego źródła.**

Dwa układy zmierzone dziś, po jednym na tor:
- **U nas:** atrapa bazy melduje „zmieniono 1 wiersz" **niezależnie od warunku**, przy defekcie
  „zapis jest pusty". **Dwie kontrole potwierdzają nieprawdę zgodnie.**
- **U nich:** test jednostkowy **i** atrapa harnessu **obie** mają kształt frontowy, a nie
  kształt serwera. Zieleń testu i poprawny wygląd ekranu **nie znaczą nic**.

**To nie jest „jeden bezpiecznik zawiódł". To jest zgodne potwierdzenie nieprawdy —
i wygląda mocniej niż pojedyncza kontrola, więc usypia skuteczniej.**

## Poprawka do reguły o odbiorach
Reguła brzmiała: *najpierw ekrany, które właściciel już przyjął — ekran przyjęty, a cicho
zepsuty, jest gorszy niż odrzucony.*

**Uzupełnienie:** sprawdzaj, **czy przyjęto CAŁY ekran, czy jedną zakładkę.**
Zmierzony przypadek: ocena **A** przyznana po obejrzeniu jednej zakładki z dwóch;
**feralnej nigdy nie sfotografowano**. Tor grafiki wprowadza fotografowanie **każdej
zakładki osobno** — przyjmujemy to samo.

**Defekt chowa się tam, gdzie nikt nie patrzył — czyli szukanie wśród „przyjętych"
bez tego uzupełnienia omija dokładnie te miejsca.**
