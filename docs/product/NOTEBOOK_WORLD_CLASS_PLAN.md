# M04 Notatnik → world-class — PLAN WYKONAWCZY

> Cel: doprowadzić notes do poziomu najlepszych (Notion/Craft/Obsidian/Linear/Google Docs),
> przy zachowaniu Waszego wyróżnika: **notes AI-native, który zamienia notatkę w pracę**
> (task/decyzja/inicjatywa/output) i karmi Teresę.
>
> Data: 2026-06-20 · Autor: CTO (Claude) · SSOT struktury: `docs/product/NOTEBOOK_STRUCTURE_SSOT.md`
> Stan bazowy zweryfikowany w kodzie (ścieżki niżej są realne).
>
> **Estymata:** S ≤0,5 dnia · M 1–2 dni · L 3–5 dni · XL >5 dni (1 dev).
> **DoD każdego taska:** kod + test (unit lub E2E w `tests/e2e/m04-notebook/`) + zweryf. live (light+dark) + i18n PL/EN przez `t()`.

## Stan bazowy (co JUŻ jest — nie budujemy od zera)
- Edytor TipTap: `src/components/MyWork/notebook/extensions.ts`, `NotebookContent.tsx` (2986 l. — **monolit, ryzyko regresji**), `SlashMenu.tsx` (433 l.).
- TipTap zainstalowane: starter-kit, table(+cell/header/row), task-item/list, highlight, link, underline, text-align, text-style, color, placeholder. **Brak:** image, code-syntax-highlight, mention, math.
- Slash: h1-3, bullet/ordered/todo, callout, warning, toggle, divider, table, code, AI (ask/expand/challenge/action), create-task/decision, save-as-idea.
- Prawy rail: `NotebookRightRail` (Praca: Insert/AI/Convert×7/Transform · Kontekst: backlinks/outputs `NotebookContextPanel`).
- `NotebookProgressChip` (①Źródła②AI③Review④Konwertuj), `CommandPalette.tsx` (681 l. — istnieje, do dopięcia).
- Markdown: `notebookContentToMarkdown` (w `notebookExpandToDocument.ts`) — **reużywalny do eksportu**.
- Search/RAG: kod + migracja FTS `server/migrations/627_notebook_fts_v4_note03.ts` **istnieją**; `search_vector` **nie zaaplikowany na staging** → naprawa = aplikacja migracji.
- Real-time: `server/src/gateways/ideaCollabWs.gateway.ts` + `src/components/MyWork/whiteboard/useWhiteboardCollab.ts` — **wzorzec collab org-scope do adaptacji**.
- Testy: `tests/e2e/m04-notebook/` (49 PASS) + unit notebook (73+76) — rozszerzamy per task.

---

## FAZA 0 — Fundament + szybkie „pro" (P0, niskie ryzyko)
*Cel: natychmiastowy skok „premium feel" + odblokowanie search. Brak zależności między sobą → można równolegle.*

| # | Task | Pliki | Est. | DoD / test | Ryzyko |
|---|------|-------|:--:|------|------|
| 0.1 | **Typografia edytora Craft-grade** — max-width treści ~680px, line-height, hierarchia H1-3, reading mode | `NotebookContent.tsx` (klasy edytora), `index.css`/tokeny | M | screeny light+dark; brak zmian zachowania | niskie |
| 0.2 | **Cover image + icon picker** — okładka notatki + picker emoji/ikon (dziś goła rakieta) | `NotebookContent.tsx` (header), nowy `notebook/NoteCoverPicker.tsx`; migracja kol. `cover_url` + endpoint PUT page | L | upload/wybór coveru trwa po reload (E2E); DB `cover_url` | śr. (migracja) |
| 0.3 | **Empty / skeleton / error states** — biblioteka i edytor (mignięcia loadingu widoczne przy reload) | `NotebookLibraryContent.tsx`, `NotebookContent.tsx` | M | brak „pustego białego" w trakcie load; screeny stanów | niskie |
| 0.4 | **Uspokojenie palety** — czerwień TYLKO destrukcja/błąd; akcent neutralny; tokeny `c.*`/`EntityStatusChip` zamiast hex | `notebook/*`, kanon `docs/ui-standards/CANON.md` | M | grep hex=0 utrzymany; audyt kontrastu WCAG AA dark | śr. (spójność) |
| 0.5 | **Naprawa search/RAG na env** — zaaplikować migrację FTS `search_vector` na staging/demo; potwierdzić §10.2/§10.3 zielone | `server/migrations/627_notebook_fts_v4_note03.ts`, deploy runner | S–M | E2E §10.2/§10.3 z SKIP→PASS; brak 500 | śr. (infra/DB) |

**Wynik Fazy 0:** moduł „wygląda i czyta się premium", search działa. ~1 tydzień.

---

## FAZA 1 — Edytor PRO (media + bogaty slash)
*Zależność: po 0.1 (typografia). Największy wizualny przeskok funkcjonalny.*

| # | Task | Pliki / pakiety | Est. | DoD / test | Ryzyko |
|---|------|-------|:--:|------|------|
| 1.1 | **Obrazy w treści** — drag-drop/paste/upload inline, resize | +`@tiptap/extension-image`; `extensions.ts`, `NotebookContent.tsx`; reuse upload `/notebook/pages/:id/attachments` | L | wklejony obraz zapisany w content_json + po reload (E2E) | śr. |
| 1.2 | **Bookmark / link-preview** — wklejony URL → karta z tytułem/opisem/faviconem | nowy node + serwer unfurl endpoint `notebook.routes.ts` | L | URL→karta; fallback goły link | śr. |
| 1.3 | **Code block z syntax-highlight** — wybór języka | +`@tiptap/extension-code-block-lowlight`+`lowlight`; `extensions.ts` | M | podświetlenie + wybór języka; istniejące `code` migruje | niskie |
| 1.4 | **Rozszerzony slash** — image, quote(blockquote), `/date`, columns (2-3), math (KaTeX), `@mention` | `SlashMenu.tsx` (+ nowe nody); +`@tiptap/extension-mention`, KaTeX | L | każdy nowy blok w E2E §3 (wstawienie + persist) | śr. |
| 1.5 | **Refactor NotebookContent (de-monolit)** — wydzielić edytor/hooki z 2986-l. pliku przed dalszą rozbudową | `NotebookContent.tsx` → `notebook/useNotebookEditor.ts` itd. | L | testy notebook bez regresji (73+76 zielone) | **wysokie** (zrobić z testem nieregresji najpierw) |

**Wynik Fazy 1:** edytor dorównuje Notion/Craft w bogactwie treści. ~1,5–2 tygodnie.

---

## FAZA 2 — Współpraca (największy wyróżnik „pro")
*Zależność: po 1.5 (stabilny, wydzielony edytor). Adaptacja istniejącego collab Ideas.*

| # | Task | Pliki | Est. | DoD / test | Ryzyko |
|---|------|-------|:--:|------|------|
| 2.1 | **Presence** — kto otwarty/edytuje (awatary) | adapt `ideaCollabWs.gateway.ts` → `notebookCollabWs`; FE `useNotebookCollab.ts` (wzór `useWhiteboardCollab.ts`) | L | 2 sesje widzą się; org-scope | śr. |
| 2.2 | **Real-time treści (CRDT)** — koniec last-write-wins (ryzyko N-1 clobber udokumentowane) | Yjs + `@tiptap/extension-collaboration`; gateway y-websocket | XL | brak utraty przy równoczesnej edycji (E2E 2-context) | **wysokie** |
| 2.3 | **Komentarze w marginesie + tryb sugestii** — wątki, resolve, @mention z powiadomieniem | nowy `notebook_comments` (migracja+routes), FE panel | XL | komentarz trwały, resolve, powiadomienie | wysokie |

**Wynik Fazy 2:** poziom Google Docs/Notion w pracy zespołowej. ~3–4 tygodnie. *(Decyzja Piotra: czy v1 czy v1.1)*

---

## FAZA 3 — Wiedza i przepływ (Wasz prawdziwy moat)
| # | Task | Pliki | Est. | DoD / test | Ryzyko |
|---|------|-------|:--:|------|------|
| 3.1 | **Eksport** — PDF / Markdown / Word / kopiuj-jako-MD | reuse `notebookContentToMarkdown`; +PDF (jsPDF/serwer), DOCX (reuse report pipeline) | M | eksport każdego formatu z treścią notatki | niskie |
| 3.2 | **„Zapytaj swoje notatki" (RAG UX)** — po 0.5; UI nad search | `NotebookContextPanel`/nowy panel; backend `/rag-context` | M | odpowiedź z cytatami do źródeł | śr. |
| 3.3 | **Graf powiązań** — wizualny graf backlinks/outputs (dane są w Kontekst, brak wizualizacji) | nowy `notebook/NotebookGraphView.tsx` (reuse react-flow z Ideas) | L | graf renderuje powiązania notatki | śr. |
| 3.4 | **Version history + diff + restore** | migracja `notebook_page_versions`, routes, FE timeline | L | przywrócenie wersji; diff | śr. |
| 3.5 | **Capture→Insight auto** — po imporcie: auto-podsumowanie + auto-tagi + „zaproponuj akcje" | `notebook.routes.ts` capture + classify/extract | M | import → gotowe akcje/tagi | niskie |

**Wynik Fazy 3:** notes jako inteligentny hub wiedzy konsultanta. ~2–3 tygodnie.

---

## FAZA 4 — Szlif i klawiatura-first
| # | Task | Pliki | Est. | DoD |
|---|------|-------|:--:|------|
| 4.1 | **Command palette dopięty** — Cmd+K: skok do notatki, akcje, wstaw blok | `CommandPalette.tsx`, `NotebookContent.tsx` | M | Cmd+K nawiguje+działa |
| 4.2 | **Skróty + a11y** — Cmd+S/Cmd+Enter, focus-trap modali, ARIA, kontrast | `notebook/*` | M | audyt a11y AA; skróty działają |
| 4.3 | **i18n `t()` (dług L-11, ~200 ternarów)** — migracja z inline-ternar | `NotebookContent.tsx`+`notebook/*`, `public/locales` | L | 0 inline-ternar; PL/EN przez `t()` |
| 4.4 | **Mikro-animacje** — rail, hover, slash fade, toast | `notebook/*` | S | płynne przejścia |
| 4.5 | **Review cadence aktywny** — przypomnienia + widok „do przeglądu" | `notebook.routes.ts`, FE | M | przypomnienie po terminie |
| 4.6 | **IDE-tabs (DP-2)** — notatka jako globalny dok przy każdym module | powłoka `RightRail`/`MainLayout` | XL | notatka przeżywa moduł (rozszerza L-02) |

---

## Kolejność rekomendowana (krytyczna ścieżka)
1. **Faza 0** (równolegle, ~1 tydz.) — fundament + search. **Start tutaj.**
2. **1.5 refactor** (przed resztą Fazy 1 — inaczej każdy task grzęźnie w monolicie 2986 l.).
3. **Faza 1** (media/slash) — widoczny przeskok funkcjonalny.
4. **Faza 3.1/3.2/3.5** (eksport, RAG, capture-auto) — tanie, wysokowartościowe, niezależne.
5. **Faza 2** (współpraca) — duża, decyzja v1 vs v1.1.
6. **Faza 4** — szlif + dług i18n + IDE-tabs.

## Suma zgrubna
Faza 0 ~5 dni · Faza 1 ~9 dni · Faza 2 ~18 dni · Faza 3 ~11 dni · Faza 4 ~14 dni.
**MVP „world-class odczuwalne" = Faza 0 + 1 + 3.1/3.2 ≈ 3 tygodnie.** Pełnia (z współpracą) ≈ 9–10 tygodni (1 dev).

## Decyzje dla Piotra
- **D-A:** Współpraca real-time (Faza 2) w v1 czy v1.1? (XL, najdroższa).
- **D-B:** Eksport — które formaty priorytet (PDF? Word? oba)?
- **D-C:** Czy 1.5 (de-monolit NotebookContent) robimy — rekomendacja: TAK przed Fazą 1 (inaczej dług rośnie).
- **D-D:** Migracja i18n L-11 (4.3) — teraz w tym planie czy osobna fala i18n programu?
