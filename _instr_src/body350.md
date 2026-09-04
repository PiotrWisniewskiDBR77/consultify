## Po co ten dyżur istnieje

`G16` — **„Owner acceptance flight"** — jest **jedyną bramką macierzy, której nie zamknie
maszyna**. Wszystkie 16 wierszy stoją dziś na `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`
i czekają wyłącznie na **oczy właściciela**.

Pakiet, po którym właściciel ma przelecieć, **istnieje**:
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` — 381 wierszy, 16 sekcji modułowych,
wspólne zasady zgłaszania, lista znanych ograniczeń stagingu i tabela do wypełnienia.

**Problem: pakiet się zdezaktualizował.** Zmierzyłem to sam:

| Co | Liczba |
| --- | --- |
| ostatni commit pakietu | `3cb7390766`, **04.09 o 05:44** |
| scaleń od tamtej pory (`--merges --first-parent`) | **49** |
| zmienionych plików produktu (`src/` + `server/src/`) | **171** |

**Ciężar zmian nie rozkłada się równo — i to jest najważniejsza wskazówka tego dyżuru:**

| Obszar | Zmienionych plików |
| --- | --- |
| `src/components/AIChat` | **66** |
| `server/src/routes` | **51** |
| `server/src/services` | 10 |
| `src/components/MyWork` | 8 |
| `src/components/Interview` | 5 |
| `src/components/assessment` | 3 |
| `src/components/DiscoveryTools` | 3 |
| `src/components/Initiatives` | 2 |
| `src/components/DocumentStudio` | 2 |
| pojedyncze pliki | `ui`, `standard`, `shared`, `layout`, `ReportBuilder`, `Presentations`, `App.tsx`, `hooks/useReportSections.ts`, `services/api.ts`, `services/chatSuggestionsPreference.ts`, `store/useToolStore.ts`, `toolPacks/packs/dynamicSwot.pack.ts`, `utils/dynamicSwotSevenStagesFlag.ts` |

**To nie jest „kilkanaście scaleń".** Sekcja pakietu o Czacie opisuje moduł, w którym zmieniło
się 66 plików — i to jest pierwsze miejsce, które musisz sprawdzić.

## ★★ Czego ten dyżur NIE robi

- **Nie wpisuje ani jednego wiersza `G16` jako `PASS`.** Ten wiersz podnosi właściciel po
  przelocie. Dyżur, który sam go podniósł, sfałszował odbiór. **Nie dotykasz w ogóle żadnego
  `MODULE_ACCEPTANCE.md`.**
- **Nie łączy się ze stagingiem, demo ani produkcją — w żadną stronę** (`Z28`). Nie robisz
  `curl` po `/api/health`, nie logujesz się na konto odbiorowe właściciela, nie sprawdzasz
  ekranów własnymi oczami przez przeglądarkę.
- **Nie zmienia ani jednego pliku w `src/` i `server/src/`.** Znaleziony defekt idzie do
  raportu jako rekomendacja z `plik:linia` i **diffem nienałożonym**.
- **Nie włącza żadnej flagi** — także tej, którą opisujesz jako stan oczekiwany.
- **Nie przepisuje pakietu od zera.** Właściciel czytał już poprzednią wersję; zmiany są
  punktowe, a każda poprawiona sekcja **cytuje commit, który ją zdezaktualizował**.

## ★★ Rozbieżność, której NIE rozstrzygasz sam

Pakiet podaje własną wersję stagingu: **`fb6547b7d0`**, potwierdzoną `/api/health` 04.09
o 05:33. Nadzorca, wydając ten dyżur, podaje **`1c4b5a5635`**.

Moje pomiary dystansu od `HEAD`:

| Znacznik | Dystans do `HEAD` |
| --- | --- |
| `fb6547b7d0` (wersja z pakietu) | **325 commitów** |
| `1c4b5a5635` (wersja od nadzorcy) | **72 commity** |

**`Z28` zakazuje Ci połączenia ze stagingiem bezwzględnie — to jedyny zakaz, którego naruszenie
zatrzymuje CAŁY dyżur.** Więc **nie rozstrzygasz tego pomiarem**. Zamiast tego:

1. wpisujesz do pakietu wartość podaną przez nadzorcę, **oznaczoną jawnie** jako podaną
   z zewnątrz i niezweryfikowaną przez dyżur (`Z28`);
2. odnotowujesz w pakiecie i w raporcie, że **poprzednie brzmienie mówiło `fb6547b7d0`**;
3. stawiasz **pytanie rozstrzygalne** w `R6`: *„Który znacznik naprawdę stoi dziś na stagingu
   i czy ma zostać zredeployowany przed przelotem?"*

★ **To jest ważne merytorycznie, nie formalnie.** Jeżeli staging stoi 325 commitów za `HEAD`,
to każde zdanie w pakiecie o naprawie z 04.09 jest **fałszem dla właściciela** — funkcja jest
w repo, ale nie na ekranie, który on ogląda. Każda taka pozycja musi być w pakiecie oznaczona
warunkowo („jeżeli staging został zredeployowany po `<SHA>`").

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `6a4919f72db338e7f49a2cacb3787d20cc649883`:

- pakiet ma **381 wierszy** i **16 sekcji modułowych**, plus sześć sekcji wspólnych;
- ostatni commit pakietu to `3cb7390766` z 04.09 o 05:44; po nim **49 scaleń** i **171
  zmienionych plików produktu**;
- rozkład zmian: **AIChat 66**, `server/src/routes` **51**, `server/src/services` 10,
  `MyWork` 8, `Interview` 5, `assessment` 3, `DiscoveryTools` 3, `Initiatives` 2,
  `DocumentStudio` 2;
- **16 z 16** wierszy `G16` = `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`;
- `fb6547b7d0` = **325** commitów za `HEAD`; `1c4b5a5635` = **72**;
- pakiet **nie jest generowany** przez żaden skrypt (`grep -rl 'PRZELOT_WLASCICIELA' scripts/`
  nie znajduje nic) — edycja ręczna jest bezpieczna;
- flaga `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` (`DEC-388`) jest **domyślnie OFF**;
- liście słowników: **pl 35198**, **en 33065**; cztery bezpieczniki (`focus-canon`,
  `list-canon`, `artefakt`, `reachability --check-baseline`) kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU**. Ten dyżur jest dokumentacyjny —
produktem „tylko odczytu" jest **wpis do raportu z rekomendacją jako diff nienałożony**,
nie czerwony kontrakt testowy.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**`, `server/src/validators/**` | **TYLKO ODCZYT** | Cytat wiersza + wpis do raportu |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — NIE WOŁASZ I NIE ZMIENIASZ.** Ten dyżur nie uruchamia serwera | Opis w raporcie |
| **Kontroler / trasy** | `server/src/routes/**`, `server/src/controllers/**` | **TYLKO ODCZYT** — 51 plików zmienionych od pakietu; czytasz je, żeby sprawdzić prawdziwość zdań | Wpis: plik, linia, problem, rekomendacja jako diff **nienałożony** |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/domain/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Middleware / model uprawnień** | `server/src/middleware/**` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Produkt UI — wszystkie moduły** | `src/**` bez wyjątku | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Ten dyżur nie pisze kodu | Wpis do raportu z `plik:linia` |
| **Flagi funkcyjne** | `src/utils/dynamicSwotSevenStagesFlag.ts`, `src/components/Initiatives/sections/initiativeCardContract.ts`, `.env*`, `docker-compose*`, `railway*` | **TYLKO ODCZYT.** ★ Wolno **OPISAĆ** flagę w pakiecie; **włączenie którejkolwiek jest odrzuceniem dyżuru** (`Z10`, `Z11`) | Nazwa flagi + wartość domyślna do pakietu |
| **Testy** | wszystko pod `tests/`, `__tests__/` | **TYLKO ODCZYT** — ten dyżur niczego nie uruchamia poza bezpiecznikami kanonu | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **★ PAKIET PRZELOTU** | `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` | **★ PEŁNA LICENCJA NA AKTUALIZACJĘ — to jest główny produkt dyżuru.** Poprawiasz istniejące sekcje i dopisujesz nowe; **zakaz przepisania całości od zera**; każda poprawiona sekcja cytuje commit, który ją zdezaktualizował | — |
| **Źródła treści** | `REJESTR_ZNALEZISK_20260903.md` (sekcje `M`, `N`), `OWNER_DECISION_LEDGER_2026-08-24.md`, `FALA_2_PO_STAGINGU.md`, `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`, `AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `ODBIOR_DYZUROW_*_20260904.md`, wiersze `G14` i `G16` szesnastu `MODULE_ACCEPTANCE.md` | **TYLKO ODCZYT** — `Z14` zakazuje zmieniania rejestru decyzji właściciela | Errata w raporcie, jeżeli uważasz, że decyzja się myli |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **NIETYKALNA — ZAKAZ ZAPISU DO KTÓREGOKOLWIEK PLIKU.** W szczególności **ZAKAZ `PASS` w wierszu `G16`**; `G15` należy do dyżuru 347, `G19` do 348 | — |
| **Dowody** | `evidence/g16/day350/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** — tu leży inwentarz dryfu z `R1` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY350_G16_PAKIET_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/**`, `resultsInternalBetaVisibility.middleware.ts` (dyżur 347) · `evidence/g19/**`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` (dyżur 348) · trzy pliki czterech czerwieni powłoki i sześć plików Bloku 3 (dyżur 349) · wszystko wokół `DEC-388`, kafli SWOT, panelu Idei i kompletności raportu **po stronie KODU** (dyżury 343-346) | **TYLKO ODCZYT** | Wpis do raportu |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

★★ **Rozstrzygnięcie kolizji z dyżurami 343-346.** Równolegle biegnie paczka dyżurów wokół
`DEC-388`, kafli SWOT, panelu Idei i kompletności raportu. Oni pracują na **KODZIE**, Ty na
**DOKUMENCIE**. Pakiet przelotu jest **wyłącznie Twój**; kod tych tematów jest wyłącznie ich.
Jeżeli w trakcie pracy stwierdzisz, że któraś z tych rzeczy zmieni to, co właściciel zobaczy —
**opisujesz to w pakiecie jako stan bieżący z numerem decyzji i zaznaczasz, że praca trwa**,
i nie zaglądasz do ich gałęzi.

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
```

★ W tym dyżurze wszystkie te liczby mają **pozostać identyczne** przed i po — nie zmieniasz
ani kodu, ani słowników. **Jakakolwiek zmiana którejkolwiek z nich oznacza, że wyszedłeś
poza zakres** i cofasz zmianę.

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wiersze pakietu i sekcje modułowe | `381` / `16` | komenda (1) z `§0.3` | TAK |
| 2 | ostatni commit pakietu | `3cb7390766`, 04.09 05:44 | komenda (2) z `§0.3` | TAK — `git log -1 --` po ścieżce pliku |
| 3 | scalenia od pakietu | `49` | komenda (2) z `§0.3` | TAK — `--merges --first-parent`, czyli linia główna |
| 4 | zmienione pliki produktu | `171` | komenda (2) z `§0.3` | TAK — ograniczone do `src` i `server/src` |
| 5 | rozkład zmian per obszar | AIChat `66`, routes `51`, … | komenda (3) z `§0.3` | TAK — **suma ma się zgodzić ze 171, sprawdź to jawnie** |
| 6 | stan 16 wierszy `G16` | `16 × TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING` | komenda (4) z `§0.3` | TAK |
| 7 | dystans dwóch znaczników stagingu | `325` / `72` | komenda (5) z `§0.3` | TAK — **i to jest JEDYNY dozwolony sposób; `curl` do stagingu jest zakazany** |
| 8 | czy naprawa kart inicjatyw jest za flagą OFF | TAK, `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` | komenda (6) z `§0.3` | TAK — czyta wartość domyślną, nie samo istnienie flagi |
| 9 | czy pakiet jest generowany | **nie** | komenda (7) z `§0.3` | TAK — `grep -rl` w `scripts/`, przez `bash -c` |
| 10 | ile sekcji modułowych wymagało poprawki | — | `R2`, licznik własny | TAK — **liczba ma się zgadzać z liczbą cytowanych commitów** |
| 11 | ile pozycji trafiło na listę „stan oczekiwany" | — | `R3`, licznik własny | TAK — **każda z numerem decyzji `DEC-*`** |
| 12 | liście słowników i bezpieczniki | `35198` / `33065`, cztery `0` | blok „WARUNKÓW WSPÓLNYCH" | TAK — mają być identyczne przed i po |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` (**główny produkt**) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY350_G16_PAKIET_REPORT.md` ·
`evidence/g16/day350/**` (nowy katalog).

**Zapisujesz WARUNKOWO:**
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja o pierwszej wolnej literze).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `server/src/**`, `public/locales/**`, `tests/**`,
`scripts/**`, `.env*`, `docker-compose*`, `railway*`, `.github/workflows/**`,
`server/migrations/**`, **żadnego `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`**,
`OWNER_DECISION_LEDGER_2026-08-24.md`, `FALA_2_PO_STAGINGU.md`, `evidence/g15/**`,
`evidence/g19/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day350-g16-pakiet
git diff --name-only --cached | tee /private/tmp/cx-day350-g16-pakiet-artefakty/staged.txt
bash -c "grep -iE '^src/|^server/|^public/|^tests/|^scripts/|^\.env|docker-compose|railway|^\.github/|MODULE_ACCEPTANCE|OWNER_DECISION_LEDGER|FALA_2_PO_STAGINGU|^evidence/g15/|^evidence/g19/' /private/tmp/cx-day350-g16-pakiet-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"

# ★★ druga kontrola, wlasciwa TEMU dyzurowi: ani jednego PASS wstawionego do bramki
git diff --cached -U0 | bash -c "grep -nE '^\+.*G16.*PASS'" \
  && echo "★★★ WPIS PASS DO G16 — TO JEST ZAKAZ NADRZEDNY TEGO DYZURU, COFNIJ" \
  || echo "brak wpisow do G16 OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) `G16` podnosi właściciel, nie dyżur.** Nie wpisujesz `PASS` do wiersza `G16` w żadnym
module i **nie dotykasz w ogóle żadnego `MODULE_ACCEPTANCE.md`**. Druga kontrola przed
commitem (blok wyżej) sprawdza to mechanicznie.

**(2) Zero połączeń ze stagingiem, demo i produkcją** (`Z28`) — to jedyny zakaz, którego
naruszenie zatrzymuje CAŁY dyżur. Wszystko, co wiesz o stagingu, pochodzi z repo albo od
nadzorcy, i tak jest oznaczone w pakiecie.

**(3) Każde zdanie, które wstawiasz do pakietu, ma odtwarzalne źródło w repo** — SHA commita,
ścieżka pliku z numerem wiersza albo numer decyzji `DEC-*`. **Pakiet czyta właściciel; jedno
nieprawdziwe zdanie kosztuje jego czas i zaufanie.** Zdanie, którego nie masz z czego
potwierdzić, **nie wchodzi do pakietu** — wchodzi do raportu jako pytanie.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus wynik obu kontroli
przed każdym commitem. **Bez commita — to jest warunek, nie pozycja.**

## R1 — INWENTARZ DRYFU PAKIETU, PRZYPISANY DO 16 MODUŁÓW (rdzeń)

1. Uruchom komendy (2) i (3) z `§0.3`. Do raportu i do
   `evidence/g16/day350/dryf-pakietu.md` idą: SHA i data commita pakietu, liczba scaleń,
   liczba plików produktu, rozkład per obszar.
2. **Wypisz 49 scaleń z nazwy** — `git log --oneline --merges --first-parent <SHA>..HEAD` —
   i **przypisz każde do modułu albo do „przekrojowe"**. Komunikaty scaleń niosą numer dyżuru
   i werdykt odbioru; to wystarczy do przypisania większości.
3. **Przypisz 171 zmienionych plików do 16 modułów pakietu.** Mapowanie katalogów na moduły
   pakietu (Chat, My Work, Interview, Tools, Assessment, Initiatives, Execution, Results,
   Finance, Materials, Audits, Meeting, Organization, Admin Panel, Settings, Partner Portal)
   wyprowadzasz z `docs/FUNCTIONAL_DOCUMENTATION.md` albo z nazw katalogów, i **zapisujesz
   swoje mapowanie jawnie** — żeby dało się je sprawdzić.
4. **Wynikiem jest tabela 16 wierszy:** moduł · ile scaleń go dotknęło · ile plików · **czy
   sekcja pakietu wymaga sprawdzenia (TAK/NIE)**. Moduł z zerem zmian dostaje `NIE` i to jest
   uczciwy wynik.

★ **Zero zmian w module nie znaczy, że jego sekcja jest aktualna** — mogła być nieaktualna już
w chwili pisania. Sekcje z `NIE` i tak przeglądasz w `R2`, tylko szybciej.

**Wymagany dowód:** `dryf-pakietu.md` z imienną listą 49 scaleń i mapowaniem plików ·
tabela 16 wierszy · jawne mapowanie katalog→moduł. **Commit po `R1`.**

## R2 — PRZEGLĄD SEKCJI MODUŁ PO MODULE, Z CYTATEM COMMITA (rdzeń)

**Dla KAŻDEGO z 16 modułów** otwierasz jego sekcję w pakiecie i sprawdzasz **trzy rzeczy**:

1. **„Kroki"** — czy ścieżka, którą każesz właścicielowi przejść, nadal istnieje (menu, przycisk,
   nazwa ekranu). Sprawdzasz w kodzie, nie zgadujesz.
2. **„Co się zmieniło"** — czy opisana zmiana jest nadal prawdziwa, i czy **nie doszły nowe**,
   których właściciel jeszcze nie widział.
3. **„Czego NIE zgłaszaj"** — czy pozycja nadal jest odłożona, czy może **została w międzyczasie
   zrobiona** (wtedy znika z tej listy i przechodzi do „Co się zmieniło"), oraz czy nie brakuje
   nowej pozycji.

**Każda poprawiona sekcja MUSI cytować commit, który ją zdezaktualizował** — w formie
`(zdezaktualizowane przez <SHA> — <krótki opis>)`. Poprawka bez cytatu jest podstawą odrzucenia
pozycji.

★★ **Zacznij od Czatu (sekcja 1).** 66 zmienionych plików to jedna trzecia całego dryfu
i największe ryzyko, że pakiet mówi o ekranie, którego już nie ma — w tym oknie scalono między
innymi usunięcie martwego poddrzewa czatu.

★ **Nie ruszaj tego, co jest nadal prawdziwe.** Sekcja bez zmian to **poprawny wynik**;
zapisujesz „sprawdzona, bez zmian" i idziesz dalej. Przepisywanie sprawnych zdań to szum,
który właściciel będzie musiał przeczytać drugi raz.

★ **Złota zasada pakietu zostaje w każdej sekcji, której dotyczy:** właściciel otwiera rekord
z **prawdziwą nazwą** (klient, projekt, inicjatywa), **nie** „Showcase"/„Przykład"/„Demo".
Program ma zmierzony przypadek, w którym zaakceptowany widok dostawały wyłącznie identyfikatory
pokazowe, a realny rekord otwierał coś zupełnie innego.

**Wymagany dowód:** dla każdego z 16 modułów jedna z dwóch odpowiedzi — „sprawdzona, bez zmian"
albo lista poprawek z cytatem SHA przy każdej. **Commit po `R2`** (wolno commitować partiami
po kilka modułów, byle każdy commit był kompletny dla swoich modułów).

## R3 — LISTA „STAN OCZEKIWANY, NIE ZGŁASZAJ" (rdzeń)

**To jest pozycja, która najbardziej oszczędza czas właściciela** — i której brak jest
najdroższym błędem tego dyżuru.

Program ma zmierzone trzy przypadki jednego dnia, w których właściciel napisał „dalej nie mam
X", a funkcja była **gotowa i wyłączona za flagą**. Dlatego:

1. **Wypisz KAŻDĄ naprawę scaloną w tym oknie, która jest za flagą `default OFF`** — bo
   właściciel **jej nie zobaczy**, i musi wiedzieć, że to nie jest defekt. Flagi do sprawdzenia
   (wszystkie domyślnie OFF): `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` (`DEC-388`),
   `VITE_VF1_INITIATIVE_CARD_CONTRACT` (`DEC-387`), `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES`,
   `VITE_VF1_DECISION_CARD_CONTRACT`, `VITE_VF1_DECISION_SPECA`. **Sprawdź, czy nie ma
   kolejnych** — komendą, nie z pamięci.
2. **Pozycja wzorcowa, którą MASZ dopisać** (jeżeli jej jeszcze nie ma): *karty inicjatyw
   nadal pokazują 6 sekcji z 24 — naprawa `DEC-388` jest scalona, ale flaga
   `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE` jest wyłączona; to NIE jest defekt do zgłoszenia,
   to stan oczekiwany do akceptu.* **Sprawdź liczbę „6 z 24" sam** — sekcja `N1` rejestru
   znalezisk podaje ją jako zmierzoną, ale program ma zapisany przypadek, w którym podobna
   liczba („11 z 15") okazała się **pojemnością kadru zrzutu**, a nie liczbą sekcji.
3. **Wypisz każdą pozycję odłożoną do fali 2** z numerem decyzji — źródło
   `docs/program/FALA_2_PO_STAGINGU.md` i `OWNER_DECISION_LEDGER_2026-08-24.md`.
4. **Wypisz decyzje właściciela z 04.09**, które zmieniają to, co ma i czego nie ma zgłaszać —
   `DEC-386`…`DEC-391`, opisane w sekcjach `M` i `N` rejestru znalezisk.
5. **Każda pozycja tej listy MA numer decyzji albo SHA commita.** Pozycja bez numeru to zdanie
   bez pokrycia i nie wchodzi do pakietu.

**Wymagany dowód:** kompletna lista „stan oczekiwany, nie zgłaszaj", każda pozycja z numerem
decyzji albo SHA · własny pomiar liczby sekcji karty inicjatywy · lista flag `default OFF`
zmierzona komendą. **Commit po `R3`.**

## R4 — LISTA „ZOBACZYSZ INACZEJ NIŻ WCZORAJ"

Lustrzane odbicie `R3`: **co właściciel realnie zobaczy inaczej** po naprawach scalonych 04.09.

1. Dla każdej naprawy z tego okna rozstrzygnij: **czy jest za flagą (→ `R3`), czy działa
   domyślnie (→ tutaj)**. Rozstrzygasz komendą, nie z komunikatu scalenia.
2. Dla każdej pozycji „zobaczysz inaczej" podaj: **moduł · ekran · co było · co jest ·
   SHA naprawy**.
3. ★★ **Oznacz każdą pozycję warunkiem stagingu.** Jeżeli staging stoi za `HEAD` (a według
   pakietu jest 325 commitów za), to naprawa scalona wczoraj **nie jest na ekranie właściciela**.
   Zapis obowiązkowy: „widoczne, **jeżeli** staging został zredeployowany po `<SHA>`".
   **Bez tego zastrzeżenia pakiet obiecuje właścicielowi rzeczy, których nie zobaczy.**

**Wymagany dowód:** tabela „zobaczysz inaczej" z pięcioma kolumnami · przy każdej pozycji
warunek stagingu · rozstrzygnięcie flaga/domyślnie zrobione komendą. **Commit po `R4`.**

## R5 — SPÓJNOŚĆ CAŁEGO PAKIETU

1. **Zasady wspólne** — sprawdź, czy sekcje „Zanim zaczniesz", „Jak zgłaszać uwagę", „Czego
   NIE zgłaszaj nigdy" i „Znane ograniczenia stagingu" są nadal prawdziwe. W szczególności:
   punkt o flagach Wyników/Finansów/Organizacji/kreatora wywiadu włączonych 03.09 wieczorem —
   **czy to nadal aktualne dzień później?**
2. **Wersja stagingu** — wpisz wartość podaną przez nadzorcę, **oznaczoną jako niezweryfikowana
   przez dyżur** (`Z28`), i odnotuj poprzednie brzmienie `fb6547b7d0`.
3. **Format zgłaszania zostaje**: jedna linia na uwagę plus zrzut, w formacie
   `moduł · ekran · co widzę · co oczekiwałem · zrzut`. **Nie zmieniasz tego formatu** —
   właściciel go już zna.
4. **Właściciel nie musi robić wszystkiego naraz** — sprawdź, czy pakiet to mówi wprost,
   i jeżeli nie, dopisz jedno zdanie. Tabela do wypełnienia ma kolumnę `Data`, więc przelot
   rozłożony na raty jest przewidziany.
5. **Tam, gdzie każesz sprawdzić sekcję na ekranie, napisz, że ma ją ROZWINĄĆ.** Program ma
   zmierzony przypadek, w którym zrzut ze zwiniętą sekcją pokazał naprawiony fragment
   i niepoprawiony obok.
6. **Zdania o języku PL/EN** — jeżeli któreś aktualizujesz, sprawdzaj **wartość** klucza
   w `public/locales/*/translation.json`, nie samo jego istnienie. Klucz może istnieć w `pl`
   i trzymać angielskie słowo.

**Wymagany dowód:** sześć odpowiedzi, po jednej na punkt, każda z cytatem źródła.
**Commit po `R5`.**

## R6 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport zawiera: inwentarz dryfu z `R1` · listę 16 modułów z werdyktem „bez zmian" / „poprawione,
oto co i na podstawie jakiego commita" z `R2` · kompletną listę „stan oczekiwany, nie zgłaszaj"
z `R3` · tabelę „zobaczysz inaczej" z `R4` · sześć odpowiedzi o spójności z `R5` · listę
rozbieżności wobec liczb tej instrukcji · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** ·
jawne zdanie, czy postawiłeś kontener (jeżeli nie — to jest poprawny wynik).

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA I NADZORCY".** Minimum dwa pytania
rozstrzygalne:

- *„Który znacznik naprawdę stoi dziś na stagingu — `fb6547b7d0` z pakietu czy `1c4b5a5635`
  od nadzorcy — i czy staging ma być zredeployowany PRZED przelotem?"* Bez odpowiedzi część
  pakietu obiecuje właścicielowi rzeczy, których nie zobaczy.
- *„Czy naprawy za flagami `default OFF` (`DEC-387`, `DEC-388` i pozostałe) mają zostać
  włączone przed przelotem, czy właściciel ma je zobaczyć dopiero po akcepcie na zrzutach?"*
  ★ **Sam ich nie włączasz — to decyzja właściciela** (`Z11`).

★★ **Osobna sekcja: „CZEGO PAKIET NADAL NIE OBEJMUJE".** Jeżeli któryś moduł ma naprawy
scalone, ale nie da się ich zweryfikować bez stagingu na właściwym SHA — piszesz to wprost.
Uczciwe „nie wiem, bo nie mogłem sprawdzić" jest lepsze niż zdanie, które właściciel odkryje
jako nieprawdziwe.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R6`.**

## Próg odbioru

**Pakiet przejrzany moduł po module — każdy z 16 ma werdykt „sprawdzona, bez zmian" albo listę
poprawek, w której KAŻDA cytuje commit, który sekcję zdezaktualizował; lista „stan oczekiwany,
nie zgłaszaj" jest kompletna i każda jej pozycja ma numer decyzji albo SHA; a żaden wiersz
`G16` nie zmienił stanu.**

Odbiorca odrzuci dyżur, w którym pojawi się `PASS` w `G16` albo jakakolwiek zmiana
`MODULE_ACCEPTANCE.md`; w którym pakiet przepisano od zera; w którym poprawka nie cytuje
commita; w którym wstawiono zdanie bez pokrycia w repo; albo w którym włączono jakąkolwiek
flagę.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „dryf przypisany do 16 modułów,
sekcje 1-8 przejrzane i poprawione z cytatami, lista stanu oczekiwanego kompletna, sekcje 9-16
nieprzejrzane" — **jest pełnowartościowym wynikiem**; właściciel może wtedy zacząć przelot od
modułów, które są gotowe, bo pakiet sam mówi, że nie musi robić wszystkiego naraz.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną. ★ Dla tego dyżuru ma to
szczególne znaczenie: liczba scaleń i zmienionych plików rośnie z każdą godziną, więc
**inwentarz z `R1` przeliczasz od nowa**, jeżeli wracasz następnego dnia.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Zaktualizuj pakiet o stan stagingu" vs `Z28` (zero połączeń) | `R0` (2) i `R5` punkt 2: wartość pochodzi od nadzorcy i jest **oznaczona jako niezweryfikowana**; rozbieżność idzie do `R6` jako pytanie, nie do pomiaru |
| „Bramka `G16` czeka na odbiór" vs „nie dotykasz macierzy" | `R0` (1) i tabela licencji: `G16` podnosi **właściciel**; dyżur dostarcza pakiet, nie werdykt |
| „Opisz flagi w pakiecie" vs `Z10`/`Z11` (zakaz zmiany flag) | `POZYCJE_Z_FLAGAMI` i `R3`: **opisanie nie jest włączeniem**; włączenie którejkolwiek jest odrzuceniem dyżuru, a decyzja o włączeniu należy do właściciela (`R6`) |
| „Popraw nieaktualne sekcje" vs „zakaz przepisania od zera" | `R2`: sekcja bez zmian dostaje werdykt „sprawdzona, bez zmian"; poprawki są punktowe i cytują SHA |
| „Wypisz, co właściciel zobaczy inaczej" vs „staging jest za `HEAD`" | `R4` punkt 3: każda pozycja dostaje warunek „widoczne, jeżeli staging zredeployowany po `<SHA>`" |
| „Sprawdź, czy ścieżka z Kroków istnieje" vs „nie uruchamiasz produktu" | `R2` punkt 1: sprawdzasz **w kodzie** (`grep` po etykiecie, komponencie, trasie), nie przez uruchomienie; jeżeli nie da się rozstrzygnąć statycznie — to jest pozycja do `R6` „czego pakiet nie obejmuje" |
| „Karty inicjatyw pokazują 6 z 24" vs „nie ufaj cudzym liczbom" | `R3` punkt 2: liczbę **mierzysz sam**; program ma zapisany przypadek, w którym analogiczna liczba okazała się pojemnością kadru zrzutu, nie liczbą sekcji |
| „Temat `DEC-388` jest terenem dyżurów 343-346" vs „opisujesz go w pakiecie" | Akapit pod tabelą licencji: oni pracują na KODZIE, Ty na DOKUMENCIE; nie zaglądasz do ich gałęzi i opisujesz stan bieżący z numerem decyzji |
| „Zero nowych dokumentów" (`Z13`) vs „pliki dowodowe i sekcja rejestru" | Tabela licencji: rejestr znalezisk to **AKTUALIZACJA istniejącego**, `evidence/g16/day350/` to **ślad**; nowy dokument rejestrowy jest dokładnie jeden — raport `R6` |
| „Kontener przydzielony" vs „dyżur go nie potrzebuje" | `SCIEZKI` i `LISTA_PORTOW_ZAJETYCH`: zasoby są rezerwą; niepostawienie kontenera jest wynikiem poprawnym **pod warunkiem napisania tego wprost** |
| „Rejestr decyzji jest źródłem" vs `Z14` (zakaz zmiany rejestru decyzji) | Tabela licencji: `OWNER_DECISION_LEDGER_2026-08-24.md` jest **TYLKO DO ODCZYTU**; uważasz, że decyzja się myli → **errata w raporcie**, nigdy zmiana w rejestrze |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — pakiet, rejestr znalezisk, rejestr decyzji, `FALA_2_PO_STAGINGU.md`, `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md`, `AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `dynamicSwotSevenStagesFlag.ts`, `initiativeCardContract.ts` sprawdzone; `evidence/g16/day350/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-9 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · montaż · kontroler · serwis/repozytorium · middleware · UI · flagi · testy · infrastruktura testów · pakiet · źródła treści · macierz · dowody · rejestr · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — cały dyżur jest dokumentacyjny; ani jedna pozycja nie wymaga zmiany kodu ani uruchomienia produktu |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6397/5537 wolne (`lsof` przy wydaniu), brak kontenera `cx-day350-pg`, brak gałęzi `codex/day350-*` i worktree; 347/348/349 mają rozłączne porty i pliki; paczka 343-346 ma zarezerwowany przedział 6390-6393/5530-5533, a kolizja tematyczna `DEC-388` rozstrzygnięta imiennie: oni KOD, ten dyżur DOKUMENT |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: naprawa za flagą OFF wygląda jak brak funkcji, `git log` ≠ to, co widzi właściciel, staging nie jest `HEAD`, rekord pokazowy zamiast prawdziwego, zwinięta sekcja nie jest dowodem, klucz istnieje ≠ przetłumaczony, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę; jedyna informacja z zewnątrz (znacznik stagingu od nadzorcy) jest jawnie oznaczona jako taka |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
