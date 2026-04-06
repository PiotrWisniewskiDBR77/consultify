# Plik 06: Macierz Odpowiedzialności RACI

**Producent:** DBR77 Robotics Sp. z o.o.  
**Produkt:** Consultify (consultify.ai)  
**Wersja dokumentu:** 1.0 | Marzec 2026

---

## Legenda RACI

| Symbol | Rola | Opis |
|---|---|---|
| **R** | Responsible (Odpowiedzialny) | Wykonuje zadanie, dostarcza wynik |
| **A** | Accountable (Rozliczany) | Ponosi ostateczną odpowiedzialność za jakość i terminowość |
| **C** | Consulted (Konsultowany) | Dostarcza wiedzę ekspercką, opiniuje przed wykonaniem |
| **I** | Informed (Informowany) | Otrzymuje informację po zakończeniu zadania |

---

## Aktorzy w Macierzy

| Symbol | Aktor | Opis |
|---|---|---|
| **K** | Klient | Organizacja używająca Consultify (Owner, Admin, Użytkownicy) |
| **SY** | System Consultify | Platforma AI (automatyczne funkcje, agenty, generatory) |
| **KO** | Konsultant Zewnętrzny | Konsultant zaproszony do workspace klienta (rola: Consultant) |
| **DBR** | Zespół DBR77 | Producent platformy, wsparcie techniczne i Customer Success |

---

## 1. Faza Onboardingu

| Zadanie | Klient (K) | System (SY) | Konsultant (KO) | DBR77 (DBR) |
|---|---|---|---|---|
| Rejestracja organizacji i wybór planu | **A/R** | I | — | I |
| Konfiguracja regionu danych i polityki bezpieczeństwa | **A/R** | C | — | C |
| Konfiguracja SSO / integracji tożsamości | **R** | C | — | **A/C** |
| Zaproszenie użytkowników i przypisanie ról | **A/R** | I | — | I |
| Konfiguracja Brand Voice Profile (styl raportu) | **A/R** | C | C | I |
| Szkolenie wstępne użytkowników | **A/R** | C | C | **R/C** |
| Podpisanie DPA i umowy licencyjnej | **A/R** | — | — | **A/R** |
| Konfiguracja integracji API (jeśli wymagane) | **R** | C | — | **A/C** |
| Weryfikacja bezpieczeństwa środowiska (Enterprise) | C | I | — | **A/R** |

---

## 2. Faza Przygotowania Danych

| Zadanie | Klient (K) | System (SY) | Konsultant (KO) | DBR77 (DBR) |
|---|---|---|---|---|
| Identyfikacja danych do dostarczenia (procesy, KPI, finanse) | **A/R** | C | C | I |
| Zebranie dokumentacji procesowej (opisy, instrukcje, schematy) | **A/R** | — | C | I |
| Przygotowanie danych finansowych (P&L, budżety, historia) | **A/R** | C | — | I |
| Import danych finansowych (Excel/CSV/PDF) do systemu | **R** | **A/R** | C | I |
| Import wyników poprzednich assessmentów (SIRI, ADMA) | **R** | **A/R** | C | I |
| Walidacja poprawności zaimportowanych danych | **A/R** | C | C | I |
| Uzupełnienie luk w danych (brakujące KPI, procesy) | **A/R** | C | C | I |
| Anonimizacja danych wrażliwych przed importem | **A/R** | I | — | C |
| Konfiguracja struktury organizacyjnej w systemie | **R** | C | C | I |
| Mapowanie celów strategicznych w systemie | **A/R** | C | C | I |

---

## 3. Faza Przeprowadzenia Assessmentu

| Zadanie | Klient (K) | System (SY) | Konsultant (KO) | DBR77 (DBR) |
|---|---|---|---|---|
| Wybór frameworku oceny (SIRI/ADMA/DRD/Lean 4.0/CMMI) | **A/R** | C | C | I |
| Wypełnienie formularza assessmentu | **A/R** | C | C | I |
| Dostarczenie dowodów do pytań assessmentu | **A/R** | — | C | I |
| Koordynacja wypełniania przez wielu uczestników | **A/R** | C | C | I |
| Weryfikacja spójności odpowiedzi assessmentu | **A/R** | **R** (AI) | C | I |
| Generowanie raportu z assessmentu | I | **A/R** (AI) | C | I |
| Interpretacja wyników i gap analysis | **A/R** | C | **R** | I |
| Zatwierdzenie wyników assessmentu | **A** | I | R | I |
| Komunikacja wyników zarządowi | **A/R** | C | C | I |

---

## 4. Faza Planowania Inicjatyw

| Zadanie | Klient (K) | System (SY) | Konsultant (KO) | DBR77 (DBR) |
|---|---|---|---|---|
| Przegląd propozycji inicjatyw od AI | **A/R** | C | C | I |
| Decyzja o przyjęciu/odrzuceniu/modyfikacji inicjatywy | **A** | I | C | I |
| Uzupełnienie business case'u inicjatywy | **R** | **R** (AI assist) | C | I |
| Walidacja modelu finansowego (NPV/IRR) | **A/R** | C | C | I |
| Priorytetyzacja portfolio inicjatyw | **A** | C | **R** | I |
| Zatwierdzenie portfolio przez zarząd | **A** | I | C | I |
| Przypisanie właścicieli inicjatyw | **A/R** | I | C | I |
| Konfiguracja KPI dla inicjatyw | **A/R** | C | C | I |
| Generowanie roadmapy portfolio | I | **A/R** (AI) | C | I |

---

## 5. Faza Realizacji (Execution)

| Zadanie | Klient (K) | System (SY) | Konsultant (KO) | DBR77 (DBR) |
|---|---|---|---|---|
| Tworzenie i przypisywanie zadań w inicjatywie | **A/R** | C | C | I |
| Aktualizacja statusu zadań i kamieni milowych | **A/R** | I | I | I |
| Zarządzanie rejestrem ryzyk | **A/R** | C | C | I |
| Obsługa governance checkpoints (zatwierdzenie) | **A** | I | C | I |
| Monitorowanie postępu przez AI (Nudges) | I | **A/R** | I | I |
| Eskalacja opóźnień i alertów | I | **A/R** (auto) | I | I |
| Podejmowanie decyzji w module Decisions | **A** | C | C | I |
| Dokumentowanie decyzji z uzasadnieniem | **A/R** | C | C | I |
| Zamknięcie inicjatywy i raport closure | **A/R** | **R** (AI) | C | I |

---

## 6. Faza Raportowania i Prezentacji

| Zadanie | Klient (K) | System (SY) | Konsultant (KO) | DBR77 (DBR) |
|---|---|---|---|---|
| Inicjowanie generowania raportu | **A/R** | I | C | I |
| Generowanie treści raportu (Narrative Engine) | I | **A/R** (AI) | I | I |
| Przegląd i korekta wygenerowanego raportu | **A/R** | I | C | I |
| Zatwierdzenie raportu przed dystrybucją | **A** | I | C | I |
| Dystrybucja raportu do odbiorców | **A/R** | C | I | I |
| Generowanie prezentacji (Deck Builder) | **R** | **R** (AI) | C | I |
| Przygotowanie materiałów dla inwestorów | **A/R** | C | C | I |

---

## 7. Faza Śledzenia Wyników (KPI/ROI)

| Zadanie | Klient (K) | System (SY) | Konsultant (KO) | DBR77 (DBR) |
|---|---|---|---|---|
| Dostarczanie bieżących danych KPI do systemu | **A/R** | C | I | I |
| Monitorowanie odchyleń KPI od planu | I | **A/R** (AI) | I | I |
| Analiza przyczyn odchyleń | **A/R** | C | C | I |
| Decyzja o korekcie kursu inicjatywy | **A** | C | C | I |
| Generowanie raportów KPI i migawek | I | **A/R** (AI) | I | I |
| Roczny przegląd ROI z transformacji | **A/R** | C | C | I |
| Inicjowanie kolejnego cyklu assessmentu | **A/R** | C | C | I |

---

## 8. Odpowiedzialności DBR77 (Producent)

| Zadanie | Odpowiedzialność |
|---|---|
| Dostępność i stabilność platformy (SLA) | **A/R** |
| Bezpieczeństwo danych i infrastruktury | **A/R** |
| Aktualizacje i nowe funkcjonalności | **A/R** |
| Wsparcie techniczne (support tickets) | **A/R** |
| Customer Success (onboarding, szkolenia) | **A/R** |
| Utrzymanie i aktualizacja frameworków AI | **A/R** |
| Certyfikacja ISO 27001 / SOC 2 | **A/R** |
| Aktualizacja metodologii DRD i Lean 4.0 | **A/R** |

---

## 9. Kluczowe Zasady Podziału Odpowiedzialności

### Zasada 1: Dane — Klient jest zawsze Accountable

Klient ponosi pełną odpowiedzialność za **poprawność i kompletność danych** wprowadzonych do systemu. Consultify nie weryfikuje prawdziwości danych źródłowych — tylko ich format i spójność wewnętrzną.

### Zasada 2: Rekomendacje AI — wymagają zatwierdzenia Klienta

Wszelkie rekomendacje, inicjatywy i analizy generowane przez AI mają status **propozycji** do momentu zatwierdzenia przez uprawnioną osobę po stronie Klienta. System nie podejmuje autonomicznych działań bez zatwierdzenia człowieka (Human-in-the-Loop governance).

### Zasada 3: Konsultant — pracuje w imieniu Klienta

Konsultant zaproszony do workspace'u działa jako przedłużenie zespołu Klienta. Klient pozostaje Accountable za wszystkie wyniki pracy Konsultanta w systemie. DBR77 nie odpowiada za jakość pracy Konsultanta zewnętrznego.

### Zasada 4: DBR77 — odpowiada za platformę, nie za biznes Klienta

DBR77 odpowiada za działanie platformy zgodnie z SLA. DBR77 nie odpowiada za decyzje biznesowe Klienta podjęte na podstawie rekomendacji AI, ani za wyniki transformacji wynikające z realizacji (lub braku realizacji) tych rekomendacji.

---

## 10. Podsumowanie — Tabela Zbiorcza

| Obszar | Klient | System | Konsultant | DBR77 |
|---|---|---|---|---|
| Dane wejściowe — dostarczenie | **A** | R | C | I |
| Dane wejściowe — walidacja | **A** | R (auto) | C | I |
| Diagnoza / Assessment | **A** | R (AI) | R | I |
| Planowanie inicjatyw | **A** | R (AI) | R | I |
| Decyzje strategiczne | **A** | C | C | I |
| Realizacja zadań | **A** | C | C | I |
| Wyniki KPI — dostarczenie danych | **A** | C | I | I |
| Interpretacja wyników | **A** | C | R | I |
| Raporty i prezentacje | **A** | R (AI) | C | I |
| Bezpieczeństwo platformy | I | I | I | **A** |
| Dostępność systemu (SLA) | I | I | I | **A** |
