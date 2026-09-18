# DOC-0 etap 2a — samodzielny ekran `/documents/:artifactId` (DEC-593), 2026-09-18

Zrzuty NOWEGO ekranu (Wpis 106 Q1(b)) i TRZECH przepiętych wołaczy (Q2)
z harnessu `dev-render` (port 5421, pula C), 1440×900, EN, motyw jasny i ciemny
przez store aplikacji (`useAppStore.setState({theme})` + klasa `.dark`),
NIE `emulateMedia`. Flaga ON przez URL `?ff_doc0_document_viewer=1`
(najwyższy priorytet w `documentViewerFlag`).

## Pliki

- `capture-script-doc0-etap2a.mjs` — narzędzie zrzutów (playwright + pngjs +
  sharp), NIE wpięte w CI.
- `pomiary.json` — pełny pomiar per zrzut (ścieżki przed/po, kontrast, rozmiar,
  `consoleErrors`, `pageErrors`, `crimsonHits`).
- `capture.log` — stdout przebiegu (8 wejść × 2 motywy, RC=0).
- `capture-real-registry.mts.txt` — kopia jednorazowego narzędzia, którym
  schwytano PRAWDZIWE payloady rejestru (patrz niżej „Co jest prawdziwe").
- 8 zrzutów ekranu `doc0-etap2a-<wejscie>-en-<motyw>-1440x900.png`
  (`wejscie` = `url` | `initiative` | `notebook` | `rezultaty`).
- 6 zrzutów wołacza `doc0-etap2a-<wejscie>-en-<motyw>-caller-1440x900.png`
  (stan PRZED klikiem — bo wszystkie cztery wejścia lądują na TYM SAMYM ekranie,
  więc bez nich dowód nie pokazywałby, skąd startuje klik).

## Co jest prawdziwe, a co stubowane

Prawdziwe: komponent trasy `DocumentViewerRoute` (ten sam symbol, który
rejestruje `src/routes/AppRoutes.tsx` — guardy `ProtectedRoute`/`BetaGate`/
`RouteErrorBoundary` siedzą w rejestracji AppRoutes i pilnuje ich test trasy,
nie harness), cały łańcuch `DocumentViewerPage` → `DocumentViewer` →
`documentContentResolver`, trzej wołacze (`InitiativeCompactPanel` w trybie
overlay, `NotebookContextPanel` + konsument `MyWorkHub`, `RezultatyView`)
i nawigacja react-router, którą każdy z nich WYKONUJE. Payloady rejestru
(`dev-render/mocks/doc0-etap2a-registry.json`) schwytano READ-ONLY produkcyjnym
serwisem (`artifactRegistryService.getArtifactForUser` +
`buildActionTargetPayload`, narzędzie w `capture-real-registry.mts.txt`) na
lokalnej kopii dumpu stagingu z 2026-09-18: wiersz `4d6600e3-…`, org
`468b234c-…`, `delivery_state=ready`, `originStatus=APPROVED`, `ownerName=null`.
Treść dokumentu = envelope etapu 1 (`mocks/doc0-digital-roadmap-envelope.json`).

Stubowany jest TYLKO transport (`window.fetch`), bo harness nie ma backendu:
envelope `/api/artifacts/:id/content`, oba czytania rejestru dla jednego id,
czytanie pojedynczego artefaktu `/api/artifacts/origin/<runtime>/<id>`
(`useArtifactOutputsForOrigins` notebooka), kanoniczna skrzynka
`/my-work/inbox/canonical*` (`v8Get` rozwija `data`, a
`buildInboxResponseFromCanonical` czyta `.items` — tablica pod `data` rzuca
wyjątek i 4 błędy konsoli), stan otwarcia linku `/artifact-links/:id/open`
(`AVAILABLE` + `deepLink.artifactId`) oraz benigniczna pusta koperta 200 dla
reszty `/api/*`. Dwie udokumentowane adaptacje harnessu (komentarze w ekranie):
jednowierszowa nawigacja powłoki sprawy (`CaseDetailScreen.tsx:1411`) i kontener
raila dla panelu notebooka (harness nie montuje 4,4-tys. linii edytora Tiptap).
Żadna ścieżka NIE jest liczona w harnessie — wszystkie pochodzą z kodu
produkcyjnego.

Dwa klucze localStorage ustawiane jak w etapie 1 (`doneKey`,
`STORY_RAIL_DISMISSED_KEY`), żeby powłoka zachowała się jak POWRACAJĄCY
użytkownik. Dodatkowo wejście mirroruje `?ff_doc0_document_viewer=1|0` do
localStorage pod produkcyjnym kluczem `ff.doc0DocumentViewer`: wołacze robią
`navigate('/documents/<id>')` BEZ query harnessu, więc samo query zgasłoby po
pierwszej nawigacji i trasa (priorytet 2) wróciłaby do domyślnego OFF.

## Wejścia i kliknięcia (skrypt klika, nie nawiguje)

- `url` — goły deep link (czat / mail / historia): start od razu na
  `/documents/<id>`, bez klika.
- `initiative` — zakładka **Outputs** panelu inicjatywy → klik wiersza
  „Digital Roadmap 2026–2028" (`InitiativeCompactPanel.tsx` `onOpen`).
- `notebook` — rail „Note context" → **Linked outputs** → **Open**
  (`NotebookContextPanel.openItem` → zdarzenie `mywork-open-item` → handler
  `MyWorkHub`).
- `rezultaty` — tabela **Linked objects** → **Open** (wiersz przewinięty w
  kadr, bo siedzi pod załamaniem; `RezultatyView` → `onOpenDeliverable`).

## Co widać na zrzutach (opis słowny)

- `*-caller-*` (6): `initiative` — overlay panelu inicjatywy na przyciemnionym
  tle, aktywna zakładka Outputs z licznikiem 1 i wierszem „Digital Roadmap
  2026–2028 / document · draft · organization" z ikoną otwarcia; `notebook` —
  Hub My Work (Inbox) z railem „Note context" po prawej: „Linked outputs 1",
  wiersz z tytułem i przyciskiem **Open**; `rezultaty` — sprawa „Operating model
  review — Northwind", sekcja **Linked objects**: OBJECT=Document, ROLE=
  „Deliverable for the client", LINK STATUS=Linked, LINKED=08/09/2026,
  przycisk **Open**.
- `doc0-etap2a-*-1440x900` (8, po kliku / z gołego URL): samodzielny ekran
  SPEC-A. Górny rail: strzałka wstecz, tytuł „Digital Roadmap 2026–2028", chip
  statusu **Ready**, „Saved", przycisk **Edit** i kebab. Pod railem pasek
  sekcji („Vision") i lewa nawigacja CZTERECH sekcji dokumentu (Vision ·
  Roadmap by Horizon · Investment Summary · Risks & Dependencies). Treść:
  akapit sekcji Vision („By the end of 2028, every shopfloor role at Leeds and
  Rotherham…"). Prawy panel `ArtifactRightPanel` (ten sam komponent co overlay
  etapu 1): ACTIONS z **Edit** i PROPERTIES — Status=Ready, Content
  registry=Artifact content, Owner=— (null z rejestru, bez słowa „null"),
  Updated=8 Sept 2026, 09:58. Wersja ciemna: to samo na ciemnym płótnie,
  przycisk Edit odwrócony (jasny), tekst czytelny.

## Pomiar (`pomiary.json`, `capture.log`)

- `bledyKonsoli` (console errors + page errors) = **0** we wszystkich 8
  przebiegach.
- Lądowanie: **8/8** na `/documents/4d6600e3-6ddd-52df-b0aa-85afa4c86c1c`
  (`landedOnRoute=true`, `pathBefore` = adres wejścia).
- Kontrast ekranu (pikselowo z surowego PNG, pngjs, PRZED kwantyzacją palety):
  light **18.15:1**, dark **16.86:1** — oba ≥4.5 (WCAG AA).
- Kontrast wiersza wołacza (boks samego wiersza, nie cały kadr — panel
  inicjatywy leży na dekoracyjnym scrimie `bg-black/20`): initiative
  13.64/13.76, notebook 17.34/14.85, rezultaty 18.15/16.86 — wszystkie AA.
- Rozmiary PNG po kwantyzacji palety (sharp, pętla jakości do ≤200 KB): ekran
  48.8 KB light / 40.1 KB dark; caller 16.6–23.3 KB. Wszystkie ≤200 KB.
- `crimsonHits=0` na każdym zrzucie (skan computed `background-color` pod
  zakres crimson `#85182F`).
- Cztery zrzuty ekranu w danym motywie są BAJTOWO identyczne (md5: 4× light,
  4× dark) — celowo: dowodem wejścia jest para „caller → ten sam ekran", a nie
  osiem różnych obrazków.

## Uruchomienie

```
npx vite --config dev-render/vite.config.ts --port 5421 --strictPort   # z korzenia repo
node evidence/qoder-doc0-etap2a-20260918/capture-script-doc0-etap2a.mjs
```
