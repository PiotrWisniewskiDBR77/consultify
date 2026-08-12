# Case Workspace V1 — STATUS TERMINALNY, 2026-08-12

## Werdykt

**`BLOCKED`** — trzy pozycje, z czego **tylko jedna** to VoiceOver.

Nie ogłaszam `READY_FOR_CODEX_REVIEW` ani
`BLOCKED_BY_HOST_PERMISSION — VOICEOVER_MANUAL_EVIDENCE ONLY`. Ta druga formuła
wymagałaby, żeby poza VoiceOver wszystko przechodziło. Nie przechodzi.

| co | wartość |
|---|---|
| worktree | `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809` |
| branch | `claude/case-workspace-v1-20260809` |
| BASE_SHA | `9d17cac11484a82f729a51044e30453e39fbcb02` |
| **HEAD** | `c435abdb9507baf81e877c819c91d9c7844b5891` |
| drzewo | czyste |
| zakres | 96+ commitów od BASE |
| push / merge / deploy | **żaden nie wykonany** |

---

## Bramki techniczne — PRZECHODZĄ

| bramka | wynik |
|---|---|
| `server tsc --noEmit` | **EXIT 0** |
| `frontend tsc --noEmit` | **EXIT 0**, 0 błędów, 0 markerów crasha |
| `git diff --check BASE..HEAD` | **EXIT 0** |
| pięć plików adapterów razem | **3/3, po 40/40** |
| e2e oba pliki razem | **34/34** |
| Run 30-minutowy | **`runDurationMs=1800041`**, restart worker PID 40582→40754, 2 wiersze NodeRun; potwierdzony drugim niezależnym przebiegiem (`1800026`, 57617→57741) |
| axe, 4 powierzchnie × 7 szerokości × 2 motywy | **56/56 komórek, 0 critical / 0 serious** |
| migracja fresh + replay | PASS, `Database ready`, `/api/ready` 200 |
| walidacja OpenAPI offline | PASS, dowód braku sieci, kontrole negatywne ×2 |
| bootstrap capability | 8/8 + kontrola negatywna w obu trybach porażki |
| generator rejestrów | **deterministyczny**, dwa przebiegi bajtowo identyczne |

Zielone bramki nie czynią produktu używalnym. Poniżej dlaczego.

---

## BLOKER 1 — rdzeń V1 nie ma ścieżki użytkownika

**Zweryfikowane osobiście przez koordynatora, ogniwo po ogniwie:**

```
trasy serwera            zamontowane (routes/caseWorkspace/index.ts:46)   ✓
klient HTTP w api.ts     istnieje (components/CaseWorkspace/api.ts)       ✓
komponenty → ODCZYT      listPlanVersions, getPlanGraph, validatePlanVersion  ✓
komponenty → ZAPIS       createPlanDraft, updatePlanDraft, proposePlanVersion,
                         publishPlanVersion, requestChangesOnPlanVersion,
                         withdrawPlanVersion                              ZERO
```

**Użytkownik nie może w produkcie stworzyć, zaproponować ani opublikować planu.**
Backend to potrafi, testy dowodzą że potrafi, UI tego nie woła.

To ta sama rodzina co siedem martwych adapterów i outbox worker bez callera —
ale w **centrum** V1, nie na peryferiach.

Uwaga metodyczna: pakiet L2 doszedł do tego wniosku **złą metodą** (szukał nazw
funkcji serwerowych w kodzie frontendu, co z definicji nic nie znajdzie).
Wniosek okazał się trafny, ale został potwierdzony dopiero bezpośrednim
sprawdzeniem wywołań komponentów.

---

## BLOKER 2 — zakres wizualny bez dowodu

- `VISUAL_TRIADA_SPEC_A_LEDGER`: **233 z 235 wierszy** bez jakiegokolwiek dowodu
- GAP całościowy: **1518** (1261 `NOT_IMPLEMENTED` + 241 `PARTIAL` + 16 `EVIDENCE_MISSING`)
- `IMPLEMENTED_AND_PROVEN` bez dowodu: **0** ← ta liczba jest zdrowa

GAP **wzrósł** 1516 → 1518 podczas tej fali. To jest właściwy kierunek: L1 i L2
dodały 15 nowych wierszy `PARTIAL` i **zero** awansów do „proven", bo uczciwa
ocena znalazła więcej otwartej pracy niż zamknęła.

Najcenniejsze były **odmowy** L1 — ~10 wierszy kuszących do zamknięcia
istniejącymi dowodami odrzucono z konkretnym powodem (`BottomNavigation` to nie
jest pill z Menu 2; wiersz dotyczy ekranu, którego dowód nie obejmuje; wiersz
złożony z niezaewidencjonowaną klauzulą).

---

## BLOKER 3 — VoiceOver

**`BLOCKED_BY_HOST_PERMISSION — VOICEOVER_MANUAL_EVIDENCE`**

Dwie próby automatyczne, oba okna uprawnień odrzucone (`user_denied` ×3 każde).
Bez podglądu ekranu nie da się odczytać panelu napisów ani potwierdzić
przywrócenia ustawienia hosta. Trzeciej próby nie wykonano, zabezpieczenia nie
obchodzono.

**To nie jest PASS ani N/A.** Runbook ręczny: `VOICEOVER_MANUAL_RUNBOOK.md`
(zmierzony stan wyjściowy do przywrócenia + 15-punktowa ścieżka krytyczna).

---

## Co ta sesja realnie zamknęła

- **Kolizja rejestru capability — cała klasa, 3 rundy, 3 różne naprawy.**
  `case_workspace_capabilities` ma UNIQUE bez zakresu organizacji, a vitest
  uruchamia pliki współbieżnie. Naprawy: prywatne id per przebieg
  (documentsAdapter, assessmentAdapter, resultsAdapter) i **advisory lock**
  (capabilityBootstrap × bootWiring — tam prywatne id wypatroszyłoby test, bo
  oba wołają zahardkodowany punkt wejścia produkcyjnego).
- **`resultsAdapter` naprawiony mimo braku czerwonego testu** — przechodził 8/8
  w ~20 parowaniach, ale odczyt bazy co 20 ms pokazał churn `0→1→0→1→0→1→0`.
  Uśpiony wyścig strzelający raz na dwadzieścia przebiegów jest groźniejszy niż
  taki, który wywala się zawsze.
- **Bramka axe domknięta i jedno znalezisko WYCOFANE** — „pozostały serious
  contrast" nie odtworzył się trzema niezależnymi metodami. Elementy okazały się
  globalnym chrome (`UserProfileMenu.tsx`, `previewStyles.ts`), nie Case
  Workspace, i przechodzą AA (dark ~7–14:1, light ~4,76–10,35:1).
- **Trzy rejestry przestały milczeć** — TRIADA/SPEC-A, responsive, journey.

---

## Pułapki dopisane w tej fali

1. **Pomiar na ruchomym drzewie.** Pierwszy przebieg suity dał 14 czerwonych;
   w jego trakcie pakiet robił `git stash`/`stash pop`. Powtórka na nieruchomym
   drzewie: `chainTenancy` zniknął z listy. **Zakaz `stash` obowiązuje wszystkich.**
2. **Test 30-minutowy siedział w domyślnym globie suity** — każdy pełny przebieg
   trwał ~1806 s i nadpisywał zacommitowane dowody. Katalog dowodów jest teraz
   opt-in (`CW_LONGRUN_EVIDENCE_DIR`); wykluczaj `'**/longRun/**'` obok `'**/e2e/**'`.
3. **CRLF udaje „trailing whitespace".** `perl s/[ \t]+$//` nie zmienił nic;
   dopiero `xxd` pokazał `0d0a`. Ścigaj bajty, nie etykietę.
4. **`git diff --check BASE..HEAD` czyta historię ZACOMMITOWANĄ** — poprawka
   w drzewie roboczym jest dla tej bramki niewidzialna.
5. **Animacja, która nigdy się nie ustala, produkuje widmowe naruszenia axe** na
   NIEPOWIĄZANYCH elementach. Wymuś `getAnimations().forEach(a => a.finish())`
   przed pomiarem; przełączanie motywu samym `classList` daje nieświeże
   `getComputedStyle` (ta sama rodzina).
6. **Backend startowany przez `nohup … &` w kończącym się poleceniu jest
   sprzątany jako sierota** — dwa `SIGTERM`, exit 0. Uruchamiaj jako śledzone
   zadanie długobieżne.

---

## Czego następca NIE ma diagnozować od nowa

F2 (e2e), bootstrap capability, walidacja OpenAPI, `createNativeDeck`, ordering
migracji w 5 mechanizmach, `--safe`, Run 30-minutowy, kolizja rejestru
capability (3 rundy), macierz axe 56/56. Wszystko ma dowód i kontrolę negatywną.

## Kolejność dla następcy

1. **Podłączyć UI do zapisu planu** — bez tego V1 nie jest używalne.
2. Zaewidencjonować zakres wizualny (233 wiersze) albo wyłączyć go z V1
   z cytatem z kanonu / numerem decyzji właściciela.
3. VoiceOver — ręcznie wg runbooka albo zatwierdzić okno uprawnień.
