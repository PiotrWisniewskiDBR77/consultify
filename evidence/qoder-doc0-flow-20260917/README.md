# DOC-0 etap 1 (b) — flow evidence (DEC-593), 2026-09-17

Zrzuty PRZEPŁYWU „lista → otwórz → JEDEN DocumentViewer" z harnessu `dev-render`
(port 5421, pula C), 1440×900, EN, motyw jasny i ciemny przez store aplikacji
(`useAppStore.setState({theme})` + klasa `.dark`), NIE `emulateMedia`.

Ekran harnessu: `dev-render/screens/doc0-document-flow.tsx` (wejście
`dev-render/doc0-document-flow-main.tsx` + `.html`). Montuje PRAWDZIWY
`<OutputsAggregateTabContent />` (rejestr wspólny Materiały, Menu 1 „All") —
ten sam komponent co produkcyjny Hub — z dwoma wierszami dokumentów:
ZATWIERDZONYM (`Digital Roadmap 2026–2028`, `delivery_state=ready`) i szkicem
(`Draft — Q4 operating notes`, `draft`). Flaga ON przez URL
`?ff_doc0_document_viewer=1` (najwyższy priorytet w `documentViewerFlag`).
Treść dokumentu = PRAWDZIWY wiersz stagingu `4d6600e3-…` (org 468b234c),
envelope schwytana produkcyjnym resolverem read-only z lokalnej kopii dumpu
(`dev-render/mocks/doc0-digital-roadmap-envelope.json`). Stubowany jest TYLKO
transport (`window.fetch` dla jednego URL `/api/artifacts/:id/content`).

`case=open` odtwarza PRAWDZIWY gest właściciela: dispatch natywnego `dblclick`
na `<tr>` zatwierdzonego wiersza → `FilterableTable.onDoubleClick` →
`openRow` → `resolveArtifactOpenTarget` (flaga ON + status approved) →
nakładka `DocumentViewer`. Żadnego skrótu, żadnego bezpośredniego `setViewerRow`.

## Co widać na zrzutach (opis słowny)

- `doc0-flow-list-en-light` / `-dark` (`case=list`): tabela rejestru wspólnego
  (StandardTable) z dwoma wierszami. Wiersz 1 „Draft — Q4 operating notes":
  chip statusu **Draft** (szary), Review „Draft", eksport DOCX. Wiersz 2
  „Digital Roadmap 2026–2…": chip statusu **Ready** (zielony), Review
  „Approved", eksporty „DOCX, PDF", właściciel „Daniel O…", data „Sep 8, 2026".
  Kolumny: Presentation · Type · Format · Status · Owner · Visibility · Source ·
  Review · Exports · Date. Nagłówek harnessu („Materials — All (document
  open-flow)") oznaczony `data-dev-render-chrome`, więc nie udaje produktu.
- `doc0-flow-open-en-light` / `-dark` (`case=open`): po podwójnym kliknięciu
  wiersza zatwierdzonego NAKŁADKA read-only DocumentViewer (pełny ekran).
  Nagłówek: tytuł „Digital Roadmap 2026–2028", chipy „Ready" i „Saved",
  przycisk **Edit** (ciemny) i kebab. Lewa nawigacja sekcji: Vision ·
  Roadmap by Horizon · Roadmap by horizon · Investment Summary · Investment
  summary · Risks & Dependencies · Risks & dependencies. Treść: akapit sekcji
  Vision („By the end of 2028, every shopfloor role at Leeds and Rotherham…").
  Prawy panel Properties: Status=Ready, Content registry=**Artifact content**,
  Owner=Daniel Osei, Updated=2026-09-08T14:58:06.124Z; panel Actions z „Edit".
  Szkic NIE otwiera viewera (fail-closed) — tylko wiersz approved.

  UWAGA (uczciwie, poza zakresem tego zlecenia — DEC-607): podwójne wpisy
  nawigacji („Roadmap by Horizon" + „Roadmap by horizon" itd.) to puste
  nagłówki-opakowniki projekcji raportu o TYM SAMYM poziomie co właściwy
  nagłówek; `splitMarkdownIntoSections` celowo je zostawia (komentarz w kodzie:
  „same-level heading after an empty one is a genuinely empty section and
  stays"). Zrzut pokazuje treść TAKĄ, JAKA jest w rejestrze — zero kosmetyki.

## Pomiar (`pomiary.json`)

Każdy zrzut: `consoleErrors=0`, `pageErrors=0`. Kontrast mierzony PIKSELOWO
z surowego PNG (pngjs, histogram luminancji w boksie treści) PRZED kwantyzacją
palety (sharp, pętla jakości do ≤200 KB):
- list light 17.41:1, list dark 18.09:1, open light 19.47:1, open dark 17.34:1
  — wszystkie ≥4.5 (WCAG AA).
Rozmiary: 16.7 / 17.0 / 56.8 / 44.4 KB (wszystkie ≤200 KB).
`overlayPresent`: false dla `case=list`, true dla `case=open`;
`viewerTitle` = „Digital Roadmap 2026–2028" dla obu `case=open`.

## Parytet harnessu

`node scripts/check-dev-render-parytet.mjs --ekran=doc0-document-flow` → CZYSTO
(R1 0 nowych, R2 pominięte jako wariantowe `?case=`). Pełna bramka pokazuje 27
NOWYCH R1/R2, ale IDENTYCZNE 27 występuje na CZYSTEJ linii
`origin/integracja/20260911` (zmierzone w osobnym worktree) — to zastany dryf
linii bazowej vs commit baseline, NIE regresja DOC-0; mój ekran nie figuruje
na liście nowych. Linii bazowej NIE regeneruję (nie uciszam cudzego długu).
