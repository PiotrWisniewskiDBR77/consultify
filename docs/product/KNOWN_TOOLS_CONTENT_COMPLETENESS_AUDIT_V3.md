# Known Tools — Content Completeness Audit (v3) + Uzupełnienia (Plan)

> **Status:** Draft (v3 SSOT)  
> **Cel:** mieć jedno miejsce, które odpowiada: *które narzędzia w Consulting Tools są sprzedażowo kompletne (opis + KB + assety), a które mają braki* — oraz w jakiej kolejności uzupełniamy.
>
> **Zakres:** Consulting tools (31) + ich “Known Tools” wpisy w `tools` registry + KB “How to use” content.  
> Licensed assessments (DRD/SIRI/ADMA) mają własny tor (Methodology Packs) i nie są audytowane tutaj.
>
> **Poza zakresem tego audytu:** klasyczne frameworki jako **Consulting Templates library** (60 narzędzi) wdrażane jako Workspace templates — SSOT: `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md`.

## 0) Źródła prawdy (techniczne)

- Workflow modułu: `docs/product/CONSULTING_TOOLS_V3.md`
- “One task per tool” spec: `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- Consulting Templates library (60 classic frameworks): `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md`
- Registry Known Tools (DB seed):
  - `server/migrations/559_tools_known_tools_library.sql` (top tools)
  - `server/migrations/562_tools_toolsets_speed.sql` (toolsets + speed tool + KB)
- API kontrakt:
  - `server/src/services/KnownToolsService.ts`  
    - `library_content_translations` → `whenToUse/inputs/steps/outputs/commonMistakes/example/nextSteps`
    - `kbArticleSlug` = `tools-${toolType}-how-to` (deterministycznie)

---

## 1) Definicja “kompletności contentu” (v3)

W v3 “kompletne narzędzie” oznacza, że użytkownik w Library ma **pełny preview** i może wejść w **Help/KB**, a konsultant ma spójny materiał do poprowadzenia pracy.

### 1.1 Minimalny komplet (MUST)

Per tool (`toolType`) wymagamy:

1) **Known Tools library content** (w `tools.library_content_translations`):
   - `whenToUse`
   - `inputs[]`
   - `steps[]`
   - `outputs[]`
   - `commonMistakes[]`
   - `example`
   - `nextSteps[]`
2) **KB “How to use”**:
   - KB article exists (slug: `tools-${toolType}-how-to`)
   - translations EN + PL
   - content: purpose/inputs/steps/interpretation/mistakes + quick checklist
3) **Assets sprzedażowe (v3 quality bar)**:
   - **preview graphic** (kanoniczna reprezentacja narzędzia)
   - **60s avatar micro‑video** (scenariusz + docelowo video URL)

> Uwaga: w danych KB obecnie `thumbnail_url`, `video_url`, `video_teaser_url` są często `NULL` — to jest *brak assetów*, nawet jeśli artykuł istnieje.

---

## 2) Stan “as‑is” (na bazie seedów w repo)

### 2.1 Co już jest kompletne tekstowo (Library + whenToUse/inputs/steps/outputs)

W seedach mamy 31 narzędzi z kompletnym `library_content_translations` (EN+PL):

- 10 narzędzi z `559_tools_known_tools_library.sql` (top set)
- 15 narzędzi z `562_tools_toolsets_speed.sql` (ops+digital+process automation + KB)
- 6 narzędzi z `604_tools_missing_known_tools_library.sql` (uzupełnienie brakujących toolType w inventory v3)

### 2.2 Największy realny brak as‑is

- ✅ **0 narzędzi brakujących w Known Tools registry** — inventory 31/31 jest już seeded (Library + KB slugs) w migracjach powyżej.
- **Micro‑video + preview graphic**: nadal brak jako “asset pipeline” (w KB `video_url`/`thumbnail_url` często `NULL` → do produkcji).
- **Video script / GFX assumptions**: w wielu tool specach jest oznaczone jako TBD — do uzupełnienia content trackiem.

---

## 3) Tabela audytu (tool → braki → priorytet → owner → ETA)

Legenda braków:

- **L** = Library content (whenToUse/inputs/steps/outputs/…)
- **KB** = KB article + translations
- **GFX** = preview graphic
- **VID** = 60s avatar micro‑video (script + url)

Owner (proponowany):

- **PO/SME (Piotr)**: zatwierdza merytorykę i “graphics assumptions”
- **AI/Writer**: draft copy + draft KB + draft video script
- **Design/Video**: thumbnail + nagranie avatar (HeyGen)

> ETA to czas “wytworzenia i zatwierdzenia” — nie implementacji kodu.

### 3.1 Priorytet P0 (sprzedażowo / demo‑critical)

| toolType | Category | Braki | Priorytet | Owner | ETA |
|---|---|---|---|---|---|
| dynamic-swot | strategy | GFX, VID (assets) | P0 | Piotr + AI + Design/Video | 0.5–1d |
| market-forces | strategy | GFX, VID | P0 | Piotr + AI + Design/Video | 0.5–1d |
| growth-paths | strategy | GFX, VID | P0 | Piotr + AI + Design/Video | 0.5–1d |
| value-chain | strategy | GFX, VID | P0 | Piotr + AI + Design/Video | 0.5–1d |
| portfolio-priority | strategy | GFX, VID | P0 | Piotr + AI + Design/Video | 0.5–1d |
| risk-uncertainty | strategy | GFX, VID | P0 | Piotr + AI + Design/Video | 0.5–1d |
| capability-mapper | strategy | GFX, VID | P0 | Piotr + AI + Design/Video | 0.5–1d |
| process-automation | automation | GFX, VID | P0 | Piotr + AI + Design/Video | 0.5–1d |

### 3.2 Priorytet P1 (drugi rząd “credibility tools”)

| toolType | Category | Braki | Priorytet | Owner | ETA |
|---|---|---|---|---|---|
| vsm-builder | operations | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |
| a3-problem-solving | operations | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |
| sop-builder | operations | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |
| constraint-control | operations | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |
| decision-engine | operations | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |
| control-tower | operations | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |
| automation-pipeline | operations | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |

### 3.3 Priorytet P1 (digital “wow tools”)

| toolType | Category | Braki | Priorytet | Owner | ETA |
|---|---|---|---|---|---|
| robotics-feasibility | digital | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |
| logistics-automation | digital | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |
| rpa-scanner | digital | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |
| ai-discovery | digital | GFX, VID | P1 | Piotr + AI + Design/Video | 0.5–1d |

### 3.4 Priorytet P2 (pozostałe digital tools)

| toolType | Category | Braki | Priorytet | Owner | ETA |
|---|---|---|---|---|---|
| integration-diagnostic | digital | GFX, VID | P2 | Piotr + AI + Design/Video | 0.5–1d |
| digital-value-pool | digital | GFX, VID | P2 | Piotr + AI + Design/Video | 0.5–1d |
| legacy-analyzer | digital | GFX, VID | P2 | Piotr + AI + Design/Video | 0.5–1d |
| data-inventory | digital | GFX, VID | P2 | Piotr + AI + Design/Video | 0.5–1d |
| pain-to-solution | digital | GFX, VID | P2 | Piotr + AI + Design/Video | 0.5–1d |
| pain-explorer | digital | GFX, VID | P2 | Piotr + AI + Design/Video | 0.5–1d |

### 3.5 Krytyczne braki (nie ma wpisu w Known Tools)

| toolType | Category | Braki | Priorytet | Owner | ETA |
|---|---|---|---|---|---|
| ambition-decomposer | strategy | L, KB, GFX, VID | P0 (content) | Piotr + AI (+ Design/Video) | 1–2d |
| focus-tradeoff | strategy | L, KB, GFX, VID | P0 (content) | Piotr + AI (+ Design/Video) | 1–2d |
| narrative-engine | strategy | L, KB, GFX, VID | P0 (content) | Piotr + AI (+ Design/Video) | 1–2d |
| smed-planner | operations | L, KB, GFX, VID | P1 (content) | Piotr + AI (+ Design/Video) | 1–2d |
| dms-builder | operations | L, KB, GFX, VID | P1 (content) | Piotr + AI (+ Design/Video) | 1–2d |
| inventory-autopilot | operations | L, KB, GFX, VID | P2 (content) | Piotr + AI (+ Design/Video) | 1–2d |

---

## 4) Plan uzupełnień (żeby narzędzia były sprzedażowo czytelne)

### 4.1 Zasada pracy per tool (MUST)

Każdy task “narzędzie” zaczyna się od etapu **Spec / knowledge capture**:

1) **Zebranie formuły narzędzia** (public knowledge + consulting handbook best practices)
2) **Spisanie i zatwierdzenie**:
   - `whenToUse/inputs/steps/outputs`
   - graphics assumptions (co ma być na grafice)
   - 60s micro‑video script
3) Dopiero potem implementacja UI/wizarda.

Jeśli podczas wdrożenia jest niejasność — system / zespół zgłasza “needs PO decision” (Piotr) zamiast zgadywać.

### 4.2 “Help content” i avatar video robimy równolegle (w trakcie)

Nie odkładamy na koniec:

- w trakcie tworzenia narzędzia od razu tworzymy:
  - KB article (How to use) + video_script
  - preview graphic
  - 60s avatar script (i potem video_url/thumbnail_url)

To zwiększa jakość, bo knowledge jest świeże i spójne z UI.

### 4.3 Kolejność uzupełnień (praktyczny program)

1) **P0:** top strategic + process automation + brakujące 3 strategy (żeby domknąć pełne “10/10 strategy”)  
2) **P1:** operacyjne credibility + digital wow (robotics/logistics/rpa/ai)  
3) **P2:** reszta digital + brakujące 3 ops

---

## 5) Output do Implementation Program (jak to przepisać na taski)

Z tego audytu powstają 2 typy tasków:

1) **Content task per tool** (spec + KB + video script + graphics assumptions)
2) **Asset production task per tool** (thumbnail + avatar video + wpięcie URL do KB)

Każdy tool w P0/P1 powinien mieć oba taski (content + assets) zanim uznamy go za “sprzedażowo gotowy”.

