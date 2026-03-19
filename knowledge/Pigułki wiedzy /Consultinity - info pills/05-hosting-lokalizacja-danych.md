# Plik 05: Hosting i Lokalizacja Danych

**Producent:** DBR77 Robotics Sp. z o.o.  
**Produkt:** Consultify (consultify.ai)  
**Wersja dokumentu:** 1.0 | Marzec 2026  
**Adresat:** Dział IT, CISO, Dział Prawny, DPO

---

## 1. Dostawca Infrastruktury Chmurowej

**Podstawowy dostawca: Amazon Web Services (AWS)**

Consultify jest zbudowane na infrastrukturze AWS z wykorzystaniem managed services klasy enterprise. AWS jest globalnym liderem rynku chmurowego z ponad 100 certyfikatami bezpieczeństwa i zgodności, w tym ISO 27001, SOC 2 Type II, PCI-DSS Level 1, GDPR, C5 (Niemcy) i IRAP (Australia).

| Komponent | Usługa AWS |
|---|---|
| Compute | AWS ECS Fargate (serverless containers) |
| Baza danych | Amazon RDS for PostgreSQL (Multi-AZ) |
| Storage plików | Amazon S3 (+ S3 Intelligent-Tiering) |
| Cache / Kolejki | Amazon ElastiCache (Redis), Amazon SQS |
| CDN | Amazon CloudFront |
| Load Balancing | AWS Application Load Balancer (ALB) |
| DNS | Amazon Route 53 |
| Monitoring | Amazon CloudWatch + AWS X-Ray |
| Security | AWS WAF, AWS Shield, AWS GuardDuty, AWS KMS |
| CI/CD | AWS CodePipeline + GitHub Actions |

---

## 2. Regiony i Lokalizacja Danych

Consultify oferuje wybór regionu przechowywania danych na etapie konfiguracji organizacji. Dane **nigdy nie są replikowane między regionami** bez wyraźnej zgody klienta.

### 2.1 Dostępne Regiony

| Region | Centrum danych | Lokalizacja fizyczna | Compliance |
|---|---|---|---|
| **EU (domyślny)** | `eu-central-1` | Frankfurt, Niemcy | GDPR, C5, ISO 27001 |
| **EU-West** | `eu-west-1` | Dublin, Irlandia | GDPR, ISO 27001 |
| **PL** (roadmap Q3 2026) | `eu-central-1` + lokalny CDN | Warszawa, Polska | GDPR, KRI (Krajowe Ramy Interoperacyjności) |
| **US** | `us-east-1` | Wirginia, USA | SOC 2, HIPAA-ready |
| **US-West** | `us-west-2` | Oregon, USA | SOC 2 |
| **GCC** | `me-central-1` | ZEA (Abu Dhabi) | Data Residency UAE |
| **JP** | `ap-northeast-1` | Tokio, Japonia | APPI, ISO 27017 |

### 2.2 Rekomendacja dla Klientów z UE

Domyślny i rekomendowany region dla klientów z Polski i Unii Europejskiej to **Frankfurt (eu-central-1)**:
- Pełna zgodność z GDPR i wymogami polskiego prawa o ochronie danych osobowych.
- Fizyczna lokalizacja danych na terytorium UE.
- Centrum danych Frankfurt objęte certyfikatem ISO 27001 i BSI C5.
- Latencja do polskich użytkowników: typowo 15–25 ms.

### 2.3 Wybór Regionu

- Region jest wybierany przez klienta podczas tworzenia organizacji (onboarding wizard).
- Po wyborze regionu zmiana wymaga migracji danych (usługa profesjonalna, ~5 dni roboczych).
- Informacja o wybranym regionie jest dostępna w panelu Admin organizacji.

---

## 3. Architektura Wysokiej Dostępności (HA)

### 3.1 Multi-AZ (Multi Availability Zone)

Wszystkie komponenty krytyczne są wdrożone w konfiguracji **Multi-AZ** — co najmniej dwa niezależne centra danych w tym samym regionie:

```
Region: eu-central-1 (Frankfurt)
├── Availability Zone A (AZ-a): Frankfurt-1
│   ├── ECS Fargate containers (aplikacja)
│   ├── RDS PostgreSQL (primary)
│   └── ElastiCache Redis (primary)
└── Availability Zone B (AZ-b): Frankfurt-2
    ├── ECS Fargate containers (aplikacja — auto-scaling)
    ├── RDS PostgreSQL (standby — synchronous replication)
    └── ElastiCache Redis (replica)
```

**Automatyczny failover**: w przypadku awarii AZ, RDS automatycznie promuje standby do primary w ciągu 60–120 sekund (bez utraty danych — synchroniczna replikacja).

### 3.2 Auto-Scaling

- Warstwa aplikacji (ECS Fargate) skaluje się automatycznie w zależności od obciążenia (CPU/memory/request rate).
- Skalowanie w górę: do 10× normalnej pojemności w ciągu 2–3 minut.
- Skalowanie w dół: stopniowe, z 15-minutowym cooldown.
- Minimum 2 instancje aplikacji działają zawsze (Active-Active).

---

## 4. SLA — Gwarantowana Dostępność

### 4.1 Zobowiązania SLA

| Plan | Dostępność (Uptime) | Maksymalny przestój miesięczny |
|---|---|---|
| **Standard** | 99.9% | ~43 minuty/miesiąc |
| **Professional** | 99.95% | ~22 minuty/miesiąc |
| **Enterprise** | 99.99% | ~4 minuty/miesiąc |

### 4.2 Definicja Dostępności

- **Dostępność** mierzona jest jako procent czasu, w którym platforma odpowiada na żądania użytkowników z kodem HTTP 200 w czasie ≤ 2 sekund.
- **Planowane okna serwisowe**: maksymalnie 2 godziny miesięcznie, ogłaszane z 72-godzinnym wyprzedzeniem, poza godzinami szczytu (02:00–06:00 CET).
- **Monitoring**: publiczny status page na `status.consultify.ai` z historią incydentów.

### 4.3 Kary Umowne (SLA Credits)

| Dostępność w miesiącu | Credit |
|---|---|
| < 99.9% (Standard) | 10% opłaty miesięcznej |
| < 99.5% | 25% opłaty miesięcznej |
| < 99.0% | 50% opłaty miesięcznej |
| < 95.0% | 100% opłaty miesięcznej |

---

## 5. Backup i Retencja Danych

### 5.1 Harmonogram Backupów

| Typ backupu | Częstotliwość | Retencja | Lokalizacja |
|---|---|---|---|
| **Snapshot RDS (pełny)** | Codziennie, godz. 02:00 CET | 30 dni (Standard) / 1 rok (Enterprise) | Cross-AZ, zaszyfrowany |
| **Point-in-Time Recovery (PITR)** | Ciągły (WAL archiving) | 35 dni | Cross-AZ |
| **Snapshot RDS (tygodniowy)** | Co niedzielę, godz. 03:00 CET | 12 tygodni | Cross-Region (S3) |
| **Backup S3 (pliki)** | Ciągły (S3 Versioning + CRR) | Ostatnie 10 wersji każdego pliku | Cross-Region |
| **Disaster Recovery Snapshot** | Co miesiąc | 12 miesięcy | Osobny region AWS |

### 5.2 Recovery Time Objective (RTO) i Recovery Point Objective (RPO)

| Scenariusz | RPO | RTO |
|---|---|---|
| Awaria pojedynczego AZ | 0 sekund (synchroniczna replikacja) | 2 minuty (automatyczny failover) |
| Awaria całego regionu | < 5 minut (PITR) | 4 godziny (DR plan) |
| Usunięcie danych przez błąd użytkownika | Dowolny punkt w ostatnich 35 dniach | 1 godzina (przywrócenie z PITR) |
| Ransomware / atak na dane | Dowolny punkt w ostatnich 35 dniach | 4 godziny |

### 5.3 Testowanie Backupów

- Automatyczne testy przywrócenia z backupu: co miesiąc w środowisku testowym.
- Ćwiczenie pełnego DR (Disaster Recovery): co kwartał.
- Wyniki testów dokumentowane i dostępne dla klientów Enterprise na żądanie.

---

## 6. Disaster Recovery (Plan Ciągłości Działania)

### 6.1 Scenariusz Regionalnej Awarii

W przypadku niedostępności całego regionu AWS (scenariusz ekstremalny — historycznie nie wystąpił):

1. Aktywacja regionu DR (drugi region AWS, np. `eu-west-1` Dublin dla klientów z regionu Frankfurt).
2. Przywrócenie z ostatniego cross-region snapshot (RPO < 5 minut).
3. Zmiana DNS (Route 53 failover routing) — automatyczna w ciągu 60 sekund.
4. Szacowany RTO: 4 godziny od decyzji o aktywacji DR.

### 6.2 Komunikacja podczas Incydentu

- Status page: `status.consultify.ai` — aktualizowany co 15 minut podczas incydentu.
- Email do administratorów organizacji: wysyłany przy każdej zmianie statusu.
- Webhook powiadomieniowy (Enterprise): integracja z PagerDuty, OpsGenie, Slack.

---

## 7. Zgodność z Regulacjami Lokalizacji Danych

### 7.1 GDPR (UE)

- Dane użytkowników z UE przechowywane wyłącznie na terytorium UE (Frankfurt lub Dublin).
- Data Processing Agreement (DPA) podpisywany przed uruchomieniem produkcyjnym.
- Sub-procesorzy (AWS, OpenAI Enterprise) objęci Standard Contractual Clauses (SCCs).
- Prawa osób: dostęp, sprostowanie, usunięcie, przenoszenie — realizowane w ciągu 30 dni.

### 7.2 Polskie Prawo

- Dane organizacji z siedzibą w Polsce: domyślnie region Frankfurt (UE).
- Na wniosek klienta — możliwość zastrzeżenia wyłącznie terytorium Polski (roadmap Q3 2026: region `pl-central-1` w partnerstwie z lokalnym data center).
- Zgodność z Rozporządzeniem o Krajowych Ramach Interoperacyjności (KRI).

### 7.3 Inne Jurysdykcje

| Kraj / Region | Region AWS | Dodatkowe compliance |
|---|---|---|
| Polska / UE | `eu-central-1` Frankfurt | GDPR |
| USA | `us-east-1` Virginia | SOC 2, CCPA |
| Arabja Saudyjska / ZEA | `me-central-1` Abu Dhabi | UAE PDPL |
| Japonia | `ap-northeast-1` Tokio | APPI |

---

## 8. Monitoring i Obserwowalność

| Narzędzie | Cel | Retencja |
|---|---|---|
| **AWS CloudWatch** | Metryki infrastruktury, logi | 90 dni (Standard) / 1 rok (Enterprise) |
| **AWS X-Ray** | Distributed tracing, performance | 30 dni |
| **Sentry** | Błędy aplikacyjne, crashes | 90 dni |
| **Prometheus + Grafana** | Metryki biznesowe, dashboardy | 1 rok |
| **AWS GuardDuty** | Threat detection (anomalie sieciowe) | 90 dni |
| **AWS CloudTrail** | Audyt operacji API AWS (niemodyfikowalny) | 1 rok |

---

## 9. Ekologia i Zrównoważony Rozwój

- AWS Frankfurt działa w oparciu o **100% energię odnawialną** (cel AWS: carbon neutral do 2040, net zero do 2025 dla regionu EU).
- Infrastruktura serverless (Fargate) minimalizuje zużycie energii przez automatyczne wyłączanie zasobów przy braku obciążenia.
- Wybór regionu EU jest zgodny z celami ESG organizacji klienta.

---

## 10. Podsumowanie dla Działu IT

| Parametr | Wartość |
|---|---|
| Dostawca chmury | Amazon Web Services (AWS) |
| Domyślny region (EU) | Frankfurt, Niemcy (eu-central-1) |
| Backup bazy danych | Codziennie + PITR (35 dni) |
| SLA dostępność (Standard) | 99.9% (~43 min/miesiąc) |
| SLA dostępność (Enterprise) | 99.99% (~4 min/miesiąc) |
| RPO (awaria AZ) | 0 sekund |
| RTO (awaria AZ) | 2 minuty (automatyczny failover) |
| RTO (awaria regionu) | 4 godziny (DR plan) |
| Retencja backupów | 30 dni (Standard) / 1 rok (Enterprise) |
| Zgodność GDPR | Tak — dane w UE, DPA dostępne |
| Status page | status.consultify.ai |
