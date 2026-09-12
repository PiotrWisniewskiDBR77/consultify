# Built-candidate UI smoke — preflight (read-only)

12.09.2026. Nie uruchomiono aplikacji/testów ani nie zmieniono produktu. Nie zatrzymano/restartowano runtime. Odczyty: raport C8, handoff Chicago, scope-audit-handoff, real-ui.mjs/api.mts oraz aktualne selektory/root source.

## Ownership / czego nie nazywać kandydatem

| Zasób | Potwierdzony odczytem stan | Właściciel/pochodzenie |
|---|---|---|
| API4218 PID55218, PPID55215 | `tsx ../codex8-scratch/api.mts`, start 12.09 03:41; cwd `codex8-finanse-pelny` | wcześniejszy odbiór C8 E0 przez scope_audit; pozostawiony root do review |
| Vite5218 PID15855, PPID13387 | `vite --host 127.0.0.1 --port 5218 --strictPort`, start 12.09 03:31; ten sam cwd | C8 **dev**, nie built root candidate |
| DB wskazana przez api.mts | guard wymaga lokalnego6459/cx8_e0; canonical Gateway + health/CSRF/inputSanitization/error middleware | istniejący fixture C8; bez odczytu haseł/env i bez nowego sprawdzenia DB |

Potwierdzenie ownership: `codex8-finanse-pelny/.../CODEX8_FINANSE_PELNY/98_RAPORT.md`, `codex4-scratch/scope-audit-handoff-20260912.md:91–93`, `HANDOFF_CHICAGO.md:16,38,130`; ps/lsof potwierdziły bieżące PID/cwd. `codex8-artefakty/HANDOFF-ACTIVE.md` nie istnieje. Nie zgadywać ownership z samego portu.

Root candidate: `/Users/piotrwisniewski/Developer/codex-wt/codex-integrator-mvp-20260912`. Przed smoke zapisać jego aktualny SHA, build-log, hash dist/index.html oraz manifest/nazwy chunków. Przy użyciu API4218 wynik ma etykietę **built candidate frontend + istniejący C8 backend/fixture**, nie pełny backend-candidate acceptance. Dla obu warstw wymagany osobny runtime z kodu kandydata.

## Uruchomienie należące wyłącznie do root (nie wykonano)

Użyć osobnego, jawnie przydzielonego wolnego `ROOT_PREVIEW_PORT`; nie zastępować zajętego5218. `vite.config.ts` root ma preview proxy i honoruje VITE_DOTENV_DISABLED. Przykład po ustawieniu portu przez root:

```sh
VITE_DOTENV_DISABLED=1 VITE_API_TARGET=http://127.0.0.1:4218 \
  node node_modules/vite/bin/vite.js preview --host 127.0.0.1 \
  --port "$ROOT_PREVIEW_PORT" --strictPort \
  --outDir /Users/piotrwisniewski/Developer/codex-wt/codex-integrator-mvp-20260912/dist
```

Cwd: root candidate. To serwowanie istniejącego dist, bez kolejnego build. Nie ładować remote .env, nie zmieniać default flags. Runtime5218 pozostaje nietknięty. Konfiguracja API/flag we frontendzie jest już wbudowana — env preview nie przebudowuje dist. Odbiór musi wykryć ewentualne inne API origin, nie maskować ich.

## Konkretna adaptacja real-ui.mjs

Zachować plik źródłowy i stare `evidence/finanse-wkrotce/` bez zmian. Nowy harness zapisać w root scratch. Argumenty: `--front=http://127.0.0.1:<ROOT_PREVIEW_PORT>`, `--out=/absolute/new-evidence-dir`, `--account=/Users/piotrwisniewski/Developer/codex-wt/codex8-scratch/account.json`. OUT musi jeszcze nie istnieć; mkdir bez recursive lub jawny exists→STOP. Account czytać tylko do pamięci, bez console/JSON dump, trace, HAR i screenshotu wypełnionego formularza logowania.

Najmocniejsza mała adaptacja: zamiast HTTP login+token injection wykonać rzeczywisty formularz logowania na built UI. Weryfikuje to od razu redirect i nie wymaga żadnego importu JS aplikacji:

```js
// imports: chromium z istniejącego Playwright, assert z node:assert/strict, fs.
// FRONT i OUT są jawnymi argumentami, żadnych domyślnych portów kandydata.
const finance = ['/finance','/finance/statements/cx8','/finance/models/cx8',
  '/finance/analyses/cx8','/finance/predictions/cx8','/finance/valuations/cx8',
  '/finance/unknown/cx8','/economics','/economics/legacy/cx8'];
const meetings = ['/meetings','/meetings/cx8','/meetings/unknown/cx8',
  '/meeting?meetingId=cx8'];
for (const role of ['OWNER','MEMBER']) for (const theme of ['light','dark']) {
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  // Wyłącznie preferencje, NIE fixture auth ani isAuthenticated.
  await context.addInitScript(({theme}) => {
    localStorage.setItem('i18nextLng','en');
    localStorage.setItem('consultify-storage',JSON.stringify({version:2,state:{
      theme,language:'en',isSidebarCollapsed:false,isChatCollapsed:true
    }}));
  }, {theme});
  const requests=[], failures=[], pageErrors=[];
  await context.route('**/*', route => {
    const u=new URL(route.request().url());
    if (u.origin !== FRONT) { failures.push({origin:u.origin,path:u.pathname,blocked:true}); return route.abort(); }
    requests.push({path:u.pathname,type:route.request().resourceType()});
    return route.continue(); // /api ma trafić realnym proxy do4218, bez fulfill/mocks
  });
  const page=await context.newPage();
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failures.push({path:new URL(r.url()).pathname,status:r.status()});});
  await page.goto(FRONT+'/finance?smoke=built');
  await page.waitForURL(u=>u.pathname==='/login');
  assert.equal(new URL(page.url()).searchParams.get('redirect'),'/finance?smoke=built');
  assert.equal(await page.getByRole('heading',{name:'Finance — Coming soon'}).count(),0);
  await page.locator('#login-email').fill(role==='OWNER'?account.email:account.memberEmail);
  await page.locator('#login-password').fill(account.password);
  await page.getByTestId('login-button').click();
  await page.waitForURL(u=>u.pathname==='/finance');
  await page.getByRole('heading',{name:'Finance — Coming soon'}).waitFor();
  const skip=page.getByRole('button',{name:'Skip for now',exact:true});
  if(await skip.isVisible())await skip.click();
  for(const path of finance){await page.goto(FRONT+path);await page.getByRole('heading',{name:'Finance — Coming soon'}).waitFor();}
  // Dalej wykonać asercje z tabeli poniżej i zapisać wyłącznie sanitizowany wynik.
  // Po wymaganym renderze: html.dark i storage.state.theme, nie tylko ustawienie.
  await context.close();
}
```

Fragment jest propozycją do złożenia w pełny harness przez root; **nie uruchomiono go**. `#login-email`, `#login-password`, `data-testid=login-button` pochodzą z aktualnego AuthView, version2 z useAppStore. Alternatywnie można zachować rzeczywisty POST login z real-ui.mjs, lecz wtedy formularz i powrót po logowaniu pozostają NOT_PROVEN. Nie używać `/src/store/useAppStore.ts` ani `/src/i18n.ts`: usunąć obie stare dynamiczne importy. Dla PL stworzyć nowy context z i18nextLng/state.language='pl'; nie zmieniać języka importem źródła.

## Obowiązkowe asercje po fragmencie

| Zakres | Konkretne sprawdzenie |
|---|---|
| Dist identity | Wszystkie script requests z `/assets/…`; zero `/src/…`, `/@vite/client`, `/@react-refresh`. HTTP200 HTML nie jest samodzielnym dowodem. Do wyniku dołączyć SHA/hash dist i rzeczywiste URL chunków. |
| Finance OWNER i MEMBER | 9 wejść → heading + dokładny tekst Wave2; brak children Finance/lock-modal, klik `Finance Coming soon` z legacy wejścia prowadzi `/finance`; `?ff_navDeclutter=1` nadal pokazuje menu. Zero `/api/(vN/)?finance*` i economics. |
| Auth/public | Osobny czysty context, zanim login: `/finance?smoke=built`→`/login?redirect=…`, brak ekranu Finance i prywatnej powłoki. Sprawdzić bootstrap scripts bez chunków MainLayout i HelpSidePanel (nazwy/mapowanie z TEGO dist, nie starego build). Po realnym loginie wraca zamierzony URL. |
| Meetings default OFF | Dla każdej trasy z tablicy heading `Meetings — planned for Wave 2`, brak pozycji Meetings w sidebarze i brak beta-lock modala. Legacy redirect zachowuje intencję obiektu. Zero meeting business API/chunków MeetingHub/MeetingObjectPage. Sam chunk neutralnego placeholdera jest prawidłowy. Flaga jest build-time VITE_MODULE_MEETINGS === 'true'; nie włączać query/env override. |
| Help lazy + działanie | Na świeżym finance context przed kliknięciem brak HelpSidePanel chunk. Klik button `Help Center`; pojawia się h2 `Help Center` i jego chunk. W panelu klik `FAQ`, zapisać widoczną treść; zamknąć Close w nagłówku panelu, otworzyć ponownie i potwierdzić zachowany FAQ. Bez ponownego pobierania/render crash. Liczyć faktyczną treść, nie sam napis przycisku. |
| Theme/screens | Świeży context dla theme; po renderze odczyt storage oraz html.dark zgodny z theme. Stabilne body ≥3×400ms i screenshot 1440×1000; obejrzeć oba, zmierzyć Δluma >40. Nie wymuszać klasy DOM ani CSS. |
| Wyniki | Zapisać role/theme/routes/status/finalPath, sanitizowane request paths, pageErrors, HTTP failures, chunk URLs. Zero obcych origin jest celem; blokowane zewnętrzne zasoby raportować osobno, nie udawać zero błędów. Bez tokenów/hasła/account dump. |

Wyjście np. nowy `integrator-20260912/built-smoke-<SHA>-<timestamp>/`; finalne PASS dopiero po rzeczywistym wykonaniu i obejrzeniu PNG. Nie nadpisywać C8 ani E3 evidence. API4218 nie dowodzi zmian backendu scalonego kandydata, a ten smoke nie stanowi pełnego E1→wynik ani zgody na pilotaż/live.
