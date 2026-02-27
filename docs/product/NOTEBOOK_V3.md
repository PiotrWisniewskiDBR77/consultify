# Notebook v3 (Consultinity) — SSOT

> **Status:** Draft (v3)  
> **Cel:** Kanoniczna specyfikacja Notebooka w v3: rola, linkowanie, backlinks, create-from-note, AI blocks, research/voice oraz zakres “tool” w prawym panelu.  
> **Powiązane SSOT:**  
> - Operating model v3: `docs/product/OPERATING_MODEL_V3.md`  
> - Tools catalog v3: `docs/product/TOOLS_CATALOG_V3.md`  
> - Requirements v3: `docs/product/REQUIREMENTS_V3_SSOT.md`  
> - UI/UX Canon v3: `docs/ui-standards/UI_UX_CANON_V3.md`  
> - Workspace 3‑tools strip: `docs/ui-standards/02-components/workspace-3-tools-strip.md`  
> - Link graph + embedded refs: `docs/product/LINK_GRAPH_V3.md` *(v3)*  
>
> **SSOT (as‑is w kodzie):**  
> - Notebook surface: `src/components/MyWork/NotebookContent.tsx`  
> - Context/links panel: `src/components/MyWork/notebook/NotebookContextPanel.tsx`  
> - Topics to analyze: `src/components/MyWork/notebook/AITopicsPanel.tsx`  
> - Tools/AI panel (voice, convert, command): `src/components/MyWork/notebook/AIChatInlinePanel.tsx`  
> - Slash commands: `src/components/MyWork/notebook/SlashMenu.tsx`  

---

## 1) Rola Notebooka (v3)

Notebook to:

- miejsce zbierania myśli
- roboczy bank wiedzy
- źródło kontekstu dla innych narzędzi
- punkt startowy do tworzenia:
  - Initiative
  - Task
  - Decision
  - Report
  - Presentation
  - Assessment
  - komunikacji / czatu w kontekście

Notebook NIE jest:

- systemem wersjonowanym
- systemem zatwierdzania (approval workflow)
- osobnym narzędziem zarządczym

---

## 2) Linkowanie (krytyczne) — embedded references

### 2.1 Wstawianie linków do innych narzędzi

W treści notatki użytkownik może wstawić odnośnik do:

- Initiative
- Task
- Decision
- Report
- Presentation
- Assessment
- Workspace
- innej notatki

**Kanon v3:**

- domyślnie wstawka jest **inline chip** w tekście
- chip ma akcję: **Expand to preview** → rozwijany **card** (mini‑preview)

### 2.2 Minimalny mini‑preview (bez przeładowania)

**Initiative:** Status, %, Owner  
**Task:** Status, Due date  
**Decision:** Status, Priority  
**Report / Presentation / Assessment:** Status, Last update

### 2.3 Live block (definicja v3)

- **Zawsze live metadata** (status/%/owner/due/updated…)
- **Live content** (fragment treści) tylko jeśli user włączy opcję “Live content”

**MVP selector v3 (Live content):**

- tylko nagłówki (H1/H2/H3) jako źródło dynamicznego fragmentu

**SSOT kontrakt:** `docs/product/LINK_GRAPH_V3.md`

---

## 3) Backlinks — “Used in” (obowiązkowe)

### 3.1 Zakres (platform‑wide)

“Used in” obejmuje linki do notatki z całej platformy:

- inne notatki
- Initiatives, Decisions, Ideas, Insights
- Reports / Presentations
- Workspaces

### 3.2 Gdzie pokazujemy “Used in”

- **Primary location:** prawy panel w Notebooku
- **Opcjonalnie:** dynamiczny block w treści (tylko jeśli user wstawi; domyślnie OFF)

**SSOT kontrakt:** `docs/product/LINK_GRAPH_V3.md`

---

## 4) Create from note (v3)

Notebook nie “strukturyzuje świata” — przekazuje kontekst, a docelowe narzędzie strukturyzuje treść według własnego modelu.

### 4.1 Jedna akcja: “Create from note”

Opcje:

- Create Initiative
- Create Task
- Create Decision
- Create Report
- Create Presentation
- Create Assessment

### 4.2 Report / Presentation / Assessment — outline first (kanon)

Flow (MUST):

1. user klika “Create … from note”
2. system generuje **outline**
3. user **akceptuje / edytuje**
4. system tworzy artefakt i otwiera generator/builder

Cel:

- większa kontrola
- mniej “śmieciowych” obiektów
- lepszy UX konsultingowy

---

## 5) AI w Notebooku (tekst + research + voice)

### 5.1 AI Command Block (kanon v3)

Notebook obsługuje polecenia AI wykonywane “na miejscu”, w kontekście notatki, z wynikiem wstawianym do treści.

Przykłady:

- podsumowanie
- rozwinięcie punktu
- komentarz strategiczny
- propozycja KPI
- przepisanie w formę maila

**Zasada v3:** AI działa jako *propose → accept* (nie nadpisuje bez zgody).

### 5.2 Research Mode

Fazowanie:

- **V1 (v3):** ad‑hoc research (AI browsing) z whitelistą źródeł po stronie backendu
- **V2 (później):** zapisany research block z parametrami + schedule (np. 24h)

Whitelist (start):

- public market data
- kursy walut
- ceny energii
- dane makro
- oficjalne regulatory sites
- strony firm

Nie robimy:

- scrapingu zamkniętych systemów
- prywatnych baz

### 5.3 Voice Mode

W v3 są dwa rozdzielone tryby:

1. **Dictation mode** → mowa na tekst
2. **AI Command mode** → mówisz polecenie, AI wykonuje operację

---

## 6) Tagowanie (v3)

### 6.1 Ręczne tagi

- user może przypisać tagi do notatki

### 6.2 Automatyczne tagi (v3+)

- AI może sugerować tagi i wspierać wyszukiwanie semantyczne (embedding)

W v3 MVP dopuszczamy wdrożenie etapowe (najpierw manual + sugestie, potem embeddings).

---

## 7) Nawigacja w długiej notatce (v3)

MUST:

- **Mini outline** (H1/H2/H3)

SHOULD:

- **Vertical progress bar** po prawej stronie (szybkie przewijanie)

---

## 8) Prawy panel w Notebooku (tool) — zakres funkcjonalny v3

Notebook używa kanonicznego “3‑tools strip” (Tools / Context‑Links / AI Suggestions) i w każdym trybie ma mieć stabilną zawartość.

### 8.1 Tools

- Create from note (Initiative/Task/Decision/Report/Presentation/Assessment)
- AI Command (input / slash commands / voice command mode)
- Voice dictation
- Insert blocks (callout/toggle/table/…)

### 8.2 Context / Links

- wstawianie embedded references (chips + expand preview)
- “Used in” (backlinks) — platform‑wide

### 8.3 AI Suggestions

- topics to analyze (send-to-chat + insert into note)

---

## 9) Czego NIE robimy teraz (v3)

- graficzna mapa powiązań (v4)
- wersjonowanie
- approval workflow

