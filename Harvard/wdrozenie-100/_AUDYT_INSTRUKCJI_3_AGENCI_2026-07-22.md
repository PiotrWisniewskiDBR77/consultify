# AUDYT KORPUSU 3 — INSTRUKCJE DLA AGENTÓW

**Data:** 2026-07-22 · **Gałąź:** `fix/prv-mywork-preview` (worktree `.worktrees/prv-mywork`, baza `origin/demo`)
**Pytanie Piotra:** czy wszystkie instrukcje są na poziomie BCG i najlepszych konsultantów.
**Zakres:** `CLAUDE.md` · 8× `.claude/skills/*/SKILL.md` · `_SPEC_N_KARTY_2026-07-21.md` · `TRIADA_KANON.md` · `ARTIFACT_ANATOMY_STANDARD.md`
**Charakter:** audyt. Zero zmian w plikach źródłowych.

---

## ODPOWIEDŹ (answer-first)

**Nie — ale problem nie jest tam, gdzie go szukasz. Forma pisarska jest na poziomie 8/10; integralność systemu jest na 3/10. Ocena łączna: 5/10.**

Twoje instrukcje są napisane lepiej niż przeciętny deliverable BCG: mają twarde liczby, falsyfikowalne progi i uzasadnienia z datami incydentów. Trzy fragmenty (SPEC-N §0, TRIADA część C, consultify-test §KRYTERIA) przeszłyby w każdej top-tier firmie bez poprawek.

Zawodzi warstwa, którą BCG traktuje jako oczywistość, nie jako zaletę: **ta sama liczba ma trzy różne wartości w trzech dokumentach, najważniejsza reguła mechaniczna ma dwie sprzeczne wersje, a każdy „bezpiecznik" opisany w `CLAUDE.md` jest wyłączony.** W BCG deck z pięknym wywodem opartym na trzech sprzecznych liczbach i przypisie do nieistniejącego źródła jest odrzucany w całości — niezależnie od jakości argumentu.

**Konsekwencja dla decyzji:** nie zlecaj przepisywania instrukcji. Napisane są dobrze. Zleć **uzgodnienie i egzekucję** — 5 napraw niżej to ~1 dzień pracy i usuwa ~90% ryzyka.

---

## 1. NAJPOWAŻNIEJSZE: egzekucja jest fikcją (★★★★★)

`CLAUDE.md` trzykrotnie powołuje się na hooki jako bezpiecznik:

> „(hook `check-list-canon.sh` blokuje naruszenia)" — `CLAUDE.md:15`
> „(hook `check-artefakt.sh` — zbudowany 2026-07-18 — blokuje w powłoce)" — `CLAUDE.md:25`
> „Bezpiecznik: `scripts/check-list-canon.sh` (hook pre-commit + OBOWIĄZKOWO przed KAŻDYM push UI na demo) blokuje własne tabele." — `CLAUDE.md:43-44`

Realny hook (`git config core.hooksPath` → `.husky/`):

```sh
# .husky/pre-commit  (112 B, całość)
# Disabled: Husky pre-commit checks
# Requested: "remove check and husky from commit"
exit 0
```

`.husky/pre-push` — identycznie `exit 0`.

**Ustalenie:** żaden z pięciu skryptów `check-*.sh` nie jest wywoływany automatycznie. Istnieją i działają (`package.json:246` — `npm run check:ui`), ale nic ich nie uruchamia. Wszystkie trzy zdania o „blokowaniu" w `CLAUDE.md` są nieprawdziwe.

**Tak-więc:** reguła nr 9 powstała, bo kanon tabel złamano („krach 07-12"). Lekarstwem miał być hook. Lekarstwo nie zostało podane — a `CLAUDE.md` twierdzi, że tak. Agent czyta „hook blokuje", zakłada siatkę bezpieczeństwa i jej nie sprawdza.

**Ironia diagnostyczna:** to dokładnie wzorzec, przed którym ostrzega ZŁOTA REGUŁA 1 tego samego pliku — „sprawdź czy flaga ma implementację (bywają FANTOMY — `ENABLE_TERESA_NOTE_CREATE` = 0 kodu)" (`CLAUDE.md:66-67`). **Dokument nie przechodzi własnego testu.**

**Falsyfikacja:** to ustalenie upada, jeśli hooki są instalowane inną drogą przy `npm install`. Sprawdziłem `package.json` i `.github/` — brak wywołania. Ustalenie się broni.

---

## 2. Sprzeczność w regule mechanicznej nr 1: `demo` vs `Londyn` (★★★★★)

`CLAUDE.md` podnosi bazę gałęzi do rangi ZŁOTEJ REGUŁY:

> „**Baza gałęzi ZAWSZE `origin/demo`** (od 07-08: demo = target deployu, niesie ~130 commitów mechaniki, których Londyn nie ma)" — `CLAUDE.md:69-70`

Trzy skille mówią odwrotnie:

| Plik:linia | Treść | Zgodność |
|---|---|---|
| `consultify-petla/SKILL.md:23` | „GAŁĄŹ: świeża z **origin/Londyn**" — **w szablonie PIGUŁKI** | ✗ |
| `consultify-petla/SKILL.md:52` | „Świeża gałąź z **`origin/demo`** per fragment" | ✓ |
| `consultify-finisz-modulu/SKILL.md:26` | „pracuj TYLKO ze świeżej gałęzi z **`origin/Londyn`**" | ✗ |
| `consultify-promocja-demo/SKILL.md:15` | „Baza gałęzi: świeża z **`origin/Londyn`**" | ✗ |

**Najgorszy przypadek: `consultify-petla` przeczy sam sobie w odległości 29 linii** — i błędna wersja siedzi w **szablonie do skopiowania**, czyli w jedynym fragmencie, który realnie trafia do robotnika. Poprawna wersja jest w sekcji „Higiena", której robotnik z definicji nie czyta („Robotnik NIE czyta wielkich handoffów", `consultify-petla/SKILL.md:18`).

**Tak-więc:** architektura ekonomii kontekstu (pigułka zamiast pełnego dokumentu) sprawia, że **błąd w szablonie waży więcej niż poprawka gdziekolwiek indziej**. Skutek złej bazy jest nazwany w samym dokumencie: „gałąź z Londyn = fix na starym kodzie = konflikt/regresja przy merge".

---

## 3. Liczby nie zgadzają się same ze sobą — i zawsze gubią a11y (★★★★)

Dwa niezależne przypadki, ten sam mechanizm.

**Przypadek A — DoD Artefaktu:**

| Źródło | Deklaruje | Plik:linia |
|---|---|---|
| Rzeczywistość (policzone `- [ ]`) | **13** | `ARTIFACT_ANATOMY_STANDARD.md:1171-1191` |
| `consultify-artefakty` (2×) | 8 | `SKILL.md:21`, `SKILL.md:55` |
| SPEC-N | 9 | `_SPEC_N_KARTY_2026-07-21.md:58` |

Skill inline'uje 9-punktową parafrazę (`consultify-artefakty/SKILL.md:57`) i **pomija dokładnie 4 pozycje: cykl Tab/Shift+Tab, Esc, focus-visible, `aria-live` dla streamingu Teresy.**

**Przypadek B — lista czekowania TRIADY:**

| Źródło | Deklaruje | Plik:linia |
|---|---|---|
| Rzeczywistość (policzone) | **43** (pkt 41-43 = a11y) | `TRIADA_KANON.md:73-144` |
| `CLAUDE.md` | „40-punktowa lista" | `CLAUDE.md:10` |
| `consultify-triada` | „audyt 40 punktów", rozbicie 7+8+3+5+7+2+5+3 = 40 | `SKILL.md:27,29` |

**Ustalenie:** w obu kanonach wymogi dostępności dopisano do SSOT i **nigdy nie przeniesiono do skilla, który agent realnie wykonuje**. Agent robiący „literalnie listę" — dokładnie tak, jak każe `CLAUDE.md:16` — pomija a11y w 100% przypadków, w obu rodzinach ekranów.

**Tak-więc:** to nie jest literówka, to wyciek klasy wymagań. Konsultant pracujący przy kliencie na klawiaturze (a takich jest sporo) trafia na produkt, którego nikt nigdy nie odebrał pod tym kątem. Naprawa: skille nie powinny inline'ować parafrazy listy — powinny odsyłać do niej i podawać liczbę wyliczaną, nie wpisaną ręcznie.

---

## 4. Bramka dokumentów-widm: 36 trafień, ale zaniża (★★★★)

`node scripts/sprawdz-zrodla.mjs` (uruchomione 2026-07-22 w tym worktree):

```
Plikow instruktazowych: 98
Sprawdzonych odwolan:  822
❌ DOKUMENTY-WIDMA — cytowane, ale nie istnieja (36)
```

Najgorsze przypadki — cytowane jako **SSOT/DoD**, czyli dokumenty, bez których agent nie wie, co budować:

| Instrukcja | Widmo | Ranga w tekście |
|---|---|---|
| `consultify-finisz-modulu/SKILL.md:14` | `_PLANY_KONCOWE_2026-07-07/00_PLAN_DOKONCZENIA_FINAL.md` + `01_notatnik.md`…`08_word.md` | **„SSOT tego programu"** |
| `consultify-artefakty/SKILL.md:40` | `_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md`, `_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md`, `_DOD_ARTEFAKTY_N_CHECKLIST_2026-07-07.md` | **„SSOT wzorca N", „DoD twardy"** |
| `consultify-test/SKILL.md:9,52` | `_SYSTEM_WERYFIKACJI_2.0.md`, `_SYSTEM_PANEL_ADWERSARYJNY_RUNBOOK.md` | podstawa 3 osi testu |
| `consultify-petla/SKILL.md:11` | `_PLANY_KONCOWE_2026-07-07/00_PLAN_DOKONCZENIA_FINAL.md` | „SSOT stanu" |

**Skala ukryta:** `consultify-finisz-modulu` (50 linii) odsyła do 4 widm, w tym do własnego SSOT — dokument jest w ~10% pusty w najważniejszym miejscu.

**Bramka zaniża wynik.** Funkcja `istnieje()` (`scripts/sprawdz-zrodla.mjs:114-122`) po nieudanym trafieniu w pełną ścieżkę szuka **pliku o tej nazwie gdziekolwiek w repo** i uznaje to za sukces (komentarz w kodzie: „cytat bez pelnej sciezki jest OK"). Odwołanie ze złą ścieżką, ale poprawną nazwą, przechodzi. Realna liczba złych odwołań jest **wyższa niż 36**; 36 to podłoga, nie sufit.

**Bramka nie sprawdza obrazków** — i to boli konkretnie: `TRIADA_KANON.md:212-226` (CZĘŚĆ D) mówi „Każdy nowy ekran musi być **NIEODRÓŻNIALNY** od tych obrazów" i wskazuje 4 pliki `assets/triada/*.png`. **Katalog `docs/ui-standards/assets/triada/` nie istnieje**, plików nie ma nigdzie w repo (`find` po całym drzewie: 0 trafień). Najostrzejsze kryterium odbioru w całym kanonie list wskazuje w próżnię — i żadna bramka tego nie łapie, bo skrypt czyta tylko odwołania w backtickach i `](…)` do rozszerzeń kodu/md.

**Widmo poza bramką:** commit `189b821361` nosi tytuł „SPEC-N build-ready + **skill consultify-karty-n**". Skill nie istnieje — `git log --all -- .claude/skills/consultify-karty-n/SKILL.md` zwraca pustkę.

---

## 5. Aktualność: SPEC-N opisuje świat sprzed 66 minut (★★★★)

Hipoteza z zlecenia potwierdzona twardo, z chronologią z gita:

| Godzina (2026-07-21) | Zdarzenie | SHA |
|---|---|---|
| 19:36 | ostatnia zmiana SPEC-N | `7f39e8c695` |
| **20:42** | **„FALA M — 7 kart doprowadzonych do SPEC-N"** | `809e3abe31` |
| — | SPEC-N zaktualizowany po implementacji | **nigdy** |

`809e3abe31` jest przodkiem HEAD (`git merge-base --is-ancestor` → tak). Skutek — trzy twierdzenia dokumentu są dziś nieprawdziwe:

| SPEC-N mówi | Plik:linia | Stan realny (zweryfikowany) |
|---|---|---|
| „Nic z tego nie jest zaimplementowane" | `:3` | **Fałsz** — zaimplementowane w `809e3abe31` |
| „**5 kart z 8 nie ma go w ogóle** [prawego panelu] (Tool, Tool Document, Initiative, Interview, Notification)" | `:103` | **Fałsz dla 4 z 5.** `<ArtifactRightPanel` renderowany: `KnownToolDetailView.tsx:1639`, `InitiativeDocumentView.tsx:9984`, `InterviewWorkspace.tsx:3043`, `NotificationDetailView.tsx:2844` (5. — Tool Document — sam dokument wypisał z zakresu w §0A) |
| „**0 z 8 kart** używa `NModeToolbar`" | `:142` | **Fałsz** — używają `DecisionDetailView.tsx`, `NotificationDetailView.tsx`, `InsightViewer.tsx` |

Weryfikacja wg reguły „realny caller": sprawdzone `<ArtifactRightPanel` w JSX, nie sam import.

**Sprawiedliwie — jedno twierdzenie się broni:** „Usuwanie sekcji — ❌ 0 z 8" (`:83`). Wszystkie trafienia `removeSection` są w `src/components/ReportBuilder/*`, który nie jest kartą N. To ustalenie stoi.

**Tak-więc:** agent, który dziś weźmie SPEC-N jako brief, dostanie polecenie zbudowania prawego panelu w czterech kartach, które go mają. To nie jest strata czasu — to **ryzyko regresji na działającym kodzie**.

**Ten sam wzorzec gdzie indziej:** `consultify-finisz-modulu/SKILL.md:43` — „**Powłoka SPEC-A = 0/8**". `ArtifactRightPanel` jest dziś w 22 plikach. `CANON.md §7.1` — „`DOKTRYNA_GESTOSCI.md` … istnieje na ten moment tylko jako plik roboczy **poza `origin/demo`** (nie scalony do tej gałęzi)". Plik jest w `origin/demo` (`git cat-file -e origin/demo:docs/ui-standards/DOKTRYNA_GESTOSCI.md` → OK).

---

## 6. Hierarchia istnieje — ale jest niewidoczna z punktu wejścia (★★★)

**Dobra wiadomość:** `docs/ui-standards/CANON.md:35-47` zawiera pełną, poprawną hierarchię rozstrzygania konfliktów — 5 poziomów, z regułą domykającą:

> „jeśli kod robi Y, a standard mówi X — to kod jest kandydatem do refactoru. **Nie tworzymy trzeciego wariantu.**"

To jest dokładnie to, czego wymaga top-tier: nie „bądźcie spójni", tylko procedura rozstrzygnięcia.

**Zła wiadomość: `CLAUDE.md` ani jeden raz nie wymienia `CANON.md`.** Grep po `CLAUDE.md` + 8 skillach: 3 trafienia, wszystkie na `TABLE_AND_PREVIEW_CANON.md` (inny plik). Jedyny dokument definiujący, co wygrywa przy sprzeczności, jest nieosiągalny z jedynego dokumentu, który agent czyta zawsze.

**Skutek widoczny — konkurencyjne „NADRZĘDNE":**

- `CLAUDE.md:6` — „UI — PRAWO NADRZĘDNE"
- `CANON.md:35` — „`CANON.md` (ten plik) — najwyższy autorytet"
- `consultify-artefakt-fala/SKILL.md:12` — „`_DOKTRYNA_POWSTAWANIA_ARTEFAKTOW.md` — **NADRZĘDNA** dla decyzji silnikowych"
- `ARTIFACT_ANATOMY_STANDARD.md:1247` — deklaruje siebie warstwą pod CANON

Cztery dokumenty, cztery deklaracje wyższości, brak jednego drzewa. Słowo „SSOT" pada w korpusie dla **8 różnych plików**.

### 6b. Skutek namacalny: dwa kanony, dwa różne „6 bloków preview"

| # | `TRIADA_KANON.md:45-51` (A7) | `consultify-preview/SKILL.md:26-38` |
|---|---|---|
| 1 | Nagłówek | Nagłówek |
| 2 | Karta meta | Meta |
| 3 | DETAILS | Treść (Details) |
| **4** | **AI** | **What's-next / „Co dalej"** |
| **5** | **Relations** | **Akcje = pill** |
| **6** | **AKCJE (siatka 2 kolumny)** | **Kebab lokalny** |

Rozbieżność nie jest kosmetyczna:

- TRIADA część B czyni AI i Relations **obowiązkowymi** punktami odbioru (pkt 28, 29 — „ekran przechodzi wyłącznie przy 100% ✓"). `consultify-preview:40` degraduje je do „**opcjonalne** karty stopki MIĘDZY blokiem 3 i blokiem 4".
- TRIADA pkt 30 wymaga „Akcje: **2 kolumny**". `consultify-preview:35` mówi „OPCJONALNE … Jeśli po odjęciu duplikatów nic nie zostaje → **pomiń cały pasek**".

Oba dokumenty każą „przejść listę literalnie". Dwóch agentów, każdy posłuszny swojemu, zbuduje dwa różne ekrany — i obaj zdadzą swój odbiór.

### 6c. Dwie wersje `CLAUDE.md`

`diff` korzeń repo vs ten worktree: **9 rozbieżnych bloków**. Korzeń ma 8 reguł UI, worktree — 9 (dochodzi „ZAKAZ MASOWEGO WŁĄCZANIA"). Korzeń wskazuje `check-triada.sh`, worktree `check-list-canon.sh`. Korzeń: SSOT finiszu = `_PLANY_KONCOWE_2026-07-07/…` (widmo); worktree: `_FINISZ_MASTER_PLAN.md` + jawna adnotacja, że tamta ścieżka jest martwa.

**Analogicznie skille:** korzeń ma 11, worktree 8. `consultify-preview` istnieje **tylko** w worktree (i nie ma go na liście skilli dostępnych tej sesji). `consultify-gestosc`, `consultify-plan-master`, `consultify-raport`, `consultify-fable-sesja` — tylko w korzeniu.

**Tak-więc:** „co obowiązuje" zależy od katalogu, w którym agent stoi. Ta sama komenda `sprawdz-zrodla.mjs` da inny wynik w korzeniu (11 skilli) niż tutaj (8).

---

## 7. Uzasadnienia — mechanizm, który realnie działa

Obserwacja Piotra („reguły z powodem są przestrzegane") ma pokrycie w samym tekście.

**Zliczenie (`CLAUDE.md`, 11 reguł najwyższego rzędu): 5 ma jawny powód, 3 z nich cytują datowany incydent.**

| Reguła | Powód | Forma |
|---|---|---|
| #3 primary=crimson | ✓ | pułapka nazwana wprost (`#85182F`) |
| #7 Piotr nie testerem | ✓ | „powód: **załamanie 07-11**, „gwiazda"" |
| #9 zakaz masowego włączania | ✓ | „powód: **krach 07-12**, „tabelki jak dla trzylatka"" + nazwy plików-winowajców |
| ZŁOTA 1 runtime | ✓ | `ENABLE_TERESA_NOTE_CREATE` = 0 kodu |
| ZŁOTA 2 baza gałęzi | ✓ | „~130 commitów mechaniki, których Londyn nie ma" |
| #1, #2, #4, #5, #8 | ✗ | sam mechanizm |

**Dowód, że to nie korelacja przypadkowa:** reguła #1 („ekrany listowe WYŁĄCZNIE komponentami standardu") nie ma powodu — i została złamana. Wiemy to, bo reguła #9 dokumentuje jej złamanie: „to złamało zamrożony kanon 07-12: InitiativesLightShell/InterviewLightShell zrobiły bespoke grid zamiast StandardTable, poszły hurtem na żywo" (`CLAUDE.md:41-43`). Lekarstwem było **powtórzenie tej samej reguły z powodem i nazwiskami plików**.

**Tak-więc:** masz w ręku wynik eksperymentu naturalnego na własnym repo. Reguła bez powodu została złamana; ta sama reguła z powodem — nie. Rekomendacja: dopisz powód do #1, #2, #4, #5 (#8 ma go implicite w nazwie runbooka). To najtańsza pojedyncza zmiana w całym korpusie.

---

## 8. Co jest realnie dobre (nie kurtuazja — z cytatami)

Trzy fragmenty są mocniejsze niż typowy materiał BCG.

**1. SPEC-N §0 — meta-standard redakcyjny.** To jest najlepszy tekst w całym repo:

> „każdy wymóg zapisujemy tak, żeby dał się przełożyć na **typ TypeScript**. Każdy punkt ma sekcję *„→ wymusza"*. Wymóg, którego nie da się wyrazić typem ani sprawdzić hookiem, jest **rekomendacją**, nie standardem — i jest tak oznaczony.
> **Test dla czytającego:** jeśli w zdaniu jest przymiotnik („czytelny", „spójny", „sensowny") zamiast liczby, tokenu albo nazwy typu — to zdanie jest źle napisane."
> — `_SPEC_N_KARTY_2026-07-21.md:34-39`

Rozróżnia standard od rekomendacji po kryterium egzekwowalności i daje czytelnikowi test do wyłapania złego zdania. Do tego diagnoza przyczyny, nie objawu (`:27-32`): „`StandardTable` **nie da się obejść**, a `NModeShell` — da się"; oraz dowód, że proza nie wystarcza — autor „**cytuje kanon w komentarzu** i dwie linie niżej ustawia strefy w złej kolejności". To jest myślenie o mechanizmie, nie o apelu.

**2. TRIADA część C — kontrakt, nie opis.** `TRIADA_KANON.md:156-209`: tokeny z wartościami hex per light/dark, `h-9` (36px), `h-7` (28px), siatka 4px, `clamp(340px, 28%, 480px)`, „ruch **nigdy >220ms**". Zero przymiotników. Weryfikowalne pomiarem.

**3. `consultify-test` — progi i falsyfikowalność.** `SKILL.md:31-37`:

> „każdy obiektyw ≥88, średnia ≥90, ZERO potwierdzonych krytyczna/wysoka" · „próg musi paść w **DWÓCH** kolejnych przebiegach (jeden może być fartem)" · „Domyślnie **„obalony=true jeśli niepewne"**" · „Padnięta weryfikacja (rate-limit) = wynik CZĘŚCIOWY, **NIE „zero findingów"**"

Adwersaryjna weryfikacja z domniemaniem obalenia i jawnym rozróżnieniem „brak danych" od „brak problemu" — to jest rygor, którego brakuje większości materiałów doradczych.

**Nierozstrzygalnych sformułowań prawie nie ma.** Systematyczny grep po `zadbaj|spójnie|sensown|czyteln|odpowiedni|właściw|estetycz|ładn` w `CLAUDE.md` + 8 skillach + TRIADA dał 11 trafień, z czego 9 to fałszywe alarmy (nazwy sekcji, „dokładnie", „bogaty domyślny szablon"). Realnie miękkie są dwa: „przejścia stanu **właściwe dla encji**" (`TRIADA_KANON.md:100`) i „Odejścia z komentarzem-decyzją w kodzie = akceptowane" (`consultify-artefakt-fala/SKILL.md:18` — furtka bez kryterium). **Na 500+ linii instrukcji to wynik bardzo dobry** — większość korpusów korporacyjnych składa się głównie z takich zdań.

---

## 9. Ocena wg 8 kryteriów top-tier

| # | Kryterium | Ocena | Dowód |
|---|---|---|---|
| 1 | Odpowiedź najpierw | **7** | Każdy skill otwiera „Zasadą nadrzędną" z tezą. `CLAUDE.md` zaczyna od prawa nadrzędnego, nie od historii. |
| 2 | MECE | **4** | Podział list/artefakty/preview jest rozłączny i wyczerpujący, ale preview ma **dwie** definicje 6 bloków (§6b); „SSOT" użyte dla 8 plików. |
| 3 | Kwantyfikacja | **8** | TRIADA C, progi ≥88/≥90, „≤220ms", „max 3-4 robotników w fali". Najmocniejsza strona korpusu. |
| 4 | Tak-więc | **7** | Zakazy mają konsekwencję („gałąź z Londyn = fix na starym kodzie = konflikt"). Kilka reguł to sam mechanizm. |
| 5 | Ugruntowanie | **2** | 36 widm (podłoga), 4 nieistniejące obrazy referencyjne, „SSOT" i „DoD twardy" wskazujące w próżnię. |
| 6 | Falsyfikowalność | **6** | Listy binarne 43/13 pkt — wzorowe. Ale liczniki się nie zgadzają (40 vs 43, 8 vs 9 vs 13), a bramki nie działają. |
| 7 | Hipoteza-najpierw | **8** | „40 artefaktów = 5 archetypów × 2 klasy" (`ARTIFACT_ANATOMY_STANDARD.md:14`) — teza, potem dowód. Wzorcowe. |
| 8 | Odbiorca i decyzja | **7** | Pigułka definiuje odbiorcę i wynik zwrotny. Minus: pigułka niesie błędną bazę gałęzi. |

**Średnia ważona konsekwencją: 5/10.** Kryteria 5 i 6 (ugruntowanie, falsyfikowalność) ciągną wynik w dół, bo w top-tier są warunkiem wstępnym — nie da się ich nadrobić dobrą formą.

---

## 10. DO DECYZJI PIOTRA

Kolejność wg stosunku skutku do kosztu.

1. **Włączyć hooki albo skreślić zdania o nich.** `.husky/pre-commit` = `exit 0`, a `CLAUDE.md` trzy razy twierdzi, że hook blokuje. Dwie drogi: (a) wpiąć `npm run check:ui` w pre-commit, (b) usunąć słowo „blokuje" i napisać „uruchom ręcznie przed push". **Trzeciej drogi nie ma — dziś instrukcja kłamie.** Koszt: 15 min.
2. **Rozstrzygnąć `demo` vs `Londyn` i naprawić NAJPIERW szablon pigułki** (`consultify-petla/SKILL.md:23`), potem `finisz-modulu:26` i `promocja-demo:15`. Koszt: 10 min. Uwaga: to Twoja decyzja, nie moja — nie wiem, czy `promocja-demo` mówi o Londynie celowo (promocja to inny kierunek niż praca).
3. **Jedno źródło liczby punktów w listach.** Skille nie inline'ują parafrazy — odsyłają. Dziś a11y (4 pkt DoD + 3 pkt TRIADY) wypada z każdego odbioru. Koszt: 30 min.
4. **`CLAUDE.md` musi wskazać `CANON.md §2` jako rozstrzygnięcie konfliktów** — hierarchia istnieje i jest dobra, tylko nikt do niej nie trafia. Przy okazji: rozstrzygnąć 6 bloków preview (TRIADA A7 vs `consultify-preview`). Koszt: 20 min + Twoja decyzja o preview.
5. **SPEC-N: dopisać nagłówek „stan na 20:42, `809e3abe31` — kolumny „Dziś" nieaktualne"** albo przeliczyć inwentarz. Dziś dokument każe budować rzeczy, które stoją. Koszt: 20 min.
6. **Uzupełnić 4 obrazy `assets/triada/*.png`** albo usunąć CZĘŚĆ D. Kryterium „NIEODRÓŻNIALNY od tych obrazów" bez obrazów jest nieegzekwowalne. Koszt: 20 min (zrzuty z demo).
7. **Rozstrzygnąć rozjazd korzeń/worktree** — dwie wersje `CLAUDE.md`, 11 vs 8 skilli. Koszt: Twoja decyzja, którą wersję uznajesz.
8. **Dopisać powody do reguł #1, #2, #4, #5 `CLAUDE.md`** — mechanizm udowodniony na Twoim repo (§7). Koszt: 15 min.

**Czego NIE robić:** nie zlecaj przepisywania instrukcji „pod BCG". Warstwa pisarska jest mocna; przepisywanie zniszczy działające fragmenty (SPEC-N §0, TRIADA C, progi testu) i nie tknie realnego problemu, którym jest uzgodnienie i egzekucja.

---

## 11. CZEGO NIE ZWERYFIKOWAŁEM

Uczciwe granice tego audytu:

- **Nie czytałem w całości `ARTIFACT_ANATOMY_STANDARD.md`** (1267 linii). Przeczytałem §0, §0C, §18, §19, §20 + mapę nagłówków. §5, §9, §13 (menu per archetyp, 26 elementów, instancjacja) — nieaudytowane. Nie twierdzę nic o ich jakości.
- **Nie sprawdziłem 27 z 36 widm** pod kątem „czy plik istnieje pod inną nazwą" — raportuję wyjście skryptu plus 4 przypadki, które zbadałem ręcznie.
- **Nie policzyłem realnego rozmiaru błędu bramki.** Wiem, że `istnieje()` zaniża (fallback po nazwie), ale nie zmierzyłem o ile. Potrzebny drugi przebieg z wyłączonym fallbackiem.
- **Nie weryfikowałem skilli z korzenia repo** (`consultify-gestosc`, `plan-master`, `raport`, `fable-sesja`) — zlecenie dotyczyło worktree. Mogą mieć własne sprzeczności.
- **Nie sprawdzałem, czy 43 punkty TRIADY są realnie stosowane** przy odbiorach — audytowałem tekst instrukcji, nie praktykę.
- **Nie oceniałem `_PROJEKT_B_VEGAS.md`, `_FORMULA_MENU_NARZEDZI_12.md`, `_FINISZ_MASTER_PLAN.md`** — istnieją (sprawdzone), ale są poza zleconym korpusem.
- **Zero pełnego `tsc`/`vitest`** — zgodnie z zakazem (OOM). Weryfikacja kodu = `grep` + odczyt JSX, wystarczająca dla postawionych twierdzeń, ale nie dowodzi, że komponenty renderują się bez błędu w runtime.
