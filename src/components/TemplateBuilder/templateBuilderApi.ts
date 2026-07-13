/**
 * templateBuilderApi — zapis szablonu do żywej fasady
 * `POST /api/deliverables/templates` (deliverableTemplates.routes.ts →
 * createDeliverableTemplate). Body = draftToPostBody() (1:1 kontrakt).
 *
 * Wzorzec fetch identyczny z useDeliverableTemplates (credentials:'include').
 * Silników generacji NIE dotyka — tylko struktura template'u.
 */

import { draftToPostBody, type TemplateDraft } from './templateBuilderModel';

export interface SavedTemplate {
  id: string;
  type: string;
  name: string;
}

export async function saveTemplate(draft: TemplateDraft): Promise<SavedTemplate> {
  const body = draftToPostBody(draft);
  const res = await fetch('/api/deliverables/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Zapis szablonu nie powiódł się (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = String(data.error);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = await res.json();
  const tpl = data.template ?? data;
  return { id: tpl.id, type: tpl.type, name: tpl.name };
}
