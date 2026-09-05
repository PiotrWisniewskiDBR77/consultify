# IV. Tryb ciemny i luki pomiarowe

**1. Cel dla użytkownika.** Właściciel może zobaczyć — i my możemy udowodnić zrzutem, nie obietnicą
— że każdy z 16 modułów wygląda równie dobrze w ciemnym motywie co w jasnym. Dziś tego dowodu nie ma
dla ani jednego z 125 zmierzonych ekranów.

**2. Zakres.** Wszystkie 16 modułów, plus cztery inne, niepowiązane z motywem luki pomiarowe
zebrane w jednym miejscu na żądanie zadania: klawiatura (Tab/Esc), 4 ekrany superadmina, kolizja
selektora widoku „Dzień" w kalendarzu, przepływy trwające >5-15 s. Źródło: `D_SYNTEZA_I_PLAN.md` §5
(„Czego nie zmierzyliśmy") + `NIE_DOTARŁEM`/`NIE_DOTARLEM` w każdej z części A/B/C.

**3. Przyczyna źródłowa.** Oba narzędzia pomiarowe używane 05.09 wymuszają jasny motyw na starcie
kontekstu przeglądarki — zweryfikowane w tej sesji, dosłownie w kodzie:
- `scripts/dev/odbior-zywo/zrzut.mjs:47-56`: `colorScheme: 'light'` w `browser.newContext(...)`, a
  `addInitScript` nadpisuje `consultify-storage.state.theme` na `'light'` i robi
  `document.documentElement.classList.remove('dark')` — **przed** każdym ładowaniem strony.
- `scripts/dev/audyt-award-20260905/audyt.mjs:33-40`: identyczny mechanizm, te same trzy linie.

Oba są napisane świadomie tak (komentarz w `zrzut.mjs`: „JASNY motyw: aplikacja trzyma motyw w
zustand persist… nadpisujemy PRZED startem aplikacji") — to nie przypadek, to celowy wybór metody,
który zostawił tryb ciemny całkowicie niezmierzony. **Dobra wiadomość:** wzorzec odwrotny już
istnieje w repo, napisany dla innego zadania — `scripts/dev/odbior-zywo-agent/zrzut-agent-dark.mjs`
ustawia `colorScheme: 'dark'` i `theme: 'dark'` dokładnie tym samym mechanizmem, tylko odwróconym.
Ten plik jest dowodem wykonalności, nie gotowym rozwiązaniem dla `zrzut.mjs`/`audyt.mjs` — celuje w
inny port (`3042`, nie `3000`) i inne zadanie (agent, nie audyt 16 modułów).

**4. Projekt rozwiązania — SPEC, nie implementacja.**

### 4.1 Flaga `--theme=dark` dla `zrzut.mjs` (i analogicznie `audyt.mjs`)

Dodać opt-in parametr `--theme=light|dark` (domyślnie `light` — **zero zmiany zachowania bez
podania flagi**, zgodnie z zasadą „nowe pliki/parametry, nie nadpisywanie domyślnego zachowania").

```js
// W zrzut.mjs, obok istniejących const:
const theme = get('theme', 'light'); // 'light' | 'dark' — domyślnie bez zmian
// ...
const ctx = await browser.newContext({
  storageState: sesja,
  viewport: { width: 1440, height: wysokosc },
  colorScheme: theme, // zamiast twardego 'light'
  locale: 'pl-PL',
});
await ctx.addInitScript((t) => {
  try {
    const raw = localStorage.getItem('consultify-storage');
    const obj = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    obj.state = { ...(obj.state || {}), theme: t };
    localStorage.setItem('consultify-storage', JSON.stringify(obj));
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch {}
}, theme);
```

To jest **dosłownie** mechanizm już działający w `zrzut-agent-dark.mjs`, tylko sparametryzowany
zamiast zakodowanego na sztywno — zero nowego ryzyka technicznego, bo wzorzec już przeszedł przez
realne użycie.

**Nazewnictwo par plików:** każdy zrzut jasny `NAZWA.png` dostaje ciemny odpowiednik `NAZWA__dark.png`
(sufiks `__dark`, nie prefiks — żeby pary sortowały się obok siebie alfabetycznie w katalogu
dowodów, np. `01-skrzynka-lista.png` + `01-skrzynka-lista__dark.png`). Sidecar `.json` towarzyszy
obu wariantom osobno (błędy konsoli/sieć mogą się różnić między motywami, np. inny CSS ładowany
warunkowo).

### 4.2 Bezpiecznik pary jasny/ciemny (z pamięci nadzorcy: „Duplikat zamiast motywu")

Reużyć istniejącą bibliotekę `scripts/dev/lib/meanLuma.mjs` (już w repo, liczy lumę Rec.601 przez
`sharp().stats()` — nic nowego do napisania w samym pomiarze). Dodać skrypt kontrolny
`scripts/dev/audyt-award-20260905/sprawdz-pary-dark.mjs` (nazwa robocza, do implementacji osobno):

```js
import { meanLuma } from '../lib/meanLuma.mjs';
// dla każdej pary <nazwa>.png / <nazwa>__dark.png w katalogu dowodów:
const jasny = await meanLuma(sciezkaJasny);
const ciemny = await meanLuma(sciezkaCiemny);
if (jasny > 150 && ciemny > 150) {
  // OBIE jasne mimo różnych nazw plików → ciemny motyw nie zadziałał, to duplikat
  bledy.push(`PARA-DUPLIKAT: ${nazwa} — jasny=${jasny.toFixed(0)} ciemny=${ciemny.toFixed(0)}, oba >150`);
}
```

Próg `150` pochodzi z tego samego pomiaru z pamięci nadzorcy („Duplikat zamiast motywu… bezpiecznik
mean_luma>150"), nie jest wymyślony na nowo tutaj. To jest bezpiecznik **jednowymiarowy** — sama
luma nie łapie przypadku, w którym motyw się zmienił, ale kolory nie są semantycznie poprawne (np.
`crimson` na jasnym tle ciemnego motywu, które ma podobną średnią jasność do jasnego motywu z tym
samym elementem) — patrz pamięć nadzorcy „Bezpiecznik nagradza defekt": para zrzutów przechodzi
kontrolę jasności tym łatwiej, im większy defekt bywa nietrafiony przez jeden wymiar pomiaru. Dlatego
luma jest **pierwszym sitem** (automatyczne, tanie, łapie „ciemny motyw w ogóle się nie włączył"),
nie zastępstwem oceny wzrokiem z listy czekowania część B.

### 4.3 Plan przejścia 16 modułów w ciemnym motywie

Nie „zrób wszystko naraz" (zakaz masowego pokazywania z `CLAUDE.md` pkt 9) — kolejność 1:1 z
kolejnością paczek dokumentu II (ekrany flagowe), bo te ekrany już mają zrzut jasny do porównania i
znaną, zaakceptowaną (albo warunkowo zaakceptowaną) treść:

| Kolejność | Moduł | Ekran do sparowania | Zależność |
| :-: | --- | --- | --- |
| 1 | Ocena | DRD → Macierz → Pełny ekran | flaga `--theme=dark` gotowa (4.1) |
| 2 | Wyniki | Cel — pełna karta OKR | jw. |
| 3 | Realizacja | Kokpit menedżera | jw. |
| 4 | Ustawienia | Przegląd bezpieczeństwa | jw. |
| 5 | Panel Administratora | Polityka bezpieczeństwa | jw. |
| 6 | Partnerzy | Pusty stan portalu / logowanie | jw. |
| 7 | Materiały | Document Studio — nowy dokument | jw. |
| 8 | Inicjatywy | Panel podglądu | jw. |
| 9 | Organizacja | Tożsamość i model działania | jw. |
| 10 | Audyty | Podgląd programu audytowego | jw. |
| 11 | Czat | Otwarta konwersacja @1920 | po naprawie i18n/danych z paczki II (inaczej ciemny zrzut dziedziczy te same defekty) |
| 12 | Moja Praca | Skrzynka z podglądem | po P1/P2 — zrzut ciemny ekranu, który i tak trzeba przerobić, jest stratą czasu przed naprawą |
| 13 | Wywiad | Skrzynka @1920 | po naprawie nawigacji (paczka II) |
| 14 | Narzędzia | Biblioteka | po P6 |
| 15 | Spotkania | Lista i podgląd | po tłumaczeniu bloku AI |
| 16 | Finanse | Sprawozdania — lista | **nie dotyczy w tej fali** (moduł poza MVP) |

Pozycje 1-10 nie mają dziś znanych defektów w jasnym motywie — ciemny pomiar dla nich może ruszyć
**natychmiast** po zbudowaniu flagi z 4.1, równolegle z naprawami P1-P6 dla reszty modułów. Pozycje
11-15 czekają na naprawę jasnego wariantu, żeby nie parować dwóch zrzutów, z których jeden i tak
trzeba będzie zastąpić.

**5. Kroki wykonania.**
1. Zaimplementować `--theme=dark` w `zrzut.mjs` i `audyt.mjs` wg specyfikacji 4.1. **S, Sonnet**
   (kod już istnieje w `zrzut-agent-dark.mjs`, to przeniesienie wzorca + parametryzacja).
2. Zaimplementować `sprawdz-pary-dark.mjs` wg specyfikacji 4.2. **S, Sonnet.**
3. Wykonać przebieg dla pozycji 1-10 planu 4.3 (10 modułów × 3 szerokości × 1 zrzut ciemny = 30
   nowych zrzutów). **M, Sonnet/harness — praca mechaniczna, nie kod.**
4. Odczyt wzrokiem (lista czekowania część B, dosłownie, za każdym razem — zasada nienaruszalna z
   `CLAUDE.md` pkt 4) każdej z 30 par. **M, nadzorca.**
5. Po naprawach z dokumentu II dla modułów 11-15 — powtórzyć kroki 3-4 dla nich. **Zależne od
   harmonogramu dokumentu II, nie od tej paczki.**

Żaden z tych plików nie należy do listy plików żadnego zamrożonego modułu w
`MVP_FINAL_ZAMROZONE.json` (to skrypty w `scripts/dev/`, nie komponenty aplikacji) — **żaden krok
tej sekcji nie wymaga znacznika `[ODMROZENIE]`**.

**6. Testy.** Nie dotyczy w sensie testów jednostkowych (skrypty dev, nie kod produkcyjny) — dowodem
jest sama para zrzutów + wynik `sprawdz-pary-dark.mjs` + odczyt wzrokiem.

**7. Kryterium odbioru właściciela.** Właściciel dostaje 10 (potem 15) par jasny/ciemny, jedna
para na raz, z zaznaczonym wynikiem bezpiecznika luma — „tak" per moduł, tak jak przy każdym innym
odbiorze wizualnym w tym programie (zasada „Piotr nigdy nie jest pierwszym testerem wizualnym"
stosuje się identycznie do ciemnego motywu).

**8. Ryzyka i cofanie.** Zero ryzyka kodowego dla aplikacji (zmiana dotyczy wyłącznie skryptów
pomiarowych w `scripts/dev/`). Jedyne ryzyko: odkrycie, że ciemny motyw ma realne defekty niewidoczne
dziś — to nie jest ryzyko do „cofnięcia", to dokładnie cel tej pracy (znaleźć, co jest ukryte).

**9. Nakład.** Krok 1: S (Sonnet, 0,5 dnia). Krok 2: S (Sonnet, 0,5 dnia). Krok 3: M (1-1,5 dnia,
głównie czas maszyny + drobne poprawki selektorów per moduł). Krok 4: M (nadzorca, 1 dzień na 10
par). Razem dla pozycji 1-10: **~3-3,5 dnia**. Pozycje 11-15: dodatkowe ~1,5 dnia po ich naprawach
jasnego wariantu.

---

## Inne luki pomiarowe (poza trybem ciemnym)

### A. Pełny cykl klawiatury (Tab/Esc)

**Stan dziś:** zero zmierzone we wszystkich trzech częściach audytu — `NIE_DOTARŁEM` wprost w A
(„pełny cykl klawiatury Tab/Esc — brak interaktywnej zalogowanej sesji w tym uruchomieniu") i
identyczna uwaga w C. To dotyczy **wszystkich 16 modułów**, nie jednego.

**Projekt pomiaru:** Playwright ma natywne wsparcie (`page.keyboard.press('Tab')`,
`page.keyboard.press('Escape')`) — bariera nie jest techniczna, jest sesyjna: dotychczasowe skrypty
(`zrzut.mjs`, `klik.mjs`) używają `storageState`, nie realnej interakcji klawiaturą, i nie mają
asercji na `document.activeElement`. Spec minimalny: dla każdego ekranu flagowego z dokumentu II —
(a) nacisnąć Tab N razy (N = liczba interaktywnych elementów w nagłówku+Menu2+Menu3, policzona przez
`page.locator('button, a, input, [tabindex]:not([tabindex="-1"])').count()`) i sprawdzić, że
`document.activeElement` zawsze ma widoczny fokus (kontrast z tłem, token `c-focus` niebieski —
kanon pkt 3 `CLAUDE.md` mówi wprost „fokus = niebieski `c-focus`"), (b) otworzyć panel/modal, nacisnąć
Escape, sprawdzić że się zamyka i fokus wraca do elementu, który go otworzył (nie do `body`).

**Efort:** M — jeden generyczny helper Playwright (`assertFocusRing(page)`,
`assertEscapeCloses(page, trigger, panel)`) reużywalny na 16 ekranach, potem M×16 uruchomień. Razem
**~2-3 dni** (Sonnet na helper, potem mechaniczne uruchomienia).

### B. Cztery ekrany superadmina

**Stan dziś:** `/superadmin/*` (AI Platform, System, Content, Security SSO/Policies) poprawnie
przekierowują do `/chat` na koncie właściciela (OWNER, nie SUPERADMIN) — to jest **potwierdzone
poprawne zachowanie**, nie luka w produkcie, ale luka w **pomiarze**: nikt nie widział tych czterech
ekranów z realnym uprawnieniem.

**Projekt pomiaru:** wymaga dedykowanego konta z rolą SUPERADMIN na stagingu (nie modyfikować roli
istniejącego konta właściciela — osobne konto testowe, żeby nie zmieniać uprawnień produkcyjnego
profilu). Utworzenie takiego konta jest decyzją wykraczającą poza samą dokumentację — **do
potwierdzenia z właścicielem przed utworzeniem** (nowe konto = nowy rekord w systemie uprawnień,
nie „realistyczny rekord biznesowy DBR77", więc poza domyślnym zezwoleniem z zasad 05.09).

**Efort:** S dla samej decyzji/utworzenia konta (jeśli zatwierdzone), potem S×4 dla zrzutów
(1280/1440/1920, jasny+ciemny = 24 zrzuty). Razem **~1,5 dnia**, licząc rezerwę na nieznane dziś
ekrany.

### C. Kolizja selektora widoku „Dzień" w kalendarzu

**Stan dziś:** audyt A dokumentuje wprost (Moja Praca, `NIE_DOTARŁEM`): „Dwie niezależne próby
kliknięcia selektorem tekstowym trafiały powtarzalnie w INNY, tak samo nazwany element (przycisk
powrotu do listy w zakładce Zadania) i przenosiły na niepowiązany rekord". Zweryfikowane w tej sesji
w kodzie: `src/components/MyWork/Calendar/CalendarGrid.tsx:262-267` definiuje cztery przyciski
przełącznika widoku przez klucze i18n (`myWork.calendarGrid.viewMonth/viewWeek/viewDay/viewList`),
renderowane jako zwykłe `<button>` bez `data-testid` ani unikalnej roli ARIA poza tekstem — nic w
samym komponencie nie zapobiega temu, że selektor oparty wyłącznie o widoczny tekst (`text=Dzień`)
dopasuje się do innego przycisku o tej samej etykiecie gdzie indziej na stronie, **jeśli** ten drugi
element pozostaje zamontowany w DOM (typowe dla wzorców zakładek, które chowają panele przez CSS,
nie przez odmontowanie).

**Projekt naprawy pomiaru (nie kodu produktu — to poprawka w harnessie/testach, nie w
`CalendarGrid.tsx`):** (a) **doprecyzować selektor** przez scoping do kontenera toolbara kalendarza
(np. `page.locator('[data-calendar-toolbar]').getByText('Dzień')` — wymaga dodania jednego atrybutu
`data-calendar-toolbar` do `<div>` z linii ~288 `CalendarGrid.tsx`, S, Sonnet, poza zakresem samej
dokumentacji ale warto odnotować jako najmniejszą możliwą zmianę produktu potrzebną, by pomiar był
w ogóle możliwy), (b) **filtr `:visible`** na poziomie selektora Playwright
(`page.locator('button:visible', { hasText: 'Dzień' })` lub odpowiednik `page.getByRole('button',
{ name: 'Dzień' }).filter({ visible: true })`) — to jest poprawka wyłącznie w skrypcie/spec
testowym, zero zmiany produktu. Rekomendacja: zrobić **oba** — atrybut w produkcie jest tani i
odporny na przyszłe duplikaty etykiet, `:visible` w teście jest natychmiastowym obejściem bez
czekania na zmianę produktu.

**Efort:** Krok (a) w produkcie: S (Sonnet, 0,5 dnia, wymaga `[ODMROZENIE 07_MY_WORK_AGENT DEC-<nr>]`
jeśli `CalendarGrid.tsx` jest na liście plików zamrożonego modułu — do potwierdzenia). Krok (b) w
teście: S (0,25 dnia, brak odmrożenia — to plik testowy/harness). Razem **~0,75 dnia**.

### D. Przepływy trwające >5-15 s

**Stan dziś:** zmierzone punktowo (Realizacja Praca/Zasoby 15-22 s, Narzędzia Operacyjne 5-10 s,
Materiały Arkusze ~6,4 s, canvasy Mojej Pracy 4-6 s) — ale **bez systematycznego przeglądu**, czy
istnieją inne, dziś niezaobserwowane wolne ścieżki (np. w modułach z części C, które audyt zmierzył
tylko powierzchownie: Audyty, Spotkania, Organizacja, Panel Administratora, Ustawienia, Partnerzy —
łącznie ok. 25 podekranów w `NIE_DOTARLEM`).

**Projekt pomiaru:** rozszerzyć `sidecar .json` już generowany przez `zrzut.mjs`/`audyt.mjs` o
próg **>5 s** jako WARN (dziś próg „>5 s" jest już zbierany dla samego audytu A/B/C jako kategoria
„żądań >5 s" w sidecarze, ale nie ma zbiorczego raportu na poziomie CAŁEGO produktu — dopiero suma
wszystkich sidecarów z 258+ zrzutów dałaby pełny obraz). Krok: napisać mały skrypt
`scripts/dev/audyt-award-20260905/zbierz-wolne.mjs`, który przechodzi po wszystkich `*.png.json` w
`evidence/audyt-award-20260905/` i `evidence/odbior-zywo-20260905/`, wyciąga pole czasu (`czasMs`
lub analogiczne) i produkuje jedną tabelę „ekran → czas" posortowaną malejąco — to jest agregacja
danych już zebranych, nie nowy pomiar.

**Efort:** S (Sonnet, 0,5-1 dzień na skrypt agregujący + przegląd wyniku).

---

## Zbiorczo — nakład dokumentu IV

| Pozycja | Efort |
| --- | :-: |
| 4.1 Flaga `--theme=dark` (implementacja) | S (0,5 dnia) |
| 4.2 Bezpiecznik pary luma | S (0,5 dnia) |
| 4.3 Przebieg 16-modułowy (pozycje 1-10 natychmiast) | M (~2 dni: 1-1,5 dnia zrzuty + 1 dzień odczyt) |
| 4.3 Przebieg pozycji 11-15 (po naprawach paczki II) | ~1,5 dnia, poza tym harmonogramem |
| A. Klawiatura Tab/Esc (helper + 16 ekranów) | M (~2-3 dni) |
| B. Superadmin (decyzja + 4 ekrany × 3 szerokości × 2 motywy) | ~1,5 dnia (warunkowe na decyzji o koncie) |
| C. Kolizja selektora „Dzień" (atrybut + `:visible`) | ~0,75 dnia |
| D. Agregacja wolnych przepływów | S (0,5-1 dzień) |

**Razem: ~8,5-10,5 dnia**, w większości niezależne od siebie i od harmonogramu dokumentu II —
jedyna twarda zależność: 4.3 dla pozycji 11-15 czeka na naprawy paczek II odpowiednich modułów.
