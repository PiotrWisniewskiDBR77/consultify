# Inicjatywa — lista błędów i wymaganych zmian

**Artefakt:** Inicjatywa  
**Status audytu:** wizualny wzorzec prawego panelu, do korekty menu i zachowań

---

## 1. Co jest poprawne i powinno zostać

- Prawy panel jest najlepszym wzorcem wizualnym spośród analizowanych kart.
- Panel jest jasny, zaokrąglony i stanowi osobny komponent systemowy.
- Dobrze kontrastuje z ciemniejszym tłem lewego panelu i treści.
- Sekcje panelu są rozwijane i zwijane.
- Tabela Właściwości ma czytelny, symetryczny układ.
- Centralne pola posiadają AI i uchwyty zmiany wysokości.
- „Oznacz jako ukończone” może pozostać w nagłówku jako jedna oczywista akcja.

---

# 2. Błędy w menu pierwszego poziomu

## 2.1. Przełącznik widoku

**Zmiana:**

- usunąć dodatkowe ikony widoku pomiędzy AI i główną akcją.

## 2.2. Główna akcja

„Oznacz jako ukończone” może pozostać w nagłówku, jeżeli:

- jest jedną rekomendowaną akcją,
- nie jest powielona w prawym panelu,
- pojawia się tylko w odpowiednim statusie.

## 2.3. AI

Przycisk AI otwiera dodatkowy panel rozmowy i przekazuje kontekst całej inicjatywy. Nie zastępuje prawego panelu.

---

# 3. Błędy w menu drugiego poziomu

Obecnie pasek zawiera:

- Zakres,
- Sekcje,
- nazwę aktywnej sekcji,
- Edycja / Podgląd po prawej.

## 3.1. Lewa strona

**Zmiana:**

- pozostawić wyłącznie „Sekcje”,
- usunąć dodatkowy przycisk „Zakres”,
- usunąć nazwę aktywnej karty z paska,
- nie dodawać „Nowa karta”.

Aktywna karta jest już wskazana w lewym panelu i nie powinna być dublowana.

## 3.2. Środek

**Zmiana:**

- przenieść Edycja | Podgląd dokładnie na środek całego paska.

## 3.3. Prawa strona

**Zmiana:**

- opcjonalnie dodać How to / Baza wiedzy,
- dodać fioletowy „Analizuj z AI” skrajnie po prawej.

---

# 4. Lewy panel

Panel jest zasadniczo poprawny.

Wymagane:

- lista kart sterowana przez Sekcje,
- brak mechaniki tworzenia nowych kart,
- ten sam styl aktywnej pozycji co w innych n-Type,
- nieruchoma pozycja podczas scrollowania.

---

# 5. Centralny obszar

## 5.1. Pola tekstowe

Obecne rozwiązanie jest dobrą bazą.

Należy wdrożyć pełne zachowanie:

- auto-fit do tekstu,
- ręczny resize,
- po ręcznym resize brak automatycznego kurczenia,
- możliwość powrotu do auto-fit,
- wspólny fioletowy styl AI,
- ukrycie kontrolek w Podglądzie.

## 5.2. Analizuj z AI

Dla Inicjatywy analiza powinna oceniać:

- jasność celu,
- zakres i wyłączenia,
- jakość KPI,
- kryteria sukcesu,
- kompletność zadań,
- zależności,
- ryzyka,
- zgodność z decyzją lub insightem źródłowym,
- gotowość do kolejnej bramy.

---

# 6. Prawy panel — wzorzec z korektami

## 6.1. Zachować

- jasne tło,
- zaokrąglenie,
- odstęp od krawędzi,
- układ accordionów,
- tabelę właściwości,
- możliwość niezależnego zwijania sekcji.

## 6.2. Docelowa kolejność

1. Akcje
2. Właściwości
3. Powiązania
4. Źródła i założenia
5. Rezultaty — jeżeli dostępne
6. Komentarze
7. Historia

## 6.3. „Historia / AI”

**Zmiana:**

- zmienić nazwę na „Historia”,
- logi AI pokazywać jako typ wpisu lub filtr.

## 6.4. Akcje

Obecne przykłady, takie jak Forkuj i Tryb pokazu, wymagają przypisania:

- **Forkuj** może pozostać w Akcjach, jeżeli tworzy biznesową odnogę artefaktu,
- **Tryb pokazu** lepiej pasuje do Rezultatów lub działań prezentacyjnych,
- działania techniczne typu Kopiuj link, Duplikuj, Archiwizuj i Usuń trafiają pod trzy kropki.

## 6.5. Rezultaty

Jeżeli inicjatywa może generować:

- prezentację,
- raport,
- podsumowanie,
- wiadomość,
- kolejny artefakt,

dodać osobną sekcję Rezultaty.

---

# 7. Przewijanie

- centralna treść przewija się,
- prawy panel pozostaje na miejscu,
- lewy panel pozostaje na miejscu,
- oba poziomy menu pozostają widoczne,
- dodatkowy panel AI nie zastępuje prawego panelu.

---

# 8. Kryteria akceptacji dla Inicjatywy

- [ ] Usunięto przełącznik widoku.
- [ ] W drugim menu pozostało tylko Sekcje po lewej.
- [ ] Usunięto Zakres i zduplikowaną nazwę aktywnej karty.
- [ ] Edycja | Podgląd jest dokładnie na środku.
- [ ] Dodano fioletowy Analizuj z AI skrajnie po prawej.
- [ ] Zachowano obecny wygląd prawego panelu jako wzorzec.
- [ ] Dodano Rezultaty, jeżeli dostępne są działania wynikowe.
- [ ] Tryb pokazu został właściwie sklasyfikowany.
- [ ] Historia/AI została zmieniona na Historia.
- [ ] Pola mają pełne zachowanie auto-fit i resize.
- [ ] Przewija się tylko centralna treść.
