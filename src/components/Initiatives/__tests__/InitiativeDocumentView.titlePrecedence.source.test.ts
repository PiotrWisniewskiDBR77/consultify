/**
 * @vitest-environment node
 *
 * [ODMROZENIE 05_INITIATIVES DEC-453] D-4b (odbiór W2B 20260910,
 * `ODBIOR_W2B_INICJATYWY_REALIZACJA_20260910.md` §1.1) — dwa różne tytuły
 * tego samego rekordu: rejestr (lista) pokazywał „Wdrożenie sieci czujników
 * IoT" (polski), karta tej samej inicjatywy — „IoT Sensor Network
 * Deployment" (angielski).
 *
 * POMIAR ŹRÓDŁA (kopia `consultify_staging_1009`, `consultify_kopia_s12a`,
 * org DBR77, rekord `e3b0a66a-dc86-4730-84e0-cdffb66cbed6`): tabela
 * `initiatives` niesie DWIE niezależne kolumny — `name` = „Wdrożenie sieci
 * czujników IoT" (polski, bieżący — dokładnie ten, który renderuje rejestr,
 * `initiativeRegisterProjection.ts`: `name: row.name || row.title || …`) i
 * `title` = „IoT Sensor Network Deployment" (angielski, zastany ślad
 * pierwotnego draftu AI, nigdy nieaktualizowany). `GET
 * /api/v8/planning/initiatives/:id` (`getInitiativeDetailRead`) tłumaczy pole
 * `name` przez `getMultilingualText`, ale zwraca surowe `title` BEZ ZMIAN —
 * czyli `data.title` było prawie zawsze wypełnione i zawsze wygrywało w
 * `data.title || data.name`, którego karta używała do `titleDraft` (H1
 * nagłówka karty, patrz `title={titleDraft || initiative?.name || ''}`
 * niżej w tym samym pliku).
 *
 * NAPRAWA: odwrócić kolejność na `data.name || data.title` — ten sam
 * pierwszy wybór, którego używa rejestr. Rekordy z jednym kanonicznym
 * pisarzem (`toInitiativeDocumentFromRegistration` dla runtime-v1-only)
 * ustawiają `title` i `name` na tę samą wartość, więc zamiana kolejności ich
 * nie dotyka — zero regresji na ścieżce D-3.
 *
 * Dlaczego na ŹRÓDLE: `InitiativeDocumentView` ma kilka tysięcy linii i
 * zależy od całego drzewa modułu — montowanie w vitest jest kosztowne i
 * kruche (ten sam wzorzec co `ExecutionHub.*.source.test.ts`).
 *
 * MUTACJA (weryfikacja ręczna): przywrócenie `data.title || data.name` →
 * test czerwony.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const view = readFileSync(new URL('../InitiativeDocumentView.tsx', import.meta.url), 'utf8');

describe('D-4b — InitiativeDocumentView czyta tytuł tak samo jak rejestr (name pierwsze)', () => {
  it('setTitleDraft preferuje data.name nad data.title (ten sam rekord = ten sam tytuł co lista)', () => {
    expect(view).toContain("setTitleDraft(String(data.name || data.title || '').trim());");
    expect(view).not.toContain("setTitleDraft(String(data.title || data.name || '').trim());");
  });

  it('na zmierzonych wartościach rekordu e3b0a66a-… daje ten sam tytuł co rejestr', () => {
    // Zmierzone na `consultify_kopia_s12a` (TEMPLATE consultify_staging_1009):
    //   SELECT name, title FROM initiatives WHERE id='e3b0a66a-dc86-4730-84e0-cdffb66cbed6';
    //   name  = 'Wdrożenie sieci czujników IoT'  (polski, bieżący — to samo co rejestr)
    //   title = 'IoT Sensor Network Deployment'  (angielski, zastały ślad draftu AI)
    const data = {
      name: 'Wdrożenie sieci czujników IoT',
      title: 'IoT Sensor Network Deployment',
    };
    // eslint-disable-next-line no-new-func -- odtworzenie DOKŁADNEGO wyrażenia z pliku źródłowego
    const evaluate = new Function('data', 'return String(data.name || data.title || "").trim();');
    expect(evaluate(data)).toBe('Wdrożenie sieci czujników IoT');

    // Rejestr (`initiativeRegisterProjection.ts` → toCanonicalInitiativeRegisterItemFromLegacyRow)
    // dla tego samego wiersza: `name: row.name || row.title || row.summary || row.id`
    const registerName = data.name || (data as any).title || (data as any).summary || 'id';
    expect(evaluate(data)).toBe(registerName);
  });

  it('rekord runtime-v1-only (title===name z toInitiativeDocumentFromRegistration) jest nietknięty', () => {
    const data = { name: 'Szkic inicjatywy AI', title: 'Szkic inicjatywy AI' };
    // eslint-disable-next-line no-new-func
    const evaluate = new Function('data', 'return String(data.name || data.title || "").trim();');
    expect(evaluate(data)).toBe('Szkic inicjatywy AI');
  });
});
