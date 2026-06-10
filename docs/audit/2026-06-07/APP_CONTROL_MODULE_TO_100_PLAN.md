# Moduł Sterowania Aplikacją (SuperAdmin) — Plan do 100%

> Data: 2026-06-07 · Branch: Londyn · Autor: code-grounded audit (3 niezależne agenty + weryfikacja ręczna)
> Status metodyczny: **każda luka poniżej została potwierdzona w kodzie** (file:line). Zgodnie z [[finding_gap_reports_overstate]] dokumenty audytowe zawyżają luki ~1:7 — dlatego ten plan ignoruje twierdzenia dokumentów i opiera się wyłącznie na faktycznym kodzie runtime.

---

## 0. Werdykt (TL;DR)

Panel SuperAdmin jest **realnie zbudowany i podłączony do backendu** — to mocna płaszczyzna aplikacji, nie makieta. Audyt frontendu nie znalazł **ani jednego** mocka/„coming soon"/`Math.random` w **dostępnej z sidebaru** powierzchni. Wszystkie 5 sekcji (Customers, AI Platform, System, Governance, Security) + Revenue + Virtual Workers są wired do prawdziwych endpointów.

Do „100% gotowego modułu sterowania" brakuje **trzech kategorii, wszystkie zweryfikowane**:

1. **6 realnych stubów backendowych** — funkcje, które UI wywołuje, ale backend zwraca 503 / dane fałszywe / nic nie zapisuje.
2. **Klaster martwego kodu frontendowego** (~22 pliki) — nieosiągalny z sidebaru; generuje fałszywe audyty i ryzyko regresji.
3. **3 domeny sterowania z SSOT, jeszcze niezamontowane** — Connector Fleet, Partner Control Tower, Demo/Trial v8.

**Najważniejsza rozbieżność obietnica↔kod:** strona sprzedaje plany **Trial / User €29 / Admin €49 / Enterprise**, a katalog planów w panelu (`getPricingPlans`) jest **hardcodowany na „free / pro $99 / enterprise $499"** i create/update/delete **nic nie zapisują**. SuperAdmin nie potrafi dziś zarządzać planami, które reklamuje strona.

Szacowana realna „kompletność" modułu sterowania: **~88%** (nie 38% jak sugerował audyt 06-02, ale i nie 100%).

---

## 1. Co jest REALNE (potwierdzone — NIE ruszać)

Pełne, DB-backed, działające domeny sterowania:

| Domena | Powierzchnia | Stan |
|---|---|---|
| Tenants/Organizacje | Command Center, Organizations (CRUD, suspend, purge), szczegóły org | REAL |
| Użytkownicy cross-tenant | UserManagement, impersonacja, access review | REAL |
| IAM / RBAC | Custom Roles Builder, Permissions Matrix (DB `role_permissions`), SSO, SCIM, Policies | REAL |
| AI Platform | LLM Providers, Model Tiers, Routing, Prompts, Model Registry, Observability, Health, Cost | REAL |
| **AI Budgets** | zapis przez `aiBudgetService` **i egzekwowane** w `AIPipeline.ts:256-308` (rzuca „AI budget exceeded") | REAL ✅ (wcześniejszy audyt mylił się twierdząc, że limity nie są czytane) |
| Revenue/Billing | Subskrypcje, faktury, recognition, payment methods, partner settlements (Stripe-gated) | REAL |
| Governance | Audit logs, Approvals, Compliance Center, Legal, Data Exports | REAL |
| Security | Incidents, Threats, DLP, Sessions, Audit Events | REAL |
| Feature Flags / Module Access | Enterprise panels, ModuleAccessControl | REAL |
| Virtual Workers | WorkersList → WorkerDetail (API-backed) | REAL |

---

## 2. LUKI POTWIERDZONE W KODZIE (lista robocza)

### 2A. Realne stuby backendowe (6)

| # | Co | Plik:linia | Zachowanie dziś | Skutek dla UI |
|---|---|---|---|---|
| S-1 | **Backup/Restore — cały router** | `server/src/routes/backup.routes.ts:12-20` | `router.use` → bezwarunkowy **503 not_configured** | Każdy przycisk backupu = błąd. Brak DR. |
| S-2 | **Katalog planów cenowych** | `server/src/controllers/superadmin/revenueController.ts:8-44,71-75` | `getPricingPlans` hardcode (free/pro $99/ent $499); create/update/delete **nie zapisują**; `comparePricingPlans` → `[]` | Nie da się zarządzać planami ze strony (€29/€49). **Obietnica↔kod.** |
| S-3 | **Email alert subscriptions** | `server/src/services/presentationGovernanceAlertService.ts:605-619` | kanał `email` → zapis `dry_run`/`email_channel_stub_only`, **mail nigdy nie wychodzi** (webhook i slack działają) | Alerty governance „wysłane", ale nie docierają mailem. |
| S-4 | **calculateProration** | `revenueController.ts:~140` | `503 'Proration calculation is not available'` | Zmiana planu w trakcie cyklu nie liczy proraty. |
| S-5 | **Branding logo upload** | `server/src/controllers/SuperAdminController.ts:~1847` | `503 FEATURE_UNAVAILABLE` | White-label/branding nie przyjmuje logo. |
| S-6 | **Fałszywe dane finansowe** | `revenueController.ts:371-393` (`generateRevenueForecast`) + `:504-527` (`retryPayment`) | `Math.random()` jako prognoza i jako wynik retry płatności | Decyzje na zmyślonych liczbach. **Usunąć lub oznaczyć jako symulacja.** |

### 2B. Martwy kod frontendowy (do usunięcia — ~22 pliki)

Nieosiągalne z `SuperAdminSidebar`/routingu, importowane tylko przez inne martwe pliki lub barrel:

- **OverviewModule chain:** `OverviewModule.tsx`, `SuperAdminDashboard.tsx`, `SuperAdminMetricsView.tsx`, `SuperAdminSignalsView.tsx`, `FeatureUpdatesAdminView.tsx`
- **Legacy single panels** (zastąpione przez `system/Enterprise*Panel`): `ApiManagementPanel`, `ConfigurationPanel`, `FeatureFlagsPanel`, `IntegrationsPanel`, `SecurityPanel`, `BackupPanel`, `AnalyticsPanel`
- **Content/Email management** (żaden tab nie montuje): `ContentSearch`, `ContentFilters`, `BulkActions`, `ContentCategoriesManager`, `ContentTagsManager`, `EmailTemplatesPanel`, `EmailConfigurationPanel`, `PartnerOutreachPanel`, `EmailTemplatesView`, `EmailTemplateEditor`, `ContentAnalyticsDashboard`
- **Playbook duplikaty** (live używa `CustomerSuccessPlaybooksView`): `PlaybookTemplatesListView.tsx`, `PlaybookEditorView.tsx`
- **Static stub:** `SuperadminRootClosurePanel.tsx`

> ⚠️ Przed `git rm` każdego pliku: `grep -r "ComponentName" src/` — potwierdzić 0 odwołań poza barrel/innym martwym plikiem. Usuwać też wpisy z `index.ts` (barrel).

### 2C. Domeny z SUPERADMIN_V8_SSOT jeszcze niezamontowane

Z `docs/product/SUPERADMIN_V8_SSOT.md` (gap list), zweryfikowane jako brakujące w routingu:

- **Connector Fleet** — brak mountu (osobny runtime SSOT istnieje).
- **Partner Control Tower** — narzędzia ukryte/niepodłączone do sidebaru.
- **Demo/Trial** — wciąż na v3 (`DEMO_TRIAL_V3.md`), brak konsoli v8.
- **Audit/Compliance console** — częściowa (komponenty są, brak spójnej konsoli).

### 2D. Dług architektoniczny (do konsolidacji, nie blokuje GA)

- **3 równoległe systemy budżetu AI na tej samej tabeli `ai_budgets`:** `aiBudgetService` (kolumny `budget_limit`/`current_usage` — TO egzekwuje AIPipeline ✅), `aiCostControlService` (`monthly_limit_usd`...), `preflightCostService` (czyta `organizations.monthly_budget_usd`, tylko doradczo). Działa, ale ryzyko rozjazdu — patrz [[project_system_unification]].
- Stała nazwa paczki `consultinity` vs brand **Consultify**; `docs/executive/EXECUTIVE_SUMMARY.md` opisuje przestarzałe „IRIS 6.0" — flaga porządkowa, nie kod.

---

## 3. Definicja „100%" (miary akceptacji)

Moduł sterowania jest „100%", gdy:

1. **Zero stubów w dostępnej powierzchni** — każdy przycisk/akcja w panelu albo działa end-to-end (DB/zewn. usługa), albo jest świadomie ukryty za feature-flagą z czytelnym stanem „niedostępne" (nie 503/`Math.random`).
2. **Obietnice = kod** — plany, ceny, seaty, budżety AI, feature flags, limity reklamowane na `PricingLandingPage.tsx` są **definiowalne i egzekwowalne** z panelu.
3. **Każda akcja sterująca = trwały audit record** (who/when/what/why) — mandat W7-7 z `SUPERADMIN_V8_SSOT.md`.
4. **Brak martwego kodu** w `src/components/SuperAdmin` i `src/views/superadmin` (eliminuje fałszywe audyty).
5. **Domeny SSOT zamontowane** lub jawnie odłożone decyzją właściciela (Connector Fleet, Partner Tower, Demo/Trial v8).
6. **Dowód wizualny per-tab** zgodnie z [[rule_verify_before_claiming]] — screenshot każdej sekcji na żywym koncie SUPERADMIN.

---

## 4. PLAN WYKONAWCZY (fazy)

### Faza 0 — Setup & uruchomienie (0.5 dnia)
- [ ] Start aplikacji: `npm run dev:londyn` (lub `npm run dev:staging`) → backend :3001, frontend :3000.
- [ ] Zalogować konto **SUPERADMIN** (nie OWNER — patrz [[finding_interview_rbac_admin_gap]]); wejść na `/superadmin`.
- [ ] Smoke każdej z 5 sekcji + Revenue + Virtual Workers — potwierdzić baseline „REAL działa".
- [ ] Screenshot baseline (dowód startowy).

### Faza 1 — Eliminacja stubów blokujących obietnice (2-3 dni) ⭐ priorytet
Kolejność wg wpływu na obietnice ze strony:
- [ ] **S-2 Katalog planów** → tabela `pricing_plans` (migracja) + pełny CRUD w `revenueController.ts`; seed planami **Trial/User €29/Admin €49/Enterprise** zgodnie z `PricingLandingPage.tsx`. `comparePricingPlans` liczy realnie. Spiąć z `plan_features` (już DB-backed).
- [ ] **S-4 calculateProration** → realna proraty na bazie `pricing_plans` + cyklu subskrypcji (zamiast 503).
- [ ] **S-6 Fałszywe finanse** → `generateRevenueForecast` na realnych danych historycznych (`revenue_recognition`); `retryPayment` realny retry przez Stripe lub jawny „symulacja" za flagą. **Usunąć `Math.random` ze ścieżki decyzyjnej.**
- [ ] Acceptance: utworzenie planu w panelu → widoczne w katalogu → egzekwowane (seat/limit). Audit record dla każdej zmiany planu.

### Faza 2 — Domknięcie operacji platformy (2-3 dni)
- [ ] **S-1 Backup/Restore** → decyzja: (a) implementacja `BackupService` (pg_dump/snapshot + restore + harmonogram) i podpięcie routera, albo (b) jawne ukrycie zakładki za flagą `BACKUP_ENABLED=false` z komunikatem „skonfiguruj backup", zamiast martwego 503.
- [ ] **S-3 Email alerts** → realny kanał email przez istniejący mailer (ten sam, którego używa reszta appki); usunąć `email_channel_stub_only`. Test: subskrypcja email → mail dochodzi.
- [ ] **S-5 Branding logo** → upload do storage (jak inne uploady w appce) + zapis URL; zdjąć 503.
- [ ] Acceptance: backup wykonuje i odtwarza (lub czysto ukryty); email alert dochodzi; logo zapisuje się i renderuje w white-label.

### Faza 3 — Czyszczenie martwego kodu (1 dzień) ✅ DONE 2026-06-07
- [x] Usunięto **26 martwych plików** (8 views + 18 components) po `grep` potwierdzeniu 0 realnych ref — `git rm`.
- [x] Wyczyszczono barrel `src/components/SuperAdmin/index.ts` (4 martwe eksporty: EmailTemplatesPanel, FeatureFlagsPanel, IntegrationsPanel, EmailConfigurationPanel). `system/index.ts` nietknięty — jego `ConfigurationPanel/SecurityPanel/BackupPanel/AnalyticsPanel` to aliasy do żywych `Enterprise*`.
- [x] `npm run type-check` → **exit 0, 0 błędów**. Brak wiszących importów (pozostałe trafienia to `Api.getSuperAdminDashboard()` — żywa funkcja API, nie usunięty komponent).

### Faza 4 — Domeny SSOT (decyzja właściciela: GA vs post-GA)
- [ ] **Connector Fleet** — zamontować w sidebarze + podpiąć runtime.
- [ ] **Partner Control Tower** — odsłonić narzędzia (`SUPERADMIN_PARTNER_CONTROL_TOWER_RUNTIME_V8.md`).
- [ ] **Demo/Trial v8** — konsola sterowania demo/trial (obecnie v3).
- [ ] **Audit/Compliance console** — spiąć istniejące komponenty w jedną konsolę.
- [ ] *Te 4 to kandydaci do post-GA — patrz decyzje §6.*

### Faza 5 — Konsolidacja długu (post-GA, opcjonalnie)
- [ ] Zunifikować 3 systemy budżetu AI na jeden kontrakt (`aiBudgetService` jako SSOT egzekucji) — [[project_system_unification]].
- [ ] Uporządkować nazwę paczki/brand; zarchiwizować `EXECUTIVE_SUMMARY.md` (IRIS 6.0).

### Faza 6 — Dowód i odbiór (0.5 dnia)
- [ ] Per-tab screenshot każdej sekcji na żywym SUPERADMIN ([[rule_verify_before_claiming]]).
- [ ] Test każdej naprawionej akcji end-to-end + sprawdzenie audit record.
- [ ] Wspólny re-walk z właścicielem.

---

## 5. Uruchomienie aplikacji (komendy)

```bash
# Stop ewentualnych zajętych portów
npm run dev:stop

# Wariant brancha Londyn (rekomendowany dla tej gałęzi)
npm run dev:londyn          # frontend :3000, backend :3001
# albo --live z pełnym logowaniem AI
npm run dev:londyn:live

# Wariant staging (domyślny)
npm run dev:staging         # wymaga .env.staging.local

# Weryfikacja typów/lintu po zmianach
npm run type-check
npm run lint
```

Panel: `http://localhost:3000/superadmin` (rola SUPERADMIN; SUPERADMIN jest auto-redirectowany z `/chat` na `/superadmin`).

---

## 6. Decyzje właściciela (PODJĘTE 2026-06-07)

1. **Kolejność:** start od **Fazy 3 (czyszczenie martwego kodu)**, potem Faza 1, potem Faza 2.
2. **Backup (S-1):** **zbudować realny `BackupService`** (pg_dump/snapshot + restore + harmonogram).
3. **Plany cenowe (S-2):** pełny katalog zarządzalny z panelu (Faza 1).
4. **Domeny SSOT (Faza 4):** **post-GA** (Connector Fleet / Partner Tower / Demo-Trial v8 / Audit console).
5. **Forecast/retry (S-6):** **realne dane od razu** — usunąć `Math.random` ze ścieżki decyzyjnej.

**Wynikowa kolejność wykonania:** Faza 0 → **Faza 3** → Faza 1 → Faza 2 → (Faza 5 dług) → Faza 6 dowód. Faza 4 odłożona post-GA.

---

## 7. Mapa plików (punkty wejścia do pracy)

**Frontend:** `src/views/superadmin/SuperAdminView.tsx` (router) · `src/components/layout/SuperAdminSidebar.tsx` · moduły w `src/views/superadmin/*Module.tsx` · komponenty `src/components/SuperAdmin/`
**Backend:** `server/src/routes/superadmin.routes.ts` · `server/src/controllers/superadmin/*` · `server/src/middleware/superAdmin.middleware.ts` (capabilities: platform_ops/security_ops/billing_ops/support_ops/ai_ops)
**Stuby do naprawy:** `backup.routes.ts` · `revenueController.ts` · `presentationGovernanceAlertService.ts` · `SuperAdminController.ts`
**SSOT odniesienia:** `docs/product/SUPERADMIN_V8_SSOT.md` · `docs/product/BUSINESS_POSITIONING_SSOT.md` · `src/views/PricingLandingPage.tsx` · `docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
