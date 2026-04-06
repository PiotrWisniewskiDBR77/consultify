# Plik 04: Cyberbezpieczeństwo i Własność Intelektualna (IP)

**Producent:** DBR77 Robotics Sp. z o.o.  
**Produkt:** Consultify (consultify.ai)  
**Wersja dokumentu:** 1.0 | Marzec 2026  
**Adresat:** CISO, Dział IT, Dział Prawny, Zarząd

---

## 1. Filozofia Bezpieczeństwa

Consultify stosuje podejście **Security by Design** — bezpieczeństwo jest wbudowane w architekturę platformy na każdym poziomie, a nie nakładane jako warstwa zewnętrzna. Kluczowe zasady:

- **Zero-trust architecture**: każde żądanie jest weryfikowane niezależnie od źródła.
- **Defence in depth**: wiele warstw zabezpieczeń — żadna pojedyncza kompromitacja nie prowadzi do naruszenia danych.
- **Principle of least privilege**: każdy użytkownik i każdy komponent systemu ma dostęp wyłącznie do zasobów niezbędnych do swojej funkcji.
- **Data isolation**: dane każdego klienta są izolowane na poziomie bazy danych (Row-Level Security).

---

## 2. Szyfrowanie Danych

### 2.1 Szyfrowanie w Transporcie (Data in Transit)

| Protokół | Standard | Zastosowanie |
|---|---|---|
| **TLS 1.3** | AES-256-GCM | Cały ruch HTTP (HTTPS) |
| **WSS (WebSocket Secure)** | TLS 1.3 | Real-time collaboration, AI streaming |
| **HSTS** | max-age=31536000 | Wymuszenie HTTPS przez przeglądarkę |
| **Certificate Pinning** | SHA-256 | API mobilne (roadmap) |

- Certyfikaty SSL/TLS wydane przez zaufany CA (DigiCert/Let's Encrypt).
- Automatyczna rotacja certyfikatów z wyprzedzeniem 30 dni.
- TLS 1.0 i 1.1 całkowicie wyłączone.
- Słabe szyfrowania (RC4, 3DES, MD5) nie są obsługiwane.

### 2.2 Szyfrowanie w Spoczynku (Data at Rest)

| Warstwa | Algorytm | Zarządzanie kluczami |
|---|---|---|
| **Baza danych (PostgreSQL)** | AES-256 (transparent encryption) | AWS KMS |
| **Storage plików (S3)** | AES-256-S3 Server-Side Encryption | AWS KMS + Customer Managed Keys (Enterprise) |
| **Backup/Snapshots** | AES-256 | AWS KMS |
| **Wolumeny dyskowe** | AES-256 (EBS encryption) | AWS KMS |
| **Logi aplikacyjne** | AES-256 (CloudWatch Logs Encryption) | AWS KMS |

### 2.3 Szyfrowanie Haseł

- Algorytm: **bcrypt** z work factor ≥ 12 (adaptacyjny).
- Hasła nigdy nie są przechowywane w postaci jawnej ani szyfrowanej symetrycznie.
- Hasła nie są logowane, nie są przesyłane do zewnętrznych systemów.
- Weryfikacja w czasie stałym (constant-time comparison) — odporność na timing attacks.

### 2.4 BYOK (Bring Your Own Key) — Enterprise

Klienci Enterprise mogą dostarczyć własne klucze szyfrowania zarządzane przez ich AWS KMS lub Azure Key Vault. Daje to klientowi pełną kontrolę — w przypadku zakończenia relacji klient może unieważnić klucze i gwarantować nieodwracalną niedostępność swoich danych.

---

## 3. Izolacja Danych (Multi-Tenancy)

### 3.1 Row-Level Security (RLS)

Consultify implementuje izolację danych na poziomie bazy danych przy użyciu **PostgreSQL Row-Level Security**:

- Każda tabela ma polityki RLS powiązane z `organization_id`.
- Żadne zapytanie nie może zwrócić danych z innej organizacji — nawet przy błędzie aplikacji.
- Testy automatyczne weryfikują izolację danych przy każdym deployu (CI/CD).

### 3.2 Architektura Multi-Tenant

```
Warstwa aplikacji (shared)
        ↓
Warstwa bazy danych (shared, RLS enforced)
  ├── Organizacja A (org_id: aaa) — widzi tylko swoje dane
  ├── Organizacja B (org_id: bbb) — widzi tylko swoje dane
  └── Organizacja C (org_id: ccc) — widzi tylko swoje dane
```

- Pliki i assety przechowywane w dedykowanych prefixach S3 per organizacja.
- Klucze szyfrowania mogą być per-tenant (Enterprise BYOK).

---

## 4. Polityka Haseł i Uwierzytelnianie

### 4.1 Wymagania Hasła

| Parametr | Wartość |
|---|---|
| Minimalna długość | 12 znaków |
| Wymagane: duże litery | Tak |
| Wymagane: małe litery | Tak |
| Wymagane: cyfry | Tak |
| Wymagane: znaki specjalne | Tak |
| Maksymalny wiek hasła | 180 dni (konfigurowalny dla Enterprise) |
| Historia haseł | 12 ostatnich haseł nie może być powtórzone |
| Blokada konta | Po 10 nieudanych próbach (z CAPTCHA po 5) |

### 4.2 Multi-Factor Authentication (MFA)

- **TOTP (Time-based One-Time Password)**: Google Authenticator, Authy, 1Password.
- **WebAuthn / Passkeys**: FIDO2 — biometria (Face ID, Touch ID), klucze sprzętowe (YubiKey).
- **Email OTP**: jednorazowy kod wysyłany na e-mail (fallback).
- MFA jest **wymagane** dla ról Admin i Owner.
- MFA jest **rekomendowane** dla wszystkich użytkowników; administratorzy organizacji mogą je wymusić dla całego tenantu.

### 4.3 Zarządzanie Sesjami

- Czas wygaśnięcia sesji: 8 godzin aktywności (konfigurowalny: 1–24h).
- Automatyczne wylogowanie przy braku aktywności: 30 minut (konfigurowalny).
- JWT z krótkim TTL (15 minut) + Refresh Token (7 dni) z rotacją.
- Możliwość wylogowania wszystkich sesji jednym kliknięciem.
- Widok aktywnych sesji z informacją o urządzeniu, przeglądarce i IP.

---

## 5. Bezpieczeństwo Aplikacyjne

### 5.1 Zabezpieczenia OWASP Top 10

| Zagrożenie | Środek zaradczy |
|---|---|
| **Injection (SQL, NoSQL)** | Parametryzowane zapytania; ORM z escape'owaniem; WAF |
| **Broken Authentication** | JWT + MFA + session management; rate limiting logowania |
| **XSS** | DOMPurify sanitization; Content Security Policy (CSP); HTTPOnly cookies |
| **CSRF** | CSRF tokens per session; SameSite=Strict cookies |
| **Broken Access Control** | RBAC + RLS; server-side authorization; principle of least privilege |
| **Security Misconfiguration** | Helmet.js security headers; automated config audits |
| **Vulnerable Dependencies** | Dependabot; `npm audit` w CI/CD; SBOM tracking |
| **Insufficient Logging** | Winston + Sentry; audit log dla wszystkich akcji wrażliwych |
| **SSRF** | Whitelist outbound requests; network segmentation |
| **Mass Assignment** | Explicit DTO validation; Zod schemas na wszystkich endpointach |

### 5.2 Dodatkowe Zabezpieczenia

- **Rate Limiting**: ochrona przed brute force i DDoS na poziomie API Gateway + Express middleware.
- **WAF (Web Application Firewall)**: AWS WAF z regułami OWASP managed rules.
- **DDoS Protection**: AWS Shield Standard (wszystkie plany), Shield Advanced (Enterprise).
- **Penetration Testing**: zewnętrzny pentest co 12 miesięcy przez certyfikowanego dostawcę CREST.
- **Vulnerability Disclosure**: program responsible disclosure na `security@dbr77.com`.
- **Dependency Scanning**: automatyczne skany w CI/CD przy każdym commit.

### 5.3 Logowanie i Audyt

- Każda akcja użytkownika (logowanie, zmiana danych, dostęp do raportu, zmiana uprawnień) jest logowana z timestampem, IP, user-agentem i identyfikatorem użytkownika.
- Logi audytowe są **niemodyfikowalne** (append-only storage, CloudTrail).
- Retencja logów: 90 dni (Standard), 1 rok (Enterprise).
- Export logów audytowych dostępny dla administratora organizacji.

---

## 6. Bezpieczeństwo AI i Danych Treningowych

**Kluczowa gwarancja: Consultify nigdy nie trenuje modeli AI na danych klientów.**

- Dane organizacji są **wyłącznie** używane jako kontekst do generowania odpowiedzi w czasie rzeczywistym.
- Żadne dane klienta nie są przesyłane do providerów AI (OpenAI, Anthropic, Google) bez szyfrowania i bez wyraźnej izolacji per-tenant.
- Umowy z providerami AI zawierają zakaz używania danych API do trenowania modeli.
- Opcja Enterprise: możliwość konfiguracji wyłącznie prywatnych deploymentów LLM (Azure OpenAI Private Endpoint, Anthropic Enterprise).

---

## 7. Certyfikaty i Standardy Zgodności

| Standard | Status | Opis |
|---|---|---|
| **ISO/IEC 27001:2022** | W trakcie certyfikacji (Q2 2026) | Zarządzanie bezpieczeństwem informacji |
| **SOC 2 Type II** | W trakcie certyfikacji (Q3 2026) | Trust Service Criteria: Security, Availability, Confidentiality |
| **GDPR** | Pełna zgodność | Regulamin, DPA, prawo do bycia zapomnianym |
| **NIS2** | Zgodność architektury | Dyrektywa UE o bezpieczeństwie sieci i informacji |
| **DORA** | Monitoring zgodności | Digital Operational Resilience Act (sektor finansowy) |
| **Cyber Essentials** | Roadmap | Certyfikacja UK (Q4 2026) |

---

## 8. Własność Intelektualna Klienta (IP Protection)

### 8.1 Zasada Fundamentalna

> **Cała wiedza procesowa, dane operacyjne, wyniki assessmentów, strategie transformacyjne oraz wszelkie inne informacje wprowadzone przez klienta do Consultify pozostają wyłączną własnością klienta.**

DBR77 nie rości sobie żadnych praw do danych klienta — ani do ich treści, ani do wynikających z nich wniosków, rekomendacji czy inicjatyw.

### 8.2 Gwarancje Prawne IP

Umowa licencyjna Consultify zawiera następujące gwarancje:

1. **Zakaz komercyjnego wykorzystania danych klienta** przez DBR77 w jakimkolwiek celu poza świadczeniem usługi.
2. **Zakaz udostępniania danych klienta** stronom trzecim bez pisemnej zgody klienta (z wyjątkiem podwykonawców technicznych — AWS, OpenAI — objętych umowami DPA).
3. **Zakaz reverse-engineering strategii klienta** na podstawie danych platformy.
4. **Prawo do eksportu wszystkich danych** w standardowych formatach (JSON, CSV, PDF) w dowolnym momencie.
5. **Prawo do trwałego usunięcia danych** (right to erasure) — usunięcie w ciągu 30 dni od żądania, z potwierdzeniem.
6. **Brak vendor lock-in**: po zakończeniu umowy klient otrzymuje pełny eksport danych w ciągu 14 dni.

### 8.3 Co Należy do DBR77 (i co NIE należy do klienta)

DBR77 pozostaje właścicielem:
- Kodu platformy Consultify (software IP).
- Metodologii DRD i Lean 4.0 (proprietary assessment frameworks).
- Modelu AI LLMind™ (architektura, wagi — nie dane klienta).
- Szablonów raportów i prezentacji.

Klient pozostaje właścicielem:
- Danych organizacyjnych, finansowych i procesowych wprowadzonych do systemu.
- Wygenerowanych raportów i prezentacji (jako efekt pracy klienta z systemem).
- Inicjatyw i strategii opracowanych przy wsparciu platformy.
- Wyników assessmentów przeprowadzonych przez klienta.

### 8.4 Data Processing Agreement (DPA)

- DPA zgodny z art. 28 GDPR dostępny do podpisania przed uruchomieniem produkcyjnym.
- Wskazuje cele przetwarzania, kategorie danych, środki bezpieczeństwa.
- Zawiera klauzule dotyczące sub-procesorów (AWS, OpenAI Enterprise, Anthropic Enterprise).
- Standardowe Klauzule Umowne UE (SCCs) dla transferów danych do USA.

---

## 9. Procedury Reagowania na Incydenty

### 9.1 Klasyfikacja Incydentów

| Poziom | Opis | Czas reakcji | Notyfikacja klienta |
|---|---|---|---|
| **P0 – Krytyczny** | Naruszenie danych, niedostępność produkcji | 15 minut | 1 godzina |
| **P1 – Wysoki** | Degradacja usługi, podejrzenie naruszenia | 1 godzina | 4 godziny |
| **P2 – Średni** | Błąd funkcjonalny bez naruszenia danych | 4 godziny | 24 godziny |
| **P3 – Niski** | Drobna usterka, sugestia usprawnienia | 24 godziny | Następne release notes |

### 9.2 Obowiązki Notyfikacyjne

- Naruszenie danych osobowych: notyfikacja UODO (lub lokalnego organu nadzorczego) w ciągu **72 godzin** (GDPR Art. 33).
- Notyfikacja klienta: nie później niż 24 godziny od potwierdzenia naruszenia.
- Raport post-incident: w ciągu 14 dni od zamknięcia incydentu.

---

## 10. Podsumowanie dla CISO

| Obszar | Gwarancja |
|---|---|
| Szyfrowanie transportu | TLS 1.3, AES-256-GCM |
| Szyfrowanie spoczynku | AES-256 (AWS KMS), BYOK dla Enterprise |
| Izolacja danych | PostgreSQL RLS + per-tenant S3 prefix |
| Hasła | bcrypt work factor ≥ 12 |
| MFA | TOTP + WebAuthn/FIDO2 |
| AI i dane klienta | Brak trenowania modeli na danych klienta |
| Własność IP danych | 100% własnością klienta — gwarancja umowna |
| Prawo do usunięcia | 30 dni od żądania |
| Certyfikaty | ISO 27001 (Q2 2026), SOC 2 Type II (Q3 2026) |
| Pentest | Zewnętrzny CREST co 12 miesięcy |
