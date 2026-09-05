# Odbiór na żywo 05.09 — strona `/zywo` w serwerze odbioru

Gałąź: `agent/odbior-zywo-strona-20260905` (worktree `/private/tmp/ag-odbior-zywo-strona`,
z `origin/m03`, jak zlecono). Commity:

1. `feat(odbior): dodaj strone /zywo do porownania zatwierdzone vs na zywo 05.09`
2. `test(odbior): dodaj testy node:test dla strony /zywo (odbiorZywo.mjs)`

## Co dodane

Cel: właściciel odbiera MVP 05.09 i dla każdego ekranu A/B chce zobaczyć obok siebie
obraz **zatwierdzony** (jasny motyw) i **zrzut z realnej aplikacji**, plus werdykt i opis
różnicy — bez ufania samej deklaracji „zgodne".

### 1. `scripts/dev/lib/odbiorZywo.mjs` (nowy plik)

Logika i HTML strony `/zywo`, wydzielone z `odbior-serwer.mjs` (ten sam wzorzec co
`lib/kartyModulow.mjs` + `lib/stylModulow.mjs` dla widoku modułowego) — żeby dało się
przetestować budowanie strony bez uruchamiania serwera HTTP.

- `indeksWynikowZywo(zywoDir)` — czyta i scala **wszystkie**
  `evidence/odbior-zywo-<data>/<katalog>/wyniki.json` w jedną mapę `id → wynik`.
  Brak katalogu głównego, brak pliku, zepsuty JSON, wpis bez `id` — każdy przypadek
  jest cicho pomijany (dane produkują równolegle inni agenci, więc katalog może jeszcze
  nie istnieć albo być w trakcie zapisu).
- `indeksZatwierdzonychLight(evidGrafikaDir)` — dla każdego id ekranu szuka najnowszego
  (po `mtime`, nie po kolejności katalogów — ta sama pułapka co w `indeksZrzutow()` w
  `odbior-serwer.mjs`, katalogi `evidence/grafika/*` sortują się tekstowo) pliku
  `<id>*light*.png` w drzewie `evidence/grafika/`.
- `liczZywe(ekranyAB, wyniki)` — liczniki nagłówka: razem, ZGODNY, ROZNI_SIE,
  NIE_DOTARLEM, BRAK (brak wyniku ≠ żaden werdykt — zero pomiaru nie jest wynikiem).
- `kartaZywo(e, wynik, zatwLight, ctx)` — jedna karta ekranu: nazwa + id, ocena A/B,
  werdykt jako etykieta (albo „BRAK WYNIKU (jeszcze nie sprawdzony)"), opis różnicy,
  trasa i kliki (jeśli podane), dwa obrazy obok siebie (max-width 50% każdy, klik = pełny
  rozmiar w nowej karcie), uwaga właściciela z `ODBIOR_DECYZJE.json` (odbiór grafiki) pod
  spodem, pole decyzji „na żywo".
- `stronaZywo(params)` — cała strona: nagłówek z licznikami, filtr (wszystkie / tylko
  różnice / tylko nie dotarłem), moduł po module w kolejności **z pliku** `status.json`
  (`status.moduly` jest już w ustalonej kolejności menu — pole `_kolejnosc` w pliku jest
  opisem słownym tej kolejności, nie osobną tablicą do sortowania, więc nie ma czego
  dodatkowo sortować).
- Kolor: neutralny wszędzie, czerwień (`--zle: #9f1239`) wyłącznie dla `ROZNI_SIE` —
  zgodnie z zasadą UI#3 z `CLAUDE.md`.

### 2. `scripts/dev/odbior-serwer.mjs` (zmiana)

- `GET /zywo` — renderuje `stronaZywo(...)`, czytając `status.json` na żywo (jak reszta
  serwera), uwagi właściciela z istniejącej tabeli `decyzje`, i nową tabelę `decyzje_zywo`.
  Błąd renderu nie zabija serwera (ten sam wzorzec co główna strona i `/moduly`).
- Nowa tabela SQLite `decyzje_zywo(ekran TEXT PRIMARY KEY, decyzja, uwaga, kiedy)` w tej
  samej bazie `docs/program/grafika/odbior.sqlite` — osobna od `decyzje`, bo dotyczy innej
  rzeczy (stan na żywo, nie sama grafika/projekt).
- `POST /decyzja-zywo` — zapisuje `{decyzja, uwaga}` dla ekranu (ten sam
  insert-or-update na `PRIMARY KEY` co istniejący `zapiszDecyzje`), po każdym zapisie
  eksportuje całą tabelę do `docs/program/grafika/ODBIOR_ZYWO_DECYZJE.json`.
- `GET /ev/<ścieżka>` — serwuje PNG z **całego** `evidence/` (nie tylko
  `evidence/grafika` jak istniejący `/png/`, bo zrzuty „na żywo" leżą pod
  `evidence/odbior-zywo-<data>/`). Zabezpieczenia: tylko odczyt, tylko plik kończący się
  na `.png`, tylko ścieżka wewnątrz `EVIDENCE_ROOT` (sprawdzone `path.resolve` +
  `startsWith(EVIDENCE_ROOT + path.sep)` — przetestowane ręcznie przeciwko `../../etc/passwd`
  zarówno w formie surowej, jak i URL-encoded, patrz niżej).
- Istniejące trasy (`/`, `/moduly`, `/decyzja`, `/decyzja-modulu`, `/png/`) nietknięte.

Front strony `/zywo` używa tego samego wzorca debounce co strona główna: uwaga zapisuje
się 800 ms po ostatnim znaku, natychmiast przy `focusout`, i przez `sendBeacon` przy
zamknięciu karty/przeglądarki — żeby nic nie zginęło.

## Skąd biorą się dane

- `evidence/odbior-zywo-20260905/<katalog>/wyniki.json` — produkują je równolegle inni
  agenci (nie ten dyżur). W chwili tej pracy katalog **nie istniał jeszcze** w repo — co
  jest zgodne ze zleceniem („na start może nie istnieć — obsłuż brak") i zostało
  zweryfikowane: serwer z pustym/brakującym katalogiem zwraca `200` i pokazuje
  wszystkie 258 ekranów A/B jako „BRAK WYNIKU (jeszcze nie sprawdzony)".
- Obraz zatwierdzony: najnowszy `evidence/grafika/**/<id>*light*.png` po `mtime` —
  ten sam katalog co reszta odbioru grafiki, nic nowego nie trzeba tam wrzucać.

## Test

`tests/unit/dev/odbior-zywo-strona.test.mjs` (node:test, `git add -f` — nowy plik w
`tests/`). 6 testów, wszystkie zielone:

```
node --test tests/unit/dev/odbior-zywo-strona.test.mjs
# ✔ indeksWynikowZywo: brak katalogu evidence/odbior-zywo-* nie wywala niczego, zwraca pustą mapę
# ✔ indeksWynikowZywo: scala wyniki.json z wielu katalogów, pomija zepsuty JSON i wpisy bez id
# ✔ indeksZatwierdzonychLight: wybiera najnowszy plik *light*.png per id, ignoruje dark i inne id
# ✔ liczZywe: liczy ZGODNY/ROZNI_SIE/NIE_DOTARLEM/BRAK po ekranach A/B
# ✔ stronaZywo: katalog evidence/odbior-zywo-* jeszcze nie istnieje — strona buduje się bez wyjątku, wszystko BRAK WYNIKU
# ✔ stronaZywo: liczniki i etykiety werdyktów odpowiadają danym z wyniki.json, obrazy się linkują
# tests 6, pass 6, fail 0
```

Testy budują HTML z przykładowym `wyniki.json` w katalogach tymczasowych
(`os.tmpdir()`, sprzątane po każdym teście), bez uruchamiania serwera HTTP — sprawdzają
liczniki nagłówka, etykiety werdyktów (`ZGODNY`, `RÓŻNI SIĘ`, `NIE DOTARŁEM`, `BRAK WYNIKU`),
linki do obrazów (`/ev/...`), przeniesienie uwagi właściciela z `ODBIOR_DECYZJE.json`, oraz
że ekran oceny `C` nigdy nie trafia na stronę.

## Uruchomienie i weryfikacja na żywym porcie 3031

```
PORT_ODBIOR=3031 node scripts/dev/odbior-serwer.mjs
```

Wynik (proces uruchomiony w tle, zatrzymany po teście przez `kill <PID>`, **nie**
`pkill` — instancja na 3030 nietknięta):

```
$ curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3031/zywo
200
$ curl -s http://127.0.0.1:3031/zywo | head -c 300
<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Na żywo 05.09 — zatwierdzone vs jak jest</title>...
```

Dodatkowo zweryfikowano ręcznie:
- `GET /` i `GET /moduly` dalej zwracają `200` (istniejące trasy nietknięte).
- `<b>258</b> ekranów A/B` w nagłówku, `BRAK WYNIKU (jeszcze nie sprawdzony)` 258×
  (bo `evidence/odbior-zywo-20260905/` jeszcze nie istnieje na tej gałęzi).
- `POST /decyzja-zywo` zapisuje do `decyzje_zywo` i eksportuje
  `docs/program/grafika/ODBIOR_ZYWO_DECYZJE.json` natychmiast (zweryfikowano treścią pliku).
- `GET /ev/grafika/<realny-plik>__PO__light.png` → `200`.
- `GET /ev/../../etc/passwd` (surowo, `curl --path-as-is`, bo bez tej flagi curl sam
  normalizuje `..` przed wysłaniem) → `404 nie ma`; to samo dla wariantu URL-encoded
  (`%2e%2e`) — poddrzewo `evidence/` nie jest wyjściowe.
- Artefakty testowe (`docs/program/grafika/odbior.sqlite`,
  `docs/program/grafika/ODBIOR_ZYWO_DECYZJE.json` powstałe z ręcznego smoke-testu)
  posprzątane po weryfikacji — nie ma ich w commitach.

## Ograniczenia i co NIE jest zrobione w tym dyżurze

- Dane wejściowe (`evidence/odbior-zywo-20260905/*/wyniki.json`) produkują inni agenci
  równolegle — ta praca dostarcza WYŁĄCZNIE stronę-konsumenta. Dopóki te pliki nie
  powstaną, strona jest w pełni funkcjonalna, ale pokazuje same „BRAK WYNIKU".
- Data `20260905` jest wpisana na sztywno (stała `ZYWO_DIR` w `odbior-serwer.mjs`) —
  zgodnie z zakresem zlecenia („NA ŻYWO 05.09"), nie generyczna dla dowolnej daty.
- Widok modułowy (`/moduly`) i główna strona odbioru grafiki nie mają linku do `/zywo`
  — zlecenie nie prosiło o wpięcie nawigacji między widokami, więc tego nie dodawałem
  (żeby nie ryzykować zepsucia istniejącego paska filtrów).
- Nie testowałem współbieżnego zapisu dwóch przeglądarek na `/decyzja-zywo` — mechanizm
  jest identyczny (insert-or-update na PRIMARY KEY) jak sprawdzony już w produkcji
  mechanizm głównej tabeli `decyzje`.

## Pliki zmienione/dodane

- `scripts/dev/lib/odbiorZywo.mjs` (nowy)
- `scripts/dev/odbior-serwer.mjs` (zmiana: import, stałe `EVIDENCE_ROOT`/`ZYWO_DIR`/
  `ODBIOR_ZYWO_DECYZJE`, tabela `decyzje_zywo`, funkcje `czytajDecyzjeZywo`/
  `zapiszDecyzjeZywo`, trasy `GET /zywo`, `POST /decyzja-zywo`, `GET /ev/`)
- `tests/unit/dev/odbior-zywo-strona.test.mjs` (nowy, dodany `git add -f`)
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/AGENT_ODBIOR_ZYWO_STRONA_20260905.md` (ten raport)
