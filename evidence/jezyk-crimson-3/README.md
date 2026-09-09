# JEZYK-CRIMSON-3 — dowod wzrokiem (DEC-453, 09.09)

Trzy miejsca, w ktorych naprawa jezykowa (J4/J15/J-DOG-C) byla zablokowana
przez hook `check-triada` (linia z crimsonem = nowe naruszenie kanonu).
Wlasciciel zgodzil sie na zmiane koloru **wylacznie w tych trzech liniach**
(nie w calych bokserach), zeby odblokowac tlumaczenie. Efekt: kazdy z trzech
kafelkow ma teraz **niespojny kolor** (reszta kontenera zostaje crimson) —
to swiadoma, waska decyzja, nie przeoczenie; opisana ponizej i w kodzie
(komentarze `ODMROZENIE ... DEC-453` przy kazdej linii).

Zrzuty: `node scripts/dev/jezyk-crimson-3-zrzuty.mjs <katalog> <przed|po>`,
dev-render harness (`npx vite --config dev-render/vite.config.ts --port 3020`),
Playwright headless, 1440x900, `en`/`pl` x `light`/`dark` = 16 plikow na stan
(`przed/`, `po/`).

## 1. WebAuthnSettings.tsx — "What are passkeys?"

**STOP wazniejszy niz kolor:** ten komponent **nie ma ani jednego importera**
w `src/` (grep na `WebAuthnSettings` poza plikiem wlasnym: 0 wynikow; nie jest
tez w barrelu `components/settings/security/index.ts`). Nie da sie do niego
dojsc zadna nawigacja zywej aplikacji — dlatego zrzuty montuja go STANDALONE
(`dev-render/screens/ustawienia-bezpieczenstwo-webauthn.tsx`), zgodnie z
CLAUDE.md #7 ("dev-render/harness z mock-danymi, bez logowania Piotra").

| | bylo | jest |
| --- | --- | --- |
| tekst | `What are passkeys?` na sztywno (angielski, nawet dla konta PL) | `{t('settings.webauthn.whatArePasskeysTitle', 'What are passkeys?')}` — PL: "Czym są klucze dostępu?" |
| kolor etykiety | `text-c-accent` (crimson #85182F) | `text-c-info` (niebieski, semantyka "info" wg `TRIADA_KANON.md` czesc C) |
| kontener/ikona tego samego boxa | `bg-c-accent-soft border border-c-accent`, `text-c-accent` | **zostaja crimson** — swiadomie, poza zakresem (patrz STOP nizej) |

**Token:** `c-info` — wybrany bo (a) to dokladnie semantyka z kanonu dla
"informacyjnego" komunikatu (`--c-info` niebieski, TRIADA_KANON.md:196), (b)
sasiedni poprawny wzor tego samego typu boxa w repo:
`src/components/Organization/GovernedContextWorkspace.tsx:717`
(`border-c-info/40 bg-c-info/5`) i link informacyjny
`src/components/Organization/redesign/OrganizationReadinessScreen.tsx:402,469`
(`text-c-info hover:underline`).

**Hook:** `check-triada.sh` — 0 naruszen po naprawie (linia dotknieta jest
poza `VIOL_RE`/`c-accent`).

**STOP dla wlasciciela:** cala reszta Info Boxa (kontener rozowy/crimson,
ikona Fingerprint crimson) zostaje nietknieta — widac to na zrzucie jako
niebieski naglowek w rozowym pudelku. Naprawa calego boxa wymaga osobnej
decyzji (poza "trzema miejscami" tego zlecenia). Powazniejszy STOP: caly
komponent jest martwym kodem — do rozstrzygniecia, czy podpiac go gdzies
w Ustawieniach, czy usunac.

Zrzuty: `1-webauthn-passkeys-{przed,po}-{en,pl}-{light,dark}.png` (motyw dark
tego ekranu renderuje sie jasno tlem `bg-c-bg` harnessu — sam komponent nie
ma wlasnych stylow zaleznych od `.dark` w tej czesci, wiec zrzut dark != inny
wyglad tej linii, ale plik istnieje dla kompletnosci macierzy).

## 2. CustomTrendCard.tsx (Megatrend) — "Add to the list?"

Osiagalny na zywo (`MegatrendsWorkspace.tsx` → `/discovery-tools/strategic/megatrends`),
ale automatyczna nawigacja w tej sesji trafila na bramke dostepu (przekierowanie
do `/interview`) — dla spojnosci z pozostalymi dwoma miejscami zrzuty tez
montuja go STANDALONE (`dev-render/screens/megatrend-custom-trend-card.tsx`).

| | bylo | jest |
| --- | --- | --- |
| tekst | `Add to list?` na sztywno (angielski, nawet dla konta PL) | `{t('megatrends.custom.addToList', 'Add to the list?')}` — klucz **juz istnial** w obu `translation.json` (przygotowany przez J4), tylko nie byl uzyty w JSX; PL: "Dodać do listy?" |
| kolor | `text-c-accent` (crimson) | `text-c-info` (niebieski), wzorem `OrganizationReadinessScreen.tsx` |

**Token:** `c-info` — ten sam wybor co miejsce 1, dla spojnosci calej paczki
(crimson → "to bylo niebieskim linkiem, tylko owinietym w zly token").

**Hook:** `check-triada.sh` — 0 naruszen.

Jedyne miejsce z trzech, gdzie fix jest **kompletny** (caly element to jeden
przycisk, bez sasiedniego kontenera/ikony w tym samym crimson — patrz zrzuty,
brak niespojnosci kolorow).

Zrzuty: `2-megatrend-add-to-list-{przed,po}-{en,pl}-{light,dark}.png`.

## 3. DBR77ReportTemplate.tsx — "AUTOMATYZUJ" / "Stanowisk"

**STOP wazniejszy niz kolor:** metoda DBR77 Lean 4.0 ma
`status: 'coming_soon'` w `src/services/frameworkRegistry.ts` (Decision D-B:
"beta placeholder in v1 — shown honestly as coming soon and NOT startable
until the structure/report are wired"). Raportu **nie da sie wygenerowac
zadna zywa sciezka aplikacji** — zrzuty montuja `<DBR77ReportTemplate>`
STANDALONE z reczna atrapa danych zgodna z ksztaltem `DBR77AssessmentData`
(`dev-render/screens/assessment-dbr77-report.tsx`).

### 3a. Kafelek "Stanowisk" (Executive Summary, ~linia 404)

| | bylo | jest |
| --- | --- | --- |
| tekst | `Stanowisk` na sztywno (polski, nawet dla konta EN) — znany dlug od J5 | `{t('assessment.reportTemplates.dbr77.workstations', 'Workstations')}` — klucz **juz istnial** w obu jezykach (przygotowany wczesniej), tylko nie byl uzyty w tym miejscu JSX |
| kolor etykiety | `text-primary-600/70` (crimson) | `text-teal-600/70` |
| kontener + wartosc liczbowa tego samego kafelka | `bg-primary-50 dark:bg-primary-900/20`, `text-primary-600` | **zostaja crimson** — swiadomie |

### 3b. Naglowek fazy 3 "AUTOMATYZUJ" (per-workstation, ~linia 227)

| | bylo | jest |
| --- | --- | --- |
| tekst | `AUTOMATYZUJ` na sztywno (polski, nawet dla konta EN) | `{t('assessment.dbr77.report.automate', 'AUTOMATE')}` — nowy klucz, EN "AUTOMATE" / PL "AUTOMATYZUJ" (wzorem juz istniejacych `measure`="MEASURE"/"POMIERZ", `optimize`="OPTIMIZE"/"ZOPTYMALIZUJ") |
| kolor naglowka | `text-primary-900 dark:text-primary-300` (crimson) | `text-teal-900 dark:text-teal-300` |
| kontener + ikona Cpu tego samego boxa | `bg-primary-50 dark:bg-primary-900/20`, `text-primary-600` | **zostaja crimson** — swiadomie |

**Token:** `teal` (nie `c-info`, bo ten plik uzywa surowych klas Tailwind
`blue-*`/`green-*`/`amber-*`/`emerald-*` per faza/kafelek, nie tokenow `c-*`).
Wybrany bo `DRDReportTemplate.tsx` (ten sam katalog `reports/templates/`,
ta sama rodzina raportow Assessment) **juz dokumentuje** teal jako
sankcjonowany zamiennik crimson w tej rodzinie: komentarz w naglowku pliku
"Aesthetic: clean, airy, slate/blue/teal ... NO crimson (`primary-*`)
classes." Faza 1=blue (MEASURE), faza 2=green (OPTIMIZE) — teal jest trzecim,
odroznialnym kolorem dla fazy 3, spojnym z reszta rodziny.

**Hook:** `check-triada.sh` — 0 naruszen na dotknietych liniach. `check-triada
--all` (ratchet calego repo) pokazuje spadek o 758 naruszen w calym repo —
**ta liczba NIE jest zaslugą tej paczki** (moje zmiany to dokladnie 2 linie w
tym pliku + 1 w WebAuthn + 1 w CustomTrendCard = 4 linie); reszta to zastany,
juz-scalony spadek z rownoleglych paczek na tej samej gałęzi/bazie, zmierzony
uczciwie i NIE zaktualizowalem `check-triada.baseline.txt` (nie moj spadek do
zatwierdzania).

**STOP dla wlasciciela (x2):**
1. Oba kafelki maja teraz niespojny kolor (kontener/ikona/wartosc crimson,
   etykieta teal) — ten sam kompromis co miejsce 1, ta sama przyczyna
   (wlasciciel zatwierdzil TYLKO te dwie linie, nie caly plik — 13 innych
   wystapien `primary-*` w tym pliku, patrz `scripts/check-triada.baseline.txt`,
   zostaje jako zastany dlug do osobnej decyzji).
2. W tym samym boxie zostaja NIEPRZETLUMACZONE polskie napisy poza zakresem
   tej paczki (nie dotykane): "% augmentacji AI:", "Rollout time: ... mies.",
   "Reskilling: TAK/NIE", "Role evolution: Transformacja/Augmentacja/...",
   "Rola znacząco się zmieni – nowe zadania i odpowiedzialności" — to dlug
   J-DOG-C, widoczny na zrzutach `po/3b-*`, nie naprawiony w tej paczce
   (poza scope: dwie konkretnie wskazane etykiety w liniach z crimsonem).

Zrzuty: `3a-dbr77-workstations-tile-{przed,po}-{en,pl}-{light,dark}.png`,
`3b-dbr77-automate-phase-{przed,po}-{en,pl}-{light,dark}.png`.

## Bezpiecznik zaktualizowany

`src/components/assessment/__tests__/jezykAssessment.source.test.ts` mial
jawna allowlist (`DOZWOLONE`) dla obu napisow DBR77 ("AUTOMATYZUJ",
"Stanowisk") — usunieta, bo obie linie sa teraz naprawione i test je
faktycznie sprawdza (przedtem byly swiadomym wyjatkiem na czas blokady).

## Podsumowanie tokenow

| miejsce | bylo | jest | powod wyboru |
| --- | --- | --- | --- |
| WebAuthn "What are passkeys?" | `text-c-accent` | `text-c-info` | semantyka "info" (TRIADA_KANON), wzor `GovernedContextWorkspace.tsx`/`OrganizationReadinessScreen.tsx` |
| Megatrend "Add to the list?" | `text-c-accent` | `text-c-info` | spojnosc z miejscem 1 (ten sam rodzaj elementu — link/przycisk info) |
| DBR77 "AUTOMATYZUJ"/"AUTOMATE" | `text-primary-900 dark:text-primary-300` | `text-teal-900 dark:text-teal-300` | sankcjonowany zamiennik w rodzinie `reports/templates/` (`DRDReportTemplate.tsx`), 3. odroznialny kolor po blue/green |
| DBR77 "Stanowisk"/"Workstations" | `text-primary-600/70` | `text-teal-600/70` | jw. |
