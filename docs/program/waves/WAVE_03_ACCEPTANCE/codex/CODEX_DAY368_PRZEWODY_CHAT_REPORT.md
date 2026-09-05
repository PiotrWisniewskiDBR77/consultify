# CODEX — dyżur 368 — przewody Chat

Data: 2026-09-05  
Baza: `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`  
Gałąź: `codex/day368-przewody-chat-20260905`  
Stan: **PARTIAL — kod K2/K6/D-4 i dowody mutacyjne zamknięte; zrzut i selektywna aktualizacja reachability pozostają zablokowane**.

## Wynik

- K2: przycisk „Akcje biznesowe” ma fallback do ogólnie dostępnej trasy `/ai-actions`, ale wyłącznie za `chatBusinessActionsNav` (`defaultValue: false`, `allowLocalOverride: true`) w `src/hooks/useFeatureFlags.tsx`. Przy fladze OFF przycisk pozostaje niewidoczny.
- K6: `UnifiedChatPanel` używa `chatKickoffMessage` ze store jako fallbacku, więc montaż `/chat` z samym `mode="full"` wysyła kickoff i czyści store. Jawny prop ma pierwszeństwo; montaż AIConsultant nie czyści globalnego handoffu, a MainLayout-style callback pozostaje właścicielem konsumpcji.
- D-4: przycisk panelu roboczego przełącza `title` i `aria-label` z „Open work panel” na „Close work panel”; oba słowniki dostały dokładnie po jednym liściu.
- `quickPrompts` i `contextActions`: **CELOWE** pominięcie na `/chat`; oba opisują kontekst modułu/artefaktu, którego ogólny pełnoekranowy chat nie ma.

## R0 — cztery twarde zasady

Przeczytałem zasadę, że dowodem jest zachowanie komponentu, a nie asercja na tekście źródła. Przeczytałem zasadę, że test ma montować prawdziwy `UnifiedChatPanel` z propsami realnej trasy `/chat`. Przeczytałem zasadę, że nowy widoczny przycisk pozostaje za flagą domyślnie OFF do wizualnego akceptu właściciela. Przeczytałem zasadę, że globalny `tests/setup.ts` jest nietykalny, dlatego test ma własny lokalny mock `useAppStore` z selektorem oraz `getState()`.

## Stan wejściowy — wynik dosłowny

```text
MARKER OK
Preparing worktree (new branch 'codex/day368-przewody-chat-20260905')
HEAD is now at 9715bab7ea docs(ledger): DEC-395 — decyzje wlasciciela 05.09 rano (jezyk, macierz DRD, Organizacja redesign, superadmin na stagingu, brak werdyktu nie dotarlem)
[core]
        bare = false
9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c
```

Marker jest przodkiem tipa `github-backup/grafika/m03-20260902`; tip był do przodu. Zgodnie z DEC-2026-08-26-95 praca wystartowała dokładnie z markera, bez rebase i bez merge.

Po materializacji: 51 GiB wolnego (wcześniejsza kontrola: 60 GiB), porty 6439/5579 wolne, `0` kontenerów `cx-day368`. Baza i backend nie były potrzebne ani uruchamiane.

## Montaże i propsy

Pomiar przed dodaniem testu: **11 montaży w 9 plikach**, pełna lista z adnotacją propsów: `evidence/przewody-chat/montaze.md`. Żaden nie przekazywał `onNavigateToActions`; `/chat` i `/chat/:id` przekazywały wyłącznie `mode="full"`.

| Rodzina | `/chat` przed | Werdykt |
| --- | --- | --- |
| `onNavigateToActions` | brak | DEFEKT — fallback naprawiony za flagą OFF |
| `kickoffMessage` / `onKickoffConsumed` | brak | DEFEKT — fallback ze store naprawiony |
| `quickPrompts` | brak | CELOWE — kontekst modułu |
| `contextActions` | brak | CELOWE — akcje konkretnego artefaktu |

Inspekcja wszystkich pól `UnifiedChatPanelProps` nie znalazła dalszego członka tej samej rodziny `{prop && (...)}` pomijanego przez `/chat`.

## Wybór celu K2

Router montuje `ROUTES.AI_ACTIONS` (`/ai-actions`) jako `ActionProposalView` bezpośrednio pod `MainLayout` i `RouteErrorBoundary`, bez `InternalToolsGate`. `ROUTES.AI_OS.ACTION_CENTER` (`/ai/action-center`) przechodzi przez `renderInternalToolsShell` i `canUseInternalTools(currentUser)`. Dlatego bezpiecznym celem dla zwykłego użytkownika jest `/ai-actions`.

Dowód renderu samego przycisku i klik→`useNavigate('/ai-actions')` jest w realnym komponencie. Pełny wizualny zrzut nie powstał: lokalny produkt na porcie 5579 zatrzymał się na czterocyfrowym PIN-ie, którego zlecenie nie podaje, a `dev-render/**` nie ma licencji zapisu. Stan tej bramki: `BLOCKED_AUTH`, bez zmiany flagi na ON.

## Dowody mutacyjne RED → GREEN

Komendy wszystkich pakietów: `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/AIChat/__tests__/UnifiedChatPanel.przewodyChat.test.tsx --retry=0 --reporter=json --outputFile=...`.

- R1: GREEN 2/2; po usunięciu fallbacku RED wyłącznie „routes Business Actions...” z powodu braku przycisku; po `cp` GREEN. SHA przywróconego komponentu `b1b80b126c60c41a744cd2a1ad6955cafe351e44b6997b66de14618db0f97398`.
- R2: GREEN 5/5; po usunięciu store fallbacku RED dwa przypadki store (`/chat` oraz MainLayout-style), a lokalny prop osadzonego panelu pozostał GREEN; po `cp` GREEN. SHA `7c3224dbf89fee4538455ca2b8c334a060c7a258b59404483205559656ec5b6b`.
- R3: GREEN 6/6; po przywróceniu statycznej etykiety RED wyłącznie „changes the work panel title...”, pozostałe 5 GREEN; po `cp` GREEN. SHA `946f215abc109725209ae0077a1eb774007468971b6fb2bd59b95ee93d9f35c9`.

Artefakty JSON są poza repo w `/private/tmp/cx-day368-przewody-chat-artefakty/`; mapa nazw i plików: `evidence/przewody-chat/dowody-testow.md`.

Pułapki testowe: pakiet jest czysto frontendowy (`RUN_DB_TESTS=0 MOCK_DB=true`), więc a–d dotyczące serwera/PG/auth nie leżą na ścieżce. Pułapka e dotyczyła wprost: to pierwszy lokalnie zmierzony test montujący realny komponent, z lokalnym mockiem `useAppStore` zawierającym statyczne `getState()`; `tests/setup.ts` nie zmieniono. Reporter JSON, nie kod wyjścia, potwierdza pełne nazwy i statusy.

## Zasięg testów po `fullName`

PRZED: 14 pełnych nazw z trzech istniejących pakietów. PO: te same 14 plus sześć nowych nazw; **0 nazw zniknęło**.

Dodane:

1. `UnifiedChatPanel chat route wiring keeps Business Actions hidden with the flag at its default OFF value`
2. `UnifiedChatPanel chat route wiring routes Business Actions to the public AI Actions screen when the default-OFF flag is enabled`
3. `UnifiedChatPanel chat route wiring sends and consumes the store kickoff with the exact props used by the chat route`
4. `UnifiedChatPanel chat route wiring preserves an embedded panel kickoff prop and does not clear the unrelated global handoff`
5. `UnifiedChatPanel chat route wiring keeps MainLayout-style consumption delegated to the provided callback`
6. `UnifiedChatPanel chat route wiring changes the work panel title and accessible label after opening it`

## Warunki wspólne — PRZED / PO

| Warunek | PRZED na markerze | PO | Werdykt |
| --- | ---: | ---: | --- |
| leaf PL | 35200 | 35201 | +1, poprawnie |
| leaf EN | 33067 | 33068 | +1, poprawnie |
| focus canon | 0 | 0 | bez regresji |
| list canon | 0 | 0 | bez regresji |
| artefakt canon | 0 | 0 | bez regresji |
| reachability | 1 | 1 | nadal czerwone; PO pokazuje własny test i jeden zastany obcy plik |

`--update-baseline` nie został wykonany: skrypt nie ma selektywnego argumentu i dopisałby jednocześnie obcy `src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts`, czego licencja wprost zabrania. Własny test pozostaje jawną deltą zamiast ręcznej edycji baseline.

## Mianowniki #1–#9

| # | Wynik PO |
| --- | --- |
| 1 | 11 produkcyjnych montaży w 9 plikach; test dodaje 6 wywołań, nie liczy się do mianownika produktu |
| 2 | 3 wystąpienia `onNavigateToActions` po uogólnieniu do `handleNavigateToActions` |
| 3 | 2 produkcyjne montaże z propem `kickoffMessage` (`MainLayout`, `AIConsultantPanel`) |
| 4 | 2 dodatkowe propy: `quickPrompts`, `contextActions`, oba CELOWE |
| 5 | 1 plik testowy renderuje realny komponent, 6 przypadków |
| 6 | 0/3 pól kickoffu i brak `getState()` w globalnym mocku; lokalny mock kompletny |
| 7 | reach exit 1; delta: własny test + zastany obcy test Initiatives |
| 8 | PL 35201 / EN 33068 |
| 9 | ostatnia litera przed wpisem: AF; wpis dyżuru dostał AG |

## Korekty wobec instrukcji

- Leaf-count autora `34331 / 32342` nie zgadza się z markerem: pomiar dał `35200 / 33067`. Obowiązuje pomiar.
- Reachability autora opisywało trzy zastane pliki; bieżący pomiar PO pokazuje jeden zastany plik Initiatives oraz własny nowy test. Nie przypisałem sobie cudzego długu.
- Audyt/V1 mówił o 10 montażach; pomiar z markera potwierdził 11 w 9 plikach.
- Instrukcja wymaga zrzutu, ale nie licencjonuje zapisu `dev-render/**`; wybrano bezpieczniejszą interpretację: brak zapisu poza tabelą i jawne `BLOCKED_AUTH`.

## Commity (`git show --stat`)

- `87d7525ab0 fix(chat): wire business actions behind default-off flag` — 3 files, 210 insertions, 2 deletions.
- `b5dd3d9d42 fix(chat): consume global kickoff in every panel mount` — 2 files, 64 insertions, 8 deletions.
- `c6499056fa fix(chat): announce work panel close state` — 4 files, 31 insertions, 4 deletions.
- `774c071cbd docs(chat): record day 368 wiring evidence` — 4 files, 45 insertions.

## Bezpieczeństwo wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiłem bazy, `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## PYTANIA DO WŁAŚCICIELA

1. Czy `/ai-actions` (`ActionProposalView`) jest docelowym ekranem przycisku „Akcje biznesowe”, czy wybierasz inny cel?
2. Czy po dostarczeniu brakującego lokalnego zrzutu akceptujesz domyślne włączenie `chatBusinessActionsNav`? W tym dyżurze flaga pozostaje OFF.
3. Czy chcesz osobnego zakresu na selektywne rozszerzenie narzędzia `reachability --update-baseline`, aby można było rejestrować wyłącznie test autora bez przyjmowania równoległego długu?

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano wizualnie przycisku w pełnym lokalnym produkcie: brak PIN-u do lokalnego profilu i brak licencji na nowy harness.
- Nie zweryfikowano semantyki `/ai-actions` na realnych danych użytkownika; potwierdzono dostępność w drzewie routera i zachowanie nawigacji komponentu, nie kompletność danych widoku.
- Nie wykonano produkcyjnego HTTP, urządzeń mobilnych, eksportów, wdrożenia ani akceptu właściciela; ten dyżur jest wyłącznie frontendowy i lokalny.
- Nie zaktualizowano reachability baseline z przyczyny opisanej wyżej.
