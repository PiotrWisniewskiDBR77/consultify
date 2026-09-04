## ★★ UZUPEŁNIENIE DO SEKCJI „JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE" (wyżej)

Sekcja wyżej obowiązuje w całości. Poniższe dwa zdania mają **pierwszeństwo**
przed jej brzmieniem — pierwszego w niej nie ma, a drugie odsyła do sekcji,
która w tym dokumencie nazywa się inaczej.

1. **★ Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.**
   Dotyczy KAŻDEJ liczby w tym dokumencie, także tych, które autor zmierzył sam przy wydaniu.
2. **★ Obalenie którejkolwiek tezy z sekcji „MOJA HIPOTEZA" albo „Zmierz moje
   liczby sam" jest SUKCESEM dyżuru, a nie porażką.** Zapisz to w „Korektach
   wobec instrukcji" z dowodem i idź dalej. (Sekcja wyżej mówi „TEZY
   ZLECENIA…" — w tym dokumencie te sekcje noszą nazwy podane tutaj.)

---

## Po co ten dyżur istnieje

`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` to **438 wierszy napisanych
w drugiej osobie do właściciela**. Po jego przeczytaniu właściciel orzeka o 16 modułach
naraz. Każdy wiersz tego pakietu jest więc mnożnikiem: zdanie prawdziwe oszczędza dzień,
zdanie fałszywe kosztuje dwa — raz na zgłoszenie nieistniejącego defektu, drugi raz na
dyżur, który odkrywa, że funkcja od dawna jest zrobiona.

**Dyżur 350 odświeżył ten pakiet i zrobił to dobrze.** Sprawdziłem to imiennie przy
wydaniu tej instrukcji i mówię to wprost, bo pochwała jest tu informacją, nie uprzejmością:

- **żaden wiersz `G16` nie zmienił stanu** — wszystkie 16 modułów mają dziś
  `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`, dokładnie tak, jak przed dyżurem 350;
- **rozbieżność SHA zapisana wzorowo** — pakiet podaje OBIE wartości (`1c4b5a5635` od
  nadzorcy i `fb6547b7d0` potwierdzone 04.09 o 05:33), mówi jawnie „nie zweryfikował go
  na stagingu, ponieważ obowiązuje bezwzględny zakaz połączenia (`Z28`)" i kieruje pytanie
  do nadzorcy. **Zero zgadywania. To zostaje bez zmian.**
- **lista „Stan oczekiwany — nie zgłaszaj"** zawiera karty inicjatyw 6 z 24 z numerami
  decyzji (`DEC-387`, `DEC-388`) i z SHA.

**Ale są dwa błędy, które właściciel zobaczy jako zepsuty produkt.** Ten dyżur nanosi
dokładnie te dwie poprawki, sprawdza, czy nie mają rodzeństwa, i **nie robi nic więcej**.

**(1) Wiersz o Ideach/Notatniku jest nieprawdziwy.** Wiersz **390** mówi:
„widoczne, jeżeli staging zredeployowany po `660482d485`". Panel siedzi za flagą
`ff_idea_notebook_right_panel_prototype`, której **domyślna wartość to `false`**
(`src/utils/ideaNotebookRightPanelPrototypeFlag.ts:27` — `?? false`), a bramka przy
`OFF` **zwraca stary panel** (`src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx:97`
— `if (!isIdeaNotebookRightPanelPrototypeEnabled()) return <>{legacy}</>;`). Po dowolnym
redeployu właściciel zobaczy **STARY** panel i zgłosi to jako brak funkcji. Sąsiednie wiersze
Tools (**392**) i Initiatives (**393**) mają dopisek „domyślnie OFF" — ten go nie ma.

**(2) `1c4b5a5635` znaczy w tym dokumencie dwie różne rzeczy.** W wierszu **16** jest to
**SHA stagingu podany przez nadzorcę** (ten sporny, obok `fb6547b7d0`). W wierszach **65**
i **389** jest to **SHA, który usunął martwe poddrzewo Czatu**. Czytelnik, który zapamięta
pierwsze znaczenie, przeczyta wiersz 389 jako „to już jest na stagingu" — a to zupełnie
inne twierdzenie. Rozdzielasz oba znaczenia w treści; **nie rozstrzygasz, który SHA jest
prawdziwy** (to należy do nadzorcy, a `Z28` i tak zabrania sprawdzenia).

**Dlaczego to trafia na dyżur, a nie „poprawię przy okazji": <<DLACZEGO>>**

---

## ★★ ZASADA NIENARUSZALNA TEGO DYŻURU

**Żaden wiersz `G16` w żadnym z 16 plików `MODULE_ACCEPTANCE.md` nie może zmienić stanu.**
Ani o stopień, ani „bo dowód jest oczywisty", ani „bo i tak przejdzie". Stan `G16` zmienia
**właściciel po przelocie**, na podstawie tego, co zobaczy — nie dyżur, który przygotowuje
mu dokument. Dowodzisz tego imiennie przez `git diff` w `R3`. Naruszenie = odrzucenie
całego dyżuru, nie pozycji.

---

## ★★ MOJA HIPOTEZA — masz ją OBALIĆ ALBO POTWIERDZIĆ, nie przyjąć

| # | Teza | Na czym ją opieram | Jak ją obalisz |
| --- | --- | --- | --- |
| `H1` | Wiersz **390** jest nieprawdziwy, bo flaga jest domyślnie `false` | `ideaNotebookRightPanelPrototypeFlag.ts:27` (`?? false`) + bramka `IdeaNotebookRightPanelPrototype.tsx:97` zwracająca `legacy` | Pokaż, że coś **poza** tą flagą włącza panel po redeployu (np. inny konsument renderuje nowy panel bez bramki). Wtedy wiersz 390 jest prawdziwy, a moja teza pada |
| `H2` | Tylko wiersz **390** ma ten defekt; wiersze **388**, **389** i **391** są w porządku | Tools i Initiatives mają jawne „domyślnie OFF"; nie zmierzyłem flag Czatu i Wywiadu | **Zmierz rodzeństwo.** Jeżeli preferencja chipów Czatu albo kontrakt menu akcji Wywiadu też siedzą za flagą domyślnie `OFF`, moja teza jest obalona i poprawiasz też te wiersze |
| `H3` | `1c4b5a5635` występuje **trzy razy** i w **dwóch** znaczeniach | `grep` przy wydaniu: wiersze 16, 65, 389 | Policz sam. Inna liczba trafień albo trzecie znaczenie = teza obalona |
| `H4` | W pakiecie jest **9** zdań o kształcie „zobaczysz"/„widoczne", a część z nich nie ma kotwicy `plik:linia` | `grep -c 'zobaczysz\|widoczne'` = 9 przy wydaniu | Policz sam i wypisz, **które** mają kotwicę, a które nie. Jeżeli wszystkie mają, moja teza pada i piszesz to wprost |
| `H5` | Dryf od odświeżenia 350 (`2d74ea1d75`) to **11 scaleń i 17 plików produktu**, w tym trzy pliki przekrojowe wspólne dla wszystkich 16 modułów | pomiar przy wydaniu, komenda (6) w `§0.3` | Policz sam na SWOIM markerze. **Zlecenie nadzorcy mówiło „49 scaleń i 171 plików produktu" — sam to obaliłem: to liczba SPRZED odświeżenia 350 i dziś jest nieaktualna w OBIE strony.** Twój pomiar jest wiążący |

---

## ★ Zmierz moje liczby sam

Wszystkie liczby w tym dokumencie zmierzyłem na markerze `<<SHA_MARKERA>>` komendami z `§0.3`
i każda z nich jest **rozkazem pomiarowym**, nie faktem. Jedna liczba została już przez autora
obalona przy wydaniu i zapisuję to jawnie, żeby nie wróciła jako „fakt":

> **Zlecenie mówiło: „poprzedni pomiar dał 49 scaleń i 171 plików produktu (69 w Czacie,
> 51 w `server/src/routes`)".** Zmierzyłem to na markerze wydania: od ostatniego commita
> pakietu (`2d74ea1d75`, dyżur 350) jest **11 scaleń i 17 plików produktu**, a od pierwszego
> commita pakietu (`c950ede121`) — **102 scalenia i 337 plików produktu**. Liczba `49/171`
> nie odpowiada żadnemu z tych dwóch punktów odniesienia. **Nie przepisuj jej.** Zmierz
> własną i podaj, od którego commita liczysz.

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: PAKIET · ŹRÓDŁA TWIERDZEŃ · MACIERZE ODBIORU · DOWODY · RAPORT

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany wpis
w raporcie z `plik:linia` i rekomendacją jako diff **nienałożony**. Pozycja z takim produktem
jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Pakiet przelotu (jedyny plik merytoryczny)** | `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` | **★ PEŁNA LICENCJA w zakresie `R1`, `R2` i `R4`.** Zakaz kasowania rozbieżności SHA z wiersza 16, zakaz wybierania jednego SHA, zakaz usuwania zdania „nie zweryfikował go na stagingu", zakaz skracania listy „Czego NIE zgłaszaj" | — |
| **Źródło twierdzenia o fladze Idei/Notatnika** | `src/utils/ideaNotebookRightPanelPrototypeFlag.ts`, `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` | **TYLKO ODCZYT.** Wolno czytać i **cytować `plik:linia`** w treści pakietu. **Zakaz zmiany wartości domyślnej** (`Z10`) i zakaz zmiany bramki (`Z11`) | Cytat `plik:linia` w pakiecie i w raporcie |
| **Żywi konsumenci bramki** | `src/components/MyWork/notebook/NotebookRightRail.tsx:1038`, `src/components/standard/IdeaRightPanel.tsx:422` | **TYLKO ODCZYT** — sprawdzasz je w `R1` po to, żeby móc obalić `H1`, nie żeby je zmienić | Wpis do raportu |
| **Rodzina flag rodzeństwa (`R2`)** | `src/utils/*Flag*.ts` (**126 plików** w `src/utils` przy wydaniu), `src/components/**/*Flag*.ts` | **TYLKO ODCZYT — inwentaryzujesz, nie naprawiasz.** Interesują Cię wyłącznie flagi stojące za wierszami **388**, **389**, **391** tabeli „Zobaczysz inaczej" | Wpis: wiersz pakietu, flaga, `plik:linia`, wartość domyślna |
| **Macierze odbioru — WSZYSTKIE 16** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **★★ NIETYKALNE DO ZAPISU — ZASADA NIENARUSZALNA.** Nie zmieniasz żadnego wiersza `G`, w szczególności `G16`. Odczyt (`grep`, `git diff`) jest obowiązkowy w `R3` | Dowód `git diff` w `R3` |
| **Kod produktu i testy** | `src/**`, `server/**`, `tests/**`, `scripts/**`, `public/locales/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Ten dyżur nie zmienia ani jednej linii kodu, ani jednego testu | Wpis do raportu: plik, linia, problem, diff **nienałożony** |
| **Konfiguracja i CI** | `vitest*.config.ts`, `tsconfig*.json`, `.github/workflows/**`, `server/migrations/**`, `docker-compose*`, `railway*` | **NIETYKALNE DO ZAPISU** (`Z12`, `Z18`, `Z38`, `Z39`) | Opis w raporcie |
| **Dowody** | `evidence/day357/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**, `git add -f`) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie.** Wszystkie dowody tego dyżuru lądują TUTAJ, w repo, a nie w katalogu tymczasowym | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem (dziś doszły do `Q`) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY357_PAKIET_POPRAWKA_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `server/src/routes/v8/finance-v2/__tests__/**`, `evidence/g15/**` (dyżur 355) · `src/components/MyWork/prototypes/__tests__/**`, `tests/unit/flags/**`, `evidence/day356/**` (dyżur 356) · `server/src/routes/__tests__/day27{4,5,6,7}-*.pg.test.ts`, `evidence/g19/**`, `vitest.config.ts`, `server/vitest.config.ts` (dyżur 358) · licznik kompletności, 20 ekranów podglądu, wiersz `G19`, etykiety narzędzi (dyżury 351-354) | **TYLKO ODCZYT** | Wpis do raportu |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

---

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (b) cztery bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: wszystkie 0

# (c) ★★ WLASCIWY TEMU DYZUROWI — 16 wierszy G16 PRZED i PO
for f in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md; do
  echo "$(basename $(dirname $f)) :: $(bash -c "grep -oE 'TECHNICAL_PACKET_READY[^\`]*' $f" | head -1)"
done | tee evidence/day357/g16-przed.txt   # ★ najpierw: mkdir -p evidence/day357
#   moje liczby: WSZYSTKIE 16 = 'TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING'
```

**Ten dyżur nie zmienia kodu, więc (a) i (b) MUSZĄ dać identyczny wynik przed i po.**
Jakakolwiek różnica oznacza, że dotknąłeś czegoś spoza licencji — **cofasz to, zanim
zrobisz cokolwiek innego.**

---

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wierszy pakietu | `438` | komenda (1) z `§0.3` | TAK |
| 2 | trafień `1c4b5a5635` w pakiecie | `3` (wiersze 16, 65, 389) | komenda (4) z `§0.3` | TAK — **`grep` przez `bash -c`, bo w `zsh` bywa pusty** |
| 3 | znaczeń, w jakich występuje `1c4b5a5635` | `2` | odczyt kontekstu wierszy 16, 65, 389 | TAK — to jest sedno poprawki (2) |
| 4 | wartość domyślna flagi panelu Idei/Notatnika | `false` | komenda (3) z `§0.3` | TAK — **to jest źródło poprawki (1)** |
| 5 | wierszy tabeli „Zobaczysz inaczej" z dopiskiem „domyślnie OFF" | `2` z `6` (Tools, Initiatives) | komenda (2) z `§0.3` | TAK — **rodzeństwo, którego mój wiersz nie ma** |
| 6 | zdań „zobaczysz"/„widoczne" w pakiecie | `9` | `bash -c "grep -c 'zobaczysz\|widoczne' <pakiet>"` | TAK — `H4` |
| 7 | wierszy `G16` w stanie `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING` | `16` z `16` | komenda (5) z `§0.3` | TAK — **to jest stan, który ma się NIE ZMIENIĆ** |
| 8 | dryf od odświeżenia 350 (`2d74ea1d75`) | `11` scaleń, `17` plików produktu | komenda (6) z `§0.3` | TAK — **obala liczbę `49/171` ze zlecenia** |
| 9 | dryf od pierwszego commita pakietu (`c950ede121`) | `102` scalenia, `337` plików produktu | komenda (6) z `§0.3` | TAK |
| 10 | pliki przekrojowe w dryfie od 350 | `3` (`FilterableTable.tsx`, `StandardPreview.tsx`, `TableWithPreviewLayout.tsx`) | komenda (7) z `§0.3` | TAK — **wspólne dla wszystkich 16 modułów** |
| 11 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

---

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY357_PAKIET_POPRAWKA_REPORT.md` ·
`evidence/day357/**` (nowy katalog, `git add -f`).

**Zapisujesz WARUNKOWO:**
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja, tylko jeżeli `R2` albo `R3`
znajdą coś, czego rejestr nie ma).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `server/**`, `tests/**`, `scripts/**`, `public/locales/**`,
`vitest*.config.ts`, `tsconfig*.json`, `.github/workflows/**`, `server/migrations/**`,
**wszystkie 16 plików `MODULE_ACCEPTANCE.md`**, `evidence/g15/**`, `evidence/g19/**`,
`evidence/day356/**`, `OWNER_DECISION_LEDGER_2026-08-24.md`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day357-pakiet-poprawka
mkdir -p evidence/day357
git diff --name-only --cached | tee evidence/day357/staged.txt
bash -c "grep -iE '^src/|^server/|^tests/|^scripts/|^public/locales/|vitest.*config|^tsconfig|^\.github/|MODULE_ACCEPTANCE|OWNER_DECISION_LEDGER|evidence/g1[59]|evidence/day356' evidence/day357/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

1. **Każda poprawka niesie CYTAT ŹRÓDŁA.** Zdanie, które wstawiasz do pakietu, ma podawać
   `plik:linia` (np. `ideaNotebookRightPanelPrototypeFlag.ts:27`). Zdanie bez kotwicy jest
   w tym dokumencie **długiem, nie informacją** — dokładnie tym, co naprawiasz.
2. **Nie rozstrzygasz sporu o SHA stagingu.** Poprawka (2) **rozdziela dwa znaczenia
   tego samego napisu**; nie wybiera prawdziwego SHA, nie kasuje drugiej wartości i nie
   łączy się ze stagingiem, żeby sprawdzić (`Z28` — to jedyny zakaz, którego naruszenie
   zatrzymuje CAŁY dyżur).
3. **Zero zmian stanu `G16`.** Robisz `evidence/day357/g16-przed.txt` przed pierwszą zmianą
   i `g16-po.txt` po ostatniej, i pokazujesz w raporcie, że `diff` obu plików jest **pusty**.
   To nie jest formalność — to jest warunek odbioru.

---

## R1 — POPRAWKA (1): WIERSZ O IDEACH/NOTATNIKU I JEGO RODZEŃSTWO (rdzeń)

1. **Udowodnij źródło, zanim poprawisz.** Wklej do raportu wynik komendy (3) z `§0.3`:
   klucz flagi, wiersz z `?? false`, wiersz bramki zwracającej `legacy`. **Bez tych trzech
   cytatów poprawka jest opinią, nie faktem.**
2. **Sprawdź, czy `H1` da się obalić.** Otwórz obu żywych konsumentów
   (`NotebookRightRail.tsx:1038`, `IdeaRightPanel.tsx:422`) i odpowiedz na jedno pytanie:
   **czy istnieje ścieżka renderująca nowy panel z pominięciem bramki?** Jeżeli tak — `H1`
   pada, wiersz 390 jest prawdziwy, poprawki (1) NIE nanosisz i piszesz to w raporcie jako
   obalenie tezy autora. To jest **sukces**, nie porażka.
3. **Nanieś poprawkę** — wiersz 390 tabeli „Zobaczysz inaczej" ma po Twojej zmianie mówić
   **to samo, co wiersze Tools i Initiatives**: kod jest scalony po `660482d485`, ale panel
   siedzi za flagą `ff_idea_notebook_right_panel_prototype` **domyślnie OFF**, więc bez
   decyzji o włączeniu właściciel nadal zobaczy stary panel — **i to nie jest defekt**.
   Sformułowanie dobierasz sam; wiążący jest sens i obecność kotwicy `plik:linia`.
4. **★ RODZINA (`H2`) — obowiązkowa, nie opcjonalna.** Ten sam kształt sprawdź dla
   **wszystkich sześciu** wierszy tabeli (388 Chat/menu, 389 Chat/panel, 390 My Work,
   391 Interview, 392 Tools, 393 Initiatives). Dla każdego podaj w raporcie: czy stoi za
   flagą, jaka to flaga, `plik:linia` wartości domyślnej. **Wiersz za flagą domyślnie `OFF`
   bez dopisku poprawiasz tak samo.** Wiersz, który nie stoi za flagą, zostawiasz i piszesz
   o nim jedno zdanie. Pominięcie rodzeństwa to znany błąd tego programu: praca
   per-zgłoszenie daje „poprawne w 2 z 3".
5. **Zapisz dowód do repo:** `evidence/day357/r1-flagi-wierszy.md` z tabelą sześciu wierszy.
   **`git add -f`.**

**Commit po `R1`. Push na `github-backup` (`Z34a`).**

---

## R2 — POPRAWKA (2): DWA ZNACZENIA JEDNEGO SHA I ZDANIA BEZ KOTWICY (rdzeń)

1. **Policz trafienia sam** (komenda (4) z `§0.3`) i wypisz kontekst każdego. Moja liczba
   to `3` trafienia w `2` znaczeniach. Inna liczba = teza `H3` obalona, zapisujesz to.
2. **Rozdziel znaczenia w treści.** Po Twojej zmianie czytelnik ma z samego zdania wiedzieć,
   o którym znaczeniu mowa — bez cofania się do wiersza 16. Najtańszy kształt: przy każdym
   wystąpieniu z drugiego znaczenia dopisz, **czego ten SHA dotyczy** („commit usuwający
   martwe poddrzewo Czatu"), a przy wierszu 16 zostaw jawną informację, że to **sporny**
   znacznik wersji stagingu, obok `fb6547b7d0`. Formę dobierasz sam.
3. **★ ZAKAZ:** nie kasujesz `fb6547b7d0`, nie wybierasz „prawdziwego" SHA, nie usuwasz
   zdania o niezweryfikowaniu, nie łączysz się ze stagingiem (`Z28`).
4. **Audyt zdań bez kotwicy (`H4`).** Wypisz wszystkie zdania o kształcie „zobaczysz" /
   „widoczne" (moja liczba: `9`) i dla każdego odpowiedz **TAK/NIE**: czy ma kotwicę
   `plik:linia` albo SHA. Zdania bez kotwicy **wypisujesz w raporcie jako dług** — nie
   musisz ich wszystkich naprawiać w tym dyżurze, ale nie wolno Ci ich przemilczeć.
   Jeżeli któreś jest **fałszywe** tak jak wiersz 390 — poprawiasz je tutaj.
5. **Zapisz dowód:** `evidence/day357/r2-kotwice.md`. **`git add -f`.**

**Commit po `R2`. Push.**

---

## R3 — DOWÓD, ŻE `G16` SIĘ NIE RUSZYŁ, I PRZEGLĄD DRYFU (rdzeń)

1. **Dowód imienny, nie zapewnienie.** Wygeneruj `evidence/day357/g16-po.txt` tą samą
   komendą co `g16-przed.txt` i wklej do raportu wynik:
   `diff evidence/day357/g16-przed.txt evidence/day357/g16-po.txt` — **ma być pusty**.
   Dodatkowo: `git diff --name-only <marker>..HEAD -- docs/program/waves/WAVE_03_ACCEPTANCE/modules/`
   — **ma być pusty**. Oba wyniki dosłownie w raporcie.
2. **Policz dryf sam** (komenda (6) z `§0.3`), od **obu** punktów odniesienia, i podaj,
   od którego liczysz. Pamiętaj, że liczba `49/171` ze zlecenia nadzorcy jest przez autora
   tej instrukcji **obalona** — nie przepisuj jej.
3. **★ Przegląd, czy dryf unieważnia pakiet.** Weź listę plików produktu zmienionych od
   `2d74ea1d75` (komenda (7)) i dla **każdego** odpowiedz jednym zdaniem: czy zmienia to,
   co właściciel zobaczy na ekranie opisanym w pakiecie. **Szczególną uwagę zwróć na trzy
   pliki przekrojowe** — `FilterableTable.tsx`, `StandardPreview.tsx`,
   `TableWithPreviewLayout.tsx` — bo są wspólne dla **wszystkich 16 modułów**: jedna zmiana
   w nich dotyka każdego ekranu listowego w pakiecie.
4. **Jeżeli znajdziesz coś, co dezaktualizuje pakiet** — dopisujesz to do pakietu tak samo
   jak poprawki (1) i (2): z kotwicą, bez zmiany stanu `G16`. **Jeżeli nic nie znajdziesz,
   piszesz to wprost jednym zdaniem** — „przejrzałem 17 plików, żaden nie zmienia treści
   pakietu" jest pełnowartościowym wynikiem, o ile faktycznie przejrzałeś wszystkie.
5. **Zapisz dowód:** `evidence/day357/r3-dryf.md` + `g16-przed.txt` + `g16-po.txt`.
   **`git add -f`.**

**Commit po `R3`. Push.**

---

## R4 — LISTA „STAN OCZEKIWANY — NIE ZGŁASZAJ": UZUPEŁNIENIE O KONTEKST KART INICJATYW

1. Lista „Stan oczekiwany — nie zgłaszaj" już dziś mówi o kartach inicjatyw 6 z 24 i podaje
   `DEC-387`/`DEC-388` oraz SHA. **Brakuje jej jednego zdania**: że to jest stan **naprawiony**,
   a nie stan **zepsuty** — naprawa jest scalona i siedzi za flagą `ff_initiative_sections_complete`
   (`src/utils/initiativeSectionsCompleteFlag.ts:1`), domyślnie wyłączoną, wprowadzoną
   dyżurami **338** i **343** na mocy **`DEC-388`**. Dopisz to.
2. **★ Sprawdź, zanim dopiszesz.** Otwórz `src/utils/initiativeSectionsCompleteFlag.ts`
   i potwierdź nazwę klucza oraz wartość domyślną. Jeżeli klucz albo domyślna wartość jest
   inna, niż podaję — **wiążący jest Twój pomiar**, a moja teza idzie do „Korekt wobec
   instrukcji".
3. Ten sam test zastosuj do pozostałych pozycji listy „Stan oczekiwany": czy każda niesie
   **numer decyzji** albo **SHA**. Pozycję bez żadnej kotwicy wypisz w raporcie.
4. **Zapisz dowód:** `evidence/day357/r4-stan-oczekiwany.md`. **`git add -f`.**

**Commit po `R4`. Push.**

---

## R5 — RAPORT, JAWNE LICZBY I PYTANIA DO NADZORCY

Raport zawiera: obie poprawki z **cytatem źródła** przy każdej · odpowiedź na `H1`–`H5`
(„potwierdzona / obalona", każda z komendą i wynikiem) · tabelę sześciu wierszy „Zobaczysz
inaczej" z flagami · listę zdań „zobaczysz/widoczne" z odpowiedzią TAK/NIE o kotwicę ·
**pusty `diff` `g16-przed.txt` ↔ `g16-po.txt` wklejony dosłownie** · własny pomiar dryfu
z podaniem punktu odniesienia · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** (co
najmniej jedno zdanie: nie sprawdziłeś stagingu, bo `Z28`).

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO NADZORCY".** Co najmniej jedno pytanie jest
w tym dyżurze pewne: **który SHA opisuje wersję stagingu — `1c4b5a5635` czy `fb6547b7d0`?**
Zadajesz je jako pytanie rozstrzygalne („tak"/„nie" albo „A"/„B") i **nie rozstrzygasz go
sam**. Jeżeli masz inne — dopisz. Sekcja nie może być pusta.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl 'PRZELOT_WLASCICIELA_STAGING_20260904' scripts/"`. Sekcję
w `REJESTR_ZNALEZISK_20260903.md` dopisujesz o **pierwszej wolnej literze** — sprawdź ją
komendą `bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy (dziś sekcje doszły do `Q`).

**Commit po `R5`. Push.**

---

## Próg odbioru

**Obie poprawki naniesione, każda z cytatem źródła (`plik:linia`). Rodzeństwo sześciu wierszy
„Zobaczysz inaczej" sprawdzone imiennie. Przegląd dryfu od dyżuru 350 wykonany na PEŁNEJ liście
plików produktu. `diff` stanu `G16` przed i po — PUSTY, wklejony dosłownie. Zero zmian
w `MODULE_ACCEPTANCE.md`.**

Odbiorca odrzuci dyżur, w którym: zmieniono stan choćby jednego wiersza `G`; wybrano jeden
SHA stagingu albo skasowano drugi; poprawiono wiersz 390 bez sprawdzenia pozostałych pięciu;
przepisano liczbę `49/171` zamiast zmierzyć własną; wstawiono do pakietu zdanie o runtime
**bez kotwicy `plik:linia`**; albo połączono się ze stagingiem, żeby „tylko sprawdzić" (`Z28`).

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „poprawka (1) naniesiona
z cytatem, poprawka (2) naniesiona, rodzeństwo sprawdzone — dwa wiersze z sześciu też były
za flagą i też je poprawiłem; przeglądu dryfu nie dokończyłem, przejrzałem 9 z 17 plików,
oto które" — **jest pełnowartościowym wynikiem.** Zdanie „przejrzałem dryf" bez listy
plików nie jest.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną. Dotyczy to zwłaszcza
liczby wierszy pakietu i numerów wierszy 16/65/389/390 — **równolegle biegną inne dyżury
i pakiet mógł się przesunąć.** Numery wierszy w tym dokumencie zawsze potwierdzaj komendą,
nigdy z pamięci.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która może wyglądać na sprzeczną | Rozstrzygnięcie |
| --- | --- |
| „Popraw wiersz o SHA" vs „nie rozstrzygaj, który SHA jest prawdziwy" | `R0` (2) i `R2` (2): poprawka **rozdziela dwa znaczenia napisu**, nie wybiera wartości; wiersz 16 zostaje ze sporem i obiema wartościami |
| „Pakiet mówi o tym, co właściciel zobaczy" vs `Z28` (zakaz połączenia ze stagingiem) | `R0` (1): każde zdanie o runtime wiążesz z `plik:linia` w repo; runtime stagingu jest **poza Twoim zasięgiem z definicji** i piszesz to w „TWIERDZENIACH NIEZWERYFIKOWANYCH" |
| „Cytuj `plik:linia` z `src/`" vs „`src/**` TYLKO ODCZYT" | Tabela licencji: odczyt i cytowanie są jawnie dozwolone i **zamówione**; zakaz dotyczy zapisu |
| „Sprawdź rodzeństwo sześciu wierszy" vs „ten dyżur zmienia dwie rzeczy" | `R1` (4): sprawdzenie rodzeństwa jest **pomiarem**; poprawiasz tyle wierszy, ile jest fałszywych — jeżeli fałszywy jest tylko jeden, poprawiasz jeden i piszesz, że pozostałe sprawdziłeś |
| „Nie zmieniasz `MODULE_ACCEPTANCE.md`" vs „przegląd dryfu może wykazać regresję modułu" | `R3` (4): regresję **opisujesz w pakiecie i w raporcie**; stan wiersza `G` zmienia właściciel po przelocie, nigdy ten dyżur |
| „Instrukcja mówi 49 scaleń i 171 plików" vs „mój pomiar mówi co innego" | Sekcja „Zmierz moje liczby sam": autor obalił tę liczbę **przy wydaniu**; wiążący jest pomiar wykonawcy (`Z24`) |
| „Dopisz kontekst do listy stanu oczekiwanego" vs `Z13` (nie tworzysz dokumentów) | `Z13` zakazuje **nowych dokumentów rejestrowych**; dopisanie zdania do istniejącego pakietu jest jawnie zamówione |
| „Zapisz dowody" vs „to dyżur dokumentacyjny, nie ma dowodów" | Tabela licencji, wiersz „Dowody": dowodem są pliki `evidence/day357/**` w **repo** (`git add -f`), nie ścieżki w `/private/tmp` — dowód poza repo wyparowuje |
| „Numery wierszy 16/65/389/390" vs „równolegle piszą inni" | Sekcja „Wznowienie": numery wierszy potwierdzasz komendą tuż przed edycją; podane tu są z markera wydania |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle dopisują inni autorzy" | `R5`: literę sekcji sprawdzasz komendą **tuż przed commitem**, nie zakładasz z góry |
| „Przydzielono Ci bazę i port" vs „nie stawiasz bazy" | `TRASY_TYL`: `cx-day357-pg`/`6416` to **rezerwacja rozłączności**, nie polecenie; ten dyżur nie uruchamia testów DB |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — pakiet (438 wierszy), `ideaNotebookRightPanelPrototypeFlag.ts:1/27`, `IdeaNotebookRightPanelPrototype.tsx:97`, `NotebookRightRail.tsx:1038`, `IdeaRightPanel.tsx:422`, `initiativeSectionsCompleteFlag.ts:1`, 16 plików `MODULE_ACCEPTANCE.md` — sprawdzone komendami przy wydaniu; `evidence/day357/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 11 wierszy; wszystkie zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — pakiet · źródło twierdzenia o fladze · żywi konsumenci · rodzina flag · 16 macierzy odbioru · kod i testy · konfiguracja i CI · dowody · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`–`R4` zmieniają wyłącznie jeden plik dokumentacyjny i katalog dowodów; zero plików kodu |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `6416`/`5556` zarezerwowane i nieużywane; 355/356/358 mają rozłączne porty (`6414`/`5554`, `6415`/`5555`, `6417`/`5557`) i **rozłączne pliki**; dyżury 351-354 mają rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: dokument starzejący się ciszej niż kod, zdanie o runtime bez kotwicy, `grep --include` w `zsh` dający pustkę, dowód poza repo, numery wierszy przesuwane przez równoległych autorów |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
