# Naprawa G06 — kontrast w otwartym podglądzie (dyżur 2026-09-03)

Worktree: `/private/tmp/ag-podglad-kontrast` · gałąź `agent/podglad-kontrast-20260903`
Bazowy commit: `c75a617588` (Merge agent/g14-01-04-20260903)
Marker pomiaru nadzorcy: `35afcb15fd`

## Kontekst

Naprawiony 2026-09-03 przyrząd (klik w wiersz PO rozwinięciu sekcji, żeby skan
axe objął OTWARTY PODGLĄD — trzy flagi `--rozwin-sekcje=1
--osiad-po-rozwinieciu=1500 --klik-po-rozwinieciu=1`) odsłonił ślepą plamę
wcześniejszych pomiarów: 24 ekrany w 11 modułach miały `color-contrast`
wyłącznie w otwartym panelu podglądu i w zaznaczonym wierszu tabeli — rodzina
znana z przekazania sesji („kontrast tekstu w zaznaczonym wierszu tabeli
spada poniżej progu — naprawione 3 wystąpienia, reszta niezweryfikowana").

Cel: zero. Wynik: **0/37 naruszeń color-contrast** na wszystkich 24 ekranach,
zweryfikowane w 4 kombinacjach język×szerokość×motyw (pl-1440 light/dark,
en-1024 light/dark) = 96 renderów ekranu.

## Pomiar PRZED (24 ekrany, pl, 1440px, light+dark)

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5344 \
  --ekrany=execution-tab-control,execution-tab-list,mywork-inbox,vault-sejf-wnetrze,meetings-module,results-vnext-kpi-registry,results-vnext-kpi-scorecards,results-vnext-okr-objectives,results-vnext-roi-full-tool,results-vnext-roi-model,results-vnext-roi-pir-outcomes,results-vnext-roi-registry,finance-hub,materialy-draft-template-visibledraft-fix,materialy-template-library-slice,audyty-piec-powierzchni,chat-signals-feed,admin-command-attention-queue,admin-command-dlp,model-catalog-table,partner-settlements-view,partner-earnings-filled,partner-referral-tools-empty,partner-referral-tools-filled \
  --katalog=pk-przed --faza=PRZED --jezyk=pl --szerokosc=1440 --motywy=light,dark \
  --rozwin-sekcje=1 --osiad-po-rozwinieciu=1500 --klik-po-rozwinieciu=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-podglad-kontrast-artefakty/przed \
  --wynik-json=/private/tmp/ag-podglad-kontrast-artefakty/przed/wynik.json
```

Wynik: `wynik.json` → **37 węzłów `color-contrast`** rozłożonych na 28
kombinacji ekran×motyw (27 light + wait patrz tabela niżej — dokładny rozkład
w sekcji „Ekran → węzeł → komponent"). Zero innych typów naruszeń (sprawdzone
osobno — szum hosta ograniczony do `landmark-one-main`/`page-has-heading-one`/
`region`, poza zakresem tego dyżuru).

`wynik.json` daje tylko LICZBĘ węzłów per ekran/motyw — do lokalizacji
KONKRETNYCH węzłów (selektor, html, fg/bg, ratio) napisany osobny skrypt poza
repo: `/private/tmp/ag-podglad-kontrast-artefakty/wezly.mjs`
(`@axe-core/playwright`, ten sam przepływ co przyrząd: klik w wiersz → rozwiń
`[aria-expanded="false"]` (8 rund, jak `grafika-zrzuty.mjs`) → klik w wiersz
ponownie → 1500ms → `AxeBuilder({page}).include('#dev-render-root').analyze()`).

## Ekran → węzeł → komponent → plik → PRZED/PO

| # | Ekran | Motyw | Węzeł (skrócony) | Komponent | Plik | PRZED (fg/bg, ratio) | PO |
|---|-------|-------|-------------------|-----------|------|------------------------|-----|
| 1 | execution-tab-control | light | `.opacity-70` w chipie Relations „Wysoka pewność · Odwracalna" (×2) | `PreviewRelations` (wartość chipa) | `src/components/shared/PreviewPane/PreviewRelations.tsx` | #7c8795/#f8fafc, 3.48:1 | usunięto `opacity-70` → dziedziczy `tone` (slate-600), 7.24:1 |
| 2 | execution-tab-list | light | `text-c-text-muted` „56%" (ProgressBar cell) w zaznaczonym wierszu | token tabeli | `src/index.css` (`td .text-c-text-muted`) | #64748b/#ebecec, 4.02:1 | `--c-text-muted-table` (#475569), 6.40:1 |
| 3 | execution-tab-list | dark | plakietka „Przykład" (DEC-120/A10 sample badge) | `ExecutionHub` (kolumna name) | `src/components/Execution/ExecutionHub.tsx` | #ed5541/#342437, 4.11:1 | `dark:text-danger-300`, 7.6–10:1 |
| 4 | mywork-inbox | light | „System" (truncate, dziedziczy muted) w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#f1f1f2, 4.21:1 | `--c-text-muted-table`, 6.71:1 |
| 5 | mywork-inbox | light | chip Relations „Powiązane zadanie" (`tone` emerald) | `InboxContent` (relationItems) | `src/components/MyWork/InboxContent.tsx` | #388a22/#f8fafc, 4.15:1 | `text-emerald-700`, 6.62:1 |
| 6 | vault-sejf-wnetrze | light | data „1 sie 2026" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 7 | meetings-module | light | „NordFood — hala A" (truncate) w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 8 | results-vnext-kpi-registry | light | „OEE-LINIA-PAKOWANIA" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 9 | results-vnext-kpi-registry | light | „proc-produkcja-1" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 10 | results-vnext-kpi-registry | light | data „8 sie 2026" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 11 | results-vnext-kpi-scorecards | light | data „2 maj 2026" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 12 | results-vnext-okr-objectives | light | data „6 sie 2026" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 13 | results-vnext-roi-full-tool | light | data „10 sie 2026" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 14 | results-vnext-roi-model | light | data „15 lip 2026" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 15 | results-vnext-roi-pir-outcomes | light | data „15 lip 2026" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 16 | results-vnext-roi-registry | light | data „7 sie 2026" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 17 | finance-hub | light | „STM" (font-mono, kod) w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#eaebec, 3.98:1 | 6.35:1 |
| 18 | materialy-draft-template-visibledraft-fix | light | data „28 lip 2026" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 19 | materialy-template-library-slice | light | data „20 lip 2026" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 20 | audyty-piec-powierzchni | light | „QMS-ELMAX-2026" (font-mono) w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 21 | chat-signals-feed | light | „Metalpol: Anna Kowalska…" (truncate) w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecee, 4.02:1 | ~6.4:1 |
| 22 | chat-signals-feed | light | plakietka „Blokada" (`text-c-danger`) w zaznaczonym wierszu | token tabeli | `src/index.css` | #e80538/#ebecee, 3.93:1 | `--c-danger-table` (#c1042f), 5.34:1 |
| 23 | chat-signals-feed | dark | plakietka „Blokada" w zaznaczonym wierszu | token tabeli | `src/index.css` | #ed5565/#21293b, 4.21:1 | `--c-danger-table` (dark, #f06f5e), 4.94:1 |
| 24 | admin-command-attention-queue | light | plakietka „Krytyczna" (`text-c-danger`) — wiersz pod kursorem (brak `bg-state-selected`, tylko `hover:bg-state-hover`) | token tabeli | `src/index.css` | #e80538/#f1f1f2, 4.12:1 | 5.59:1 |
| 25 | admin-command-attention-queue | light | „Panel kondycji usług" (title=URL) — hover | token tabeli | `src/index.css` | #64748b/#f1f1f2, 4.21:1 | 6.71:1 |
| 26 | admin-command-attention-queue | light | data „03/09/2026 16:53" — hover | token tabeli | `src/index.css` | #64748b/#f1f1f2, 4.21:1 | 6.71:1 |
| 27 | admin-command-attention-queue | dark | plakietka „Krytyczna" — hover | token tabeli | `src/index.css` | #ed5565/#1d2437, 4.47:1 | ~5.2:1 |
| 28 | admin-command-dlp | light | plakietka „Krytyczna" (font-medium) — hover | token tabeli | `src/index.css` | #e80538/#f1f1f2, 4.12:1 | 5.59:1 |
| 29 | admin-command-dlp | dark | plakietka „Krytyczna" — hover | token tabeli | `src/index.css` | #ed5565/#1d2437, 4.47:1 | ~5.2:1 |
| 30 | model-catalog-table | light | „gpt-4o" (font-mono) w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 31 | model-catalog-table | light | plakietka Kind „TEXT_LLM" (`bg-blue-500/10`) w zaznaczonym wierszu | `ModelRegistry` (badge styles) | `src/components/SuperAdmin/ModelRegistry/types.ts` | #4f62a2/#dee0e6, 4.41:1 | `text-blue-700`, 8.76:1 |
| 32 | model-catalog-table | light | „128K ctx" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 33 | partner-settlements-view | light | „(15%)" w zaznaczonym wierszu | token tabeli | `src/index.css` | #64748b/#ebecec, 4.02:1 | 6.40:1 |
| 34 | partner-earnings-filled | light | „(15%)" — wiersz pod kursorem (brak `bg-state-selected` w tej tabeli) | token tabeli | `src/index.css` | #64748b/#f0f0f2, 4.18:1 | 6.66:1 |
| 35 | partner-referral-tools-empty | light | „newsletter / email" — wiersz pod kursorem | token tabeli | `src/index.css` | #64748b/#f0f0f2, 4.18:1 | 6.66:1 |
| 36 | partner-referral-tools-filled | light | „newsletter / email" — wiersz pod kursorem | token tabeli | `src/index.css` | #64748b/#f0f0f2, 4.18:1 | 6.66:1 |

Wiersz 1 obejmuje 2 węzły (oba chipy Relations execution-tab-control); razem
z pozostałymi 35 wierszami = 37 zmierzonych węzłów `color-contrast` PRZED.

Uwaga do wiersza „wiersz pod kursorem": trzy tabele (`admin-command-*`,
`partner-earnings-filled`, `partner-referral-tools-*`) NIE mają statycznej
klasy `bg-state-selected` na wierszu — używają wyłącznie `hover:bg-state-hover`.
Klik-w-wiersz w przyrządzie zostawia kursor myszy nad wierszem (Playwright
`.click()` pozycjonuje kursor na środku elementu i nie odsuwa go), więc
`:hover` jest aktywne w chwili skanu axe — realny stan, jaki zobaczy
użytkownik po kliknięciu bez odsunięcia myszy. Naprawa `td .text-c-text-muted`
/ `td .text-c-danger` w `src/index.css` działa niezależnie od MECHANIZMU
podświetlenia wiersza (statyczna klasa `bg-state-selected`, `:hover`, albo
własny stan jak w `mywork-inbox`/`InboxContent`) — selektor jest po tagu `td`,
nie po klasie stanu wiersza.

## Naprawa — grupy komponentów (kolejność commitów)

1. **`src/index.css`** (23 ekrany, wspólny token) — `--c-text-muted-table` /
   `--c-danger-table` (nowe, wąskie tokeny per wzorzec
   `--c-focus-solid-on-tint`), skonsumowane regułą `td .text-c-text-muted` /
   `td .text-c-danger` w `@layer base`. Nie zmieniono `--c-text-muted`/
   `--c-danger` samych — mają dziesiątki wywołań poza tabelami.
2. **`src/components/shared/PreviewPane/PreviewRelations.tsx`** (1 ekran,
   wspólny komponent Relations) — usunięcie `opacity-70` z wartości chipa.
3. **`src/components/Execution/ExecutionHub.tsx`** (1 ekran) — plakietka
   „Sample"/„Przykład": `dark:text-danger-400` → `dark:text-danger-300`.
4. **`src/components/MyWork/InboxContent.tsx`** (1 ekran) — `tone` chipa
   „Linked task": `text-emerald-600` → `text-emerald-700`.
5. **`src/components/SuperAdmin/ModelRegistry/types.ts`** (1 ekran) —
   plakietki Kind/Provider „TEXT_LLM"/„local": `text-blue-600` →
   `text-blue-700` (light; dark bez zmian).

## Commity (gałąź `agent/podglad-kontrast-20260903`)

```
fb2f003e02 fix(a11y): podgląd — kontrast tokeny tabeli text-c-text-muted/text-c-danger (23 ekrany)
939d0c934a fix(a11y): podgląd — kontrast PreviewRelations wartość chipa (execution-tab-control)
5c3ad70d83 fix(a11y): podgląd — kontrast plakietka „Sample" (execution-tab-list, dark)
950a67ed35 fix(a11y): podgląd — kontrast tone „Powiązane zadanie" (mywork-inbox)
8b89821cbf fix(a11y): podgląd — kontrast plakietka TEXT_LLM/local (model-catalog-table)
```

## Weryfikacja PO

Po każdej grupy zmian (HMR na `npx vite --config dev-render/vite.config.ts
--port 5344`) ponowny przejazd `wezly.mjs` na wszystkich 28 kombinacji
ekran×motyw z PRZED → **0/28 z naruszeniami** (plik surowy:
`/private/tmp/ag-podglad-kontrast-artefakty/wezly-wynik-po1.jsonl`).

Formalna weryfikacja PO przez `grafika-zrzuty.mjs`, WSZYSTKIE 24 ekrany,
z trzema flagami, w 2 lokalizacjach:

```
# pl, 1440px, light+dark
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5344 \
  --ekrany=<24 ekrany, jak wyżej> \
  --katalog=pk-po-pl1440 --faza=PO --jezyk=pl --szerokosc=1440 --motywy=light,dark \
  --rozwin-sekcje=1 --osiad-po-rozwinieciu=1500 --klik-po-rozwinieciu=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-podglad-kontrast-artefakty/po-pl1440 \
  --wynik-json=/private/tmp/ag-podglad-kontrast-artefakty/po-pl1440/wynik.json

# en, 1024px, light+dark
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5344 \
  --ekrany=<24 ekrany, jak wyżej> \
  --katalog=pk-po-en1024 --faza=PO --jezyk=en --szerokosc=1024 --motywy=light,dark \
  --rozwin-sekcje=1 --osiad-po-rozwinieciu=1500 --klik-po-rozwinieciu=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-podglad-kontrast-artefakty/po-en1024 \
  --wynik-json=/private/tmp/ag-podglad-kontrast-artefakty/po-en1024/wynik.json
```

Wynik: **0 węzłów `color-contrast`** w obu `wynik.json` (pl-1440: 48
renderów, en-1024: 48 renderów = 96 łącznie). Porównanie WSZYSTKICH typów
naruszeń PRZED→PO (nie tylko color-contrast): `{'color-contrast': 37}` →
`{}` — zero nowych typów naruszeń wprowadzonych naprawą.

Zrzuty wizualne (kontrola regresji WZROKIEM, nie tylko liczbą) sprawdzone
ręcznie na: `execution-tab-control` light (chip Relations — etykieta+wartość
nadal czytelnie odróżnione przez `font-medium`), `model-catalog-table` light
(plakietka TEXT_LLM w podglądzie — ciemniejszy, wciąż wyraźnie niebieski),
`mywork-inbox` light (chip „Powiązane zadanie" — nadal czytelnie zielony),
`execution-tab-list` dark (plakietka „PRZYKŁAD" — nadal czytelnie
czerwona/ostrzegawcza). Brak regresji wizualnej w żadnym z czterech.

## Ścieżki surowe

- Worktree: `/private/tmp/ag-podglad-kontrast` (gałąź `agent/podglad-kontrast-20260903`)
- Vite dev server: port 5344 (uruchomiony ręcznie w tle, PID zapisany lokalnie w sesji)
- Pomiar PRZED: `/private/tmp/ag-podglad-kontrast-artefakty/przed/` (`wynik.json` + zrzuty `pk-przed/`)
- Skrypt lokalizujący węzły: `/private/tmp/ag-podglad-kontrast-artefakty/wezly.mjs`
- Surowe dane węzłów PRZED: `/private/tmp/ag-podglad-kontrast-artefakty/wezly-wynik.jsonl` (37 wierszy)
- Surowe dane węzłów PO (pierwszy przejazd, 28 kombinacji z PRZED): `/private/tmp/ag-podglad-kontrast-artefakty/wezly-wynik-po1.jsonl` (28× „ZERO naruszeń")
- Pomiar PO formalny (pl-1440): `/private/tmp/ag-podglad-kontrast-artefakty/po-pl1440/` (`wynik.json` + zrzuty `pk-po-pl1440/`)
- Pomiar PO formalny (en-1024): `/private/tmp/ag-podglad-kontrast-artefakty/po-en1024/` (`wynik.json` + zrzuty `pk-po-en1024/`)

## Co zostało otwarte

Nic w zakresie color-contrast — 0/0 na wszystkich zmierzonych 24 ekranach w
4 kombinacjach język/szerokość/motyw. Poza zakresem tego dyżuru (nie
dotknięte, nie zmierzone jako regresja): dług `check-focus-canon` (crimson
jako fokus, 109 plików — istniejący przed tym dyżurem, niezmieniony przez
te commity, zgłoszony przez hook informacyjnie przy każdym commicie).
