---
document_id: SETTINGS-DATA-SECURITY-INTEGRATIONS-CHANGE
module: Settings
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Settings — dane, bezpieczeństwo, integracje i zmiany

## 1. Zasada API

Każda sekcja używa typed endpointu albo registry service. Generic key/value
storage jest warstwą persistence, nie publicznym kontraktem bez walidacji.
Request określa zalogowanego aktora; zwykły użytkownik nie przesyła dowolnego
`userId`, aby zmienić cudze ustawienia.

## 2. Write contract

```text
GET effective value/version
 -> edit
 -> PUT/PATCH expectedVersion + value
 -> auth + ownership + schema + policy validation
 -> durable write + audit
 -> effective read-back
 -> cache/event propagation
```

Operacja jest idempotentna. Conflict zwraca bieżącą wartość i możliwość reload,
nie nadpisuje last-write-wins. Batch update jest atomowy albo raportuje dokładny
partial result bez fałszywego sukcesu.

## 3. Klasy wrażliwości

- zwykłe preferences: theme, density, default view;
- personal data: profile, availability, contact;
- sensitive: memory, privacy, notification content;
- security-critical: password, MFA, recovery, sessions;
- secrets: API keys, webhook secrets, OAuth tokens.

Security-critical wymaga reauthentication. Sekret jest szyfrowany, nigdy nie
wraca w GET i pokazuje się tylko raz przy utworzeniu/rotacji. Logi nie zawierają
wartości tajnych.

## 4. Integracje

Connect flow:

```text
discover allowed connector -> show requested scopes -> OAuth/basic authorization
-> encrypted token storage -> health test -> initial sync choice -> status/log
```

Disconnect pokazuje skutek: zatrzymanie sync, zachowanie/usunięcie już
zaimportowanych danych i wpływ na artefakty. Re-auth nie tworzy drugiego
połączenia. Refresh i sync mają job ID, progress, cancel i rezultat.

## 5. Powiadomienia

Preference engine rozstrzyga: event policy, urgency, role/ownership, channel
availability, personal category preference, DND/quiet hours i escalation. DND
opóźnia zwykłe komunikaty, ale nie musi blokować obowiązkowych alertów. Digest
deduplikuje i grupuje po obiekcie; nie powiela tej samej informacji przez kilka
kanałów bez potrzeby.

## 6. AI, pamięć i prywatność

Użytkownik widzi osobno:

- czy historia jest zapisywana;
- czy rozmowy mogą zasilać pamięć;
- jakie wpisy pamięci istnieją;
- jakie źródła osobiste Teresa może czytać;
- czy dane mogą być używane do ulepszania modeli, jeżeli w ogóle dopuszczone;
- okres retencji audio i transcriptów.

Private mode ma jeden precyzyjny kontrakt. Nie może tylko zmieniać ikonki przy
zachowaniu zwykłej persistence.

## 7. Cross-device

Preferences serwerowe synchronizują się między urządzeniami. Device-local mogą
być tylko ustawienia sprzętowe, np. wyjście audio lub desktop sound. Każdy klucz
deklaruje sync scope. Offline edit ma queue, konflikt i read-back po odzyskaniu
sieci.

## 8. Audit i monitoring

Audit obejmuje security, privacy, integrations, memory, data export/delete,
API/webhook i bulk restore. Mierzymy save failures, degraded fallbacks, conflict,
policy rejection, integration health, token expiry oraz divergence effective
value między frontendem i backendem.
