# HANDOFF — program Agent + Sejf (benchmark: Harvey)

**Data zamknięcia sesji:** 2026-07-30
**Sesja poprzednika:** `194230ac-73f0-4a13-b82b-258e86995335` (Consultify Master / CTO)
**Powód przekazania:** wyczerpanie okna kontekstu + zmiana planu taryfowego
**Stan demo w chwili przekazania:** `e62623cb99` (żywe, `database: connected`, `redis: connected`)

---

## 1. MISJA, KTÓRĄ REALIZOWAŁEM

Doprowadzić **generator agentów + Sejf wiedzy (Vault)** do poziomu, w którym
Piotr może to pokazać klientowi — benchmark: **Harvey**. Nie „dodać funkcje",
a **domknąć to, co już istnieje w kodzie, ale nie jest podłączone albo jest
nieczytelne**.

Trzy osie, po których szła praca:

1. **Nawigacja** — odzyskać przestrzeń roboczą zjadaną przez zdublowane paski menu.
2. **Zarządzanie wiedzą** — foldery, które realnie decydują, co widzi AI (nie kosmetyka).
3. **Profesjonalizm listy** — kolumny odpowiadające na pytania konsultanta, nie ozdoby.

Poprzeczka jakości narzucona przez właściciela:
> **Piotr nigdy nie jest pierwszym testerem wizualnym.** (reguła #7 w `CLAUDE.md`,
> powód: załamanie 07-11). Każdy ekran = zrzut zrobiony przeze mnie PRZED tym,
> jak Piotr go zobaczy.

---

## 2. CO ZOSTAŁO ZROBIONE I ŻYJE NA DEMO

Wszystkie SHA poniżej **zweryfikowane jako przodkowie żywego `e62623cb99`**
(`git merge-base --is-ancestor`), nie tylko „push się udał".

### 2.1 Nawigacja — mechanizm „jeden pasek na ekran"

| SHA | Co |
|---|---|
| `9ad8961163` | Run agent: scalone Menu 2/3, CTA „Nowy agent", karta w Menu 3 |
| `c293d6c367` | Client Vault: to samo |
| `dca93b85c0` | domknięcie długów: ikona CTA, nazwa w empty-state, `FolderCreateDialog` |

**Rdzeń architektoniczny: `src/components/shared/HubBarSlots.tsx`.**
Wzorzec: **dziecko DEKLARUJE (`useHubBarSlot`), hub RENDERUJE (`useHubBar`)**.
Na jednym ekranie jest dokładnie jedno Menu 2 i jedno Menu 3, należące do
najwyższego huba. To odpowiedź na wprost wypowiedziane polecenie Piotra:
„ten konflikt trzeba będzie rozwiązać na etapie całej aplikacji" — więc NIE
jest to łatka na dwa ekrany, a mechanizm dla wszystkich przyszłych.

Zmierzony koszt przed naprawą: **264 px** chrome w Run agent, **do 320 px**
w Sejfie. Przyczyna: Agent i Sejf to dawne samodzielne moduły wstawione do
My Work RAZEM z własnymi `StandardModuleBar`.

★ **Reguła wyprowadzona z korekty Piotra (zapamiętać):**
> Pasek huba to **nawigacja**. Filtry listy należą do **treści**.

Wstawiłem filtry listy do slotu huba — Piotr odrzucił: „jak się otworzy karta,
to tego po prostu nie widać, bo nie widzimy teraz przecież konkretnej listy".
Cofnięte tego samego dnia. Nie powtarzać.

### 2.2 Bezpieczeństwo — dwie luki zamknięte, jedna otwarta

`052e2a74da`:

1. **`executeKBSearch` bez `vault_scope`** nie ograniczał dokumentów projektowych
   do faktycznych członków projektu → agent jednej firmy mógł czytać cudze.
2. **`ai_knowledge_embeddings` na Postgresie NIE MA kolumny organizacji.**
   `IngestionPipeline.ingestText` (wołany przy KAŻDEJ odpowiedzi z wywiadu
   klienta) pisał tam bez odgrodzenia firm; ścieżka odczytu żywa przez
   generowanie raportów. Naprawione przez `organizationId` w `metadata` jsonb.
   Stan żywej bazy sprawdzony przed naprawą: 4 wiersze, wszystkie testowe,
   usunięte za wyraźną zgodą Piotra.

★ **TRZECIA LUKA — OTWARTA, NIENAPRAWIONA:**
`vault_scope=project` z **jawnie podanym** `vault_project_id` **nie sprawdza
członkostwa** w tym projekcie. Wektor: `vault_project_id` to pole schematu
narzędzia AI, czyli **wejście od MODELU, nie wybór z UI** — caller-trust.
Zlecone do zbadania w osobnej sesji (`task_fab397fe`). **Sprawdź jej wynik
na starcie.** Kontekst: pamięć `luka-vault-project-id-narzedzie-ai-2026-07-28`.

Bonus zamknięty przez inną sesję (potwierdzone w kodzie, nie w docach):
`DecisionController.getBottlenecks` — audyt wskazywał JEDNO dziurawe zapytanie,
realnie były **trzy** (aging, blocking, ownerOverload). Wszystkie filtrują teraz
po organizacji; bez organizacji zwracają pustkę.

### 2.3 Sejf — foldery sterujące wiedzą AI

`545f157fac` + migracja `server/migrations/20260728_vault_folders.sql`
(idempotentna: `vault_folders` + `knowledge_docs.folder_id`).

**Decyzja Piotra o modelu:** trzy poziomy — **prywatny / projektowy /
organizacyjny**. Cytat: „folder powinien mieć wersję prywatny, projektowy
i organizacyjny na trzech poziomach. Pracujemy projektami, będziemy wprowadzali
myśl projektową do Consultify coraz bardziej".

★ **KLUCZOWE ODKRYCIE, które zmieniło plan:** foldery w **Ideach są czysto
kosmetyczne** (nie sterują niczym). Wzorzec „folder → zakres wiedzy AI"
wzięty z `chat_projects` + `project_knowledge`, gdzie działa realnie.
Nie kopiować Idei jako wzorca zakresu.

Model sejfu: **sejf nie jest osobną tabelą** — to widok syntetyczny
`GROUP BY scope, project_id, owner_id` nad `knowledge_docs.scope`
(`'user' | 'project' | 'organization'`).

### 2.4 Kolumny — dokumenty i lista sejfów

| SHA | Co |
|---|---|
| `8ab9c03e36` | dokumenty: kolumna **„W wiedzy AI"** (`chunk_count`, „—" + tooltip gdy 0) |
| `b3bdf47905` | lista sejfów: **Rozmiar** · **W wiedzy AI** (`2/3`) · **Błędy indeksowania** |

Wszystko doliczone w **istniejącym** `GROUP BY` w
`server/src/routes/knowledge.routes.ts` (~918-940) — zero dodatkowych zapytań.
Brak przewijania w poziomie przy 1440 px sprawdzony pomiarem DOM
(`scrollWidth === clientWidth === 1440`), nie na oko.

★ **UCZCIWIE O RESEARCHU HARVEYA:** publiczna dokumentacja
(`developers.harvey.ai/guides/vault`) na poziomie listy projektów wystawia
TYLKO `files_count`, `is_knowledge_base_project`, `created_at`, `creator_email`.
Nasze kolumny **NIE są kopią 1:1** — są odpowiedzią na to, czego Harvey w tym
miejscu nie daje. Strona pomocy Harveya wymaga logowania → głębiej nie weszliśmy.
To granica researchu, nie zgadywanie. **Nie przedstawiać tych kolumn Piotrowi
jako „tak robi Harvey".**

★ **Cięcie zakresu (decyzja CTO):** wykonawca dołożył 3 kolumny powodujące
przewijanie w poziomie; jedna pokazywała `Użytkownik #A3F2B1` zamiast nazwiska,
druga tę samą wartość w każdym wierszu. Zostawiona JEDNA. **Więcej kolumn ≠ lepiej.**

### 2.5 Run agent — kolumny i foldery agentów

`9ad7bbd954`. Kolumny: **Zaplanowany na** (`scheduled_at` — istniał w silniku
od 07-26, nigdy nie docierał do frontu) · **Ostatnie uruchomienie** · **Czas
wykonania** (liczony live dla `executing`). Foldery: `agent_folders` — kopia
`vault_folders` 1:1, te same trzy poziomy.

Research n8n/Zapier/Make potwierdził wspólny mianownik: nazwa, status,
ostatnie uruchomienie z czasem trwania. Publiczne docy tych narzędzi są ubogie
w szczegóły list — to też granica, nie zgadywanie.

★ **Świadomie ODRZUCONE, z uzasadnieniem w kodzie** (nie przeoczenia):
- kolumna „Czeka na zgodę" — plan wchodzi w `awaiting_approval` **całościowo**
  (wykonanie sekwencyjne, nigdy 2 kroki naraz) → dubel Statusu;
- „Duplikuj"/„Uruchom ponownie" — backend tego nie ma (`AgentPlan` nie niesie
  źródłowego `processId`/`manifestId`) → lepiej brak niż martwy przycisk;
- **pasek `bulk` poza slotem** — warunkowy, dotyczy jednej tabeli, w slocie
  oderwałby się od niej wizualnie; drugi konsument slotu bulk-bara nie ma.

**Decyzja architektoniczna do zapamiętania:** widoczność PLANÓW się NIE
zmieniła (nadal `organizationId` + opcjonalnie `userId`). Filtr po folderze
jest **kliencki** nad planami, które user i tak widzi. Powód: plany agenta
nigdy nie miały pojęcia projektu i nie wymyślaliśmy dla nich nowej reguły
dostępu. Widoczność FOLDERÓW ma pełną regułę 3-poziomową, przetestowaną.

### 2.6 Statusy po polsku we wszystkich tabelach (TAB-003)

`d35d1fa60b`. Wariant wybrany po **policzeniu**: `EntityStatusChip` ma
**110 wywołań w 37 plikach** → poprawka w samym komponencie, zero ruszania
callerów. **57 kluczy** w obie strony językowe. Fallback zachowany: nieznany
status → humanizacja, NIGDY surowy klucz i18n.

★ **Rozjazd gramatyczny wyłapany przez wykonawcę:** istniał już słownik
`status.*`, ale z polskimi końcówkami dopasowanymi do słowa „Inicjatywa"
(„Zatwierdzona"). Użycie go w tabelach dałoby dokumentowi żeńską końcówkę.
Dlatego **osobna przestrzeń `statusChip.*`**. Nie scalać tych dwóch słowników.

Obejrzane na 3 ekranach PL/EN. **11 ekranów z no-label callerami NIE obejrzanych**
(brak harnessów) — mechanizm ten sam, ale wypisane w karcie jako granica.

---

## 3. CO CZEKA — W KOLEJNOŚCI WAŻNOŚCI

### 3.1 ★ DECYZJA WŁAŚCICIELA (blokuje kodowanie) — budowa całego flow

Artefakt projektowy: **https://claude.ai/code/artifact/82216783-bf5d-4522-9283-5a2b94ee7179**

Piotr zlecił wprost: **„Zaprojektuj. Jeszcze nie buduj."** Analiza Harveya
+ osobno n8n, przygotowanie pod przyszłe połączenia zewnętrzne, tak żeby dało
się budować **całe flow, a nie tylko jeden przepływ**.

Do wyboru: **Wariant C (hybryda)** vs **Wariant B (pełny canvas)**.
Stan na 2026-07-30: **Piotr powiedział, że jeszcze to dopracowuje** —
„to jeszcze muszę wypracować". **NIE ponaglać, NIE zaczynać kodowania.**

Silnik po stronie serwera jest częściowo gotowy:
- `server/src/services/ai/agentPlannerService.ts` — `executePlan` to **płaska
  pętla po tablicy**, brama `awaiting_approval`, continue-on-error (decyzja
  Piotra 07-16). Dodane: `resolveStepInputVariables` (`$step.N.pole`),
  `runToolWithRetry` (3 próby, 400 ms), `schedulePlan`/`listScheduledPlansDue`/
  `listWaitStepsDue`/`resumeWaitStep`, `PlanStatus += 'scheduled'`.
- `server/src/jobs/agentPlanSchedulerJob.ts` — cron co 2 min.
- ★ **`toolChainExecutor.ts` = MARTWY, ale to GOTOWY silnik DAG** z `dependsOn`,
  `maxParallel`, `$step.X.field`. **Zanim ktokolwiek napisze nowy silnik grafu —
  przeczytać ten plik.** Prawdopodobnie wystarczy go podłączyć.

### 3.2 ★ Trzecia luka bezpieczeństwa

Patrz §2.2. Wynik osobnej sesji do sprawdzenia na starcie.

### 3.3 Trzy błędy z audytu — NIGDY nie zlecone do naprawy

Artefakt audytu: **https://claude.ai/code/artifact/75c6cee2-06fc-4dff-afc0-2fa7c14f4793**

Piotr o nich WIE, ale nie wydał polecenia naprawy. **Nie ruszać bez jego słowa.**

1. **„+ Nowa Decyzja" zawsze 400** — pusty formularz bez kontekstu projektu,
   serwer wymaga `projectId`/`initiativeId`/`taskId`. Działa tylko
   Task→Decision i Idea→Decision. **Najbardziej widoczne CTA modułu.**
2. **`TaskDetailView` fałszywe „zapisano"** — checklist, komentarze, załączniki
   i **przypisanie osoby** nie idą do bazy (`personalPayload` pomija pola).
3. **Zerwane ogniwo 8 łańcucha wartości** — Materiały nie umieją sięgnąć po dane
   z Inicjatyw/Execution/Results, konsultant przepisuje liczby ręcznie.
   To **jedyna prawdziwa dziura funkcjonalna**; cegiełki (AI, eksport PDF/PPTX)
   już są. Łańcuch działa 7/8 ogniw.

Inne atrapy z audytu: `NotificationSettings` zawsze 400; Discovery „Uruchom
projekt" nieosiągalne (`setRecommendations` nigdy nie wołane) +
`handleAttachToProject` = `console.log`; Interview Stakeholders/OpenGaps zawsze
puste (backend gotowy, front odrzuca pola); business case inicjatywy martwy;
kalendarz Google/Outlook bez żywego „Połącz".
**~20 tys. linii martwego kodu** (Inbox/Notifications 5900, Today/Focus 12 plików
z `RADAR_ENABLED=false` twardo w kodzie, PresentationsHub 879) — **przy audytach
zawyża gotowość, uważać**.

### 3.4 Dług drobny

- **`FolderCreateDialog`** działa, ale nie był obejrzany w ŻYWYM `MyWorkHub`
  (4152 linie — jedyny z 12 hubów bez `StandardModuleBar`, zbyt kosztowny do
  zamockowania). Dowodowy harness `?screen=menu-dlugi-domkniecie` odtwarza jego
  Menu 2 kopią 1:1, ale to nie to samo.
- **4 karty modułu Materiały (`MAT-*`) leżą niezacommitowane** w katalogu
  roboczym repo głównego. Robota innej sesji — nie dotykałem. Ktoś powinien domknąć.
- **Statusy w 11 ekranach** nieobejrzane (patrz §2.6).

---

## 4. JAK TU SIĘ PRACUJE — DESTYLAT (czytaj, oszczędzi dzień)

### 4.1 Twarde reguły (z `CLAUDE.md`, nienaruszalne)

- **Baza gałęzi ZAWSZE `origin/demo`.** Nigdy Londyn, nigdy `tp-*`.
- **`demo` = święte.** Merge, nie force, nigdy rebase/force-push.
- **Reguła #7:** Piotr nigdy nie jest pierwszym testerem wizualnym. Zrzut
  robię JA, przed nim.
- **Zakaz masowego włączania flag.** Jeden ekran = jeden akcept.
- **Ekrany listowe WYŁĄCZNIE `StandardTable`/`StandardModuleBar`.** Powłoki nie
  kleją własnych tabel (to złamało kanon 07-12).
- **`primary-*` KAŻDY numer = crimson `#85182F`.** Czerwień = tylko semantyka
  krytyczna. Fokus = niebieski `c-focus`.
- **Robotnicy: Sonnet.** Świeża gałąź per krok, worktree, commit per krok,
  **NIE pushują** — push robi Master. Zero sub-agentów u robotników.

### 4.2 Pułapki, na których realnie się przewróciliśmy

| Pułapka | Skutek |
|---|---|
| **`esbuild` NIE sprawdza typów** | brakujący klucz w `Record<Union, X>` wysypał paletę klocków na żywo; bramki świeciły zielono |
| **`tsc --noEmit` NIE obejmuje `dev-render/`** | i pada z OOM na całym repo → bramka bywa ŚLEPA |
| **„Testy przeszły" ≠ „działa"** | `FolderCreateDialog` miał przycisk trwale wyszarzony w Sejfie przy 18/18 zielonych testach |
| **Moja własna bramka dała fałszywy alarm** | zły flag `--loader:tsx` (poprawnie `--loader:.tsx=tsx` albo bez flagi) zgłosił „błąd" w 6 poprawnych plikach; po poprawieniu wyszedł PRAWDZIWY błąd mojego scalenia |
| **`preview_start` po nazwie z `launch.json`** | podpina serwer INNEJ sesji → weryfikacja na cudzym, starym ekranie. Zawsze `nohup npx vite --config dev-render/vite.config.ts --port NNNN --strictPort` z worktree |
| **worktree bez `node_modules`** | vite umiera CICHO. Zawsze `ln -s <repo>/node_modules <worktree>/node_modules` |
| **`merge-tree` bez markerów** | NIE gwarantuje czystego merge'a |
| **demo rusza się pod sesją** | dziś +126 i +193 commitów dryfu. Zawsze `git fetch` + merge przed pushem; **weryfikuj żywy `gitSha` z `/api/health`, nie własny log pusha** |
| **Audyty starzeją się w ~3 dni** | i zawyżają gotowość. Zanim powiesz „działa": `grep` realnego callera, sprawdź czy flaga ma implementację (bywają FANTOMY), stan danych czytaj z ŻYWEJ bazy |
| **Podagent z za szerokim zakresem** | sam zaczyna delegować i kończy turę pustym „wrócę z syntezą". Pisać wprost: **„NIE DELEGUJ, odpowiedz w tej turze"** i wąsko ciąć zakres |
| **`git commit` wisi >60 s na hookach** | `git -c core.hooksPath=/dev/null commit` |
| **Nowe pliki w `tests/`** | wymagają `git add -f` |

### 4.3 Bazy i wdrożenie

- **demo** = host `trolley:28146` · **prod** = `centerbeam:37823`. Zła baza = krach.
- `origin/demo` → Railway auto-deploy. Zdrowie: `https://demo.consultify.ai/api/health`
  (pole `gitSha`).
- Punkt cofnięcia przed pracą nad menu: `2708c430c5`.

### 4.4 Jak Piotr pracuje

- **Po polsku, krótko, obrazkami.** Nie-koder. CEO; ja jestem CTO — decyzje
  techniczne podejmuję sam i raportuję (mandat „decyduj sam"), ale to NIE znosi
  reguł #5 (nic na demo bez akceptu na zrzutach) i #7.
- **WOLI KLIKAĆ niż oglądać zrzuty.** Panel odbioru `?screen=odbior` czyta
  `rejestr/3-DO-ODBIORU/` — **brak karty = obszar nie istnieje w odbiorze.**
- Stała instrukcja: **„wdrażaj po prostu, wdrażaj, daj mi do testowania"**.
  To realny mandat na wdrażanie bez pytania za każdym razem — ale nie znosi
  obowiązku zrzutu.
- Ceni **uczciwość o granicach**: „czego nie zweryfikowałem i dlaczego" jest
  wartością, nie słabością. Nigdy nie udawać weryfikacji.

---

## 5. PLIKI-MAPA (gdzie co jest)

| Rzecz | Plik |
|---|---|
| Mechanizm jednego paska | `src/components/shared/HubBarSlots.tsx` |
| Hub nadrzędny (4152 linie) | `src/components/MyWork/MyWorkHub.tsx` |
| Powłoka Run agent | `src/components/AIChat/AgentHubShell.tsx` |
| Dokumenty w sejfie | `src/views/vault/VaultDocumentsView.tsx` |
| Lista sejfów | `src/views/vault/VaultSafesTable.tsx` |
| Wspólny dialog folderu | `src/components/shared/FolderCreateDialog.tsx` |
| Pigułka statusu (110 callerów) | `src/components/ui/primitives/chips/EntityStatusChip.tsx` |
| Silnik planu agenta | `server/src/services/ai/agentPlannerService.ts` |
| ★ Gotowy, martwy silnik DAG | `server/src/services/ai/toolChainExecutor.ts` |
| Definicje narzędzi AI + zakresy | `server/src/services/ai/toolDefinitions.ts` |
| Endpointy wiedzy (`GROUP BY` sejfów) | `server/src/routes/knowledge.routes.ts` |
| Foldery agentów | `server/src/services/ai/agentFolderService.ts` |
| Punkt wejścia w prawdę | `docs/SOURCE_OF_TRUTH.md` |

**Karty odbioru tej pracy** (`rejestr/3-DO-ODBIORU/`): `AGT-012` (brama zgody),
`AGT-013` (zaznaczanie masowe), `AGT-014` (fala 1 flow), `AGT-015` (menu Agent
+ domknięte długi), `VLT-005`…`VLT-008`, `TAB-003`.

---

## 6. PIERWSZE TRZY RUCHY NASTĘPCY

1. **Przeczytaj `docs/SOURCE_OF_TRUTH.md`** — punkt wejścia w prawdę repo.
2. **Sprawdź wynik sesji badającej trzecią lukę** (`task_fab397fe`) i stan demo
   przez `/api/health` — demo ruszyło się dziś o >100 commitów pod dwoma
   równoległymi sesjami.
3. **Zapytaj Piotra o wariant flow** (hybryda vs pełny canvas) — ale tylko jeśli
   sam wróci do tematu. Powiedział, że dopracowuje. Do tego czasu:
   `toolChainExecutor.ts` do przeczytania, nie do przepisywania.

---

*Handoff spisany przez poprzednika 2026-07-30 przy wyczerpanym oknie kontekstu.
Wszystkie SHA zweryfikowane wobec żywego `e62623cb99`. Gdzie czegoś nie
sprawdziłem — napisane wprost.*
