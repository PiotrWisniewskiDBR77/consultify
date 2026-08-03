---
doc_kind: UI_PRIMITIVE_INTERACTION_CONTRACT
spec_status: APPROVED_SPEC
runtime_status: PARTIAL
owner: Piotr Wisniewski
last_updated: 2026-08-02
authority: docs/ui-standards/CANON.md
---

# Kontrakt interakcji primitives

Implementacja preferuje natywny HTML oraz Radix-compatible behavior. Każdy primitive musi spełnić poniższy kontrakt niezależnie od stylu.

## 1. Wspólne reguły

- każdy trigger jest `button` lub semantycznym linkiem, nie klikalnym `div`;
- icon-only ma `aria-label` i tooltip, etykieta nie powtarza „button”;
- focus jest zawsze widoczny i niezasłonięty;
- `disabled` blokuje focus/akcję; jeśli powód jest istotny, używamy `aria-disabled` i tekstu wyjaśnienia;
- overlay jest portaled, respektuje 12 px viewport clearance i wykrywa kolizje;
- zamknięcie przywraca focus do triggera, chyba że trigger przestał istnieć — wtedy do logicznego następcy;
- pointer i keyboard prowadzą do identycznego skutku;
- target minimum 36×36 desktop, 44×44 touch; absolutne minimum WCAG 24×24 z odstępem.

## 2. Kontrakty

| Primitive | Semantyka | Klawiatura | Focus i dismiss | Wymiar |
|---|---|---|---|---|
| Button | native `button`; role przez typ/variant | Enter/Space | focus pozostaje; pending nie usuwa etykiety | h36, prominent h40 |
| Tooltip | opis pomocniczy, nie interaktywna treść | focus/hover otwiera, Esc zamyka | bez trap; opóźnienie 400 ms, natychmiast w grupie | max 320 |
| Dropdown/Context menu | `menu/menuitem`; checkbox/radio role gdy potrzeba | arrows, Home/End, Enter/Space, Esc, typeahead | focus do pierwszej/wybranej; restore trigger | item h36, min w200 |
| Popover | dialog non-modal lub opisany region | Tab naturalny, Esc zamyka | bez trap; outside dismiss; restore | max w320 |
| Modal dialog | `dialog`, `aria-modal=true`, label/description | Tab trap, Shift+Tab, Esc jeśli bezpieczne | initial focus na tytule lub bezpiecznej akcji; restore | w480/640/800 |
| Alert dialog | `alertdialog` | Tab trap; Esc zgodnie z polityką | initial focus na Cancel przy destrukcji | w480 |
| Drawer/Sheet | modal dialog dla create/edit; complementary non-modal dla preview | jak dialog; preview Esc zamyka | preview nie blokuje listy; edit ma trap | w360/420 |
| Combobox | `combobox` + listbox/option | arrows, Enter, Esc, typeahead | focus pozostaje w input; `aria-activedescendant` | h36 |
| Select | button + listbox/menu zgodnie z modelem | arrows, Enter/Space, Esc, typeahead | selected option initial | h36 |
| Tabs | tablist/tab/tabpanel | arrows, Home/End; activation automatic tylko przy instant panel | roving tabindex | h36 |
| Toolbar | toolbar + label | arrows/Home/End; Tab wchodzi raz | roving tabindex | control 32/36 |
| Accordion | heading + button, region opcjonalny | Enter/Space; arrows gdy grupa | focus na triggerze | trigger min h36 |
| Toast | status dla info/success, alert dla blocking error | focus tylko gdy ma akcję | nie kradnie focusu; pause hover/focus | 4–8 s; persistent dla error |
| Drag/drop | list/grid/tree zależnie od danych | Space podnosi, arrows przesuwają, Space upuszcza, Esc anuluje | live region ogłasza wynik | uchwyt 36 |

## 3. Menu i parytet akcji

Toolbar pokazuje akcje częste. Kebab pokazuje kompletny zestaw rekordu. Context menu może optymalizować eksperta, ale żadna funkcja nie może istnieć wyłącznie w prawym kliknięciu. Ta sama akcja zachowuje ID, nazwę, ikonę, capability, shortcut i rezultat.

Grupy menu: open/preview; edit/organize; share/link; automation/AI; destructive na końcu po separatorze. Maksymalnie jeden poziom submenu.

## 4. Async, error i recovery

Akcja mutująca pokazuje pending, blokuje duplikację, otrzymuje server read-back i kończy success albo konkretnym błędem z retry/recovery. Optimistic UI wymaga rollbacku. Spinner bez limitu i silent no-op są zakazane.

## 5. Test matrix

Każdy primitive: mouse, keyboard-only, VoiceOver/NVDA smoke, light/dark, 125% i 200%, reduced motion, long label PL/EN, disabled, loading, error, nested overlay, viewport collision oraz focus restoration.
