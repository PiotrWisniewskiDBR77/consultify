# A11y fix — 12_AUDITS (dyżur „reszta", 2026-09-03)

Gałąź: `agent/fix-a11y-reszta-20260903`, worktree `/private/tmp/ag-fix-a11y-reszta`.

## Ekran

`audyty-warsztat-kryterium` — mocked `CriterionWorkspaceGate`
(`src/components/Audit/method/workspace/CriterionWorkspaceGate.tsx`), podgląd
otwarty domyślnym klikiem w wiersz. Prawy panel (`ArtifactRightPanel`) osadza
współdzieloną sekcję „Aktywność" (`PreviewActivityStrip`) — patrz niżej.

## Tabela PRZED → PO

| Motyw | PRZED | PO pl-1440 | PO en-1024 |
|---|---|---|---|
| light | 0 | 0 | 0 |
| dark | 5 (color-contrast) | 0 | 0 |

Zgodne z liczbą podaną w instrukcji (color-contrast 2/8 — w mojej matrycy dark
skupiał wszystkie 5 węzłów w jednym kadrze; w pełnej matrycy nadzorcy to
prawdopodobnie 2 z 8 kadrów dark były akurat zmierzone, reszta poza próbką).

## Diagnoza

Wszystkie 5 węzłów to JEDEN defekt w JEDNYM współdzielonym komponencie —
`PreviewActivityStrip` (`src/components/shared/PreviewPane/PreviewActivityStrip.tsx`),
renderowana sekcja „Aktywność" w prawym panelu podglądu. Klasa
`dark:text-slate-500` (nie `dark:text-slate-400`) na dwóch miejscach:
nagłówek sekcji („Aktywność" + ikona zegara) i timestamp każdego wpisu
aktywności (4 wpisy widoczne = 4 węzły + 1 nagłówek = 5).

## Naprawa (reguła → komponent → plik)

| Reguła | Komponent | Plik | Co zmieniono |
|---|---|---|---|
| color-contrast | Nagłówek sekcji „Aktywność" + timestamp każdego wpisu — `dark:text-slate-500` mierzy 3.75:1 na dark surface (< 4.5) | `src/components/shared/PreviewPane/PreviewActivityStrip.tsx` (linie 54, 72) | `dark:text-slate-500` → `dark:text-slate-400` (6.96:1) w obu miejscach; `text-slate-600` w light bez zmian (7.58:1 na białym). Komponent współdzielony (`shared/PreviewPane/`) — naprawa zamyka to naruszenie w KAŻDYM panelu podglądu w aplikacji, który osadza sekcję aktywności (Assessment, Initiatives, Execution, Audits itd.), nie tylko na tym jednym ekranie. |

## Komendy (odtwarzalność)

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5333 \
  --ekrany=audyty-warsztat-kryterium --katalog=12_AUDITS-po-pl1440 --faza=PO \
  --jezyk=pl --szerokosc=1440 --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-reszta-artefakty/12_AUDITS/po-pl-1440 \
  --wynik-json=/private/tmp/ag-fix-a11y-reszta-artefakty/12_AUDITS/po-pl-1440/wynik.json
```

(analogicznie `--jezyk=en --szerokosc=1024`)

Surowe dane (poza repo):
`/private/tmp/ag-fix-a11y-reszta-artefakty/12_AUDITS/{przed-pl-1440,po-pl-1440,po-en-1024}/wynik.json`.

## Pliki produktu zmienione

- `src/components/shared/PreviewPane/PreviewActivityStrip.tsx`

Weryfikacja składni: `npx esbuild <plik> --loader:.tsx=tsx --jsx=automatic` — exit 0.

## Nienaprawione / nierozstrzygnięte

Brak. 0 realnych naruszeń axe na pl-1440 i en-1024, oba motywy. PO en-1024
zajęło znacznie dłużej niż inne pomiary (więcej sekcji `aria-expanded=false`
do rozwinięcia przy tej szerokości — Relations/Sources/Comments/History — nie
błąd, tylko więcej pracy dla pętli rozwijania sekcji przyrządu).
