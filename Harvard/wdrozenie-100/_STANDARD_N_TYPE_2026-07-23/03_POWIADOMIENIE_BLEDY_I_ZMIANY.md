# Powiadomienie — lista błędów i wymaganych zmian

**Artefakt:** Powiadomienie  
**Status audytu:** największa niespójność względem standardu n-Type

---

## 1. Co jest poprawne i powinno zostać

- Prosta lista kart: Co się dzieje, Oczekiwana akcja.
- Przycisk „Analizuj z AI” znajduje się w dobrym obszarze drugiego menu.
- Kształt przycisków w drugim menu jest dobrą bazą.
- Treść centralna jest czytelnie podzielona na sekcje.

---

# 2. Błędy w menu pierwszego poziomu

## 2.1. Zbyt wiele akcji w nagłówku

W nagłówku znajdują się równocześnie:

- Przeczytane,
- Odłóż,
- Usuń.

To jest złożona lista działań, a nie jedna rekomendowana akcja.

**Zmiana:**

- przenieść Przeczytane i Odłóż do sekcji Akcje w prawym panelu,
- „Usuń” przenieść pod trzy kropki jako działanie administracyjne/destrukcyjne,
- nie zostawiać kilku równorzędnych przycisków w nagłówku.

## 2.2. Przełącznik widoku

**Zmiana:**

- usunąć dodatkowe ikony widoku.

## 2.3. AI w nagłówku

Przycisk AI ma otwierać rozmowę w kontekście całego powiadomienia i nie zastępować prawego panelu.

---

# 3. Błędy w menu drugiego poziomu

## 3.1. Niewłaściwe położenie „Sekcje”

„Sekcje” znajduje się po prawej stronie.

**Zmiana:**

- przenieść „Sekcje” na lewą stronę paska, dokładnie nad lewą listę kart.

## 3.2. „Nowa karta”

**Zmiana:**

- usunąć przycisk,
- karty są predefiniowane i zarządzane przez Sekcje.

## 3.3. Brak Edycja | Podgląd

**Zmiana:**

- dodać przełącznik dokładnie na środku całego paska.

## 3.4. Analizuj z AI

Pozycja skrajnie po prawej jest właściwa.

**Zmiana:**

- nadać fioletowy styl AI,
- analiza ma oceniać treść aktywnej karty względem jej celu,
- wynik ma pokazywać braki, ryzyka i proponowane poprawki.

---

# 4. Centralny obszar

## 4.1. Brak standardowych pól edycyjnych

Obecna treść wygląda bardziej jak statyczny opis niż pola zgodne ze standardem n-Type.

**Zmiana:**

- każde pole opisowe powinno mieć:
  - nazwę,
  - AI w prawym górnym rogu,
  - tryb edycji,
  - auto-fit,
  - uchwyt zmiany wysokości.
- w Podglądzie ukryć kontrolki edycyjne.

## 4.2. Oczekiwana akcja

Karta „Oczekiwana akcja” może zawierać specjalne komponenty, ale działania biznesowe nie powinny być rozrzucone po centralnej treści, jeśli są akcjami całego artefaktu.

---

# 5. Prawy panel — pełna przebudowa

Obecny panel:

- ma inny format niż pozostałe artefakty,
- nie jest jasnym, zaokrąglonym komponentem,
- zaczyna się od Właściwości,
- nie zawiera sekcji Akcje,
- ma inny styl tabeli,
- zawiera tylko Właściwości i Historię,
- wygląda jak techniczny sidebar przyklejony do krawędzi.

**Zmiana:**

Zastąpić cały panel wspólnym komponentem n-Type.

Docelowe sekcje:

1. Akcje
2. Właściwości
3. Powiązania
4. Źródła i założenia
5. Rezultaty — jeżeli dostępne
6. Komentarze
7. Historia

## 5.1. Akcje

W panelu umieścić:

- Oznacz jako przeczytane,
- Odłóż,
- inne działania biznesowe.

„Usuń” pozostaje pod trzema kropkami.

## 5.2. Właściwości

Ujednolicić tabelę i kolejność pól. Typowe pola:

- Status,
- Priorytet / Waga,
- Źródło,
- Typ powiadomienia,
- Termin lub data,
- Właściciel, jeżeli występuje.

## 5.3. Historia

Ostatnia sekcja nazywa się „Historia”. Logi AI są typem wpisu, nie częścią nazwy sekcji.

---

# 6. Przewijanie

- przewija się centralna treść,
- lewy panel pozostaje nieruchomy,
- prawy panel pozostaje nieruchomy,
- menu pozostają widoczne.

---

# 7. Kryteria akceptacji dla Powiadomienia

- [ ] W nagłówku nie ma kilku przycisków akcji.
- [ ] Przeczytane i Odłóż są w Akcjach prawego panelu.
- [ ] Usuń jest pod trzema kropkami.
- [ ] Usunięto przełącznik widoku.
- [ ] Sekcje znajduje się po lewej stronie drugiego menu.
- [ ] Usunięto „Nowa karta”.
- [ ] Edycja | Podgląd jest dokładnie na środku.
- [ ] Analizuj z AI jest skrajnie po prawej i ma fioletowy styl.
- [ ] Centralne pola mają AI, auto-fit i resize.
- [ ] Prawy panel został zastąpiony wspólnym komponentem.
- [ ] Panel ma wszystkie właściwe sekcje w stałej kolejności.
- [ ] Ostatnia sekcja nazywa się Historia.
