# J16 — moduł PARTNERZY / PARTNER PORTAL bez obcego języka (DEC-453)

Paczka J16 programu spójności językowej. Zasady: `docs/program/JEZYK_EN_PL_20260908/PLAN.md` §2.
Przyrząd: `node scripts/i18n/pomiar-jezyka.mjs --modul "16 Partner Portal"`.

## Pomiar przed → po (przyrząd, nie deklaracja)

| Kategoria | Przed | Po | Uwaga |
| --- | --: | --: | --- |
| K1def — polski `defaultValue` w `t()` | 131 | **0** | z tego widocznych na stałe (K1defWID): 30 → **0** |
| K3a — klucz tylko w `pl` | 167 | **0** | z tego bez defaultu w kodzie (K3aKLUCZ): 19 → **0** |
| K4pl — polski hardcode w JSX | 24 | **0** | |
| K4en — angielski hardcode w JSX | 21 | **1** | reszta to FRAGMENT KODU, nie napis (niżej) |
| K7 — daty/liczby bez locale | 34 | **0** | podpięte pod istniejący SSOT `src/utils/listDateFormat.ts` |
| K3b — klucz tylko w `en` (angielski w PL) | 0 | **0** | |

Poza zakresem paczki (serwer): **K5pl 3, K5en 29** — komunikaty backendu; wg PLAN.md
to paczka **J17**, która idzie osobno i dotyka kontraktów API.

## Dwie role modułu — obie zmierzone

Moduł ma DWA różne ekrany startowe i oba trzeba było zobaczyć:

* **OWNER organizacji BEZ wiersza `partner_users`** widzi WYŁĄCZNIE ekran „connect"
  (`PartnerOrientationPanel`, wariant `unconnected`) — nagłówek, jedno zdanie i przycisk
  „Connect this organization as a partner" (przycisk pokazuje się tylko roli ADMIN/OWNER;
  autorytet i tak sprawdza serwer). Każda inna zakładka, także wymuszona w adresie
  (`?tab=earnings`) i trasa legacy (`/partner/dashboard`), jest przekierowana z powrotem
  na `partner-home` — sprawdzone trzema osobnymi zrzutami (`01`, `02`, `03`).
  **Aktywny partner nigdy nie dostaje ekranu rejestracji, a błąd odczytu nie udaje
  „nie jesteś partnerem"** — to osobny wariant `error` z przyciskiem ponowienia.
* **Partner z ACTIVE `partner_users`** widzi pełny portal: 20 zakładek (Start, Pulpit,
  Metryki, Polecenia ×3, Prowizje ×4, Klienci ×4, Akademia ×3, Zasoby ×2, Profil).

Dodatkowo 5 ekranów poza powłoką partnera: `become-partner`, formularz zgłoszenia,
cennik, aktywacja trialu, pulpit subskrybenta. Razem **28 ekranów × 2 języki = 56 zrzutów**.

### Fikstura roli partnera (tylko w KOPII bazy)

`getActivePartnerOrgIdForTenantUser` (`server/src/services/partnerOrgResolution.ts:107`)
łączy `partner_users` z `partner_organizations.owner_organization_id` — **sam wiersz
`partner_users` NIE wystarczy**. W kopii stagingu tylko JEDNA organizacja partnerska ma
ustawiony `owner_organization_id` (`702709e7-…`, „DBR77", przypięta do tenanta konta
audytowego; kolumna ma UNIQUE, więc druga jest niemożliwa). Fikstura dokłada więc
wyłącznie brakujący wiersz `partner_users` i kasuje go po przebiegu:

```sql
INSERT INTO partner_users (id,user_id,partner_org_id,status,role)
VALUES ('pu-audyt-j16','audyt-j16','702709e7-1c6a-4910-8e8d-88ab76f8b01b','active','owner')
ON CONFLICT (id) DO UPDATE SET status='active';
-- po przebiegu:
DELETE FROM partner_users WHERE id='pu-audyt-j16';
```

## Dowód wizualny

`przed/` i `po/` — te same ekrany, konto `audyt-j16@dbr77.local`, 1440×900, motyw jasny,
własna kopia bazy `consultify_kopia_d24`. `liczniki.json` liczy obce słowa **wyłącznie
w napisach interfejsu** (przyciski, zakładki, nagłówki, `aria-label`, pozycje menu) —
nie w komórkach z danymi. Detektor to `wykryjPolski`/`wykryjAngielski` **z tego samego
pliku, na którym stoi przyrząd pomiarowy**, żeby dowód i pomiar nie rozjechały się
definicją „polskiego".

| | przed | po |
| --- | --: | --: |
| EN — polskie napisy interfejsu | 35 | **28** |
| PL — angielskie napisy interfejsu | 1 | **0** |

**Wszystkie 28 pozostałych trafień EN to JEDEN napis powtórzony na każdym ekranie:**
„Środowisko LOCAL, wersja …" z `src/components/layout/EnvironmentBadge.tsx` — komponent
WSPÓLNY spoza modułu 16, zgłoszony jako STOP (ten sam STOP zgłosiła paczka J10).
Polskich napisów modułu 16 w wersji angielskiej: **0**.

Najbardziej dobitna para: `przed/11-home-en.png` (cały ekran startowy partnera po polsku
na koncie EN: „Twój program partnerski", „ZAROBIONE ŁĄCZNIE", „GOTOWE DO WYPŁATY",
„Przejdź do prowizji") → `po/11-home-en.png` („Your partner program", „EARNED IN TOTAL",
„READY FOR PAYOUT", „Go to commissions"). Druga: `przed/07-aktywacja-trial-en.png`
(publiczny ekran aktywacji dostępu w całości po polsku) → `po/07-aktywacja-trial-en.png`.

### Czym ten dowód kłamał, zanim zaczął mówić prawdę

Przyrząd `scripts/dev/jezyk-j16-zrzuty.mjs` skłamał DWA razy, oba defekty są opisane
w nagłówkach pliku:

1. **Modal pierwszego uruchomienia („Meet Teresa") zasłaniał KAŻDY zrzut.** Liczniki
   wyszły identyczne (pl 1 / en 6) na wszystkich 23 ekranach — sygnał, że mierzony jest
   przyrząd, nie produkt. Gasimy go po stronie serwera (`user_preferences`), bo świeży
   kontekst przeglądarki nie ma jeszcze klucza w `localStorage`. Dołożony twardy
   bezpiecznik: zrzut z tekstem „Meet Teresa" na ekranie jest odrzucany.
2. **Kotwica językowa PL padała na 13 z 20 ekranów** komunikatem „interfejs nie przeszedł
   na pl". To NIE był defekt produktu: nazwy grup menu są w pliku PL zapisane
   WERSALIKAMI („POLECENIA"), a wzorzec był wrażliwy na wielkość liter. Kotwicą jest dziś
   stopka menu (`Back to app` / `Powrót do aplikacji`) — jedyny napis obecny na każdym
   ekranie w OBU rolach — dopasowywana bez rozróżniania wielkości liter.

## Bezpiecznik w repozytorium

`src/components/Partner/__tests__/jezykPartnerow.source.test.ts` czyta ŹRÓDŁO (nie
renderuje), więc obejmuje też ekrany, których żaden zrzut nie odwiedził.

**I od razu na siebie zarobił: znalazł 39 polskich defaultów `t()` przy przyrządzie
pokazującym K1def = 0.** Przyczyna jest mechaniczna: `wykryjPolski` z `pomiar-jezyka.mjs`
wymaga diakrytyku albo słowa z listy mocnej, a „Prowizje", „Klienci", „Akademia",
„Egzaminy", „Certyfikaty", „Organizacje", „Wstrzymane", „Moje linki i kody" nie mają ani
jednego ogonka. Codemod etapu 2b używał tej samej funkcji, więc ominął dokładnie te
24 klucze — w tym WSZYSTKIE nazwy grup i pozycji bocznego menu partnera, czyli napisy
widoczne na każdym ekranie modułu.

Bezpiecznik skłamał też raz w drugą stronę: pierwsza wersja słownika miała słowo „link",
identyczne w obu językach, i wywaliła 13 POPRAWNYCH angielskich napisów
z `ReferralToolsSection`. Słowo usunięte, powód zapisany w pliku testu.

**Mutacja** (obie sprawdzone i cofnięte): `t('partner.start.retry', 'Try again')` → polski
tekst daje RED w `it` „nie ma polskiego defaultValue w t()"; `formatListNumber(…)` →
formatowanie liczby bez locale daje RED w `it` „nie formatuje dat ani liczb z locale
przybitym na sztywno". Po przywróceniu: 4/4 zielone.

## Bramka

`node scripts/i18n/pomiar-jezyka.mjs --baseline docs/program/JEZYK_EN_PL_20260908/baseline.json`
przechodzi kodem 0. Mutacja baseline (moduł 16, K4en 1 → 0) wywala ją kodem 1
z komunikatem `16 Partner Portal / K4en: 0 -> 1 (+1)`; przywrócenie — kod 0.

Baseline obniżony **wyłącznie dla modułu 16**, a `suma` **wyłącznie o deltę tego modułu**
(K1def −131, K1defWID −30, K3a −167, K3aKLUCZ −19, K4pl −24, K4en −20, K7 −34), żeby nie
zabrać zapasu paczkom, które jeszcze nie weszły.

`tsc` frontu (pełny, `-p tsconfig.json`): **192 błędy, próg ≤ 192, zero w plikach paczki.**
Uwaga metodyczna: pierwszy przebieg pokazał „0 błędów", ale skończył się kodem 134 —
proces padł na braku pamięci. To nie był wynik, to był brak pomiaru.

Testy modułu przed → po: 7 plików / 40 testów zielonych → **8 plików / 44 testy zielone**
(nowy plik to bezpiecznik). Zero nowych czerwonych.

## STOP-y (do decyzji właściciela)

1. **Plakietka środowiska** (`src/components/layout/EnvironmentBadge.tsx`) ma polski napis
   i `aria-label` na KAŻDYM ekranie EN — to jedyne polskie trafienie, jakie zostało
   w wersji angielskiej tego modułu. Komponent wspólny, poza modułem 16. Ten sam STOP
   zgłosiła paczka J10 — warto go domknąć raz, dla całej aplikacji.
2. **Rozszerzenie zakresu plikowego, świadome.** Zamrożenie `16_PARTNER`
   (`docs/program/MVP_FINAL_ZAMROZONE.json`) wymienia 28 plików `Partner/**` i
   `views/partner/**`. Mapa przyrządu pomiarowego (`scripts/i18n/pomiar-jezyka.mjs:99`)
   przypisuje do modułu 16 SZERSZY zbiór: dodatkowo `components/Trial/**`,
   `components/Subscriber/**`, `views/subscriber/**` i `views/TrialEntryView.tsx` —
   i to w nich siedziały 23 z 24 K4pl oraz 4 z 21 K4en, czyli liczby z tabeli zlecenia.
   Bez ich ruszenia paczka nie mogła osiągnąć K4pl = 0. Pliki te nie są współdzielone
   z żadnym innym modułem (jedyni importerzy to `App.tsx` i `AppRoutes.tsx`) i nie są
   objęte żadną inną paczką J1–J15, więc ryzyko dwóch rąk w jednym pliku jest zerowe.
   **Do potwierdzenia: czy zamrożenie `16_PARTNER` ma zostać rozszerzone o te 4 ścieżki,
   czy mapa przyrządu ma zostać zawężona.** Dziś te dwa źródła prawdy się rozjeżdżają.
3. **Serwer poza paczką**: K5pl 3 i K5en 29 (komunikaty backendu modułu). Wg PLAN.md to
   paczka J17, która idzie osobno, bo dotyka kontraktów API.
4. **Jedno pozostałe K4en to fałszywe trafienie przyrządu**:
   `src/components/Partner/CommissionIntelligence.tsx:105` — `new Date(d.registeredAt)`
   w filtrze dat. To fragment kodu, nie napis interfejsu; nie ma czego tłumaczyć.
