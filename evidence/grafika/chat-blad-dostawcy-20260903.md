# CHAT-OWN-016 — błąd dostawcy AI: komunikat zrozumiały i bezpieczny

Gałąź `agent/chat-blad-dostawcy-20260903`, baza `96982ed24f`. Data pomiaru 2026-09-03.

## Źródło uwagi

`docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md:233`, wiersz **47**:

> | 47 | `CHAT-OWN-016` | Gdy dostawca AI zwróci błąd, dostaje techniczny komunikat → dostaje zrozumiały i bezpieczny. | ŚREDNIE | DEFEKT | **TERAZ** (2 dni) |

Sprostowanie do zlecenia: w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md`
**nie ma wiersza `CHAT-OWN-016`** — `grep` po całym `docs/` nie zwraca stamtąd ani jednego trafienia.
To samo odnotowuje `ROZLICZENIE_P0P1_20260903.md:200` („nie ma osobnego wiersza w
MODULE_ACCEPTANCE.md — tylko wiersz zbiorczy `CHAT-OWN-001`–`017`"). Pełny opis pozycji stoi
w `.../13_CHAT/OWNER_REVIEW_2026-08-22.md:212-224`, kryterium odbioru dosłownie:

> Acceptance: (…) ordinary users do not see internal endpoints/log instructions; admins retain correlated diagnostics; provider failure creates no false answer, proposal or artifact.

## R1 — Pomiar ścieżki błędu

Czat woła model dwoma trasami: `POST /api/ai/chat/stream` (`server/src/routes/ai.routes.ts:1580`)
i `POST /api/ai/chat/quick` (`ai.routes.ts:6530`). Rodzina wołaczy z frontu:
`src/services/api.ts:2684`, `src/components/AIChat/CanvasEditor/useCanvasAIStream.ts:182,301`,
`src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx:270,360`.
Ramkę SSE parsuje `api.ts` (rozpoznaje błąd **po polu `error`**), a wiadomość w rozmowie
tworzy `UnifiedChatPanel.onStreamError` (`UnifiedChatPanel.tsx:2005`).

| Przypadek | Co serwer odsyłał (PRZED) | Czy niosło treść dostawcy | Co widział użytkownik (PRZED, dosłownie) |
| --- | --- | --- | --- |
| 429 limit dostawcy | ramka SSE `{error: <err.message>, code:'AI_STREAM_ERROR'}` (`ai.routes.ts:6295-6321`) | **TAK** — pełna treść wyjątku | właściciel/admin: „⚠️ Teresa jest chwilowo niedostepna… 🔧 Szczegoly (admin): HTTP 429 · AI_STREAM_ERROR · Rate limit exceeded for model openai/gpt-4o-mini on openrouter.ai / Sprawdz /api/llm/health/detailed oraz logi serwera."; zwykły użytkownik: ogólnik „Wystąpił błąd podczas generowania odpowiedzi" (kod 429 **nie docierał** — patrz niżej) |
| 401 / zły klucz | `code:'INVALID_API_KEY'` + `error: <err.message>` | **TAK** — dostawcy odbijają fragment klucza („Incorrect API key provided: sk-or-v1-…") | „⚠️ Konfiguracja klucza API do AI jest nieprawidłowa lub wygasła" + admin: surowa treść |
| brak dostawcy | `{error:'No LLM provider configured on the backend. **Set OPENROUTER_API_KEY** or configure OpenRouter in **llm_providers**.', code:'NO_LLM_PROVIDER'}` (`ai.routes.ts:2458`) | **TAK** — nazwa zmiennej środowiskowej i nazwa tabeli | admin: cały ten napis w rozmowie |
| brak dostawcy (trasy nie-strumieniowe) | `ensureAiProviderAndAccess` → `'…Set OPENROUTER_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY…'` (`ai.routes.ts:396`) | **TAK** — trzy nazwy zmiennych | j.w., dla `/chat/quick`, `/refine-text`, `/generate-list` |
| 5xx / wyłącznik | `code:'AI_STREAM_ERROR'` (kod `CIRCUIT_OPEN` z `AIPipeline` **gubiony**) + surowa treść | **TAK** — „Circuit [openrouter] is OPEN. Retry in 18s" | ogólnik zamiast „spróbuj za N s"; front MIAŁ gałąź `CIRCUIT_OPEN`, ale trasa nigdy jej nie wystawiała |
| timeout | j.w. `AI_STREAM_ERROR` + surowa treść | **TAK** — pełny URL endpointu i `60000ms` | ogólnik |
| przerwany stream | ramki `{type:'error', code:'PARTIAL_RECOVERY_*', **message**: …}` (`ai.routes.ts:2237,2564`) | nie | **NIC** — `api.ts` rozpoznaje błąd po polu `error`, a te ramki go nie miały; strumień ginął w ciszy |
| „model not found" | wpada w `AI_STREAM_ERROR` + surowa treść | **TAK** — identyfikator modelu | ogólnik |
| błąd w kanwie Czatu | j.w. | **TAK** | `useCanvasAIStream.ts:364,443` pokazywało `data.message` / `err.message` **wprost**; a `WorkCanvasDocumentPanel.tsx:2324` w ogóle nie przekazywał `onError` → w kanwie użytkownik nie widział **nic** |
| każdy błąd (zapis) | — | — | `UnifiedChatPanel.tsx:2026` zapisywał `metadata: { error: err.message }` — surowa treść dostawcy lądowała w bazie rozmów |

### Znalezisko bezpieczeństwa (osobno)

Sześć miejsc odsyłało do przeglądarki treść techniczną. Trzy kategorie wycieku:
1. **Sekrety infrastruktury** — `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
   nazwa tabeli `llm_providers` (dwa miejsca, dla KAŻDEGO użytkownika, nie tylko admina —
   `ensureAiProviderAndAccess` i ramka SSE `NO_LLM_PROVIDER` nie sprawdzają roli).
2. **Fragmenty kluczy i adresy** — surowa treść wyjątku dostawcy trafiała 1:1 do ramki SSE.
   OpenAI/OpenRouter odbijają w komunikacie fragment podanego klucza oraz adres endpointu;
   na zrzucie PRZED widać klikalny link `https://openrouter.ai/api/v1/chat/completions`.
3. **Wewnętrzne ścieżki diagnostyczne** — `/api/llm/health/detailed` wklejane w rozmowę.
   Ta pozycja jest bramkowana rolą (admin/owner) i zostaje — kryterium odbioru wprost jej
   wymaga („admins retain correlated diagnostics").

Punkty 1 i 2 są naprawione; punkt 3 pozostaje, ale wyłącznie za bramką roli.

## R2 — Naprawa

**Serwer** — `server/src/services/ai/providerErrorMapper.ts` (nowy). Klasyfikuje po jawnym
`code`, potem po statusie HTTP dostawcy, na końcu po wzorcach w treści. Zwraca
`{ httpStatus, errorCode, legacyCode, safeMessage, logMessage, retryable }`. Siedem kodów
kanonicznych: `AI_RATE_LIMIT`, `AI_UNAVAILABLE`, `AI_CONFIG`, `AI_TIMEOUT`,
`AI_STREAM_INTERRUPTED`, `AI_EMPTY`, `AI_ERROR`. Surowa treść zostaje w `logMessage`
(log serwera) i nie wchodzi do żadnej odpowiedzi. Pole `code` na drucie **bez zmian** —
zgodność wstecz z klientami i testami sprzed naprawy; `errorCode` jest dołożone obok.
Podpięte w ośmiu miejscach `ai.routes.ts`. Ramki `PARTIAL_RECOVERY_*` dostały pole `error`,
więc przerwany strumień przestał ginąć w ciszy.

**Front** — `src/components/AIChat/aiProviderErrorCopy.ts` (nowy) jest jedynym miejscem,
które zamienia kod na zdanie: co się stało + co użytkownik może zrobić. Klucze
`aiChat.providerError.*` w obu `translation.json` (pl 34289 → 34305, en 32300 → 32316 liści;
delta **+16**, zero ubytku). Widok: `AiProviderErrorNotice.tsx`.
Podpięci konsumenci: `api.ts` (zagnieżdżony ternary z twardymi napisami PL/EN → wspólne
źródło), `teresaRuntimeCopy.ts` (dwa twarde zdania bez `t()` i bez polskich znaków),
`UnifiedChatPanel.tsx` (metadane niosą KOD, nie `err.message`), `MessageRenderer.tsx`,
`useCanvasAIStream.ts` (3 miejsca), `WorkCanvasDocumentPanel.tsx` (brakujący `onError`).

| Przypadek | PO — kod na drucie | PO — co widzi użytkownik |
| --- | --- | --- |
| 429 limit | `errorCode: AI_RATE_LIMIT`, HTTP 429 | „Asystent obsługuje w tej chwili zbyt wiele zapytań. / Odczekaj chwilę i wyślij wiadomość ponownie." |
| 401 / brak dostawcy / model nieznany | `AI_CONFIG`, HTTP 503 | „Asystent nie jest dostępny na tym koncie. / Skontaktuj się z administratorem." |
| 5xx / wyłącznik | `AI_UNAVAILABLE`, HTTP 503 | „Asystent jest chwilowo niedostępny. / Spróbuj za moment albo wybierz inny model." |
| timeout | `AI_TIMEOUT`, HTTP 504 | „Asystent odpowiadał zbyt długo. / Spróbuj ponownie albo skróć pytanie." |
| przerwany stream | `AI_STREAM_INTERRUPTED`, HTTP 502 | „Odpowiedź została przerwana przed końcem. / Wyślij wiadomość ponownie, żeby dostać całą odpowiedź." |
| pusta odpowiedź | `AI_EMPTY`, HTTP 502 | „Asystent nie zwrócił odpowiedzi. / Spróbuj ponownie albo sformułuj pytanie inaczej." |
| nierozpoznany | `AI_ERROR`, HTTP 502 | „Asystent nie mógł wykonać tego polecenia. / Spróbuj ponownie. Jeśli problem wraca, skontaktuj się z administratorem." |

## R3 — Dowody

**Serwer** — `server/src/services/ai/__tests__/providerErrorMapper.test.ts`, **20/20 PASS**
(`cd server && npx vitest run src/services/ai/__tests__/providerErrorMapper.test.ts`).
11 realnych kształtów błędu → kod + HTTP. Test negatywny sprawdza, że ani ciało HTTP, ani
ramka SSE nie zawierają `sk-*`, `openrouter`, nazw modeli, `Circuit [..]`, nazw zmiennych
środowiskowych ani `llm_providers`.
**Dowód mutacyjny:** podmiana `safeMessage: SAFE_MESSAGE[errorCode]` na `readRawMessage(err)`
→ **4 czerwone / 16 zielonych**; przywrócenie → **20 zielonych**.

**Front** — `src/components/AIChat/__tests__/aiProviderErrorCopy.chatOwn016.test.tsx`,
**23/23 PASS**. Siedem kodów = siedem różnych zdań, każde z podpowiedzią działania, zero
technikaliów w widocznym tekście, tokeny `c-warning`/`c-danger` i brak `primary-*`.
**Dowód mutacyjny:** usunięcie bloku `aiChat.providerError` z `pl/translation.json`
→ **1 czerwony / 22 zielone**; przywrócenie → **23 zielone**.

**Pułapka przyrządu (zmierzona):** `tests/setup.ts:46` podmienia CAŁY `react-i18next` atrapą,
której `t(klucz, 'domyślne')` zawsze zwraca wartość domyślną — czyli angielski wpisany
w kodzie. Bez `vi.mock('react-i18next', importActual)` test „tłumaczeń PL" patrzyłby na
napisy EN i przechodziłby na zielono przy **pustym** `pl/translation.json`.

**Wzmocniony test istniejący** — `tests/unit/services/api-chat-stream-recovery.test.ts`
asertował `stringContaining('error')`, co przechodziło również wtedy, gdy do rozmowy trafiała
surowa treść dostawcy (ona też zawiera słowo „error"). Teraz test żąda, żeby
`provider disconnected` **nie** trafiło do rozmowy. **2/2 PASS**.

**Wizualnie** — nowy ekran harnessu `chat-blad-ai` (`dev-render/screens/chat-blad-ai.tsx`,
zarejestrowany w `dev-render/main.tsx`), montuje REALNY `UnifiedChatPanel`:
`?screen=chat-blad-ai&stan=blad-ai&wariant=przed|po`. Wariant `przed` odtwarza stan sprzed
naprawy dosłownie — tekst skopiowany z `git show c800e48860~1:…/teresaRuntimeCopy.ts`,
nie wymyślony na potrzeby zrzutu; rola w harnessie to OWNER, więc pokazuje to, co realnie
widział właściciel.

| Plik | Co pokazuje |
| --- | --- |
| `evidence/grafika/chat-blad-dostawcy-20260903/chat-blad-ai__PRZED__pl__1440__light.png` | `OPENROUTER_API_KEY`, `llm_providers`, klikalny link `openrouter.ai/api/v1/chat/completions`, `AI_STREAM_ERROR`, `ECONNRESET`, `Circuit [openrouter]`, `/api/llm/health/detailed`; jedno zdanie bez polskich znaków dla wszystkich czterech przypadków |
| `…__PRZED__pl__1440__dark.png` | to samo w ciemnym |
| `…__PO__pl__1440__light.png` | cztery przypadki, cztery różne zdania, każde z podpowiedzią działania, zero technikaliów |
| `…__PO__pl__1440__dark.png` | to samo w ciemnym (realny motyw ciemny, nie duplikat jasnego) |

**Dostępność (`--a11y=1`, axe):** PO light **0**, PO dark **0**.
Pierwsza wersja bloku miała **5 węzłów `color-contrast`** w jasnym — zmierzone i naprawione:
`--c-text-muted` #64748b na obu odcieniach dawał 3,85–3,96:1 (`src/index.css:247` opisuje
dokładnie tę pułapkę: tokeny są kalibrowane na zwykłym tle, nie na tincie) → zwykły
`text-c-text`; `--c-danger` #e80538 na `bg-c-danger/10` #f8e2e6 dawał 3,77:1 → skalibrowany
na odcieniu `--c-danger-table` #c1042f (`src/index.css:259/422`), wyliczone **5,12:1**.
Nowy token nie powstał. `--c-warning` #a3541c przechodził od razu (jest już przyciemniony
„for AA on warning/10", `src/index.css:119`).
PRZED dark ma **1** naruszenie `color-contrast` — stan zastany chromu Czatu, nie ten blok.

**Bramki repo:** `check-list-canon`, `check-artefakt`, `check-triada`, `check-gestosc`,
`check-focus-canon --ci` — wszystkie OK, dług nie rośnie (hook pre-commit przy każdym commicie).

## Czego NIE zrobiono

- **Nie uruchomiono żywego dostawcy.** `OWNER_REVIEW` wymaga przelotu „with an authorized real
  provider" (send/stream/cancel/retry/recover, brak fałszywej odpowiedzi/artefaktu). To
  wymaga klucza dostawcy, którego robotnik nie ma i nie wolno mu wpisywać. Zamknięta jest
  **połowa pozycji**: bezpieczne komunikaty i rozdzielenie diagnostyki. Połowa „przelot na
  żywym dostawcy" zostaje otwarta.
- **Nie ruszono `AIPipeline.handleError`** — jego wnioskowanie kodu (`INVALID_API_KEY` /
  `RATE_LIMIT` / `CIRCUIT_OPEN`) nadal działa równolegle do nowego mappera. Mapper przyjmuje
  te kody na wejściu, więc nie ma sprzeczności, ale są to dwa miejsca robiące podobną rzecz.
- **Nie sprawdzono innych modułów** wołających model (`/api/ai/insights`, `/api/ai/nudges`,
  `/api/ai/report/*` itd.). Zakres to Czat i jego kanwa. `ensureAiProviderAndAccess`
  i `mapLlmCallError` są wspólne, więc te trasy skorzystały ubocznie — ale ich widoków
  nie mierzono.
- **Nie mierzono zapisu do bazy** — `metadata` wiadomości niesie teraz kod zamiast treści,
  ale stare rekordy w `chat_messages` z `metadata.error` = surowa treść dostawcy **zostają**.
  Czyszczenie historycznych rekordów nie było w zleceniu.
- **Nie ruszono ośmiu innych tras w `ai.routes.ts`**, które nadal odsyłają `error: (err as Error).message`
  wprost do klienta: `/policy` (GET 6838, PATCH 6858), `/policy/can-perform/:actionType` (6880),
  `/memory/project/:projectId` (6906, 6973), `/memory/project/:projectId/decision` (6944),
  `/memory/user` (6958, 7001), `/memory/org`. To **nie są** błędy dostawcy AI (to błędy bazy
  i walidacji), więc `providerErrorMapper` ich nie dotyczy i są poza zakresem `CHAT-OWN-016` —
  ale wyciek treści wyjątku do przeglądarki jest ten sam co rodziny i wart osobnego zgłoszenia.
