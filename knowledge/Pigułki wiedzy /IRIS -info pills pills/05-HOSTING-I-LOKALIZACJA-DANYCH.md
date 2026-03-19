# IRIS — Hosting i Lokalizacja Danych

Data: 2026-03-03  
Wersja: 1.0  
Cel: opisać gdzie fizycznie “mieszkają” dane, jak wygląda wybór dostawcy/regionu, backupy, retencja i SLA.

---

## 1) Gdzie fizycznie są dane

Lokalizacja danych w IRIS zależy od wybranego modelu wdrożenia:

1. **SaaS (multi-tenant)**: dane przechowywane w chmurze w regionie uzgodnionym w umowie.  
2. **Private Cloud / Single-Tenant**: dedykowane środowisko w wybranym regionie (chmura dostawcy lub chmura klienta).  
3. **On-Prem**: dane pozostają w infrastrukturze klienta.

W każdym modelu obowiązują te same zasady: izolacja tenantów, RBAC, szyfrowanie, audyt.

---

## 2) Dostawca chmury i referencyjna architektura

### 2.1. Preferowany target (docelowo)

Referencyjny target dla IRIS:

- **AWS**:
  - **EKS** (Kubernetes) dla runtime aplikacji,
  - **RDS PostgreSQL** dla bazy danych,
  - **ElastiCache Redis** dla cache/stream (etapowo),
  - **Secrets Manager** dla sekretów,
  - storage obiektowy (np. S3) dla plików/załączników,
  - monitoring/observability (logi/metryki/traces).

### 2.2. Alternatywy (wymagania klienta)

Na życzenie klienta możliwe są wdrożenia na:

- **Azure** (AKS + PostgreSQL + Key Vault + Cache),
- **inne chmury** lub **on-prem** — po uzgodnieniu standardów security/DR/observability.

---

## 3) Region danych (data residency)

Region jest dobierany do wymogów prawnych i polityk klienta.

Przykładowe regiony:

- **UE (zalecane dla klientów z UE)**:
  - Frankfurt (DE), Warszawa (PL) lub inny region UE zależnie od dostępności usług,
- **USA**:
  - regiony US (np. East/West) dla klientów z wymogiem hostingu w USA,
- **Inne**: wg uzgodnień (np. APAC).

**Zasada**: dane produkcyjne nie są przenoszone między regionami bez procesu zmiany i zgody klienta (change management).

---

## 4) Backupy, retencja i odtwarzanie (DR)

### 4.1. Kopie zapasowe (backup)

Standardowe elementy polityki backup:

- **Baza danych**:
  - kopie okresowe (np. dzienne) + opcjonalnie **PITR** (point-in-time recovery),
  - szyfrowanie backupów,
  - automatyczna weryfikacja poprawności.
- **Załączniki i pliki**:
  - wersjonowanie lub snapshoty (zależnie od storage),
  - szyfrowanie,
  - kontrola integralności.

### 4.2. Retencja (przykładowe poziomy)

Retencja jest konfigurowalna kontraktowo:

- **Standard**: 30 dni (backupy DB), 30–90 dni (logi/telemetria)  
- **Enterprise**: 90–365 dni (zgodnie z compliance), dłuższa retencja archiwów (opcjonalnie)

### 4.3. DR: RPO i RTO (przykładowe)

RPO/RTO zależą od wybranego pakietu:

- **Standard**: RPO 24h, RTO 24h  
- **Premium**: RPO 4–8h, RTO 8–12h  
- **Enterprise**: RPO ≤ 1h, RTO 4–8h (wymaga architektury HA i uzgodnień)

**Uwaga**: parametry są finalnie definiowane w SLA.

---

## 5) SLA — dostępność systemu

SLA jest dobierane do potrzeb klienta (biznes krytyczność, liczba zakładów, integracje).

Przykładowe poziomy:

- **SLA Standard**: 99.5% miesięcznie  
- **SLA Premium**: 99.9% miesięcznie  
- **SLA Enterprise**: 99.95% miesięcznie (z HA i uzgodnionymi oknami serwisowymi)

Definicje SLA obejmują:

- zakres (UI, API, kluczowe moduły),
- wyjątki (planowane maintenance windows),
- sposób pomiaru (monitoring syntetyczny + metryki serwerowe),
- procedury eskalacji i czasy reakcji.

---

## 6) Monitoring i utrzymanie

W modelu SaaS/Private Cloud IRIS utrzymuje:

- monitoring dostępności, opóźnień (p95), błędów,
- logi i korelację zdarzeń (`correlationId`),
- alerting i on-call (zależnie od SLA),
- politykę aktualizacji bezpieczeństwa.

W modelu On-Prem te obowiązki mogą przechodzić w całości lub części na klienta (wg umowy).

---

## 7) Co klient powinien uzgodnić na etapie wyboru hostingu

- **Region danych** (UE/PL/DE/USA),
- **Model** (SaaS vs Private Cloud vs On-Prem),
- **SLA i DR** (RPO/RTO),
- **Retencja** (backupy, logi, archiwa),
- **Integracje** (API, eventy, IoT) i ich krytyczność,
- **Wymogi compliance** (np. branżowe, kontraktowe, audytowe).

