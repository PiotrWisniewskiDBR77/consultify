# Reports & Presentations v3 — SSOT (Gamma‑like UX)

> Note (v1 doctrine update): the Document runtime referenced from this document is now productized as **Consultify Document Studio**. See `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`. R1–R4 reports remain the `report` family within Document Studio's Template Registry. The unified Reports & Presentations hub remains the primary R&P surface.
>
> **Status:** Canonical (v3)  
> **⚠️ PRESENTATION GENERATOR** — pełna specyfikacja flow, model danych, AI agent, templates, media library, eksport, learning:  
> → **[`PRESENTATION_GENERATOR_V3.md`](PRESENTATION_GENERATOR_V3.md)** ← P0, kanoniczny SSOT  
>  
> **⚠️ REPORT GENERATOR** — pełna specyfikacja raportów (R1–R4), wizard/builder, templates, AI narrative, quality gate, eksport:  
> → **[`REPORT_GENERATOR_V3.md`](REPORT_GENERATOR_V3.md)** ← P0, kanoniczny SSOT  
>  
> **Cel:** Ustandaryzować “Reports” i “Presentations” jako **biblioteki + generatory**, z UX inspirowanym narzędziami typu Gamma (szybko, elegancko, mało tarcia).  
> **Powiązane SSOT:**  
> - `docs/product/OPERATING_MODEL_V3.md` (Reports & Presentations jako gałąź flow)  
> - `docs/product/TOOLS_CATALOG_V3.md` (tool surfaces: ModuleHub + Wizard/Editor)  
> - `docs/ui-standards/03-modules/view-modes-standard.md` (list + cards)  
> - `docs/ui-standards/03-modules/module-hub-standard.md` (topbar)  
> - `docs/REPORT_BUILDER_EXPORTS_STANDARD.md` (export quality)  

---

## 1) Kanoniczny model produktu (v3)

W v3 “Reports” i “Presentations” mają tę samą logikę:

- **Library (Hub)**: lista + karty (karty = okładki)
- **Generator (Wizard/Builder)**: tworzenie nowej sztuki z template albo “od zera”
- **Final artifact**: gotowy raport/deck jako artefakt platformy

Wspólny cel UX: “kliknij, wybierz, wygeneruj, dopracuj” — bez rozbudowanej konfiguracji na start.

---

## 2) Surface types (v3)

### 2.1 Library (Module Hub)

MUST:

- view modes: `table` + `grid(cards)` (zgodnie z `view-modes-standard.md`)
- szybkie filtry: (np. `Templates` / `Final`, `Team` / `Mine`, `Type`)
- CTA: **Dodaj raport** / **Dodaj prezentację**

### 2.2 Generator (Wizard / Builder)

MUST:

- wejście w generator zawsze z kontekstem (skąd user przyszedł i co generuje)
- tryb “template first”: wybór templatek jako domyślna ścieżka
- tryb “blank”: minimum opcji, szybki start

---

## 3) Gamma‑like UX (kanon v3)

To są zasady “ease & elegance” dla generatorów (raport/deck):

- **Low friction start**: pierwsza decyzja = “z czego generujemy” (template / źródło danych), nie “ustawienia”.
- **Content first**: user widzi strukturę (outline/sections/slides) jak najszybciej.
- **AI propose → accept/reject**: AI nie nadpisuje pracy użytkownika; proponuje warianty i bloki.
- **1‑click scaffolding**: jeden przycisk generuje wstępny szkic (outline) i wypełnia placeholdery.
- **Traceability**: każdy blok może mieć “source” (Tool session / Initiative / Notebook / Financial Analysis run).

---

## 4) Źródła danych (inputs) i powiązania (links)

Generator może budować content z:

- Tools → sessions (analysis/report output)
- Initiatives / Execution / Benefits (statusy, KPI/ROI)
- Financial Analysis (model / analysis / scenarios / valuation)
- Notebook (notatki jako kontekst)

**Kanon:** po wygenerowaniu artefaktu, w metadanych musi być widoczne “z czego powstało”.

---

## 5) Artefakty (v3)

Nazwy robocze:

- `ReportTemplate`
- `Report`
- `PresentationTemplate`
- `Deck` (Presentation)

Każdy final artefakt ma:

- owner, updatedAt, status (draft/final/published jeśli wprowadzimy)
- export history (PDF/DOCX/PPTX)
- powiązania do inicjatyw / narzędzi / analiz

---

## 6) Template system (kanon v3) — wspólny wzorzec dla Report/Presentation

> Ten rozdział opisuje meta‑system template’ów, zgodny z tym jak budujemy także template’y tabel interaktywnych.
> Kanon: **generator → save as template → admin library**, z auto‑apply rules.

### 6.1 Dwa typy template’ów (scope)

- **Application templates** (globalne): tworzone i utrzymywane przez **SuperAdmin** (owner aplikacji).
- **Organization templates** (org scope): tworzone przez **Org Admin** (bez dostępu do SuperAdmin).

### 6.2 Brak rozbudowanego workflow (MVP)

- Nie budujemy ciężkiego approval flow.
- Wystarczają proste statusy: `active` / `archived` (opcjonalnie `draft` dla WIP).
- Założenie: template’y tworzą uprawnione role (SuperAdmin/Org Admin), więc “zatwierdzają je sami”.

### 6.3 Klonowanie (MUST)

- Organization może **sklonować** application template do org scope i modyfikować (powstaje nowy template).

### 6.4 Brak wersjonowania (MUST)

- Nie wersjonujemy template’ów (brak `v1/v2` na tym samym template).
- Zmiana template = **nowy template** (copy + edit), stary może zostać `archived`.

### 6.5 Auto‑apply rules (SHOULD)

Template może mieć proste reguły automatycznego doboru, zależne od kontekstu:

- moduł/narzędzie (np. Financial Analysis)
- artefakt źródłowy (Initiative / ToolSession / Analysis run)
- branża / typ organizacji (jeśli dostępne w kontekście)
- rola (opcjonalnie)

### 6.6 Sample content (SHOULD)

- Template może zawierać prosty sample content (placeholdery/sekcje), który jest łatwo usuwalny.
- Przy użyciu template’u user może wybrać: “Keep / Remove sample content”.

---

## 6) Export (quality gate)

Zasady eksportu (baseline) są w:

- `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`

W v3 UX generatora ma prowadzić usera do outputu, który:

- wygląda “zarządowo” (czytelność, spójna typografia)
- ma okładkę i metadane
- ma spójne “sections”

