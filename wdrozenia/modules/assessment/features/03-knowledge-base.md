# Assessment – Knowledge Base System

## Status: ✅ ZAIMPLEMENTOWANY

**Ostatnia aktualizacja:** 2026-01-29

---

## 🎯 Cel

System bazy wiedzy dla assessmentów, dostarczający pytań walidacyjnych, przykładów i sugerowanych technologii dla każdego poziomu w każdym obszarze.

---

## 📋 Przegląd Funkcjonalności

### Baza Wiedzy per Poziom

Dla każdego poziomu w każdym obszarze DRD, system dostarcza:

1. **3 Pytania Walidacyjne** - pytania yes/no pozwalające ocenić czy poziom jest osiągnięty
2. **Przykład (Example)** - konkretny przykład implementacji poziomu
3. **Sugerowane Technologie** - lista technologii związanych z poziomem

### Frameworki Obsługiwane

- ✅ **DRD** - pełna implementacja (34 obszary × 5-7 poziomów)
- ⏳ **SIRI** - w planach
- ⏳ **ADMA** - w planach
- ⏳ **CMMI** - w planach
- ⏳ **Lean 4.0** - w planach

---

## 🔧 Implementacja

### Struktura Danych

```typescript
type DRDLevelKnowledge = {
  questions: [string, string, string];  // 3 pytania yes/no
  example: string;                       // przykład implementacji
  suggestedTechnologies: string[];      // lista technologii
};
```

### API Funkcji

```typescript
getDRDKnowledge(areaId: string, levelNumber: number): DRDLevelKnowledge
```

**Lokalizacja:** `src/services/assessmentKnowledge/drdKnowledge.ts`

---

## 📝 Generowanie Domyślnych Wartości

### Domyślne Pytania

System automatycznie generuje pytania dla wszystkich poziomów na podstawie:

- Nazwy obszaru (`area.name`)
- Numeru poziomu (`level.level`)
- Tytułu poziomu (`level.title`)

**Format:**
1. `In "{areaName}", is level {level} ("{title}") implemented as described?`
2. `Can we show evidence for level {level} (e.g. system, report, procedure, record in the system)?`
3. `Does it work in practice and is it used regularly (not just a pilot or a one-off case)?`

**Przykład dla 1A, poziom 3:**
1. "In 'Sales Processes', is level 3 ('Process Control') implemented as described?"
2. "Can we show evidence for level 3 (e.g. system, report, procedure, record in the system)?"
3. "Does it work in practice and is it used regularly (not just a pilot or a one-off case)?"

### Domyślne Przykłady

System generuje uniwersalne przykłady:

**Format:**
`Example: in "{areaName}", we provide a concrete artifact confirming level {level} (e.g. screenshot, report, system log, procedure, instruction, KPI).`

**Przykład dla 1A, poziom 3:**
"Example: in 'Sales Processes', we provide a concrete artifact confirming level 3 (e.g. screenshot, report, system log, procedure, instruction, KPI)."

### Sugerowane Technologie

System sugeruje technologie na podstawie słów kluczowych w opisie poziomu:

#### Reguły Keyword Matching

| Keyword Pattern | Technologie |
|----------------|-------------|
| `ERP` | ERP, Master Data Management (MDM), API Integration |
| `MES` | MES, OEE Dashboard, SCADA |
| `WMS` | WMS, Barcode/RFID, Warehouse Analytics |
| `CMMS` | CMMS, Predictive Maintenance, Asset Registry |
| `BI\|Dashboard\|Reporting` | BI Dashboard, Data Warehouse, ETL/ELT |
| `AI\|Machine Learning\|NLP\|Chatbot` | GenAI Assistant, ML Models, MLOps |
| `Automation\|RPA` | Workflow Automation, RPA, Integration Platform (iPaaS) |
| `CRM` | CRM, Marketing Automation, Customer Data Platform |

#### Fallback

Jeśli żadna reguła nie pasuje, system zwraca domyślne technologie:
- Process Documentation
- KPI Dashboard
- Standard Operating Procedures (SOP)

---

## 🎯 System Override

### Nadpisywanie Konkretnych Poziomów

Można nadpisać wartości dla konkretnych poziomów używając `DRD_KNOWLEDGE_OVERRIDES`:

```typescript
const DRD_KNOWLEDGE_OVERRIDES: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '1A#3': {
    questions: [
      'Czy system sprzedaży ma automatyczną kontrolę budżetu?',
      'Czy istnieją raporty KPI sprzedaży w czasie rzeczywistym?',
      'Czy plan sprzedaży jest powiązany z realizacją?'
    ],
    example: 'Przykład: system ERP z modułem sprzedaży pokazujący budżet vs realizację.',
    suggestedTechnologies: ['ERP', 'Sales Analytics', 'KPI Dashboard']
  },
  // ... więcej override'ów
};
```

**Format klucza:** `${areaId}#${levelNumber}` (np. `"1A#3"`)

---

## 📊 Przykłady Użycia

### Podstawowe Użycie

```typescript
import { getDRDKnowledge } from '@/services/assessmentKnowledge/drdKnowledge';

const knowledge = getDRDKnowledge('1A', 3);

console.log(knowledge.questions);
// [
//   "In 'Sales Processes', is level 3 ('Process Control') implemented as described?",
//   "Can we show evidence for level 3 (e.g. system, report, procedure, record in the system)?",
//   "Does it work in practice and is it used regularly (not just a pilot or a one-off case)?"
// ]

console.log(knowledge.example);
// "Example: in 'Sales Processes', we provide a concrete artifact confirming level 3..."

console.log(knowledge.suggestedTechnologies);
// ["ERP", "Master Data Management (MDM)", "API Integration"]
```

### W Komponencie React

```typescript
import { getDRDKnowledge } from '@/services/assessmentKnowledge/drdKnowledge';

const DRDLevelCard = ({ areaId, levelNumber }) => {
  const knowledge = getDRDKnowledge(areaId, levelNumber);

  return (
    <div>
      <h3>Level {levelNumber}</h3>
      
      <div>
        <h4>Validation Questions:</h4>
        <ul>
          {knowledge.questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </div>

      <div>
        <h4>Example:</h4>
        <p>{knowledge.example}</p>
      </div>

      <div>
        <h4>Suggested Technologies:</h4>
        <div>
          {knowledge.suggestedTechnologies.map((tech, i) => (
            <span key={i}>{tech}</span>
          ))}
        </div>
      </div>
    </div>
  );
};
```

---

## 🔄 Integracja z Edytorem DRD

Baza wiedzy jest automatycznie używana w `DRDAssessmentEditor`:

1. **Renderowanie poziomu:**
   - Pobranie wiedzy dla poziomu: `getDRDKnowledge(areaId, levelNumber)`
   - Wyświetlenie pytań w sekcji "3 yes/no validation questions"
   - Wyświetlenie przykładu w sekcji "Example"
   - Wyświetlenie technologii jako chips/badges

2. **Aktualizacja:**
   - Wiedza jest pobierana przy każdej zmianie obszaru/poziomu
   - Nie jest cachowana (zawsze świeże dane)

---

## 🚀 Przyszłe Ulepszenia

### 1. AI-Powered Suggestions

- **Kontekst klienta:** Technologie sugerowane na podstawie:
  - Branży klienta
  - Obecnych systemów (z modułu Expectations & Challenges)
  - Rozmiaru firmy
  - Budżetu

- **Inteligentne pytania:** Pytania dostosowane do:
  - Kontekstu branżowego
  - Poziomu szczegółowości potrzebnego dla klienta
  - Języka klienta (jeśli różny od angielskiego)

### 2. Rozszerzenie na Inne Frameworki

- Implementacja bazy wiedzy dla:
  - SIRI (Smart Industry Readiness Index)
  - ADMA (Advanced Digital Maturity Assessment)
  - CMMI (Capability Maturity Model Integration)
  - Lean 4.0

### 3. Wersjonowanie Wiedzy

- Historia zmian w bazie wiedzy
- Możliwość powrotu do poprzednich wersji
- Tracking zmian w override'ach

### 4. External Knowledge Sources

- Integracja z zewnętrznymi źródłami wiedzy:
  - Dokumentacja technologii
  - Case studies
  - Best practices z branży

### 5. Multi-language Support

- Tłumaczenia pytań i przykładów
- Lokalizacja technologii (nazwy w różnych językach)

---

## 📚 Powiązane Dokumenty

- `00-OVERVIEW.md` - przegląd modułu Assessment
- `07-drd-editor.md` - dokumentacja edytora DRD
- `11-DRD-METHOD.md` - szczegółowy opis metodyki DRD
- `wdrozenia/knowledge/` - źródłowe materiały DRD (PDF)
