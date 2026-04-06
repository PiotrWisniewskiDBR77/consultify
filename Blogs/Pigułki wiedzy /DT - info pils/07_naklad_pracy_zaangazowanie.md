## Nakład pracy i zaangażowanie we wdrożenie Digital Twin

### Czynniki wpływające na czas wdrożenia

- **Złożoność zakładu**:
  - liczba linii, gniazd, produktów, wariantów technologii,
  - liczba lokalizacji (multi‑site).
- **Dostępność i jakość danych**:
  - czy dane procesowe są kompletne w ERP/MES, czy rozproszone po Excelach,
  - stopień koniecznej ręcznej rekonstrukcji procesów.
- **Zakres projektu**:
  - pojedyncza linia, cały wydział, cały zakład czy wiele zakładów,
  - liczba scenariuszy „to‑be” do analizy.
- **Współpraca zespołów**:
  - zaangażowanie lidera projektu i kluczowych działów,
  - szybkość podejmowania decyzji, dostępność osób decyzyjnych.
- **Poziom automatyzacji integracji**:
  - jednorazowy import vs stała integracja przez API/IoT.

---

### Estymacja godzin wg ról

#### Lider Projektu (po stronie klienta)

- **Zakres**:
  - koordynacja prac, komunikacja z DBR77, organizacja warsztatów i zebrań,
  - uzgadnianie zakresu, priorytetów scenariuszy, odbiór rezultatów.
- **Nakład**:
  - mały zakład/jedna linia: 40–80 godzin w całym projekcie,
  - średni zakład: 80–160 godzin,
  - duży zakład/multi‑site: 160–300+ godzin.

#### Managerowie produkcji / logistyki

- **Zakres**:
  - dostarczanie wiedzy procesowej, weryfikacja założeń modelu,
  - udział w warsztatach, walidacja wyników symulacji.
- **Nakład**:
  - mały zakres: 20–60 godzin na osobę,
  - średni: 60–120 godzin,
  - duży/multi‑site: 120–200+ godzin (kilka osób).

#### IT

- **Zakres**:
  - dostarczanie danych z ERP/MES/WMS/IoT,
  - konfiguracja integracji, bezpieczeństwo, dostęp do środowisk.
- **Nakład**:
  - przy prostym imporcie plików: 20–40 godzin,
  - przy integracji API/IoT: 60–150+ godzin (w zależności od złożoności).

#### Finanse (CFO / kontroling)

- **Zakres**:
  - definicja wymagań dot. ROI, NPV, okresu zwrotu,
  - interpretacja wyników finansowych scenariuszy.
- **Nakład**:
  - głównie w fazach definicji i finalnej oceny: 20–60 godzin.

---

### Podział na fazy projektowe

#### 1. Onboarding

- **Czas trwania**: 1–2 tygodnie kalendarzowe.
- **Aktywności**:
  - konfiguracja kont, ról, dostępów,
  - kickoff projektu, ustalenie celów i zakresu,
  - przeszkolenie podstawowe zespołu klienta.
- **Zaangażowanie**:
  - Lider Projektu: 8–16 godzin,
  - DBR77: 16–24 godziny (onboarding, szkolenia).

#### 2. Zbieranie danych

- **Czas trwania**: 2–6 tygodni (silnie zależne od jakości danych).
- **Aktywności**:
  - identyfikacja źródeł danych (ERP, MES, IoT, layouty),
  - eksport/test integracji danych,
  - uzupełnianie i czyszczenie danych.
- **Zaangażowanie**:
  - Lider Projektu: 16–40 godzin,
  - produkcja/logistyka: 20–80 godzin,
  - IT: 20–80 godzin,
  - DBR77: 40–80 godzin (wsparcie, walidacja).

#### 3. Budowa modelu

- **Czas trwania**: 3–8 tygodni.
- **Aktywności**:
  - modelowanie layoutu,
  - odwzorowanie procesów, zasobów, logik sterowania,
  - wstępne uruchomienia modelu.
- **Zaangażowanie**:
  - DBR77: 80–200+ godzin (w zależności od zakresu),
  - produkcja/logistyka: 20–60 godzin (konsultacje),
  - IT: 10–30 godzin (dodatkowe dane).

#### 4. Walidacja modelu

- **Czas trwania**: 2–4 tygodnie.
- **Aktywności**:
  - porównanie wyników z danymi historycznymi,
  - warsztaty walidacyjne z klientem,
  - korekty parametrów i logik.
- **Zaangażowanie**:
  - produkcja/logistyka: 20–60 godzin,
  - DBR77: 40–80 godzin,
  - Lider Projektu: 10–20 godzin.

#### 5. Analiza scenariuszy

- **Czas trwania**: 3–8 tygodni (zależnie od liczby scenariuszy).
- **Aktywności**:
  - definiowanie scenariuszy „to‑be”,
  - uruchamianie symulacji i interpretacja wyników,
  - przygotowanie rekomendacji.
- **Zaangażowanie**:
  - DBR77: 60–160 godzin,
  - produkcja/logistyka: 20–60 godzin,
  - finanse: 10–40 godzin,
  - zarząd (warsztaty decyzyjne): 10–20 godzin.

#### 6. Decyzje inwestycyjne

- **Czas trwania**: 2–6 tygodni (cykle komitetów inwestycyjnych).
- **Aktywności**:
  - prezentacje wyników i rekomendacji,
  - dyskusje w gronie zarządu i kluczowych interesariuszy,
  - doprecyzowanie zakresu inwestycji i harmonogramu.
- **Zaangażowanie**:
  - CFO, COO, CEO: 10–30 godzin,
  - DBR77: 10–30 godzin (wsparcie merytoryczne),
  - Lider Projektu: 10–20 godzin.

---

### Uwagi z dt-website

- **Proces jest powtarzalny** – od opisu obiektu do symulacji scenariuszy, także przy niskiej dojrzałości danych.
- **Skalowanie** – w miarę podłączania kolejnych źródeł (manual → historical → live) wartość rośnie.
- **Brak big-bang** – value można dostarczać stopniowo, bez konieczności pełnej integracji IoT na starcie.

