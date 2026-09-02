# G-1 — Specyfikacja wizualna „deck jak z gamma.app" dla generatora PPTX

Autor: analityk projektowy (tor G). Data: 2026-09-01.
Zakres: **wyłącznie specyfikacja wizualna**. Nie dotykałem kodu Consultify i nie proponuję implementacji.

---

## 0. Podstawa dowodowa — co zmierzyłem, a czego nie

Żeby nie powtórzyć błędu „hipoteza podana jako fakt", rozdzielam trzy rzeczy: **ZMIERZONE**, **WYWNIOSKOWANE**, **REKOMENDACJA (moja decyzja projektowa)**.

**ZMIERZONE.** Otworzyłem w przeglądarce trzy publiczne szablony gamma.app z kategorii doradczej i odczytałem z DOM realne `getComputedStyle` + `getBoundingClientRect` każdego elementu tekstowego, każdego panelu i każdego slotu obrazu:

| Deck | ID | Motyw (kroje) | Kart |
|---|---|---|---|
| Stakeholder Briefing | `vwgv7rmlwi2b69r` | Manrope + DM Sans, ciemny ciepły brąz, akcent blady wrzos | 11 |
| Client Recommendation | `3ruhg6w8lk1algu` | Cormorant Garamond + Inter, kremowy, akcent burgund | 8 |
| Case Study | `6y37657doxj0afr` | Space Grotesk + Source Sans 3, ciemny, akcent turkus | 10 |

Razem **29 slajdów, 3 różne motywy**. Wszystkie liczby w rozdziałach 1–3 oznaczone „zmierzone" pochodzą stąd, nie z oglądania.

**CZEGO NIE ZMIERZYŁEM — mówię wprost:**
- **Pitch, Tome, Beautiful.ai — nie zmierzone.** Pitch obejrzałem tylko powierzchownie (galeria szablonów „Report"); to, co widziałem, jest zgodne z wnioskami z gammy (duża typografia dosunięta do lewej, płaskie pola koloru, panel-obraz), ale **nie traktuj tego jako dowodu**. Tome i Beautiful.ai nie sprawdzałem wcale. Jeżeli decyzja ma zależeć od tych produktów — trzeba osobnego pomiaru.
- **Nie wiem, jak wygląda gamma na treści realnej, długiej.** Zmierzone szablony mają treść placeholderową (66–112 słów/slajd). Realny raport z audytu bywa gęstszy. To jest istotne i wracam do tego w §6 i §9.
- **Nie znam wewnętrznych reguł gammy.** Wszystko poniżej to reverse-engineering z 29 renderów, nie dokumentacja producenta.
- **Nie sprawdziłem, jak gamma eksportuje do PPTX.** Nie wiem, na ile jej własny eksport zachowuje ten wygląd.

**Jedno zastrzeżenie metodyczne.** Karta gammy nie jest 16:9. Zmierzone proporcje kart: **1,95** (decki 1 i 3) oraz **1,48** (deck 2). Część „przestronności" gammy bierze się z tego, że jej płótno jest **szersze niż 16:9**. Na 16:9 mamy proporcjonalnie mniej miejsca w poziomie. Wszystkie wartości przeliczone na 16:9 poniżej to **przeliczenie proporcjonalne, nie pomiar** — normalizowałem przez **wysokość** karty (bo typografia skaluje się z wysokością kadru), i tam gdzie odchodzę od pomiaru, piszę to jawnie.

Kanwa docelowa w całym dokumencie: **16:9 = 13,333 × 7,5 cala = 960 × 540 pt**.

---

## 1. Cechy MIERZALNE (15)

Każda cecha ma: regułę, wartość liczbową, oraz **jak to sprawdzić** (bramka dla toru pomiarowego).

---

### C1. Siatka: jedno pole treści, marginesy stałe, grafika może wychodzić poza

- **Reguła.** Cała treść tekstowa mieści się w jednym prostokącie. Poza niego wychodzi wyłącznie grafika pełnospadowa (obraz, pole koloru, wykres-tło).
- **Wartości (16:9, 960 × 540 pt):**
  - margines lewy/prawy: **120 pt** (12,5 % szerokości)
  - margines górny/dolny: **66 pt** (12,2 % wysokości)
  - pole treści: **720 × 408 pt**, od (120, 66) do (840, 474)
  - rynna między kolumnami: **14 pt** (1,94 % szerokości pola treści)
  - szerokość kafla przy podziale na N: `(720 − (N−1) × 14) / N` → N=2: **353 pt**; N=3: **230,7 pt**; N=4: **169,5 pt**
- **Podstawa (zmierzone).** W deckach 1 i 3 pasmo treści na karcie 1400 px zaczyna się dokładnie na **x = 183 px** i ma szerokość **1035 px** — czyli marginesy 13,07 % i pole treści 73,9 % szerokości. Ta sama liczba 1035 px powtarza się w trzech niezależnych slajdach dwóch różnych decków. W decku 2 (karta 1060 px) marginesy to **95 px = 9,0 %** symetrycznie. Rynna 3-kafelkowa zmierzona: 19,5 px / 1035 px = **1,88 %** (deck 3) i 22,5 px / 870 px = **2,1 %** (deck 2).
- **Sprawdzenie.** Żaden `textbox` nie ma lewej krawędzi < 120 pt ani prawej > 840 pt. Kafle N-up mają identyczną szerokość co do 0,5 pt i rynny równe 14 pt co do 0,5 pt.

---

### C2. Blok treści **wyśrodkowany w pionie** w polu treści (to jest sedno)

- **Reguła.** Sumaryczny blok wszystkich elementów slajdu (od górnej krawędzi pierwszego do dolnej ostatniego) jest centrowany pionowo w polu treści. **Tytuł nie ma stałej wysokości** — slajd z małą ilością treści ma tytuł niżej, gęsty ma wyżej.
- **Wartość.** Środek bloku = **y 270 pt** ± 16 pt (±3 % wysokości slajdu).
- **Podstawa (zmierzone).** Górna krawędź tytułu na 29 slajdach waha się od **y = 97 px do y = 425 px** (13,5 % – 59 % wysokości) — gamma **nie** przybija tytułu do stałej linii. Sprawdziłem hipotezę centrowania na trzech slajdach decku 3: karta 2 → środek bloku 399 vs środek pola 378; karta 6 → 375 vs 378; karta 1 → 391 vs 378. Zgadza się w granicach ±3 %. **Uczciwie: zweryfikowałem to na 3 z 29 slajdów, nie na wszystkich.**
- **Dlaczego to jest ważne.** To pojedyncza reguła, która najbardziej odróżnia gammę od korporacyjnego szablonu. Klasyczny PPT przybija tytuł do góry, treść leci w dół i zostaje dziura przy dolnej krawędzi. Gamma tej dziury nie ma nigdy.
- **Sprawdzenie.** `|((min_y + max_y)/2) − 270| ≤ 16 pt` dla każdego slajdu treściowego (okładka i przekładka mają własną regułę).

---

### C3. Dokładnie **2 kroje**, rola sztywna

- **Reguła.** Jeden krój „display" (tytuły, liczby, etykiety-nagłówki), jeden „text" (treść, podpisy). Zero trzeciego kroju, zero kroju dekoracyjnego.
- **Podstawa (zmierzone).** 3 z 3 motywów: dokładnie 2 rodziny. Manrope+DM Sans; Cormorant Garamond+Inter; Space Grotesk+Source Sans 3. Żadnego trzeciego kroju nigdzie na 29 slajdach.
- **Sprawdzenie.** `len(set(fonts_in_deck)) == 2`.

---

### C4. Drabina rozmiarów: skala modularna, max 5 stopni na slajdzie

- **Reguła.** Cały deck korzysta z jednej drabiny; na jednym slajdzie użyte są **3–5 stopni**, a dwa sąsiednie użyte stopnie różnią się o **≥ 1,25×**.
- **Drabina (pt, na 960 × 540):**

  | Rola | pt | Podstawa |
  |---|---|---|
  | okładka — tytuł | **64** | zmierzone 7,2–14,8 % wys. → 39–80 pt |
  | przekładka / statement | **44** | zmierzone |
  | **liczba (statystyka)** | **52** | zmierzone 5,3–7,25 % → 28–39 pt; **podbite — patrz §9** |
  | tytuł slajdu (H1) | **34** | zmierzone 4,4–7,2 % → 24–39 pt |
  | podnagłówek (H2) | **20** | zmierzone 3,0–4,3 % → 16–23 pt |
  | etykieta (H3, display 600) | **16** | zmierzone 2,2–2,5 % → 12–13,5 pt |
  | treść (body) | **15** | zmierzone 1,9–2,5 % → 10–13,5 pt; **podbite — patrz §9** |
  | podpis / nota | **12** | zmierzone |
  | kicker (wersaliki) | **10,5** | zmierzone 1,6–2,0 % → 8,5–11 pt |
- **Podstawa (zmierzone).** Liczba różnych rozmiarów na karcie: **2–7, mediana 4** (deck 3, 10 kart: 2,5,3,3,4,5,3,7,3,4).
- **Sprawdzenie.** Każdy rozmiar w pliku należy do drabiny; liczba różnych rozmiarów na slajdzie ≤ 5.

---

### C5. Stosunek tytuł : treść ≥ 2,2

- **Wartość.** `tytuł / body` w przedziale **2,2 – 3,0**, cel **2,3** (34 / 15).
- **Podstawa (zmierzone).** Deck 1: 2,61 i 2,62 (trzy slajdy). Deck 2: 2,88 / 2,88 / 3,60. Deck 3: 2,24 / 2,25 / 2,48. **Zakres zmierzony 2,24 – 3,60.**
- **Sprawdzenie.** Prosty iloraz na każdym slajdzie treściowym.

---

### C6. Interlinia: nagłówki **1,0**, treść **1,35–1,50**

- **Podstawa (zmierzone) — to najtwardsza stała w całym badaniu.** Interlinia nagłówka = **dokładnie 1,00** w **100 % zmierzonych nagłówków, we wszystkich trzech motywach, bez jednego wyjątku**. Interlinia treści: 1,15–1,52 (deck 1: 1,36–1,52; deck 2: 1,16–1,25; deck 3: 1,31–1,50).
- **Rekomendacja.** Display **1,00–1,05**; body **1,42**. Dolny kraniec zmierzonego zakresu (1,15) uznaję za za ciasny dla polskiego tekstu z ogonkami i diakrytykami — to moja decyzja, nie pomiar.
- **Sprawdzenie.** Wszystkie akapity display mają `lnSpc ≤ 105 %`; wszystkie body `138–150 %`.

---

### C7. Waga pisma odwrócona: duże = lekkie, małe = mocne

- **Reguła.** Im większy stopień, tym **lżejsza** waga. Wielki tytuł nigdy nie jest najgrubszy na slajdzie.
- **Wartości.** display 60–72 pt → waga 400–500; H1 34 pt → 400–500; H2/H3 16–20 pt → **600–700**; body 15 pt → 300–400. Body **nigdy** nie jest pogrubione poza pojedynczym wyróżnieniem inline.
- **Podstawa (zmierzone).** Deck 1: tytuły waga **400**, podnagłówki **700**, treść **300**. Deck 2: tytuły 600, treść 400. Deck 3: tytuły 500, podnagłówki 700, treść 400. We wszystkich trzech: **waga treści ≤ waga display i ≤ 400**.
- **Dlaczego to jest ważne.** Domyślny PowerPoint robi odwrotnie — grubaśny bold tytuł. To jeden z najszybszych sygnałów „szablon z 2005".
- **Sprawdzenie.** Waga(body) ≤ 400 na każdym slajdzie; waga(tytuł) ≤ waga(H3).

---

### C8. Paleta: powierzchnia + 2 stopnie tuszu + **dokładnie jeden** akcent

- **Role (bez kodów — role, nie hexy):**
  - `surface` — tło slajdu
  - `surface-alt` — wypełnienie panelu, przesunięcie 6–10 % względem `surface`
  - `ink-primary` — tytuły, nagłówki
  - `ink-secondary` — treść, podpisy; ten sam odcień co primary, niższy kontrast, **≥ 4,5:1** względem `surface`
  - `accent` — **jeden jedyny odcień w całym decku**
  - `accent-ink` — tekst na wypełnieniu akcentem
  - `rule` — włos, `ink-secondary` przy ~25 % krycia
- **Podstawa (zmierzone).** 3 z 3 motywów: dokładnie **jeden** akcent. Deck 1 blady wrzos rgb(226,210,222); deck 2 burgund rgb(128,0,32); deck 3 turkus rgb(66,161,173). Tusz drugorzędny to zawsze **odbarwiony stopień tego samego odcienia**, nigdy inny kolor (255,251,244 → 233,226,216; 255,255,255 → 207,207,207).
- **Budżet akcentu.** Akcent wolno użyć na: wielkie liczby, jeden poziom podnagłówków, chipy, kicker, pierwszą serię wykresu. **Zakaz:** akapity treści, duże wypełnienia tła, więcej niż ~8 % powierzchni slajdu.
- **Uczciwie o „nigdy czysta biel/czerń":** 2 z 3 motywów używa złamanej bieli i złamanej czerni (ciepłe/kremowe), ale **deck 3 używa czystego #FFFFFF i #000000**. Więc to jest **częste, nie uniwersalne**. Rekomenduję złamane (wygląda drożej), ale nie wolno tego sprzedawać jako prawa gammy.
- **Sprawdzenie.** Liczba odcieni akcentu w decku = 1. Kontrast body ≥ 4,5:1. Powierzchnia akcentu ≤ 8 % slajdu.

---

### C9. Kicker: mała etykieta nad tytułem

- **Reguła.** Nad tytułem slajdu opcjonalna etykieta: **10,5 pt, wersaliki, światło międzyliterowe +8 %, kolor `accent`**, odstęp do tytułu **16 pt**, jedno–dwa słowa.
- **Podstawa (zmierzone).** Deck 2: na **6 z 8** kart („Overview", „Analysis", „objectives", „Recommendations", „approach", „impact", „Action Required") — 12,2–14,4 px, Inter 400, kolor burgundowy, dokładnie ~29 px nad tytułem. Deck 3: na 3 kartach (11,3–12,6 px, kolor drugorzędny). Deck 1: **brak** — zamiast tego numer strony.
- **Wniosek.** To element opcjonalny, ale bardzo tani i bardzo skuteczny: nadaje slajdowi „rozdział" bez dodawania hałasu. W decku doradczym mapuje się wprost na fazę raportu (DIAGNOZA / REKOMENDACJA / WDROŻENIE / EFEKT).
- **Sprawdzenie.** Jeśli obecny: rozmiar 10,5 pt, wersaliki, ≤ 3 słowa, kolor `accent`.

---

### C10. Miara wiersza: 45–75 znaków, inaczej łam na kolumny

- **Reguła.** Blok tekstu nigdy nie jest szerszy niż **560 pt** (78 % pola treści). Akapit prowadzący ma max 2 wiersze. Jeśli treść nie mieści się w miarze — **dziel na kolumny, nie zwężaj kroju**.
- **Podstawa (zmierzone).** Bloki treści w kolumnach: 275–337 px przy foncie 14,2–15,8 px → **~40–45 znaków w wierszu**. Akapity pełnej szerokości (rzadkie, tylko lead): 1035 px → długie wiersze, ale zawsze max 2 wiersze.
- **Sprawdzenie.** Szacowana liczba znaków w wierszu z metryk kroju: 45 ≤ n ≤ 75.

---

### C11. Gęstość: 60–110 słów na slajd treściowy, ≤ 8 na okładce

- **Wartości.** Cel **80 słów**, twardy limit **110**. Pojedynczy blok tekstu ≤ 55 słów. Okładka ≤ 14 słów. Przekładka ≤ 10.
- **Podstawa (zmierzone).** Deck 3, liczba słów per karta: 4 (okładka), 74, 111, 85, 112, 108, 90, 77, 83, 66. **Średnia 81, zakres treściowy 66–112.**
- **Zasada nadrzędna.** Gdy treść przekracza limit — **slajd się dzieli, nie kurczy**. Zakaz zmniejszania kroju żeby wcisnąć treść (to zabija C4, C5 i C6 naraz).
- **Sprawdzenie.** Licznik słów per slajd.

---

### C12. Listy: jeden poziom, max 5 pozycji, bez kropek

- **Reguła.** Zero zagnieżdżenia. Pozycja listy = krótki nagłówek + 1–3 wiersze opisu, ułożone jako **kafle w siatce**, nie jako pionowa lista z punktorami. Znacznik: numer (`01`), ikona liniowa albo nic — **nie „•"**.
- **Podstawa (zmierzone).** Na 29 slajdach **nie znalazłem ani jednej listy drugiego poziomu**. Pozycje występowały jako osobne krótkie akapity z wcięciem 17–28 px (miejsce na ikonę/numer). Numeracja „01 / 02 / 03" zmierzona w decku 2 (17,1 px, waga 300) i decku 3 (14,2 px, waga 300) — zawsze **cieńsza i mniejsza** niż nagłówek, który opisuje.
- **Sprawdzenie.** Głębokość listy = 1; liczba pozycji ≤ 5; brak glifu punktora.

---

### C13. Sloty obrazu: trzy kształty, zawsze pełnospadowe, nigdy pod tekstem

- **Reguła.** Obraz nie „wstawia się" — zajmuje jeden z trzech zdefiniowanych slotów, wychodzi na spad do krawędzi slajdu i **nigdy nie leży pod tekstem**.

  | Slot | Geometria (zmierzona) | Na 16:9 |
  |---|---|---|
  | **A — panel boczny** | 21 % / 31 % / 37 % / 62 % szer., pełna wysokość, lewo albo prawo | szer. 200 / 300 / 360 / 595 pt × 540 pt |
  | **B — pas** | pełna szerokość, 14 % / 23 % / 33 % wysokości, góra albo dół | 960 × 76 / 124 / 178 pt |
  | **C — rząd kafli** | N równych kafli, proporcja ~1,62:1, rynna ~8 % szer. kafla | 3 × 230,7 × 142 pt |
- **Podstawa (zmierzone).** Deck 1: 435×653 px (panel 37 %) na 4 kartach, 1161×167 px (pas 23 %) na 1. Deck 2: 654×653 (panel 62 %), 996×236 (pas 33 %) ×2, 392×686 (panel 37 %), 3×(275×170) (kafle 1,62:1, rynna 22,5 px = 8,2 % kafla). Deck 3: 435×653 (panel 31 %), 290×653 (panel 21 %), 1161×98 (pas 14 %).
- **Czego NIE ma (zmierzone).** Zero obrazów pływających. Zero obrazów pod tekstem. Zero obrazów o nieregularnym kształcie. Zero ramek wokół obrazu. Zero cienia pod obrazem.
- **Sprawdzenie.** Każdy obraz pasuje do jednego z A/B/C co do 2 pt; przecięcie prostokąta obrazu z każdym prostokątem tekstu = 0.

---

### C14. Panele i krawędzie: promień mały albo żaden, włos zamiast cienia

- **Wartości (16:9).** Promień narożnika **0–7 pt** (najczęściej **3 pt**). Obramowanie **0,5–1,5 pt** (włos). **Cień: zero.** Chipy (organizacja, data, tag) mogą być pigułką: wysokość 26 pt, promień 13 pt, padding poziomy 14 pt.
- **Podstawa (zmierzone).** Promienie paneli: 1,91 / 2,14 / 2,25 / 6,62 / 7,09 / 7,56 / 8,03 / 8,51 / 9,45 px na kartach ~717 px wysokości → **0,27 % – 1,32 % wysokości** → 1,5–7 pt na 540. Obramowania: **0,5 px / 2 px** → 0,4–1,5 pt. `box-shadow` na kartach: **`none`** (sprawdzone bezpośrednio). Jedyny duży promień: chip 337×43 px z promieniem 170 px — czyli pigułka, i tylko dla chipa.
- **Sprawdzenie.** `radius ≤ 7 pt` dla paneli; `shadow == none` w całym decku; `border ≤ 1,5 pt`.

---

### C15. Punkt wejścia oka: jeden bohater, lewy górny róg bloku, wyrównanie do lewej

- **Reguła.** Na slajdzie jest **dokładnie jeden** element „bohater" — największy stopień. Na slajdzie treściowym to tytuł; na slajdzie liczbowym to **liczba** (i wtedy liczba jest większa od tytułu). Bohater startuje w lewym górnym rogu bloku treści. Wszystko wyrównane **do lewej**.
- **Wyrównanie do środka jest dozwolone TYLKO na:** okładce, przekładce, cytacie, oraz w środku małego kafla/węzła diagramu. Nigdy dla akapitu wielowierszowego w polu treści.
- **Podstawa (zmierzone).** Tytuł jest największym elementem na **26 z 29** slajdów; wyjątki to slajdy liczbowe. Wyrównanie do lewej dominuje. **Ale: okładka decku 3 jest wyśrodkowana** (tytuł 106,3 px, x od 407 do 992 — idealnie centralnie na karcie 1400). Więc „nigdy nie centruj" byłoby **fałszem** — gamma centruje okładki.
- **Sprawdzenie.** Dokładnie jeden element ma największy stopień; jego lewa krawędź = 120 pt (albo jest wyśrodkowany i slajd ma typ cover/divider/quote).

---

## 2. Ile archetypów wystarczy: **7** (+2 warianty trywialne)

Z 29 zmierzonych slajdów da się złożyć wszystko z siedmiu. Więcej archetypów to **obciążenie, nie zaleta** — każdy dodatkowy to nowa droga do zepsucia spójności.

| # | Archetyp | Wystąpienia w pomiarze | Wariacje |
|---|---|---|---|
| **A1** | **Okładka** | 3/3 decki | tekst lewo + panel-obraz prawo; albo wyśrodkowana bez obrazu |
| **A2** | **Przekładka / statement** | deck 1 k.11, deck 3 k.1 | duży tytuł, max 10 słów, dużo powietrza |
| **A3** | **Tekst + slot obrazu** | 10 slajdów | slot A lewo / A prawo / B góra / B dół |
| **A4** | **Kafle N-up** | 8 slajdów | N = 2, 3, 4; z ikoną, z numerem, albo bez |
| **A5** | **Rząd liczb** | 4 slajdy | N = 2, 3, 4; z grafiką dowodową nad liczbą albo bez |
| **A6** | **Narracja + wizual** (wykres/diagram) | 5 slajdów | podział 50/50, 62/38, 38/62 |
| **A7** | **Sekwencja numerowana** (kroki, fazy, oś czasu) | 5 slajdów | rząd poziomy; oś naprzemienna góra/dół |
| *w1* | *Cytat* | 2 slajdy | wariant A2 |
| *w2* | *Zamknięcie / następne kroki* | 3 slajdy | wariant A7 |

**Konsekwencja dla generatora:** archetyp wybiera się z **kształtu treści**, nie z „urozmaicenia". Trzy punkty rekomendacji → A4/N=3. Cztery wskaźniki → A5/N=4. Jedno zdanie tezy → A2. Nigdy nie rotować archetypów „dla ozdoby".

---

## 3. ANTY-WZORCE — lista zakazów w generatorze

Podzielone na: **zmierzona nieobecność w gammie** (mocny dowód) i **ocena rzemieślnicza** (moja, uzasadniona).

### 3.1 Zmierzona nieobecność w 29 slajdach gammy — zakaz twardy

| # | Zakaz | Dowód |
|---|---|---|
| Z1 | **Wypunktowanie drugiego i trzeciego poziomu** | 0 wystąpień listy zagnieżdżonej na 29 slajdach |
| Z2 | **Cień pod polem / tekstem / obrazem** | `box-shadow: none` na wszystkich zmierzonych kartach i panelach |
| Z3 | **Gradient jako wypełnienie kształtu treści** | 0 wystąpień; gradienty wyłącznie w rozmytym tle POZA kartą |
| Z4 | **Tabela z pełną siatką linii** | 0 wystąpień na 29 slajdach |
| Z5 | **Obraz pod tekstem / obraz pływający / obraz w ramce** | 0 wystąpień; 100 % obrazów w slotach A/B/C |
| Z6 | **Duże zaokrąglenia paneli (> 1,3 % wysokości)** | zmierzony zakres 0,27–1,32 %; pigułka tylko dla chipa |
| Z7 | **Grube obramowania (> 1,5 pt)** | zmierzone 0,5–2 px = 0,4–1,5 pt |
| Z8 | **Trzeci krój pisma** | 3/3 motywy: dokładnie 2 |
| Z9 | **Druga barwa akcentowa** | 3/3 motywy: dokładnie 1 |
| Z10 | **Wyrównanie do środka akapitu wielowierszowego w polu treści** | 0 wystąpień (środkowanie tylko okładka / węzeł diagramu / cytat) |
| Z11 | **Pogrubiona treść** | waga body ≤ 400 w 3/3 motywach |

### 3.2 Ocena rzemieślnicza — zakaz, ale to moja opinia, nie pomiar

| # | Zakaz | Dlaczego |
|---|---|---|
| Z12 | **Clipart, ikony wielobarwne, emoji, „ludziki"** | jednoznaczny sygnał 2005; ikony wyłącznie liniowe, jednobarwne, 15–20 pt |
| Z13 | **WordArt, tekst z konturem, 3D, faza, odbicie, poświata** | j.w. |
| Z14 | **Wykres 3D, kołowy z >4 wycinkami, podwójna oś, „wybuchowy" wycinek** | nieczytelne i niewiarygodne dla zarządu |
| Z15 | **Tęcza / paleta ≥ 5 nasyconych barw na wykresie** | seria = odcień akcentu + stopnie neutralne |
| Z16 | **Auto-shrink tekstu żeby wcisnąć treść** | rozjeżdża drabinę C4 i stosunek C5 na jednym slajdzie; slajd ma się dzielić |
| Z17 | **Logo klienta i wykonawcy na każdym slajdzie** | pasek marki na każdym slajdzie to sygnatura szablonu 2005; logo na okładce i zamknięciu |
| Z18 | **Dekoracyjne linie/wstążki/„swoosh" pod tytułem** | ozdoba bez funkcji |
| Z19 | **Podkreślenie jako wyróżnienie** | zostawić dla hiperłączy |
| Z20 | **Wersaliki w bloku dłuższym niż 3 słowa** | wersaliki wyłącznie dla kickera (C9) |
| Z21 | **Tytuł slajdu jako zdanie z kropką na końcu** | nagłówek, nie zdanie |
| Z22 | **Liczby bez źródła na slajdzie liczbowym** | patrz §5, slajd 3 — to warunek wiarygodności wobec zarządu |

---

## 4. Sprawa obrazów — rozstrzygnięcie

### 4.1 Fakt, który zmienia postać rzeczy

**Na 29 zmierzonych slajdów gammy 14 (48 %) nie ma ŻADNEGO obrazu rastrowego** — i wyglądają tak samo „gammowo" jak reszta.

| Deck | Slajdy z obrazem | Bez obrazu |
|---|---|---|
| Stakeholder Briefing | 6 | **5** |
| Client Recommendation | 5 | **3** |
| Case Study | 4 | **6** |
| **Razem** | **15 (52 %)** | **14 (48 %)** |

Slajdy bez obrazu to dokładnie te, które są rdzeniem decku doradczego: rekomendacje, liczby, wykresy, diagramy, sekwencja kroków, cytat, macierz. Slajdy z obrazem to okładka, przekładka i slajdy narracyjne.

### 4.2 Drugi fakt: te obrazy nie są fotografią czegokolwiek

Każdy zmierzony obraz był **abstrakcyjną teksturą** — rozmyte formy organiczne, pola koloru w palecie motywu. Zero zdjęć ludzi, biur, fabryk, produktów, uścisków dłoni. Obraz pełni rolę **materiału**, nie **treści**. Nie niesie informacji — wypełnia slot, daje głębię i sygnalizuje, że ktoś nad tym pracował.

To jest dobra wiadomość: **materiał da się wygenerować, przedstawienie rzeczy — nie.**

### 4.3 Co da się osiągnąć bez fotografii — z pełną wartością

1. **Wszystkie 48 % slajdów bezobrazowych — 1:1, bez straty.** To nie jest substytut, to jest ta sama rzecz.
2. **Pole gradientowo-teksturalne w slocie A/B/C.** 2–3 przystanki w palecie decku, przejście miękkie, plus delikatne ziarno. Ziarno jest tu kluczowe — płaski gradient wygląda tanio, gradient z ziarnem wygląda jak materiał.
3. **Wielka liczba/litera jako grafika.** Liczba w stopniu 200–320 pt, przycięta krawędzią slotu, w `surface-alt` albo akcencie o niskim kryciu. Bardzo mocne na przekładkach.
4. **Macierz kropek (waffle).** Zaobserwowana bezpośrednio w gammie (Stakeholder Briefing, „Expected Impact"): siatka kropek, część wypełniona akcentem proporcjonalnie do wartości. Tania, czytelna, natychmiast mówi „75 %" bez wykresu. **To najlepszy pojedynczy zamiennik zdjęcia w decku doradczym.**
5. **Geometria wielkoskalowa.** Koncentryczne łuki, siatka punktów o zmiennej gęstości, przesunięte prostokąty, pojedyncza gruba krzywa. Warunek: **jeden gest na slajd**, skala duża (element ≥ 30 % wysokości slajdu). Mała geometria = ozdóbka = anty-wzorzec.
6. **Wykres jako grafika, nie jako dowód.** Pierścień 108 pt (zmierzony w decku 3), pojedynczy pasek postępu, sparkline. Bez osi, bez legendy, z etykietą bezpośrednio przy danych.
7. **Pole samego koloru.** Slot A wypełniony `surface-alt` albo akcentem, z jednym słowem/liczbą w środku. Zmierzone w gammie jako wariant.

### 4.4 Czego bez fotografii NIE osiągniemy — mówię wprost

1. **Przedstawienia konkretnej rzeczy.** Hala produkcyjna klienta, linia, produkt, zespół, miejsce. Jeśli raport z audytu ma pokazać stan magazynu — geometria tego nie zastąpi. **Rozwiązanie: te zdjęcia dostarcza klient/konsultant**, generator ma tylko slot A/B/C gotowy do wklejenia. Ten slot musi istnieć od pierwszego dnia.
2. **Organicznej „przypadkowości" tekstury gammy.** Ich pola wyglądają jak fotografia czegoś nieokreślonego — mają nierówność, której proceduralny gradient nie ma. Da się zbliżyć (wielowarstwowy szum + rozmycie), ale **będzie różnica i ktoś o dobrym oku ją zobaczy**. Nie obiecywałbym parytetu.
3. **Ciepła / człowieka / emocji.** Deck doradczy tego zwykle nie potrzebuje, ale trzeba to nazwać: geometria jest chłodna. Jeśli właściciel oczekuje ciepła — potrzebna fotografia.
4. **Różnorodności między deckami przy tej samej palecie.** Dwa raporty dla dwóch klientów w tej samej palecie będą miały bardzo podobne pola. **Zaradzić: ziarno pseudolosowe zasiane identyfikatorem projektu** — deterministyczne, a jednak różne.

### 4.5 Rekomendacja jednym zdaniem

**Zbudować deck jako bezobrazowy z założenia (geometria + typografia + liczby jako grafika), z trzema slotami A/B/C, które przyjmują — w tej kolejności — (1) zdjęcie dostarczone przez konsultanta, (2) wygenerowane pole teksturalne z palety decku, (3) nic (slot znika, układ przechodzi na pełną szerokość).** Ta kolejność sprawia, że deck jest kompletny bez ani jednego zdjęcia, a lepszy z nimi.

---

## 5. Trzy slajdy wzorcowe

Kanwa: **960 × 540 pt**. Kolory jako **role** (§C8). Wszystkie współrzędne w punktach, początek układu = lewy górny róg.

---

### SLAJD 1 — OKŁADKA

```
┌──────────────────────────────────────┬──────────────┐
│                                      │              │
│  KICKER                              │   SLOT A     │
│                                      │  (grafika    │
│  Tytuł raportu                       │   pełno-     │
│  w dwóch wierszach                   │   spadowa)   │
│                                      │              │
│  Podtytuł: klient i zakres           │              │
│                                      │              │
│  [ Organizacja ]  [ Data ]           │              │
└──────────────────────────────────────┴──────────────┘
```

| Element | Pozycja | Wymiar / wartości |
|---|---|---|
| `surface` | 0, 0 | 960 × 540 |
| **Slot A** (grafika) | **600, 0** | **360 × 540** (37,5 % szer. — zmierzone) |
| Blok tekstu | x = **120**, szer. **440** | wyśrodkowany pionowo w y 66–440, środek **y = 253** |
| Kicker | x 120 | **10,5 pt**, wersaliki, tracking **+8 %**, `accent`, 1 wiersz, ≤ 3 słowa |
| odstęp | | **16 pt** |
| Tytuł | x 120 | **64 pt**, display, waga **400–500**, lh **1,05**, `ink-primary`, **max 2 wiersze, max 45 znaków** |
| odstęp | | **24 pt** |
| Podtytuł | x 120 | **18 pt**, text, waga 400, lh 1,4, `ink-secondary`, **1 wiersz, ≤ 70 znaków** |
| Chip „Organizacja" | x **120**, y **448** | wys. **26**, promień **13**, padding-x **14**, tekst **11 pt** waga 600, obrys `rule` 0,75 pt, bez wypełnienia |
| Chip „Data" | x = koniec chipa 1 + **10** | jw. |
| Logo (opcja) | x 120, y **66** | wys. **≤ 28 pt**, jednobarwne |

**Reguły twarde.** Bez cienia. Bez linii pod tytułem. Bez roku w stopniu większym niż podtytuł. Suma słów **≤ 14**. Jeśli tytuł > 45 znaków → stopień spada do 54 pt; > 70 znaków → 44 pt i 3 wiersze (to jest zmierzone zachowanie gammy: tytuł adaptuje stopień, deck 2 miał 44 / 49,2 / 51,8 zależnie od długości).

**Wariant B (bez grafiki, wyśrodkowany)** — zmierzony w decku 3: tytuł **80 pt**, wyśrodkowany poziomo, środek bloku y = 270, pod nim jedna linia 16 pt. Tło = `surface` albo pełnospadowe pole teksturalne. Ten wariant jest mocniejszy, gdy nie mamy dobrej grafiki.

---

### SLAJD 2 — REKOMENDACJE (treść + hierarchia)

```
KICKER
Tytuł rekomendacji w jednym
lub dwóch wierszach
Zdanie prowadzące — jedna teza, co z tego wynika.
────────────────────────────────────────────────────
┌──────────┐   ┌──────────┐   ┌──────────┐
│ 01       │   │ 02       │   │ 03       │
│ Nagłówek │   │ Nagłówek │   │ Nagłówek │
│ opis 3-4 │   │ opis 3-4 │   │ opis 3-4 │
│ wiersze  │   │ wiersze  │   │ wiersze  │
└──────────┘   └──────────┘   └──────────┘
```

| Element | Pozycja | Wymiar / wartości |
|---|---|---|
| Kicker | 120, **66** | 10,5 pt, wersaliki, +8 %, `accent`, np. „REKOMENDACJE" |
| Tytuł | 120, **84** | **34 pt**, display 400–500, lh 1,05, `ink-primary`, max **2 wiersze**, ≤ **60 znaków**, dół ≈ y 155 |
| Lead | 120, **172** | szer. **560** (nie 720!), **17 pt**, lh 1,45, `ink-secondary`, max **2 wiersze**, ≤ 150 znaków |
| Włos | 120 → 840, y **250** | **0,75 pt**, `rule` — opcjonalny |
| Kafle | y **274 → 452** (wys. 178) | x: **120 / 363,7 / 607,3**, szer. **230,7**, rynna **14** |
| — numer/ikona | +0, y 274 | „01" **15 pt** display waga **300** `accent`; albo ikona 20 × 20 pt jednobarwna |
| — nagłówek kafla | +0, y **306** | **20 pt** display waga **600**, `ink-primary`, max 2 wiersze, ≤ 32 znaki |
| — opis | +0, y **356** | **15 pt** text waga 400, lh **1,42**, `ink-secondary`, max **4 wiersze**, ≤ 190 znaków |
| — tag (opcja) | +0, y **434** | 12 pt, `accent`, ≤ 20 znaków |

**Reguły twarde.**
- Kafel ma wypełnienie **albo** obrys, **nigdy oba**, **nigdy cień**. Wypełnienie = `surface-alt`, promień **3 pt**.
- **Dokładnie jeden element akcentowany na kafel** (numer albo tag, nie oba).
- Wszystkie trzy kafle mają identyczną wysokość — treść krótsza nie skraca kafla, kafel jest siatką.
- Kontrola pionu (C2): `(66 + 452)/2 = 259`, w tolerancji 270 ± 16. OK.
- Kontrola gęstości (C11): tytuł ≤ 10 słów + lead ≤ 28 + 3 × 24 = **≈ 110 słów**, na górnej granicy — świadomie, bo trzy kolumny trzymają krótką miarę.
- Zajętość powierzchni ≈ **42 %** → ≥ 30 % pustki spełnione.
- N = 4 kafle → szer. 169,5 pt, opis skraca się do ≤ 130 znaków. N = 2 → szer. 353 pt, opis ≤ 320 znaków.

---

### SLAJD 3 — LICZBY (wynik / wskaźnik / porównanie)

```
KICKER
Tytuł wyniku

 ●●●●●●●●○○      ●●●●●●○○○○      ●●●●●●●●●○
 ●●●●●●●●○○      ●●●●●●○○○○      ●●●●●●●●●○
 ●●●●●●●●○○      ●●●●●●○○○○      ●●●●●●●●●○

    75%             25–30            412
  Wzrost         tygodni         zgłoszeń
  wydajności     do wdrożenia    objętych
  opis 2 wiersze opis 2 wiersze  opis 2 wiersze

Źródło: pomiar 3 linii, VIII–X 2026, n = 412
```

| Element | Pozycja | Wymiar / wartości |
|---|---|---|
| Kicker | 120, **66** | 10,5 pt, wersaliki, `accent` |
| Tytuł | 120, **84** | **34 pt**, max **1 wiersz**, ≤ 40 znaków |
| Kolumny | x **120 / 363,7 / 607,3** | szer. **230,7**, rynna **14** |
| **Grafika dowodowa** (macierz kropek) | +0, y **190 → 253** | siatka **10 × 5**, kropka **⌀ 7 pt**, podziałka **14 pt**, blok **133 × 63**; wypełnionych = `round(wartość% × 50/100)` w `accent`, reszta w `ink-secondary` @ 25 % |
| **Liczba** | +0, y **273 → 325** | **52 pt**, display waga 400–500, lh **1,0**, `accent` **albo** `ink-primary` — jedna decyzja na cały deck; **max 6 znaków** |
| Etykieta | +0, y **337** | **16 pt** display waga 600, `ink-primary`, **1 wiersz**, ≤ 26 znaków |
| Nota | +0, y **360 → 400** | **13 pt**, lh 1,4, `ink-secondary`, max **2 wiersze**, ≤ 90 znaków |
| **Źródło (obowiązkowe)** | 120, y **452** | **10,5 pt**, `ink-secondary` @ 70 %, 1 wiersz |

**Reguły twarde.**
- **Liczba ≥ 1,4 × tytuł** (52 / 34 = **1,53**). To jest jedyny slajd, na którym tytuł nie jest bohaterem.
- Max **4** liczby na slajd. Liczba > 6 znaków → stopień spada do 40 pt; > 9 znaków → liczba nie nadaje się na ten slajd, idzie do tabeli/wykresu.
- **Jednostka i znak zawsze przy liczbie**, nigdy w osobnym polu („75 %", nie „75" + „procent" obok).
- **Źródło jest obowiązkowe.** Gamma tego nie robi — i to jest dokładnie ta różnica, która decyduje, czy zarząd uzna slajd za wiarygodny czy za marketing. To moja rekomendacja, świadome odejście od wzorca.
- Zamienniki grafiki dowodowej (do wyboru, jeden typ na cały deck): pasek poziomy (wys. **8 pt**, szer. kolumny, tor w `rule`, wypełnienie w `accent`) albo pierścień **⌀ 108 pt** (zmierzony w decku 3), grubość obwodu **10 pt**.
- Porównanie „przed / po": dwa paski jeden pod drugim w tej samej kolumnie, „przed" w `ink-secondary` @ 40 %, „po" w `accent`, różnica podpisana bezpośrednio.
- Kontrola pionu: `(66 + 400)/2 = 233`; blok trzeba przesunąć w dół o ~37 pt, albo zaakceptować że źródło (y 452) domyka blok: `(66 + 464)/2 = 265` ≈ 270. OK ze źródłem.
- Suma słów **≤ 60**.

---

## 6. Pułapki formatu PPTX

PPTX ma **zaletę**, o której się zapomina: pozycjonowanie jest **absolutne w EMU**, więc siatka i geometria są dokładniejsze i bardziej powtarzalne niż w CSS. Problem jest gdzie indziej: **PPTX nie zna wysokości własnego tekstu** — nie ma autolayoutu, nie ma reflow, a generator nie wie, ile miejsca zajmie napis, dopóki sam tego nie policzy.

### 6.1 Tabela: łatwe / wymaga obejścia / niemożliwe

| Cecha | Status | Uwagi |
|---|---|---|
| C1 siatka, marginesy, rynny, kolumny | **ŁATWE** | pozycjonowanie absolutne; dokładniejsze niż CSS |
| C3 dwa kroje (przypisanie ról) | **ŁATWE** | `majorFont` / `minorFont` w motywie — natywna dokładnie ta koncepcja |
| C4 drabina stopni | **ŁATWE** | `sz` w setnych punktu |
| C5 stosunek tytuł : treść | **ŁATWE** | wynika z drabiny |
| C7 wagi pisma | **ŁATWE** *pod warunkiem* | wymaga osobnych plików kroju dla wag (Light/Regular/SemiBold); „faux bold" wygląda źle |
| C8 kolory jako role | **ŁATWE** | `clrScheme` (dk1/lt1/accent1…6) to natywnie „role, nie hexy" |
| C9 kicker (wersaliki + tracking) | **ŁATWE** | `spc` w `rPr` |
| C12 listy jednopoziomowe bez punktora | **ŁATWE** | `buNone` |
| C13 sloty obrazu pełnospadowe | **ŁATWE** | kształt na (0,0)–(960,540), przycięcie przez `srcRect` |
| C14 promień, włos, brak cienia | **ŁATWE** | `roundRect` z `adj`; `ln w=`; brak `effectLst` |
| Numer slajdu | **ŁATWE** | pole `slidenum` |
| Archetypy A1–A7 | **ŁATWE** | jako `sldLayout` w `slideMaster` |
| Macierz kropek, pierścienie, paski, łuki | **ŁATWE** | autokształty/freeform, w pełni deterministyczne — **mocna strona PPTX** |
| Wykresy natywne | **ŁATWE** | `c:chart`, edytowalne po stronie klienta |
| **C2 centrowanie bloku w pionie** | **OBEJŚCIE** | brak autolayoutu — generator **musi sam** zmierzyć wysokość tekstu (metryki kroju: fontTools/HarfBuzz/PIL) i policzyć pozycje. To jest **główny koszt inżynierski całej specyfikacji.** |
| **C10/C11 miara i gęstość** | **OBEJŚCIE** | PPTX nie zawija tak jak CSS i nie zwraca wyniku zawijania. Trzeba **łamać wiersze po stronie generatora** albo trzymać twarde limity znaków (jak w §5) i nigdy nie ufać `normAutofit` |
| Adaptacyjny stopień tytułu (44 / 49 / 52) | **OBEJŚCIE** | wybór ze skoków drabiny na podstawie zmierzonej szerokości napisu; **nie** przez autofit |
| Interlinia 1,00 / 1,42 dokładnie | **OBEJŚCIE** | `lnSpc spcPct` liczy się względem metryk kroju (ascent+descent+lineGap), więc „140 %" w PPTX ≠ „1,4" w CSS. Trzeba **skalibrować współczynnik per krój** i zweryfikować renderem |
| Pole teksturalne z ziarnem | **OBEJŚCIE** | `gradFill` daje 3 przystanki natywnie, ale **nie da rozmytej formy organicznej ani ziarna**. Rozwiązanie: **wyrenderować PNG po stronie serwera z palety decku** i wstawić jako obraz. Tanie, deterministyczne, wygląda dobrze |
| Zaokrąglenie tylko wybranych narożników | **OBEJŚCIE** | freeform albo nakładka |
| Krycie tekstu (np. `ink-secondary` @ 70 %) | **OBEJŚCIE** | `alpha` działa w PowerPoint, ale renderuje się różnie w Google Slides/Keynote — **lepiej wypłaszczyć kolor do wartości docelowej** |
| **Osadzenie kroju pisma** | **NIEMOŻLIWE do zagwarantowania** | patrz §6.2 — to jest największe ryzyko dla całego przedsięwzięcia |
| Oblewanie tekstem kształtu (float / shape-outside) | **NIEMOŻLIWE** | nie istnieje w formacie |
| Layout reagujący na zmianę treści po otwarciu | **NIEMOŻLIWE** | gdy klient dopisze zdanie, układ się nie przeliczy — rozjedzie |
| Identyczny render w PowerPoint / Keynote / Google Slides / LibreOffice | **NIEMOŻLIWE** | przy podmianie kroju **złamania wierszy się zmienią**; da się tylko ograniczać szkodę |
| Typografia „drukarska" (dzielenie wyrazów, optyczne wyrównanie marginesu, kerning optyczny) | **NIEMOŻLIWE** | brak kontroli |
| Przewijana rytmika gammy (karta po karcie w pionie) | **NIE DOTYCZY** | gamma to strona, PPTX to slajdy |

### 6.2 Krój pisma — ryzyko numer jeden, do rozstrzygnięcia PRZED prototypem

**Typografia JEST tym wyglądem** (C3, C4, C6, C7 — cztery z piętnastu cech to typografia). A jednocześnie: **nie da się zagwarantować, że wybrany krój wyrenderuje się na komputerze odbiorcy.** PPTX ma mechanizm osadzania kroju, ale:
- wsparcie różni się między PowerPoint na Windows, PowerPoint na Mac, Google Slides i LibreOffice,
- licencje wielu krojów zabraniają osadzania,
- podmiana kroju **zmienia złamania wierszy**, a przy naszych twardych limitach znaków (§5) to znaczy: tytuł zamiast w 2 wierszach zmieści się w 3 i rozjedzie blok.

**Nie znam aktualnego stanu wsparcia osadzania na Macu i w Google Slides na tyle pewnie, żeby to zadeklarować.** To trzeba **zmierzyć**, a nie założyć — i to jest osobne zadanie przed prototypem.

Trzy drogi, do decyzji właściciela:
1. **Krój bezpieczny** (obecny w każdej instalacji Office). Zero ryzyka, wygląd bliżej „porządny" niż „wyjątkowy".
2. **Krój własny + PDF jako format dystrybucji**, PPTX tylko dla tych, którzy edytują. Najlepszy wygląd, ale trzeba obsłużyć dwa formaty.
3. **Krój własny osadzony**, z akceptacją że poza Windows wygląd bywa inny. Najwyższe ryzyko na spotkaniu z zarządem klienta.

**Moja rekomendacja: droga 2.** Deck doradczy w 90 % przypadków jest wysyłany, nie edytowany — a PDF renderuje typografię dokładnie tak, jak ją zaprojektowaliśmy.

### 6.3 Trzecia pułapka: proporcje gammy nie są proporcjami 16:9

Karta gammy jest **szersza** (1,95) niż 16:9 (1,78) albo **węższa** (1,48). Kopiowanie jej marginesów procentowo 1:1 da na 16:9 inny efekt. Wartości w §1 i §5 są już przeliczone, ale to jest miejsce, gdzie prototyp na pewno wymaga korekty na oko po pierwszym renderze — i to jest normalne, nie porażka.

---

## 7. Napięcie, które trzeba nazwać właścicielowi PRZED prototypem

**Nie da się mieć jednocześnie skali typograficznej gammy i czytelności z sali zarządu.**

Zmierzone: treść w gammie ma **1,9–2,5 % wysokości kadru** — na slajdzie 7,5 cala to **10–13,5 pt**. Tytuł slajdu **24–39 pt**. To są rozmiary dobrane do czytania na laptopie z 50 cm, nie do rzutnika i nie do wydruku.

W §1 świadomie **podbiłem** treść do **15 pt** i liczbę do **52 pt** (zamiast zmierzonych ~11 i ~34). Konsekwencja jest arytmetyczna: przy tej samej ilości powietrza większy krój **musi** oznaczać mniej treści. Dlatego limit C11 (**≤ 110 słów, cel 80**) nie jest kaprysem — to jest cena tej decyzji.

**Wybór dla właściciela, do świadomego podjęcia:**
- **(a)** wygląd gammy 1:1, mały krój, deck do czytania na ekranie/PDF — **więcej treści na slajd**;
- **(b)** wygląd gammy z podbitą typografią, deck do pokazania na sali — **mniej treści na slajd, więcej slajdów**.

Prototyp powinien pokazać **(b)**, bo o to chodzi w decku dla zarządu. Ale trzeba to powiedzieć wprost, zanim właściciel zobaczy trzy slajdy i zapyta „a gdzie reszta treści".

---

## 8. Bramki pomiarowe — 15 automatycznych sprawdzeń

Do zaimplementowania przez tor pomiarowy jako walidator pliku PPTX (nie przeze mnie).

| # | Bramka | Warunek |
|---|---|---|
| B1 | marginesy | brak tekstu poza (120, 66)–(840, 474) |
| B2 | pion | `|((min_y+max_y)/2) − 270| ≤ 16 pt` na slajdach treściowych |
| B3 | kroje | liczba rodzin w decku = 2 |
| B4 | drabina | każdy `sz` należy do drabiny; ≤ 5 różnych na slajd |
| B5 | stosunek | tytuł/body ≥ 2,2 |
| B6 | interlinia | display ≤ 105 %; body 138–150 % |
| B7 | wagi | waga(body) ≤ 400; waga(tytuł) ≤ waga(H3) |
| B8 | akcent | 1 odcień w decku; ≤ 8 % powierzchni slajdu; kontrast body ≥ 4,5:1 |
| B9 | miara | 45 ≤ znaków w wierszu ≤ 75 |
| B10 | gęstość | ≤ 110 słów/slajd; okładka ≤ 14 |
| B11 | listy | głębokość = 1; ≤ 5 pozycji; brak glifu punktora |
| B12 | obrazy | każdy pasuje do slotu A/B/C ±2 pt; przecięcie z tekstem = 0 |
| B13 | efekty | `effectLst` pusty w całym decku; `radius ≤ 7 pt`; `ln ≤ 1,5 pt`; brak `gradFill` na kształtach treści |
| B14 | bohater | dokładnie 1 element o max stopniu; lewa krawędź = 120 pt (albo typ = cover/divider/quote) |
| B15 | liczby | slajd A5: liczba ≥ 1,4 × tytuł; ≤ 4 liczby; ≤ 6 znaków; **źródło obecne** |

---

## 9. Podsumowanie różnicy: gamma vs „slajd z 2005"

Gdyby trzeba było wskazać **pięć** decyzji, które robią całą różnicę (reszta to szlif):

1. **Blok treści wyśrodkowany w pionie** (C2) — slajd nigdy nie jest górno-ciężki z dziurą na dole.
2. **Odwrócona waga pisma** (C7) — wielki tytuł jest lekki, mały nagłówek jest mocny. PowerPoint domyślnie robi odwrotnie.
3. **Interlinia nagłówka = 1,00** (C6) — zmierzone w 100 % przypadków, we wszystkich trzech motywach. Domyślny PPT daje ~1,2 i tytuł natychmiast wygląda tanio.
4. **Jeden akcent, dwa stopnie tuszu, zero gradientów i zero cieni** (C8, C14) — płaskość jest cechą, nie brakiem.
5. **Treść jako siatka kafli, nie jako lista z punktorami** (C12) — to jedna zmiana, która likwiduje największą liczbę anty-wzorców naraz.

---

## 10. Czego ta specyfikacja NIE rozstrzyga

Uczciwie, żeby nikt nie zbudował na tym więcej, niż to udźwignie:

1. **Nie wiem, czy nasz generator to potrafi.** Nie zaglądałem do kodu — z założenia. Sufit możliwości nakładamy później, świadomie.
2. **Nie zmierzyłem Pitch, Tome ani Beautiful.ai.** Wszystkie liczby pochodzą z gammy.
3. **Nie zweryfikowałem C2 (centrowanie w pionie) na wszystkich 29 slajdach** — tylko na trzech. To najważniejsza reguła w dokumencie i **zasługuje na dopomiar** przed budową.
4. **Nie wiem, jak te reguły zniosą polską treść doradczą.** Polskie nagłówki są ~15–20 % dłuższe od angielskich; limity znaków w §5 mogą wymagać poluzowania. To wyjdzie na prototypie i jest to normalne.
5. **Nie znam stanu wsparcia osadzania krojów** w PowerPoint na Mac i w Google Slides na 2026 rok (§6.2). To trzeba zmierzyć, a nie zgadnąć — i to blokuje wybór kroju.
6. **Rozmiary w drabinie C4 dla treści (15 pt) i liczby (52 pt) są moją decyzją, nie pomiarem** — gamma ma tam ~11 i ~34. Powód i cena: §7.
