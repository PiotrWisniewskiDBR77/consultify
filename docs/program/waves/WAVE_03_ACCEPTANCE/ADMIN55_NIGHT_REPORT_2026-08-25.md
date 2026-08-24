# Admin komplet 55 — raport dyżuru nocnego 2026-08-25

Gałąź bazowa: `codex/m03-admin-20260824` @ `345286ff56be48849dfac6b1566495ba71d6aa15`
Gałąź robocza: `codex/admin55-night-20260825`
Worktree: `/private/tmp/consultify-admin55-night`
Zakres: Fala 2 (7) + Fala 3 (4) + tenant-defaults (1) + Fala 4 (15) = 27 ekranów
Start: 2026-08-24 (Europe/Warsaw) · Koniec: —

## Stan zastany (co zrobiła Fala 0/1 przed moim startem)

- `5d9615d367` — `feat(admin): unlock Command Center compliance-posture tabs (Admin komplet 55, Fala 0)`
- `ae8c7eaf9e` — `feat(admin): wire billing-details to Budgets & tax tab (Admin komplet 55, Fala 1)`
- `b15792bd8e` — `feat(admin): wire audit high-risk-changes/retention-export and health diagnostics (Admin komplet 55, Fala 1)`
- `5fc3016b05` — `feat(admin): wire security sso/scim-lifecycle/api-access/risk-summary (Admin komplet 55, Fala 1)`
- `ea9e00476e` — `feat(admin): wire ai models-providers/ai-limits-budgets/data-privacy/ai-operations/ai-audit (Admin komplet 55, Fala 1)`

## Tabela wykonania

| # | Ekran | Fala | Commit | Status | Uwagi |
|---|---|---|---|---|---|
| 1 | team/teams | 2 | `6838861109` | DONE | realny CRUD zespołu i składu; mutacje z readbackiem |
| 2 | billing/plan-history | 4/A | `52195ad3b7` | DONE | tenant-scoped, tylko odczyt, paginacja |
| 3 | security/domains | 4/A | — | STOP | endpoint verify automatycznie oznacza domenę jako zweryfikowaną bez DNS/TXT |
| 4 | team/access-requests | 4/A | — | STOP | żywy approve tworzy nową organizację; brak kontraktu dołączenia do bieżącej org |
| 5 | security/service-accounts | 4/A | `26caf7f2b7` | DONE | nowa admin-only trasa; sekret tylko raz; readback |
| 6 | ai/quality-evaluations | 2 | — | STOP | obie mutacje bez tenant-scope (`WHERE id = ?`) |
| 7 | command/attention-queue | 2 | `358d4a2307` | DONE | 4 realne źródła; źródło/świeżość/severity/deep-link; bez mutacji |
| 8 | command/cost-capacity | 2 | `a92af5e497` | DONE | 5 źródeł; atrybucja StandardTable; tylko odczyt + deep-linki |
| 9 | audit/compliance-evidence | 2 | `f91a3a6849` | DONE | 6 źródeł dowodowych; źródło/świeżość/deep-link; eksport audytu |
| 10 | billing/seats-licences | 3 | `1a926118e2` | DONE | realna konfiguracja/historia; auto-add z readbackiem; zakup contact-sales |
| 11 | health/dependencies | 3 | — | STOP | brak jawnej mapy probe→zależność; rejestr opisuje przepływy produktowe, nie zależności |
| 12 | health/incident-history | 4/B | — | NIE ZACZĘTO | |
| 13 | health/queues-jobs | 4/B | — | NIE ZACZĘTO | |
| 14 | health/sla-slo | 4/B | — | NIE ZACZĘTO | |
| 15 | security/security-alerts | 4/A | — | NIE ZACZĘTO | |
| 16 | security/sessions | 3 | — | NIE ZACZĘTO | |
| 17 | security/break-glass | 3 | — | NIE ZACZĘTO | |
| 18 | team/guests-external | 4/A | — | NIE ZACZĘTO | |
| 19 | team/access-reviews | 4/B | — | NIE ZACZĘTO | |
| 20 | team/roles-permissions | 2 | — | NIE ZACZĘTO | |
| 21 | audit/legal-hold | 4/B | — | NIE ZACZĘTO | |
| 22 | audit/export-history | 4/B | — | NIE ZACZĘTO | |
| 23 | audit/integrity | 4/B | — | NIE ZACZĘTO | |
| 24 | ai/personas | 4/A | — | NIE ZACZĘTO | |
| 25 | ai/ai-incidents | 4/B | — | NIE ZACZĘTO | |
| 26 | ai/configuration-versions | 2 | — | NIE ZACZĘTO | |
| 27 | command/organization-defaults | DEC-13 | — | NIE ZACZĘTO | licznik docelowy: 56 |

## Pozycje STOP

### STOP — security/domains
Powód: istniejący endpoint weryfikacji nie wykonuje weryfikacji DNS/TXT i bezwarunkowo zapisuje `verified = 1`, więc podpięcie go stworzyłoby fałszywy sukces bezpieczeństwa.
Dowód: `server/src/routes/organization/approved-domains.routes.ts:261-268`; `rg -n "resolveTxt|verification_token|verify.*domain" server/src src` nie wskazuje innego mechanizmu DNS dla approved domains.
Co zrobiłbym, gdyby zapadła decyzja X: po zatwierdzeniu kontraktu DNS dodałbym resolver TXT z oczekiwanym tokenem, rozróżnienie `pending/verified/failed`, timeout i testy negatywne; dopiero potem podłączyłbym UI z instrukcją rekordu TXT.
Stan: NIE ZACOMMITOWANO.

### STOP — ai/quality-evaluations
Powód: oba endpointy mutujące opisane jako tenant-scoped aktualizują rekord wyłącznie po `id`, bez `organization_id`, co tworzy ryzyko cross-tenant IDOR.
Dowód: `server/src/routes/admin/ai-quality.routes.ts:243-251` (`ai_feedback WHERE id = ?`) oraz `:343-351` (`ai_style_learning_patterns WHERE id = ?`).
Co zrobiłbym, gdyby zapadła decyzja X: w osobnej poprawce bezpieczeństwa dodałbym `organization_id` z tokenu do obu UPDATE, 404 dla zasobu spoza organizacji, sprawdzenie `changes` i testy negatywne cross-tenant; dopiero potem panel z mutacjami i readbackiem.
Stan: NIE ZACOMMITOWANO.

### STOP — team/access-requests
Powód: istniejące API nie obsługuje zatwierdzenia dołączenia do bieżącej organizacji; endpoint listy jest globalny/superadmin-only, a `approve` tworzy nową organizację i użytkownika.
Dowód: `server/src/routes/access-control.routes.ts:83-104` (globalna lista + `requireSuperAdmin`) oraz `:107-189` (tworzenie `organizations` i `users`); publiczny `POST /requests` nie zapisuje docelowego `organization_id` (`:35-76`).
Co zrobiłbym, gdyby zapadła decyzja X: po zatwierdzeniu modelu wniosku do istniejącej organizacji dodałbym tenant-scoped command z jednoznacznym `organization_id`, obsługą istniejącego użytkownika i idempotencją, następnie approve/reject z readbackiem i testem cross-tenant.
Stan: NIE ZACOMMITOWANO.

### STOP — billing/seats-licences / purchaseSeats
Powód: nie wystawiono mutacji finansowej `purchaseSeats` bez kontraktu potwierdzenia, idempotencji, readbacku dostawcy płatności i paragonu.
Stan: ekran odczytu, historii i auto-add jest gotowy; zakup jest jawnie oznaczony jako contact-sales.

### STOP — health/dependencies
Powód: `HEALTH_PROBES` rejestruje próby przepływów produktowych (np. KPI round-trip, lista inicjatyw, Assessment→M13), ale nie zawiera jawnej kategorii zależności ani mapy probe→baza/dostawca/usługa/kolejka. Utworzenie takiej mapy wymagałoby zgadywania, czego §4.4 wprost zakazuje.
Dowód: `server/src/services/health/healthProbeService.ts:104-107`, `:496-515`, `:528-570`; typ `HealthProbeDefinition` nie ma pola zależności.
Co zrobiłbym po decyzji X: po zatwierdzeniu kanonicznego katalogu zależności i jawnego przypisania probe'ów dodałbym wyłącznie customer-safe agregację ostatnich wyników, bez danych hosta i credentiali.
Stan: NIE ZACOMMITOWANO.

## Znaleziska (problemy w istniejącym kodzie — NIE naprawiane przeze mnie)

| # | Znalezisko | Plik:linia | Klasa | Dlaczego nie naprawiłem |
|---|---|---|---|---|

## Korekty inwentarza

Brak na starcie dyżuru.

## Testy

- `npx esbuild src/components/Admin/AdminTeamsPanel.tsx --loader:.tsx=tsx --outfile=/dev/null` — PASS.
- `bash scripts/check-list-canon.sh src/components/Admin/AdminTeamsPanel.tsx` — PASS, 0 nowych naruszeń.
- `npx vitest run src/components/Admin/__tests__/AdminTeamsPanel.test.tsx src/views/admin/__tests__/AdminSettingsModule.test.tsx` — PASS, 2 pliki / 32 testy.
- `npx esbuild src/components/Admin/AdminPlanHistoryPanel.tsx --loader:.tsx=tsx --outfile=/dev/null` — PASS.
- `npx esbuild server/src/routes/admin/billing-history.routes.ts --platform=node --format=esm --outfile=/dev/null` — PASS.
- `bash scripts/check-list-canon.sh src/components/Admin/AdminPlanHistoryPanel.tsx` — PASS, 0 nowych naruszeń.
- `npx vitest run server/src/routes/__tests__/billing-history.routes.test.ts src/components/Admin/__tests__/AdminPlanHistoryPanel.test.tsx src/views/admin/__tests__/AdminSettingsModule.test.tsx` — PASS, 3 pliki / 35 testów.
- `npx esbuild src/components/Admin/AdminServiceAccountsPanel.tsx --loader:.tsx=tsx --outfile=/dev/null` — PASS.
- `npx esbuild server/src/routes/admin/service-accounts.routes.ts --platform=node --format=esm --outfile=/dev/null` — PASS.
- `bash scripts/check-list-canon.sh src/components/Admin/AdminServiceAccountsPanel.tsx` — PASS, 0 nowych naruszeń.
- `npx vitest run server/src/routes/__tests__/service-accounts.routes.test.ts src/components/Admin/__tests__/AdminServiceAccountsPanel.test.tsx src/views/admin/__tests__/AdminSettingsModule.test.tsx` — PASS, 3 pliki / 36 testów.
- `npx esbuild src/components/Admin/AdminCommandCenterPanel.tsx --loader:.tsx=tsx --outfile=/dev/null` — PASS.
- `npx vitest run src/components/Admin/__tests__/AdminCommandCenterAttentionQueue.test.tsx src/views/admin/__tests__/AdminSettingsModule.test.tsx` — PASS, 2 pliki / 32 testy.
- `bash scripts/check-list-canon.sh src/components/Admin/AdminCommandCenterPanel.tsx` — PASS, 0 nowych naruszeń.
- `npx vitest run src/components/Admin/__tests__/AdminCommandCenterCostCapacity.test.tsx src/views/admin/__tests__/AdminSettingsModule.test.tsx` — PASS, 2 pliki / 31 testów.
- `npx esbuild src/components/Admin/AdminComplianceEvidencePanel.tsx --loader:.tsx=tsx --outfile=/dev/null` — PASS.
- `bash scripts/check-list-canon.sh src/components/Admin/AdminComplianceEvidencePanel.tsx` — PASS, 0 nowych naruszeń.
- `npx vitest run src/components/Admin/__tests__/AdminComplianceEvidencePanel.test.tsx src/views/admin/__tests__/AdminSettingsModule.test.tsx` — PASS, 2 pliki / 33 testy.
- `npx esbuild server/src/routes/admin/seats.routes.ts --platform=node --format=esm --outfile=/dev/null` — PASS.
- `npx esbuild src/components/Admin/AdminSeatsLicencesPanel.tsx --loader:.tsx=tsx --outfile=/dev/null` — PASS.
- `bash scripts/check-list-canon.sh src/components/Admin/AdminSeatsLicencesPanel.tsx` — PASS, 0 nowych naruszeń.
- `npx vitest run server/src/routes/__tests__/seats.routes.test.ts src/components/Admin/__tests__/AdminSeatsLicencesPanel.test.tsx src/views/admin/__tests__/AdminSettingsModule.test.tsx` — PASS, 3 pliki / 38 testów (ostrzeżenie testowe `act`, bez błędów).

## Migracje

Najwyższy ośmiocyfrowy prefiks na starcie: `20261072_finance_statement_pack_archive_command.sql`.
Nie dodano jeszcze migracji.

## Licznik ekranów

Podłączonych przed dyżurem: do ustalenia z białej listy na bazowym SHA.
Podłączonych po dyżurze: do ustalenia /56 (56, bo DEC-13 dodaje `command/organization-defaults`).

## Czego NIE zrobiłem i dlaczego

- Nie wykonano push, merge, deployu ani operacji Railway — zakazy Z1, Z2 i Z8.
- Nie dotknięto chronionych worktree właściciela ani Fali 0/1 — zakazy Z5 i Z6.
- Nie odblokowano `platform-operations`, nie zmieniono `ProtectedRoute` ani modelu uprawnień — zakazy Z11 i Z14.
- Nie wystawiono `purchaseSeats`, nie zbudowano łańcucha haszy i nie włączono nieegzekwowanych przełączników — pozycje świadomie poza zakresem.
