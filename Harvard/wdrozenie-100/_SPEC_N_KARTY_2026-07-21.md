# SPEC-N — karty N (build-ready uzupełnienie SPEC-A)

> **Status:** propozycja do zatwierdzenia przez Piotra. Nic z tego nie jest zaimplementowane.
> **Relacja do SSOT:** to jest **uzupełnienie** `ARTIFACT_ANATOMY_STANDARD.md`, nie konkurencja.
> Po akcepcie wchodzi jako §11.2a i podlinkowanie z §11.2 / §13.1 / §18.1.
> **Zakres:** wzorzec **N** = karty, w których treść pisze (współ)AI: Insight · Initiative · Task ·
> Decision + dziedziczące (KPI · RAID · Milestone · Change Request · Stage Gate · Action Proposal).
> **Nie dotyczy** wzorca W (8 narzędzi roboczych) ani Instrumentów.

---

## STAN 2026-07-22 — warstwa aktualna (NIE kasuj tego co niżej; dopisane, nie przepisane)

> **Po co ta sekcja:** oryginał (nagłówek „Nic z tego nie jest zaimplementowane", §2.1 „usuwanie sekcji
> 0 z 8", §2.2 „5 kart bez panelu", §2.3 „3 karty zero primary") opisywał stan **sprzed implementacji**.
> Werdykt `_WERDYKT_KARTY_N_2026-07-22.md §5 pkt 13` wprost ostrzega: kto zaplanuje kolejną falę na
> starym SPEC-N, **każe przepisać rzeczy, które już działają**. Ta warstwa mówi, co jest zrobione, żeby
> tego uniknąć. Cała treść oryginału niżej ZOSTAJE jako historia i jako kontrakt typów/bramek (§5) — te
> części są nadal aktualne.
>
> **Dowody:** `_ODBIOR_KARTY_N_2026-07-22/RAPORT.md` (niezależny odbiór, 14 zrzutów, viewport 1280×832,
> izolowana przeglądarka) · implementacja `NModeHeader.tsx` · kanon: `ARTIFACT_ANATOMY_STANDARD.md §11.2`
> („AKTUALIZACJA 2026-07-22", wdrożona z decyzji D-A…D-D Piotra).

### Co ZROBIONO (fazy 1-2 — WYŁĄCZNIE Menu 1 / pasek nagłówka)

Powłoka `NModeHeader.tsx` przebudowana wg decyzji Piotra 2026-07-22. Odbiór: **7/7 kart PASS w Menu 1,
oba motywy.** Zakres = pasek nagłówka; CENTRUM i PRAWY PANEL kart **nietknięte** (patrz „Nadal otwarte").

- **D-B status-etykieta-pigułka** (tekst + token c-*, nie naga kropka) — wdrożone na 7/7. Mapa tonów =
  §11.2 „AKTUALIZACJA". Naprawia defekt „kropka 0px" (D3/D4/D5).
- **D-C wskaźnik zapisu = tekst nieklikalny**, osobno od statusu — 7/7. Znika drugi przycisk akcji (D7).
- **D-D kod obiektu + permalink → kebab `⋮`** — 7/7, na pasku 0 przycisków kodu/linku (D2/D9, w tym crimson permalinku).
- **D6 tytuł `truncate`/wielokropek**, input po kliknięciu — 7/7.
- **§2.3 „dokładnie jeden primary"** — **zrealizowane dla wszystkich 7** (Interview D11, Task D12,
  Initiative — sloty, które wcześniej były puste, teraz mają primary). To unieważnia zdanie oryginału
  „3 karty z 8 mają zero primary".
- **D-A tryb otwarcia wg stanu** — wdrożony (szczegóły w tabeli niżej).

### Stan per karta (7) — po fazach 1-2

| Karta | Primary (jest? etykieta) | Tryb otwarcia (D-A) | Status-etykieta (ton) |
|---|---|---|---|
| **Tool** | ✅ „Startuj sesję" | Tylko-do-odczytu (wyjątek D-A) | „Aktywne" (success) |
| **Notification** | ✅ „Otwórz dokument" | Edycja (wyjątek: arkusz do wypełnienia) | „Nowe" (info) |
| **Interview** | ✅ „Zakończ wywiad" *(było 0 — D11)* | Edycja (wyjątek: aktywny warsztat) | „W trakcie" (info) |
| **Decision** | ✅ „Zatwierdź decyzję" | Edycja (stan roboczy) | „Oczekująca" (info) |
| **Insight** | ✅ „Konwertuj na inicjatywę" | ⚠️ Podgląd (in_review → do potwierdzenia) | „W recenzji" (info) |
| **Task** | ✅ „Wyślij do przeglądu" *(było 0 przy readMode — D12)* | Edycja (stan roboczy) | „W trakcie" (info) |
| **Initiative** | ✅ „Oznacz jako ukończone" *(było 0 w harnessie)* | ⚠️ Podgląd (executing → do potwierdzenia) | „W realizacji" (success) |

Crimson w Menu 1: **0 trafień na 7/7** (skan klasy `primary-\d` + pomiar `getComputedStyle` = `rgb(133,24,47)`).

### Nadal OTWARTE (fazy 1-2 tego NIE tknęły — kolejne fale)

Menu 1 to jedyny domknięty obszar. Poniższe wymogi SPEC-N dotyczą CENTRUM/PANELU i **czekają**:

- **§2.1 usuwanie sekcji lewej kolumny** — Decision/Task mają je w trybie Edycja (werdykt), reszta nie;
  „0 z 8" z oryginału było już nieaktualne w dniu werdyktu. Pełny kontrakt `sectionManagement` niewdrożony.
- **§2.2 prawy panel wymagany** — nie ruszony fazami 1-2; „5 kart bez panelu" wymaga osobnej weryfikacji
  na żywej bazie (odbiór 07-22 był scoped do Menu 1).
- **§2.4 `NModeToolbar` jako jedyna droga · §2.5 kontrakt AI per sekcja · §2.6 anty-duplikacja ·
  §2.7 rozdział trybów + martwy kod · §2.8 odkrywalne skróty** — otwarte.
- **§4 kontrakt treści** — otwarte (0 z 63 podpowiedzi komunikuje próg — werdykt §3 pkt 3).
- **FAIL-e odbioru 07-22 (poza Menu 1, `RAPORT.md §4`):** Interview crimson w `RuntimeModeSelector.tsx`
  (selektor trybu + badge „Rekomendowane" = #85182F) · Insight duplikaty kluczy React + 3× ten sam wpis
  Powiązań · Insight karty „DZIAŁANIA" nakładają się i ucinają tekst @1280px. **Luka bezpiecznika:**
  `check-artefakt.sh` nie skanuje centrum kart (`RuntimeModeSelector`), więc crimson tam przechodzi hook.

### Zastrzeżenie metodyczne (z RAPORT §6/§8)

Harness **omija serwer** (podmienia fetch) → trwałość zapisu, przejście bramy jakości i stan żywej bazy
**niemierzalne**. Zarzut werdyktu „Notification gubi treść, meldując »Zapisano«" to mechanika/persistencja —
z harnessu nie do potwierdzenia ani obalenia; do sprawdzenia na demo. Wskaźnik „Zapisano" jest teraz tekstem
(D-C), więc jeśli persistencja padnie, komunikat i tak wprowadzi w błąd — osobny, mechaniczny wątek.

---

## 0A. SIEDEM kart, nie osiem — korekta klasyfikacji (Piotr, 2026-07-21)

Inwentarz A1 liczył **8** kart i traktował „Tool Document" jako jedną z nich (archetyp B,
do rozstrzygnięcia). **To był błąd klasyfikacji.** Rozróżnienie właściciela:

- **Tool** = karta N. Obiekt pracy: ma stan, właściwości, powiązania, żyje w systemie. **Zostaje.**
- **Tool Document** = **wynik**, nie karta. To zawsze będzie PowerPoint, Word albo Excel —
  dostawa dla klienta. Nie ma powłoki artefaktu, bo nie jest artefaktem roboczym.
  **Wypada z tej fali** i dostaje własny kontrakt renderu (bliżej ART-012 niż powłoki).

**Objęte tym dokumentem (7):** Tool · Initiative · Insight · Interview Session · Decision ·
Notification · Task.

---

## 0. Zasada rozstrzygająca — dlaczego ten dokument jest inny

Tabele w tej aplikacji **się nie rozjeżdżają**, karty N — tak. Przyczyną nie jest brak standardu
opisowego: `ARTIFACT_ANATOMY_STANDARD.md` jest szczegółowy i dobry. Przyczyną jest to, że
`StandardTable` **nie da się obejść**, a `NModeShell` — da się, i obchodzi go **8 kart na 8**.

Dowód, że proza nie wystarcza (`IdeasTableContent.tsx`, 2026-07-21): autor **cytuje kanon
w komentarzu** i dwie linie niżej ustawia strefy w złej kolejności.

**Stąd reguła redakcyjna tego dokumentu:** każdy wymóg zapisujemy tak, żeby dał się przełożyć na
**typ TypeScript**. Każdy punkt ma sekcję *„→ wymusza"*. Wymóg, którego nie da się wyrazić typem
ani sprawdzić hookiem, jest **rekomendacją**, nie standardem — i jest tak oznaczony.

**Test dla czytającego:** jeśli w zdaniu jest przymiotnik („czytelny", „spójny", „sensowny")
zamiast liczby, tokenu albo nazwy typu — to zdanie jest źle napisane.

---

## 1. Co JUŻ MAMY (bez zmian — tylko odesłanie)

Te obszary są opisane wystarczająco build-ready. **Nie powtarzamy ich tutaj.**

| Obszar | Gdzie | Stan |
|---|---|---|
| Anatomia 6 stref, definicje, reguła zejścia w głąb | §2 | ✅ |
| 5 archetypów × 2 klasy wielkości | §3 | ✅ |
| Menu per archetyp | §5 | ✅ |
| Katalog elementów + **stała kolejność kebaba** | §6.1–6.4 | ✅ |
| Foundation graficzny, light/dark, 26 elementów | §9 | ✅ |
| **Wymiary powłoki, tokeny, kolejność Menu 1, kolejność panelu, skróty** | **§11.2** | ✅ |
| Drabina otwierania (klasa S=drawer / L=pełna), quick-create=modal | §12.2 | ✅ |
| Strażnicy niezapisanych zmian | §12.4 | ✅ |
| **Instancjacja 11 typów Rekordu** — primary + sekcje kluczowe panelu | **§13.1** | ✅ |
| DoD Artefaktu — 9 czerwonych MUST | §18.1 | ✅ |
| Responsywność, copy/i18n, a11y, motion, gęstość | §19 | ✅ |
| Doktryna treści kart (rubryki, progi, anty-wzorce) | `CARD_CONTENT_FORMULA.md` | ✅ dla 2 z ~10 typów |

**Wniosek:** standard nie jest ubogi. Brakuje **egzekucji** i **ośmiu konkretnych obszarów** niżej.

---

## 2. Czego BRAKUJE — osiem obszarów

Każdy wynika wprost z powtarzalnego defektu wykrytego w inwentarzu A1 (8 kart × 10 parametrów),
nie z domysłu.

### 2.1 Lewa kolumna — zarządzanie kartami sekcji ★ *(pytanie Piotra wprost)*

Dziś **nieopisane w ogóle**. §11.2 wymienia „lewy rail" tylko dla archetypów A/D/E; dla Rekordu
(archetyp C) lewa kolumna sekcji nie istnieje w standardzie, a w kodzie ma ją 6 z 8 kart —
każda inaczej.

**Kontrakt:**

| Zdolność | Reguła | Dziś |
|---|---|---|
| Zmiana kolejności | drag za uchwyt `⠿`; kolejność trwała per użytkownik | Insight/Initiative/Decision/Task tak, reszta nie |
| Dodawanie sekcji | tylko z zamkniętego katalogu typu; brak „pustej sekcji" | tylko Insight |
| **Usuwanie sekcji** | **MUST — dziś nie ma nigdzie** (R2) | ❌ 0 z 8 |
| Ukrywanie | odrębne od usuwania; ukryta sekcja wraca z katalogu | 4 z 8 |
| Płaska vs grupowana | grupowanie **dozwolone od 8 sekcji wzwyż** (DEC-001) | niespójne |

**Limit klasy S — nowa reguła rozstrzygająca:** artefakt klasy S (drawer) deklaruje **maksymalnie
4 sekcje** lewej kolumny. Powyżej = to jest klasa L i tak ma być zaklasyfikowany.
*Uzasadnienie:* Task deklaruje klasę S i ma 10 sekcji — to nie jest drobiazg, tylko sprzeczność
klasyfikacji, która wywraca drabinę otwierania z §12.2. Reguła zamienia spór o gust w test.

**Zarezerwowane identyfikatory (MUST):** `comments` · `history` · `activity-log` **nie mogą być
sekcją lewej kolumny** — należą wyłącznie do prawego panelu.
*Dziś łamią to:* Decision (i renderuje komentarze **dwa razy naraz**), Task, Notification,
Tool Document.

**→ wymusza:** `sections: NModeSectionId[]` gdzie `NModeSectionId` to union **z wykluczonymi**
zarezerwowanymi id; `sectionManagement: { reorder: boolean; add: SectionCatalog; remove: true; hide: boolean }`
z `remove` niezdejmowalnym; walidacja długości tablicy względem klasy.

### 2.2 Prawy panel — wymagany, nie opcjonalny

**5 kart z 8 nie ma go w ogóle** (Tool, Tool Document, Initiative, Interview, Notification). To nie
jest „zła kolejność sekcji", tylko brak całej struktury. Initiative — największa i najważniejsza
karta — trzyma właściwości jako **poziomą siatkę 7 pól pod nagłówkiem**.

**Kontrakt:**
- Panel jest **polem wymaganym** powłoki, nie `?:`.
- Kolejność z §11.2 bez zmian: Akcje · Właściwości · Powiązania · Komentarze · Historia/AI.
- **Domyślny stan: wszystkie sekcje zwinięte poza „Akcje"** (R3) — dziś niespójne.
- **Rozszerzenia poza piątkę: zamknięta lista.** Dozwolone dokładnie jedno: **`evidence`
  (Dowody i założenia)**, zawsze **między Powiązaniami a Komentarzami**. Żadnych innych.

**Decyzja (moja, do odrzucenia przez Piotra): `evidence` obowiązkowe dla każdej karty, której
treść generuje AI.** Uzasadnienie z rzemiosła doradczego: w materiale BCG/McKinsey teza bez
ścieżki do dowodu jest bezwartościowa — „so what" musi dać się cofnąć do „skąd wiemy". Karta,
która twierdzi, a nie pokazuje na czym się opiera, nie nadaje się przed klienta. Insight ma to
dziś jako pilota; to nie eksperyment UI, to warunek wiarygodności.

**→ wymusza:** `rightPanel: RightPanelSections` jako pole wymagane, gdzie `RightPanelSections`
to **rekord o stałych kluczach** (`actions/properties/relations/comments/history` + opcjonalne
`evidence`), **nie** dowolna tablica `{id,label}[]`. Karta bez panelu przestaje się kompilować.

### 2.3 Nagłówek — dokładnie jeden primary, wymuszony typem

3 karty z 8 mają **zero** primary; Tool Document renderuje **dwa równoważne CTA** naraz
(Approve + Send back). Łamanie idzie w obie strony, więc konwencja nie działa.

**Kontrakt:**
- `primaryAction` jest **wymagane**, z jawną wartością „świadomie brak".
- Poza tym jednym slotem **żaden element nie może być stylowany jako solid/filled CTA**.
  *Dziś:* Insight ma formalnie 1 primary, ale toolbar ma solid-teal „AI Consultant", który
  wizualnie z nim konkuruje. Formalnie zgodne, wizualnie nie — więc reguła musi mówić o wyglądzie.
- Wskaźnik zapisu **osobno** od statusu cyklu życia (już w §11.2, dziś łamane przez Notification,
  które nadużywa deprecated propa `draftSavedLabel`).

**→ wymusza:** `primaryAction: PrimaryActionConfig | { intentionallyNone: true; reason: string }`;
hook `check-artefakt.sh` rozszerzony o wykrywanie solid-CTA poza slotem primary.

### 2.4 Toolbar — jedna droga budowy

**0 z 8 kart** używa `NModeToolbar`. Trzy piszą bespoke `<div>`, a Tool Document **portaluje
toolbar całkiem poza powłokę** (`createPortal`), stylując go jak kebab wiersza listy.

**Kontrakt:** powłoka nie eksportuje żadnego prymitywu do budowy toolbara poza `NModeToolbar`;
`NModeShell` nie przyjmuje `children` ani portal-targetu poza zdefiniowanymi slotami — żeby
wyjście na zewnątrz stało się **technicznie niemożliwe**, nie „niezalecane".

### 2.5 Kontrakt AI per sekcja — wymagany, nie opt-in

Mechanizm istnieje (`NModeCardState`: `empty → generating → ai-draft → edited → done → error`
+ pasek `Regeneruj · Edytuj · Zaakceptuj`) i **nie ma go w standardzie w ogóle**. W kodzie wpięty
częściowo: Initiative 13/26 sekcji, Decision 4/8, Task 4/10, Insight wariant badge-only.

**Kontrakt:** każda sekcja deklaruje kontrakt AI **albo jawne wykluczenie**. Milczenie (dzisiejszy
stan czterech kart) przestaje być możliwe.

**Decyzja (moja): regeneracja na sekcji w stanie `edited` zawsze pyta o nadpisanie.** Praca
konsultanta ginąca pod przyciskiem „Regeneruj" to najkosztowniejszy błąd w tej klasie narzędzi.

**Decyzja (moja, DEC-008): sekcja AI NIE dostaje własnego kebaba.** Akcje AI żyją w pasku
kontraktu sekcji. Trzeci poziom menu w karcie, która ma już Menu 1 i kebab wiersza, to gęstość
bez wartości.

**→ wymusza:** `aiContract: NModeCardStateProps | { none: true; reason: string }` na deklaracji
sekcji.

### 2.6 Anty-duplikacja akcji

Ta sama akcja w dwóch miejscach z tym samym handlerem: **Save** (Task, Decision — nagłówek
i panel), **Export** i **AI Consultant** (Insight — toolbar i panel), **Delegate** (Decision,
trzy kopie), **Generate Initiatives** (Tool Document, **cztery** miejsca).

**Kontrakt:** akcje pochodzą z jednego rejestru per karta; miejsce renderowania jest **atrybutem
akcji**, nie osobną deklaracją. Sekcja „Akcje" w panelu automatycznie wyklucza akcje, które
powłoka renderuje w nagłówku. Duplikat id = błąd w dev-mode.

### 2.7 Tryby — rozdzielić dwa pojęcia i usuwać martwe

„Present" znaczy dziś **dwie różne rzeczy**: gęstość widoku (N/C) i tryb pełnoekranowy. Initiative
ma oba pod jedną ikoną.

**Kontrakt:**
- `densityMode: 'n' | 'c'` i `presentationMode: 'off' | 'fullscreen'` — **osobne pola, osobne sloty**.
- **Tryb wyłączony globalnie znika z typu.** Nie zostaje w kodzie z `useEffect`, który go zawraca.
  *Dziś:* Task ma z tego powodu **~25% pliku** martwe (1870 linii), Notification ~600 linii.
- **Deprecated propy powłoki muszą być martwe typem** (`never`), nie komentarzem. Komentarz
  „Do not use for persistence state" nie powstrzymał Notification przed nadużyciem.

### 2.8 Skróty klawiszowe — odkrywalne

Notification ma `D` = usuń i `M` = oznacz przeczytane, **bez żadnej widocznej podpowiedzi**.
Skrót niszczący dane bez wskazówki na ekranie to defekt bezpieczeństwa użycia, nie ułatwienie.

**Kontrakt:** skrót istnieje ⟺ jest widoczny przy akcji (badge `[D]` na pigułce, jak w §7.3b dla
preview). Skróty destrukcyjne wymagają potwierdzenia.

---

## 3. Kontrakt per typ karty — czego brakuje w §13.1

§13.1 podaje dla 11 typów Rekordu: ikonę, sposób otwarcia, primary i sekcje kluczowe panelu.
**Brakuje trzech kolumn**, bez których „czy ta karta jest zgodna?" nie ma twardej odpowiedzi:

| Nowa kolumna | Co zawiera |
|---|---|
| **Sekcje lewej kolumny** | zamknięta lista + czy grupowane (limit klasy S = 4) |
| **Które sekcje mają kontrakt AI** | lista id, reszta jawnie wykluczona |
| **Kontrakt przycisków** (KT3 — pytanie Piotra 20.07) | primary · akcje 2rz. · co w kebabie · co w panelu |

To jest **deskryptor per typ** — dokładnie ten mechanizm, który tabele mają od dawna (§15),
preview dostał wczoraj (§7.3c), a karty N nie mają wcale.

---

## 4. Kontrakt treści — zakres (DEC-010)

Stan: doktryna `CARD_CONTENT_FORMULA.md` jest realnie McKinsey-grade (anty-wzorce, kwantyfikacja,
ugruntowanie, prompty generacyjny i recenzencki, gold-standard), walidator ma twarde progi
(`insight.summary_len` 60-130 słów, `initiative.description_len` 400-750) i woła go 8 serwisów.
**Obejmuje 2 typy z ~10.** Decision — wybrany jako karta referencyjna powłoki — ma **zero**.

**Decyzja (moja, DEC-010): kontrakt treści dostaje KAŻDY typ karty N, w dwóch wariantach.**

| Wariant | Dla kogo | Co zawiera |
|---|---|---|
| **Pełny** | treść pisze AI w długiej formie: Insight · Initiative | rubryki + **progi długości** + anty-wzorce |
| **Lekki** | wypełniane ręcznie lub AI-krótko: Decision · Task · KPI · RAID · Notification · pytania wywiadu | **pola obowiązkowe** + anty-wzorce, **bez** progów słownych |

*Uzasadnienie:* progi długości na polu „termin" są bez sensu, ale zdanie „decyzja bez wariantów
i bez kryterium wyboru nie jest decyzją" — jest twardym anty-wzorcem i da się sprawdzić maszynowo.
Odpuszczenie kontraktu tam, gdzie treść jest krótka, jest dokładnie tym błędem, który już
popełniliśmy: Decision i Task mają dziś puste sekcje z „Generate with AI / Fill manually" i zero
progu jakości.

**Warunek konieczny:** kontrakt bez wpięcia w generację jest dokumentem, nie bramką. Raport
ART-016 pokazał **19 z 19 kart Insight poniżej progu** — mimo pełnego kontraktu i działającego
walidatora. Kontrakt liczy się dopiero, gdy blokuje zapis.

---

## 4A. Warstwa dowodowa — co to jest i kogo obowiązuje

**Po ludzku.** Karta twierdzi: *„Marża w cold chain spadła o 4 punkty przez rozdrobnienie floty"*.
Pytanie klienta przy stole brzmi zawsze tak samo: **„skąd to wiecie?"** Dziś na większości kart nie
ma odpowiedzi — treść wygenerowało AI z sesji i dokumentów, ale ścieżka powrotna nie istnieje.

Warstwa dowodowa to **ta ścieżka powrotna**: przy każdej tezie widać, na czym się opiera — który
wywiad, który dokument, która liczba. Nie akapit do czytania, tylko link do rozwinięcia.

*Dlaczego to jest przewaga, a nie ozdoba:* konsultant, który nie umie w sekundę pokazać źródła,
traci wiarygodność. Miro tego nie ma, Notion tego nie ma, żaden generyczny SaaS tego nie robi.

**Obowiązuje: Insight · Initiative · każdą kartę, której treść generuje AI.**
Initiative wchodzi wprost — bo inicjatywa bez odpowiedzi „z czego to wynika" jest pomysłem,
nie inicjatywą, a to jest kluczowe narzędzie w tym produkcie.

**Bramka nie blokuje pisania, blokuje promocję (MUST).** Brak dowodów **nie** blokuje zapisu
roboczego. Blokuje dopiero **przejście do zatwierdzenia**. Piszesz swobodnie, system pyta o źródła
w momencie, w którym karta ma iść dalej — tak jak działa dziś bramka jakości w wywiadach.

---

## 5. EGZEKUCJA — cztery bramki ★

> To jest odpowiedź na postawiony wprost problem: *„nic w systemie nie broni się przed cofnięciem"*.
> Kolejność od najmocniejszej. Każda następna łapie to, czego poprzednia z natury nie widzi.

### 5.1 Typ — stany niedozwolone mają być niewyrażalne

Najmocniejsza i darmowa w utrzymaniu: nie wymaga niczyjej pamięci ani dyscypliny.

| Reguła | Realizacja w typie |
|---|---|
| Panel obowiązkowy | `rightPanel: RightPanelSections` (bez `?:`), rekord o stałych kluczach |
| Jeden primary | `primaryAction: PrimaryActionConfig \| { intentionallyNone: true; reason: string }` |
| Zarezerwowane sekcje | `NModeSectionId` = union **z wykluczonymi** `comments`/`history`/`activity-log` |
| Kontrakt AI wymagany | `aiContract: NModeCardStateProps \| { none: true; reason: string }` |
| Limit klasy S | `sections` walidowane długością względem `class: 'S' \| 'L'` |
| Wycofany prop | typ `never`, nie komentarz |

**Test:** karta bez panelu **nie kompiluje się**. Nie „jest niezgodna" — nie buduje się.

### 5.2 Hook — to, czego typ nie widzi, bo dotyczy wyglądu

`check-artefakt.sh` rozszerzony o: drugi element solid/filled CTA poza slotem primary · toolbar
budowany poza `NModeToolbar` · `createPortal` z wnętrza powłoki · `primary-*` i `c-accent`
w nowym kodzie (jest dziś, zostaje).

### 5.3 Test zgodności — jedyna bramka łapiąca runtime

**To jest bramka, której nam brakowało.** Fala N: agent wstawił `useCallback` z zależnością do
`const`-a zadeklarowanego niżej → `ReferenceError` → cały widok w error-boundary. **Przeszło
esbuild i tsc**, wywaliło się w przeglądarce.

Jeden test parametryzowany rejestrem: dla **każdej** zarejestrowanej karty renderuje ją z danymi
makietowymi i sprawdza:

1. renderuje się bez wyjątku i bez error-boundary,
2. dokładnie jeden element ma rolę primary,
3. panel obecny, sekcje w kanonicznej kolejności, zwinięte poza Akcjami,
4. żaden identyfikator akcji nie występuje dwa razy,
5. żadna sekcja lewej kolumny nie ma zarezerwowanego id,
6. liczba sekcji ≤ limit klasy,
7. każda sekcja ma `aiContract`.

**Nowa karta dopisana do rejestru jest testowana automatycznie — bez pisania testu.**

### 5.4 Rejestr — system wie, co jest prawidłowym komponentem

`src/components/standard/registry.ts` — jedno źródło: powierzchnia → komponent → sekcja
standardu → bramka. Z niego korzystają jednocześnie: test §5.3, hook §5.2 i generowany
przegląd „które ekrany są na standardzie".

**Ekran bez wpisu w rejestrze nie przechodzi CI.** Stąd system *wie*, co jest prawidłowym
komponentem — i ten sam mechanizm obsłuży każdy następny komponent, który zbudujemy.

### 5.5 Bramka źródeł — dokumentacja ma nie kłamać

`scripts/sprawdz-zrodla.mjs` (gotowe 2026-07-21): czyta 98 plików instruktażowych, wyciąga 824
odwołania i sprawdza, czy każdy cytowany plik istnieje **na tej gałęzi**. Pierwszy bieg: **36 widm,
13 w pięciu skillach.** Dokument cytowany jako SSOT, który nie istnieje, jest gorszy niż jego brak —
agent zgaduje zamiast czytać.

---

## 5B. Bramka — co sprawdza hook

Rozszerzenie `check-artefakt.sh` (dziś sprawdza tylko tokeny kolorystyczne):

1. karta bez `rightPanel` → **blok**
2. sekcja o zarezerwowanym id w lewej kolumnie → **blok**
3. drugi element solid/filled CTA poza slotem primary → **blok**
4. toolbar budowany poza `NModeToolbar` / `createPortal` z powłoki → **blok**
5. sekcja bez `aiContract` (nawet `{none}`) → **blok**
6. klasa S z >4 sekcjami lewej kolumny → **blok**
7. `primary-*` / `c-accent` w nowym kodzie powłoki → **blok** (jest dziś, zostaje)

---

## 6. Kolejność wykonania (bez zmian wobec planu z 20.07)

`W1 inwentarz` ✅ → **`W2 ten dokument`** → `W3 komponent` → `W4 migracja 8 kart` → `W5 bramka`.
W rejestrze: ART-001 ✅ → ART-002 → ART-003 → ART-004…010 → ART-011.

Kolejność migracji wg ciężaru (z A1, **bez Tool Document** — patrz §0A):
Tool → Notification → Interview → Decision → Insight → Task → **Initiative**
(najcięższa: 10 818 linii, brak panelu, 9 grup w toolbarze).

**Warunek wejścia do W4:** każda z 7 kart ma ekran w harnessie `dev-render` i zrzut PRZED.
Bez zrzutu PRZED nie da się uczciwie odebrać zrzutu PO.

**Stan na 2026-07-21, wieczór:** harness zbudowany i zweryfikowany w przeglądarce — **8/8
ekranów renderuje się** (7 kart + porównanie preview), jasny i ciemny motyw. Warunek wejścia
do W4 spełniony.

### 6A. Znaleziska z harnessu — naprawione na żywo (nie tylko zapisane)

Budowa harnessu ujawniła cztery realne wady, których lektura kodu by nie złapała — dokładnie
lekcja z fali N: *„esbuild przeszedł" nie jest dowodem, dowodem jest przeglądarka.* Wszystkie
cztery naprawione i wypchnięte na demo tego samego wieczoru.

| # | Gdzie | Co | Jak znalezione |
|---|---|---|---|
| 1 | harness, 7 ekranów | Router `window.fetch` instalowany na poziomie modułu; `main.tsx` importuje wszystkie karty naraz → routery nadpisywały się nawzajem, ostatni odpowiadał obcym fallbackiem | Initiative zwracała „Nie udało się załadować" mimo „esbuild OK" |
| 2 | **produkt** — `InterviewWorkspace.tsx` + `InterviewHub.tsx` | `toLocaleDateString(t('...enUs'))` bez fallbacku — klucz istnieje tylko w en/pl; w de/es/ja/jp/ar i18next zwraca sam klucz → `RangeError: Invalid language tag` → **cały ekran w error-boundary** | Interview w error boundary w harnessie |
| 3 | **produkt** — `NotificationDetailView.tsx:2521` | Przycisk „Analizuj z AI" miał `border-primary-400/text-primary-600/bg-primary-500` — pułapka nr 1 z CLAUDE.md, crimson na akcencie AI zamiast `c-info`/teal | zmierzony computed style w ciemnym motywie: `rgba(168,45,73)` |
| 4 | **produkt** — `DecisionPreviewPanel.tsx` | Ten sam handler `onRemind` renderowany dwa razy, gdy `canAct=false` — dokładnie wzorzec z §2.6 (anty-duplikacja) | duplikat widoczny na ekranie porównawczym preview, policzony przez `querySelectorAll` |

**Znalezisko zapisane, nienaprawione (poza zakresem tej tury):** ekran Interview w trybie
`conversational` renderuje surowe klucze i18n (`interview.runtimeMode.conversational.pros/cons`)
zamiast tłumaczeń — nie crashuje, tylko pokazuje klucz jako tekst. Do dopisania jako osobne
zgłoszenie w rejestrze (obszar WYW), nie do kodowania przy okazji.

### 6B. Piotr patrzy na zrzut i widzi to, czego kod nie pokazuje

Po naprawie wariantów Piotr spojrzał na ten sam ekran porównawczy i zapytał wprost: *„każdy
z tych ekranów wygląda inaczej — strefy nie są tej samej wielkości, dolna część wygląda różnie."*
Zmierzone (nie na oko): wysokość całej karty 579–684 px (18% rozstępu). Rozbite na górę
(meta+opis, zależną od długości tekstu: 283–314 px, 11%) i dół (AI+powiązania+akcje,
zależny od struktury: 288–371 px, **29%**) — problem w **prawie trzy razy większym stopniu**
siedział w dole, nie w treści.

Przyczyna: Decision miał **7 widocznych przycisków w 3 wierszach** — złamanie
`DOKTRYNA_GESTOSCI.md` §1 („toolbar ≤5 widocznych, 6+ → obowiązkowy overflow") i §15
(„gęsty i płytki, nie płaski wysyp"). Piotr rozstrzygnął: Zatwierdź/Odrzuć/Odłóż zostają
zawsze widoczne (3), pozostałe cztery (Więcej info/Deleguj/Przypomnij/Eskaluj) → „…".

**Ale zamiast naprawić to punktowo, Piotr zadał właściwe pytanie: „czy nie łatwiej zbudować
komponent na nowo i podmienić wszystkie?"** Odpowiedź, po sprawdzeniu kodu: `PreviewActionBar`
już jest współdzielony (11 modułów) — problemem nie był brak wspólnego komponentu, tylko
brak w nim **jednej zdolności**: mechanizmu przepełnienia. Bez niej każdy ekran, który
potrzebował „…", pisał je sam — i to jest dokładnie to, co się stało **dwa razy w jednym
wieczorze** (raz w produkcji, raz w moim własnym mockupie porównawczym), zanim doszliśmy
do tego zdania.

**Naprawione u źródła (`PreviewActionBar.tsx`):** nowy prop `overflowActions` — komponent
sam renderuje trigger „…" + menu, dołączony do ostatniego wiersza `rows` (albo jako
samodzielny wiersz, gdy `rows` jest puste). Dev-mode `console.warn`, gdy widocznych akcji
jest >5 bez użycia tego propa — **DOKTRYNA_GESTOSCI §1 wymuszona przez komponent, nie przez
pamięć autora ekranu**. `DecisionPreviewPanel.tsx` i mockup porównawczy przepięte na ten
prop; ręczny kod menu usunięty z obu miejsc. `PillColorScheme` ujednolicony (był
zduplikowany jako lokalny `ColorScheme` w `PreviewActionBar.tsx` — druga kopia tego samego
typu, którą trzeba by osobno pamiętać o synchronizacji z wycofaniem `purple/green/blue`).

Zweryfikowane w przeglądarce: wysokość Decision 645→599 px, menu otwiera się i zamyka
poprawnie, wszystkie 24 miejsca używające `PreviewActionBar` w repo nadal się kompilują.

**Wniosek dla dalszej migracji (W3/W4):** ten sam wzorzec — dozbrojenie istniejącego,
już-przyjętego komponentu jedną brakującą zdolnością, zamiast przebudowy ekranów od zera —
jest właściwym podejściem też dla pełnych kart N. `NModeToolbar`/`NModeCardState` już
istnieją; prawdopodobnie brakuje im tej samej klasy rzeczy (przepełnienie, rezerwacja
sekcji), nie całkowitego zastąpienia.

---

## 7. Decyzje — moje propozycje i to, o co pytam

**Zdecydowałem sam (możesz odrzucić każdą):**

| # | Rzecz | Decyzja | Dlaczego |
|---|---|---|---|
| 1 | `evidence` jako 6. sekcja panelu | **obowiązkowa dla kart z treścią AI**, między Powiązaniami a Komentarzami | teza bez ścieżki do dowodu nie idzie przed klienta |
| 2 | Task: klasa S czy 10 sekcji | **klasa S z limitem 4 sekcji**; nadmiar → panel; Podzadania do panelu wg §13.1 | limit zamienia spór o gust w test |
| 3 | Notification | **lżejszy podtyp „wiadomość systemowa"** — bez pełnego panelu, ale z jednym primary i uczciwymi stanami | 6 pól metadanych nie potrzebuje akordeonu; pełna powłoka to ceremonia |
| 4 | Tool Document: archetyp | **B w wariancie „do przeglądu"** — bez Menu 2 formatowania | to widok recenzji dostawy, nie edytor prozy |
| 5 | Interview: 3 warianty runtime | **jedna powłoka, centrum może się różnić** — `single_question` przestaje mieć własny top-bar | „inna powłoka" to nie delta centrum |
| 6 | Kebab sekcji AI (DEC-008) | **nie ma go** | trzeci poziom menu bez wartości |
| 7 | Zakres kontraktu treści (DEC-010) | **każdy typ**, w wariancie pełnym albo lekkim | brak kontraktu = dzisiejsze puste sekcje |

**Pytam Ciebie — bo to decyzje produktowe, nie rzemieślnicze:**

**P1. Czy Tool i Tool Document w ogóle zostają w zakresie MVP?**
Jeśli nie, spadają z listy migracji (2 z 8 kart) i standard ich nie dotyczy. Karta MVP nie
rozstrzyga, a to zmienia rozmiar fali o jedną czwartą.

**P2. Czy obowiązkowa warstwa dowodowa ma objąć też Initiative?**
Podnosi poprzeczkę generatorowi: każda inicjatywa musiałaby wskazać, z czego wynika. Jakościowo
to duży skok, ale wydłuża generowanie i może zablokować zapis kart, które dziś przechodzą.

**Rozstrzygnięte przeze mnie (Piotr: „ty jesteś CTO, ty decydujesz"):**

| # | Rzecz | Decyzja | Dlaczego |
|---|---|---|---|
| P1 | Tool / Tool Document w zakresie | **Tool zostaje jako karta N; Tool Document wypada** — jest wynikiem (PPT/Word/Excel), nie kartą | rozróżnienie Piotra 21.07; patrz §0A |
| P2 | Warstwa dowodowa dla Initiative | **TAK, z bramką przy zatwierdzaniu** — nie blokuje pisania | inicjatywa bez „z czego to wynika" jest pomysłem; patrz §4A |
| P3 | Martwy kod | **osobną falą, PO migracjach** | ~2500 linii w Task i Notification. Przy okazji byłoby taniej, ale każdy diff przestałby się nadawać do odbioru na zrzutach — a to jedyny mechanizm kontroli, który dziś realnie działa |

---

*Dokument do zatwierdzenia. Po akcepcie: wchodzi jako §11.2a, §13.1 dostaje 3 nowe kolumny,
`CARD_CONTENT_FORMULA.md` dostaje warianty pełny/lekki, powstaje skill `consultify-karty-n`.*
