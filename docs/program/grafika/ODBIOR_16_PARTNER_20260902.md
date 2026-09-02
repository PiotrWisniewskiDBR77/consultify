# Odbiór modułu 16 Partner — decyzja właściciela 2026-09-02

## Na czym stoi ten odbiór

Właściciel obejrzał **13 ekranów Portalu Partnerskiego** (12 ekranów × jasny i ciemny motyw
plus otwarte menu wiersza) na stronie przeglądu złożonej ze zrzutów z harnessu `dev-render`,
montującego **realny** `PartnerPortalView` na danych atrapowych partnera „Zenit Consulting".

To był **pierwszy raz**, kiedy zobaczył ten moduł. Do 2026-09-02 rejestr grafiki nie miał dla
Partnera ani jednego wpisu — nie dlatego, że portal nie istniał, tylko dlatego, że **nikt nigdy
nie zrobił zrzutów**. Portal jest podpięty pod `/partner/*` (`src/routes/AppRoutes.tsx:3494`)
i bramkowany wyłącznie zalogowaniem, bez żadnej flagi.

## Decyzja właściciela — dosłownie

> „Poza tym czerwonym tłem w jasnym tle to nie mam jakoś wiele uwag. Popraw sam i daj mi
> poprawione. Załatw to szybko bo szkoda czasu. Do MVP może być."

Zapytany, czy chodzi o wskazany blok, potwierdził:

> „Tak. I resztę odbieramy."

**Rozstrzygnięcie: moduł PRZYJĘTY na MVP z jednym warunkiem — poprawą czerwonych teł.**

## Warunek do wykonania

Crimsonowe tła i gradienty użyte **dekoracyjnie**, wbrew pułapce nr 1 z `CLAUDE.md`
(`primary-*` każdy numer = crimson `#85182F`; czerwień wyłącznie dla semantyki krytycznej).

Wskazany palcem: blok „Wskazówki zwiększające konwersję" na ekranie „Moje linki i kody" —
`src/views/partner/sections/ReferralToolsSection.tsx:952`,
`bg-gradient-to-br from-primary-900/30 to-primary-800/20`. To jest **podpowiedź, nie ostrzeżenie**.

Zmierzona rodzina: **75 odwołań do crimsona w module, z czego 29 to tła i gradienty** —
to one dają efekt „czerwonego tła", nie kolor tekstu ani ikon.

★ **Sprostowanie własnego pomiaru nadzorcy, zapisane dla uczciwości:** pierwsza miara podawała
54 odwołania w 8 plikach i pomijała podkatalog `src/views/partner/sections/`, w którym leżą dwa
najbardziej obciążone pliki (`ReferralToolsSection.tsx` — 21, `EarningsSection.tsx` — 9).
Druga miara wskazała pasek `border-t-crimson` w `PartnerLayout.tsx:144` jako główny problem —
też nietrafnie, bo właściciel mówił o tłach. **Obie były niepełne; wykonawca dostał polecenie
zmierzenia od nowa.** Pasek jest realnym naruszeniem (unikalny dla Partnera, żaden inny moduł
go nie ma) i też idzie do poprawy, ale nie jest tym, co zgłosił właściciel.

## Sześć znalezisk z przeglądu — poza warunkiem odbioru

Właściciel objął je słowami „resztę odbieramy". **Nie blokują zamknięcia**, idą do backlogu:

1. Zero ekranów listowych z podglądem po kliknięciu w wiersz — w całym module.
2. Menu wiersza działa tylko w tabeli kampanii; pozostałe trzy tabele mają `hideRowActions`.
3. `projects` i `users` w Zarządzaniu klientami to bespoke karty, nie `StandardTable` —
   naruszenie kanonu list.
4. Twardy znak € w Pulpicie (`PartnerPortalView.tsx:345`) obok PLN na tym samym ekranie;
   ★ dodatkowo ta sama kwota występuje na Pulpicie **trzy razy w trzech zapisach**:
   „PLN 10 800", „€10 800" i „10 800,00 zł".
5. Cztery miejsca z twardo wpisanym angielskim tekstem w polskim UI — m.in. nagłówek
   „Documentation" obok okruszka „Dokumentacja", surowy enum „Subscription Renewal",
   oraz „unique", „signups", „trials", „earn lifecycle" sklejane z liczbami na Pulpicie.
6. Crimson jako kolor tekstu i ikon (poza tłami) — reszta z 75 odwołań.

## Co zamyka moduł

`G07`–`G12` — na tym przeglądzie. `G17`/`G18` — **dopiero po zweryfikowanych zrzutach PO**
z poprawionymi tłami. Do tego czasu moduł pozostaje otwarty.

Zrzuty PRZED: `evidence/grafika/16-partner/` (25 plików; kontrola par jasny/ciemny:
różnica luminancji 213–228 przy progu 150, 99,1–100% różnych pikseli).
Inwentarz i opisy: `PRZEGLAD_16_PARTNER_20260902.md`.
