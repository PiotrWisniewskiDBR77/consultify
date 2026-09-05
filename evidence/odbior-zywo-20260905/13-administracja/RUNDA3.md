# RUNDA 3 — 13-administracja (05.09.2026)

Staging gitSha w chwili testu: `b852ade6164e0dec755ea3ae0c59ec2f7ca3dc04` (health API) — STARY, naprawy serwerowe (persony AI, saldo miejsc) jeszcze niewdrożone.

| id | werdykt rano (R2) | werdykt teraz (R3) | jedno zdanie |
|---|---|---|---|
| admin-billing-seats-licences | ROZNI_SIE | **CZEKA_NA_SERWER** | Trasa GET /api/admin/seats (seatManagementService.getSeatConfiguration) zwraca total_seats_available=0 przy seats_used=8 — matematycznie sprzeczne podsumowanie (Łącznie 0/Zajęte 8/. |
| admin-team-invitations | ROZNI_SIE | **DANE** | Kompozycja zgodna z obrazem (nagłówek, opis, przycisk 'Odśwież'). |
| admin-team-roles-permissions | ROZNI_SIE | **DANE** | Kompozycja zgodna (formularz Nazwa roli/uprawnienia/Dodaj rolę, nagłówki tabeli Rola/Uprawnienia/Aktualizacja). |
| admin-team-teams | ROZNI_SIE | **DANE** | Kompozycja zgodna (formularz tworzenia zespołu, nagłówki tabeli Nazwa/Lider/Członkowie/Typ/Status). |
| admin-team-guests-external | ROZNI_SIE | **DANE** | Kompozycja zgodna (opis, nagłówki tabeli Gość/E-mail/Zakres/Przyznano/Wygasa/Status). |
| admin-security-sessions | ROZNI_SIE | **DANE** | Kompozycja zgodna (nagłówki tabeli Użytkownik/Urządzenie/IP/Lokalizacja/Ostatnia aktywność/Wygaśnięcie). |
| admin-security-domains | ROZNI_SIE | **DANE** | Kompozycja zgodna (formularz dodawania domeny, nagłówki tabeli Domena/Automatyczne dołączanie/Status weryfikacji/Data weryfikacji/Akcje). |
| admin-security-service-accounts | ROZNI_SIE | **DANE** | Kompozycja zgodna (formularz 'Utwórz', nagłówki tabeli Nazwa/Prefiks tokenu/Zakresy/Ostatnie użycie/Wygasa). |
| admin-security-break-glass | ROZNI_SIE | **DANE** | Kompozycja i kolor przycisku 'Aktywuj na 1h' zgodne z obrazem. |
| admin-health-dependencies | ROZNI_SIE | **ZGODNY** | NAPRAWIONE: podtytuł strony i breadcrumb są teraz w całości po polsku ('Stan systemu' zamiast 'Health', 'Sondy potwierdzające działanie systemu — testy w obie strony na naszym włas. |
| admin-health-incident-history | ROZNI_SIE | **ZGODNY** | NAPRAWIONE: ten sam problem językowy co na admin-health-dependencies już nie występuje — breadcrumb 'Stan systemu' i podtytuł strony w całości po polsku, treść karty 'Stan bieżący,. |
| admin-ai-personas | ROZNI_SIE | **CZEKA_NA_SERWER** | Komunikat błędu jest już spolszczony ('Nie udało się pobrać person.'), ale trasa GET /api/ai-prompts?limit=500&page=1 (Api.aiGetSystemPrompts, src/services/api.ts:4406) nadal zwrac. |

## Liczby
- ZGODNY: 28 (26 z R2 bez zmian + 2 nowo potwierdzone: admin-health-dependencies, admin-health-incident-history — 'Health' po polsku naprawione)
- WYMAGA_SUPERADMINA: 3 (bez zmian, retest po nadaniu roli poza zakresem tej rundy)
- DANE: 8 (puste stany bez seedu w organizacji testowej — Zaproszenia/Role/Zespoły/Goście/Sesje/Domeny/Konta usługowe/Break-glass)
- CZEKA_NA_SERWER: 2 (admin-billing-seats-licences — GET /api/admin/seats, saldo miejsc matematycznie sprzeczne; admin-ai-personas — GET /api/ai-prompts 404)

## ROZNI_SIE ze specyfikacją naprawy
Brak — po weryfikacji na żywo żadna pozycja z tego pakietu nie pozostała ROZNI_SIE. Dwie czekają na deploy serwera (CZEKA_NA_SERWER), reszta to brak danych seedowych (DANE) lub już naprawiony język (ZGODNY).
## Runda 4

| id | werdykt runda 3 | werdykt runda 4 | jedno zdanie |
|---|---|---|---|
| admin-billing-seats-licences | CZEKA_NA_SERWER | **ZGODNY** | GET /api/admin/seats zwraca teraz seats_limit_configured:false i AdminSeatsLicencesPanel.tsx już poprawnie pokazuje "nieskonfigurowane" zamiast sprzecznych zer — kod naprawy potwierdzony w źródle i przez API, zrzutu z realną rolą ADMIN nie dało się zrobić (sesja SUPERADMIN jest przekierowywana z /admin/* na /superadmin/customers przez stały guard ADM-RAW-P0-001, niezwiązany z dzisiejszymi naprawami). |
| admin-ai-personas | CZEKA_NA_SERWER | **ZGODNY** | GET /api/ai-prompts?limit=500&page=1 zwraca teraz 200 z realną listą person (poprzednio 404) — defekt naprawiony po stronie serwera, ten sam bloker sesji SUPERADMIN uniemożliwił zrzut ekranu. |

Uwaga metodyczna: sesja odbioru (ODBIOR_AUTH_STATE) niesie dziś rolę SUPERADMIN, a nie ADMIN/OWNER organizacji — dla `/admin/*` to oznacza natychmiastowy redirect na `/superadmin/customers` (ProtectedRoute.tsx:88, mechanizm istnieje od 02.06, nie jest regresją dzisiejszych napraw). Weryfikacja tych dwóch pozycji oparta jest o bezpośrednie wywołania API tokenem z tej samej sesji + inspekcję kodu źródłowego, NIE o zrzut ekranu z poprawną rolą. Zalecenie: powtórzyć zrzut z sesją ADMIN/OWNER przy najbliższej okazji.
