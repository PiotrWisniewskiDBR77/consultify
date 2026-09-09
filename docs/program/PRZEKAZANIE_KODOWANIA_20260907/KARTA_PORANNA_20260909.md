# Karta poranna 09.09.2026 — wersja angielska i dane pokazowe

Stan na ~04:30. Gałąź `mvp/inicjatywy-lancuch-20260907`, wszystko poniżej jest na stagingu (`https://staging.consultify.ai`), health sprawdzany po każdym wdrożeniu.

## 1. Co poszło na staging w nocy (8 wdrożeń)

| fala | zawartość | staging |
|---|---|---|
| 1 | Czat, Moja Praca, Organizacja, Wyniki, Spotkania, Wywiad, Audyty, Finanse, Materiały; Northwind (dane EN) | `33a5b12c2c` |
| 1b | język konta ładowany przed pierwszym renderem (ZZ), Ocena (J5), naprawa tsc | `d5a381a5ce` |
| 2a | Ustawienia (J15) | `d7a53eb92e` |
| 2b | Partnerzy (J16), Narzędzia (J4) | `e8f816828d` |
| 2c | Panel administratora (J14, częściowo — robotnik zamilkł, scalone to, co zacommitował) | `c076e94405` |
| 3a | dogrywka Admin + Finanse (cennik, podatki, analityka subskrypcji) | `52dfc2846a` |
| 3b | polski bez ogonków w modułach fali 1: 665 miejsc → 3 | `0fd0ef25e0` |
| 3c | dogrywka Moja Praca (zlecenia) + wspólne (plakietka środowiska) + Ustawienia; **naprawa etykiet statusów, które były zawsze po polsku niezależnie od języka konta** | HEAD gałęzi po ostatnim pushu (patrz rejestr) |

Punkt cofnięcia przed nocą: `996d914591`.

## 2. Stan wersji angielskiej (pomiar przyrządem na gałęzi, 04:20)

Widoczny polski w EN (polskie defaulty, klucze bez EN, polski na sztywno w ekranie):

| moduł | widoczny polski w EN | uwaga |
|---|---:|---|
| Czat, Wywiad, Narzędzia, Ocena, Inicjatywy, Realizacja, Wyniki, Finanse, Materiały, Audyty, Spotkania, Organizacja, Admin, Partnerzy | **0** | |
| Moja Praca | 1 | dev-harness `podglad/main.tsx`, bez importera — nie jest w aplikacji |
| Ustawienia | 9 | 4 pliki martwe (SmartNudge, QuestionExplanation, SnapshotLabel, TourTrigger) — do usunięcia |
| wspólne | 21 | 18 = strony styleguide dla deweloperów za flagą, 3 = adres firmy i nazwisko |

Dodatkowo polski bez ogonków (którego przyrząd główny nie widzi): 665 → 3 w modułach fali 1; 18 bezpieczników źródłowych pilnuje, żeby nie wrócił.

**Co NIE jest domknięte** (nie przeszkadza w prezentacji po angielsku, ale istnieje):
- daty/liczby bez locale: Admin 174 miejsc (rozsiane po ekranach superadmina), serwer 87, Materiały 8, Ustawienia 4;
- zdania budowane po stronie serwera (K5) — osobna paczka J17; maile i PDF (J19); prompty (J20);
- wersja **polska** ma dług odwrotny: ok. 330 angielskich napisów na sztywno w Ustawieniach, K4en w Adminie 543 — EN było priorytetem;
- w `CaseDetailScreen` ~18 rzadszych komunikatów po komendach; arkusz liczy boolean jako „PRAWDA/FAŁSZ” na sztywno;
- język danych (K6: obszary/osie Oceny mieszane) — to dane, nie kod.

## 3. Jak to obejrzeć (10 minut)

Zaloguj się kontem Northwind z pliku, który dostałeś wczoraj (konto ma język EN). Przejdź: Moja Praca → zlecenie → Plan/Realizacja/Wyniki; Inicjatywy → rejestr → podgląd; Realizacja → zakładki; Ustawienia → profil, bezpieczeństwo; Partnerzy. Szukasz jednego polskiego słowa. Jeśli znajdziesz — zrzut i słowo, reszta jest moja.

## 4. Decyzje na dziś (Tak/Nie)

1. **Czystka bazy stagingu**: 325 organizacji-śmieci (30 659 wierszy) + 38 715 osieroconych wierszy. Zrzut bazy przed operacją jest gotowy (`~/Developer/consultify-dumps/staging-thomas-20260909-0059.dump`, 35 MB). Tak = wykonuję dziś.
2. **Kasowanie organizacji** Atelier Toys, Nordwind, VTS ze stagingu. Tak/Nie.
3. **Demo = kopia stagingu** (dane Northwind + DBR77) przed prezentacją. Tak/Nie.
4. **Spotkania na prezentacji** (flaga `VITE_MODULE_MEETINGS` na stagingu). Tak/Nie.
5. **Usunięcie martwego kodu** znalezionego przez robotników: `views/ContextBuilder/**` (3 pliki), 4 pliki Ustawień z pkt 2, poddrzewo `governance/`. Tak = wystawiam paczkę porządkową.
6. **Trzy miejsca wymagające zmiany koloru** (linie z crimsonem, których hook nie pozwala ruszyć bez Twojej zgody): „What are passkeys?” w Ustawieniach, 1 napis w karcie trendu (Narzędzia), 2 etykiety w szablonie raportu DBR77. Pokażę zrzuty przed/po, decydujesz.
7. **Mapa modułów**: przyrząd językowy liczy do modułu inne katalogi niż rejestr zamrożenia (np. Trial/Subscriber → Partnerzy, TemplateBuilder → Narzędzia). Proponuję: mapa przyrządu = prawda, rejestr zamrożenia rozszerzam. Tak/Nie.

## 5. Incydenty nocy (dla porządku)

- Restart komputera ok. 23:00 wyczyścił `/private/tmp` (worktree, sekrety, zrzut bazy) — wszystko przeniesione do `~/Developer`, robotnicy wznowieni z zasadą commit-co-etap.
- Robotnik J14 (Admin) zamilkł przy zrzutach końcowych; scaliłem jego 7 commitów, resztę modułu domknęła dogrywka B.
- Helper scalania przywrócił 4 klucze celowo skasowane przez J15 — złapała to bramka językowa w pre-commit, helper poprawiony.
- Robotnik B zgłosił, że pełny plik `server.env` wywraca lokalne API bez czytelnej przyczyny — do sprawdzenia, nie dotyczy stagingu.

Rejestr: `docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md` (wiersze „FALA JEZYKOWA …”). Dowody: `evidence/jezyk-j*/`, `evidence/jezyk-jdog-*/`.
