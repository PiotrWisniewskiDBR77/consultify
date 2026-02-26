# UI/UX Canon v3 (Consultinity MVP) — SSOT

> **Status:** Draft (v3)  
> **Cel:** Spisać w jednym miejscu **wszystkie kanoniczne decyzje UI/UX v3**, wynikające z feedbacku i “Phase 3” MVP.  
> Ten dokument nie zastępuje szczegółowych standardów — on je **konsoliduje** i wskazuje SSOT.

---

## 0) Zasady nadrzędne (MUST)

- **SSOT over vibes**: jeśli standard istnieje w `docs/ui-standards/` — jest prawem.
- **Chrome monochromatyczny (DBR77)**: kolor jest sygnałem danych/artefaktów, nie dekoracją nawigacji.
- **Kontrast > estetyka** w light mode: czytelność zawsze wygrywa.
- **Globalne tokeny zamiast ad-hoc** (rounding, warstwy tła, semantyka badge).

---

## 1) Light mode readability (MUST)

Problem v2: “za biało” + zbyt jasne teksty/chipsy = spadek czytelności.

Kanon v3:

- **Layer 1 (base)**: `bg-slate-50` (nie `bg-white`)
- **Layer 2 (elevated)**: `bg-white`
- Tekst główny w light mode: `text-slate-900` / `text-navy-900`
- Zakaz: “jasne tło semantyczne + jasny tekst tego samego koloru” (badge/chips)

SSOT: `docs/ui-standards/00-foundation/visual-language.md`

---

## 2) Rounding system (MUST)

Chcemy móc “podkręcać okrągłości” systemowo (Apple/Google style) bez ręcznej migracji setek klas.

Kanon v3:

- używać `rounded-hig-*` tokenów (globalnie sterowane w `tailwind.config.js`)
- nie wprowadzać nowych `rounded-lg/xl/...` w świeżym kodzie

SSOT: `docs/ui-standards/00-foundation/visual-language.md`

---

## 3) Artifact identity (ikona + akcent) (MUST)

Każdy artefakt ma:

- 1 kanoniczną ikonę
- 1 kanoniczny kolor akcentu

Zasady:

- chrome (sidebar/topbar): monochromatyczne ikony (akcent tylko w data surfaces)
- akcent w tabelach/kartach/kanban: dot, border, mini marker, ikona — nie “kolorowe tła w menu”

SSOT: `docs/ui-standards/00-foundation/artifact-identity-map.md`

---

## 4) Breadcrumbs (MUST)

Sprzątamy “Dashboard / My Work” i podobne hybrydy.

Kanon v3:

- `Module > Surface/Tool`
- brak dodatkowego “wielkiego tytułu” — breadcrumbs są wystarczające

SSOT: `docs/ui-standards/03-modules/module-hub-standard.md`

---

## 5) Dwa topbary: App vs Module (MUST)

### 5.1 App Topbar (globalny, stały)

- prawa strona (stała kolejność): **Data → Model → Inbox → Tasks(Today) → User**
- brak globalnego przycisku “AI toggle”
- Notifications scalone do Inbox

SSOT: `docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md`

### 5.2 Module Topbar (kontekstowy)

Kolejność elementów (prawa strona):

**AI context → +New → View modes → Filters**

SSOT: `docs/ui-standards/03-modules/module-hub-standard.md`

---

## 6) Kanoniczny “AI w kontekście” (MUST)

Jeden, stały przycisk w topbarze modułu:

- steruje split chat (open/close)
- chat ma znać kontekst ekranu i artefaktu

SSOT (koncepcja): `docs/ui-standards/00-foundation/artifact-identity-map.md`  
SSOT (layout): `docs/ui-standards/03-modules/module-hub-standard.md`  
SSOT (hook w kodzie): `src/hooks/useOpenChatWithContext.ts`

---

## 7) Table + Preview Pane (MUST)

Kanon “Outlook style”:

- preview jest częścią surface’u tabeli (nie “border-l widget”)
- szerokość: 20–33% (min ~340px)
- rounded card + warstwy tła spójne z tabelą
- wspólny shell: `PreviewPaneShell`

SSOT: `docs/ui-standards/03-modules/table-preview-pane-standard.md`

---

## 8) Workspace “3‑tools strip” (MUST)

Jeden, stały pasek 3 przycisków dla workspace’ów:

1. **Tools** — narzędzia pracy w danym narzędziu
2. **Context/Links** — sugestie powiązań z platformy
3. **AI Suggestions** — “topics to analyze” + send-to-chat + insert

SSOT: `docs/ui-standards/02-components/workspace-3-tools-strip.md`

---

## 9) Inbox jako Action Queue (MUST)

Inbox to miejsce, gdzie spływa wszystko wymagające akcji (system/AI/sync/artefakty) i ma standard:

- tabela + preview pane (Outlook style)
- filtry (All/Read/Unread itp.) jako część Module Topbar

SSOT: `docs/ui-standards/03-modules/table-preview-pane-standard.md`

