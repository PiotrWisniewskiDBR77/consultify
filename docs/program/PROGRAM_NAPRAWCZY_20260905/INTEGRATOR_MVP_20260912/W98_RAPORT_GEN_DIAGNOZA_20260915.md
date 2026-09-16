# RAPORT-GEN — diagnoza dwóch błędów (Wpis 98)

**Werdykt:** oba błędy mają odtworzony, jednoznaczny mechanizm; zgodnie z Wpisem 98 paczka zatrzymuje się przed kodem produkcyjnym.

## 1. Assessment: `Create draft` kończy się `Assessment not found`

### Zmierzony przewód

1. `AssessmentHub` buduje kanoniczny wiersz DRD z Method Core i nadaje mu `id = method_sessions.id` (`src/components/assessment/AssessmentHub.tsx:305-350`). Legacy bliźniak z tabeli `assessments` służy tylko do uzupełnienia pól prezentacyjnych (`src/components/assessment/AssessmentHub.tsx:736-771`).
2. `NewAssessmentReportModal` wybiera po `assessment.id`, a następnie przekazuje tę samą wartość jako `sourceId` do `POST /report-builder` (`src/components/assessment/modals/NewAssessmentReportModal.tsx:57-79,198-215`).
3. Report Builder dla `sourceType=ASSESSMENT` odczytuje wyłącznie tabelę `assessments` (`server/src/services/reportBuilderService.ts:468-505,644-681,983-986`). Id sesji Method Core nie istnieje w tej tabeli, więc `getAssessmentSourceData` zwraca `null`, a serwis rzuca `Assessment not found`.

### Przyczyna

UI przekazuje identyfikator kanonicznej sesji Method Core do kontraktu generatora, który akceptuje identyfikator legacy `assessments`. To błąd typu identyfikatora, nie brak danych użytkownika.

### Rekomendowana naprawa po zdjęciu HOLD

W projekcji kanonicznego wiersza należy jawnie zachować osobne `reportSourceId` z dopasowanego legacy bliźniaka. Kreator powinien:

- pokazywać wyłącznie zatwierdzone źródła z rzeczywistym `reportSourceId`,
- wysyłać `reportSourceId`, nigdy `method_sessions.id`,
- nie zgadywać powiązania bez legacy bliźniaka; taki wiersz ma uczciwy stan braku dostępnego źródła raportu.

Docelowy generator natywny dla Method Core byłby zmianą kontraktu Report Builder i wymaga osobnej decyzji. Nie należy jej ukrywać w poprawce tego defektu.

## 2. Audits: `Generate` zwraca 403 dla OWNER organizacji

### Zmierzony przewód

1. Generator raportu wymaga `report.draft` przed odczytem wyniku (`server/src/services/audits/reportService.ts:135`).
2. `program_owner` ma `report.draft` (`server/src/services/audits/permissions.ts:94-121`).
3. Platformowa rola `owner` jest uznawana za administratora (`server/src/services/audits/permissions.ts:270-277`), ale `PLATFORM_ADMIN_CAPABILITIES` celowo nie zawiera `report.draft` (`server/src/services/audits/permissions.ts:236-245`).
4. `resolveProgramAccess` dodaje OWNER wyłącznie capability z tej wąskiej listy (`server/src/services/audits/permissions.ts:295-309`). OWNER bez wpisu `audit_program_members` jako `program_owner` kończy więc na 403.

### Przyczyna

Rola OWNER organizacji nie jest właścicielem konkretnego programu audytowego w macierzy audytów. UI pozwala dojść do generatora, ale serwis wymaga roli programowej.

### Rekomendowana naprawa po zdjęciu HOLD

Jeżeli decyzja produktu brzmi „OWNER organizacji może tworzyć szkic raportu z istniejącego wyniku”, należy dodać wyłącznie `report.draft` do uprawnień OWNER. Nie należy przy okazji przyznawać `report.approve`, `report.publish`, pracy na dowodach ani ustaleniach. Alternatywą jest obowiązkowe automatyczne przypisanie OWNER do każdego programu; to szersza zmiana członkostwa i nie jest potrzebna do naprawy tego 403.

## Dowód diagnostyczny

Na świeżej lokalnej bazie PostgreSQL wykonano 922 migracje. Tymczasowy prototyp, usunięty przed commitem zgodnie z HOLD, potwierdził obie hipotezy:

- Assessment: 2/2 testy komponentu — wysłanie legacy id i ukrycie kanonicznej sesji bez źródła raportu;
- Audits RealPG: 3/3 — istniejący łańcuch `program_owner` oraz przypadek OWNER organizacji bez roli audytowej;
- łącznie 3 pliki / 6 testów PASS; esbuild 3/3 PASS.

Te wyniki dowodzą wykonalności proponowanych zmian, ale nie są dostawą kodu. Finalna delta tej paczki zawiera tylko ten dokument.

## STOP

Brak zmian produktu, serwera, migracji, flag, stagingu i deployu. Implementacja czeka na publikację decyzji przewidzianej w Wpisie 98.
