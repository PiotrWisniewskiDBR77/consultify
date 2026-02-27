# N‑mode Management v3 — Templates, Sections, Completeness, Gates, AI Assist (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** zdefiniować kanoniczny system zarządzania N‑mode:  
> (1) standaryzacja sekcji (lewa nawigacja + prawa treść), (2) template’y o różnych poziomach złożoności,  
> (3) required/completeness/gate_readiness, (4) AI assist *propose→accept*, (5) Admin Template Builder.
>
> **Dlaczego:** bez tego N‑mode jest “ładnym edytorem”, ale nie prowadzi do dowiezienia jakości i przejścia gate’ów.

## 0) Powiązane źródła prawdy (MUST)

### UI/UX kanon (obowiązujący)

- Presentation modes D/N/C: `docs/ui-standards/01-shell-layout/presentation-modes.md`
- Artifact shell (N/C): `docs/ui-standards/artifact-shell-future-standard.md`
- Shared N‑mode sections: `docs/ui-standards/02-components/shared-sections.md`
- Initiative sections canon: `docs/ui-standards/02-components/initiative-sections.md`
- Building blocks: `docs/ui-standards/02-components/building-blocks.md`

### Product & program

- Program task: `docs/product/V3_IMPLEMENTATION_PROGRAM.md` → `V3-K01`
- Gates DoD policy: `docs/product/GATE_DEFINITION_OF_DONE.md`
- InitiativeLevel/templates (PMO baseline): `docs/product/INITIATIVE_LEVEL_TEMPLATES_V3.md`

### Code anchors (as‑is)

- Admin templates UI: `src/components/Admin/AdminInitiativeTemplatesPanel.tsx`, `src/components/Admin/InitiativeTemplateEditor.tsx`
- Initiative dynamic renderer: `src/components/Initiatives/InitiativeDocumentView.tsx`
- Backend templates service: `server/src/services/initiativeTemplateService.ts`
- DB: `initiative_templates` + section types (`initiative_section_types`)

---

## 1) Co jest “N‑mode” (kontrakt)

N‑mode to kanoniczny detail view dla artefaktów pracy (Initiative/Task/Decision/Notification…), który:

- prezentuje **dużą ilość danych** w czytelnej, porównywalnej strukturze,
- wspiera pracę “jak w systemie zarządzania”, nie jak w notatniku,
- umożliwia **gates i kontrolę jakości** (required + completeness),
- jest w pełni spójny wizualnie (shell + sekcje shared) i wspiera i18n PL/EN oraz `locked`.

**MUST:** nie tworzymy per‑artefakt nowych “layoutów”. Zmienna jest treść sekcji, nie struktura.

---

## 2) Anatomia N‑mode (kanon shell)

Źródło: `docs/ui-standards/artifact-shell-future-standard.md`

W skrócie (MUST):

1) **Header Bar** (sticky): tytuł, ID/index, permalink, Save, Chat, switcher N/C  
2) **Properties Strip**: 6 pól, spójne wysokości kontrolek  
3) **CTA Action Bar**: po lewej akcje biznesowe; po prawej max 1 globalny AI CTA  
4) **Content Area**:
   - **Left Nav** (220px): lista sekcji
   - **Canvas** (prawa strona): treść sekcji, spójny “card shell” i building blocks

---

## 3) Sekcje: standaryzacja lewej nawigacji i prawej treści

### 3.1 Zasada: “section type library” jako dane (MUST)

Sekcja nie jest “dowolnym JSX”. Sekcja jest typem z biblioteki:

- ma stabilny `key` (niezależny od języka),
- ma nazwę EN + PL (do left nav),
- ma ikonę (spójną w całej aplikacji),
- ma `componentKey` (mapowanie na komponent),
- ma kategorię (`content/control/meta`) i domyślne pozycjonowanie.

As‑is dla Initiatives: `initiative_section_types` + dynamic renderer.

### 3.2 Standaryzacja nazewnictwa (MUST)

To, co widzimy po lewej, musi być:

- **identyczne semantycznie** między artefaktami (tam gdzie to możliwe),
- **identyczne wizualnie** (typografia, ikony, badge count),
- **porównywalne** (sekcja “KPI” wygląda jak KPI w innym artefakcie, a nie jak “losowy blok”).

Źródło kanonicznej kolejności dla Initiative jest w `docs/ui-standards/02-components/initiative-sections.md`.

### 3.3 Standaryzacja prawej treści (MUST)

Każdy `section type` ma:

- wspólny **card shell** (header + actions + body + empty state),
- spójne mechaniki:
  - `+ Add` w prawym górnym rogu sekcji (w wariancie light lub framed),
  - lokalny AI button w stałym miejscu,
  - “More/Less” overflow standard,
  - te same building blocks (`InlineTable`, `ChecklistBlock`, `EmbeddedView`, …).

**Zakaz:** tworzenia “unikatowych mini‑layoutów” bez potrzeby. Najpierw używamy shared sections i blocks.

---

## 4) Template’y N‑mode (różny poziom złożoności)

### 4.1 Po co template’y (product intent)

Nie każdy artefakt od razu jest “20‑sekcyjnym potworem”.

Template’y pozwalają:

- zacząć od lekkiej formy (np. idea → quick initiative),
- rosnąć wraz z dojrzałością/ryzykiem inicjatywy (upgrade template),
- mieć **bramki jakości** adekwatne do poziomu (required/completeness per gate),
- zachować spójny UI (ta sama lista sekcji, tylko różna widoczność i wymagania).

### 4.2 Initiative templates (as‑is + kanon v3)

W systemie istnieją 4 poziomy (as‑is w Admin):

- `quick_win`
- `standard`
- `enterprise`
- `full_charter`

Każdy template definiuje (as‑is DB + editor):

- `visibleSections` (mapa sekcji),
- `requiredFields` (global),
- `workflowConfig`, `gateConfig`, `validationRules`,
- suggested tasks/milestones/decisions/roles/KPIs,
- team/finance/benefits/escalation/notifications/status reports.

### 4.3 Task / Decision / Notification templates (v3)

W v3 rozszerzamy **ten sam model** na:

- Task templates (np. lite / standard / compliance-heavy)
- Decision templates (np. lightweight / governance / steering)
- Notification templates (np. simple / compliance / escalation)

Zasada: to jest *ten sam mechanizm template-driven sekcji + required/completeness*, tylko inne section libraries.

> Implementacyjnie może to być osobna tabela per typ lub generyczna tabela; SSOT wymaga zachowania kontraktu, nie konkretnej tabeli.

---

## 5) Required / Completeness / Gate readiness (fundament V3‑K01)

### 5.1 Definicje

- **Required item**: element, który musi być spełniony dla danego artefaktu i stanu (status/gate).
- **Missing item**: required item, który nie jest spełniony.
- **Completeness score**: liczba 0–100 pokazująca “jak blisko jesteśmy gotowości”.
- **Gate readiness**: bool/enum określający, czy wolno wykonać krytyczne przejście (np. Submit/Approve/Start).

### 5.2 Źródła required items

Required items wynikają z:

1) Template’u (level + konfiguracje): `requiredFields`, `validationRules`, `gateConfig`
2) Polityk globalnych (np. gates DoD): `docs/product/GATE_DEFINITION_OF_DONE.md`
3) Kontekstu (np. status, rola, typ inicjatywy, source type)

### 5.3 Kontrakt API (MUST)

Dla dowolnego artefaktu w N‑mode backend musi umieć zwrócić:

- `required_items[]`
- `missing_items[]`
- `completeness_score`
- `gate_readiness` (np. `ready | blocked | warning`)

To jest dokładnie wymaganie z `V3-K01` w programie.

### 5.4 UI kontrakt (MUST)

- W N‑mode jest widoczna **completeness pill** (np. w properties strip/canvas header).
- Klik → otwiera listę braków (missing items) z:
  - dlaczego to jest required,
  - gdzie to uzupełnić (deep link do sekcji),
  - akcje “Fix” / “Propose fill” (AI).
- Próba przejścia przez gate/status bez readiness → blokada + jasny komunikat + lista braków.

---

## 6) AI assist (propose→accept) dla completeness

AI w N‑mode ma 3 role:

1) **Diagnose missing**: wskazuje braki na bazie danych + template’u (nie opinii)
2) **Propose fill**: generuje propozycje uzupełnień (tekst/rekordy) dla braków
3) **One‑click apply**: user akceptuje/odrzuca; system zapisuje zmiany i aktualizuje completeness

**MUST:**

- AI nigdy nie nadpisuje pracy usera bez akceptacji.
- AI nie zmienia “sources” (traceability) — tylko proponuje content w artefakcie.
- Każda propozycja ma granularne accept/reject.

---

## 7) Zmiana template’u i “dołożenie sekcji” w trakcie pracy

To jest kluczowe do Twojego scenariusza:

### 7.1 Zmiana template’u (MUST)

Artefakt może zmienić template:

- upgrade (np. `quick_win → standard → enterprise`) jest wspierany wprost,
- downgrade jest dopuszczalny tylko jeśli nie psuje gate’ów (w praktyce: rzadko; wymagane ostrzeżenie).

Zmiana template’u wpływa na:

- widoczność sekcji (left nav),
- required items i completeness,
- gate policies.

### 7.2 “Add section” (MUST)

Jeśli brakujące dane dotyczą sekcji, która jest niewidoczna w obecnym template:

- UI oferuje: **Upgrade template** lub **Enable section** (jeśli polityka pozwala),
- system zapisuje zmianę w konfiguracji artefaktu (nie musi zmieniać globalnego template’u).

> Zasada: template jest punktem startu, ale artefakt może mieć “overrides” — jawne i audytowalne.

---

## 8) Admin — N‑mode Template Builder (kanoniczny)

As‑is istnieje:

- Initiative Templates CRUD: `AdminInitiativeTemplatesPanel` + `InitiativeTemplateEditor`

Kanon v3:

1) **Section Type Library** (per artefakt type):
   - list, filters, preview konfiguracji
2) **Template Editor**:
   - level, sources, sections visibility + ordering + per-section config
   - workflow/gates/validation
   - suggested tasks/milestones/decisions/roles/KPIs
   - team/finance/benefits/escalation/notifications/status reports
3) **Template usage**:
   - wybór template przy tworzeniu artefaktu (tool/assessment/manual/AI)
   - możliwość upgrade template w trakcie pracy

**MUST:** “to jest jeden kreator template’ów” — nie osobne, różne edytory per artefakt, tylko ten sam pattern UI.

---

## 9) Zadania do programu (jak wycinać taski z tego SSOT)

Minimalny zestaw tasków w ramach `V3-K01`:

1) **Audit & standardization**
   - przegląd wszystkich artefaktów N‑mode i ujednolicenie nazw sekcji (left nav)
   - ujednolicenie “prawej treści” sekcji (card shells, empty states, add patterns, AI button placement)
2) **Completeness engine**
   - required/missing/completeness/gate_readiness jako dane (template + status)
   - UI pill + missing list + deep links
3) **AI assist**
   - propose→accept + one-click fill (per missing item)
4) **Templates**
   - inicjatywy: 4 poziomy (as‑is) dopięte do completeness/gates
   - task/decision/notification: 2–3 template’y na start (lite/standard/governance)
5) **Admin Template Builder**
   - wspólny pattern i CRUD dla template’ów (as‑is dla initiative → rozszerzenie na inne typy)

