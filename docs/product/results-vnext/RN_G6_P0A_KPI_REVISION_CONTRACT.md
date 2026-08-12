# P0-A — kontrakt kolejnej wersji definicji KPI

> Projekt kontraktu wykonany przez orkiestratora (Opus). To jest **defekt modelu
> domenowego**, nie kosmetyka UI, dlatego kontrakt powstaje przed implementacją.
> Implementację wykonuje Sonnet ściśle wg tego dokumentu.

## 1. Zdiagnozowany stan

W całym `server/src/services/resultsVnext/` istnieje **dokładnie jeden**
`INSERT INTO rvn_kpi_definition_versions` — w `createKpiDraft`
(`kpiDefinitionCommands.ts:319`). Eksportowane komendy definicji:
`createKpiDraft` · `editDraft` · `submitDefinition` · `approveDefinitionVersion`
· `rejectDefinitionVersion` · `activateKpi` · `suspendKpi` · `archiveKpi`.

Skutek dzisiaj:

| Krok | Stan wersji | Stan rekordu głównego |
|---|---|---|
| utworzenie | `draft` v1 | `draft` |
| zgłoszenie | `submitted` v1 | `pending_approval` |
| **odrzucenie** | **`rejected` v1 (terminalny)** | `draft` |
| próba edycji | **BŁĄD** — `editDraft` wymaga `approval_status='draft'` NA WERSJI | — |

Nie istnieje żadna droga do wersji 2. **KPI zostaje trwale zablokowane.**
Komentarz w kodzie twierdzi, że KPI „can be edited and resubmitted" — to
nieprawda i trzeba go poprawić razem z implementacją.

## 2. Kluczowe ustalenie: MIGRACJA NIE JEST POTRZEBNA

`rvn_kpi_definition_versions` (`server/migrations/20260810_rvn_kpi_core.sql:110`)
już dziś obsługuje wiele wersji na jedno KPI:

- `definition_version_id` UUID PK — każda wersja ma własną tożsamość;
- `version_number INT NOT NULL` + `UNIQUE (kpi_id, version_number)` — numeracja
  kolejnych wersji jest przewidziana w schemacie;
- `approval_status` ∈ `draft|submitted|approved|rejected`;
- `created_by` / `submitted_by` / `approved_by` / `rejected_by` / `rejected_at`
  — pełny ślad audytowy per wersja;
- `row_version INT NOT NULL DEFAULT 1` — optymistyczna współbieżność per wersja;
- `ux_rvn_kpi_definition_versions_approved_no_overlap` — **wersje `draft`,
  `submitted` i `rejected` NIE uczestniczą** w tym ograniczeniu, więc obecność
  odrzuconej wersji obok nowej roboczej jest legalna;
- wyzwalacz `rvn_kpi_definition_versions_protect_approved()` chroni wersje
  zatwierdzone przed modyfikacją.

**Model danych jest poprawny. Brakuje wyłącznie komendy.** To dobra wiadomość:
naprawa jest addytywna po stronie kodu i zerowa po stronie schematu.

## 3. Kontrakt nowej komendy

Nazwa w konwencji pliku: **`reviseDefinition`**.

### Warunki wstępne
1. KPI istnieje i aktor je widzi (istniejąca ścieżka widoczności).
2. Wersja wskazana przez `definitionVersionId` ma `approval_status = 'rejected'`.
   - `approved` → odmowa. Zmiana zatwierdzonej definicji to inne zagadnienie
     cyklu życia, **poza zakresem tego kontraktu**.
   - `draft` → odmowa. Nie ma czego poprawiać, jest `editDraft`.
   - `submitted` → odmowa. Najpierw musi zapaść decyzja recenzenta.
3. Optymistyczna współbieżność: `expectedVersion` porównywane z `row_version`
   **odrzuconej wersji**. Niezgodność → istniejący błąd konfliktu, nie nowy typ.
4. **Autoryzacja przez `assertCommandCapability`** (strażnik RN-G5), z
   identyfikatorami osób odpowiedzialnych wziętymi z rekordu KPI. Odmowa =
   generyczne 403, bez ujawniania istnienia obiektu (D06).

### Skutek
Dokładnie jeden `INSERT` do `rvn_kpi_definition_versions`:

- `definition_version_id` — nowy UUID;
- `kpi_id`, `organization_id` — z wersji odrzuconej;
- `version_number` = `MAX(version_number) + 1` dla tego `kpi_id`, policzone
  **w tej samej transakcji**, pod blokadą wiersza rekordu głównego (inaczej dwa
  równoległe wywołania złamią `UNIQUE (kpi_id, version_number)`);
- **wszystkie pola merytoryczne skopiowane z wersji odrzuconej** — nazwa, opis,
  jednostka, geometria celu, wartości progowe, `binary_success_value`.
  To jest sedno: recenzent powiedział, co jest źle, więc właściciel poprawia
  **wypełniony formularz**, a nie pusty. Kopiowanie jest wymogiem, nie wygodą;
- `approval_status = 'draft'`;
- `created_by` = aktor;
- `submitted_by`, `approved_by`, `rejected_by`, `rejected_at` = `NULL`;
- `row_version = 1`.

### Czego komenda NIE robi — wymogi negatywne
1. **NIE dotyka wiersza wersji odrzuconej.** Zero `UPDATE`. Wersja odrzucona
   zostaje na zawsze `rejected`, ze swoim `rejected_by` i `rejected_at`.
   Reaktywacja odrzuconej wersji jest zabroniona.
2. **NIE omija zatwierdzania.** Nowa wersja jest `draft` i musi przejść
   `submitDefinition` → `approveDefinitionVersion` normalną drogą.
3. **NIE znosi maker-checkera.** `SelfApprovalDeniedError` obowiązuje tak samo
   dla wersji 2: kto ją utworzył albo zgłosił, ten jej nie zatwierdza.
4. **NIE tworzy dwóch wersji przy podwójnym kliknięciu** — klucz idempotencji,
   ten sam wzorzec co pozostałe komendy definicji.
5. **NIE zmienia stanu rekordu głównego na `pending_approval`** — to robi
   dopiero zgłoszenie.

### Rekord główny
`rvn_kpi_definitions.current_definition_version_id` — implementujący ma
**odczytać z kodu**, czy wskazuje wersję zatwierdzoną (semantyka odczytu), czy
najnowszą (semantyka edycji), i zachować istniejącą regułę. Jeżeli
`createKpiDraft` ustawia je na nowo utworzoną wersję, `reviseDefinition` ma
zrobić to samo. **Nie zgadywać — sprawdzić i zacytować plik:linia w raporcie.**

## 4. Historia, którą użytkownik ma zobaczyć

```
v1  utworzona    →  zgłoszona  →  ODRZUCONA (kto, kiedy, powód)
v2  utworzona z v1  →  zgłoszona  →  zatwierdzona (kto, kiedy)
```

Obie wersje pozostają widoczne i audytowalne. Zimne otwarcie zachowuje pełną
historię.

## 5. Testy obowiązkowe

Na realnym PostgreSQL, nie na mocku:

1. utworzenie KPI + wersji 1;
2. zgłoszenie wersji 1;
3. recenzent odrzuca wersję 1;
4. właściciel tworzy wersję 2 — **`INSERT`, nie `UPDATE`**;
5. wersja 2 ma pola skopiowane z wersji 1;
6. właściciel edytuje wersję 2;
7. właściciel zgłasza wersję 2;
8. recenzent zatwierdza wersję 2;
9. **wersja 1 nadal `rejected` i BAJTOWO niezmieniona** — porównać cały wiersz
   przed i po, nie tylko status;
10. wersja 2 `approved`;
11. rejestr, szczegóły i historia pokazują poprawne stany;
12. **aktor bez uprawnień NIE tworzy wersji 2** (403, generyczny powód);
13. **aktor z innej organizacji nie dostaje niczego** — asercja po
    `organizationId` na każdym wierszu, przez publiczną ścieżkę;
14. **samo-zatwierdzenie wersji 2 nadal zabronione**;
15. próba `reviseDefinition` na wersji `approved` / `draft` / `submitted` →
    odmowa, każda osobno;
16. **podwójne wywołanie z tym samym kluczem idempotencji tworzy JEDNĄ wersję**;
17. **dwa równoległe wywołania nie łamią `UNIQUE (kpi_id, version_number)`**;
18. zimne otwarcie (świeży klient) zachowuje wynik.

**Kontrola negatywna obowiązkowa** dla punktów 9, 12 i 16: zepsuć asercję,
potwierdzić czerwień, cofnąć.

## 6. Czego NIE wolno zrobić

- Nie maskować problemu zmianą tekstu ani ukryciem przycisku.
- Nie pozwalać na edycję wersji odrzuconej „w miejscu".
- Nie kasować ani nie nadpisywać wersji odrzuconej.
- Nie dodawać migracji — schemat już to obsługuje.
- Nie wprowadzać nowego stanu `approval_status`.
