# M21 — Meeting — FAZA 5 (KANONY) + FAZA 6 (BEZPIECZEŃSTWO)

Agent: KANON+SEC. Branch: feat/deliverables-light. Data: 2026-06-11.

Pliki w zakresie:
- FE: `src/components/Meeting/MeetingHub.tsx` (1662 l.)
- BE: `server/src/routes/meeting.routes.ts` (282 l.), `server/src/services/meetingService.ts` (399 l.), `server/src/services/ai/meetingIntelligenceService.ts` (282 l.)
- Gating: `src/routes/AppRoutes.tsx`, `src/utils/betaAccess.ts`, `server/src/Gateway.ts`

---

## FAZA 5 — KANONY

### 1. §27 TABLE_AND_PREVIEW_CANON (lista spotkań, poz.1)
ZGODNE. Lista renderowana przez `TableWithPreviewLayout` + `FilterableTable`:
- `MeetingHub.tsx:667-739` — `TableWithPreviewLayout<MeetingItem>` z `selectedId/selectedItem/onSelect/onOpenFull/itemIds/getItemById/renderPreview` → preview pane (poz.1 wzorca).
- `MeetingHub.tsx:686-738` — `FilterableTable` z `columns`, `selectedRowId`, `onRowClick` (→preview), `onRowDoubleClick` (→open), `activeFilters/onFilterChange`, `emptyMessage` (`meeting.empty`).
- Menu 3 (row actions) — kanoniczny manifest z komentarzami §9.2 (`MeetingHub.tsx:692-732`): `open_preview` (poz.1 side preview) → `open` (primary) → `edit` (divider, start "manage") → `archive` (disabled, "Coming soon (backend)") → `delete` (danger, divider, confirm dialog). Archive świadomie zaślepiony (brak backendu).
- Filtry statusu: `MeetingHub.tsx:274-281` scheduled/completed.
- Decyzje i follow-upy NIE są osobnymi tabelami kanonowymi — renderowane wewnątrz preview/dokumentu spotkania (lista w MeetingPreview/dokument). §27 dla nich n.d.

### 2. Wzorzec hubowy (ModuleHub)
ZGODNE. `MeetingHub.tsx:24-31` import `ModuleHub`, `FilterableTable`, `Menu3Row`, `useModuleOpenDocuments`, `getMenu3AiButtonClass`. `MeetingHub.tsx:590-742` render w `<ModuleHub tabs/activeTab/onTabChange>`. Breadcrumbs przez `MainLayout` w AppRoutes (`sidebar.meeting`). Trzy widoki: dokument / kalendarz / tabela+preview.

### 3. UI-standards
- `EntityStatusChip` użyty kanonicznie: `MeetingHub.tsx:42` import, `:284-286` mapowanie scheduled→info / completed→success (`statusChipTone()`), komentarz §4.1. OK, bez lokalnej kopii.
- HARDKODY KOLORÓW — **P3**: 3× `#A51C30` (Harvard crimson) w przyciskach AI/Teresa: `MeetingHub.tsx:958` (`text-[#A51C30]`), `:1062` (`bg-[#A51C30] hover:bg-[#8a1828]`), `:1214` (to samo). Powinny być tokenem CSS (np. `--hbs-crimson`), nie inline hex. Reszta przez Tailwind tokeny.

### 4. i18n PL/EN — HYBRYDA, **P2**
Mieszanka dwóch systemów w jednym pliku:
- 109× `t(...)` (z fallbackami EN) — np. `meeting.empty`, `meeting.status.*`, `meeting.errors.*`, `common.open/edit`.
- 78× `isPolish` z ręcznymi ternary PL/EN — `isPolish = i18n.language?.startsWith('pl')` (`MeetingHub.tsx:73`). Przykłady: `:696` "Otwórz podgląd"/"Open preview", `:718` "Archiwizuj"/"Archive", `:727` "Usuń"/"Delete", `:959` "Notatki AI ze spotkania"/"AI Meeting Notes", `:976` "Wklej transkrypcję..."/"Paste...", `:1217-1218`, `:1222`.
- Skala gorsza niż M19 (25× isPolish) w liczbach bezwzględnych. Wzorzec docelowy M15 = 0× isPolish. Treść jest dwujęzyczna (brak EN-only/PL-only luk), więc to dług techniczny spójności, nie brak tłumaczenia.

### 5. Stany empty / loading / error / degradacja LLM
- Loading/Error/Empty OK: `MeetingHub.tsx:633` `<LoadingState variant="spinner">`, `:634-635` `<ErrorState message={loadError} retry={loadMeetings}>`, `:736` `emptyMessage`.
- DEGRADACJA LLM — NIETRANSPARENTNA, **P2** (patrz FAZA 6/finding SEC-3 niżej dot. UX). `generateMeetingNotes` cicho spada na regex-heurystykę gdy: brak `OPENAI_API_KEY`, transkrypt ≤100 znaków, lub wyjątek LLM (`meetingIntelligenceService.ts:96-100`, `:172-177`). FE zawsze pokazuje toast "AI notes generated" (`MeetingHub.tsx:557`) i etykiety "Notatki AI / Teresa" (`:959,:1217-1222`). Obiekt `note` nie niesie pola `source`/`generatedBy`, FE go nie czyta → **użytkownik nie wie, że "notatki AI" to wynik regexa, a nie modelu**.

### 6. CARD_CONTENT_FORMULA — n.d. (moduł nie generuje kart Insight/Initiative).

---

## FAZA 6 — BEZPIECZEŃSTWO

### SEC-1. Trzy warstwy gatingu — SPÓJNE (closed beta), API otwarte dla zalogowanych — **P2**
- Nawigacja: `betaAccess.ts:45` `MODULE_MEETING: 'closed'` (lock dla nie-adminów, `BETA_ADMINS_EXEMPT=false`).
- Route: `AppRoutes.tsx:2010-2024` `<ProductionModuleGate enabled={!hideNonCoreModulesOnPublicProduction} moduleName="Meeting">`. Meeting NIE jest w `PUBLIC_PRODUCTION_CORE_ROUTE_MODULES` (`AppRoutes.tsx:566` = tylko My Work/Initiatives/Implementation) → na hostname public-prod renderuje `PublicProductionModuleDisabled` (ukryte). `ProductionModuleGate` to gate hostname/public-prod (`:567-576`), niezależny od beta-lock.
- API: `meeting.routes.ts:26-27` tylko `verifyToken` + `isAuthenticated`. BRAK gate'u beta/modułu/roli. Każdy zalogowany user (dowolna org) może wołać `/api/meeting`, mimo że UI jest closed-beta + ukryty na public-prod. To wzorzec systemowy (FE-only beta gating), ale warto odnotować: zamknięcie bety jest tylko po stronie klienta.

### SEC-2. ORG-SCOPE — CZYSTE. Brak cross-org IDOR. NAJWAŻNIEJSZE (PII spotkań/notatek) — ZABEZPIECZONE
Wszystkie endpointy z `:id`/`:meetingId`/`:followUpId` filtrują `organization_id`. Service to wzorzec czysty (jak M02/M25/M17/M18/M19):
- READ: `getMeeting` → `meetingService.ts:180-181` `WHERE id = ? AND organization_id = ?`. `listMeetings` → `:166-168` `WHERE organization_id = ?`.
- UPDATE: `:289` `UPDATE meetings ... WHERE id = ? AND organization_id = ?`; `updateMeetingStatus` `:320` to samo.
- DELETE: `:306` `DELETE FROM meetings WHERE id = ? AND organization_id = ?` (+ guard `getMeeting` `:300-304`).
- decisions/follow-ups: `addMeetingDecision`/`addMeetingFollowUp`/`updateMeetingFollowUpStatus` najpierw `getMeeting({organizationId, meetingId})` jako bramka org (`:333-337`, `:363-367`, `:384-388`) → cross-org zwraca null → 404 (`routes:159,177,199`). Następujący po nim UPDATE/INSERT keyed na `meeting_id`, ale bramka go poprzedza (brak realnego TOCTOU — `meeting_id` to UUID, nie da się trafić cudzego po przejściu bramki).
- **PII (transkrypt/notatki AI) — niedostępne cross-org**: `generate-notes` woła `getMeeting({organizationId: orgId, meetingId})` ZANIM cokolwiek zrobi (`meeting.routes.ts:225-226`) → cudzy meetingId = 404. `meetingIntelligenceService.persistNote` zapisuje notatkę z transkryptem do `notebook_entries` z `organization_id = orgId, user_id = userId` (`meetingIntelligenceService.ts:218-237`), org-scoped poprawnie. Brak ścieżki dotarcia do transkryptu/notatek innej org po meetingId.

WNIOSEK: M21 należy do CZYSTYCH modułów org-scope (kontrast do M20/M16/M15 z dziurami legacy raw-DB). Brak findingu IDOR.

### SEC-3. Transkrypt — BRAK GUARDA ROZMIARU + RYZYKO PROMPT INJECTION — **P2**
- BRAK walidacji rozmiaru transkryptu: `meeting.routes.ts:220-223` tylko sprawdza, że niepusty (`transcript.trim()` wymagany). Brak `maxLength`. FE też bez limitu (`MeetingHub.tsx:546` `notesTranscript.trim()`). Cały `rawTranscript` ląduje nieograniczony w `notebook_entries` (`meetingIntelligenceService.ts:166,228`) — payload abuse / rozdęcie DB. Tylko prompt LLM jest ucinany do 5000 znaków (`meetingIntelligenceService.ts:116` `transcript.slice(0,5000)`), nie magazyn.
- PROMPT INJECTION: transkrypt wstrzykiwany surowo w prompt w delimiterach `"""..."""` (`meetingIntelligenceService.ts:114-117`). Transkrypt zawierający `"""` + własne instrukcje może wyłamać się z bloku i sterować wyodrębnianiem. Output jest JSON-parsowany (`:145`), ale wstrzyknięte "decyzje"/"action items" trafiają do persystencji jako prawdziwe rekordy meeting decisions/follow-ups (`meeting.routes.ts:256-270`) — manipulacja danych biznesowych. Severity P2 (wymaga, by atakujący wkleił własny transkrypt do własnego spotkania — samo-szkodzące, ale zanieczyszcza dane org).

### SEC-4. Cross-module write (notatki → notebook, decyzje/action items) — ORG-SCOPED OK
- `persistNote` → `notebook_entries` z `organization_id`/`user_id` z kontekstu zweryfikowanego org (`meetingIntelligenceService.ts:218-237`). OK.
- decyzje/action items z LLM zapisywane przez `addMeetingDecision`/`addMeetingFollowUp` z `organizationId: orgId` (`meeting.routes.ts:256-270`). OK, org-scoped.
- "Otwórz jako dokument" / action items → tasks: w M21 follow-upy żyją w `meeting_follow_ups` (nie ma realnego mostu do modułu Tasks w tym kodzie). Brak cross-org write.

### SEC-5. Sekrety / PII w logach — CZYSTE
- Brak logowania transkryptu: `grep transcript` po `logger.`/`console.` w server/src = 0 trafień (jedyny wynik to test redakcji w innym module). `generate-notes` loguje tylko komunikat błędu persystencji bez treści (`meeting.routes.ts:273`). LLM-fallback loguje `err.message` bez transkryptu (`meetingIntelligenceService.ts:173-174`). OK.

---

## PODSUMOWANIE FINDINGÓW
| ID | Severity | Obszar | Dowód |
|----|----------|--------|-------|
| SEC-2 | — (czyste) | Org-scope spotkań + notatek PII | meetingService cały org-scoped; generate-notes guard `routes:225-226` |
| SEC-1 | P2 | API beta-gating tylko FE; `/api/meeting` otwarte dla każdego zalogowanego | `meeting.routes.ts:26-27` vs `betaAccess.ts:45` |
| SEC-3 | P2 | Brak limitu rozmiaru transkryptu + prompt injection przez `"""` | `meeting.routes.ts:220-223`; `meetingIntelligenceService.ts:114-117,166` |
| FAZA5.5 | P2 | Degradacja LLM nietransparentna (regex udaje "AI") | `meetingIntelligenceService.ts:96-100,172-177`; `MeetingHub.tsx:557` |
| i18n | P2 | Hybryda 78× isPolish + 109× t() | `MeetingHub.tsx:73` + liczne ternary |
| UI | P3 | 3× hardkod `#A51C30` | `MeetingHub.tsx:958,1062,1214` |

Brak P0/P1. Brak cross-org IDOR (moduł czysty). Stany loading/error/empty OK; §27 i wzorzec hubowy zgodne.
