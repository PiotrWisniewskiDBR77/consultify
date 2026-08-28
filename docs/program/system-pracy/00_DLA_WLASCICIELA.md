# SYSTEM PRACY — dla właściciela

Jak to działa, co robisz Ty, i po czym poznać, że coś idzie źle. Bez żargonu.

---

## 1. KTO CO ROBI

**Ty (CEO, founder).** Decydujesz produktowo — co ma robić aplikacja i co jest ważniejsze.
Komunikujesz się z wykonawcą. Wykonujesz operacje w panelu hostingu. Oglądasz i akceptujesz
to, co widać na ekranie. **Nic poza tym nie należy do Ciebie** — jeśli ktoś prosi Cię
o decyzję techniczną, to znaczy, że ktoś nie wykonuje swojej roboty.

**Integrator (Codex-master).** Prowadzi codzienną pracę: planuje fale, pisze zlecenia,
wykonuje je, poprawia własną pracę, odbiera, scala. To on jest silnikiem tempa.

**Nadzorca (CTO).** Cztery rzeczy i nic więcej: wytyczne fali · wyrywkowa kontrola dowodów ·
zgoda na scalenie · ocena wyglądu. Podpis musi być oddzielony od wykonania — inaczej nikt
nikogo nie kontroluje.

---

## 2. DLACZEGO NADZORCA NIE CZYTA WSZYSTKIEGO

Przy 24 dyżurach dziennie nikt nie przeczyta 24 raportów po 2000 linii. Gdyby próbował,
czytałby pobieżnie i przyklepywał — czyli podpisywał na wiarę.

Zamiast tego działają dwa mechanizmy:

**Karta dowodowa.** Każdy dyżur streszcza swoje **dowody** na jedną stronę: jakie żądania
wysłano, jakie kody wróciły, co pokazała baza, czy naprawa przetrwała próbę cofnięcia.
Nadzorca podpisuje kartę, nie opowieść. **Brak karty = brak scalenia**, bez wyjątków.

**Próbkowanie.** Z każdej fali nadzorca bierze jedno–dwa twierdzenia, na których opiera się
decyzja, i **mierzy je sam, od zera, nie zaglądając do raportu**. Zgadza się — fala przechodzi.
Nie zgadza — cała fala wraca. Nikt nie wie z góry, co zostanie sprawdzone, więc opłaca się
być dokładnym wszędzie.

To jest ta sama logika, co kontrola jakości na produkcji: nie bada się każdej sztuki,
bada się losowe i wyciąga wnioski o partii.

---

## 3. CO CZYTASZ TY — cztery linijki po każdej fali

```
FALA 3 — 28.08, 16:00
  Wydane: 6   Zamknięte: 5   STOP: 1
  Karty podpisane: 5/6   Scalone: 5
  Nowe defekty wykryte przez odbiór: 4 (blokujące: 1)
  Prognoza: 47 dyżurów pozostało (zmiana: +3, powód: dług testowy większy niż zakładano)
```

**Jak to czytać:**

- **STOP nie jest złą wiadomością.** Oznacza, że wykonawca natrafił na coś, czego nie wolno
  mu rozstrzygnąć sam, i zapytał zamiast zgadywać. STOP kosztuje godzinę; zgadywanie kosztuje
  tydzień.
- **„Nowe defekty wykryte przez odbiór" to miara, że system działa**, nie że praca jest zła.
  Zero przez kilka fal z rzędu jest sygnałem ostrzegawczym — znaczy, że odbiór przestał szukać.
- **Prognoza rośnie i to jest normalne.** Każdy tydzień odsłania rzeczy, których nie było
  widać. Wzrost raportowany z przyczyną jest zdrowy; **prognoza, która nigdy nie rośnie,
  jest nieprawdziwa**.

---

## 4. TRZY RZECZY, KTÓRE ZAWSZE NALEŻĄ DO CIEBIE

**Decyzje produktowe.** Co ma się dziać, gdy użytkownik zrobi X. Czy funkcja Y jest w tej
wersji. Czy wolimy szybciej i prościej, czy wolniej i pełniej. Nikt inny tego nie rozstrzygnie.

**Akcept wyglądu.** Nigdy nie jesteś pierwszą osobą, która widzi ekran — najpierw ogląda go
wykonawca, potem nadzorca. Do Ciebie trafia to, co ma być **zaakceptowane**, nie odkryte
jako zepsute. Jeśli kiedykolwiek zobaczysz coś oczywiście zepsutego jako pierwszy — to jest
awaria procesu i powiedz to wprost.

**Dane i środowiska.** Co wolno ruszyć, czego nie. Produkcja jest nietykalna bez Twojej
osobnej zgody, za każdym razem.

---

## 5. PO CZYM POZNASZ, ŻE COŚ IDZIE ŹLE

| sygnał | co oznacza |
|---|---|
| Raporty przestały zawierać sekcję „czego nie sprawdziłem" | wykonawca przestał szukać granic własnej wiedzy — najwcześniejszy objaw psucia się systemu |
| Odbiory od kilku fal nie znajdują nic | odbiór stał się rytuałem, nie kontrolą |
| Prognoza dyżurów nie rośnie ani nie maleje | ktoś dopasowuje liczby zamiast mierzyć |
| Pytają Cię o decyzje techniczne | ktoś przerzuca na Ciebie swoją robotę |
| „Wszystko gotowe" bez karty dowodowej | nie ma dowodu, jest opowieść |
| Ten sam moduł wraca po raz trzeci | zamykaliśmy go bez odbioru albo bez dowodu |
| Nikt nie zgłasza własnych błędów | najgorszy sygnał ze wszystkich |

---

## 6. SŁOWNIK — pięć pojęć, które wystarczą

**Dyżur** — jedno duże zlecenie dla wykonawcy, zwykle cały moduł albo obszar. Trwa kilka godzin.

**Fala** — sześć dyżurów puszczonych równolegle, tak dobranych, żeby nie wchodziły sobie
w drogę. Cztery fale dziennie.

**Odbiór adwersaryjny** — osobny wykonawca dostaje zadanie **obalić** wynik, nie potwierdzić.
Zawsze ktoś inny niż autor. To jest ta rzecz, która w tym programie za każdym razem zarobiła
na siebie.

**Dowód mutacyjny** — sprawdzenie, czy naprawa naprawdę działa: psujemy ją z powrotem i
patrzymy, czy test to wykryje. Jeśli test przechodzi tak samo z naprawą i bez niej, to test
niczego nie dowodzi.

**Karta dowodowa** — jedna strona z dowodami zamiast raportu. Bez niej nic nie wchodzi.

---

## 7. DLACZEGO TO WSZYSTKO ISTNIEJE

Ten program przez tygodnie raportował postęp, który nie przekładał się na działającą aplikację.
Powód nie był lenistwem ani brakiem umiejętności — powodem było to, że **„testy przeszły"
nie znaczyło „działa"**, a nikt tego nie sprawdzał.

Kilka rzeczy, które to potwierdziły w praktyce: udostępnianie linkiem było martwe na
produkcji i żaden test tego nie widział, bo testy chodziły na innej bazie · dowolny tekst
wysłany jako nazwa narzędzia tworzył prawdziwy wpis w bazie · cztery testy twierdziły, że
przepuszczanie żądania przy awarii bazy jest zamierzone · raport ogłaszał mechanizm
zabezpieczający, którego w kodzie nie było.

Żadnej z tych rzeczy nie wykrył raport wykonawcy. **Wszystkie wykrył odbiór.**

Dlatego system wygląda tak, jak wygląda: dowód zamiast deklaracji, sceptyk zamiast autora,
próbka zamiast zaufania. Nie dlatego, że ktoś kłamie — dlatego, że **nikt nie potrafi
sprawdzić samego siebie**.
