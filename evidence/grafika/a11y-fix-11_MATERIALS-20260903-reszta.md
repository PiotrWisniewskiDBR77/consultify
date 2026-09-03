# A11y fix — 11_MATERIALS (dyżur „reszta", 2026-09-03)

Gałąź: `agent/fix-a11y-reszta-20260903`, worktree `/private/tmp/ag-fix-a11y-reszta`
(z `/private/tmp/m03`, HEAD `7c2f342144`).

Przyrząd: `scripts/dev/grafika-zrzuty.mjs --a11y=1` (axe-core, zakres `#dev-render-root`).
Szum hosta (`landmark-one-main`, `page-has-heading-one`, `region`) odjęty — nie
wystąpił na żadnym z tych 5 ekranów.

## Ekrany

1. `deck-artifact` — mocked `DeckBuilder`
   (`src/components/Presentations/DeckBuilder/DeckBuilder.tsx`)
2. `document-artifact` — mocked `DocumentStudioDocumentPanel`
   (`src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx`)
3. `excele-reopen-verify` — mocked `ExceleView`/`KimiWorkspaceShell`
4. `gen-deck-content-hints` — mocked `PresentationTemplateArchitectView`
5. `report-builder-library-template` — mocked `ReportBuilderView` →
   `LibraryTemplateReportCreateFlow` → `NewAssessmentReportModal`
   (wymaga `--parametry=new=true&templateArtifactId=fake-1` — **UWAGA**: instrukcja
   zawierała `%26` zamiast realnego `&`; z tym literalnym zapisem
   `templateArtifactId` NIGDY nie dociera do komponentu, bo cały string trafia jako
   wartość parametru `new`. Zmierzone PRZED poniżej użyło poprawnego `&`
   — patrz „Korekta pomiaru" niżej.)

## Tabela PRZED → PO (kadry z realnym naruszeniem, pl-1440)

| Ekran | PRZED light | PRZED dark | PO light | PO dark |
|---|---|---|---|---|
| deck-artifact | 2 (color-contrast) | 0 | 0* | 0* |
| document-artifact | 0 | 2 (color-contrast) | 0 | 0 |
| excele-reopen-verify | 0 | 1 (color-contrast) | 0 | 0 |
| gen-deck-content-hints | 11 (label 5 + select-name 6) | 11 (identycznie) | 0 | 0 |
| report-builder-library-template | 2 (color-contrast 1 + select-name 1) | 1 (select-name 1) | 0 | 0 |

PO w `en-1024` (oba motywy): identycznie zero dla wszystkich 5 ekranów, **z tym samym
zastrzeżeniem (*) przy `deck-artifact`** — patrz sekcja „Kadr, który został" niżej.

## Korekta pomiaru (punkt 5 instrukcji — mój pomiar różni się od podanych liczb)

Instrukcja podawała dla tego dyżuru: `gen-deck-content-hints`: label 8/8 + select-name
8/8; `report-builder-library-template`: select-name 8/8 + color-contrast 4/8. Mój
PRZED (pl-1440, 2 kadry na ekran) pokazał: `gen-deck-content-hints` label 5+select-name
6 (per kadr, stałe w obu motywach) — różnica prawdopodobnie z innej szerokości/języka
w pełnej macierzy 8 kadrów nadzorcy, ale ten sam KOMPONENT i te same pola (per zasadę
punktu 5 „jeśli Twój pomiar przeczy tym liczbom, obowiązuje Twój" — naprawiłem
wszystkie pola tego komponentu, więc liczba kadrów jest bez znaczenia: zero pól bez
etykiety = zero naruszeń w KAŻDYM kadrze). Podobnie `report-builder-library-template`:
zmierzone 2+1 (nie 8+4/8), ale przyczyna sięga do tego samego wąskiego zbioru pól —
naprawa jest kompletna niezależnie od tego, ile z 8 kadrów matrycy nadzorcy akurat
złapało błąd.

## Naprawy (reguła → komponent → plik)

| Reguła | Komponent | Plik | Co zmieniono |
|---|---|---|---|
| color-contrast | „Saved" wskaźnik zapisu (11px, `text-emerald-600` = custom „HBS Green" #388A22, 4.35:1 na białym < 4.5) | `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` (2 miejsca: `presenceSlot`+`titleTrailingSlot`) | `text-emerald-600` → `text-emerald-700` (6.93:1); `dark:text-emerald-400` bez zmian (już 8.89:1) |
| color-contrast | Aktywna zakładka `bg-c-focus/10 text-c-focus-solid` (4.31:1 < 4.5 — token dodany WCZEŚNIEJ tego samego dyżuru specjalnie do tej pary, ale nieużyty w tych plikach) | `DeckBuilderMelsView.tsx`, `CardFloatingToolbar.tsx` (4×), `DeckBuilderBottomBar.tsx`, `DeckBuilderTopBar.tsx`, `PresentationReviewPanel.tsx`, `DocumentStudioDocumentPanel.tsx` (2×) | `text-c-focus-solid` → `text-c-focus-solid-on-tint` (istniejący wąski token, ~5.6:1) wszędzie, gdzie łączy się z `bg-c-focus/10` w drzewie komponentów tych dwóch ekranów |
| color-contrast | `doc-kpi-strip__delta` — trend up/down malowany STAŁYM hexem (`#1e6b32`/`#9b1c2e`), bez świadomości motywu; na `--c-surface` dark (#0f172a) dawało 2.72:1/3.75:1 | `src/components/DocumentStudio/blocks/DocKpiStrip.tsx` | `trendColor()` zwraca `var(--c-success)`/`var(--c-danger)`/`var(--c-text-muted)` zamiast hexów — tokeny mają już poprawne pary jasny/ciemny (≥4.66:1/≥5.18:1/≥4.76:1) |
| color-contrast | `dark:text-danger-400/80` na `dark:bg-c-surface-raised` (#15213b) → 3.33:1 | `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (stan `isFailed`) | `dark:text-danger-400/80` → `dark:text-danger-300/80` (~5.9:1, ta sama przezroczystość/waga wizualna) |
| color-contrast | Plakietka „Z Biblioteki" `text-slate-500` na `bg-slate-100` → 4.34:1 | `src/components/assessment/modals/NewAssessmentReportModal.tsx` | `text-slate-500` → `text-slate-600` (6.92:1); `dark:text-slate-400` bez zmian (już 6.48:1) |
| label | Pole tytułu slajdu i pole „Teza"/select typu slajdu w wierszu konspektu — bez etykiety (span-etykieta nie zawijał inputu) | `src/components/Presentations/PresentationTemplateArchitectView.tsx` | `aria-label` na input tytułu (`slideTitleLabel`, z numerem slajdu) i select typu (`slideTypeLabel`) |
| select-name | Select „nowy typ slajdu" przed przyciskiem „Dodaj slajd" | jw. | `aria-label` (`newSlideTypeLabel`) |
| select-name | Select asysty w `NewAssessmentReportModal` — `<label>` nie był powiązany z `<select>` (brak `htmlFor`/zawijania) | `src/components/assessment/modals/NewAssessmentReportModal.tsx` | Dodano `id`/`htmlFor` parujące `<label>` z `<select>` |
| i18n | nowe klucze | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | `presentations.templateArchitect.slideTitleLabel`, `.slideTypeLabel`, `.newSlideTypeLabel` (oba języki, przetłumaczone — nie tylko klucz-widmo) |

Kontrast liczony wg WCAG relative-luminance (ten sam wzór co axe `color-contrast`);
wartości podane w komentarzach przy każdej zmianie w kodzie.

## Kadr, który został: `deck-artifact` — artefakt czasowy przyrządu (NIE defekt produktu)

Kanoniczny przyrząd zgłasza konsekwentnie 4 węzły `color-contrast` na `deck-artifact`
(oba motywy, oba `pl-1440`/`en-1024`) — selektor
`div[data-block-frame="block-slide-problem-0/1"]` (nagłówek+wypunktowanie slajdu
„Problem" w ciągłym widoku kart edytora). Zbadane i **obalone jako realny defekt**:

1. Kolor nagłówka to inline `rgb(165,28,48)` (#A51C30, motyw „harvard"). Wyliczony
   kontrast na pełnej nieprzezroczystości vs karta (#fdfdfd): **7.35:1** (próg 3:1
   dla 24px bold) — przechodzi z zapasem.
2. axe raportuje POLICZONY (efektywny, po zblendowaniu) kolor #d8a0a7/#74505c —
   znacznie jaśniejszy niż literalny inline-color. To sygnatura **opacity na
   przodku w trakcie animacji**, nie stały wybór koloru.
3. Źródło: `AnimatedBlock`/`AnimatedCard`
   (`src/components/Presentations/DeckBuilder/AnimatedBlock.tsx`) — framer-motion
   `useInView({once:true})`, `initial:{opacity:0}→animate:{opacity:1}`,
   duration 0.4–0.6s. Każda karta/blok dostaje fade-in.
4. **Dowód mechanizmu** (4 przebiegi kanonicznego narzędzia, ten sam kod produktu):
   - `--rozwin-sekcje=1` (jak w komendzie kanonicznej) → 4/4 węzły, powtarzalnie
     (2× rerun, w tym z `--osiad=5500` — podniesienie POCZĄTKOWEGO wyciszenia nie
     pomaga, bo to nie tam jest luka czasowa).
   - `--rozwin-sekcje=0` (pomija pętlę klik-w-`[aria-expanded=false]`) → **0/0**.
   - Mój pomocniczy skrypt z pętlą identyczną jak kanoniczna (8 rund, Escape+klik
     w róg) + dodatkowe 3s ciszy PRZED skanem axe → **0 naruszeń** (ten sam DOM,
     ta sama sekwencja kliknięć).
   - Wniosek: pętla rozwijania sekcji (klika KAŻDY `[aria-expanded=false]`, w tym
     przełączniki paneli w `CardFloatingToolbar`/`DeckBuilderMelsView`) w
     kumulacie ponownie wyzwala animację wejścia bloków, a kanoniczne narzędzie
     nie ma dodatkowego wyciszenia PO tej pętli przed skanem axe — łapie klatkę
     pośrednią.
5. To nie jest ukrywanie elementu ani obniżanie progu — treść ZAWSZE dochodzi do
   pełnej nieprzezroczystości (animacja `once:true`, kończy się zawsze), użytkownik
   (także czytnik ekranu/lupa) nigdy nie widzi trwałego stanu o zaniżonym kontraście.
   Nie zmieniałem `scripts/dev/grafika-zrzuty.mjs` (zakaz) ani nie wyłączałem
   animacji w produkcie — to byłaby zmiana UX dla obejścia pomiaru, nie naprawa
   defektu.
6. **Nierozstrzygnięte formalnie**: kanoniczny przyrząd nadal zgłosi te 4 węzły przy
   dosłownym powtórzeniu komendy z instrukcji. Zostawiam to jawnie oznaczone —
   jeśli nadzorca chce zero w SUROWYM wyjściu narzędzia (nie tylko „zero realnych
   defektów"), potrzebna jest zmiana w samym przyrządzie (dodatkowe ciche
   oczekiwanie po pętli rozwijania sekcji), której nie mogę wykonać w tym zakresie
   prac (zakaz zmian w `grafika-zrzuty.mjs`).

## Komendy (odtwarzalność)

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5333 \
  --ekrany=deck-artifact,document-artifact,excele-reopen-verify,gen-deck-content-hints \
  --katalog=11_MATERIALS-po-pl1440 --faza=PO --jezyk=pl --szerokosc=1440 \
  --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-reszta-artefakty/11_MATERIALS/po-pl-1440 \
  --wynik-json=/private/tmp/ag-fix-a11y-reszta-artefakty/11_MATERIALS/po-pl-1440/wynik.json

node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5333 \
  --ekrany=report-builder-library-template --katalog=rblt-po --faza=PO --jezyk=pl \
  --szerokosc=1440 --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  "--parametry=new=true&templateArtifactId=fake-1" \
  --wyjscie=/private/tmp/ag-fix-a11y-reszta-artefakty/11_MATERIALS/po-report-builder \
  --wynik-json=/private/tmp/ag-fix-a11y-reszta-artefakty/11_MATERIALS/po-report-builder/wynik.json
```

(analogicznie `--jezyk=en --szerokosc=1024` dla PO en-1024)

Surowe dane (poza repo, worktree `/private/tmp/ag-fix-a11y-reszta`):
`/private/tmp/ag-fix-a11y-reszta-artefakty/11_MATERIALS/{przed-pl-1440,po-pl-1440,po-en-1024,przed-report-builder-fixed,po-report-builder,po-report-builder-en}/wynik.json`
i towarzyszące `*.png`.

## Pliki produktu zmienione

- `src/components/Presentations/DeckBuilder/DeckBuilder.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilderMelsView.tsx`
- `src/components/Presentations/DeckBuilder/CardFloatingToolbar.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilderBottomBar.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilderTopBar.tsx`
- `src/components/Presentations/DeckBuilder/PresentationReviewPanel.tsx`
- `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx`
- `src/components/DocumentStudio/blocks/DocKpiStrip.tsx`
- `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`
- `src/components/Presentations/PresentationTemplateArchitectView.tsx`
- `src/components/assessment/modals/NewAssessmentReportModal.tsx`
- `public/locales/pl/translation.json`, `public/locales/en/translation.json`

Weryfikacja składni: `npx esbuild <plik> --loader:.tsx=tsx --jsx=automatic` na każdym
z 10 plików `.tsx` — wszystkie exit 0. `node -e "JSON.parse(...)"` na obu plikach
lokalizacji — OK.
