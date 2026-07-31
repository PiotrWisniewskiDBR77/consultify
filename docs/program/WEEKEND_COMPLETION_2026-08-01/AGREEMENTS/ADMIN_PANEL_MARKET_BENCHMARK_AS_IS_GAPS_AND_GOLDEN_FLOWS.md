---
doc_kind: BENCHMARK_AND_GAP_AUDIT
status: DRAFT_FOR_OWNER_REVIEW
owner: Piotr Wisniewski
last_updated: 2026-07-31
module: Admin Panel
---

# Admin Panel — benchmark, remanent kodu, luki i golden flows

## 1. Benchmark rynku

### Asana

Asana rozdziela konsolę administratora od administracji zespołem i skupia w niej ludzi, zespoły, role, bezpieczeństwo, integracje, billing i wykorzystanie. Ma role standardowe i custom roles; goście podlegają ograniczeniom zewnętrznego użytkownika. Wniosek: Consultify potrzebuje delegowanych kompetencji, a nie wyłącznie pełnego `ADMIN`.

Źródła: [Admin console](https://help.asana.com/s/article/how-to-access-the-admin-console?language=en_US), [member and team management](https://help.asana.com/s/article/member-and-team-management?language=en_US), [role-based access control](https://help.asana.com/s/article/role-based-access-control-with-custom-roles), [team permissions](https://help.asana.com/s/article/team-permissions?language=en_US).

### Slack

Slack rozróżnia role i system roles oraz zakres organizacji i workspace; dashboard administracyjny grupuje People, Channels, Slack Connect, Billing, Analytics, Security i Settings. Wniosek: rola i zakres muszą być osobnymi wymiarami, a administracja może być delegowana domenowo.

Źródła: [permissions by role](https://slack.com/help/articles/201314026-Permissions-by-role-in-Slack), [Admin dashboard](https://slack.com/help/articles/115005594006-Guide-to-the-Slack-Admin-dashboard).

### Microsoft Entra

Entra modeluje role jako `principal + role + scope`, wykorzystuje grupy do nadawania dostępu, a Conditional Access łączy assignments, warunki i controls. Dzienniki pozwalają ustalić zastosowaną politykę i zmianę konfiguracji. Wniosek: Consultify powinno przechowywać jawne nadanie, scope, dziedziczenie i policy evaluation, a nie tylko końcową nazwę roli.

Źródła: [groups](https://learn.microsoft.com/en-us/entra/fundamentals/concept-learn-about-groups), [role assignments](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/view-assignments), [Conditional Access](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-policies), [policy audit](https://learn.microsoft.com/en-us/entra/identity/conditional-access/troubleshoot-policy-changes-audit-log).

## 2. Remanent rzeczywistego runtime — 2026-07-31

Canonical shell: `src/views/admin/AdminSettingsModule.tsx`, chroniony w `src/routes/AppRoutes.tsx` przez `ProtectedRoute requiredRole="ADMIN"`.

| Zamontowana sekcja | Komponent | Ocena remanentu |
| --- | --- | --- |
| People | `AdminMembersRolesPanel` | realna lista członków, role Owner/Admin/Member/Guest, zaproszenia i kod; brak pełnego modelu Consultant, grup, kompetencji i scope |
| Billing | `AdminBillingFinOpsPanel` | rozbudowany shell planu, limitów, płatności, faktur i budżetów; wymaga pełnego E2E i rozdzielenia kompetencji billingowej |
| AI | `AdminAIControlCenterPanel` | governance settings i AI operations; brakuje jednolitego policy engine, approval classes i efektywnego dziedziczenia |
| Security | `AdminSecurityIdentityPanel` | policy, collaboration, API access, IAM, SCIM i risk; dobry fundament, do udowodnienia egzekucja backendowa |
| Audit | `AdminAuditLogPanel` | log, ryzyko/incydenty, compliance i eksport; potrzebny kanoniczny event/diff i coverage wszystkich mutacji |
| Command | `AdminCommandCenterPanel` | za flagą; Overview, agent trace, SOC2, DLP, residency, retention, AI policy i benchmark; ryzyko dublowania sekcji źródłowych |
| Health | `AdminHealthPanel` | realne probe API/DB; to diagnostyka, nie ogólny dashboard biznesowy |

Stary `ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md` jest częściowo nieaktualny: wymienia `overview`, `integrations` i `operations` jako zamontowane panele, lecz aktualny `PRIMARY_SECTIONS` ich nie zawiera, a aliasy kierują część tych adresów do `people` lub `security`. Implementacja jest źródłem prawdy dla stanu AS-IS; kontrakt produktu jest źródłem prawdy dla TO-BE.

## 3. Luki priorytetowe

### P0 — przed wiarygodnym stagingiem

1. Ujednolicić routing/inventory i usunąć fałszywe deklaracje zamontowanych ekranów.
2. Wymusić tenant scope i granularne capabilities na backendzie; samo `requiredRole="ADMIN"` jest za szerokie.
3. Dodać role projektowe, zespoły projektowe, ManagerScope i prosty workflow inicjatywy.
4. Zdefiniować krytyczne akcje, reauth, diff, approval i pełny audit event.
5. Udowodnić E2E People, AI policy, Security policy, Billing read-back i Audit export.
6. Rozstrzygnąć Command Center: summary + linki; bez równoległej edycji tej samej polityki.

### P1

7. Connections jako jawna sekcja organizacyjna z polityką i health.
8. Delegowane admin roles, grupy, czasowe nadania i access review.
9. Policy inheritance/effective policy, simulator, staged rollout i rollback.
10. Overview z ryzykami i akcjami, bez vanity metrics.

### P2

11. SSO/SCIM klasy enterprise, conditional access, legal hold, zaawansowane DLP i compliance packs.
12. Automatyczne okresowe przeglądy dostępu i wykrywanie anomalii.

## 4. Golden flows odbiorowe

1. **Joiner:** admin zaprasza Membera do projektu → użytkownik dostaje najniższą rolę projektową → dostęp jest widoczny w effective access i audycie.
2. **Role upgrade:** Project Admin proponuje upgrade → właściwy approver zatwierdza → API egzekwuje nowy zakres, a wcześniejsza wersja zostaje w historii.
3. **Manager:** Admin nadaje capability i zakres projektu → Manager widzi obciążenie projektu, ale nie widzi prywatnej notatki ani osoby spoza zakresu.
4. **Initiative governance:** projekt dziedziczy prosty workflow → draft przechodzi walidację, go/no-go i potwierdzenie zasobów → trafia do Execution z kompletem ról.
5. **AI policy:** AI Admin blokuje model dla danych poufnych → symulacja pokazuje wpływ → po publikacji UI i bezpośrednie API respektują regułę → trace zapisuje decyzję.
6. **Connector:** Admin dopuszcza provider i scopes → użytkownik łączy konto w Settings → synchronizacja działa → revoke unieważnia token i jest audytowany.
7. **Leaver:** konto zostaje zawieszone → sesje i tokeny tracą ważność → obiekty firmowe mają nowego ownera → historia pozostaje.
8. **Critical security change:** Security Admin tworzy zmianę → simulator → drugi approver → reauth → staged rollout → read-back → rollback w razie błędu.
9. **Billing boundary:** Billing Admin widzi wykorzystanie i fakturę, ale nie treść promptów ani dokumentów.
10. **Tenant isolation:** administrator organizacji A nie odczyta ani nie zmieni żadnego obiektu organizacji B przez UI ani API.

## 5. Minimalna macierz testów

- unit: policy resolution, role inheritance, separation of duties, workflow validation;
- API integration: tenant isolation, capabilities, read-back, idempotency, audit emission;
- E2E: wszystkie golden flows z dwoma tenantami i rolami negatywnymi;
- security: IDOR, privilege escalation, stale token, secret redaction, export authorization;
- accessibility/visual: desktop i wspierany mobile state, keyboard, focus, empty/error/degraded;
- recovery: partial failure, timeout, retry, rollback i przerwanie wieloetapowej operacji.

## 6. Pytania do końcowego odbioru

Pytania zbieramy do wspólnej rundy po całej dokumentacji; nie blokują obecnego draftu:

1. Czy `Consultant` jest zawsze rolą aplikacyjną, czy może być także relacją zewnętrzną per projekt?
2. Kto domyślnie zatwierdza go/no-go inicjatywy: Project Owner czy Sponsor?
3. Czy Command Center pozostaje osobną sekcją, czy staje się Overview?
4. Czy Health widzi każdy Admin, czy wyłącznie Technical/Integration Admin?
