# Naprawa kontrastu — canvas-new-doc (G06, 2026-09-03)

## Kontekst

Pomiar #4 (nadzorca, marker `cfb21c0959`): ekran harnessu `canvas-new-doc`
(moduł 13_CHAT), motyw **light**, w 4 kadrach (pl/en × 1440/1024) zgłaszał
`color-contrast` (impact serious, 1 węzeł) — ukryte w pomiarze #3, bo pętla
rozwijania sekcji naciskała Escape i zamykała menu „Nowy dokument" przed
skanem axe. W trybie **dark** naruszeń nie było (0).

## R1 — pomiar PRZED (z węzłem)

Komenda (kanoniczne narzędzie, port 5416):

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5416 \
  --ekrany=canvas-new-doc --jezyk=pl --szerokosc=1440 --motywy=light,dark \
  --a11y=1 --wyjscie=/private/tmp/ag-canvas-kontrast-artefakty/przed \
  --wynik-json=/private/tmp/ag-canvas-kontrast-artefakty/przed/wynik.json
```

Wynik: `canvas-new-doc` light → `color-contrast` serious, 1 węzeł. Dark → 0.

Skrypt diagnostyczny (Playwright + axe-core, ten sam URL/skan co narzędzie
kanoniczne, `.include('#dev-render-root')`) zlokalizował węzeł:

- **Selektor**: `.bg-slate-100 > .mt-0\.5.text-\[11px\].dark\:text-slate-400`
- **HTML**: `<div class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Czysty dokument Markdown do pracy biznesowej.</div>`
- **Kolory**: fg `#64748b` (slate-500) na bg `#f1f5f9` (slate-100)
- **Kontrast**: 4.34:1 — próg 4.5:1

## R2 — przyczyna i rodzina

Element: opis szablonu „Napisz dokument" w rozwiniętym menu „Nowy dokument"
(`data-testid="canvas-new-menu-v2"`), `src/components/AIChat/WorkCanvasDocumentPanel.tsx`.
Kafel `template.description` dostaje tło `bg-slate-100` gdy jest aktywny
(`documentState.activeStarterId === template.id`) — token opisu
`text-slate-500` jest skalibrowany na zwykłe tło (białe), nie na
podbarwiony `bg-slate-100`. Ten sam kafel dostaje `bg-slate-100` również
na **hover** (`hover:bg-slate-100`) dla WSZYSTKICH kart w tym menu (w tym
„Czysty dokument"), więc ten sam brak kontrastu występuje przejściowo
także tam, mimo że axe złapał tylko stan domyślnie aktywny.

`git grep` tej samej pary kolorów (`text-slate-500 dark:text-slate-400`) w
strukturze karta-opis (`mt-0.5 text-[11px] text-slate-500 dark:text-slate-400`)
w tym samym menu — rodzeństwo (3 wystąpienia, ten sam dialog):

1. linia ~3519 — opis „Czysty dokument" (blank card)
2. linia ~3558 — opis szablonu w bloku v2 (`starterTemplates.map`, aktualny)
3. linia ~3625 — opis szablonu w bloku legacy (fallback gdy flaga
   `isCanvasNewDocOptionsEnabled()` wyłączona)

Sekcje-nagłówki (`Z SZABLONU`/`Z CANVASA`, 10px uppercase) i stany
ładowania/pustki używają tej samej pary kolorów, ale renderują się na
zwykłym tle (białe/`navy-800`) bez `bg-slate-100` — poza zakresem tej
naprawy (nie są kartami-rodzeństwem, nie dostają podbarwionego tła).

## R3 — naprawa

`text-slate-500` → `text-slate-600` w 3 wystąpieniach (opis pod nazwą
kafla), `dark:text-slate-400` bez zmian (dark już przechodził, 0 naruszeń).

| Kolor | Na `#f1f5f9` (slate-100) | Na białym |
|---|---|---|
| `slate-500` (`#64748b`, PRZED) | 4.34:1 ✗ | 4.76:1 ✓ |
| `slate-600` (`#475569`, PO) | 6.92:1 ✓ | 7.58:1 ✓ |

Zgodnie z kanonem: bez `primary-*`, bez nowych wartości hex w kodzie (zmiana
to istniejąca klasa Tailwind z tej samej skali szarości — analogicznie do
wzorca z `5c3ad70d83` — jeden stopień w skali, nie nowy token, bo zasięg
jest wąski: 1 komponent, 3 wystąpienia w tym samym dialogu). Esbuild pliku
— czysto.

## R4 — dowód PO

Ten sam przebieg co R1 → `/private/tmp/ag-canvas-kontrast-artefakty/po/wynik.json`:
`color-contrast` **0** w light i dark.

Dodatkowo pełne 4 kadry z pomiaru #4 (pl/en × 1440/1024, light+dark, 8
renderów):

```
for jez in pl en; do
  for szer in 1440 1024; do
    node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5416 \
      --ekrany=canvas-new-doc --jezyk=$jez --szerokosc=$szer \
      --motywy=light,dark --a11y=1 \
      --wyjscie=/private/tmp/ag-canvas-kontrast-artefakty/po-full/${jez}-${szer} \
      --wynik-json=/private/tmp/ag-canvas-kontrast-artefakty/po-full/${jez}-${szer}/wynik.json
  done
done
```

Wynik: **0/8** `color-contrast` — pl-1440, pl-1024, en-1440, en-1024 ×
light/dark, wszystkie puste (`a11yNaruszenia: []`).

### Zrzuty PRZED/PO (pl, 1440, light)

- PRZED: `/private/tmp/ag-canvas-kontrast-artefakty/przed/nieprzypisane/canvas-new-doc__PRZED__pl__1440__light.png`
- PO: `/private/tmp/ag-canvas-kontrast-artefakty/po-full/pl-1440/nieprzypisane/canvas-new-doc__PRZED__pl__1440__light.png`

Obejrzane oboje (Read na PNG): identyczny układ menu „Nowy dokument"
(„Czysty dokument" / „Z SZABLONU" / „Z CANVASA"), identyczne pozycje i
rozmiary kart. Jedyna zmiana wizualna: opis pod nazwą aktywnego kafla
(„Napisz dokument" → „Czysty dokument Markdown do pracy biznesowej.")
jest odrobinę ciemniejszy/wyraźniejszy — ten sam układ, ciemniejszy tekst.

## Commit

- Naprawa: `src/components/AIChat/WorkCanvasDocumentPanel.tsx` (3 miejsca,
  `text-slate-500` → `text-slate-600`), gałąź
  `agent/canvas-new-doc-kontrast-20260903`, baza `cfb21c0959`.
