# SHARED CONTRACT MANIFEST — Method Kernel

> **Adresaci: zespoły Tools i Audits.** To jest jedyny dokument, który musicie
> przeczytać, żeby budować na wspólnym kernelu.
>
> Właściciel kontraktu: zespół **Assessment / Shared Method Core**.
> Koordynator programu: **Codex**.

---

## 1. Numer commita kontraktu

| Pole | Wartość |
| --- | --- |
| **Contract SHA** | `e3b8be6cd706e2b563c84d0b5980f91d0eb8de5c` |
| Branch | `codex/method-assessment-core-20260813` |
| Baseline | `f3e7df565e` (== `origin/demo`) |
| Data zamrożenia | 2026-08-13 |
| Stan | **ZAMROŻONY** dla powierzchni publicznej |

Bramka jakości kontraktu:
`npx tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck src/method-core/contracts/*.ts` → **exit 0**.

Zmiana czegokolwiek z rozdziału 3 wymaga noty `COORDINATION_REQUIRED` do Codexa
**przed** zmianą, nie po.

---

## 2. Zasada nadrzędna

**Kernel nie zawiera ani jednej reguły DRD, SIRI, ADMA ani standardu audytowego.**

Kernel wie, że istnieją jednostki oceny, poziomy, dowody, propozycje i decyzje.
Nie wie, że DRD ma 7 osi, że SIRI ma Bandy 0–5, ani że jakiś audyt ma klauzule.
Cała ta wiedza wchodzi przez `MethodAdapter`.

W kernelu nie wolno napisać `if (method === 'drd')`. Jeśli czujesz taką potrzebę,
to znaczy, że brakuje członka w `MethodAdapter` — zgłoś to, nie obchodź.

---

## 3. Ścieżki publicznych typów

Importujecie **wyłącznie** z barrel-a. Nic głębiej nie jest kontraktem.

```ts
import type { MethodSession, MethodEvent, MethodAdapter } from '@/method-core/contracts';
```

| Plik | Zawartość publiczna |
| --- | --- |
| `src/method-core/contracts/index.ts` | **jedyny dozwolony punkt importu** |
| `src/method-core/contracts/events.ts` | model zdarzeń, siła dowodu E0–E4 |
| `src/method-core/contracts/session.ts` | maszyna stanów, role procesu, save-state |
| `src/method-core/contracts/methodPack.ts` | rejestr packów + granica adaptera |
| `src/method-core/contracts/teresa.ts` | Intent → Preview → Commit |

Import z `src/method-core/` **poza** `contracts/` jest wewnętrzny i może się
zmienić bez uprzedzenia.

---

## 4. Eventy — zbiór zamknięty (18)

```
ANSWER_DRAFTED · ANSWER_CONFIRMED · ANSWER_REVISED · NOTE_ADDED
EVIDENCE_ATTACHED · EVIDENCE_VERIFIED
TERESA_PROPOSAL_CREATED · TERESA_PROPOSAL_ACCEPTED · TERESA_PROPOSAL_REJECTED
DECISION_PROPOSED · DECISION_APPROVED · DECISION_SENT_BACK
ARTIFACT_UPDATED · ARTIFACT_REORGANIZED
OUTPUT_CREATED · OUTPUT_APPROVED · REPORT_REQUESTED · INITIATIVE_PROPOSED
```

Reguły, które obowiązują wszystkie trzy moduły:

1. **Append-only.** Nic nigdy nie aktualizuje ani nie kasuje eventu.
   Korekta to **nowy** event z polem `supersedes`.
2. **Każdy event jest org-scoped.** `organizationId` jest wymagane bez wyjątku.
3. **Każdy event niesie `methodPackVersion`.** Bez tego historia przestaje być
   odtwarzalna po podbiciu wersji metody.
4. **`idempotencyKey` jest kontraktem, nie optymalizacją.** Ten sam klucz
   w tej samej sesji = ten sam wynik i **zero** drugiego wiersza.
5. **`actorKind` ≠ `actorUserId`.** Gdy człowiek akceptuje propozycję Teresy,
   aktorem jest człowiek, ale autorstwo AI pozostaje widoczne. Nie zlewajcie
   tych pól.

Jeśli Waszemu modułowi brakuje eventu — **nie dodawajcie własnego**. Znaczenie
domenowe niesie `payload` za Waszym adapterem. Nowy typ eventu = nota do Codexa.

---

## 5. Maszyna stanów sesji

```
draft → prepared → active → in_review → frozen → closed → archived
```

Dwie reguły, które łatwo złamać przez nieuwagę:

- **`frozen` NIE jest stanem terminalnym.** `frozen → active` jest legalne
  i tworzy **nową rewizję**. Zamrożony snapshot nigdy nie jest edytowany
  w miejscu. Kto to złamie, złamie odtwarzalność historii.
- **Nie ma ścieżki do `frozen` z pominięciem `in_review`.** Wynik nie zamraża
  się bez ludzkiego przeglądu.

Statusy domenowe (`Evidence pending`, `Sampling`, `Consolidation`, …) **nie są**
dodatkowymi stanami. Są sub-etapami w polu `domainStage` i **mapują się** na
powyższe siedem. Nie rozszerzajcie `METHOD_SESSION_STATES`.

Uprawnienie do przejścia opisuje `TRANSITION_AUTHORITY`. Freeze może wykonać
wyłącznie `approver`.

---

## 6. Interfejs adaptera — tu wchodzi Wasza metoda

```ts
interface MethodAdapter {
  methodPackId: string;
  loadPack(version): Promise<MethodPack>;
  resolveOpenLevels(input): ProgressionResult;   // progresja, no-leapfrog, prerequisites
  computeScore(input): ScoringResult;            // DETERMINISTYCZNY, zero LLM
  aggregate(input): AggregationResult;           // jawna, wersjonowana reguła
  prioritise?(input): PrioritisationResult;      // opcjonalne, tylko po freeze
}
```

Cztery twarde reguły dla każdego adaptera:

1. **`computeScore()` nie może wywołać LLM.** Scoring jest deterministyczny
   i pochodzi z wersji packa. LLM proponuje, silnik liczy.
2. **Brak dowodu → `needs_evidence`, nigdy `0`.** Zero to wynik pomiaru,
   nie brak pomiaru.
3. **`aggregate()` musi zwrócić `mappingVersion` i `rule`.** Nieopisana średnia
   arytmetyczna jest defektem, nie agregacją — mamy na to udokumentowany
   precedens w tym repo.
4. **`prioritise()` przyjmuje wyłącznie zamrożone poziomy.** Priorytetyzacja
   na niezatwierdzonych propozycjach jest zakazana.

Metoda, która czegoś jeszcze nie może uczciwie dostarczyć (brak licencji, brak
treści), zwraca `AdapterCapability` z `{ supported: false, reason:
'EVIDENCE_MISSING' | 'NOT_LICENSED' }`. **Zgadywanie treści metodyki jest
zakazane** — jawna luka jest wymagana.

---

## 7. Teresa — jedna warstwa dla rozmowy i dla przycisków

Cykl: **Intent → Preview → Human confirmation → Commit → Settle.**

Kontrakt jest tak zbudowany, że **commit bez preview jest niereprezentowalny**:
`TeresaCommitRequest` wymaga `previewId`. Dodatkowo kernel odrzuca commit, gdy
preview wygasł, został już skonsumowany albo ma werdykt `invalid`.

**Zasada antyduplikacyjna:** przycisk lokalny i rozmowa **muszą** trafiać do tej
samej capability z `TERESA_CAPABILITIES`. Dwie implementacje tej samej czynności
to dwie prawdy — jest to jawnie zakazane przez kanon.

`TERESA_FORBIDDEN_EFFECTS` jest listą **danych**, nie komentarzem — ma na sobie
test. Teresa nigdy nie zatwierdza score, nie zamraża, nie publikuje, nie
rejestruje inicjatywy i nie tworzy dowodu.

---

## 8. Zasady migracji

1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT
   EXISTS`. Zero `DROP`, zero `ALTER` istniejących kolumn, zero `DELETE`.
2. Migracje idą **bezpośrednio** do `server/migrations/`.
   Runner `server/scripts/migrate.postgres.ts` jest **nierekurencyjny** —
   cokolwiek położycie w podkatalogu (np. `never-ran/`, 158 plików) **nigdy nie
   zostanie uruchomione**. To nie jest teoria: sprawdzone na tym baseline.
3. Każda tabela kernela jest **org-scoped** (`organization_id NOT NULL`).
4. Migracji **nie uruchamiamy na żywej bazie** w ramach tej fali.
5. Jeśli liczycie hash treści — **sortujcie w pamięci przed serializacją**, nie
   przez `ORDER BY` w SQL, i nie wrzucajcie floatów do konkatenacji. Repo ma
   udokumentowany przypadek, gdzie to dało 6–7 różnych hashy z 10 przebiegów.

---

## 9. Pliki wyłącznej własności zespołu Assessment / Core

Nie edytujcie ich. Potrzebna zmiana → nota do Codexa.

| Ścieżka | Uwaga |
| --- | --- |
| `src/method-core/**` | cały kernel i adaptery metod |
| `src/services/drdStructure.ts` | struktura DRD — **zweryfikowana jako zgodna z kanonem** |
| `src/services/siriStructure.ts` | struktura SIRI — przedmiot otwartego COORD-02 |
| `src/services/admaStructure.ts` | struktura ADMA |
| `server/src/method-core/**` | runtime kernela po stronie serwera |
| `server/migrations/20260813_method_core_*.sql` | migracje kernela |

**Uwaga dla Audits:** kanon (`10_ASSESSMENT_REVIEW.md` §18.8) żąda wprost
„DRD/SIRI usunięte z własności Audits", a §17 notuje, że „DRD report bywa
opisany i routowany jako Audit". Jeśli dziś czytacie te pliki bezpośrednio —
zgłoście to, dostaniecie adapter. Nie edytujcie ich równolegle.

---

## 10. Instrukcja dla Tools i Audits — od czego zacząć

1. Przeczytajcie `src/method-core/contracts/index.ts` — to cała powierzchnia.
2. Zmapujcie swój lifecycle domenowy na 7 stanów kernela. Stan, który się nie
   mapuje, to prawie zawsze sub-etap → `domainStage`, nie nowy stan.
3. Zaimplementujcie własny `MethodAdapter`. Zacznijcie od `loadPack()`
   i `resolveOpenLevels()`; `prioritise()` jest opcjonalne.
4. Podłączcie swoje akcje AI do `TERESA_CAPABILITIES` — **nie twórzcie własnego
   rejestru capabilities**.
5. Emitujcie eventy z zamkniętej listy. Znaczenie domenowe w `payload`.
6. Migracje wyłącznie addytywne, bezpośrednio w `server/migrations/`.

Czego **nie** musicie robić: własnego katalogu osób, własnej historii wersji,
własnego systemu zadań, własnego shellu save/exit. To wszystko jest wspólne —
kanon nazywa duplikowanie tych rzeczy wprost defektem
(`ASSESSMENT_WORKBENCH_SYSTEM_CONTRACT.md` §6).

---

## 11. Otwarte punkty koordynacyjne wpływające na ten kontrakt

| ID | Temat | Wpływ na kontrakt | Blokuje? |
| --- | --- | --- | --- |
| COORD-01 | Nazwy pięciu powierzchni (`Processes` vs `Sessions`, `Deliverables` vs `Reports`) | tylko etykiety UI, **zero** wpływu na typy | NIE |
| COORD-02 | SIRI 8D → 16D + wydzielenie TIER | dotyczy adaptera SIRI, **nie** kernela | NIE |
| COORD-03 | Właścicielstwo plików struktur metodyk | rozdział 9 tego dokumentu | NIE |
| COORD-04 | Baza: `origin/demo` vs gałąź integracyjna | wspólny SHA dla trzech zespołów | NIE |

Pełna treść: [`COORDINATION.md`](COORDINATION.md).
Dowody i pomiary: [`EVIDENCE_LEDGER.md`](EVIDENCE_LEDGER.md).
