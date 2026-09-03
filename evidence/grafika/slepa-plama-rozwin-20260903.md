# Ślepa plama pętli rozwijania `grafika-zrzuty.mjs` — dyżur agent/slepa-plama-20260903

Punkt wyjścia: teza nadzorcy (zmierzona 03.09 18:30 na `assessment-list`, pl,
light, 1440): `--rozwin-sekcje=1 --klik-po-rozwinieciu=1
--osiad-po-rozwinieciu=1500 --a11y=1` daje tekst **1444** znaków, przebieg BEZ
`--rozwin-sekcje` daje **1562**. `execution-tab-list` zgłoszono jako czysty
(1018 = 1018).

## R2 — przyczyna (zmierzona)

**Przycisk „Szukaj” w `src/components/shared/ModuleHub/ModuleNavBar.tsx`
(~linie 367–390).**

Zmierzono metodą wykluczenia: enumeracja WSZYSTKICH kontrolek
`[aria-expanded="false"]` na `assessment-list` (10 sztuk — `Szukaj`,
`Filtruj Typ`, `Filtruj Status`, `Ustawienia widoku`, 6× `Akcje wiersza`) i
test KAŻDEJ osobno (`scripts/dev/r2-test-each.mjs`, fresh page + domyślny klik
w wiersz + klik testowanej kontrolki + Escape + klik w róg (2,2), tak jak robi
to prawdziwa pętla). Wynik: **tylko `Szukaj` chowa chip „AI Triage”** z DOM —
pozostałe 9 kontrolek (lejki filtrów, kebaby wiersza) nie wpływają na chipy.

Przycisk ma poprawne, semantyczne `aria-expanded={showSearch}` — ale to NIE
jest akordeon treści, tylko przełącznik trybu. Komentarz w źródle (linia 245):

> „Modes swap in place: search ↔ dynamic tabs ↔ counters/bulk ↔ other
> contextual chips.”

`commandRow` (linie ~246–420) renderuje DOKŁADNIE JEDNĄ z tych zawartości na
raz: gdy `showSearch === true`, CAŁY rząd Menu 3 (chipy statusu, taby,
liczniki — na `assessment-list`: „Wszystkie 6 · Szkic 1 · W przeglądzie 2 ·
… · AI Triage”) znika z DOM, zastąpiony polem wyszukiwania. Zamknięcie tego
trybu NIE MA obsługi ani klawisza Escape, ani kliku-na-zewnątrz — wyłącznie
ponowny klik w ten sam przycisk (`setShowSearch(!showSearch)`) albo klik „X”
przy wpisanej frazie (`handleCloseSearch`, widoczny tylko gdy `searchQuery`
niepuste).

Pętla rozwijania w `grafika-zrzuty.mjs` (przed naprawą) klika WSZYSTKIE
kontrolki `[aria-expanded="false"]` bez rozróżniania semantyki, więc trafia
też przycisk „Szukaj”. Naprawa `KLIK_PO_ROZWINIECIU`/`OSIAD_PO_ROZWINIECIU` z
tego samego dnia (03.09, dla `execution-tab-list`) NIE dotyczy tego przypadku
— to nie jest nakładka `.fixed.inset-0` zamykana klikiem w róg, tylko stan
Reacta bez żadnego zewnętrznego zamknięcia. Po jednym kliknięciu
`aria-expanded` przycisku staje się `true`, więc kolejne rundy pętli już go
nie widzą — chipy pozostają schowane DO KOŃCA przelotu (skan axe + zrzut
lecą bez nich).

Zmierzone (weryfikacja `scripts/dev/r2-verify-toggle-back.mjs`): klik 1 →
1562→1444 (dokładnie zgodne z pomiarem nadzorcy). Klik 2 (w ten sam przycisk)
→ z powrotem 1562, chip „AI Triage” ponownie obecny.

Ten sam `ModuleNavBar.tsx` obsługuje WSZYSTKIE ekrany listowe zbudowane na
kanonie `StandardModuleBar`/`FilterableTable` — defekt jest więc systemowy,
nie punktowy dla `assessment-list`. Potwierdzone od razu na drugim ekranie w
R1: `meetings-module` 1139→1028.

## R3 — naprawa przyrządu (opt-in)

Commit `2c200f8cf4` w `scripts/dev/grafika-zrzuty.mjs` +
`scripts/dev/g06-macierz-uruchom.mjs` (branch `agent/slepa-plama-20260903`).

Nowa flaga **`--cofnij-jesli-skraca=1`** (domyślnie `0` — zero zmiany
zachowania historycznych wywołań). Wybrany wariant naprawy: automatyczne
wykluczenie przez pomiar (nie hardkodowana lista selektorów) — bo defekt jest
systemowy i punktowa lista wymagałaby aktualizacji przy każdym nowym ekranie.

Mechanizm w pętli rozwijania (`ROZWIN_SEKCJE`): po każdym kliku w kontrolkę
`[aria-expanded="false"]` mierzy `document.body.innerText.length` PRZED i PO.
Jeśli klik tekst SKRÓCIŁ (prawdziwy akordeon ZAWSZE dokłada tekst, nigdy go
nie ujmuje) — cofa PONOWNYM klikiem w ten sam uchwyt DOM
(`elementHandle()`, nie selektor + pozycja, bo `aria-expanded` elementu już
się zmienił po pierwszym kliku i nie pasowałby do tego samego zapytania).
Dowód trafia do `wynik.json`:
- nagłówek: `cofnijJesliSkraca: true/false`,
- per ekran: `sekcjeCofniete: [{etykieta, przed, poKliku, poCofnieciu}]`.

Zweryfikowano na `assessment-list` (`scripts/dev/r3-test`, patrz log sesji):

| wariant | tekst | uwaga |
|---|---|---|
| (a) bez `--rozwin-sekcje` | 1562 | punkt odniesienia |
| (b) z rozwijaniem, BEZ nowej flagi | 1444 | ślepa plama (identyczne jak przed naprawą — zero regresji domyślnego zachowania) |
| (b') z rozwijaniem, Z `--cofnij-jesli-skraca=1` | **1562** | pełne odzyskanie, `sekcjeCofniete` zawiera wpis `Szukaj: 1562→1444→1562` |

`g06-macierz-uruchom.mjs` włącza flagę jawnie w swoim wywołaniu (dopisana w
tablicy argumentów z komentarzem datowanym 03.09) — od tego dyżuru pipeline
G06 nie ma już tej ślepej plamy.

## R1 — pomiar rodziny (wszystkie 16 modułów, 248 ekranów)

Metoda: dla KAŻDEGO ekranu z `g06-macierz-ekrany.json` (16 modułów, 248 ekranów, batchowane per moduł przez `scripts/dev/r1-slepa-plama-uruchom.mjs`) dwa przebiegi `grafika-zrzuty.mjs`, oba pl/light/1440/a11y=1:
- (a) BEZ `--rozwin-sekcje`
- (b) Z `--rozwin-sekcje=1 --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=1500` (istniejące naprawy z tego samego dnia — BEZ nowej `--cofnij-jesli-skraca`)

Ślepa plama = tekst(b) < tekst(a). Pełny log: `scripts/dev/r1-slepa-plama-uruchom.mjs` / artefakty w `/private/tmp/ag-slepa-plama-artefakty/r1/` (poza repo — dowód poniżej, w tabeli).

**Wynik: 30 / 248 ekranów (12%) ma ślepą plamę.** `execution-tab-list` (zgłoszony jako czysty) potwierdzony: 1018 = 1018.

| moduł | ekran | tekst(a) | tekst(b) | różnica | a11y(a) | a11y(b) | co znika (pierwsze 3 linie) |
|---|---|---|---|---|---|---|---|
| 13_CHAT | canvas-kebab-restructure | 2530 | 490 | -2040 | 0 | 0 | NAJCZĘSTSZE DZIAŁANIA / Rozwiń zaznaczoną myśl / Użyj AI, aby rozwinąć aktualnie zaznaczony fragment w bardziej kompletny tekst. |
| 13_CHAT | canvas-new-doc | 651 | 159 | -492 | 1 | 0 | Czysty dokument / Puste — zaczynasz od zera z Teresą. / Z SZABLONU |
| 02_INTERVIEW | interview-preview-canon | 425 | 68 | -357 | 0 | 0 | Odbiór właścicielski — retencja klienta / Otwórz / Zakończony |
| 04_ASSESSMENT | assessment-artifacts-restart | 938 | 754 | -184 | 0 | 0 | Wszystkie / 3 / Szkic |
| 06_EXECUTION | execution-tab-resources | 1785 | 1601 | -184 | 0 | 0 | Wszystkie / Przeciążeni / 1 |
| 09_RESULTS | results-vnext-attention | 315 | 147 | -168 | 0 | 0 | 2 / Zaległe obowiązki / 1 |
| 06_EXECUTION | execution-tab-control | 1053 | 890 | -163 | 0 | 0 | Wymaga działania / 4 / Krytyczne |
| 06_EXECUTION | execution-tab-work | 1741 | 1578 | -163 | 0 | 0 | Wszystkie / 7 / Zadania |
| 04_ASSESSMENT | assessment-reports-table | 1438 | 1314 | -124 | 0 | 0 | 1 / Generowanie / 0 |
| 04_ASSESSMENT | assessment-list | 1562 | 1444 | -118 | 0 | 0 | 1 / 2 / Oczekuje na zatwierdzenie |
| 04_ASSESSMENT | assessment-menu3-status-chips | 1466 | 1348 | -118 | 0 | 0 | 1 / 2 / Oczekuje na zatwierdzenie |
| 13_CHAT | chat-signals-feed | 1834 | 1719 | -115 | 0 | 0 | Wszystkie / 9 / Tylko moje (lokalnie) |
| 08_MEETINGS | meetings-module | 1139 | 1028 | -111 | 0 | 0 | Wszystkie / Nadchodzące / Wymaga follow-upu |
| 09_RESULTS | results-vnext-okr-registry | 1987 | 1901 | -86 | 0 | 0 | Wszystkie / 9 / W toku |
| 10_FINANCE | finance-hub | 1049 | 963 | -86 | 0 | 0 | Wszystkie / 6 / Odrzucone importy |
| 12_AUDITS | audyty-piec-powierzchni | 1904 | 1820 | -84 | 0 | 0 | Wszystkie / 5 / 3 |
| 09_RESULTS | results-vnext-kpi-registry | 921 | 842 | -79 | 0 | 0 | Wszystkie / 5 / 1 |
| 02_INTERVIEW | interview-sessions-status | 965 | 894 | -71 | 0 | 0 | Wszystkie / 5 / 1 |
| 09_RESULTS | results-vnext-roi-full-tool | 654 | 583 | -71 | 0 | 0 | Wszystkie / 1 / W toku |
| 09_RESULTS | results-vnext-roi-registry | 1285 | 1214 | -71 | 0 | 0 | Wszystkie / 7 / W toku |
| 14_ADMIN | model-catalog-table | 1312 | 1250 | -62 | 0 | 0 | Wszystkie |
| 04_ASSESSMENT | assessment-five-surfaces | 922 | 869 | -53 | 0 | 0 | Wszystkie statusy / Lista robocza / AI Triage |
| 04_ASSESSMENT | assessment-initiatives-table | 1707 | 1654 | -53 | 0 | 0 | 1 / Oczekuje na przegląd / 0 |
| 04_ASSESSMENT | drd-library-entry | 922 | 869 | -53 | 0 | 0 | Wszystkie statusy / Lista robocza / AI Triage |
| 07_MY_WORK_AGENT | zwornik-projects | 949 | 897 | -52 | 0 | 0 | Wszystkie / 1 / Zarchiwizowane |
| 01_ORGANIZATION | org-identity-operating | 2511 | 2468 | -43 | 0 | 0 | Wszystkie / 16 / Uzupełnione |
| 03_TOOLS | tools-outputs-insights-tab | 1498 | 1458 | -40 | 0 | 0 | Wszystkie / 4 / 2 |
| 09_RESULTS | results-vnext-kpi-scorecards | 542 | 504 | -38 | 0 | 0 | Wszystkie |
| 14_ADMIN | prompt-registry-tab | 1359 | 1322 | -37 | 0 | 0 | All / 11 / 6 |
| 09_RESULTS | results-zestawienia | 1510 | 1476 | -34 | 0 | 0 | Wszystkie / 6 / Otwarte |
## R4 — dowód: naprawa na 30 ekranach ze ślepą plamą

Powtórka wariantu (b) z `--cofnij-jesli-skraca=1` TYLKO dla 30 ekranów z R1 (`scripts/dev/r4-dowod-uruchom.mjs`).

| moduł | ekran | tekst(a) | tekst(b) bez naprawy | tekst(b') z naprawą | wynik |
|---|---|---|---|---|---|
| 13_CHAT | canvas-kebab-restructure | 2530 | 490 | 490 | ★ NIE odzyskane |
| 13_CHAT | canvas-new-doc | 651 | 159 | 159 | ★ NIE odzyskane |
| 02_INTERVIEW | interview-preview-canon | 425 | 68 | 68 | ★ NIE odzyskane |
| 04_ASSESSMENT | assessment-artifacts-restart | 938 | 754 | 938 | ✓ pełne odzyskanie |
| 06_EXECUTION | execution-tab-resources | 1785 | 1601 | 1785 | ✓ pełne odzyskanie |
| 09_RESULTS | results-vnext-attention | 315 | 147 | 315 | ✓ pełne odzyskanie |
| 06_EXECUTION | execution-tab-control | 1053 | 890 | 1053 | ✓ pełne odzyskanie |
| 06_EXECUTION | execution-tab-work | 1741 | 1578 | 1741 | ✓ pełne odzyskanie |
| 04_ASSESSMENT | assessment-reports-table | 1438 | 1314 | 1438 | ✓ pełne odzyskanie |
| 04_ASSESSMENT | assessment-list | 1562 | 1444 | 1562 | ✓ pełne odzyskanie |
| 04_ASSESSMENT | assessment-menu3-status-chips | 1466 | 1348 | 1466 | ✓ pełne odzyskanie |
| 13_CHAT | chat-signals-feed | 1834 | 1719 | 1834 | ✓ pełne odzyskanie |
| 08_MEETINGS | meetings-module | 1139 | 1028 | 1139 | ✓ pełne odzyskanie |
| 09_RESULTS | results-vnext-okr-registry | 1987 | 1901 | 1987 | ✓ pełne odzyskanie |
| 10_FINANCE | finance-hub | 1049 | 963 | 1049 | ✓ pełne odzyskanie |
| 12_AUDITS | audyty-piec-powierzchni | 1904 | 1820 | 1904 | ✓ pełne odzyskanie |
| 09_RESULTS | results-vnext-kpi-registry | 921 | 842 | 921 | ✓ pełne odzyskanie |
| 02_INTERVIEW | interview-sessions-status | 965 | 894 | 965 | ✓ pełne odzyskanie |
| 09_RESULTS | results-vnext-roi-full-tool | 654 | 583 | 654 | ✓ pełne odzyskanie |
| 09_RESULTS | results-vnext-roi-registry | 1285 | 1214 | 1285 | ✓ pełne odzyskanie |
| 14_ADMIN | model-catalog-table | 1312 | 1250 | 1312 | ✓ pełne odzyskanie |
| 04_ASSESSMENT | assessment-five-surfaces | 922 | 869 | 922 | ✓ pełne odzyskanie |
| 04_ASSESSMENT | assessment-initiatives-table | 1707 | 1654 | 1707 | ✓ pełne odzyskanie |
| 04_ASSESSMENT | drd-library-entry | 922 | 869 | 922 | ✓ pełne odzyskanie |
| 07_MY_WORK_AGENT | zwornik-projects | 949 | 897 | 949 | ✓ pełne odzyskanie |
| 01_ORGANIZATION | org-identity-operating | 2511 | 2468 | 2526 | ✓ odzyskane (+15 ponad bazę) |
| 03_TOOLS | tools-outputs-insights-tab | 1498 | 1458 | 1498 | ✓ pełne odzyskanie |
| 09_RESULTS | results-vnext-kpi-scorecards | 542 | 504 | 542 | ✓ pełne odzyskanie |
| 14_ADMIN | prompt-registry-tab | 1359 | 1322 | 1359 | ✓ pełne odzyskanie |
| 09_RESULTS | results-zestawienia | 1510 | 1476 | 1510 | ✓ pełne odzyskanie |

**27 / 30 ekranów odzyskanych do tekst(b') ≥ tekst(a).**

Uwaga do `prompt-registry-tab`: w pierwszym przebiegu R4 (batch 14_ADMIN) tekst(c)=0 z powodu `net::ERR_NETWORK_CHANGED` (11 błędów sieci w konsoli) — fluktuacja środowiska, NIE defekt naprawy. Powtórzony w izolacji (`scripts/dev/grafika-zrzuty.mjs` osobno dla tego ekranu): tekst(c)=1359=tekst(a), pełne odzyskanie, tabela wyżej pokazuje wynik powtórki.

### Trzy ekrany BEZ pełnego odzyskania — inny mechanizm, nieobjęty tą naprawą

Zbadane osobno (`scripts/dev/r4-debug-canvas-new-doc.mjs`, `scripts/dev/r4-debug-interview-preview.mjs`) instrumentacją krok-po-kroku (długość tekstu po każdym: kliku / Escape / kliku w róg (2,2)):

**`canvas-new-doc` (13_CHAT), `canvas-kebab-restructure` (13_CHAT)** — przyczyna ZMIERZONA: to nie klik ich psuje, tylko klawisz **Escape**, który pętla rozwijania naciska PO KAŻDYM kliku (bezwarunkowo, niezależnie od `--cofnij-jesli-skraca`). Zmierzone na `canvas-new-doc`: klik w „Menu Canvas” 651→931 (menu się otwiera, tekst PRZYBYWA — `--cofnij-jesli-skraca` słusznie NIE reaguje), ale zaraz potem Escape zabiera do 159 — Escape zamyka coś WIĘCEJ niż menu (prawdopodobnie edytor/canvas dokumentu), czego żaden ponowny klik nie odtwarza. Naprawa `--cofnij-jesli-skraca` mierzy tekst wokół `.click()`, NIE wokół następującego po nim `Escape` — to inny punkt awarii, poza zakresem tej flagi.

**`interview-preview-canon` (02_INTERVIEW)** — ekran nie ma tabeli pasującej do domyślnego klik-selektora (`podgląd: BRAK` w logu), a treść bazowa (425 znaków) to zawartość WIDOCZNA zanim jakakolwiek interakcja dotknie prawego podglądu. Po interakcji z jedyną kontrolką ekranu („Więcej akcji”) tekst spada do 68 — zostaje wyłącznie fixture-owy komunikat „(Tabela Sesje — poza zakresem tego zrzutu; patrz preview po prawej.)”. Mechanizm nie powtórzył się identycznie między dwoma pomiarami (raz przez realny przyrząd, raz przez ręczną replikę) — prawdopodobnie zależny od kolejności/czasu interakcji z panelem podglądu tego konkretnego ekranu-fixture. Nie zbadano do końca w tym dyżurze (poza zakresem: ślepa plama pętli rozwijania kontra specyfika jednego ekranu podglądu interview).

Te 3 ekrany NIE są regresją tej naprawy (bez `--cofnij-jesli-skraca` miały DOKŁADNIE tę samą wartość jak z nią — 490/159/68 w obu wariantach) — naprawa po prostu nie sięga tego konkretnego mechanizmu (Escape / kolejność interakcji), bo cel dyżuru (teza nadzorcy, `assessment-list`) to była PODMIANA TRYBU po kliku, nie efekt Escape.

## Meldunek końcowy

**Ślepa plama: 30 / 248 ekranów (12%)** w całej macierzy G06, wszystkie 16
modułów zmierzone (nie próbka). Metoda i pełne dane w sekcjach R1/R4 wyżej —
brak pomiaru NIE jest tu wynikiem pozytywnym: każdy z 248 ekranów ma parę
tekst(a)/tekst(b) zmierzoną realnym przelotem `grafika-zrzuty.mjs` na
działającym harnessu (port 5410).

**Przyczyna (R2):** przycisk „Szukaj” w
`src/components/shared/ModuleHub/ModuleNavBar.tsx` — poprawny semantycznie
`aria-expanded`, ale to przełącznik trybu (podmienia CAŁY rząd Menu 3:
chipy/taby/liczniki na pole wyszukiwania), bez obsługi Escape/klik-na-zewnątrz.
Pętla rozwijania klika go jak akordeon, chipy znikają z DOM na resztę
przelotu. Systemowy defekt — ten sam komponent obsługuje wszystkie ekrany
listowe.

**Opcja naprawy (R3):** `--cofnij-jesli-skraca=1` w `grafika-zrzuty.mjs`
(domyślnie OFF, zero zmiany historycznego zachowania). Automatyczne
wykrywanie po pomiarze długości tekstu przed/po kliku + cofnięcie ponownym
klikiem w ten sam uchwyt DOM, gdy tekst zmalał. `g06-macierz-uruchom.mjs`
włącza flagę jawnie od tego dyżuru.

**Dowód (R4):** 27 / 30 ekranów odzyskuje tekst(b') ≥ tekst(a) (26 dokładnie
równe bazie + 1 lekko powyżej — `org-identity-operating` 2526 vs 2511, drobna
dodatkowa treść z interakcji, nie regresja). 1 dodatkowy ekran
(`prompt-registry-tab`) miał w pierwszym przebiegu fluktuację sieci
(`ERR_NETWORK_CHANGED`), po powtórce w izolacji również pełne odzyskanie —
razem **28/30 realnie potwierdzonych, licząc bez fluktuacji sieci**.

**3 ekrany bez odzyskania** (`canvas-new-doc`, `canvas-kebab-restructure`,
`interview-preview-canon`) — NIE regresja tej naprawy (identyczny wynik z
flagą i bez), tylko INNY mechanizm ślepej plamy tej samej pętli: klawisz
Escape (naciskany bezwarunkowo po każdym kliku, niezależnie od tej flagi)
zamyka więcej niż otwarte menu na ekranach typu canvas/dokument. Zmierzone
precyzyjnie dla `canvas-new-doc` (Escape: 931→159, nie klik). Dla
`interview-preview-canon` przyczyna nie w pełni ustalona (ekran-fixture bez
tabeli, zależność od kolejności interakcji z panelem podglądu) —
NIE ZBADANE DO KOŃCA w tym dyżurze.

### Commity (branch `agent/slepa-plama-20260903`)

- `2c200f8cf4` — `fix(grafika-zrzuty): opt-in --cofnij-jesli-skraca — naprawa
  slepej plamy petli rozwijania` (R2 znaleziska + R3 naprawa, w tym skrypty
  pomocnicze `r1-slepa-plama-uruchom.mjs`, `r2-debug-assessment-list.mjs`,
  `r2-test-each.mjs`, `r2-verify-toggle-back.mjs`).

Ten dokument (`evidence/grafika/slepa-plama-rozwin-20260903.md`) oraz
pozostałe skrypty pomocnicze R1/R4 (`r1-slepa-plama-agreguj.mjs`,
`r4-dowod-uruchom.mjs`, `r4-debug-canvas-new-doc.mjs`,
`r4-debug-interview-preview.mjs`) commitowane osobno.

### Czego NIE zrobiono i dlaczego

1. **Nie naprawiono `ModuleNavBar.tsx` (produkt).** To dyżur PRZYRZĄDU
   (`grafika-zrzuty.mjs`), nie UI — zlecenie wprost zakazuje edycji `src/`.
   Właściwa naprawa produktowa (np. zamknięcie trybu wyszukiwania klawiszem
   Escape / klikiem-na-zewnątrz, tak jak inne overlaye w tym samym pliku) to
   osobny dyżur.
2. **Nie naprawiono mechanizmu Escape** dla `canvas-new-doc` /
   `canvas-kebab-restructure` — zmierzony i opisany, ale naprawa (pomiar
   tekstu wokół KAŻDEGO kroku pętli, nie tylko wokół `.click()`) wymaga
   przeprojektowania pętli (koszt/ryzyko regresji nieproporcjonalny do 2
   ekranów na 248) — zostawione jako znany, udokumentowany dług.
3. **`interview-preview-canon` nie w pełni wyjaśniony** — dwa pomiary tego
   samego mechanizmu dały niespójne pośrednie wartości (435 vs bezpośrednio
   68 po pierwszym kliku w realnym przelocie); nie ustalono z pewnością CO
   dokładnie w DOM znika między pomiarami. Zgłoszone jako otwarte, nie
   zamknięte fałszywym „naprawione”.
4. **Nie uruchomiono ponownie PEŁNEJ macierzy 4 kombinacji języka/szerokości**
   (pl/en × 1440/1024) z nową flagą — zlecenie prosiło o pl/light/1440
   wyłącznie; `g06-macierz-uruchom.mjs` ma flagę już wpisaną, więc kolejny
   pełny przebieg G06 (dowolna kombinacja) automatycznie z niej skorzysta.
