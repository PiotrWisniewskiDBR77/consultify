# V3 Sprint Agent Runbook — jak uruchamiać 12 sprintów bez chaosu
>
> **Status:** Canonical (operational)  
> **Owner:** Piotr  
> **Last updated:** 2026-02-28  
>
> **Cel:** dać Ci procedurę + gotowy “kontrakt pracy” dla oddzielnego agenta per sprint:
> - agent startuje od podsumowania zakresu i kontraktu (IN/OUT + DoD),
> - implementuje tylko scope sprintu,
> - zapisuje BO rzeczy, które nie mieszczą się w sprincie,
> - kończy sprint raportem “co dowiezione” + jak to odebrać w aplikacji,
> - dopiero po Twojej akceptacji robimy merge do `main`.

---

## 0) Źródła prawdy (MUST)

- Sprinty: `docs/product/V3_SPRINT_PLAN_12_SPRINTS.md`
- Change register + GAP: `docs/product/V3_ACTION_PLAN.md`
- Backorder: `docs/product/V3_BACKORDER.md`
- Program ledger (V3-*): `docs/product/V3_IMPLEMENTATION_PROGRAM.md`
- UI standards (nie wymyślamy komponentów): `docs/ui-standards/**`

---

## 1) Model pracy: “Sprint Branch + małe PR-y” (żeby nic nie zginęło)

### 1.1 Gałęzie

- `main` — zawsze releasable (tylko odebrane sprinty)
- `staging` — deploy branch (po odebraniu sprintu)
- `sprints/S{NN}-{slug}` — gałąź integracyjna sprintu (pracujemy tu w trakcie sprintu)
- `S{NN}/<topic>` — opcjonalne pod-gałęzie robocze, jeśli trzeba rozdzielić prace

### 1.2 Zamykanie sprintu (kontrakt)

Sprint uznajemy za “zamknięty” tylko jeśli:

1) jest PR do `main` z gałęzi `sprints/S{NN}-{slug}` (może być Draft na początku),
2) checklisty odbioru z `V3_SPRINT_PLAN_12_SPRINTS.md` są przejściowe i na końcu “PASS”,
3) wszystkie “nie zmieściło się / blokowane” są zapisane jako BO,
4) po Twojej akceptacji: merge do `main` + aktualizacja `staging`.

---

## 1.3 Uprawnienia na Git side-effects (MUST)

W tym repo obowiązuje zasada bezpieczeństwa: **agent nie robi commitów/push/PR, jeśli user nie poprosił wprost**.

Dlatego w każdym sprincie traktujemy jako “jawne polecenie użytkownika”, gdy:

- user wkleja prompt sprintu zawierający **Branching: Push immediately + Draft PR**, albo
- user akceptuje Sprint Contract zawierający zdanie: **“Masz zgodę na commit/push i otwarcie Draft PR”**.

**Konsekwencja dla agentów:**

- jeśli prompt zawiera instrukcję push/PR → **wykonaj to bez wahania** (to jest explicit request),
- nie “wstrzymuj się” z PR, bo sprint bez PR nie jest zamykalny operacyjnie.

---

## 2) Kontrakt startu agenta (MUST: agent zaczyna tym)

Każdy agent sprintu zaczyna swoją pracę od sekcji:

### 2.1 Sprint Summary (1–2 min czytania)
- **Sprint ID**: S{NN}
- **Cel sprintu**: 1 zdanie
- **Scope (IN)**: 3–7 punktów (konkret)
- **Scope (OUT)**: 2–3 punktów (jawnie)
- **SSOT refs**: lista
- **V3 mapping**: V3-* + CR-*
- **Definition of Done (DoD)**: 3–5 warunków
- **Demo path**: 5–10 minut (klikane kroki)

### 2.2 Sprint Contract (uzgadniany z Tobą)
Agent ma napisać: “Jeśli zaakceptujesz ten kontrakt, zaczynam implementację”.

**W kontrakcie MUSI się znaleźć zdanie o Git:**

- “Po akceptacji zrobię commity na `sprints/S{NN}-{slug}`, wypchnę branch i otworzę Draft PR do `main`.”

---

## 3) Kontrakt pracy agenta (MUST)

### 3.1 Scope guardrails
- Agent nie rozszerza scope poza Sprint S{NN}.
- Jeśli pojawia się nowy pomysł lub blocker:
  - wpis do `V3_BACKORDER.md` (BO-…),
  - kontynuujemy sprint (bez rozlewania).

### 3.2 UI/UX guardrails
- **Zakaz** tworzenia nowych komponentów UI jeśli nie ma standardu w `docs/ui-standards/**`.
- Jeśli brakuje standardu: BO z propozycją standardu (bez implementacji ad-hoc).

### 3.3 Traceability / i18n / locked
- Jeśli sprint tworzy outputy: `source_type/source_id` i “Open source” muszą działać.
- i18n PL/EN i locked/read-only tam, gdzie dotyczy.

---

## 4) Kontrakt końca sprintu (MUST: agent kończy tym raportem)

Agent kończy pracę tylko gdy:
- checklisty odbioru mają status PASS **albo** jasno opisany jest blocker (BO).

Raport końcowy agenta musi zawierać:

1) **What shipped** (entry points w UI)
2) **Acceptance checklist** (skopiowana z planu sprintu, z PASS/FAIL)
3) **Backorder items created/updated** (`BO-…`)
4) **Tests & commands** (co uruchomione)
5) **Known gaps/risks**
6) **PR link + branch name**

### 4.1 Zakaz “PASS z wyjątkami” (MUST)

Jeśli agent przenosi element checklisty do BO, to:
- ten punkt checklisty ma status **FAIL (blocker)**,
- w raporcie musi być **link do BO** i minimalny opis, dlaczego to nie weszło do sprintu.

Cel: uniknąć sytuacji “drobny zakres dowieziony, ale raport mówi PASS”.

---

## 5) Gotowy “prompt template” do uruchomienia agenta sprintu

> Wklejasz to do nowego agenta, podmieniasz `{NN}` i `{slug}` oraz wklejasz sekcję sprintu z `V3_SPRINT_PLAN_12_SPRINTS.md`.

```text
You are Sprint Agent S{NN}. Your single goal is to implement Sprint S{NN} exactly as specified in:
- docs/product/V3_SPRINT_PLAN_12_SPRINTS.md (Sprint S{NN})
- docs/product/V3_ACTION_PLAN.md (CR mapping + GAP rules)
- docs/product/V3_BACKORDER.md (BO format and process)
- docs/ui-standards/** (MUST: do not invent new UI components)

Branching:
- Create/checkout: sprints/S{NN}-{slug}
- Push branch to GitHub immediately and open a Draft PR to main:
  title: "S{NN}: {short title}"
  body must include: V3-IDs, CR-IDs, BO-IDs

Rules:
1) Start by posting a Sprint Summary and Sprint Contract (IN/OUT, SSOT refs, DoD, demo path).
2) Implement only Sprint S{NN}. Any new idea/blocker goes to V3_BACKORDER.md as BO-YYYYMMDD-###.
3) UI/UX: only use components/standards from docs/ui-standards/**. If missing, create BO proposing a standard.
4) Respect i18n PL/EN and locked/read-only where applicable.
5) If your changes create artifacts, enforce traceability (source_type/source_id + Open source).

Finish only when:
- Acceptance checklist is PASS, or you have a short blocker list with BO entries.

In your final message include:
- What shipped (UI entry points)
- Acceptance checklist PASS/FAIL
- BO items added/updated
- Tests/commands run
- PR link
```

