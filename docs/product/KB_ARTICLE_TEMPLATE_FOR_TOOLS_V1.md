# KB Article Template For Tools V1

> Status: proposed foundation  
> Scope: Help Center article for each tool

---

## 1. Purpose

Each tool must have one canonical Help Center article.

The article is written for the sidebar Help Center, not for marketing pages and not for an internal methodology encyclopedia.

It should help the user quickly answer:

- what this tool is for,
- when to use it,
- what input it needs,
- how to run it,
- how to interpret the result,
- what outputs can be created from it.

---

## 2. Canonical metadata

Required metadata:

- slug: `tools-<toolType>-how-to`
- related_modules: `[\"<toolType>\"]`
- category: `tools-features`
- status: `published`
- translations: `en`, `pl`

Recommended:

- `reading_time_minutes`
- `video_script`
- `thumbnail_url`
- `video_url`
- `video_teaser_url`

---

## 3. Canonical article structure

Use the same structure for every tool article.

### Title

`How to use: <Tool Name>`

### Summary

One or two sentences:

- what the tool does,
- what kind of result the user gets.

### Section 1. Purpose / when to use

Explain:

- what problem this tool solves,
- when it is the right choice,
- when it is not the best tool.

### Section 2. What you need before you start

List:

- minimum inputs,
- optional inputs,
- evidence / examples,
- useful preparation tips.

### Section 3. How the flow works

Describe the actual runtime stages.

Use the real product stages, not abstract textbook steps.

### Section 4. How to interpret the result

Explain:

- what the user should look for,
- how to separate evidence from assumptions,
- how to use the most important patterns,
- what “good” output looks like.

### Section 5. Common mistakes

Use a short list of:

- modeling mistakes,
- reasoning mistakes,
- UX mistakes,
- decision mistakes.

### Section 6. Example

Provide a short, realistic example that shows:

- one input,
- one insight,
- one resulting action or output.

### Section 7. Outputs in Consultify

Always mention:

- initiative,
- report,
- presentation,
- idea.

This section should explicitly tell the user that the tool is not a dead end.

### Section 8. Quick checklist

Close with a short checklist the user can scan in seconds.

---

## 4. Authoring rules

The article should be:

- concise,
- practical,
- consulting-grade,
- product-aligned,
- bilingual-ready.

The article should not be:

- overly academic,
- verbose,
- generic,
- disconnected from the real runtime.

---

## 5. Reusable EN template

```md
# <Tool Name> — How to use

## Purpose / when to use
Use this tool when ...

## What you need before you start
- Input 1
- Input 2
- Input 3

## How the flow works
1) Stage 1
2) Stage 2
3) Stage 3
4) Stage 4
5) Outputs

## How to interpret the result
Look for ...

## Common mistakes
- Mistake 1
- Mistake 2
- Mistake 3

## Example
Example:

## Outputs in Consultify
From this tool you can create:
- Initiative
- Report
- Presentation
- Idea

## Quick checklist
- Goal is clear
- Inputs are concrete
- Evidence is visible
- Result was translated into outputs
```

---

## 6. Reusable PL template

```md
# <Nazwa narzędzia> — Jak używać

## Kiedy używać
Użyj tego narzędzia gdy ...

## Co przygotować przed startem
- Input 1
- Input 2
- Input 3

## Jak działa flow
1) Etap 1
2) Etap 2
3) Etap 3
4) Etap 4
5) Outputy

## Jak interpretować wynik
Szukaj ...

## Typowe błędy
- Błąd 1
- Błąd 2
- Błąd 3

## Przykład
Przykład:

## Outputy w Consultify
Z tego narzędzia możesz utworzyć:
- Inicjatywę
- Raport
- Prezentację
- Pomysł

## Szybka checklista
- Cel jest jasny
- Inputy są konkretne
- Evidence jest widoczne
- Wynik został przełożony na outputy
```
