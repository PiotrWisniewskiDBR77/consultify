# Artifact Identity Map (Colors + Icons) — v3

> **Status:** Draft (v3)  
> **Cel:** Ustalić stałą tożsamość wizualną artefaktów i narzędzi w całej platformie: *jeden artefakt = jeden kolor akcentu + jedna ikona kanoniczna*.  
> **Zasada DBR77:** UI chrome pozostaje monochromatyczny. Kolor artefaktu to **akcent danych**, nie dekoracja nawigacji.

## 1) Co to jest “identity”

**Identity** = zestaw 2 stałych elementów:

- **Icon (Lucide)** — jedna kanoniczna ikona reprezentująca artefakt
- **Accent color** — kolor akcentu używany tylko jako sygnał (ikonka, cienka ramka, badge/dot, mini gradient w kartach)

**MUST NOT:** kolorowe tła w menu głównym (sidebar/top chrome).

## 2) Kanoniczna mapa (propozycja v3)

Tabela niżej jest **docelową** mapą v3. Na start dopuszczamy “as-is mapping” (sekcja 3), ale docelowo aplikacja ma trzymać jedną mapę.

| Artefakt / narzędzie | Kanoniczna ikona | Akcent (kolor) | Dozwolone użycie akcentu |
|---|---|---|---|
| **Initiative** | `Lightbulb` _(lub `Rocket` jeśli rozdzielamy Idea vs Initiative)_ | **blue** | dot/badge, cienka ramka w dynamic tab, mini marker w tabeli |
| **Task** | `CheckSquare` | **emerald** | status chip, ikona, row marker, kanban card accent |
| **Decision** | `Scale` | **amber** | status chip, ikona, dot, risk/priority accent |
| **Idea** | `Lightbulb` _(jeśli Initiative zmieni ikonę)_ | **violet** | ikona, subtle border, tag chips |
| **Notebook page** | `BookOpen` _(preferowane)_ | **indigo** | ikona, subtelny akcent w cards, convert-to menu |
| **Tool session (consulting)** | `Wrench` / `Zap` (kategoria) | strategic=emerald, operational=blue, digital=purple, automation=amber | kategoria tool (karta/lista), nie jako CTA |
| **Assessment** | `CheckCircle2` | **cyan** (sygnał) | framework badges, report cover chips |
| **Report** | `FileText` / `FileBarChart2` | **slate** (neutral) + opcjonalny info blue | okładki, export badges |
| **Presentation / Deck** | `Presentation` / `Monitor` | **fuchsia** (sygnał) | okładki decków, “exported” chip |
| **Meeting** (future) | `CalendarDays` | **sky** (sygnał) | event chip, calendar markers |
| **Inbox / Notification** | `Inbox` / `Bell` | **red** (signal only) | unread badge, urgency marker |
| **AI Chat** | `MessageSquare` / `Sparkles` | **primary** (brand) | jeden kanoniczny “AI CTA” w topbarze |

### 2.1 Zasada rozróżnienia Idea vs Initiative (KANON v3)

W kodzie as-is oba miejsca używają `Lightbulb` (Sidebar Initiatives, MyWork Ideas).
W v3 rozdzielamy te dwa byty (żeby UI było jednoznaczne) w sposób kanoniczny:

- **Idea** = `Lightbulb`
- **Initiative** = `Rocket`

## 3) Inwentaryzacja “as-is” (wycinek)

### 3.1 Sidebar module icons (as-is)

Źródło: `src/components/navigation/Sidebar/menuConfig.ts`.

- AI Chat: `MessageSquare`
- My Work: `Briefcase`
- Interview: `ClipboardList`
- Tools (Discovery Tools): `Wrench`
- Licensed Tools (Assessment): `CheckCircle2`
- Initiatives: `Lightbulb`
- Execution: `Rocket`
- Benefits: `TrendingUp`
- Economics: `Calculator`
- Reports: `BookOpen`

### 3.2 MyWork tabs (as-is)

Źródło: `src/components/MyWork/MyWorkHub.tsx` (tabs config).

- Executive: `FileText`
- Inbox: `Inbox`
- Focus: `Target`
- Tasks: `CheckSquare`
- Decisions: `Scale`
- Notebook: `FileText` (do zmiany na `BookOpen` w v3, dla rozróżnienia)
- Ideas: `Lightbulb`

### 3.3 Shared sections (N-mode) — kanoniczne ikony sekcji (as-is)

Poniżej “kręgosłup” ikon, który powtarza się wewnątrz narzędzi (Task/Decision/Initiative itp.).
Źródła: `src/components/shared/NModeSections/`.

- **Risk**: `AlertTriangle` (+ AI: `Sparkles`, akcje: `Plus`, `X`)  
  SSOT: `RiskCanvas.tsx`
- **Governance**: `Edit3`, `Trash2` (+ AI: `Sparkles`, akcje: `Plus`, `X`)  
  SSOT: `GovernanceCanvas.tsx`
- **Attachments / Links**: `Paperclip`, `Link`, `Upload`, `ExternalLink`, `Cloud`, `HardDrive`, `Search`, `MoreVertical`  
  SSOT: `AttachmentsLinksCanvas.tsx`
- **Activity Log**: ikony są dostarczane przez `typeMeta()` w artefakcie (kontrakt: `ActivityLogCanvas.tsx`)
- **Team / People**: `Users` (sekcja), `User` (pojedyncza rola), `Crown` (owner/admin), `Shield` (governance/permissions)  
  As-is przykłady: `src/components/Initiatives/sections/TeamSection.tsx`, `src/components/assessment/manage/TeamManagementPanel.tsx`
- **Comments**: `MessageSquare` (+ akcje: `Plus`, `X`, AI: `Sparkles`)  
  SSOT: `CommentsCanvas.tsx`
- **Dependencies**: `ArrowUp`/`ArrowDown` (kierunek), `AlertTriangle` (blocked), `CheckCircle2` (done), `ExternalLink`, `Copy`, `Edit3`, `Trash2`, `MoreVertical`, `Search`  
  SSOT: `DependenciesSection.tsx`

> v3 reguła: jeśli sekcja ma “ikonę semantyczną” (Risk/Governance/Attachments/Comments/Activity),
> to ta sama ikona powinna być użyta w: nagłówku sekcji, left-nav (N-mode), oraz w chips/badges w listach.

### 3.4 Linked item “type chips” — uwaga o spójności

W `AttachmentsLinksCanvas.tsx` istnieje wewnętrzna mapa kolorów `TYPE_CHIP` dla typów linków (`task`, `decision`, `initiative`, …).

**KANON v3:** `TYPE_CHIP` powinien być zgodny z mapą tożsamości artefaktów (sekcja 2) oraz z zasadą light-mode readability (sekcja 5),
czyli:

- akcent = sygnał (tło `*/10–*/15`, border `*/20`)
- tekst w light mode bliżej `*/700` (lub neutralny `text-slate-900`) — nie “400 na białym”

## 4) Reguły użycia ikon (v3)

- **Ikony w chrome (nav/topbar)**: monochromatyczne, outline, stały stroke (jak `NavItem.tsx`).
- **Ikony w data surfaces** (tabela/karty/kanban): mogą używać akcentu artefaktu, ale:
  - tło ikony nie może być tak jasne, że “zjada” label (light mode problem)
  - jeśli jest background, to **kontrast** musi być zachowany (preferuj ciemniejszy tekst lub mocniejszy border)

## 5) Reguły light mode (czytelność)

W light mode zabronione jest zestawienie: bardzo jasne tło semantyczne + jasny tekst tego samego koloru.

Preferowane:

- tło semantyczne: `*/10–*/15`
- tekst semantyczny: `*/700` (lub `slate-900` dla treści)
- jeśli tło jest bardzo jasne: dodaj subtelny border (`*/20`) albo przyciemnij tekst.

## 6) Kanoniczny przycisk “AI w kontekście” (topbar)

W v3 “AI w kontekście” jest **jednym** kanonicznym przyciskiem (ikonka + label), zawsze w topbarze modułu po prawej stronie
(przed “+ New …” i przed view modes).

**Funkcja:**

- klik = otwarcie lewego panelu czatu (split chat) i rozpoczęcie rozmowy o **tym, co user widzi teraz**
- jeśli aktywna rozmowa ma już ten kontekst → tylko otwórz panel
- jeśli nie → utwórz nową rozmowę z `workspaceContext` + `pmoContext`

**SSOT w kodzie (as-is):**

- Hook: `src/hooks/useOpenChatWithContext.ts`
- Globalny toggle split chat: `src/layouts/MainLayout.tsx` (przycisk “AI”)

> Uwaga: istnieje też “legacy widget” typu floating (`src/components/AIChat/ChatToggleButton.tsx`) z animacją.
> W v3 kanon to topbar button; legacy widget jest traktowany jako opcjonalny / deprecated.

