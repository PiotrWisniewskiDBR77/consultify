# KRONIKA SESJI — 2026-07-21 (cały dzień + wieczór)

> Zapisane przy wyczerpującym się kontekście, na polecenie Piotra.
> **Cel:** żeby następna sesja nie musiała odtwarzać ustaleń z rozmowy.
> **Dokumenty siostrzane:** `_HANDOFF_KARTY_N_2026-07-21_WIECZOR.md` (stan techniczny) ·
> `_ANALIZA_UTRZYMANIA_STANDARDU_2026-07-21.md` (co realnie broni standardu) ·
> `_SPEC_N_KARTY_2026-07-21.md` (kontrakt) · `_PLAN_WDROZENIA_KART_N_2026-07-21.md` (fale).

---

## 1. STAN KOŃCOWY

| | |
|---|---|
| Gałąź | `fix/prv-mywork-preview`, baza `origin/demo` |
| Worktree | `.worktrees/prv-mywork` (**wewnątrz repo** — `/private/tmp` bywa czyszczone) |
| Demo | `55bdea8d0f` — **wszystko wypchnięte, zero zaległych** |
| Harness | `harness-kart-n`, port 3220, `?screen=karta-<nazwa>&theme=dark\|light&lang=pl\|en` |

**Punkty cofnięcia:** `79cb925bdb` (start dnia) · `06cdc24c1f` (przed falą migracji) ·
`713428f0b4` (przed ujednoliceniem paneli).

---

## 2. PRZEBIEG — co się działo, po kolei

### 2.1 Rano — rejestr i orientacja
Rejestr `rejestr/` (103 zadania, jedno zadanie = jeden plik) był świeżo zmigrowany.
Zbudowałem **artefakt przeglądarki rejestru** (`rejestr/WIDOK.html` + generator
`rejestr/_system/widok.mjs`) i **listę do przeklikania na demo** (`rejestr/LISTA-DEMO.html`).

**Ustalenie:** z 16 zadań „do odbioru" tylko **jedno** dało się wtedy odebrać wzrokiem na demo —
reszta to analizy albo kod w niepushniętych gałęziach.

### 2.2 Odkrycie, które ustawiło resztę dnia
Zbudowałem `scripts/sprawdz-zrodla.mjs` — bramkę sprawdzającą, czy dokumenty cytowane
w instrukcjach **istnieją**. Wynik: **36 martwych odwołań, 13 w pięciu skillach.**
Trzy „źródła prawdy" wzorca N, które skill każe czytać, **nigdy nie powstały**.

### 2.3 Zmiana kierunku (decyzja Piotra)
Kolejno: „ograniczmy liczbę zgłoszeń naraz" → „zróbmy MVP najpierw" → „przejdziemy moduł po
module, zaczynamy od MyWork" → **„weźmy się za karty N"**.

Przy MVP ustaliłem: karta MVP istnieje (`docs/mvp/KARTA_MVP_consultify.md`, 10 ścieżek CJ-01…10,
gotowość **0/10** — bo nikt nie zmierzył), a **21 ze 103 zadań rejestru dotyczy rzeczy, które
karta MVP wprost odłożyła** (Ideas, Notatnik, agenci).

### 2.4 Preview w MyWork (pierwsza fala kodu)
Kanon §7.2/§7.3 domknięty: zamknięte opcjonalności, deskryptor per zakładka, **jeden zestaw
wariantów przycisków — wariant wybiera SKUTEK akcji, nie ekran**.
Naprawione: szerokość podglądu Decisions, kolejność stref w Ideas, ikona przy „Open" w Inbox,
powtórzony tytuł w Tasks, `purple`(=crimson)→`primary`, `green`→`emerald`.

**Piotr znalazł na moim własnym zrzucie dwa rozjazdy, których nie widziałem:**
„Zrobione" neutralne w Inbox a zielone w Tasks; „Otwórz Flow" różne w dwóch widokach Ideas.
Lekcja: porównywałem przyciski **w obrębie** zakładki, nie **między** zakładkami.

### 2.5 Pytanie Piotra, które zmieniło podejście
> „czy nie łatwiej zbudować ten komponent na nowo i podmienić wszystkie?"

Sprawdzenie: `PreviewActionBar` **już był wspólny** (11 modułów). Brakowało mu **jednej
zdolności** — przepełnienia akcji. Bez niej każdy ekran pisał własne „…" ręcznie; zdarzyło się
to **dwa razy w jeden wieczór**. Dodałem prop `overflowActions` + ostrzeżenie dev przy >5 akcjach.

**Zasada, która z tego wynikła i obowiązuje dalej:** *dozbrajaj istniejący komponent jedną
brakującą zdolnością, nie przebudowuj ekranów od zera.*

### 2.6 Karty N — SPEC, plan, wykonanie
`_SPEC_N_KARTY_2026-07-21.md` (kontrakt) → `_PLAN_WDROZENIA_KART_N_2026-07-21.md` (fale F/M/Z).

**Fala F (4 agenty):** `StandardArtifactShell` (typowana warstwa nad `NModeShell`),
`NModeToolbar.overflowActions`, `registry.ts` + smoke, `check-artefakt.sh` +3 reguły.
**Fala M (7 agentów, jeden na kartę):** naruszenia blokujące **10 → 0**, ostrzeżenia **16 → 3**.
**Ujednolicenie paneli:** tabela Właściwość/Wartość we wszystkich 7 (4 karty odstawały,
Notification renderował listę definicyjną zamiast tabeli).

---

## 3. DECYZJE — kto i co rozstrzygnął

### Piotr
| # | Decyzja |
|---|---|
| P1 | Tool zostaje kartą N; **Tool Document wypada** — to wynik (PPT/Word/Excel), nie karta. **7 kart, nie 8** |
| P2 | Warstwa dowodowa **obejmuje Initiative** |
| P3 | Martwy kod (~2500 linii) — **osobną falą PO migracjach**, żeby diff dało się odebrać na zrzutach |
| — | Decision: `Zatwierdź/Odrzuć/Odłóż` widoczne, reszta pod „…" |
| — | Strefa „Co dalej" zostaje **tylko w Ideas** |
| — | Wzorzec panelu = **Task i Decision** |
| — | Tryb pracy: wypychamy na demo partiami, Piotr weryfikuje na żywym demo |

### Moje (CTO), do odrzucenia przez Piotra
| # | Decyzja | Uzasadnienie |
|---|---|---|
| K1 | Decision i Task: **klasa S → L** | cięcie 8–10 sekcji do 4 byłoby utratą treści; drawer z listy = ich preview |
| K2 | Notification: **bez sekcji Komentarzy w ogóle** | wiadomość systemowa nie jest artefaktem współpracy |
| — | `evidence` obowiązkowe dla kart z treścią AI | teza bez ścieżki do dowodu nie idzie przed klienta |
| — | Regeneracja sekcji `edited` **zawsze pyta o nadpisanie** | praca konsultanta ginąca pod przyciskiem to najdroższy błąd tej klasy |
| — | Rodzina planowania (Dziś/Tydzień/Później/Odłóż) → **neutral** | zbiór równorzędnych wyborów, żaden nie krzyczy |
| — | Sekcja AI **bez własnego kebaba** (DEC-008) | trzeci poziom menu bez wartości |
| — | Kontrakt treści dla **każdego** typu, w wariancie pełnym albo lekkim (DEC-010) | brak kontraktu = dzisiejsze puste sekcje |

---

## 4. ZNALEZISKA — realne wady produktu wykryte po drodze

| Wada | Jak znaleziona |
|---|---|
| **Crash całego ekranu Interview w 5 językach** — `toLocaleDateString(t('…enUs'))` bez fallbacku; i18next zwraca klucz → `RangeError` | harness, error-boundary |
| **13× `useMemo`/`useCallback` wołające `t()` bez `t` w deps** — surowy klucz i18n na stałe; we WSZYSTKICH 7 kartach | **wzrokiem**; esbuild i tsc zielone, klucz istniał w JSON |
| **Initiative: wartości panelu jako ciemne prostokąty** — kontrolki z poziomego paska w wąskiej komórce | zrzut Piotra |
| **Initiative: „Submit for Review" dwa razy** — nagłówek + pasek zatwierdzania | zrzut Piotra |
| Dublet „Delegate" w Decision (2 widoczne + 1 w martwym kodzie) | zrzut Piotra |
| Wyciek crimsona na przycisku AI w Notification | zmierzony computed style |
| **TAB-002: kryterium odbioru było błędne** — „licznik pokaże 105" liczyło DWIE organizacje; użytkownik zobaczy 99 | sonda na żywej bazie |
| **Wszystkie 59 „zatwierdzonych sesji" to MyWork notebooks** — TAB-002 w konflikcie z DANE-001 | sonda na żywej bazie |
| 36 dokumentów-widm w instrukcjach, w tym 3 SSOT wzorca N | `sprawdz-zrodla.mjs` |

---

## 5. MOJE BŁĘDY W TEJ SESJI — zapisane, żeby się nie powtórzyły

1. **Oceniłem 741-linijkowy dokument po nagłówkach** i orzekłem „tego nie ma", a sekcja KT
   odpowiadała wprost na pytanie Piotra sprzed dnia. → Czytaj całość albo mów, że nie czytałeś.
2. **Podałem numery linii z niewłaściwej gałęzi** (`oxford/oc2-merge` zamiast `origin/demo`,
   ~2000 commitów różnicy). → `git show origin/demo:<ścieżka>`.
3. **Kazałem 7 agentom czytać dokument, którego nie było w ich gałęzi** — dokładnie ta pułapka,
   którą rano wykryłem u innych. → Uruchom `sprawdz-zrodla.mjs` przed wypuszczeniem agentów.
4. **Powiedziałem „kanon legalizuje crimson jako CTA"** przed sprawdzeniem implementacji.
   `primary` to navy, nie crimson. Prawdziwym winowajcą był `purple`.
5. **„Naprawiłem" harness Initiative wbrew świadomej decyzji agenta**, nie przeczytawszy jego
   uzasadnienia (blueprinty showcase są po angielsku).
6. **Porównywałem przyciski w obrębie zakładki, nie między zakładkami** — Piotr znalazł to,
   czego nie widziałem.

---

## 6. CO ZOSTAŁO — kolejność dla następnej sesji

1. **Dopytaj Piotra o pełną listę** „dużo błędów" z demo — potwierdzone są dwa, on mówił o wielu.
   **Nie zgaduj.**
2. **U3+U4: wpiąć bramki w `.husky` i CI** (~2 h). Dziś `.husky/pre-commit` i `pre-push` to
   **`exit 0`**, a żaden z 8 workflowów CI nie woła naszych bramek. Bez tego bramki działają
   wyłącznie, gdy kod pisze agent Claude Code.
3. **U5: wpiąć `check-gestosc.sh`** do `.claude/settings.json` (15 min) — leży niewpięty.
4. **U1: przepiąć 7 kart na `StandardArtifactShell`** (dzień+, świeży kontekst).
   Powłoka istnieje i jest sprawdzona testami, ale **żadna karta jej nie używa**, więc
   najmocniejsza bramka jest wyłączona.
5. **U2: `KARTY_N_STRICT=1`** po U1.
6. Sprawdzić panel na wąskim ekranie (`hidden lg:block`; poziomy pasek właściwości usunięty).

---

## 7. REGUŁY WYPRACOWANE DZIŚ — obowiązują dalej

1. **„esbuild przeszedł" ≠ działa.** 2 z 8 ekranów z zielonym esbuildem wywaliły się w przeglądarce.
2. **Raport agenta = deklaracja, nie dowód.** 7/7 zgłosiło sukces; wzrokiem znalazłem 13 wad.
3. **Wariant przycisku wybiera SKUTEK akcji, nie ekran.**
4. **Jedna akcja = jedno miejsce.** Zostaje tam, gdzie widoczna zawsze; znika z warunkowego.
5. **Dozbrajaj istniejący komponent, nie przebudowuj ekranów.**
6. **Klasa wad „technicznie poprawne, wizualnie złe" jest niewykrywalna maszynowo** — na to
   jest wyłącznie oko na zrzucie. Harness nie jest wygodą, tylko jedynym narzędziem.
7. **Agenci nie mogą pisać w te same pliki.** Po każdej fali: `python3 -m json.tool` na obu locale.
8. **Uczciwe „nie zweryfikowałem" > udawane „gotowe".**

---

*Wszystkie liczby i SHA zmierzone w tej sesji. Tam, gdzie czegoś nie sprawdziłem — napisane wprost.*
