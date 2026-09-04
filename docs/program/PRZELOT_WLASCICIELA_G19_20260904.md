---
doc_id: program-przelot-wlasciciela-g19-20260904
status: gotowy-do-uzycia-po-weryfikacji-wersji
data: 2026-09-04
wygasa: 2026-09-11
sha: 2a7273e087cbd3e44344725b524f6ddd79d5badc
---

# Przelot właściciela G19 — dziewięć modułów kubełka C

Cel: sprawdzić, czy na zmienionych od odbioru ścieżkach wystąpiła regresja (`G19`), a nie wykonać odbiór przed/po naprawach (`G16`). Pakiet obowiązuje na SHA `2a7273e087cbd3e44344725b524f6ddd79d5badc`, wystawiono 04.09.2026, wygasa 11.09.2026; później wynik wymaga odświeżenia zgodnie z `DEC-392`. Czas: około **45–60 minut**.

Pakiet **nie potwierdza wersji stagingu**. Spór `1c4b5a5635` kontra `fb6547b7d0` pozostaje otwarty; przed przelotem nadzorca ma potwierdzić, że badane środowisko odpowiada SHA pakietu. Bez tego nie wpisuj wyniku G19.

## Zanim zaczniesz

- Zaloguj się kontem odbiorowym. Nie zmieniaj flag i nie używaj rekordów pokazowych.
- PL↔EN oraz jasny↔ciemny przełącz tylko raz podczas całego przelotu.
- Jeśli wymaganej sekcji nie widać, zanotuj „wejście niewidoczne” i przejdź dalej.

## Jak zgłaszać uwagę

Jedna linia: **moduł · ekran · co widzę · czego oczekiwałem · zrzut**.

## Czego NIE zgłaszaj nigdy

- Rzeczy świadomie odłożonych do fali 2 z `docs/program/FALA_2_PO_STAGINGU.md` (`DEC-2026-09-03-354`…`383`).
- Pięciu etapów SWOT zamiast siedmiu: siedem etapów pozostaje za domyślnie wyłączoną flagą (`DEC-2026-09-03-383`, `src/utils/dynamicSwotSevenStagesFlag.ts:8`).
- Wyłączonego Archiwum Wyników (`resultsLegacyArchive`) — to stan celowy, opisany w `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`.
- Starego wariantu ekranu wyłącznie dlatego, że nadzorca nie potwierdził SHA środowiska. Najpierw potrzebna jest weryfikacja wersji.
- Samej pustej sekcji „Brak powiązań”; zgłoś ją tylko, gdy zasłania treść (`StandardPreview.tsx:353-368`, commit `58d391d65b`).

## 1. Interview (02)

**Kroki:** Wywiad → lista → realny, wcześniej rozpoczęty wywiad → otwórz jedną oś → utwórz/edytuj element formularza → wróć lewą nawigacją; podczas jedynego przełączenia języka sprawdź etykiety i komunikat błędu.

**Rekord:** otwórz rekord z PRAWDZIWĄ nazwą klienta/projektu, nie „Showcase”, „Przykład”, „Demo”. Jeśli lista jest pusta — zapisz to jako uwagę, nie improwizuj na rekordzie pokazowym.

**Co się zmieniło od odbioru:** `NModeLeftNav` (`src/components/Interview/InsightViewer.tsx:9253`) oraz współdzielone `DatePicker`/`MultiSelect` w `AssignInterviewModal.tsx:18-22,722,774`; patrz na aktywną sekcję, fokus, wybrane osoby i datę.

**Czego NIE zgłaszaj:** zachowania „jedna oś rozwinięta naraz” — jest zamierzone, zgodnie z pakietem G16.

## 2. Tools (03)

**Kroki:** Narzędzia → realne użyte narzędzie → podgląd → otwórz kreator → zmień jedno pole bez zatwierdzania → wywołaj bezpieczny błąd walidacji i sprawdź możliwość powrotu.

**Rekord:** otwórz rekord z PRAWDZIWĄ nazwą klienta/projektu, nie „Showcase”, „Przykład”, „Demo”. Jeśli lista jest pusta — zapisz to jako uwagę, nie improwizuj na rekordzie pokazowym.

**Co się zmieniło od odbioru:** `ToolWizardShell` jest żywą powłoką `ToolWizardView.tsx:19,271`, a odczyt/zapis sesji idzie przez `/api/tools/:toolId` (`server/src/routes/tools.routes.ts:52-53`); patrz na formularz i czytelny `ErrorState`.

**Czego NIE zgłaszaj:** wspólnego kreatora inicjatyw z Narzędzi — fala 2 (`DEC-2026-09-03-382`); pięciu etapów SWOT przy fladze OFF (`DEC-2026-09-03-383`).

## 3. My Work Agent (07)

**Kroki:** Moja Praca → Zadania → realne zadanie → przejdź sekcje lewą nawigacją → wróć do listy → otwórz realną decyzję lub powiadomienie i powtórz zmianę sekcji.

**Rekord:** otwórz rekord z PRAWDZIWĄ nazwą klienta/projektu, nie „Showcase”, „Przykład”, „Demo”. Jeśli lista jest pusta — zapisz to jako uwagę, nie improwizuj na rekordzie pokazowym.

**Co się zmieniło od odbioru:** wspólny `NModeLeftNav` jest użyty w `TaskDetailView.tsx:6011`, `DecisionDetailView.tsx:6358`, `NotificationDetailView.tsx:3521`; patrz, czy aktywna sekcja i treść pozostają zsynchronizowane.

**Czego NIE zgłaszaj:** niewidocznego prototypu prawego panelu Idei przy `ff_idea_notebook_right_panel_prototype` OFF (`src/utils/ideaNotebookRightPanelPrototypeFlag.ts:1,27`; `DEC-2026-09-03-354`).

## 4. Results (09)

**Kroki:** Wyniki → KPI → realny raport/KPI → szczegóły → otwórz Pomoc → wróć → przy naturalnym błędzie sieciowym sprawdź komunikat i ponowienie; nie rozłączaj sieci celowo, jeśli błąd nie wystąpi.

**Rekord:** otwórz rekord z PRAWDZIWĄ nazwą klienta/projektu, nie „Showcase”, „Przykład”, „Demo”. Jeśli lista jest pusta — zapisz to jako uwagę, nie improwizuj na rekordzie pokazowym.

**Co się zmieniło od odbioru:** współdzielone `HelpButton`, `ErrorState` oraz słowniki PL/EN są w odziedziczonym dryfie; patrz na właściwy tekst pomocy, brak żargonu i działające ponowienie.

**Czego NIE zgłaszaj:** wyłączonego `resultsLegacyArchive`; to stan celowy zapisany w pakiecie G16.

## 5. Finance (10)

**Kroki:** Finanse → realny projekt/case → pakiet sprawozdań lub widoczny panel → przejdź stan pełny i dostępny naturalnie stan pusty → podczas jedynego przełączenia języka sprawdź nagłówki i komunikaty.

**Rekord:** otwórz rekord z PRAWDZIWĄ nazwą klienta/projektu, nie „Showcase”, „Przykład”, „Demo”. Jeśli lista jest pusta — zapisz to jako uwagę, nie improwizuj na rekordzie pokazowym.

**Co się zmieniło od odbioru:** słowniki PL/EN i warunkowe przestrzenie Finance; widoczność paneli przechodzi m.in. przez `useFinancePredictionWorkspaceFlag.ts:48` oraz `useFinanceStatementPackWorkspaceV2Flag.ts:54-55`. Patrz tylko na panele widoczne bez zmiany flag.

**Czego NIE zgłaszaj:** braku panelu, którego flaga jest OFF, zanim nadzorca potwierdzi profil i SHA (`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, sekcja Finance).

## 6. Audits (12)

**Kroki:** Audyty → realny program → formularz/kreator → wybierz realnego użytkownika lub szablon → Raporty DRD → naturalny stan pusty albo błąd, jeśli wystąpi → ponów.

**Rekord:** otwórz rekord z PRAWDZIWĄ nazwą klienta/projektu, nie „Showcase”, „Przykład”, „Demo”. Jeśli lista jest pusta — zapisz to jako uwagę, nie improwizuj na rekordzie pokazowym.

**Co się zmieniło od odbioru:** `MultiSelect` jest użyty w `AuditOrchestratorWizard.tsx:32,393,417`; stany błędu są w `AuditLibraryTab.tsx:249` i `AuditReportDocumentView.tsx:1227,1425`. Patrz na wybór, pustkę, komunikat i retry.

**Czego NIE zgłaszaj:** samego braku danych jako błędu; zgłoś tylko pomieszanie pustki z błędem albo niedziałające ponowienie (`AuditLibraryTab.test.tsx:268`).

## 7. Admin (14)

**Kroki:** Panel administratora → Użytkownicy lub Audyt → realny wiersz → szczegóły → Pomoc, jeśli widoczna → wróć; przy naturalnym błędzie oceń komunikat.

**Rekord:** otwórz rekord z PRAWDZIWĄ nazwą klienta/projektu, nie „Showcase”, „Przykład”, „Demo”. Jeśli lista jest pusta — zapisz to jako uwagę, nie improwizuj na rekordzie pokazowym.

**Co się zmieniło od odbioru:** wspólne `HelpButton`/`ErrorState`, słowniki i dane warunkowe; wejście jest zależne od roli administratora (`src/App.tsx:442-445`). Patrz, czy dane odpowiadają wybranemu wierszowi i czy komunikat nie ujawnia technikaliów.

**Czego NIE zgłaszaj:** braku Panelu administratora na koncie bez roli admin; użyj konta odbiorowego z uprawnieniem, zgodnie z pakietem G16.

## 8. Settings (15)

**Kroki:** Ustawienia → Profil → Bezpieczeństwo → Powiadomienia → otwórz widoczny formularz z wyborem/datą/prioritetem → zmień wartość tylko wtedy, gdy operacja jest odwracalna, po czym cofnij ją.

**Rekord:** otwórz rekord z PRAWDZIWĄ nazwą klienta/projektu, nie „Showcase”, „Przykład”, „Demo”. Jeśli lista jest pusta — zapisz to jako uwagę, nie improwizuj na rekordzie pokazowym.

**Co się zmieniło od odbioru:** współdzielone `DatePicker`, `Select`, `MultiSelect`, `PriorityPicker`; nawigacja sekcji jest w `SettingsSidebar.tsx:84-101`. Patrz na etykiety, wybór, fokus, walidację i zachowanie po powrocie.

**Czego NIE zgłaszaj:** zakładki „Obserwowane”, jeśli jej nie ma lub jest niedokończona — kod jest przeznaczony do usunięcia, zgodnie z pakietem G16.

## 9. Partner (16)

**Kroki:** Portal partnerski → lista → realny partner/umowa → szczegóły → wróć do listy; podczas jedynego przełączenia PL↔EN sprawdź tę kartę.

**Rekord:** otwórz rekord z PRAWDZIWĄ nazwą klienta/projektu, nie „Showcase”, „Przykład”, „Demo”. Jeśli lista jest pusta — zapisz to jako uwagę, nie improwizuj na rekordzie pokazowym.

**Co się zmieniło od odbioru:** oba słowniki PL/EN; montaż modułu mapuje `src/config/viewToModuleMapping.ts:243`, a backend ma rodzinę `server/src/routes/v8/partner.routes.ts`. Patrz na zgodność nazwy, umowy, akcji i etykiet w obu językach.

**Czego NIE zgłaszaj:** danych pokazowych jako defektu środowiska; zgłoś natomiast brak prawdziwego rekordu, bo taki rekord jest warunkiem tego pomiaru (`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, ograniczenia stagingu).

## Tabela wykonania części

| Moduł | Data wykonania | Wynik / uwaga |
| --- | --- | --- |
| 02 Interview | | |
| 03 Tools | | |
| 07 My Work Agent | | |
| 09 Results | | |
| 10 Finance | | |
| 12 Audits | | |
| 14 Admin | | |
| 15 Settings | | |
| 16 Partner | | |
