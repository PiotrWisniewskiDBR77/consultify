## Workstation Canvas — analiza paczki Camunda (wnioski pod Process flow / enterprise BPMN)

> **Data:** 2026-03-16  
> **Źródło:** `knowledge/Miro/added/camunda..zip` (zrzut `docs.camunda.org`, głównie Camunda 7 manual 7.24)  
> **Cel:** zidentyfikować „enterprise-grade” elementy edytora BPMN (properties, templates, compliance) i dopisać delta do `process_flow`

---

## 1) Co realnie jest w paczce
- Snapshot `docs.camunda.org` zawiera m.in. `manual/7.24/modeler/*`.
- Część treści „Modeler BPMN” i „Forms” ma adnotację, że **została przeniesiona do `docs.camunda.io`** (Camunda 8 docs) jako źródło „na przyszłość”.

**Wniosek**: do pełnego obrazu „Camunda‑style enterprise BPMN” warto pobrać również `docs.camunda.io` (już masz na liście inspiracji).

---

## 2) Najbardziej wartościowe wzorce produktowe (dla Consultify `process_flow`)

### 2.1 Element Templates (domain‑specific steps) jako feature „enterprise default”
Camunda traktuje **element templates** jako oficjalny mechanizm rozszerzania modelera o „klocki domenowe” (np. service tasks / user tasks).

Kluczowe cechy:
- Template można przypisać do elementu **z poziomu properties panel**.
- Zastosowanie template:
  - ustawia predefiniowane wartości pól BPMN,
  - mapuje **input/output mappings**,
  - ustawia **extension properties**.

Format i governance:
- Templates to JSON array w pliku descriptor.
- Templates mają **JSON schema** (`$schema`) i kompatybilność wersji:
  - tooling **ignoruje template z wyższą wersją schema** i loguje warning,
  - brak `$schema` → przyjmowana najnowsza wersja (Camunda 7 path).
- `id + version` mogą definiować unikalność (ten sam `id` z różnym `version`).
- Jest model UI‑kontrolek dla properties panel:
  - `type`: `String | Text | Boolean | Dropdown | Hidden`,
  - `binding`: mapowanie do BPMN XML / extension elements,
  - `constraints` (walidacje edycji).
- „Bezpieczeństwo” konfiguracji: jeśli template nie spełnia zasad, tooling loguje validation error i **ignoruje** template.
- `entriesVisible`: domyślnie template definiuje widoczne pola properties panel, reszta jest ukryta; `entriesVisible=true` przywraca domyślne pola.

**Implikacja dla Consultify**:
- W `process_flow` warto dodać jako P0/P1:
  - **Step Templates**: JSON templates przypisywane do node w properties strip,
  - **schema versioning** i mechanizm „reject/ignore invalid templates”,
  - mapping template → metadata node (i/lub przyszły BPMN export).

---

### 2.2 Compliance / retention: History Time To Live (HTTL) jako wymóg
Camunda wymusza politykę retencji dla danych historycznych:
- History cleanup usuwa dane po czasie określonym przez **history time to live**.
- Od Camunda 7.20: HTTL musi być skonfigurowany (per model / default / albo wyłączenie check).
- TTL jest atrybutem rozszerzenia na definicji procesu: `camunda:historyTimeToLive="5"` lub `P5D`.
- W UI: ustawiane w **properties panel** pod „History cleanup”.
- W „References” jest wskazany rule source (bpmnlint plugin) — czyli to jest realnie lint‑rule klasy enterprise.

**Implikacja dla Consultify**:
- Nasz **rules engine** dla `process_flow` powinien mieć „enterprise pack” reguł, m.in.:
  - **Retention/TTL required** dla diagramów oznaczonych jako „deployment/execution ready”.
- W properties strip: pole „Retention / TTL” na poziomie diagramu/procesu (nie tylko node).

---

## 3) Delta do naszego FINAL MASTER PLAN (co dopisać)
- `process_flow`:
  - dodać **Element/Step Templates** jako oficjalny feature properties strip (P0/P1).
  - dodać „enterprise lint rules” (np. TTL) jako rozszerzenie rules engine (P1).
- „Inspiracje do pobrania”:
  - poza `docs.camunda.org` potrzebne `docs.camunda.io` (bo część modeler treści jest przeniesiona).

