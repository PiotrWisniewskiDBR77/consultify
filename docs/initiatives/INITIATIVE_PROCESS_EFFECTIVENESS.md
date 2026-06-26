# Analiza efektywności i szczelności procesu inicjatyw

> **Data:** 2026-06-26 · **Podstawa:** żywy kod (zweryfikowane file:line), nie audyt.
> **Towarzyszy:** [`INITIATIVE_LIFECYCLE.md`](./INITIATIVE_LIFECYCLE.md) (pełny opis procesu).
> **Cel:** ocenić jak sprawny i SZCZELNY jest proces — gdzie tarcia, luki, footguny — i co naprawić najpierw.

## Werdykt w jednym zdaniu

Proces jest **dobrze zaprojektowany architektonicznie** (jeden SSOT statusów, bramki role-gated, warstwa AI-readiness, podwójny ślad audytu, kanoniczny emiter powiadomień), ale jest **w połowie migracji** i ma **realne nieszczelności integralności** — z których **dwie pozwalają inicjatywie ominąć cały łańcuch zatwierdzeń**. To nie jest „zepsute", to jest „mocny szkielet z policzalnymi dziurami".

**Ocena dojrzałości procesu: ~7/10** — szkielet 9/10, szczelność egzekwowania 5/10.

---

## Mocne strony (co działa i warto chronić)

| # | Mocna strona | Dowód |
|---|---|---|
| S1 | **Jeden SSOT** statusów+przejść+bramek+RBAC w jednym pliku | `constants/initiativeStatuses.ts` |
| S2 | **Role-gated łańcuch** zamiast jednego „approve" — odzwierciedla realny governance konsultingowy (PM→Sponsor→Steering→PMO) | `GATE_PERMISSIONS:117` |
| S3 | **Warstwa AI-readiness** ocenia kompletność sekcji przed promocją, fail-open (nie blokuje twardo) | `gateAiReadinessService.ts` |
| S4 | **Podwójny ślad** historii + audyt + kanoniczne powiadomienia z eskalacją (BLOCKED=CRITICAL) | `InitiativeController.ts:2037-2269` |
| S5 | **Wersjonowany baseline harmonogramu** przy SCHEDULE — porównanie plan vs rzeczywistość | `initiative_schedule_baselines` |
| S6 | **Guard schema-drift** na zapisie (odrzuca nieznane statusy 400) | `initiativeLifecycleCanon.ts:225` |
| S7 | **Wartość tylko L5 = zaksięgowana** — uczciwe rozróżnienie prognoza vs realizacja | `valueStageGateService` |

---

## Ustalenia (posortowane wg dotkliwości)

### 🔴 KRYTYCZNE — szczelność egzekwowania

**F1 — Pomysły→inicjatywa tworzą od razu `APPROVED`, omijając CAŁY łańcuch zatwierdzeń.**
`notebookConversionService.ts:88` pisze status `APPROVED` bez DRAFT→REVIEW→PROMOTED→PLANNING→APPROVED. Inicjatywa z Mind-mapy **pomija**: przegląd PM, decyzję Go/No-Go, akceptację Sponsora, zatwierdzenie Komitetu Sterującego, decyzję Zasoby. Każdy kto może konwertować pomysł obchodzi cały governance.
- **Wpływ:** dziura w kontroli — „tylnymi drzwiami" inicjatywa wchodzi jako zatwierdzona.
- **Naprawa:** zmień na `DRAFT` (lub `PENDING_REVIEW` jeśli ma być szybka ścieżka), zachowując lineage `source_type='mywork_idea'`. 1-linijkowa zmiana + test.

**F2 — Lejek kreacji za flagą OFF → ~23 rozproszone INSERT-y, brak gwarancji integralności.**
`createInitiativeService.ts` (kanoniczny lejek: zawsze DRAFT, name+title, lineage, audyt, QA §B3) działa tylko gdy `INITIATIVE_FUNNEL_ENABLED==='true'`. Przy OFF (domyślnie) każda ścieżka ma własny INSERT → niespójny status startowy (stąd F1), różne pola, brak jednolitego audytu.
- **Wpływ:** F1 i wszystkie przyszłe wyłomy są SKUTKIEM tego — bez jednego lejka nie ma jak wymusić niezmienników.
- **Naprawa:** dokończyć migrację i włączyć flagę (staging→prod). To „matka" pozostałych ustaleń.

### 🟠 WYSOKIE — obejścia governance

**F3 — Import PDF tworzy `PENDING_REVIEW` (drugi wyłom DRAFT).**
`reportImportService.ts:1536`. Mniej groźne niż F1 (PENDING_REVIEW wciąż przechodzi przez PM-review), ale niespójne z kanonem „zawsze DRAFT". Świadoma decyzja czy bug?
- **Naprawa:** potwierdzić intencję; jeśli celowe — udokumentować jako wyjątek, jeśli nie — DRAFT.

**F4 — Teresa `generate_initiative` omija blokadę pilotów.**
Narzędzie jest typu READ (`ai/tools/generateInitiative.ts`) → NIE przechodzi `evaluateInitiativeWriteAccess`. Użytkownik z pasma „pilot" (VIEWER/CLIENT/TEAM_MEMBER) może utworzyć inicjatywę z czatu, której PMO API by mu zabroniło.
- **Wpływ:** niespójna polityka — ta sama operacja dozwolona z czatu, zabroniona z UI.
- **Naprawa:** albo zastosuj `evaluateInitiativeWriteAccess` na ścieżce MCP, albo świadomie udokumentuj, że draft z czatu jest dozwolony dla wszystkich (bo odwracalny). Decyzja produktowa.

### 🟡 ŚREDNIE — footguny i spójność

**F5 — Auto-start job omija RBAC/bramki.**
`jobs/initiativeAutoStartJob.ts` przełącza SCHEDULED→EXECUTING gdy data startu nadejdzie, bezpośrednim UPDATE-em. To job systemowy (z definicji bez aktora), ale **nie ma bramki AI/readiness/governance** — inicjatywa wchodzi w realizację bez sprawdzenia gotowości wykonawczej.
- **Naprawa:** rozważ uruchomienie tej samej walidacji readiness przed auto-startem (albo świadomie zaakceptuj, że SCHEDULE już to sprawdził).

**F6 — Drift typów: dwa enumy statusów.**
5-wartościowy `types/index.ts:157` (`draft/planning/active/completed/cancelled`) współistnieje z 13-wartościowym SSOT. Footgun — nowy kod może przypadkiem zaimportować zły.
- **Naprawa:** usuń/oznacz `@deprecated` stary enum, przekieruj importy na `constants/initiativeStatuses.ts`.

**F7 — Dwa źródła zależności Gantta.**
`task_dependencies` (tabela, SoT) vs per-task `dependsOnId` (pole). Dokument M13 potrafił renderować dwa Gantty z dwóch źródeł (znane z `finding_initiative_two_gantts`). Łatwo podpiąć złe źródło.
- **Naprawa:** jedno źródło prawdy = `task_dependencies`; `dependsOnId` wyprowadzać z niego lub usunąć.

**F8 — Due-breach cron wyłączony domyślnie.**
`INITIATIVE_DUE_BREACH_CRON_ENABLED` OFF (M13 safety) → przeterminowane inicjatywy NIE generują powiadomień na prod. Widać tylko wizualnie w chipach.
- **Naprawa:** świadoma decyzja — włączyć na prod (po weryfikacji idempotencji) czy zostawić wizualnie.

**F9 — Kontroler re-implementuje `validateTransition` inline zamiast wołać czystą funkcję.**
`initiativeStatuses.ts:711` ma bogaty walidator (BLOCKED wymaga powodu, DONE blokowane przez zadania, itp.), ale `InitiativeController` powiela równoważniki w ciele handlera. Ryzyko rozjazdu logiki przy zmianie.
- **Naprawa:** skonsoliduj — handler woła `validateTransition`, jedna definicja reguł.

### 🟢 NISKIE — higiena

**F10 — `initiativeNotificationService` wrapper w większości nieużywany** (kontroler emituje bezpośrednio; tylko `notifyDueBreach` podpięty). Martwa-ish abstrakcja.
**F11 — Akumulacja martwego kodu:** `components/Implementation/`, `RoadmapKanban`, nieroutowane widoki, `Reports/InitiativesReportSection`. Mylące przy nawigacji.

---

## Analiza efektywności PROCESU (nie tylko kodu)

**Tarcia w przepływie:**
- **Łańcuch jest długi** — 13 statusów, 14 bramek, do 4 różnych ról (PM, Sponsor, Steering, PMO, Business Owner). Dla małej org bez pełnej obsady ról inicjatywa może **utknąć** (brak osoby z rolą następnej bramki). Łagodzą to: fallback Steering→Sponsor/Portfolio (`:1299`) + bypass ADMIN.
- **Bypass ADMIN to miecz obosieczny** — odblokowuje zatory, ale obchodzi cały governance. W małych zespołach gdzie większość to ADMIN, łańcuch bramek faktycznie nie egzekwuje nic.
- **Powiadomienie `gate_action_required`** jest dobre (mówi „czeka na Twoją decyzję"), ale jeśli rola następnej bramki jest nieobsadzona — nikt nie dostaje sygnału, inicjatywa cicho stoi.

**Wniosek efektywnościowy:** proces jest „enterprise-grade" w projekcie, ale jego **skuteczność zależy od obsady ról** i od **włączenia flag** (funnel, due-breach). W obecnym stanie (flagi OFF, 2 wyłomy DRAFT, bypass ADMIN dostępny) realna szczelność jest znacznie niższa niż sugeruje architektura.

---

## Co naprawić najpierw (priorytet)

| Prio | Akcja | Ustalenie | Koszt |
|---|---|---|---|
| **P0** | Pomysły→inicjatywa: `APPROVED`→`DRAFT` | F1 | 1 linia + test |
| **P0** | Decyzja + włączenie lejka kreacji (staging→prod) | F2 | migracja flagi |
| **P1** | Ujednolicić import PDF + ścieżkę Teresy z polityką | F3, F4 | mała + decyzja produktowa |
| **P1** | Skonsolidować walidację przejść (handler → `validateTransition`) | F9 | refactor |
| **P2** | Usunąć drift enuma + ujednolicić źródło Gantta | F6, F7 | refactor |
| **P2** | Decyzja o due-breach cronie na prod | F8 | flaga + weryfikacja |
| **P3** | Sprzątanie martwego kodu | F10, F11 | cleanup |

> **Uwaga metodologiczna:** część szczegółów (dokładne numery migracji, niektóre claimy schematu M15/M16) pochodzi z czytania dokumentów i NIE została niezależnie potwierdzona w kodzie — oznaczone w `INITIATIVE_LIFECYCLE.md`. Nazwy modułów, lokalizacje bramek, RBAC i side-effecty są zweryfikowane file:line.
