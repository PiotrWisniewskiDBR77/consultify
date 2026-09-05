# Raport — pakiet 13 (Administracja)

Liczby: ZGODNY 26 / ROZNI_SIE 12 / NIE_DOTARLEM 3 (na 41 ekranów)

## Nie dotarłem (3) — brak uprawnień
`superadmin-platform-operations-day15`, `partner-settlements-view`, `model-catalog-table` — wszystkie trzy
żyją pod `/superadmin/*`. Konto testowe (Owner organizacji DBR77) NIE ma roli SuperAdmin — każda próba
wejścia pod `/superadmin` lub `/superadmin/*` przekierowuje natychmiast na `/chat`. Zweryfikowano realnie
(nie zgadywano): 3 niezależne próby nawigacji, wszystkie z tym samym skutkiem.

## Realne błędy (nie tylko brak danych demo)
1. **admin-ai-personas** — czerwony baner „Failed to fetch system prompts" (po angielsku) blokuje wczytanie
   całej listy person; sekcja jest zupełnie pusta zamiast pokazać 3 persony z obrazu. To aktywny błąd
   pobierania danych, nie pusty stan demo.
2. **admin-billing-seats-licences** — podsumowanie liczbowo sprzeczne: „Łącznie: 0" przy „Zajęte: 8",
   „Wolne: 0" i „Wykorzystanie: 0%" (matematycznie niemożliwe — 8 zajętych przy 0 łącznie powinno dać
   >100%, nie 0%). Wygląda na błąd obliczenia salda miejsc.
3. **admin-health-dependencies / admin-health-incident-history** — podtytuł strony i breadcrumb „Health"
   pozostają PO ANGIELSKU mimo że reszta interfejsu (nagłówki kart, opisy) jest po polsku — stały element
   interfejsu nieprzetłumaczony w całej rodzinie ekranów Health.

## Obserwacja ogólna — przejściowa niestabilność środowiska
W trakcie sesji dwukrotnie napotkano przejściowe usterki środowiska deweloperskiego, niezwiązane z
konkretnym ekranem:
- Błąd kompilacji Vite („Identifier 'MoreVertical' has already been declared" w `RowActionsMenu.tsx`) —
  pojawił się i sam ustąpił w ciągu ok. 1 minuty; prawdopodobnie inny proces edytował ten plik współbieżnie
  na tym samym środowisku (repo współdzielone). 7 zrzutów z tego okna trzeba było powtórzyć.
- Jedna próba wczytania `admin-command-audit` pokazała krótkotrwały błąd „HTTP 404 Not Found" z całym
  interfejsem po angielsku — kolejna próba (kilka sekund później) wczytała się poprawnie po polsku. Ten sam
  wzorzec (język PL/EN losowo między świeżymi wczytaniami tej samej trasy) obserwowano też w pakiecie 18.
  To wygląda na wyścig przy starcie aplikacji (i18n/dane ładują się nie zawsze w tej samej kolejności),
  a NIE na trwały defekt konkretnego ekranu — każdy dotknięty ekran po ponownym wczytaniu wyglądał
  poprawnie. Warto to zgłosić osobno jako problem stabilności bootstrapu, niezależnie od odbioru ekranów.
- Kilkanaście zrzutów (szczególnie w rodzinach Team/Security/Health/AI) wymagało wydłużenia czasu
  oczekiwania z 2,2s do 5–9s — przy krótszym czasie łapano stan „szkielet ładowania" (skeleton) zamiast
  gotowej treści. Nie jest to defekt produktu, tylko właściwość narzędzia pomiarowego przy współbieżnym
  obciążeniu środowiska.

## Wzorzec różnic (11 z 12 ROZNI_SIE)
Zdecydowana większość różnic to ten sam wzorzec: układ, nagłówki kolumn i treść opisowa ZGODNE z obrazem,
ale tabela pokazuje dobrze zaprojektowany PUSTY STAN zamiast 2–5 przykładowych wierszy z obrazu
(`admin-team-invitations`, `admin-team-roles-permissions`, `admin-team-teams`, `admin-team-guests-external`,
`admin-security-sessions`, `admin-security-domains`, `admin-security-service-accounts`,
`admin-security-break-glass`). Przyczyna: ta organizacja testowa (DBR77 / Piotr Wiśniewski) po prostu nie ma
zaseedowanych rekordów w tych konkretnych tabelach — to różnica DANYCH, nie UI, ale zgodnie z instrukcją
(„pusty stan tam, gdzie obraz miał treść" = różnica) każdy taki przypadek jest wypisany osobno.

## Pozytywne obserwacje (naprawione od czasu akceptu)
- `admin-audit-legal-hold`: tytuł ekranu jest teraz w pełni po polsku „Wstrzymanie prawne" — obraz
  zatwierdzony miał znany, udokumentowany wyjątek „Tytuł po angielsku" (Legal hold). Wygląda naprawione.
- `admin-command-attention-queue`: kolumna „Źródło" pokazuje czytelne nazwy („Dziennik audytu", „Rozliczenia
  i budżet") zamiast surowych adresów API (`GET /api/admin/health-panel/summary`) — znany wyjątek z 01.09
  (fala 174) wygląda naprawiony. Znany błąd „Ryzyka wymagające przeglądu zawsze 0" NADAL WYSTĘPUJE
  (potwierdzone, nienaprawione).
- `admin-sso-self-service-card`: karta „Konfiguracja SSO (SAML/OIDC)" jest w pełni widoczna i funkcjonalna,
  wbrew uwadze w pakiecie że jest za domyślnie wyłączoną flagą.

## Czas i trudności
Największą trudnością było zmapowanie 41 nazw ekranów na realne trasy `/admin/<domena>/<ekran>` —
rozwiązane przez przeczytanie `src/components/Admin/adminNavigation.ts` (mapa domena→ekran) zamiast
klikania przez UI (dużo szybsze i bardziej niezawodne niż `--klik` po tekście, który zawodził przy
przełączających się losowo językach PL/EN interfejsu). Druga trudność: odróżnienie realnych defektów od
przejściowych usterek współdzielonego środowiska (patrz sekcja wyżej) — rozwiązane przez każdorazowe
ponowienie próby przy podejrzanym wyniku. Czas: ok. 2,5 godziny.
