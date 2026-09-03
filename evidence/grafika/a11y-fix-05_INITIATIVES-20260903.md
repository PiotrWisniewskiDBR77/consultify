# G06 — naprawa dostępności (axe), moduł 05_INITIATIVES — 2026-09-03

Robotnik naprawczy programu odbioru G06. Worktree `/private/tmp/ag-fix-a11y-05-08`,
gałąź `agent/fix-a11y-05-08-20260903`, harness na porcie 5331.

## Stan wiedzy na start

Poprzedni zbiorczy pomiar (`scripts/dev/_aggregate-g06.mjs`) odejmował błędnie
SZEŚĆ reguł zamiast trzech (`landmark-one-main`, `page-has-heading-one`, `region`),
więc jego liczby dla modułów 05-08 były zaniżone. Ten dokument opiera się
WYŁĄCZNIE na własnym pomiarze kanonicznym narzędziem
(`scripts/dev/grafika-zrzuty.mjs --a11y=1`), z domyślnym klikiem w pierwszy
wiersz i rozwinięciem sekcji.

## Blokada przed pomiarem PRZED (naprawiona osobnym commitem)

Pierwszy pomiar PRZED (na porcie 5331) trafił na **zacommitowane znaczniki
konfliktu git** w `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx`
(linie 110/117/118, `<<<<<<< HEAD` / `=======` / `>>>>>>> agent/fix-a11y-01-04-20260903`)
— pozostałość po wcześniejszym scaleniu w tej samej gałęzi macierzystej. Vite
zwracał 500 dla tego pliku, a importuje go `StandardPreview` na każdym ekranie
z podglądem, więc żaden domyślny klik w wiersz nie mógł otworzyć podglądu
(wszystkie 11/12 kadrów: „podgląd: BRAK", jeden zrzut w ogóle się nie wyrenderował
— timeout 60s na `capacity-advisor-a3` light).

Naprawa: usunięcie trzech linii znaczników (komentarz o naprawie kontrastu axe
zostaje), zweryfikowane `grep`-em (brak znaczników w pliku i w całym `src/`) i
`esbuild`. Osobny commit **650a1b1ab7** — `fix(preview): usun znaczniki
konfliktu w PreviewAIHintStrip`. Pomiar PRZED powtórzony od zera PO tej
naprawie — poniższe liczby pochodzą z powtórki, nie z pierwszego (skażonego)
przelotu.

## Wynik: PRZED → PO

| Ekran | PRZED (pl-1440, kadrów z realnym naruszeniem / 2) | PO (pl-1440) | PO (en-1024) |
|---|---|---|---|
| capacity-advisor-a3 | 0/2 | 0/2 | 0/2 |
| ev-football-field | 0/2 | 0/2 | 0/2 |
| exe-002-004-ui-audit | **2/2** | 0/2 | 0/2 |
| initiative-record | **2/2** | 0/2 | 0/2 |
| karta-initiative | 0/2 | 0/2 | 0/2 |
| plan-scenario-d1 | 0/2 | 0/2 | 0/2 |
| **Razem (kadrów z naruszeniem / 12)** | **4/12** | **0/12** | **0/12** |

Jedna reguła realna w całym module: `nested-interactive` (impact: `serious`,
24 węzły na każdy z 4 skażonych kadrów) — identyczna na obu ekranach i obu
motywach.

## Mapa: reguła → komponent → plik

**`nested-interactive`** — `SortableNavItem` w
`src/components/shared/NModeLayout/NModeLeftNav.tsx` (wspólny lewy panel
sekcji "Menu 1" dla wszystkich artefaktów typu Rekord — Inicjatywa, Decyzja,
Zadanie itd., patrz `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §10.2).

Przyczyna: uchwyt przeciągania sekcji (`dnd-kit` `useSortable().attributes` —
`role="button"`, `tabIndex`, obsługa klawiatury do reorderu) był renderowany
jako `<span {...attributes} {...listeners}>` ZAGNIEŻDŻONY wewnątrz
`<button onClick={() => onSectionChange(...)}>`. Dwie interaktywne kontrolki
jedna w drugiej — axe: „Interactive controls must not be nested".

Wystąpiło na `exe-002-004-ui-audit` i `initiative-record` (oba renderują
`InitiativeDocumentView` w trybie Edycji, gdzie uchwyt jest widoczny).
`karta-initiative` nie miał naruszenia mimo tego samego komponentu — renderuje
się w trybie Podgląd, gdzie uchwyt jest celowo ukryty (`!readMode`), więc
zagnieżdżenie nie powstaje.

## Naprawa

`SortableNavItem`: uchwyt przeciągania i przycisk wyboru sekcji są teraz
**rodzeństwem** w tym samym wierszu zamiast rodzic/dziecko. Tło, obramowanie
aktywnego stanu, `group` i hover przeniesione na wspólny `<div>` (hover na
divie odpala się już przy najechaniu na dowolne dziecko — zero zmiany
zachowania wizualnego); wewnętrzny `<button>` dostaje własny
`focus-visible:ring`. Zero zmiany layoutu — zweryfikowane zrzutem PO
(`initiative-record`, light+dark, 1440px): uchwyt nadal pierwszy, 12px
odstępy, pełna szerokość wiersza podświetlona na hover/aktywne jak wcześniej.

Commit: **7df001a343** — `fix(a11y): 05_INITIATIVES — nested-interactive w
lewej nawigacji artefaktu`.

## Komendy pomiaru

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5331 \
  --ekrany=capacity-advisor-a3,ev-football-field,exe-002-004-ui-audit,initiative-record,karta-initiative,plan-scenario-d1 \
  --katalog=05-initiatives-przed --faza=PRZED --jezyk=pl --szerokosc=1440 \
  --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=<poza repo> --wynik-json=<poza repo>/wynik.json

# analogicznie --faza=PO --jezyk=pl --szerokosc=1440
# analogicznie --faza=PO --jezyk=en --szerokosc=1024
```

## Surowe dane (poza repo, nie commitowane — screenshoty)

- `/private/tmp/ag-fix-a11y-05-08-artefakty/05_INITIATIVES/przed-pl-1440/`
- `/private/tmp/ag-fix-a11y-05-08-artefakty/05_INITIATIVES/po-pl-1440/`
- `/private/tmp/ag-fix-a11y-05-08-artefakty/05_INITIATIVES/po-en-1024/`

Każdy katalog zawiera `wynik.json` (maszynowo czytelny — `a11yNaruszenia[]`
per kadr, tylko `id`/`impact`/liczba węzłów; selektory i html węzłów
zdobyto osobnym diagnostycznym przelotem axe [nie commitowanym, replikującym
dokładnie tę samą sekwencję interakcji: motyw, `uwagi=0`, domyślny klik w
wiersz, rozwinięcie sekcji], bo kanoniczne narzędzie zapisuje tylko liczbę
węzłów, nie ich selektory).

## Konsola / błędy sieci

Brak błędów konsoli poza standardowym szumem 404 na `/api/**` (harness bez
backendu — ignorowane zgodnie z instrukcją). Brak innych błędów HTTP.

## Co NIE zostało naprawione i dlaczego

Nic — moduł 05_INITIATIVES ma 0 realnych naruszeń axe na wszystkich 6
ekranach, oba motywy, oba warianty język/szerokość (pl-1440, en-1024).
