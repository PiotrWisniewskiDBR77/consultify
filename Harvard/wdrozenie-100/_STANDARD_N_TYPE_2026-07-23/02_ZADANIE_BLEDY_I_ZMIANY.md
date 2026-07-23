# Zadanie — lista błędów i wymaganych zmian

**Artefakt:** Zadanie  
**Status audytu:** do ujednolicenia ze standardem n-Type

---

## 1. Co jest poprawne i powinno zostać

- Czytelny nagłówek z nazwą, statusem i informacją o zapisaniu.
- Lewa lista kart: Opis i zakres, Lista kontrolna, Zależności, Dowody.
- Centralne pola mają przyciski AI i uchwyty zmiany wysokości.
- Prawy panel zawiera podstawowe sekcje: Akcje, Właściwości, Powiązania, Komentarze i Historia/AI.
- „Wyślij do przeglądu” może pozostać w nagłówku, jeżeli w danym stanie jest jedyną rekomendowaną akcją.

---

# 2. Błędy w menu pierwszego poziomu

## 2.1. Przełącznik widoku

**Zmiana:**

- usunąć ikony przełączania widoku pomiędzy AI i przyciskiem działania.

## 2.2. Główna akcja

„Wyślij do przeglądu” może zostać w nagłówku pod warunkiem, że:

- jest dokładnie jedną rekomendowaną akcją,
- nie jest powielona w prawym panelu,
- po zmianie statusu przycisk zmienia się zgodnie z workflow.

Jeżeli w danym stanie dostępne są równorzędne przejścia, należy je przenieść do prawego panelu.

## 2.3. AI w nagłówku

Przycisk AI ma otwierać rozmowę w kontekście całego zadania, bez zastępowania prawego panelu.

---

# 3. Błędy w menu drugiego poziomu

## 3.1. „Nowa karta”

**Zmiana:**

- usunąć przycisk „Nowa karta”,
- wszystkie karty są predefiniowane,
- ich widocznością i kolejnością zarządza „Sekcje”.

## 3.2. Brak standardowej osi menu

**Zmiana:**

- po lewej pozostawić „Sekcje”,
- na dokładnym środku dodać „Edycja | Podgląd”,
- po prawej dodać opcjonalne How to / Baza wiedzy,
- skrajnie po prawej dodać fioletowy „Analizuj z AI”.

---

# 4. Banner „Created from decision”

Banner jest stałym elementem pokazującym pochodzenie zadania i zajmuje miejsce nad treścią.

**Zmiana:**

- usunąć banner,
- informację o decyzji źródłowej przenieść do:
  - Właściwości — pole „Źródło”,
  - Powiązania — link do decyzji,
  - Źródła i założenia — kontekst utworzenia.

Stały banner nie powinien być używany do informacji, która już istnieje w panelu systemowym.

---

# 5. Rozproszony pasek akcji

Na ekranie występuje osobny zestaw przycisków:

- Ukończ,
- Zablokuj,
- Przydziel.

Jest to niezgodne ze standardem.

**Zmiana:**

- przenieść te działania do sekcji **Akcje** w prawym panelu,
- ułożyć pionowo,
- wyróżnić działanie główne,
- nie dublować „Wyślij do przeglądu”, jeśli pozostaje w nagłówku.

---

# 6. Lewy panel

Panel jest właściwy funkcjonalnie.

Wymagane ujednolicenie:

- stała szerokość,
- ten sam styl aktywnej karty co w innych n-Type,
- nieruchoma pozycja podczas przewijania,
- lista zgodna z ustawieniami menu Sekcje.

---

# 7. Centralny obszar roboczy

## 7.1. Pola tekstowe

Obecne rozwiązanie jest dobrą bazą.

Należy zapewnić:

- automatyczne dopasowanie wysokości,
- ręczne przeciąganie,
- po ręcznym ustawieniu brak automatycznego kurczenia,
- możliwość powrotu do auto-fit,
- wspólny fioletowy styl AI.

## 7.2. Checklisty i dowody

Komponenty nietekstowe mogą być specyficzne dla Zadania, ale powinny respektować:

- Edycja/Podgląd,
- wspólne odstępy,
- wspólne nagłówki,
- analizę AI aktywnej karty.

## 7.3. Analizuj z AI

Dla Zadania analiza powinna oceniać co najmniej:

- kompletność opisu,
- jasność zakresu,
- kryteria akceptacji,
- zależności,
- ryzyka blokady,
- kompletność dowodów,
- spójność z decyzją źródłową.

---

# 8. Prawy panel

## 8.1. Komponent wizualny

Użyć tego samego jasnego, zaokrąglonego komponentu co w Inicjatywie.

## 8.2. Docelowe sekcje

1. Akcje
2. Właściwości
3. Powiązania
4. Źródła i założenia
5. Rezultaty — jeżeli dostępne
6. Komentarze
7. Historia

**Zmiany:**

- dodać Źródła i założenia,
- przenieść tam kontekst decyzji źródłowej,
- zmienić „Historia / AI” na „Historia”,
- dodać Rezultaty, jeżeli zadanie może generować raport lub podsumowanie.

## 8.3. Akcje

W panelu umieścić:

- Ukończ,
- Zablokuj,
- Przydziel,
- inne działania workflow.

Nie umieszczać tam technicznych działań typu Kopiuj link lub Usuń — trafiają pod trzy kropki.

---

# 9. Kryteria akceptacji dla Zadania

- [ ] Usunięto przełącznik widoku.
- [ ] Usunięto „Nowa karta”.
- [ ] Dodano Edycja | Podgląd dokładnie na środku drugiego menu.
- [ ] Dodano „Analizuj z AI” skrajnie po prawej.
- [ ] Usunięto banner „Created from decision”.
- [ ] Źródło zadania jest widoczne w prawym panelu.
- [ ] Ukończ, Zablokuj i Przydziel znajdują się w sekcji Akcje.
- [ ] Panel prawy używa wzorcowego komponentu.
- [ ] Dodano Źródła i założenia.
- [ ] „Historia / AI” zmieniono na „Historia”.
- [ ] Pola mają auto-fit i ręczną wysokość.
- [ ] Przewija się tylko centralna treść.
