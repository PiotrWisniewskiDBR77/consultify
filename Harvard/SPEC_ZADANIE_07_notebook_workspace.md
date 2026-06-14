# ZADANIE #7 (SYSTEMOWE / P1-design) — Lekki workspace notatnika: konsolidacja prawego panelu + odchudzenie „Canonical Path"

> Propozycja redesignu zarządzania notatnikiem (M04). Na zlecenie właściciela 2026-06-13 (live test). Oparta na DWÓCH analizach: (1) inwentarz obecnego systemu w kodzie (file:line), (2) standardy best-in-class na rynku. Rozszerza `[[project_notebook_structure_overhaul]]`; projektować łącznie z Uwagą #1/#6 (globalny trzeci panel). Status: PROPOZYCJA do akceptacji.

---

## 1. Diagnoza: dlaczego obecny układ jest „ciężki"

Powstał, gdy aplikacja była „wielką tabelą". Trzy rzeczy go obciążają:

- **„CANONICAL NOTEBOOK PATH" — gigantyczny pasek** (`src/components/MyWork/notebook/NotebookCanonicalPathStrip.tsx:25-179`, render `NotebookContent.tsx:2503-2523`): 4 wielkie karty zajmujące ~40% kanwy. **Co gorsza — duplikuje akcje, które już są w prawym panelu**: krok 1 (Add sources) = Attachments, krok 2 (AI proposal) = AICommand, krok 3 (Review) = sekcja propozycji, krok 4 (Convert) = convert-to. To scaffold tłumaczący workflow, nie unikalna funkcja.
- **Rozproszone panele prawe.** Realnie są 2 przełączniki górne: „Tools" (suwaki, `AIChatInlinePanel.tsx`) i „Note context" (żarówka, `NotebookContextPanel.tsx`) + 2 panele zdarzeniowe (`ActionItemsPanel`, `AITopicsPanel`) otwierane spoza toggli. Trzeci ikonowy przycisk (dymek) = do potwierdzenia (prawdopodobnie komentarze/feedback). Użytkownik widzi „3 okna konkurujące o tę samą przestrzeń".
- **Brak hierarchii „mniej znaczy więcej".** Wszystko naraz, zero progresywnego ujawniania.

## 2. Standardy rynkowe (kontekst #2 — co robią najlepsi)

- **Jeden „inspector"/prawy rail z zakładkami, nie N osobnych przełączników.** Notion ma jeden prawy sidebar (komentarze/AI/info strony), Obsidian — jeden rail z układanymi/zakładkowanymi panelami (backlinks, outline), Craft — jeden inspektor. Wzorzec: JEDNA listwa, sekcje/zakładki, nie 3 przyciski podmieniające widok. (Shape of AI / agent-UX 2026: „inspector panel", „context mentions".)
- **AI jest akcją inline (slash / ⌘), nie osobnym „panelem".** Notion AI, Mem, Tana — AI wywoływane w miejscu kursora; panel służy do KONTEKSTU (co AI widzi), nie do uruchamiania.
- **Backlinks/linked references = pasywny kontekst w zwijanej sekcji**, nie wielkie CTA (Obsidian/Roam: backlinks na dole/ w railu).
- **Auto-surfacing kontekstu** (Mem, Tana supertags) — system sam podsuwa powiązane rekordy; to dokładnie wartość obecnego panelu „Note context" (ideas/initiatives/backlinks) → **to zostaje**.
- **Model NotebookLM:** źródła + praca + studio-outputs jako STREFY-workspace, nie toggle. Spójne z Uwagą #6 (notatnik jako trwały workspace).

Źródła: [AI Note-Taking Apps 2026 (saner.ai)](https://blog.saner.ai/best-ai-note-taking-apps/), [Best AI Note-Taking 2026 (get-alfred)](https://get-alfred.ai/blog/best-ai-note-taking-apps), [The Shape of AI — UX patterns](https://www.shapeof.ai/), [Agent UX 2026 (fuselabcreative)](https://fuselabcreative.com/ui-design-for-ai-agents/).

## 3. Integracja z całym systemem (kontekst #1 — czego NIE wolno zgubić)

Notatnik jest już gęsto wpięty — redesign musi zachować WSZYSTKIE mosty (inwentarz z dowodami w sesji):
- **Convert-to ×7**: Initiative/Task/Decision/Idea (direct) + Assessment/Report/Presentation (outline-gated, `canConvertDeliverable` = wordCount≥80 lub ≥2 nagłówki, `NotebookContent.tsx:696-702`) → `Api.convertNotebookPage`.
- **Link graph**: Note→Idea/Task/Decision/Initiative + embedded refs (`createLinkGraphEdge`), backlinks (`getLinkGraphBacklinks`).
- **Outputs registry**: linked outputs (`useArtifactOutputsForOrigins/ForInitiatives`).
- **Canvas**: „Expand into document" → `notebookExpandToDocument.ts` (kopia do work-canvas draft).
- **AI/Teresa**: AICommand (ask/expand/challenge/action), AIChat inline, suggestNotebookTopics, action-extraction → tasks, smart-classification toast.
- **Atrybuty pracy**: verification (Unverified/Verified/Disputed), review cadence (Weekly/Monthly/Quarterly), Mark as reviewed, stale flag, tags, visibility (private/project), attachments+capture-source.

## 4. PROPOZYCJA — układ docelowy

### 4a. Odchudzić „Canonical Path" (zgodnie z „4 małe przyciski")
**Usunąć wielki pasek z kanwy.** Workflow zachować jako:
- **Slim progres-chip w nagłówku notatki**: `① Sources · ② AI · ③ Review · ④ Convert` — 4 małe segmenty, aktywny podświetlony, gate (Refine first) jako tooltip na ④. Klik segmentu = ta sama akcja co dziś, ale akcje wykonują się w prawym railu (gdzie i tak żyją). Zysk: ~40% kanwy odzyskane, zero duplikacji.
- Alternatywa minimalna: 4 ikon-przyciski w istniejącym toolbarze edytora (obok H1/H2/list).

### 4b. Konsolidacja prawego panelu: 3 okna → JEDEN rail z 2 zakładkami
Zgodnie z wolą właściciela („zostaw AI-pomysły, resztę nawigacji upakuj pod jednym przyciskiem, trzeci zbędny"):

- **Zakładka A — „Praca" (konsoliduje obecny Tools + akcje Canonical Path + panele zdarzeniowe):** sekcje zwijane, progresywne:
  1. *Wstaw blok* (Callout/Warning/Toggle/Table/Divider) — kompakt, ikon-grid.
  2. *AI* — Command (⌘⇧A) + Chat + Topics + Action-extraction (scal `AITopicsPanel`+`ActionItemsPanel` tutaj, koniec osobnych okien).
  3. *Przekształć w…* — 7 celów convert-to z gate'ami (zastępuje „Create from note" + krok 4 Canonical).
  4. *Źródła i transformacje* — Attachments (krok 1 Canonical) + Translate/Change-style.
  5. *Atrybuty* — verification/review/tags/visibility/share/delete (na dole, rzadziej używane).
- **Zakładka B — „Kontekst AI" (ZOSTAJE bez zmian merytorycznych, `NotebookContextPanel`):** backlinks, linked outputs, podpowiedzi ideas/initiatives/tasks/decisions/notes z Insert/Open. To najsilniejsza, auto-surfacingowa wartość — zgodna z rynkiem.
- **Trzeci przycisk (dymek): usunąć lub scalić** — jeśli to komentarze, przenieść do Zakładki A (sekcja) albo do globalnego feedbacku. POTWIERDZIĆ czym jest przed usunięciem.

### 4c. Spójność z trwałym „trzecim panelem" (Uwaga #1/#6)
Ten rail to ta sama powłoka, której wymaga kręgosłup Teresy i multi-notebook tabs. **Projektować jako jeden komponent „workspace right-rail" reużywalny** (`ExecutiveModuleShell/RightRail.tsx` jako baza), hostujący notatnik / Canvas-doc / tabelę. Nie budować osobno.

## 5. Mapowanie „nic nie ginie" (każda obecna akcja → nowe miejsce)
| Dziś | Nowe miejsce |
|---|---|
| Tools: Insert block | Zakładka A › Wstaw blok |
| Tools: AI Command/Chat | Zakładka A › AI |
| Tools: Create from note ×7 | Zakładka A › Przekształć w… |
| Tools: Transform text | Zakładka A › Źródła i transformacje |
| Tools: page meta/share/delete | Zakładka A › Atrybuty |
| ActionItemsPanel / AITopicsPanel | Zakładka A › AI (scalone) |
| Note context (żarówka) | Zakładka B (bez zmian) |
| Canonical Path 4 karty | Slim chip w nagłówku (akcje → rail) |
| SEND TO: Initiatives | Zakładka A › Przekształć w… (handoff) |
| Verification/Review/Tags | Zakładka A › Atrybuty |

## 6. Otwarte decyzje produktowe (do właściciela)
1. **Trzeci przycisk (dymek)** — czym jest? (komentarze/feedback) → usunąć czy scalić?
2. **Zakres trzeciego panelu** — globalny dok (jak #6, przeżywa moduły) czy kontekstowy per-notatka? Determinuje, czy budujemy od razu reużywalny `workspace right-rail`.
3. **Canonical Path** — slim chip w nagłówku vs 4 ikony w toolbarze edytora?

## 7. Ryzyka
- Duża powierzchnia FE (NotebookContent.tsx ~2900 linii) — robić falami, każda funkcja z testem nieregresji (mosty convert/link-graph krytyczne).
- Nie zgubić gate'ów (`canConvertDeliverable`) i analytics funnel events przy przenoszeniu.
- Łączyć z #1/#6 — inaczej zbudujemy trzeci równoległy system paneli (anty-wzorzec, który właśnie likwidujemy).

## 8. Szacunek
- 4a (odchudzenie Canonical): mały, 1 komponent + render. Szybka wygrana.
- 4b (konsolidacja railu): średni/duży refaktor `AIChatInlinePanel`+toggli, ale bez zmian backendu (akcje istnieją). Falami.
- 4c (reużywalny workspace-rail): duży — wspólny z #1/#6, decyzja zakresu najpierw.
