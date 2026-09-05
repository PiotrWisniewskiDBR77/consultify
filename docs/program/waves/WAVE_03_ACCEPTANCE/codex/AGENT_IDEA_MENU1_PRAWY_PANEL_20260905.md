# Idea Menu 1 → prawy panel (naprawa, 2026-09-05)

Gałąź: `agent/idea-menu1-prawy-panel-20260905` (baza: `m03` @ `1cea82c7c0`)
Worktree: `/private/tmp/ag-idea-menu1`
Commit naprawy: `2d89ebb429c5e643f5138a1e1581a7063bd94f39`

Zlecenie: `evidence/odbior-zywo-20260905/RUNDA2_RAPORT.md` (linia „`IdeaRightPanel`
to kod martwy" — id `ideas-teresa-panel` w `02-moja-praca/wyniki.json`, plus
`mywork-idea-inspector-lekki` i `idea-confidentiality-control`). Ekrany: Moja
Praca → Pomysły → otwarta idea jako kanwa → trzy ikony Menu 1 (Narzędzia /
Kontekst i powiązania / Sugestie AI).

---

## 1. Pomiar — który komponent obsługuje kliknięcia i dlaczego panel nie znika, a **nigdy się nie pojawia**

- **Menu 1 (trzy ikony)** to `WorkspacePanelStrip` (`src/components/shared/WorkspacePanelStrip.tsx`)
  zamontowany w `MyWorkHub.tsx:4657` dla `activeTab === 'ideas' && activeDocumentId`.
  Kliknięcie woła `handleIdeaPanelChange` → `setIdeaActivePanel`/`activeIdeaWorkspaceState`,
  które `MyWorkHub.tsx:3954` przekazuje do `<IdeaMapWorkspace activePanel=… onActivePanelChange=…>`.
  **To działa poprawnie** — stąd raport widział ikony „podświetlające się": stan
  `activePanel` faktycznie się zmienia.
- W `IdeaMapWorkspace.tsx` `activePanel` (prop `externalActivePanel`) zasila
  `toolsPanelOpen`/`contextPanelOpen`/`aiPanelOpen` (linie ~1476-1478) — też
  poprawnie.
- **Defekt**: jedyny montaż `<IdeaRightPanel>` (accordion `ArtifactRightPanel`,
  sekcje Akcje/Właściwości/Powiązania/Komentarze/Historia) siedział w
  `renderWorkspaceSiblings()` pod warunkiem `!melsCanvasEnabled && (toolsPanelOpen
  || contextPanelOpen || aiPanelOpen)`. `melsCanvasEnabled` (linia ~3655) to
  **stała `true` przybita na sztywno** — komentarz obok mówi wprost „the
  canonical Ideas shell is no longer feature-gated". Renderowanie idei zawsze
  wchodzi w gałąź `if (melsCanvasEnabled) { return (…) }` (`IdeaCanvasMelsView`
  + MELS), która **returnuje wcześniej** i nigdy nie dochodzi do drugiego,
  identycznie wyglądającego `return (…)` niżej w pliku (legacy, `!melsCanvasEnabled`)
  — ten drugi blok, WŁĄCZNIE z jedynym montażem `IdeaRightPanel`, jest w 100%
  martwym kodem od momentu, gdy `melsCanvasEnabled` przestało być flagą.
- Co miało się otworzyć: `IdeaRightPanel` (kanoniczny `ArtifactRightPanel`
  accordion) z sekcją `properties` (ikona Narzędzia → `<IdeaWorkspaceTools embedded>`,
  tu żyje m.in. pigułka poufności E12/RISK-22), `relations` (ikona Kontekst i
  powiązania → `<IdeaContextPanel embedded>`) i `teresa`/Akcje (ikona Sugestie AI
  → `<IdeaTeresaSection>` — komendy + przycisk „Rozmawiaj z Teresą", **nigdy**
  bespoke czat na szynie, zgodnie z decyzją właściciela 01.09 „jedna Teresa, w
  swoim oknie").
- MELS ma WŁASNĄ, osobną, ŻYWĄ szynę sześciu paneli (`melsCanvasRightRailTools`
  + `renderMelsCanvasRightRailPanel`, renderowaną po LEWEJ stronie płótna via
  `inspectorRailSide="left"`) plus lekki inspektor elementu (`elementInspectorRail`,
  `IdeaElementInspector`, po PRAWEJ) — **oba działają** (stąd raport odnalazł
  realny lekki inspektor i sześć paneli MELS przy klikaniu węzła/szyny). To
  jest inny, równoległy mechanizm niż Menu 1 — nietknięty tą naprawą.

## 2. Naprawa

`src/components/MyWork/IdeaMapWorkspace.tsx`:

1. Wydzielono `function renderIdeaRightPanel(): React.ReactNode` — identyczna
   treść/kontrakt panelu co wcześniej (ten sam `<IdeaRightPanel>`, te same
   propsy `propertiesContent`/`relationsContent`/`teresaContent`/`onExport`/
   `onConvert`/`onDiscussWithTeresa`/`teresaCommands`/`aiSuggestionsContent`),
   ale bramkowana WYŁĄCZNIE stanem Menu 1 (`toolsPanelOpen || contextPanelOpen
   || aiPanelOpen`) — **bez** `melsCanvasEnabled`.
2. W żywej gałęzi `if (melsCanvasEnabled)` panel montuje się teraz jako
   WŁAŚCIWA kolumna obok płótna: opakowano `canvasContainerRef` (dotąd
   bezpośrednie dziecko kontenera `flex-col`) razem z `{ideaRightPanelNode}`
   w nowy wiersz `flex` (`<div className="flex flex-1 min-w-0 min-h-0
   overflow-hidden">`). **Nie** zamontowano panelu przez `siblings` (ten sam
   kontener co modale/dialogi eksportu/szablonów) — `siblings` renderuje się
   w kontenerze `flex-col` (pion), więc `<aside>` panelu wylądowałby POD
   płótnem zamiast OBOK niego.
3. `renderWorkspaceSiblings()` (legacy, dziś nieosiągalna gałąź) woła teraz
   `renderIdeaRightPanel()` zamiast duplikować treść — DRY, zero zmiany
   zachowania (dalej martwy kod, ale spójny z żywą ścieżką, gdyby kiedyś
   `melsCanvasEnabled` znów stało się flagą).

Efekt: kliknięcie dowolnej z trzech ikon Menu 1 w otwartej idei montuje
`IdeaRightPanel` z właściwą sekcją otwartą — Narzędzia → Właściwości
(pigułka poufności E12, jeśli `confidentialitySupported` z API), Kontekst i
powiązania → Powiązania, Sugestie AI → Akcje (Teresa: przycisk-wejście +
komendy, strumień sugestii AI). Lekki inspektor elementu (MELS) i sześć
paneli szyny MELS **nietknięte** — dalej dostępne równolegle, jak przed
naprawą.

## 3. Testy — RTL + dowód mutacyjny

| Plik | Co sprawdza | Wynik |
|---|---|---|
| `src/components/standard/__tests__/IdeaRightPanel.menu1Sections.test.tsx` | RTL: `activeSection="properties"/"relations"/"teresa"` otwiera właściwą kartę i pokazuje jej treść (pozostałe karty NIE są w DOM); Eksportuj/Konwertuj klikalne i wywołują realne handlery; brak `onExport`/`onConvert` → brak przycisków-widm; brak `role="textbox"` w trybie Teresa (kanon: przycisk-wejście, nie bespoke czat) | 5/5 PASS |
| `src/components/MyWork/__tests__/IdeaMapWorkspace.menu1RightPanel.ownerFeedback.test.ts` | Source-contract (plik zbyt duży/stanowy na pełny mount, wzorzec `IdeaMapWorkspace.candidateGate.ownerFeedback.test.ts`): `renderIdeaRightPanel()` istnieje i bramkuje WYŁĄCZNIE stanem Menu 1 (bez `melsCanvasEnabled`); zgłoszony martwy wzorzec `!melsCanvasEnabled && (...) && (() => {` już nie istnieje; `ideaRightPanelNode` liczone i renderowane WEWNĄTRZ żywej gałęzi `melsCanvasEnabled` (przed startem martwej gałęzi legacy); panel siedzi w wierszu `flex` obok płótna, nie w warstwie `siblings` | 6/6 PASS |

**Dowód mutacyjny**: skopiowano plik `IdeaMapWorkspace.tsx` sprzed naprawy
(`git show HEAD` na bazowym SHA) na miejsce naprawionego, uruchomiono
`IdeaMapWorkspace.menu1RightPanel.ownerFeedback.test.ts` → **6/6 FAIL**
(dokładnie te warunki, które naprawa wprowadza, nie istniały w kodzie
sprzed naprawy). Przywrócono naprawiony plik → 6/6 PASS ponownie
potwierdzone.

```
npx vitest run src/components/standard/__tests__/IdeaRightPanel.menu1Sections.test.tsx                     # 5 passed
npx vitest run src/components/MyWork/__tests__/IdeaMapWorkspace.menu1RightPanel.ownerFeedback.test.ts       # 6 passed
bash scripts/check-artefakt.sh                                                                               # exit 0, brak nowych naruszeń crimson (8 vs baseline 9)
bash scripts/check-list-canon.sh                                                                             # exit 0, brak nowych naruszeń (staged: 0 nowych)
npx esbuild <oba pliki źródłowe zmienione + oba testy> --bundle=false --loader:.tsx=tsx                      # OK, zero błędów składni
```

Pełny `tsc`/`vitest` całego repo NIE uruchamiany (zakaz robotnika) — testy
tylko wskazanych plików, esbuild per plik.

## 4. Zrzuty PO — NIE WYKONANE (sesja ODBIOR_AUTH_STATE nie istnieje)

Próba: własny `vite --port 3096 --strictPort` (kopia `.env.local` z `m03`),
`scripts/dev/odbior-zywo/zrzut.mjs` z `ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json`.

- `/private/tmp/odbior-auth/` istnieje (zrzuty innych agentów z dzisiaj), ale
  **plik `auth.json` nie istnieje** — tylko sidecar `.png.json` innych zrzutów.
  `zrzut.mjs` odmawia od razu (`Wymagane: --out oraz ODBIOR_AUTH_STATE
  (istniejący plik)`), zanim w ogóle spróbuje nawigacji.
- To ten sam, już udokumentowany dziś blokier co w
  `AGENT_KANON_KARTY_KALENDARZ_20260905.md` §3 („sesja ODBIOR_AUTH_STATE
  martwa") — tam plik jeszcze istniał, ale token był wygasły; u mnie pliku
  już nie ma wcale (prawdopodobnie posprzątany albo nigdy nie odtworzony po
  tamtym zgłoszeniu). Odnowienie wymaga ręcznego logowania właściciela
  (`node scripts/dev/odbior-zywo/zaloguj.mjs` otwiera okno i czeka na hasło
  Piotra) — nie mogę tego zrobić za niego.
- Własny vite (port 3096) wystartował poprawnie i został zatrzymany po
  próbie (`pkill -f "vite --port 3096"`, tylko mój proces) — zero
  pozostawionych procesów.

**Do zrobienia przez nadzorcę/Piotra**: odśwież `/private/tmp/odbior-auth/auth.json`
(`node scripts/dev/odbior-zywo/zaloguj.mjs`), potem zrzuty PO na porcie 3096+ dla
otwartej idei (Moja Praca → Pomysły → dowolna idea → workspace mindmap) z
każdą z trzech sekcji Menu 1 otwartą (Narzędzia/Kontekst i powiązania/Sugestie
AI), do `evidence/idea-menu1-20260905/`.

## 5. Zakres nietknięty (zgodnie ze zleceniem)

- `MyIdeasListContent.tsx` i podgląd tabeli Pomysłów — nie dotknięte.
- Flaga `ideaNotebookRightPanelPrototypeFlag` — nie dotknięta (fala 2, decyzja
  właściciela); `IdeaRightPanel` dalej przechodzi przez
  `IdeaNotebookRightPanelPrototypeGate` bez zmian w gałęzi flag OFF (domyślnej).
- Sześć paneli szyny MELS (`melsCanvasRightRailTools`) i lekki inspektor
  elementu (`elementInspectorRail`/`IdeaElementInspector`) — nietknięte,
  działały przed naprawą i działają po niej (inny, równoległy mechanizm).
- `git push` nie wykonany (robotnik nie pushuje).
