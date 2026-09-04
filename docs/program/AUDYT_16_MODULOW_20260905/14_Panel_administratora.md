# 14. Panel administratora — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

75 ekranów (67 + 8 Internal Tools), 20 odłożonych (D), 26 bez Twojej decyzji. Tu leży 8 tras, które zwykłemu zalogowanemu użytkownikowi zwracają błąd 500 (konta serwisowe, webhooki billingu, table-platform, report-builder), 3 z nich z surowym SQL. Zlecenia włączone od dziś.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Zlecenia (Case Workspace, trasa /zlecenia) | `VITE_ENABLE_CASE_WORKSPACE` | ON od dziś (parytet z demo) |
| Narzędzia wewnętrzne | `VITE_INTERNAL_TOOLS_ENABLED` | false na stagingu (ustawione wcześniej, nie ruszałem) |

## A. Zatwierdzone obrazy — 75 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `admin-ai-ai-incidents` | Incydenty AI | A | ok |  | `evidence/grafika/195-przelot-B/admin-ai-ai-incidents__PO__light.png` |
| `admin-audit-export-history` | Historia eksportów | A | ok |  | `evidence/grafika/195-przelot-B/admin-audit-export-history__PO__light.png` |
| `admin-audit-integrity` | Integralność | A | ok |  | `evidence/grafika/195-przelot-B/admin-audit-integrity__PO__light.png` |
| `admin-billing-plan-history` | Historia zmian planu | A | ok |  | `evidence/grafika/195-przelot-B/admin-billing-plan-history__PO__light.png` |
| `admin-billing-seats-licences` | Miejsca i licencje | A | ok |  | `evidence/grafika/195-przelot-B/admin-billing-seats-licences__PO__light.png` |
| `admin-command-agent-trace` | Ślad agentów | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-admin-command-agent-trace__PO__light.png` |
| `admin-command-ai-policy` | Polityka AI | A | ok |  | `evidence/grafika/217-trzy-rodziny/admin-command-ai-policy__PO__light.png` |
| `admin-command-audit` | Audyt SOC2 | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-admin-command-audit__PO__light.png` |
| `admin-command-benchmark` | Benchmark konsultingowy | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-admin-command-benchmark__PO__light.png` |
| `admin-command-center-panel` | Centrum dowodzenia | A | ok | Znowu nie mam pojęcia, co to jest. | `evidence/grafika/121-przeglad-calosci/admin-command-center-panel__PO__light.png` |
| `admin-command-cost-capacity` | Koszt i pojemność | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-admin-command-cost-capacity__PO__light.png` |
| `admin-command-overview` | Przegląd | A | ok |  | `evidence/grafika/217-trzy-rodziny/admin-command-overview__PO__light.png` |
| `admin-command-residency` | Rezydencja danych | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-admin-command-residency__PO__light.png` |
| `admin-command-retention` | Retencja | A | ok |  | `evidence/grafika/217-trzy-rodziny/admin-command-retention__PO__light.png` |
| `admin-health-dependencies` | Zależności | A | ok |  | `evidence/grafika/195-przelot-B/admin-health-dependencies__PO__light.png` |
| `admin-health-sla-slo` | SLA / SLO | A | ok |  | `evidence/grafika/195-przelot-B/admin-health-sla-slo__PO__light.png` |
| `admin-security-break-glass` | Break-glass | A | ok |  | `evidence/grafika/195-przelot-B/admin-security-break-glass__PO__light.png` |
| `admin-security-domains` | Domeny | A | ok |  | `evidence/grafika/195-przelot-B/admin-security-domains__PO__light.png` |
| `admin-security-service-accounts` | Konta usługowe | A | ok |  | `evidence/grafika/195-przelot-B/admin-security-service-accounts__PO__light.png` |
| `admin-security-sessions` | Sesje | A | ok |  | `evidence/grafika/195-przelot-B/admin-security-sessions__PO__light.png` |
| `admin-sso-self-service-card` | Logowanie firmowe SSO | A | ok |  | `evidence/grafika/07-realizacja-narzedzia-admin/admin-sso-self-service-card__PRZED__light.png` |
| `admin-team-access-reviews` | Przeglądy dostępów | A | ok |  | `evidence/grafika/195-przelot-B/admin-team-access-reviews__PO__light.png` |
| `admin-team-guests-external` | Goście i dostęp zewnętrzny | A | ok |  | `evidence/grafika/195-przelot-B/admin-team-guests-external__PO__light.png` |
| `admin-team-invitations` | Zaproszenia | A | ok |  | `evidence/grafika/202-czerwien/admin-team-invitations__PRZED__light.png` |
| `admin-team-members` | Użytkownicy | A | ok |  | `evidence/grafika/195-przelot-B/admin-team-members__PO__light.png` |
| `admin-team-ownership` | Własność | A | ok |  | `evidence/grafika/195-przelot-B/admin-team-ownership__PO__light.png` |
| `partner-settlements-view` | Rozliczenia partnerskie | A | ok |  | `evidence/grafika/grafika-14-ekranow/partner-settlements-view__RETRY__light.png` |
| `superadmin-platform-operations-day15` | Operacje platformowe | A | ok |  | `evidence/grafika/07-realizacja-narzedzia-admin/superadmin-platform-operations-day15__PRZED__light.png` |
| `admin-ai-configuration-versions` | Wersje konfiguracji | B | ok |  | `evidence/grafika/203-polski/admin-ai-configuration-versions__PRZED__light.png` |
| `admin-ai-personas` | Persony | B | ok |  | `evidence/grafika/195-przelot-B/admin-ai-personas__PO__light.png` |
| `admin-ai-quality-evaluations` | Jakość i ewaluacje | B | ok |  | `evidence/grafika/203-polski/admin-ai-quality-evaluations__PRZED__light.png` |
| `admin-audit-legal-hold` | Legal hold | B | ok |  | `evidence/grafika/203-polski/admin-audit-legal-hold__PRZED__light.png` |
| `admin-command-attention-queue` | Kolejka uwagi | B | ok | to ni jest szerokoś strony :( | `evidence/grafika/uwagi-zrobione-20260902/UW-14-03__admin-command-attention-queue__light.png` |
| `admin-command-dlp` | DLP | B | ok |  | `evidence/grafika/216-poprawione-dzis/mini-admin-command-dlp__PO__light.png` |
| `admin-command-organization-defaults` | Ustawienia domyślne organizacji | B | ok |  | `evidence/grafika/216-poprawione-dzis/mini-admin-command-organization-defaults__PO__light.png` |
| `admin-health-incident-history` | Historia incydentów | B | ok |  | `evidence/grafika/195-przelot-B/admin-health-incident-history__PO__light.png` |
| `admin-health-queues-jobs` | Kolejki i zadania | B | ok |  | `evidence/grafika/195-przelot-B/admin-health-queues-jobs__PO__light.png` |
| `admin-team-access-requests` | Wnioski o dostęp | B | ok |  | `evidence/grafika/195-przelot-B/admin-team-access-requests__PO__light.png` |
| `admin-team-roles-permissions` | Role i uprawnienia | B | ok |  | `evidence/grafika/195-przelot-B/admin-team-roles-permissions__PO__light.png` |
| `admin-team-teams` | Zespoły | B | ok |  | `evidence/grafika/195-przelot-B/admin-team-teams__PO__light.png` |
| `aios-agents` | Agents | B | ok |  | `evidence/grafika/195-przelot-B/aios-agents__PO__light.png` |
| `aios-connectors` | Connectors | B | ok | Dodaj tutaj także wersję w liście. Bo jak będzie dużo pozycji do dołączenia, to może być trudniej zarządzać, czyli zmiany widoków. | `evidence/grafika/195-przelot-B/aios-connectors__PO__light.png` |
| `aios-memory` | Memory & Scope | B | ok |  | `evidence/grafika/195-przelot-B/aios-memory__PO__light.png` |
| `aios-outcomes` | KPI/ROI & AI Ops | B | ok |  | `evidence/grafika/195-przelot-B/aios-outcomes__PO__light.png` |
| `model-catalog-table` | Katalog modeli | B | ok |  | `evidence/grafika/grafika-14-ekranow/model-catalog-table__PRZED__light.png` |
| `admin-audit-compliance-evidence` | Dowody zgodności | C | — |  | `evidence/grafika/146-admin-audit-health/admin-audit-compliance-evidence__PO__light.png` |
| `admin-audit-events` | Zdarzenia | C | — |  | `evidence/grafika/149-admin-rodziny/admin-audit-events__PO__light.png` |
| `admin-billing-plan-limits` | Plan i limity | C | — |  | `evidence/grafika/146-admin-billing/admin-billing-plan-limits__PO__light.png` |
| `admin-security-security-alerts` | Alerty bezpieczeństwa | C | — |  | `evidence/grafika/146-admin-security/admin-security-security-alerts__PO__light.png` |
| `admin-security-security-policy` | Polityka bezpieczeństwa | C | — |  | `evidence/grafika/146-admin-security/admin-security-security-policy__PO__light.png` |
| `admin-security-sso` | SSO | C | — |  | `evidence/grafika/146-admin-security/admin-security-sso__PO__light.png` |
| `aios-actions` | AI Actions | C | — |  | `evidence/grafika/146-aios/aios-actions__PO__light.png` |
| `aios-artifacts` | Artifacts | C | — |  | `evidence/grafika/146-aios/aios-artifacts__PO__light.png` |
| `aios-home` | AI OS — Home | C | — |  | `evidence/grafika/146-aios/aios-home__PO__light.png` |
| `aios-research` | Research Sessions | C | — |  | `evidence/grafika/146-aios/aios-research__PO__light.png` |
| `admin-ai-ai-audit` | Audyt AI | D | — |  | `evidence/grafika/kontrast-motywow/admin-ai-ai-audit__PO__light.png` |
| `admin-ai-ai-limits-budgets` | Limity i budżety | D | — |  | `evidence/grafika/kontrast-motywow/admin-ai-ai-limits-budgets__PO__light.png` |
| `admin-ai-ai-operations` | Operacje AI | D | — |  | `evidence/grafika/crimson-odwrocona-semantyka/admin-ai-ai-operations__PO__light.png` |
| `admin-ai-data-privacy` | Dane i prywatność | D | — |  | `evidence/grafika/kontrast-motywow/admin-ai-data-privacy__PO__light.png` |
| `admin-ai-models-providers` | Modele i dostawcy | D | — |  | `evidence/grafika/146-admin-ai/admin-ai-models-providers__PO__light.png` |
| `admin-ai-policy-autonomy` | Polityka i autonomia | D | — |  | `evidence/grafika/kontrast-motywow/admin-ai-policy-autonomy__PO__light.png` |
| `admin-audit-high-risk-changes` | Zmiany wysokiego ryzyka | D | — |  | `evidence/grafika/146-admin-audit-health/admin-audit-high-risk-changes__PO__light.png` |
| `admin-audit-retention-export` | Retencja i eksport | D | — |  | `evidence/grafika/146-admin-audit-health/admin-audit-retention-export__PO__light.png` |
| `admin-billing-billing-details` | Dane rozliczeniowe | D | — |  | `evidence/grafika/146-admin-billing/admin-billing-billing-details__PO__light.png` |
| `admin-billing-budgets-alerts` | Budżety i alerty | D | — |  | `evidence/grafika/146-admin-billing/admin-billing-budgets-alerts__PO__light.png` |
| `admin-billing-invoices` | Faktury | D | — |  | `evidence/grafika/146-admin-billing/admin-billing-invoices__PO__light.png` |
| `admin-billing-overview` | Przegląd | D | — |  | `evidence/grafika/146-admin-billing/admin-billing-overview__PO__light.png` |
| `admin-billing-payment-methods` | Metody płatności | D | — |  | `evidence/grafika/146-admin-billing/admin-billing-payment-methods__PO__light.png` |
| `admin-billing-usage-costs` | Wykorzystanie i koszty | D | — |  | `evidence/grafika/146-admin-billing/admin-billing-usage-costs__PO__light.png` |
| `admin-health-diagnostics` | Diagnostyka | D | — |  | `evidence/grafika/146-admin-audit-health/admin-health-diagnostics__PO__light.png` |
| `admin-health-platform-operations` | Operacje platformowe | D | — |  | `evidence/grafika/146-admin-audit-health/admin-health-platform-operations__PO__light.png` |
| `admin-health-service-status` | Stan usług | D | — |  | `evidence/grafika/146-admin-audit-health/admin-health-service-status__PO__light.png` |
| `admin-security-api-access` | Dostęp API | D | — |  | `evidence/grafika/crimson-odwrocona-semantyka/admin-security-api-access__PO__light.png` |
| `admin-security-risk-summary` | Podsumowanie ryzyka | D | — |  | `evidence/grafika/146-admin-security/admin-security-risk-summary__PO__light.png` |
| `admin-security-scim-lifecycle` | SCIM i cykl życia | D | — |  | `evidence/grafika/146-admin-security/admin-security-scim-lifecycle__PO__light.png` |

Bez Twojej decyzji (30): `admin-billing-overview`, `admin-billing-plan-limits`, `admin-billing-usage-costs`, `admin-billing-payment-methods`, `admin-billing-invoices`, `admin-billing-billing-details`, `admin-billing-budgets-alerts`, `admin-security-security-policy`, `admin-security-sso`, `admin-security-scim-lifecycle`, `admin-security-api-access`, `admin-security-security-alerts`, `admin-security-risk-summary`, `admin-audit-events`, `admin-audit-high-risk-changes`, `admin-audit-compliance-evidence`, `admin-audit-retention-export`, `admin-health-service-status`, `admin-health-diagnostics`, `admin-health-platform-operations`, `admin-ai-policy-autonomy`, `admin-ai-models-providers`, `admin-ai-ai-limits-budgets`, `admin-ai-data-privacy`, `admin-ai-ai-operations`, `admin-ai-ai-audit`, `aios-home`, `aios-actions`, `aios-research`, `aios-artifacts`.

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B2. Przyrząd pokazał kompozycję, której w produkcie nie ma (audyt przyrządu 01.09)

| Ekran | Kategoria | Co dokładał / zmieniał przyrząd | Ocena, którą dałeś |
|---|---|---|---|
| `superadmin-platform-operations-day15` | Kategoria 2 | `max-w-6xl p-6` | **A** |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `partner-settlements-view`: Ekran w calosci po angielsku — narzedzie wewnetrzne
- `partner-settlements-view`: ZOSTAJE po angielsku: kolumna TYP („Subscription"/„One Time") i pigułka „subscription" w podglądzie to WARTOŚCI DANYCH, nie etykiety; daty w formacie ISO (2026-07-10) zamiast polskiego; w banerze widoczny kod techniczny AMD-PRT-ECONOMICS-002 (2026-09-02)
- `model-catalog-table`: Reszta tabeli po angielsku — osobny, duzo wiekszy dlug tego ekranu nadzorcy
- `admin-billing-overview`: Karty po angielsku mimo lang=pl.
- `admin-billing-overview`: Crimson dekoracja (ikona text-primary-500).
- `admin-billing-plan-limits`: Przycisk „Przydziel plan i limity” variant="brand" = crimson na zwykłym CTA (AdminBillingFinOpsPanel.tsx:511).
- `admin-billing-usage-costs`: Mylący osobny slot menu dla identycznej treści.
- `admin-billing-payment-methods`: Surowy FilterableTable, brak kebab.
- `admin-billing-invoices`: FilterableTable, hideRowActions.
- `admin-billing-invoices`: Kwoty bez PLN.
- `admin-billing-budgets-alerts`: FilterableTable.
- `admin-billing-plan-history`: Drobne: nazwy planów 'Starter'/'Growth' po angielsku — nazwy handlowe, nie tłumaczone.
- `admin-team-roles-permissions`: Daty w formacie US.
- `admin-team-teams`: Kolumna Typ pokazuje surowe enumy consulting/finance/support.
- `admin-team-ownership`: Kolor wyróżnienia karty właściciela (tło/avatar/pigułka) to ciepły bursztyn/pomarańcz, wizualnie odróżnialny od crimson #85182F używanego gdzie indziej w aplikacji dla stanów krytycznych — nie flagowane jako naruszenie kanonu, ale warto zweryfikować w kodzie kolor dokładny.
- `admin-security-security-policy`: Wzorzec ADM-OWN-001 nienaprawiony tu.
- `admin-security-security-policy`: Surowe klasy slate/navy.
- `admin-security-security-policy`: Ikony crimson dekoracyjnie.
- `admin-security-scim-lifecycle`: Nie używa StandardTable.
- `admin-security-sessions`: toLocaleString bez locale (format zależny od przeglądarki).
- `admin-security-api-access`: Bespoke karty.
- `admin-security-api-access`: Crimson odznaki na każdym kluczu.
- `admin-security-security-alerts`: Typ/Dotkliwość surowe enumy (impossible_travel, critical).
- `admin-security-risk-summary`: Status: resolved po angielsku.
- `admin-security-risk-summary`: Crimson dekoracyjny.
- `admin-audit-events`: FilterableTable zamiast StandardTable.
- `admin-audit-events`: Placeholder szukania obcięty — potwierdzone na świeżym zrzucie ('Szukaj akcji, wykonaw...').
- `admin-audit-events`: NOWE, poważniejsze niż wcześniej odnotowane: kolumna 'Akcja' pokazuje surowe nazwy zdarzeń po angielsku i surowe ładunki JSON wprost w UI zamiast czytelnego opisu po polsku.
- `admin-audit-compliance-evidence`: Frontend czyta action/actor/risk, backend zwraca action_type/admin_id/risk_level (AdminComplianceEvidencePanel.tsx:81-110 vs adminP32.routes.ts:2208-2296) — zob. zgłoszenie #9 do toru funkcji.
- `admin-audit-legal-hold`: Tytuł po angielsku.
- `admin-health-service-status`: CAN_ACCESS_PLATFORM_OPERATIONS=false na sztywno, nigdy nie woła API.
- `admin-health-incident-history`: Link do nieistniejącego /admin/health/overview (AdminIncidentHistoryPanel.tsx:76) — zob. zgłoszenie #17 do toru funkcji.
- `admin-health-queues-jobs`: Statusy Succeeded/Running/Queued po angielsku; czerwień poprawna semantycznie.
- `admin-ai-policy-autonomy`: 100% po angielsku.
- `admin-ai-policy-autonomy`: Crimson na wybranej roli/focus/ikonie.
- `admin-ai-policy-autonomy`: Trzeci poziom tabów kolidujący nazewniczo z menu.
- `admin-ai-personas`: Karty pokazują surowy klucz (advisor_default) zamiast nazwy.
- `admin-ai-models-providers`: 2. poziom nawigacji w całości po angielsku.
- `admin-ai-models-providers`: Raw <table> z fałszywym self-exempt (ModelsProvidersTab.tsx:649) — zob. zgłoszenie #20 do toru funkcji.
- `admin-ai-models-providers`: Crimson na odznace PREMIUM.

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 3 w tym module (1 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `admin-command-attention-queue` | „to ni jest szerokoś strony :(" | 2026-09-01 | DO_NAPRAWY | Szerokość: ograniczenie 1200 px siedziało w NARZĘDZIU podglądowym, nie w produkcie — produkt ma 1280 px i responsywny odstęp. Zdjęte w ośmiu // Liczby odmieniają się po polsku: „1 dzień" zamiast „1 dni", „2 dni", „5 dni". Wcześniej każda liczba dostawała tę samą końcówkę. |
| `admin-command-center-panel` | „Znowu nie mam pojęcia, co to jest." | 2026-08-30 | ZROBIONE | To jest Centrum administracyjne: Panel Administratora, lewy pasek grup, zakladki Audyt SOC2 / DLP / Rezydencja danych / Retencja / Polityka  |
| `aios-connectors` | „Dodaj tutaj także wersję w liście. Bo jak będzie dużo pozycji do dołączenia, to może być trudniej zarządzać, czyli zmiany widoków." | 2026-09-01 | ZROBIONE | — |

### C2. Trasy, które zwykłemu zalogowanemu użytkownikowi zwracają 500 (pomiar 04.09, odbiór 312)

- `/api/admin/service-accounts` — surowy SQL ze stosem (`invalid input syntax for type uuid`)
- `/api/knowledge-graph/freshness/duplicates` — `group_concat` (funkcja SQLite na Postgresie) + stos
- `/api/report-builder/sources/upload_bundle` — `column coverage_percent does not exist` + stos
- `/api/billing/webhook-events`, `/api/billing/webhook-events/stats`, `/api/report-builder/definitions`, `/api/table-platform/admin/service-accounts`, `/api/table-platform/admin/sso`
- `/api/admin/health-panel/probes` — katalog 20 sond dostępny każdemu zalogowanemu OWNER-owi

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`PARTIAL_PASS / RED_LEGACY_7`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-14_ADMIN-20260903.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evidence/gr
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `08775ced65` (02.09 17
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-14_ADMIN.md`.
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: (wymaga konta administratora — to samo konto odbiorowe powinno mieć te uprawnienia)
otwórz Panel administratora → otwórz realną sekcję (np. użytkownicy albo audyt) → kliknij realny
wiersz → z kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: usunięty martwy plik-fantom jednej z flag (nazwa w kodzie nie
zgadzała się z niczym realnym); kolor pierścienia fokusu poprawiony w 26 miejscach; dostępność
doprowadzona do zera błędów.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Sekcja administracyjna otwiera się i pokazuje realne dane bez błędu?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/14_ADMIN/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
