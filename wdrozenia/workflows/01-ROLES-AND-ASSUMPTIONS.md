# 👥 Kanon ról + założenia (jedno rozumienie)

## Cel
Ten dokument ustala **jedno rozumienie**:
- jakie role istnieją w procesie (biznesowo),
- jakie mają odpowiedzialności,
- jak działa **delegacja** w projektach, gdzie nie wszystkie role występują,
- jak mapujemy to na role/pojęcia w kodzie (Account Type vs Project Role).

> To jest dokument **kanoniczny dla workflow**. Moduły mają być z nim spójne (gates, uprawnienia, UI).

---

## 1) Dwa poziomy ról (żeby nie mieszać pojęć)

### A) Account Type (organizacja / tenant)
Służy do zarządzania organizacją jako „kontem”:
- billing / ownership,
- administracja użytkownikami,
- ustawienia organizacji i systemu.

**Nie definiuje** kto podejmuje decyzje procesowe w inicjatywach — to robi poziom projektu.

Źródło: `src/types/core.ts` (`UserRole`).

### B) Project Role (projekt)
Służy do sterowania procesem w konkretnym projekcie:
- kto wykonuje pracę,
- kto odbiera jakość (review),
- kto podejmuje decyzje gate’owe (Go/No‑Go, approvals, unblock, cancel),
- kto rozlicza efekty (benefits).

Źródło: `src/types/core.ts` (`ProjectRole`).

---

## 2) Role procesowe (kanon workflow) — 8 ról
To są role, których używamy w dokumentacji workflow (Initiative lifecycle, gates, odbiory). To one muszą być spójne w UX/UI.

1. **Admin (techniczny)**
   - konfiguruje system i polityki,
   - **nie jest aktorem procesu** (admin override powinien być auditowany).

2. **Consultant (autor treści)**
   - tworzy i edytuje artefakty discovery (Tools/Assessment/Interview),
   - może wykonać „submit for review” własnej pracy,
   - **nie podejmuje gate decisions biznesowych**.

3. **Initiative Owner (operacyjny właściciel)**
   - prowadzi inicjatywę w Execution, zarządza taskami,
   - operacyjnie może `BLOCK/COMPLETE`.

4. **Project Sponsor (właściciel biznesowy)**
   - odpowiada za sens biznesowy, priorytety i budżet,
   - decyduje: `ACCEPT/REJECT/UNBLOCK` (biznesowo).

5. **PMO (governance / porządek wykonawczy)**
   - planowanie, harmonogram, start/stop, standaryzacja,
   - decyduje: `START_PLANNING/SCHEDULE/START/CANCEL` (wykonawczo).

6. **Steering Committee (strategiczne decyzje / eskalacje)**
   - najwyższe decyzje i konflikty,
   - decyduje: `APPROVE` strategiczne, `CANCEL`, `UNBLOCK` po eskalacji.

7. **Team Member (wykonanie)**
   - wykonuje taski, aktualizuje statusy, dostarcza evidence,
   - nie podejmuje decyzji procesowych.

8. **Business Owner (właściciel efektów)**
   - odpowiada za KPI/benefits, weryfikację outcomes,
   - decyduje: `START_TRACKING/CLOSE_TRACKING`.

Źródło definicji kanonu: `wdrozenia/standards/07-ROLES-PERMISSIONS.md`.

---

## 3) Minimalny zestaw ról per typ projektu (zasada: projekty mogą być „mniejsze”)

### A) Projekt mały (Discovery / prototyp)
Minimalnie:
- Consultant (lub autor)
- PM (jako reviewer)
- Sponsor (jeśli ma być Go/No‑Go)

Delegacje:
- PMO → PM
- Steering → Sponsor
- Business Owner → Sponsor (jeśli w ogóle mierzymy efekty)

### B) Projekt średni (end-to-end do Execution)
Minimalnie:
- PM
- Sponsor
- Initiative Owner
- Team Member(s)

Delegacje:
- PMO → PM (jeśli brak PMO)
- Steering → Sponsor (jeśli brak committee)

### C) Program duży (portfolio)
Pełny kanon:
- PMO
- Steering Committee
- Sponsor(y)
- Initiative Owner(s)
- Team Member(s)
- Business Owner(s)
- Reviewer (jako funkcja)
- Consultant (jeśli discovery robi doradca)

---

## 4) Reguły delegacji (gdy roli nie ma)
To jest **twardy kanon**, żeby workflow zawsze miał „kto decyduje”:

- **Jeśli brak PMO** → obowiązki PMO przejmuje **Project Manager**.
- **Jeśli brak Steering Committee** → strategiczne `APPROVE/CANCEL` przejmuje **Sponsor / Project Executive**.
- **Jeśli brak Business Owner** → tracking korzyści robi **Sponsor** (albo PMO/PM), ale musi być wskazany owner KPI.
- **Jeśli brak Reviewer** → review artefaktów robi **Project Manager**.
- **Jeśli brak Consultant** → discovery robi **PM/Team Lead**.

---

## 5) Kanon odpowiedzialności: „kto co ma dostarczyć”

### Discovery (Interview / Tools / Assessment)
- **Autor (Consultant/PM/Lead)**: tworzy treść, spełnia DoD, składa do odbioru.
- **Reviewer (PM/Lead/PMO)**: odbiera jakość; może odesłać `send back` z checklistą.
- **Sponsor**: widzi tylko artefakty „quality‑checked” (po review), chyba że projekt ustali inaczej.

### Initiatives (Review → Planning → Approved → Scheduled)
- **Sponsor/Steering**: Go/No‑Go + approval strategiczny.
- **PMO/PM**: planowanie, schedule, start.
- **Initiative Owner**: przygotowuje do wykonania (taski, zasoby, ryzyka).

### Execution (Executing/Blocked/Done)
- **Initiative Owner**: operacyjne decyzje (block/complete), zarządzanie taskami.
- **Team Member**: wykonanie.
- **Sponsor/Steering**: odblokowanie biznesowe (unblock) i cancel.

### Benefits (Tracking)
- **Business Owner**: KPI actual, evidence, zamknięcie trackingu.
- **PMO/PM**: governance i raportowanie.

---

## 6) Mapowanie kanonu na role w kodzie (robocze)
W kodzie mamy więcej ról projektowych niż w kanonie. Kanon wybiera „role procesowe”, a kod może je reprezentować:

- **Sponsor** → `ProjectRole.PROJECT_EXECUTIVE` i/lub `ProjectRole.SPONSOR`
- **PMO** → `ProjectRole.PMO_LEAD`
- **PM** → `ProjectRole.PROJECT_MANAGER`
- **Initiative Owner** → `ProjectRole.INITIATIVE_OWNER`
- **Team Member** → `ProjectRole.TEAM_MEMBER` (czasem `TASK_ASSIGNEE`)
- **Reviewer** → `ProjectRole.REVIEWER` (albo PM w małych projektach)
- **Business Owner** → brak 1:1 (często `DECISION_OWNER` lub dedykowana rola do dodania, jeśli chcemy twardo rozróżniać)
- **Steering Committee** → praktycznie „grupa” (często: `PROJECT_EXECUTIVE` + `DECISION_OWNER` + reguły eskalacji)

> To mapowanie może się doprecyzować, gdy zakończą się równoległe prace nad artefaktami (Tools/Initiatives itd.).

---

## 7) Założenia (assumptions) — które muszą być prawdą, żeby workflow działał
1. **Każdy gate ma ownera i termin** (Decision Owner + due date) oraz audit trail.
2. **Consultant nie wykonuje decyzji biznesowych** (może tylko submit do review).
3. **Admin jest techniczny** — każde „admin override” jest flagowane w audycie.
4. **Artefakty discovery mają odbiór jakości** (Interview assignment, Tool Report, Assessment Report).
5. **Statusy i przejścia są egzekwowane w backend** (UI tylko odzwierciedla).
6. **Nie ma mock fallbacków w produkcyjnym UI** (loading/error/empty + retry).
7. **Brak roli nie blokuje procesu** — działa delegacja z sekcji 4.

