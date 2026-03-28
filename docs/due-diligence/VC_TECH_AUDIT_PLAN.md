# VC Tech Audit Readiness (Silicon Valley VC)

Cel: pozytywnie przejść techniczny audyt VC (security, reliability, scale, compliance). Poniżej lista kontrolna “must-have” i “evidence” do okazania audytorom.

## Wybrane stacki (domyślne)

- IdP: Google Workspace (OIDC/SAML) + SCIM provisioning.
- Billing: Stripe (webhook podpisany, idempotency).
- Observability: Prometheus + Grafana + Loki, OpenTelemetry exporter; SIEM: eksport logów security/audyt do ELK/Splunk.
- DR/Backup: Postgres + storage snapshoty, test przywrócenia z raportem RPO/RTO.

## 1) Security & Identity

- [ ] SSO (OIDC/SAML) skonfigurowane z produkcyjnym IdP (Google / Okta / Azure AD); test logowania.
- [ ] SCIM (Users/Groups) działa w produkcji (provision/deprovision); log audytu SCIM.
- [ ] MFA wymuszona dla SuperAdmin/Admin; IP allowlist dla SuperAdmin panelu.
- [ ] Polityka haseł, rotacja kluczy (API keys, signing keys), KMS dla szyfrowania; brak sekretów w repo.
- [ ] WAF + rate limiting na wszystkich ścieżkach admin/SuperAdmin/API keys; ochrona CSRF, HSTS, CSP.
- [ ] DLP zasady dla PII/sekretów; blokady eksportu danych bez uprawnień.
- [ ] SIEM integra (logi security, auth, admin actions); alerty krytyczne (login anomaly, brute force, key misuse).

## 2) Data & Privacy

- [ ] RLS/tenant isolation lub twarde filtrowanie orgId w zapytaniach; testy braku wycieku cross-tenant.
- [ ] Szyfrowanie at-rest (KMS) i in-transit (TLS 1.2+); ewentualnie kolumnowe dla PII.
- [ ] Retencja danych, data minimization, polityki usuwania/anonymizacji; DSR (export/delete) ścieżka i log audytu.
- [ ] Backup + DR: RPO/RTO zdefiniowane, ostatni test odtworzenia zaliczony; runbook DR.

## 3) Reliability & Observability

- [ ] SLO/SLA (availability, latency); dashboard w Grafana/Datadog; alerty on-call.
- [ ] Health-checki i readiness/liveness; automatyczny rollback (blue/green lub canary).
- [ ] Pełne logi (app, audit, access) + metryki (Prometheus/Datadog) + tracing (OpenTelemetry) dla kluczowych ścieżek (login, AI, billing).

## 4) Product & Access Controls

- [ ] RBAC spójne: role, granular permissions dla operacji krytycznych (API keys, billing, konfiguracja).
- [ ] Feature flags produkcyjne (nie mock); możliwość rollout/rollback.
- [ ] API keys: scope, TTL, IP allowlist, usage analytics, rotacja; podpisane webhooki.

## 5) Compliance & Legal

- [ ] DPIA/ROPA, DPA/SCC; polityki prywatności i ToS opublikowane; cookie/consent.
- [ ] SLA/OLA komunikowane; raport dostępności/awarii (status page).

## 6) Billing & Finance Integrity

- [ ] Produkcyjne billing (Stripe/Braintree): podpisane webhooki, idempotency keys, reconciliacja usage→invoice.
- [ ] Metered billing test: zgodność liczników z fakturą, raport dla audytora.

## 7) Engineering Process

- [ ] CI/CD z podpisanymi artefaktami; skan zależności (Snyk), SAST/DAST, secrets scan (gitleaks).
- [ ] Code freeze + release tag + smoke tests przed prod; plan rollback.
- [ ] Runbooki: incident response, on-call, DR, bezpieczeństwo (klucze, konta, SSO/SCIM).

## 8) Evidence (co pokazać audytorowi)

- Dashboard metryk (uptime, 5xx, p95 latency, LLM errors, billing errors).
- Logi audytowe z SIEM: przykłady (login admin, zmiana uprawnień, rotacja klucza).
- Dowód DR: raport z ostatniego testu przywrócenia backupu.
- Dowód DSR: ścieżka request → export/delete → log audytu.
- Dowód billing: próbka faktury + zrzut usage z licznika + wynik reconciliacji.
- Dowód SSO/SCIM: screenshot flow + log audytu provisioning.

## 9) Najważniejsze braki do zamknięcia (w repo są mocki)

- SSO/SCIM: podłączyć realny IdP, usunąć mocki, dodać audyt SCIM.
- Security core: realne API do sessions, audit logs, API keys usage, incidents/threats/DLP, policies.
- Billing: zamienić mock na Stripe/Braintree (prod keys, webhooki, reconciliacja).
- Audyt: zapisy do bazy + eksport + wysyłka do SIEM; alerty.
- Observability: produkcyjne metryki, logi, tracing; alerting on-call.
- RLS/tenant isolation: wymusić orgId w zapytaniach lub RLS.
- Backup/DR: potwierdzony test odtworzenia + runbook.
