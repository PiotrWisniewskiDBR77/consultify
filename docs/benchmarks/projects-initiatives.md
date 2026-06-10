---
brief: projects-initiatives
module: Initiatives / Projekty
sources: [Linear (scrape 2026-06, linear.app + Method), ClickUp (developer.clickup.com + help.clickup.com, 2026-06), Monday (developer.monday.com, 2026-06)]
status: done
updated: 2026-06-09
---

# Benchmark: Initiatives / Projekty

> Po co: ustawić model danych i UX naszego modułu Initiatives wobec trzech wzorców rynku —
> Linear (opiniotwórcza prędkość + warstwa Initiative→Project→Issue), ClickUp (głęboka hierarchia
> + custom fields + automatyzacje), Monday (typowane kolumny + multi-level boards). Cel: NIE budować
> kolejnego generycznego task-trackera, tylko wzmocnić naszą doktrynę inicjatywy (convergence point +
> engine of transformation; MECE / Kerzner / Kaplan-Norton) sprawdzonymi prymitywami.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **Linear** | „Product development system for teams and agents" — opiniotwórczy, szybki, dla zespołów produktowych | **Initiatives → Projects → Issues** jako wbudowana hierarchia strategii→egzekucji + Linear Method (doktryna) + sub-second UX |
| **ClickUp** | „One app for everything" — maksymalnie konfigurowalny, all-in-one | 6-poziomowa **Hierarchy** (Workspace→Space→Folder→List→Task→Subtask) + custom statuses + Custom Fields + Automations |
| **Monday** | Wizualny „Work OS" na bazie arkusza | **Board→Group→Item→Subitem** z typowanymi kolumnami + **rollup columns** (agregacja w górę) + multi-level boards (do 5 poziomów) |

Wniosek strategiczny: **Linear to nasz wzorzec doktryny i hierarchii** (mają dokładnie warstwę
Initiative, której my chcemy bronić jako rdzenia). **ClickUp to wzorzec modelu danych** (statusy,
custom fields, automatyzacje, dependencies). **Monday to wzorzec agregacji** (rollup = nasze
KPI/postęp inicjatywy liczony z dołu). My nie kopiujemy konfigurowalności ClickUp/Monday — kradniemy
opiniotwórczość Linear i nakładamy ją na doktrynę Initiative Formula.

## 2. Wzorce UX / IA (co działa)

- **Hierarchia strategia→egzekucja jako first-class obywatel** (Linear: Initiatives / Projects / Issues
  w sidebarze „Workspace") → `assets/projects-initiatives/01-linear-list-view.png` → *dlaczego działa:*
  inicjatywa nie jest „tagiem" na zadaniu, tylko osobnym poziomem nawigacji → *jak u nas:* Initiative =
  poziom 1 (convergence point), Project/Charter = poziom 2, działania = poziom 3; nasz Charter wizard
  zasiedla poziom 1, nie poziom zadania.
- **Status jako jawny workflow z czasem-w-stanie** (Linear: Triage→Todo→In Progress→In Review→Ready→Done,
  każdy z „time in status") → `assets/projects-initiatives/02-linear-status-workflow.png` → *dlaczego:*
  status to lifecycle, nie label; metryka czasu w stanie ujawnia blokery → *jak u nas:* status inicjatywy
  to fazy transformacji (np. Diagnoza→Charter→Realizacja→Mierzenie efektu), z czasem-w-fazie jako sygnałem.
- **Lista pogrupowana + bogate badge'e metadanych w jednym wierszu** (Linear: priorytet, label, „28d",
  koszt $576/yr, assignee — wszystko inline) → `01-linear-list-view.png` → *jak u nas:* wiersz inicjatywy
  niesie owner, fazę, KPI-target, ROI/impact, deadline bez wchodzenia w kartę.
- **Onboarding przez „Space = zespół/dział/inicjatywa wysokiego poziomu"** (ClickUp) →
  `assets/projects-initiatives/03-clickup-create-space.png` → *dlaczego:* modal tłumaczy semantykę encji
  w jednym zdaniu (ikona + nazwa + private/share) → *jak u nas:* tworzenie inicjatywy = krótki modal z
  doktrynalną podpowiedzią (co to convergence point), nie pusty formularz.
- **Intake → inicjatywa** (Linear: z rozmowy Slack/Intercom/Gong robi się issue; @Linear) → *jak u nas:*
  z Wywiadu/Ankiety/Insightu jednym ruchem powstaje kandydat na inicjatywę (mamy już insight→initiative).

## 3. Model danych / architektura

Trzy spójne wzorce hierarchii + typowanych pól — to siatka kontrolna naszego schematu:

| | Linear | ClickUp | Monday |
|---|---|---|---|
| Kontener | Team → **Initiative → Project** | Workspace→Space→Folder→**List** | **Board** (+ Group) |
| Jednostka pracy | **Issue** (+ sub-issue) | **Task** (+ nested Subtask) | **Item** (+ Subitem) |
| Głębokość | Issue/sub-issue + Milestones | Subtaski zagnieżdżone (ClickApp) | **Multi-level: do 5 poziomów** |
| Pola | properties + custom | **Custom Fields** (typowane) | **Columns** (typowane) |
| Agregacja | scope/velocity, project progress | progress (auto/manual) | **Rollup columns** (number/date/status) |

- **Custom Fields (ClickUp) = nasz słownik atrybutów inicjatywy.** Typy z API: `drop_down`, `labels`,
  `number`, `currency`, `date`, `short_text`/`text`, `checkbox`, `tasks` (relacja), `users` (People),
  `emoji` (rating), `automatic_progress` / `manual_progress` (pasek postępu), `location`. Każdy ma
  `type_config` (np. dropdown ma `options[]` z `orderindex`, currency ma `currency_type`+`precision`).
  → Dla nas: pola Charteru (KPI, baseline/target, budżet, owner, ryzyko) to typowane pola, nie wolny tekst.
- **Relacje/zależności (ClickUp):** `linked_tasks` (luźny link) vs `dependencies` (`type`, `depends_on`,
  `chain_id`) — dwa różne byty. Linear ma Milestones + dependencies między projektami (critical path).
  → Dla nas: inicjatywy mają zależności (MECE: blocker/enabler — dokładnie język Linear Method 2.3) i
  kamienie milowe; to karmi „engine of transformation".
- **Rollup (Monday):** komórka rodzica = agregat dzieci (suma/min/max/status) na number/date/status.
  → Dla nas: postęp i KPI inicjatywy liczone z działań w dół — nie wpisywane ręcznie. To nasz Kaplan-Norton
  (kaskada celów) na poziomie danych.
- **Status = osobna encja z grupami** (ClickUp custom statuses; Linear stany z kategoriami
  Backlog/Unstarted/Started/Completed/Canceled). → status inicjatywy konfigurowalny per typ transformacji,
  ale z kanonicznymi kategoriami (żeby raportowanie cross-initiative działało — antyteza chaosu ClickUp).
- **Views jako zapisany obiekt** (ClickUp `type`: list/board/calendar/gantt + `grouping`/`filters`/`sorting`/
  `columns`; Monday board_views: Table/Kanban/Timeline/Gantt/Calendar/Chart/Form). → ten sam zbiór
  inicjatyw renderowany jako Lista / Board (po fazie) / Timeline (Gantt — Kerzner) / Kalendarz.

## 4. API / integracje (jeśli istotne)

- **ClickUp:** REST v2/v3 + **Webhooks** (task/list/folder/space + Automation Call + Goal/Target payloads,
  z sygnaturą), **MCP Server** (oficjalny, narzędzia do CRUD tasków/list) — wzorzec „AI asystent steruje
  projektami". Automations = **Trigger → Condition → Action** (np. status changed → assign → comment;
  triggery: status, tag added, button custom field; warunki na polach).
- **Linear:** GraphQL + **MCP** (Claude Code / ChatGPT / Figma „search/create/update issues, projects,
  initiatives"); **Agents** jako pełnoprawni członkowie (assign issue do agenta, @mention w wątku);
  Git automations (branch name → status). → wzorzec dla Teresy: agent jako wykonawca działań inicjatywy.
- **Monday:** GraphQL (items/columns/boards/groups/subitems), `create_project` mutation (Portfolio),
  rollup + multi-level w toku rolloutu 2025/2026.
→ Dla nas: webhook „status inicjatywy zmieniony" + MCP/agent endpoint, żeby Teresa czytała i ruszała
  inicjatywy. Automatyzacja Trigger→Condition→Action to minimalny, sprawdzony model (nie budować silnika
  reguł od zera).

## 5. Decyzje dla Consultify

- ✅ **Kradniemy (Linear):** Initiative jako **osobny poziom nawigacji nad projektem/zadaniem**, nie tag.
  To dosłownie nasza doktryna „convergence point" w UX. + status-jako-workflow z czasem-w-fazie.
- ✅ **Kradniemy (ClickUp):** typowany słownik **Custom Fields** dla pól Charteru (KPI/baseline/target/
  budżet/ryzyko/owner) + model **dependencies vs linked** (blocker/enabler = MECE) + **Trigger→Condition→
  Action** jako jedyny model automatyzacji.
- ✅ **Kradniemy (Monday):** **rollup** — postęp i KPI inicjatywy liczone z działań w dół (Kaplan-Norton
  w danych), nie ręcznie.
- ✅ **Kradniemy (Linear Method jako doktryna produktu):** „Scope projects down", „Prioritize enablers
  and blockers", „Set useful goals", „Generate momentum" — to gotowy język do naszego Initiative Formula.
- ⚠️ **Adaptujemy:** widoki jako zapisany obiekt (list/board/timeline/calendar) — ale **Gantt/timeline
  to must** (Kerzner, kamienie milowe), nie opcja. Jeden zbiór inicjatyw, wiele renderów.
- ⚠️ **Adaptujemy:** intake (Linear) — z Wywiadu/Insightu/Ankiety jednym ruchem rodzi się kandydat na
  inicjatywę; mamy zalążek (insight→initiative), domknąć do „speed of conversation".
- ❌ **Unikamy (ClickUp/Monday antywzorzec):** nieograniczonej konfigurowalności statusów/pól per-lista.
  Daje to chaos i zabija raportowanie cross-initiative. My narzucamy **kanoniczne kategorie faz** (doktryna
  > elastyczność).
- ❌ **Unikamy:** traktowania inicjatywy jak zwykłego taska z polem „typ=initiative". Initiative ≠ duże
  zadanie — to byt strategiczny (Charter, KPI, ROI, kaskada). Płaski model = utrata przewagi.
- ❌ **Unikamy:** 5 poziomów zagnieżdżenia (Monday multi-level) — overkill; głębokość Initiative→
  Project/Charter→Action wystarcza i pozostaje czytelna.

## 6. Otwarte pytania / do walidacji

- Czy nasze „fazy inicjatywy" to sztywny enum (kanon) czy konfigurowalny per typ transformacji z
  kanonicznymi kategoriami (jak Linear: Started/Completed/Canceled)? Rekomendacja: to drugie.
- Rollup KPI: liczymy postęp z działań (bottom-up) czy owner wpisuje (top-down)? Doktryna mówi bottom-up
  — czy mamy dane działań, żeby to udźwignąć w v1?
- Czy budujemy własny silnik automatyzacji (Trigger→Condition→Action) już w v1, czy to wave 2?
- Gdzie kończy się Initiatives a zaczyna KPI/OKR (`kpi-insights.md`)? Rollup i „set useful goals" to
  wspólna granica — uzgodnić właściciela metryki.

## Załączniki
Zrzuty (realne UI): `assets/projects-initiatives/01-linear-list-view.png` (lista issue z grupowaniem +
badge'ami), `02-linear-status-workflow.png` (workflow statusów + time-in-status),
`03-clickup-create-space.png` (modal tworzenia Space z semantyką hierarchii).
Surowe źródła (do usunięcia po akceptacji): `Softs/0 Projekty/{Clickup dev,Clickup help,Linear,Monday dev}.zip`.
Uwagi do źródeł: **`Monday help.zip` to w rzeczywistości scrape Notion API**, a **`Monday support.zip`
to Evernote** — oba ZAFAŁSZOWANE etykietą, nieużyte (poza modułem). Realne dane Monday tylko z
`Monday dev.zip`. Strony marketingowe Linear i docs ClickUp/Monday są częściowo JS-renderowane —
najwartościowsze: API docs (model danych) + Linear Method (doktryna) + renderowane assety produktowe.
