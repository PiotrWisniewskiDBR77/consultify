# A11y fix — 02_INTERVIEW (dyżur „reszta", 2026-09-03)

Gałąź: `agent/fix-a11y-reszta-20260903`, worktree `/private/tmp/ag-fix-a11y-reszta`.

## Ekran

`karta-insight` — mocked `InsightViewer` (`src/components/Interview/InsightViewer.tsx`),
podgląd otwarty domyślnym klikiem (`--rozwin-sekcje=1` rozwija prawy panel, w tym
sekcję „Źródła i założenia" → `EvidencePanelSection`, oraz sekcję komentarzy →
`CommentsCanvas`).

## Tabela PRZED → PO

| Motyw | PRZED | PO pl-1440 | PO en-1024 |
|---|---|---|---|
| light | button-name 3 + color-contrast 2 | 0 | 0 |
| dark | button-name 3 + color-contrast 2 | 0 | 0 |

Zgodne z liczbą podaną w instrukcji (button-name 8/8, color-contrast 8/8 — w mojej
macierzy 2 kadry pl-1440 × light/dark obie wykazały ten sam komplet, spójne z
„8/8" na pełnej matrycy nadzorcy).

## Naprawy (reguła → komponent → plik)

| Reguła | Komponent | Plik | Co zmieniono |
|---|---|---|---|
| button-name | Przycisk usuwania komentarza (`<X/>`, `disabled` gdy zablokowane, widoczny tylko na hover grupy) — brak `aria-label` | `src/components/shared/NModeSections/CommentsCanvas.tsx` | Dodano `aria-label={t('sharedComponents.commentsCanvas.deleteComment', 'Delete comment')}` + nowy klucz i18n (pl: „Usuń komentarz", en: „Delete comment") |
| color-contrast | Plakietki źródła założenia („zaimportowane" `bg-c-tag-1`, „założenie AI" `bg-c-tag-4`) — `text-c-tag-foreground` (biały) na tle tag-1..tag-5 mierzy 2.49–4.32:1 (< 4.5) w obu motywach dla WSZYSTKICH pięciu wariantów tego komponentu (nie tylko tych dwóch akurat widocznych na tym ekranie) | `src/components/standard/EvidencePanelSection.tsx` (`AssumptionRow`, mapa `ASSUMPTION_BADGE`) | `text-c-tag-foreground` → `text-black` na tym jednym `<span>` odznaki. Sprawdzone: czarny tekst przechodzi na WSZYSTKICH 5 kolorach tej mapy (tag-1..tag-5), oba motywy, 4.86–8.44:1. **Nie ruszono** wspólnego tokenu `--c-tag-foreground` ani `--c-tag-1..12` — te obsługują ~24+ innych miejsc w całej aplikacji (pełna paleta identyfikacyjna 12 kolorów), poza zakresem tego dyżuru; naprawa jest lokalna do tej jednej odznaki tego jednego komponentu. |

## Ważne odkrycie (poza zakresem tego dyżuru, zgłoszone osobno)

Podczas ustalania przyczyny policzyłem kontrast WSZYSTKICH 12 kolorów palety
identyfikacyjnej (`--c-tag-1`…`--c-tag-12`) na białym tekście
(`--c-tag-foreground`): **10 z 12 nie przechodzi w light, 11 z 12 nie przechodzi w
dark** (dark bywa katastrofalny: 2.1–3.1:1). To systemowy defekt współdzielonego
tokenu używanego w całej aplikacji (karty tagów/kategorii w wielu modułach), nie
tylko na tym ekranie. Naprawa globalna wykracza poza ten dyżur (duży promień
rażenia, brak PRZED innych ekranów, brak przeglądu wizualnego) — zgłaszam jako
osobne zadanie, nie naprawiam tutaj.

## Komendy (odtwarzalność)

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5333 \
  --ekrany=karta-insight --katalog=02_INTERVIEW-po-pl1440 --faza=PO --jezyk=pl \
  --szerokosc=1440 --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-reszta-artefakty/02_INTERVIEW/po-pl-1440 \
  --wynik-json=/private/tmp/ag-fix-a11y-reszta-artefakty/02_INTERVIEW/po-pl-1440/wynik.json
```

(analogicznie `--jezyk=en --szerokosc=1024`)

Surowe dane (poza repo):
`/private/tmp/ag-fix-a11y-reszta-artefakty/02_INTERVIEW/{przed-pl-1440,po-pl-1440,po-en-1024}/wynik.json`.

## Pliki produktu zmienione

- `src/components/shared/NModeSections/CommentsCanvas.tsx`
- `src/components/standard/EvidencePanelSection.tsx`
- `public/locales/pl/translation.json`, `public/locales/en/translation.json`

Weryfikacja składni: `npx esbuild <plik> --loader:.tsx=tsx --jsx=automatic` — exit 0
na obu plikach `.tsx`. JSON obu lokalizacji — OK.

## Nienaprawione / nierozstrzygnięte

Brak na tym ekranie (0 realnych naruszeń, pl-1440 i en-1024, oba motywy).
Defekt palety identyfikacyjnej (12 kolorów, opisany wyżej) zgłoszony jako osobne
zadanie dla nadzorcy — dotyczy wielu modułów poza zakresem tego dyżuru.
