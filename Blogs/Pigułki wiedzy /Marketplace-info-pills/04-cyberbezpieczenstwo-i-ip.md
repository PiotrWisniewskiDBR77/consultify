# 04: Cyberbezpieczeństwo i IP (Intellectual Property) — DBR77 Marketplace

Jak zabezpieczamy dane? Szyfrowanie, polityka haseł, certyfikaty oraz gwarancja prawna, że wiedza procesowa klienta pozostaje jego wyłączną własnością.

---

## Szyfrowanie

### W transporcie

- **TLS/HTTPS** — cała komunikacja klient–serwer przez szyfrowany protokół
- Wymóg stosowania HTTPS w środowisku produkcyjnym

### W spoczynku (at rest)

| Dane | Mechanizm |
|------|-----------|
| **Offer.price** | Laravel `encrypted` cast — szyfrowanie przed zapisem do bazy |
| **User.dbr_id** | Laravel `encrypted` cast — identyfikator zewnętrzny |
| **APP_KEY** | Klucz aplikacji Laravel używany do szyfrowania; przechowywany poza repozytorium |

Baza danych przechowuje jedynie ciphertext; odszyfrowanie następuje w warstwie aplikacji przy odczycie.

---

## Polityka uwierzytelniania

### OAuth (bez hasła)

- Logowanie przez **Google** i **LinkedIn** — brak przechowywania haseł przez DBR77
- Zmniejszone ryzyko wycieku haseł, phishingu i słabych haseł

### Sesja

- **Session timeout** — automatyczne wylogowanie po okresie nieaktywności
- **Invalidacja przy logout** — sesja jest niszczona
- **CSRF** — ochrona przed atakami Cross-Site Request Forgery
- **Session fixation** — zabezpieczenia przed przejęciem sesji
- **Cookie**: HttpOnly, Secure, SameSite — zgodne z najlepszymi praktykami

### Admin

- **IP whitelisting** — panel `/admin` dostępny tylko z zaufanych adresów IP
- **Rola admin** — wymagana przypisana rola administratora

---

## Certyfikaty i zgodność

### ISO 27001

Platforma realizuje wymagania **ISO 27001** w zakresie:

- **ISMS** — polityka zarządzania bezpieczeństwem informacji
- **Risk assessment** — ocena ryzyka, rejestr zagrożeń
- **Asset register** — klasyfikacja zasobów (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED)
- **Statement of Applicability** — mapowanie kontrolek ISO na implementację
- **Incident response** — procedury reakcji na incydenty
- **Disaster recovery** — plan odzyskiwania i retencja kopii zapasowych
- **Session security** — polityka sesji
- **Audit logging** — retention ok. 7 lat (2555 dni) dla zgodności

---

## Klasyfikacja danych

| Poziom | Opis | Przykłady |
|--------|------|-----------|
| **PUBLIC** | Informacje do publicznego ujawnienia | Katalogi Challenge (podsumowania) |
| **INTERNAL** | Tylko do użytku wewnętrznego | Audit logs |
| **CONFIDENTIAL** | Wymagają ochrony | Dane Challenge (po NDA), ceny ofert, dane prowizji |
| **RESTRICTED** | Ścisła ochrona | Dane użytkowników (np. dbr_id) |

---

## Ochrona własności intelektualnej (IP)

### Gwarancja prawna

- **Wiedza procesowa i dane klienta pozostają jego wyłączną własnością**
- Platforma nie nabywa praw własności, licencji ani praw użytkowania do:
  - specyfikacji projektowych
  - rysunków
  - opisów procesów
  - komunikacji
  - innych treści udostępnionych przez klienta

### NDA-first

1. Integrator widzi tylko podsumowanie Challenge w katalogu
2. Aby zobaczyć pełne dane (specyfikacje, rysunki), musi **podpisać NDA** przez DocuSign
3. NDA jest prawnie wiążące; platforma śledzi status podpisania
4. Dostęp do treści chronionych NDA jest logowany (audit trail)

### Kontrola dostępu

- Producenci decydują, które Challenge wymagają NDA
- Możliwość wyboru szablonu NDA
- Informacje wrażliwe ujawniane tylko po podpisaniu NDA przez integratora

### Audit trail

- Logowanie dostępu i modyfikacji
- Zachowanie dowodów na wypadek sporu lub naruszenia NDA

---

## Narzędzia bezpieczeństwa

### Rate limiting

| Limit | Wartość |
|------|---------|
| API | 60 req/min |
| Challenge creation | 5/h |
| Offer submission | 10/min |
| File upload | 20/min |

### AI Leak Detection

- Skanowanie treści użytkowników (opisy Challenge, Solution, wiadomości)
- Wykrywanie: e-mail, telefony, adresy, dane osobowe, numery kont
- Blokada publikacji treści zawierających PII do momentu poprawy

### Security Event Monitor

- Wykrywanie anomalii (np. nieudane logowania, nietypowy dostęp, export danych)
- Alerty e-mail do zespołu bezpieczeństwa
- Integracja z Compliance Dashboard w panelu admina

### Content Security Policy (CSP)

- Nagłówki CSP ograniczające wykonywanie potencjalnie niebezpiecznych skryptów

---

## Podsumowanie dla klienta

| Aspekt | Implementacja |
|--------|---------------|
| **Szyfrowanie** | TLS w transporcie; szyfrowanie pól wrażliwych w bazie |
| **Uwierzytelnianie** | OAuth (Google, LinkedIn), brak haseł |
| **Certyfikaty** | Zgodność z ISO 27001 |
| **IP klienta** | Wyłączna własność klienta, brak przeniesienia praw na platformę |
| **NDA** | DocuSign, NDA przed dostępem do szczegółów |
| **Audit** | Pełna historia dostępu i zmian (~7 lat) |
