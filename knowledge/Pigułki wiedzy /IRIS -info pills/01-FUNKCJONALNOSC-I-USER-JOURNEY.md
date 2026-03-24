# IRIS — Funkcjonalność i User Journey (End-to-End)

Data: 2026-03-03  
Wersja: 1.0  
Zakres: opis funkcjonalny i przebieg pracy użytkownika od pierwszego logowania do rekomendacji, inicjatyw i raportów.

---

## 1) Czym jest IRIS

**IRIS** to **enterprise-grade, multi-tenant SaaS Plant Operation System** zbudowany jako **modularny monolit** (jeden deploy/runtime) z **wydzielonymi modułami logicznymi** i kontraktami API (`/api/v5/<module>/...`). System łączy:

- **Operacje produkcyjne** (MES),
- **Logistykę wewnętrzną** (WMS),
- **Jakość** (QMS),
- **Utrzymanie ruchu** (CMMS),
- **Zadania operacyjne i praca “na hali”** (GEMBA Suite, w tym `GEMBA_TASKS`),
- **KPI, raportowanie i analitykę** (KPI, DATA_AI),
- **Integracje danych i sygnałów** (IoT),
- **(Docelowo) Digital Twin** (DT),
- **Platform core**: tenant/org, auth, RBAC, audit, settings, obserwowalność (CORE + SETTINGS + SAAS + APPLICATION + MENU).

W praktyce IRIS działa w 3 trybach, które można wdrażać sekwencyjnie lub równolegle:

1. **Baseline & Readiness**: uporządkowanie danych, audyt dojrzałości, baseline KPI.
2. **Run the Plant**: codzienne zarządzanie operacjami i egzekucją (MES/WMS/QMS/CMMS/GEMBA).
3. **Transform the Plant**: portfel inicjatyw, mapy drogowe, decyzje, priorytetyzacja i kontrola ROI (KPI/DATA_AI + workflow).

---

## 2) Najważniejsze elementy platformy (cross-cutting)

### 2.1. Dostęp, bezpieczeństwo i odpowiedzialność

- **Logowanie i sesja**: email/hasło + JWT (MFA i SSO jako etap rozszerzeń).
- **Multi-tenancy**: każdy rekord ma `tenantId`, a system wymusza izolację danych.
- **RBAC**: uprawnienia w formacie `module.resource.action` (np. `mes.order.start`).
- **Audit trail**: każda operacja typu *write* generuje zdarzenie audytu (kto/co/kiedy/na czym).
- **Standard event envelope** (dla zdarzeń między modułami): `eventName`, `occurredAt`, `tenantId`, `actorId`, `correlationId`, `payload`, `version`.

### 2.2. Shell aplikacji (APPLICATION) i nawigacja (MENU)

- **APPLICATION**: wspólny układ UI (header/sidebar), cross-module dashboardy, global search (UI gotowe, backend etapami), powiadomienia, preferencje użytkownika.
- **MENU**: dynamiczne menu (docelowo z API), filtrowane wg roli oraz subskrypcji/feature flags.

### 2.3. Konfiguracja (SETTINGS) i SaaS (SAAS)

- **SETTINGS**: ustawienia hierarchiczne (global → tenant → organizacja → użytkownik), preferencje, konfiguracje procesów, urządzeń, feature flags.
- **SAAS**: lifecycle tenantów, plany/subskrypcje, limity, metering i rozliczenia.

---

## 3) User Journey — od pierwszego logowania do wartości biznesowej

Poniższy przebieg opisuje **najczęstszy scenariusz wdrożenia**: najpierw *onboarding i baseline*, następnie *ciągłe operacje* oraz *zarządzanie inicjatywami*.

### 3.1. Wejście do systemu i aktywacja tenanta (Dzień 0)

1. **Utworzenie organizacji (tenant)**:
   - konfiguracja nazwy, kodu, regionu danych, podstawowych polityk (retencja, logowanie, role).
2. **Zaproszenie użytkowników**:
   - role (np. Admin, Kierownik Produkcji, Lider Lean, IT Manager, CFO) i minimalne uprawnienia.
3. **Pierwsze logowanie**:
   - onboarding w UI: wybór języka, strefy czasowej, preferencji powiadomień.
4. **Weryfikacja dostępu i RBAC**:
   - użytkownik widzi tylko to, co powinien widzieć (menu i dane).

**Rezultat**: gotowy “szkielet” organizacyjny, bezpieczny dostęp, audyt.

### 3.2. Zbieranie danych i mapowanie “jak działa zakład” (Tydzień 1–2)

IRIS wspiera zbieranie danych w modelu “minimum viable data”, a dopiero potem ich doskonalenie:

- **Dane organizacyjne**: zakłady, lokalizacje, struktura (CORE/SETTINGS).
- **Master data**:
  - produkcja: zlecenia/produkty/gniazda (MES),
  - magazyn: magazyny/lokacje/stock (WMS),
  - jakość: typy inspekcji, parametry kontroli (QMS),
  - utrzymanie: zasoby/maszyny, klasyfikacje (CMMS).
- **Dane historyczne i kontekst** (opcjonalnie na start):
  - import CSV/XLSX, PDF (raporty, procedury), integracje API.
- **Sygnały operacyjne**:
  - ręczne zdarzenia (GEMBA),
  - automatyczne alerty (IoT/SCADA/MES) — w miarę gotowości integracji.

**Rezultat**: IRIS “rozumie” podstawowy model zakładu, a użytkownicy mogą przejść do baseline’u i rekomendacji.

### 3.3. Assessmenty (Baseline dojrzałości i gotowości) (Tydzień 2–3)

IRIS może prowadzić assessment w kilku warstwach (wybierane zależnie od celu klienta):

1. **Readiness Industry 4.0/5.0** (np. SIRI/ADMA jako struktura pytań i scoring).
2. **Procesy operacyjne**: przepływ materiału, planowanie, utrzymanie ruchu, jakość, bezpieczeństwo, ESG.
3. **Dane i systemy IT/OT**: źródła danych, integracje, cyber posture, architektura.
4. **Ludzie i kompetencje**: role, luki kompetencyjne, governance.
5. **Finanse**: baseline kosztów, CAPEX/OPEX, TCO.

**Mechanika w IRIS** (typowy przebieg):

- zestaw pytań (ankiety + warsztat),
- dowody: pliki, linki, pomiary, eksporty,
- scoring + heatmapy + wykrycie luk,
- wnioski automatyczne + rekomendacje działań.

**Rezultat**: obiektywny baseline i lista rekomendacji startowych.

### 3.4. Dashboardy i moduły analityczne (Tydzień 3–4)

IRIS dostarcza dashboardy w 3 poziomach:

- **Executive Cockpit** (CEO/CFO/COO): KPI “dlaczego” i “co robić dalej”, status inicjatyw.
- **Operations Cockpit** (Produkcja/Logistyka/Jakość/UR): KPI dzienne/zmianowe, alerty, wąskie gardła.
- **Module Dashboards**:
  - MES: status zleceń, postęp, przestoje, (docelowo) OEE,
  - WMS: stock, przyjęcia, rotacja, braki,
  - QMS: inspekcje, odchylenia, niezgodności,
  - CMMS: awarie, zlecenia serwisowe, backlog UR,
  - GEMBA: tasks, obserwacje, działania korygujące.

**Rezultat**: wspólny “język liczb” i widoczność operacyjna.

### 3.5. Rekomendacje i inicjatywy (Tydzień 4+)

IRIS tworzy rekomendacje w oparciu o:

- wyniki assessmentu,
- dane operacyjne (MES/WMS/QMS/CMMS),
- sygnały i alerty (GEMBA/IoT),
- benchmarki oraz reguły (rule-based) i modele (DATA_AI) — zależnie od etapu wdrożenia.

Rekomendacje są materializowane w postaci:

- **Inicjatyw** (portfolio): opis, owner, koszt/benefit, zależności, ryzyka, harmonogram,
- **Zadań** (operational execution): przez `GEMBA_TASKS` (assignment, SLA, status, zależności),
- **Decyzji**: workflow akceptacji (zarząd/COO/CFO), audyt i uzasadnienie.

**Przykład ścieżki**:

1. IRIS wykrywa problem: *częste przestoje na gnieździe X* (MES) + *wzrost awarii assetu Y* (CMMS).
2. System proponuje inicjatywę: *program prewencji + monitoring* (CMMS + IoT).
3. Inicjatywa generuje zestaw zadań GEMBA dla UR i produkcji (GEMBA_TASKS).
4. KPI śledzi efekt: spadek MTTR/MTBF, wzrost dostępności, wpływ na OEE.

### 3.6. Planowanie zadań, wymaganie i przyspieszanie decyzji

IRIS upraszcza egzekucję zmian przez:

- **Priorytety** (operacyjne i strategiczne),
- **SLA i due dates** (GEMBA_TASKS),
- **Powiązania przyczynowo-skutkowe**: task ↔ alert ↔ inicjatywa ↔ KPI,
- **Workflow approvals** (CFO/COO): szybkie decyzje o kosztach i priorytetach,
- **Powiadomienia**: eskalacje po przekroczeniu SLA, alerty krytyczne.

### 3.7. Raporty, audyt i eksporty (ciągle)

IRIS generuje raporty:

- **Operacyjne**: zmiana/dzień/tydzień (MES/WMS/QMS/CMMS),
- **Transformacyjne**: status portfela inicjatyw, realizacja korzyści (KPI),
- **Compliance i ślad decyzyjny**: audyt, kto zatwierdził co i dlaczego (CORE/Audit).

Formaty wyjściowe (typowo):

- PDF (raport zarządczy),
- CSV/XLSX (dalsza analiza),
- API (pobranie danych do BI lub data lake).

---

## 4) Moduły IRIS (mapa możliwości)

### 4.1. Moduły platformowe

- **CORE**: auth, tenants, users, roles/permissions, audit, org/plant graph.
- **SAAS**: tenant lifecycle, subskrypcje, billing, limity.
- **SETTINGS**: konfiguracja hierarchiczna, preferencje, feature flags.
- **APPLICATION**: shell UI, global search, cross-module dashboards, notification center.
- **MENU**: dynamiczna nawigacja zgodna z RBAC.

### 4.2. Moduły operacyjne

- **MES**: zlecenia, gniazda/stanowiska, postęp, statusy, (docelowo) OEE, przestoje, integracje.
- **WMS**: magazyny/lokacje/stock, przyjęcia, rezerwacje (docelowo), kompletacja/wysyłki.
- **QMS**: inspekcje, wyniki, niezgodności (v1+), automatyczne inspekcje po `mes.order.completed`.
- **CMMS**: assets, awarie, work orders, (docelowo) preventive/predictive maintenance.

### 4.3. GEMBA Suite (operacyjne “nervous system”)

- **GEMBA_TASKS**: zadania, assignment, SLA, widoki My/Team/Overdue.
- (Docelowo) **GEMBA_ALERTS / GEMBA_CORE / GEMBA_COMM**: obserwacje, alerty, komunikacja, rekomendacje i integracje.

### 4.4. Inteligencja i dane

- **KPI**: metryki i dashboardy (p95, trendy, baseline vs target).
- **DATA_AI**: rekomendacje, predykcje, scoring, agregacje cross-module.
- **IoT**: ingest sygnałów/alertów, mapowanie do assetów/procesów.
- **DT**: digital twin (model zakładu i symulacje) — etapowo.

---

## 5) Przykładowe scenariusze użycia (quick wins)

1. **Produkcja**: workflow zlecenia (create → start → complete) + automatyczna inspekcja jakości (QMS).
2. **Magazyn**: przyjęcia materiału i bieżący stock z filtrowaniem (WMS) + widoczność braków pod produkcję.
3. **Utrzymanie ruchu**: zgłoszenie awarii → work order → zamknięcie + raport awaryjności (CMMS).
4. **Operacje**: inicjatywa redukcji przestojów → tasks z SLA → pomiar KPI → raport dla COO/CFO.

---

## 6) “Co jest kluczowe” dla wartości w IRIS

- **Jedna prawda o danych operacyjnych** (tenant isolation, audit, kontrakty modułów).
- **Egzekucja**: rekomendacje bez zadań i SLA nie zmieniają rzeczywistości → GEMBA_TASKS jest krytyczne.
- **Decyzje oparte o KPI**: wspólne definicje KPI, baseline, cele i tracking benefitów.
- **Bezpieczeństwo i IP**: dane procesowe klienta są chronione i pozostają jego własnością.

