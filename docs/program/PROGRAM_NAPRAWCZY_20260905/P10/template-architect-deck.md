# Architekt wzorca prezentacji (`template-architect-deck`)

**Status:** PROPOZYCJA — do słowa właściciela. Karta #59 inwentarza, moduł `11_MATERIALS`.
**Klon** `template-architect-doc.md` (#58) — komentarz nagłówkowy pliku źródłowego mówi to wprost:
„Klon wzorca `DocumentStudio/DocumentStudioTemplateArchitectView.tsx` dostosowany do decka".
Cała analiza K1–K30 z #58 stosuje się tu 1:1; ten plik niesie TYLKO różnice zmierzone w kodzie.

## §0. Tożsamość (różnice od #58)

- Nazwa PL: **Architekt wzorca prezentacji**. Otwarcie: `ReportsAndPresentationsHub.tsx:1341`
  (nie zakładka Document Studio — osobny hub, ale ten sam BRAK powłoki).
- Komponent: `src/components/Presentations/PresentationTemplateArchitectView.tsx:1` (1853 linii,
  większy niż bliźniak — dokłada `SlideSilhouette`, edycję konturu slajdów rename/reorder/add/
  remove). **Zero `ArtifactRightPanel`/`ExecutiveModuleShell`/`RightRail`** — identyczne zero
  trafień jak w #58.
- Governance: TU realnie istnieje osobny SuperAdmin ekran —
  `src/views/superadmin/PresentationTemplateGovernanceView.tsx` (potwierdzony komentarzem
  nagłówkowym pliku: „Governance (approve/deprecate/lineage/audit) is a separate, existing
  SuperAdmin surface — this view only owns drafting + manual outline editing").
- **Tożsamość rekordu**: TA SAMA luka — `selectedTemplateId` lokalny stan (`:226`), nie URL.
  Dodatkowo: `fetchTemplateLineage(selectedTemplateId)` (`:365-373`) pokazuje, że backend MA
  pojęcie „lineage" (historia wersji/pochodzenia wzorca) — funkcjonalny odpowiednik „Historii" z
  K10 istnieje w danych, tylko nie jest wystawiony przez kanoniczny prawy panel.
- Serwerowy invariant: `assertEditableLifecycle` (`presentations.routes.ts:1147`) — tylko wzorce
  w statusie `draft` można edytować w miejscu; zatwierdzony/wycofany dostaje „Clone as new draft"
  zamiast edycji w miejscu (ten sam wzorzec cyklu życia co `_wzorzec-raport-dokument.md`
  szkic→opublikowany, ale tu dla WZORCA, nie dla dokumentu końcowego).

## §1–§7. Bez zmian względem #58

Zero powłoki kanonu, zero `PracujZAI`, brak tożsamości URL, brak zrzutu żywego w tej partii.
Ta sama rekomendacja: nie łatać punktowo, ocena architektoniczna razem z #57/#58 — czy te dwa
architekty i `TemplateBuilderShell` (#57) powinny być JEDNYM przepływem zamiast trzech osobnych
implementacji tego samego pomysłu („stwórz/edytuj wzorzec"). **Do decyzji właściciela.**

**STOP:** brak zrzutu żywego (K30), jak w #58 — priorytet partii poszedł do dokumentu/prezentacji/
arkusza/sejfu.
