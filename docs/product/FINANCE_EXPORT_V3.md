# Finance v3 — “Exportuj” do Reports/Presentations/Initiatives + traceability (V3‑I01) (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** opisać standard “Exportuj” w kontekstowych narzędziach finansowych:  
> - eksport do **Report** i **Presentation** (template/no‑template)  
> - oraz (ważne) eksport do **Initiatives** (AI propose→accept)  
> z pełną traceability (“Open source”) i metadanymi.

## 0) Powiązane SSOT (MUST)

- Reports/Presentations mental model: `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- Report generator: `docs/product/REPORT_GENERATOR_V3.md`
- Results/ROI (źródła finansowe i rozliczenia): `docs/product/RESULTS_V3.md`, `docs/product/ROI_TRACKING_CONTRACT_V3.md`
- Financial Analysis module (źródło eksportu): `docs/product/FINANCIAL_ANALYSIS_V3.md`
- Source traceability: `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- UI canon:
  - Module Hub standard: `docs/ui-standards/03-modules/module-hub-standard.md`
  - App Table Standard (jeśli export jest z listy/tabeli): `docs/ui-standards/03-modules/app-table-standard.md`

---

## 1) Kiedy i gdzie jest “Exportuj”

“Exportuj” pojawia się w wielu miejscach, ale zachowanie jest identyczne:

- w Financial Analysis (analizy/statementy/wyceny/inwestycyjne),
- w ROI card / Economic Analysis (jeśli jest w finansach),
- w przyszłości w innych narzędziach kontekstowych.

**MUST:** klik w “Exportuj” zawsze otwiera wizard (dynamic tab), nigdy “magicznie” nie tworzy deliverable bez pytań.

---

## 2) 3 kierunki exportu (kanon)

Export ma 3 typy outputów:

1) **Report** (deliverable dokument)  
2) **Presentation** (deck)  
3) **Initiatives** (draft inicjatyw z analizy finansowej)

> W export do Initiatives nie generujemy “na twardo” projektów bez zgody — AI tylko proponuje.

---

## 3) Wizard exportu (template / no‑template)

### 3.1 Krok 1 — wybór outputu

- Report / Presentation / Initiatives

### 3.2 Krok 2 — Template vs No‑template

Jeśli Report/Presentation:

- **Template**: user wybiera template (systemowy lub org)  
- **No‑template**: user odpowiada na pytania kontekstowe (poniżej)

### 3.3 Krok 3 — pytania kontekstowe (no‑template)

Wizard pyta minimalnie:

- **cel** (po co ten report/deck)
- **odbiorca** (kto będzie czytał/oglądał)
- **język** (PL/EN)
- **format** (np. “executive 5 slajdów” vs “długi raport”)
- **zakres** (co ma wejść: które analizy/okresy)

**MUST:** te odpowiedzi stają się metadanymi i “briefem” dla generatora.

---

## 4) Traceability (Open source) — bez dyskusji

Każdy wygenerowany output ma:

- `source_type`
- `source_id`
- `created_by`, `created_at`
- “Open source” prowadzące do **konkretnego źródła**.

**Zasada:** “Open source” ma wracać do **snapshotu / zapisanego runu**, nie do “live view”, żeby:

- dało się odtworzyć, skąd wzięły się liczby,
- uniknąć sytuacji “zmienił się model → zmieniły się liczby → report nie ma sensu”.

R1 minimum:

- jeśli źródło jest “live”, wizard proponuje: **Save snapshot** przed exportem.

---

## 5) Export do Initiatives (ważny tor)

Z finansów często wynikają działania.

Wizard “Initiatives”:

- AI generuje listę propozycji inicjatyw (propose→accept):
  - tytuł, problem, spodziewany efekt,
  - (opcjonalnie) KPI/ROI propozycje,
  - link do źródła finansowego (traceability).
- user akceptuje/odrzuca per inicjatywa
- po akceptacji inicjatywy trafiają do **Initiatives module** jako `DRAFT` (nie do Tools), żeby user ich nie “szukał”.

---

## 6) Permissions + locking

Minimalna polityka:

- export dostępny dla roli, która ma dostęp do źródła (Financial Analysis) i prawo tworzyć outputy,
- jeśli źródło jest locked/final — export jest dozwolony (czytanie),
- jeśli źródło nie jest zapisane/snapshot — wizard wymusza “Save snapshot” (albo jasno ostrzega, że liczby mogą się zmienić).

---

## 7) DoD — V3‑I01 (R1/P1)

- “Exportuj” działa z Financial Analysis do Report i Presentation (template/no‑template).
- Output ma metadane (kto/kiedy/tytuł) i sekcję Source + “Open source”.
- Export do Initiatives tworzy draft inicjatyw w Initiatives module (AI propose→accept) z traceability.

