# AUDYT: czy mamy określoną ARCHITEKTURĘ artefaktów (2026-07-22)

> **Dla:** Piotr (nie-koder). **Pytanie:** zanim ruszymy standaryzację kart — czy artefakty MAJĄ
> architekturę, czy każdy jest robiony inaczej?
> **To jest audyt ISTNIENIA specyfikacji, nie jej pisanie.** Zero zmian w plikach produktu.
> **Baza:** worktree `fix/prv-mywork-preview` (baza `origin/demo`, 24 commity za czubkiem demo — drobne).
> **Metoda:** każde twierdzenie ma dowód `plik:linia` z żywego kodu; nie z docy i nie z flag.
> **Słownik (ustalony 07-22):** ARTEFAKT = obiekt-ekran + wspólna powłoka (jest ich 7). KARTA = sekcja
> WEWNĄTRZ artefaktu, gdzie AI pisze treść (Initiative ma ich 20+).

---

## 1. TRZY ODPOWIEDZI W TRZECH ZDANIACH

**(a) Wspólna architektura POWŁOKI (Menu 1 · prawy panel · kebab · stany)? — CZĘŚCIOWO.**
Powłoka jest opisana wzorowo (jeden z najlepszych obszarów w repo) i Menu 1 + kebab są NAPRAWDĘ
identyczne na 7/7, bo płyną z jednego wspólnego komponentu `NModeHeader` — ale „identyczne na każdym
artefakcie" kończy się na nagłówku: zestaw sekcji prawego panelu waha się 2–6, a twardy kontrakt, który
miałby to wymusić (`StandardArtifactShell`), jest podłączony do **0 z 7** artefaktów, więc spójność
trzyma się dziś na konwencji autora, nie na bramce.

**(b) Opisana ZAWARTOŚĆ kart (co AI ma napisać w każdej karcie + próg)? — CZĘŚCIOWO (słabo).**
Zawartość opisana systemowo tylko dla **2 z 7** artefaktów (Insight, Initiative), i to per POLE DANYCH,
nie per KARTĘ; dla reszty jest wyrywkowa (Task, Decision) albo żadna (Interview, Tool, Notification),
a tam gdzie jest — jest **doradcza**: twarda brama łapie wyłącznie brak tytułu i wypełniacz, więc progi
kompletności nie egzekwują niczego (Decision ma wręcz kontrakt-widmo: reguły są zdefiniowane, ale nikt
ich nie woła).

**(c) Opisane DEFAULT vs DODAWALNE karty (który zestaw domyślny, co można dołożyć)? — CZĘŚCIOWO.**
Jest realny opis (dokument `n-mode-card-standard.md`: karta domyślna/opcjonalna/wymagana + katalog) i
realne dane (`cardSets.ts`: katalog + zestawy + „karta nieusuwalna", egzekwowane w UI) — ale pokrywają
**tylko 4 z 7** typów, kod cytuje **nieistniejący** dokument zamiast tego prawdziwego, prawdziwy
dokument jest z 2026-05-01 i **rozjechał się** z kodem, a implementacje są **DWIE równoległe** (Insight/
Task/Decision jedną, Initiative zupełnie inną) bez żadnej specyfikacji, która by je godziła.

---

## 2. TABELA — gdzie jest architektura, a gdzie dziura

| Wymiar | OPISANE? | AKTUALNE? | EGZEKWOWANE? |
|---|---|---|---|
| **1. Wspólna POWŁOKA** (Menu 1, prawy panel, kebab, stany) | **TAK** — `ARTIFACT_ANATOMY_STANDARD.md` §10.2/§11.2/§18.1 + wstawka „AKTUALIZACJA 2026-07-22" (kontrakt Menu 1 wg decyzji D-A…D-D) | **TAK** — edytowany 07-22; niezależny odbiór 7/7 PASS w obu motywach | **CZĘŚCIOWO** — Menu 1+kebab wspólne 7/7 (jeden `NModeHeader`); prawy panel = wspólny KONTENER `ArtifactRightPanel`, ale zestaw sekcji 2–6, „Akcje" tylko w 4/7; kontrakt `StandardArtifactShell` wpięty **0/7**; hook `check-artefakt.sh` pilnuje tylko KOLORU, nie struktury |
| **2. ZAWARTOŚĆ kart** (co AI pisze + próg) | **CZĘŚCIOWO** — systemowo tylko Insight+Initiative; `CARD_CONTENT_FORMULA.md` opisuje per POLE, nie per KARTĘ; reszta wyrywkowa/żadna | **CZĘŚCIOWO/NIE** — Decision = kontrakt-widmo (reguły bez callera); walidatory cytują pliki, których nie ma; jednego SSOT per-karta **brak** — dopiero PLANOWANY (SPEC-N §4 / DEC-010, status „otwarte") | **NIE** — doradcze; twarda brama = tylko brak tytułu + placeholder; progi (KPI, długości, RAID) nie blokują nic |
| **3. DEFAULT vs DODAWALNE** karty | **CZĘŚCIOWO** — `n-mode-card-standard.md` §2/§6/§7 (domyślna/opcjonalna/wymagana + katalog) + `cardSets.ts` (katalog+zestawy+`core`) dla 4/7 | **CZĘŚCIOWO/NIE** — dokument z 2026-05-01, katalog §7 rozjechany z kodem (inne id kart); kod cytuje **widmo** `_WZORZEC_N_KARTY §3.5`; DWA systemy (cardSets vs Initiative `SECTION_REGISTRY`); `INITIATIVE_SPEC` = martwe dane | **CZĘŚCIOWO** — `core`=nieusuwalna wymuszona w UI (`NModeCardManager`), ale tylko dla 3/7 (Insight/Task/Decision); Initiative = własny system; Interview/Tool/Notification = **zero** zarządzania kartami; brak wspólnej bramki |

**Czytanie tabeli jednym zdaniem:** kolumna „OPISANE" jest w większości zielona/żółta — **kolumna
„EGZEKWOWANE" jest w większości żółta/czerwona.** Architektura jest OPISANA; nie jest WIĄŻĄCA.

---

## 3. ★ NAJWIĘKSZA DZIURA

**Nie istnieje jeden EGZEKWOWANY „kontrakt karty".** Czyli: nie ma jednego miejsca — pilnowanego przez
bramkę — które dla każdej karty mówi trzy rzeczy naraz: (1) co ta karta zawiera, (2) próg kompletności
jako LICZBĘ (nie przymiotnik), (3) czy jest domyślna / wymagana / dodawalna.

Dziś te trzy rzeczy leżą w **pięciu** różnych miejscach, każde pokrywa inny wycinek i żadne nie jest
kompletne ani wiążące:
- struktura kart (default/dodawalne) → `cardSets.ts`, ale tylko 4/7 typów, i cytuje nieistniejący dokument;
- treść kart → 3 walidatory w `server/`, ale tylko 2/7 typów, doradczo, też cytują pliki-widma;
- taksonomia (domyślna/opcjonalna/wymagana) → `n-mode-card-standard.md`, ale z 2026-05-01 i rozjechany z kodem;
- powłoka → `ARTIFACT_ANATOMY_STANDARD.md` (dobra) + typ `StandardArtifactShell` (dobry) — wpięty 0/7;
- próba złączenia tego w jeden kontrakt → `_SPEC_N_KARTY` §4 (DEC-010), status **„otwarte", niezaakceptowane**.

**Dlaczego to zaboli najbardziej:** to jest dokładnie różnica między tabelami a kartami, którą sam
kod nazywa (`_SPEC_N_KARTY` :98): *„`StandardTable` nie da się obejść, a `NModeShell` — da się, i obchodzi
go 8 kart na 8."* Tabele się nie rozjeżdżają, bo standard jest KODEM którego nie da się ominąć. Karty się
rozjeżdżają, bo ich kontrakt jest ROZPROSZONYM OPISEM, a nic nie „nie kompiluje się", gdy artefakt zrobi
po swojemu. Dopóki nie ma jednego wiążącego kontraktu karty, „standaryzacja kart" = podejmowanie tych
samych decyzji osobno przy każdym z 7 artefaktów = **każdy artefakt i tak wyjdzie inny.**

---

## 4. CO TRZEBA OPISAĆ ZANIM RUSZY STANDARYZACJA KART (dokumenty, nie kod)

1. **Jeden SSOT per-karta.** Dla KAŻDEGO z 7 artefaktów: lista jego kart, a przy każdej karcie —
   (a) co zawiera, (b) próg kompletności LICZBĄ, (c) rola AI, (d) domyślna/wymagana/dodawalna. Dziś to
   jest rozsiane po 5 miejscach i żadne nie jest pełne.
2. **Rozstrzygnięcie DWÓCH systemów kart.** `cardSets.ts` (Insight/Task/Decision) vs Initiative
   `SECTION_REGISTRY`/`DEFAULT_VISIBLE_SECTIONS` — który jest kanonem i jak schodzimy do jednego. Bez
   tego Initiative (największa karta) rozjeżdża się z resztą **z definicji**, nie przez zaniedbanie.
3. **Kontrakt kart dla 3 sierot.** Interview, Tool, Notification nie mają ŻADNEGO opisu ani zestawu kart,
   ani zawartości. Trzeba je opisać albo świadomie zwolnić — z podanym powodem (jak Notification, klasa S).
4. **Uśmiercenie/przekierowanie dokumentów-widm.** `cardSets.ts` i walidatory odsyłają do
   `_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md §3.5`, którego **nie ma w repo**. Trzeba przepiąć odnośniki
   na żywy SSOT (to jest dokładnie bramka §5.5 z SPEC-N: „dokumentacja ma nie kłamać").
5. **Uzgodnienie `n-mode-card-standard.md` (2026-05-01) z kodem** albo oznaczenie go jako historii. Dziś
   katalog §7 (`outcome`, `acceptance`, `plan`) NIE pokrywa się z `cardSets.ts` (`description-scope`,
   `implementation`…) — dwa różne słowniki kart udające jeden standard.
6. **Zatwierdzenie SPEC-N §4 (DEC-010, kontrakt treści per typ).** Dziś „otwarte". To jest brakujący
   AKT, który zamienia „opis" w „bramkę" — sam SPEC-N to mówi (:305): *„kontrakt bez wpięcia w generację
   jest dokumentem, nie bramką."*
7. **Kanoniczny zestaw sekcji prawego panelu.** Komplet + które wolno redukować i dlaczego (dziś 2–6
   sekcji, „Akcje" tylko 4/7, bez uzasadnienia dla Tool/Interview).

---

## 5. DO DECYZJI PIOTRA

- **P-1. Jeden system kart czy dwa?** Zejść Initiative do `cardSets.ts`, czy uznać jego system
  szablonowy (`visible_sections`) za osobny kanon? Ta jedna decyzja determinuje CAŁĄ standaryzację.
- **P-2. Kontrakt treści (DEC-010) — zatwierdzamy?** „Każda karta N dostaje kontrakt treści, wariant pełny
  albo lekki." Bez tego zawartość kart zostaje dowolna — i tak jest dziś.
- **P-3. Egzekwowanie jak przy tabelach?** Czy kontrakt karty (`StandardArtifactShell`, dziś 0/7) + bramka
  testowa stają się WARUNKIEM wejścia karty na demo — tak jak `StandardTable` dla list? Czy zostaje
  konwencja (czyli akceptujemy, że będzie się rozjeżdżać)?
- **P-4. Trzy sieroty (Interview / Tool / Notification).** Opisujemy ich karty teraz, czy świadomie
  odkładamy — z powodem wpisanym do SSOT?
- **P-5. `n-mode-card-standard.md`.** Aktualizujemy do stanu kodu i czynimy żywym SSOT, czy oznaczamy jako
  historię i budujemy nowy z zatwierdzonego SPEC-N?

---

## 6. CZEGO NIE ZWERYFIKOWANO (uczciwie)

- **Baza:** worktree jest **24 commity za** czubkiem `origin/demo` — różnica mała, ale pojedyncze numery
  linii mogły drgnąć.
- **Wejście:** wynik OSI 2 dotarł do mnie **ucięty** (kończy się na „Decision … ma 0"), a wynik OSI 3 nie
  dotarł wcale — OŚ 3 (default vs dodawalne) **odtworzyłem własnym śledztwem w kodzie**; OŚ 1 dostałem w
  całości. Kluczowe twierdzenia OSI 1/2 sprawdziłem grepem samodzielnie: `StandardArtifactShell` renderowany
  0×, `CardKind = 'insight'|'initiative'`, Decision bez callera walidatora treści — wszystkie potwierdzone.
- **Dwie LICZBY z raportów przyjąłem bez re-runu:** „19/19 kart Insight poniżej progu" i „0/63 podpowiedzi
  podaje próg" pochodzą z wyniku OSI 2 / raportu ART-016 — nie odtwarzałem ich na żywej bazie.
- **Katalog §7** `n-mode-card-standard.md` vs `cardSets.ts` — stwierdziłem rozjazd na PRÓBCE id, nie
  policzyłem różnicy pozycja po pozycji.
- **Treść kart czytana z KODU** (walidatory, `cardSets`, prompty generacji), **nie z żywej bazy demo** —
  harness kart omija serwer (per zastrzeżenie SPEC-N §STAN), więc realny stan rekordów niesprawdzony.
- **Nie uruchamiałem** pełnego `tsc`/`vitest` (zakaz). **Nie audytowałem** wzorca W (SWOT, Mind Map…) —
  poza zakresem.

---

### Aneks — dowody (plik:linia)

- **Powłoka opisana:** `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §10.2/§11.2/§18.1;
  wstawka „AKTUALIZACJA 2026-07-22".
- **StandardArtifactShell 0/7:** `grep '<StandardArtifactShell' src/` = pusto; `src/components/standard/registry.ts`
  — 7 wpisów, wszystkie `statusMigracji: 'przed'` (:93…:151).
- **Hook tylko kolor:** `scripts/check-artefakt.sh` skanuje `primary-*`/`c-accent`, nie strukturę (nagł. l.4-29).
- **Treść tylko 2 typy:** `server/src/services/cardContentFormulaValidator.ts:33` `CardKind = 'insight'|'initiative'`.
- **Decision = kontrakt-widmo:** `cardContentValidator.ts:78-92` definiuje reguły Decision, ale
  `grep validateCardContent server/src/services/decisionService.ts server/src/controllers/DecisionController.ts` = pusto.
- **Default/dodawalne — dane:** `src/components/shared/NModeLayout/cardSets.ts` — `catalog`+`sets`+`core`
  dla `insight|initiative|decision|task` (:32, :580); `core` egzekwowane w `NModeCardManager.tsx` (Remove
  non-core only, ~:363).
- **Wpięte tylko 3/7:** `useCardLayout`/`NModeCardManager`/`AddCardMenu` importują TaskDetailView (:82,:89),
  DecisionDetailView (:93,:100), InsightViewer (:80,:90). Initiative/Interview/Tool/Notification = pusto.
- **Initiative = drugi system:** `InitiativeDocumentView.tsx` używa `SECTION_REGISTRY`/`DEFAULT_VISIBLE_SECTIONS`
  z `./sections/registry.ts` (:138), nie `cardSets`. → `INITIATIVE_SPEC` w `cardSets.ts` = martwe dane.
- **Dokument-widmo:** `find _WZORZEC_N_KARTY*` = brak; mimo to cytowany w `cardSets.ts:26`.
- **Realny, lecz code-osierocony SSOT:** `docs/ui-standards/01-shell-layout/n-mode-card-standard.md`
  (2026-05-01) — cytowany przez CANON.md/README.md/artifact-shell.md, ale przez ŻADEN plik `.ts/.tsx`.
- **Plan złączenia:** `_SPEC_N_KARTY_2026-07-21.md` §2.1 (:140 „★ pytanie Piotra wprost", :152 usuwanie
  „0 z 8"), §4 (:285 DEC-010), §STAN (:59 „`sectionManagement` niewdrożony", :64 „§4 … otwarte").
