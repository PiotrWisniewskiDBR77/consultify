---
doc_id: przekazanie-grafika-20260901
status: canonical
truth_type: handover
established: 2026-09-01
od: nadzorca toru grafiki (sesja 31.08–01.09)
dla: następcy — czytaj PRZED dotknięciem czegokolwiek
---

# PRZEKAZANIE — tor Grafika, 01.09.2026

Właściciel kończy sesję. Ten dokument ma dać następcy odtworzenie stanu w 10 minut
i nie powtórzyć błędów dzisiejszych dwóch dni. Liczby poniżej są **zmierzone
w tej samej godzinie, w której powstał ten plik** — nie przepisane z pamięci
(patrz Złota Reguła 1 w `CLAUDE.md`).

---

## 1. ZACZNIJ TU

**Kolejność czytania:** ten plik → sekcja 4 „★ CZEGO NIE POWTARZAĆ" (najważniejsza) →
`DZIENNIK_GRAFIKA.md` wpisy Z-20…Z-36 → `00_ZASADY_PRACY.md` reguły 0–16 →
`AUDYT_PRZYRZADU_20260901.md` (dziś, najświeższe, największe ryzyko — patrz §3).

**Katalog:** `/private/tmp/m03`, gałąź `codex/m03-admin-20260824`. To **współdzielony
worktree** — przed czymkolwiek: `git status`, `git log -1`, sprawdź czy tip się nie
przesunął pod Tobą (patrz Z-29, §4 niżej).

**Podnieś stanowisko.** Powstało `scripts/dev/stanowisko.mjs` (commit
`595b7bf43f`, zacommitowany, `git status` czysty) — jedno narzędzie do
harnessu (:3020) i strony odbioru (:3030), komendy `start|stop|status|restart|sprawdz`:

```
node scripts/dev/stanowisko.mjs start
```

`start` sam sprząta osierocone procesy i podnosi TYLKO tę usługę, która nie
odpowiada — zdrowej nie rusza (nagłówek pliku: jednego dnia ręczne
podnoszenie trzy razy zatrzymało pracę właściciela — zniknięte pliki, padnięty
harness przy podwójnym starcie, osiem osieroconych procesów). `sprawdz`
weryfikuje nie tylko kod odpowiedzi HTTP, ale czy serwer oddaje sensowną
treść; kody wyjścia 0/1 nadają się do bramki.

**Awaryjnie** (gdyby `stanowisko.mjs` zawiódł), ręcznie dwoma poleceniami,
każde w osobnym terminalu:

```
npx vite --config dev-render/vite.config.ts --port 3020 --strictPort
```
```
node scripts/dev/odbior-serwer.mjs
```

Harness (3020) renderuje pojedyncze ekrany z mockowymi danymi — bez logowania.
Strona odbioru (3030) czyta/zapisuje `docs/program/grafika/odbior.sqlite` i woła
harness pod spodem (`HARNESS=http://127.0.0.1:3020` domyślnie). Otwórz
`http://127.0.0.1:3030/`.

**Sprawdź stan bramki, zanim uwierzysz status.json:**

```
node scripts/dev/odbior-kontrola.mjs --maks-wiek-godzin=400
```

Dziś: `CZYSTO — można oddawać` (512/512 kart A/B, oba motywy, bez zastrzeżeń wieku/rozmiaru).
Bramka jest MECHANICZNA (brak zrzutu, faza-PRZED jako najnowsza, wiek pliku, podejrzanie
mały rozmiar) — nie sprawdza **czy zrzut pokazuje produkt**. To osobna, dziś odkryta
dziura — patrz §3 i §4.

---

## 2. STAN LICZBOWY (zmierzone 2026-09-01)

| Miara | Wartość | Źródło |
| --- | --- | --- |
| Ekranów łącznie w `status.json` | **313**, 18 modułów | `status.json` |
| — ocena A | 184 | policzone z `status.json` |
| — ocena B | 72 | policzone z `status.json` |
| — ocena C (nie pokazujemy) | 24 | policzone z `status.json` |
| — ocena D (odłożone) | 33 | policzone z `status.json` |
| Kart A/B idących do właściciela | **256** (512 z dwoma motywami) | `status.json` + `odbior-kontrola.mjs` |
| Ekranów rozstrzygniętych przez właściciela (`decyzje`) | **260** | `odbior.sqlite` |
| — decyzja `ok` | 255 | `odbior.sqlite` |
| — decyzja `poprawka` | 3 | `odbior.sqlite` |
| — decyzja `nie` | 2 | `odbior.sqlite` |
| Wpisów w `historia` (log zdarzeń odbioru) | 938 | `odbior.sqlite` |
| Wpisów w `poprawki` | 93 | `odbior.sqlite` |
| Commitów na tej gałęzi, 31.08–01.09 | **233** | `git log --oneline --since="2026-08-31 00:00"` |
| Bramka `odbior-kontrola.mjs` | **CZYSTO** — 512/512 bez zastrzeżeń | uruchomione dziś |

**Uwaga do liczby 260/313.** Rejestr ekranów (313) jest większy niż liczba rozstrzygnięć
(260), bo część ekranów w rejestrze to warianty/aliasy bez własnej karty odbioru
(patrz Z-25) — to normalne, nie luka.

---

## 3. CO JEST OTWARTE

Uszeregowane po priorytecie realnego ryzyka dla właściciela, nie po dacie zgłoszenia.

### ★★ NAJWYŻSZY PRIORYTET — audyt przyrządu, dziś, bezpiecznik napisany ale jeszcze NIEZACOMMITOWANY

`AUDYT_PRZYRZADU_20260901.md` (dyżur 177): na **240/240** plików harnessu zmierzono
mechanicznie zgodność z produktem. Wynik: **41 ekranów** ma udokumentowaną rozbieżność
wobec produkcji, z czego **29 ma dziś ocenę A lub B** — czyli są dziś pokazywane
właścicielowi jako gotowe, a mogą pokazywać nieprawdę. Pięć przypadków z dowodem
`plik:linia`, m.in.: `idea-table` (ocena B) **NADAL, po dwóch naprawach**, dokłada pasek
`TopBar`, którego produkcja (`MyIdeasListContent.tsx`) nie ma; `agent-plan-canvas` (A)
odtwarza dwukolumnowy układ, który kod produkcji opisuje komentarzem jako **naprawiony
błąd**; cztery panele Finansów ocenione jako osobne kartki, w produkcie to jedna szuflada
z zakładkami; `calendar-sync-settings` (A) to przepisany markup z **zerem** wywołań `t()`
— defekty tłumaczeń nigdy się tu nie ujawnią. **Stan sprawdzony na 2026-09-01, przy pisaniu tego dokumentu:** plik
`scripts/check-dev-render-parytet.mjs` (614 linii, reguły R1/R2/R3 +
ostrzeżenie PODPIS opisane w nagłówku) **już istnieje na dysku**, ale jest
**NIEZACOMMITOWANY** w tym współdzielonym worktree (`git status` pokazuje go
jako `??`) — nikt jeszcze nie wprowadził go do repozytorium. Uruchomienie:
`node scripts/check-dev-render-parytet.mjs [--all] [--report] [--update]
[--ekran=<id>]`; linia bazowa (`scripts/check-dev-render-parytet.baseline.txt`)
**jeszcze nie istnieje** — bez niej bramka porównuje każde naruszenie do
pustego zbioru (niesprawdzone uruchomieniem w tym dyżurze, sprawdź przed
poleganiem). Priorytet nadal #1: zacommitować plik, ustalić linię bazową
(`--update`), potem przejść 29 zagrożonych kart pojedynczo.

### Staging kontra demo — analiza gotowa, czeka na decyzję właściciela

`ANALIZA_STAGING_DEMO.md`, plan 9 kroków (KROK 0–8). Kluczowe ustalenia: rozłączenie
staging/demo z 28.08 (DEC-227/DEC-237) wykonano **tylko w roli produktowej i w kodzie
strażnika domen** — **nie w bazie** (DEC-176: właściciel świadomie zostawił jedną wspólną
bazę `trolley`, etap E4 „rozcięcie" nigdy nie wykonany) i **nie w drodze powrotnej
staging→demo** (nie istnieje w repozytorium, Znalezisko 3). Demo stoi na kodzie
z **13.08** (18 dni), 3926 commitów za HEAD (nie 11 tysięcy — ta liczba dotyczy martwej
gałęzi `develop`, nie demo). Pipeline stagingu **celuje w martwą gałąź `develop`**
(stoi od 2 czerwca). Job `deploy-staging` **nie uruchamia bramki kompilacji**
(`deploy-gate.sh` — tsc/eslint/build) — tylko `deploy-production` ją ma; staging przyjmie
kod, który się nie kompiluje. Sekcja 6 dokumentu ma trzy pytania do właściciela
z rekomendacją każde — do rozstrzygnięcia PRZED wykonaniem planu.

### Dwie poprawki właściciela wymagające roboty serwerowej (nie graficznej)

Z `PARTIA_DO_ZATWIERDZENIA_20260901.md` §3: (1) wygląd otwartej, edytowalnej Sprawy
odchylenia KPI (płaskie pola, szare przyciski) — prawdopodobne prawdziwe źródło skargi
„jak sprzed 5 lat", wymaga osobnej rundy stylowania formularza; (2) „Ryzyka wymagające
przeglądu" w Kolejce uwagi Administracji zawsze pokazuje 0 — to błąd odczytu pola
z odpowiedzi serwera, nie wygląd; zgłoszone do toru funkcji.

### Funkcje utracone przy wycofaniu starego huba Wyników

`ODLOZONE.md` §„SPRAWA DO DECYZJI WŁAŚCICIELA" + `ANALIZA_ODRZUCONE_20260901.md`.
Zmierzone greppem po realnych wołaczach (nie z dokumentacji): **diagnostyka odchyleń**
(`ff_deviationDiagnostics`) — trzy silniki serwera żyją i są zamontowane w routerze
(`kpiAnomalyService`, `kpiForecastService`, `deviationRcaSuggestService`), ale wołaczy
w interfejsie jest **zero**; **karta naprawcza** — następca (`KpiDeviationCaseSubview`)
ma odpowiedniki dla większości funkcji, ale **cztery są utracone**: powiązanie działania
z Zadaniem, eksperymenty (utwórz/recenzuj/rozstrzygnij), zależności i ryzyka, typ działania
IMMEDIATE/DURABLE. Decyzja CTO z rozmowy z właścicielem: **diagnostykę odchyleń i
powiązanie z Zadaniem robimy; zależności/ryzyka i typ działania odkładamy; eksperymenty
NIE wracają** — ta decyzja **jeszcze nie jest wpisana** do `ODLOZONE.md` (plik wciąż
pokazuje wszystkie cztery jako „do rozstrzygnięcia") — następca powinien ją tam dopisać
przy najbliższej okazji, żeby dokument nie kłamał.

### Warsztat OKR do przebudowy

`results-vnext-okr-workspace` — dziś ocena A, na demo jako główne „Otwórz" w rejestrze
OKR, ale zgodnie z `ANALIZA_ODRZUCONE_20260901.md` (rekomendacja: PRZEBUDOWAĆ, nie
zdejmować) świadomie **odłożone**; plan przebudowy w `ODLOZONE.md`.

### Zgłoszenia do toru funkcji

`ZGLOSZENIA_DO_TORU_FUNKCJI.md` — **23 sprawy** poza mandatem grafiki. Najpilniejsza:
**#1, P0-bezpieczeństwo** — okno 300 ms bez ochrony trybu demo przy przełączaniu
(`useAppStore.ts:94-95` → `api.ts:761,778-780`); zapis flagi `isDemoMode` do
`localStorage` ma debounce 300 ms, więc żądanie wysłane w tym oknie może pójść bez
nagłówka `X-Demo-Mode`. Status: **hipoteza z dowodem kodowym**, NIE zmierzone na żywym
backendzie — wymaga osobnego dyżuru pomiarowego z instrumentacją, zanim wejdzie do
rejestru jako potwierdzone (dyscyplina z Z-24/pamięć „hipoteza nadzorcy staje się
faktem" — nie podnosić statusu bez pomiaru mutacyjnego).

---

## 4. ★ CZEGO NIE POWTARZAĆ

To jest sekcja, którą trzeba przeczytać w całości, nie po łebkach.

### Stanowisko pomiarowe kłamie — siedem zmierzonych dziś sposobów

| # | Sposób kłamstwa | Jak wykryć |
| --- | --- | --- |
| Z-20 | Strona odbioru pokazywała STARE zrzuty na 120/229 kart — indeks wybierał plik po **kolejności alfabetycznej katalogu**, a „15-"/„99-" sortuje się za „144-" | Wybór wg **mtime pliku**, nie porządku alfabetycznego; własny przegląd nadzorcy PRZED właścicielem (reguła 3) |
| Z-21 | 8 z 16 wejść harnessu nigdy nie ustawiało języka — ekrany wychodziły po angielsku mimo polskiego produktu; naprawione raz 27.08, **odrosło** w bliźniaczych plikach | Kopiować naprawę w CAŁOŚCI wraz z kolejnością zdarzeń (język PO inicjalizacji, montaż PO języku), nie fragmentem |
| Z-22 | Zrzut bez wymaganych parametrów adresu (np. brak `state=reopened`) pokazywał **pustkę** zamiast naprawionego ekranu | Parametry adresu to część tożsamości ekranu — czytać z nagłówka pliku; pusty ekran = podejrzenie błędu pomiaru, nie defekt produktu, dopóki nie sprawdzone |
| Z-24 (1) | Robotnik meldował „rejestr i bramka nie istnieją w repozytorium" — bo szukał w **złym katalogu** | Zweryfikować katalog roboczy PRZED wnioskiem |
| Z-26 | `grafika-zrzuty.mjs` zrzucał zawsze **slajd 1** prezentacji, bo nie umiał wcisnąć klawisza — każdy pomiar odpowiadał na „jak wygląda strona tytułowa", nie „czy jest macierz" | Dodano `--klawisze`; przy multi-slajdowych ekranach sprawdzić, czy narzędzie faktycznie nawiguje, nie tylko otwiera |
| Z-27/Z-32(a) | Harness **dokładający panel nieobecny w produkcie** (`ArtifactRightPanel` na `processflow-canvas`, który w produkcji ma własny `IdeaElementInspector`) — właściciel ocenił „na tym obrazie jak go nie mogę ocnić" i miał rację, panel inspektora jest pusty bez kliknięcia | Sprawdzić w kodzie, KTÓRY komponent faktycznie montuje ekran, nie zakładać po nazwie rodziny |
| Z-32(b) | `max-w-3xl` siedział w **harnessie zrzutów** Finansów, nie w produkcie — tabela urosła z 740 do 1364 px po zdjęciu | Zanim uznasz „tabela za wąska" za defekt produktu, sprawdź czy limit nie jest wklejką harnessu |

**Dziś dołączony, największy: `AUDYT_PRZYRZADU_20260901.md` (dyżur 177) — 41 ekranów
harnessu odtwarza kompozycję, której produkcja nie ma; 29 z nich ma ocenę A/B.** To ta
sama rodzina, ale zmierzona systemowo (240/240 plików), nie punktowo. Trzy nowe wzorce
kłamstwa w tej rodzinie: **harness dokładający własny `<TopBar>`/panel, którego wołacz
produkcyjny nie ma** (`idea-table` — po DWÓCH naprawach nadal); **harness montujący
układ, który kod produkcji opisuje komentarzem jako naprawiony błąd** (`agent-plan-canvas`
— dwukolumnowy grid, gdy produkcja ma trójkolumnowy pełnoszerokościowy flex); **harness
montujący kilka modali naraz w jednym kadrze, z których produkcja pokazuje tylko jeden**
(`mindmap-i18n-smoke` — trzy modale zamontowane, jeden widoczny na zrzucie, ocena A
dotyczy jednej trzeciej tego, co ekran obiecuje). Zrzut **bez kliknięcia otwierającego
panel** to osobny, czwarty wzorzec (Z-27, `processflow-canvas`) — puste okno wygląda jak
defekt, choć trzeba było kliknąć węzeł. Jak wykryć każdy z tych czterech: `grep` w `src/`
za realnym wołaczem komponentu montowanego w pliku harnessu; jeśli para komponentów
z harnessu nigdy nie występuje razem w żadnym pliku `src/`, to kompozycja wymyślona.
Bezpiecznik `check-dev-render-parytet.mjs` (napisany, na dysku, ale jeszcze
NIEZACOMMITOWANY — patrz §3 dla dokładnego stanu i sposobu wywołania) ma to
łapać mechanicznie.

### Mechanizm „raport mówi co innego niż obraz" — złapane co najmniej 4 razy dziś

Z-24 wylicza dwanaście przypadków w jednym dniu, gdzie ekran wyglądał na zepsuty, a
zepsuty był przyrząd albo raport, nie produkt — w tym: strona odbioru z indeksem
alfabetycznym (120/229 kart), 8 wejść harnessu bez języka, zbiorczy przebieg bez
parametrów adresu, robotnik szukający w złym katalogu. Wzorzec: raport/zrzut twierdzi
jedno, żywy kod robi drugie — **rozstrzyga zawsze kod i pomiar mutacyjny, nigdy sam
raport**. Bezpiecznik: `node scripts/dev/odbior-kontrola.mjs` przed każdą partią
(mechaniczne, bo „oko przywyka" — pamięć nadzorcy „Przyrząd kłamie, a oko przywyka").

### Pułapki współdzielonego katalogu — 8 incydentów

Z-16 (cztery naraz: cudze locale zaciągnięte do commita, cudze staged locale w gołym
commicie, 6 cudzych zrzutów PNG zmiecionych gołym `git commit`, właściciel zrzutów zastał
je w cudzym commicie), Z-17 (piąty: krzyżowa zamiana treści commitów między dwoma
robotnikami w tym samym oknie wyścigu, naprawione `--amend` PRZED instrukcją nadzorcy),
Z-18 (szósty: `git stash` mimo jawnego zakazu w zleceniu, bez szkody), Z-29 (ósmy i
najgroźniejszy: **7392 pliki kodu zniknęły w nocy** z `/private/tmp/m03`, worktree
przestał widzieć siebie — nic nie zginęło z repozytorium, ale to pierwszy incydent, który
realnie zatrzymał pracę właściciela, nie tylko robotnika). Jak wykryć: `git status`,
`git show --stat HEAD` po KAŻDYM commicie robotnika; commit **tylko z jawnym pathspec**
(reguła 14); nigdy `git stash` (reguła 8, Z-18); przy podejrzeniu ubytku —
`ls <katalog> | wc -l` wobec `git ls-tree HEAD` (kontrola integralności worktree
zgłoszona do toru funkcji po Z-29, jeszcze niezbudowana).

### Reguła 16 — reguła dopuszcza czy nakazuje (Z-34)

Robotnik, mając polecenie „nie trzeba tłumaczyć angielskiego na polski", **zamienił
działające polskie nazwy na angielskie** na slajdzie 5 prezentacji — dokładnie odwrotnie
niż intencja. Nadzorca cofnął PRZED pokazaniem właścicielowi. Test: jeśli po naprawie
dwa sąsiadujące ekrany zaczynają mówić różnymi językami/stylami — reguła została
rozciągnięta za daleko. Cofnij i zapytaj, nie zgaduj kierunku.

### Skill jako punkt wejścia starzeje się osobno od normy, którą cytuje (Z-36)

`consultify-preview` SKILL.md miał odwróconą kolejność bloków stopki preview względem
poprawionej 02.08 normy `TABLE_AND_PREVIEW_CANON.md` — trzecie zgłoszenie tej samej
rzeczy przez właściciela. Wykonawca czyta skill jako wejście i naprawiłby zgodny ekran,
żeby dopasować go do NIEAKTUALNEGO opisu. Naprawione dziś. Wniosek: dokument, który
normę tylko CYTUJE, potrzebuje własnej daty poprawki i przeglądu przy każdej zmianie
źródła.

---

## 5. CO DZIAŁA I WARTO UTRZYMAĆ

**Trzy warstwy kontroli, w tej kolejności:** (1) naprawa u przyczyny, rodzinami, nie
per ekran; (2) ocena na ŚWIEŻYM zrzucie PRZED/PO, obejrzanym oczami nadzorcy PRZED
właścicielem; (3) bramka mechaniczna (`odbior-kontrola.mjs`) tuż przed oddaniem —
mechaniczna, bo oko przywyka.

**Warunek weryfikowalny w zleceniach przeglądowych.** Zlecenie robotnikowi ma zawsze
żądać realnej liczby z pomiaru (np. „ile ekranów faktycznie ma świeży zrzut" —
`ls evidence/grafika/<katalog> | wc -l` wobec liczby w tabeli robotnika), nie
deklaracji „zrobione". To złapało Z-14 (dwaj robotnicy ocenili ekrany bez pomiaru,
0/31 i 1/22 świeżych zrzutów).

**Naprawa rodzinami zamiast per ekran.** Pierwszy pomiar zawsze pokazuje dolną granicę
(Z-23): 3 zgłoszone surowe wartości → 12 realnych; kilka dat US → 29 w 22 plikach.
Zlecenie ma zawsze żądać przemiecenia całego obszaru tym samym wzorcem, nie punktowej
łatki — inaczej defekt odrasta (patrz `naprawa-per-wywolanie-odrasta`, pamięć nadzorcy).

**Zasada „awans oceny wymaga obrazu, nie deklaracji".** Ocena ekranu w `status.json`
zmienia się WYŁĄCZNIE po obejrzeniu świeżego zrzutu PRZED/PO — nigdy po samym raporcie
robotnika, że „naprawione". Reguła 13 w `00_ZASADY_PRACY.md`.

---

## 6. PROTOKÓŁ Z WŁAŚCICIELEM

Właściciel (Piotr) mówi po polsku, krótko, obrazkami — żargon go blokuje (dziś wprost:
„nie wiem o czym mówisz"). Nadzorca dowodzi i pracuje tanimi modelami (Sonnet/Haiku do
mechaniki, Opus tylko trudny kod). Właściciel oddał decyzje produktowe i techniczne —
pyta się go wyłącznie o to, co widzi OCZAMI, i o pieniądze. Ceni surową szczerość i
sprostowania własnych błędów bardziej niż dobre wiadomości. **Właściciel NIGDY nie jest
pierwszym testerem wizualnym** (reguła 3 w `00_ZASADY_PRACY.md`, reguła nadrzędna nr 7
w `CLAUDE.md`) — zawsze: prototyp → wstępny OK → realny zrzut nadzorcy sam → dopiero
wtedy właściciel patrzy, do AKCEPTU nie do odkrywania zepsucia.

---

## 7. MAPA DOKUMENTÓW

- `status.json` — maszynowy stan rejestru ekranów (313, A/B/C/D), źródło dla strony odbioru.
- `odbior.sqlite` — żywa baza decyzji właściciela (`decyzje`, `historia`, `poprawki`).
- `DZIENNIK_GRAFIKA.md` — chronologia zdarzeń Z-1…Z-36, kontekst którego nie da się odtworzyć z samego wyniku.
- `00_ZASADY_PRACY.md` — reguły 0–16, w tym reguła nadrzędna nr 0 i zakaz `git stash` (8).
- `ANALIZA_STAGING_DEMO.md` — śledztwo staging/demo, plan 9 kroków wyjścia, czeka na decyzję właściciela.
- `UWAGI_ODBIOR_20260901.md` — 85 uwag właściciela pogrupowanych w 13 rodzin, z sekcją regresji.
- `ANALIZA_ODRZUCONE_20260901.md` — cztery odrzucone ekrany, analiza pojedynczo, z sekcją wykonania.
- `PARTIA_DO_ZATWIERDZENIA_20260901.md` — pięć ekranów domkniętych dziś, czeka na przejrzenie właściciela.
- `ZGLOSZENIA_DO_TORU_FUNKCJI.md` — 23 sprawy poza mandatem grafiki, w tym P0 (okno 300 ms).
- `AUDYT_PRZYRZADU_20260901.md` — 41 ekranów harnessu rozbieżnych z produktem, 29 na A/B, bezpiecznik proponowany.
- `ODLOZONE.md` — świadomie odłożone prace, w tym sprawa utraconych funkcji huba Wyników.
- `KANON_Z_ODBIOROW.md` — decyzje zamykające, wiążące na przyszłość (m.in. „jedna Teresa", macierz DRD).
- `MAPA_UWAG_WLASCICIELA.md` — poprzednik `UWAGI_ODBIOR_20260901.md`, klastry K1–K12 z sesji 30.08.
- `REJESTR_EKRANOW.md` — inwentarz ekranów z adnotacjami CLOSED_FINAL historycznych modułów.
