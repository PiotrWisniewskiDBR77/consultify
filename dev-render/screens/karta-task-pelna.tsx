/**
 * dev-render host dla `karta-task-pelna` — PEŁNY rekord zadania
 * (`src/components/MyWork/TaskDetailView.tsx`), widok po double-click, NIE
 * preview.
 *
 * ★ SPROSTOWANIE WOBEC BRIEFU (zweryfikowane w źródle, nie zgadywane):
 * dyżur zlecający ten ekran zakładał, że `dev-render/screens/karta-task.tsx`
 * to podgląd (preview) i że pełny rekord jest osobną, brakującą powierzchnią.
 * To NIEPRAWDA — `karta-task.tsx` JUŻ hostuje REALNY `<TaskDetailView>`
 * dokładnie w tym samym trybie, o który prosi ten dyżur:
 *
 *   - `TaskDetailView` (8837 linii) jest montowany w
 *     `MyWorkHub.tsx` WYŁĄCZNIE w `renderDocumentContent()`
 *     (komentarz w kodzie: "Render document content (full view)",
 *     MyWorkHub.tsx:3882-3897) — czyli po double-click na wiersz zadania,
 *     nie w panelu podglądu jednego kliknięcia.
 *   - `TaskDetailViewProps` (TaskDetailView.tsx:165-170) NIE MA żadnego
 *     `mode`/`variant` — grep na te słowa w pliku = 0 trafień. Komponent nie
 *     zna trybu "preview" — renderuje się zawsze jako pełna powłoka N-mode
 *     (NModeHeader + NModeLeftNav + NModeCanvas + ArtifactRightPanel,
 *     archetyp C·Rekord wg SPEC-A).
 *
 * Wniosek: duplikowanie ~500 linii mocka `karta-task.tsx` pod nowym id
 * groziłoby rozjazdem dwóch kopii tego samego stanu demo. Ten plik zamiast
 * tego RE-EKSPORTUJE ten sam, już kompletny ekran pod id `karta-task-pelna`
 * — żeby dostał swój PIERWSZY zrzut/odbiór wzrokiem pod nazwą, której
 * oczekuje ten dyżur (kod-wzorzec wg `_FORMULA_MENU_NARZEDZI_12.md`,
 * "nigdy nie odebrany wzrokiem" — patrz nagłówek `karta-task.tsx` po pełny
 * opis mocka, danych i pułapek API).
 *
 * URL: ?screen=karta-task-pelna[&lang=pl|en][&theme=light|dark][&dane=pelne]
 */
export { KartaTaskScreen as default, KartaTaskScreen } from './karta-task';
