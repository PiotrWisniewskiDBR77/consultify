# RUNDA 3 — 18-ustawienia (05.09, po naprawach)

Staging (backend realnej aplikacji): gitSha `b852ade6164e0dec755ea3ae0c59ec2f7ca3dc04` — starszy niż próg `5ffdabe05e`, naprawy SERWEROWE (persony AI, licencje) jeszcze nie wdrożone. Żaden z 2 moich ROZNI_SIE nie zależał jednak od serwera.

| id | werdykt rano | werdykt teraz | jedno zdanie |
|---|---|---|---|
| ustawienia-powiadomienia | ROZNI_SIE | **ZGODNY** | Błąd konsoli 501 zniknął (naprawa „Powiadomienia bez 501"); reszta była już zgodna. |
| ustawienia-zaawansowane | ROZNI_SIE | **ZGODNY** | „Funkcje beta" i „Historia" SĄ w sidebarze — poprzedni zrzut (viewport 900px bez przewinięcia własnego scrollowalnego menu) fałszywie sugerował ich brak; po przewinięciu widać pełny komplet zgodny z obrazem. |

## Liczby
- ZGODNY: 2
- ROZNI_SIE: 0
- NOWY_WZORZEC / DECYZJA / CZEKA_NA_SERWER: 0

## Uwaga metodyczna (własna pomyłka poprzedniej rundy skorygowana)
`ustawienia-zaawansowane` był oznaczony ROZNI_SIE („brakuje Funkcje beta") w rundzie 1 na podstawie zrzutu przy standardowym viewport 900px. Sidebar Ustawień ma własny przewijany kontener (`overflow-y-auto`) niezależny od strony — przy 5 pozycjach w grupie „Zaawansowane" dwie ostatnie („Funkcje beta", „Historia") wypadały poza widoczny obszar bez przewinięcia. Sprawdzenie DOM (`page.getByText('Funkcje beta').count()`) potwierdziło, że pozycja istnieje i renderuje się poprawnie z plakietką „Beta" — kod w `src/components/settings/SettingsSidebar.tsx:471-478` jest kompletny i bezwarunkowy dla użytkownika nie-pilota. To przypadek „przyrząd chowa, nie produkt" — narzędzie zrzutu ucięło ekran, nie aplikacja ukryła element.

## Czas i trudności
Ok. 15 minut. Jedyna trudność: odkrycie, że różnica w `ustawienia-zaawansowane` była artefaktem pomiaru (brak przewinięcia bocznego menu), nie realnym defektem — wymagało dodatkowego sprawdzenia DOM zamiast polegania wyłącznie na zrzucie o stałej wysokości 900px.
