# Pogodzenie: lane governance (A) × pasy poza nagłówkiem (B) — 2026-09-05

## Przyczyna konfliktu
Obie poprawki już były scalone w `m03` (`d7563578c1` ⊂ `aabd55cd09`), ale
zostawiły ze sobą sprzeczne założenia w jednym pliku:

- **B** (`18840efb25`) wprowadził `hasHeaderLanes` z warunkiem
  `framework !== 'drd'` — w chwili jego powstania panel governance renderował
  się BEZWARUNKOWO dla metodyk innych niż DRD, więc pas miał być zawsze otwarty.
- **A** (`4d4abf7a3e`, później) zmienił render governance z
  `framework !== 'drd' || showGovernance` na samo `showGovernance` — governance
  jest teraz schowany domyślnie dla KAŻDEJ metodyki — ale zapomniał
  zaktualizować `hasHeaderLanes`, które dalej miało stary warunek.

Efekt: test B pierwszy `it` (`managePanelViewport`) szukał `v8-canon-panel`
zakładając, że renderuje się od razu — po fixie A panel jest ukryty do czasu
kliknięcia przełącznika „Governance”, więc `findByTestId` szedł w timeout.

## Naprawa w kodzie
`src/views/AssessmentSessionEditorView.tsx`:
- `hasHeaderLanes` już nie zawiera martwego `framework !== 'drd'` — teraz to
  `Boolean(sessionAiPanel) || showGovernance || isInfoOpen`, spójne z DRD.
  Efekt uboczny naprawiony przy okazji: sesja SIRI/ADMA/CMMI/Lean nie pokazywała
  już pustego, obramowanego paska pod nagłówkiem, gdy wszystkie pasy są
  zwinięte (pas miał zawsze klasy `shrink-0 max-h-[45vh] overflow-y-auto…`
  mimo braku treści).

## Minimalna zmiana asercji (uzasadnienie)
`tests/.../AssessmentSessionEditorView.managePanelViewport.test.tsx`, pierwszy
`it`: asercja zakładała, że `v8-canon-panel` jest widoczny bez interakcji —
to szczegół sprzeczny z zamiarem A (domyślnie schowany governance dla
nie-DRD, broniony przez `siriGovernanceLane.test.tsx`). Dodano jedno kliknięcie
przełącznika „Governance” przed sprawdzeniem `header.contains/lanes.contains`
— sama struktura (pas POZA nagłówkiem, własny scroll, `shrink-0`) nadal
weryfikowana identycznie, więc test broni się przed regresją tak samo jak
wcześniej.

## Wynik testów
- `AssessmentSessionEditorView.siriGovernanceLane.test.tsx` — 2/2 PASS
- `AssessmentSessionEditorView.managePanelViewport.test.tsx` — 2/2 PASS
- `AssessmentSessionEditorView.availabilityGate.test.tsx` — 2/2 PASS
- `AssessmentSessionEditorView.canonical-drd.test.tsx` — 1/1 PASS
- `DRDMatrixSession.test.tsx` — 10/10 PASS
- Razem: 5 plików / 17 testów PASS

Kontrola kompilacji: `esbuild src/views/AssessmentSessionEditorView.tsx`
(bundle, loader tsx, external react/react-dom/react-router-dom) — bez błędów.

## Pliki zmienione
- `src/views/AssessmentSessionEditorView.tsx`
- `tests/components/assessment/AssessmentSessionEditorView.managePanelViewport.test.tsx`
