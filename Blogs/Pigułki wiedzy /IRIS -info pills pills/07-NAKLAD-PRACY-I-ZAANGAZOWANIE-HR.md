# IRIS — Nakład Pracy i Zaangażowanie (Human Resources)

Data: 2026-03-03  
Wersja: 1.0  
Cel: realistycznie oszacować zaangażowanie ludzi po stronie klienta i DBR77 w typowym wdrożeniu IRIS.

---

## 1) Co wpływa na czas i nakład pracy

Największe czynniki:

- **Liczba zakładów / lokalizacji** (1 vs wiele fabryk).
- **Zakres modułów** (GEMBA-only vs pełne MES/WMS/QMS/CMMS + KPI/DATA_AI).
- **Jakość danych wejściowych** (master data gotowe vs “porządkujemy od zera”).
- **Integracje IT/OT** (brak integracji → szybciej; integracje IoT/ERP → dłużej).
- **Wymogi security/compliance** (SSO, audyty, data residency, retention).
- **Dojrzałość governance** (czy są ownerzy procesów i decyzje są podejmowane terminowo).

---

## 2) Ramowy harmonogram (typowy projekt)

### Wariant A — “Quick Start” (1 zakład, szybkie value)

- **Tydzień 0–1**: onboarding + RBAC + podstawowa konfiguracja
- **Tydzień 1–2**: import master data + pierwsze dashboardy
- **Tydzień 2–4**: assessment + rekomendacje + pierwsze inicjatywy/tasks
- **Tydzień 4+**: iteracje: KPI → inicjatywy → tasks → raport

### Wariant B — “Enterprise” (wiele działów i integracje)

- **Tydzień 0–2**: onboarding + security (SSO/MFA) + governance
- **Tydzień 2–6**: dane + integracje (ERP/SCADA/IoT) + stabilizacja
- **Tydzień 6–10**: assessmenty wieloobszarowe + portfel inicjatyw
- **Tydzień 10+**: rollout w falach na kolejne zakłady + model operacyjny

---

## 3) Zaangażowanie po stronie klienta — estymacje roboczogodzin

Poniższe wartości są **zakresami** dla projektu 8-tygodniowego (wariant Quick Start / średni zakres). Dla enterprise zwykle mnożnik 1.5–3×.

### 3.1. Role i zaangażowanie (łącznie w projekcie)

| Rola (Klient) | Onboarding (A) | Zbieranie danych (B) | Inicjatywy & wdrożenie (D) | Analiza & iteracje (E) | Łącznie (typowo) |
|---|---:|---:|---:|---:|---:|
| Sponsor Biznesowy (CEO/COO/CFO) | 2–4h | 2–4h | 4–8h | 2–6h | **10–22h** |
| Lider Projektu (PM) | 12–20h | 20–40h | 20–40h | 8–16h | **60–116h** |
| Kierownik Produkcji / Owner MES | 4–8h | 16–32h | 16–40h | 8–16h | **44–96h** |
| Logistyka / Owner WMS | 2–6h | 12–24h | 12–24h | 4–8h | **30–62h** |
| Jakość / Owner QMS | 2–6h | 8–20h | 8–20h | 4–8h | **22–54h** |
| Utrzymanie Ruchu / Owner CMMS | 2–6h | 8–20h | 12–28h | 4–8h | **26–62h** |
| Lean/DX (inicjatywy, governance) | 2–6h | 6–16h | 16–32h | 8–16h | **32–70h** |
| IT Manager / Architekt (integracje, access) | 6–12h | 12–40h | 8–24h | 4–12h | **30–88h** |
| Data Steward (opcjonalnie) | 0–4h | 16–40h | 4–12h | 4–12h | **24–68h** |

**Interpretacja**:

- Największy koszt czasu to zwykle **zbieranie/porządkowanie danych** i **egzekucja inicjatyw**.
- Sponsor powinien być aktywny w punktach decyzyjnych (priorytety, budżet, rozstrzygnięcia).

---

## 4) Zaangażowanie po stronie DBR77 — estymacje roboczogodzin

| Rola (DBR77) | Onboarding (A) | Zbieranie danych (B) | Inicjatywy & wdrożenie (D) | Analiza & iteracje (E) | Łącznie (typowo) |
|---|---:|---:|---:|---:|---:|
| Delivery Lead | 8–16h | 8–16h | 12–24h | 6–12h | **34–68h** |
| Platform/Backend Engineer | 12–24h | 24–60h | 16–40h | 8–16h | **60–140h** |
| Frontend/UX (jeśli w zakresie) | 4–12h | 8–16h | 8–20h | 4–8h | **24–56h** |
| Security/Compliance (jeśli wymagane) | 2–8h | 4–16h | 2–8h | 2–8h | **10–40h** |
| Data/AI (jeśli KPI/reco w zakresie) | 0–6h | 8–24h | 16–40h | 8–20h | **32–90h** |

---

## 5) Fazy projektu — co “realnie” robią ludzie

### Faza A — Onboarding (1–2 tygodnie)

- **Klient**: wyznacza sponsor/PM, role, zakres i KPI sukcesu; przygotowuje listę użytkowników.  
- **DBR77**: uruchamia tenant, RBAC baseline, konfiguracje i “pierwszy login”.  

### Faza B — Zbieranie danych (1–4 tygodnie)

- **Klient**: dostarcza master data, opis źródeł danych, potwierdza słowniki.  
- **DBR77**: wspiera importy, walidacje, mapowanie, integracje (jeśli w zakresie).  

### Faza D — Wdrażanie inicjatyw (2–8+ tygodni, iteracyjnie)

- **Klient**: ownerzy procesów realizują tasks, aktualizują statusy, domykają decyzje.  
- **DBR77**: dopasowuje konfiguracje, KPI, automatyzacje i raporty; zapewnia stabilność.  

### Faza E — Analiza raportów i ponowne tworzenie inicjatyw (ciągle)

- **Klient**: review KPI, priorytetyzacja kolejnych inicjatyw, governance.  
- **DBR77**: wzmacnia analitykę, automatyzuje pipeline danych, optymalizuje UX.  

---

## 6) Jak zminimalizować nakład pracy (best practices)

- **Start od jednego zakładu i 1–2 procesów krytycznych** (np. downtime + awarie lub braki materiałowe).
- **MVP danych**: najpierw minimum master data, potem wzbogacanie.
- **Jedno źródło prawdy**: uzgodnić definicje KPI i słowniki na początku.
- **Wymuszać egzekucję**: wszystko co ważne → task z SLA, owner, due date.

