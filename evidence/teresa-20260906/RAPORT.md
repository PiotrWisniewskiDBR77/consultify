# Teresa — język polski i realne źródła (2026-09-06)

Gałąź `ai/teresa-polski-zrodla`, odgałęziona od `origin/staging` = `59e282df88`.
Commity: `5ded4ddd1c` (język), `45adcccf33` (źródła), `e4ad77f1d8` (dowody + skrypty).

---

## 1. Przyczyna — odpowiedzi po angielsku

**Zmierzone przed naprawą** (`/private/tmp/stanowisko-noc/teresa-stream.txt`):
`POST /api/ai/chat/stream` z polskim pytaniem → 200, model `openai/gpt-4o-mini`,
odpowiedź: *„I operate in English; please continue in that language."*

Język rozstrzygały **cztery niezależne miejsca**, każde z własnym `|| 'en'`, i każde
czytające wyłącznie `req.body.language`:

| Plik | Linia (na `59e282df88`) | Kod |
|---|---|---|
| `server/src/routes/ai.routes.ts` | 1958 (`/chat/stream`) | `const langCode = (language \|\| 'en').split('-')[0];` |
| `server/src/routes/ai.routes.ts` | 1450 (`/chat/confirm`) | to samo |
| `server/src/services/ai/AIPipeline.ts` | 1198, 1010, 1288 | `… \|\| userMemory?.preferences?.language \|\| 'en'` |
| `server/src/services/ai/AIPipeline.ts` | 1749 | `const langBaseFinal = conversationLang ? … : 'en'` |
| `server/src/ai/persona.ts` | 600 (`detectLanguage`) | `(conversationLanguage \|\| userPreferredLanguage \|\| 'en')` |

Skutek: **każdy wołacz, który nie poda `language`, dostaje angielski.** Front w głównym
czacie go podaje (`src/hooks/useAIStream.ts:1351`), ale nie robią tego m.in.
`src/hooks/useIndependentAI.ts`, `src/components/MyWork/notebook/AICommandPrompt.tsx`,
`src/components/AIChat/CanvasEditor/useCanvasAIStream.ts` ani żadne wywołanie API spoza UI.
Nic nie czytało profilu użytkownika (`users.language`, migracja
`20260726_users_language_preference.sql`) ani nagłówka `Accept-Language`.

To stało w sprzeczności z `docs/ssot/ZASADY_AI_TERESA_SSOT.md` §8 J1:
„**Polski jest domyślny** dla całego UI Teresy i dla treści generowanych".

### Naprawa
Nowy SSOT: **`server/src/services/ai/languagePolicy.ts`** — jedyne miejsce, w którym
rozstrzyga się język i buduje instrukcję dla modelu. Kolejność:

`jawny wybór z żądania` → `język wątku` → `users.language` → `Accept-Language` → **`pl`**

Podpięte w: `ai.routes.ts` (`/chat/stream`, `/chat/confirm`, `/refine-text` i 3 dalsze
handlery pól AI), `AIPipeline.ts` (4 miejsca), `persona.ts` (`detectLanguage`).
Odczyt `users.language` jest best-effort i pomijany, gdy język podano wprost —
ścieżka gorąca nie dostaje dodatkowego zapytania.

---

## 2. Przyczyna — `degraded: no_sources`

**Łańcuch, zmierzony w kodzie i na bazie:**

1. `server/src/routes/ai.routes.ts:5819` liczy `used_sources` **wyłącznie** z ramek SSE
   `citations` (`degraded = used_sources.length === 0 ? {mode:'no_sources'} : null`).
2. Cytaty emitowały tylko cztery ścieżki: baza wiedzy produktu (`:3580`), wyszukiwanie web
   (`:4008`), załączniki rozmowy (`:4411`) i korpus dokumentów organizacji (`:4237`).
3. Korpus organizacji jest za flagą `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` (`ai.routes.ts:4160`).
   **Na stanowisku i na stagingu ta zmienna nie jest ustawiona** — potwierdzone odczytem
   środowiska działającego procesu (`ps eww 69883`) i `server.env`. Blok jest bezczynny.
   Druga flaga, `ENABLE_TERESA_RETRIEVAL` (`:3624`, notatki/wnioski/inicjatywy po słowach
   kluczowych), też nie jest ustawiona.
4. Nawet po ich włączeniu nic by nie znalazł. Pomiar na `consultify_noc`, org DBR77
   (`cc9db573-260f-4a19-927f-f3cc1fbaea38`):

   ```
   knowledge_documents      = 0
   knowledge_docs           = 0   (cała tabela, nie tylko org)
   knowledge_chunks         = 0
   ai_knowledge_embeddings  = 0
   ```

5. **Ale dane modułu istnieją**: `initiatives` = 71 (org), `tasks` = 84 (org), z czego 20
   przypisanych do konta audytowego. `AIContextBuilder._buildExecutionContext` /
   `_buildOrganizationContext` je czytają, a `AIPipeline.buildExecutionSection`
   (`:1577`) / `buildOrganizationSection` (`:1567`) wkładają do promptu — więc Teresa
   **na nich odpowiadała, tylko nigdy ich nie nazwała.**

**Wniosek: `no_sources` był fałszem w drugą stronę** — odpowiedź była ugruntowana danymi
klienta, a rodowód meldował brak źródeł. `ZASADY_AI_TERESA_SSOT.md` Z1 wymienia trzy klasy
źródeł, które Teresa ma nazywać, w tym „**dane modułu w zasięgu**" — ta klasa nie miała
po stronie cytatów żadnej implementacji.

### Naprawa
Nowy moduł **`server/src/services/ai/moduleContextGrounding.ts`**, wpięty w
`/chat/stream` (`ai.routes.ts`, blok „Dane modulu jako ZRODLO"):

| Ekran | Co czyta (zawsze `WHERE organization_id = ?`) |
|---|---|
| `/initiatives` | 12 najświeższych inicjatyw + pełna karta otwarta w panelu (po `selectedObjectId`) |
| `/my-work` | do 15 niezamkniętych zadań przypisanych do użytkownika |
| `/execution` | inicjatywy + zadania + ostatnie decyzje |
| czat ogólny (brak `screenContext`) | 6 inicjatyw + 6 ostatnich decyzji organizacji |

Rekordy trafiają do `systemInstruction` jako blok `## DANE MODUŁU W ZASIĘGU` ze
znacznikami `[M1]…[Mn]` **i** wychodzą jako ramka `citations` typu `module_data`, więc
`source_ledger.used_sources` przestaje być pusty.

Zachowana uczciwość: pusty moduł → `null` → `no_sources` zostaje. `privateMode`,
`knowledgeSources.organizationData === false` oraz zawężenie zakresu przez użytkownika
(`selected_material_only`) całkowicie blokują odczyt.

---

## 3. Testy i mutacje

`server/src/services/ai/__tests__/languagePolicy.test.ts` — 21 testów
`server/src/services/ai/__tests__/moduleContextGrounding.test.ts` — 10 testów

Surowy zapis przebiegów mutacyjnych: `mutacje.txt`. Każda mutacja to realne uszkodzenie
kodu produkcyjnego, po którym testy wracały do stanu wyjściowego:

| # | Mutacja | Wynik |
|---|---|---|
| L1 | `DEFAULT_AI_LANGUAGE = 'en'` | 4 testy padły |
| L2 | usunięty znacznik `[LANGUAGE INSTRUCTION:` | 1 test padł |
| L3 | `normalizeAiLanguage` zwraca `'en'` zamiast `null` | 2 testy padły |
| L4 | wycięte zdanie „Even if the user writes… different language" | 1 test padł |
| M1 | usunięty `pushCitation` z gałęzi inicjatyw | 1 test padł |
| M2 | zapytanie o inicjatywy bez `organization_id` (wyciek tenanta) | 1 test padł |
| M3 | pusty moduł zwraca obiekt zamiast `null` (zmyślone źródła) | 1 test padł |
| M4 | ignorowany `allowOrganizationData === false` (czytanie w trybie prywatnym) | 1 test padł |

Po każdym przywróceniu oryginału: **31/31 zielone**.

Zaktualizowany też `tests/unit/ai/persona.test.ts` — jedna asercja utrwalała stary defekt
(`detectLanguage(undefined, undefined) === 'en'`). Zmiana jest opisana w pliku, nie cicha.

---

## 4. Trzy dowody na realnym modelu

Serwer testowy na `:4110` (kod tej gałęzi, ta sama baza `consultify_noc`, te same klucze).
Skrypt: `scripts/dev/teresa-dowod-20260906.sh`. **Żadne wywołanie nie wysyła pola
`language`** — dokładnie tak, jak wołacze, które je pomijają.
Pytanie: „Podsumuj w jednym zdaniu, co robi ten moduł."

| Dowód | Znaki PL | Ang. słowa | `used_sources` | `degraded` | Typy źródeł |
|---|---|---|---|---|---|
| `1-czat-ogolny` | 5 | 0 | **12** | `null` | `module_data` × 12 |
| `2-inicjatywy` | 6 | 0 | **12** | `null` | `module_data` × 12 |
| `3-moja-praca` | 7 | 0 | **15** | `null` | `module_data` × 15 |

Odpowiedzi (surowe SSE + rozbiór w `*.sse` / `*.json`):

- 1: „Moduł „Initiatives" zarządza inicjatywami transformacyjnymi, przekształcając diagnozy
  w priorytetyzowane projekty z kartami projektów i roadmapami."
- 2: „Moduł „Inicjatywy" zarządza transformacyjnymi projektami, umożliwiając tworzenie,
  śledzenie i priorytetyzację inicjatyw w organizacji."
- 3: „Moduł „Moja Praca" umożliwia zarządzanie zadaniami, decyzjami i powiadomieniami
  przypisanymi do użytkownika, co wspiera efektywne śledzenie postępów w projektach."

Źródła to **realne rekordy DBR77**, nie ogólniki:
`Inicjatywa: Supply Chain Optimization`, `Inicjatywa: Digital Workplace Platform`,
`Zadanie: DBR77: Zweryfikować eksport raportów publicznych`, …

### Kontrole przeciwne (żeby nie uwierzyć w przypadek)

| Kontrola | Warunek | Wynik |
|---|---|---|
| `K1-pytanie-EN-bez-language` | pytanie **po angielsku**, brak pola `language` | odpowiedź **po polsku** (7 znaków diakrytycznych), 12 źródeł |
| `K2-jawne-EN` | pytanie po polsku, `language: "en"` | odpowiedź **po angielsku**, 12 źródeł |

K1 dowodzi, że język narzuca instrukcja systemowa, a nie język pytania.
K2 dowodzi, że jawny wybór EN nadal działa — nie zabetonowaliśmy polskiego.

**Łącznie 8 wywołań realnego modelu** (`gpt-4o-mini`, po ~15 tokenów wejścia): 3 dowody
w pierwszym, nieudanym przebiegu (patrz §5), 3 w powtórzonym i 2 kontrole.

---

## 5. Zastane, znalezione przy okazji

**a) Bramka `TRIAL_PROFILE_INCOMPLETE` blokuje Teresę po 3 wywołaniach.**
`server/src/services/accessPolicyService.ts:399-416`: organizacja typu `TRIAL`, której
`organizations.onboarding_status != 'ORG_SETUP_COMPLETED'`, dostaje 3 darmowe wywołania AI,
a potem twarde `TRIAL_PROFILE_INCOMPLETE`. DBR77 na stanowisku miała
`TRIAL | NOT_STARTED` — pierwszy przebieg dowodów padł na tym po jednym wywołaniu
(dowody 2 i 3 wróciły puste, `degraded: {mode:'blocked', reason:'access_policy'}`).
Odblokowane **wyłącznie na bazie lokalnej**:
`UPDATE organizations SET onboarding_status='ORG_SETUP_COMPLETED' WHERE id='cc9db573-…'`.
**Do sprawdzenia na stagingu/demo przed MVP** — jeśli tam organizacja też jest `TRIAL`
z nieukończonym onboardingiem, Teresa zamilknie po trzecim pytaniu.

**b) Zastane, niezwiązane porażki testów** (identyczne przed moją zmianą):
11 plików `*.pg.test.ts` w `server/src/services/ai/__tests__` wymaga `RUN_DB_TESTS=1`
i realnego Postgresa (`assertRealPostgres.ts:45`); `day228.imageStyleSafety.test.ts`
pada na braku pakietu `tesseract.js` w `node_modules`. Poza nimi: **203 testy zielone**.

---

## 6. Domknięcie

- `cd server && npx tsc --build tsconfig.build.json` → **exit 0**
- `npx vitest run src/services/ai/__tests__/languagePolicy.test.ts` → 21/21
- `npx vitest run src/services/ai/__tests__/moduleContextGrounding.test.ts` → 10/10
- `npx vitest run tests/unit/ai/persona.test.ts` → 10/10
- `npx vitest run tests/integration/ai/l6-pipeline.test.ts` → 21/21
- `bash scripts/check-list-canon.sh` → exit 0 (dług 361 vs baseline 364 — spadł)
- esbuild frontendu: **niepotrzebny — zero zmienionych plików w `src/`**

Realny diff (`59e282df88..HEAD`): 7 plików, wszystkie po stronie serwera.

---

## 7. Co wymaga wykonania na stagingu

Kod **nie potrzebuje żadnej flagi** — kontekst modułu i język działają domyślnie.
Do rozważenia osobno, po zaindeksowaniu dokumentów:

```bash
# 1. Pomiar (nic nie zmienia) — czy org ma w ogóle co indeksować:
npx tsx server/scripts/teresa-indeksuj-org.ts --org=<ORG_ID_STAGING> --dry-run

# 2. DOPIERO jeśli dry-run pokaże dokumenty bez chunków — do decyzji nadzorcy:
npx tsx server/scripts/teresa-indeksuj-org.ts --org=<ORG_ID_STAGING> --apply

# 3. Flagi korpusu dokumentów — WŁĄCZAĆ dopiero po (2), nie wcześniej:
ENABLE_ORG_KNOWLEDGE_RETRIEVAL=true
ENABLE_TERESA_RETRIEVAL=true
```

Uruchomienie `--dry-run` lokalnie (log w tej sesji) potwierdziło stan: `knowledge_docs = 0`,
czyli **nie ma czego indeksować** i brak źródeł z korpusu dokumentów był tu uczciwy.

## 8. Ryzyka

- **Koszt tokenów.** Blok danych modułu dokłada 12–15 rekordów do promptu systemowego —
  rząd 1–2 tys. tokenów wejścia na wywołanie. Limity: 12 inicjatyw / 15 zadań / 6 decyzji,
  a każdy fragment jest przycięty (`truncate`, 160–480 znaków). Przy `gpt-4o-mini` to
  ułamek grosza, przy modelu premium warto obserwować.
- **Limiter AI wyłączony 05.09** (`DISABLE_RATE_LIMIT=true`, `API_RATE_LIMIT_MAX=1000`).
  Większy prompt × brak limitera = szybsze palenie budżetu, jeśli ktoś zapętli czat.
- **Bramka trialu (§5a)** — realne ryzyko ciszy Teresy na demo po trzech pytaniach.
- Zapytania modułowe idą na każdą wiadomość w czacie. Są indeksowane po
  `organization_id` / `assignee_id` i ograniczone `LIMIT`, ale to 2–4 dodatkowe zapytania
  na wywołanie.
