---
doc_id: funkcje-ksztalt-19
status: canonical
owner: piotr
truth_type: process
established: 2026-09-01
---

# DZIEWIĘTNASTY kształt fałszywego „gotowe": para przechodzi bezpiecznik, a pokazuje dwa różne stany

## Co się stało
Odbiór dyżuru 233 (Finanse). Pięć par zrzutów jasny/ciemny **przeszło nasz bezpiecznik**
z ogromnym zapasem — różnica średniej jasności ponad **200** przy progu **150**.
Audytor i tak **obejrzał obrazy oczami** i znalazł, że dwie z pięciu par
**pokazują różne stany aplikacji**:

- panel Monte Carlo — wariant **jasny** pokazuje **sam formularz wejściowy**,
  wariant **ciemny** pokazuje policzony histogram z metrykami;
- panel scenariuszy — wariant **jasny** pokazuje **sam przycisk „Uruchom"**,
  wariant **ciemny** pokazuje gotowy wykres wachlarzowy.

Przyczyna: **wyścig** między automatycznym kliknięciem uruchamiającym obliczenie
a przechwyceniem zrzutu. W trybie jasnym zrzut zdążył przed wynikiem.

## Dlaczego to jest nowy kształt, a nie powtórka trzynastego
**Kształt 13** („duplikat zamiast motywu") to para będąca **dwa razy tym samym obrazem**.
Bezpiecznik na różnicę jasności powstał **właśnie po to** i działa — złapałby duplikat.

**Kształt 19 jest jego dokładnym przeciwieństwem:** obrazy różnią się **za bardzo**,
bo przedstawiają **różne momenty pracy programu**. Bezpiecznik mierzy, czy obrazy
są różne, więc taka para przechodzi **tym łatwiej, im większy jest defekt.**

> **Bezpiecznik, który nagradza defekt tym wyższą oceną, im defekt większy, jest gorszy
> niż jego brak — bo daje fałszywy spokój.**

## Czego to uczy o naszych bezpiecznikach
Nasza kontrola par zrzutów sprawdzała **jeden wymiar** (różnica jasności) i cicho zakładała,
że wszystko inne jest w porządku. Zakładała **jednostronnie**: „za mało różnicy = źle",
bez drugiej strony „za dużo różnicy w niewłaściwym miejscu = też źle".

To jest ta sama rodzina co **kształt 14** („przyrząd kłamie, a oko przywyka") — z tą różnicą,
że tam kontrolki harnessu zasłaniały produkt, a tu **sam pomiar jest jednowymiarowy**.

## Co wprowadzamy
1. **Para zrzutów musi przedstawiać TEN SAM STAN.** Przy zrzucie stanu policzonego
   dowodem jest **obecność wyniku w obu wariantach** — nie sama różnica jasności.
2. **Zrzut stanu policzonego czeka na wynik**, nie na upływ czasu. Klik i przechwycenie
   nie mogą być wyścigiem; przechwycenie ma zależeć od pojawienia się wyniku.
3. **Instrukcja mówi wprost, co ma być widać na zrzucie** („histogram", „wykres", nie
   „panel"), żeby dało się to sprawdzić bez znajomości kodu.
4. **Oglądanie oczami zostaje obowiązkowe** także wtedy, gdy wszystkie liczby są zielone.
   Ten defekt **przeszedł każdą liczbę, jaką mamy.**

## Zapis dla porządku
Instrukcja dyżuru 233 **ostrzegała przed dokładnie tym defektem**, cytując wcześniejszy
odbiór 135: *zrzut musi pokazać policzony wynik, nie sam formularz.* Ostrzeżenie było
w tekście, a mimo to raport zameldował 5 na 5 zamiast 3 na 5. **Ostrzeżenie w instrukcji
nie zastępuje kontroli przy odbiorze.**
