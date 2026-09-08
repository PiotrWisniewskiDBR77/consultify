# PLAN uspójnienia językowego aplikacji — 2026-09-08

**Zlecenie właściciela (08.09):** „Przejdź przez całą aplikację i uspójnij ją językowo.
W wersji polskiej mamy trochę angielskiego, w angielskiej trochę polskiego.
**PRIORYTET: wersja angielska. W wersji angielskiej nie ma być ANI JEDNEGO innego języka.**"

Pomiar, na którym stoi ten plan: [`POMIAR.md`](POMIAR.md). Liczby bazowe: `baseline.json`.
Kolejność modułów = kolejność menu z `docs/FUNCTIONAL_DOCUMENTATION.md`.

---

## 1. Skąd bierze się polski w wersji angielskiej — trzy kanały, trzy różne naprawy

Bez tego rozróżnienia paczki będą naprawiać nie to co trzeba. Uzasadnienie mechaniki: POMIAR §0.

| # | Kanał | Skala | Naprawa |
| --- | --- | --: | --- |
| **A** | **Polski `defaultValue` w `t('klucz', 'Tekst')`** — `fallbackLng.en=['en']` nie spada na PL, spada na default z kodu; a `useSuspense:false` pokazuje default jeszcze **przed** dojściem pliku EN | **1 558** (z tego **242** bez klucza w EN = widoczne na stałe) | default w kodzie **zawsze po angielsku**, polski wyłącznie w `pl/translation.json` |
| **B** | **Brak klucza w `en/translation.json`** — na ekranie ląduje surowy klucz | **429** | dopisać klucz do EN |
| **C** | **Tekst na sztywno w JSX poza `t()`** i **zdania z serwera** | **1 130** + **258** | przenieść do `t()` / zamienić na kod błędu |

Plik `en/translation.json` jest praktycznie czysty (**3** polskie wartości). **Naprawa wersji
angielskiej to robota w `src/**` i `server/src/**`, nie w `public/locales/en/`.**

---

## 2. Zasady docelowe (po akcepcie właściciela → do `CLAUDE.md`)

1. **EN = zero innego języka.** Żadnego polskiego słowa w interfejsie angielskim — poza nazwami
   własnymi z listy `scripts/i18n/pomiar-jezyka.wyjatki.json` (Consultify, DBR77, Teresa, KPI…).
2. **PL = zero angielskiego** poza tą samą listą nazw własnych.
3. **`defaultValue` w `t()` jest ZAWSZE po angielsku.** To wartość, którą zobaczy użytkownik EN
   przy braku klucza i przy każdym pierwszym malowaniu ekranu. Polski żyje wyłącznie
   w `public/locales/pl/`.
4. **Zero tekstu widocznego dla użytkownika poza `t()`.** Dotyczy też `placeholder`, `title`,
   `aria-label`, `alt`, tekstów pustych stanów i toastów.
5. **Serwer nie wysyła zdań, wysyła kody.** `res.status(4xx).json({ errorCode: 'INITIATIVE_LOCKED' })`;
   front tłumaczy `t('errors.INITIATIVE_LOCKED')`. Pole `error`/`message` zostaje **tylko** dla
   dziennika, nigdy nie jest renderowane.
6. **Enumy i statusy zawsze przez słownik.** Zakaz renderowania surowej wartości bazy
   (`UNKNOWN`, `SOLVER-1:SELECTED`) i zakaz sklejania enumu z polskim zdaniem
   („UNKNOWN Pewność: Nieznana").
7. **Daty, liczby, waluty przez wspólny `formatDate(locale)` / `formatNumber(locale)`.**
   Zakaz `toLocaleDateString()` bez argumentu i zakaz `'en-US'`/`'pl-PL'` na sztywno.
8. **Język AI = język interfejsu użytkownika.** Każdy prompt przechodzi przez
   `resolveResponseLanguage` + `withLanguageInstruction`. Zakaz zaszywania „po polsku"
   / „in English" w prompcie.
9. **Maile i dokumenty generowane** biorą język z `users.language` (wzorzec już działa
   w `server/src/routes/auth.routes.ts`).
10. **Bramka:** `node scripts/i18n/pomiar-jezyka.mjs --baseline docs/program/JEZYK_EN_PL_20260908/baseline.json`
    w pre-commit i w CI. **Ratchet: żadna kategoria nie może wzrosnąć.** Baseline wolno
    zaktualizować wyłącznie w dół, w tym samym commicie co naprawa.

---

## 3. Paczki dla robotników

**Wspólne dla KAŻDEJ paczki (nie powtarzam w opisach):**

* **KROK 0 — ZMIERZ PREMISĘ.** Uruchom `node scripts/i18n/pomiar-jezyka.mjs --modul "<moduł>"`
  i zapisz liczby **przed**. Jeśli twoja liczba różni się od tej z tabeli poniżej — **zgłoś to
  i zatrzymaj się**, nie „dostosowuj" naprawy do mojej liczby. Liczba nadzorcy bywa fałszywa.
* **DOWÓD.** (a) raport narzędzia przed/po dla tego modułu; (b) **zrzuty EN każdego ekranu modułu**
  (nie tylko głównego: zakładki Menu 1/2/3, modal tworzenia, podgląd, kebab) — `scripts/i18n/pomiar-jezyka-ekrany.mjs`
  jest wzorem, rozszerz o swoje trasy; (c) **mutacja bramki**: obniż baseline o 1 w swojej
  kategorii i pokaż, że bramka wywala kodem 1.
* **STOP.** Zatrzymaj się i zapytaj, gdy: (1) tekst wygląda na nazwę własną spoza listy wyjątków;
  (2) naprawa wymaga zmiany kontraktu API; (3) trzeba dotknąć testu asertującego polski napis
  w innym module; (4) liczba w module rośnie zamiast spadać.
* **ZAKAZY.** `git push`, `--no-verify`, `git stash`, masowe `sed` po `public/locales/**`.
  Baza gałęzi: `origin/demo`. Commit per krok, worktree per paczka, sprzątnąć worktree po scaleniu.
* **NIE tłumacz maszynowo.** Angielski default ma być normalnym angielskim, nie kalką.

### J0 — bramka, wyjątki, baseline (**Sonnet**, ~0,5 sesji) — **BLOKUJE WSZYSTKO**

Podpiąć `pomiar-jezyka.mjs --baseline` do hooka pre-commit (obok `check-list-canon.sh`)
i do CI. Przejrzeć `pomiar-jezyka.wyjatki.json` pod kątem fałszywych trafień na nazwach
własnych (uruchom `--kategoria K4en --przyklady 50` i wypisz, co jest nazwą własną, a co defektem).
Zamrozić `baseline.json`. **Dowód: mutacja bramki + jeden commit odrzucony przez hooka.**

### J17 — serwer: zdania → kody błędów, enumy → słownik (**Opus**, ~3 sesje) — **PRZED J1–J16**

Idzie **przed** paczkami modułowymi, bo dotyka kontraktów, których J1–J16 będą używać, a jego
efekt (`UNKNOWN Pewność: Nieznana`) widać na pierwszym ekranie Inicjatyw.

* **258 K5pl** (polskie zdania z serwera) → `errorCode` + wpis w `errors.*` w obu plikach.
* **1 822 K5en** — **nie tłumaczyć na polski**, przenieść na ten sam mechanizm kodów.
  Realistycznie: w tej paczce **tylko te, które front faktycznie renderuje** — wypisać listę
  z `grep` po `catch` / `toast` / `setError` w `src/`, resztę zostawić jako dług z listą.
* **Słownik enumów** na froncie: `UNKNOWN`, `SOLVER-1:SELECTED`, statusy inicjatyw/zadań.
  Zakaz sklejania enumu ze zdaniem.
* Ryzyko: kontrakt API. **Każda zmiana kształtu odpowiedzi = STOP i pytanie.**

### J1–J16 — moduły w kolejności menu (**Sonnet**; Materials/Finance też Sonnet, ale dwie sesje)

W jednej paczce **najpierw EN, potem PL tego samego modułu** — dwukrotne wchodzenie w ten sam
plik to podwójne ryzyko konfliktu (patrz decyzja właściciela w §5, pytanie 2).

Szacunek: `sesje ≈ (K1def + K3aKLUCZ)/120 + (K4pl + K4en)/60`, zaokrąglone w górę do 0,5.
Formuła jest jawna, żeby dało się ją zakwestionować: defaulty `t()` to praca mechaniczna,
hardcode w JSX wymaga wymyślenia klucza i dopisania go do **dwóch** plików.

| Paczka | Moduł | K1def | K3aKLUCZ | K4pl | K4en | K7 | Sesje | Uwaga |
| --- | --- | --: | --: | --: | --: | --: | --: | --- |
| J1 | 01 Chat | 172 | 0 | 68 | 34 | 27 | **3,5** | 63 defaultów widocznych na stałe |
| J2 | 02 My Work | 182 | 0 | 78 | 71 | 75 | **4,0** | najwięcej K7 poza Adminem |
| J3 | 03 Interview | 0 | 0 | 3 | 2 | 9 | **0,5** | najczystszy moduł |
| J4 | 04 Tools | 75 | 9 | 83 | 36 | 9 | **3,0** | |
| J5 | 05 Assessment | 35 | 12 | 188 | 43 | 30 | **4,5** | rekord K4pl — raport oceny |
| J6 | 06 Initiatives | 131 | 0 | 43 | 32 | 40 | **2,5** | **ekran dowodowy właściciela** |
| J7 | 07 Execution | 209 | 0 | 119 | 86 | 35 | **5,5** | `ExecutionControlSurface.tsx` 135 trafień |
| J8 | 08 Results | 45 | 0 | 3 | 8 | 10 | **1,0** | |
| J9 | 09 Finance | 176 | 54 | 183 | 22 | 49 | **5,5** | 520 kluczy bez pary w EN |
| J10 | 10 Materials | 231 | 215 | 165 | 89 | 67 | **8,0** | **najgorszy moduł**; podzielić na Dokumenty / Prezentacje / Arkusze |
| J11 | 11 Audits | 0 | 0 | 4 | 5 | 3 | **0,5** | |
| J12 | 12 Meeting | 22 | 0 | 4 | 0 | 0 | **0,5** | moduł ukryty w MVP (DEC-425) — robić na końcu |
| J13 | 13 Organization | 29 | 0 | 53 | 7 | 6 | **1,5** | **drugi ekran dowodowy** |
| J14 | 14 Admin Panel | 36 | 1 | 10 | 571 | 288 | **10,0** | 571 angielskiego hardcode boli **PL**, nie EN → niższy priorytet mimo rozmiaru |
| J15 | 15 Settings | 7 | 16 | 30 | 136 | 81 | **3,0** | |
| J16 | 16 Partner Portal | 131 | 19 | 24 | 21 | 34 | **2,0** | `PartnerPortalView.tsx` 95 trafień |
| — | ZZ wspólne (nawigacja, layout, błędy, prawne) | 77 | 103 | 72 | 233 | 141 | **7,0** | **rozdzielić między paczki**, nie robić osobno — inaczej dwie ręce w tych samych plikach |

**Kolejność wydawania (priorytet EN, nie rozmiar):**
J0 → J17 → **J6, J13** (ekrany, które właściciel widział zepsute) → J10, J9, J7 (najgorsze dla EN)
→ J1, J2, J16, J4, J5 → J15, J8, J11, J3 → J14, J12 (bolą PL albo są ukryte).

### J18 — daty, liczby, waluty (**Sonnet**, ~2 sesje)

904 trafienia K7. Jeden wspólny `formatDate/formatNumber/formatCurrency` czytający `i18n.language`,
codemod po `toLocaleDateString()` / `Intl.*`. **Uwaga:** 288 z 904 siedzi w Admin Panelu —
ta paczka i J14 dotykają tych samych plików, **nie puszczać równolegle**.

### J19 — maile transakcyjne i dokumenty (**Sonnet**, ~2 sesje)

8 szablonów `.hbs` i 7 serwisów mailowych są **tylko po angielsku i nie patrzą na język**.
Wzorzec do skopiowania istnieje: `server/src/routes/auth.routes.ts` czyta `users.language`.
Dołożyć warianty PL, wybór po `users.language`, i te same reguły do generatorów PDF/DOCX
(`drdReportHtml.ts` ma `'Wygenerowano'` zaszyte po polsku).

### J20 — język odpowiedzi AI (**Opus**, ~3 sesje)

Mechanizm istnieje (`services/ai/responseLanguage.ts`), ale woła go **4 miejsca na 95**
budujących `systemPrompt` (≈4 %). Do tego **31 promptów ma zaszyte „po polsku"** i **24 „in English"**.
Przepiąć wszystkie na `resolveResponseLanguage(users.language) + withLanguageInstruction`,
usunąć zaszyte instrukcje. **To jedyna paczka, w której użytkownik EN dostaje polski tekst
wygenerowany na żywo — bez niej „zero innego języka" jest nieosiągalne.**

**Suma szacunku: ≈ 73 sesje robotnika** (J1–J16 + wspólne = 62,5; J0/J17/J18/J19/J20 = 10,5). To szacunek z formuły, nie obietnica.

---

## 4. Ryzyka

1. **299 plików testowych asertuje polskie napisy** w `getByText` / `toContain` /
   `toHaveTextContent` (zmierzone). Zmiana defaultu `t()` z polskiego na angielski **wywali te
   testy** — i to jest właściwe zachowanie, ale robotnik musi je poprawić w tej samej paczce,
   inaczej wróci z „testy nie przechodzą, cofam naprawę".
2. **Fałszywe trafienia i fałszywe przepuszczenia** heurystyki (POMIAR §6). Krótkie etykiety bez
   diakrytyków („Portfel", „Definicja", „Realizacja") **nie są łapane** — liczby są dolną granicą.
   Robotnik ma czytać ekran oczami, nie tylko raport.
3. **Zero na skanie wizualnym ≠ moduł czysty.** Chat, My Work i Meeting miały 15–32 linie tekstu,
   bo są puste. Dopóki nie ma danych, ten pomiar o nich milczy.
4. **Konflikty w `public/locales/*.json`** — dwa pliki po ~2 MB, wszystkie paczki w nie piszą.
   Zasada: jedna paczka = jedna gałąź = scalanie po kolei, **nie równolegle w tym samym namespace**.
5. **J14 i J18 dzielą pliki** (288 z 904 trafień K7 jest w Adminie) — kolejno, nie równolegle.
6. **K5en (1 822) to nie jest zadanie „przetłumacz na polski"** — to zadanie „przenieś na kody".
   Robotnik, który zacznie tłumaczyć zdania serwera, zepsuje kontrakt i wydłuży pracę
   kilkukrotnie. To najbardziej prawdopodobny błąd wykonania w całym planie.
7. **Ryzyko regresji dla PL.** Zmiana defaultów na angielskie oznacza, że **każda dziura
   w `pl/translation.json` natychmiast pokaże angielski Polakowi**. Dlatego każda paczka
   modułowa robi EN **i** PL — inaczej naprawiamy jedno, psując drugie.

---

## 5. Pytania do właściciela (tak / nie)

1. **Nazwy własne narzędzi zostają nieprzetłumaczone w obu wersjach** — „Teresa", „Studio",
   „Consultify", „DBR77"? (Lista: `scripts/i18n/pomiar-jezyka.wyjatki.json`.) **TAK / NIE**
2. **Polski naprawiamy w tej samej paczce co angielski** (jeden moduł = jedno wejście w plik),
   czy dopiero po domknięciu całego EN? Rekomendacja: **w tej samej paczce** — inaczej zmiana
   defaultów na angielskie odsłoni dziury PL i Polacy zobaczą angielski. **TA SAMA / PÓŹNIEJ**
3. **Język odpowiedzi AI zawsze = język interfejsu użytkownika** (`users.language`), nawet gdy
   materiał źródłowy jest po polsku? Dziś mechanizm zgaduje z treści. **TAK / NIE**
4. **Dane pokazowe (K6)** — nazwy inicjatyw, zadań, KPI po polsku w wersji EN: robimy **osobny
   komplet angielskich danych pokazowych** (`docs/program/DANE_POKAZOWE_EN_20260908/`), czy na
   ten MVP zostawiamy polskie dane i uspójniamy **tylko interfejs**? **OSOBNY KOMPLET / TYLKO UI**
