# D-17 — plakietka „3 V9 overrides" na każdym ekranie: PREMISA NIE POTWIERDZONA

**Wniosek: to nie jest defekt produktu. To element widoczny WYŁĄCZNIE na
serwerze deweloperskim Vite — a taki serwer był stanowiskiem testu TEST-DANE.**
Zero zmian w kodzie. Poniżej pomiar, nie opinia.

## Co zgłosił raport
> Stała plakietka „3 V9 overrides" w prawym dolnym rogu — element deweloperski
> widoczny na każdym ekranie produktu (70/70).
Zlecenie kazało dodatkowo zmierzyć, „czy na stagingu (produkcyjny build) też
się pokazuje" — raport twierdził, że TAK.

## Co renderuje plakietkę
`src/components/Admin/ChatV9FlagsIndicator.tsx` (montowany w `src/App.tsx:468`).
Ma trzy bramki, wszystkie sprawdzane przed renderem:
1. rola (admin/owner — `isV9FlagsOverlayAuthorized`),
2. liczba nadpisanych flag > 0,
3. `shouldShowDebugOverlays()` z `src/utils/debugOverlays.ts`, czyli
   `import.meta.env.DEV || isDebugOverlaysOptedIn()` (`?debug=1`).
Bramkę nr 3 dołożono 2026-09-05 dokładnie po to, żeby plakietka nie brudziła
zrzutów odbiorczych. Druga plakietka („LOCAL @<sha>", `EnvironmentBadge.tsx`)
chodzi za tą samą bramką.

## Pomiar 1 — co robi produkcyjny build (dowód w kodzie wynikowym)
`vite build --mode staging` z tym samym kompletem 34 flag `VITE_*` co stanowisko
testu. W wynikowym `assets/App-*.js`:

    function CRe(){return oX()}

`CRe` to skompilowane `shouldShowDebugOverlays`. Człon `import.meta.env.DEV`
zniknął (podstawiony `false` i wycięty), zostało samo `isDebugOverlaysOptedIn()`.
Czyli w buildzie plakietka pokazuje się TYLKO po jawnym `?debug=1`.

Pułapka po drodze (warto zapamiętać): pierwszy build robiłem ze `source
server.env`, a ten plik ma `NODE_ENV=development`. Vite uznał build za
nieprodukcyjny, zostawił `jsxDEV` i `DEV=true` — czyli mierzyłbym własne
skażenie stanowiska. Poprawny pomiar wymaga `unset NODE_ENV`.

## Pomiar 2 — jak buduje się staging/demo
`Dockerfile.api`: `RUN npm run build` (linia 490) wykonuje się w etapie
budowania, gdzie `NODE_ENV` NIE jest ustawiony — `ENV NODE_ENV=production`
pojawia się dopiero w etapie uruchomieniowym (linia 794). `vite build` sam
domyśla `NODE_ENV=production`, więc `DEV=false`. Staging dostaje ten sam
wynik, co pomiar 1.

## Pomiar 3 — obraz (to samo konto, ta sama baza, ten sam kod)
| plik | czym serwowane | plakietki |
|---|---|---|
| `przed/jasny.png`, `przed/ciemny.png` | serwer deweloperski Vite (port 3229) | „3 V9 overrides" **i** „LOCAL @996d9145910b" widoczne |
| `po/jasny.png`, `po/ciemny.png` | produkcyjny build podany przez API (port 4211) | **żadnej plakietki** |

## Dlaczego raport zobaczył ją „na kopii z flagami stagingu"
Bo `--mode staging` na serwerze DEWELOPERSKIM nie zmienia `import.meta.env.DEV`
— tryb i tryb pracy to dwie różne rzeczy. Zestaw flag był stagingowy, ale
serwer dalej był deweloperski.

## Rekomendacja
Nic nie zmieniać. Bramka jest już poprawna i celowa (plakietka ma sens dla
dewelopera). Gdyby właściciel oglądał ekran na serwerze deweloperskim, wystarczy
dodać do adresu `?debug=0`.
