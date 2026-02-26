# Link Graph v3 (Embedded References + Backlinks) — SSOT

> **Status:** Draft (v3)  
> **Cel:** Zdefiniować kanoniczny kontrakt dla:  
> - embedded references w edytorach (Notebook/Reports/…),
> - platform‑wide backlinks (“Used in”),
> - live metadata vs live content.
>
> **Powiązane SSOT:**  
> - Notebook v3: `docs/product/NOTEBOOK_V3.md`  
> - System axis (artefacts list): `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`  
> - Artifact identity: `docs/ui-standards/00-foundation/artifact-identity-map.md`  
> - Attachments/Links canvas (as‑is pattern): `src/components/shared/NModeSections/AttachmentsLinksCanvas.tsx`  

---

## 1) Definicje (v3)

### 1.1 Embedded reference

**Embedded reference** to osadzony w treści dokumentu odnośnik do artefaktu platformy (np. initiative/task/decision), który ma:

- stabilne ID (`type + id`)
- render jako chip lub card preview
- klik “Open”
- live metadata (zawsze)
- opcjonalne live content (fragment treści)

### 1.2 Backlinks (“Used in”)

**Backlinks** to odwrócona perspektywa: lista artefaktów, które referują dany obiekt.

Kanon v3: backlinks są **platform‑wide** (nie tylko między notatkami).

### 1.3 Live metadata vs live content

- **Live metadata (MUST):** status, owner, due date, % progress, updatedAt itp. odświeżane z API.
- **Live content (opt‑in):** dynamiczny fragment treści z artefaktu źródłowego, tylko jeśli user włączy.

---

## 2) Kontrakt danych (v3) — Link Graph

### 2.1 Minimalny model relacji (MVP v3)

W v3 utrzymujemy **jeden typ relacji**: `ref` (neutralne “odniesienie”).

Rekord relacji:

- `source`: `{ type: string; id: string }`
- `target`: `{ type: string; id: string }`
- `relation`: `'ref'`
- `context`:
  - `containerType` (np. `notebook_page`, `report_section`…)
  - `containerId` (np. notebookPageId)
  - `blockId` (opcjonalnie; jeśli mamy stabilne identyfikatory bloków)
  - `createdAt`, `createdBy`

### 2.2 Zasady

- link graph jest **jedynym źródłem prawdy** dla backlinks (nie parsujemy “po tekście”).
- relacje nie zależą od tytułów; są stabilne na `type+id`.
- jeśli user nie ma dostępu do targetu → UI pokazuje “Restricted/Unavailable”, ale relacja może istnieć (w zależności od polityki uprawnień).

---

## 3) Embedded reference w edytorach — kontrakt UI (v3)

### 3.1 Dwa tryby prezentacji

- **Inline chip** (domyślnie)
- **Card preview** (po “Expand to preview”)

### 3.2 Minimalny mini‑preview (kanon v3)

- Initiative: Status, %, Owner
- Task: Status, Due date
- Decision: Status, Priority
- Report/Presentation/Assessment: Status, Last update

### 3.3 Live content (MVP selector v3)

Jeśli user włączy “Live content”, to w v3 wybór fragmentu jest ograniczony do:

- nagłówków (H1/H2/H3)

---

## 4) “Used in” (backlinks) — kontrakt UI (v3)

### 4.1 Zakres

Backlinks obejmują co najmniej:

- notatki
- initiatives / tasks / decisions
- reports / presentations
- workspaces (jeśli workspace ma stabilny artefakt ID)

### 4.2 Lokalizacje UI

- primary: panel boczny (np. w Notebooku)
- optional: dynamiczny block w treści (insert‑only; domyślnie OFF)

---

## 5) Implementacyjne zasady bezpieczeństwa (v3)

### 5.1 Cache i odświeżanie

- live metadata musi być cache’owane (krótki TTL) i odświeżane bez “migotania”
- fetch powinien być “batched” gdy na ekranie jest wiele reference chipów

### 5.2 Uprawnienia

- UI nie może ujawniać treści/tytułu artefaktu, jeśli user nie ma uprawnień
- w takim przypadku renderuje “Restricted” (bez szczegółów) + opcjonalnie “Request access”

### 5.3 Prywatne obiekty (My Work) i backlinks

W v3 dopuszczamy obiekty “osobiste” (np. personal workspace w MyWork/Ideas, prywatne notatki).

Zasady:

- jeśli obiekt jest **prywatny** i nie został powiązany z artefaktami projektowymi — nie pojawia się w “Used in” poza przestrzenią użytkownika
- jeśli prywatny obiekt zostaje podlinkowany do artefaktu zespołowego/projektowego:
  - sama relacja może istnieć, ale widoczność w backlinks musi respektować uprawnienia (zasada 5.2)
  - UI nie ujawnia tytułu/treści bez dostępu

---

## 6) Out of scope (v3)

- pełna semantyka relacji (informs/depends_on/blocks/…): v4+
- graficzna mapa powiązań: v4+

