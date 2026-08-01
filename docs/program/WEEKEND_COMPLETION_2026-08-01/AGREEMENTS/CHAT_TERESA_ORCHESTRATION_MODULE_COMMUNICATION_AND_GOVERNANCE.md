---
document_id: CHAT-TERESA-ORCHESTRATION-MODULE-COMMUNICATION
module: Chat
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Chat — orkiestracja Teresy, moduły i governance

## 1. Teresa jako router pracy

Router intencji wybiera jedną z dróg:

1. odpowiedź konwersacyjna;
2. pytania doprecyzowujące;
3. retrieval/research;
4. utworzenie albo edycja Canvasu;
5. uruchomienie narzędzia domenowego;
6. przygotowanie cross-module proposal;
7. uruchomienie procesu Run Agent.

Klasyfikacja jest hybrydowa. Jednoznaczna rozmowa pozostaje rozmową,
jednoznaczna prośba o pracę trafia do właściwej ścieżki, a znacząca dwuznaczność
prowadzi do krótkiego pytania. Router nie może wykonywać skutków biznesowych na
podstawie samego podobieństwa semantycznego.

## 2. Tool registry

Każde narzędzie publikuje manifest:

```ts
interface TeresaToolManifest {
  toolName: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  readScopes: string[];
  writeCapabilities: string[];
  risk: 'read' | 'reversible' | 'business_write' | 'external' | 'destructive';
  requiresConfirmation: boolean;
  idempotency: 'required' | 'optional' | 'not_applicable';
  timeoutMs: number;
  supportsCancel: boolean;
  ownerModule: string;
}
```

Model wybiera tylko narzędzia dostarczone po rozwiązaniu roli, scope, feature
flags i health. Nazwa toola niewidocznego dla użytkownika nie może zostać
wywołana przez prompt injection.

## 3. Execution envelope

```ts
interface TeresaExecutionEnvelope {
  operationId: string;
  conversationId: string;
  messageId: string;
  actorId: string;
  organizationId: string;
  projectId?: string;
  toolName: string;
  input: unknown;
  sourceRefs: SourceRef[];
  requestedAt: string;
  idempotencyKey?: string;
  approval?: ApprovalRef;
}
```

Wynik ma `status`, structured data, user summary, target refs, citations,
warnings, auditRef i readBack. `completed_with_errors` pozostaje partial i nie
jest renderowane jako zielony sukces.

## 4. Komunikacja z modułami

Teresa nie zapisuje bezpośrednio do przypadkowych tabel. Każdy moduł zapewnia
read adapter i command adapter:

```text
resolve context -> read projection -> propose command -> validate target schema
-> check role/scope -> preview/diff -> user/approver confirmation
-> idempotent owner command -> read-back -> chat receipt + deep link
```

### Obowiązkowe adaptery

| Moduł | Odczyt | Zapis z Chatu |
| --- | --- | --- |
| My Work Notes | dozwolone strony/kontekst | create/update proposal |
| Ideas | ideas i visual artifacts | create seed/proposal |
| Tasks | zadania użytkownika/projektu | create/update/assign proposal |
| Decisions | decision queue i podobne decyzje | decision draft/approval command |
| Initiatives | kandydaci i portfolio | Initiative Candidate proposal |
| Execution | status, blockers, capacity | intervention/task/decision proposal |
| Results/KPI | target, actual, trend, alerts | corrective-action proposal |
| Finance | model/analysis assumptions | analysis artifact; governed write |
| Interview | questions, answers, insights | session/question/insight proposal |
| Tools/Assessment/Audit | library, session, output | start/resume with method contract |
| Materials | output metadata | create deliverable/export proposal |
| Client Vault | authorized retrieval | ingest/link governed separately |
| Meeting | meeting context/actions | future live-participant commands |
| Admin/Settings | allowed policy summary | no ordinary chat mutations |

## 5. Context resolution

Effective context jest przecięciem:

```text
user identity × app role × project role × active organization/project
× surface context × explicit mentions/attachments × source ACL × privacy mode
```

UI pokazuje aktywny scope. Teresa nie rozszerza go automatycznie. Jeśli prośba
dotyczy obiektu poza zakresem, prosi o wybór lub zgłasza brak uprawnienia.

## 6. Approval policy

| Klasa | Przykład | Gate |
| --- | --- | --- |
| read | znajdź, streść, porównaj | bez approval, audit retrieval |
| local proposal | draft odpowiedzi/Canvas patch | accept/reject |
| business write | task, decyzja, inicjatywa, KPI action | explicit confirm / policy approver |
| external | email, link publiczny, connector write | odbiorca + payload + final confirm |
| destructive/bulk | delete, mass update | elevated role + impact summary + strong confirm |

Approval ma expiry, approvera, exact payload hash i base version. Zmiana payloadu
unieważnia wcześniejszą zgodę.

## 7. Tool trace dla użytkownika

UI pokazuje użyteczne etapy: „Przeszukuję dozwolone źródła”, „Przygotowuję
draft”, „Czekam na zatwierdzenie”, „Zapisuję w Initiatives”, „Potwierdzono zapis”.
Rozwinięcie pokazuje tool, źródła, czas, result i audit reference. Nie pokazujemy
ukrytego chain-of-thought ani tajnych promptów.

## 8. Failure i recovery

- timeout: zachowaj częściową odpowiedź, pokaż retry;
- tool failure: odpowiedź nie udaje wykonania, może zaproponować alternatywę;
- permission denied: wskaż wymagane prawo, bez wycieku danych;
- conflict: pokaż aktualną wersję i rebase proposal;
- partial result: lista sukcesów i błędów per target;
- model/provider failure: jawny fallback lub wybór użytkownika;
- lost stream: resume od event cursor albo bezpieczny retry bez duplikowania;
- cancelled: zatrzymaj kolejne narzędzia, zachowaj audit i częściowy materiał.

## 9. Prompt i odporność

System instructions, organization policy i tool schemas mają wyższy priorytet
niż treść źródeł. Tekst pobrany z web/pliku jest nieufnym data, nie instrukcją.
Tool output przechodzi schema validation i content sanitization. Teresa nie
ujawnia promptów, sekretów, tokenów ani treści spoza scope. Connector write i
external fetch mają DLP oraz allow/deny policy.

## 10. Obserwowalność

Mierzymy: time-to-first-token, completion latency, abort/retry, retrieval hit,
citation coverage, tool success/partial/failure, approval conversion,
read-back mismatch, artifact open/save, handoff completion, user correction,
feedback i koszt. Telemetria nie zapisuje pełnej wrażliwej treści, jeśli nie jest
to konieczne i dozwolone.
