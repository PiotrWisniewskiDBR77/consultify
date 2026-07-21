# AUDYT INSTRUKCJI — KORPUS 2: DOKTRYNA TREŚCI (2026-07-22)

> **Pytanie Piotra:** „czy wszystkie instrukcje są na poziomie BCG i najlepszych konsultantów".
> **To jest audyt, nie przepisywanie.** Zero zmian w plikach źródłowych.
> **Gałąź:** `fix/prv-mywork-preview` (worktree `.worktrees/prv-mywork`), baza `origin/demo`.
> **Miara:** 8 kryteriów top-tier deliverable (answer-first · MECE · kwantyfikacja · so-what ·
> ugruntowanie · falsyfikowalność · hipoteza-najpierw · odbiorca+decyzja).

---

## 0. WNIOSEK (answer-first)

**Nie ma jednej doktryny treści. Są trzy warstwy o różnej klasie, a jakość SPADA im bliżej
konsultanta, który realnie pisze.**

| Warstwa | Ocena | Czego uczy |
|---|---|---|
| `CONCLUSION_LAYER_STANDARD.md` | **8/10** | MYŚLENIA — formuła K1→K2→K3→K4, testy falsyfikowalności, 3 pełne wzorce before/after |
| `CARD_CONTENT_FORMULA.md` + 2 walidatory | **5/10** | LICZENIA — 85 progów liczbowych, 0 uzasadnień, wzorzec złoty = obietnica |
| 63 placeholdery w 7 kartach N | **2/10** | NICZEGO — 0 z 63 niesie choćby jedną cyfrę z doktryny |

**Ocena łączna: 5/10.** Sufit jakości jest realnie wysoki (§6 P1–P3 w CONCLUSION_LAYER to
materiał, który partner by podpisał). Problem nie w tym, że nikt nie wie, jak wygląda dobry
wniosek — **to jest zapisane i dobrze zapisane**. Problem w tym, że ta wiedza jest w dokumencie
najdalszym od miejsca pisania, a w miejscu pisania nie ma jej wcale.

Trzy ustalenia, które to domykają — każde zweryfikowane uruchomieniem kodu, nie lekturą:

1. **Jedyny placeholder w systemie, który podaje strukturę zdania, uczy formatu, który walidator
   odrzuca jako naruszenie `hard`.** Konsultant piszący DOKŁADNIE wg podpowiedzi dostaje FAIL.
2. **Punktacja karze BOGACTWO.** Przy identycznej jakości per motyw: 3 motywy → 68/100,
   8 motywów → 28/100. Doktryna dopuszcza 3–6 motywów; punktacja uczy pisać dokładnie 3.
3. **Reguła „tytuł ma być tezą, nie tematem" — sedno anty-wzorca — jest zaimplementowana jako
   „≥4 słowa".** Własny zły przykład z doktryny, dopełniony do 5 słów, przechodzi.

---

## 1. CO AUDYTOWAŁEM — i jak

| Artefakt | Status | Metoda |
|---|---|---|
| `docs/standards/CARD_CONTENT_FORMULA.md` (216 linii) | ✅ istnieje | lektura + zliczenie progów/uzasadnień |
| `server/src/services/cardContentFormulaValidator.ts` (1376) | ✅ istnieje | lektura + **uruchomienie** (esbuild→node) |
| `server/src/services/cardContentValidator.ts` (410) | ✅ istnieje | lektura |
| 63 placeholdery w 7 kartach N | ✅ policzone niezależnie | ekstrakcja + rozwiązanie kluczy i18n wzgl. `public/locales/pl/translation.json` |
| `docs/standards/CONCLUSION_LAYER_STANDARD.md` (330) | ✅ istnieje | lektura + sprawdzenie wpięcia (20 plików) |
| `docs/initiatives/INITIATIVE_FORMULA.md` | ✅ istnieje | lektura |

**Liczba 63 potwierdzona niezależnie** od `_ANALIZA_JAKOSCI_TRESCI_KART_2026-07-22.md` §4.2 —
własnym skanem (regex wieloliniowy + rozwiązanie i18n). Rozkład: Initiative 23 · Task 18 ·
Decision 15 · Notification 6 · Interview 1 · Insight 0 · Tool 0.

### 1.0 ★ Ostrzeżenie o współbieżności (istotne dla zaufania do numerów linii)

**W trakcie tego audytu INNY agent edytował ten sam worktree.** `NotificationDetailView.tsx`
urósł o 95 linii (23:33), a `public/locales/{pl,en}/translation.json` i
`dev-render/screens/karta-notification.tsx` zmieniły się o 23:29–23:30. **Ja nie zmieniłem
żadnego pliku źródłowego** — jedynym moim zapisem jest ten dokument.

Skutek: numery linii dla Notification przesunęły się w trakcie pracy (`:1754` → `:1826`).
Po wykryciu **przeskanowałem korpus ponownie**: suma nadal 63, a
`InitiativeDocumentView.tsx` · `DecisionDetailView.tsx` · `TaskDetailView.tsx`
(źródła **wszystkich** cytatów z numerami linii w tym dokumencie) są nietknięte
(`git diff --stat` = pusto). **Żaden cytat poniżej nie odwołuje się do pliku, który się zmienił.**
Gdybym nie sprawdził, dokument mógłby cytować nieistniejące już linie.

### 1.1 ★ Dwa dokumenty-widma (klasa błędu z CLAUDE.md, ZŁOTA REGUŁA 1)

**Oba SSOT-y, na które powołują się walidatory, NIE ISTNIEJĄ** — ani na gałęzi, ani w historii
(`git log --all` = 0 trafień):

```
cardContentValidator.ts:4
  * SSOT: `Harvard/wdrozenie-100/_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md` §0
  * (BCG doctrine anti-patterns) …
```
→ `find . -name "*ARTEFAKTY_TRESC*"` = **0 trafień**. Plik nie istnieje.

```
cardContentFormulaValidator.ts:251-252
  // §3/§5 per-type predicates (13-type formula). Deterministic, tolerant, cheap.
  // Each mirrors an anti-pattern from _FORMULA_TRESCI_INSIGHT §3 so the code IS
  // the checklist.
```
→ `find . -name "*FORMULA_TRESCI*"` = **0 trafień**. Plik nie istnieje.

**Skala:** walidator powołuje się **54 razy** na sekcje §3.1–§3.15 i §5.1–§5.2 dokumentu,
którego nie ma. Sekcje te nie istnieją też w `CARD_CONTENT_FORMULA.md`
(`grep -nE "§3\.|§5\." docs/standards/CARD_CONTENT_FORMULA.md` = 0 trafień).

**Tak-więc:** najciekawsze poznawczo reguły w całym systemie — `title_is_thesis`,
`tension_two_sided`, `pattern_multisource`, `model_heldby`, `power_implication`,
`snippet_verbatim` — istnieją **wyłącznie jako kod**. Konsultant nie ma dokumentu, z którego
mógłby się ich nauczyć. Komentarz „the code IS the checklist" (`:253`) jest szczery, ale to
znaczy: checklistą jest coś, czego konsultant nie przeczyta.

**Konkret:** walidator wymaga od sygnału opisu ≥25 słów (`:777-783`, kod
`insight.signal_desc_len`). W `CARD_CONTENT_FORMULA.md` §A2 sygnały mają tylko: „1–4 jeśli są
napięcia" (`:40`). **Progu 25 słów nie ma w żadnym czytelnym dokumencie.** Karta pokazowa
harnessu dostaje z tego tytułu 4 naruszenia.

---

## 2. OCENA WG 8 KRYTERIÓW

Osobno dla dwóch doktryn — bo różnią się o klasę.

| # | Kryterium | `CONCLUSION_LAYER` | `CARD_CONTENT_FORMULA` | Placeholdery (63) |
|---|---|---|---|---|
| 1 | Answer-first | ✅ SPEŁNIA | ✅ SPEŁNIA | ❌ NIE SPEŁNIA |
| 2 | MECE | ✅ SPEŁNIA | ⚠️ CZĘŚCIOWO | ➖ NIE DOTYCZY |
| 3 | Kwantyfikacja | ✅ SPEŁNIA | ⚠️ progi bez uzasadnień | ❌ 0/63 z cyfrą |
| 4 | Tak-więc (so-what) | ✅ SPEŁNIA | ❌ NIE SPEŁNIA | ❌ NIE SPEŁNIA |
| 5 | Ugruntowanie | ✅ SPEŁNIA | ✅ SPEŁNIA (§A8) | ❌ 0/63 pyta o dowód |
| 6 | Falsyfikowalność | ✅ SPEŁNIA (R3) | ⚠️ format zamiast testu | ❌ NIE SPEŁNIA |
| 7 | Hipoteza-najpierw | ⚠️ CZĘŚCIOWO | ⚠️ CZĘŚCIOWO | ➖ NIE DOTYCZY |
| 8 | Odbiorca i decyzja | ✅ SPEŁNIA (R6) | ❌ NIE SPEŁNIA | ❌ NIE SPEŁNIA |

Uzasadnienia najważniejszych ocen — niżej, przy pytaniach.

---

## 3. ODPOWIEDZI NA 5 PYTAŃ

### Pytanie 1 — czy doktryna uczy MYŚLENIA, czy FORMATOWANIA?

**`CONCLUSION_LAYER_STANDARD.md` uczy myślenia. `CARD_CONTENT_FORMULA.md` uczy formatowania.**

Dowód, że pierwszy uczy myślenia — trzy testy operacyjne, nie definicje:

> **„czy zdanie pasowałoby do dowolnej firmy na świecie?"** Jeśli tak — jest ogólnikiem.
> — `CONCLUSION_LAYER_STANDARD.md:46` (R1)

> **„czy przy przeciwnych danych napisalibyśmy to samo zdanie?"** Jeśli tak — wniosek jest pusty.
> — `:60` (R3)

> Liczby klient ma w Excelu za darmo — **płaci za wniosek**.
> — `:10`

To są **narzędzia myślowe**, nie liczniki: dają konsultantowi operację, którą wykona na własnym
zdaniu i sam rozstrzygnie. Podobnie R6 (`:86`): *„Rekomendacja bez właściciela i bez terminu to
życzenie"* — jedno zdanie niosące kryterium 8 (odbiorca+decyzja) i uzasadnienie naraz.

Dowód, że drugi uczy formatowania — jego trzon to dwie tabele progów (§A2 `:33-45`, §A3 `:48-68`).
Kolumna „Kryteria jakościowe" niesie 3–6 słów na rubrykę, np.:

> | Streszczenie (summary) | W | 40–90 słów | czym jest + jaki efekt | nigdy |
> — `CARD_CONTENT_FORMULA.md:53`

„czym jest + jaki efekt" to etykieta, nie instrukcja. Konsultant nie dowie się z niej, co czyni
efekt wartym opisania. Zestawienie liczbowe:

- **85 progów liczbowych** w dokumencie (`grep -oE "[0-9]+[–-][0-9]+|≥ ?[0-9]+|≤ ?[0-9]+|min\.? ?[0-9]+"` = 85)
- **0 uzasadnień progu.** Każde trafienie na „bo/ponieważ/dlaczego/uzasadn" dotyczy treści,
  którą ma napisać konsultant (uzasadnij pominięcie, uzasadnij severity) — **nigdy** tego,
  dlaczego próg wynosi tyle, ile wynosi.

**Tak-więc:** §A0.2 nazywa piramidę Minto (`:19`) i §A0.7 nazywa MECE (`:24`), ale nazwanie
zasady to nie nauczenie jej. Cały wykład answer-first w tym dokumencie to jedno zdanie:
*„pierwsze zdanie niesie konkluzję, nie wstęp"*. To definicja, nie umiejętność.

### Pytanie 2 — czy progi są uzasadnione, czy arbitralne?

**Arbitralne — i w trzech miejscach szkodliwe.** Nie ma ani jednego uzasadnienia; jedyna
udokumentowana zmiana progu to decyzja z autorytetu:

> **v1.1 (2026-06-10):** decyzja CTO — milestones mogą mieć daty relatywne […]
> — `CARD_CONTENT_FORMULA.md:214`

To poprawny changelog, ale „decyzja CTO" to źródło władzy, nie argument. Nigdzie nie ma,
dlaczego podsumowanie ma 60–130 słów, a nie 50–150.

**Trzy progi, które realnie uczą złych rzeczy:**

**(a) Punktacja karze bogactwo — zweryfikowane uruchomieniem.**

```ts
// cardContentFormulaValidator.ts:473-479
function buildVerdict(kind, violations) {
  let score = 100;
  for (const v of violations) score -= v.severity === 'hard' ? 18 : 8;
```

Naruszenia są zliczane **per element** (per motyw, per problem, per sygnał, per dowód —
`:670`, `:715`, `:768`, `:807`), bez żadnego limitu i normalizacji przez liczbę elementów.
Uruchomiłem walidator na kartach o **identycznej jakości per motyw** (opis 45 słów, tuż poniżej
progu 50), różniących się WYŁĄCZNIE liczbą motywów:

```
3 motywy →  68/100 (4 naruszenia)
4 motywy →  60/100 (5)
5 motywów → 52/100 (6)
6 motywów → 44/100 (7)
8 motywów → 28/100 (9)
```

**Tak-więc:** −8 pkt za każdy dodatkowy motyw tej samej jakości. §A2 dopuszcza 3–6 motywów
(`:37`), ale punktacja czyni 3 jedyną racjonalną liczbą. To jest **odwrotność MECE** — kryterium
„łącznie wyczerpujące" jest karane. Konsultant optymalizujący pod wynik nauczy się pisać
minimum, nie komplet.

**(b) Reguła „tytuł = teza" jest zaimplementowana jako „≥4 słowa".**

```ts
// cardContentFormulaValidator.ts:320-327
function titleIsThesis(title: string): boolean {
  if (TITLE_CONNECTOR_RE.test(t)) return true;
  const ws = words(t);
  if (ws.length >= 4) return true;          // ← tu
  return ws.some(tokenIsVerb);
}
```

Komentarz `:318` przyznaje to wprost: *„Titles with ≥4 words are assumed to carry enough
substance to pass"*. Uruchomienie:

```
PRZESZEDŁ | 5 słów | «Problemy z jakością danych produkcyjnych»      ← czysty TEMAT
PRZESZEDŁ | 5 słów | «Wyniki wymiaru Dane i Analityka»               ← zły przykład z doktryny
ZŁAPANY   | 2 słowa| «Planowanie produkcji»
PRZESZEDŁ |11 słów | «Dane utykają w silosach — analityka nie ma na czym pracować»  ← teza
```

Drugi wiersz to **własny zły przykład doktryny** (`CONCLUSION_LAYER_STANDARD.md:143`: *Zły:
„Wyniki wymiaru Dane"*), dopełniony do 5 słów. Przechodzi.

**Tak-więc:** reguła nie odróżnia tezy od tematu — odróżnia długie od krótkich. Uczy dopisywania
słów. To samo w drugim walidatorze: `conclusionValidators.ts:353` sprawdza `title_is_thesis` (W5)
jako `wordCount(t) >= 5`, choć doktryna §4.4 wymaga *„tytuł slajdu ma orzeczenie; nie jest samą
frazą rzeczownikową"*.

**(c) §B4 — rubryka punktowa jest arytmetycznie niewykonalna.**

```
- Każda rubryka W: **2 pkt** (jakość) · WAR/OPC zaliczona lub uzasadniona: **1 pkt**.
- Dodatkowo: ugruntowanie ≥80% (**+}**), MECE OK (**+**), język PL (**+**), brak anty-wzorców A6 (**+**).
- **Skala 0–100; próg PASS ≥ 90.**
— CARD_CONTENT_FORMULA.md:157-159
```

Wniosek ma 8 rubryk W + 3 WAR (§A2) → maksimum 8×2 + 3×1 = **19 pkt**, nie 100. Brak reguły
normalizacji. Bonusy „(+)" nie mają wartości, a pierwszy jest literówką: **`(+})`**. Kod
implementuje **inny algorytm** (start 100, odejmowanie) dającą inne liczby.

**Tak-więc:** dokument nazwany „FORMUŁA" nie zawiera działającej formuły. Numer w UI i numer
w doktrynie nie mają wspólnego pochodzenia.

### Pytanie 3 — ★ czy placeholdery uczą MYŚLEĆ JAK KONSULTANT?

**Nie. 63 placeholdery niosą zero doktryny — zmierzone, nie oszacowane.**

Skan rozwiązanych wartości (klucz i18n → `public/locales/pl/translation.json`):

| Cecha | Wynik |
|---|---|
| Placeholderów łącznie | **63** |
| …zawierających choć jedną **cyfrę** (próg, minimum, liczba pozycji) | **0** |
| …proszących o **dowód/źródło/cytat** (§A8 = obowiązek ugruntowania) | **0** |
| …wspominających **kierunek zmiany** (§A2 KPI: „baseline→target + kierunek") | **0** |
| …podających „**do ustalenia**" (§A7 — jedyne legalne wyjście przy braku baseline) | **0** |
| …będących **pytaniem** (`?`) | **5 (8%)** |
| …kończących się „…" / „..." (ucięta etykieta) | **37 (59%)** |

**Zestawienie najlepszego z najgorszym — jak proszono:**

**NAJLEPSZY** — `InitiativeDocumentView.tsx:8395` → `initiatives.weBelieveThatBecauseWeWill2`
(`translation.json:7718`):

> **„Wierzymy, że… ponieważ… Zmierzymy to przez…"**

Jedyny z 63, który podaje **strukturę zdania**, nie nazwę pola. Wymusza trzy ruchy naraz:
twierdzenie → uzasadnienie → miara. To jest realnie dobra podpowiedź.

**★ I to jest jednocześnie najcięższy defekt w korpusie.** Walidator wymaga innego formatu:

```ts
// cardContentFormulaValidator.ts:1020
const HYPOTHESIS_RE = /Jeśli .+ to .+ (bo|ponieważ) .+/i;
```

Uruchomienie na tezie napisanej **dokładnie wg podpowiedzi z UI**:

```
teza wg placeholdera UI  → NARUSZENIE [hard]  (initiative.hypothesis_format)
teza wg doktryny §C1     → OK
```

**Tak-więc:** jedyne miejsce w produkcie, gdzie konsultant dostaje wzór myślenia, uczy wzoru,
który system ocenia jako naruszenie `hard`. (Łagodzące: `hypothesis_format` jest świadomie poza
listą blokującą — `:1240-1241` — więc karta się zapisze. Ale wynik spadnie o 18 pkt i konsultant
nie dowie się dlaczego.)

**NAJGORSZY** — `DecisionDetailView.tsx:5740` → `decisions.detail.options.descriptionPlaceholder`:

> **„Opis…"**

To pole opisu **wariantu decyzyjnego** — serce karty Decision. Nie pyta o kryterium wyboru, koszt,
ryzyko, odwracalność ani o to, co się przez ten wariant traci. Obok, `:5780` i `:5847`:
**„Argument za…"** / **„Argument przeciw…"** — bez pytania o wagę, dowód czy koszt.

Blisko: `TaskDetailView.tsx:2880` i `:6554` → **„Wprowadź element…"** (klucze
`myWork.taskDetail.placeholder` i `…placeholder4` — same nazwy kluczy zdradzają, że treści nikt
nie projektował).

**Trzeci wart nazwania** — `InitiativeDocumentView.tsx:7708`, `:7794`, `:7806`:

```tsx
placeholder="Baseline"      // :7708, :7794 — literał, nie t()
placeholder="Target"        // :7806
```

Angielskie literały bez i18n w polskim UI, i to **dokładnie w dwóch polach**, które doktryna czyni
automatycznym FAIL-em (§A6.3, §A6.4, `:81-82`). Konsultant nie ma skąd wiedzieć, że puste pole
obniży wynik, a `„do ustalenia (N4)"` je przepuści — bo fraza „do ustalenia" nie występuje
w UI ani razu.

**Uczciwie — co jest dobre:** 5 placeholderów to realne pytania konsultingowe, wszystkie w tym
samym wzorcu (nagłówek + podtytuł + pytanie):

- `InitiativeDocumentView.tsx:6451` → **„Co się stanie jeśli nie podejmiemy działań?"** — koszt
  bezczynności, klasyczne pytanie doradcze
- `DecisionDetailView.tsx:6132` → **„Co się stanie, jeśli decyzja nie zostanie podjęta?"**
- `TaskDetailView.tsx:2768` → **„Zdefiniuj mierzalny rezultat — co oznacza sukces, jakie kryteria
  akceptacji…"**

Ten wzorzec działa i jest gotowy do skopiowania. Problem: obejmuje 5 z 63 pól.

### Pytanie 4 — czy istnieje WZORZEC ZŁOTY?

**W `CARD_CONTENT_FORMULA.md` — NIE. Jest obietnica w miejscu przykładu:**

> ## C2. Gold-standard
> Wzorcową kartę (1 wniosek + 1 inicjatywa spełniające 100%) **dołączymy** po przebudowie treści
> Elkomtechu — pierwsza karta, która przejdzie B3+B4 z wynikiem ≥90, staje się przykładem
> referencyjnym w tym dokumencie.
> — `CARD_CONTENT_FORMULA.md:207-209`

**Tak-więc:** dokument, którego §A1 stanowi *„Zakaz wypełniaczy (ogólnik/placeholder udający
treść) = rubryka NIEZALICZONA"* (`:30`), sam ma placeholder w rubryce najważniejszej. Karta ma
wzorzec, do którego można ją porównać — nie istnieje. Zostaje §C1: 4 wiersze „źle → dobrze"
(`:200-205`). Są dobre (patrz §5 niżej), ale to fragmenty zdań, nie karta.

**W `CONCLUSION_LAYER_STANDARD.md` — TAK, i to mocny.** §6 (`:257-300`) daje trzy pełne pary
before/after na realnych powierzchniach. **Ten materiał definiuje realny sufit jakości**, więc
oceniam go wg 8 kryteriów. Wzorzec P1 (`:259-271`, analiza finansowa):

> **Płynność formalnie w normie, ale trend zjada bufor — przy tym tempie próg ostrzegawczy za
> ~3 kwartały.** CR 1,2 (próg 1,0; branżowo 1,5–2,0) spadł z 1,6 w 4 kwartały. Driver:
> zobowiązania krótkoterminowe +38% r/r przy płaskich aktywach obrotowych […] Najpierw:
> (1) CFO — renegocjacja terminów u 3 największych dostawców […] Efekt: zatrzymanie erozji
> i CR ≥ 1,3 w 2 kwartały; firma negocjuje z pozycji siły, nie pod ścianą.

| # | Kryterium | Werdykt |
|---|---|---|
| 1 | Answer-first | ✅ konkluzja w pierwszym zdaniu, pogrubiona; fakt dopiero w drugim |
| 2 | MECE | ⚠️ 3 akcje uszeregowane, ale bez deklaracji wyczerpania |
| 3 | Kwantyfikacja | ✅ 8 liczb z jednostkami i progami; „~3 kwartały" ma tyldę |
| 4 | Tak-więc | ✅ „negocjuje z pozycji siły, nie pod ścianą" — konsekwencja, nie opis |
| 5 | Ugruntowanie | ⚠️ liczby podane, ale w prozie brak `factRefs` z §4.3 |
| 6 | Falsyfikowalność | ✅ przy CR 1,8 rosnącym wniosek brzmiałby inaczej |
| 7 | Hipoteza-najpierw | ⚠️ niejawne |
| 8 | Odbiorca i decyzja | ✅ CFO / kontroler / CFO + horyzont per akcja |

**Wzorzec P2 (`:272-284`) jest jeszcze lepszy na kryterium 5** — nazywa status dowodu wprost:
*„(wg deklaracji zespołu, do potwierdzenia — brak dowodu w sesji)"*, i dyscyplinuje zakres:
*„dla 2 procesów krytycznych (nie «całej firmy»)"*.

**Tak-więc:** sufit jest na poziomie 7–8/10 wg miary BCG. Wiedza istnieje. Nie jest tylko
podpięta tam, gdzie powstaje treść kart N.

### Pytanie 5 — czy są ANTY-WZORCE z przykładami?

**Tak, i to jest najmocniejsza część korpusu.** To odróżnia instrukcję zawodową od życzeniowej —
tutaj jest zrobione.

- `CARD_CONTENT_FORMULA.md:78-88` — §A6, **10 anty-wzorców jako automatyczny FAIL**, w tym takie,
  które celują w realne patologie: *„«Cel −35%» bez podanego baseline ani adnotacji «do
  ustalenia»"* (`:82`), *„Sizing bez jawnych założeń («przyniesie miliony»)"* (`:87`).
- `:88` — §A6.2 wiąże anty-wzorzec z **incydentem produkcyjnym**: *„Niekompletny obiekt = ryzyko
  crashu UI → twardy FAIL. (Patrz: incydent 2026-06-09.)"* To wzorowe: reguła z podanym kosztem.
- `CONCLUSION_LAYER_STANDARD.md:43-49` — R1 z **listą zakazanych fraz** („poprawić komunikację",
  „zoptymalizować procesy", „należy rozważyć") **plus testem** rozstrzygającym.
- `:258-300` — 3 pary before/after, gdzie „źle" jest zacytowane z realnego kodu
  (*„dzisiejszy wzorzec, por. `financialAnalysisService`"*, `:260`) — anty-wzorzec z adresem.
- `cardContentValidator.ts:110-113` — anty-wzorzec zakodowany dosłownie:
  `/\bw dzisiejszym dynamicznym (świecie|otoczeniu|rynku)\b/i`, severity `error`.

**Jedyna dziura:** anty-wzorce nie docierają do konsultanta. Żaden z 63 placeholderów nie mówi,
czego NIE pisać. Wyjątek poza polami — karta Tool, która ma sekcję **„CZYM TO NARZĘDZIE NIE JEST"**
i zdanie *„nie jest szkolnym ćwiczeniem polegającym na zapełnieniu czterech pól"*
(`KnownToolDetailView.tsx`, treść redakcyjna; karta ma 0 placeholderów). To jedyne miejsce
w produkcie, gdzie anty-wzorzec jest pokazany użytkownikowi.

---

## 4. NAJGORSZE BRAKI (uszeregowane)

| # | Brak | Dowód | Łamie kryterium |
|---|---|---|---|
| 1 | Jedyny placeholder ze strukturą zdania uczy formatu, który walidator karze jako `hard` | „Wierzymy, że… ponieważ…" (`translation.json:7718` ← `InitiativeDocumentView.tsx:8395`) vs `HYPOTHESIS_RE` (`cardContentFormulaValidator.ts:1020`) — zweryfikowane uruchomieniem | 6 falsyfikowalność |
| 2 | Punktacja karze bogactwo: −8 pkt za każdy dodatkowy motyw tej samej jakości (3→68, 8→28) | `cardContentFormulaValidator.ts:473-479` + brak normalizacji w `:670`/`:715`/`:768` | 2 MECE |
| 3 | „Tytuł = teza" zaimplementowane jako „≥4 słowa"; własny zły przykład doktryny przechodzi | `cardContentFormulaValidator.ts:320-327`; `conclusionValidators.ts:353` | 1 answer-first |
| 4 | Wzorzec złoty = obietnica w dokumencie zakazującym placeholderów | „dołączymy po przebudowie treści Elkomtechu" (`CARD_CONTENT_FORMULA.md:208-209`) vs §A1 `:30` | 5 ugruntowanie |
| 5 | 54 odwołania walidatora do dwóch nieistniejących SSOT-ów | `cardContentValidator.ts:4`; `cardContentFormulaValidator.ts:251` — `git log --all` = 0 | 5 ugruntowanie |
| 6 | 0 z 63 placeholderów niesie cyfrę, dowód, kierunek ani „do ustalenia" | skan 63 wartości i18n; `grep -rnE "60[–-]130\|400[–-]750" src/components/` = 0 | 3 kwantyfikacja |
| 7 | §B4 arytmetycznie niewykonalna (max 19 pkt na skali 0–100, literówka `(+})`) | `CARD_CONTENT_FORMULA.md:157-159` | 3 kwantyfikacja |
| 8 | 85 progów, 0 uzasadnień — uczą trafiania w licznik | zliczenie w `CARD_CONTENT_FORMULA.md`; changelog `:214` = „decyzja CTO" | 4 tak-więc |
| 9 | Brak odbiorcy i decyzji w doktrynie kart — nigdzie nie napisano, KTO czyta kartę i co ma z nią zrobić | `CARD_CONTENT_FORMULA.md` — 0 wystąpień odbiorcy; kontrast: `CONCLUSION_LAYER:86` R6 | 8 odbiorca |

---

## 5. CO JUŻ TRZYMA POZIOM (bez pochlebstw — czym konkretnie)

1. **`CONCLUSION_LAYER_STANDARD.md` §1 + R1–R6 + §6.** Formuła K1→K2→K3→K4 (`:22-31`) jest
   operacyjnym rozwinięciem so-what: fakt → co to znaczy → co robić najpierw **i dlaczego w tej
   kolejności** → jaki efekt z horyzontem. Wzmocniona zasadą proporcji: *„K2–K4 razem ≥ 50%
   objętości. Wynik, w którym K1 dominuje […] jest opisem, nie wnioskiem"* (`:33`). To jest
   kryterium 4 zapisane tak, że da się je wyegzekwować.
2. **Testy zamiast definicji** (`:46`, `:60`, `:244`). Test podpisu — *„czy partner podpisałby to
   nazwiskiem przed zarządem — bez poprawiania ani jednego zdania?"* — to lepsza bramka jakości
   niż jakikolwiek próg słowny w korpusie.
3. **Wymóg trade-offu** (`:116`): *„Rekomendacja bez trade-offu = nie było decyzji, tylko lista."*
   Jedno zdanie odróżniające doradztwo od raportowania.
4. **`CONCLUSION_LAYER` jest realnie wpięty** — 20 plików w `server/src` odwołuje się do niego,
   istnieje dedykowany `conclusionValidators.ts` + katalog `services/conclusions/`. To nie
   dokument-widmo (sprawdzone, bo klasa tego błędu w tym repo występuje — patrz §1.1).
5. **Świadome, udokumentowane rozluźnienie progów w kodzie** — `conclusionValidators.ts:303-307`
   stosuje tolerancję 1,3× do limitów R4 z komentarzem `// R4 ≤60, 1.3x tolerance`. To dojrzała
   inżynieria: rozbieżność doktryna↔kod jest jawna i uzasadniona, nie przemilczana.
6. **Projekt twardej bramy `CARD_GATE_BLOCKING_CODES`** (`cardContentFormulaValidator.ts:1229-1250`).
   Blokuje na wąskiej, jawnej liście; heurystyki podatne na false-positive celowo poza listą;
   zawór env; fail-OPEN przy błędzie walidatora. Rozumowanie zapisane w komentarzu `:1204-1227`.
   To jest inżynierska ostrożność właściwej klasy — niezależnie od zastrzeżeń do progów.
7. **`INITIATIVE_FORMULA.md`** — doktryna z jawnymi źródłami (`:169-173`: Minto, Kerzner PMMM,
   Kaplan–Norton, McKinsey wave) i regułą, która realnie chroni jakość portfela: **„0 nowych ≠
   porażka"** (`:99`). To odwaga produktowa — generator, któremu wolno nie wygenerować niczego.

---

## 6. DO DECYZJI PIOTRA

1. **Czy `CARD_CONTENT_FORMULA` ma zostać osobną doktryną, czy stać się wariantem
   `CONCLUSION_LAYER`?** Dziś §W4 (`CONCLUSION_LAYER:126-131`) deklaruje, że karty są „już
   znormalizowane" i odsyła do `CARD_CONTENT_FORMULA` — czyli lepszy dokument oddaje pole
   słabszemu. Scalenie dałoby kartom K1→K2→K3→K4 i testy R1/R3.
2. **Czy progi mają dostać uzasadnienia, czy zniknąć z doktryny do kodu?** Trzecia droga (moim
   zdaniem najlepsza): zostawić w doktrynie zasadę + test, a liczby trzymać wyłącznie w kodzie
   z komentarzem „dlaczego tyle".
3. **Czy naprawiamy placeholder tezy, czy regex?** Dwa formaty („Wierzymy, że… ponieważ…"
   vs „Jeśli… to… bo…") — jeden musi zniknąć. Rekomendacja: zostawić regex (jest w §A6.2 i §C1),
   poprawić placeholder — mniejszy zasięg zmiany.
4. **Czy wynik punktowy ma być pokazywany konsultantowi w trakcie pisania?** Dziś 63 pola nie
   niosą ani jednego progu; autor poznaje kontrakt dopiero przy odrzuceniu (albo wcale, bo
   `soft` nie blokuje).
5. **Czy zamawiamy wzorzec złoty karty (1 wniosek + 1 inicjatywa)?** To odblokowuje §C2 i daje
   punkt odniesienia, którego dziś nie ma. Bez niego „≥90/100" jest liczbą bez desygnatu.
6. **Czy odtwarzamy `_FORMULA_TRESCI_INSIGHT`, czy przepisujemy 54 odwołania?** Dziś ~15 reguł
   jakościowych istnieje wyłącznie jako kod, nieczytelny dla konsultanta.

---

## 7. CZEGO NIE ZWERYFIKOWAŁEM

- **Realnych kart w żywej bazie** — audyt jest statyczny + uruchomienie walidatora na kartach
  syntetycznych, które sam skonstruowałem. Nie wiem, jakie wyniki mają karty produkcyjne.
- **Czy `CONCLUSION_LAYER` jest egzekwowany w praktyce** — potwierdziłem 20 plików odwołujących
  się i istnienie walidatorów, **nie** prześledziłem, czy `conclusionValidators` blokuje przed
  renderem („żaden wniosek nie trafia do UI bez PASS", `:236`). To twierdzenie zostaje
  niesprawdzone.
- **Placeholderów w kartach dziedziczących** (KPI · RAID · Milestone · Change Request ·
  Stage Gate · Action Proposal) — poza zakresem 7 kart N.
- **`docs/product/DRD_REPORT_SPEC.md`** — cytowany jako implementacja referencyjna §W1; nie
  otwierałem.
- **Progów w `cardContentValidator.ts`** (`SECTION_REQUIREMENTS`, `:78-101`) nie poddałem tej
  samej analizie empirycznej co walidator formuły — oceniłem je wyłącznie z lektury.
- **Nie sprawdziłem wersji EN** placeholderów (`public/locales/en/`) — cały skan dotyczy PL.
  Uwaga: `en/translation.json` był edytowany przez innego agenta w trakcie audytu (§1.0).
- **Sześciu placeholderów Notification nie przejrzałem po zmianie** wprowadzonej przez równoległego
  agenta (§1.0) — wartości i18n są te same, ale nie wiem, czy dodane 95 linii nie wnosi nowej
  treści pomocniczej. Nie wpływa na żaden wniosek (0 cytatów z tego pliku).
