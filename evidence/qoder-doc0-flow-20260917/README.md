# DOC-0 etap 1 (b) v2 — flow evidence (DEC-593), 2026-09-17

Zrzuty PRZEPŁYWU „lista → otwórz → JEDEN DocumentViewer" z harnessu `dev-render`
(port 5421, pula C), 1440×900, EN, motyw jasny i ciemny przez store aplikacji
(`useAppStore.setState({theme})` + klasa `.dark`), NIE `emulateMedia`.

## v2 (Wpis 87 P2) — lista w REALNYM Hubie, nie izolowana tabela

Wpis 86/P2 odrzucił zrzuty listy jako „izolowany StandardTable z ręcznym
nagłówkiem i podpisem debugowym na pustym tle, bez powłoki Huba". v2 montuje
DOKŁADNIE to, co montuje `AppRoutes` dla `ROUTES.PRESENTATIONS`
(`AppRoutes.tsx:2814`): `<MainLayout breadcrumbs noPadding>` →
`<ReportsAndPresentationsHub />`. Dzięki temu na zrzucie listy widać PRAWDZIWĄ
powłokę: lewy rail ikon (`Sidebar`, `fixed z-[60]`), górny pasek z okruszkiem
„Materials" i awatarem, Menu 1/2/3 huba (All · Documents · Presentations ·
Sheets · Template Library), chipy filtrów (All 2 · Document 2 · Presentation 0 ·
Sheet 0), filtry Status/Visibility, przycisk „New material" i PRAWDZIWY
`StandardTable` rejestru wspólnego. Żadnego ręcznego nagłówka ani podpisu
debugowego — harness nie dokłada własnego chrome.

Ekran harnessu: `dev-render/screens/doc0-document-flow.tsx` (wejście
`dev-render/doc0-document-flow-main.tsx` + `.html`). Lista czyta PRAWDZIWY
read-model rejestru (`useArtifactOutputsList` → `GET /api/artifacts?limit=200` →
`mapRegistryItemToUnified`) z dwoma wierszami dokumentów: ZATWIERDZONYM
(`Digital Roadmap 2026–2028`, `delivery_state=ready`) i szkicem
(`Draft — Q4 operating notes`, `draft`). Flaga ON przez URL
`?ff_doc0_document_viewer=1` (najwyższy priorytet w `documentViewerFlag`).
Treść dokumentu = PRAWDZIWY wiersz stagingu `4d6600e3-…` (org 468b234c),
envelope schwytana produkcyjnym resolverem read-only z lokalnej kopii dumpu
(`dev-render/mocks/doc0-digital-roadmap-envelope.json`).

Stubowany jest TYLKO transport (`window.fetch`): (1) envelope dla jednego URL
`/api/artifacts/:id/content`, (2) dwa wiersze rejestru dla listy, (3) benigniczna
pusta koperta 200 dla pozostałych `/api/*` (OrgContext `/api/organizations/current`
i shell `/api/v8/admin/flags` sięgają po surowe `fetch`; bez tego harness loguje
404 i `bledyKonsoli≠0`). `/locales/**` i wszystko poza `/api` idzie prawdziwym
`fetch` do vite. Dodatkowo ekran ustawia dwa produkcyjne klucze localStorage,
żeby powłoka zachowała się jak POWRACAJĄCY użytkownik: klucz ukończonego
onboardingu (`doneKey`, inaczej MainLayout otwiera modal „Meet Teresa" krok 1/3)
oraz `STORY_RAIL_DISMISSED_KEY` (inaczej demo-coach-mark „Start the tour"
przesłania dół Huba).

`case=open` odtwarza PRAWDZIWY gest właściciela: dispatch natywnego `dblclick`
na `<tr>` zatwierdzonego wiersza → `FilterableTable.onDoubleClick` →
`openRow` → `resolveArtifactOpenTarget` (flaga ON + status approved) →
nakładka `DocumentViewer`. Żadnego skrótu, żadnego bezpośredniego `setViewerRow`.

## Co widać na zrzutach (opis słowny)

- `doc0-flow-list-en-light` / `-dark` (`case=list`): pełna powłoka Huba (rail +
  górny pasek + Menu 1/2/3 + filtry) i tabela rejestru wspólnego (StandardTable)
  z dwoma wierszami. Wiersz 1 „Draft — Q4 operating notes": chip statusu
  **Draft** (szary), Review „Draft", eksport DOCX. Wiersz 2 „Digital Roadmap
  2026–2…": chip statusu **Ready** (zielony), Review „Approved", eksport DOCX,
  właściciel „Daniel …", data „Sep 8, 2026". Kolumny: Presentation · Type ·
  Format · Status · Owner · Visibility · Source · Review · Exports · Date.
- `doc0-flow-open-en-light` / `-dark` (`case=open`): po podwójnym kliknięciu
  wiersza zatwierdzonego PEŁNOEKRANOWA nakładka read-only DocumentViewer
  (przykrywa rail — patrz niżej `z-[70]`). Nagłówek: strzałka wstecz, tytuł
  „Digital Roadmap 2026–2028", chipy „Ready" i „Saved", przycisk **Edit** i
  kebab. Lewa nawigacja sekcji: **CZTERY** wpisy — Vision · Roadmap by Horizon ·
  Investment Summary · Risks & Dependencies (bez duplikatów, patrz niżej).
  Treść: akapit sekcji Vision („By the end of 2028, every shopfloor role at
  Leeds and Rotherham…"). Prawy panel Properties: Status=Ready, Content
  registry=**Artifact content**, Owner=Daniel Osei,
  Updated=2026-09-08T14:58:06.124Z; panel Actions z „Edit". Szkic NIE otwiera
  viewera (fail-closed) — tylko wiersz approved.

## Naprawy v2 poza samymi zrzutami

- **Deduplikacja nawigacji sekcji (Wpis 87 P2#2).** `splitMarkdownIntoSections`
  zwracał osobne wpisy dla nagłówków różniących się TYLKO wielkością liter po
  trimie („Roadmap by Horizon" + „Roadmap by horizon" itd.), bo pusty
  nagłówek-opakownik projekcji raportu siedzi na tym samym poziomie co właściwy
  nagłówek. v2 scala sekcje o identycznym tytule (case-insensitive, po trimie)
  w JEDEN wpis nawigacji, łącząc ich treść w kolejności dokumentu — wybrano
  scalanie zamiast numerowania („Roadmap by Horizon (2)"), bo duplikaty to
  jeden logiczny blok rozdarty na pusty opakownik i właściwą treść, a numerki
  sugerowałyby właścicielowi dwie różne sekcje. Test:
  `src/components/documents/__tests__/documentContentResolver.test.ts`
  (18/18) + dowód mutacyjny (przywrócenie duplikatów → czerwono).
- **`z-[70]` nakładki viewera (Wpis 87, zmierzone w realnym Hubie).** Nakładka
  DEC-593 była `fixed inset-0 z-50`, a globalny `Sidebar` jest `fixed … z-[60]`,
  więc rail malował się NAD „pełnoekranowym" viewerem i ucinał pierwsze znaki
  lewej nawigacji sekcji („Vision" → „ision"). Podniesiono do `z-[70]` — ta sama
  wartość co pełnoekranowy overlay w `ReportBuilder/TemplatesManager.tsx:761`;
  toasty (100) i menu kontekstowe (120) zostają nad nim.

## Uruchomienie CLI backfillu (Wpis 87 P1) — wymaga `MOCK_DB=false`

`server/scripts/doc0-registry-backfill.ts` bez `MOCK_DB=false` pod
`NODE_ENV=test` milcząco korzysta z mocka i zwraca 0/0 (fałszywy sukces).
Poprawny runbook na lokalnej kopii dumpu:

```
MOCK_DB=false NODE_ENV=test DATABASE_URL=postgres://postgres:qoder@127.0.0.1:6621/consultify_qoder \
  npx tsx server/scripts/doc0-registry-backfill.ts --apply   # lub --restore / dry-run
```

Dowód end-to-end na kopii dumpu: `dump-proof-v2.log` (dry-run 119/6/0 →
apply#1 119+6, log merged 6 → apply#2 0/0, log NADAL merged 6 → restore=6 →
dry-run `archivedByDoc0=0`).

## Pomiar (`pomiary.json`)

Każdy zrzut: `consoleErrors=0`, `pageErrors=0`. Kontrast mierzony PIKSELOWO
z surowego PNG (pngjs, histogram luminancji w boksie treści) PRZED kwantyzacją
palety (sharp, pętla jakości do ≤200 KB):
- list light 17.41:1, list dark 18.09:1, open light 18.15:1, open dark 16.86:1
  — wszystkie ≥4.5 (WCAG AA).
Rozmiary: 28.0 / 24.7 / 42.7 / 40.1 KB (wszystkie ≤200 KB).
`overlayPresent`: false dla `case=list`, true dla `case=open`;
`viewerTitle` = „Digital Roadmap 2026–2028" dla obu `case=open`;
`viewerNavLabels` = 4 wpisy (bez duplikatów) dla obu `case=open`.

## Parytet harnessu

`node scripts/check-dev-render-parytet.mjs --ekran=doc0-document-flow` → CZYSTO
(R1 0 nowych, R2 pominięte jako wariantowe `?case=`). Pełna bramka pokazuje 27
NOWYCH R1/R2, ale IDENTYCZNE 27 występuje na CZYSTEJ linii
`origin/integracja/20260911` (zmierzone w osobnym worktree) — to zastany dryf
linii bazowej vs commit baseline, NIE regresja DOC-0; mój ekran nie figuruje
na liście nowych. Linii bazowej NIE regeneruję (nie uciszam cudzego długu).
