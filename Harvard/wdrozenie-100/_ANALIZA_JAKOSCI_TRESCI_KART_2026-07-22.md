# Analiza jakości OPISÓW kart N — treść, nie wygląd (2026-07-22)

> **Zakres:** oś 2 — jakość opisów kart. 7 kart N: Tool · Notification · Interview · Decision ·
> Insight · Task · Initiative.
> **To jest analiza, nie naprawa.** Zero zmian w kodzie.
> **Gałąź:** `fix/prv-mywork-preview` (worktree `.worktrees/prv-mywork`), baza `origin/demo`.
> **Metoda:** kod czytany z gałęzi roboczej + realny render w harnessie `localhost:3220`
> (każdy odczyt związany z zweryfikowanym `document.location.href` — patrz §0.2).

---

## 0. Metoda i to, czego NIE zweryfikowałem

### 0.1 Co zrobiłem
1. Odczyt doktryny `docs/standards/CARD_CONTENT_FORMULA.md` (215 linii) i walidatora
   `server/src/services/cardContentFormulaValidator.ts` (1377 linii).
2. Wyliczenie realnych wołających walidatora (`grep` importów, nie deklaracji).
3. Ekstrakcja **wszystkich** placeholderów z 7 komponentów kart + rozwiązanie kluczy i18n
   względem `public/locales/pl/translation.json`.
4. Render wszystkich 7 ekranów w harnessie, odczyt DOM (`[placeholder]`, `innerText`).
5. **Uruchomienie realnego walidatora na karcie pokazowej harnessu** — §2.3.

### 0.2 Pułapka harnessu, na którą się natknąłem (istotne dla zaufania do tego dokumentu)
W trakcie pracy **inny proces cyklicznie przenawigowywał tę samą kartę przeglądarki**.
Dwa razy zrzut/odczyt dotyczył innego ekranu niż ten, który przed chwilą otworzyłem
(np. `screenshot` pokazał Notification, gdy odczyt danych dotyczył Decision).

Dlatego **każdy odczyt DOM w tym dokumencie zwracał `document.location.href` w tej samej
migawce co dane**. Wszystkie cytaty z ekranu poniżej mają potwierdzony href. Gdyby nie to
wiązanie, ten dokument zawierałby co najmniej dwa fałszywe przypisania.

### 0.3 Czego NIE zweryfikowałem
- **Raport ART-016 nie istnieje na tej gałęzi.** `grep -rl "ART-016"` zwraca **wyłącznie**
  `_SPEC_N_KARTY_2026-07-21.md`, czyli dokument, który go cytuje. Twierdzenia „19/19 kart Insight
  poniżej progu" i „karty pokazowe atelier 12–68" **nie mają na tej gałęzi źródła do sprawdzenia**.
  Nie podważam ich — sygnalizuję, że to dokładnie klasa „widma" z SPEC-N §5.5.
- **Stanu żywej bazy** (ile realnych kart i z jakim wynikiem) — analiza jest statyczna + harness.
- Kart dziedziczących (KPI · RAID · Milestone · Change Request · Stage Gate · Action Proposal) —
  poza zakresem 7 kart.

---

## 1. Weryfikacja twierdzeń z SPEC-N §4 — co się potwierdziło, co nie

| Twierdzenie z SPEC-N §4 (DEC-010) | Werdykt | Dowód |
|---|---|---|
| Doktryna jest McKinsey-grade (anty-wzorce, kwantyfikacja, prompty gen. i recenz., gold-standard) | ✅ **POTWIERDZONE** | `CARD_CONTENT_FORMULA.md` §A6 (10 anty-wzorców), §A7, §B5, §B6, §C2 |
| `insight.summary_len` 60–130 słów | ✅ **POTWIERDZONE** | `cardContentFormulaValidator.ts:646` — `summaryWords < 60 \|\| summaryWords > 130` |
| `initiative.description_len` 400–750 | ✅ **POTWIERDZONE** | `cardContentFormulaValidator.ts:1114` — `dw < 400 \|\| dw > 750` |
| „woła go **8 serwisów**" | ⚠️ **NIEŚCIŚLE — jest 7** | 7 plików importuje moduł; 6 to serwisy, 1 to **kontroler** (`InitiativeController.ts:26`) |
| „Obejmuje **2 typy z ~10**" | ✅ **POTWIERDZONE** | `cardContentFormulaValidator.ts:33` — `export type CardKind = 'insight' \| 'initiative'` |
| „Decision ma **zero**" | ✅ **POTWIERDZONE, i gorzej niż napisano** | patrz §2.2 — Decision ma wymogi **zadeklarowane, ale bez wołającego** (fantom) |
| „kontrakt bez wpięcia w generację jest dokumentem, nie bramką" | ✅ **POTWIERDZONE EMPIRYCZNIE** | §2.3 — karta pokazowa harnessu dostaje **0/100** |

**Siedmiu realnych wołających** (`grep -rln "from '.*cardContentFormulaValidator.js'" server/src`):
`InitiativeController.ts` · `InterviewInsightService.ts` · `assessmentInitiativeService.ts` ·
`initiative/createInitiativeService.ts` · `initiative/initiativeMaterializeService.ts` ·
`insightMaterializationService.ts` · `interviewInsightReportPackService.ts`.

`evidence/evidenceEnvelopeService.ts` i `cardContentValidator.ts` wypadają — wymieniają moduł
**wyłącznie w komentarzu** (`evidenceEnvelopeService.ts:12` i `:369`, `cardContentValidator.ts:11`).

---

## 2. Pokrycie kontraktem treści — per typ karty

W systemie są **DWA** walidatory treści, nie jeden. SPEC-N §4 opisuje tylko pierwszy.

| Walidator | Poziom | Charakter |
|---|---|---|
| `cardContentFormulaValidator.ts` | **cała karta** (§A2/§A3) | scoring 0–100 + **twarda brama** (§O7.1, HTTP 422) |
| `cardContentValidator.ts` | **pojedyncza sekcja** | wyłącznie doradczy (`pass:false` = „oflaguj", nigdy „odrzuć" — `:21`) |

### 2.1 Tabela pokrycia (odpowiedź na pytanie 1 zadania)

| Karta | Kontrakt **całej karty** | Kontrakt **sekcji** | Twarda brama | Werdykt |
|---|---|---|---|---|
| **Insight** | ✅ `validateInsightCard` | — | ✅ `assertCardMeetsFormula` (`InterviewInsightService.ts:2491`) | **PEŁNY** |
| **Initiative** | ✅ `validateInitiativeCard` | ✅ `validateCardContent` (`ai/initiativeSectionFill.ts:462`) | ✅ (`createInitiativeService.ts:187`, `InitiativeController.ts:640`) | **PEŁNY** |
| **Task** | ❌ brak | ✅ `validateCardContent` (`taskSectionGenerationService.ts:269`) | ❌ doradczo | **SZCZĄTKOWY** |
| **Decision** | ❌ brak | ⚠️ **zadeklarowany, martwy** | ❌ | **ZERO (fantom)** |
| **Tool** | ❌ brak | ❌ brak | ❌ | **ZERO** |
| **Notification** | ❌ brak | ❌ brak | ❌ | **ZERO** |
| **Interview** | ❌ brak | ❌ brak | ❌ | **ZERO** |

### 2.2 ★ Znalezisko: Decision ma kontrakt-fantom

`cardContentValidator.ts:88–92` deklaruje wymogi dla sekcji Decision:

```ts
// Decision (server/src/services/decisionService.ts)
alternatives:            { listFields: { alternatives: 2 } },
risk:                    { listFields: { risks: 2 } },
description:             { minWords: 15 },
consequencesOfInaction:  { minWords: 20 },
```

Komentarz wskazuje `decisionService.ts` jako konsumenta. **`decisionService.ts` nigdy nie woła
`validateCardContent`** — `grep -n "validateCardContent\|cardContentValidator\|qualityFlags"
server/src/services/decisionService.ts` zwraca **zero trafień**.

Realni wołający `validateCardContent` to wyłącznie:
`taskSectionGenerationService.ts:269` (Task) · `ai/initiativeSectionFill.ts:462` (Initiative) ·
`InitiativeController.ts:6007` (Initiative).

Ścieżka generowania sekcji Decision (`DecisionController.generateSection` → `decisionService.
generateSection`, `DecisionController.ts:1875–1918`) zwraca `result` **bez żadnej walidacji**.

**To jest dokładnie wzorzec `ENABLE_TERESA_NOTE_CREATE` ze ZŁOTYCH REGUŁ CLAUDE.md**: reguła
istnieje w kodzie, wygląda na pokrycie w przeglądzie, i ma zero mocy sprawczej. Karta wybrana
na **referencyjną powłokę** jest jedyną, dla której ktoś napisał wymogi i nikt ich nie podłączył.

### 2.3 ★ Dowód empiryczny: karta pokazowa harnessu dostaje 0/100

Uruchomiłem realny `validateInsightCard` na `MOCK_INSIGHT` z `dev-render/screens/karta-insight.tsx:147–460`
— karcie, która na ekranie wygląda najlepiej w całym systemie:

```
tytul: Podsumowanie wykonawcze — gotowość operacyjna MZT Komponenty
WYNIK: 0/100 | prog: 90 | PASS: false | naruszen: 13
  [hard] insight.material_quality_complete :: Brak obiektu material_quality (§A6.2 — ryzyko crashu UI)
  [soft] insight.theme_desc_len       × 4  :: Motyw #1–4 ma opis <50 słów
  [soft] insight.signal_desc_len      × 4  :: Sygnał #1–4 ma opis <25 słów
  [soft] insight.issue_severity_justified  :: Problem #1: severity="high" bez uzasadnienia kosztu
  [soft] insight.opp_measurable            :: Szansa #1 bez mierzalnego celu/liczby
  [soft] insight.evidence_snippet_len      :: Fragment dowodu #1 ma 130 znaków (max 120)
  [soft] insight.content_len               :: Opis (content) ma 86 słów (oczekiwane 350–700)
```

Dwa wnioski, oba twarde:

1. **`insight.material_quality_complete` jest na liście blokującej** (`CARD_GATE_BLOCKING_CODES`,
   `cardContentFormulaValidator.ts:1243–1250`). Gdyby ta karta przeszła realną ścieżką zapisu,
   brama odrzuciłaby ją z **HTTP 422**. Renderuje się tylko dlatego, że harness podmienia
   `window.fetch` i **omija serwer w całości**. `grep -n "material_quality"
   dev-render/screens/karta-insight.tsx` → **zero trafień**; `InsightViewer.tsx:1770` czyta
   `insight.materialQuality`, więc sekcja „Jakość materiału" renderuje stan pusty.
2. **To jest dokładnie lekcja z wczoraj w nowym przebraniu.** Wczoraj mock odfiltrował akcję
   primary. Dziś mock pokazuje kartę, która **wygląda na wzorcową i jest niezdatna do zapisu**.
   Harness nie jest dowodem jakości treści — jest dowodem jakości renderu.

---

## 3. Pola treści per karta — co karta REALNIE oferuje (odpowiedź na pytanie 2)

Liczby = wszystkie `placeholder=` w komponencie (kod), potwierdzone renderem.

| Karta | Komponent | Linii | Placeholderów | Szablon w polu? |
|---|---|---|---|---|
| **Initiative** | `Initiatives/InitiativeDocumentView.tsx` | 11 244 | **23** | ✅ 1 realny szablon |
| **Task** | `MyWork/TaskDetailView.tsx` | 7 407 | **18** | ❌ (1 przykład) |
| **Decision** | `MyWork/DecisionDetailView.tsx` | 8 866 | **15** | ❌ |
| **Notification** | `MyWork/NotificationDetailView.tsx` | 3 433 | **6** | ❌ |
| **Interview** | `Interview/InterviewWorkspace.tsx` | 3 057 | **1** | ❌ |
| **Insight** | `Interview/InsightViewer.tsx` | 8 870 | **0** (+1 z powłoki: „Tytuł wniosku…") | — |
| **Tool** | `DiscoveryTools/KnownToolDetailView.tsx` | 1 648 | **0** | — |

**Wszystkie pola są puste-do-wypełnienia.** W całym systemie jest **dokładnie jeden** placeholder,
który podaje strukturę zdania zamiast nazwy pola (Initiative, teza — §4.1).

### 3.1 Initiative — jedyna karta z warstwą podpowiedzi dwupoziomową
Render (`href=…screen=karta-initiative&theme=light&lang=pl`) pokazuje wzorzec **nagłówek +
zdanie objaśniające + placeholder**:

```
PROBLEM
Jaki problem rozwiązuje ta inicjatywa            ← podtytuł sekcji
[pole] „Jaki problem rozwiązujemy? Co jest nie tak?"   ← placeholder

OPIS ROZWIĄZANIA
Proponowane podejście i sposób realizacji
[pole] „Jakie rozwiązanie proponujemy? Jakie podejście?"

KOSZT BEZCZYNNOŚCI
Konsekwencje braku działania
[pole] „Co się stanie jeśli nie podejmiemy działań?"

KONTEKST RYNKOWY
Otoczenie rynkowe, konkurencja i trendy
[pole] „Kontekst rynkowy, konkurencja, trendy..."
```

To jest **wzorzec do skopiowania na pozostałe 6 kart**. Piotr w zadaniu użył
„Jaki problem rozwiązuje ta inicjatywa" jako przykładu dobrego — to jest literalnie ten string.

### 3.2 Decision — 6 sekcji w nawigacji, treść tylko w jednej
Render (`href=…screen=karta-decision&…`): lewa kolumna deklaruje 6 sekcji —
`Zakres decyzji · Opcje i trade-offy · Ryzyko i wpływ · Konsekwencje · RACI i eskalacja ·
Załączniki i powiązania`. Cały `innerText` ma **386 znaków** i zawiera wyłącznie
`ZAKRES DECYZJI` + `KONTEKST UZUPEŁNIAJĄCY`. Kliknięcie każdej z 6 pozycji nie zmienia treści
ani placeholderów.

**Uczciwie: nie rozstrzygnąłem, czy to brak danych w mocku, czy defekt nawigacji.**
Placeholdery dla sekcji „Opcje" (`DecisionDetailView.tsx:5706–5879`) i „Konsekwencje" (`:6132`)
w kodzie **istnieją**, więc sekcje są zaimplementowane. Najprawdopodobniej mock nie niesie dla
nich danych. Do rozstrzygnięcia osobno — nie zgłaszam jako defekt produktu.

### 3.3 Tool — jedyna karta z prawdziwą doktryną treści, i to nie w polach
Tool nie ma **żadnego** pola do wypełnienia. Ma za to najlepszą treść redakcyjną w systemie
(`innerText` 5 635 znaków, `href=…screen=karta-tool&…`):

```
POZYCJONOWANIE NARZĘDZIA
CO TO NARZĘDZIE NAPRAWDĘ ROBI
CZYM TO NARZĘDZIE NIE JEST     ← anty-wzorzec wprost przy narzędziu
KIEDY UŻYĆ
KIEDY NIE ZACZYNAĆ OD SWOT     ← kieruje do PESTEL / Five Forces
CO PRZYGOTOWAĆ PRZED STARTEM
```

Cytat: *„nie jest szkolnym ćwiczeniem polegającym na zapełnieniu czterech pól"*.
To jest dokładnie ta klasa podpowiedzi, której brakuje w polach pozostałych 6 kart.

---

## 4. ★ OCENA JAKOŚCI PLACEHOLDERÓW — sedno (pytanie 3)

Skala:
- **A — instruktażowy:** mówi CO napisać (pytanie / wyliczenie / szablon).
- **B — echo etykiety:** powtarza nazwę pola, zero naddatku informacyjnego.
- **C — obcy:** angielski lub format systemowy w polu prozy.

| Karta | A | B | C | Ocena |
|---|---|---|---|---|
| Initiative | 8 | 12 | **3** | mieszana — najlepsze i najgorsze naraz |
| Task | 9 | 6 | 3 (uzasadnione) | **najlepsza średnia** |
| Decision | 3 | 9 | 3 (uzasadnione) | słaba w sekcji krytycznej |
| Notification | 3 | 3 | 0 | przyzwoita |
| Interview | 1 | 1 | 0 | za mało danych |

### 4.1 Najlepszy placeholder w systemie
`initiatives.weBelieveThatBecauseWeWill2` (`InitiativeDocumentView.tsx:8395`):

> **„Wierzymy, że… ponieważ… Zmierzymy to przez…"**

Jedyny placeholder, który podaje **strukturę zdania**, a nie nazwę pola. Odpowiada wprost
anty-wzorcowi §A6.2 („teza nie-falsyfikowalna") i walidatorowi `hypothesis_format`
(`cardContentFormulaValidator.ts:1020` — `/Jeśli .+ to .+ (bo|ponieważ) .+/i`).

⚠️ **Ale nie zgadza się z walidatorem.** Placeholder uczy „Wierzymy, że… ponieważ…",
a regex wymaga **„Jeśli … to … bo/ponieważ …"**. Tekst napisany dokładnie wg podpowiedzi
**nie przejdzie** `initiative.hypothesis_format` (severity `hard`). Patrz DEF-3.

Blisko drugie miejsce, Task (`TaskDetailView.tsx:2768`):
> „Zdefiniuj mierzalny rezultat — co oznacza sukces, jakie kryteria akceptacji…"

### 4.2 ★ LISTA NAJGORSZYCH PLACEHOLDERÓW (z cytatami)

**1. `"Baseline"` i `"Target"` — hardkodowany angielski, bez klucza i18n**
`InitiativeDocumentView.tsx:7708`, `:7794` (`placeholder="Baseline"`), `:7806` (`placeholder="Target"`).
Nie `t(...)` — **literały**. W polskim UI wyświetla się angielskie słowo.

To najcięższy przypadek w zestawieniu, bo dotyczy **dokładnie tych dwóch pól**, które doktryna
czyni automatycznym FAIL-em:
- §A6.3 — „KPI bez baseline→target lub bez kierunku"
- §A6.4 — „«Cel −35%» bez podanego baseline ani adnotacji «do ustalenia»"
- walidator `kpi_baseline_target` ma severity **`hard`** (`cardContentFormulaValidator.ts:1025`)

Doktryna dopuszcza puste baseline **tylko** z adnotacją „do ustalenia" (§A7). Placeholder
nie mówi o tym ani słowa — konsultant nie ma skąd wiedzieć, że puste pole wywali kartę,
a `„do ustalenia (N4)"` ją przepuści.

**2. `"Opis..."` — sekcja opcji decyzyjnych**
`DecisionDetailView.tsx:5740` → `decisions.detail.options.descriptionPlaceholder` = **„Opis..."**

To jest pole opisu **wariantu decyzyjnego** — serce karty Decision. SPEC-N §4 stawia sprawę
wprost: *„decyzja bez wariantów i bez kryterium wyboru nie jest decyzją"*. Placeholder nie pyta
o kryterium, koszt, ryzyko ani odwracalność. Mówi: „Opis".

**3. `"Argument za..."` / `"Argument przeciw..."`**
`DecisionDetailView.tsx:5780`, `:5847`. Zero podpowiedzi o **wadze** argumentu, dowodzie
czy koszcie. Doktryna §A8 wymaga ugruntowania każdej tezy — pole nie prosi o źródło.

**4. `"Wprowadź element..."` ×2 — Task**
`TaskDetailView.tsx:2880` (`myWork.taskDetail.placeholder`) i `:6554` (`…placeholder4`).
Najbardziej pusty ogólnik w systemie. Sam klucz i18r (`placeholder`, `placeholder2`…`placeholder5`)
zdradza, że nikt nie zastanawiał się nad treścią — to auto-wygenerowane nazwy.

**5. `"Oczekiwana akcja..."` ×2 — Notification**
`NotificationDetailView.tsx:1754` i `:3003`. Czyste echo nagłówka sekcji „OCZEKIWANA AKCJA"
(potwierdzone renderem). Użytkownik czyta to samo słowo dwa razy i nie wie, czy ma wpisać
czynność, termin, czy osobę.

**6. `"Nazwa KPI"` · `"Jednostka"` · `"Kategoria"` · `"Obecnie"` · `"Cel realizacja"`**
`InitiativeDocumentView.tsx:7688–7806`. Sześć pól KPI, sześć ech etykiety, zero wzmianki
o kierunku zmiany — mimo że §A2 wymaga „baseline→target **+ kierunek** + jednostka".

**7. `"Kryterium rezygnacji..."`**
`InitiativeDocumentView.tsx:7129` (`initiatives.killCriteria7`). Doktryna §A3 wymaga
„konkretny warunek stop", minimum 2. Placeholder nie podaje ani formatu, ani że mają być dwa.

### 4.3 ★ Wniosek przekrojowy: progi doktryny są NIEWIDOCZNE dla piszącego

```
grep -rn "60–130|60-130|400–750|400-750|120–250|350–700" src/components/   → 0 trafień
grep -rn "minWords|liczba słów|co najmniej" <Initiative|Decision>.tsx      → 0 trafień
```

**Żaden z 63 placeholderów w systemie nie podaje ani jednej liczby z doktryny.** Ani „60–130 słów",
ani „min. 4 rezultaty", ani „min. 2 kryteria zatrzymania", ani „baseline→target".

To jest, moim zdaniem, **główna przyczyna** wyniku opisanego w SPEC-N §4 („19/19 kart poniżej progu"):
kontrakt jest egzekwowany na serwerze i **nigdzie nie komunikowany w miejscu pisania**.
Autor dowiaduje się o progu dopiero, gdy brama odrzuci kartę — albo, częściej, nie dowiaduje się
wcale, bo naruszenia `soft` nie blokują.

---

## 5. Wycieki surowych kluczy i18n (pytanie 4)

**Wynik: ZERO. Trzynaście wycieków z 21.07 jest naprawionych.**

Metoda — audyt maszynowy: z 8 komponentów wyciągnięto każde wywołanie `t('klucz'[, 'default'])`
i sprawdzono, czy klucz ma tłumaczenie PL **i/lub** wartość domyślną. Surowy klucz renderuje się
tylko wtedy, gdy nie ma ani jednego, ani drugiego.

| Komponent | Surowych kluczy |
|---|---|
| Tool · Notification · Interview · RuntimeModeSelector · Decision · Insight · Task | **0** |
| Initiative | 0 (1 trafienie = **fałszywy alarm**, komentarz w kodzie: `InitiativeDocumentView.tsx:9550`) |

Potwierdzenie na renderze: skan `innerText` regexem
`(myWork|interview|initiatives|discoveryTools|decisions?|tasks?|notification|tool)\.[a-zA-Z]`
na wszystkich 7 ekranach → **0 trafień** na każdym.

**Konkretny wyciek zgłoszony w SPEC-N §6A jako „zapisany, nienaprawiony" — jest naprawiony:**
`interview.runtimeMode.conversational.pros/cons` mają dziś tłumaczenia PL i EN. Render
(`href=…screen=karta-interview&…`) pokazuje polską prozę: *„Naturalny przebieg, wychwytuje wątki
spoza scenariusza, najmniej wysiłku dla rozmówcy"*. **SPEC-N §6A należy zaktualizować** —
w obecnej formie kieruje na nieistniejący problem.

---

## 6. DEFEKTY (łamią kanon, z dowodem plik:linia)

**DEF-1 · Kontrakt treści Decision to fantom** — `cardContentValidator.ts:88–92` deklaruje wymogi
dla `alternatives/risk/description/consequencesOfInaction` i wskazuje w komentarzu `decisionService.ts`
jako konsumenta; `decisionService.ts` **nigdy** nie woła `validateCardContent` (0 trafień grep).
Łamie ZŁOTĄ REGUŁĘ 1 z CLAUDE.md (flaga/reguła bez implementacji).

**DEF-2 · Hardkodowany angielski w polach KPI** — `InitiativeDocumentView.tsx:7708`, `:7794`
(`placeholder="Baseline"`), `:7806` (`placeholder="Target"`). Brak klucza i18n; w PL UI widnieje
angielskie słowo. Dotyczy pól objętych anty-wzorcami §A6.3/§A6.4.

**DEF-3 · Placeholder tezy uczy formatu, którego walidator nie akceptuje** —
`InitiativeDocumentView.tsx:8395` podpowiada *„Wierzymy, że… ponieważ… Zmierzymy to przez…"*,
a `cardContentFormulaValidator.ts:1020` wymaga `/Jeśli .+ to .+ (bo|ponieważ) .+/i`
(severity **`hard`**, §A6.2). Tekst napisany literalnie wg podpowiedzi zostaje odrzucony.
UI i brama uczą dwóch różnych rzeczy.

**DEF-4 · Brak polskiej liczby mnogiej — „1 dni temu"** — `NotificationDetailView.tsx:1000`
woła `t('myWork.notificationDetail.daysAgo', { count: diffDays })`; w `pl/translation.json`
klucz ma **jedną** formę `"{{count}} dni temu"`, bez wariantów `_one/_few/_many`.
Render potwierdza: **„Utworzono · 1 dni temu"**.

**DEF-5 · Surowy enum bazy jako etykieta użytkownika** — `NotificationDetailView.tsx:2237` i `:3242`
renderują `notification.type.replace(/_/g, ' ')`. Render pokazuje w wierszu „Typ" wartość
**„AI RISK DETECTED"** — angielski, wersalikami, nietłumaczony. Mapa pod `:156` przypisuje typom
tylko ikonę i kolor, nie etykietę PL.

**DEF-6 · Dwie różne sekcje Insight renderują to samo pole** — `InsightViewer.tsx:7480–7483`:
```ts
} else if (section.id === 'consulting-readout' || section.id === 'consulting-narrative') {
  body = stripMarkdownPreview(insight?.content || '');
}
```
„Odczyt konsultingowy" i „Narracja konsultingowa" spadają na **to samo** `insight.content`.
Render potwierdza: obie sekcje wyświetlają identyczny tekst zaczynający się
*„Kontekst Ocena gotowości operacyjnej przeprowadzona na zlecenie zarządu MZT Komponenty…"*.

**DEF-7 · Angielski w prozie PL na ekranie** — poza słownikiem §A5:
- `„Submit for review"` — Decision, potwierdzone w DOM (`href=…screen=karta-decision&…`)
- `„Created from decision"` — Task, potwierdzone w DOM (`href=…screen=karta-task&…`)
- `„wymaga obecności interviewer'a"`, `„przyjazny dla async"`, `„self-service"` — Interview,
  selektor trybu

**DEF-8 · Karta pokazowa harnessu nie przechodzi własnej doktryny** — `MOCK_INSIGHT`
(`dev-render/screens/karta-insight.tsx:147–460`) uzyskuje **0/100** przy progu 90, z naruszeniem
`hard` `insight.material_quality_complete` znajdującym się **na liście blokującej** bramy
(`cardContentFormulaValidator.ts:1243–1250`). Realną ścieżką zapisu ta karta dostałaby HTTP 422.

---

## 7. UZASADNIONE RÓŻNICE (archetyp tego wymaga — nie zgłaszać jako defekt)

**UR-1 · Insight ma 0 placeholderów w `InsightViewer.tsx`.** Insight jest artefaktem **czytanym**,
generowanym przez AI z sesji — nie formularzem. Jedyne pole edytowalne („Tytuł wniosku…")
pochodzi z powłoki. Poprawnie.

**UR-2 · Tool ma 0 pól wejściowych.** Tool to karta pozycjonująca narzędzie (co robi / czym nie
jest / kiedy użyć), a nie obiekt wypełniany przez konsultanta. Brak placeholderów jest zgodny
z archetypem.

**UR-3 · `"slack:#ops, jira:DRD"` jako placeholder** (Decision `:6903`, `:7234`, `:7604`;
Task `:4908`, `:5172`, `:5466`). To pola integracji — placeholder pokazuje **format składni**,
co jest tu właściwym zastosowaniem. Nie liczę jako defekt (osobno: Task importuje klucze
`decisions.detail.integrations.*`, więc dzieli tłumaczenia z Decision — to celowe współdzielenie).

**UR-4 · Wariant „lekki" kontraktu dla kart krótkich.** Zgadzam się z SPEC-N §4 (DEC-010):
progi słowne na polu „termin" nie mają sensu. Brak `summary_len` dla Notification to nie luka.

---

## 8. DO DECYZJI PIOTRA (wybór produktowy, nie rzemieślniczy)

**P-A · Czy progi doktryny mają być widoczne w UI podczas pisania?**
Dziś kontrakt żyje wyłącznie na serwerze (§4.3). Opcje: (a) licznik słów przy polu z progiem,
(b) progi wpisane w placeholder („Podsumowanie, 3–5 zdań: konkluzja → so-what → pewność"),
(c) zostawić jak jest i polegać na auto-naprawie AI. **Rekomendacja: (b)** — najtańsza, zero
nowych komponentów, a placeholder i tak trzeba przepisać.

**P-B · Który wzorzec podpowiedzi rozciągamy na 6 pozostałych kart?**
Initiative ma dwupoziomowy (nagłówek + zdanie objaśniające + placeholder, §3.1). Jest najlepszy
w systemie i już zaimplementowany. Decyzja: kopiujemy go, czy projektujemy nowy?
**Rekomendacja: kopiujemy** — to zgodne z wnioskiem SPEC-N §6B („dozbroić istniejący komponent,
nie przebudowywać ekranów").

**P-C · Rozstrzygnięcie kolizji DEF-3: „Jeśli…to…bo" czy „Wierzymy, że…"?**
Trzeba wybrać JEDEN format tezy i zrównać UI z walidatorem. Doktryna §A3/§C1 mówi „Jeśli X,
to Y(mierzalne) bo Z". Placeholder mówi inaczej. To decyzja o języku produktu, nie o kodzie.

**P-D · Czy walidator ma odróżniać kartę słabą od karty pustej?**
Punktacja (`cardContentFormulaValidator.ts:476–479`) odejmuje 8 pkt za `soft` i 18 za `hard`
od 100, z podłogą na 0. **12 drobnych uwag = 96 pkt = wynik 0.** Karta pokazowa (13 naruszeń,
w tym 11 kosmetycznych) i karta całkowicie pusta dostają **identyczny wynik 0/100**.
Skala nie ma rozdzielczości na dole — nie da się zmierzyć postępu ani zaraportować „poprawiło się
z 34 na 61". Jeśli §4 SPEC-N ma być bramką z feed-forwardem, to jest do przemyślenia.

**P-E · Kolejność łatania pokrycia.** Doktryna obejmuje 2 typy z 7. Kolejność wg mojego odczytu
ciężaru: **Decision** (fantom — najtaniej, wymogi już napisane, brakuje wołania) → **Task**
(ma sekcje, brak kontraktu całej karty) → Notification → Interview → Tool.

---

## 9. Podsumowanie w trzech zdaniach

Doktryna `CARD_CONTENT_FORMULA.md` jest realnie dobra i realnie egzekwowana — ale **tylko dla
Insight i Initiative**, i **wyłącznie na serwerze**; człowiek piszący kartę nie widzi ani jednego
z jej progów, bo żaden z 63 placeholderów w systemie nie podaje ani jednej liczby.
Decision — karta wybrana na referencyjną — ma wymogi napisane i **nigdy niewołane** (fantom),
a karta pokazowa harnessu, która wygląda najlepiej w całym systemie, dostaje od własnego
walidatora **0/100** i zostałaby odrzucona przez bramę z HTTP 422.
Najlepszy istniejący wzorzec podpowiedzi (Initiative: nagłówek + zdanie objaśniające +
placeholder pytający) już działa na jednej karcie — pytanie do Piotra brzmi, czy rozciągamy go
na pozostałe sześć, czy projektujemy coś nowego.
