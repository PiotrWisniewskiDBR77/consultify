---
document_id: TOOL-ARTIFACT-TYPE-CONTRACT
module: Tools / Artifact Platform
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Tool jako kanoniczny typ artefaktu

Kompletny rejestr funkcji artefaktu z identyfikatorami, zachowaniem, rolą AI i
kryterium odbioru znajduje się w
[`TOOL_ARTIFACT_FUNCTION_CATALOG.md`](TOOL_ARTIFACT_FUNCTION_CATALOG.md).

## 1. Rozstrzygnięcie

`Tool Artifact` jest pełnoprawnym typem artefaktu platformy, analogicznym w
governance do dokumentu, prezentacji, arkusza czy Canvas, lecz posiadającym
metodę konsultingową, fazy i strukturalne obiekty analizy.

Rozróżniamy:

- **Tool Definition/Template** — wersjonowany przepis na narzędzie;
- **Tool Session Artifact** — edytowalna instancja pracy użytkowników;
- **Tool Output** — immutable snapshot sfinalizowanej wersji;
- **Derived Deliverable** — dokument/deck/sheet należący do Materials;
- **Initiative Proposal Draft** — propozycja zmiany wyprowadzona z Outputu.

Template nie jest kopią UI ani dokumentem instruktażowym. Konfiguruje wspólny
runtime bez tworzenia nowego shellu.

## 2. Tool Definition/Template

Każdy template zawiera:

```text
ToolDefinition {
  id, slug, name, version, status, category,
  purpose, decisionJobs, whenToUse, whenNotToUse,
  requiredInputs, expectedOutputs, estimatedEffort,
  phases[5], methodObjectSchemas, validationRules,
  knowledgePackRef, questionBankRef, qualityRubricRef,
  visualManifest, aiCapabilityManifest,
  outputAdapters, permissionsPolicy, localization,
  owner, reviewers, licenseAndSources, changelog
}
```

Status: `DRAFT`, `IN_REVIEW`, `PILOT`, `PUBLISHED`, `DEPRECATED`, `RETIRED`.
Session przypina dokładną wersję template. Aktualizacja nie zmienia istniejącej
sesji bez jawnej migracji z preview.

## 3. Tool Session Artifact

Minimalny envelope:

```text
ToolSessionArtifact {
  id, organizationId, projectId?, toolDefinitionId, toolVersion,
  title, ownerId, participants, visibility,
  workMode, lifecycleStatus, currentPhase,
  phaseStates, contentObjects, relationGraph,
  evidenceIndex, proposalQueue, qualityState,
  version, saveState, createdAt, updatedAt, finalizedAt?
}
```

Jest jednym źródłem roboczej prawdy. Manual i Teresa-led zapisują te same
obiekty. Każdy obiekt ma ID, typ, phase, author/provenance, state, evidence,
confidence, owner, comments, created/updated version i history.

## 4. Stały shell i nawigacja artefaktu

Każdy Tool Artifact renderuje:

1. stale widoczne `Wyjdź / Wróć do sesji`;
2. Header z nazwą, statusem, trybem i save state;
3. Properties;
4. dokładnie jedną Command Row;
5. lewy Phase Navigator — zawsze pięć faz;
6. centralny Method Canvas;
7. prawy Teresa Panel;
8. sticky phase navigation: Previous, phase X/5, Next;
9. utilities: Comments, Activity, History, Relations, Used In;
10. lifecycle actions: Review, Finalize, Revise, Archive.

Kliknięcie wcześniejszej fazy jest zawsze dozwolone w edytowalnej sesji.
Użytkownik może wracać, oglądać i zmieniać. Wpływ zmiany jest oznaczany w
późniejszych fazach jako stale/needs-review, nie usuwany.

## 5. Nawigacyjna maszyna stanów

| Stan sesji | Oglądanie faz | Edycja | AI proposals | Phase review | Finalize |
| --- | --- | --- | --- | --- | --- |
| Draft/Active/Needs input | wszystkie dostępne | tak wg permissions | tak | gdy readiness | nie przed final review |
| In review | wszystkie | suggested changes albo wg policy | analysis/draft only | reviewer | approver only |
| Finalized | wszystkie read-only | nie | explain/analyze bez write | history only | wykonane |
| Revised version | wszystkie | nowa wersja | tak | ponownie | ponownie |
| Archived | read-only | nie | explain wg access | nie | nie |

`Next` i kliknięcie fazy są nawigacją. `Mark ready`, `Approve` i `Finalize` są
oddzielnymi decyzjami.

## 6. Save, exit i resume

- autosave jest domyślny;
- manual `Zapisz teraz` pozostaje dostępne;
- `Wyjdź / Wróć do sesji` zapisuje i wraca do Sessions;
- w razie błędu użytkownik widzi Retry/Stay, a nie znika z niezapisanym stanem;
- Sessions przechowuje Resume z ostatnią fazą/focus;
- browser Back i globalna nawigacja korzystają z tego samego kontraktu;
- po powrocie Teresa pokazuje `Since last visit` oraz next action.

## 7. Kolory i style

Template wybiera `identityAccent`, ikonę i tool-specific visual blocks, ale nie
zmienia semantyki platformy:

- neutral — zaakceptowana treść;
- primary — aktywność i selection;
- indigo/violet — AI proposal/Teresa;
- green — accepted/ready/verified;
- amber — needs evidence/warning/stale;
- red — blocker/rejected/error/destructive;
- slate/blue — draft/informational.

Template korzysta ze wspólnych design tokens. Nie wpisuje klas kolorów ani
dowolnego layoutu bezpośrednio w definicję. Visual Manifest wskazuje dozwolone
komponenty i warianty.

## 8. Visual Manifest

```text
VisualManifest {
  identityAccent, icon,
  phaseVisuals,
  allowedBlockTypes,
  primaryMethodVisualization,
  layoutVariants,
  densityRules,
  legendSchema,
  presentationMappings,
  accessibleFallbacks
}
```

Bloki są semantycznym HTML/SVG/native renderem. Mają responsive/app/presentation
variants, accessibility fallback i export-safe theme. Screenshot nie jest
kanonicznym formatem transferu.

## 9. AI Capability Manifest

Template wybiera capabilities z platformowego katalogu i dostarcza
method-specific config:

```text
AiCapabilityBinding {
  capabilityId, phase, label, purpose,
  allowedSelectionTypes, sourceScope,
  knowledgePackRef, promptPolicyRef,
  outputSchema, approvalLevel,
  materializationTarget, qualityChecks
}
```

Dwa wejścia — Teresa chat i lokalny przycisk — wywołują to samo capability ID.
Nie mogą mieć różnych promptów i zachowań dla tej samej operacji.

Każda lokalna akcja ma nazwę opisującą rezultat. Template nie może dodawać
ogólnego `Do with AI` bez purpose, zakresu i output schema.

## 10. Method Knowledge Pack

Template nie jest production-ready bez powiązanego, zatwierdzonego packa
wiedzy: metoda, pytania, evidence, błędy, bias, przykłady, synteza, quality,
źródła i licencje. Teresa używa dokładnej wersji packa przypiętej do Session.

## 11. Output i transfer

Finalizacja tworzy `ToolOutput` zawierający:

- exact Tool Session/version/template/method pack;
- accepted content objects;
- evidence/provenance;
- final summary, insights, moves i limitations;
- quality review i exceptions;
- visual source blocks;
- Deliverable candidates;
- Initiative Proposal Draft candidates;
- immutable lifecycle/decision snapshot.

Presentation Studio otrzymuje semantyczne visual blocks i dane, nie screenshot.
Materials i Initiatives zapisują własne obiekty oraz relation do Outputu.

## 12. Kontrakt template adoption

Nowy template nie może tworzyć:

- własnego headera, phase navigatora, Teresa panelu albo save/exit flow;
- własnej semantyki AI proposal/accepted/error;
- własnego systemu kolorów statusowych;
- niezależnej kopii Comments/History/Relations;
- bezpośredniego eksportu omijającego Materials;
- bezpośredniej Registered Initiative omijającej Candidates.

Może dostarczyć:

- tool-specific labels i instrukcje;
- object schemas i method rules;
- centralne visual blocks;
- question bank i knowledge;
- phase-specific AI capability config;
- quality extensions i output mappings.

## 13. Standard jakości implementacji template

Template jest `PUBLISHED`, gdy:

- osoba bez wiedzy konsultingowej potrafi ukończyć przykład w Teresa-led;
- ekspert potrafi pracować szybko w Guided Manual;
- oba tryby tworzą ten sam poprawny model danych;
- użytkownik zawsze może wyjść, zapisać, wrócić i przejść do dowolnej fazy;
- cofnięcie i edycja propagują stale/impact bez utraty danych;
- local AI actions i Teresa materializują jedną proposal truth;
- grafiki są czytelne w aplikacji, eksporcie i prezentacji;
- Output dokładnie odtwarza finalized snapshot;
- permissions, errors, offline/conflict i accessibility są przetestowane;
- template przeszedł method quality review oraz shell visual regression.

## 14. Dynamic SWOT jako pierwszy template

Dynamic SWOT powinien być pierwszą pełną implementacją `Tool Artifact`:

- primary visualization: responsive SWOT 2×2;
- secondary: evidence map, SO/WO/ST/WT correlation map, tension/move cards;
- local AI actions: extract, classify, deduplicate, challenge, correlate,
  synthesize, propose moves, quality check;
- presentation mappings: matrix, correlations, implications, moves;
- pięć wspólnych faz i dwa tryby pracy;
- pełny save/exit/resume/revise/finalize flow.

Po akceptacji SWOT wspólne primitives są zamrażane. Następne narzędzie wdraża
wyłącznie własny plugin/template i służy jako test, czy standard naprawdę jest
powtarzalny.
