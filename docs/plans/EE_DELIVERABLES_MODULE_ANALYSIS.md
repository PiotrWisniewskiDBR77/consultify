# EE / Deliverables Module — Pełna analiza stanu obecnego (Faza 1: Research)

> **Data:** 2026-06-02
> **Autor:** analiza Claude Code (5 równoległych researchów kodu + dokumentacji)
> **Zakres:** moduł "EE" = centrum przedstawiania efektów pracy = **Document Studio** (Word) + **Table Studio** (Excel) + **Presentation Studio** (prezentacje), spięte hubem **Outputs Library**.
> **Status dokumentu:** Faza 1 zamknięta (research). Faza 2 (gap rynkowy) i Faza 3 (budowa) — do uruchomienia.

---

## 0. Co to jest "EE" w kodzie

"EE" nie istnieje jako nazwa w kodzie. To, co opisujesz (sidebar + obszar dokumentów Word/Excel + prezentacja), mapuje się na **moduł deliverables / Outputs** — warstwę, w której efekty pracy stają się trwałymi, wersjonowanymi, audytowalnymi artefaktami.

Architektura (zgodnie z `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`):

```
                 ┌─────────────────────────────────────────┐
                 │   Artifact Registry (GET /api/artifacts) │   ← jeden rejestr
                 │   Document · Presentation · Sheet        │
                 └─────────────────────────────────────────┘
                        ▲             ▲              ▲
        ┌───────────────┘             │              └───────────────┐
   Document Studio            Presentation Studio              Table Studio
   (/document-studio)         (/presentations/builder)         (/tabele)
   "Word-like"                "Slides / Deck"                  "Excel/Airtable"
                        ▼             ▼              ▼
                 ┌─────────────────────────────────────────┐
                 │   Outputs Library = ReportsAndPresentations Hub  │
                 │   (/presentations)  — tabs: All/Mine/Review/     │
                 │   Documents/Presentations/Sheets/Templates        │
                 └─────────────────────────────────────────┘
```

Twoje trzy elementy:
1. **Sidebar: opis EE (centrum zarządzania dokumentami)** → dziś **NIE istnieje** jako jeden wpis. Są dwa osobne wpisy ("Reports" #8 i "Presentations" #9), oba prowadzą do tego samego huba. Brak wpisu "Documents"/"Sheets"/"Templates" (tylko jako zakładki). Żaden wpis nie ma pola `description`.
2. **Obszar dokumentów (Word + Excel)** → Document Studio + Table Studio.
3. **Prezentacja** → Presentation Studio (DeckBuilder).

---

## 1. Stan trzech filarów (z kodu, nie z dokumentów)

### 1A. Document Studio (Word) — dojrzałość ~50–55%

**Ścieżka:** `/document-studio`, `src/components/DocumentStudio/`. Wejście z huba ("New AI document").

**Działa (mocna strona = governance plumbing):**
- 3-fazowy flow: intake → outline (plan) → document. 3 tryby (bez szablonu / plan szablonu / z zatwierdzonego szablonu).
- Realne renderery eksportu na backendzie: **DOCX** (pakiet `docx@9.5.1` — style Word, nagłówki, tabele, callouty, numeracja stron, stopka poufności) i **PDF** (`pdfkit` — strona tytułowa, TOC, tabele, cytowania, rasteryzacja wykresów). Eksport: markdown / docx / pdf.
- Bogate governance: wersjonowany schema, audyt, edytor z 6 zakresami (local/section/global/methodology/source/transformative), QA Engine (10 kategorii, soft-block przy eksporcie), approvals z kworum, share links, audience variants, schema diff, source version pinning.
- Backend solidnie przetestowany (~70 plików testów w `server/src/services/documentStudio/`).

**Nie działa / brak (krytyczne luki):**
- ⛔ **Brak edytora rich-text.** Nie ma TipTap/ProseMirror/contentEditable. Dokument to **read-only HTML preview** renderowany blok po bloku.
- ⛔ **Treść NIE jest generowana przez AI przy tworzeniu.** `buildDocumentSchema` zwraca **placeholdery** ("MVP-1 placeholder; finalization replaces it with AI-generated narrative"). LLM dotyka tylko *outline*, nie treści bloków. Realna treść powstaje dopiero przez post-hoc proposale w edytorze.
- ⛔ Edycja jest wyłącznie **propozycja → diff → approve/reject**, brak WYSIWYG, brak inline edit, brak współpracy real-time/kursorów.
- Komentarze tylko na poziomie dokumentu (typy wspierają sekcję/blok, ale UI nie); odpowiedzi liczy się, nie renderuje.
- Dropdown typów pokazuje 15 z 23 wspieranych typów.
- FE testy: **1 plik** (5 testów). UI praktycznie nieprzetestowany.

### 1B. Table Studio (Excel) — dojrzałość ~65%

**Ścieżka:** `/tabele` (KIMI `TabeleView`), backend `table-platform`. `/excele` → redirect na `/tabele`.

**Działa (mocna strona = model danych klasy Airtable):**
- Relacyjny model: bases → tables → fields → views → records. **30+ typów pól** (w tym linkedRecord, rollup, lookup, formula, oraz konsultingowe: risk_score, priority, ai_generated_summary, ai_classification, source_reference).
- ~120 endpointów backendu (`tablePlatform.api.ts`, 2187 linii). 8 typów widoków (grid/kanban/calendar/timeline/gantt/gallery/form/matrix).
- Własny, wirtualizowany grid (`GridView.tsx`) z pełną edycją inline — **ale tylko w `IdeaTableTool` (MyWork)**, nie na `/tabele`.
- Eksport CSV + XLSX + import CSV/Google Sheets. Formy publiczne (JWT intake). Audit trail, collaborators, webhooks, templates (30 szablonów), provenance/QA.

**Nie działa / brak:**
- ⛔ **Dwie nie-zunifikowane powierzchnie.** `/tabele` (flagowa, z chatu) jest **read-only preview** (zwykłe `<td>`, bez inputów). Edytowalny grid żyje osobno w MyWork `IdeaTableTool`. Użytkownik nie edytuje komórek na `/tabele`.
- ⛔ **Toy-grade silnik formuł** (`FormulaEngineV2.ts`): regex, tylko SUM/AVG/MIN/MAX/COUNT/IF/CONCAT, **brak zakresów A1:B2, brak biblioteki funkcji**. Vs Excel/Sheets = przepaść.
- AI Editor: część poziomów to **stuby** (`handlerStatus: 'stub'|'live'`, badge w UI). Poziomy 7–8 super-admin only.
- Nowy shell MELS za flagą domyślnie OFF; AI Editor/QA za flagami backendu.
- ⚠️ **Zacommitowane markery konfliktu merge** w 6 plikach flag (`melsTabeleFlag.ts` i in.) — w komentarzach JSDoc (kompiluje się, ale docbloki uszkodzone). [Zgłoszone osobno.]
- Historia commitów zdominowana przez hotfixy stabilności ("fail loudly", "ghost artifacts", "harden materialization") — ścieżka materializacji była krucha, świeżo ustabilizowana.

### 1C. Presentation Studio (Prezentacje) — dojrzałość ~60% (DeckBuilder ~70%)

**KLUCZOWE: istnieją DWA równoległe, niepowiązane pipeline'y prezentacji.**

| | `/presentation-studio` (`PresentationStudioPage`) | `/presentations` + wizard + builder |
|---|---|---|
| Cel | read-only preview + approval (governance) | realne tworzenie: wizard → AI deck → WYSIWYG → eksport |
| Status | **route osierocony** (brak linku w nawigacji), kończy się ślepo (tylko deck ID, brak przejścia do buildera) | **realny, pełnofunkcyjny edytor** |

**Działa (DeckBuilder = najlepsza część całego modułu, ~70%):**
- Prawdziwy WYSIWYG w stylu Gamma/Pitch: 3 panele (sorter slajdów | canvas | toolbar). **17 typów bloków** (heading, lista, tabela, chart, image, kpi_widget, smart_layout, smart_diagram, timeline, metric_strip, artifact_embed…).
- `LayoutEngine` auto-dobiera layout i przypisuje bloki do regionów. Inline edit (TipTap), undo/redo, theme switcher, brand kit, media library, speaker notes.
- AI (Teresa) edytuje przez **proposale (accept/reject)**. Collaboration (presence), version history, autosave z optimistic-concurrency (409 handling).
- Eksport **PPTX + PDF + PNG** (quality-gate-blocked). **Present mode** z presenter view (current+next slide, notatki, timer). Publiczny share link.
- Wizard (Gamma-style 5 kroków): sources → setup → outline → generating → result, generacja AI z artefaktów.

**Nie działa / brak:**
- ⛔ `/presentation-studio` osierocony i ślepy (governance scaffold nigdy nie wpięty w produkt). Dojrzałość jako feature ~35%, jako backend plumbing ~85%.
- ⛔ `Presentations/PresentationsHub.tsx` (25KB) = **martwy kod** (nie routowany).
- ⛔ **Zero testów** na realny edytor (DeckBuilder, PresentMode, CardRenderer, LayoutEngine, wszystkie 17 bloków, wizard). Testy są na osieroconym Studio.
- Bloki są przypisywane do regionów, nie ma **free-form drag-anywhere** (jak Pitch/PowerPoint).
- HTML export = stub. Layout-capacity admin process-global, nie per-tenant.

---

## 2. Problemy przekrojowe (cały moduł)

1. **Fragmentacja / duplikacja.** Dwa stacki dokumentów (`/document-studio` + `/reports/builder` oraz KIMI `/wordy`), dwa stacki prezentacji (`/presentations` + KIMI `/prezentacje`), dwie powierzchnie tabel (`/tabele` read-only + MyWork `IdeaTableTool` edytowalny). To samo zadanie ma po 2 implementacje.
2. **Brak prawdziwego "centrum zarządzania dokumentami" w sidebarze.** Hub istnieje (`ReportsAndPresentationsHub` = realne Outputs Library z rejestrem artefaktów), ale nawigacja go rozbija na "Reports" + "Presentations" i ukrywa "Documents/Sheets/Templates" jako zakładki. Brak jednego wpisu "Deliverables/Dokumenty".
3. **Testy odwrotnie skorelowane z wartością.** Dobrze przetestowane są warstwy governance i osierocone powierzchnie; realne edytory (DeckBuilder, IdeaTablectool, DocumentStudio UI) — prawie zero FE testów.
4. **Lokalizacja PL niekompletna.** Brak kluczy `sidebar.outputsLibrary`, całego namespace `documentStudio.*`, większości `rap.outputs.*` — renderują się angielskie fallbacki nawet po polsku.
5. **Materializer / konwersje to stuby.** Table→Document i Table→Presentation są kontraktowo zbudowane, ale działają na injectable stub (P1) — realny cross-artifact pipeline nie jest w pełni live. Generacja treści dokumentu to placeholdery.
6. **Rozbieżność dokumenty vs kod.** Closeouty z 2026-05-16 mówią "PASS na strict-dev", ale: (a) "Business Owner manual acceptance" wszędzie odroczone, (b) realne luki UX powyżej. "PASS strict-dev" ≠ gotowe dla użytkownika.

---

## 3. Mapa dokumentacji (źródła prawdy)

**Przekrojowe:** `V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md` (kanon), `ARTIFACT_LINEAGE_MATRIX.md`, `DOCUMENTATION_REGISTRY.md` (rozstrzyga autorytet).
**Document/Reports:** `CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md` (+ GAP_MATRIX, TYPE_TAXONOMY, IMPLEMENTATION_PLAN), `REPORT_BUILDER_EXPORTS_STANDARD.md`. (`REPORT_GENERATOR_V3.md` — superseded.)
**Table:** `TABLE_V8_SSOT.md` + `TABLE_STUDIO_FULL_PRODUCT_CLOSEOUT_2026-05-08.md` + `TABLE_MISSING_CAPABILITIES_MATRIX_V8.md`.
**Presentation:** `PRESENTATION_GENERATOR_V3.md` (najwyższy autorytet, NIE superseded) + `CONSULTIFY_PRESENTATION_STUDIO_*_2026-05-08` (requirements / 100% contract / sprint plan).
**Realny status:** `docs/testing/reports/{EXCEL_TABLE_STUDIO_BLOCK12, WORD_DOCUMENTS_REPORTS_BLOCK13, PRESENTATIONS_BLOCK14}_STRICT_DEV_CLOSEOUT_2026-05-16.md`.
**UX:** `docs/UI_UX/26_DOCUMENT_STUDIO_UX.md`, `27_PRESENTATION_STUDIO_UX.md`, `31_TABLES_AND_LISTS.md`.

**Stale do uważania:** `10_dokumenty/SSOT.md` (mówi BLOCKED_P1 na `/wordy`, ale closeout nowszy), `STUDIO_AI_INTEGRATION_ANALYSIS.md` (2026-01, stary), framing Table jako Idea Workspace vs deliverables artifact.

---

## 4. Wizja dokumentów vs rzeczywistość

**Wizja (dokumenty):** jedna platforma artefaktów — chat tworzy → wszystko staje się first-class, source-traceable, wersjonowanym, governed artefaktem w jednym rejestrze, wystawionym w Outputs Library. Trzy silniki: Document Studio (consulting-grade Word/PDF, template-first, QA), Presentation Studio (Gamma-quality ale governed), Table Studio (Airtable/Coda-class). Cel jakości eksportu: "consulting-grade" (BCG/EY/IBM).

**Rzeczywistość:** plumbing i governance są zaawansowane; **rdzeń doświadczenia użytkownika — pisanie dokumentu, edycja komórek na flagowej powierzchni, spójna nawigacja — jest najmniej skończony.** To dziś bardziej "pipeline generacji + governance" niż "edytor dokumentów/arkuszy".

---

## 5. Następne fazy (propozycja)

- **Faza 2 — Gap rynkowy:** porównanie każdego filaru z liderami (Google Docs/Notion/Word; Excel/Sheets/Airtable; PowerPoint/Slides/Gamma/Pitch) → lista konkretnych braków do uzupełnienia.
- **Faza 3 — Plan budowy:** priorytetyzacja (najpierw zamknąć rdzeń: edytor rich-text dokumentu + edytowalny grid na `/tabele` + konsolidacja prezentacji + jeden wpis sidebar/hub), potem governance i polish.

### Top 10 luk do decyzji (wstępnie, przed gapem rynkowym)
1. Document Studio: realny edytor rich-text (WYSIWYG) zamiast read-only preview.
2. Document Studio: AI generuje treść (nie placeholdery) przy tworzeniu.
3. Table Studio: edytowalny grid na `/tabele` (zunifikować z `IdeaTableTool`).
4. Table Studio: realny silnik formuł (zakresy + biblioteka funkcji).
5. Presentation: skonsolidować dwa pipeline'y, usunąć/wpiąć osierocone `/presentation-studio`, usunąć martwy `PresentationsHub.tsx`.
6. Nawigacja: jeden wpis sidebar "Dokumenty/Deliverables" → Outputs Library jako centrum.
7. Lokalizacja PL: uzupełnić brakujące namespace'y i18n.
8. Testy FE na realne edytory.
9. Materializer/konwersje: z stub na live.
10. Komentarze/współpraca real-time spójnie w trzech filarach.
