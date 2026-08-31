---
doc_id: funkcje-odbior-166
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 166 — domknięcie karty decyzji

**Klasyfikacja rozdzielona: A na czterech częściach, C na zawężeniu klucza pamięci,
B na dyscyplinie licencji.**

Marker `22124537f7`, 2 commity (pierwszy to zapis zasadnego STOP-u na zajętym porcie
5000 — mój błąd w przydziale), 8 plików.

## Co działa — cztery części na A, każda odtworzona niezależnie

**Kolumny ryzyka.** Migracja `20260830_day166_decision_risk_fields.sql` — dwie linie,
wyłącznie `ADD COLUMN IF NOT EXISTS`, zero DROP. Cztery warstwy sprawdzone osobno:
`decision.validators.ts:147-148,157-158` → `DecisionController.ts:2937-2945` →
`decisionCollaborationService.ts:527-546,590-608,663-670` →
`DecisionDetailView.tsx:333-354`.

★ **Znana pułapka NIE zadziałała:** pola są zadeklarowane w schemacie, więc middleware
ich nie wycina. To była moja główna obawa — `alternatives`/`rationale` ginęły
kiedyś dokładnie w tym miejscu.

**RACI — trasa zbudowana, nie usunięty wołacz.** `git show` na markerze potwierdza,
że trasy `/stakeholders` **nie było w ogóle**. Dyżur dodał GET (`decisions.routes.ts:203`)
i PUT (`:206-211`) plus kontroler i serwis. Autoryzacja przez `isDossierEditor`
z walidacją przynależności do organizacji. **Cichy `404` zamknięty.**

**Test jest prawdziwy.** Realny `ApiGateway`, `supertest`, JWT podpisany prawdziwym
sekretem, asercje **surowym SQL** niezależnie od odpowiedzi HTTP, `retry: 0`.
Kontrola rozstrzygająca: po zatrzymaniu kontenera test **pada na `ECONNREFUSED`** —
czyli nie ma cichego zjazdu na sqlite ani atrapę.

**Dwa dowody mutacyjne, w tym jeden ponad raport.** Mutacja `toRiskDTO` → `1 FAIL`
dokładnie na round-tripie ryzyka. **Audytor dorobił drugą, której wykonawca nie miał:**
usunięcie pętli `INSERT` w `replaceDecisionStakeholders` → `1 FAIL` dokładnie na teście
RACI. Oba przywrócone, drzewo czyste.

**Migracja przechodzi od pustej bazy** — `DAY161_FRESH_MIGRATION_GATE=PASS`, 869
migracji, replay `0`. Bramka wpięta wczoraj przez dyżur 167 **właśnie się przydała**.

**Zero zmian wizualnych** — `git diff ... DecisionDetailView.tsx | grep className`
daje zero trafień. Cały diff to logika. Zakaz dotrzymany.

## ★ C — zawężenie klucza NIE zamyka granicy dla danych już zapisanych

Nowe zapisy są izolowane poprawnie:
`consultify-decision-enhancements:<orgId>:<userId>:<decisionId>`. To realny postęp.

**Ale stary, niezawężony klucz jest nadal odczytywany** (`DecisionDetailView.tsx:2422-2428`):

```ts
let raw = localStorage.getItem(storageKey);
if (!raw && currentUser?.id) {
  raw = localStorage.getItem(legacyStorageKey);
  if (raw) { localStorage.setItem(storageKey, raw); localStorage.removeItem(legacyStorageKey); }
}
```

Zapisany obiekt **nie niesie żadnej informacji o właścicielu** — sprawdziłem całą
strukturę: `schemaVersion` i `savedAt`, nic więcej. **Nie ma czym zweryfikować, czyje
to notatki.**

**Skutek:** pierwsza osoba, która po wdrożeniu otworzy dowolną decyzję na tym
komputerze, **bezwarunkowo przejmuje i KASUJE** stary wpis — także jeśli należał do
kogoś innego. Zamieniamy „każdy odczyt to wyciek" na „jednorazowe ciche zawłaszczenie
plus trwała utrata dla pierwotnego autora".

**W programie, którego priorytetem zero jest „użytkownik traci swoją pracę", cicha
trwała utrata jest ceną, której nie wolno zapłacić za zamknięcie wycieku.**

### Warunek domknięcia — mała poprawka, wchodzi do kolejki

Minimalna bezpieczna zmiana: **kopiować bez kasowania** albo **nie czytać starego
klucza w ogóle**. To są dane szkicowe w przeglądarce, nierozstrzygalne co do
właściciela — bezpieczniej zostawić je nietknięte niż przypisać niewłaściwej osobie.

## B — jedno przekroczenie licencji, merytorycznie uzasadnione

`server/src/services/decisionCollaborationService.ts` (~110 linii) **nie był na liście
dozwolonych**, a został zmieniony. Zmiana jest **niezbędna** — bez niej pola ryzyka
i RACI nie dotarłyby do bazy. Nie tknięto żadnego pliku **jawnie zakazanego**:
`DecisionWorkspace.tsx`, `m05DecisionWorkspaceFlag.ts` i wszystkie pliki zadań mają
**zero linii diffu**.

Zarzut jest jeden: **wykonawca nie zgłosił tego jako odstępstwa.** Wymieniał ten plik
w diagnozie, nie w naruszeniach. Uzasadnione przekroczenie zgłoszone wprost jest
w porządku; przemilczane — nie.

**Wina częściowo moja:** licencja wymieniała kontroler i trasy, ale nie serwis, przez
który te dane fizycznie muszą przejść. **To ta sama klasa błędu co w 167** — tabela
licencji nie obejmowała pliku, którego wymagała treść merytoryczna. **Drugi raz dziś.**

## Drobiazg niezgłoszony

Debounced `useEffect` (`:2507-2515`) wysyła `PUT /stakeholders` **przy każdym
załadowaniu strony**, także z danymi demo o fikcyjnych identyfikatorach. Walidacja
odrzuca nieznanych użytkowników **przed** `DELETE`, więc **utraty danych nie ma** —
ale w sesji demo leci cichy `console.error` przy każdym otwarciu karty.

## Czego NIE zweryfikowano

- **Realnego scenariusza dwóch sesji** (login A → zapis → wylogowanie → login B)
  w przeglądarce — wykonawca przyznał to sam jako częściowe; audyt potwierdził
  wyłącznie czytaniem kodu.
- Zrzutów ekranu — brak zmian `className` w diffie zamiast oglądu.
- Zachowania frontu przy `403`/`404` z nowej trasy w warunkach brzegowych.
- Sum kontrolnych artefaktów wykonawcy — audytor zrobił własne przebiegi zamiast tego.

## Werdykt

**Do scalenia.** Cztery części na A z niezależnie odtworzonymi dowodami, w tym
mutacja dorobiona ponad raport. Karta decyzji **przestała gubić ryzyka i RACI**.

**Ale nie jest domknięta.** Zawężenie klucza wchodzi na **C** i wraca jako mała
poprawka: przejęcie starych notatek ma przestać je kasować.
