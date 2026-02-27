# KPI Deviation Management v3 — progi, alerty, action plan, accountability (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** odwzorować “kartę mierników” + “kartę KPI” w trybie **operacyjnym**, tzn. KPI nie jest tylko sprawozdawcze, ale uruchamia pętlę: **wykryj odchylenie → przypisz ownera → wyjaśnij przyczynę → action plan → tracking → zamknięcie**.

## 0) Powiązane SSOT (MUST)

- Results module mental model: `docs/product/RESULTS_V3.md`
- Gates / DoD policy: `docs/product/GATE_DEFINITION_OF_DONE.md`
- Evidence discipline (claim → evidence): `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`
- Tool knowledge packs (RAG): `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`

---

## 1) Terminologia (kanon)

- **KPI Definition**: definicja metryki (nazwa, wzór, jednostka, owner, źródło danych, częstotliwość).
- **KPI Time-series Point**: pojedynczy wpis/obserwacja KPI dla okresu.
- **Threshold bands**: widełki bezpieczeństwa (np. Green/Amber/Red) determinujące reakcję.
- **Deviation Case**: “sprawa odchylenia” tworzona automatycznie po przekroczeniu widełek; ma ownera i status.
- **Action Plan**: zestaw działań (tasków) naprawczych, z terminami i odpowiedzialnością.

---

## 2) Progi bezpieczeństwa (threshold bands) — kontrakt

### 2.1 Dlaczego progi są SSOT

Bez progów KPI jest tylko wykresem. Progi definiują **moment interwencji** i zapobiegają:

- “alert fatigue” (zbyt czułe alarmy),
- “false assurance” (zbyt luźne progi),
- arbitralnym interpretacjom (“dla mnie to jeszcze OK”).

### 2.2 Minimalny model progów (v3)

Każdy KPI ma:

- `direction`: `HIGHER_IS_BETTER | LOWER_IS_BETTER`
- `target_mode`:
  - `SINGLE_TARGET` (jeden target na okres/rok),
  - `TARGET_BY_PERIOD` (target per miesiąc/kwartał — jak w karcie BSC).
- `threshold_mode`:
  - `ABSOLUTE` (progi w jednostce KPI),
  - `PERCENT_FROM_TARGET` (progi jako % odchylenia od targetu).
- `bands` (minimum 3):
  - **GREEN**: “nic się nie dzieje” (monitoruj),
  - **AMBER**: “odchylenie” (wymaga wyjaśnienia + plan),
  - **RED**: “alarm” (wymaga natychmiastowego wyjaśnienia + eskalacji + plan).

### 2.3 Reguły interpretacji (deterministyczne)

Niech:

- \(v\) = wartość KPI w okresie,
- \(t\) = target dla okresu (z `SINGLE_TARGET` albo `TARGET_BY_PERIOD`),
- \(d\) = direction.

W trybie `PERCENT_FROM_TARGET`:

- obliczamy odchylenie względne: \(\Delta = \frac{v - t}{|t|}\)
- dla `LOWER_IS_BETTER` znak interpretujemy odwrotnie (bo “niżej” jest lepiej).

**MUST:** zasady muszą działać dla obu kierunków, bez ręcznej interpretacji w UI.

---

## 3) Workflow “Deviation Case” — automatyczna karta + wezwanie ownera

### 3.1 Trigger

System tworzy (lub re-otwiera) `Deviation Case`, gdy:

- pojawi się nowy wpis time-series dla KPI, oraz
- status KPI po ewaluacji to `AMBER` lub `RED`, oraz
- nie ma otwartego case’a dla tego KPI (lub dla tego okresu) w statusie aktywnym.

### 3.2 Minimalna zawartość Deviation Case (v3)

- `kpi_id`
- `organization_id`
- `period_key` / `period_start` + `period_end`
- `severity`: `AMBER | RED`
- `status`: `OPEN | ACKNOWLEDGED | IN_PROGRESS | MITIGATING | RESOLVED | CLOSED`
- `owner_user_id` (z KPI)
- `detected_at`, `detected_by` (system)
- `deviation_summary` (auto: “odchylenie X vs target Y”)
- `rca_text` (Root Cause Analysis — wymagane dla AMBER/RED)
- `action_plan`:
  - lista działań z ownerem, terminem, statusem (minimum)
  - możliwość tworzenia tasków w module `MyWork/Execution` (propose→accept)
- `evidence_links` / `attachments` (opcjonalnie v3, ale preferowane)

### 3.3 Powiadomienia

Gdy case powstaje:

- owner KPI dostaje notyfikację: “KPI w odchyleniu — wyjaśnij przyczynę i przygotuj plan”.
- jeśli `RED` i brak reakcji przez X dni (konfig) → eskalacja do PMO/owner inicjatywy.

---

## 4) UI/UX — “karta mierników” + “karta KPI” (Twoja inspiracja)

### 4.1 KPI Card (lista/tabela)

W `Rezultaty → KPI` tabela pokazuje kolumny (od lewej do prawej, kanon v3):

1) **Nazwa KPI**
2) **Wzór / sposób liczenia** (skrót + tooltip)
3) **Jednostka**
4) **Owner**
5) **Baseline**
6) **Target** (dla bieżącego okresu + “tryb targetu”)
7) **Progi bezpieczeństwa** (np. Green/Amber/Red — skrót)
8) **Aktualna wartość** (z ostatniego wpisu)
9) **Status** (Green/Amber/Red/No data)
10) **Okres** (za jaki jest ostatni wpis)
11) **Akcja**: “Open KPI” / “Record value”

### 4.2 KPI Detail (pojedynczy KPI)

Karta KPI zawiera:

- nagłówek: status + owner + ostatni okres,
- wykres/trend (min 12 okresów),
- edycja definicji (z uprawnieniami),
- sekcja “Deviation Cases”:
  - jeśli jest case OPEN/IN_PROGRESS → jest to element “wzywający do akcji”
  - CTA: “Acknowledge”, “Explain cause”, “Create action plan”, “Close case”

**MUST:** KPI detail ma być “actionable”, nie tylko historyczne.

---

## 5) Quality + audit (MUST)

- Każda zmiana progów/definicji KPI ma:
  - `changed_by`, `changed_at`, `reason`
  - wersjonowanie (min: `version` integer)
- Wpisy time-series są nieedytowalne “po cichu”:
  - korekty = nowy wpis typu `CORRECTION/REVERSAL` albo jawny audit trail.

---

## 6) Best-practice alignment (notes)

- RAG/RAG status bez “action rules” jest tylko kosmetyką → każda strefa ma wymaganą reakcję.
- KPI governance wymaga: owner + cadence + definicja + źródło danych (metric dictionary).
- Dla produkcji (szczególnie manufacturing) warto mapować definicje KPI do standardów typu ISO 22400 (terminologia i formuły), ale progi i workflow odchyleń to policy organizacji.

