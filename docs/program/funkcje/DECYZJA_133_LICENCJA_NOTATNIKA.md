---
doc_id: funkcje-decyzja-133-licencja
status: canonical
truth_type: process
established: 2026-08-30
---

# Decyzja nadzorcy — dyżur 133, rozszerzenie licencji o notatnik

**STOP dyżuru 133 jest ZASADNY. Przyczyna leży w mojej instrukcji, nie w wykonaniu.**

## Co zgłosił wykonawca i dlaczego ma rację

Instrukcja żądała dwóch rzeczy naraz, których **nie da się spełnić jednocześnie**:

- `W-C` — `Promise<void>` ma być **błędem kompilacji** dla callbacku mutacyjnego;
- `Z40` — `NotebookAttachmentsSection.tsx` jest **nietykalny do zapisu**.

Notatnik przekazuje `onUpload` i `onDelete` typu `Promise<void>` **wprost** do
`AttachmentsSection`. Zmiana kontraktu widżetu wywraca kompilację notatnika.
Wykonawca udowodnił to **minimalną reprodukcją kompilatora**:

```text
error TS2322: Type '(files: FileList) => Promise<void>' is not assignable to
type '(files: FileList) => Promise<MutationResult>'.
```

Nie obszedł tego rzutowaniem, unią ani przeciążeniem — i **słusznie**, bo każde
z tych obejść pozornie spełniłoby `W-C`, nie wdrażając kontraktu.

## Decyzja — licencja rozszerzona imiennie

`src/components/MyWork/notebook/NotebookAttachmentsSection.tsx` otrzymuje
**wąską licencję zapisu** o zakresie **wyłącznie typów i adaptacji wywołania**:

- wolno zmienić typ dwóch propsów mutacyjnych (`onUpload`, `onDelete`) na wynik
  dyskryminowany i dostosować miejsce, w którym notatnik je tworzy;
- **nie wolno** zmienić zachowania, układu, tekstów ani ścieżki pobierania
  (`Api.downloadNotebookAttachment` zostaje nietknięte);
- **nie wolno** ukryć porażki adapterem zwracającym zawsze sukces.

**Pozycja `R2` zmienia treść.** Zamiast „udowodnij, że nie zmieniłeś notatnika”
obowiązuje: **udowodnij, że notatnik nadal działa po zmianie typów** — test
behawioralny przechodzący przez `NotebookAttachmentsSection`, plus para
`RED → GREEN` z `W-A`.

## Co zostaje bez zmian

Zakaz dotykania `src/components/Initiatives/**` **obowiązuje dalej** — tam żyje
druga kopia tych widżetów i należy do innego dyżuru. Reszta tabeli licencji bez zmian.

## ★★ Znalezisko `R4`, ważniejsze niż sam kontrakt

Pomiar statyczny wykonawcy: `handleAddComment` w `TaskDetailView.tsx`
i `DecisionDetailView.tsx` wykonuje **wyłącznie `setComments`** — zero wywołań
`fetch`, `Api`, `axios` czy `V8MyWorkApi`. Usuwanie i polubienie też są lokalne.

**To zmienia opis problemu.** Zakładaliśmy, że zapis zawodzi i produkt kłamie,
że się udał. Prawda jest ostrzejsza: **dla komentarzy Zadania i Decyzji zapisu
nie ma w ogóle** — istnienie tras `my-work.routes.ts` niczego nie dowodzi, bo
te handlery ich nie wołają. Kontrakt mutacji jest konieczny, ale **nie wystarczy**:
bez podpięcia wołacza wynik dyskryminowany będzie uczciwie raportował porażkę
operacji, której nikt nie próbuje wykonać.

Do rejestru wchodzi jako osobna pozycja `DO_ZBUDOWANIA` z dowodem nieistnienia.

## Mój szósty błąd autorski — ten sam kształt, co pięć poprzednich

Zabroniłem dotykać pliku, przez który **przepływa typ**, który kazałem zmienić.
Sprzeczność z konstrukcji, niewykrywalna bez próby wdrożenia. Poprawka wpisana
do szkieletu jako `A.1-BIS (4)`: przed zakazem dotykania pliku sprawdź
`grep -rl "<NazwaWidzetu>" src/ --include='*.tsx'` i **każdego konsumenta albo
wpuść do licencji, albo zaprojektuj zmianę inaczej**.
