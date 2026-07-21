# SPEC-N — karty N (build-ready uzupełnienie SPEC-A)

> **Status:** propozycja do zatwierdzenia przez Piotra. Nic z tego nie jest zaimplementowane.
> **Relacja do SSOT:** to jest **uzupełnienie** `ARTIFACT_ANATOMY_STANDARD.md`, nie konkurencja.
> Po akcepcie wchodzi jako §11.2a i podlinkowanie z §11.2 / §13.1 / §18.1.
> **Zakres:** wzorzec **N** = karty, w których treść pisze (współ)AI: Insight · Initiative · Task ·
> Decision + dziedziczące (KPI · RAID · Milestone · Change Request · Stage Gate · Action Proposal).
> **Nie dotyczy** wzorca W (8 narzędzi roboczych) ani Instrumentów.

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

## 5. Bramka — co sprawdza hook

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

Kolejność migracji wg ciężaru (z A1): Tool → Notification → Interview → Tool Document → Decision
→ Insight → Task → **Initiative** (najcięższa: 10 818 linii, brak panelu, 9 grup w toolbarze).

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

**P3. Czy przy migracji usuwamy martwy kod od razu, czy osobną falą?**
~2500 linii w Task i Notification. Usunięcie przy okazji jest tańsze, ale powiększa diff każdej
migracji i utrudnia odbiór na zrzutach.

---

*Dokument do zatwierdzenia. Po akcepcie: wchodzi jako §11.2a, §13.1 dostaje 3 nowe kolumny,
`CARD_CONTENT_FORMULA.md` dostaje warianty pełny/lekki, powstaje skill `consultify-karty-n`.*
