## Po co ten dyżur istnieje

Dyżur 349 zmienił `src/components/standard/StandardPreview.tsx` tak, że blok „Relations”
renderuje się **bezwarunkowo** (linia **362**, commit `58d391d65b`). Skutek: w każdym
podglądzie wszystkich 16 modułów, także tam gdzie wołacz nie przekazuje żadnych powiązań,
pojawia się karta „POWIĄZANIA / Brak powiązań” o wysokości 107 px.

Dyżur 352 zmierzył to uczciwie i **sam nazwał trzy rzeczy, których nie domknął**. To jest
rzadkie i cenne — dlatego ten dyżur nie zaczyna od zera, tylko domyka dokładnie te trzy.

**★★★ Ale przy odbiorze wyszło coś, czego 352 nie nazwał — i to jest pozycja BLOKUJĄCA.**

Dyżur 352 miał licencję na **jedną** opcję opt-in w kanonicznym narzędziu zrzutów, przy
zachowaniu historycznych wywołań **bit w bit**. Wprowadził **trzy** zmiany w jednym commicie
(`4fcd20808e`):

| # | Zmiana | Czy opt-in | Co zmienia |
| --- | --- | --- | --- |
| (a) | opcja `--mierz-wysokosc` | **TAK** | nic, dopóki nie podasz selektora — **w porządku** |
| (b) | warunek `podgladNadalOtwarty` przed re-klikiem po rozwinięciu sekcji, plus **nowa pętla** po selektorach `KLIK` | **NIE** | **treść kadru** każdego wywołania używającego `--klik-po-rozwinieciu` |
| (c) | `zlePary` liczy tylko pary mające pole `ok` (`Object.hasOwn`), i zmienia się drukowany mianownik | **NIE** | **mianownik i KOD WYJŚCIA** każdego wywołania używającego `--wynik-selektor` |

**Raport 352 nie wspomniał o (b) ani o (c).** Obie są merytorycznie poprawne — (b) naprawia
realną ślepą plamę (rozwijanie sekcji potrafi zamknąć podgląd), (c) naprawia realny błąd
licznika (pary bez pola `ok` nie powinny być liczone jako złe). **Ale obie zmieniają wynik
pomiarów innych dyżurów, a `--klik-po-rozwinieciu` woła pięć skryptów, w tym `g06-macierz-*`,
czyli przegląd 16 modułów — najszerszy pomiar w programie.**

**Zmiana w przyrządzie, o której nikt nie wie, jest gorsza niż defekt w produkcie: defekt
widać, przesunięty przyrząd nie.**

## ★★ TRZY RZECZY DO DOMKNIĘCIA — w tej kolejności

**1. BLOKUJĄCA — trzy zmiany w narzędziu (`R1`).** Zadeklarować imiennie, uzasadnić i pokazać,
że historyczne wywołania dają ten sam wynik — **albo cofnąć**. Bez tego reszta dyżuru nie ma
przyrządu, któremu można ufać.

**2. Dublet w Finansach (`R2`).** `finance-hub&tab=analysis` pokazuje **dwie identyczne karty
„POWIĄZANIA / Brak powiązań” jedna pod drugą**, razem 214 px. Odbiorca potwierdził to własnymi
oczami na kadrze
`evidence/podglad-relations-20260904/finance-analysis/finance-hub__PO__pl__1440__light.png`.
**To jest realny defekt, nie kwestia kadru** — i ma **dwa adresy**:

- `src/components/standard/StandardPreview.tsx:362` — powłoka renderuje blok bezwarunkowo;
- `src/components/Economics/FinancePreviewPanel.tsx:1280` — `renderPreviewFooter` renderuje
  **własny** `PreviewRelations`, a `src/components/Economics/FinanceHub.tsx:3279` przekazuje
  ten footer do `StandardPreview` **jako dzieci**.

**3. Brakujące pary (`R3`).** Z 16 kontekstów tylko **12** ma różne sumy kontrolne;
**3 pary są identyczne** (`core/finance-hub`, `core/results-vnext-registry-shell`,
`core/results-vnext-attention`) i **1 nie ma „PO”** (`audyt-findings`). Dodatkowo trzy ekrany
`CaseWorkspace` (7 użyć `StandardPreview` w 3 plikach) **nie mają wejścia w harnessie** —
mimo commitu o nazwie „feat(dev-render): wejscie harnessu dla CaseWorkspace (352 R4)”, który
**zmienił wyłącznie plik raportu i ani jednej linii `dev-render/`**. Sprawdź to sam.

## ★★ CZEGO NIE ROZSTRZYGASZ

Dyżur 352 **nie rozstrzygnął po cichu** pytania, czy pusta karta ma się w ogóle pokazywać.
Postawił je właścicielowi i pokazał, że SSOT jest wewnętrznie sprzeczny:

| Dokument | Wiersz | Co mówi |
| --- | --- | --- |
| `docs/ui-standards/TRIADA_KANON.md` | `:70` | „**Relations:** klikalne pigułki albo »No relations«” — **blok zawsze** |
| `docs/ui-standards/TRIADA_KANON.md` | `:132` | pozycja 29 listy czekowania: „Relations albo »No relations«” — **blok zawsze** |
| `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` | `:337` | „**Relations** (blok 5 TRIADY, **jeśli są**)” — **blok tylko przy danych** |

**To było poprawne zachowanie i Ty je powtarzasz.** Naprawiasz **dublet** — dwie karty zamiast
jednej. To jest coś zupełnie innego niż „jedna karta zamiast zera”, i tej drugiej zmiany
nie robisz.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `2a7273e087cbd3e44344725b524f6ddd79d5badc`:

- w commicie `4fcd20808e` są **trzy** zmiany zachowania w `grafika-zrzuty.mjs`, z czego
  **jedna** jest opt-in;
- `--klik-po-rozwinieciu` wołają **cztery** skrypty pomiarowe plus sam harness
  (`r1-slepa-plama-uruchom.mjs`, `r1-slepa-plama-agreguj.mjs`, `g06-macierz-uruchom.mjs`,
  `g06-macierz-rejestr.mjs`, `r4-dowod-uruchom.mjs` — **policz sam, podaj swoją liczbę**);
- katalogów kontekstów w `evidence/podglad-relations-20260904/`: **16**
  (**zlecenie mówiło o 20 — to jest rozbieżność, którą zapisałem; potwierdź ją albo obal**);
- par o różnych sumach kontrolnych: **12**; identycznych: **3**; bez „PO”: **1**;
  plików PNG razem: **62**;
- `core/finance-hub` PO ma **1** pusty blok; `finance-analysis/finance-hub` PO ma **2**
  (107 px każdy, razem 214 px);
- użyć `<StandardPreview` w `src/` bez plików testowych: **55** w **39** plikach
  (dyżur 352 podał **53/39** po usunięciu komentarzy — **mianowniki są różne, podaj definicję
  swojego**); w `dev-render/`: **7** w **6** plikach;
- wołaczy `<StandardPreview>` przekazujących **dzieci**: **16** — i to jest rodzina, w której
  może żyć dublet;
- liście słowników: **pl 35199**, **en 33066**; cztery bezpieczniki kanonu kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: POWŁOKA · WOŁACZE · STOPKA MODUŁU · HARNESS · SKRYPTY POMIAROWE · KANON · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Powłoka podglądu** | `src/components/standard/StandardPreview.tsx` | **★ WĄSKA LICENCJA POD WARUNKIEM `R2`:** wolno zmienić **wyłącznie** tak, żeby zniknął DUBLET, i **wyłącznie** razem z parą zrzutów z co najmniej dwóch modułów. **ZAKAZ usunięcia bezwarunkowego renderu bloku i ZAKAZ dodania warunku „tylko gdy są dane”** — to jest pytanie do właściciela (`R4`) | Brief z `plik:linia` + diff **nienałożony** |
| **Blok Relations** | `src/components/shared/PreviewPane/**` (`PreviewRelations`) | **TYLKO ODCZYT** — komponent jest wspólny dla wszystkich 16 modułów | Brief |
| **Stopka Finansów (drugi adres dubletu)** | `src/components/Economics/FinancePreviewPanel.tsx`, `src/components/Economics/FinanceHub.tsx` | **★ WĄSKA LICENCJA POD WARUNKIEM `R2`:** wolno usunąć **jedno** z dwóch wystąpień bloku Relations, po wykazaniu, które jest kanoniczne. **Zakaz zmiany treści `emptyLabel` Finansów** (`relationsInWorkspace`) bez decyzji właściciela | Brief |
| **Pozostałe 15 wołaczy z dziećmi** | 16 miejsc `<StandardPreview>` przekazujących dzieci (lista z `R2` `KROK 0`) | **TYLKO ODCZYT**, chyba że `R2` udowodni w nich ten sam dublet — wtedy naprawa obejmuje **rodzinę**, a nie tylko Finanse | Wpis do raportu z `plik:linia` |
| **Kanoniczne narzędzie zrzutów** | `scripts/dev/grafika-zrzuty.mjs` | **★ LICENCJA WYŁĄCZNIE NA ROZLICZENIE `R1`:** wolno **cofnąć** zmianę (b) i/lub (c), albo **zostawić je z jawną deklaracją i dowodem równoważności**. **ZAKAZ dopisania czwartej zmiany.** Jedna nowa opcja opt-in dopuszczalna tylko z dowodem, że historyczne wywołania dają wynik i kod wyjścia bit w bit | — |
| **Skrypty pomiarowe wołające harness** | `scripts/dev/{r1-slepa-plama-uruchom,r1-slepa-plama-agreguj,g06-macierz-uruchom,g06-macierz-rejestr,r4-dowod-uruchom}.mjs`, `scripts/check-dev-render-parytet.mjs` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** To są historyczne wywołania, wobec których dowodzisz równoważności | Wynik obu przebiegów do raportu |
| **Harness (dev-render)** | `dev-render/main.tsx`, `dev-render/screens/**` | **★ WĄSKA LICENCJA:** wolno dodać wpisy `SCREENS` montujące **realne** komponenty produktu, wyłącznie dla ekranów bez wejścia (`CasesListScreen`, `RealizacjaView`, `RezultatyView`) i dla niepustej selekcji `AuditFindingsTab`. **Zakaz atrapy zamiast komponentu produktu i zakaz zmiany istniejących wpisów** | Brief z listą brakujących zależności fikstury |
| **Dokumenty kanonu** | `docs/ui-standards/TRIADA_KANON.md`, `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` | **NIETYKALNE DO ZAPISU — BEZWZGLĘDNIE.** Sprzeczność między nimi jest przedmiotem pytania do właściciela, nie Twojej redakcji | Cytat obu wierszy w `R4` |
| **Zasady pracy toru grafiki** | `docs/program/grafika/00_ZASADY_PRACY.md` | **AKTUALIZACJA przez DOPISANIE** sekcji o zmianach w narzędziu (352 i 365), nigdy nadpisanie | — |
| **Dowody 352** | `evidence/podglad-relations-20260904/**` — istniejące PNG i JSON | **TYLKO ODCZYT dla istniejących plików; DOPISYWANIE nowych dozwolone.** Nadpisanie istniejącego PNG unieważnia bazę porównania | — |
| **Nowe dowody** | `evidence/podglad-domkniecie-20260904/**` (**NIE ISTNIEJE — tworzysz**) | **★ PEŁNA LICENCJA**; commitujesz przez `git add -f` | — |
| **Testy podglądu** | `src/components/shared/__tests__/standardPreview.r03.test.tsx`, `.../tablePreviewGeometry.r03-2.test.tsx`, `src/components/standard/__tests__/keyboardAccessCanon.test.tsx` | **TYLKO URUCHAMIANIE** (48 przypadków PRZED i PO wg 352 — zmierz sam). Zakaz osłabienia asercji | Wynik do raportu |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA**, jeżeli dublet da się objąć testem. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** | — |
| **Serwer** | `server/**` | **TYLKO ODCZYT** | Brief |
| **Słowniki** | `public/locales/**` | **NIETYKALNE DO ZAPISU.** Liście nie mogą zmaleć | Opis w raporcie |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`** | Opis w raporcie |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł** | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze** (`AA`, `AB`, …), sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY365_PODGLAD_DOMKNIECIE_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/**`, `server/src/services/legacyCutover/**` (dyżury 363 i 366) · `src/store/useToolStore.ts`, `src/components/DiscoveryTools/**`, `scripts/dev/check-etykiety-dwujezyczne*`, `scripts/dev/i18n-pl-audyt.mjs` (dyżur 364) · `tests/unit/assessment/day351.assessmentCompleteness.test.ts`, `server/src/routes/assessment/assessment-hub.routes.ts` (dyżur 366) · wiersze macierzy i rejestry bramek (dyżury 359-362) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35199, en 33066

# (b) bramki kanonu maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
node scripts/check-dev-render-parytet.mjs >/dev/null 2>&1; echo "parytet=$?"
#   moje liczby: cztery pierwsze 0; parytet dev-render zmierz sam PRZED zmiana harnessu
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | zmian zachowania w commicie `4fcd20808e` | `3`, z czego `1` opt-in | komenda (1) z `§0.3` | TAK — czyta diff narzędzia, nie raport |
| 2 | skryptów wołających `--klik-po-rozwinieciu` | `5` | komenda (2) | TAK — **to jest zasięg skutku zmiany (b)** |
| 3 | dokumentów opisujących `--wynik-selektor` | `4` | komenda (2) | TAK — **zasięg skutku zmiany (c)** |
| 4 | kontekstów w katalogu dowodów | `16` | komenda (3) | TAK — **obala „20” ze zlecenia** |
| 5 | par różnych / identycznych / bez PO | `12` / `3` / `1` | komenda (3) | TAK — po sumach SHA-256, nie po dacie pliku |
| 6 | pustych bloków w Finansach | `1` (core) / `2` (analysis) | komenda (4) | TAK — z JSON-a kontroli, nie z oka |
| 7 | adresów dubletu | `2` (`plik:linia`) | komenda (5) | TAK |
| 8 | użyć `<StandardPreview>` i tych z dziećmi | `55/39` + `7/6`, z dziećmi `16` | komenda (6) | TAK — **`grep` per plik NIE znajduje tej rodziny** |
| 9 | wierszy sprzeczności w SSOT | `3` (`:70`, `:132`, `:337`) | komenda (7) | TAK |
| 10 | testy podglądu przed/po | `48` wg 352 | własny przebieg | TAK — `numTotalTests`, nie tylko `numFailedTests` |
| 11 | równoważność historycznych wywołań | — | dwa przebiegi z `R1` | TAK — porównuje PNG, JSON **i kod wyjścia** |
| 12 | liście słowników PL/EN | `35199` / `33066` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY365_PODGLAD_DOMKNIECIE_REPORT.md` ·
`evidence/podglad-domkniecie-20260904/**` (nowy katalog) ·
`docs/program/grafika/00_ZASADY_PRACY.md` (sekcja **dopisana**).

**Zapisujesz WARUNKOWO:**
`scripts/dev/grafika-zrzuty.mjs` (wyłącznie rozliczenie `R1`) ·
`src/components/standard/StandardPreview.tsx` **albo**
`src/components/Economics/FinancePreviewPanel.tsx` (wyłącznie usunięcie dubletu — **jedno
z dwóch, nie oba naraz bez uzasadnienia**) ·
`dev-render/main.tsx` + nowe pliki w `dev-render/screens/` ·
nowe PNG/JSON w `evidence/podglad-relations-20260904/` (**tylko nowe nazwy**) ·
nowe pliki testowe w `tests/` (`git add -f`) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `public/locales/**`, `server/**`,
`docs/ui-standards/TRIADA_KANON.md`, `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`,
`src/components/shared/PreviewPane/**`,
`scripts/dev/{r1-slepa-plama-*,g06-macierz-*,r4-dowod-uruchom}.mjs`,
`scripts/check-dev-render-parytet.mjs`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`server/migrations/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (**wszystkie 16**),
**istniejące** pliki PNG i JSON w `evidence/podglad-relations-20260904/`,
`evidence/g15/**`, `src/store/useToolStore.ts`, `scripts/dev/check-etykiety-dwujezyczne*`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day365-podglad-domkniecie
git diff --name-only --cached | tee /private/tmp/cx-day365-podglad-domkniecie-artefakty/staged.txt
bash -c "grep -iE '^public/locales/|^server/|ui-standards/|PreviewPane/|slepa-plama|g06-macierz|r4-dowod|dev-render-parytet|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|evidence/g15|useToolStore|check-etykiety' /private/tmp/cx-day365-podglad-domkniecie-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
# ★ osobno: zaden ISTNIEJACY plik z evidence/podglad-relations-20260904 nie moze byc zmodyfikowany
git diff --name-status --cached -- evidence/podglad-relations-20260904 | grep -v '^A' && echo "★★ NADPISUJESZ DOWOD 352 — COFNIJ" || echo "dowody 352 nietkniete"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Przyrząd przed produktem.** `R1` jest pierwsza i blokująca. Dopóki nie wiadomo, czy
narzędzie zrzutów mierzy to samo co wczoraj, każdy kolejny kadr jest bez wartości. Jeżeli
zatrzymasz się po `R1` — to jest pełnowartościowy wynik dyżuru.

**(2) Pytanie o pustą kartę zostaje otwarte.** Naprawiasz **dublet** (dwie karty → jedna).
Nie usuwasz bezwarunkowego renderu, nie dodajesz warunku „tylko gdy są dane”, nie zmieniasz
żadnego z dwóch dokumentów kanonu.

**(3) Para bajtowo identyczna = ZERO dowodu.** Zapisujesz ją jako wynik negatywny
z wyjaśnieniem, dlaczego zmiana nie dotarła do renderowanego DOM-u. Nigdy jako zaliczoną parę.

**(4) Brakującą funkcję dokłada się NARZĘDZIU, opt-in.** Zakaz własnego skryptu zrzucającego
obok kanonicznego — doraźny skrypt dał już raz parę identycznych obrazów i zameldował sukces.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — ★ BLOKUJĄCA: TRZY ZMIANY W NARZĘDZIU — ZADEKLAROWAĆ, UDOWODNIĆ RÓWNOWAŻNOŚĆ ALBO COFNĄĆ (rdzeń)

**Ta pozycja jest pierwsza. Nie zaczynasz `R2` przed jej commitem.**

1. **Przeczytaj diff** `git show 4fcd20808e -- scripts/dev/grafika-zrzuty.mjs` i **wypisz
   wszystkie zmiany zachowania z osobna**, każdą z `plik:linia` i jednym zdaniem: co robi,
   kto na nią patrzy, czy jest opt-in. Moja liczba: **trzy**. Jeżeli znajdziesz czwartą —
   obowiązuje Twój pomiar.
2. **Ustal zasięg skutku.** Dla `(b)` — które wywołania używają `--klik-po-rozwinieciu`;
   dla `(c)` — które używają `--wynik-selektor`. Podaj listę plików i dokumentów.
   **To jest liczba, o którą chodzi: ile pomiarów w programie stoi na zmienionym przyrządzie.**
3. **DOWÓD RÓWNOWAŻNOŚCI — dwa przebiegi tego samego wywołania.**
   Skopiuj wersję narzędzia sprzed `4fcd20808e` do `SCRATCH` (**POZA repo**, `Z13`):
   `git show 4fcd20808e^:scripts/dev/grafika-zrzuty.mjs > $SCRATCH/grafika-zrzuty-przed.mjs`.
   Uruchom **to samo** historyczne wywołanie (wzór weź z `g06-macierz-uruchom.mjs` albo
   `r1-slepa-plama-uruchom.mjs`) raz starą, raz bieżącą wersją i porównaj **trzy rzeczy**:
   sumy kontrolne SHA-256 wszystkich PNG, treść JSON-a kontroli, **kod wyjścia**.
4. **Werdykt per zmiana**, jeden z trzech, i tylko z tych trzech:
   - `RÓWNOWAŻNA` — historyczne wywołanie daje identyczny wynik i kod wyjścia; zmiana zostaje,
     z jawną deklaracją;
   - `ZMIENIA WYNIK, PRZYJĘTA` — zmienia, ale jest merytorycznie poprawna; zostaje,
     **z deklaracją, uzasadnieniem i wypisaniem, które wcześniejsze pomiary mogły być
     zawyżone lub zaniżone**;
   - `COFNIĘTA` — zmiana wraca do stanu sprzed `4fcd20808e`.
5. **Zapisz deklarację na trwałe.** Dopisz do `docs/program/grafika/00_ZASADY_PRACY.md`
   sekcję „Zmiany w kanonicznym narzędziu zrzutów — dyżury 352 i 365”: data, `plik:linia`,
   opcja, opis skutku, werdykt. **Dopisanie, nigdy nadpisanie.** Sprawdź najpierw, czy plik
   nie jest generowany: `bash -c "grep -rl '00_ZASADY_PRACY' scripts/"`.
6. **Jeżeli werdykt dla `(b)` lub `(c)` brzmi `ZMIENIA WYNIK, PRZYJĘTA`** — wypisz z nazwy
   dyżury i dokumenty, których liczby mogą być teraz nieaktualne. To jest osobne zlecenie,
   nie Twoja praca; ale bez tej listy nikt się nie dowie, że powstało.

**Wymagany dowód:** lista wszystkich zmian z `plik:linia` · lista wywołań i dokumentów
w zasięgu skutku · **dwa przebiegi z sumami SHA-256, treścią JSON i kodami wyjścia** ·
werdykt per zmiana · sekcja dopisana do `00_ZASADY_PRACY.md` · lista pomiarów do przemiaru.
**Commit po `R1`.**

## R2 — DUBLET „BRAK POWIĄZAŃ” W FINANSACH (rdzeń)

**KROK 0 — wypisz rodzeństwo, ZANIM cokolwiek naprawisz.**

1. **Wypisz 16 wołaczy `<StandardPreview>` przekazujących dzieci** (komenda (6) z `§0.3`)
   i dla każdego sprawdź, czy jego dzieci zawierają własny `PreviewRelations`,
   `PreviewAIHintStrip` albo `PreviewActionBar`. **★ `grep` po jednym pliku tego nie znajdzie**
   — dublet w Finansach powstaje z DWÓCH plików (`FinanceHub.tsx` woła hook
   z `FinancePreviewPanel.tsx`). Idź po łańcuchu `children` / `renderPreviewFooter`.
2. **Podaj liczbę:** ile z 16 wołaczy dubluje **którykolwiek** z trzech bloków stopki.
   Jeżeli Finanse są jedyne — powiedz to wprost. Jeżeli nie — **naprawa obejmuje rodzinę**,
   nie tylko zgłoszony przypadek; praca per zgłoszenie daje „poprawne w dwóch z trzech”.
3. **Rozstrzygnij, które wystąpienie jest kanoniczne**, cytując kanon:
   powłoka (`StandardPreview.tsx:362`) czy stopka modułu (`FinancePreviewPanel.tsx:1280`).
   **To jest pytanie o architekturę bloku, nie o to, czy blok ma istnieć.**
4. **Napraw najwęziej, jak się da.** Preferowana droga: usunięcie **jednego** z dwóch
   wystąpień. Zmiana w `StandardPreview.tsx` dotyka wszystkich 16 modułów naraz — jeżeli ją
   wybierzesz, **musisz** dołożyć parę zrzutów z co najmniej dwóch innych modułów jako dowód,
   że niczego tam nie zgasiłeś.
5. **★ Uwaga na treść pustej etykiety.** Finanse mają własny `emptyLabel`
   (`finance.preview.relationsInWorkspace`, „Verified lineage is available in the canonical
   workspace”), różny od domyślnego „Brak powiązań”. **Jeżeli usuniesz niewłaściwe wystąpienie,
   zgubisz tę treść.** Sprawdź w zrzucie PO, która etykieta została.
6. **Dowód wizualny:** para PRZED/PO dla `finance-hub&tab=analysis`, oba motywy, sekcje
   ROZWINIĘTE, z SHA-256, średnią jasnością i **liczebnością pustych bloków z uchwytu DOM**.
   Oczekiwany kształt wyniku: **2 → 1**. Para bajtowo identyczna = zero dowodu.
7. **★ OBEJRZYJ KADR WŁASNYMI OCZAMI** i napisz jedno zdanie: co widzisz na PO-light.
   Nie „test przeszedł”, tylko „pod szczegółami jest jedna karta »POWIĄZANIA« z etykietą …”.
8. **Testy podglądu** (`standardPreview.r03`, `tablePreviewGeometry.r03-2`,
   `keyboardAccessCanon`) PRZED i PO, `--retry=0 --reporter=json`, z `numTotalTests`
   i `diff` list pełnych nazw. **Żadna nazwa nie ma zniknąć.**

**Wymagany dowód:** tabela 16 wołaczy z kolumną „dubluje blok stopki TAK/NIE” · liczba ·
uzasadnienie wyboru kanonicznego wystąpienia · para zrzutów `2 → 1` z sumami i liczebnością
z DOM · zdanie oględzin · wynik testów przed/po z `numTotalTests`. **Commit po `R2`.**

## R3 — DOROBIENIE BRAKUJĄCYCH PAR PRZED/PO

Dyżur 352 powiedział wprost, czego nie domknął — to był niedomknięty próg, nie fałszywe
„gotowe”. Domykasz go.

1. **Trzy pary identyczne** (`core/finance-hub`, `core/results-vnext-registry-shell`,
   `core/results-vnext-attention`). 352 udowodnił, że te ekrany **już przed zmianą** miały
   pusty blok, bo dane szły spreadem. **To jest falsyfikacja założenia i ma zostać zapisana
   jako taka.** Twoje zadanie: albo znaleźć stan, w którym para faktycznie się różni
   (i wtedy ją dostarczyć), albo **potwierdzić własnym pomiarem, że różnicy nie ma, i zamknąć
   te trzy jako `BEZ ZMIANY RUNTIME — POTWIERDZONE`**. Oba wyniki są dobre; zgadywanie nie.
2. **`audyt-findings` bez „PO”.** 352 nazwał przyczynę: wpis `tab=findings` działa, ale
   domyślnie wybiera pierwszy program z zerem ustaleń, a `AuditFindingsTab` nie czyta
   `programId` z URL. Fikstura `prog-metalpol-zakupy` istnieje. **Dodaj wejście harnessu
   z niepustą selekcją** (wpis montujący realny komponent) — albo, jeżeli wymagałoby to
   nowej opcji w narzędziu, **zatrzymaj się i napisz brief**, bo `R0` (4) i `R1` zabraniają
   dopisywania czwartej zmiany bez rozliczenia.
3. **Trzy ekrany `CaseWorkspace`** (`CasesListScreen`, `RealizacjaView`, `RezultatyView`;
   razem 7 użyć `StandardPreview` w 3 plikach) **nie mają wejścia w harnessie**.
   ★ Commit `a38110231b` nosi nazwę „feat(dev-render): wejscie harnessu dla CaseWorkspace
   (352 R4)”, ale **zmienił wyłącznie plik raportu** — sprawdź to sam
   (`git show --stat a38110231b`) i zapisz, co zobaczyłeś. Dodaj brakujące wpisy albo
   dostarcz brief z listą wymaganych zależności fikstury.
4. **Manifest końcowy:** tabela wszystkich kontekstów — kontekst · faza · motyw · ścieżka PNG ·
   SHA-256 · średnia jasność · liczebność z DOM · werdykt (`RÓŻNA PARA` /
   `BEZ ZMIANY RUNTIME — POTWIERDZONE` / `BRAK WEJŚCIA — BRIEF`).
5. **★ OBEJRZYJ KAŻDY NOWY KADR WŁASNYMI OCZAMI**, jedno zdanie per kadr. Liczby nie
   wystarczą — kontrolki harnessu zasłaniały już raz produkt na każdym zrzucie przez cały
   dzień i nikt tego nie zauważył.

**Wymagany dowód:** manifest wszystkich kontekstów z sumami, jasnością i werdyktem ·
nowe pary z sekcjami rozwiniętymi · zdania oględzin · brief dla każdego kontekstu bez wejścia.
**Commit po `R3`.**

## R4 — PYTANIE O PUSTĄ KARTĘ: UTRZYMAĆ I WYOSTRZYĆ, NIE ROZSTRZYGAĆ

1. **Zacytuj oba zapisy SSOT dosłownie**, z `plik:linia` (`TRIADA_KANON.md:70` i `:132`
   kontra `TABLE_AND_PREVIEW_CANON.md:337`) i pokaż, że są wzajemnie wykluczające się.
2. **Wyostrz pytanie tak, żeby dało się na nie odpowiedzieć „tak” albo „nie”.**
   Dyżur 352 zapytał: „czy pojedyncza karta »Brak powiązań« ma pozostać na ekranach, które
   nie deklarują powiązań?”. Dołóż do tego **koszt każdej odpowiedzi**, zmierzony:
   ile ekranów dotyczy, ile pikseli zabiera per ekran, czy odbiera treść czy tylko przewijanie.
3. **Dołóż trzecią możliwość, jeżeli Twój pomiar ją pokaże** — na przykład „blok pokazuje się
   tylko wtedy, gdy moduł deklaruje, że powiązania są dla tej encji sensowne”. **Ale nie
   implementujesz jej.**
4. **Nie zmieniasz żadnego z dwóch dokumentów kanonu.** Rozstrzygnięcie sprzeczności należy
   do właściciela; Twoim produktem jest pytanie z policzonym kosztem.

**Wymagany dowód:** dosłowne cytaty z `plik:linia` · pytanie rozstrzygalne „tak”/„nie” ·
policzony koszt każdej odpowiedzi · jawne stwierdzenie, że nie zmieniłeś dokumentów kanonu.
**Commit po `R4`.**

## R5 — RAPORT, MANIFEST I PYTANIA DO WŁAŚCICIELA

Raport zawiera: rozliczenie trzech zmian w narzędziu z `R1` (**werdykt per zmiana, dosłowne
wyniki dwóch przebiegów, kody wyjścia**) · tabelę 16 wołaczy i naprawę dubletu z `R2` ·
manifest wszystkich kontekstów z `R3` · pytanie z `R4` z policzonym kosztem ·
listę rozbieżności wobec liczb tej instrukcji · **niepustą sekcję „TWIERDZENIA
NIEZWERYFIKOWANE”** · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „POMIARY DO PRZEMIARU”.** Jeżeli którakolwiek ze zmian
w narzędziu okaże się `ZMIENIA WYNIK, PRZYJĘTA` — wypisz z nazwy dyżury, dokumenty i wiersze
rejestrów, których liczby mogą być teraz nieaktualne. **Bez tej listy nikt się nie dowie,
że powstał dług pomiarowy.**

★★ **Osobna, obowiązkowa sekcja: „OGLĘDZINY”.** Jedno zdanie na każdy kadr, który obejrzałeś
własnymi oczami. Zdanie ma opisywać, **co widzisz**, nie **czy test przeszedł**.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Pierwsze pytanie jest już znane
(`R4`). Drugie, jeżeli je zobaczysz: czy zmiany `(b)` i `(c)` w narzędziu mają zostać.
Sekcja nie może być pusta — pytanie o pustą kartę jest w niej obowiązkowo.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sekcje doszły dziś do `Z`, więc następne idą
`AA`, `AB`, …; sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy.

**Commit po `R5`.**

## Próg odbioru

**Wszystkie konteksty z werdyktem i różnymi sumami tam, gdzie różnica jest możliwa;
`finance-hub&tab=analysis` z jedną kartą zamiast dwóch; trzy zmiany w harnessie zadeklarowane
imiennie z dowodem, że historyczne wywołania dają ten sam wynik i ten sam kod wyjścia** —
przy nietkniętym pytaniu o sens pustej karty i nietkniętych dokumentach kanonu.

Odbiorca odrzuci dyżur, w którym: zmiany w narzędziu zostały bez deklaracji albo bez dowodu
równoważności; dołożono czwartą zmianę; para bajtowo identyczna została zaliczona jako dowód;
naprawiono Finanse bez sprawdzenia pozostałych piętnastu wołaczy z dziećmi; kadrów nie
obejrzano oczami; albo rozstrzygnięto po cichu pytanie o pustą kartę.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. **Zdanie: „trzy zmiany w narzędziu
rozliczone, dwie cofnięte, dublet nienaprawiony, bo wymaga decyzji o kanonicznym wystąpieniu
bloku” — jest pełnowartościowym wynikiem tego dyżuru**, nawet jeżeli nie powstanie ani jedna
nowa para zrzutów. Przyrząd jest ważniejszy od kadru.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw dublet w `StandardPreview`” vs „nie rozstrzygaj, czy pusta karta ma być” | `R0` (2) i `R2`: naprawiasz „dwie karty → jedna”; „jedna → zero” jest pytaniem do właściciela |
| „Narzędzie jest bramką, nietykalne” vs „rozlicz trzy zmiany w narzędziu” | Tabela licencji: licencja **wyłącznie na rozliczenie** — cofnięcie albo deklaracja z dowodem; zakaz czwartej zmiany |
| „Dorób brakujące pary” vs „zakaz dopisania czwartej zmiany do harnessu” | `R3` punkt 2: jeżeli para wymaga nowej opcji — zatrzymujesz się i piszesz brief; jedna opcja opt-in tylko z dowodem równoważności |
| „Zrzuty z sekcjami rozwiniętymi” vs „rozwijanie zamyka podgląd” | `PULAPKA` (4) i `R1`: dokładnie temu służy zmiana (b); sprawdzasz marker `[data-preview-block="details"]` w każdym kadrze |
| „12 z 20 kontekstów” vs „katalogów jest 16” | Sekcja „Zmierz moje liczby sam” i mianownik #4: rozbieżność zapisana jawnie, obowiązuje pomiar wykonawcy |
| „Napraw Finanse” vs „naprawa obejmuje rodzinę” | `R2` `KROK 0`: najpierw 16 wołaczy, potem naprawa; praca per zgłoszenie daje „poprawne w dwóch z trzech” |
| „Usuń jeden blok” vs „Finanse mają własną etykietę pustego stanu” | `R2` punkt 5: sprawdzasz w kadrze PO, która etykieta została; usunięcie niewłaściwego wystąpienia gubi treść |
| „Zmiana w powłoce jest najprostsza” vs „dotyka 16 modułów naraz” | `R2` punkt 4: wybór powłoki wymaga dowodu wizualnego z co najmniej dwóch innych modułów |
| „Para identyczna to porażka” vs „352 udowodnił, że tak ma być” | `R3` punkt 1: `BEZ ZMIANY RUNTIME — POTWIERDZONE` jest pełnoprawnym werdyktem; zgadywanie nie jest |
| „Commit mówi, że wejście CaseWorkspace powstało” vs „w `dev-render/` nic się nie zmieniło” | `R3` punkt 3: sprawdzasz `git show --stat` i zapisujesz, co zobaczyłeś; nazwa commita nie jest dowodem |
| „Aktualizuj `00_ZASADY_PRACY.md`” vs „dokumenty kanonu nietykalne” | Tabela licencji: `00_ZASADY_PRACY.md` to zasady toru grafiki (dopisanie dozwolone); `TRIADA_KANON.md` i `TABLE_AND_PREVIEW_CANON.md` to kanon UI (nietykalne) |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy” | `R5`: literę sprawdzasz komendą tuż przed commitem; sekcje doszły do `Z`, następne to `AA`, `AB` |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 12 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `StandardPreview.tsx:353-368`, `FinancePreviewPanel.tsx:1280`, `FinanceHub.tsx:3272/3279`, commity `58d391d65b`, `4fcd20808e`, `a38110231b`, pięć skryptów pomiarowych, oba dokumenty kanonu, 16 katalogów dowodowych i 62 PNG sprawdzone; `evidence/podglad-domkniecie-20260904/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-9 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — powłoka · blok Relations · stopka Finansów · 15 pozostałych wołaczy · narzędzie zrzutów · skrypty pomiarowe · harness · dokumenty kanonu · zasady toru grafiki · dowody 352 · nowe dowody · testy podglądu · nowe testy · serwer · słowniki · infrastruktura testów · macierz · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` czyta diff i porównuje dwa przebiegi, `R2` naprawia jeden dublet, `R3` dorabia kadry, `R4` formułuje pytanie, `R5` składa |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6436/5576 wolne (`lsof` przy wydaniu), brak kontenera `cx-day365-pg`, brak gałęzi `codex/day365-*` i worktree; 363/364/366 mają rozłączne porty i pliki; paczka 359-362 ma zarezerwowany przedział 6430-6433/5570-5573 i rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: przyrząd nie jest produktem, para identyczna, rodzina niewidoczna per plik, zwinięta sekcja, skan w trakcie animacji, bezpiecznik jednowymiarowy, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
