# Consultify — Finalna dokumentacja dokończenia (wszystkie 19 modułów → 100%)

**Data:** 2026-06-03 · **Autor:** code-verified audit (dokumentacja + kod + cel/wizja modułu)
**Zakres:** rygorystyczna ocena gotowości każdego z 19 modułów do pełnej pracy, integracji z Teresą i resztą systemu, oraz sekwencjonowany plan dokończenia do 100%.
**Per-moduł dossiers:** `COMPLETION_01..19_*.md` (ten katalog). Ten dokument je spina w jeden program.

---

## 0. Werdykt nadrzędny

System jest **funkcjonalnie szeroki i backendowo mocny**, ale dzieli go od „100%" **jeden powtarzalny, systemowy dług**, nie zaś braki w pojedynczych modułach.

> **Główne odkrycie audytu: „Teresa-integration-as-UI-illusion".**
> W większości modułów warstwa AI jest *zbudowana i podpięta przyciskami*, ale **martwa w ścieżce wykonania** — handler nie istnieje, komponent nigdy nie jest zamontowany, flaga jest domyślnie wyłączona, albo „AI" to regex/keyword zamiast LLM. Użytkownik widzi obietnicę Teresy, której kliknięcie nic nie robi.

To jest naprawialne **bez przepisywania** — to podpinanie istniejących końcówek. Stąd realny koszt dojścia do 100% jest dużo niższy niż sugerowałby zakres.

### Średnia gotowość
- **17 modułów aktywnych** (bez 14/15 odroczonych per D7): **~74/100**.
- **2 moduły odroczone** (14 MCP/Iris = 22, 15 Marketplace = 14): świadomie sparkowane, plan „po v1".

---

## 1. Tablica wyników (scoreboard)

| # | Moduł | Score | Tier | Teresa w ścieżce wykonania | Główny blocker do 100% |
|---|---|---|---|---|---|
| 01 | Czat | **87** | Production | ✅ Działa (rdzeń systemu AI) | Long-tail: streaming edge-cases, attachments |
| 03 | Wywiad | **84** | Strong | ⚠️ Zbudowana, **nie zamontowana** (ConversationalPanel+SufficiencyIndicator) | Zamontować panel konwersacyjny |
| 16 | Organizacja | **81** | Strong | ✅ 4 ścieżki kontekstu; ❌ **KG nie wstrzykiwany** | InvitationSendingService = stub (P0); KG→Teresa |
| 12 | Prezentacje | **79** | Strong | ⚠️ `applyPresentationEditPlan` = regex, nie LLM | Prawdziwy LLM edit-plan |
| 09 | Outputs | **78** | Strong | ✅ Działa | Long-tail eksporty/typy |
| 11 | Tabele | **77** | Strong | ⚠️ Częściowa | Podpięcie AI-akcji tabel |
| 18 | Ustawienia | **76** | Beta+ | ⚠️ Ustawienia AI **zapisują się, nie sterują** Teresą | 3× P0 (GDPR delete bez hasła, deleteAccount stub, AI-settings 503) |
| 05 | Inicjatywy | **74** | Beta+ | ⚠️ Częściowa | Apply-handlery AI |
| 07 | Rezultaty | **74** | Beta+ | ⚠️ Częściowa | ROI/benefit AI apply |
| 13 | Meeting | **72** | Beta+ | ❌ `meetingIntelligenceService.llmClient` = **trwale null** | Wstrzyknąć llmClient |
| 08 | Finanse | **72**/62 | Beta / Beta- | ⚠️ Modeling tak, billing manualny | Manualny billing → automacja |
| 06 | Realizacja | **71** | Beta | ⚠️ Częściowa | Apply-handlery AI |
| 10 | Dokumenty | **71** | Beta | ❌ `documentTeresaIntent.ts` importowany **tylko w testach** | Podpiąć intent w produkcie |
| 19 | Partner | **69** | Beta | ❌ Brak (CommissionIntelligence = useMemo, nie LLM) | `@ts-nocheck` P0; dead buttons |
| 02 | Moja Praca | **68** | Beta | ⚠️ Częściowa | Spójność danych/tasks |
| 17 | Admin | **67** | Beta | ❌ Budżety AI **dekoracyjne** (ai.routes nie czyta limitów) | Podpiąć limity; zamontować 8 sub-tabów AI |
| 04 | Narzędzia | **65** | Beta- | ❌ 9 narzędzi pokazuje przyciski Teresy bez apply-handlera | Apply-handlery + DB fix |
| — | — | — | — | — | — |
| 14 | MCP/Iris | **22** | Deferred | ❌ | Odroczone (po v1) |
| 15 | Marketplace | **14** | Deferred | ❌ | Odroczone (po v1, zależność: usługa DBR77) |

---

## 2. Dziewięć systemowych tematów (powtarzają się między modułami)

1. **Teresa-as-illusion** — przyciski AI bez handlera / niezamontowane panele / flagi off / regex zamiast LLM. **(04, 03, 10, 12, 13, 17, 18 — najwięcej ROI)**
2. **Kontekst organizacji nie domyka pętli** — `aiContextBuilder` wstrzykuje claim-snapshot, ale **Knowledge Graph nie trafia do promptu** (16). Teresa nie umie „kto jest właścicielem X".
3. **Dual-path context builder** — kanoniczny `services/aiContextBuilder.ts` vs legacy `ai/aiContextBuilder.ts` (`@ts-nocheck`, węższy zestaw pól). Rozjazd źródeł prawdy kontekstu.
4. **Governance dekoracyjny** — limity/budżety AI (Admin 17) zapisywane do `organization_limits`, ale `ai.routes.ts` ich nie czyta przed routingiem Teresy. `setBudgetConfig()` bez wywołań.
5. **Audyt z dziurami** — najczulsze mutacje (zmiana roli/usunięcie membera w 17 idzie przez route org 16; profil/webhooks/working-hours w 18) **nie logują** `adminAuditService`.
6. **Bezpieczeństwo: niespięte ścieżki** — GDPR-delete bez bramki hasła (18), `deleteAccount` stub (18), BYOK plaintext w DB mimo deklaracji „never sent" (18), `@ts-nocheck` na 2898-liniowym `partners.routes.ts` (19).
7. **Stuby produkcyjne podane jako gotowe** — Invitation email (16), per-org email (17), backup 503 (17), Calendar 501 (18), `POST /clients`/`GET /invoices` 503 (19), 12 stubów partnera ukrytych.
8. **DB adapter / init mismatch** — tabele MCP/marketplace brak w `DatabaseInitializer` (SQLite silent-fail), mieszanka `$1` (PG) i `?` (SQLite) (14, 15).
9. **Color/UI drift** — `bg-primary-600`/violet zamiast crimson w panelach admin; rozjazd vs system kolorów (cross-cutting → patrz `_DESIGN_SYSTEM_STANDARDIZATION_PLAN.md`).

---

## 3. Program dokończenia — sekwencjonowany do 100%

Filozofia: **najpierw spiąć to, co już zbudowane** (najwyższy ROI, najmniej ryzyka), potem governance/bezpieczeństwo, potem długie ogony i moduły odroczone.

### WAVE A — „Teresa naprawdę działa" (rdzeń wartości produktu)
Spina martwą warstwę AI w ścieżkę wykonania. Każda pozycja = podpięcie istniejącego kodu.
- **A1** Wstrzyknąć `llmClient` do `meetingIntelligenceService` (13) — odblokowuje AI spotkań.
- **A2** Zamontować `ConversationalPanel` + `SufficiencyIndicator` w Wywiadzie (03).
- **A3** Podpiąć `documentTeresaIntent.ts` w produkcie, nie tylko w testach (10).
- **A4** Apply-handlery dla przycisków Teresy: 9 narzędzi (04), Inicjatywy (05), Realizacja (06), Rezultaty (07).
- **A5** `applyPresentationEditPlan` → realny LLM edit-plan zamiast regex (12).
- **A6** Ustawienia AI sterują Teresą: wpiąć `effective.{temperature,tone,proactivity,instructions}` w `ai.routes.ts:1799-1811` + system prompt (18).
- **A7** Knowledge Graph snapshot → kontekst Teresy (16); ujednolicić dual-path context builder (16/temat 3).

### WAVE B — Governance, bezpieczeństwo, zaufanie (GA-blockers)
- **B1** GDPR-delete: UI woła bramkowaną hasłem końcówkę `/api/settings/gdpr/...`; zaimplementować `deleteAccount` (18) — **P0 bezpieczeństwo**.
- **B2** AI-settings: zamontować łaskawy fallback zamiast hard-503 (18).
- **B3** Limity/budżety AI realnie egzekwowane: `ai.routes.ts` czyta `organization_limits` + `cost-monitoring.setBudgetConfig()` ma wywołania (17) — **P0 governance**.
- **B4** Zamontować 8 zbudowanych sub-tabów Admin/AI (`AccessLimitsTab` itd.) (17).
- **B5** Audyt najczulszych mutacji: role/remove member (17), profil/webhooks/working-hours (18).
- **B6** `partners.routes.ts`: zdjąć `@ts-nocheck`, zabezpieczyć payout/auth (19) — **P0**.
- **B7** BYOK: szyfrowanie kluczy w DB (18).

### WAVE C — Stuby → realne końcówki
- **C1** InvitationSendingService SMTP/SendGrid (16).
- **C2** Per-org email zamiast `billing@example.com` (17); backup routes (17).
- **C3** Dead buttons partnera: Export CSV, QR, „Add Organization"; `usePartnerEcosystem` → realne API; `POST /clients`, `GET /invoices` (19).
- **C4** Calendar sync: „Coming soon" zamiast 501 (18).
- **C5** Manualny billing → automacja faktur/limitów (08).

### WAVE D — Spójność danych i UI
- **D1** Moja Praca: spójność tasks/danych (02).
- **D2** Tabele/Outputs AI-akcje long-tail (11, 09).
- **D3** Color/UI drift → crimson tokens (cross-cutting; `_DESIGN_SYSTEM_STANDARDIZATION_PLAN.md`).
- **D4** Usunąć podwójny widget kontekstu org (16); `isAdmin` po roli, nie po nazwie sekcji (16).

### WAVE E — Moduły odroczone (po v1)
- **E1** Fix DB init/adapter mismatch (wspólny 14+15), default provider seed.
- **E2** MCP/Iris (14) un-park: wykonanie narzędzi end-to-end.
- **E3** Marketplace (15): MarketplaceView + most do Teresy — **zależność zewnętrzna: usługa DBR77 musi publikować assety**.

---

## 4. Definicja „100%" (kryteria akceptacji całości)

System jest „w 100%" gdy łącznie:
1. **Teresa nie ma martwych przycisków** — każdy widoczny przycisk AI ma działający apply-handler; każdy zbudowany panel AI jest zamontowany; żaden „AI" nie jest regexem podawanym jako LLM.
2. **Pętla kontekstu domknięta** — claim-snapshot **i** Knowledge Graph zasilają Teresę jedną kanoniczną ścieżką; ustawienia AI realnie zmieniają zachowanie modelu.
3. **Governance egzekwowany, nie deklarowany** — limity/budżety AI blokują realnie; najczulsze mutacje są audytowane.
4. **Brak stubów w widocznych ścieżkach** — żaden przycisk nie prowadzi do 501/503; e-mail (invite/billing) faktycznie wychodzi.
5. **Bezpieczeństwo domknięte** — usuwanie konta/GDPR za bramką hasła; brak `@ts-nocheck` na ścieżkach payout/auth; BYOK szyfrowane.
6. **Spójność wizualna** — crimson jako jedyny akcent, brak driftu violet/primary (per design-system plan).
7. **Odroczone udokumentowane jako odroczone** — 14/15 mają jawne kryteria un-park i zależności.

---

## 5. Co dalej (rekomendacja)

1. **Najpierw WAVE A** — to jest różnica między „aplikacja z przyciskami AI" a „aplikacja, w której Teresa pracuje". Najwyższy ROI, najmniejsze ryzyko (podpinanie, nie pisanie).
2. **Równolegle WAVE B** (bezpieczeństwo/governance) jako warunek GA.
3. Dopiero potem C/D, a E po v1.
4. Po Wave A/B — **wizualny przegląd właściciela** (recolor crimson + LP) per `_DESIGN_SYSTEM_STANDARDIZATION_PLAN.md`.

> Pełne uzasadnienia z `file:line` i estymatami P0/P1/P2 — w 19 plikach `COMPLETION_NN_*.md` w tym katalogu.
