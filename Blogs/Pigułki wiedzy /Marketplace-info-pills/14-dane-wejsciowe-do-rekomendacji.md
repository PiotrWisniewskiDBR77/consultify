# 14: Dane Wejściowe do Rekomendacji (Input Questions) — DBR77 Marketplace

Pytania, które AI Sprzedawca powinien zadać klientowi, aby zaproponować odpowiedni pakiet / sposób korzystania z DBR77 Marketplace. Podział: Dane o firmie, Cele biznesowe, Wyzwania techniczne.

---

## 1. Dane o firmie

### Podstawowe

1. **Jaka jest nazwa firmy i branża?**
   - Cel: Weryfikacja fit (np. automotive, FMCG, metalurgia).

2. **Gdzie znajduje się siedziba / zakład produkcyjny?**
   - Cel: Dopasowanie integratorów, wymagania data residency.

3. **Ilu pracowników zatrudnia firma (łącznie / w produkcji)?**
   - Cel: Szacunek skali, typowy budżet na automatyzację.

4. **Czy firma jest częścią większej grupy / holdingu?**
   - Cel: Wielozakładowe wdrożenia, centralne zakupy.

5. **Czy firma ma już doświadczenie z robotyzacją / automatyzacją?**
   - Cel: Poziom dojrzałości, oczekiwania względem platformy.

6. **Jaki jest przybliżony roczny obrót / przychód firmy?**
   - Cel: Szacunek budżetu, wykluczenie zbyt małej skali.

7. **Czy firma ma dział IT / procurement?**
   - Cel: Proces decyzyjny, kto będzie użytkownikem platformy.

8. **Czy firma działa w regulowanym sektorze (np. automotive, farmacja, lotnictwo)?**
   - Cel: Wymagania compliance, NDA, audyt.

### Kontakt i decyzje

9. **Jaka jest Pana/Pani rola w firmie?**
   - Cel: Dopasowanie persony, języka, argumentów.

10. **Kto poza Panem/Panią będzie zaangażowany w decyzję (CFO, COO, IT, procurement)?**
    - Cel: Wieloosobowa sprzedaż, materiał dla każdej persony.

11. **Jaki jest typowy horyzont decyzyjny (np. kwartał, rok)?**
    - Cel: Timeline wdrożenia, pilność.

12. **Czy firma korzysta z Google / LinkedIn do logowania (OAuth)?**
    - Cel: Możliwość rejestracji bez własnych haseł.

---

## 2. Cele biznesowe

### Strategia

13. **Jaki jest główny cel automatyzacji? (np. redukcja kosztów, brak kadr, jakość, elastyczność)**
    - Cel: Priorytet, język korzyści.

14. **Czy firma ma mapę drogową cyfryzacji / automatyzacji?**
    - Cel: Jednorazowy projekt vs. wieloletni plan.

15. **Jaki jest planowany budżet na najbliższy projekt automatyzacji (przedział)?**
    - Cel: Kwalifikacja leada, fit/non-fit.

16. **Jaki jest docelowy timeline wdrożenia (np. 6 miesięcy, 12 miesięcy)?**
    - Cel: Dopasowanie integratorów, realność oczekiwań.

17. **Czy firma szuka oszczędności kosztów, czy głównie jakości / elastyczności?**
    - Cel: Argumentacja (ROI vs. jakość, zdolność reagowania).

### Proces zakupowy

18. **Jak obecnie firma znajduje integratorów? (targi, znane kontakty, rekomendacje, brokerzy)**
    - Cel: Porównanie z wartością DBR77.

19. **Ile czasu średnio zajmuje znalezienie i wybór integratora?**
    - Cel: Pokazanie przyspieszenia (z miesięcy do tygodni).

20. **Czy firma zwykle pracuje z jednym integratorami, czy porównuje wiele ofert?**
    - Cel: Wartość standaryzacji i AI Matching.

21. **Czy firma ma ulubionych / preferowanych integratorów?**
    - Cel: Możliwość zaproszenia ich na platformę; brak wymogu porzucenia relacji.

22. **Jakie są typowe obawy przy wyborze integratora (cena, jakość, termin, IP)?**
    - Cel: Dopasowanie odpowiedzi (NDA, milestones, ratings).

---

## 3. Wyzwania techniczne

### Zakres projektu

23. **Jaki typ automatyzacji jest priorytetowy?**
    - Opcje: Pick-and-Place, Assembly, Welding, Quality Control, Painting, Transport, Gluing, MES, ERP, inne.
    - Cel: Application Type, AI Matching.

24. **Czy projekt obejmuje tylko hardware (roboty), czy też software (MES, ERP)?**
    - Cel: Software Integration vs. Technological Challenge.

25. **Czy wymagania są już opisane (RFQ, brief, specyfikacja)?**
    - Cel: Gotowość do Challenge — „tak” = szybszy start.

26. **Czy są szczegółowe wymagania techniczne (OEE, cycle time, payload, safety)?**
    - Cel: Złożoność Challenge, dopasowanie integratorów.

### Środowisko

27. **Czy w strefie pracy będą ludzie (coboty, współdzielone strefy)?**
    - Cel: Wymagania bezpieczeństwa, typ integratora.

28. **Czy istnieje infrastruktura IT (MES, ERP, IoT), z którą trzeba zintegrować rozwiązanie?**
    - Cel: Software Integration, wymagania w Challenge.

29. **Czy są ograniczenia przestrzenne (wysokość, szerokość, dostęp)?**
    - Cel: Konkretne constrainty w Challenge.

30. **Czy są wymagania compliance (np. IATF, ISO, FDA)?**
    - Cel: Informacje w Challenge, dobór integratorów.

### IP i dane

31. **Czy dane procesowe / specyfikacje są poufne (wymagane NDA)?**
    - Cel: Konfiguracja NDA przy Challenge.

32. **Czy firma ma obawy dotyczące udostępniania danych na platformie?**
    - Cel: Wyjaśnienie NDA, ISO 27001, własności danych.

33. **Czy wymagana jest realizacja w konkretnym kraju / regionie?**
    - Cel: Delivery countries w Challenge, dobór integratorów.

---

## Matryca dopasowania (uproszczona)

| Odpowiedź | Rekomendacja |
|-----------|--------------|
| Branża: automotive, metalurgia, FMCG, elektro | Fit |
| Branża: handel, usługi B2C | Non-fit (brak produkcji) |
| Budżet &lt; 20–30k EUR | Prawdopodobnie non-fit |
| Budżet 50k+ EUR | Fit |
| Brak gotowości na udostępnienie danych pod NDA | Wyjaśnić NDA, ewentualnie non-fit |
| Ma już RFQ / specyfikację | Szybki start — zachęcić do publikacji Challenge |
| Brak RFQ | Zachęcić do kreatora + AI |
| Wiele osób w procesie decyzyjnym | Przygotować materiały dla CEO, CFO, COO, IT, procurement |
| Rola: IT Manager | Skupić się na bezpieczeństwie, zero wdrożenia |
| Rola: CFO | Skupić się na kosztach (0 dla producenta), ROI |

---

## Kolejność pytań w rozmowie

1. **Krótkie** (rola, firma, branża) — 2–3 min
2. **Cele** (cel automatyzacji, budżet, timeline) — 3–5 min
3. **Techniczne** (typ projektu, compliance, NDA) — 3–5 min
4. **CTA** — demo lub rejestracja

Łączny czas: ok. 10–15 min na kwalifikację i propozycję następnego kroku.
