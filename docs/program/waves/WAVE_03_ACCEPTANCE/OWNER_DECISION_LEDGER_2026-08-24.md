# Owner decision ledger — 2026-08-24

Status: `FINAL / IRREVOCABLE`

Ten rejestr zamyka fazę 1 planu dokończenia. Werdykty zostały zebrane od
właściciela (Piotr) w sesji decyzyjnej 2026-08-24, na podstawie pakietu
decyzyjnego z kartami opartymi o realny kod kandydata
(`codex/final-mvp-integration-20260823`) i zrzuty dowodowe z repozytorium.

Reguła ostateczności: raz podjęta decyzja nie wraca do dyskusji. Nowe pomysły
dotyczące zamkniętych obszarów trafiają do backlogu po-MVP z nowym
identyfikatorem. Agenci mają zakaz podważania poniższych werdyktów; zmiana
wymaga wyłącznie nowej, jawnej decyzji właściciela z nowym wpisem w tym
rejestrze (stary wpis pozostaje jako historia).

Karty źródłowe (pełne uzasadnienia, opcje, ścieżki zrzutów): materiały sesji
`decyzje-W1-trasy-nazewnictwo.md`, `decyzje-W2-zachowanie-modulow.md`,
`decyzje-W3-dane-silniki.md` (scratchpad sesji nadzorczej 2026-08-24) oraz
opublikowany pakiet decyzyjny.

| ID | Decyzja | Werdykt | Treść zamrożona |
|---|---|---|---|
| DEC-2026-08-24-01 | Interview — tożsamość adresu | **OWNER_ACCEPT** | `/interview` jedynym adresem kanonicznym; `/discovery` i `/project-intelligence` stają się przekierowaniami (`Navigate replace`); pozycja menu „Interview" prowadzi na `/interview`; wpis „Project Intelligence" w palecie poleceń znika lub staje się aliasem wyszukiwania; `/discovery/canvas` (osobny ekran) i `/interview/respond/:token` nietknięte. |
| DEC-2026-08-24-02 | Assessment — jedno narzędzie DRD | **OWNER_ACCEPT** | Silnik serwerowy (Method Core, `DrdMethodWorkspaceScreen`/`MethodWorkspaceShell`) jedyną implementacją DRD. Zakładki dokładnie `Interview | Matrix | Report`; `Split` usunięty; `Workspace` nie wraca; `Settings` jako osobna akcja. Mechanika pracy (karta poziomu, decyzje Osiągnięte/Cel/Pomiń, macierz pełnoekranowa, AS-IS/TO-BE) przenoszona ze starego `DRDAssessmentEditor`/`DRDMatrixSession` jako dawcy. Prototyp do akceptu właściciela PRZED kodowaniem (ASM-THREE-AC-008); test blokujący powrót `Split`/`Workspace`. Zgodne z ASM-OWN-021/022. |
| DEC-2026-08-24-03 | Execution — banner niedostępności | **OWNER_ACCEPT** | Banner V8 dozwolony wyłącznie wokół pojedynczego panelu realnie wymagającego V8 (dziś: Manager Cockpit) — nigdy wokół trasy modułu ani powłoki `ExecutionHub`. Treść banera: co nie działa + co nadal działa + kto włącza (wersja PL). Błąd odczytu flag (sieć/404) = stan błędu, nie „brak uprawnień"; produkcja fail-closed. Test-strażnik rozszerzony o powłokę. Zamyka przyczynę EXE-OWN-001. |
| DEC-2026-08-24-04 | Results — generacja źródeł | **OWNER_ACCEPT** | `ResultsVNext/*` (rejestry i karty KPI/OKR/ROI) jedyną generacją. `src/components/Results/*` (stary kokpit `ResultsHub`) = `HISTORICAL`, bez prawa powrotu do tras. Wymagany DZIAŁAJĄCY strażnik: `verify-canonical-16-module-bindings.mjs` egzekwuje `forbiddenCanonicalComponent` (dziś pole martwe) + blokada tylnych drzwi (`sampleData`, flagi, pusty wynik API nie podmieniają rejestru na kokpit). Ustalić jawną ścieżkę włączenia flag rejestrów dla właściciela (dziś default OFF). RES-OWN-002/007 realizowane później na tym fundamencie. |
| DEC-2026-08-24-05 | Finance — cutover na jedną linię | **SUPERVISOR_ACCEPT_BY_OWNER_DELEGATION** | Kandydat (`EconomicsView` → `FinanceHub` → warsztaty Finance V3) jedyną linią. Gałąź `codex/preserve-finance-owner-wip-20260823` (`e7574b340e`) = `REVIEWED_PATH_BY_PATH / NO_ADOPTION` — odrzucona w całości jako źródło kodu. Podstawa: analiza plik-po-pliku (22/37 identycznych, 15/37 starszych) POTWIERDZONA niezależną weryfikacją adwersaryjną (wszystkie 1786 dodanych linii sprawdzone; 45 niepasujących wyjaśnionych; 0 unikalnych kluczy tłumaczeń; drzewo gałęzi ścisłym podzbiorem kandydata; gałąź nowsza zegarowo, starsza treściowo — WIP z pominięciem 321 commitów). Gałąź pozostaje w backupie `github-backup` — decyzja odwracalna wyłącznie nowym wpisem. Dalej: deterministyczny resolver kart (FIN-REC-002); 4 flagi V3 włączane POJEDYNCZO, każda po akcepcie właściciela na zrzucie; odłączenie importów `Benefits/*` z `FinanceHub` dopiero po pełnym przełączeniu; polityka danych: historyczne wartości ufności NIE są nadpisywane. Werdykt właściciela: delegacja („jeśli jesteś pewien — podejmij") — zapisano dosłownie w protokole sesji. |
| DEC-2026-08-24-06 | Materials — silnik arkuszy | **OWNER_ACCEPT** | `ExceleView` kanonicznym silnikiem „Arkusza" w Materiałach (formuły, wieloarkuszowość, realny `.xlsx`, generowanie AI; flaga default ON od 2026-07-22). `TabeleView` = `SEPARATE_TOOL / NOT_A_MATERIALS_SHEET_ENGINE` — osobne żywe narzędzie operacyjne (rejestry, master data), nie `HISTORICAL`, nie do kasowania. Do naprawy w fazie 2: projekcja rejestru Materiałów (dziś pokazuje tylko „Prezentacja"), nieaktualny komentarz „default OFF", dług SPEC-A silnika Excele. |
| DEC-2026-08-24-07 | Meetings — adres obiektu | **OWNER_ACCEPT** | Gramatyka: `/meetings` (lista) + `/meetings/:meetingId` (karta) + `/meetings/:meetingId/minutes`, `/decisions`, `/notes/:noteId`. `/meeting` i `/meeting?meetingId=` = trwałe przekierowania. Karta spotkania wg standardu artefaktów SPEC-A (wzór: karta KPI). |
| DEC-2026-08-24-08 | Partner — landing | **OWNER_ACCEPT** | `/partner` = wyłącznie pulpit operacyjny podłączonego partnera (domyślnie „Pulpit"). Ekran pierwszego podłączenia = osobny, jednoekranowy stan. Treści programowe/marketingowe wyłącznie na publicznych `/become-partner`, `/partner/apply`, `/partner/pricing`; siedem wewnętrznych podstron marketingowych wycofane z `/partner` z zapisem, gdzie treść żyje dalej. Bramki: `connection` decyduje podłączony/nie; `lifecyclePhase` tylko o zawartości pulpitu; stan nieznany/błąd nigdy nie pokazuje rejestracji. Ekonomia partnerska pozostaje wyłączona polityką AMD-PRT-ECONOMICS-002 — poza zakresem tej decyzji. |
| DEC-2026-08-24-09 | Słownik menu | **OWNER_ACCEPT** | Jedna pełna lista nazw powierzchni na moduł (PL wiodące, EN równoległe), wywiedziona z KODU. Tabele zbiorcze podają liczbę powierzchni + odsyłacz do karty modułu — nigdy urwany fragment listy. Sporne moduły: Organization 6 modułów + 21 ekranów podrzędnych; Interview 6 zakładek + 1 ukryta za flagą (opisana jako ukryta); Materials 5 zakładek + 2 zakresy przez `?tab=`. Uzupełnić tłumaczenia PL („Presentations", „Template Library"), breadcrumb „Documents"→„Materials". Zmiana etykiety bez zmiany słownika nie przechodzi bramki. |
| DEC-2026-08-24-10 | Granice Ustawienia/Organizacja/Admin | **OWNER_ACCEPT** | Podział z `FINAL_THREE_MODULE_CONTRACT.md`: fakty o firmie → Organizacja; preferencje osobiste → Ustawienia; polityki organizacji (role, plan/faktury, AI, bezpieczeństwo, audyt) → Admin. Jeden obiekt = jeden właściciel; pozostałe moduły tylko-do-odczytu z linkiem. Praktycznie: Billing w Ustawieniach → kafelek z linkiem do Admina; `/settings/organization` i `/settings/tenant-defaults` → Admin; sekcja ADMINISTRACJA znika z Organizacji, adresy `members/billing/limits/domains/branding` → przekierowania do Admina; sprzątnięcie aliasów `ROUTES.ADMIN`. Bramki `OWN-GATE-001..005` = `ACCEPTED`. Warstwa `/superadmin/*` osobna, nietknięta. |

## Protokół sesji

- Partia 1 (D1–D4): werdykty właściciela ACCEPT × 4, po zrzutach dowodowych.
- Partia 2 (D5–D8): D6/D7/D8 ACCEPT; przy D5 właściciel odpowiedział dosłownie:
  „Szczerze powiedziawszy, nie wiem, czy wiesz, o czym mówisz. Zakładam, że tak.
  Jeśli jesteś pewien w 100 % że ta rekomendacja jest dobra, to nie podejmuj jej,
  bo ja nie wiem, o czym ty wiesz." — odczytane jako delegacja rozstrzygnięcia
  technicznego na nadzorcę pod warunkiem pewności. Warunek spełniono niezależną
  weryfikacją adwersaryjną (osobny agent z zadaniem OBALENIA tezy; werdykt:
  teza przetrwała). Decyzja odwracalna: gałąź w backupie.
- Partia 3 (D9–D10): werdykty właściciela ACCEPT × 2, po zrzutach dowodowych.

## Skutek

Warunek „owner freeze" z `CANONICAL_16_MODULE_SOURCE_CONTROL_MAP_2026-08-24.md`
(krok 6 sekwencji konsolidacji) jest SPEŁNIONY dla dziesięciu rozstrzygnięć
powyżej. Zamrożenie kodu produktu przechodzi w tryb ograniczonej integracji:
jeden moduł na raz, w zamrożonej kolejności 01→16, commit-per-krok, z bramką
akceptu właściciela na kompletnych zrzutach i wpisem `CLOSED_FINAL` per moduł.

Obserwacja poboczna z weryfikacji adwersaryjnej (do sprawdzenia w fazie 2,
moduł Finance): flaga `isFinanceOwnerSampleDataEnabled()` podmienia listy
Finance na zaszyte `FINANCE_OWNER_SAMPLE_*` — zweryfikować przed jakimkolwiek
demo (reguła „dane demo = twarz produktu").

## Uzupełnienie — sesja wieczorna 2026-08-24

| ID | Decyzja | Werdykt | Treść zamrożona |
|---|---|---|---|
| DEC-2026-08-24-11 | Organizacja — ekran wzorcowy redesignu | **OWNER_ACCEPT** | Realny ekran „Tożsamość i model działania" (SHA 14b1a8fc73, flaga `orgRedesignV1` OFF) zaakceptowany jako wzorzec; etap B = pozostałe 10 ekranów przez ten sam szkielet wg mapy 21→11. Flaga pozostaje OFF do odbioru całości modułu. |
| DEC-2026-08-24-12 | Admin — przełączniki bezpieczeństwa bez egzekwowania (TRI-MUST-02) | **OWNER_ACCEPT** | Trzy przełączniki (goście, link-sharing, zatwierdzanie narzędzi) UKRYTE/oznaczone „planowane" do czasu wdrożenia realnego egzekwowania; egzekwowanie = zadanie po-MVP z własnym odbiorem. Zakaz placebo polityk. |
| DEC-2026-08-24-13 | Admin — dom „ustawień domyślnych organizacji" (TRI-MUST-06) | **OWNER_ACCEPT** | Edytor tenant-defaults powstaje jako ekran-dziecko w Admin Command Center; przekierowania już tam celują (08e2beec19). |
| DEC-2026-08-24-14 | Admin — zakres domknięcia modułu w MVP | **OWNER_DECISION: FULL_55** | Moduł Admin zostaje otwarty do czasu podłączenia WSZYSTKICH 55 ekranów; odbioru częściowego nie będzie. Program budowy 40 brakujących ekranów staje się jawnym torem prac MVP (inwentarz → fale wdrożeniowe → odbiory per domena). |
