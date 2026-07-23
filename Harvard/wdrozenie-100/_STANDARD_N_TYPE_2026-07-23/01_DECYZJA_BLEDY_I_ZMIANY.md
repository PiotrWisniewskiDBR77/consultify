# Decyzja — lista błędów i wymaganych zmian

**Artefakt:** Decyzja  
**Status audytu:** do przebudowy względem standardu n-Type

---

## 1. Co jest poprawne i powinno zostać

- Ogólny układ trzech kolumn: lista kart, treść centralna, panel prawy.
- Jasny panel prawy odróżniony od ciemniejszego tła.
- Sekcje centralne posiadają przyciski AI.
- Pola tekstowe pokazują uchwyty zmiany wysokości.
- Lewa lista kart jest czytelna i ma wyraźny stan aktywny.
- Panel prawy zawiera już sekcje Akcje, Właściwości, Powiązania, Komentarze i Historia/AI, więc jego struktura jest zbliżona do docelowej.

---

# 2. Błędy w menu pierwszego poziomu

## 2.1. Niepotrzebny przełącznik widoku

W nagłówku znajdują się ikony przełączania widoku pomiędzy przyciskiem AI i główną akcją.

**Zmiana:**

- usunąć cały przełącznik N/C lub analogiczny przełącznik układu,
- pozostawić jeden standardowy widok n-Type.

## 2.2. Niewłaściwe umieszczenie głównej akcji

Przycisk „Zatwierdź decyzję” znajduje się w nagłówku. Decyzja ma jednak bardziej złożony zestaw możliwych działań i przejść workflow.

**Zmiana:**

- usunąć „Zatwierdź decyzję” z nagłówka,
- przenieść wszystkie działania decyzji do sekcji **Akcje** w prawym panelu,
- nie dublować ich w innych miejscach.

## 2.3. AI w nagłówku

Przycisk AI może pozostać, ale musi działać zgodnie ze standardem:

- otwiera dodatkowy panel rozmowy,
- przekazuje kontekst całej decyzji,
- nie zastępuje prawego panelu.

---

# 3. Błędy w menu drugiego poziomu

## 3.1. Przycisk „Nowa karta”

Przycisk sugeruje możliwość tworzenia kart spoza zamkniętego katalogu.

**Zmiana:**

- usunąć „Nowa karta”,
- pozostawić wyłącznie „Sekcje”.

## 3.2. Pasek workflow zamiast standardowego menu

Obecny pasek pokazuje etapy Draft / Analiza / Rekomendacja / Decyzja. Nie realizuje standardu drugiego menu.

**Zmiana:**

- drugie menu przebudować na:
  - lewa strona: Sekcje,
  - dokładny środek: Edycja | Podgląd,
  - prawa strona: opcjonalnie How to / Baza wiedzy,
  - skrajnie po prawej: Analizuj z AI.
- stan workflow pokazywać przez Status i Właściwości, a nie przez osobny trzeci pasek zajmujący wysokość ekranu.

Jeżeli wizualizacja procesu decyzji jest potrzebna biznesowo, powinna być osobnym komponentem wewnątrz właściwej karty, a nie częścią globalnego szkieletu n-Type.

## 3.3. Brak „Analizuj z AI”

**Zmiana:**

- dodać fioletowy przycisk „Analizuj z AI” skrajnie po prawej,
- analiza ma oceniać aktywną kartę względem jej opisu i standardu.

---

# 4. Lewy panel

Lewy panel jest zasadniczo poprawny.

Do sprawdzenia podczas wdrożenia:

- lista pokazuje tylko karty włączone w menu Sekcje,
- kolejność jest zgodna z ustawieniem użytkownika,
- panel pozostaje nieruchomy podczas przewijania centralnej treści,
- styl aktywnej pozycji jest wspólny z pozostałymi n-Type.

---

# 5. Centralny obszar treści

## 5.1. Automatyczna wysokość

Pola pokazują uchwyty, ale należy potwierdzić zachowanie.

**Wymagane:**

- wysokość dopasowuje się automatycznie do tekstu,
- po ręcznym przeciągnięciu automatyczne kurczenie zostaje wyłączone,
- pole nadal może rosnąć, gdy treść przestaje się mieścić,
- dostępny jest powrót do auto-fit.

## 5.2. AI przy polach

Obecne przyciski AI należy ujednolicić:

- fioletowy token AI,
- ten sam rozmiar i pozycja,
- wspólne menu operacji,
- propozycja nie nadpisuje treści bez akceptacji.

## 5.3. Tryb Podgląd

W Podglądzie:

- ukryć uchwyty,
- ukryć lub wyłączyć AI przy polach,
- usunąć ramki edycyjne.

---

# 6. Prawy panel

## 6.1. Wygląd

Panel jest bliski wzorcowi, ale musi korzystać z tego samego komponentu co Inicjatywa:

- identyczna szerokość,
- identyczne zaokrąglenie,
- identyczne odstępy,
- identyczna tabela właściwości,
- identyczne nagłówki accordionów.

## 6.2. Kolejność i kompletność sekcji

Docelowo:

1. Akcje
2. Właściwości
3. Powiązania
4. Źródła i założenia
5. Rezultaty — jeżeli dostępne
6. Komentarze
7. Historia

**Zmiany:**

- dodać „Źródła i założenia”,
- dodać „Rezultaty”, jeżeli decyzja może generować raport, prezentację lub kolejny artefakt,
- zmienić „Historia / AI” na „Historia”.

## 6.3. Akcje decyzji

Do sekcji Akcje przenieść wszystkie działania workflow, w tym:

- zatwierdzenie etapu,
- cofnięcie,
- zatwierdzenie decyzji,
- inne przejścia specyficzne dla stanu.

Akcje ułożyć pionowo. Najważniejszą wyróżnić.

## 6.4. Historia

Historia ma zawierać logi:

- ludzi,
- systemu,
- AI.

Nie używać nazwy „Historia / AI”. AI jest filtrem lub typem wpisu, nie osobną częścią nazwy sekcji.

---

# 7. Przewijanie

**Wymagane:**

- przewija się tylko centralna treść,
- oba menu pozostają widoczne,
- lewy panel jest nieruchomy,
- prawy panel jest nieruchomy,
- panel AI otwiera się dodatkowo i nie zastępuje prawego panelu.

---

# 8. Kryteria akceptacji dla Decyzji

- [ ] Usunięto przełącznik widoku z nagłówka.
- [ ] Usunięto „Zatwierdź decyzję” z nagłówka.
- [ ] Wszystkie działania decyzji znajdują się w Akcjach prawego panelu.
- [ ] Usunięto „Nowa karta”.
- [ ] Edycja | Podgląd jest dokładnie na środku drugiego menu.
- [ ] Dodano fioletowy „Analizuj z AI” skrajnie po prawej.
- [ ] Pasek workflow nie zastępuje standardowego drugiego menu.
- [ ] Panel prawy używa komponentu wzorcowego.
- [ ] Dodano Źródła i założenia.
- [ ] „Historia / AI” zmieniono na „Historia”.
- [ ] Pola mają auto-fit i zapamiętują ręczną wysokość.
- [ ] Centralna treść przewija się niezależnie od paneli.
