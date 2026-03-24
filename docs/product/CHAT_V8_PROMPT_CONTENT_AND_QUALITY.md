# Chat v8 - Prompt content and quality

> Status: Draft v8
> Cel: Zdefiniowac jakosciowy kontrakt dla tresci promptow w `Chat v8`: co jest base persona, jakie prompt sources sa dopuszczalne, jak unikac duplikacji i jak oceniac jakosc prompt layer.

---

## 1. Po co istnieje ten dokument

Nawet poprawny prompt pipeline nie gwarantuje dobrego chatu, jesli sama tresc promptow jest:
- zdublowana,
- sprzeczna,
- zbyt dluga,
- przeinstruowana,
- niezgodna z product promise.

Ten dokument istnieje po to, by `Chat v8` mial nie tylko dobra architekture promptow, ale tez wysoka jakosc prompt content.

---

## 2. Nadrzedna zasada

Prompt content for canonical chat should be:
- singular in identity,
- layered by purpose,
- short enough to preserve model focus,
- explicit in governance,
- aligned with product truth,
- traceable to one owner.

Jesli kilka roznych prompt sources probuje jednoczesnie definiowac "kim jest asystent", jakosc rozmowy staje sie niestabilna.

---

## 3. Prompt content sources that matter most

For main chat quality, the most important content sources are:

### 3.1 Registry base prompt

To jest docelowo glowna definicja base persona i core behavior.

Expected qualities:
- stabilna tozsamosc asystenta,
- zgodnosc z produktem,
- brak vendor theater i przegadania,
- latwa wersjonowalnosc.

### 3.2 Persona fallback

Fallback persona moze byc potrzebna jako safety net.
Nie moze jednak byc rownoleglym ukrytym "lepszym promptem", bo wtedy prompt governance jest iluzja.

### 3.3 Client-side system overlays

Client może przekazywac:
- mode hints,
- short structured overrides,
- contextual intent.

Client nie powinien pozostac dlugoterminowym ownerem calej konsultingowej persony.

### 3.4 Co-thinker prompts

Te prompty powinny byc modifierami, nie osobnymi alternatywnymi swiatami produktu.

### 3.5 Retrieval and evidence text

To nie sa prompty tozsamosciowe.
To evidence addons.
Ich rola jest inna i nie powinna konkurowac z base persona layer.

---

## 4. Quality risks found in current runtime model

### 4.1 Competing base personas

Najwieksze ryzyko jakosciowe:
- prompt registry moze definiowac base role,
- fallback persona moze definiowac inna,
- klient moze dosylac jeszcze trzecia, duza konsultingowa narracje.

To prowadzi do:
- niestabilnego tonu,
- sprzecznych instrukcji,
- trudniejszego debugowania odpowiedzi,
- slabego prompt governance.

### 4.2 Language instruction duplication

Kilka warstw promptow moze jednoczesnie mowic modelowi:
- odpowiadaj w jezyku UI,
- odpowiadaj w jezyku usera,
- stosuj language hint z co-thinkera.

To ryzyko:
- mixed-language output,
- wasted tokens,
- hidden instruction conflicts.

### 4.3 Oversized prompt stack

Jesli prompt ma jednoczesnie:
- dluga persone,
- governance,
- context,
- memory,
- retrieval,
- co-thinker,
- research blocks,
- adaptive style,

to latwo dojsc do punktu, w ktorym model widzi za duzo konkurencyjnych nakazow.

### 4.4 Retrieval pretending to be knowledge

Metadata about docs, snippets z webu i help context nie sa tym samym co stabilna, reviewable evidence layer.
Prompt content musi to rozrozniac.

### 4.5 Over-formatting

Prompty konsultingowe czesto wpadaja w pulapke:
- zbyt wielu frameworkow naraz,
- przesadnej liczby sekcji,
- obowiązkowych formatow tam, gdzie user oczekuje prostoty.

To zabija naturalnosc odpowiedzi.

---

## 5. Canonical quality rules for prompt content

### 5.1 One base identity rule

Canonical chat should have one authoritative base identity.

This identity should define:
- rola asystenta,
- glowny styl,
- poziom profesjonalizmu,
- expected decision posture,
- trust posture.

It should not define again:
- all retrieval rules,
- all mode rules,
- all UI-specific formatting,

if these are already separate prompt layers.

### 5.2 Modifier-not-replacement rule

Co-thinker, deep research, private mode, response style i inne modes powinny modyfikowac base behavior, a nie zastępować cały rdzeń promptu.

### 5.3 Short-core rule

Base prompt should be as short as possible while still:
- anchoring identity,
- anchoring governance,
- anchoring quality bar.

Everything else should be layered contextually.

### 5.4 Product-truth rule

Prompt content cannot promise:
- abilities product does not expose,
- guarantees runtime does not provide,
- sources the system did not really use.

### 5.5 No hidden override rule

If one prompt source can silently dominate another, docs must say so.
Preferably, architecture should reduce such dominance.

---

## 6. Prompt content structure standard

Canonical chat prompt content should be organized conceptually into:

1. `Identity`
2. `Governance`
3. `Core quality expectations`
4. `Mode modifiers`
5. `Evidence/retrieval addons`
6. `Output-format constraints only when needed`

This order is important because many current prompt problems come from mixing these layers together.

---

## 7. Standards for specific prompt types

### 7.1 Base persona prompt

Must define:
- kim jest asystent,
- czego pilnuje,
- jaki ma poziom business rigor,
- jak zachowuje sie wobec niepewnosci.

Must not overdefine:
- every output template,
- every mode,
- every domain workflow.

### 7.2 Co-thinker prompt

Must define:
- what perspective changes,
- what extra rigor it adds,
- what it should question or emphasize.

Must not redefine:
- whole product identity,
- whole governance model.

### 7.3 Retrieval addon

Must define:
- what evidence is available,
- how it should be used,
- how confidence/citation behavior should work.

Must not impersonate:
- memory,
- org policy,
- base persona.

### 7.4 Custom instructions

Must personalize style and preference.

Must not:
- override governance,
- fabricate permissions,
- break private mode semantics.

---

## 8. Quality evaluation checklist

When reviewing any important chat prompt, ask:

1. Czy wiadomo, kto jest ownerem tego promptu?
2. Czy prompt dodaje nowa wartosc, czy duplikuje juz istniejaca warstwe?
3. Czy prompt wprowadza jedna jasna role, czy kilka konkurencyjnych rol?
4. Czy jezyk i ton sa zgodne z product promise?
5. Czy prompt wymusza za duzo struktury przy prostych pytaniach?
6. Czy prompt jest uczciwy wobec sources, permissions i certainty?
7. Czy prompt wspiera tryby produktu, zamiast je rozmywac?
8. Czy prompt da sie wersjonowac i debugowac?

---

## 9. Recommended improvements to target

### 9.1 Reduce client persona weight

Long, hardcoded client-side consultant prompts should be progressively replaced by:
- canonical registry base prompt,
- short client-side overrides only where needed.

### 9.2 Unify language policy

One language rule should dominate.
Other prompt layers should reference it, not restate it differently.

### 9.3 Make co-thinker prompts comparative

Each co-thinker should be documented by:
- core behavioral difference,
- intended use case,
- expected tradeoffs,
- evaluation criteria.

### 9.4 Add prompt budget discipline

Prompt content quality is not only semantic.
It is also about:
- token economy,
- instruction salience,
- avoiding dilution.

### 9.5 Align prompt content with evals

Prompt content should not be changed without:
- clear objective,
- regression awareness,
- quality measurement for affected use cases.

---

## 10. Anti-patterns

- three different prompts all define the assistant identity,
- language policy repeated in inconsistent ways,
- giant consultant manifesto appended to every chat,
- co-thinker redefining the whole assistant instead of modifying one dimension,
- evidence text formatted as if it were certain truth,
- prompt changes made because they "sound better" instead of because they improve outcomes.

---

## 11. Definition of done

Prompt content quality is complete only when:
- one base identity clearly dominates,
- modifier prompts are clearly scoped,
- language policy is singular,
- prompt content is concise enough to preserve salience,
- quality checklist can be applied to any important prompt source,
- changes to prompt content can be reasoned about and reviewed systematically.

Related specs:
- `CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`
- `CHAT_V8_PROMPT_MASTERY_GAP_MATRIX.md`
- `CHAT_V8_AI_GOVERNANCE.md`
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `CHAT_V8_RESPONSE_MODEL.md`
