# DBR77 IIoT — Funkcjonalność i User Journey

## 1. Przegląd platformy

DBR77 IIoT to kompletny ekosystem przemysłowego Internetu Rzeczy: od urządzeń na hali (Status Deck, Data Hub, czujniki, połączenia PLC), przez przetwarzanie i walidację sygnałów na edge, aż po panel IIoT, aplikacje mobilne i tablet oraz integrację z platformą IRIS. System jest zaprojektowany jako **The Loop**: źródła danych → edge i komunikacja → panel IIoT → akcja na hali (mobile/tablet) → optymalizacja.

## 2. Proces od pierwszego kontaktu do pełnego wdrożenia

### 2.1 Ścieżka wejścia: Demo vs. Pilotaż

| Ścieżka | Opis | Dla kogo |
|---------|------|----------|
| **Demo online** | Dostęp do środowiska przykładowego bez sprzętu. Dashboardy, alerty, zadania, widoki operatora. | Osoby chcące szybko zobaczyć możliwości |
| **Pilotaż** | Zestaw na 1–3 stanowiskach lub jednej linii. Status Deck i/lub Data Hub (opcjonalnie Vision). Raport z wnioskami i rekomendacją skalowania. | Decydenci gotowi do realnego testu |

### 2.2 User Journey — Pilotaż

1. **Discovery (30–60 min)** — Cele, KPI, wybór linii/stanowisk, dostępne źródła danych (PLC, Modbus, IO, deklaracje, wizja).
2. **Dobór zestawu** — Deck / Hub / integracja sygnałów + opcjonalnie Vision AI.
3. **Instalacja i konfiguracja** — Montaż sprzętu, mapowanie danych, alerty, role użytkowników.
4. **Okres pomiaru** — Zbieranie danych w realnej pracy + korekty (żeby nie było luk).
5. **Raport końcowy** — Wnioski, straty, przyczyny przestojów, rekomendacja skalowania.

### 2.3 User Journey — Codzienne użytkowanie

1. **Logowanie** — Panel IIoT (web) lub aplikacje Mobile/Tablet.
2. **Dashboard główny** — Statusy maszyn, OEE, alerty aktywne, trendy.
3. **Zadania i checklisty** — Operator widzi plan dnia, potwierdza alerty, wykonuje zadania.
4. **Raportowanie** — Raporty OEE, przestojów, mediów; eksport do PDF/Excel.
5. **Zarządzanie urządzeniami** — Konfiguracja czujników, zdalna obsługa, aktualizacje firmware.

## 3. Moduły i funkcje

### 3.1 Hardware (urządzenia na hali)

- **Status Deck** — Deklaracja stanu maszyny (Praca / Przerwa / Przezbrojenie / Awaria). ~2 s do prawdy o przestojach. Idealne dla legacy.
- **Data Hub / Master** — Bramka na szynę DIN. Zbieranie sygnałów, multi-protokół (MQTT, Modbus, RS485), łączność (LoRaWAN, Wi‑Fi, SIM).
- **Vision AI (Edge)** — BHP (PPE), QA (defekty), obecność, anomalie. Przetwarzanie lokalne.
- **Czujniki** — Własne i z ekosystemu partnerów (energia, temperatura, wibracje, media).

### 3.2 Panel IIoT (web)

- Dashboardy OEE, statusów maszyn, mediów, workforce.
- Konfiguracja alertów i eskalacji.
- Mapowanie źródeł danych i walidacja sygnałów.
- Zarządzanie urządzeniami.
- Raporty i eksport danych.

### 3.3 Aplikacje Mobile & Tablet

- Zadania i plan dnia.
- Powiadomienia i potwierdzanie alertów.
- Szybkie decyzje na zmianie.
- Checklisty i zbieranie deklaracji.

### 3.4 Walidacja sygnałów na edge (kluczowa funkcja)

System analizuje sygnały i wnioskuje o poprawności danych **przed** wysłaniem dalej. Walidacja obejmuje m.in.:

- Spójność formatu (np. timestamp ISO 8601).
- Sprawdzenie zakresów (np. temperatura 0–100°C).
- Kompletność pól.
- Spójność typów danych.

Złe dane są zatrzymywane na edge; tylko zwalidowane trafiają do chmury.

## 4. Możliwe zastosowania (use cases)

| Obszar | Opis |
|--------|------|
| **OEE i produkcja** | Statusy, cykle, straty, przyczyny przestojów w czasie zbliżonym do rzeczywistego |
| **Media** | Energia, woda, gaz, powietrze — monitorowanie i koszty |
| **Workforce** | Produktywność operatorów, powiązanie zadań z osobami |
| **QA/BHP** | Vision AI: PPE, defekty, anomalie procesowe |
| **Retrofit** | Starsze maszyny bez PLC/OPC-UA — Status Deck + Data Hub |

## 5. Generowanie raportów

- Raporty OEE (dzienne, tygodniowe, miesięczne).
- Analiza przyczyn przestojów (Pareto).
- Raporty mediów (koszt, zużycie).
- Raport pilotażowy — wnioski, straty, rekomendacje skalowania.
- Eksport do PDF, Excel, CSV; dostęp do API (planowane).

## 6. Przyspieszanie decyzji

- Alerty w czasie rzeczywistym (przekroczenia progów, anomalie).
- Eskalacje do wskazanych ról.
- Zadania generowane przez system lub AI (w planach).
- Mobilne powiadomienia dla operatorów.
