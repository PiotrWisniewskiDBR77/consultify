# Audyt wdrożeniowy — moduł Deliverables light (deck / doc / sheet)

> **Data:** 2026-06-10 (wieczór) · **Zakres:** całość wdrożenia z dnia (L1–L3 + Kimi-parity),
> branch `feat/deliverables-light` @ `9451db4f` · **Metoda:** code-verified (każde twierdzenie
> sprawdzone w bieżącym kodzie/DB/przeglądarce dziś — nie z pamięci; istotne, bo równoległy
> workstream canvas modyfikował współdzielone pliki przez cały dzień).
> **Skala ocen:** jak w audycie systemowym 2026-06-02 (0–100 per wymiar).

---

## 0. Werdykt

**71/100 — „dev-complete za flagą".** Rdzeń doświadczenia działa i jest zweryfikowany żywymi
przebiegami (deck PL, doc PL ×2, sheet z realnym budżetem). Architektura zgodna z doktryną
(jeden kontrakt, reuse, lekkość). Do statusu „production-ready" brakuje: domknięcia pętli
odświeżania artefaktu (bloker A1, poza tym modułem), telemetrii, rate-limitu na drogim
endpoincie i czterech porządków niżej opisanych. **Brak P0** — nic nie blokuje dalszego
developmentu ani nie zagraża danym przy flagach OFF (prod) / ON (dev-staging).

| Wymiar | Ocena | Jednym zdaniem |
|---|---|---|
| 1. Kontrakt API + runtime backend | **85** | spójny, idempotentny w kluczowych miejscach, odporny na restart; bez ewikcji map i walidacji setup decka |
| 2. Bezpieczeństwo / RBAC / izolacja | **74** | auth+org+capability+flaga na całej powierzchni; bez rate-limitu i schemy wejścia |
| 3. Frontend (intercepty, checklista, panel) | **68** | pełny flow działa; luka refresh (zewn. bloker), poll bez anulowania, brak i18n nowych stringów |
| 4. Testy | **62** | 16 unit (runtime doc/sheet, bramki) zielonych; zero testów decka-gałęzi, routera i frontu |
| 5. Obserwowalność / operacje | **30** | logi info/error są; zero telemetrii produktowej, zero metryk, zero alertów |
| 6. Integracje (registry, eksport, mostki) | **72** | doc+deck w rejestrze Outputs, eksporty i Table-Studio-bridge odziedziczone; **sheet nie rejestruje się w Outputs** |
| 7. Zgodność z doktryną/planem | **90** | wszystkie decyzje D-L2-1…4 wdrożone; anti-scope utrzymany; odstępstwa udokumentowane |
| 8. Dług i higiena (orphany, dane testowe) | **60** | drafty-sieroty po błędach, dane QA na staging, fallback `conversationId='chat'` |

---

## 1. Co zweryfikowano jako DZIAŁAJĄCE (dowody)

- **Kontrakt:** `POST /api/deliverables/generations` (+`/:id/generate`, `GET /:id`) — dispatch
  3 formatów kompletny; mapowanie błędów domenowych → HTTP (400/404/409/501); 202 dla async.
- **Restart-resilience:** stan wnioskowany z DB (deck: `presentation_decks.status`; doc/sheet:
  treść draftu vs marker szkieletu) — testy jednostkowe pokrywają.
- **Idempotencja startu:** podwójny start ⇒ `invalid_state` (test ✓).
- **Bramka uczciwości:** placeholder/stub w wyniku ⇒ stan `error`, draft nietknięty (test ✓);
  zero „MVP-1" w outputach (przepisane stuby + tłumaczone etykiety calloutów).
- **Izolacja org:** wszystkie odczyty/zapisy draftów org-scoped (`workCanvasService` 3×
  `AND organization_id`), deck row org-scoped; RBAC: `verifyToken` + `requireOrgAccess` +
  capability `presentation_create`; flaga per-request (OFF ⇒ 404 na całej powierzchni, default OFF).
- **Żywe przebiegi (dziś, staging DB, konto demo):** deck PL z faktami z kontekstu org; dokument
  PL `implementation_plan` 9 sekcji z `[Assumption]` inline; arkusz „Budżet projektu" 10 wierszy,
  **bezstratny** autosave round-trip (dowód w DB po fixie tabel); 3 intercepty wpięte (grep ✓);
  checklisty + chipy artefaktów w transkrypcie; eksport XLSX/CSV/PDF/DOCX endpointem draftów (✓ route).
- **16/16 testów** deliverables zielonych na bieżącym HEAD (przed chwilą); documentStudio 855 ✓ (dziś).

## 2. Znaleziska (wg wagi; wszystkie zweryfikowane w kodzie)

### P1 — przed włączeniem flag na staging dla ludzi
| # | Znalezisko | Dowód | Rekomendacja |
|---|---|---|---|
| P1-1 | **Refresh szkielet→finał w otwartym panelu nie działa** — edytor ignoruje zewnętrzne zmiany `contentMd`; event+fetch dochodzą (network-proof), treść stoi | sesja live; handoff `DELIVERABLES_X_CANVAS_REFRESH_HANDOFF.md` | bloker A1 planu — właściciel: workstream canvas (naprawia też ich streaming); workaround: tab/chip artefaktu |
| P1-2 | **Setup decka bez walidacji schemy** — `params.setup as unknown as DeckSetup` (2×, `deliverablesGenerationService.ts:175,249`); user-JSON płynie do generatora (m.in. `sourcePack`, `templateId`) | grep ✓ | zod-schema na wejściu routera (jak w innych route'ach repo); whitelist pól |
| P1-3 | **Brak rate-limitu na endpointach generacji** — każdy request = wywołanie LLM (koszt) + wiersz w DB; za auth, ale bez per-user limitu | inspekcja routera | reuse istniejącego limitera repo (np. wzorzec public-form): N generacji/min/user |
| P1-4 | **Sheet nie rejestruje się w Outputs Library** — `startSheet` 0× register (doc: 4× przez C7, deck: rejestruje generator) | grep ✓ | analogiczny `registerArtifactBestEffort` (outputType `sheet`) w `startSheet` |

### P2 — przed GA (mogą iść równolegle z fazą B/C)
| # | Znalezisko | Dowód | Rekomendacja |
|---|---|---|---|
| P2-1 | Mapy stanu runtime **bez ewikcji** (`docRuntimeState`, deck `runtimeState`) — rosną do restartu | grep `.delete(` = 0 poza testowym clear | TTL-sweep (np. wpisy >24 h) albo delete na stanach terminalnych po odczycie |
| P2-2 | **Poll frontendu bez anulowania** — `pollDeckGenerationUntilDone` żyje do 5 min po odejściu z czatu/zamknięciu panelu | brak AbortController w `deliverablesGeneration.ts` | AbortSignal z cleanupem komponentu |
| P2-3 | **Drafty-sieroty**: plan tworzy draft; błąd generacji zostawia szkielet na liście draftów użytkownika | konstrukcja `planDoc/planSheet` | przy stanie `error`: oznaczać draft (np. tytuł „(nieudane)") albo sprzątać przy ponownym plan |
| P2-4 | Fallback `conversationId: 'chat'` w draftach, gdy brak rozmowy | `docGenerationRuntime` parseSetup | wymagać conversationId (frontend i tak bootstrapuje rozmowę) → `invalid_setup` |
| P2-5 | Brak telemetrii (zaplanowane D2) — nie zmierzymy metryk spec §8 | brak eventów | faza D2 planu (eventy requested/plan_ready/completed/failed) |
| P2-6 | Nowe stringi UI **bez i18n** — checklisty/empty-states mają PL/EN hardcode zamiast `t()` (poza CanvasPresentationView, który używa `t`) | inspekcja `deckGenerationChecklist`, intercepty | przenieść copy do translations przy fazie C |

### P3 — porządki (z retire-listą L4)
- Tytuł artefaktu = surowa intencja („Napisz raport: …" jako tytuł) — przyciąć prefiks komendy.
- `intent` bez limitu długości w prompcie (context jest cięty do 4000, intencja nie).
- Dane QA dnia na staging (demo-org: ~10 draftów/decków `claude-verify`) — nieszkodliwe, do sprzątnięcia.
- Capability `presentation_create` dla doc/sheet — działa, ale semantycznie do przemianowania
  (`deliverable_create`) przy porządkach RBAC.
- Stash z porannej pracy QA wciąż wisi (`qa/remediation-2026-06-08 WIP`) — przypomnienie.

## 3. Ryzyka procesu (nie kodu)

1. **Współdzielony branch + working tree z workstreamem canvas** — dziś bezkolizyjnie (commity
   chirurgiczne, wzajemne dopiski C7/B2 spójne), ale to szczęście+dyscyplina, nie mechanizm.
   Rekomendacja: od jutra osobne worktree/branche + integracja przez PR, albo jawny podział plików.
2. **Restarty tsx-watch podczas edycji drugiej sesji** ubijają in-flight generacje na dev —
   na prod nieistotne, w demo może zmylić (objaw: przejściowe 500, uczciwie pokazywane).
3. **Testy E2E są ręczne (przeglądarka)** — brak automatu; warto dodać 1 playwrightowy happy-path
   na format po fazie A (jest wzorzec `scripts/claude-verify`).

## 4. Macierz zgodności z planem ratyfikowanym

| Wymóg (decyzje + spec) | Stan |
|---|---|
| D-L2-1 wejście = rozmowa | ✅ 3 intercepty | 
| D-L2-1b wejście z kart encji | ⏳ faza B1 (kontrakt gotowy, brak UI) |
| D-L2-2 grounding: rozmowa | ✅ (kontekst konwersacji w prompcie) |
| D-L2-2 grounding: sourceRefs → treść | ◐ przyjmowane; doc/sheet bez ContextPack (faza B2) |
| D-L2-3 zakaz placeholderów | ✅ bramka + testy + przepisane stuby |
| D-L2-4 żywe sekcje później, nieblokowane | ✅ (`is_refreshable` w modelu) |
| Checklista Kimi + artefakt od razu | ✅ / ◐ (szkielet ✓, podmiana = P1-1) |
| Eksporty + rejestr + mostki | ✅ poza P1-4 (sheet w rejestrze) |
| Anti-scope (bez parytetu, bez kreatorów) | ✅ utrzymany |

## 5. Rekomendacja końcowa

Moduł jest **gotowy do fazy A+B planu wykonawczego bez poprawek wstępnych**. Przed włączeniem
flag na staging dla ludzi: zamknąć P1-2/P1-3/P1-4 (≤1 dzień `[D]`) i P1-1 (`[C]`). Przed GA:
P2-1…P2-6 + telemetria D2 + charter QA D1. Ocena 71/100 odzwierciedla świeżość wdrożenia
(jeden dzień życia kodu), nie jego jakość kierunkową — architektura i doktryna są właściwe,
braki są typu „dokręcić", nie „przebudować".
