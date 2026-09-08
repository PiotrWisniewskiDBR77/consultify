# DOWÓD PACZKI ZZ — komponenty wspólne i bootstrap i18n

Program: `docs/program/JEZYK_EN_PL_20260908/PLAN.md`. Wzór dowodu: `evidence/jezyk-j1/`, `evidence/jezyk-j7/`.

## STANOWISKO (odbiega od zlecenia — powód niżej)

| | zlecenie | faktycznie | dlaczego |
| --- | --- | --- | --- |
| API | 4201 | **4202** | port 4201 był **zajęty przez cudzy proces** (PID 89094, `DB_NAME=consultify_kopia_final`, uruchomiony 22:30 przez inną paczkę). Mój serwer nie mógł wstać i padał z pustym błędem; do czasu wykrycia moje zapytania szły przez CUDZY serwer. |
| Vite | 3219 | 3219 | zgodnie ze zleceniem, proxy przepięte na 4202 |
| baza | `consultify_kopia_final` | **`consultify_jzz`** (kopia `pg_dump`) | na wspólnej bazie równolegle pracował `scripts/dev/jezyk-j9/zrzuty-j9.mjs`, który robi `UPDATE users SET language=…` na **tym samym koncie** `audyt@dbr77.local`. Pierwszy przebieg złapał cudzy `UPDATE` w locie i pokazał „polską powłokę na koncie EN" — to był **artefakt kolizji, nie defekt produktu**. |

Wniosek metodyczny: **pomiar języka na koncie współdzielonym z inną paczką jest bezwartościowy.**
Kopia bazy `consultify_jzz` powstała `pg_dump | psql` (295 MB) i jest usuwalna.

## 1. WYŚCIG BOOTSTRAPU — co naprawdę się dzieje

Narzędzie: `scripts/dev/jezyk-jzz/wyscig-bootstrapu.mjs <przed|po> <scenariusz>`.
Próbki `document.body.innerText` w **300 ms / 1 s / 3 s** od `domcontentloaded` **i po pełnym
załadowaniu** — bo szkielet ładowania nie jest dowodem w żadną stronę.

Trzy scenariusze, bo jeden by skłamał:

| scenariusz | co ustawia | po co |
| --- | --- | --- |
| `lepki` | `i18nextLng='en'` w localStorage, navigator `en-US` | stan użytkownika, który już raz wybrał EN |
| `swieza` | **brak** `i18nextLng`, navigator **`pl-PL`**, konto `users.language='en'` | pierwsze wejście konta EN na nowej przeglądarce: konto gra przeciwko przeglądarce |
| `wolne-locale` | jw. + opóźnienie `**/locales/**` o 3 s | `en/translation.json` waży **1,9 MB**; na localhoście idzie z dysku w milisekundach, u użytkownika przez sieć w sekundach |

### Wynik PRZED (konto `users.language='en'`, wszystkie zrzuty w `przed-*/`)

* **`swieza`** — powłoka startuje na `lng=pl` (detektor: navigator `pl-PL`) i stoi tak przez
  **całe pierwsze 3 s** ekranu Czatu; na `en` przechodzi dopiero po powrocie `/auth/me`.
  Polskich napisów sonda nie liczy, bo w tym oknie ekran jest jeszcze szkieletem — **to nie jest
  dowód, że wyścigu nie ma, tylko że na localhoście nie zdążył się pomalować.**
* **`wolne-locale`** — ten sam wyścig z realną prędkością sieci pokazuje **polski interfejs
  na koncie EN**, `lng=en`, po pełnym załadowaniu ekranu:
  `Przejdź do głównej treści` · `Czat AI` · `Przejdź do pola wiadomości` ·
  `Dobrze Cię widzieć, Audyt.` · `Rozmawiaj głosem`, a na Materiałach nagłówki tabeli
  `TYTUŁ` · `ŹRÓDŁO`.

### Mechanizm (dwie różne przyczyny, nie jedna)

1. **`src/i18n.ts:165` `react.useSuspense: false`** — powłoka maluje się, **nie czekając** na
   `translation.json`. Do czasu dojścia pliku `t('klucz', 'Polski tekst')` zwraca `defaultValue`
   **z kodu**, a takich polskich defaultów jest w repo **1046** (`K1def`). Dlatego konto EN
   z poprawnym `lng=en` i tak widzi polski — **plik jest w drodze, nie brakuje tłumaczenia**.
2. **`src/i18n.ts:150` `detection.order: ['localStorage','navigator','htmlTag']`** — o pierwszy
   render języka gra **przeglądarka**, a `users.language` dochodzi dopiero po `/auth/me`
   (`src/App.tsx:378` → `syncLanguageFromAccount`). W świeżej przeglądarce z `navigator=pl-PL`
   konto EN dostaje polską powłokę na cały czas trwania tego zapytania.
