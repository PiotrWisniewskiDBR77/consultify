# RN-G3 tor PLATFORMY — dowód wizualny (2026-08-11)

SHA bazowy: `0b161c7719` (worktree `/Users/piotrwisniewski/rn-g2-lanes/platform2`,
gałąź `rn-g3-lane-platform2`). Harness: `dev-render` na porcie 3614
(`npx vite --config dev-render/vite.config.ts --port 3614 --strictPort`).
Ekrany: `results-vnext-kpi-registry`, `results-vnext-roi-registry`,
`results-vnext-okr-registry` (REALNE komponenty produkcyjne, mock
`Api.get`/`Api.post`). `?theme=light|dark&lang=pl` — parametry natywne harnessu.

## `regression-baseline-lists/` — punkt 4 raportu: brak regresji na 3 ekranach

Widok listy (Menu 1/2/3 + tabela + preview domyślny), 1440×900, PL, light+dark,
dla wszystkich trzech ODEBRANYCH rejestrów. Porównane wzrokiem z bieżącym
stanem repo PRZED zmianami tego toru (kod list/tabel/Menu nie był dotykany w
żadnym z pięciu punktów zakresu) — brak różnicy w układzie, kolorach, typografii.

## `regression-kebab-d06/` — punkt 2 raportu: D06 nadpisuje R01

`before/` = zrzuty z tymczasowo przywróconym `RowActionsMenu.tsx` sprzed
commita `4c3b720891` (R01: powód blokady ukryty). `after/` = bieżący stan
(D06: powód widoczny). Kebab otwarty na REALNYM zablokowanym wierszu z
każdego z trzech rejestrów (KPI: KPI zarchiwizowane; ROI: sprawa
odrzucona/zaakceptowana/złożona do akceptacji — 7 zablokowanych pozycji
naraz; OKR: zestaw aktywny/szkic). W `before/` pozycje są wyszarzone BEZ
żadnego wyjaśnienia; w `after/` każda niesie zdanie-powód pod etykietą.
Metoda przywrócenia stanu `before`: `git show 0b161c7719:<plik>` tymczasowo
nadpisane na czas zrzutu, natychmiast przywrócone (`git diff --stat` czysty
po przywróceniu — zweryfikowane).

`before/kpi-kebab-locked-dark-pl.png` został pominięty: pierwsza próba
złapała przejściowy błąd modułu HMR (Vite w trakcie podmiany pliku) —
zrzut pokazywał `SyntaxError`, nie realny UI. Usunięty jako nie-dowód, nie
podmieniony na spreparowany.

## `preview-width-item5/` — punkt 5 raportu: szerokość podglądu 125%/1280

`roi-preview-<W>-<Z>.png`: `<W>` = deklarowany breakpoint (1440/1280), `<Z>`
= zoom (100/125). 125% symulowane jak REALNY zoom przeglądarki (Ctrl+) —
zmniejszenie efektywnego viewportu (`W/1.25`), NIE CSS `zoom` na elemencie
(które skaluje piksele bez reflow i myląco pokazuje przycięcie, którego
realny użytkownik nie zobaczy — pierwsza próba tej metody dała fałszywy
alarm, poprawiona przed zapisaniem dowodu).

Wynik: 1440@125% (efektywnie 1152px) — pełny reflow, panel `clamp(340px,
28%, 480px)` czytelny bez przycięcia (potwierdza fix R09-1, 2026-08-10,
już na bazie). 1280@100% — czysto. 1280@125% (efektywnie 1024px, sam brzeg
progu 1024–1280) — ostatnia kolumna tabeli wymaga przewinięcia poziomego
WEWNĄTRZ kontenera tabeli (`overflow-auto`, nie `overflow-hidden` —
treść osiągalna, nie ucięta bez wyjścia); kanon §19.1 przewiduje dla
1024–1280 przejście panelu w `⑯drawer`, czego `ResultsVNextRegistryShell`
nie implementuje — ISTNIEJĄCA luka architektoniczna, nienaprawiona w tym
przebiegu (naprawa = zmiana układu, nie łatka konserwatywna; zgłoszona w
raporcie, nie ukryta).
