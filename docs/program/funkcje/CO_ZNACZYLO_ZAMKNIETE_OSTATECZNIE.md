---
doc_id: funkcje-co-znaczylo-zamkniete-ostatecznie
status: canonical
owner: piotr
truth_type: process
established: 2026-09-01
---

# Co naprawdę znaczyło „ZAMKNIĘTE OSTATECZNIE" — i dlaczego dwa moduły nie były zamknięte

Dwa moduły noszą w spisie funkcjonalnym oznaczenie **`CLOSED_FINAL 2026-08-25`**, każdy
z własnym znacznikiem w historii: **Organizacja** i **Ustawienia**. To najmocniejsze
oznaczenie, jakim dysponuje ten program. Sprawdziliśmy, **na czym zostało oparte.**

## Organizacja — zamknięta na akcepcie PROTOTYPU, nie realnego produktu
Decyzja właściciela, na którą powołuje się zamknięcie, dotyczyła **prototypu**.
Realny, zbudowany moduł ma do dziś status **„właściciel nie obejrzał"**, a **jedenaście
ekranów przeprojektowania jest nieosiągalnych** — flaga została **świadomie cofnięta
na wyłączoną 29.08, właśnie do czasu odbioru wizualnego**.

Czyli: **zamknięto akcept rysunku, a nie akcept działającego ekranu.**

## Ustawienia — zamknięte, choć pierwszy przegląd wizualny NIGDY SIĘ NIE ZACZĄŁ
Karta modułu ma dwie pozycje przeglądu w stanie **„nie rozpoczęte"**. Jednocześnie spis
funkcjonalny mówi **`CLOSED_FINAL`**.

**Dwa dokumenty kanoniczne mówią o tym samym module rzeczy wykluczające się.**
Pisarz **słusznie nie rozstrzygnął**, który ma pierwszeństwo — to nie jest decyzja
wykonawcy ani dokumentalisty.

## Dlaczego to jest ważniejsze niż te dwa moduły
> **Oznaczenie w rejestrze jest warte tyle, ile warty jest najsłabszy powód, dla którego
> ktoś je kiedyś postawił.**

Jeżeli **„ZAMKNIĘTE OSTATECZNIE" mogło znaczyć „właściciel zaakceptował rysunek"**,
to samo oznaczenie przy każdym innym module **przestaje cokolwiek gwarantować** —
dopóki nie sprawdzimy, na czym stoi. **To nie podważa tamtych dwóch decyzji; podważa
naszą zdolność czytania rejestru.**

To ta sama rodzina co **„gotowe ≠ skończone"** i **„wołacz istnieje ≠ renderuje się"**:
słowo brzmi mocno, a pod spodem jest słabsze zdarzenie.

## Co wprowadzamy — trzy zasady
1. **Zamknięcie modułu wymaga zapisania, CO dokładnie zaakceptowano**: prototyp, zrzut
   realnego ekranu, czy działający przepływ na realnych danych. **Bez tego zapisu
   zamknięcie nie obowiązuje.**
2. **Akcept prototypu NIE zamyka modułu.** Zamyka etap projektowy. Zamknięcie modułu
   wymaga **zrzutu realnie zbudowanego ekranu** — reguła 7 mówi to od dawna, ale nie było
   miejsca, w którym rozróżnienie byłoby zapisane.
3. **Sprzeczność między dwoma dokumentami kanonicznymi rozstrzyga właściciel albo nadzorca
   z pomiarem** — nigdy wykonawca w biegu i nigdy „ten nowszy wygrywa".

## Do rozstrzygnięcia przez właściciela
- Czy **Organizacja** i **Ustawienia** zostają zamknięte, czy wracają do odbioru
  wizualnego. **Rekomendacja: wracają** — w Organizacji jest jedenaście nieobejrzanych
  ekranów, w Ustawieniach nie zaczęto przeglądu.
- **Czy przejrzeć pozostałe zamknięcia tą samą miarą.** Rekomendacja: tak, jednym tanim
  przebiegiem — sprawdzamy wyłącznie **na czym stoi oznaczenie**, nie sam moduł.
