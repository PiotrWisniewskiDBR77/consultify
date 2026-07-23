# Narzędzie — lista błędów i wymaganych zmian

**Artefakt:** Narzędzie  
**Status audytu:** poprawna treść, niespójny szkielet systemowy

---

## 1. Co jest poprawne i powinno zostać

- Czytelna nazwa, status i główna akcja „Startuj sesję”.
- „Startuj sesję” może pozostać w nagłówku jako jedna oczywista akcja.
- Przycisk How to / Baza wiedzy jest dobrym wzorem wizualnym dla pomocy kontekstowej.
- Lewa lista kart Cel / Proces / Rezultat jest prosta i czytelna.
- Centralna treść dobrze opisuje zastosowanie narzędzia.
- Ogólny podział na trzy kolumny jest właściwy.

---

# 2. Błędy w menu pierwszego poziomu

## 2.1. Przełącznik widoku

**Zmiana:**

- usunąć ikony alternatywnego widoku.

## 2.2. Główna akcja

„Startuj sesję” pozostaje w nagłówku, jeżeli:

- jest jedną rekomendowaną akcją,
- nie jest powielona w panelu,
- jej dostępność zależy od stanu narzędzia.

## 2.3. AI

Przycisk AI otwiera rozmowę w kontekście całego narzędzia i jego aktualnej karty.

---

# 3. Błędy w menu drugiego poziomu

Obecne przyciski znajdują się po prawej stronie.

## 3.1. Sekcje

**Zmiana:**

- przenieść „Sekcje” na lewą stronę, nad listę kart.

## 3.2. Nowa karta

**Zmiana:**

- usunąć przycisk „Nowa karta”.

## 3.3. Edycja | Podgląd

**Zmiana:**

- dodać przełącznik dokładnie na środku całego paska.

## 3.4. How to / Baza wiedzy

Przycisk pozostaje po prawej jako element pomocy kontekstowej.

Należy ujednolicić:

- wysokość,
- obramowanie,
- ikonę,
- odstępy,
- zachowanie po kliknięciu.

## 3.5. Analizuj z AI

**Zmiana:**

- dodać fioletowy przycisk skrajnie po prawej, za How to / Baza wiedzy.

---

# 4. Lewy panel

Panel jest poprawny funkcjonalnie.

Należy zapewnić:

- standardowy styl aktywnej karty,
- nieruchomą pozycję,
- zgodność listy z menu Sekcje,
- brak tworzenia nowych kart.

---

# 5. Centralny obszar

Obecne sekcje są wizualnie bardziej statycznymi kartami niż standardowymi polami n-Type.

**Zmiana:**

Każdy opisowy blok, na przykład:

- opis narzędzia,
- Najlepiej sprawdza się,
- Nie służy do,
- wejścia,
- kroki procesu,
- rezultat,

powinien w trybie Edycja mieć:

- przycisk AI,
- bezpośrednią edycję,
- auto-fit,
- uchwyt zmiany wysokości.

W trybie Podgląd kontrolki są ukryte.

## 5.1. Analizuj z AI

Dla Narzędzia funkcja powinna oceniać:

- zgodność treści z celem narzędzia,
- kompletność wejść,
- klarowność procesu,
- jakość oczekiwanego rezultatu,
- ograniczenia i warunki niewłaściwego użycia,
- gotowość do rozpoczęcia sesji.

---

# 6. Prawy panel — przebudowa

Obecny panel:

- ma płaski format,
- nie jest osobnym zaokrąglonym komponentem,
- zawiera głównie Właściwości i Powiązania,
- nie ma pełnej architektury systemowej.

**Zmiana:**

Zastosować wspólny panel n-Type z sekcjami:

1. Akcje
2. Właściwości
3. Powiązania
4. Źródła i założenia
5. Rezultaty — jeżeli dostępne
6. Komentarze
7. Historia

## 6.1. Akcje

Jeżeli „Startuj sesję” pozostaje w nagłówku, panel nie może go dublować.

W Akcjach mogą znaleźć się:

- aktywuj / dezaktywuj,
- przypisz właściciela,
- forkowanie,
- działania administracyjne związane z użyciem narzędzia.

## 6.2. Rezultaty

Jeżeli Narzędzie pozwala:

- utworzyć raport,
- przygotować prezentację,
- wyeksportować wynik sesji,
- wysłać rezultat,

przyciski trafiają do Rezultatów.

## 6.3. Historia

Dodać pełną Historię jako ostatnią sekcję. Nie używać nazwy Historia/AI.

---

# 7. Kryteria akceptacji dla Narzędzia

- [ ] Usunięto przełącznik widoku.
- [ ] Sekcje przeniesiono na lewą stronę drugiego menu.
- [ ] Usunięto Nowa karta.
- [ ] Edycja | Podgląd jest dokładnie na środku.
- [ ] How to / Baza wiedzy pozostało po prawej.
- [ ] Dodano fioletowy Analizuj z AI skrajnie po prawej.
- [ ] Centralne pola mają AI, auto-fit i resize.
- [ ] Prawy panel używa wzorcowego zaokrąglonego komponentu.
- [ ] Panel zawiera pełną, stałą architekturę.
- [ ] Dodano Historię jako ostatnią sekcję.
- [ ] Przewija się tylko centralna treść.
