---
brief: notes-notebooks
module: Notes / Notebooks
sources: [Notion API docs (developers.notion.com, scrape 2026-03, model v2025-09-03), Notion Help (notion.com/help, 2026-03), Evernote Help (help.evernote.com, 2026-03), Evernote SDK docs (dev.evernote.com, 2026-03)]
status: done
updated: 2026-06-09
---

# Benchmark: Notes / Notebooks

> Po co: zwalidować i doprecyzować planowany overhaul Notes — nową górną warstwę
> „lista notatników" + typologię personal/team + osobną flagę kontekstu organizacji.
> Notion to wzorzec modelu danych (bloki + hierarchia stron + bazy-w-notatce),
> Evernote to wzorzec prostej typologii (note → notebook → stack + personal/team split).

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature |
|---|---|---|
| **Notion** | „Twój workspace AI" — dokumenty = bloki, wszystko jest stroną | **Block-based editor** + dowolnie zagnieżdżalne strony + **bazy danych w notatce** + Teamspaces |
| **Evernote** | Klasyczny notatnik do przechwytywania i odzyskiwania wiedzy | Prosta, sztywna hierarchia **Note → Notebook → Stack** + Web Clipper + wyszukiwanie |

Wniosek: **Notion = wzorzec architektury** (rekordowy model bloków, parent-polimorfizm,
bazy-jako-strony). **Evernote = wzorzec typologii i onboardingu** — czytelny podział
personal/team i „domyślny prywatny notatnik", którego my potrzebujemy dla flagi org-context.

## 2. Wzorce UX / IA (co działa)

- **Wszystko jest blokiem.** `/` lub `+` → menu bloków; każdy blok ma uchwyt `⋮⋮`
  do drag-and-drop i akcję **„Turn into"** (zamiana typu w miejscu) →
  `assets/notes-notebooks/01-notion-blocks.webp` (adnotowane typy bloków na jednej stronie)
  → *dlaczego działa*: jeden mentalny model, zero „trybów"; treść jest płynna →
  *jak u nas*: Notes/Canvas powinny mieć tę samą gramatykę bloków co edytor czatu (TipTap, patrz `canvas_overhaul`).
- **Sidebar = typologia w 3 sekcjach: Teamspaces / Shared / Private** →
  `assets/notes-notebooks/02-notion-teamspaces.webp` (sekcja Teamspaces + menu zarządzania)
  → *dlaczego działa*: jedna nawigacja koduje własność i widoczność; „Private" to osobisty
  brudnopis, „Shared" to per-page udostępnienia, „Teamspaces" to przestrzenie zespołów →
  *jak u nas*: **to jest dokładnie nasza planowana typologia personal/team** — kradniemy podział sidebara 1:1.
- **Brak folderów — strony w stronach „bez limitu".** Subpage = strona-dziecko; nawigacja
  przez toggle w sidebarze + breadcrumbs u góry; przenoszenie = drag w sidebarze
  (out of parent / into parent). → *jak u nas*: nasza nowa warstwa „lista notatników" powinna
  być cienka (kontener + uprawnienia), a głębsza struktura to zwykłe zagnieżdżanie notatek.
- **Bazy-w-notatce (inline ⇄ full-page).** Tę samą bazę można osadzić w stronie (inline,
  kontrolki ukryte do hovera) albo rozwinąć do pełnej strony (drag do sidebara) →
  `assets/notes-notebooks/03-notion-databases.webp` → *jak u nas*: most do modułu Table/Ideas —
  tabela jako blok wewnątrz notatki, nie osobna wyspa.
- **Evernote: „My Notebook" jako nieusuwalny, nieudostępnialny domyślny notatnik** — miejsce
  „do brudnopisu zanim udostępnisz zespołowi". → *jak u nas*: wzorzec dla **flagi org-context** —
  domyślny prywatny notatnik użytkownika, który nigdy nie wpada do kontekstu organizacji,
  dopóki świadomie nie zostanie oznaczony/przeniesiony.

## 3. Model danych / architektura

**Notion (model v2025-09-03 — kluczowy dla nas):**
- Hierarchia: **Database → (1..n) Data source → (0..n) Page → (0..n) Block**.
  Database = kontener uprawnień; Data source = pojedyncza tabela (schema `properties` + wiersze=strony);
  Page = wiersz/strona z `property values`; Block = atom treści.
- **Parent polimorficzny.** Każda encja ma `parent: { type, id }` gdzie type ∈
  `workspace | page_id | database_id | data_source_id | block_id`. Strona może mieć rodzica
  page/data_source/block/workspace → to daje „strony w stronach bez limitu" przy jednym polu.
- **Block** = `{ object, id, parent, type, has_children, <type>: {...} }`; ~30+ typów
  (`paragraph`, `heading_1/2/3`, `bulleted/numbered_list_item`, `to_do`, `toggle`, `callout`,
  `code`, `quote`, `image`, `table`, `column_list`/`column`, **`synced_block`**, `child_page`,
  `child_database`, …). `synced_block` = ten sam blok renderowany w wielu miejscach.
- **Rekordowy, nie monolityczny** — treść strony to lista bloków (drzewo przez `has_children`),
  pobierana endpointem „Retrieve block children". To samo czego chcemy dla Whiteboard (patrz `whiteboard.md`).
- **Uprawnienia żyją na Database / Teamspace, nie na Data source** — pojedyncze tabele nie mają
  własnych ACL; dostęp dziedziczy się z kontenera. Ważna lekcja: **uprawnienia mocuj do notatnika/teamspace, nie do bloku.**

**Evernote (kontrast — płaski model):**
- **Note → Notebook → Stack** (sztywne 3 poziomy, brak zagnieżdżania notatek w notatkach).
- Treść notatki = **ENML** (podzbiór XHTML, jeden dokument), nie drzewo bloków → brak
  „turn into", brak baz danych. Tagi jako ortogonalna klasyfikacja. **Spaces** = warstwa
  zespołowa grupująca notatki+notatniki dla Enterprise.

→ Dla nas: **bierzemy hierarchię i parent-polimorfizm z Notion** (kontener → notatnik → notatka → blok),
ale typologię/onboarding (personal/team + domyślny prywatny) z Evernote, bo jest prostsza i wprost mapuje na nasz overhaul.

## 4. Współdzielenie / uprawnienia

- **Notion — 4 poziomy per page/group/teamspace:** **Full access** (edycja + udostępnianie),
  **Can edit** (edycja, bez udostępniania), **Can comment**, **Can view**. Granularnie per encja.
- **Teamspace — 3 tryby dostępu:** **Open** (każdy dołącza i widzi), **Closed** (widać, że istnieje,
  ale wejście za zaproszeniem), **Private** (niewidoczny dla nieczłonków; Business/Enterprise).
- **General access** strony: „Only people invited" / „Everyone at workspace" (+ Hide in search) /
  „Anyone on the web with link" (z opcją wygaśnięcia linku). **Guests** = osoby spoza workspace, per-page.
- **Domyślny teamspace** = wszyscy w workspace są w nim automatycznie (wzorzec „wszyscy w org").
- **Evernote:** udostępnianie per-notatnik / per-Space; konto **dzieli się na Individual vs Team**
  (przełączasz kontekst), a `My Notebook` jest twardo prywatny.

→ Dla nas: **3 tryby teamspace (Open/Closed/Private) to gotowy wzorzec** dla naszej typologii team-notebook;
**4 poziomy uprawnień** to nasz docelowy zestaw ról na notatnik. Flaga org-context ≈ Notion „default teamspace" + Evernote „przełącz Individual/Team".

## 5. Decyzje dla Consultify

- ✅ **Kradniemy:** sidebar-typologię **Private / Shared / Teamspaces** jako fizyczny kształt naszej
  warstwy „lista notatników" + personal/team — to potwierdza i finalizuje plan overhaulu.
- ✅ **Kradniemy:** **parent polimorficzny** (`parent: {type,id}`) + rekordowy model bloków (notatka = drzewo bloków),
  i regułę **„uprawnienia na notatniku/teamspace, nie na bloku/wierszu"**.
- ✅ **Kradniemy:** 4 poziomy dostępu (Full/Edit/Comment/View) + 3 tryby przestrzeni (Open/Closed/Private)
  jako gotowy słownik ról dla team-notebooków.
- ⚠️ **Adaptujemy:** flagę **org-context** jako hybrydę „default teamspace" (Notion) + nieusuwalny
  prywatny `My Notebook` (Evernote) — domyślnie prywatne, świadome promowanie do kontekstu org.
- ⚠️ **Adaptujemy:** bazy-w-notatce — w v1 jako most do istniejącego modułu Table (tabela jako blok),
  nie pełny silnik baz danych Notion (relations/rollups/views to osobny, późniejszy zakres).
- ❌ **Unikamy:** monolitycznej treści notatki (ENML-owy jeden dokument) — zabija „turn into",
  zagnieżdżanie i granularny realtime/undo. Treść = lista bloków.
- ❌ **Unikamy:** sztywnych 3 poziomów Evernote (Note/Notebook/Stack bez zagnieżdżania) — nasza warstwa
  notatników ma być cienkim kontenerem nad dowolnie zagnieżdżalnymi notatkami, nie kolejną sztywną klatką.
- ❌ **Unikamy:** ACL per-blok/per-wiersz (Notion świadomie tego nie robi) — komplikacja bez ROI.

## 6. Otwarte pytania / do walidacji

- Czy nasza „lista notatników" = 1 poziom kontenerów (jak Evernote Stack), czy n-poziomów (jak Notion)?
  Rekomendacja z benchmarku: cienki kontener-notatnik + zagnieżdżanie notatek pod spodem.
- Czy flaga org-context jest na notatniku, czy na pojedynczej notatce? (Notion: na teamspace; Evernote: na koncie). Rekomendacja: na notatniku, z dziedziczeniem.
- Czy w v1 wprowadzamy `synced_block` (jeden blok w wielu miejscach)? Świetne dla powtórzeń (np. wspólny brief), ale komplikuje model.
- Mapowanie ról team-notebook na nasz istniejący RBAC (org admin/owner/member) — czy 4 poziomy Notion nakładamy 1:1, czy redukujemy do 3?

## Załączniki
Zrzuty (real product UI) w `assets/notes-notebooks/`:
`01-notion-blocks.webp` (adnotowane typy bloków), `02-notion-teamspaces.webp` (sidebar Teamspaces + menu),
`03-notion-databases.webp` (baza-w-notatce). Surowe źródła (do usunięcia po akceptacji):
`Softs/0 Notatki/Notion dev.zip`, `Notion help.zip`, `evernote dev.zip`, `evernote help.zip`.

Uwagi o źródłach: **Notion dev** (developers.notion.com) — bardzo bogate, statyczny HTML, czytelny model danych v2025-09-03 (database/data-source/page/block/parent). **Notion help** — bogaty, ale HTML JS-renderowany; tekst wyłuskany regexem z `<p>/<li>` (textutil zwracał pustkę). **Evernote help** — użyteczny dla typologii (Spaces, account notebook, individual/team). **Evernote dev** (dev.evernote.com) — landing JS-renderowany, cienki; model ENML/Note/Notebook uzupełniony wiedzą własną.
