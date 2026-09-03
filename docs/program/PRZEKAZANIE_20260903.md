---
doc_id: program-przekazanie-20260903
status: canonical
data: 2026-09-03
---

# Przekazanie — 3 września 2026

Linia pracy: **`github-backup/grafika/m03-20260902`**, tip `75f846f837`, katalog `/private/tmp/m03`.
Wszystko wypchnięte — **zero commitów różnicy** wobec kopii zapasowej.

## 1. Gdzie jesteśmy — trzy zdania

**240 z 336 bramek zamkniętych.** Rano 2 września było 159, dobę wcześniej 125.
Zostało **sześć kolumn po szesnaście**: `G06` (dostępność), `G14`–`G16` (cykl napraw),
`G19`–`G20` (finał). **Ani jednej pojedynczej resztki, ani jednej rzeczy czekającej na właściciela.**

## 2. ★ Najważniejsze ustalenie o zależnościach

**`G06`, `G14`, `G15`, `G16` to nie cztery fale, tylko jedna robota widziana z czterech stron:**
napraw defekt → udowodnij → spakuj do przeglądu → zapisz ślad do commita.
Nadzorca planował je szeregowo i **to był błąd**. Robią się równolegle.

**Jedyna prawdziwa szeregowość: `G19` i `G20`** — regresja po wszystkich zmianach i finalny
przebieg szesnastu modułów naraz. Z definicji ostatnie.

**Wąskim gardłem nie jest kolejność, tylko liczba rąk NAPRAWIAJĄCYCH.** Pomiaru mamy z nadmiarem:
sześć dyżurów `G06`, ponad 1500 kadrów, dziewięć rejestrów.

## 3. ★★★ Lekcja dnia — mierzenie zamiast naprawiania

Przez dwie godziny licznik stał na 235, bo nadzorca puścił **siedmiu ludzi na mierzenie i zero
na naprawianie** — mimo że pomiar był kompletny cztery dyżury wcześniej. Właściciel to zauważył
pytaniem „czy ty się posuwasz, czy testujesz własne testy". **Miał rację.**

`G06` nie zamyka się od patrzenia. Zamyka się, gdy ktoś naprawi naruszenia.
**Sprawdzaj przed każdą falą: czy to, co zlecam, ZAMYKA bramkę, czy tylko ją opisuje.**

## 4. Stan gałęzi — lepszy, niż się wydawało

| Gałąź | Zawarta w naszej linii | Promocja |
| --- | --- | --- |
| `origin/develop` | tak | **czysty fast-forward** |
| `origin/demo` | tak (wchłonięte 49 commitów) | **czysty fast-forward** |
| `origin/Londyn` | tak | **czysty fast-forward** |
| `origin/staging` | tak | **czysty fast-forward** |

**Nikt nie jest przed nami nigdzie. Nie ma rozjazdu — jest zaległość promocyjna.**

Ścieżka wymuszona narzędziami: **nasza linia → `develop` → staging wdraża się sam →
weryfikacja → tag → `demo`**. `demo` od 31.08 jest witryną: przyjmuje **wyłącznie**
kod przez niezmienny tag `staging-deployed`, gałąź jest odrzucana celowo.

★ **Wypchnięcie na `develop` uruchomi automatyczne wdrożenie na staging.** Właściciel został
zapytany i **jeszcze nie odpowiedział** — nie rób tego bez jego słowa.

## 5. Decyzje właściciela z tego dnia (wiążące)

- **Prawa do zasobów (Materiały, Audyty):** *„Tylko własne i otwarte"* — na MVP wyłącznie zasoby
  o jasnym statusie prawnym; Audyty **bez przywoływania nazw komercyjnych norm**. Zamknęło 4 bramki.
- **Uprawnienia w Czacie:** *„Nie — zostaje jak jest"* — zatwierdzanie przekazań zostaje przy
  administratorze i właścicielu. Kod bez zmian. Zamknęło 1 bramkę.
- **Cięcie martwego kodu:** *„Wytnij razem z resztą"* — łącznie z 4000 linii bez odpowiednika.
- **Portal Partnerski:** *„Przyjmujemy w całości"* po poprawce kolorystyki.

## 6. ★★★ Przyrząd kłamał PIĘĆ razy w dwie doby

To jest najczęstszy kształt fałszywego defektu w tym programie. **Zanim zgłosisz cokolwiek jako
defekt produktu, sprawdź przyrząd.**

1. **Wysokości podglądu** — 3 z 6 „defektów" to hosty harnessu z `min-h-screen` zamiast `h-full`.
2. **Dostępność, sześć reguł krajobrazowych** — skan obejmował cały dokument zamiast `#dev-render-root`.
3. **„Martwy ekran" Teresy** — atrapa harnessu łamała własny kontrakt, produkt zdrowy.
4. **„Nieprzetłumaczone" osiem ekranów Ustawień** — dwa hosty **hardkodowały polski**.
5. **`report-builder-library-template` „pusty"** — brak wymaganych parametrów adresu w harnessie.

## 7. ★★★ Błąd nadzorcy, który wsiąkł w narzędzie

Nadzorca przekazał tezę: „sześć reguł krajobrazowych znika po zawężeniu skanu". **Za mocna.**
Zmierzone dwukrotnie niezależnie: znikają **trzy** (`landmark-one-main`, `page-has-heading-one`,
`region`). Pozostałe trzy (`heading-order`, `landmark-unique`, `landmark-no-duplicate-banner`)
**potrafią wystąpić wewnątrz fragmentu i wtedy są realnym defektem**.

**Skutki, wszystkie sprostowane w repo:**
- `scripts/dev/_aggregate-g06.mjs` odejmował sześć — poprawione na trzy plus lista do rozstrzygnięcia.
- Ustawienia: `heading-order` błędnie odjęty na 6/9 ekranów.
- Partner: `landmark-unique` błędnie odjęty — **0/12 ekranów czystych, nie 3/12**.

★ Autor skryptu **zmierzył samodzielnie trzy i przyjął sześć, bo pochodziły od nadzorcy.**
To jest wzorzec, któremu program ma zapobiegać. **Zdanie „zmierz moje liczby sam" w zleceniu
działa tylko wtedy, gdy wykonawca ufa własnemu pomiarowi bardziej niż mojej tezie.**

## 8. Co robią agenci teraz

- **`agent/fix-a11y-01-04-20260903`** — naprawa dostępności w modułach 01-04 (w toku).
- **`agent/fix-a11y-09-12-20260903`** — SCALONE: zero naruszeń na 15 ekranach, naprawy
  przez komponenty współdzielone.

**15 worktree w `/private/tmp/ag-*`** — większość scalona, do sprzątnięcia.
★ **Usuwaj worktree zaraz po scaleniu.** Wczoraj 70 niesprzątniętych zjadło dysk do 566 MB
i zatrzymało dwa dyżury Codexa. Docker oddał 82 MB, worktree 77 GB.

## 9. Dyżury Codexa — stan

`279` `G05` · `280` `G06` częściowy · `281` **P0 schemat od zera, naprawiony** ·
`282` przepływy · `283` `G01` **16/16** · `284` `G06` częściowy · `285` **naprawa przyrządu
dostępności + kontrast + nazwy** — wszystkie wykonane i scalone.

Generator instrukcji: `scripts/dyzury/gen_instrukcja.py` (w repo od 2.09, czyta żywy szkielet).
Kolejka pozycji: `docs/program/KOLEJKA_CODEX_INTEGRACJA.md`.

## 10. Otwarte ryzyka

1. **`ai_user_tiers` nie powstaje z żadnej migracji** (`aiSettingsService.ts`) — **ten sam wzorzec,
   który ubił rejestrację użytkownika**. W module ogłoszonym jako najlepszy, niewidoczny na zrzutach.
2. **34 trasy odczytowe `/api/v8/finance/*` bez bramki modułu** — ta sama rodzina co zamknięty
   dziś wyciek sprawozdań. Nie domykane po omacku: nie wiadomo, które są osiągalne dla `USER`.
3. **Cztery mounty modułów otwartych noszą pustą atrapę bramki** — wystrzelą w dniu przełączenia
   modułu na zamknięty. Zabezpieczone detektorem `tests/unit/backend/security/betaGateMountRegistry.test.ts`.
4. **Kontrast tekstu w zaznaczonym wierszu tabeli** spada poniżej progu — naprawione 3 wystąpienia,
   reszta w aplikacji niezweryfikowana.
5. **Crash `Invalid hook call`** w Czacie — niedeterministyczny, przy pierwszym załadowaniu,
   nieodtwarzalny na żądanie. Nie naprawiany na ślepo.
6. **Pierścień fokusu na crimsonie: 362 wystąpienia w 119 plikach** — pułapka nr 1 z `CLAUDE.md`,
   naprawa mechaniczna, nikt jej nie wziął.

## 11. Pierwsze kroki dla następnego

1. **Scal `agent/fix-a11y-01-04-20260903`**, gdy wróci. Potem **przemierz `G06`** — jeśli naruszenia
   spadły do zera, bramki się zamkną.
2. **Wydaj `G14`/`G15`/`G16` razem z naprawami**, nie po nich. Ślad znalezisko→commit zapisuj
   w trakcie naprawy, nie osobnym dyżurem.
3. **Zapytaj właściciela o `develop`** — promocja jest fast-forward i bezpieczna, ale uruchamia
   wdrożenie na staging.
4. **Sprzątnij worktree.**
