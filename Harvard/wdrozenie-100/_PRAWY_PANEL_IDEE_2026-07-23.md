# Prawy panel IDEE (inspektor) — co jest, co powinno być, co mówi dokumentacja

**Data:** 2026-07-23 · **Zakres:** prawy panel + ikony-zakładki na prawej krawędzi, 4 narzędzia płótna (Mind Map / Whiteboard / Process Flow / Tabela)
**Metoda:** wyciągnięte z kodu (`ideaCanvasMelsChips.ts`, `IdeaMapWorkspace.tsx`, `IdeaWorkspaceTools.tsx`, `ExecutiveModuleShell/RightRail.tsx`) + kanon z `ARTIFACT_ANATOMY_STANDARD.md`.

---

## 1. Diagnoza jednym zdaniem

Ikony po prawej krawędzi to **5 zakładek, które wszystkie otwierają ten sam panel**. Kliknięcie innej ikony **nie zmienia treści** — pokazuje całość (wszystkie sekcje w jednym scrollu). Kliknięcie aktywnej ikony **zamyka** panel. Czyli: zakładki są zbudowane wizualnie, ale **przełączanie między nimi nie jest podłączone**. Twoja obserwacja jest trafna.

---

## 2. Co jest pod tym menu TERAZ (z kodu)

### 5 ikon-zakładek (prawa krawędź)
Definicja: `buildIdeaCanvasRightRailTools()` w `ideaCanvasMelsChips.ts:322`.

| poz. | ikona (lucide) | id | etykieta | co robi po kliknięciu |
|---|---|---|---|---|
| 1 | `HelpCircle` (?) | `problem` | Problem | otwiera panel (całość) / zamyka jeśli już aktywna |
| 2 | `GitBranch` | `status` | Status | to samo — **ten sam panel** |
| 3 | `Sparkles` | `inspector` | Inspector | to samo — **ten sam panel** |
| 4 | `Workflow` | `convert` | Convert | to samo — **ten sam panel** |
| 5 | `LayoutTemplate` | `health` | Health | to samo — **ten sam panel** |

### Panel, który się otwiera (ten sam dla każdej ikony)
Renderowany przez `IdeaWorkspaceTools.tsx` — accordion 5 sekcji naraz, w kolejności:

| # | sekcja | domyślnie | zawartość |
|---|---|---|---|
| 1 | **Problem** | otwarta | tytuł + opis pomysłu + Zapisz / Zaakceptuj |
| 2 | **Status** | otwarta | etap (SPARK→…), kompletność, dowody, + podgrupa **Metadata** (branch / area / priorytet) |
| 3 | **Konwertuj** | zwinięta | inicjatywa · zadania · decyzja · raport · deck … |
| 4 | **Inspektor narzędzia** | otwarta | zależny od narzędzia: „Inspektor mapy" / „Inspektor procesu" / „Inspektor tablicy" — właściwości węzła (styl/układ/motyw) |
| 5 | **Zdrowie narzędzia** | zwinięta | „Zdrowie mapy" / „Zdrowie procesu" — wskaźnik jakości |

To jest dokładnie to, co widać na Twoim zrzucie (Status, Idea Completeness, Metadata, Convert, Map Inspector, Map Health) — **wszystko w jednym panelu**, nie pod osobnymi zakładkami.

---

## 3. Dlaczego reszta ikon „nie jest podłączona" (dokładny mechanizm)

Dwa braki w spięciu, oba w `IdeaMapWorkspace.tsx`:

**(a) Renderer ignoruje wybraną zakładkę.** `renderMelsCanvasRightRailPanel` (`IdeaMapWorkspace.tsx:3231`):
```ts
const renderMelsCanvasRightRailPanel = useCallback(
  (_activeToolId: string | null) => (        // ← podkreślnik = argument CELOWO nieużywany
    <IdeaWorkspaceTools {...} open embedded />  // ← zawsze ten sam komponent, cała treść
  ), [...]);
```
Powłoka woła `renderRightRailPanel(activeToolId)` z id klikniętej zakładki — ale funkcja ten id **wyrzuca** i zwraca zawsze pełny `IdeaWorkspaceTools`. Stąd: 5 ikon → 1 treść.

**(b) Host nie przekazuje stanu wyboru.** `IdeaMapWorkspace.tsx:3303` przekazuje `rightRailTools` i `renderRightRailPanel`, ale **NIE** przekazuje `activeRightToolId` ani `onSelectRightTool`. Więc powłoka trzyma stan aktywnej zakładki tylko u siebie (wizualnie podświetla ikonę), a że renderer i tak ignoruje id — podświetlenie jest jedynym efektem.

**Zachowanie powłoki** (`RightRail.tsx:126`): panel pokazuje się tylko gdy jakaś zakładka jest aktywna (`showPanel = Boolean(activeTool)`), a klik w aktywną = `onSelectTool(null)` = zamknięcie. To tłumaczy „klik otwiera/zamyka, ale zawsze to samo".

**Wniosek:** zakładki NIE są martwe technicznie (reagują, podświetlają się, otwierają/zamykają panel) — brakuje **przełączania treści per zakładka**. Intencja projektu jest w komentarzu descriptora: „*the host renders the matching existing panel content via `renderRightRailPanel(activeToolId)`*" — czyli renderer **miał** przełączać po `activeToolId`. Ta połowa nie została napisana.

---

## 4. Co POWINNO być pod tym menu

Dwa poziomy „powinno", bo są dwa źródła prawdy — i one się ze sobą **rozjeżdżają**:

### 4a. Zgodnie z własnym projektem zakładek (intencja D-W-2)
Każda z 5 ikon → **swoja** sekcja, nie wszystko naraz:
- **Problem** → sekcja Problem
- **Status** → Status + Metadata
- **Inspector** → inspektor narzędzia (właściwości węzła)
- **Convert** → konwersja
- **Health** → zdrowie

To najmniejsza naprawa: `renderMelsCanvasRightRailPanel` ma przełączać po `activeToolId` i renderować tylko wybraną sekcję (albo scrollować do niej), plus host ma przekazać `activeRightToolId`/`onSelectRightTool`.

### 4b. Zgodnie z KANONEM artefaktu SPEC-A (`ARTIFACT_ANATOMY_STANDARD.md §11.2 / §708)
Kanoniczny prawy panel każdego artefaktu ma 5 sekcji w stałej kolejności:
> **Akcje · Właściwości · Powiązania · Komentarze · Historia/AI**
(komponent `src/components/standard/ArtifactRightPanel.tsx` — używają go karty Rekord: Task/Decision/Insight/Notification).

Dla archetypu **Canvas** (§13, tabela) panel wg kanonu to:
> ▸ Właściwości węzła (kolor/rozmiar/typ) · ▸ **Powiązania** (do inicjatyw/źródeł) · ▸ Warstwy/struktura · ▸ Historia/AI

**IDEE canvas NIE używa `ArtifactRightPanel`** — ma własny `IdeaWorkspaceTools` z innym zestawem 5 sekcji (Problem·Status·Konwertuj·Inspektor·Zdrowie). Względem kanonu:

| Kanon (Canvas §13) | Jest w IDEE? |
|---|---|
| Właściwości węzła | ✅ (wewnątrz „Inspektor narzędzia") |
| **Powiązania** (do inicjatyw/źródeł) — first-class | ❌ **brak jako sekcja** |
| Warstwy / struktura | ❌ brak |
| **Komentarze** | ❌ brak (kanon ogólny §708 je wymaga) |
| Historia / AI | ⚠ częściowo — „Historia wersji" jest, ale w lewym railu / kebabie, nie w prawym panelu |
| — dodatkowo w IDEE: Problem, Status, Konwertuj, Zdrowie | (nadmiar względem kanonu — orientacja „pomysł→inicjatywa") |

---

## 5. Co mamy opisane w dokumentacji

- `ARTIFACT_ANATOMY_STANDARD.md:708` — kanon prawego panelu: „Akcje·Właściwości·Powiązania·Komentarze·Historia/AI", pełna specyfikacja wyglądu (nagłówek h-11, pola label L4 + wartość L3, first-class Powiązania).
- `ARTIFACT_ANATOMY_STANDARD.md:303` — panel dla archetypu Canvas: Właściwości węzła · Powiązania · Warstwy · Historia/AI.
- `ARTIFACT_ANATOMY_STANDARD.md:1213` — lista czekowania DoD: „Prawy panel: sekcje w kolejności Akcje·Właściwości·Powiązania·Komentarze·Historia/AI".
- `IdeaWorkspaceTools.tsx:4-11` — deklaruje WŁASNY kanon: „Editor Shell Canon §2 PRAWA (UI-L16): ≤5 sekcji" z listą Problem·Status·Convert·Inspector·Health.

**To jest rdzeń rozjazdu:** dokumentacja artefaktów (SPEC-A) mówi jedno, a płótno IDEE realizuje drugie („Editor Shell Canon"), i te dwa kanony nie zostały uzgodnione. Zakładki na prawej krawędzi to trzecia warstwa, wpół-spięta.

---

## 6. Podsumowanie dla decyzji

| Pytanie | Odpowiedź |
|---|---|
| Co jest teraz? | 5 ikon = 5 toggli otwierających **ten sam** panel z 5 sekcjami naraz |
| Czemu reszta „nie podłączona"? | renderer ignoruje id zakładki (`_activeToolId`), host nie przekazuje `activeRightToolId`/`onSelectRightTool` |
| Co powinno być (min)? | każda ikona → swoja sekcja (dokończyć renderer + 2 propsy) |
| Co powinno być (kanon)? | Akcje·Właściwości·Powiązania·Komentarze·Historia/AI — a brakuje **Powiązań** (first-class), **Komentarzy**, Historii w panelu |
| Największa luka merytoryczna | **Powiązania** i **Komentarze** — kanon je wymaga, IDEE canvas ich nie ma jako sekcji |

**Rekomendacja kolejności naprawy:** (1) dopiąć przełączanie zakładek (mała, czysto UI, odkłamuje „5 ikon"), (2) decyzja czy IDEE canvas dochodzi do kanonu SPEC-A (dodać Powiązania + Komentarze) czy świadomie zostaje przy „Editor Shell Canon" — to decyzja Piotra, bo dotyka spójności całego produktu.
