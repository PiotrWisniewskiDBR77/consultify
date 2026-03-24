## Cyberbezpieczeństwo i własność IP w Digital Twin

### Szyfrowanie danych (at rest / in transit)

- **W tranzycie (in transit)**:
  - wszystkie połączenia użytkownika z platformą realizowane wyłącznie przez HTTPS (TLS 1.2+),
  - wsparcie rekomendowanych zestawów szyfrów (cipher suites),
  - wymuszenie HSTS i ochrona przed atakami typu downgrade.
- **W spoczynku (at rest)**:
  - dane przechowywane w bazach danych i storage’ach szyfrowane (AES‑256 lub odpowiednik),
  - szyfrowanie snapshotów i backupów,
  - klucze przechowywane i zarządzane przy użyciu KMS dostawcy chmury (AWS KMS / Azure Key Vault).

---

### Kontrola dostępu i RBAC

- **Model uprawnień**:
  - role systemowe (np. Admin Organizacji, Analityk, Viewer, IT Integrator),
  - możliwość tworzenia ról niestandardowych z precyzyjnymi uprawnieniami.
- **RBAC (Role‑Based Access Control)**:
  - dostęp do projektów i modeli przypisywany jest per‑organizacja i per‑zespół,
  - użytkownicy mogą mieć różne poziomy dostępu do:
    - danych źródłowych,
    - modeli symulacyjnych,
    - wyników i raportów,
    - ustawień integracji (wyłącznie rola IT/Administrator).
- **Autoryzacja i sesje**:
  - ochrona sesji (tokeny o ograniczonym czasie życia),
  - mechanizmy odwołania uprawnień (natychmiastowe odebranie dostępu przy odejściu pracownika klienta).

---

### Polityka haseł i uwierzytelnianie

- **Hasła**:
  - minimalna długość (np. 12 znaków),
  - wymagane złożone wzorce (małe/duże litery, cyfry, znaki specjalne),
  - wymuszanie okresowej zmiany haseł (jeśli wymagane przez politykę klienta).
- **2FA / MFA**:
  - możliwość włączenia dwuskładnikowego uwierzytelniania (TOTP / SMS / e‑mail),
  - rekomendacja stosowania MFA dla ról administracyjnych i kluczowych decydentów.
- **Integracja z SSO**:
  - opcjonalna integracja z korporacyjnym IdP (SAML/OIDC),
  - centralne zarządzanie tożsamościami przez dział IT klienta.

---

### Zgodność z ISO 27001 i dobrymi praktykami

- **Zarządzanie bezpieczeństwem informacji**:
  - procesy i procedury zgodne z normą ISO 27001 (zarządzanie ryzykiem, incydentami, dostępem),
  - regularne przeglądy i aktualizacje polityk bezpieczeństwa.
- **Audyt i logowanie**:
  - logi dostępu i działań w systemie (kto, kiedy, co zrobił),
  - możliwość udostępniania logów audytowych na żądanie klienta (w ramach umowy).
- **Testy bezpieczeństwa**:
  - okresowe testy penetracyjne i skanowania podatności,
  - eliminacja wykrytych luk zgodnie z priorytetem krytyczności.

---

### Własność modelu Digital Twin i danych

- **Własność danych wejściowych**:
  - wszystkie dane procesowe, layouty i parametry dostarczone przez klienta pozostają jego własnością,
  - DBR77 wykorzystuje je wyłącznie w celu świadczenia usługi Digital Twin.
- **Własność modeli**:
  - model Digital Twin zakładu (layout, procesy, scenariusze) jest własnością klienta w rozumieniu treści i struktury procesów,
  - DBR77 pozostaje właścicielem platformy oraz komponentów technologicznych (silnik symulacyjny, framework, szablony).
- **Prawo do eksportu i usunięcia danych**:
  - klient ma prawo do eksportu danych i modeli w uzgodnionym formacie,
  - klient może żądać usunięcia danych po zakończeniu współpracy (z zachowaniem wymogów prawnych dot. retencji).

---

### Gwarancja, że dane procesowe pozostają własnością klienta

- **Postanowienia umowne**:
  - jasne zapisy w umowie i DPA (Data Processing Agreement), że dane klienta nie są wykorzystywane w innych projektach,
  - brak możliwości udostępniania danych stronom trzecim bez pisemnej zgody klienta.
- **Anonimizacja / agregacja**:
  - jeśli dane są wykorzystywane do celów statystycznych lub rozwoju algorytmów, odbywa się to w formie zanonimizowanej, uniemożliwiającej identyfikację konkretnego zakładu.
- **Geograficzna lokalizacja danych**:
  - dane klienta przechowywane są w wybranym regionie (np. UE) – szczegóły w polityce hostingu i lokalizacji danych.

---

### Dodatkowe certyfikaty i zaufanie (wg dt-website)

- **ISO 27001** – zarządzanie bezpieczeństwem informacji.
- **SOC2 Type II** – audyt kontroli bezpieczeństwa w środowisku chmurowym.
- **GDPR** – zgodność z unijnym rozporządzeniem o ochronie danych.
- **AES-256** – szyfrowanie danych.
- **Regiony**: EU / US / GCC / JP – opcje lokalizacji danych.
- **No AI training on your data** – dane klienta nie są wykorzystywane do trenowania modeli AI.
- **Human approval layer** – system wspiera rekomendacje i analizy, lecz decyzje pozostają pod kontrolą człowieka (zarządu klienta).

