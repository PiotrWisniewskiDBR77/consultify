# DOKTRYNA: Tabela ≠ Excel ≠ Platforma-tabel (SSOT, #86a)

> Powód: przez miesiące myliły się TRZY różne byty „tabelaryczne". Ta doktryna je rozdziela raz na
> zawsze — który komponent, kiedy, jaki standard wyglądu. SSOT nadrzędny nad intuicją „to tabela".
> Data: 2026-07-13. Powiązane: [[project_triada_kanon]], `TRIADA_KANON.md`, `ARTIFACT_ANATOMY_STANDARD.md`.

## TL;DR — trzy byty, trzy standardy

| Byt | Czym JEST | Do czego | Standard wyglądu | Komponent |
|-----|-----------|----------|------------------|-----------|
| **1. LISTA (Tabela)** | wiersze = REKORDY encji o STAŁYM schemacie (Task, Decision, Initiative, Report, Assessment…) | przeglądać / filtrować / sortować / otwierać rekord | **TRIADA / SPEC-L** — `StandardTable` + `StandardModuleBar` + `StandardPreview` | `src/components/standard/StandardTable.tsx` |
| **2. EXCEL (Arkusz)** | KOMÓRKI + FORMUŁY, wolny schemat, obliczenia (Cost-Benefit, KPI Dashboard, budżet) | modelować / liczyć / raport finansowy | **artefakt Deck/Dokument-owa powłoka + renderer .xlsx** | silnik workbook (Excel/Sheet), `output_type='sheet'` |
| **3. PLATFORMA-TABEL (Matryca)** | dynamiczny schemat a'la Airtable — bazy, tabele, kolumny definiowane przez usera, kolaboracja real-time | budować własną strukturę danych w narzędziu Ideas | **artefakt SPEC-A archetyp D „Matryca"** | `IdeaTableTool` / `TablePlatformApi`, `GridView` |

## 1. LISTA (Tabela) — kiedy to jest „tabela" w sensie TRIADY
- **Rozpoznanie:** wiersze reprezentują rekordy jednej encji o **znanym z góry** zestawie kolumn; klik wiersza otwiera preview/artefakt rekordu.
- **Przykłady:** My Work (Tasks/Decisions/Ideas listy), Assessment listy, Interview 6 tabel, Materiały, Finance listy, Initiatives, Execution, Results KPI/OKR.
- **Standard = KODEM, nie opisem:** WYŁĄCZNIE `StandardTable` (+ `StandardModuleBar` Menu 1/2/3 + `StandardPreview`). Zakaz własnego `<table>`. Bezpiecznik: `scripts/check-list-canon.sh` (blokuje bespoke).
- **Kanon:** `docs/ui-standards/TRIADA_KANON.md` + `03-modules/TABLE_AND_PREVIEW_CANON.md`.

## 2. EXCEL (Arkusz) — kiedy to NIE jest lista
- **Rozpoznanie:** użytkownik wpisuje wartości do KOMÓREK, są FORMUŁY/sumowania, schemat nie jest listą rekordów encji — to model/kalkulacja.
- **Przykłady:** Cost-Benefit Model (NPV/IRR), KPI Dashboard, Budżet vs Actual, Initiative Tracker jako model.
- **Standard:** artefakt (powłoka Dokument/Deck), rdzeń = renderer `.xlsx` (silnik workbook). NIE StandardTable — StandardTable renderuje rekordy, nie komórki-z-formułami.
- **Pułapka:** „to wygląda jak tabela więc dam StandardTable" — NIE. Jeśli są formuły/komórki → to Excel, inny silnik.

## 3. PLATFORMA-TABEL (Matryca) — trzeci, najczęściej mylony
- **Rozpoznanie:** user SAM definiuje bazy/tabele/kolumny (dynamiczny schemat), jest kolaboracja real-time — to nie lista encji ani arkusz-kalkulacja, to **narzędzie do budowy struktur danych** (a'la Airtable/Notion DB).
- **Przykład:** `IdeaTableTool` (3811 linii — pełna platforma), `GridView` (table-platform standalone).
- **Standard:** artefakt **SPEC-A, archetyp D „Matryca"** (`ARTIFACT_ANATOMY_STANDARD.md` §13). NIE migrować na StandardTable — to zły archetyp (StandardTable = stały schemat, Matryca = dynamiczny).
- **Decyzja 07-13:** GridView/IdeaTableTool ZOSTAJĄ jako platforma-tabel; §27-migracja ich NIE dotyczy.

## Reguła rozstrzygająca (gdy nie wiesz który)
1. Wiersze = rekordy encji o STAŁYCH kolumnach, klik→otwiera rekord? → **LISTA** (StandardTable).
2. Są KOMÓRKI + FORMUŁY, liczysz/modelujesz? → **EXCEL** (renderer .xlsx).
3. User SAM definiuje kolumny/tabele, dynamiczny schemat? → **PLATFORMA-TABEL** (Matryca SPEC-A).

Nigdy nie stosuj StandardTable do #2 i #3. Nigdy nie rób bespoke `<table>` do #1.
