# G-1 ANEKS — OBRAZY

Uzupełnienie do `docs/program/funkcje/GAMMA_G1_SPECYFIKACJA.md`. Nie powtarzam rzeczy stamtąd (siatka, typografia, drabina, bramki).
Data: 2026-09-01. Sufit przyjęty: `pptxgenjs 4.0.1` — gradienty niemożliwe, osadzanie fontów niemożliwe, obrazy rastrowe dostępne.

---

## 0. Skąd te ustalenia

| Źródło | Co z niego mam |
|---|---|
| **Pomiar własny** (29 slajdów, 3 motywy — z pierwszej specyfikacji) | sloty, proporcje, brak obrazu na slajdach danych |
| **Dokumentacja Gammy — „How do I use the visuals menu"** | **werbatim lista presetów stylu** |
| **Dokumentacja Gammy — „What are image style references"** | mechanizm referencji stylu (1–4 obrazy wzorcowe) |
| **Gamma Insights — „The state of AI image generation" (22.07.2025)** | pierwszorzędne dane o modelach i **ich udokumentowanych awariach** |
| **Gamma Insights — „How to create pitch decks"** | motyw własny zawiera **„background images, accent colors"** razem; Agent; Smart Layouts |
| **Właściciel (1.09)** | relacja użytkownika zaawansowanego — punkt wyjścia, nie hipoteza |

---

## 1. Style obrazu — **jest ich 5 presetów + „Custom", czyli 6 pozycji do wyboru**

Właściciel pamięta „około sześciu typów" — **zgadza się co do liczby pozycji w menu**. Dokumentacja Gammy („How do I use the visuals menu in Gamma?") wymienia werbatim: **photography, illustration, abstract, 3D, line art**, plus **Custom** do wpisania stylu ręcznie.

**Zastrzeżenie, ważne:** strona produktowa Gammy (`/products/graphics/art`) mówi o „painterly, graphic, photorealistic, surreal i dziesiątkach innych stylów". **Nie udało mi się otworzyć samego pickera w produkcie (403 / pane się zawieszał), więc pełna, autorytatywna lista presetów NIE JEST USTALONA.** Pewne jest tylko 5 nazw z artykułu pomocy + Custom. Nie zgaduję reszty.

Poniżej sześć pozycji. Kolumna **werdykt** = moja ocena przydatności w decku dla zarządu, nie pomiar.

---

### 1.1 `Abstract` — abstrakcja *(werdykt: DOMYŚLNY, wdrożyć pierwszy)*

- **Co daje.** Miękkie formy organiczne, duże pole koloru, płytka głębia, ziarno. Zero rozpoznawalnych obiektów.
- **Do jakiej treści.** Okładka, przekładka, slajd narracyjny bez konkretu, zamknięcie. Nie stawia żadnej tezy faktograficznej — więc nie może skłamać.
- **Dlaczego pierwszy.** To dokładnie to, czego użyła Gamma we **wszystkich trzech** zmierzonych szablonach doradczych. Odporny na obie udokumentowane awarie modeli (§2.3): brak twarzy, brak miejsca na fałszywy tekst.
- **Szkic polecenia:**
  > `large-scale abstract composition, soft organic forms, smooth colour field, shallow depth of field, subtle film grain, matte finish, editorial art direction, muted palette of {PALETA}, no objects, no people, no text, no letters, no logos, {ASPECT}`

### 1.2 `Photography` — fotografia *(werdykt: TAK, ale z twardą regułą)*

- **Co daje.** Realizm, konkret, „to jest prawdziwy świat". Najmocniejsze pierwsze wrażenie na okładce.
- **Do jakiej treści.** Okładka i przekładki, gdy temat ma fizyczny desygnat (produkcja, logistyka, energetyka, budownictwo).
- **REGUŁA TWARDA: zero ludzi.** Gamma podaje wprost, że poza Imagen 4 modele dawały „poor facial integrity". Twarz z AI na okładce raportu dla zarządu to koszt wiarygodności większy niż zysk z ładnego zdjęcia. Architektura, materiał, przestrzeń, hala bez ludzi — tak.
- **REGUŁA TWARDA 2: nigdy jako dowód.** Zdjęcie wygenerowane nie może udawać hali *tego* klienta. Jeśli ma pokazać stan faktyczny — zdjęcie dostarcza konsultant.
- **Szkic polecenia:**
  > `editorial architectural photography of {TEMAT}, natural side light, shallow depth of field, muted desaturated colour, matte film look, generous negative space on the {left|right} third, 50mm lens, no people, no faces, no text, no signage, {ASPECT}`

### 1.3 `Line art` — rysunek liniowy *(werdykt: TAK, niedoceniony)*

- **Co daje.** Monolinia jednej grubości, jeden kolor, czytelność schematu. Czyta się jak rysunek techniczny/blueprint.
- **Do jakiej treści.** Slajd metody, architektury rozwiązania, procesu — tam, gdzie abstrakcja byłaby pusta, a fotografia kłamliwa. Bardzo wysoka wiarygodność inżynierska.
- **Zaleta praktyczna.** Jednobarwny → **duotone go nie psuje** (§2), więc dopasowanie do palety jest darmowe i idealne.
- **Szkic polecenia:**
  > `technical line drawing, single-weight monoline, {TEMAT} rendered as a clean schematic, orthographic or isometric, one colour on plain background, no shading, no fill, no labels, no text, generous negative space, {ASPECT}`

### 1.4 `Illustration` — ilustracja *(werdykt: OSTROŻNIE)*

- **Co daje.** Płaskie kształty, redakcyjna wektorowa stylistyka.
- **Ryzyko.** Bardzo łatwo zsuwa się w „startup" albo w infantylność. Dla zarządu korporacyjnego to obniża rangę dokumentu.
- **Warunek dopuszczenia.** Paleta ograniczona do 3 barw z motywu, **bez postaci i twarzy**, geometryczna abstrakcja pojęcia, nie ilustracja sceny.
- **Szkic polecenia:**
  > `editorial vector illustration, flat geometric shapes, strictly 3-colour palette {PALETA}, abstract representation of {POJĘCIE}, no characters, no people, no faces, no text, generous negative space, matte, {ASPECT}`

### 1.5 `3D` — render *(werdykt: OSTROŻNIE)*

- **Co daje.** Miękkie bryły, materiał matowy/glina, jedno miękkie światło, długie cienie. Wygląda nowocześnie i drogo.
- **Ryzyko.** Modne, więc szybko się zestarzeje; przy złym prompcie czyta się jako gadżet.
- **Warunek.** Wyłącznie prymitywy geometryczne jako metafora, nigdy przedmioty ani ludzie.
- **Szkic polecenia:**
  > `soft 3D render, matte clay material, simple geometric primitives arranged to suggest {POJĘCIE}, single soft key light, long soft shadows, plain background, muted palette {PALETA}, no text, no people, {ASPECT}`

### 1.6 `Custom` — styl własny + referencje *(werdykt: TAK, to jest nasza dźwignia marki)*

- **Co daje.** Słowa kluczowe użytkownika oraz — wg dokumentacji Gammy — **od 1 do 4 obrazów referencyjnych**: „Think of it like handing a mood board to a designer — Gamma reads the colors, composition, and aesthetic feel".
- **Dlaczego dla nas ważne.** To jest droga do „deck wygląda jak od TEJ firmy doradczej": raz ustalony zestaw referencji na organizację daje spójność między raportami dla różnych klientów.
- **Uwaga.** Dokumentacja mówi, że referencje czytają „colors, composition, aesthetic feel", ale **nie mówi, na ile kolor jest priorytetowany względem reszty — to NIE JEST USTALONE.** Dlatego nie opieram na tym dopasowania koloru (§2).

**Kolejność wdrożenia, gdybyśmy mieli robić po jednym:** `Abstract` → `Line art` → `Photography (bez ludzi)` → `Custom` → `3D` → `Illustration`.

**Dodatkowo, poza listą Gammy, rekomenduję szósty styl własny: `Tekstura / materiał`** — makro materiału (beton, papier, włókno, metal szczotkowany), monochromatyczne, bez obiektu. Technicznie to podzbiór `photography`, ale zachowuje się jak `abstract`: zero ryzyka twarzy i tekstu, a wygląda drożej niż gradient. To najtańszy sposób na „ma teksturę, nie jest płaskie".

---

## 2. Jak obraz „pasuje kolorem" — rozstrzygnięcie

### 2.1 Co robi Gamma

**W szablonach, które zmierzyłem — obraz jest częścią motywu, nie jest generowany per slajd.** Potwierdza to dokumentacja Gammy wprost: motyw własny ustawia się podając „the title and heading fonts, **background images, accent colors**, logo" — obrazy tła i barwy akcentowe są **jedną rzeczą, ustawianą razem**. Dlatego w moim pomiarze obrazy decku 1 były wrzosowo-brązowe przy wrzosowym akcencie, decku 2 burgundowo-kremowe przy burgundowym, decku 3 ciemne przy turkusowym. To nie jest magia dopasowania — **to kurator dobrał jedno do drugiego z góry.**

**Dla decków generowanych z promptu mechanizm dopasowania koloru NIE JEST USTALONY.** Wiem tylko, że istnieją słowa kluczowe stylu i referencje obrazowe. Nie twierdzę, że Gamma wstrzykuje paletę do promptu — nie znalazłem na to dowodu.

### 2.2 Trzy możliwe mechanizmy i werdykt

| Mechanizm | Determinizm | Werdykt dla nas |
|---|---|---|
| **(A) Paleta w treści polecenia** („muted palette of deep warm brown and pale mauve") | niski — model trafia „w okolice", nie w wartość | **Pomocniczo tak.** Darmowe, poprawia punkt startowy. Nigdy jako jedyny mechanizm. |
| **(B) Obróbka po wygenerowaniu** — mapowanie luminancji na rampę zbudowaną z ról palety (duotone/tritone) | **pełny — wynik co do piksela** | **TO JEST ODPOWIEDŹ.** |
| **(C) Dobór palety slajdu pod obraz** | pełny, ale odwrotny kierunek | **ODRZUCIĆ.** Nasz akcent jest stały (marka produktu albo marka klienta). Paleta nie może się ruszać pod obrazek. |

### 2.3 Dlaczego (B), konkretnie

Bierzemy wygenerowany obraz, sprowadzamy do luminancji i mapujemy ją na rampę z **naszych ról** (`surface` → `ink-secondary` → `accent`). Efekt:

1. **Dopasowanie jest dokładne zawsze**, niezależnie od tego, co model wypluł.
2. **Ratuje przeciętny obraz.** Duotone sprawia, że nawet niezbyt udany render wygląda jak świadoma decyzja redakcyjna. To klasyczny chwyt magazynowy.
3. **Rozwiązuje problem spójności między slajdami** — sześć różnych obrazów po tej samej rampie wygląda jak jedna seria.
4. **Jest sprawdzalne automatem** — kontrast tekstu nad obrazem liczymy z gotowych pikseli, przed wysyłką.

**Stopniowanie, bo duotone nie pasuje wszędzie:**

| Styl | Obróbka |
|---|---|
| `abstract`, `line art`, `tekstura` | **pełny duotone/tritone** na rampie palety — 100 % dopasowania, zero straty |
| `photography` | **NIE duotone** (zabija realizm). Zamiast tego: desaturacja 30–50 %, cienie podbite w stronę `surface`, światła w stronę neutralnej bieli, na wierzchu **welon `accent` przy kryciu 8–15 %** |
| `illustration`, `3D` | paleta wymuszona w poleceniu (A) + delikatny welon; duotone opcjonalnie |

### 2.4 Bramka jakości, której wymagam — z powodu udokumentowanych awarii

Gamma podaje **z pierwszej ręki** dwie awarie modeli obrazowych:
- *„Unsolicited text generation has become a persistent issue. Models that excel at rendering text when requested now sometimes add unwanted text elements even when prompts explicitly avoid mentioning any text content."*
- Instrukcje „DO NOT" bywają łamane (w ich teście Recraft trzymał się ich najlepiej, GPT i Ideogram dodały ludzi mimo zakazu).

Czyli: **negatywny prompt nie jest zabezpieczeniem.** Dlatego dwie bramki automatyczne przed wstawieniem obrazu do decku:

- **B-IMG-1 — OCR.** Jeśli w wygenerowanym obrazie wykryty jest jakikolwiek tekst → odrzuć i generuj ponownie. Zniekształcony napis-widmo na okładce raportu dla zarządu to koszt niewspółmierny do oszczędności.
- **B-IMG-2 — detekcja twarzy.** Jeśli wykryta twarz, a styl nie jest jawnie „fotografia z ludźmi zatwierdzona przez człowieka" → odrzuć.

To są dwie tanie kontrole, które zdejmują dokładnie te ryzyka, które producent sam nazwał.

---

## 3. Pogodzenie z moim pomiarem — sprawdzam tezę koordynatora

**Teza do sprawdzenia:** *„Ty mierzyłeś szablony, on mówi o deckach generowanych; obraz robi pierwsze wrażenie (okładka, przekładki), nie niesie treści; rdzeń doradczy broni się bez zdjęć."*

### Werdykt: **teza potwierdzona w dwóch trzecich, jedna trzecia niezweryfikowana. Nie potwierdzam całości.**

**POTWIERDZAM — 1: mierzyłem co innego niż to, o czym mówi właściciel.** Koordynator ma rację i to jest realna korekta mojego pierwszego raportu. Szablony to **zasoby motywu dobrane ręcznie przez projektanta Gammy**; decki generowane używają **modeli obrazowych**. To dwa różne mechanizmy. Mój wskaźnik „52 % slajdów z obrazem" opisuje szablony i **nie wolno go przenosić na decki generowane.** Skala generowania podana przez Gammę — **ponad miliard obrazów, do 5 mln dziennie w szczycie** — mocno sugeruje, że decki generowane są znacznie gęściej zobrazowane niż szablony.

**POTWIERDZAM — 2: obraz nie niesie treści.** To zostaje w mocy i jest mocno zmierzone. Każdy obraz w 29 slajdach był **abstrakcyjną teksturą bez desygnatu** — żadnego wykresu, żadnej rzeczy, żadnej osoby. Obraz był materiałem, nie argumentem.

**POTWIERDZAM — 3, najmocniej: rdzeń doradczy broni się bez zdjęć.** Tu dowód jest twardy i bez wyjątku: **na wszystkich slajdach danych — statystyki, wykresy, diagramy — we wszystkich trzech deckach było ZERO obrazów rastrowych.** Deck 1 karty 3, 4, 6, 7, 9; deck 3 karty 2, 3, 5, 6, 8, 9. Jedenaście slajdów, zero wyjątków, trzy różne motywy. To nie jest przypadek — to reguła projektowa.

**NIE POTWIERDZAM — czego nie zdołałem sprawdzić.** Koordynator prosił o dowód na **decku generowanym**. **Nie zdobyłem go.** Galeria `gamma.app/inspiration` nie wystawia linków do dokumentów w DOM, a panel przeglądarki zawieszał się przy próbach scrollowania. **Nie wiem więc, ile obrazów przypada na slajd w decku generowanym ani czy każda karta go dostaje.** Piszę „nie ustalone" zamiast wnioskować z wolumenu generacji.

### Co z tego wynika dla nas

Jest jeden wniosek, który jest **mocniejszy** niż spór o statystykę i który się nie zmienia:

> Projektanci Gammy, budując ręcznie szablony **doradcze**, świadomie zostawili slajdy danych bez obrazów i oparli wrażenie na okładce i przekładkach.

To jest ocena zawodowa ich własnego zespołu, dotycząca dokładnie naszego gatunku dokumentu — i jest lepszą wskazówką niż zachowanie generatora na dowolnym prompcie. **Robimy jak ich projektanci, nie jak ich generator.**

Praktycznie: **obraz na okładce, przekładkach i slajdach narracyjnych; nigdy na slajdach danych.** Właściciel dostaje efekt „wow" tam, gdzie o niego walczy (pierwsze wrażenie), a deck nie traci wiarygodności tam, gdzie się o nią gra.

---

## 4. Sloty i kiedy obraz szkodzi

### Sloty (proporcje generowania — żeby nie kadrować destrukcyjnie)

| Slot | Wymiar na 960 × 540 pt | Proporcja do generowania | Kiedy |
|---|---|---|---|
| **Pełne tło** | 960 × 540 | **16:9** | **wyłącznie** okładka, przekładka, zamknięcie — i tylko z welonem (§5) |
| **Panel boczny** | 360 × 540 (lewo lub prawo) | **2:3 pion** | slajd narracyjny, jedna teza, cytat |
| **Pas** | 960 × 178 (góra lub dół) | **16:3 panorama** | otwarcie rozdziału, slajd o krótkiej treści |
| **Kafel** | 230,7 × 142 (×N) | **1,6:1** | 2–4 równoległe wątki, z których każdy ma „twarz" |

Reguła z pierwszej specyfikacji zostaje bez zmian: **przecięcie prostokąta obrazu z prostokątem tekstu = 0**, poza pełnym tłem, gdzie obowiązuje welon i bramka kontrastu.

### Kiedy obraz **pogarsza** slajd — zakaz

| Treść | Dlaczego obraz szkodzi |
|---|---|
| **Slajd z liczbami** | oko ma porównywać wartości; obraz to druga konkurencyjna masa wizualna i liczba przestaje być bohaterem. **Zmierzone: 11/11 slajdów danych w Gammie bez obrazu.** |
| **Gęsta tabela / macierz** | obraz zabiera szerokość, kolumny się zwężają, tabela traci czytelność — a to jedyne, co ma |
| **Sekwencja kroków / oś czasu** | sekwencja jest już grafiką; dwie grafiki obok siebie znoszą się nawzajem |
| **Wykres** | wykres **jest** obrazem tego slajdu |
| **Slajd z 4 kaflami** | kafel + obraz = 8 obiektów; przekroczony limit gęstości |
| **Zamknięcie z konkretnymi ustaleniami** | jeśli slajd ma zapaść w pamięć jako zobowiązanie, ozdoba rozprasza |

Reguła jednym zdaniem: **obraz tam, gdzie oko ma poczuć; nigdy tam, gdzie oko ma policzyć.**

---

## 5. Czy wypalać całe tło slajdu w PNG? — **TAK**

Odpowiedź wprost: **tak, wypalać** — pole koloru, gradient, ziarno, welon i duotone w jeden raster. **Nie składać tła z półprzezroczystych kształtów.**

**Dlaczego:**

1. **I tak generujemy raster.** Skoro obraz wchodzi jako PNG/JPG, dołożenie do niego gradientu i ziarna kosztuje zero dodatkowych elementów na slajdzie.
2. **Udawany gradient widać.** Nakładanie 3–4 półprzezroczystych prostokątów daje **schodkowanie**. Na ekranie laptopa ujdzie, na rzutniku przy polu pełnoekranowym pasy są widoczne — a to dokładnie ten slajd, na którym gramy o pierwsze wrażenie.
3. **Ziarna nie da się zrobić kształtami w ogóle.** A ziarno jest tym, co odróżnia „drogie tło" od „gradientu z 2005".
4. **Determinizm.** Jeden raster renderuje się identycznie w PowerPoint, Keynote, Google Slides i LibreOffice. Stos przezroczystych kształtów to cztery różne kompozycje w czterech aplikacjach.
5. **Kontrast staje się mierzalny przed wysyłką.** Mając gotowe piksele, próbkujemy je pod polem tekstowym i liczymy kontrast (bramka: **≥ 4,5:1 w 9 punktach** obszaru tekstu). Przy stosie kształtów trzeba by symulować składanie.
6. **Mniej elementów = bezpieczniejszy agent redagujący.** Każdy kształt tła to obiekt, który edycja może przesunąć albo zgubić.

**Granica, której nie przekraczać — i to jest istotne:**

> **Raster dla materiału, wektor dla znaczenia.**

W PNG wypalamy **wyłącznie to, co nie niesie informacji**: pole, gradient, ziarno, tekstura, welon. **Nigdy** nie wypalamy: tekstu (dostępność, tłumaczenie, edycja), liczb, macierzy kropek, pasków, pierścieni, wykresów — one muszą zostać kształtami OOXML, bo agent musi móc zmienić liczbę i grafika ma za nią pójść.

**Uczciwie o kosztach:**
- **Waga pliku.** Full-bleed 1920×1080 to ~200–400 KB (JPG dla fotografii, PNG tylko gdy potrzebna alfa). Deck 20 slajdów z 6 obrazami ≈ 2–3 MB. Nieistotne.
- **Utrata edytowalności po stronie klienta.** Klient nie przefarbuje wypalonego tła w PowerPoint. To realna strata i trzeba ją nazwać. Odpowiedź: **zmiana idzie przez agenta i regenerację**, nie przez grzebanie w PPTX — co jest zresztą tą samą zasadą, która chroni cały układ.
- **Półprzezroczyste kształty zostają** do dwóch zastosowań: welon nad obrazem, gdy chcemy go **stroić** bez regeneracji, oraz tinty akcentu nad żywą treścią.

---

## 6. Czego nie ustaliłem — wprost

1. **Pełna lista presetów stylu w produkcie.** Mam 5 nazw werbatim z artykułu pomocy + „Custom". Marketing mówi o „dziesiątkach". Pickera nie otworzyłem. **Nie ustalone.**
2. **Gęstość obrazów w decku generowanym z promptu.** Nie otworzyłem żadnego decku generowanego. **Nie ustalone** — i to jest ta jedna trzecia tezy z §3, której nie potwierdzam.
3. **Jak dokładnie Gamma dopasowuje kolor obrazu w trybie generowanym.** Wiem, że w motywach obrazy i akcenty ustawiane są razem; dla generowania **nie ustalone**. Rekomendacja (B) w §2 jest **moją decyzją inżynierską**, nie odtworzeniem mechanizmu Gammy.
4. **Na ile referencje stylu sterują kolorem** względem kompozycji i nastroju. Dokumentacja wymienia wszystkie trzy, nie waży ich. **Nie ustalone.**
5. **Czy Gamma stosuje jakąkolwiek obróbkę po generowaniu.** Nie znalazłem żadnej wzmianki. **Nie ustalone** — nie zakładam, że stosuje.
