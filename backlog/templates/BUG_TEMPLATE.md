# 🐛 Szablon Rejestru Błędu

**ID:** BUG-[DATA]-[NR] (np. BUG-20260105-001)
**Data rejestracji:** <!-- DATA_REJESTRACJI -->
**Rejestrujący:** <!-- IMIE_NAZWISKO -->

---

## 🚨 Podstawowe Informacje

### Tytuł Błędu
[Krótki, opisowy tytuł błędu]

### Kategoria
- [ ] 🎨 UI/UX & Frontend (wyświetlanie, interakcja)
- [ ] ⚙️ Backend & API (logika, przetwarzanie)
- [ ] 🗄️ Baza Danych (dane, zapytania)
- [ ] 🤖 AI & Analityka (algorytmy, obliczenia)
- [ ] 🔧 DevOps & Narzędzia (wdrożenie, infrastruktura)
- [ ] 📱 Integracje (zewnętrzne API, synchro)
- [ ] 🧪 Testing & QA (testy, automatyzacja)

### Priorytet Techniczny
- [ ] 🔥 **P0 - Krytyczny** (system niedostępny, utrata danych)
- [ ] ⚡ **P1 - Wysoki** (blokuje funkcjonalność)
- [ ] 📈 **P2 - Średni** (utrudnia pracę, obejścia dostępne)
- [ ] 📝 **P3 - Niski** (drobne niedogodności)

### Severity Level
- [ ] **S1 - Critical** (całkowita utrata funkcjonalności)
- [ ] **S2 - Major** (znaczące ograniczenie funkcjonalności)
- [ ] **S3 - Minor** (drobne błędy, obejścia dostępne)
- [ ] **S4 - Trivial** (kosmetyczne błędy)

---

## 🔍 Opis Błędu

### Steps to Reproduce
1. **Krok 1:** [Dokładny opis działania]
2. **Krok 2:** [Dokładny opis działania]
3. **Krok 3:** [Dokładny opis działania]
4. **Oczekiwany rezultat:** [Co powinno się stać]
5. **Aktualny rezultat:** [Co się dzieje zamiast tego]

### Environment
- **Browser:** [Chrome/Firefox/Safari/Edge] v[X.X.X]
- **OS:** [Windows/Mac/Linux] v[X.X.X]
- **Device:** [Desktop/Mobile/Tablet]
- **Screen Resolution:** [1920x1080, etc.]
- **User Role:** [Admin/User/Guest]
- **Environment:** [Production/Staging/Development]

### Frequency
- [ ] Always (zawsze się reprodukuje)
- [ ] Often (częściej niż w 50% przypadków)
- [ ] Sometimes (okazjonalnie)
- [ ] Rarely (rzadko, trudno zreprodukować)
- [ ] Once (pojawił się jednorazowo)

---

## 📊 Wpływ Biznesowy

### Zakres Oddziaływania
- **Liczba użytkowników:** [Ile osób dotyczy problem]
- **Częstotliwość występowania:** [Jak często występuje]
- **Business Impact:** [Wpływ na biznes - przychody, reputacja, etc.]

### Workarounds
- **Dostępne obejścia:** [Jak użytkownicy mogą ominąć problem]
- **Efektywność obejścia:** [Na ile rozwiązuje problem]

---

## 🔧 Analiza Techniczna

### Root Cause Analysis
[Opis prawdopodobnej przyczyny błędu - jeśli znana]

### Stack Trace / Error Logs
```
[Tutaj wklej stack trace lub logi błędów]
```

### Affected Components
- **Frontend:** [Które komponenty są affected]
- **Backend:** [Które API/endpoints]
- **Database:** [Które tabele/zapytania]
- **External Services:** [Które integracje]

### Related Code
- **File:** `path/to/file.js:123`
- **Function:** `functionName()`
- **Commit:** [Link do commit jeśli znany]

---

## ✅ Kryteria Naprawy

### Expected Behavior
[Dokładny opis jak powinno działać po naprawie]

### Test Cases for Fix
- [ ] Test case 1: [Opis testu weryfikującego naprawę]
- [ ] Test case 2: [Opis testu weryfikującego naprawę]
- [ ] Test case 3: [Opis testu weryfikującego naprawę]

### Regression Tests
- [ ] Test 1: [Zapewnienie, że nie zepsuliśmy innych funkcjonalności]
- [ ] Test 2: [Dodatkowe testy regresji]

---

## 📈 Oszacowanie Naprawy

### Złożoność
- [ ] **XS** - < 4h (drobna zmiana, oczywista przyczyna)
- [ ] **S** - 4-8h (jedna funkcja, znane rozwiązanie)
- [ ] **M** - 1-3 dni (kilka plików, wymaga analizy)
- [ ] **L** - 3-5 dni (wiele komponentów, złożona logika)
- [ ] **XL** - 1+ tygodnie (architectural changes, research)

### Szacowany Czas
- **Analysis:** [h] godzin
- **Fix Implementation:** [h] godzin
- **Testing:** [h] godzin
- **Code Review:** [h] godzin
- **Łącznie:** [h] godzin

---

## 🎯 Plan Rozwiązania

### Proposed Solution
[Opis proponowanego rozwiązania]

### Alternative Solutions
1. **Opcja 1:** [Opis] - **Zalety:** [...] - **Wady:** [...]
2. **Opcja 2:** [Opis] - **Zalety:** [...] - **Wady:** [...]

### Implementation Plan
1. **Krok 1:** [Co zrobić najpierw]
2. **Krok 2:** [Następny krok]
3. **Krok 3:** [Finalny krok]

---

## 📋 Checklist Wdrożenia

### Przed Naprawą
- [ ] Root cause potwierdzony
- [ ] Impact analysis wykonany
- [ ] Solution approved przez technical lead
- [ ] Test cases przygotowane

### Podczas Naprawy
- [ ] Code changes zaimplementowane
- [ ] Unit tests dodane/zaktualizowane
- [ ] Manual testing zakończone
- [ ] Code review przeprowadzony

### Po Wdrożeniu
- [ ] Production deployment
- [ ] Monitoring - brak nowych błędów
- [ ] User communication (jeśli potrzebne)
- [ ] Documentation updated

---

## 📎 Załączniki

- **Screenshots:** [Linki do zrzutów ekranu]
- **Videos:** [Linki do nagrań wideo]
- **Logs:** [Linki do pełnych logów]
- **Test Data:** [Linki do danych testowych]

---

## 🔗 Powiązane

- **Related Issues:** [Linki do podobnych błędów]
- **Duplicates:** [Linki do duplikatów jeśli istnieją]
- **Caused By:** [Link do zadania które mogło spowodować błąd]
- **Blocks:** [Linki do zadań które blokuje ten błąd]

---

## 🏆 Compliance z Meta-PMO Framework

### ISO 21500 Mapping
- **Process Group:** Controlling (Quality Control)
- **Subject Group:** Process Quality Management

### PMBOK 7 Mapping
- **Performance Domain:** Quality Management
- **Value Delivery:** Risk Mitigation through Quality Assurance

### PRINCE2 Mapping
- **Theme:** Quality Management
- **Process:** Controlling a Stage (Quality Control)

---

*Szablon zgodny z Meta-PMO Framework - Consultify Professional Services*



