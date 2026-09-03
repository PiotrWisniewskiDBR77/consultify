# Skrzynka + pasek nawigacji — trzy defekty Mojej Pracy — 2026-09-03

Robotnik `agent/mw-skrzynka-pasek-20260903`, worktree `/private/tmp/ag-mw-skrzynka`
(z `/private/tmp/m03`), harness `dev-render` na porcie 5420. Zadanie: pozycje
`MYW-PHOTO-002`, `MYW-PHOTO-003`, `MYW-PHOTO-005` z
`docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` (wiersze 24/28/29).
Źródło dokładnego brzmienia:
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md`
i `docs/program/waves/WAVE_03_ACCEPTANCE/ROZLICZENIE_P0P1_20260903.md`.

Zrzuty leżą POZA repo (poleceniem zlecenia): `/private/tmp/ag-mw-skrzynka-artefakty/`
— jeśli katalog zniknie, powtórz pomiar poleceniami w sekcji „Jak odtworzyć"
niżej; ten plik jest dowodem trwałym (SHA commitów + cytaty), PNG-i są
pomocą wizualną sesji.

## Ustalenie wstępne, które zmieniło zakres obu pozostałych pozycji

`MYW-PHOTO-003` cytuje jako dowód częściowej naprawy: „Gradient
`ScrollAffordance` was added (`MyWorkNav.tsx:164–176`, used at `:285–286`),
but there is no canonical `More`/overflow menu or safe grouping." —
**ten kod nigdy się nie renderuje**. Zmierzone:

```
grep -rn "<MyWorkNav" src/          →  0 trafień poza samym MyWorkNav.tsx
grep -rn "isMyWorkTwoLevelNavEnabled" src/  →  1 trafienie (własna definicja,
                                                 nigdy nie wywołana)
```

`MyWorkNav.tsx` to gotowy, przetestowany komponent dwupoziomowej nawigacji
(M02-P01) za flagą `isMyWorkTwoLevelNavEnabled()` (`src/utils/myWorkTwoLevelNavFlag.ts`,
domyślnie OFF) — ale `MyWorkHub.tsx` NIGDZIE nie sprawdza tej flagi ani nie
montuje `<MyWorkNav>`. To jest ÓSMY kształt fałszywego „gotowe" („wołacz
istnieje ≠ renderuje się"): dowód w dokumencie akceptacyjnym wskazuje na
kod, który klient nigdy nie widzi. Realny pasek, który się renderuje, to
pojedynczy wiersz `tabs.map(...)` w `MyWorkHub.tsx` („Main Navigation Row")
+ osobny prawy klaster (Menu 2) — **żaden z nich nie miał AFFORDANCE**, tylko
cienki stylowany scrollbar (`app-table-scrollbar`) bez żadnego wizualnego
sygnału, że coś jest ucięte.

## Tabela: pozycja · PRZED · PO · commit · zrzuty

| Pozycja | PRZED (zmierzone) | PO (naprawione) | Commit | Zrzuty |
|---|---|---|---|---|
| `MYW-PHOTO-002` (reszta, P0) | 401/403 renderowały identyczny ogólny komunikat „Coś poszło nie tak / Nie udało się załadować Inbox / Spróbuj ponownie" — nie do odróżnienia od pustej skrzynki ani od zwykłego błędu sieci | 401/403 → osobny tytuł „Nie masz dostępu do tej skrzynki" + wskazówka co zrobić, BEZ przycisku „Spróbuj ponownie" (retry nie naprawi uprawnień); pusta skrzynka → osobny, spokojny komunikat „Brak elementów w skrzynce" | `71ccfbe005` | `photo002-brak-dostepu/…PRZED…`, `…PO…`, `photo002-pusty/…PO…` (light+dark, 1440) |
| `MYW-PHOTO-003` (P1) | Pasek zakładek i prawy klaster Menu 2 twardo ucinają ostatnią pozycję („Se…" zamiast „Sejf klienta" @1024px; ikona „Decyzje" w połowie @768px) — ZERO wizualnego sygnału przewijalności | Fade + chevron na obu krawędziach obu wierszy, widoczny dokładnie gdy jest coś do przewinięcia (mierzone `scrollWidth-clientWidth`) | `761e128ef1` | `photo003-1024/…PRZED/PO…`, `photo003-768/…PRZED/PO…` (light+dark) |
| `MYW-PHOTO-005` (P1) | — | **Zmierzone jako JUŻ NAPRAWIONE** dla ekranu Skrzynki: zero zagnieżdżonych pionowych scroll-containerów @1024/768, stan pusty/pełny — patrz sekcja niżej. Zero kodu zmienione. | — (weryfikacja, nie naprawa) | pomiar Playwright, nie zrzut |

## MYW-PHOTO-002 — szczegóły

Uwaga właściciela (cytat z `MODULE_ACCEPTANCE.md`, `MYW-PHOTO-002`): „Empty
Inbox always announces 'Everything processed. Great job!' even when zero
could mean out-of-tenant-scope, missing fixture, API error or unavailable
data." Kopia pustej skrzynki była już naprawiona 2026-08-25 (Fala 1, commit
sprzed tej sesji). Pozostała otwarta część, cytat z tego samego wiersza:
„**Still open:** there is still no distinct access-denied/unavailable
branch — a genuinely-empty successful query and a silently-scoped-to-nothing
query render identically; that needs a backend signal this endpoint does
not currently expose."

To zdanie miesza DWA różne przypadki:

1. **200 z pustą tablicą, scoped-to-nothing** (zły najemca/projekt zwraca
   pustą, ale "poprawną" odpowiedź) vs **200 z pustą tablicą, naprawdę pusto**
   — TEGO faktycznie nie da się odróżnić bez nowego sygnału backendu (poza
   zakresem tego dyżuru, FALA_2/FALA_3, zgodnie z dokumentem).
2. **401/403, żądanie faktycznie ODRZUCONE** — TO już było dostępne: klient
   (`services/api.ts:1104-1105`) ustawia `err.status = res.status` na każdym
   rzuconym błędzie, ale `InboxContent.tsx`'s `fetchInbox` catch-block tego
   pola nie czytał — każdy błąd (401/403/500/sieć) dostawał identyczny,
   ogólny komunikat.

Naprawiono (2): `InboxContent.tsx` teraz czyta `err.status`; 401/403 →
`myWork.inboxContent.accessDeniedTitle`/`accessDeniedMessage` (nowe klucze
i18n pl+en), bez przycisku retry. Wszystko inne (500, sieć, timeout) →
bez zmian, nadal generyczny błąd + retry. (1) pozostaje otwarte i wymaga
backendu — nie ruszone, zgodnie z zakresem.

Harness: `dev-render/screens/mywork-inbox.tsx` dostał parametr `?stan=`
(`pelny`/`pusty`/`brak-dostepu`) — poprzednio nie dało się wymusić żadnego
z tych trzech stanów z linii poleceń.

## MYW-PHOTO-003 — szczegóły

Uwaga właściciela (cytat, `MYW-PHOTO-003`): „Level-2 menu overflows at
1280px with a native horizontal scrollbar; controls are cramped at the
right edge." Jak wyżej — dowód w dokumencie wskazywał na `MyWorkNav.tsx`,
kod nigdy niemontowany. Naprawiono REALNY pasek: `MyWorkHub.tsx`'s Main
Navigation Row (`tabs.map`) i prawy klaster Menu 2. Wydzielono
`useScrollEdges` (hook mierzący `scrollWidth`/`clientWidth`/`scrollLeft`) i
`ScrollEdgeFade` (gradient + chevron) do `src/components/MyWork/shared/` —
ta sama konstrukcja projektowa co w `MyWorkNav.tsx`, ale jako wspólny,
faktycznie używany prymityw zamiast trzeciej kopii martwego kodu.

Zero nowych naruszeń a11y (axe, `--a11y=1`): 0/0 na 1024px i 768px,
light+dark (pełny JSON: `photo003-1024-wynik.json`, `photo003-768-wynik.json`
w tym samym katalogu poza repo).

## MYW-PHOTO-005 — pomiar, nie naprawa

Uwaga właściciela (cytat, `MYW-PHOTO-005`): „A nested vertical scroll gutter
is visible on the left over an empty surface; combined with the horizontal
nav scrollbar it reads as a broken view." `ROZLICZENIE_P0P1_20260903.md`
rozszerza to na: „no single owned scroll container across
`MyWorkNav.tsx:259/301` and inner content containers; not verified across
empty/table/open-workspace states."

Skrypt Playwright (scratchpad, `count-scroll-containers.mjs`) policzył
elementy w `#dev-render-root`, gdzie `computedStyle.overflowY` jest
`auto`/`scroll` ORAZ `scrollHeight > clientHeight` (czyli REALNIE
zagnieżdżony, aktywny pionowy scroll-container, nie tylko klasa CSS):

| Szerokość | Stan | Wysokość okna | Pionowych scroll-containerów |
|---|---|---|---|
| 1024px | pełny (9 pozycji) | 800px | **0** |
| 1024px | pusty | 800px | **0** |
| 768px | pełny | 800px | **0** |
| 768px | pusty | 800px | **0** |
| 1024px | pełny | 500px (wymuszone realne przepełnienie) | **1** — dokładnie kolumna listy `InboxContent` (`flex-1 min-w-0 overflow-y-auto…`), `document.body`/`documentElement` NIE przewijają się wcale |

Wniosek: na ekranie Skrzynki pasek nawigacji (Main Navigation Row) siedzi
POZA jedynym kontenerem przewijania — nie ma własnego `overflow`, więc jest
efektywnie przyklejony (sticky-by-construction we `flex flex-col h-full`),
a treść ma dokładnie JEDEN właściciel scrolla. To dokładnie kształt, o który
prosi zlecenie („nav i treść w jednym scroll-containerze albo nav
przyklejony"). Ta konkretna, zagnieżdżona pionowa rynna z cytatu właściciela
była już naprawiona wcześniej (commit `5e97da627e`, „fix(mywork): stop
nesting a second scroll container under Inbox", 2026-08-25 — `inbox` dodane
do `workspaceOwnsScroll` w `getMyWorkMainContentClassName`). Zero kodu
zmienione w tym dyżurze dla tej pozycji — pomiar obala twierdzenie
`ROZLICZENIE`'s „NIEZROBIONE" dla zakresu, jaki dało się zmierzyć (ekran
Skrzynki, 768/1024, pusty/pełny).

**Czego NIE zmierzono**: inne zakładki (Zadania/Decyzje/Idee/Notatnik) mają
WŁASNY wpis w `workspaceOwnsScroll` (tylko `calendar`, `inbox`, i
`ideas`+table) — pozostałe dostają domyślny `overflow-y-auto` na wrapperze.
Czy KTÓRAŚ z nich renderuje wewnątrz WŁASNY dodatkowy scroll (analogiczny
błąd jak przed naprawą 5e97da627e) — nienmierzone, poza zakresem zlecenia
(dostępny harness to tylko `mywork-inbox`).

## Znalezisko poza zakresem — zgłoszone osobno

Trzeci poziomy pasek (`renderCommandRow()` → filtry Skrzynki:
Wszystkie/Zaległe/Zapisane/AI/…/„Ten tydz.") overflow'uje przy 768px BEZ
żadnego affordance — ten sam kształt defektu co `MYW-PHOTO-003`, ale to
inny komponent (`QuickFilterBar`, poza wskazanym zakresem `MyWorkNav.tsx`/
Main Navigation Row). Zgłoszone jako osobne zadanie (spawn_task), żeby nie
poszerzać tego dyżuru bez zlecenia.

## Czego NIE zrobiono

- `MYW-PHOTO-002`, luka (1) — prawdziwe rozróżnienie „pusto po zakresie" vs
  „pusto naprawdę" wymaga nowego sygnału backendu; nie dotknięte.
- `MYW-PHOTO-005` — affordance dla `QuickFilterBar` (patrz wyżej, osobne
  zgłoszenie); scroll-topologia pozostałych zakładek (nie Skrzynki)
  niezmierzona.
- `MyWorkNav.tsx` (martwy kod za flagą OFF) pozostaje nietknięty — to osobna,
  świadoma decyzja produktowa (dwupoziomowa nawigacja czeka na akcept Piotra
  na zrzutach, `myWorkTwoLevelNavFlag.ts` komentarz), nie coś do „naprawienia"
  w tym dyżurze.

## Jak odtworzyć pomiar

```bash
cd /private/tmp/ag-mw-skrzynka
npx vite --config dev-render/vite.config.ts --port 5420 --strictPort &
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5420 \
  --ekrany=mywork-inbox --katalog=mw-skrzynka-pasek-20260903 --faza=PO \
  --motywy=light,dark --szerokosc=1024 --wysokosc=800 --a11y=1 \
  --parametry=stan=brak-dostepu \
  --wyjscie=/private/tmp/ag-mw-skrzynka-artefakty/photo002-brak-dostepu
```

Testy kontraktowe (blokują regresję źródła):
`src/components/MyWork/__tests__/InboxContent.photo002.contract.test.ts`,
`src/components/MyWork/__tests__/MyWorkHub.photo003.contract.test.ts`,
`src/components/MyWork/__tests__/MyWorkHub.photo005.contract.test.ts`,
`src/components/MyWork/shared/__tests__/ScrollEdgeFade.test.tsx`.
