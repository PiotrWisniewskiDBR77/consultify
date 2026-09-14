# F2-3 PMO E2 — independent skeptical review

**Werdykt: HOLD. Zakres kodu E2 nie jest jeszcze akceptowalny: dwa wymagania wykonawcze nie są spełnione, a obowiązkowego dowodu przeglądarkowego nie ma.**

Przegląd wykonano 2026-09-13 na gałęzi `codex/pmo-projekty-role-statusy-20260913`, HEAD i baza `ba25e564592f4a803ecf53edf81b7d8c84524426`. Autor nie dostarczył jeszcze commitu E2, dlatego przedmiotem przeglądu jest dokładnie zamrożony zestaw 21 plików opisany przez `MANIFEST_SHA256.txt`, a nie SHA commitu.

## Ustalenia blokujące

### P1 — zapisy zespołu i komunikacji nie mają domyślnie egzekwowanej autoryzacji capability

Nowe UI wywołuje zapisy członków i planu komunikacji, lecz trasy `POST/PATCH /:id/members` i `PUT /:id/notification-settings` używają `requireAnyProjectCapability(..., { shadow: true })` (`server/src/routes/pmo/projects.routes.ts:179-198,276-285`). Implementacja middleware dokumentuje i realizuje, że przy domyślnym `CAPABILITY_ENFORCE=shadow` taka bramka **nigdy nie blokuje** i zawsze wywołuje `next()` (`server/src/middleware/effectiveCapability.middleware.ts:24-31,87-93,241-245`). Kontrolery sprawdzają organizację projektu i aktywne członkostwo dodawanej osoby, ale nie sprawdzają uprawnienia aktora (`server/src/controllers/ProjectController.ts:1192-1262,1312-1395,595-648`).

Skutek: po włączeniu ekranu każdy uwierzytelniony członek organizacji, który zna `projectId`, może zmieniać zespół, role, alokacje i plan komunikacji; telemetria `wouldAllow=false` nie jest odmową. Świeży bieg RealPG potwierdził, że wykonywany tryb to `mode:"shadow"`. E2 wymaga capability authorization, więc scoped ACCEPT jest przedwczesny. Naprawa powinna użyć per-route enforcement (`enforceMode: 'enforce'`) i dodać negatywny przypadek Gateway/JWT/PG: aktor bez wymaganej capability dostaje 403 i SQL pozostaje bez zmian. Nie należy globalnie przełączać 142 bramek.

### P1 — DEC-480 nie da się utrzymać dla istniejącego członka z poziomu produktu

Lista pokazuje `allocationPercent` i formularz ustawia wartość tylko podczas dodawania osoby (`src/components/MyWork/MyProjects.tsx:618-632,647-658,1509-1565`). Klient `Api.updateProjectTeamMember` istnieje (`src/services/api.ts:3619`), ale nie ma żadnego konsumenta w repo. Nie ma akcji wiersza ani edytora istniejącej alokacji/roli.

Skutek: omyłkowej lub zmienionej deklaracji procentowej per osoba nie da się poprawić w ekranie budowania zespołu; użytkownik musi ominąć produkt i wołać API. To nie spełnia własnego planu E2 „pokazywać i edytować per osoba” ani praktycznego wymagania ustawiania zespołu i ról. Potrzebny jest edytor istniejącego członka przez kanoniczny wiersz/preview, test zachowania oraz SQL readback zmienionej wartości.

### P1 — brak obowiązkowego dowodu przeglądarkowego i odbioru wizualnego

Freeze jawnie mówi, że nie ma zrzutów ani visual acceptance. Nie ma dowodu z **zbudowanego frontu** dla 1440×900 w jasnym i ciemnym motywie, stanów pusty/ładowanie/brak uprawnień/rola bez obsady ani `bledyKonsoli=0`. Bez tego nie da się sprawdzić artefaktu projektu SPEC-A, rzeczywistego montowania `StandardTable`/`StandardPreview`, focusu, przewijania i zachowania formularzy. Pełne E2 pozostaje HOLD niezależnie od zielonych testów źródłowych.

## Ustalenia P2

### P2 — opisy „może/nie może” wyświetlają identyfikatory techniczne i nie mają tłumaczenia PL

`CANONICAL_PMO_ROLES` przechowuje `can/cannot` jako techniczne slug-i, np. `approve-business-case`, a UI renderuje je bez mapowania (`server/src/domain/pmo/projectOperatingModel.ts:20-77`; `src/components/MyWork/MyProjects.tsx:1620-1623,1644-1646`). W polskim interfejsie nagłówki są polskie, lecz właściwy opis uprawnień pozostaje angielskim identyfikatorem z łącznikami. Role mają prawidłowe etykiety i opisy EN/PL, ale część „co może / czego nie” nie jest ludzkim opisem w obu językach.

### P2 — test UI potwierdza napisy w źródle, a nie zachowanie

`MyProjects.pmoE2.contract.test.ts` sprawdza `toContain()` na surowym pliku. Nie dowodzi, że użytkownik może utworzyć projekt, dodać osobę, zobaczyć opis roli, zapisać komunikację ani że dane są odświeżone. Ten test może pozostać pomocniczy, ale nie zastępuje testu interakcji ani Playwrighta.

## Co zostało potwierdzone

- SHA-256 `MANIFEST_SHA256.txt`: `3c94843da60b36ad9426c303b38f07ad8352aefb443bd5fae9b8e909d8f445bb`.
- Wszystkie 21 wpisów manifestu: `OK`; przed przeglądem nie było driftu.
- Pełny zestaw zmian względem bazy obejrzany, w tym pliki nieśledzone; `git diff --check` bez błędów.
- Świeży niezależny targeted run: 3 pliki, 8/8 PASS.
- Świeży niezależny ApiGateway + JWT + PostgreSQL 18 (`127.0.0.1:6458/f23_e1`): 4/4 PASS; po biegu `organizations=0`, `projects=0`, `users=0` dla fixture'ów E2.
- Tenant isolation w przetestowanych ścieżkach jest realna: obca osoba nie może zostać członkiem projektu, a obca organizacja dostaje 404 na operating-model. Zapytania kontrolerów ograniczają projekt po `organization_id`.
- SPEC-A tworzenia projektu zapisuje i czyta z PG: nazwa/opis/cel/status/owner/metodyka/daty/budżet/waluta. Nie powstała migracja.
- Model ma pięć ról DEC-488, w tym `STEERING_COMMITTEE`; capacity jest liczone per osoba; odpowiedzialności, komunikacja i `approvalInputs.roleBindings` są deterministycznie wyprowadzane z ról. Nie ma zapisu polityki E4 ani drugiego magazynu.
- `/projects`: warunek ma dokładny kształt `import.meta.env.VITE_PMO_PROJECTS === 'true'`; brak/inna wartość daje redirect `/my-work`; nie dodano pozycji menu głównego.
- Listy projektu i zespołu korzystają z `StandardTable`, ekran z `StandardModuleBar` i `StandardPreview`; `check-list-canon.sh --all` nie wykrył nowego długu (322 wobec baseline 357). `check-artefakt.sh --report` nie wykrył nowej regresji (8 wobec baseline 8).
- Frontend TypeScript: 866 linii na bazie i 866 na kandydacie, pliki byte-identical, SHA-256 `47bd5cef37ba70021bf6936106633cfd6ed97f64514f8b3dc9fc86375d3b68a5`; diagnostyki nazwujące ścieżki E2: 0. To neutralna delta, nie zielony typecheck repo.

## Warunki ponownego przeglądu

1. Egzekwować capability per nowe zapisy i udowodnić 403 + brak mutacji SQL dla aktora bez capability.
2. Dodać edycję roli oraz DEC-480 allocation istniejącej osoby i udowodnić zapis/odczyt PG.
3. Zastąpić techniczne slug-i widocznymi opisami EN/PL.
4. Dostarczyć pełny browser acceptance na dokładnym zbudowanym artefakcie, ze zrzutami i zerem błędów konsoli.
5. Wygenerować nowy freeze manifest po poprawkach i poddać go świeżemu niezależnemu przeglądowi.
