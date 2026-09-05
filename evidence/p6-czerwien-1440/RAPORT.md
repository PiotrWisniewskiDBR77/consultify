# P6 — Czerwień tylko dla krytycznych + przegląd 1440 px — RAPORT WYKONANIA

Gałąź: `ui/p6-czerwien-1440-20260905` (z `origin/staging`, base `888e8a52b9`)
HEAD: `faf6dcaf726b765173cfec1b10ef5d9059a6e547`
Commity: 5 (bez push)

## Tabela PRZED/PO

| Ekran / plik | Metryka | PRZED | PO |
| --- | --- | --- | --- |
| `DiscoveryToolsHub.tsx` + `KnownToolPreviewV3.tsx` | `rg -n "text-danger\|bg-danger"` bez adnotacji `danger-ok` | 18 (17+1) | **0** |
| `DiscoveryToolsHub.tsx` — kategoria „Oceny” | ton koloru | `critical` (danger) | `neutral` (przez `stateToneMap.ts`) |
| `KnownToolPreviewV3.tsx` — status „Nieaktywny” | wariant pigułki | pełna czerwona pigułka | cichy chip neutralny |
| `stateToneMap.test.ts` | testy | — (plik nie istniał) | 8/8 PASS, dowód mutacyjny zweryfikowany ręcznie (revert `licensed→critical` wywala 1 test) |
| CTA „Dodaj narzędzie” (N8) | zachowanie @1280 px | `shrink` niekontrolowany, brak `whitespace-nowrap` (kod: łamanie do 2 linii, audyt A §N8: +27 px przepełnienia) | `shrink-0` + `whitespace-nowrap` na SSOT (`MENU_1_PRIMARY_CTA`) + 2 miejscach pochodnych + własnym CTA Narzędzi |
| `NModeHeader.tsx` — nagłówek Dynamic SWOT | overlap tekstu @1280 px (symulacja sidebar 288px, `scripts/dev/1440-overlap-check.mjs`) | **2 pary nakładające się**: `["Aktywne","Sekcje"]`, `["Zapisano","Baza wiedzy"]` | **0 par** |
| `NModeHeader.tsx` — @1440/1920 px (symulacja) | overlap | 0 (nie reprodukowało się dokładnie na 1440 w tej symulacji — patrz zastrzeżenie niżej) | 0 |
| Regresja 5 kart Rekord (`initiative-record`, `karta-task`, `karta-decision`, `karta-initiative`, `karta-insight`) @1280/1440(/1920) | overlap | (nie mierzone — baseline nie istniał) | **0 par** na wszystkich |
| `check-artefakt.sh` (crimson w powłoce SPEC-A) | naruszenia | 9 (baseline sprzed sesji, z pre-istniejącym dryfem) | 8 (dryf zsynchronizowany, zweryfikowany `git diff` — plik nietknięty w tej sesji) |
| `check-artefakt.sh` CZĘŚĆ 3 (danger-* Discovery/DiscoveryTools, RAPORT nie blokada) | — | brak takiej kontroli | 117 nieoznaczonych w 63 plikach (baseline ratchet; `DiscoveryToolsHub.tsx` samo: 2→0) |
| `check-list-canon.sh` | — | OK (dług 364) | OK (dług 361, spadek niezwiązany z P6) |

## Ścieżki zrzutów PO (do obejrzenia)

- `evidence/p6-czerwien-1440/swot-header-PRZED-{1280,1440,1920}.png` + `.json` — stan przed naprawą (1280: potwierdzony overlap w `.json`).
- `evidence/p6-czerwien-1440/swot-header-PO-{1280,1440,1920}.png` + `.json` — po naprawie, zero par nakładających się na wszystkich trzech szerokościach.
- `evidence/p6-czerwien-1440/regresja-{initiative-record,karta-task,karta-decision,karta-initiative,karta-insight}-*.png/.json` — regresja na archetypie Rekord (C), zero nowych naruszeń.
- `evidence/p6-czerwien-1440/regresja-{template-builder-deck,template-builder-table}-*.json` — te ekrany NIE używają `NModeHeader` (selektor nie znaleziony — używają `ExecutiveModuleShell`), więc zmiana ich nie dotyczy; zostawione jako dowód negatywny.
- Realny zrzut audytu źródłowego (referencja PRZED z prawdziwej produkcji, nie z harnessu): `evidence/audyt-award-20260905/narzedzia/13-dynamicswot-fullopen.png`.

## Metoda pomiaru (uczciwie, żeby nadzorca mógł ocenić wiarygodność)

Weryfikacja żywa poszła przez **dev-render harness** (`dev-render/screens/tools-swot-library-detail.tsx`,
realny `<KnownToolDetailView>`, mock dane, bez logowania — CLAUDE.md #7), własny vite na porcie 3061,
zatrzymany po pracy (PID własny, nikt inny nie ruszony). Real backend+auth (staging) NIE był użyty —
harness nie renderuje globalnego `<Sidebar>` aplikacji (`MainLayout.tsx`: `md:ltr:pl-64` + `md:pr-8` =
288 px, których harness nie ma), więc do wiernej reprodukcji ciasnoty produkcyjnej wstrzyknięto
symulację tego offsetu (`margin-left`/`width: calc(100vw - 288px)` na `#dev-render-root`,
`window.innerWidth` NIETKNIĘTY — więc Tailwind `lg:` nadal reaguje na realną szerokość viewportu).

**Zastrzeżenie uczciwe:** próg nakładania w tej symulacji wypadł przy ~1280 px równoważnym, nie
dokładnie przy 1440 px jak w oryginalnym zrzucie audytu. Mechanizm (shrink-0 dzieci bez `flex-wrap`
w kontenerze, który sam dostaje mniej miejsca niż potrzeba) i naprawa są identyczne niezależnie od
dokładnego progu — dowodem jest to, że PRZED reprodukuje IDENTYCZNE pary nakładające się
(`Aktywne`+`Sekcje`, `Zapisano`+`Baza wiedzy`) jak na realnym zrzucie produkcyjnym audytu. Różnica progu
wynika z tego, że symulacja offsetu 288 px jest przybliżeniem geometrii (nie 1:1 real routing).

## Co z §10 NIE zostało wykonane i dlaczego

1. **Krok 2 (kolor „Final” w Ocenie)** — NIE wykonany. Moduł `04_ASSESSMENT` zamrożony 05.09,
   zmiana koloru wymaga potwierdzenia właściciela PRZED wdrożeniem (dwie sensowne opcje: `primary`
   granatowy albo `positive` emerald — pakiet §4.1). Mapa `stateToneMap.ts` klasyfikuje `final→neutral`
   jako bezpieczny domyślny ton (spójny z istniejącym `statusChipTone()`), ale NIE została zastosowana
   w `AssessmentHub.tsx` (`REPORT_STATUS_CONFIG` nietknięty — nadal indygo).
2. **Krok 5 (Partner CTA)** — NIE wykonany. Warunkowy, wymaga decyzji „czy reguła crimson-tylko-
   krytyczne obowiązuje stronę marketingową publiczną” (§3.6) — decyzja produktowa, nie techniczna.
   `PartnerApplicationView.tsx` nietknięty.
3. **Krok 6 (Finanse „Przelicz”)** — odłożony do fali 2 (poza MVP), zgodnie z §5.
4. **Pełne 5 archetypów SPEC-A dla kroku 3** — zweryfikowano Canvas (A, przez `KnownToolDetailView`)
   i Rekord (C, przez 5 kart N). Dokument/Matryca/Deck (B/D/E) NIE używają `NModeHeader` (potwierdzone
   przez `selektor nie znaleziony` na `template-builder-deck`/`template-builder-table` — te archetypy
   mają WŁASNĄ powłokę `ExecutiveModuleShell`), więc regresja tam jest nieistotna dla tej konkretnej
   zmiany — ale to ustalenie, nie założenie z pamięci.
5. **CTA „Dodaj narzędzie” — brak własnego zrzutu wizualnego** (tylko esbuild + 248 istniejących testów
   DiscoveryToolsHub zielonych + przegląd kodu). Nie zbudowano osobnego dev-render harnessu dla samego
   huba Narzędzi (wymagałoby mockowania większej liczby wywołań `Api`) — ryzyko niskie (fix to
   standardowe `shrink-0`+`whitespace-nowrap`, mechanicznie gwarantowane przez spec CSS), ale to
   różnica w rygorze względem `NModeHeader` (tam był pełny pomiar geometryczny PRZED/PO).
6. **`check-list-canon.sh --update`** — NIE wykonany celowo. Dług spadł (364→361) z przyczyn
   niezwiązanych z tym pakietem (nie zdiagnozowano źródła w czasie sesji) — zostawione nadzorcy do
   osobnej decyzji, zgodnie z regułą „nie ukrywaj cudzego sprzątania jako swojego bez sprawdzenia”.

## Testy — stan łączny

- `stateToneMap.test.ts`: 8/8 PASS (nowy plik).
- `NModeHeader.hideSaveState.test.tsx` + `.a11y.test.tsx`: PASS (bez zmian).
- `NModeHeader.ownerActions.test.tsx`: 4 testy FAIL — **PRZEDISTNIEJĄCE na nietkniętym `origin/staging`
  HEAD** (zweryfikowane: `git apply -R` mojej łatki + uruchomienie testu → te same 4 failures). Test
  oczekuje atrybutów `data-nmode-header-action-row`/`data-nmode-header-secondary-actions`, których
  obecny `NModeShell` nie eksponuje — niepowiązane z tym pakietem, nie naprawiane tutaj.
- `DiscoveryToolsHub.*` (5 plików, 248 testów): PASS, bez regresji.
- `esbuild` na każdym z 6 zmienionych plików źródłowych: exit 0.

## Bezpieczniki

- `bash scripts/check-list-canon.sh`: OK (dług nie rośnie).
- `bash scripts/check-artefakt.sh --report`: OK, PART1 (crimson) 8/8 baseline, PART2 (karty N) bez zmian,
  PART3 (nowa, danger-* raport) 117/117 — zero regresji, nigdy nie blokuje.

## Uczciwość ponad optymizm

Głównym ryzykiem tej pracy było zaufanie do JEDNEJ metody pomiaru (harness bez realnego sidebar/auth).
Zamiast zgadywać, zmierzono geometrycznie PRZED (potwierdzając identyczne pary nakładania co w realnym
zrzucie audytu) i PO (zero nakładania) — ale próg szerokości w symulacji nie jest identyczny z produkcją
co do piksela, co jest jawnie przyznane wyżej, nie ukryte. Kroki 2 i 5 celowo NIE wykonane bez słowa
nadzorcy, zgodnie z zakazem w §10.
