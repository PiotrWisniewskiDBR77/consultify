# Raport — pakiet 18 (Ustawienia)

Liczby: ZGODNY 5 / ROZNI_SIE 2 / NIE_DOTARLEM 1 (na 8 ekranów)

## Różnice (2)
1. **ustawienia-powiadomienia** — wygląd 1:1 zgodny z obrazem, ale 1 błąd konsoli 501 (Not Implemented) w tle.
2. **ustawienia-zaawansowane** — treść główna zgodna, ale w sidebarze brakuje pozycji „Funkcje beta" (Beta) obecnej na obrazie zatwierdzonym.

## Nie dotarłem (1)
**ustawienia-integracje** — najważniejsze znalezisko sesji. Po 8 niezależnych próbach (bezpośrednia
nawigacja pod `/settings/integrations` oraz klik w sidebarze startując z `/settings/profile`) ani razu
nie udało się zobaczyć realnej treści ekranu „Połączone aplikacje". Zachowanie jest niedeterministyczne
przy identycznym koncie i identycznej trasie:
- 3× wylądowano na `/admin/integrations`, ale renderowana treść to zupełnie inny ekran: „Przegląd ustawień"
  (dokument taksonomii ustawień), nie lista połączonych aplikacji;
- 3× wylądowano na `/admin/security/security-policy` (kompletnie inny moduł);
- 2× URL pozostał poprawny (`/settings/integrations`), ale strona wyrenderowała się pusta/biała.

To wygląda na realny błąd wyścigu (race condition) w warstwie routingu (prawdopodobnie `RouterSync.tsx`
i/lub logika przekierowań w `AdminSettingsModule`/pilot-access), nie na brak danych czy ograniczenie
środowiska. Zasługuje na osobne zgłoszenie inżynierskie — obraz zatwierdzony dla tego ekranu
(`evidence/grafika/216-poprawione-dzis/mini-ustawienia-integracje__PO__light.png`) nie mógł zostać
porównany z realną aplikacją.

## Ekrany zgodne (5)
ustawienia-personalne, ustawienia-workflow (właściwy cel to subpozycja „Panel" pod grupą Preferencje
pracy, nie strona „Work Preferences" — poprawiono po pierwszej pomyłce nawigacyjnej), ustawienia-ai-automatyzacja,
ustawienia-dane-prywatnosc, ustawienia-wyglad — wszystkie 1:1 z obrazami zatwierdzonymi (uwzględniając
zaakceptowane wyjątki: angielski język konta testowego, crimson-dekoracyjne ikony nagłówków, puste
podglądy motywu identyczne z obrazem).

## Czas i trudności
- Pierwsza pomyłka: „ustawienia-workflow" początkowo nawigowano pod `/settings/work-preferences` (nazwa
  grupy w `gdzie`), ale docelowy ekran to subpozycja „Panel" w tej grupie — poprawiono po zobaczeniu,
  że treść referencyjna to dashboard-preferencje, nie work-preferencje.
- App renderuje się czasem po polsku, czasem po angielsku między kolejnymi świeżymi kontekstami przeglądarki
  mimo tego samego `storageState` — utrudniało to dobór selektorów `text=` do klikania (zawodne), stąd
  wolano nawigację po bezpośrednich trasach z `routeConfig.ts`.
- Case „integracje" wymagał 8 prób zanim uznano wzorzec za powtarzalny błąd, nie przypadkową usterkę sieci.
- Czas: ok. 30 minut.
