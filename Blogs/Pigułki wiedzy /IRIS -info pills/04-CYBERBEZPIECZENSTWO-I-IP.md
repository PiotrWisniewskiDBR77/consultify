# IRIS — Cyberbezpieczeństwo i IP (Intellectual Property)

Data: 2026-03-03  
Wersja: 1.0  
Cel: techniczny opis zabezpieczeń danych oraz gwarancji własności intelektualnej klienta.

---

## 1) Zasady nadrzędne (security-by-default)

IRIS został zaprojektowany jako system **enterprise-grade** w podejściu:

- **Isolation-by-design**: twarda separacja danych tenantów (kontekst tenanta, wymuszanie `tenantId`).
- **Least privilege**: dostęp tylko wg roli/uprawnień (RBAC).
- **Auditability**: pełny ślad zmian (audit trail dla operacji write).
- **Defense in depth**: wiele warstw kontroli (transport, storage, dostęp, monitoring).

---

## 2) Szyfrowanie danych

### 2.1. Szyfrowanie w transporcie (in-transit)

- **HTTPS** na całej ścieżce użytkownik → IRIS API/UI
- **TLS 1.2+** (docelowo TLS 1.3)
- HSTS (w modelu SaaS / kontrolowanym reverse proxy)
- Bezpieczne zestawy szyfrów i regularna rotacja certyfikatów

### 2.2. Szyfrowanie w spoczynku (at-rest)

W zależności od modelu wdrożenia:

- **SaaS/Cloud**: szyfrowanie danych w bazie i storage po stronie dostawcy chmury (np. AES-256) + zarządzanie kluczami (KMS/Secrets Manager).
- **Private Cloud/On-Prem**: IRIS wymaga włączenia szyfrowania storage/DB oraz zarządzania kluczami (HSM/KMS lub równoważne).

**Dane obejmowane szyfrowaniem at-rest**:

- bazy danych (np. PostgreSQL),
- pliki i załączniki (np. dokumenty PDF, eksporty),
- sekrety i klucze aplikacyjne (secrets manager / vault).

---

## 3) Kontrola dostępu (Identity, RBAC, MFA/SSO)

### 3.1. Uwierzytelnianie (Auth)

- logowanie email + hasło jako minimum,
- sesje oparte o **JWT** (token w `Authorization: Bearer ...`),
- polityka wygasania sesji i odświeżania tokenów (konfigurowalna per tenant).

### 3.2. Autoryzacja (RBAC)

IRIS stosuje katalog uprawnień w stylu:

- `module.resource.action` (np. `cmms.work_order.assign`, `qms.inspection.submit`)

RBAC obejmuje:

- filtrowanie dostępu do danych,
- filtrowanie funkcji UI (menu, widoki),
- logowanie decyzji i zmian (audit).

### 3.3. MFA (Multi-Factor Authentication)

MFA jest wdrażane etapowo (w zależności od wymaganej dojrzałości klienta):

- w modelu SaaS: możliwość włączenia MFA per tenant,
- w modelach enterprise: preferowane MFA wymuszone polityką bezpieczeństwa.

### 3.4. SSO (Single Sign-On)

Jeżeli klient wymaga SSO:

- warianty integracji: **SAML 2.0** lub **OIDC** (zgodnie z wymaganiami klienta),
- mapowanie ról/grup → RBAC w IRIS,
- polityka lifecycle’u użytkowników (provisioning/deprovisioning).

---

## 4) Polityka haseł i bezpieczeństwo kont

Zalecana polityka (konfigurowalna per tenant):

- min. długość: 12+ znaków,
- wymuszenie złożoności lub (preferowane) passphrase,
- ochrona przed atakami brute-force (rate limiting, lockout, captcha opcjonalnie),
- blokada haseł z wycieków (opcjonalnie: integracja z bazami kompromitacji),
- bezpieczne przechowywanie haseł (hashowanie z salt; algorytmy klasy bcrypt/argon2 — implementacja zależna od warstwy auth).

---

## 5) Izolacja danych i multi-tenancy

IRIS egzekwuje izolację tenantów przez:

- wyprowadzanie `tenantId` z kontekstu sesji (JWT/context), a nie z body requestu,
- wymuszanie filtrowania danych po `tenantId` w warstwie dostępu do danych,
- kontrolę uprawnień (RBAC) nad zasobami i akcjami,
- audyt operacji write dla rozliczalności.

Dodatkowe wzmocnienia stosowane w enterprise:

- row-level security (RLS) w DB jako etap “hardening”,
- testy penetracyjne i testy izolacji (negative tests).

---

## 6) Bezpieczeństwo aplikacyjne i operacyjne

### 6.1. Bezpieczeństwo aplikacji

- walidacja danych wejściowych,
- spójny format błędów z `correlationId`,
- zabezpieczenia przed typowymi wektorami (OWASP Top 10),
- kontrola zależności (SCA), aktualizacje bibliotek,
- zasady kontraktów API (contract-first) ograniczające “chaos integracyjny”.

### 6.2. Logowanie, monitoring, wykrywanie incydentów

- logi aplikacyjne w formacie strukturalnym (JSON),
- śledzenie `traceId`/`correlationId`,
- alerty operacyjne (błędy, opóźnienia, próby nieautoryzowanego dostępu),
- procedury reagowania na incydenty (IR) i komunikacji.

### 6.3. Backupy i odtwarzanie (DR)

- automatyczne kopie zapasowe (wg polityki retencji),
- testy odtwarzania okresowo (RTO/RPO uzgadniane z klientem),
- separacja środowisk (dev/test/prod) i uprawnień.

---

## 7) Certyfikacje i standardy (ISO 27001 i inne)

IRIS jest projektowany zgodnie z praktykami **ISO 27001 / security management** oraz standardami enterprise (m.in. kontrola dostępu, audyt, zarządzanie podatnościami, backup/DR).

W zależności od modelu współpracy:

- możliwe jest udostępnienie klientowi **pakietu bezpieczeństwa** (security pack) obejmującego: opis kontroli, architekturę, procedury IR/DR, wyniki testów, politykę retencji,
- certyfikacja formalna (np. ISO 27001) może być elementem roadmapy i/lub wymogiem kontraktowym — zakres i termin są wtedy uzgadniane w umowie.

---

## 8) IP klienta — własność danych i wiedzy procesowej

### 8.1. Co jest IP klienta

Za **własność klienta** uznaje się w szczególności:

- dane procesowe, parametry, konfiguracje procesów,
- dokumenty i załączniki (procedury, instrukcje, raporty),
- modele operacyjne (struktura zakładów, zasoby, KPI),
- wyniki assessmentów i dane źródłowe użyte do ich wytworzenia.

### 8.2. Gwarancja prawna i praktyczna

IRIS zapewnia ochronę IP klienta przez połączenie:

- **mechanizmów technicznych** (izolacja tenantów, RBAC, szyfrowanie, audyt),
- **mechanizmów kontraktowych**:
  - NDA,
  - umowa powierzenia przetwarzania danych (DPA) — jeśli dotyczy,
  - zapisy o **własności danych i wyników** po stronie klienta,
  - zasady eksportu danych (data portability) i usunięcia danych po zakończeniu współpracy.

### 8.3. Dostęp konsultantów zewnętrznych

Jeżeli klient zaprasza własnych konsultantów:

- dostęp jest przyznawany **jawnie** (RBAC), ograniczony czasowo i zakresowo,
- działania konsultantów są audytowane,
- klient zachowuje kontrolę nad uprawnieniami oraz widocznością danych.

---

## 9) Najczęstsze pytania security (skróty odpowiedzi)

- **Czy dane “uciekają” między klientami?** Nie — multi-tenancy i wymuszenie `tenantId` + RBAC + audyt.  
- **Czy mogę mieć region w UE?** Tak — wybór regionu danych zależnie od umowy (szczegóły w dokumencie hostingowym).  
- **Czy mogę odzyskać dane?** Tak — eksporty i procedury portability (zakres uzgadniany).  
- **Czy IRIS wspiera audyt?** Tak — audit trail oraz raporty, a dodatkowo monitoring i correlationId.

