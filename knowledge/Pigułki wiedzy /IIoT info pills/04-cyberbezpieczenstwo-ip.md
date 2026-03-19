# DBR77 IIoT — Cyberbezpieczeństwo i IP (Intellectual Property)

## 1. Certyfikacje

| Certyfikat | Status |
|------------|--------|
| **ISO 27001** | Zgodność |
| **CE** | Pełna zgodność urządzeń |

## 2. Szyfrowanie

| Aspekt | Implementacja |
|--------|---------------|
| **Dane w transporcie** | TLS 1.2+ (HTTPS, MQTT over TLS) |
| **Dane w spoczynku** | Szyfrowanie na poziomie bazy danych |
| **Klucze** | Zarządzanie kluczami zgodne z najlepszymi praktykami |

## 3. Polityka haseł

- Minimalna długość zgodna z ISO 27001.
- Wymaganie złożoności (małe/duże litery, cyfry, znaki specjalne).
- Polityka wygasania i blokady po nieudanych próbach.
- Możliwość SSO (w planach).

## 4. Dostęp i autoryzacja

- Role użytkowników (Operator, Manager, Admin).
- Zasada najmniejszych uprawnień.
- Audit log dostępu i zmian konfiguracji.

## 5. Dane procesowe klienta — gwarancja IP

**Gwarancja prawna:** Dane procesowe klienta (produkcja, OEE, media, workforce) są **wyłączną własnością klienta**. DBR77 nie wykorzystuje ich do trenowania modeli AI ani udostępniania podmiotom trzecim bez wyraźnej zgody. Szczegóły w umowie i polityce prywatności.

## 6. Segmentacja i izolacja

- Izolacja tenantów w architekturze multi-tenant.
- Dane jednego klienta nie są udostępniane innym klientom.
- Możliwość wdrożenia on-premise dla wrażliwych obciążeń (w planach).
