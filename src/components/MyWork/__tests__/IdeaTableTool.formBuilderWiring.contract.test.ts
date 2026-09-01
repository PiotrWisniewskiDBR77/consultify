import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../IdeaTableTool.tsx'), 'utf8');
const formsIndexSource = fs.readFileSync(
  path.resolve(__dirname, '../table/forms/FormsIndex.tsx'),
  'utf8'
);

// Regression guard for the "kreator formularzy nie zapisuje nic" incident
// (2026-09-01). The old "Form Builder" modal in IdeaTableTool.tsx rendered
// FormBuilder with a hardcoded literal `form` object (`id: \`form-${ideaId}\``,
// `config: { fields: [] }`) created fresh on every open, and its `onSave`/
// `onDelete` never called any API — onSave unconditionally fired a success
// toast and closed the modal, onDelete just closed the modal. Every
// configured field, publish flag, submit message, and redirect URL was
// silently discarded; the "opublikowany" form was never actually live.
//
// The fix does not patch that modal — it removes it and reroutes all three
// "Form Builder" entry points to the platform's `forms` tab, which already
// renders `<FormsIndex>`: a fully-wired component (real
// TablePlatformApi.createForm/listForms/updateForm/deleteForm calls, a
// loaded-from-backend `forms` list, toasts only after the real mutation
// settles). Reusing that existing, already-correct mechanism instead of
// duplicating a second (still-fixable-independently-broken) save path is the
// point of this fix — this test guards both halves: the dead literal-object
// modal must stay gone, and every trigger must still reach FormsIndex.
describe('Idea Table Form Builder wiring contract', () => {
  it('does not reintroduce the hardcoded-literal FormBuilder modal', () => {
    // The literal object that was invented fresh on every open instead of
    // being loaded from the backend.
    expect(source).not.toContain("name: t('ideas.table.newForm', 'New Form')");
    expect(source).not.toContain('config: { fields: [] }');
    // The unconditional-success onSave/onDelete pair that never called an API.
    expect(source).not.toContain("toast.success(t('ideas.table.formSaved', 'Form saved'))");
    expect(source).not.toContain('showFormBuilder');
    // The standalone <FormBuilder> mount this incident traces to — FormBuilder
    // remains a legitimate import inside FormsIndex.tsx, just not mounted
    // directly by IdeaTableTool.tsx with a fabricated `form` prop.
    expect(source).not.toMatch(/<FormBuilder\b/);
    expect(source).not.toContain("import FormBuilder from './table/FormBuilder'");
  });

  it('routes every "Form Builder" trigger to the already-wired Forms tab', () => {
    // All three entry points (Platforma overflow menu, direct-open toolbar
    // button, Tools dropdown "Build" section) must switch to the tab that
    // renders <FormsIndex>, not open a dead local modal.
    const formBuilderTriggerCount = (source.match(/setPlatformTab\('forms'\)/g) ?? []).length;
    expect(formBuilderTriggerCount).toBeGreaterThanOrEqual(3);

    expect(source).toContain("import { FormsIndex } from './table/forms/FormsIndex';");
    expect(source).toContain("platformTab === 'forms' ? (");
    expect(source).toContain('<FormsIndex');
  });

  it('FormsIndex only announces success after the real API call resolves', () => {
    // Guards the mechanism this fix now relies on: create/update await the
    // real TablePlatformApi call before any toast fires, and errors are
    // reported (not swallowed into a false-positive "saved").
    expect(formsIndexSource).toContain('await TablePlatformApi.updateForm(editingForm.id, updates)');
    expect(formsIndexSource).toContain('await TablePlatformApi.createForm(tableId,');
    expect(formsIndexSource).toContain('await TablePlatformApi.deleteForm(formId)');
    expect(formsIndexSource).toMatch(/catch\s*\{\s*\n\s*toast\.error/);
  });
});
