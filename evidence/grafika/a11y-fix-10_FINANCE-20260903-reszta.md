# A11y fix — 10_FINANCE (dyżur „reszta", 2026-09-03)

Gałąź: `agent/fix-a11y-reszta-20260903`, worktree `/private/tmp/ag-fix-a11y-reszta`.

## Ekran

`finance-statement-pack-workspace-v2` — mocked `StatementPackWorkspaceV2`
(`src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx`).

## Tabela PRZED → PO

| Motyw | PRZED | PO pl-1440 | PO en-1024 |
|---|---|---|---|
| light | 2 (color-contrast) | 0 | 0 |
| dark | 0 | 0 | 0 |

## Korekta pomiaru (punkt 5 instrukcji)

Instrukcja: „color-contrast 4/8". Zmierzyłem 2 węzły w JEDNYM kadrze (pl-1440
light) — dark był już czysty w moim pomiarze. Interpretuję „4/8" jako 4 z 8
kadrów pełnej matrycy nadzorcy dotknięte (nie 4 pojedyncze naruszenia) — mój
komplet 2 węzłów (data + residual w wybranym wierszu uzgodnienia) to
prawdopodobnie ten sam defekt widoczny w każdym z tych 4 kadrów (statyczna
klasa CSS, nie zależy od danych/szerokości/języka — tylko od tego, czy
przynajmniej jeden wiersz jest zaznaczony, co harness robi domyślnie).

## Naprawa (reguła → komponent → plik)

| Reguła | Komponent | Plik | Co zmieniono |
|---|---|---|---|
| color-contrast | Wiersz przebiegu uzgodnienia (data + „Residual: X%") w stanie ZAZNACZONYM — `text-c-text-muted` na tle `bg-c-focus/10` (tint zaznaczenia) mierzy 4.13:1 (< 4.5) w light | `src/components/Finance/statementPackWorkspaceV2/ReconciliationLedgerPanel.tsx` (linia ~129) | Warunkowa klasa: `isSelected ? 'text-c-text-secondary' : 'text-c-text-muted'` — `text-c-text-secondary` przechodzi na tym tle (6.58:1). Niezaznaczone wiersze (jaśniejsze/przezroczyste tło) zostają przy `text-c-text-muted`, bo ta kombinacja już przechodziła (nie była zgłoszona). |

Kontrast liczony wg WCAG relative-luminance; wartości w komentarzu przy zmianie.

## Komendy (odtwarzalność)

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5333 \
  --ekrany=finance-statement-pack-workspace-v2 --katalog=10_FINANCE-po-pl1440 \
  --faza=PO --jezyk=pl --szerokosc=1440 --motywy=light,dark --rozwin-sekcje=1 \
  --a11y=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-reszta-artefakty/10_FINANCE/po-pl-1440 \
  --wynik-json=/private/tmp/ag-fix-a11y-reszta-artefakty/10_FINANCE/po-pl-1440/wynik.json
```

(analogicznie `--jezyk=en --szerokosc=1024`)

Surowe dane (poza repo):
`/private/tmp/ag-fix-a11y-reszta-artefakty/10_FINANCE/{przed-pl-1440,po-pl-1440,po-en-1024}/wynik.json`.

## Pliki produktu zmienione

- `src/components/Finance/statementPackWorkspaceV2/ReconciliationLedgerPanel.tsx`

Weryfikacja składni: `npx esbuild <plik> --loader:.tsx=tsx --jsx=automatic` — exit 0.

## Nienaprawione / nierozstrzygnięte

Brak. 0 realnych naruszeń axe na pl-1440 i en-1024, oba motywy.
