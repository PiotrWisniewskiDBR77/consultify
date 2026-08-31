---
doc_id: funkcje-modul17-dowod-realnym-modelem
status: canonical
owner: piotr
truth_type: status
established: 2026-08-31
---

# Moduł 17 — dowód realnym modelem: dwa punkty na trzy, i BŁĄD W MOIM KRYTERIUM

| punkt | wynik |
| --- | --- |
| **(a)** model **sam** wywołał narzędzie, bez dyktowania argumentów | **TAK** — 2 kroki `search_knowledge_base`, koszt $0,02, 4386 ms |
| **(c)** ta sama rozmowa przy **wyłączonej** fladze | **TAK** — zero kroków |
| **(b)** znacznik z bazy wiedzy w odpowiedzi | **NIE** — ale patrz niżej |

## ★ Punkt (b) nie przeszedł, bo kryterium było źle postawione — przez nadzorcę

Kryterium brzmiało: „unikalny znacznik z bazy wiedzy **obecny w odpowiedzi**".
Dwie wady, obie moje:

1. **Znacznik siedział wyłącznie w TYTULE dokumentu**, a tytuł był w prompcie. Model
   go powtórzył — więc sprawdzenie nie potrafiło odróżnić „znalazł w bazie" od
   „przepisał z pytania". **Test był z założenia nierozstrzygający.**
2. **Żądanie dosłownego cytatu jest kruche wobec parafrazy.** Model streszcza, a nie
   cytuje — i to jest jego poprawne zachowanie, nie usterka.

## Co odpowiedź modelu mówi NAPRAWDĘ (odczyt nadzorcy z surowego artefaktu)

> „…is an **executive memo** intended for **internal use**. It appears to be
> **concise and written in a consulting style**… it currently **lacks content in
> critical sections** like the key message, findings, and recommendations…"

Prompt zawierał **wyłącznie tytuł**. Typ dokumentu, przeznaczenie, styl i to, że
**sekcje są puste** — tego w pytaniu nie było. Model musiał to wziąć z wyszukiwania.

**Czyli pobranie prawdopodobnie zadziałało, a nie potrafimy tego dowieść, bo dowód
zbudowałem tak, że nie rozstrzyga.** Nie ogłaszam sukcesu na poszlace.

## Drugi brak, uczciwie nazwany przez wykonawcę

Model wybrał `vault_scope: "organization"` i **w ogóle nie podał** `vault_project_id`.
Więc naprawiona dziś ścieżka „nazwa → identyfikator" **nie została na żywym modelu
wywołana ani razu**. Jest dowiedziona deterministycznie atrapą (`fix217.vaultProject
NameContract.pg.test.ts`, 6/6) — ale to nie to samo.

## Stan: MODUŁ 17 NIEZAMKNIĘTY

Nie z powodu wady produktu. Z powodu **dowodu, który nie rozstrzyga**.

## Co trzeba zrobić — konkretnie
1. Znacznik umieścić **w treści dokumentu**, nie w tytule, i **nie podawać go w
   prompcie**. Wtedy jego pojawienie się w odpowiedzi jest rozstrzygające.
2. Kryterium zmienić z dosłownego cytatu na **fakt z treści, którego nie ma w
   pytaniu** (np. konkretna liczba albo nazwa własna ukryta w dokumencie).
3. Prompt sformułować tak, by naturalnie prowadził do zasięgu projektu — inaczej
   ścieżka „nazwa → identyfikator" znów nie zostanie tknięta.
4. Jeden przebieg realnego modelu. Koszt rzędu dwóch groszy.

## Higiena
Zero naruszeń bram dostępu — naprawiono wyłącznie dane fixture. Push wyłącznie do
prywatnego vaulta. Wykonawca odzyskał ~18 GB, usuwając 10 scalonych worktree
(w tym katalog referencyjny nadzorcy — odtworzony).

---

# DOPISEK 31.08 (drugi przebieg) — kryterium przebudowane, (a) i (c) znów TAK,
# ścieżka nazwa→projekt WRESZCIE dotknięta na żywo, (b) znowu NIE — z innego,
# węższego powodu

Budżet: **dokładnie jeden przebieg** realnego modelu (zatwierdzony). Wykonany
raz. Zgodnie z zasadą „STOP przy powtórnym nie" — **nie wykonano drugiego
przebiegu**, mimo że dowody sugerują, że produkt działa.

## KROK 2 — weryfikacja bez modelu (atrapa), WYNIK: PASS

Atrapa podmieniała wyłącznie `llmService.callStream` na obiekt, który i tak
woła PRAWDZIWY `context.executeReadTool` (ten sam callback, którego używa
`ai.routes.ts` dla realnego modelu) z argumentami `{vault_scope:"project",
vault_project_id:"<NAZWA projektu>"}`. Realna trasa HTTP, realna baza,
zero LLM.

```
MOCK_HTTP status=200 eventsCount=19 httpError=brak
MOCK_TOOL_ARGS {"query":"...","vault_scope":"project","vault_project_id":"Pilotaż Retencji Klienci Premium d94e64"}
MOCK_TOOL_RESULT {"source":"knowledge_base","query":"...","vaultScope":"project","results":[{"content":"# Raport z pilotażu programu retencji\n...\nWskaźnik retencji w pilocie Marchewka-7-d215 wyniósł 63,4% ...\n..."}]}
MOCK_FACT_PRESENT pilotCode=true retentionPct=true overall=true
MOCK_VERDICT PASS
```

Dowód: `KnowledgeService.addDocument(...,'project')` + `processDocument` →
`executeToolCall('search_knowledge_base', {vault_scope:'project',
vault_project_id:<NAZWA>})` → dokument realnie wraca, treść zawiera
wstrzyknięty fakt. Mechanika działa. Dopiero po tym PASS uruchomiono model.

## KROK 3 — jeden przebieg realnego modelu

Dokument tym razem osadzony **bezpośrednio w Vault jako `scope='project'`**
(nie przez `document-studio/generate` — ta trasa zna tylko `user`/
`organization`, nigdy `project`; to była luka nadzorcy, teraz obejściona).
Fakt (nazwa własna `Marchewka-7-<sufiks>` + liczba `63,4%`) **wyłącznie w
treści dokumentu**. Prompt: *„Jaki wynik osiągnął pilot opisany w materiałach
projektu „Pilotaż Retencji Klienci Premium 49a1b0"? Sprawdź dostępne materiały
projektowe i podaj konkretny wynik."* — **zero znacznika, zero faktu, zero
tytułu dokumentu** w prompcie.

| punkt | wynik |
| --- | --- |
| **(a)** model sam wywołał narzędzie | **TAK** — 1 wywołanie `search_knowledge_base` (2 zdarzenia SSE: running+completed), ~6 s |
| **(c)** ta sama rozmowa przy wyłączonej fladze | **TAK** — zero kroków, model odpowiada wprost że nie ma dostępu do materiałów |
| **(b)** fakt z treści w odpowiedzi | **NIE** — liczba TAK, nazwa własna NIE (patrz niżej) |

### Argumenty wywołania narzędzia (log serwera, nie SSE — SSE nigdy nie niesie surowych argumentów/wyniku)

```
[ToolExecutor] Executing tool: search_knowledge_base
  args: {"query":"Pilotaż Retencji Klienci Premium 49a1b0","vault_scope":"project","vault_project_id":"Pilotaż Retencji Klienci Premium 49a1b0"}
[executeKBSearch] Policy decision: allowed=true, outcome=allow, scopes=[user_private,org_shared,public_kb]
```

Model **sam** wybrał `vault_scope="project"` i podał `vault_project_id` jako
**NAZWĘ** projektu (nie UUID) — dokładnie ścieżka FIX-217 name-resolution,
którą poprzedni przebieg (31.08, wpis wyżej) w ogóle nie dotknął (model
wybrał wtedy `organization` i nie podał `vault_project_id`). **Ten brak jest
teraz zamknięty na żywym modelu, nie tylko atrapą.**

### Odpowiedź modelu (dosłowny cytat, tura READ ON)

> "The pilot program "Pilotaż Retencji Klienci Premium 49a1b0" achieved a
> retention rate of **63.4%** after twelve weeks of observation, compared to
> **51.2%** in the control group. This result supports extending the program
> for another quarter."

### Dlaczego (b) mimo to NIE — uczciwie, bez podciągania

To NIE jest awaria pobrania. Dowód: model podał **63,4%** (liczba
niezgadywalna) ORAZ **51,2%** — liczbę z grupy kontrolnej, o którą w ogóle
nikt nie pytał i której nie da się zgadnąć. To silniejszy dowód retrievalu niż
wymagałoby samo kryterium. Trasa `executeKBSearch` → `KnowledgeService.
getDocuments(scope='project')` → `ragService.hybridSearch` realnie zwróciła
treść dokumentu modelowi.

Zawiodła **treść odpowiedzi względem MOJEGO kryterium**: kryterium (b)
wymagało nazwy własnej `Marchewka-7-<sufiks>` ORAZ liczby, obie w odpowiedzi.
Liczba jest. Nazwa własna — **nie jest**: model nazwał pilota po prostu „the
pilot program ”<nazwa projektu>"" zamiast wewnętrznego kodu z dokumentu. Powód
jest do zlokalizowania precyzyjnie: nazwa projektu w tym przebiegu zawierała
słowo „Pilotaż" (polskie „pilot"), więc model miał pod ręką naturalny,
gotowy substytut dla „nazwy pilota" i go użył zamiast sięgnąć po wewnętrzny
kod. **To błąd konstrukcji faktu przeze mnie** — analogiczny do pierwszej
usterki (nakładanie się treści dokumentu z treścią promptu), tylko subtelniejszy:
nie dosłowne powtórzenie, tylko semantyczna nadwyżka pozwalająca na
podstawienie.

Zmierzone (Postgres, `ai_usage_logs`, org tego przebiegu):
`openai/gpt-4o` przez OpenRouter, tura ON: 14285 promptTokens / 116
completionTokens; tura OFF: 5726 / 87. Orientacyjny koszt rzeczywisty
(cennik gpt-4o na OpenRouter, nieodczytany wprost z bazy — kolumna
`estimated_cost_usd` pusta) **~$0,05** dla obu tur łącznie — więcej niż
poprzednie „$0,02", bo router wybrał `gpt-4o`, nie `gpt-4o-mini`, i prompt
niósł pełny kontekst organizacji.

## Stan: MODUŁ 17 DALEJ NIEZAMKNIĘTY — zgodnie z zasadą STOP, bez trzeciego przebiegu

(a) i (c) potwierdzone drugi raz z rzędu, na dwóch różnych fixture'ach.
Ścieżka „nazwa → identyfikator projektu" (drugi brak z poprzedniego wpisu)
**zamknięta** — udowodniona na żywym modelu, nie tylko atrapą. (b) nie
przeszło z powodu, który jest teraz precyzyjnie zlokalizowany (nadmiarowa
semantyka w wybranej nazwie własnej), nie z powodu wady retrievalu — ale to
i tak NIE jest ogłoszenie sukcesu na poszlace. Budżet jednego przebiegu
wyczerpany; kolejny przebieg wymaga nowej decyzji, nie tej sesji.

## Co trzeba zrobić — konkretnie (aktualizacja)
1. Fakt-znacznik: użyć nazwy własnej, która **nie dzieli rdzenia słownego**
   z żadnym elementem już widocznym w prompcie (nazwa projektu, tytuł, słowa
   z pytania) — inaczej model ma naturalny substytut i go użyje zamiast
   cytować dokument.
2. Rozważyć kryterium (b) jako **liczba sama wystarcza**, jeśli jest
   praktycznie niezgadywalna (jak `63,4%` + `51,2%` tutaj) — to może być
   wystarczający dowód pobrania bez wymogu nazwy własnej, ale to decyzja do
   podjęcia świadomie, nie do przemycenia post factum w tym pliku.
3. Ścieżka „nazwa → identyfikator projektu" jest już zamknięta na żywym
   modelu — nie trzeba jej dowodzić ponownie.
