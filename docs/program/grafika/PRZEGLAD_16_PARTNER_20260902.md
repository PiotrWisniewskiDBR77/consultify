---
module_id: MODULE_PARTNER_PORTAL
data: 2026-09-02
autor: robotnik (agent/partner-zrzuty-20260902)
cel: pierwszy komplet zrzutów modułu 16 „Partner" dla przeglądu właściciela — moduł nie miał w rejestrze grafiki ANI JEDNEGO ekranu
---

# Moduł 16 „Partner" — pierwszy przegląd (2026-09-02)

## Zero ekranów w rejestrze — potwierdzone

`docs/program/grafika/status.json` (`moduly[]`, 19 wpisów) **nie zawiera ani jednego wpisu** dla
Partnera — sprawdzone maszynowo (grep po `partner`/`Partner` w całym pliku, zero trafień w polu
`katalog`/`nazwa`/`id`). Zlecenie było trafne.

★ Zgodnie z uwagą nadzorcy: `partner-settlements-view` (`src/views/superadmin/revenue/
PartnerSettlementsView.tsx`) **nie jest częścią tego modułu** — to SuperAdmin → Revenue, własny
ekran rozliczeń platformy z partnerami (widok operatora, nie widok partnera). Nie jest tu liczony.

## Co to jest moduł 16 „Partner"

Menu główne: `src/components/navigation/Sidebar/menuConfig.ts:280` — `getPartnerMenuItem()`,
etykieta „Partner Portal" (`sidebar.partnerPortal`), `viewId: AppView.PARTNER_LANDING`.
Kontrakt funkcjonalny: `docs/modules/19_portal-partnerski/CURRENT_CONTRACT.md` (uwaga: link w
`docs/FUNCTIONAL_DOCUMENTATION.md` jest względny i poprawny — `docs/modules/19_portal-partnerski/…`,
NIE `docs/program/modules/…`, jak sugerowała treść zlecenia; to nie jest zepsuty link, tylko
skrót w instrukcji).

Trasa: `/partner/*` (`ROUTES.PARTNER.LANDING`), montowana w `src/routes/AppRoutes.tsx:3494`
jako `<PartnerPortalViewNew />` wewnątrz `<MainLayout>`. **Gate wyłącznie `requireAuth={true}`
— ZERO flagi frontendowej.** Komentarz w kodzie (AppRoutes.tsx:3484-3492) mówi to wprost:
niepodłączeni użytkownicy widzą ekran orientacyjny, nie dane; dostęp do realnych danych partnera
jest egzekwowany po stronie serwera. To NIE jest fantom za flagą — to realny, zamontowany ekran.

## K1 — inwentarz (wołacz → renderowanie, cztery warstwy sprawdzone)

Jeden komponent-powłoka `PartnerPortalViewNew` (`src/views/partner/PartnerPortalView.tsx`,
3443 linie) obsługuje WSZYSTKIE 24 podsekcje przez `?tab=`. Renderuje się realnie — potwierdzone
zrzutem 12 wariantów w REALNYM DOM-ie przeglądarki (Playwright), nie tylko istnieniem pliku.

| Sekcja (grupa menu) | Podzakładki | Komponent | Realny wołacz API | Kebab wiersza | Klik w wiersz → podgląd |
| --- | --- | --- | --- | --- | --- |
| Start | partner-home | `PartnerStartRouter` | `V8PartnerApi.getProgramStatus/getConnection` | — (nie lista) | — |
| Pulpit | dashboard | `DashboardSection` | `Api.get('/api/partners/dashboard')` + runtime strip | — (karty, nie lista) | — |
| Metryki | metrics | `MetricsSection` | `Api.get('/api/partners/metrics')` | nie sprawdzone w tej rundzie | — |
| Polecenia | referral-tools / referral-analytics / referred-organizations | `ReferralToolsSection` | `V8PartnerApi.getReferralTools/getReferralAnalytics/getAttributions` | **TAK** — `getRowActions` realny (Kopiuj link / Usuń) | **NIE** — brak `onRowClick` |
| Prowizje | earnings / statements / payouts / payout-settings | `EarningsSection` | `V8PartnerApi.getEarningsSummary/getCommissionTransactions/getPayouts/getPayoutSettings` | **NIE** — `hideRowActions` | **NIE** — brak `onRowClick` |
| Zarządzanie klientami | client-access | `ClientAccessView` | `V8PartnerApi.getClients/getEmployees/getReferralTools` | **NIE** — `hideRowActions` | **NIE** |
| Zarządzanie klientami | organizations / projects / users | `ClientsSection` | `V8PartnerApi.getClients/getProjects` | **NIE** — `hideRowActions`; `projects`/`users` to karty, nie `FilterableTable` wcale (naruszenie kanonu triady — patrz niżej) | **NIE** |
| Akademia | learning-path / exams / certificates | `CertificationSection` | `Api.get('/api/partners/certifications')` | n/d (karty kursów) | n/d |
| Zasoby | documentation / marketing / case-studies / templates | `ResourcesSection` | `Api.get('/api/partners/resources')` | n/d (karty plików) | n/d |
| Profil | company-info / specializations / regions / public-listing | `ProfileSection` | `Api.get('/api/partners/organization')` | n/d (formularz) | n/d |

Dodatkowo w rodzinie tras (nie zrzutowane w tej rundzie, budżet czasu — zaznaczono jako braki
poniżej): `BecomePartnerView`/`PartnerApplicationView` (publiczna strona rekrutacyjna,
`/become-partner`) i `EnterpriseOnboardingWizard` (`/partner/onboarding`, chroniony realny
wizard z wołaniami `V8PartnerApi.acceptOnboardingTerms/selectOnboardingTier/completeOnboarding`).
Obie ścieżki mają realny kod (nie fantomy), ale nie są „portalem partnera" sensu stricto —
pierwsza to marketing, druga to jednorazowy onboarding sprzed wejścia do portalu.

**Wniosek K1: portal partnera ISTNIEJE i renderuje się naprawdę — to NIE jest przypadek
„wołacz istnieje, komponent nigdy nie jest renderowany".** Wszystkie 12 wariantów poniżej to
zrzuty prawdziwego DOM-u po realnym mountowaniu `<PartnerPortalViewNew>` w harnessie z danymi
atrapowymi, bez żadnej flagi.

## Znaleziska (K1, potwierdzone w kodzie źródłowym — nie domysł)

1. **Zero ekranów listowych z podglądem po kliknięciu w wiersz.** Sprawdzone `grep`em
   (`onRowClick`, `PreviewPane`) w `PartnerPortalView.tsx`, `EarningsSection.tsx`,
   `ReferralToolsSection.tsx`, `ClientAccessView.tsx` — **zero trafień** w całym module.
   Kanon triady (§ podgląd po single-clicku) nie jest tu wdrożony NIGDZIE.
2. **Kebab wiersza działa tylko w jednym miejscu na cztery tabele.** `ReferralToolsSection`
   (kampanie UTM) ma realny `getRowActions` → menu „Kopiuj link" / „Usuń" (zrzut
   `partner-referral-tools-filled-kebab`). Pozostałe trzy (`organizations` w `ClientsSection`,
   transakcje w `EarningsSection`, pracownicy w `ClientAccessView`) mają jawnie ustawione
   `hideRowActions` — brak kebaba całkowicie.
3. **`projects`/`users` w `ClientsSection` to bespoke karty, nie `FilterableTable`.**
   Sprawdzone `grep`em na `FilterableTable`/`StandardTable` — tylko `organizations` używa
   realnej tabeli triady; `projects` renderuje własną siatkę kart (`PartnerPortalView.tsx`
   ok. linii 1360-1420), `users` własną listę wierszy z `ChevronRight` bez żadnej akcji.
   Naruszenie CLAUDE.md #1/#9 (zakaz bespoke list poza `StandardTable`).
4. **Crimson (`primary-*`) użyty jako kolor DEKORACYJNY/INFORMACYJNY, nie krytyczny —
   pułapka nr 1 z CLAUDE.md #3, szeroko rozsiana.** Policzone `grep -c` po plikach:
   `ReferralToolsSection.tsx` 21×, `EarningsSection.tsx` 9×, `AcademyProgress.tsx` 8×,
   `PartnerLifecycleCanonPanel.tsx` 5×, `CommissionIntelligence.tsx` 2×. Widoczne na
   zrzutach: panel „Podsumowanie poleceń" (różowa ramka+tło, ikona trend-up różowa — zwykłe
   metryki, nie błąd), skrzynka „Wskazówki zwiększające konwersję" (bordowe tło, bordowy
   nagłówek — zwykłe porady, nie ostrzeżenie), etykieta „ROZLICZENIA" w Prowizjach (czerwony
   tekst dla neutralnego statusu), focus ring formularza kampanii (`focus:border-primary-500`
   zamiast `c-focus`).
5. **Twarda waluta € w Pulpicie, mimo PLN wszędzie indziej na tym samym ekranie.**
   `PartnerPortalView.tsx:345` — `` value: `€${(s.monthlyRevenue || 0).toLocaleString()}` ``
   (dosłowny znak euro wklejony w kod). Na tym samym zrzucie (`partner-dashboard`) inne kafle
   pokazują `PLN 10,800` i `10 800,00 zł`. Sprzeczna waluta na jednym ekranie.
6. **Twardo wpisane angielskie napisy w polskim UI — cztery niezależne miejsca:**
   - `PartnerPortalView.tsx:2348-2352` — tytuł H1 sekcji Zasoby: `titles = { documentation:
     'Documentation', marketing: 'Marketing Materials', 'case-studies': 'Case Studies',
     templates: 'PMO Templates' }` — ZERO `t()`. Widoczne na zrzucie `partner-resources-filled`:
     okruszek mówi „Dokumentacja" (PL), nagłówek strony obok mówi „Documentation" (EN).
   - `ReferralToolsSection.tsx:507/512/517/522` i `PartnerRuntimeSummaryStrip.tsx:127/137/147`
     — detale kafli metryk: `` `${x} unique}` ``, `` `${x} trials` ``, `` `${x} sources` ``,
     `` `${x} tracked days` ``, `` `${lifecyclePhase} lifecycle` `` — literalne angielskie słowa
     sklejane z liczbą, widoczne na `partner-dashboard` i `partner-referral-tools-filled`
     (np. „412 unique", „41 trials", „earn lifecycle").
   - `EarningsSection.tsx` kolumna „TYP" w tabeli transakcji pokazuje surowy enum
     (`SUBSCRIPTION_RENEWAL`→„Subscription Renewal", `NEW_CONTRACT`→„New Contract") bez
     tłumaczenia — widoczne na `partner-earnings-filled`, kontrastuje z kolumną „STATUS"
     obok, która JEST przetłumaczona („Wypłacone"/„Zatwierdzone"/„Oczekujące").

## K2 — zrzuty (12 ekranów/stanów × light+dark = 24, plus 1 stan kebaba = 25 plików)

Harness kanoniczny: `dev-render/screens/partner-portal.tsx` (nowy plik, zarejestrowany w
`dev-render/main.tsx` jako 12 wpisów `partner-*`). Montuje **realny** `<PartnerPortalViewNew />`
w `<MemoryRouter>`, dane wstrzyknięte przez stub `window.fetch` (scoped po substringach
`/api/v8/partner/*` i `/api/partners/*` — bez catch-all). Fikcyjny partner demo:
„Zenit Consulting Sp. z o.o.", polski zespół, waluta PLN, klienci Metalpol Group / HurtNord
Logistyka / Atelier Toys. Uruchomienie: `npx vite --config dev-render/vite.config.ts --port 5252`,
zrzuty przez kanoniczne `scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5252 …`.

Wszystkie ścieżki poniżej: `evidence/grafika/16-partner/`.

### Para light/dark — liczby (mean luma + procent różnych pikseli)

Próg kanonu (`checkScreenshotPairState`) to różnica luma **150**. Próg pikselowy dodany w tej
rundzie (`scripts/dev/partner-portal-lumadiff-measure.mjs`, sumaryczna różnica RGB > 24/piksel).

| ekran | luma light | luma dark | różnica luma | % pikseli różnych |
| --- | --- | --- | --- | --- |
| partner-start-unconnected | 248.8 | 21.2 | **227.7** | **100.0%** |
| partner-start-active | 247.8 | 23.2 | **224.7** | **100.0%** |
| partner-start-error | 249.2 | 21.1 | **228.1** | **100.0%** |
| partner-dashboard | 247.9 | 28.6 | **219.2** | **99.9%** |
| partner-referral-tools-filled | 241.9 | 28.2 | **213.7** | **99.7%** |
| partner-referral-tools-empty | 242.1 | 28.2 | **214.0** | **99.7%** |
| partner-organizations-filled | 248.3 | 23.1 | **225.2** | **99.9%** |
| partner-organizations-empty | 248.8 | 22.8 | **226.0** | **99.9%** |
| partner-earnings-filled | 246.7 | 29.1 | **217.6** | **99.8%** |
| partner-academy-filled | 247.6 | 26.7 | **220.9** | **99.1%** |
| partner-resources-filled | 248.4 | 22.5 | **225.9** | **100.0%** |
| partner-profile-filled | 248.7 | 23.4 | **225.3** | **100.0%** |

Wszystkie 12 par **daleko powyżej progu 150** i ~99-100% pikseli różnych — pary light/dark są
realnymi, odrębnymi motywami, nie duplikatem pod dwiema nazwami (KSZTAŁT 13 wykluczony
mechanicznie, liczbami, nie okiem). Surowe dane: `evidence/grafika/16-partner/_luma-pixel-diff.json`.

## K3 — opisy do przeglądu (język właściciela)

1. **Start (niepodłączony)** — `partner-start-unconnected__PRZED__{light,dark}.png`.
   Ekran, który widzi każdy nowy użytkownik: informacja, że profil partnera nie jest jeszcze
   podłączony, bez żadnych danych i bez zaproszenia do rejestracji. Menu boczne jest wyszarzone.

2. **Start (błąd połączenia)** — `partner-start-error__PRZED__{light,dark}.png`.
   Gdy serwer nie potwierdzi statusu partnera, ekran pokazuje uczciwy komunikat błędu z
   przyciskiem „Sprawdź ponownie" — nigdy nie udaje, że użytkownik ma się zarejestrować.

3. **Start (aktywny partner)** — `partner-start-active__PRZED__{light,dark}.png`.
   Pulpit powitalny aktywnego partnera: cztery kafle salda (zarobione, gotowe do wypłaty,
   wypłacone, wstrzymane) i lista „Następny krok".

4. **Pulpit** — `partner-dashboard__PRZED__{light,dark}.png`.
   Rozbudowany przegląd: kliknięcia linków, płacący klienci, konwersja, gotowe do wypłaty;
   niżej stan programu (status, certyfikacja, polecenia), aktywność ostatnich dni i postęp
   certyfikacji. Najbogatszy ekran modułu.

5. **Moje linki i kody — wypełnione** — `partner-referral-tools-filled__PRZED__{light,dark}.png`.
   Własny kod i link polecający partnera plus tabela trzech kampanii z parametrami UTM
   (kliknięcia/rejestracje/płacący/konwersja) i podpowiedziami zwiększającymi konwersję.

6. **Moje linki i kody — kebab otwarty** —
   `partner-referral-tools-filled-kebab__PRZED__light.png`.
   To samo co wyżej, z otwartym menu przy pierwszym wierszu tabeli: „Kopiuj link" i „Usuń".
   Jedyne miejsce w całym module, gdzie menu przy wierszu naprawdę działa.

7. **Moje linki i kody — puste** — `partner-referral-tools-empty__PRZED__{light,dark}.png`.
   Ten sam ekran bez żadnej kampanii — kod i link własny partnera nadal widoczne, tabela
   kampanii pusta.

8. **Organizacje — wypełnione** — `partner-organizations-filled__PRZED__{light,dark}.png`.
   Lista trzech firm klienckich partnera z branżą, liczbą użytkowników, projektów, oceną i
   statusem. Bez menu przy wierszu i bez podglądu po kliknięciu.

9. **Organizacje — puste** — `partner-organizations-empty__PRZED__{light,dark}.png`.
   Ten sam ekran bez żadnej firmy klienckiej — czytelny komunikat „Brak organizacji".

10. **Prowizje** — `partner-earnings-filled__PRZED__{light,dark}.png`.
    Podsumowanie zarobków (łącznie, w tym miesiącu, oczekujące, gotowe do wypłaty) i tabela
    trzech ostatnich rozliczeń z klientami, kwotą, prowizją i statusem.

11. **Ścieżka nauki (Akademia)** — `partner-academy-filled__PRZED__{light,dark}.png`.
    Trzy kursy certyfikacyjne partnera z paskiem postępu: jeden ukończony, jeden w toku,
    jeden zablokowany do czasu ukończenia poprzednich.

12. **Dokumentacja (Zasoby)** — `partner-resources-filled__PRZED__{light,dark}.png`.
    Lista dwóch plików do pobrania (podręcznik wdrożeniowy, standard oceny) z rozmiarem pliku.

13. **Dane firmy (Profil)** — `partner-profile-filled__PRZED__{light,dark}.png`.
    Formularz danych firmy partnera: nazwa, NIP, e-mail, telefon, strona internetowa,
    przycisk zapisu zmian.

## Commity (branch `agent/partner-zrzuty-20260902`, baza `eeb253c3ec`)

Patrz `git log --oneline eeb253c3ec..HEAD` w worktree `/private/tmp/ag-partner-zrzuty` — commit
per krok (harness K1/K2, poprawki danych atrapowych, ten dokument), zgodnie z zasadą „commit po
każdym kroku, NIE push".

## Czego NIE zrobiono w tej rundzie (uczciwie, nie ukryte)

- `metrics` (Metryki) — nie zrzucony osobno; renderuje się pod tym samym `DashboardSection`-podobnym
  wzorcem, ale nie zweryfikowano wołacza `/api/partners/metrics` w tej rundzie.
- `client-access` (osobny komponent `ClientAccessView`, inny niż `organizations`) — nie zrzucony;
  kod przeczytany, kebab potwierdzony jako `hideRowActions` (brak), ale brak zrzutu wizualnego.
- `statements`/`payouts`/`payout-settings` (podzakładki Prowizji poza domyślną `earnings`) — nie
  zrzucone osobno; ten sam komponent `EarningsSection`, inny `subsection`.
- `exams`/`certificates`, `marketing`/`case-studies`/`templates`, `specializations`/`regions`/
  `public-listing` — podzakładki tego samego komponentu co zrzucony reprezentant grupy
  (`CertificationSection`/`ResourcesSection`/`ProfileSection`), nie zrzucone osobno.
- `BecomePartnerView`/`PartnerApplicationView` (publiczna rekrutacja) i `EnterpriseOnboardingWizard`
  (`/partner/onboarding`) — zidentyfikowane jako realny kod, nie zrzucone (poza zakresem „portal
  partnera" sensu stricto, patrz K1).
- Powód ograniczenia zakresu: budżet jednej rundy robotnika: 12 reprezentatywnych ekranów/stanów
  uznano za wystarczające do PIERWSZEGO przeglądu właściciela (moduł miał ZERO), przy 24
  podzakładkach współdzielących 6 komponentów.
