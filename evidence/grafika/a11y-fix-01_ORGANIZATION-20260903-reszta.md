# A11y fix — 01_ORGANIZATION (dyżur „reszta", 2026-09-03)

Gałąź: `agent/fix-a11y-reszta-20260903`, worktree `/private/tmp/ag-fix-a11y-reszta`.

## Ekran

`org-identity-operating` — mocked `OrganizationView` (`src/views/OrganizationView.tsx`)
→ redesign screen `OrganizationIdentityOperatingScreen`. **Wymaga**
`--parametry=ff_org_redesign_v1=1` (bez tego harness renderuje starą powierzchnię,
zgodnie z instrukcją).

## Tabela PRZED → PO

| Motyw | PRZED | PO pl-1440 | PO en-1024 |
|---|---|---|---|
| light | heading-order 1 | 0 | 0 |
| dark | heading-order 1 | 0 | 0 |

Zgodne z liczbą podaną w instrukcji (heading-order 8/8 na pełnej matrycy nadzorcy —
jeden i ten sam strukturalny błąd obecny w każdym kadrze, bo dotyczy statycznej
struktury nagłówków strony, nie stanu zależnego od danych).

## Diagnoza

Zrzut pełnej hierarchii nagłówków w DOM (kolejność, poza `#dev-render-root`):

```
H1  "Organizacja"
H3  "Tożsamość"              (org-card-identity)   ← przeskok H1→H3
H3  "Skala"                  (org-card-scale)
H3  "Model dostawy"          (org-card-delivery)
H3  "Rynki i systemy rdzeniowe" (org-card-markets)
```

Wszystkie cztery karty na tym ekranie to bezpośrednie podsekcje strony (nic nie
siedzi na poziomie H2 pomiędzy). Nagłówek karty pochodzi ze WSPÓLNEGO komponentu
`OrgSectionCard` (`src/components/Organization/redesign/OrganizationCardPrimitives.tsx`),
używanego w **9 ekranach** całej rodziny redesignu Organizacji — więc `<h3>`
przeskakiwało poziom na każdym z nich, nie tylko na `org-identity-operating`.

## Naprawa (reguła → komponent → plik)

| Reguła | Komponent | Plik | Co zmieniono |
|---|---|---|---|
| heading-order | Nagłówek karty sekcji (`OrgSectionCard`) — bezpośrednia podsekcja `<h1>` strony, renderowana jako `<h3>` (przeskok poziomu) | `src/components/Organization/redesign/OrganizationCardPrimitives.tsx` (linia ~100) | `<h3 id={...}>` → `<h2 id={...}>`. Semantycznie poprawny poziom — karty to bezpośrednie sekcje strony, nic nie zajmuje H2. Naprawa w jednym współdzielonym komponencie zamyka WSZYSTKIE 9 ekranów rodziny (Identity/Operating, Scope/Collaboration, Direction/Constraints, Goals/Metrics, Risks/Opportunities, Root Causes/Blockers, Challenges/Evidence, Scenarios/Brief, Sources/Claims, Knowledge Graph) — pojedynczy punkt prawdy, brak ryzyka odrostu per-ekran. |

Sprawdzone: po zmianie hierarchia to `H1 → H2 → H2 → H2 → H2` (rodzeństwo na tym
samym poziomie nie łamie `heading-order` — reguła zabrania tylko PRZESKOKU, nie
powtórzeń).

## Komendy (odtwarzalność)

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5333 \
  --ekrany=org-identity-operating --katalog=01_ORG-po-pl1440 --faza=PO --jezyk=pl \
  --szerokosc=1440 --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  --parametry=ff_org_redesign_v1=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-reszta-artefakty/01_ORGANIZATION/po-pl-1440 \
  --wynik-json=/private/tmp/ag-fix-a11y-reszta-artefakty/01_ORGANIZATION/po-pl-1440/wynik.json
```

(analogicznie `--jezyk=en --szerokosc=1024`)

Surowe dane (poza repo):
`/private/tmp/ag-fix-a11y-reszta-artefakty/01_ORGANIZATION/{przed-pl-1440,po-pl-1440,po-en-1024}/wynik.json`.

## Pliki produktu zmienione

- `src/components/Organization/redesign/OrganizationCardPrimitives.tsx`

Weryfikacja składni: `npx esbuild <plik> --loader:.tsx=tsx --jsx=automatic` — exit 0.

## Nienaprawione / nierozstrzygnięte

Brak. 0 realnych naruszeń axe na pl-1440 i en-1024, oba motywy. Naprawa
prawdopodobnie zamyka to samo naruszenie na pozostałych 8 ekranów rodziny
redesignu Organizacji (nie zmierzone tutaj — poza przypisanym zakresem tego
dyżuru, ale ten sam komponent, więc ten sam efekt jest oczekiwany).
