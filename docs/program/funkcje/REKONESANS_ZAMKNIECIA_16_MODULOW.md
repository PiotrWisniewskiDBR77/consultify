---
doc_id: funkcje-rekonesans-zamkniecia-16
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# Rekonesans zamknięcia — 16 modułów (2026-08-30, wieczór)

**Cel:** jedna tabela „czego brakuje do CLOSED_FINAL" per moduł, żeby od teraz wydawać
wyłącznie dyżury ZAMYKAJĄCE. Od tej chwili znalezisko z odbioru = pozycja w karcie
modułu, nie nowy dyżur (wyjątek: P0).

**Metoda:** szkic z 16 kart `MODULE_ACCEPTANCE.md` + obu rejestrów, następnie
**weryfikacja W KODZIE przez 5 równoległych agentów-czytelników** (bo karty starzeją
się w ~3 dni). Weryfikacja obaliła 6 tez kart i 2 tezy nadzorcy — wiersze niżej są
stanem KODU na 30.08 wieczór, nie stanem dokumentacji.

**Bramka budowania (zmierzona dziś):** serwer `tsc --build` PASS · front `vite build`
PASS (ten sam build co Railway). Root `type-check` FAIL 875, z czego 844 to `TS7030`
w `server/src/routes/**`, których root config nie powinien obejmować — realny dług
frontu to ~31 błędów w 10 plikach.

---

## Tezy OBALONE przez weryfikację kodu (uczciwość: były w szkicu tego dokumentu)

| Teza (źródło) | Prawda w kodzie |
| --- | --- |
| „Komentarze Zadań/Decyzji nie zapisują się do serwera" (rejestr, dyżur 133) | **Zapisują się**: `TaskDetailView.tsx:1544` → `POST /tasks/:id/comments` (trasa `pmo/tasks.routes.ts:1181`), analogicznie Decyzje (`pmo/decisions.routes.ts:218`). Dowód 133 grepował `my-work.routes.ts` — złe miejsce. Realna, węższa dziura: **komentarz generowany przez AI** ląduje tylko w `setComments` i ginie po odświeżeniu (`TaskDetailView.tsx:2542-2650`). |
| „4 raporty EXE-* zaginęły w uncommitted worktree" (karta 06) | **Istnieją i są wpięte**: `ExecutionHub.tsx:126-129, 5509-5524`; commity `c93dc2c36b`…`1e893e11f7`; testy per komponent. |
| „UsageMeters wywala pasek boczny" (nadzorca, dziś) | Bug `t()` realny (`UsageMeters.tsx:174`), ale komponent **martwy** — `SidebarUsage` ma zero importerów. Priorytet: sprzątanie, nie P0. |
| „Partner: seeder odrzuca nazwę bazy" (karta 16, day62) | **Naprawione i scalone**: `19b75cd708` + `0eab8a3dad` — guard przyjmuje dowolną nazwę z jawnym `--confirm-db`, mianownik migracji dynamiczny. |
| „Admin: komunikat wyceny BLOCKED poza licencją" (karta 14, day118) | **Naprawione na gałęzi**: `useFinanceRowActions.ts:623-629` obsługuje `APPROVED_VERSION_IMMUTABLE` po polsku (commity `32050f31ee`, `f1efb98a3a`). |
| „GEN-2 i GEN-4 mają wspólną przyczynę" (nadzorca, szkic) | **Dwa różne silniki**: GEN-2 = strażnik groundingu kasuje zdania z liczbami spoza briefu (`documentBlockContentGenerator.ts:386-451`; LLM realnie woła i odpowiada — plik z modelem i bez jest bajtowo identyczny). GEN-4 = trasa szablonowa **świadomie omija AI** (`presentations.routes.ts:2253`), mapper ma nieużywany parametr `brief`. |
| „Ocena: Insights bez uczciwego stanu pustego" (karta 04) | Insights **ma** uczciwy stan pusty (`AssessmentOutputsTab.tsx:334-346`). Library ma tekst mylący (zakłada błąd ładowania). |
| „Dyżur 170 niedokończony" (nadzorca, dziś rano) | **Skończony w trakcie pomiaru**: 4 commity + raport `89fd32e413` + 11 artefaktów + czyste drzewo. Odbiór adwersaryjny w toku. |

## Znaleziska NOWE z weryfikacji (nie było ich w żadnej karcie)

1. **OCENA — przyczyna pustych Inicjatyw znaleziona:** `InitiativeController.ts:~362`
   nadpisuje `sourceType` frameworkiem (`COALESCE(sa.framework_type, sa.assessment_type)` →
   np. `"DRD"`), a biała lista frontu (`AssessmentHub.tsx:328-340`) wymaga
   `assessment*` — rekord odrzucany MIMO istnienia danych. Jeden precyzyjny fix.
2. **SPOTKANIA — otwarcie bety to JEDNA wartość:** `betaMenuStatus.ts:57`
   `MODULE_MEETING: 'closed'` (+ mirror przez `sync-server-runtime-mirrors.mjs`).
   Zwykły użytkownik WIDZI pozycję menu (kłódka), wejście przekierowuje do czatu.
3. **INICJATYWY — przyczyna braku przycisku statusu:** `initiativeWriteTruth.ts:268-282`
   rzuca bezwarunkowo dla każdej zmiany statusu z karty; naprawa = budowa governed
   ścieżki zapisu w gate workflow, nie odwrócenie `statusActions=[]`.
4. **AGENT — limit kosztu nie może zadziałać w żadnej konfiguracji:** mechanizm limitu
   istnieje i działa (`agentResourceGovernanceService.ts:230-238`), ale planner karmi
   go `estimatedCostUsd: 0` (`agentPlannerService.ts:1058`), a tabeli polityk
   `v8_agent_resource_policies` **nie wypełnia nikt** poza skryptami dowodowymi —
   plan z `canonicalRunId` pada na `resource_policy_not_found`, plan bez — omija
   limit całkiem. Wchodzi do dyżuru 174.
5. **MOJA PRACA — wywrotka pobierania załącznika decyzji:** `DecisionDetailView.tsx:8917`
   `handleDownloadAttachment(a)` w mapie po `s` — `ReferenceError` po kliknięciu.
6. **NARZĘDZIA — przyczyna awarii staging Insights nazwana w kodzie:** brak tabeli
   `tool_outputs` na staging → bezwarunkowy fetch w `Promise.all` → 500 → hub padał
   (komentarz DEC-158 w `toolsInsightsWiringFlag.ts`). Naprawa = migracja na staging
   + retest + flaga ON.

---

## Tablica zamknięć — stan KODU, od najtańszego

| # | Moduł | Bramka | Brakuje po stronie FUNKCJI (zweryfikowane) | Decyzja właściciela | Dyżury |
|---|---|---|---|---|---|
| 01 | Organizacja | **CLOSED_FINAL** | sprzątnięcie karty (sekcja `PENDING` nad `CLOSED_FINAL`) | — | **0** |
| 14 | Admin | OWNER_REVIEW | day118 domknięty w kodzie; przejrzeć resztki day53 | — | **0-1** |
| 15 | Ustawienia | **CLOSED_FINAL** | komunikat dla MEMBER (4/5 tras wraca cicho do Profilu, day124); martwy `UsageMeters`+`SidebarUsage` → inwentarz sprzątania | — | **1** |
| 13 | Czat | REMEDIATION_REQUIRED | i18n karty propozycji; dowód feedu przy `ENABLE_SIGNAL_PRODUCER=true` lokalnie | włączyć producenta sygnałów? | **1** |
| 08 | Spotkania | OWNER_REVIEW | backend realny; otwarcie = `MODULE_MEETING:'open'` + mirror; potem pierwszy przegląd ekranów | **otworzyć betę?** zakres MVP | **1** |
| 16 | Partner | OWNER_REVIEW | seeder naprawiony → przejście 25 ekranów za auth (G08: 0/25) | ekonomia zostaje OFF (potwierdzić) | **1** |
| 03 | Narzędzia | IN_PROGRESS | migracja `tool_outputs` na staging + retest + `VITE_TOOLS_INSIGHTS_WIRING` ON | spec W3-TLS-CX-001 („jest źle" — nazwać CO) | **1** |
| 12 | Audyty | OWNER_REVIEW | i18n seeda; surowe ID; ucinanie wartości; PDF nie istnieje (tylko DOCX) | hub vs „warsztat"; PDF w MVP? | **1-2** |
| 04 | Ocena | **NO_GO** | fix `sourceType` (pkt 1 wyżej); śledztwo Reports (kod czysty — podejrzane dane); tekst Library | zakres remediacji MVP | **2** |
| 07 | Moja praca | OWNER_REVIEW | 163-bis (regresja karty — poprawka gotowa, do ponownego wydania); zapis komentarza AI; bug `a`/`s`; notatki (173 wydany) | kalendarz ON/OFF (sprzeczność git); Radar w MVP? | **2** |
| 06 | Realizacja | OWNER_REVIEW | raporty EXE istnieją; zostają ciche 409 (173 wydany) + głębia kontraktu backendu raportów | dwa magazyny zadań (`tasks` vs `ie_aggregate_state`, ZERO synchronizacji) — architektura | **1-2** |
| 05 | Inicjatywy | **NO_GO** | governed ścieżka zapisu statusu (budowa, pkt 3); droga bez kandydata SWOT; most czeka na UI od grafiki | zakres mostu | **2-3** |
| 11 | Materiały | OWNER_REVIEW | GEN-2: kalibracja strażnika groundingu; GEN-4: dobudowa ogniwa AI w trasie szablonowej; GEN-3 zdrowy (ocena rubryką) | ryzyko halucynacji przy poluzowaniu strażnika (analogia do decyzji o akronimach) | **2-3** |
| 10 | Finanse | OWNER_REVIEW | waluta (171 wydany); podpięcie 19 paneli (135, za `ENABLE_V8_GLOBAL=false`); „Management report" wyceny NIE istnieje w kodzie | Management report w MVP czy poza? wariant odbioru z PDF | **2-3** |
| 09 | Wyniki | OWNER_REVIEW | 170 skończony (odbiór w toku); kontrakty kart KPI/OKR/ROI (RES-OWN-007/008); crosswalk/backfill nadal zero wołaczy; F.2 4/135 | trzy poziomy Wyników; zakres F.2 do MVP | **3-4** |
| 17 | Agent | wydzielony | **174**: zatrzymanie planu (cancelPlan nie dotyka kolejki + `cancelled` poza warunkiem zamknięcia pokwitowania) + realny koszt + pisarz polityk | po 174: `ENABLE_AI_TASKS_WORKER` | **1-2** |

**Suma: ~21-29 dyżurów** (weryfikacja obniżyła szacunek z 27-36 — trzy moduły okazały
się tańsze, niż mówiły karty). W locie: 171·172·173 wydane, 163-bis i 174 do wydania.

## Kolejność — trzy fale

**Z1 (tanie):** 14 · 15 · 13 · 08 · 16 · 03 · 12 + ogon (171-174, 163-bis).
Cel: 2 → **8-9 modułów** gotowych do zrzutów/werdyktu.
**Z2 (niewidziane przez właściciela):** Finanse · Wyniki · Materiały — najpierw
komplet ekranów przez harness (reguła 7), styk z grafiką przez `KOORDYNACJA.md`.
**Z3 (NO_GO + architektura):** Ocena · Inicjatywy · Realizacja · Moja praca —
decyzje właściciela PRZED wydaniem dyżurów.

## Decyzje właściciela do zebrania

1. **Spotkania:** otwieramy betę (jedna wartość)? zakres MVP.
2. **Czat:** włączamy `ENABLE_SIGNAL_PRODUCER`?
3. **Audyty:** hub tabelaryczny jako powierzchnia odbioru? PDF w MVP?
4. **Moja praca:** kalendarz ON czy OFF (decyzja mówi ON, revert właściciela OFF)? Radar?
5. **Realizacja:** dwa rozłączne magazyny zapisu zadań — który jest docelowy?
6. **Materiały:** poluzować strażnik groundingu (ryzyko halucynacji) czy karmić go bogatszym źródłem?
7. **Finanse:** Management report wyceny w MVP?
8. **Agent:** po dyżurze 174 — włączamy?

## Poza zakresem tego rekonesansu

Zrzuty/oceny wizualne (tor grafiki) · droga na demo (3709 commitów — osobna decyzja)
· dług testowy 906 czerwonych (plan gotowy, wchodzi po falach).
