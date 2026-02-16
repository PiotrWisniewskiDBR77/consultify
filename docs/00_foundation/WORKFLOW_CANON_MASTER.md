# Workflow Canon Master (KANON) — Roles, Statuses, Gates (end‑to‑end)

> **Status:** OBOWIĄZUJĄCY  
> **Ostatnia aktualizacja:** 2026-02-11  
> **Cel:** Jedno, spójne źródło prawdy dla: ról, statusów, gate’ów i end‑to‑end flow pracy w Consultify.  
> **Zakres modułów:** Interview, Tools, Assessment, Initiatives, Execution/Implementation, Benefits, Economics, Reports, MyWork.  
> **Core encje pracy:** `Initiative`, `Task`, `Decision`, `Notification`.

---

## 0) Źródła prawdy w repo (MUST)

**Kanon statusów i gate’ów inicjatywy:**

- Backend: `server/src/constants/initiativeStatuses.ts`
- Frontend: `src/services/initiativeLifecycle.ts`
- Typy: `src/types/core.ts` (`InitiativeStatus`, `TaskStatus`, `DecisionStatus`, `NotificationSeverity`)

**Kanon ról i delegacji:**

- `wdrozenia/workflows/01-ROLES-AND-ASSUMPTIONS.md`

**Kanon flow end‑to‑end (opisowy):**

- `wdrozenia/workflows/00-WORK-LIFECYCLE.md`
- `docs/flows/core/*` (Tools/Assessment/Initiatives/Tasks/Decisions/Notifications/Benefits/Reports/MyWork)
- Economics policy: `docs/product/ECONOMIC_ANALYSIS_POLICY.md`
- Economics module/API: `docs/modules/ECONOMICS_MODULE.md`, `server/src/routes/economics.routes.ts`

> Zasada: jeśli jakikolwiek moduł/ekran łamie ten dokument, to jest bug (albo aktualizujemy kanon centralnie).

---

## 1) Role — pełne mapowanie (enterprise)

### 1.1 Dwa poziomy ról (MUST)

1. **Account Type (organizacja/tenant)** — do administracji i access control systemu.
2. **Project Role (projekt)** — do sterowania procesem transformacji (gates, approvals, ownership).

**MUST:** workflow (gates/statusy) jest kontrolowany przez **Project Role**, nie przez Account Type.

### 1.2 Role procesowe (KANON) — 8 ról

Te role są używane w dokumentacji i UX:

| Workflow role                | Odpowiedzialność                            | Typowe decyzje/gates                            |
| ---------------------------- | ------------------------------------------- | ----------------------------------------------- |
| Admin (techniczny)           | konfiguracja, auditowany override           | brak “biznesowych” gate’ów                      |
| Consultant (autor discovery) | tworzy artefakty Interview/Tools/Assessment | `SUBMIT_FOR_REVIEW` własnej pracy               |
| Initiative Owner             | prowadzi delivery w Execution               | `BLOCK`, `COMPLETE` (operacyjnie)               |
| Project Sponsor              | sens biznesowy/budżet/prior.                | `ACCEPT/REJECT`, `UNBLOCK` (biznesowo)          |
| PMO                          | governance i harmonogram                    | `START_PLANNING`, `SCHEDULE`, `START`, `CANCEL` |
| Steering Committee           | strategiczne approvals/eskalacje            | `APPROVE`, `CANCEL`, `UNBLOCK` po eskalacji     |
| Team Member                  | wykonanie tasków                            | brak gate’ów                                    |
| Business Owner               | KPI/benefits                                | `START_TRACKING`, docelowo `CLOSE_TRACKING`     |

Źródło: `wdrozenia/workflows/01-ROLES-AND-ASSUMPTIONS.md`.

### 1.3 Delegacje ról (gdy roli brak) (MUST)

Workflow nigdy nie może “nie mieć decydenta”.

- brak **PMO** → przejmuje **Project Manager**
- brak **Steering Committee** → przejmuje **Sponsor/Executive**
- brak **Business Owner** → przejmuje **Sponsor** (ale KPI owner musi być jawny)
- brak **Reviewer** → przejmuje **PM/Lead**

### 1.4 Mapowanie ról na kod (MUST – definicja kompatybilności)

**Kanon gate permissions** jest w backendzie w `server/src/constants/initiativeStatuses.ts` (Role: `PROJECT_MANAGER`, `PROJECT_LEAD`, `PROJECT_SPONSOR`, `PMO`, `STEERING_COMMITTEE`, `BUSINESS_OWNER`, itd.).

**MUST:** każdy użytkownik wykonujący gate musi mieć:

- `account role` (auth) umożliwiającą wejście do modułu
- oraz `project role` mapującą się na `RoleType` z `initiativeStatuses.ts`

**Luka do domknięcia (P0):** jednoznaczne mapowanie “role w DB” → `RoleType` (żeby `canExecuteGate` nie rozjechał się z kanonem).

### 1.5 Mapping matrix: Workflow role → `ProjectRole` → `RoleType` (MUST)

Źródła:

- Workflow role: `wdrozenia/workflows/01-ROLES-AND-ASSUMPTIONS.md`
- Kod: `src/types/core.ts` (`ProjectRole`)
- Gates: `server/src/constants/initiativeStatuses.ts` (`RoleType`)

**MUST:** poniższa tabela jest kanoniczną mapą kompatybilności. Jeśli projekt używa innego nazewnictwa, dodajemy aliasy, ale NIE zmieniamy semantyki.

| Workflow role (doc/UX)                         | Primary `ProjectRole`(s)                                           | Gate `RoleType` (initiativeStatuses) | Notes                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------- |
| Consultant                                     | `ProjectRole.CONSULTANT`                                           | `CONSULTANT`                         | Consultant = autor discovery; nie wykonuje decyzji biznesowych  |
| Project Manager (reviewer w małych projektach) | `ProjectRole.PROJECT_MANAGER`                                      | `PROJECT_MANAGER`                    | odpowiada za review artefaktów discovery                        |
| Project Lead (reviewer/lead)                   | `ProjectRole.TEAM_LEAD` / `ProjectRole.WORKSTREAM_OWNER`           | `PROJECT_LEAD`                       | w zależności od projektu; rola “lead jakości”                   |
| Initiative Owner                               | `ProjectRole.INITIATIVE_OWNER`                                     | `INITIATIVE_OWNER`                   | operacyjny właściciel inicjatywy                                |
| Sponsor / Project Executive                    | `ProjectRole.SPONSOR` / `ProjectRole.PROJECT_EXECUTIVE`            | `PROJECT_SPONSOR`                    | strategiczny właściciel; Go/No‑Go, unblock, budżet              |
| PMO                                            | `ProjectRole.PMO_LEAD`                                             | `PMO`                                | governance i harmonogram                                        |
| Steering Committee                             | (grupa użytkowników) `ProjectRole.PROJECT_EXECUTIVE` + policy      | `STEERING_COMMITTEE`                 | w kodzie to często “membership list”, nie pojedyncza rola       |
| Team Member                                    | `ProjectRole.TEAM_MEMBER` / `ProjectRole.TASK_ASSIGNEE`            | `TEAM_MEMBER`                        | wykonanie tasków                                                |
| Business Owner (benefits)                      | **(do dodania 1:1)** lub `ProjectRole.DECISION_OWNER` (tymczasowo) | `BUSINESS_OWNER`                     | **P0 gap:** brak jednoznacznej roli w kodzie dla benefits owner |
| Admin (techniczny)                             | `UserRole.ADMIN/OWNER` (+ ewentualnie project admin)               | `ADMIN`                              | admin override zawsze auditowany                                |

### 1.6 Algorytm rozstrzygania uprawnień do gate (MUST)

**Cel:** mieć jeden spójny mechanizm, aby UI i backend podejmowały tę samą decyzję.

**MUST:**

1. User musi mieć dostęp do projektu (project membership).
2. Z project membership wyliczamy **effective gate role**:
   - jeśli user ma wiele ról, wybieramy rolę o najwyższej “mocy gate” dla danego gate (np. Sponsor > PMO > Manager > Consultant).
3. Sprawdzamy `GATE_PERMISSIONS[gate].includes(effectiveRole)`.
4. Dodatkowe warunki:
   - `SUBMIT_FOR_REVIEW`: autor może submit tylko własny artefakt (ownership check).
   - `START_TRACKING`: user jest wskazanym Business Owner lub delegacją (Sponsor) wg kanonu delegacji.

**SHOULD:** udostępnić endpoint “canExecuteGate” (server returns: allowed/whyNot) aby UI nie zgadywał.

---

## 2) Status machines (KANON) — core encje

### 2.1 InitiativeStatus (KANON)

Źródło: `server/src/constants/initiativeStatuses.ts`, `src/types/core.ts`.

**Wartości:**

`DRAFT` → `PENDING_REVIEW` → `REVIEW` → `PROMOTED` → `PLANNING` → `APPROVED` → `SCHEDULED` → `EXECUTING` ↔ `BLOCKED` → `DONE` → `TRACKING` → `ARCHIVED`  
Terminalnie: `CANCELLED`.

**MUST:** inicjatywa ma **jeden lifecycle**; moduły tylko renderują różne etapy tej samej encji.

### 2.2 TaskStatus (KANON)

Źródło: `src/types/core.ts`.

`TODO` → `IN_PROGRESS` ↔ `BLOCKED` → `DONE`

**Uwaga o “REVIEW / PENDING_APPROVAL”:**

- Jeśli task ma `requiresAcceptance=true`, w UX pojawia się stan “pending approval”, ale **nie musi to być osobny `TaskStatus`**.
- **MUST:** stan akceptacji jest modelem pobocznym (np. `acceptanceType`, `acceptorId`, `signedOff`) i nie może rozwalać filtrów statusu.

### 2.3 DecisionStatus (KANON)

Źródło: `src/types/core.ts`.

`PENDING` → (`APPROVED` / `REJECTED`) oraz `ESCALATED`.

**Uwaga o “EXPIRED/CANCELLED”:**

- Jeśli dokumentacja wspomina `EXPIRED`, traktujemy to jako **computed UI state** (deadline minął), a nie koniecznie zapisany status.
- Jeśli potrzeba “cancel decision”, to albo:
  - wprowadzamy jawny status w kanonie, albo
  - używamy `REJECTED` + reason + audit event.

### 2.4 Notification severity (KANON)

Źródło: `src/types/core.ts` (`NotificationSeverity`).

- `INFO`
- `WARNING`
- `CRITICAL`

**MUST:** jeżeli w legacy API występuje `priority` (np. `high/normal/low`), UI mapuje to do severity zgodnie z adapterem (patrz `docs/ui-standards/detail-view-presentation-modes.md` / adapter spec).

---

## 3) Gates (KANON) — inicjatywa jako “stage gates”

### 3.1 GateType (MUST)

Źródło: `server/src/constants/initiativeStatuses.ts` (`GateType`).

- Faza 1 (Tools/Assessment): `SUBMIT_FOR_REVIEW`, `SEND_BACK`, `APPROVE_TO_INITIATIVE`
- Faza 2: `ACCEPT`, `REJECT`, `START_PLANNING`, `APPROVE`, `SCHEDULE`
- Faza 3: `START`, `BLOCK`, `UNBLOCK`, `COMPLETE`
- Faza 4: `START_TRACKING`
- Universal: `CANCEL`

### 3.2 Gate transitions (from → to) (MUST)

To jest **kontrakt** dla backendu i UI:

| Gate                    | From status(es)  | To status        |
| ----------------------- | ---------------- | ---------------- |
| `SUBMIT_FOR_REVIEW`     | `DRAFT`          | `PENDING_REVIEW` |
| `SEND_BACK`             | `PENDING_REVIEW` | `DRAFT`          |
| `APPROVE_TO_INITIATIVE` | `PENDING_REVIEW` | `REVIEW`         |
| `ACCEPT`                | `REVIEW`         | `PROMOTED`       |
| `REJECT`                | `REVIEW`         | `DRAFT`          |
| `START_PLANNING`        | `PROMOTED`       | `PLANNING`       |
| `APPROVE`               | `PLANNING`       | `APPROVED`       |
| `SCHEDULE`              | `APPROVED`       | `SCHEDULED`      |
| `START`                 | `SCHEDULED`      | `EXECUTING`      |
| `BLOCK`                 | `EXECUTING`      | `BLOCKED`        |
| `UNBLOCK`               | `BLOCKED`        | `EXECUTING`      |
| `COMPLETE`              | `EXECUTING`      | `DONE`           |
| `START_TRACKING`        | `DONE`           | `TRACKING`       |
| `CANCEL`                | wiele            | `CANCELLED`      |

### 3.3 Gate permissions (kto może) (MUST)

Źródło: `GATE_PERMISSIONS` w `server/src/constants/initiativeStatuses.ts`.

**Reguły kluczowe (must‑have UX):**

- Consultant może robić tylko `SUBMIT_FOR_REVIEW` (swojej pracy) — nie podejmuje decyzji biznesowych.
- Sponsor/Steering decydują o `ACCEPT/REJECT` oraz o `UNBLOCK` (biznesowo).
- PMO steruje przejściami “operacyjnymi” (`START_PLANNING`, `SCHEDULE`, `START`, `CANCEL`).
- Business Owner uruchamia `START_TRACKING`.

**MUST:** UI pokazuje tylko akcje dozwolone dla roli, a disabled state ma tooltip “dlaczego”.

---

## 4) Flow modułów (wejście/wyjście + kto i kiedy)

### 4.1 Discovery: Interview → Tools/Assessment (SHOULD)

**Cel:** AI + konsultant budują kontekst, który zasila analizy.

**MUST (docelowo):**

- Interview tworzy “facts/insights” i może:
  - zasugerować Tools/Assessment,
  - wygenerować drafty inicjatyw/decision requests (z human approval).

### 4.2 Tools / Assessment → Initiatives (MUST)

- W Tools/Assessment powstają inicjatywy `DRAFT`.
- Gates fazy 1 kontrolują jakość i wejście do Initiatives (`REVIEW`).

### 4.3 Initiatives → Execution → Benefits (MUST)

- Initiatives moduł kończy się na `SCHEDULED`.
- Execution pracuje na `EXECUTING/BLOCKED/DONE`.
- Benefits zaczyna od `TRACKING`.

---

## 5) AI przejmuje większość pracy (docelowy model) — “human-in-the-loop”

### 5.1 Zasada: AI nigdy nie “decyduje” (MUST)

AI może:

- proponować inicjatywy/task/decisions,
- przygotowywać drafty,
- wykrywać blokady i eskalacje,
- generować raporty i podsumowania,

AI **nie może** samodzielnie:

- wykonywać gate’ów inicjatywy,
- zatwierdzać decyzji biznesowych,
- wykonywać operacji destrukcyjnych (delete, cancel) bez jawnego potwierdzenia.

### 5.2 Tryby AI w governance policy (MUST)

Źródło: `src/types/core.ts` (`aiMode`, `allowedAiActions`).

| AI mode     | Co to znaczy w praktyce                        | Domyślne zachowanie                                         |
| ----------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `ADVISORY`  | AI tylko doradza                               | podpowiedzi/insights, zero automatycznych akcji             |
| `ASSISTED`  | AI przygotowuje drafty, człowiek klika “Apply” | drafty inicjatyw/tasków/decyzji/raportów                    |
| `PROACTIVE` | AI sam inicjuje pracę pomocniczą               | auto‑draft + auto‑przypomnienia + auto‑linkowanie kontekstu |
| `AUTOPILOT` | AI wykonuje dozwolone akcje operacyjne         | tylko dla akcji z `allowedAiActions` + pełny audit          |

**MUST:** nawet w `AUTOPILOT`, AI wykonuje tylko akcje, które:

- są jawnie dozwolone w `allowedAiActions`,
- nie są gate decision,
- nie zmieniają strategicznego kierunku bez człowieka (approval loop).

### 5.3 Matryca: AI akcje vs wymagany “human loop” (KANON)

| Akcja                                        | AI może wykonać?        | Wymaga człowieka?              | Audit/Activity |
| -------------------------------------------- | ----------------------- | ------------------------------ | -------------- |
| Draft initiative z Tools/Assessment          | tak                     | nie (draft)                    | MUST           |
| Submit draft do review (`SUBMIT_FOR_REVIEW`) | tylko jeśli allowlisted | **tak** (domyślnie)            | MUST           |
| Create task draft                            | tak                     | nie (draft)                    | SHOULD         |
| Zmiana statusu task (TODO→IN_PROGRESS itd.)  | tylko operacyjnie       | zależnie od policy             | MUST           |
| Utworzenie decision request (PENDING)        | tak                     | **tak** jeśli to gate decision | MUST           |
| Eskalacja decision po terminie               | tak                     | nie (system rule)              | MUST           |
| Generacja reportu (draft)                    | tak                     | nie                            | SHOULD         |
| Publikacja / public link                     | nie                     | **tak**                        | MUST           |
| Cancel initiative                            | nie                     | **tak**                        | MUST           |

---

## 6) Gate Definition of Done (DoD) — wymagania per gate (MUST)

Poniższe checklisty są egzekwowane:

- **w UI** (czytelny komunikat “co brakuje”),
- **w backend** (żeby nie dało się ominąć).

### 6.1 Faza 1 (Discovery) — `DRAFT → PENDING_REVIEW → REVIEW`

#### Gate: `SUBMIT_FOR_REVIEW` (Consultant/Owner)

**MUST minimal requirements:**

- `title` (niepuste)
- `description` (min. sensowna długość / brak placeholderów)
- `axis` / kategoria / źródło (Tool/Assessment)
- `projectId` albo `sandbox` (jawne)

**MUST effects:**

- notyfikacja do reviewerów (PM/Lead/PMO)
- event w Activity: “submitted for review”

#### Gate: `SEND_BACK` (PM/Lead/PMO)

**MUST:**

- `sendBackReason` / komentarz (co poprawić)
- notyfikacja do autora
- audit/event

#### Gate: `APPROVE_TO_INITIATIVE` (PM/Lead/PMO)

**MUST:**

- wskazany reviewer/approver
- notyfikacja do Sponsor/Owner, że inicjatywa jest gotowa do Go/No‑Go

### 6.2 Faza 2 (Initiatives) — `REVIEW → ... → SCHEDULED`

#### Gate: `ACCEPT` (Sponsor/Steering)

**MUST:**

- owner (kto prowadzi inicjatywę) jest wskazany
- “why/value/effect” jest uzupełnione (minimum)
- ryzyka/RAID: minimum 1 flag albo jawny “none”

#### Gate: `START_PLANNING` (PMO)

**MUST:**

- przypisani ownerzy (biznes + execution jeśli używacie dwóch ownerów)
- wstępny plan (task seeds) istnieje

#### Gate: `APPROVE` (Steering)

**MUST:**

- plan (taski) + odpowiedzialności
- timeline wstępny
- economics/ROI: jeśli wymagane polityką projektu (**canonical policy:** `docs/product/ECONOMIC_ANALYSIS_POLICY.md`)

#### Gate: `SCHEDULE` (PMO)

**MUST:**

- daty (planned start/end) + baseline
- dependencies (co najmniej initiative‑initiative jeśli istnieją)

### 6.3 Faza 3 (Execution) — `SCHEDULED → EXECUTING → DONE`

#### Gate: `START` (PMO)

**MUST:** inicjatywa ma baseline i ownera wykonawczego.

#### Gate: `BLOCK` (Owner/PMO)

**MUST:**

- `blockedReason`
- (SHOULD) powiązana decyzja jeśli blokada to “brak decyzji”
- notyfikacja do właściwego decydenta

#### Gate: `UNBLOCK` (Sponsor/Steering)

**MUST:** audit + “co odblokowało” (decision reference lub reason).

#### Gate: `COMPLETE` (Owner/PMO)

**MUST:**

- task completion (wszystkie kluczowe taski DONE lub jawne wyjątki)
- evidence/sign‑off jeśli `requiresAcceptance`

### 6.4 Faza 4 (Benefits) — `DONE → TRACKING`

#### Gate: `START_TRACKING` (Business Owner)

**MUST:**

- zdefiniowane KPI/benefits (baseline + target)
- owner KPI (Business Owner) jawny

---

## 7) Spójność z systemem decyzji i notyfikacji (MUST)

### 7.1 Zależność “Decision blocks work” (KANON)

**MUST:**

- Jeśli work jest zablokowany decyzją:
  - task/initiative pokazuje “blocked by decision …”
  - decision pokazuje “blocks X”
- Decyzje mają due date i eskalacje (system presji).

### 7.2 Notification jako “system presji” (KANON)

**MUST:**

- Każda eskalacja / overdue / gate pending generuje notyfikację z CTA:
  - “Make decision”, “Review”, “Unblock”, “Schedule”, “Start tracking”.

---

## 8) Luki i brakujące warianty (audyt — P0/P1)

### P0 (blokuje spójność flow)

1. **Role mapping do `RoleType`** (kto ma `PROJECT_SPONSOR`, `PMO`, `BUSINESS_OWNER` itd. w praktyce) — bez tego permissions gate mogą nie działać zgodnie z kanonem.
2. **Task status rozjazd** (w dokumentach występuje `REVIEW` / `PENDING_APPROVAL`, a w kanonie enum jest 4‑stanowy).
3. **Decision status rozjazd** (w części opisów jest `EXPIRED/CANCELLED`, a w kanonie nie) — trzeba ustalić czy to computed czy stored.
4. **Unified Activity / audit stream** dla initiative/task/decision (API + UI) — niezbędne dla enterprise‑grade governance.
5. **Watchers/followers** dla task/decision (nie tylko initiative) — inaczej RightRail i presja nie będą kompletne.

### P1 (ważne brakujące elementy enterprise primitives)

6. **Economics workflow** (statusy/gates/role) + wpięcie w gates `APPROVE` i w Benefits (expected vs realized).
7. **Interview → Initiative/Decision**: brak twardo opisanego generatora inicjatyw/decyzji z insightów (dziś głównie Tools/Assessment).
8. **Task‑task dependencies** + walidacja cykli + widok zależności.
9. **Automations** (reguły) — np. “blocked > X dni → eskaluj”, “due soon → notify”.
10. **Custom fields** dla initiative/task/decision (minimum enterprise).

---

## 9) Zasady spójności z UI (3 tryby prezentacji detail view)

Detail view dla `Initiative/Task/Decision/Notification` ma 3 tryby renderu (D/N/C presentation modes), ale workflow jest jeden.

**MUST:**

- statusy, gate actions i role permission są identyczne w każdym trybie (zmienia się tylko layout treści),
- UI nie dubluje “mocy” gate’ów w różnych miejscach (jedno miejsce na akcje, jedno na treść),
- wszystkie akcje mutujące (gate, unblock, approve) generują audit/Activity.

Źródło trybów prezentacji: `docs/ui-standards/detail-view-presentation-modes.md`.

---

## 10) Historia zmian

- 2026-02-11: utworzono kanoniczny dokument mapujący role/statusy/gates end‑to‑end + model przejęcia pracy przez AI (human-in-the-loop).

---

## 11) Flow per moduł (MUST) — jak się pracuje w praktyce

Ta sekcja odpowiada na pytanie: **czy praca w każdym module jest jasna** oraz jak dokładnie łączy się z encjami:
`Initiative`, `Task`, `Decision`, `Notification`.

W każdym module trzymamy ten sam format:

- **Cel modułu**
- **Wejścia/wyjścia (artefakty)**
- **Widoki i narzędzia workflow** (co użytkownik “ma w rękach”)
- **Gates i odpowiedzialności** (kto klika, kto odpowiada)
- **Zasady przydziału** (owners/assignees/deciders/reviewers)
- **Integracja z Task/Decision/Notification/Initiative**
- **AI: co robi automatycznie** (ADVISORY/ASSISTED/PROACTIVE/AUTOPILOT)
- **Co jest niejasne / luka** (jeśli dotyczy)

### 11.1 Moduł: Interview (Wywiad + wnioski)

**Cel modułu:** pozyskać fakty, kontekst i wnioski od interesariuszy w sposób audytowalny, tak aby AI mogło generować rekomendacje (tools/assessments/initiatives/decisions) bez zgadywania.

**Wejście:**

- projekt + lista interesariuszy,
- szablony pytań / assignmenty.

**Wyjście (artefakty):**

- `Interview Session` (transkrypcja, notatki),
- `Insights` (ustrukturyzowane: pain points, constraints, goals),
- (docelowo) seed do: `ToolWork`, `Assessment`, `Initiative (DRAFT)`, `Decision (PENDING)`.

**Widoki i narzędzia workflow (MUST):**

- Lista sesji (table) + statusy sesji.
- Widok sesji: pytania → odpowiedzi → evidence → AI summary.
- Assignment workflow: kto ma odpowiedzieć, do kiedy, kto review’uje.

**Gates i odpowiedzialności (SHOULD, docelowo MUST):**

- `SUBMIT_INTERVIEW` (Assignee) → “gotowe do review”
- `SEND_BACK_INTERVIEW` (Reviewer) → “poprawki”
- `APPROVE_INTERVIEW` (Reviewer/PM/Lead/PMO) → “quality-checked”

**Zasady przydziału (MUST):**

- Każda sesja ma:
  - `assignee` (kto odpowiada),
  - `reviewer` (kto odbiera jakość),
  - `dueDate`.
- Jeśli w projekcie nie ma osobnego `REVIEWER`:
  - reviewer = `ProjectRole.PROJECT_MANAGER` (delegacja).

**Integracja z core encjami (MUST):**

- Zatwierdzony insight może tworzyć:
  - `Notification` do właścicieli obszarów (“Potrzebna decyzja”, “Brak danych do oceny”),
  - `Decision (PENDING)` jeśli insight wskazuje governance blocker (np. “budżet nieustalony”),
  - `Initiative (DRAFT)` jako propozycja (z human approval).

**AI (docelowo):**

- `ADVISORY`: podsumowania, ekstrakcja faktów, sugestie pytań.
- `ASSISTED`: generuje draft insights + draft initiatives/decyzje (człowiek zatwierdza).
- `PROACTIVE`: automatycznie proponuje next step (Tools/Assessment), tworzy przypomnienia.
- `AUTOPILOT`: tylko pomocnicze akcje (przypomnienia, linkowanie kontekstu); brak gate/approvals.

**Luka (P1):** brak jednego, twardego kontraktu “Interview → Initiative/Decision” jako standardowego przycisku/akcji (dziś to jest głównie w opisach).

### 11.2 Moduł: Tools (Discovery Tools)

**Cel modułu:** wykonać analizy (strategiczne/operacyjne/digital), wytworzyć artefakt i wygenerować inicjatywy `DRAFT`.

**Wejście:** kontekst (Interview), projekt/sandbox, dane wejściowe toola.

**Wyjście:**

- `ToolWork` / `Tool Report`,
- propozycje: `Initiative (DRAFT)` + (opcjonalnie) `Decision (PENDING)` gdy tool wykrywa blocker.

**Widoki i narzędzia workflow (MUST):**

- Katalog narzędzi + sesje narzędzi.
- Widok pracy narzędzia: formularz + evidence + AI “analysis blocks”.
- Widok “Tool Report” (quality-checked artefakt).

**Gates (MUST) — spójne z inicjatywą w fazie discovery:**

- `SUBMIT_FOR_REVIEW` (autor) `DRAFT → PENDING_REVIEW`
- `SEND_BACK` (PM/Lead/PMO) `PENDING_REVIEW → DRAFT`
- `APPROVE_TO_INITIATIVE` (PM/Lead/PMO) `PENDING_REVIEW → REVIEW` (inicjatywa wchodzi do fazy 2)

**Zasady przydziału (MUST):**

- Autor = `Consultant` lub `TeamLead` (w zależności od projektu).
- Reviewer = `Project Manager/Lead/PMO` wg delegacji.
- Po `APPROVE_TO_INITIATIVE`: inicjatywa musi mieć `Project Sponsor` jako decydenta Go/No-Go (gate `ACCEPT/REJECT`).

**Integracja (MUST):**

- Tool może generować:
  - `Initiative DRAFT` (jedna lub wiele),
  - `Task` tylko jako “seed” w PLANNING (nie jako execution),
  - `Notification` do reviewerów i sponsorów o stanie gate.

**AI (docelowo):**

- generuje draft inicjatyw z tool outputu,
- sugeruje priorytet i dependencies,
- wykrywa “decision needed” i proponuje `Decision (PENDING)`.

### 11.3 Moduł: Assessment (ocena + raport + inicjatywy)

**Cel modułu:** zebrać dane o dojrzałości, wygenerować report i przetłumaczyć wyniki na inicjatywy.

**Wejście:** framework + odpowiedzi + evidence (+ import PDF).

**Wyjście:**

- `Assessment` (completed),
- `Assessment Report` (draft/final),
- `Initiative (DRAFT)` wygenerowane z reportu.

**Widoki i narzędzia workflow (MUST):**

- Wykonywanie assessmentu (question-by-question + evidence + AI notes).
- Widok wyników i gapów (wspierający dyskusję z klientem).
- Widok raportu (executive + detailed + recommendations).
- Akcja “Generate initiatives”.

**Gates / odpowiedzialności (MUST/SHOULD):**

- Completion assessment (team/consultant) → report ready.
- Review/approve report (Reviewer/Sponsor wg projektu).
- Generate initiatives:
  - AI generuje `Initiative (DRAFT)`,
  - człowiek zatwierdza “batch accept” do dalszej fazy (min. review jakości).

**Zasady przydziału (MUST):**

- `Consultant/Lead` wykonuje assessment i składa do odbioru.
- `Reviewer` odbiera jakość reportu.
- `Sponsor/Executive` akceptuje rekomendacje strategiczne.

**Integracja (MUST):**

- `Assessment Report` jest źródłem:
  - inicjatyw DRAFT,
  - (docelowo) economics baseline (estimated benefit/capex),
  - notyfikacji “assessment completed”, “report needs review”.

**AI (docelowo):**

- podczas assessmentu: clarifications, evidence suggestions,
- po assessment: report generation,
- z reportu: initiative generation + dependency suggestions.

### 11.4 Moduł: Zarządzanie inicjatywami (specyfikacja → plan → approval → schedule)

**Cel modułu:** przekształcić `Initiative (DRAFT)` w inicjatywę gotową do realizacji (`SCHEDULED`) przez:

- doprecyzowanie specyfikacji (scope/why/outcome),
- uzupełnienie owners i governance,
- plan (task seeds, timeline),
- analizę finansową (Economics) jeśli wymagana,
- decyzje gate (Go/No-Go, Approval, Scheduling).

**Wejście:** inicjatywy z discovery (DRAFT/PENDING_REVIEW) oraz manual create.

**Wyjście:** `SCHEDULED` (gotowe do Execution) albo `DRAFT` (send back/reject).

**Widoki i narzędzia workflow (MUST):**

- Portfolio/list/kanban/timeline dla inicjatyw (status-driven).
- Detail view (3 tryby prezentacji) z:
  - status + gate actions,
  - RAID,
  - Dependencies,
  - Decisions & gates,
  - Plan (tasks/milestones),
  - Economics (capex/benefit/roi) w PLANNING.

**Gates i odpowiedzialności (MUST):**

- `ACCEPT/REJECT` (Sponsor/Steering): `REVIEW → PROMOTED` lub `REVIEW → DRAFT`
- `START_PLANNING` (PMO): `PROMOTED → PLANNING`
- `APPROVE` (Steering): `PLANNING → APPROVED`
- `SCHEDULE` (PMO): `APPROVED → SCHEDULED`

**Zasady przydziału (MUST):**

- Każda inicjatywa ma:
  - `Project Sponsor` (decider) dla gate’ów strategicznych,
  - `Initiative Owner` (delivery owner),
  - `PMO` (scheduler) lub delegacja do PM.
- Jeśli economics jest wymagana polityką (`approvalThresholdCost` / change request policy):
  - brak economics blokuje `APPROVE`.

**Integracja (MUST):**

- W PLANNING powstają:
  - task seeds (niekoniecznie “pełne” taski wykonawcze),
  - decyzje governance (approval/resource/schedule),
  - notyfikacje do decydentów o pending gate.

**AI (docelowo):**

- readiness checker (co brakuje do gate),
- proposal generator: scope, risks, plan outline,
- economics assistant (szacunki, scenariusze, assumptions) — ale approval zawsze człowiek.

### 11.5 Moduł: Wdrożenie / Implementation (Execution) — analizy + task management + raportowanie postępu

**Cel modułu:** dostarczyć inicjatywę w sposób mierzalny, z pełną widocznością:

- zarządzanie taskami i blokadami,
- decyzje odblokowujące,
- workload/capacity,
- raportowanie postępu (dla PMO/Sponsor/Steering).

**Wejście:** inicjatywa `SCHEDULED` oraz baseline.

**Wyjście:** `DONE` (delivery zakończone) lub `CANCELLED`.

**Widoki i narzędzia workflow (MUST):**

- **Execution Hub**:
  - list/kanban/timeline/heatmap (workload),
  - filtrowanie po statusie inicjatyw i tasków,
  - widoki: “Blocked”, “At risk”, “Due soon”.
- **Task work views** (MUST — wszystkie muszą odnosić się do kanonicznego modelu Task):
  - lista tasków (table),
  - board (kanban po statusie),
  - workload view (osoby → obciążenie),
  - gantt/timeline (dla planowania terminów, nie time tracking),
  - detail view taska (3 tryby prezentacji).
- **Progress reporting**:
  - aktualizacja statusu tasków,
  - evidence / sign-off (jeśli requiresAcceptance),
  - komentarze,
  - eskalacje.

**Gates i odpowiedzialności (MUST):**

- `START` (PMO): `SCHEDULED → EXECUTING`
- `BLOCK` (Owner/PMO): `EXECUTING → BLOCKED` (wymaga reason i często decyzji)
- `UNBLOCK` (Sponsor/Steering): `BLOCKED → EXECUTING`
- `COMPLETE` (Owner/PMO): `EXECUTING → DONE` (wymaga task completion + evidence jeśli trzeba)

**Zasady przydziału (MUST):**

- Task ma zawsze:
  - `assignee` (wykonawca),
  - `ownerId` (accountability; jeśli brak, fallback do assignee),
  - `dueDate` (jeśli planujemy),
  - `initiativeId`.
- Task assignment:
  - `Initiative Owner/PMO` przypisuje,
  - `Team Member` wykonuje,
  - `Decision Owner` decyduje, gdy blokada jest governance.

**Integracja (MUST):**

- Jeśli task jest `BLOCKED` przez brak decyzji:
  - tworzymy/łączymy `Decision (PENDING)` z taskiem,
  - generujemy `Notification` do decydenta,
  - decision ma eskalacje po terminie.

**AI (docelowo):**

- triage: “które taski są at risk / blocked i dlaczego”,
- auto‑draft status updates (po sygnałach) + rekomendacje next action,
- auto‑create decision request przy blokadach (human confirm jeśli governance),
- auto‑generate progress report / executive summary.

#### 11.5.1 Standard raportowania postępu (KANON) — “jak raportujemy wdrożenie”

W Execution raportowanie ma być **proste jak w narzędziach enterprise**, ale dopasowane do transformacji (bez time tracking).

**Zasada (MUST):** raportowanie postępu opiera się o:

- statusy `Task` + `Initiative`,
- blokady i decyzje (`Decision`),
- presję i CTA (`Notification`),
- (docelowo) zunifikowany Activity/Audit stream.

##### A) Mikro‑raport: Task update (MUST)

Każda zmiana statusu taska jest “mikro‑raportem”.

**MUST przy zmianie statusu (`TODO/IN_PROGRESS/BLOCKED/DONE`):**

- `what changed` (co się stało) — może być krótki komentarz / activity note,
- `next action` (co dalej) — szczególnie przy `IN_PROGRESS`,
- jeśli `BLOCKED`:
  - `blockedReason` (wymagane),
  - `blockedByDecisionId` lub link do decyzji (SHOULD gdy to governance),
  - `who needs to act` (decider/owner),
  - `when` (deadline lub SLA).
- jeśli `DONE`:
  - evidence/sign‑off jeśli `requiresAcceptance=true` (MUST),
  - w przeciwnym razie evidence (SHOULD, choćby link/krótka notatka).

**MUST NOT:** nie wymagamy time tracking/worklog (strategiczne taski).

##### B) Raport tygodniowy: Initiative execution status (MUST)

Każda inicjatywa w `EXECUTING/BLOCKED` ma raport tygodniowy (lub częściej, jeśli Steering tak ustali).

**MUST fields (1 ekran, bez lania wody):**

- **Progress**: % (z tasków lub jawnie) + trend (↑/→/↓)
- **Last week delivered**: 3–5 bulletów (z DONE tasków)
- **This week focus**: 3–5 bulletów (top tasks/milestones)
- **Blockers**: co blokuje + kto ma zrobić co + do kiedy
- **Decisions needed**: lista `Decision (PENDING/ESCALATED)` + due + CTA
- **Timeline**: next milestone + ryzyko terminu
- **Scope/budget changes** (jeśli były): link do Change Request / decyzji

**Owner raportu (MUST):**

- `Initiative Owner` (delivery) przygotowuje,
- `PMO/PM` review’uje i dystrybuuje do Sponsor/Steering (wg polityki projektu).

##### C) Raport zarządczy: Steering pack (SHOULD)

Zestawienie dla Sponsor/Steering (portfolio) powinno agregować:

- inicjatywy at‑risk/blocked,
- decyzje przeterminowane,
- największe przesunięcia timeline/budget,
- top 3 ryzyka,
- rekomendacje AI (z pełnym uzasadnieniem).

Źródło ogólne: `docs/flows/core/REPORT_GENERATION_FLOW.md`.

##### D) Powiązanie z Notifications (MUST)

Raportowanie i presja muszą się spinać:

- `task_due_soon`, `task_overdue` → notyfikacje do assignee/owner,
- `initiative_blocked` → notyfikacje do Sponsor/Steering (z CTA `UNBLOCK`),
- `decision_needed`, `decision_escalated` → notyfikacje do decidera,
- brak aktualizacji inicjatywy > X dni (SHOULD) → notyfikacja “Update required”.

##### E) AI w raporcie postępu (docelowo)

- `ASSISTED`: AI generuje draft raportu tygodniowego z danych task/decision/notifications.
- `PROACTIVE`: AI wykrywa ryzyka i proponuje korekty (taski/decisions/plan).
- `AUTOPILOT`: AI może wysyłać przypomnienia i tworzyć drafty, ale nie podejmuje decyzji i nie wykonuje gate.

### 11.6 Moduł: Analiza rezultatów (Benefits / Results)

**Cel modułu:** zmierzyć i udowodnić outcomes transformacji po delivery:

- KPI baseline/target/actual,
- trend i trwałość efektu,
- ROI realized vs expected,
- rekomendacje korekt (kolejne inicjatywy lub decyzje).

**Wejście:** inicjatywa `DONE`.

**Wyjście:** `TRACKING` aktywne lub zamknięte/archived (docelowo gate `CLOSE_TRACKING`).

**Widoki i narzędzia workflow (MUST):**

- lista inicjatyw w `TRACKING`,
- KPI detail (pomiar, evidence, komentarz),
- alerty at-risk (KPI spada/nie dowozi).

**Gate i odpowiedzialności (MUST/SHOULD):**

- `START_TRACKING` (Business Owner): `DONE → TRACKING`
- (docelowo) `CLOSE_TRACKING` (Business Owner/PMO) → `ARCHIVED`

**Integracja (MUST):**

- KPI at-risk lub brak pomiarów w terminie generuje `Notification` do Business Owner.
- Jeśli realization odbiega krytycznie:
  - AI proponuje `Decision` (np. “adjust scope / corrective action”) lub nową inicjatywę.

**AI (docelowo):**

- automatyczne przypomnienia o pomiarach,
- analiza trendu i narracja dla raportów,
- wykrywanie “benefits leakage” i rekomendacje działań korygujących.

### 11.7 Moduł: Economics (analiza finansowa / business case) — canonical workflow

**Cel modułu:** dostarczyć _governance-grade_ business case dla inicjatywy (nie “excel”), który:

- wspiera decyzje `APPROVE` (inwestycja),
- zasila priorytetyzację i roadmap,
- staje się baseline dla Benefits (expected vs realized),
- tworzy presję przez decyzje i notyfikacje (gdy brakuje danych/ownerów/akceptacji).

**Źródła (MUST):**

- Policy: `docs/product/ECONOMIC_ANALYSIS_POLICY.md`
- Module overview: `docs/modules/ECONOMICS_MODULE.md`
- API: `server/src/routes/economics.routes.ts`

#### 11.7.1 Status machine (KANON) — ujednolicenie `FINAL` vs `APPROVED`

W repo występują dwa opisy:

- policy mówi o `DRAFT` / `FINAL`,
- moduł/API normalizuje `DRAFT` / `REVIEW` / `APPROVED`.

**KANON (MUST):** używamy statusów:

`DRAFT` → `REVIEW` → `APPROVED`

I przyjmujemy mapowanie:

- `FINAL` (z policy) == `APPROVED` (w API)

**MUST:** `APPROVED` oznacza „zamrożony snapshot business case” używany do gate’ów i raportów.

#### 11.7.2 Kiedy Economics jest wymagane (MUST)

Zgodnie z `ECONOMIC_ANALYSIS_POLICY.md`, economics jest **mandatory**, jeśli spełniony jest dowolny warunek (progi konfigurowalne):

- CAPEX > próg
- OPEX roczny > próg
- initiative typu strategic/transformation
- cross-team / multi-quarter resource impact
- risk level medium/high
- Sponsor zażąda

**MUST enforcement:** jeśli economics jest wymagane i brak `APPROVED` analysis → gate inicjatywy `APPROVE` jest zablokowany.

#### 11.7.3 Wejście/wyjście

**Wejście:**

- inicjatywa w `PLANNING` (najwcześniej `PROMOTED`, ale praktycznie od `PLANNING`),
- właściciele (Sponsor + Business Owner / owner efektów),
- dane kosztów i korzyści, assumptions.

**Wyjście:**

- `Economic Analysis (APPROVED)` jako snapshot,
- (opcjonalnie) `Decision (PENDING)` typu „Investment Go/No-Go” / „Budget approval”,
- `Notification` do ownerów, gdy brakuje danych lub terminów.

#### 11.7.4 Widoki i narzędzia workflow (MUST)

W Economics musi istnieć czytelna praca “jak w narzędziach operacyjnych”, ale z governance:

- **Analyses list** (filtry statusu, search, project/initiative linkage)
- **Analysis detail**:
  - input sections (costs/benefits/timeline/assumptions/risks),
  - computed metrics (ROI, payback, NPV jeśli liczone),
  - scenariusze: base / optimistic / conservative,
  - “warnings” i walidacje jakości danych.
- **Initiative integration**:
  - tab/sekcja w inicjatywie pokazująca status economics + summary metrics,
  - akcje: “Open analysis”, “Request missing inputs”.

#### 11.7.5 Gates i odpowiedzialności (MUST)

Economics ma swój mini‑workflow:

- `DRAFT` (autor/owner uzupełnia dane)
- `REVIEW` (reviewer sprawdza spójność assumptions)
- `APPROVED` (sponsor/business owner zatwierdza business case)

**MUST roles:**

- **Owner economics**: Business Owner (accountable za założenia i KPI baseline)
- **Reviewer**: PMO/PM (spójność i kompletność)
- **Approver**: Sponsor/Steering (akceptacja inwestycji) — może być realizowana jako `Decision` typu approval

**MUST:** Economics `APPROVED` jest wymaganym inputem do gate inicjatywy `APPROVE` (gdy policy mówi “required”).

#### 11.7.6 Minimal Required Fields (MUST)

Minimum dla stanu `APPROVED` (zgodnie z policy):

- owner (Business Owner)
- currency
- total cost (CAPEX+OPEX)
- expected benefit + benefit type
- payback period
- ROI
- assumptions
- risks
- versioning/snapshot metadata

#### 11.7.7 Zmiany (Change control) — kiedy trzeba re‑finalizować (MUST)

Jeśli zmiana dotyczy:

- budżetu,
- scope,
- benefits,

to economics musi być:

1. zaktualizowane,
2. przejść z powrotem do `REVIEW`,
3. ponownie `APPROVED`.

**MUST:** gate inicjatywy `APPROVE` / (jeśli już po approval) kolejne strategiczne decyzje muszą widzieć delta vs baseline.

#### 11.7.8 Integracja z Task/Decision/Notification/Initiative (MUST)

- **Initiative**:
  - economics jest widoczne od `PLANNING`,
  - `APPROVED` economics snapshot jest powiązany z gate `APPROVE`.
- **Decision**:
  - jeśli próg inwestycji przekroczony → system tworzy/wiąże `Decision (PENDING)` “Investment approval”.
  - decision ma due date i eskalacje; economics summary jest w decision context.
- **Notification**:
  - “Economics required for approval” do owner/reviewer,
  - przypomnienia o missing inputs,
  - escalation gdy review/approval przekracza termin.
- **Task**:
  - economics może generować taski “collect inputs” (np. od finansów), ale tylko jako wspierające (nie mylić z execution tasks inicjatywy).

#### 11.7.9 AI (docelowo) — co automatyzuje

**ADVISORY:** sprawdza spójność i ryzyka assumptions, tłumaczy ROI “po ludzku”.  
**ASSISTED:** generuje draft business case i scenariusze, proponuje KPI baseline.  
**PROACTIVE:** tworzy taski zbierania danych + notyfikacje, wykrywa brak ownera/terminu.  
**AUTOPILOT:** może przeliczać i aktualizować metryki oraz scenariusze, ale **nie może** zatwierdzać (`APPROVED`) ani wykonywać gate inicjatywy.

---

## 12) Ocena jasności pracy w module (podsumowanie)

**Jasne i spójne (✅):**

- Initiative lifecycle + gates (backend/typy/dokumenty).
- Decisions jako governance system + eskalacje (koncepcyjnie).
- Benefits jako etap TRACKING po DONE (koncepcyjnie).

**Niejasne / wymagające doprecyzowania (⚠️):**

- Interview: formalne gates i standardowe “output actions” do inicjatyw/decyzji.
- Economics: workflow jest opisany w tym dokumencie; do domknięcia zostaje implementacyjne egzekwowanie w UI/back oraz mapowanie roli Business Owner 1:1.
- Unified Activity/Audit: brak jednego strumienia dla task/decision/initiative (kluczowe dla enterprise‑grade).

---

## 13) Zatwierdzanie faz (gates) — ekrany, przydziały, domykanie, odpowiedzialności (MUST)

### 13.1 Gdzie w UI “żyją” gate’y (single source of UX)

**KANON:** gate’y inicjatywy obsługujemy w detail view inicjatywy:

- `src/components/Initiatives/InitiativeDocumentView.tsx`

To jest docelowo jeden „cockpit bramek” niezależnie od modułu wejścia (Tools/Assessment/Initiatives/Execution/Benefits).

W tym cockpit’cie są trzy kluczowe sekcje:

- **Przydziały (kto dowozi i kto decyduje)**: `TeamSection` (`src/components/Initiatives/sections/TeamSection.tsx`)
  - `Owner` (`ownerId`) — odpowiedzialny za delivery (Initiative Owner)
  - `Sponsor` (`sponsorId`) — odpowiedzialny za decyzje gate (Project Sponsor/Executive)
- **Gotowość bramki + request approval (uruchamia decyzję gate)**: `GateReadinessSection`
  - przycisk **Request** tworzy `Decision (PENDING)` typu = gate i przypisuje `deciderId`
  - due date (domyślnie 7 dni) — presja + eskalacje
- **Wykonanie przejścia statusu (zamknięcie bramki w lifecycle)**: `ControlSection`
  - primary status action buttons (np. przejście do kolejnego statusu)

### 13.2 Standard “domykania gate” (MUST)

Każda bramka jest domykana w tym samym rytmie:

1. **Prepare (Responsible)**: autor/owner przygotowuje artefakty z DoD dla gate.
2. **Assign (Accountable)**: w `TeamSection` ustawiamy Owner + Sponsor (oraz wymagane role wg polityki projektu).
3. **Request approval**: w `GateReadinessSection` klikamy **Request** → powstaje `Decision (PENDING)` i notyfikacje.
4. **Decide**: decider pracuje na `Decision` (MyWork → Decisions / Decision detail) i `APPROVE/REJECT/ESCALATE`.
5. **Close gate (status transition)**:
   - **MVP (dopuszczalne)**: uprawniony operator wykonuje status action w `ControlSection` po spełnieniu DoD i decyzji.
   - **TARGET (docelowo MUST)**: `Decision.APPROVED` automatycznie wykonuje transition inicjatywy (bez drugiego kliku), zapisuje audit i publikuje notyfikacje.

### 13.3 Kto odpowiada za gate (skrót RACI + operator)

| Gate / faza                     | Responsible (prepare)                    | Accountable (decision)                 | Operator transition (MVP)       | Ekran                                    |
| ------------------------------- | ---------------------------------------- | -------------------------------------- | ------------------------------- | ---------------------------------------- |
| `SUBMIT_FOR_REVIEW` (Discovery) | Consultant/Author                        | Reviewer (PM/Lead/PMO)                 | Author                          | Initiative detail: GateReadiness/Control |
| `APPROVE_TO_INITIATIVE`         | Reviewer                                 | Reviewer/PMO                           | Reviewer/PMO                    | Initiative detail                        |
| `ACCEPT/REJECT` (Go/No-Go)      | Initiative Owner                         | Sponsor/Steering                       | Sponsor/Steering/PMO (wg perms) | Initiative detail                        |
| `START_PLANNING`                | PMO/PM                                   | PMO                                    | PMO                             | Initiative detail                        |
| `APPROVE` (Investment)          | Initiative Owner + PMO + Economics owner | Steering _(lub Sponsor — patrz audit)_ | Steering/PMO                    | Initiative detail + Economics tab        |
| `SCHEDULE`                      | PMO                                      | PMO                                    | PMO                             | Initiative detail                        |
| `START` (Execution start)       | PMO                                      | PMO                                    | PMO                             | Execution hub/detail + Initiative detail |
| `BLOCK`                         | Initiative Owner                         | Initiative Owner/PMO                   | Initiative Owner/PMO            | Execution hub/detail + Initiative detail |
| `UNBLOCK`                       | Initiative Owner                         | Sponsor/Steering                       | Sponsor/Steering                | Decision detail + Initiative detail      |
| `COMPLETE`                      | Initiative Owner                         | Initiative Owner/PMO                   | Initiative Owner/PMO            | Execution hub/detail + Initiative detail |
| `START_TRACKING`                | Business Owner                           | Business Owner                         | Business Owner                  | Benefits hub + Initiative detail         |
| `CANCEL`                        | Initiative Owner/PMO                     | Sponsor/Steering/PMO _(patrz audit)_   | uprawniony gate owner           | Initiative detail                        |

### 13.4 Gdzie “ustalamy” kto ma domykać gate (assignment rules)

**MUST:**

- Gate owner jest wyznaczany przez przypisania w inicjatywie:
  - Sponsor (`sponsorId`) — strategiczne gate’y (Go/No-Go, unblock, investment),
  - Owner (`ownerId`) — przygotowanie i operacyjne domykanie (block/complete),
  - PMO — jeśli projekt ma rolę PMO (wymaga mapowania ról do `RoleType`).

**SHOULD (enterprise):**

- Dla każdego gate ustawiamy:
  - `gateOwnerId` (lub listę ownerów, jeśli Steering),
  - `gateDueDate`,
  - `gateDecisionId` (Decision artefakt).

---

## 14) Audyt przejść między fazami — czy wszystko jest poprawnie opisane? (P0/P1)

### 14.1 Spójność techniczna transitions

**Źródła:**  
`server/src/constants/initiativeStatuses.ts` (GateType/from→to/permissions)  
`src/services/initiativeLifecycle.ts` (VALID_TRANSITIONS)

**Wniosek:** podstawowy łańcuch faz jest spójny (Discovery → Initiatives → Execution → Benefits), ale są rozjazdy w “wokół‑gate” (patrz 14.2).

### 14.2 Rozjazdy i brakujące warianty (musi być doprecyzowane)

**P0:**

1. **`EDITING` w modelu produktu vs brak w kanonie kodu**
   - `docs/product/INITIATIVE_GOVERNANCE_MODEL.md` używa `EDITING`, kod ma `PENDING_REVIEW` + `REVIEW`.
   - **MUST decyzja:** albo dodajemy `EDITING`, albo mapujemy je na `DRAFT`/`REVIEW` (i aktualizujemy dokumenty).

2. **Gate owner dla `APPROVE`**
   - model produktu: Sponsor **lub** Steering,
   - obecne `GATE_PERMISSIONS`: Steering.
   - **MUST:** policy per projekt (kto zatwierdza inwestycję) + spójność w backend i UI.

3. **`CANCEL` — kto ma prawo**
   - model produktu sugeruje Sponsor,
   - gate permissions wskazują PMO/Steering.
   - **MUST:** ustalić kanon i wdrożyć (rekomendacja: Sponsor + Steering + PMO, zawsze z reason + audit).

4. **`ARCHIVED` — brak formalnego gate**
   - `VALID_TRANSITIONS` ma `TRACKING → ARCHIVED` i `CANCELLED → ARCHIVED`,
   - ale `GateType` nie ma `ARCHIVE`. W UI jest akcja archiwizacji (patch status).
   - **SHOULD:** ustandaryzować: kto może archiwizować, z jakich stanów, czy wymaga reason, i spiąć to z audit/notyfikacją.

**P1:**

5. **Gate `CHANGE`**
   - model produktu przewiduje Change gate, ale kanon gate’ów go nie obejmuje.
   - **SHOULD:** dodać change request workflow (albo jawnie odroczyć jako “Phase 2”).

6. **Interview gates i zdarzenia**
   - Interview nie ma egzekwowalnego kontraktu “submit/review/approve” jako standard systemowy.
   - **SHOULD:** dopisać i wdrożyć (oraz powiązać output z initiative/decision).

7. **Unified Activity/Audit**
   - Bez wspólnego Activity nie da się enterprise‑spójnie opisać “wszystkich zdarzeń” i presji (Jira-grade).
   - **SHOULD:** wdrożyć Activity API + UI (RightRail) i uczynić go prawdą czasu.

---

## 15) Decyzje kanoniczne (P0) — zamykamy niejednoznaczności (MUST)

Ta sekcja usuwa “albo/albo”. Po jej przyjęciu implementacja nie ma prawa interpretować inaczej.

### 15.1 `EDITING` — rozstrzygnięcie (MUST)

W `docs/product/INITIATIVE_GOVERNANCE_MODEL.md` występuje status `EDITING`, a w kanonie kodu nie.

**Decyzja kanoniczna:** nie wprowadzamy osobnego statusu `EDITING` w lifecycle.  
`EDITING` jest **tylko pojęciem UX**, a w statusach mapuje się na:

- `DRAFT` (inicjatywa jest edytowana / kompletowana),
- `PENDING_REVIEW` (inicjatywa jest “submitted” i czeka na review),
- `REVIEW` (inicjatywa jest “business review / Go-No-Go”).

**Instrukcja dokumentacyjna (MUST):**

- od teraz w dokumentach, jeśli pada słowo `EDITING`, to należy dopisać w nawiasie: `(= DRAFT w status machine)`.

### 15.2 Gate `APPROVE` — kto jest approverem (MUST)

**Decyzja kanoniczna:**

- Domyślnym approverem gate `APPROVE` jest **Steering Committee**.
- Jeśli projekt nie ma Steering Committee → approverem jest **Project Sponsor/Executive** (delegacja).

**Instrukcja wdrożeniowa (MUST):**

- `GATE_PERMISSIONS[APPROVE]` musi wspierać oba warianty (Steering + Sponsor fallback).
- UI ma pokazywać, kto jest approverem dla tego projektu (label w `GateReadinessSection` + w decyzji gate).

### 15.3 Gate `CANCEL` — kto może anulować inicjatywę (MUST)

**Decyzja kanoniczna (enterprise):**

- `CANCEL` może wykonać:
  - **Project Sponsor/Executive** (biznesowa decyzja),
  - **Steering Committee** (strategicznie),
  - **PMO** (operacyjnie), ale wyłącznie jeśli:
    - istnieje `Decision (PENDING/APPROVED)` typu `CANCEL` z deciderem Sponsor/Steering **albo**
    - projekt ma politykę “PMO can cancel without sponsor” (rzadkie; wymaga audytu).

**MUST:** `CANCEL` zawsze wymaga `reason` i generuje notyfikacje do Owner + Sponsor + PMO.

### 15.4 `ARCHIVED` — polityka archiwizacji (MUST)

**Decyzja kanoniczna:**

- Archiwizacja jest _polityką porządkową_, nie gate’iem strategicznym.
- Dozwolone przejścia:
  - `TRACKING → ARCHIVED` (po domknięciu rezultatów) — owner: Business Owner/PMO
  - `CANCELLED → ARCHIVED` (porządek) — owner: PMO
- `ARCHIVED` jest terminalny (brak restore) **chyba że** wprowadzimy osobny gate `RESTORE` w przyszłości.

**MUST (UI):**

- akcja “Archive” ma być dostępna tylko w dozwolonych stanach (TRACKING/CANCELLED) i mieć potwierdzenie.

### 15.5 Gate `CHANGE` — status (MUST)

**Decyzja kanoniczna:** gate `CHANGE` nie jest częścią minimalnego kanonu gate’ów inicjatywy (P1), ale:

- zmiany Scope/Schedule/Budget **muszą** być audytowane,
- a jeśli economics jest wymagane → zmiana wymusza re‑review economics (patrz 11.7.7).

**Instrukcja wdrożeniowa (SHOULD):**

- użyć istniejącego typu `ChangeRequest` z `src/types/core.ts` jako minimalnego workflow zmian.

---

## 16) Instrukcje implementacyjne (MUST) — “jak to zakodować bez zgadywania”

### 16.1 Jeden “gate cockpit” w UI

**MUST:**

- Gate’y i readiness są obsługiwane w `InitiativeDocumentView` przez sekcje:
  - `TeamSection` (assign Owner/Sponsor),
  - `GateReadinessSection` (readiness + request approval),
  - `ControlSection` (status actions).

### 16.2 Request approval = Decision (presja)

**MUST:**

- klik “Request” tworzy `Decision (PENDING)` z:
  - `type` = gate (np. `PROMOTE/APPROVE/SCHEDULE/UNBLOCK/START_TRACKING`),
  - `relatedObjectType=initiative`, `relatedObjectId=<initiativeId>`,
  - `deciderId` wynikający z policy (Owner/Sponsor/Steering),
  - `dueDate` i eskalacje.

### 16.3 Close gate = transition (docelowo automatyczny)

**MVP (MUST):**

- po spełnieniu DoD + po `Decision.APPROVED` UI umożliwia status action w `ControlSection`.

**TARGET (SHOULD, docelowo MUST):**

- backend po `Decision.APPROVED` wykonuje transition i emituje event do Activity/History.

### 16.4 Audit/History/Notifications dla każdego gate

**MUST:**

- każde z poniższych generuje audit event + notyfikacje:
  - request approval,
  - approve/reject/escape (escalate),
  - status transition,
  - block/unblock,
  - cancel/archive.

### 16.5 “Coverage checklist” (MUST) — zamykamy dokumentację

Dokumentacja jest uznana za domkniętą, jeśli dla każdego gate mamy:

- **(a)** ekran/sekcję w UI,
- **(b)** owner role + delegacja,
- **(c)** DoD (wymagania),
- **(d)** decyzję/presję (Decision/Notification),
- **(e)** transition (from→to),
- **(f)** audit event.
