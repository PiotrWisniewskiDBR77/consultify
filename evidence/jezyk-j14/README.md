# J14 — moduł PANEL ADMINISTRATORA bez obcego języka (DEC-453)

Paczka J14 programu spójności językowej. Zasady: `docs/program/JEZYK_EN_PL_20260908/PLAN.md` §2.
Przyrząd: `node scripts/i18n/pomiar-jezyka.mjs --modul "14 Admin Panel"`.
Gałąź: `mvp/j14-admin-0909`, baza `33a5b12c2c`.

---

## 0. ROZSTRZYGNIĘCIE ZAKRESU — to jest najważniejsza liczba w tym dokumencie

Zlecenie mówiło: „`SuperAdmin/**` to platforma — sprawdź, czy wchodzi do pozycji menu
»Panel administratora« dla OWNER organizacji". **Nie wchodzi.** Sprawdzone, nie założone:

| Dowód | Miejsce |
| --- | --- |
| trasa `/superadmin/*` wymaga globalnej roli SUPERADMIN | `src/routes/AppRoutes.tsx:3759` |
| SUPERADMIN **nie** dziedziczy dostępu do `/admin` tenanta (bariera w obie strony) | `src/components/ProtectedRoute.tsx:84-90` |
| pozycja menu „SuperAdmin" tylko przy `isSuperAdminRole()` | `src/components/navigation/Sidebar/Sidebar.tsx:498` |
| `/superadmin` ma własny layout, bez `MainLayout` | `src/routes/AppRoutes.tsx:3756-3766` |
| domknięcie importów `AdminView` (251 plików) nie zawiera ANI JEDNEGO pliku z `views/superadmin/**`, `components/billing/**`, `SystemHealth` | pomiar 09.09 |

Jedyny wspólny plik to `components/SuperAdmin/TabLayout.tsx` — prezentacyjny pasek zakładek
bez logiki uprawnień, reużywany też przez `views/settings/**`. Primitive UI w złym katalogu,
nie ekran superadmina wpuszczony do panelu klienta.

**Skutek dla liczb.** Moduł „14 Admin Panel" przyrządu to 982 trafienia. Po rozdzieleniu:

| | K1def | K4pl | K4en | K7 | RAZEM |
| --- | --: | --: | --: | --: | --: |
| **panel OWNER-a** (`views/admin/**`, `components/Admin/**`) — MÓJ ZAKRES | 3 | 0 | 17 | 11 | **31** |
| **platforma SuperAdmin + billing** — DŁUG, §5 | 33 | 9 | 543 | 277 | **951** |

Czyli **97 % liczby, którą niesie nazwa „14 Admin Panel", leży poza panelem administratora
organizacji.** Robota w ekranach właściciela to 31 trafień przyrządu — i tu zaczyna się drugi,
poważniejszy problem.

---

## 1. Przyrząd widział 31 defektów. W ekranach właściciela było ich ~415.

Audyt źródeł (nie skan heurystyczny) znalazł w `views/admin/**` + `components/Admin/**`:

| Grupa | Trafień | Skaner widział |
| --- | --: | --: |
| hardcode angielski poza `t()` (psuje PL) | ~290 | 17 |
| hardcode polski poza `t()` (psuje EN) | 84 | 0 |
| polski `defaultValue` w `t()` (psuje EN) | 10 | 3 |
| daty/liczby bez locale konta | 31 | 11 |
| **RAZEM** | **~415** | **31 (7,5 %)** |

**Dlaczego przyrząd tego nie widzi — dwa wzorce, oba systemowe:**

1. **`adminNavigation.ts` trzymał DWA równoległe słowniki napisów.** `ADMIN_DOMAINS` po polsku,
   `ADMIN_DOMAIN_EN` + `ADMIN_SCREEN_EN` po angielsku, przełączane funkcją
   `getAdminDomains(language)`. **136 napisów CAŁEGO menu panelu** (7 domen × 61 ekranów,
   w dwóch językach) poza `t()` — i poza skanem, bo to plik `.ts`, a przyrząd czyta `.tsx`.
2. **`isPolish ? 'PL' : 'EN'` w czterech plikach powłoki** (`AdminHealthPanel`,
   `AdminCapabilityState`, `AdminSettingsSidebar`, `AdminSettingsModule`) — oba języki zaszyte
   w kodzie, i18n omijane w całości.

Do tego napisy w pełni polskie **bez ani jednego ogonka**, których detektor diakrytyczny nie
zobaczy nigdy: „Role i uprawnienia", „Plan i limity", „Panel administratora", „Zapisano
i potwierdzono odczytem", „Wykorzystanie i koszty", „Historia zmian planu".

---

## 2. Pomiar przed → po (przyrząd, nie deklaracja)

| Kategoria | Przed | Po | Uwaga |
| --- | --: | --: | --- |
| K1def — polski `defaultValue` w `t()` | 36 | **33** | 3 z 3 w moim zakresie naprawione; 33 reszty = SuperAdmin/billing (dług) |
| K4pl — polski hardcode w JSX | 9 | **9** | wszystkie 9 w `views/superadmin/**` (dług) |
| K4en — angielski hardcode w JSX | 560 | **543** | 17 z 17 w moim zakresie naprawione; 543 = SuperAdmin/billing (dług) |
| K7 — daty/liczby bez locale | 288 | **277** | 11 z 11 w moim zakresie naprawione; 277 = SuperAdmin/billing (dług) |
| K3a / K3b / K1 / K2 | 3 / 0 / 0 / 0 | bez zmian | `superadmin.*` — klucze platformy |

`baseline.json` obniżony **wyłącznie dla modułu 14** (K1def 36→33, K4en 560→543, K7 288→277)
i o tę samą deltę w `suma`. Żadna inna kategoria ani moduł nie ruszone.

**Liczba przyrządu jest tu złym miernikiem pracy** i mówię to wprost: naprawa 136 napisów menu
zmieniła pomiar o **zero**, bo skaner nigdy ich nie widział. Prawdziwą miarą jest bezpiecznik
źródłowy (§4) i zrzuty (§3).

---

## 3. Dowód wizualny

`przed/` i `po/` — te same 14 ekranów, konto `audyt-j14@dbr77.local` (rola ADMIN organizacji
DBR77), 1440×900, motyw jasny, w DWÓCH językach: 7 domen Menu 1 (Zespół, Rozliczenia ×4,
Sterowanie AI ×2, Bezpieczeństwo ×2, Dziennik audytu, Centrum dowodzenia, Stan systemu)
plus modal tworzenia klucza API.

`liczniki.json` liczy obce słowa **wyłącznie w napisach interfejsu** (menu, przyciski, zakładki,
nagłówki kolumn, `aria-label`, `placeholder`, opcje `<select>`) — nie w komórkach z danymi.
Detektor to `wykryjPolski`/`wykryjAngielski` **z tego samego pliku, na którym stoi przyrząd
pomiarowy**, żeby dowód i pomiar nie rozjechały się definicją.

| | PRZED | PO |
| --- | --: | --: |
| konto **PL** widzi angielskie napisy interfejsu | **11** (6 unikalnych) | **0** |
| konto **EN** widzi polskie napisy interfejsu | 20 (7 unikalnych) | 20 (7 unikalnych) |
| ekranów, których nie udało się zrzucić | 0 | 0 |

**PL → 0.** Zniknęły: „Billing, FinOps, and commercial controls", „Usage and overage posture",
„Legal company name", „Save tax settings", „Security and identity sections",
„What is this key used for?".

**EN → 20 trafień, ale ANI JEDNO nie jest defektem tego modułu.** Rozbicie co do sztuki:

* **5 × „Role for ⟨polskie nazwisko⟩"** — to `aria-label` z klucza `admin.membersRoles.roleSelectLabel`,
  poprawnie przetłumaczonego w obie strony (`PL: „Rola użytkownika {{name}}"`). Detektor
  zapala się na NAZWISKU z bazy DBR77 („Wiśniewski", „Zieliński"). To **dane**, nie interfejs.
* **„Środowisko LOCAL, wersja …"** — `src/components/layout/EnvironmentBadge.tsx:145`.
  Komponent wspólny, poza modułem → **STOP nr 2**.
* **„Zamknij komunikat"** — `src/components/access/ForbiddenAccessBanner.tsx:79`
  (i bliźniak w `src/components/CaseWorkspace/ui.tsx:291`). Komponent wspólny → **STOP nr 3**.

### Czym ten dowód kłamał, zanim zaczął mówić prawdę

Trzy razy, i za każdym razem w stronę „wygląda dobrze":

1. **Zrzut pokazywał modal, nie produkt.** Pierwszy przebieg złapał okno onboardingu
   („Meet Teresa — a consultant that talks") przykrywające cały panel; licznik policzyłby
   napisy modala i zameldował sukces. Skrypt gasi go dziś kluczem
   `consultify_onboarding_done:{userId}` z `useFirstRunOnboarding.ts` — nie klikaniem „Skip for
   now", bo przycisk ma inny napis w każdym języku.
2. **Kotwica językowa odrzuciła 12 z 14 działających ekranów.** `innerText` zwraca tekst **po**
   transformacji CSS, a nagłówek grupy Menu 1 ma `text-transform: uppercase`. Porównanie
   wrażliwe na wielkość liter meldowało „interfejs nie przeszedł na en" dla sprawnego produktu.
   Dziś porównanie jest bez wielkości liter.
3. **Log serwera nie należał do mojego serwera.** `lsof` pokazał, że do pliku, z którego czytałem
   „stan uruchomienia", pisał proces INNEJ sesji (`wt/jzz-wspolne`, port 4201) — stąd
   w moim logu komunikaty o bazie `consultify_jzz`, której nigdy nie tworzyłem.

---

## 4. Bezpiecznik w repozytorium

`src/components/Admin/__tests__/jezykAdmina.source.test.ts` czyta **ŹRÓDŁO** (nie renderuje),
więc obejmuje także te z 62 slotów nawigacji, których żaden zrzut nie odwiedził, oraz pliki `.ts`
(słowniki enumów, konfiguracja nawigacji), których przyrząd nie skanuje. Sześć prób, **obie
strony wymagania**: polski w kodzie (psuje EN) i angielski poza `t()` (psuje PL).

**Mutacje — każda sprawdzona, każda RED, przywrócenie GREEN:**

| # | Mutacja | Próba, która zaświeciła |
| --- | --- | --- |
| 1 | polski `defaultValue` w `t()` | „nie ma polskiego defaultValue w t()" |
| 2 | polski napis w tablicy `ADMIN_DOMAINS` | „nie ma polskich napisów w etykietach tablic i obiektów stałych" |
| 3 | polski BEZ ogonków („Role i uprawnienia") | jw. (słownik słów, nie diakrytyki) |
| 4 | angielski napis poza `t()` w JSX | „nie ma angielskich napisów poza t()" |
| 5 | `toLocaleDateString()` bez locale | „nie formatuje dat ani liczb z locale na sztywno" |
| 6 | `isPolish` w pliku panelu | „nie rozgałęzia napisów po języku" |

**Bezpiecznik złapał DWA własne błędy, zanim złapał cudze** — i to jest jedyny powód, dla
którego mu ufam:

* próba `defaultValue` **nie widziała** napisu w tablicy stałej; mutacja 2 przechodziła na
  zielono. Dołożona osobna próba etykiet obiektów.
* regex pomocnika nawigacji wymagał **jednej linii**, a prettier łamie wywołanie `c(...)` na
  cztery; mutacja 3 przechodziła. Naprawione flagą `/s`.

Słownik polskich słów **świadomie nie zawiera** `role`, `plan`, `panel`, `benchmark`, `audyt`,
`limity` — po angielsku znaczą to samo i dawały fałszywe trafienia na poprawnym kodzie
(„Default Role", „Artifacts Panel", „Failed to assign plan"). Bezpiecznik, który krzyczy na
poprawny kod, zostaje wyciszony i przestaje bronić.

**Bramka `pomiar-jezyka.mjs --baseline`** przechodzi (kod 0). Mutacja: obniżenie baseline
o 1 w K4en modułu 14 wywala ją kodem **1** z komunikatem `14 Admin Panel / K4en: 542 -> 543 (+1)`;
przywrócenie — kod 0. Sprawdzone 09.09.

**tsc frontu: 192 błędy** (próg ≤ 192). W moich katalogach jeden — `ChatV9FlagsIndicator.test.tsx:137`,
**zastany** (plik nietknięty, identyczny w `33a5b12c2c`). Wkład paczki: 0.

**Testy modułu:** 40 plików / 324 testy. Zielone poza `AdminDay2I18n.test.ts` — awaria
**ZASTANA**, identyczna w `33a5b12c2c` (7 z 26 panelów zawiera `defaultValue`, czego ten
kontrakt zabrania). Dwa testy poprawione w tej paczce, bo asertowały nieprzetłumaczone napisy:
`AdminSettingsModule` (nagłówek `UNAUTHORIZED`) i `AdminCommandCenterCostCapacity` (surowe `12.50`).

---

## 5. DŁUG — powierzchnia platformy SuperAdmin (poza panelem właściciela)

Wypisany co do pliku, nie „reszta". Wymaga osobnej paczki i osobnej decyzji, bo to inna
powierzchnia, inny odbiorca (operator platformy DBR77, nie klient) i inny guard.

| Powierzchnia | K1def | K4pl | K4en | K7 |
| --- | --: | --: | --: | --: |
| `src/views/superadmin/**` | 6 | 9 | ~470 | ~240 |
| `src/components/SuperAdmin/**` | 0 | 0 | ~67 | ~34 |
| `src/components/billing/**` (nieosiągalne z `/admin`) | 28 | 0 | 6 | 9 |
| `src/components/SystemHealth*`, `views/SystemHealthDashboard` | 0 | 0 | 1 | 3 |

Najgorsze pliki: `AIIntelligenceView` (16 K4en), `InvoiceCenterView` (11), `WhitelabelStudioView` (11),
`PresentationGovernanceAlertSubscriptionsView` (11), `BulkOperationsView` (11),
`revenue/PartnerSettlementsView` (**34 K7** — rekord modułu), `billing/SubscriptionAnalytics` (24 K1def).

**Dodatkowo poza zakresem, świadomie:**

* `src/components/Admin/ChatV9Flags*.tsx` — ~32 angielskie napisy. To **ukryta nakładka
  deweloperska** otwierana wyłącznie przez `?v9flags=1` (`ChatV9FlagsOverlay.tsx:41`),
  nie jest żadnym z 62 slotów menu i właściciel organizacji nie ma do niej wejścia.
  Wpisana do listy wyłączeń bezpiecznika z tym uzasadnieniem.
* K5pl 13 / K5en 73 — komunikaty backendu, paczka J17 (kody błędów, nie tłumaczenia).

---

## 6. STOP-y do decyzji właściciela

1. **Kolumna „Koszt" bez jednostki (produktowy, nie językowy).**
   `AdminCommandCenterPanel` pokazuje koszt jako gołą liczbę — kolumna nazywa się „Koszt"/„Cost",
   a odpowiedź API nie niesie kodu waluty. Sformatowałem **liczbę** (separator z konta), świadomie
   **nie dopisując USD**, którego w danych nie ma. Waluta w tej kolumnie to decyzja produktowa.
   (Tam, gdzie `$` był już w kodzie — `AdminLLMView`, `AdminMarginConfig`, `CommandCenterAuditTab` —
   został `formatListCurrency(..., 'USD')`, bo to zachowuje istniejące znaczenie.)
2. **Plakietka środowiska ma polski `aria-label` na KAŻDYM ekranie EN.**
   `src/components/layout/EnvironmentBadge.tsx:145`. Komponent wspólny, poza modułem.
   (Ten sam STOP zgłosiła paczka J10 — nadal otwarty.)
3. **„Zamknij komunikat" po polsku na koncie EN.**
   `src/components/access/ForbiddenAccessBanner.tsx:79` oraz `src/components/CaseWorkspace/ui.tsx:291`.
   Komponenty wspólne, poza modułem.
4. **Rozjazd pomiaru: PLAN.md §3 podaje dla J14 `K4pl 10, K4en 571`; `baseline.json` i żywy
   przyrząd na bazie `33a5b12c2c` dają `9` i `560`.** Nie „dostosowałem" naprawy do liczby
   nadzorcy — pracowałem na baseline (SSOT bramki). Tabela w PLAN.md do poprawienia.
5. **Wartości enumów z bazy renderowane wprost.** Na ekranie Rozliczeń widać `Status: inactive`,
   plan `enterprise` — surowe wartości bazy w obu językach. To kategoria „enumy przez słownik"
   z §2.6 planu, wspólna dla całego programu; nie ruszam jej per moduł.
6. **`NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia ATRAPĘ bazy** (`[Server] Persistent background
   workers disabled for MOCK_DB runtime`). Sprawdziłem procesy innych sesji na tej maszynie:
   `wt/j4-narzedzia` (port 4202), `wt/j16-partnerzy` (4205), `wt/jzz-wspolne` (4201) startują
   z `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false` — czyli **poprawnie**. Zgłaszam wzorzec, nie
   incydent: sam trafiłem w atrapę, zanim znalazłem udokumentowaną kombinację (`server/src/index.ts:306`).
