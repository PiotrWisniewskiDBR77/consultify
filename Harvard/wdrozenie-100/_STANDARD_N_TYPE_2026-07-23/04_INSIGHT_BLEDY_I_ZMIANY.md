# Insight — lista błędów i wymaganych zmian

**Artefakt:** Insight  
**Status audytu:** dobry szkielet, niespójne menu drugiego poziomu

---

## 1. Co jest poprawne i powinno zostać

- Czytelna struktura: lewy panel, centralna treść, jasny panel prawy.
- Rozbudowana lista kart może pozostać specyficzna dla Insightu.
- „Konwertuj na inicjatywę” może pozostać w nagłówku, jeżeli jest jedyną rekomendowaną akcją.
- Prawy panel jest wizualnie bliski wzorcowi.
- Sekcja „Źródła i założenia” już występuje.
- Centralne komponenty działań downstream mogą pozostać specyficzne dla Insightu.

---

# 2. Błędy w menu pierwszego poziomu

## 2.1. Przełącznik widoku

**Zmiana:**

- usunąć dodatkowe ikony układu pomiędzy AI i główną akcją.

## 2.2. Konwertuj na inicjatywę

Przycisk może pozostać w nagłówku, jeżeli:

- jest jedną oczywistą akcją,
- nie występuje równocześnie w panelu Akcje lub Rezultaty,
- jest dostępny tylko w odpowiednim stanie.

## 2.3. AI w nagłówku

Ma otwierać panel rozmowy z kontekstem całego Insightu, bez zastępowania prawego panelu.

---

# 3. Błędy w menu drugiego poziomu

Obecne elementy:

- Sekcje,
- Eksportuj,
- Dalsze,
- nazwa aktywnej karty,
- Edycja / Podgląd.

Układ jest niezgodny ze standardem.

## 3.1. Lewa strona

**Zmiana:**

- pozostawić tylko „Sekcje”,
- usunąć z paska „Eksportuj” i „Dalsze”,
- nie wyświetlać nazwy aktywnej karty jako dodatkowego elementu paska.

„Eksportuj” powinno trafić:

- do Rezultatów, jeśli tworzy gotowy efekt,
- albo pod trzy kropki, jeśli jest technicznym eksportem danych.

„Dalsze” powinno zostać rozbite na konkretne działania i umieszczone w Akcjach lub Rezultatach.

## 3.2. Środek

**Zmiana:**

- umieścić Edycja | Podgląd dokładnie na środku całego paska.

## 3.3. Prawa strona

**Zmiana:**

- opcjonalnie How to / Baza wiedzy,
- dodać fioletowy „Analizuj z AI” skrajnie po prawej.

---

# 4. Lewy panel

Panel może pozostać rozbudowany i pogrupowany.

Wymagane:

- wszystkie widoczne pozycje pochodzą z zamkniętego katalogu kart,
- Sekcje steruje widocznością i kolejnością,
- aktywna karta ma wspólny styl,
- panel nie przewija się razem z centralną treścią.

---

# 5. Centralny obszar

## 5.1. Komponenty downstream

Karty „Rozpocznij decyzję” i „Rozpocznij inicjatywę” mogą pozostać jako specjalne komponenty.

Należy jednak rozstrzygnąć ich klasyfikację:

- tworzenie kolejnego artefaktu jest **Rezultatem**, nie zwykłą akcją techniczną,
- jeżeli przyciski pozostają w centralnej karcie, nie powinny być powielone w prawym panelu.

## 5.2. Pola tekstowe w pozostałych kartach Insightu

Wszystkie opisowe pola muszą mieć:

- AI,
- auto-fit,
- ręczny resize,
- tryb Edycja/Podgląd.

## 5.3. Analizuj z AI

Dla Insightu analiza powinna oceniać:

- jasność tezy,
- jakość dowodów,
- poziom pewności,
- brakujące źródła,
- sprzeczności,
- potencjalny wpływ,
- gotowość do konwersji na decyzję lub inicjatywę.

---

# 6. Prawy panel

## 6.1. Wygląd

Panel jest dobrym punktem wyjścia, ale musi używać identycznego komponentu jak Inicjatywa.

## 6.2. Docelowa kolejność

1. Akcje
2. Właściwości
3. Powiązania
4. Źródła i założenia
5. Rezultaty
6. Komentarze
7. Historia

**Zmiany:**

- dodać lub uporządkować Rezultaty,
- przenieść Eksportuj i Dalsze do właściwych sekcji,
- zmienić „Historia / AI” na „Historia”.

## 6.3. Akcje i Rezultaty

Przykładowy podział:

**Akcje:**

- zmiana statusu,
- przypisanie,
- recenzja,
- forkowanie.

**Rezultaty:**

- Konwertuj na inicjatywę — jeśli nie pozostaje w nagłówku,
- Rozpocznij decyzję,
- Utwórz raport,
- Utwórz prezentację,
- Eksportuj gotowy wynik.

---

# 7. Kryteria akceptacji dla Insightu

- [ ] Usunięto przełącznik widoku.
- [ ] W drugim menu po lewej znajduje się tylko Sekcje.
- [ ] Eksportuj i Dalsze zostały przeniesione do właściwych sekcji.
- [ ] Edycja | Podgląd jest dokładnie na środku.
- [ ] Dodano fioletowy Analizuj z AI.
- [ ] Nie ma zduplikowanej nazwy aktywnej karty w menu.
- [ ] Prawy panel używa wzorcowego komponentu.
- [ ] Dodano lub uporządkowano sekcję Rezultaty.
- [ ] Historia/AI została zmieniona na Historia.
- [ ] Wszystkie pola tekstowe w kartach mają AI, auto-fit i resize.
- [ ] Przewija się tylko centralny obszar.
