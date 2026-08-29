# CODEX DAY 118 — PROPAGACJA SERWER → PIKSEL

Data: 2026-08-29  
Gałąź: `codex/day118-propagacja-20260829`  
Marker: `86eeb60fb3fd6343536e6a8f0fbddfb63acf5a0e`  
Stan: `FIXED / MUTATION_VERIFIED` dla ekranu statusu AI; `BLOCKED / NOT_AUTHORIZED` dla komunikatu wyceny.

## 0. Tożsamość i stan wejściowy

```text
git merge-base --is-ancestor 86eeb60fb3fd6343536e6a8f0fbddfb63acf5a0e github-backup/codex/m03-admin-20260824
MARKER OK

git -C /private/tmp/cx-day118-propagacja rev-parse HEAD
86eeb60fb3fd6343536e6a8f0fbddfb63acf5a0e

git -C /private/tmp/cx-day118-propagacja status --short | head -3
<brak wyjścia>
```

Na `/` było `34Gi` wolnego. Porty `6001`, `4902`, `4903` były wolne. Tip
`github-backup/codex/m03-admin-20260824` był o jeden commit przed markerem:
`63b5f8e64b docs(day118-120): fala naprawcza 2`; diff obejmował wyłącznie trzy
instrukcje dyżurów 118–120. Start nastąpił dokładnie z markera.

## 1. Baza, migracje i Z30

Kontener `cx-day118-pg`, obraz `pgvector/pgvector:pg16`, port wyłącznie
`127.0.0.1:6001`. Pierwszy pełny przebieg migracji zakończył się
`Postgres migrations complete`; drugi: `Applying migrations: 0`. Seeder Admin
utworzył fixture `W3-ADMIN-OWNER-v1`, `8/8` person i odczytał `863` udane
migracje. W3 w seederze jest progiem minimum: `Number(rb.successful_migrations)
< MIN_MIGRATIONS`.

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%';
(0 rows)
grep ... server/src/Gateway.ts
<0 trafień>
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu podczas testów. Żaden e-mail ani zaproszenie
kalendarzowe nie zostało wysłane.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.

## 2. K1 — własny pomiar obu granic

Status AI:

- `Gateway.ts:775` montuje `superAdminRoutes` pod `/api/superadmin`, a
  `superadmin.routes.ts:1914` udostępnia `/system-health` z mapą OpenRouter i Google;
- `Gateway.ts:803` montuje `systemHealthRoutes` pod `/api/system-health`, gdzie
  istnieją `/services`, `/metrics` i `/alerts`;
- ekran wołał bazowe `Api.getSystemHealth()` → nieistniejące `/system-health`,
  services/metrics bez prefiksu i alerts z błędnym prefiksem `/superadmin`;
- stary pełny runtime pokazał `System health unavailable / The requested API
  endpoint does not exist.`

Wycena:

- licencjonowane `src/components/Finance/**` nie zawierało generycznego toastu;
- rzeczywisty wołacz jest w
  `src/components/Economics/hooks/useFinanceRowActions.ts:624` i redukuje błąd
  do `finance.toast.computeDcfFailed`;
- §D nie licencjonuje zapisu `src/components/Economics/**`.

## 3. K2 — naprawa statusu AI

W `EnterpriseHealthMonitor.tsx` zastosowano dwa istniejące kontrakty:

- `/superadmin/system-health` dla głównego health i mapy dostawców;
- `/system-health/services`, `/metrics` i cały CRUD `/alerts` dla routera
  szczegółowego.

Widget pokazuje teraz pięć jawnych pozycji: OpenRouter, OpenAI, Anthropic, Groq
i Google AI. Nie zmieniono serwera, flag, uprawnień ani domyślnych wartości.
Commity: `9a39cd41d6`, `73cb3bf395`; oba wypchnięte po powstaniu.

## 4. K3 — dowód mutacyjny statusu AI

Pakiet jest czysto komponentowy (`RUN_DB_TESTS=0 MOCK_DB=true`); nie dowodzi
Gateway/DB/auth. Pułapki Z33 (a)–(e) nie leżą na ścieżce runnera, a realny mount
i piksel zweryfikowano osobno pełnym runtime.

```text
cp .../EnterpriseHealthMonitor.tsx .../EnterpriseHealthMonitor.providers.fixed.tsx
<mutacja: stare endpointy i usunięte OpenRouter/Google AI>
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/components/SuperAdmin/EnterpriseHealthMonitor.honesty.test.tsx --retry=0 --reporter=json --outputFile=.../health-provider-mutation-red.json
5 total; 2 passed; 3 failed

cp .../EnterpriseHealthMonitor.providers.fixed.tsx src/components/SuperAdmin/system/EnterpriseHealthMonitor.tsx
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/components/SuperAdmin/EnterpriseHealthMonitor.honesty.test.tsx --retry=0 --reporter=json --outputFile=.../health-provider-mutation-green.json
5 total; 5 passed; 0 failed
git diff --exit-code
DIFF PO PRZYWROCENIU: PUSTY
```

Czerwieniały dokładnie trzy przypadki konsumujące zdrowe payloady i alerty;
dwa sąsiednie przypadki uczciwych stanów awarii pozostawały zielone.

## 5. K4 — nazwy i zakres regresji

Zbiór pełnych nazw przed/po: `5/5` tych samych nazw, delta nazw `0/5`.
Po naprawie `5/5 PASS`. Nie uruchomiono pełnego `tests/unit`: instrukcja odwołuje
się do nieistniejącego `§0.4a`, a czerwony kontrakt Finance jest świadomie
otwarty. Nie przedstawiam zawężonego pakietu jako pełnego korpusu.

## 6. Wycena — czerwony kontrakt i brief

Nowy kontrakt:
`tests/unit/components/Finance/day118ValuationErrorPropagation.contract.test.ts`.

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/components/Finance/day118ValuationErrorPropagation.contract.test.ts --retry=0 --reporter=json --outputFile=.../valuation-boundary-red.json
1 total; 0 passed; 1 failed
```

Sygnatura jest właściwa: test znajduje generyczny toast i brak obsługi
`APPROVED_VERSION_IMMUTABLE` w realnym wołaczu. Commit czerwonego kontraktu:
`0caec88e83`, wypchnięty na backup.

### STOP — komunikat wyceny
Rodzaj: MERYTORYCZNY  
Powód: rzeczywisty wołacz leży poza licencją zapisu §D.  
Licencja, którą sprawdziłem: §D pozwala zapisywać komponent pokazujący błąd w
`src/components/Finance/**`; pomiar wskazał `src/components/Economics/**`.  
Dowód: `useFinanceRowActions.ts:624` i czerwony kontrakt `1/1 FAIL`.  
Co dostarczyłem ZAMIAST zmiany: czerwony kontrakt oraz brief: wołacz powinien
odczytać kod/komunikat odpowiedzi `409`, zachować dokładną przyczynę i zalecenie,
a generyczny fallback stosować tylko bez bezpiecznego komunikatu serwera.  
Co zrobiłbym po decyzji X: po rozszerzeniu licencji zmieniłbym wyłącznie catch
akcji `computeDcf`, dodał PL/EN, uruchomił red→green i zrzuty `/finance`.  
Rekomendacja: osobny mały commit w `useFinanceRowActions.ts` plus tłumaczenia.  
Stan: czerwony kontrakt zacommitowany w `0caec88e83`; produkt niezmieniony.  
Czy kontynuowałem pozostałe pozycje: TAK — status AI ukończony.

## 7. K5 — cztery zrzuty statusu AI

Pełny produkt, ta sama fixture i ekran, dwa stany × dwa motywy:

```text
02dc920919c66cd97b1076a12373e23db5ec95475771f3fb92a164068a3195f8  /private/tmp/cx-day118-propagacja-artefakty/before-dark.png
3d63b8869358d308c005c1d86e704f7650bc1bf462499efa10c8b937df54aa62  /private/tmp/cx-day118-propagacja-artefakty/before-light.png
73d643b81e257d6870d6597a5608a386c371ed300499a0972dcdaeec46cf5ee3  /private/tmp/cx-day118-propagacja-artefakty/after-dark.png
d79194c2995974a97b41d96a7b4574e8f0e8e4f7adb3df3ede24ed31fec2f0d0  /private/tmp/cx-day118-propagacja-artefakty/after-light.png
```

Przed: uczciwy błąd nieistniejącego endpointu. Po: ekran działa i jawnie
pokazuje OpenRouter oraz Google AI jako `Not configured` w bezkluczowym runtime.
K5 dla ekranu AI: `4/4`. K5 dla wyceny: `0/4`, bo produkt nie został zmieniony.

## 8. Korekty wobec instrukcji

1. Instrukcja odwołuje się do nieistniejących `§0.4a`, `§0.3`, „BLOKU 0” i
   „tabeli licencji”. Zastosowano literalne §D/Z40 i własne mianowniki.
2. Teza, że services/metrics mają zły prefiks, została obalona: właśnie te dwa
   wywołania były zgodne z `Gateway.ts:803`; błędne były base health i alerts.
3. Samo skierowanie wszystkiego pod jeden prefiks także byłoby błędne. Ekran
   wymaga dwóch istniejących routerów; potwierdził to pełny runtime.
4. Teza, że wołacz wyceny mieści się w `src/components/Finance/**`, została
   obalona; realny plik jest w `src/components/Economics/**`.

## 9. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano produkcji, demo, stagingu ani Railway; Z28 tego zabrania.
- Nie wywołano żadnego modelu i nie ustawiono kluczy AI; status `configured`
  dla realnego klucza nie był wizualnie testowany.
- Nie naprawiono komunikatu wyceny ani nie wykonano jego zrzutów, ponieważ
  rzeczywisty plik produktu nie był licencjonowany.
- Nie uruchomiono pełnego korpusu `tests/unit`; nie ma podstaw do twierdzenia o
  globalnej delcie nazw.
- Nie wykonano owner acceptance ani nie podniesiono G08–G10.

## 10. Stan końcowy i sprzątanie

`FIXED / MUTATION_VERIFIED / 4 OF 4 SCREENSHOTS` — status AI.  
`BLOCKED / NOT_AUTHORIZED / RED CONTRACT` — komunikat wyceny.  
`NOT VERIFIED` — środowiska zdalne i owner acceptance.

Runtime został zatrzymany, jego grupy procesów zakończone, porty `4902/4903`
zwolnione. Końcowe sprzątanie:

```text
docker rm -fv cx-day118-pg
cx-day118-pg
PORT 6001 WOLNY
PORT 4902 WOLNY
PORT 4903 WOLNY
```

Wolumen i obie lokalne bazy dyżuru zostały usunięte wraz z należącym do niego
kontenerem. Artefakty dowodowe poza repo pozostawiono do odbioru nadzorcy.
