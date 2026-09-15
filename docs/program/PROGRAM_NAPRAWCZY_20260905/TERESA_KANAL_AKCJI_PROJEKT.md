# DEC-526 — kanał akcji Teresy (projekt do decyzji CTO)

**Status:** READY FOR CTO DECISION — STOP przed kodem produktu  
**Zakres:** Wpis 83, Fala 2 po fali B (analiza portfela A3/A4)  
**Baza audytu:** `df3428e7e027124a60dfdc0b7ae1ba3a76c4facc`  
**Flaga docelowa:** `ENABLE_TERESA_ACTIONS`, domyślnie `OFF`  
**Zasada nadrzędna:** Teresa może zaproponować tylko akcję obecną w manifeście
bieżącego użytkownika. Żadna akcja nie wywołuje skutku przed jawnym
potwierdzeniem. Mutacja przechodzi przez istniejące API i jego autoryzację;
kanał Teresy nie zapisuje bezpośrednio do bazy.

## 1. Werdykt audytu

Na bazie W83 nie istnieje jeden ogólny kanał `Teresa -> akcja aplikacji` dla
`navigate`, `createTask` i `runTool`. Istnieją cztery przydatne elementy, ale
każdy ma węższy kontrakt:

| Element | Co istnieje | Klasyfikacja wobec DEC-526 | Dowód |
|---|---|---|---|
| `ENABLE_TERESA_MINDMAP` | Realny wołacz otwiera wspólny czat z kontekstem `ideaId`; drugi klik może wznowić rozmowę. | **WOŁACZ kontekstu**, **FANTOM wykonania akcji**. Flaga nie daje Teresie prawa do nawigacji ani mutacji. | `src/hooks/useFeatureFlags.tsx:349-355`; `src/hooks/useOpenChatWithContext.ts:85-100`; `src/components/MyWork/IdeaMapWorkspace.tsx:2476-2494` |
| `useToolAI` | `ToolDocumentView` naprawdę montuje hook; hook buduje prompt i woła `useAIStream.startStream`. | **WOŁACZ AI narzędzia**, **FANTOM ogólnego executora**. Nie przyjmuje manifestu aplikacyjnych akcji i nie uruchamia istniejących API `navigate/createTask/runTool`. | `src/components/DiscoveryTools/ToolDocumentView.tsx:299-312`; `src/hooks/discovery/useToolAI.ts:185-216,262-317,1235-1253` |
| `ActionCard` — „Create task” | Przycisk ma realny callback; Skrzynka woła klienta HTTP, trasa serwera i `TaskService`. Operacja jest idempotentna po `action-card-task:<id>`. | **WOŁACZ dla zadania z istniejącej karty działania**, nie kanał polecenia z rozmowy Teresy. Może zostać adapterem tylko wtedy, gdy kontekst źródłowy jest kartą działania. | `src/components/standard/ActionCard.tsx:90-101`; `src/components/MyWork/InboxActionCards.tsx:68-79,139-145`; `src/services/actionCards.ts:57-69`; `server/src/routes/actionCards.routes.ts:71-102`; `server/src/services/actionCard/actionCardTaskService.ts:17-71` |
| P-T13 wariant B | Kanoniczny manifest nawigacji z trasami, etykietami, ścieżkami kliknięć oraz bramkami roli/org/runtime; grounding wycina niedostępne pozycje. | **WOŁACZ groundingu**, jeszcze nie executor. Jest właściwym SSOT do rozszerzenia o `actions[]`. Nie znajduje się na bazie W83; jest na osobnym freeze K9. | freeze `codex/a-k9-teresa-manifest-20260915` = `65418738909f9a1e5df5f9712a6e4ade393ab737`; manifest `server/src/sharedRuntime/routes/teresaNavigationManifest.ts:7-37`; filtr `server/src/services/ai/teresaNavigationGrounding.ts:43-95`; test lustra `tests/unit/routes/teresaNavigationManifest.test.ts:1-20` na tym refie |

### Dodatkowe elementy, które należy wykorzystać zamiast budować drugi obieg

- F1 już uczciwie blokuje obietnice bez transportu: `server/src/services/ai/navigationHonesty.ts:58-79`.
  Po włączeniu DEC-526 instrukcja nie może zniknąć globalnie. Ma być generowana
  z manifestu: „mogę wykonać” tylko dla dostępnych `actions[]`, a dla reszty
  nadal podaje ścieżkę kliknięć.
- Istnieje trwały cykl propozycji `create -> approve/reject -> execute`:
  `server/src/routes/v8/teresa.routes.ts:85-105,207-291` oraz karta UI
  `src/components/AIChat/TeresaProposalCard.tsx:100-123,153-182`. Należy
  rozszerzyć ten cykl, a nie tworzyć równoległy stan potwierdzenia.
- Istniejące karty działania produkują powiadomienie ze ścieżką do Skrzynki:
  `server/src/services/actionCard/actionCardService.ts:173-207`.
- Sesja narzędzia ma istniejący adapter HTTP i serwer jako SSOT:
  `src/services/toolSessionApi.ts:1-21,95-107`; istniejące endpointy to
  `POST /api/tools`, `GET /api/tools/:toolId`, `PUT /api/tools/:toolId`.

### Niespójność flag, której nie wolno kopiować

`ENABLE_TERESA_MINDMAP` ma różne wartości domyślne: backend `ON`
(`server/src/config/FeatureFlags.ts:39,191`), katalog flag frontu `OFF`
(`src/hooks/useFeatureFlags.tsx:349-355`). DEC-526 wymaga jednej autorytatywnej
decyzji serwera: `ENABLE_TERESA_ACTIONS=false` przy braku wartości. Front może
mieć lustrzany gate prezentacyjny, ale nie może samodzielnie nadać uprawnienia.

## 2. Jeden manifest nawigacji i akcji

Źródłem jest manifest P-T13 wyprowadzony z `src/routes/routeConfig.ts`. Jego
serwerowe lustro pozostaje data-only i jest chronione testem driftu. Każda
pozycja modułu dostaje opcjonalne `actions[]`; nie powstaje osobny katalog
narzędzi Teresy.

```ts
type TeresaActionKind = 'navigate' | 'createTask' | 'runTool';

interface TeresaActionManifestEntry {
  id: string;                    // stabilne, np. MY_WORK.CREATE_TASK
  kind: TeresaActionKind;
  labelEn: string;
  labelPl: string;
  confirmation: 'required';     // w pierwszym wydaniu zawsze required
  permission: {
    roles?: readonly string[];
    capability?: string;         // efektywna capability, nie deklaracja modelu
    runtimeFlagKey?: string;
    organizationFlagKey?: string;
    objectScope?: 'organization' | 'project' | 'owner';
  };
  args: {
    schemaId: string;            // wersjonowany JSON Schema po stronie serwera
    allowedKeys: readonly string[];
  };
  executor: {
    adapter: string;             // allowlista kodu, nigdy URL podany przez model
    existingApi: string;         // dokumentacja istniejącego kontraktu
    method: 'CLIENT_NAVIGATE' | 'GET' | 'POST' | 'PUT';
  };
  receipt: {
    kind: 'inbox_notification';
    entityType: 'teresa_proposal';
    targetFrom: string;          // pole wyniku adaptera, nie argument modelu
  };
}

interface TeresaNavigationManifestEntry {
  // obecne pola P-T13: id, route, labels, click paths, role/org/runtime gates
  actions?: readonly TeresaActionManifestEntry[];
}
```

Filtr serwera tworzy **efektywny manifest użytkownika** w dwóch etapach:

1. P-T13 usuwa moduły niedostępne przez rolę, organizację i flagę runtime.
2. Dla pozostałych modułów resolver usuwa akcje bez capability, bez dostępu do
   projektu/obiektu albo wyłączone flagą. Błąd odczytu uprawnień oznacza brak
   akcji (`fail closed`).

Model dostaje tylko `id`, bezpieczną etykietę, schemat argumentów i opis skutku.
Nie dostaje adresu endpointu ani nazwy tabeli. Odpowiedź modelu może wskazać
wyłącznie `actionId` z przekazanego manifestu. Serwer ignoruje wszelkie
modelowe `url`, `method`, `permission` i `receipt`.

## 3. Pierwsze trzy akcje

### `navigate(route)`

- Występuje jako akcja na pozycji każdego dostępnego modułu.
- Argument modelu to `routeId` równy `entry.id`; właściwy `route` serwer/front
  odczytuje z manifestu. Model nie podaje dowolnego URL.
- Po potwierdzeniu karta woła istniejący router klienta. To jedyna akcja bez
  domenowego API, ponieważ nie zapisuje danych. Nie wolno symulować jej
  bezpośrednim zapisem ani nowym endpointem.
- Przed wykonaniem klient ponownie porównuje `actionId`, `manifestVersion` i
  bieżący efektywny manifest zwrócony przez serwer. Po utracie dostępu akcja
  kończy się `ACTION_NO_LONGER_ALLOWED` bez nawigacji.
- Receipt w Skrzynce: propozycja, potwierdzający użytkownik, czas, bezpieczna
  etykieta celu i wynik `completed/failed`; nie zapisuje pełnego URL z danymi.

### `createTask(from context)`

- Minimalne argumenty: `title`; opcjonalne `description`, `assigneeId`,
  `dueDate`, `projectId`, `sourceContextRef`. Id organizacji i użytkownika
  zawsze pochodzą z tokenu.
- Wymaga efektywnej capability tworzenia zadania oraz dostępu do wskazanego
  projektu, właściciela i encji źródłowej.
- Po potwierdzeniu adapter woła kanoniczne istniejące API zadania. Gdy źródłem
  jest `action_card`, używa istniejącego
  `POST /api/action-cards/:id/task`, zachowując obecną idempotencję. Dla innego
  kontekstu używa istniejącego `POST /api/tasks` i przekazuje stabilny klucz
  idempotencji `teresa-proposal:<proposalId>`.
- Receipt wskazuje utworzone `task.id`, tytuł, wykonawcę i link dostarczony przez
  odpowiedź API. Teresa nie może stwierdzić „zadanie utworzone” bez odpowiedzi
  sukcesu i receipt.

### `runTool(toolId, sessionId)`

- Pierwsze wydanie oznacza **wznowienie istniejącej sesji**, nie stworzenie ani
  automatyczne wygenerowanie wyniku.
- `toolId` jest identyfikatorem typu narzędzia z allowlisty; `sessionId` jest
  identyfikatorem istniejącej sesji. Nazwa parametru endpointu
  `GET /api/tools/:toolId` jest historycznie myląca — niesie identyfikator
  sesji (`src/services/toolSessionApi.ts:33-60,100-105`).
- Przed propozycją serwer sprawdza, czy sesja należy do organizacji, pasuje do
  typu narzędzia i jest widoczna dla użytkownika. Po potwierdzeniu adapter robi
  istniejący `GET /api/tools/:sessionId`, a potem nawiguje na kanoniczną trasę
  sesji z manifestu. Nie wywołuje `PUT`, generowania ani akcji fazy.
- Receipt zawiera `toolId`, `sessionId`, nazwę sesji i wynik otwarcia. Nie
  zawiera odpowiedzi/treści sesji.

## 4. Przepływ propozycja -> potwierdzenie -> wykonanie -> receipt

1. Backend buduje manifest filtrowany dla organizacji, roli, capability, flag i
   bieżącego obiektu. Do modelu trafia `manifestVersion` i wyłącznie dostępne
   akcje.
2. Model zwraca propozycję `{actionId, args}`. Serwer waliduje ją względem tego
   samego manifestu i wersjonowanego JSON Schema.
3. Istniejący cykl `teresa_proposals` zapisuje propozycję i audyt
   `proposal_created`. To zapis sterujący, bez domenowego skutku akcji.
4. Czat renderuje kartę **„Teresa proposes: …”** z dokładnym celem, argumentami,
   spodziewanym skutkiem oraz przyciskami `Confirm` i `Reject`. Brak kliknięcia,
   zamknięcie, timeout lub odrzucenie nie uruchamiają adaptera.
5. `Confirm` zatwierdza propozycję. Bezpośrednio przed wykonaniem backend
   ponownie wylicza uprawnienia i zakres organizacji/obiektu. Zmiana uprawnień
   między propozycją a kliknięciem blokuje wykonanie.
6. Executor wybiera adapter wyłącznie po `actionId` z allowlisty. Adapter używa
   istniejącego API. Nie interpoluje endpointu podanego przez model i nie ma
   dostępu do surowego helpera DB.
7. Odpowiedź istniejącego API wyznacza stan `completed/failed`. Dopiero wtedy
   Teresa może opisać wynik.
8. `notificationService` umieszcza receipt w Skrzynce z `proposalId`,
   `actionId`, aktorem potwierdzającym, czasem, stanem, bezpiecznym odnośnikiem
   do rezultatu i kodem błędu. Receipt ma dedupe key
   `teresa-action:<proposalId>:<attempt>`.

Powtórzenie `Confirm` zwraca poprzedni wynik. Każdy adapter musi mieć klucz
idempotencji lub semantykę bezskutkowego replay. Stan `failed` nie jest
przedstawiany jako wykonany.

## 5. Kontrakty testowe

Minimalny mianownik wdrożenia:

1. **Manifest drift:** frontendowy manifest z `routeConfig.ts` i serwerowe
   lustro, łącznie z `actions[]`, są identyczne.
2. **Widoczność użytkownika:** brak roli/capability/flag/org-access usuwa moduł
   albo akcję; grounding i propozycja nie zawierają nazwy, trasy ani schematu
   ukrytej akcji.
3. **Akcja spoza manifestu:** model zwraca nieznane `actionId` ->
   `ACTION_NOT_IN_USER_MANIFEST`, bez propozycji wykonawczej i bez skutku.
4. **Argument spoza schematu:** dodatkowy URL, organizationId, userId albo
   method -> odrzucenie, bez wywołania adaptera.
5. **Bez potwierdzenia:** proposal/reject/timeout/remount bez `Confirm` -> zero
   wywołań routera i API, zero zadania, zero zmiany sesji.
6. **TOCTOU uprawnień:** odebranie dostępu po propozycji, przed potwierdzeniem ->
   `ACTION_NO_LONGER_ALLOWED`, zero wywołania domenowego API.
7. **Idempotencja:** podwójne potwierdzenie `createTask` -> jeden task i jeden
   kanoniczny receipt; replay zwraca ten sam identyfikator.
8. **Org scope:** cudzy `task/sourceContext/sessionId` -> nieodróżnialne 404,
   brak wycieku etykiety i receipt.
9. **Uczciwość odpowiedzi:** sukces dopiero po odpowiedzi adaptera; błąd API
   daje `failed`, kod i bezpieczną instrukcję następnego kroku.
10. **Trzy akcje:** zachowanie `navigate`, `createTask` i `runTool` sprawdzone
    na istniejących API/routerze oraz przez odczyt rezultatu i receipt w
    Skrzynce.
11. **Flaga OFF:** brak manifestu wykonawczego, brak eventów propozycji akcji i
    zachowanie F1/P-T13 byte-for-byte; model nadal podaje ścieżki kliknięć.
12. **Zero skip/retry:** kontrakty uruchamiane z `--retry=0`; RealPG wymagany
    dla idempotencji, org-scope, task readback i receipt readback.

## 6. Trzy paczki implementacyjne — wszystkie za flagą OFF

### Paczka A — manifest i autoryzacja

- Najpierw zintegrować zaakceptowany freeze P-T13 K9 na aktualnej bazie.
- Rozszerzyć dokładnie ten manifest o `actions[]`, schematy argumentów i receipt.
- Dodać serwerowy resolver efektywnego manifestu oraz
  `ENABLE_TERESA_ACTIONS=false` jako jawny default.
- Utrzymać `navigationHonesty`: przy OFF lub braku akcji Teresa wyłącznie opisuje
  ścieżkę kliknięć.
- Dowód: drift, role/org/runtime/capability fail-closed, nieznana akcja i flaga OFF.

### Paczka B — propozycja i potwierdzenie

- Rozszerzyć istniejący `teresa_proposals` i `TeresaProposalCard`, bez drugiego
  store ani drugiego cyklu zatwierdzania.
- Związać proposal z `manifestVersion`, `actionId`, znormalizowanymi argumentami
  i skrótem kontekstu; nie przechowywać tajnych danych z promptu.
- Wymusić, że tylko klik `Confirm` może przejść do execute; approve/execute może
  być jednym atomowym gestem UI, ale serwer zachowuje oba zdarzenia audytowe.
- Dowód: brak skutku przed potwierdzeniem, reject/timeout/remount, TOCTOU i
  idempotentny replay.

### Paczka C — trzy adaptery i receipt

- Dodać allowlistowane adaptery `navigate`, `createTask`, `runTool`.
- Podłączyć wyłącznie istniejący router/API; zabronić importu warstwy DB w
  adapterach kanału Teresy.
- Po wyniku wytworzyć receipt przez istniejący system powiadomień/Skrzynki.
- Dowód: zachowanie każdej akcji, RealPG dla createTask i receipt, org-scope,
  readback oraz pełna regresja OFF.

Każda paczka ma osobny freeze i może wejść na linię przy nadal wyłączonej
fladze. Włączenie następuje dopiero po odbiorze trzech paczek i pilotażu na
jednej organizacji.

## 7. Ryzyka i zabezpieczenia

| Ryzyko | Zabezpieczenie |
|---|---|
| Model wymyśla akcję lub URL | Efektywny manifest po stronie serwera, `actionId` allowlist, route/endpoint wyłącznie z kodu. |
| Uprawnienie znika po wygenerowaniu karty | Ponowna autoryzacja bezpośrednio przed execute; fail closed. |
| Podwójny klik tworzy dwa zadania | Idempotency key z `proposalId`; replay tego samego rezultatu. |
| Teresa ogłasza sukces po samej propozycji | Stan i tekst sukcesu dopiero po odpowiedzi istniejącego API oraz utworzeniu receipt. |
| P-T13 i katalog akcji rozjeżdżają się | Jedna struktura `TeresaNavigationManifestEntry.actions[]` i test lustra. |
| Flaga frontu daje pozorne uprawnienie | Serwer jest jedyną władzą; frontendowa flaga tylko ukrywa UI. |
| `runTool` uruchamia generowanie bez zgody | W pierwszej wersji tylko read + resume; żadnego PUT/generate. |
| Receipt ujawnia dane innej organizacji | Org-scoped entity refs, bez promptu i bez pełnego payloadu; cudzy ref -> 404. |
| Powstaje trzeci system propozycji | Rozszerzenie istniejących `teresa_proposals` i `TeresaProposalCard`. |

## 8. Decyzje wymagane od CTO

1. **Zależność P-T13:** zatwierdzić, że Paczka A startuje dopiero po integracji
   freeze K9 `65418738909f9a1e5df5f9712a6e4ade393ab737`, a nie kopiuje jego plików.
2. **`runTool`:** zatwierdzić zakres pierwszej wersji jako wznowienie istniejącej
   sesji. Utworzenie sesji lub generowanie wyniku pozostaje poza DEC-526.
3. **Receipt:** zatwierdzić receipt jako powiadomienie w Skrzynce powiązane z
   `teresa_proposal`; nie tworzyć sztucznej biznesowej `action_card` dla samej
   nawigacji.
4. **`createTask`:** zatwierdzić dwa istniejące adaptery zależne od źródła:
   `/api/action-cards/:id/task` dla karty działania i `/api/tasks` dla innego
   kontekstu, oba z idempotencją proposal.
5. **Potwierdzenie nawigacji:** Wpis 83 mówi „za zgodą użytkownika”; projekt
   stosuje `confirmation: required` również do `navigate`. Zatwierdzić bez
   wyjątku w pierwszym wydaniu.
6. **Retencja receipt:** ustalić okres przechowywania oraz czy receipt `failed`
   ma pozostać w Skrzynce do ręcznego zamknięcia.

## STOP

Nie powstał kod produktu, flaga, endpoint, migracja ani test. Dokument kończy
zadanie projektowe W83 i czeka na decyzje CTO. Do tego czasu obowiązuje F1
`navigationHonesty.ts`, P-T13 pozostaje kanałem groundingu, a Teresa nie może
deklarować wykonania `navigate`, `createTask` ani `runTool` przez ogólny kanał.
