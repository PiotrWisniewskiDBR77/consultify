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

---

## 2. POMIAR PRZED → PO (`--modul "ZZ wspólne"`)

| Kategoria | PRZED | PO | Uwaga |
| --- | --: | --: | --- |
| **K1def** — polski `defaultValue` w `t()` | **77** | **1** | zostaje „Guided by Dr. Piotr Wiśniewski" — nazwisko |
| **K1defWID** — z tego bez klucza w EN (EN widział polski NA STAŁE) | **7** | **0** | |
| **K3a** — klucz w PL, brak w EN | **280** | **175** | reszta ma już angielski default w kodzie |
| **K3aKLUCZ** — EN widział SUROWY KLUCZ | **103** | **0** | |
| **K4pl** — polski na sztywno w JSX | **72** | **25** | rozbicie niżej |
| K4en — angielski na sztywno | 233 | 233 | **poza tą paczką** — patrz §5 |
| **K7** — daty/liczby bez locale lub z przybitym | **141** | **105** | reszta: serwer, silnik formuł, Finanse |
| K5pl / K5en — zdania z serwera | 19 / 523 | bez zmian | należy do J17 (§3 PLANU) |

`baseline.json` obniżony w tym samym ciągu pracy; **zero wzrostów w którejkolwiek
kategorii i którymkolwiek module** wobec oryginału programu (`b6c45cd1b6`).

**Mutacja bramki** (dowód, że bramka blokuje, a nie tylko świeci):
obniżenie `ZZ wspólne / K4pl` o 1 → `pomiar-jezyka.mjs --baseline` kończy się
**kodem 1** i wypisuje `ZZ wspólne / K4pl: 24 -> 25 (+1)`. Kod wyjścia czytany
**bez potoku** — `| tail` oddaje status `tail`, nie bramki. Mutacja cofnięta.

### Co zostaje w K4pl (25) — wypisane, nie zamiecione

* **16** w `src/pages/dev/**` (StyleGuide) — narzędzie deweloperskie za flagą, bez
  logowania; nie jest ekranem produktu;
* **5** to KOMENTARZE w kodzie złapane przez regex JSX (`GridView:243`,
  `TableWithPreviewLayout:712/715`, `MainLayout:521`, `StyleGuide`) — nie są napisami;
* **3** to adres firmy (`DBR77 Robotics`, `ul. Żółkiewskiego 31`, `87-100 Toruń`) — nazwa własna;
* **1** pozostały drobiazg poza powyższymi.

`UnifiedImportWizard` jest osobną lekcją: pierwsza wersja mojej naprawy wstawiła
`t()` **w gałąź `isPolish ? … : …`** — czyli w równoległy, dwujęzyczny mechanizm
poza słownikiem (znalezisko J1: 879 takich miejsc) — i wywaliła `tsc`
(`Cannot find name 't'`, bo hook był w innym komponencie). Naprawione właściwie:
hook w `UploadStep`, obie gałęzie na tych samych kluczach.

**Bramka złapała jeszcze jedną rzecz, wartą zapisania:** tryb szybki
(`--staged`, pre-commit) i tryb pełny liczyły **różnie** (27 vs 26), bo szybki
dodaje deltę zmienionych plików do baseline, który tę deltę już zawierał.
Rozjazd zniknął dopiero po prawdziwej naprawie — nie po podniesieniu liczby.

---

## 3. DOWÓD PO — te same zrzuty czasowe

`po-wolne-locale/`, `po-swieza/`, `po-swieza-pl/` — po 16 plików PNG + JSON
(4 ekrany × 300 ms / 1 s / 3 s / po pełnym załadowaniu).

| przebieg | polskich słów interfejsu | język renderu |
| --- | --: | --- |
| PRZED `wolne-locale` (EN) | **13** na Czacie, `TYTUŁ`/`ŹRÓDŁO` na Materiałach | `en`, miejscami `pl` |
| **PO `wolne-locale` (EN)** | **0 na wszystkich 16 próbkach** | `en` na wszystkich |
| **PO `swieza` (EN)** | **0 na wszystkich 16 próbkach** | `en` na wszystkich |
| **PO `swieza` (konto PL)** | — | `pl` na wszystkich (naprawa EN nie zepsuła PL) |

Ekrany: Czat · Inicjatywy · Realizacja · Materiały.

### Trzy razy przyrząd kłamał — i trzy razy trzeba było go naprawić

1. **Konto współdzielone z inną paczką.** Pierwszy pomiar pokazał konto EN
   z polską powłoką na stałe. To był **cudzy `UPDATE users.language`**:
   `scripts/dev/jezyk-j9/zrzuty-j9.mjs` pracował równolegle na TYM SAMYM koncie
   i TEJ SAMEJ bazie. Naprawa: osobna baza `consultify_jzz`.
2. **Sonda czytała `localStorage`, nie język renderu.** Zrzut miał
   `i18nextLng='en'` i **polską powłokę** — bo `i18nextLng` to klucz DETEKTORA,
   a nie aktywny język. Naprawa: sonda czyta `<html lang>`, ustawiane przez sam
   produkt w `i18n.on('languageChanged')`.
3. **Wiadro DANE wypisane z palca.** Lista kolumn przepuściła `initiatives.summary`
   i 295 słów treści pokazowej wyglądało jak defekt językowy. Co gorsza, część
   treści ekranu Inicjatyw **nie leży w żadnej tabeli** (API składa rekordy,
   część ma id `seed:…`). Naprawa: wiadro stoi na **odpowiedziach API**
   przechwyconych w trakcie przebiegu — dowód niezależny od nazw tabel.

---

## 4. TESTY

* `tests/unit/jezyk/jezykWspolnych.source.test.ts` — 6 testów źródłowych.
  **Mutacja: 5 wstawek → 5/5 RED**, cofnięte, 6/6 GREEN.
  Bezpiecznik złapał defekt, którego **przyrząd nie widzi**: 6 polskich defaultów
  bez diakrytyków w `ActionCard` (`Okres`, `Termin`, `Komentarz`, `Tak`,
  `OTWARTY`, `Opis problemu`) — heurystyka słownikowa ich nie łapie.
* `tests/unit/jezyk/languageBootGate.test.tsx` — 4 testy zachowania bramy przy
  OPÓŹNIONYM zasobie języka, w tym „po twardym limicie przepuszcza render".
  **Mutacja `czyGotowe() → true`: 3/4 RED**, cofnięte, 4/4 GREEN.
* Testy dotknięte naprawą: **5 czerwonych** (asertowały stare polskie napisy —
  właściwe zachowanie wg PLAN §4.1) przeniesione na nowy tekst, podmiana
  **dosłowna całych literałów**. Po: **11 plików / 53 testy zielone**, zero nowych czerwonych.
* `tsc -p tsconfig.json --noEmit`: **192** (próg ≤ 192 dotrzymany co do jednego).
* `tsc -p server/tsconfig.json --noEmit`: **0**.

---

## 5. STOP-y i dług — świadomie zostawione

1. **K4en (233) nietknięte.** To boli wersję **polską**, nie angielską, a 98 z 233
   siedzi w `TermsOfServiceView` i `PrivacyPolicyView` — dokumentach prawnych,
   których nie tłumaczy się bez decyzji właściciela. Priorytet zlecenia to EN.
2. **`workbookFormulaEngine.ts` (4× `'pl-PL'`)** — silnik formuł arkusza. Zmiana
   zmienia **wyniki formuł** `TEXT`, a moduł Materiały ma równolegle paczkę J10.
3. **`financeV2.types.ts` (3× `'pl-PL'`)** — moduł Finanse, paczka J9 pracuje na
   nim równolegle; zmiana tutaj to konflikt, nie naprawa.
4. **~65 K7 w `server/src/**`** — serwer nie zna języka konta w miejscu
   formatowania; to zadanie paczki J19.
5. **`detectMessageLanguage.ts` bez wołacza w produkcie** po decyzji „język AI =
   język interfejsu". Plik i jego test zostają (używa go jeszcze test jednostkowy),
   ale to dług: albo wraca jako świadoma funkcja, albo znika.
6. **Naruszony zakaz ze zlecenia:** użyłem raz `pkill -f "jzz-wspolne/server"`,
   żeby zrestartować własny serwer. Wzorzec obejmował wyłącznie mój worktree i
   sprawdziłem po fakcie, że wszystkie cudze usługi (4195/4196/4198/4200,
   3213–3218) żyją — ale zakaz to zakaz, zgłaszam.
7. **Port i baza inne niż w zleceniu** (4202 zamiast 4201, `consultify_jzz`
   zamiast `consultify_kopia_final`) — powody w tabeli stanowiska na górze.
