# IRIS — Macierz Odpowiedzialności (RACI)

Data: 2026-03-03  
Wersja: 1.0  
Cel: jasno rozdzielić odpowiedzialność między Klientem, systemem IRIS, konsultantami zapraszanymi przez klienta oraz zespołem DBR77.

---

## 1) Legenda RACI

- **R — Responsible**: wykonuje pracę (realizacja).
- **A — Accountable**: odpowiada za wynik (akceptuje, podejmuje decyzję).
- **C — Consulted**: konsultowany (dostarcza wiedzę, opinię).
- **I — Informed**: informowany (status, raport).

---

## 2) Role (zestaw referencyjny)

### 2.1. Po stronie Klienta

- **Sponsor Biznesowy (CEO/COO/CFO)** — właściciel programu, decyzje, budżet.
- **Lider Projektu (PM/Program Manager)** — koordynacja wdrożenia i harmonogram.
- **Właściciele Procesów (Produkcja/Logistyka/Jakość/UR/Lean/DX)** — dane, wymagania, walidacja.
- **IT Manager / Architekt IT/OT** — integracje, bezpieczeństwo, dostęp.
- **Data Steward (opcjonalnie)** — jakość danych, słowniki, master data.

### 2.2. System IRIS (platforma)

- **IRIS Platform** — automatyzacje, RBAC, audit, dashboardy, rekomendacje (zgodnie z konfiguracją).

### 2.3. Konsultanci zapraszani przez Klienta (opcjonalnie)

- **Konsultanci Klienta** — wsparcie merytoryczne, warsztaty, benchmarki, interpretacja.

### 2.4. Zespół DBR77 (dostawca IRIS)

- **Delivery Lead (DBR77)** — prowadzenie wdrożenia, metodologia, ryzyka.
- **Platform/Backend Engineer (DBR77)** — konfiguracje, API, integracje, migracje.
- **Frontend/UX (DBR77)** — adaptacje UI (jeśli w zakresie).
- **Security/Compliance (DBR77)** — polityki, hardening, audyt, DPA/SLA.
- **Data/AI (DBR77)** — modele KPI, agregacje, rekomendacje, data pipeline (jeśli w zakresie).

---

## 3) RACI — fazy wdrożenia (referencyjnie)

### 3.1. Faza A — Onboarding i uruchomienie tenanta

| Aktywność | Sponsor | Lider Projektu | Właściciele Procesów | IT Manager | Konsultanci Klienta | DBR77 | IRIS |
|---|---|---|---|---|---|---|---|
| Ustalenie celów wdrożenia i KPI sukcesu | A | R | C | C | C | C | I |
| Wybór modelu wdrożenia (SaaS/Private/On-Prem) i regionu danych | A | R | C | A/R | C | C | I |
| Utworzenie tenanta, konfiguracja podstawowa | I | C | I | C | R | A/R | R |
| Założenie użytkowników, role, RBAC (baseline) | I | A/R | C | C | I | R | R |
| Uzgodnienie polityk (retencja, SLA/DR, access) | A | R | I | A/R | I | C | I |

### 3.2. Faza B — Zbieranie danych i konfiguracja procesu

| Aktywność | Sponsor | Lider Projektu | Właściciele Procesów | IT Manager | Konsultanci Klienta | DBR77 | IRIS |
|---|---|---|---|---|---|---|---|
| Inwentaryzacja źródeł danych (IT/OT) | I | A/R | C | R | C | C | I |
| Dostarczenie master data (produkty, zasoby, lokacje, itp.) | I | A | R | C | C | C | I |
| Walidacja master data (spójność, słowniki) | I | A | R | C | C | C | I |
| Import danych (CSV/XLSX/PDF) | I | C | C | C | I | A/R | R |
| Integracje API/IoT (jeśli w zakresie) | I | A | C | A/R | C | R | R |
| Konfiguracja ustawień i workflow (SETTINGS) | I | A/R | C | C | C | R | R |

### 3.3. Faza C — Assessment i baseline rekomendacji

| Aktywność | Sponsor | Lider Projektu | Właściciele Procesów | IT Manager | Konsultanci Klienta | DBR77 | IRIS |
|---|---|---|---|---|---|---|---|
| Uzgodnienie zakresu assessmentu (SIRI/ADMA/custom) | A | R | C | C | C | C | I |
| Warsztaty i udzielanie odpowiedzi (evidence) | I | A/R | R | C | R (opc.) | C | I |
| Scoring, heatmapy i wnioski | I | I | C | I | C | R | R |
| Wstępna lista rekomendacji i inicjatyw | I | A | C | I | C | R | R |

### 3.4. Faza D — Egzekucja inicjatyw i praca operacyjna

| Aktywność | Sponsor | Lider Projektu | Właściciele Procesów | IT Manager | Konsultanci Klienta | DBR77 | IRIS |
|---|---|---|---|---|---|---|---|
| Zatwierdzenie portfela inicjatyw (priorytety/budżet) | A | R | C | C | C | C | I |
| Przypisanie ownerów i zasobów | A | R | R | C | C | C | I |
| Tworzenie i prowadzenie zadań operacyjnych (GEMBA_TASKS) | I | A | R | I | C | C | R |
| Monitoring KPI i raporty (KPI/DATA_AI) | I | A | R | C | C | C | R |
| Utrzymanie systemu (SaaS) / utrzymanie środowiska (On-Prem) | I | I | I | R (On-Prem) | I | R (SaaS/PC) | R |

### 3.5. Faza E — Bezpieczeństwo, compliance, audyt

| Aktywność | Sponsor | Lider Projektu | Właściciele Procesów | IT Manager | Konsultanci Klienta | DBR77 | IRIS |
|---|---|---|---|---|---|---|---|
| Polityka dostępu, role, przeglądy uprawnień | I | A | C | R | I | C | R |
| DPA/NDA/SLA (kontrakt) | A | R | I | C | I | C | I |
| Audyt działań i raportowanie zgodności | I | A | C | C | I | C | R |

---

## 4) Najczęstsze punkty sporne — jak je rozwiązać

- **Jakość danych**: Klient dostarcza i waliduje; DBR77 wspiera narzędziami importu i regułami; IRIS egzekwuje spójność na tyle, na ile pozwala konfiguracja.  
- **Interpretacja wyników**: IRIS generuje rekomendacje na podstawie danych; ostateczna interpretacja i decyzje należą do klienta (Sponsor/Ownerzy), ewentualnie wspierane przez konsultantów klienta i DBR77.  
- **Integracje**: IT klienta jest Accountable za dostęp do źródeł i polityki bezpieczeństwa; DBR77 za implementację po stronie IRIS (jeśli w zakresie).  

