# Interactive Board Standard (Tables + Boards) — v3

> **Status:** Draft (v3)  
> **Cel:** Kanoniczny standard dla **interaktywnych tablic** (boards) i tabel w aplikacji, gdzie user:
> - definiuje kolumny/sekcje,
> - linkuje kolumny do danych,
> - utrzymuje KPI / wskaźniki / indeksy (w tym finansowe),
> - korzysta z tych samych view modes (table/cards/kanban/timeline/calendar) w zależności od kontekstu.
>
> **Powiązane SSOT:**  
> - `app-table-standard.md` (kanon tabel aplikacji)  
> - `view-modes-standard.md` (globalne tryby zestawień)  
> - `table-preview-pane-standard.md` (Outlook-style preview)  

---

## 1) Definicja

**Interactive Board** to surface, w którym użytkownik może:

- utrzymywać zestaw danych w tabeli (primary)
- przełączyć prezentację na board (kanban / sekcje) bez zmiany danych
- mieć możliwość konfiguracji kolumn i tego, “co jest w kolumnie” oraz jak jest powiązane z innymi polami

To jest fundament do prezentowania:

- KPI / OKR
- indeksów finansowych
- modeli i analiz (Financial Analysis)

---

## 2) Minimalny kontrakt (MUST)

### 2.1 Warstwa danych

- jeden “dataset” może być pokazany w wielu view modes (table/cards/kanban/...)
- statusy/semantyka są spójne między trybami

### 2.2 Warstwa UI

- tabelaryczna prezentacja jest **pierwsza i kompletna**
- board jest wartością (nie bajerem): drag & drop, szybkie akcje, sygnały
- wszystkie kontrolki w topbarze mają kanon `h-9`

**MUST:** jeśli board ma drag&drop, to stosujemy globalny kontrakt uprawnień i feedbacku z:

- `docs/ui-standards/03-modules/view-modes-standard.md` → sekcja **5.3 Drag & drop + uprawnienia**

### 2.3 Preview pane (opcjonalny, ale preferowany)

Jeśli user przegląda wiele elementów:

- stosujemy `Table + Preview Pane` (Outlook style)

SSOT: `table-preview-pane-standard.md`

---

## 3) Kiedy używać

- gdy definicja kolumn/sekcji jest częścią pracy (np. KPI board)
- gdy potrzebujesz zestawień porównawczych (okresy, scenariusze)
- gdy dane mają charakter “operacyjny” i user musi nimi zarządzać

---

## 4) Zakres v3

W v3 standard dotyczy przede wszystkim:

- Financial Analysis (model, analysis runs, scenarios)
- Benefits/Realization (KPI/ROI)
- dowolnych modułów, gdzie budujemy “tablice” z polami definiowanymi przez użytkownika

---

## 5) Table generator + templates (KANON v3)

Interactive tables są budowane jako building block w narzędziach (Finance/Tools/Workspaces), ale muszą mieć wspólną mechanikę:

### 5.1 Tabela ma własne ID (MUST)

- Każda tabela ma swój ID, aby można ją było linkować (Notebook/Reports/Presentations) i pokazywać w “Used in”.

### 5.2 Dwa “źródła życia” (MUST)

1) **Tool‑linked table** — tabela jest fragmentem nadrzędnego narzędzia/workflow i dziedziczy lifecycle:
   - usunięcie narzędzia usuwa tabelę (tied to tool).
2) **Personal/Idea table** — tabela utworzona w MyWork/Ideas jest artefaktem użytkownika:
   - zostaje w registry i może być później podlinkowana lub usunięta.

### 5.3 Excel-like mechanics (MUST)

- Formuły w stylu Excela (funkcje, odwołania A1, Sheet!A1, zakresy).
- Tabela wspiera:
  - komórki manual,
  - komórki linked (live binding do źródeł),
  - komórki formula (computed).
- Linked cells mogą być używane w formułach (Excel “connected with data”).

### 5.4 Live view → snapshot (MUST)

- Tabela jest domyślnie “żywa” (live).
- Save tworzy snapshot, który zapisuje:
  - manual values,
  - formuły,
  - binding config,
  - oraz **frozen values** linked cells (audytowalny stan do raportowania).

### 5.5 Generator + template library (MUST)

- Tabele powstają przez generator (wizard) i mogą zostać zapisane jako template.
- Template library ma dwa scope’y:
  - application templates (SuperAdmin),
  - organization templates (Org Admin).
- Wspieramy clone template, brak wersjonowania (zmiana = nowy template), auto‑apply rules i sample content.

