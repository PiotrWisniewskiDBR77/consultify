# Analiza efektywności i szczelności procesu inicjatyw

> **Data:** 2026-06-26 · **Podstawa:** żywy kod (zweryfikowane file:line), nie audyt.
> **Towarzyszy:** [`INITIATIVE_LIFECYCLE.md`](./INITIATIVE_LIFECYCLE.md) (pełny opis procesu).
> **Cel:** ocenić jak sprawny i SZCZELNY jest proces — gdzie tarcia, luki, footguny — i co naprawić najpierw.

## Werdykt w jednym zdaniu

Proces jest **dobrze zaprojektowany architektonicznie** (jeden SSOT statusów, bramki role-gated, warstwa AI-readiness, podwójny ślad audytu, kanoniczny emiter powiadomień). Główne ryzyko to **niedokończona migracja** (lejek kreacji za flagą OFF) i kilka footgunów spójności — **nie** obejścia governance. To „mocny szkielet, w połowie ujednolicony".

**Ocena dojrzałości procesu: ~8/10** — szkielet 9/10, szczelność egzekwowania 7/10.

> ⚠️ **KOREKTA 2026-06-26 (po weryfikacji w kodzie).** Pierwotny nagłówkowy P0 „F1 — Pomysły→inicjatywa tworzą APPROVED, omijając łańcuch" był **FAŁSZYWYM ALARMEM** automatycznego audytu. Linia `notebookConversionService.ts:88` ustawia status **sesji narzędzia** (`tool_sessions`), nie inicjatywy; inicjatywa powstaje jako **DRAFT** (`:326` + funnel `:289`). F1 **wycofany**. F3 (import PDF→PENDING_REVIEW) jest **celowy i defensywny**, nie naruszenie. Lekcja: każdy claim file:line z audytu = zweryfikuj runtime przed działaniem (zgodnie z zasadą projektu „audyty zawyżają ~1 na 7"). Ocena podniesiona po korekcie.

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

### ✅ WYCOFANE — fałszywy alarm audytu

**~~F1 — Pomysły→inicjatywa tworzą `APPROVED`, omijając łańcuch~~ → NIEPRAWDA.**
Zweryfikowane w kodzie 2026-06-26: `notebookConversionService.ts:88` ustawia status **sesji narzędzia** (`tool_sessions`, INSERT do `tool_sessions`), co jest poprawne (ukończona sesja MyWork = APPROVED/100%). FAKTYCZNa inicjatywa powstaje w bloku `target==='initiative'` (`:275-337`) ze statusem **DRAFT** — zarówno przez kanoniczny funnel (`:289`) jak i fallback (`:326`). **Żadnego obejścia governance nie ma.** Finding wycofany; był to przykład zawyżania audytu (verify-runtime-before-acting).

### 🟠 WYSOKIE — niedokończona migracja

**F2 — Lejek kreacji za flagą OFF → rozproszone INSERT-y, brak jednolitych gwarancji.**
`createInitiativeService.ts` (kanoniczny lejek: zawsze DRAFT, name+title, lineage, audyt, QA §B3) działa tylko gdy `INITIATIVE_FUNNEL_ENABLED==='true'` (potwierdzone `notebookConversionService.ts:288`, `reportImportService.ts:1527`). Przy OFF każda ścieżka ma własny INSERT — niespójne pola, brak jednolitego audytu (choć status startowy i tak wychodzi DRAFT na zweryfikowanych ścieżkach).
- **Wpływ:** brak jednego punktu wymuszania niezmienników — przyszłe ścieżki mogą się rozjechać.
- **Naprawa:** dokończyć migrację i włączyć flagę (staging→prod). „Matka" higieny kreacji.

**F3 — Import PDF tworzy `PENDING_REVIEW` (celowe, nie wyłom).**
`reportImportService.ts:1536` — jawnie `status: 'PENDING_REVIEW'`, komentarz „status importu ważny w cyklu". To **świadomy, defensywny wybór**: treść jest już zwalidowana w raporcie źródłowym, więc pomija się tylko etap autorski DRAFT — inicjatywa i tak przechodzi przez PM-review (PENDING_REVIEW→REVIEW→…). Nie omija governance.
- **Naprawa:** żadna wymagana; ewentualnie udokumentować jako oficjalny wyjątek w `INITIATIVE_FORMULA.md`.

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

**Wniosek efektywnościowy:** proces jest „enterprise-grade" w projekcie i — po korekcie F1 — jego **szczelność statusu startowego jest dobra** (wszystkie zweryfikowane ścieżki = DRAFT/PENDING_REVIEW, oba przechodzą przez review). Realne ryzyko to nie obejścia governance, lecz: **skuteczność zależna od obsady ról** (zatory gdy rola następnej bramki nieobsadzona), **bypass ADMIN** (w małych zespołach łańcuch nie egzekwuje), i **niedokończona migracja lejka** (higiena, nie bezpieczeństwo).

---

## Co naprawić najpierw (priorytet — po korekcie F1)

| Prio | Akcja | Ustalenie | Koszt |
|---|---|---|---|
| **P1** | Dokończyć migrację + włączyć lejek kreacji (staging→prod) | F2 | migracja flagi |
| **P1** | Decyzja produktowa: czy Teresa (czat) może tworzyć drafty dla pasma pilot | F4 | decyzja + ew. guard |
| **P1** | Skonsolidować walidację przejść (handler → `validateTransition`) | F9 | refactor |
| **P2** | Usunąć drift enuma + ujednolicić źródło Gantta | F6, F7 | refactor |
| **P2** | Decyzja o due-breach cronie na prod | F8 | flaga + weryfikacja |
| **P2** | Bypass ADMIN — rozważyć audyt/ostrzeżenie przy ominięciu bramki | (tarcie) | mały |
| **P3** | Sprzątanie martwego kodu | F10, F11 | cleanup |

> **Uwaga metodologiczna (wzmocniona po F1):** automatyczny audyt miał ≥1 błąd file:line (F1 — pomylił `tool_sessions` z `initiatives`). **Każdy claim z audytu = zweryfikuj runtime PRZED działaniem.** Niezależnie zweryfikowane file:line: F2 (`:288`/`:1527`), F3 (`:1536`), ścieżki kreacji DRAFT (`notebookConversionService.ts:326`). Pozostałe (F4-F11, schematy M15/M16, numery migracji) — potwierdzić przed naprawą.
